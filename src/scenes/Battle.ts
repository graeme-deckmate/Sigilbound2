import Phaser from 'phaser';
import type { BossId, ElementId, GameState } from '../core/state.ts';
import type { ZoneId } from '../data/formations.ts';
import { mulberry32, type Rng } from '../core/rng.ts';
import {
  commitBattle,
  initBattle,
  initBossBattle,
  reduce,
  type BattleEvent,
  type BattleState,
  type UiSnapshot,
} from '../systems/battle.ts';
import { battleLine } from '../systems/battlelog.ts';
import { spellTargeting } from '../systems/spellcraft.ts';
import { xpNext } from '../systems/leveling.ts';
import type { EncounterRoll } from '../systems/encounters.ts';
import { SAY_MIN_MS, SAY_PER_CHAR_MS, TEXT_SPEED_MULT, ZONE_BACKDROPS } from '../data/constants.ts';
import { ELEMENTS } from '../data/elements.ts';
import { BATTLE_SPRITES } from '../render/grids.ts';
import { textureFromGrid } from '../render/sprites.ts';
import { FloaterPool, burst } from '../render/fx.ts';
import * as dom from '../render/dom.ts';
import * as bdom from '../render/battledom.ts';
import { playMusic } from '../audio/music.ts';
import { playSfx } from '../audio/synth.ts';

export interface BattleResult {
  outcome: 'victory' | 'defeat' | 'fled';
  state: GameState;
  xpGained: number;
  levelsGained: number[];
  essenceGained: number;
  essenceLost: number;
  bossId?: BossId;
}

interface BattleSceneData {
  state: GameState;
  seed: number;
  onDone: (result: BattleResult) => void;
  /** Wild encounters. */
  encounter?: EncounterRoll;
  /** Boss fights (takes precedence). */
  bossId?: BossId;
  zone?: ZoneId | null;
}

const FLASH_MS = 120;
const SILENT_BEAT_MS = 420;

export class BattleScene extends Phaser.Scene {
  private params!: BattleSceneData;
  private battle!: BattleState;
  private names: string[] = [];
  private isBoss: boolean[] = [];
  private rng: Rng = mulberry32(1);
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private bobTweens = new Map<number, Phaser.Tweens.Tween>();
  private baseY = new Map<number, number>();
  private floaters!: FloaterPool;
  private attuneAura: Phaser.GameObjects.Ellipse | null = null;
  private finishing = false;
  /** prefers-reduced-motion gates shakes and full-screen camera flashes. */
  private motionOk = true;

  constructor() {
    super({ key: 'Battle' });
  }

  init(data: BattleSceneData): void {
    this.params = data;
    this.finishing = false;
    this.sprites.clear();
    this.bobTweens.clear();
    this.baseY.clear();
    this.attuneAura = null;
  }

  create(): void {
    this.motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.rng = mulberry32(this.params.seed);
    let setup;
    if (this.params.bossId) {
      setup = initBossBattle(this.params.state, this.params.bossId, this.params.zone ?? null);
    } else {
      if (!this.params.encounter) throw new Error('Battle needs an encounter or a bossId');
      const enc = this.params.encounter;
      setup = initBattle(
        this.params.state,
        enc.formation.members,
        enc.enemyLv,
        enc.zone,
        { ambush: enc.ambush, elites: enc.elites, glimmer: enc.glimmer },
        this.rng,
      );
    }
    this.battle = setup.state;
    this.names = this.battle.enemies.map((e) => e.displayName);
    this.isBoss = this.battle.enemies.map((e) => e.kind === 'boss');
    playMusic(this.params.bossId ? 'boss' : 'battle');

    this.drawBackdrop();
    this.spawnEnemySprites();
    this.floaters = new FloaterPool(this);

    dom.showTouchControls(false);
    bdom.showBattle(true);
    bdom.buildEnemyRows(this.battle);
    bdom.setLog('');
    bdom.lockCommands(true);
    this.refreshHud();

    const input = dom.ensureInput();
    const offAction = input.onAction((action) => {
      if (!this.scene.isActive()) return;
      if (action === 'cancel') {
        bdom.exitTargetMode();
        if (!this.finishing) this.playerTurn();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offAction);

    void this.play(setup.events).then(() => {
      // An ambush can end the battle before the first command.
      if (this.battle.phase !== 'player') {
        void this.finish();
        return;
      }
      this.playerTurn();
    });
  }

  /* ---------- rendering ---------- */

  private drawBackdrop(): void {
    const { width: w, height: h } = this.scale;
    const bd = ZONE_BACKDROPS[this.battle.zone ?? 'default'] ?? ZONE_BACKDROPS['default'];
    if (!bd) return;
    const color = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;
    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(color(bd.sky[0]), color(bd.sky[0]), color(bd.sky[1]), color(bd.sky[1]), 1);
    g.fillRect(0, 0, w, h * 0.72);
    for (let i = 0; i < 14; i++) {
      const hx = Math.abs(Math.sin(i * 127.1)) % 1;
      const hy = Math.abs(Math.sin(i * 311.7)) % 1;
      g.fillStyle(0xffffff, 0.15 + 0.2 * hx);
      g.fillRect(Math.floor(hx * w), Math.floor(hy * h * 0.4), 1, 1);
    }
    g.fillStyle(color(bd.hill), 1);
    g.beginPath();
    g.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 8) {
      g.lineTo(x, h * 0.62 + Math.sin(x * 0.05 + 1) * 6 - 6);
    }
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fillPath();
    g.fillStyle(color(bd.ground), 1);
    g.fillRect(0, h * 0.7, w, h * 0.3);
  }

  private spawnEnemySprites(): void {
    const { width: w, height: h } = this.scale;
    const n = this.battle.enemies.length;
    for (const enemy of this.battle.enemies) {
      const scale = enemy.kind === 'boss' ? 5 : n <= 1 ? 4 : 3;
      this.ensureBattleTextures(enemy.species);
      const x = (w * (enemy.index + 1)) / (n + 1);
      const y = h * 0.46;
      this.add.ellipse(x, y + 4, 52 * (scale / 4), 12 * (scale / 4), 0x000000, 0.3).setDepth(1);
      const sprite = this.add
        .image(x, y, `b_${enemy.species}`)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setDepth(2);
      // Elite tint rule: promoted enemies carry a gold cast.
      if (enemy.affix) sprite.setTint(0xffd9a0);
      this.sprites.set(enemy.index, sprite);
      this.baseY.set(enemy.index, y);
      const bob = this.tweens.add({
        targets: sprite,
        y: y - 3,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: enemy.index * 180,
      });
      this.bobTweens.set(enemy.index, bob);
    }
  }

  /** Sink or surface a diving boss sprite. */
  private setSubmerged(index: number, down: boolean): void {
    const sprite = this.sprites.get(index);
    const baseY = this.baseY.get(index);
    const bob = this.bobTweens.get(index);
    if (!sprite || baseY === undefined) return;
    bob?.pause();
    this.tweens.add({
      targets: sprite,
      y: baseY + (down ? 12 : 0),
      alpha: down ? 0.3 : 1,
      duration: 320,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        if (!down) bob?.resume();
      },
    });
  }

  /** Element-colored aura behind an attuning boss. Retints on each shift. */
  private setAttuneAura(index: number, element: ElementId): void {
    const sprite = this.sprites.get(index);
    const baseY = this.baseY.get(index);
    if (!sprite || baseY === undefined) return;
    const hex = ELEMENTS[element].color;
    const color = Phaser.Display.Color.HexStringToColor(hex).color;
    const cx = sprite.x;
    const cy = baseY - sprite.displayHeight / 2;
    if (!this.attuneAura) {
      this.attuneAura = this.add
        .ellipse(cx, cy, sprite.displayWidth * 1.5, sprite.displayHeight * 1.25, color, 0.22)
        .setDepth(1);
      this.tweens.add({
        targets: this.attuneAura,
        alpha: 0.7,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    this.attuneAura.setFillStyle(color, 0.22);
    burst(this, cx, cy, hex);
  }

  private ensureBattleTextures(species: string): void {
    const def = BATTLE_SPRITES[species] ?? BATTLE_SPRITES['gloop'];
    if (!def) return;
    textureFromGrid(this, `b_${species}`, def.grid, def.pal);
    const whitePal = Object.fromEntries(Object.keys(def.pal).map((k) => [k, '#ffffff']));
    textureFromGrid(this, `b_${species}_white`, def.grid, whitePal);
  }

  private flashSprite(index: number): void {
    const sprite = this.sprites.get(index);
    const enemy = this.battle.enemies[index];
    if (!sprite || !enemy) return;
    sprite.setTexture(`b_${enemy.species}_white`);
    this.time.delayedCall(FLASH_MS, () => {
      if (sprite.active) sprite.setTexture(`b_${enemy.species}`);
    });
  }

  private refreshHud(): void {
    const p = this.battle.player;
    dom.refreshHud({
      lv: p.lv,
      hp: p.hp,
      maxhp: p.maxhp,
      mp: p.mp,
      maxmp: p.maxmp,
      xp: this.params.state.player.xp,
      xpNext: xpNext(p.lv),
    });
    bdom.updateHudShield(p.veil?.shield ?? 0);
    bdom.updateHudStatuses(p.statuses);
  }

  /** Render the HUD from a moment-in-time snapshot during playback. */
  private refreshHudFrom(ui: UiSnapshot): void {
    const p = this.battle.player;
    dom.refreshHud({
      lv: p.lv,
      hp: ui.player.hp,
      maxhp: p.maxhp,
      mp: ui.player.mp,
      maxmp: p.maxmp,
      xp: this.params.state.player.xp,
      xpNext: xpNext(p.lv),
    });
    bdom.updateHudShield(ui.player.shield);
    bdom.updateHudStatuses(ui.player.statuses);
  }

  /* ---------- turn flow ---------- */

  private playerTurn(): void {
    bdom.buildCommands(this.battle, {
      onCast: (slot) => {
        this.chooseTarget(slot);
      },
      onFocus: () => {
        this.submit({ type: 'focus' });
      },
      onFlee: () => {
        this.submit({ type: 'flee' });
      },
    });
    bdom.lockCommands(false);
    bdom.setLog('Your move.');
  }

  private chooseTarget(slot: number): void {
    const spell = this.battle.player.spells[slot];
    if (!spell) return;
    if (spellTargeting(spell) !== 'single') {
      this.submit({ type: 'cast', slot });
      return;
    }
    const alive = this.battle.enemies.filter((e) => e.hp > 0);
    if (alive.length === 1 && alive[0]) {
      this.submit({ type: 'cast', slot, target: alive[0].index });
      return;
    }
    bdom.enterTargetMode(
      this.battle,
      (index) => {
        this.submit({ type: 'cast', slot, target: index });
      },
      () => {
        this.playerTurn();
      },
    );
  }

  private submit(action: Parameters<typeof reduce>[1]): void {
    bdom.lockCommands(true);
    const { state, events } = reduce(this.battle, action, this.rng);
    this.battle = state;
    void this.play(events).then(() => {
      if (this.battle.phase === 'player') {
        this.playerTurn();
        return;
      }
      void this.finish();
    });
  }

  /* ---------- event playback ---------- */

  private async play(events: BattleEvent[]): Promise<void> {
    for (const event of events) {
      this.animate(event);
      const line = battleLine(event, this.names, this.isBoss);
      if (line !== null) {
        await this.say(line);
      } else if (event.kind === 'enemyHit') {
        await this.wait(SILENT_BEAT_MS);
      }
    }
  }

  private animate(event: BattleEvent): void {
    switch (event.kind) {
      case 'playerCast': {
        playSfx('cast');
        for (const t of event.targets) {
          const sprite = this.sprites.get(t);
          if (sprite)
            burst(
              this,
              sprite.x,
              sprite.y - sprite.displayHeight / 2,
              ELEMENTS[event.element].color,
            );
        }
        // MP cost shows the moment the cast goes off.
        this.refreshHudFrom(event.ui);
        break;
      }
      case 'enemyHit': {
        playSfx('hit');
        if (event.crit) playSfx('crit');
        this.flashSprite(event.index);
        const sprite = this.sprites.get(event.index);
        if (sprite) {
          this.floaters.spawn(
            sprite.x,
            sprite.y - sprite.displayHeight,
            String(event.amount),
            event.crit ? '#ffd84a' : '#ffffff',
            event.crit,
          );
        }
        if (this.motionOk)
          this.cameras.main.shake(event.mult > 1.2 ? 160 : 100, event.mult > 1.2 ? 0.012 : 0.006);
        bdom.updateEnemyRows(event.ui.enemies);
        break;
      }
      case 'enemyDot': {
        playSfx('status_apply');
        this.flashSprite(event.index);
        const sprite = this.sprites.get(event.index);
        if (sprite) {
          const color = event.status === 'burning' ? ELEMENTS.ember.color : ELEMENTS.thorn.color;
          this.floaters.spawn(
            sprite.x,
            sprite.y - sprite.displayHeight,
            String(event.amount),
            color,
            false,
          );
        }
        bdom.updateEnemyRows(event.ui.enemies);
        break;
      }
      case 'enemyDown': {
        const sprite = this.sprites.get(event.index);
        if (sprite) {
          this.tweens.add({ targets: sprite, alpha: 0, duration: 420, ease: 'Cubic.easeIn' });
        }
        if (this.isBoss[event.index] && this.attuneAura) {
          this.tweens.killTweensOf(this.attuneAura);
          this.tweens.add({ targets: this.attuneAura, alpha: 0, duration: 420 });
        }
        bdom.updateEnemyRows(event.ui.enemies);
        break;
      }
      case 'enemyMove': {
        const sprite = this.sprites.get(event.index);
        if (sprite) {
          this.tweens.add({
            targets: sprite,
            y: sprite.y + 7,
            duration: 110,
            yoyo: true,
            ease: 'Quad.easeIn',
          });
        }
        break;
      }
      case 'enemyStatus':
        playSfx('status_apply');
        bdom.updateEnemyRows(event.ui.enemies);
        break;
      case 'enemyShield':
        playSfx('shield_up');
        bdom.updateEnemyRows(event.ui.enemies);
        break;
      case 'bossSummon': {
        playSfx('status_apply');
        const { width: w, height: h } = this.scale;
        event.spawned.forEach((s, i) => {
          const enemy = this.battle.enemies[s.index];
          if (!enemy) return;
          this.ensureBattleTextures(enemy.species);
          const x = i === 0 ? w * 0.2 : w * 0.8;
          const y = h * 0.5;
          this.add.ellipse(x, y + 3, 39, 9, 0x000000, 0.3).setDepth(1);
          const sprite = this.add
            .image(x, y, `b_${enemy.species}`)
            .setOrigin(0.5, 1)
            .setScale(3)
            .setDepth(2)
            .setAlpha(0);
          this.tweens.add({ targets: sprite, alpha: 1, duration: 350 });
          this.sprites.set(s.index, sprite);
          this.baseY.set(s.index, y);
          const bob = this.tweens.add({
            targets: sprite,
            y: y - 3,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: i * 180,
          });
          this.bobTweens.set(s.index, bob);
          this.names.push(s.name);
          this.isBoss.push(false);
        });
        bdom.buildEnemyRows(this.battle);
        break;
      }
      case 'bossAttune':
        playSfx('boss_telegraph');
        this.setAttuneAura(event.index, event.element);
        break;
      case 'bossDoom': {
        playSfx('boss_telegraph');
        const sprite = this.sprites.get(event.index);
        if (sprite) {
          this.flashSprite(event.index);
          this.tweens.add({
            targets: sprite,
            scaleX: sprite.scaleX * 1.07,
            scaleY: sprite.scaleY * 1.07,
            duration: 260,
            yoyo: true,
            ease: 'Quad.easeOut',
          });
        }
        if (this.motionOk) {
          this.cameras.main.shake(320, 0.004);
          this.cameras.main.flash(280, 26, 20, 51);
        }
        break;
      }
      case 'bossSubmerge':
        playSfx('boss_telegraph');
        this.setSubmerged(event.index, true);
        break;
      case 'bossSurface':
        this.setSubmerged(event.index, false);
        if (event.reason === 'breach' && this.motionOk) this.cameras.main.shake(200, 0.014);
        break;
      case 'playerHit':
        playSfx('hurt');
        dom.flashPanel();
        if (this.motionOk) this.cameras.main.shake(120, 0.008);
        this.refreshHudFrom(event.ui);
        break;
      case 'playerStatus':
      case 'playerDot':
      case 'mpDrain':
        playSfx('status_apply');
        this.refreshHudFrom(event.ui);
        break;
      case 'playerHeal':
      case 'focus':
        playSfx('heal');
        this.refreshHudFrom(event.ui);
        break;
      case 'veilUp':
      case 'veilReapply':
        playSfx('shield_up');
        this.refreshHudFrom(event.ui);
        break;
      case 'veilBreak':
        playSfx('shield_break');
        this.refreshHudFrom(event.ui);
        break;
      case 'playerCleanse':
        this.refreshHudFrom(event.ui);
        break;
      case 'miss':
        playSfx('deny');
        break;
      case 'fled':
        playSfx('confirm');
        break;
      case 'victory':
        playSfx('victory');
        break;
      case 'defeat':
        playSfx('defeat');
        break;
      case 'bossEnrage':
        playSfx('boss_telegraph');
        break;
      case 'ambush':
        playSfx('encounter');
        if (this.motionOk) this.cameras.main.shake(140, 0.006);
        break;
      case 'sealedHit':
        playSfx('deny');
        break;
      case 'sealBreak': {
        playSfx('shield_break');
        this.flashSprite(event.index);
        break;
      }
      case 'frenzy':
        playSfx('boss_telegraph');
        this.flashSprite(event.index);
        break;
      case 'glimmerFlee': {
        playSfx('select');
        const sprite = this.sprites.get(event.index);
        if (sprite) {
          this.tweens.add({ targets: sprite, alpha: 0, x: sprite.x + 30, duration: 420 });
        }
        bdom.updateEnemyRows(event.ui.enemies);
        break;
      }
      default:
        break;
    }
  }

  private say(text: string): Promise<void> {
    bdom.setLog(text);
    const speed = TEXT_SPEED_MULT[this.params.state.settings.textSpeed] ?? 1;
    return this.wait(Math.max(SAY_MIN_MS, SAY_PER_CHAR_MS * text.length) * speed);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }

  /* ---------- outro ---------- */

  private async finish(): Promise<void> {
    this.finishing = true;
    const phase = this.battle.phase;
    const { state, xpGained, levelsGained, essenceGained, essenceLost } = commitBattle(
      this.params.state,
      this.battle,
    );
    const outcome: BattleResult['outcome'] =
      phase === 'victory' ? 'victory' : phase === 'defeat' ? 'defeat' : 'fled';
    await this.wait(350);
    await dom.irisTransition(() => {
      bdom.showBattle(false);
      dom.showTouchControls(true);
      this.params.onDone({
        outcome,
        state,
        xpGained,
        levelsGained,
        essenceGained,
        essenceLost,
        bossId: this.params.bossId,
      });
      this.scene.wake('World');
      this.scene.stop();
    });
  }
}
