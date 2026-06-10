import Phaser from 'phaser';
import type { BossId, GameState } from '../core/state.ts';
import { save } from '../core/save.ts';
import { deriveSeed, mulberry32, type Rng } from '../core/rng.ts';
import {
  entityIndex,
  exitAt,
  tileAt,
  walkableAt,
  zoneAt,
  type CompiledMap,
  type EntityAt,
} from '../core/mapdefs.ts';
import { MAPS } from '../data/maps/index.ts';
import { TILE } from '../data/constants.ts';
import { DIALOGUE } from '../data/dialogue.ts';
import { ELEMENTS } from '../data/elements.ts';
import { FORMS } from '../data/forms.ts';
import { RUNES } from '../data/runes.ts';
import { BOSSES } from '../data/enemies.ts';
import { SCRIPTED_BATTLES } from '../data/triggers.ts';
import { maxHpAt, maxMpAt, unlocksAtLevel, xpNext } from '../systems/leveling.ts';
import type { UnlockDef } from '../data/unlocks.ts';
import type { BattleResult } from './Battle.ts';
import { resolveStep, type EncounterRoll } from '../systems/encounters.ts';
import {
  applyExit,
  applyShrineGrant,
  applySlotPurchase,
  applySpringRestore,
  facingPos,
  interactionFor,
  npcDialogueId,
  sigilCount,
} from '../systems/worldstate.ts';
import { starterSpells } from '../data/progression.ts';
import { ESSENCE } from '../data/essence.ts';
import type { ElementId } from '../core/state.ts';
import { isGrimoireOpen } from '../render/grimoire.ts';
import { isSettingsOpen } from '../render/settingsdom.ts';
import { createEntityTextures, createTilesetTexture, tileIndexFor } from '../render/tiles.ts';
import { createActorTextures, npcTextureKey } from '../render/sprites.ts';
import * as dom from '../render/dom.ts';
import { playMusic, applyAudioSettings } from '../audio/music.ts';
import { playSfx } from '../audio/synth.ts';
import type { MusicId } from '../data/audio.ts';

const STEP_MS = 160;
const ANIM_MS = 380;

function unlockToastText(unlock: UnlockDef): string {
  switch (unlock.kind) {
    case 'element':
      return `Element unlocked: ${ELEMENTS[unlock.id].label.toUpperCase()}`;
    case 'form':
      return `Form unlocked: ${FORMS[unlock.id].label.toUpperCase()}`;
    case 'rune':
      return `Rune unlocked: ${RUNES[unlock.id].label.toUpperCase()}`;
  }
}

/** One session-stable seed stream for overworld rolls; battles derive
 *  their own seeds from it via the battle counter. */
const sessionSeed = Date.now() >>> 0;

interface WorldData {
  state: GameState;
}

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private map!: CompiledMap;
  private index!: ReadonlyMap<string, EntityAt>;
  private worldRng: Rng = mulberry32(deriveSeed(sessionSeed, 0xa11ce));

  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Rectangle;
  private layerA!: Phaser.Tilemaps.TilemapLayer;
  private layerB!: Phaser.Tilemaps.TilemapLayer;

  private moving = false;
  private targetX = 0;
  private targetY = 0;
  private progress = 0;
  private busy = false;
  private markerSprite: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: 'World' });
  }

  init(data: WorldData): void {
    this.state = data.state;
  }

  create(): void {
    const map = MAPS[this.state.world.mapId] ?? MAPS.hearth;
    if (!map) throw new Error('no maps compiled');
    this.map = map;
    applyAudioSettings(this.state.settings);
    playMusic(map.music as MusicId);
    // Defeated bosses leave the world: drop them from the walk/interact index.
    const index = new Map(entityIndex(map));
    // A fallen boss leaves a teleporter home in its place (Grae, 2026-06-10).
    for (const b of map.bosses) {
      if (this.state.world.bosses[b.id]) {
        index.set(`${String(b.x)},${String(b.y)}`, {
          kind: 'teleporter',
          x: b.x,
          y: b.y,
          ref: b.id,
        });
      }
    }
    // The north gate dissolves once three Grand Sigils are held.
    if (sigilCount(this.state) >= 3) {
      for (const g of map.gates) index.delete(`${String(g.x)},${String(g.y)}`);
    }
    this.index = index;
    this.moving = false;
    this.busy = false;

    createTilesetTexture(this);
    createEntityTextures(this);
    createActorTextures(this);

    this.buildTileLayers();
    this.placeEntities();

    this.player = this.add.image(0, 0, 'player_front').setOrigin(0, 0).setDepth(10);
    this.shadow = this.add.rectangle(0, 0, 10, 2, 0x000000, 0.25).setOrigin(0, 0).setDepth(9);
    this.snapPlayer();

    const w = this.map.width * TILE;
    const h = this.map.height * TILE;
    this.cameras.main.setBounds(0, 0, w, h);
    this.cameras.main.startFollow(this.player, true, 0.16, 0.16);

    const input = dom.ensureInput();
    const offAction = input.onAction((action) => {
      if (!this.scene.isActive()) return;
      if (action !== 'interact') return;
      if (isGrimoireOpen() || isSettingsOpen()) return;
      if (dom.isDialogOpen()) {
        dom.advanceDialog();
        return;
      }
      if (!this.busy && !this.moving && !dom.isTransiting()) this.interact();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offAction);

    const animTimer = this.time.addEvent({
      delay: ANIM_MS,
      loop: true,
      callback: () => {
        this.layerA.setVisible(!this.layerA.visible);
        this.layerB.setVisible(!this.layerA.visible);
      },
    });
    // Auto-save every 60s while wandering (docs/01 save rules).
    const saveTimer = this.time.addEvent({
      delay: 60_000,
      loop: true,
      callback: () => {
        if (!this.busy && this.scene.isActive()) this.autoSave();
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      animTimer.remove();
      saveTimer.remove();
    });

    this.bindTopButtons();
    dom.applyDpadSettings(this.state.settings.dpadSide, this.state.settings.dpadScale);
    dom.showWorldUi(true);
    this.refreshHud();
    this.renderEssenceMarker();

    // A fresh save: the Elder asks what the first page answers to
    // (03 section 26, final copy) before the Vale opens up.
    if (this.state.player.starter === null) this.askStarter();

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>)['__debug'] = {
        setLv: (lv: number): void => {
          const p = this.state.player;
          p.lv = lv;
          p.maxhp = maxHpAt(lv);
          p.maxmp = maxMpAt(lv);
          p.hp = p.maxhp;
          p.mp = p.maxmp;
          p.xp = 0;
          this.refreshHud();
        },
        allShrines: (): void => {
          this.state.world.shrines = { fury: true, thirst: true, echo: true, keen: true };
        },
        giveEssence: (n: number): void => {
          this.state.player.essence += n;
        },
        slayBogmaw: (): void => {
          this.state.world.bosses.bogmaw = true;
        },
      };
    }
  }

  /** The starter choice (v1.1): grants the element's Wisp and Bolt. */
  private askStarter(): void {
    this.busy = true;
    const page1 = DIALOGUE['elder_grimoire'];
    const page3 = DIALOGUE['elder_start_south'];
    const ask = (): void => {
      dom.openChoice(
        'ELDER',
        'Ember burns answers. Rime keeps them. Thorn grows its own.',
        ['Ember', 'Rime', 'Thorn'],
        (i) => {
          const starter: ElementId = (['ember', 'rime', 'thorn'] as const)[i] ?? 'ember';
          this.state.player.starter = starter;
          this.state.player.spells = starterSpells(starter).map((sp) => (sp ? { ...sp } : null));
          playSfx('unlock');
          dom.toast(`✦ ${ELEMENTS[starter].label.toUpperCase()} answers`, true);
          this.refreshHud();
          this.autoSave();
          if (page3) {
            dom.openDialog(page3, () => {
              this.busy = false;
            });
          } else {
            this.busy = false;
          }
        },
      );
    };
    if (page1) {
      dom.openDialog(page1, ask);
    } else {
      ask();
    }
  }

  /** Dropped-essence marker (03 section 16): drawn on its map only. */
  private renderEssenceMarker(): void {
    this.markerSprite?.destroy();
    this.markerSprite = null;
    const m = this.state.world.essenceMarker;
    if (!m || m.mapId !== this.map.id) return;
    this.markerSprite = this.add
      .image(m.x * TILE, m.y * TILE, 'ent_essence')
      .setOrigin(0, 0)
      .setDepth(5);
    this.tweens.add({
      targets: this.markerSprite,
      alpha: 0.6,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Walking onto the marker reclaims the dropped essence. */
  private tryRecoverEssence(): void {
    const m = this.state.world.essenceMarker;
    if (!m || m.mapId !== this.map.id) return;
    if (m.x !== this.state.world.x || m.y !== this.state.world.y) return;
    this.state.player.essence += m.amount;
    this.state.world.essenceMarker = null;
    this.markerSprite?.destroy();
    this.markerSprite = null;
    playSfx('unlock');
    dom.toast(`✦ ${String(m.amount)} essence reclaimed`, true);
    this.autoSave();
  }

  private bindTopButtons(): void {
    const grimBtn = document.getElementById('grimBtn');
    const setBtn = document.getElementById('setBtn');
    const helpBtn = document.getElementById('helpBtn');
    const overlayBlocked = (): boolean =>
      !this.scene.isActive() ||
      this.busy ||
      this.moving ||
      dom.isDialogOpen() ||
      dom.isTransiting() ||
      isGrimoireOpen() ||
      isSettingsOpen();
    const openGrim = (): void => {
      if (overlayBlocked()) return;
      this.scene.launch('Grimoire', {
        state: this.state,
        onInscribe: (slot: number, spell: NonNullable<GameState['player']['spells'][number]>) => {
          this.state.player.spells[slot] = spell;
          this.state.stats.inscribed += 1;
        },
      });
    };
    const openSettings = (): void => {
      if (overlayBlocked()) return;
      this.scene.launch('Settings', { state: this.state });
    };
    const openHelp = (): void => {
      if (!this.scene.isActive() || dom.isDialogOpen() || isGrimoireOpen() || isSettingsOpen())
        return;
      const entry = DIALOGUE['help'];
      if (entry) dom.openDialog(entry);
    };
    grimBtn?.addEventListener('click', openGrim);
    setBtn?.addEventListener('click', openSettings);
    helpBtn?.addEventListener('click', openHelp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      grimBtn?.removeEventListener('click', openGrim);
      setBtn?.removeEventListener('click', openSettings);
      helpBtn?.removeEventListener('click', openHelp);
    });
  }

  private buildTileLayers(): void {
    const grid = (frame: 0 | 1): number[][] =>
      this.map.tiles.map((row, y) => [...row].map((ch, x) => tileIndexFor(ch, x, y, frame)));
    const make = (frame: 0 | 1): Phaser.Tilemaps.TilemapLayer => {
      const tilemap = this.make.tilemap({
        data: grid(frame),
        tileWidth: TILE,
        tileHeight: TILE,
      });
      const tiles = tilemap.addTilesetImage('world_tiles');
      if (!tiles) throw new Error('tileset texture missing');
      const layer = tilemap.createLayer(0, tiles, 0, 0);
      if (!layer) throw new Error('tile layer failed');
      return layer.setDepth(0);
    };
    this.layerA = make(0);
    this.layerB = make(1).setVisible(false);
  }

  private placeEntities(): void {
    const at = (x: number, y: number): { px: number; py: number } => ({
      px: x * TILE,
      py: y * TILE,
    });
    for (const s of this.map.signs) {
      const { px, py } = at(s.x, s.y);
      this.add.image(px, py, 'ent_sign').setOrigin(0, 0).setDepth(5);
    }
    for (const l of this.map.lore) {
      const { px, py } = at(l.x, l.y);
      this.add.image(px, py, 'ent_lore').setOrigin(0, 0).setDepth(5);
    }
    for (const s of this.map.springs) {
      const { px, py } = at(s.x, s.y);
      this.add.image(px, py, 'ent_spring').setOrigin(0, 0).setDepth(5);
    }
    for (const g of this.map.gates) {
      if (sigilCount(this.state) >= 3) continue;
      const { px, py } = at(g.x, g.y);
      this.add.image(px, py, 'ent_gate').setOrigin(0, 0).setDepth(5);
    }
    for (const b of this.map.bosses) {
      if (this.state.world.bosses[b.id]) {
        const { px, py } = at(b.x, b.y);
        const pad = this.add.image(px, py, 'ent_teleporter').setOrigin(0, 0).setDepth(5);
        this.tweens.add({
          targets: pad,
          alpha: 0.65,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        continue;
      }
      const { px, py } = at(b.x, b.y);
      const marker = this.add.image(px, py, 'ent_boss_marker').setOrigin(0, 0).setDepth(5);
      this.tweens.add({
        targets: marker,
        alpha: 0.55,
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });
    }
    for (const s of this.map.shrines) {
      const { px, py } = at(s.x, s.y);
      const shrine = this.add.image(px, py, `ent_shrine_${s.rune}`).setOrigin(0, 0).setDepth(5);
      this.tweens.add({
        targets: shrine,
        alpha: 0.7,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }
    for (const n of this.map.npcs) {
      const { px, py } = at(n.x, n.y);
      this.add
        .image(px + 2, py + 1, npcTextureKey(this, n.id))
        .setOrigin(0, 0)
        .setDepth(8);
    }
  }

  private snapPlayer(): void {
    const px = this.state.world.x * TILE;
    const py = this.state.world.y * TILE;
    this.placePlayerPx(px, py);
  }

  private placePlayerPx(px: number, py: number): void {
    this.player.setPosition(px + 2, py + 1);
    this.shadow.setPosition(px + 3, py + 14);
    this.player.setTexture(this.state.world.facing === 'up' ? 'player_back' : 'player_front');
    this.player.setFlipX(this.state.world.facing === 'left');
  }

  override update(_time: number, delta: number): void {
    if (
      this.busy ||
      dom.isDialogOpen() ||
      dom.isTransiting() ||
      isGrimoireOpen() ||
      isSettingsOpen()
    )
      return;

    if (!this.moving) {
      const dir = dom.ensureInput().currentDir();
      if (dir) this.tryStep(dir);
    }
    if (this.moving) {
      this.progress = Math.min(1, this.progress + delta / STEP_MS);
      const wx = this.state.world.x;
      const wy = this.state.world.y;
      const px = (wx + (this.targetX - wx) * this.progress) * TILE;
      const py = (wy + (this.targetY - wy) * this.progress) * TILE;
      const bob = Math.sin(this.progress * Math.PI) * 1.4;
      this.placePlayerPx(px, py - bob);
      this.shadow.setPosition(px + 3, py + 14);
      if (this.progress >= 1) this.finishStep();
    }
  }

  private tryStep(dir: GameState['world']['facing']): void {
    this.state.world.facing = dir;
    const next = facingPos(this.state.world.x, this.state.world.y, dir);
    this.placePlayerPx(this.state.world.x * TILE, this.state.world.y * TILE);
    if (!walkableAt(this.map, next.x, next.y, this.index)) return;
    this.moving = true;
    this.targetX = next.x;
    this.targetY = next.y;
    this.progress = 0;
  }

  private finishStep(): void {
    this.moving = false;
    this.state.world.x = this.targetX;
    this.state.world.y = this.targetY;
    this.state.stats.steps += 1;
    this.snapPlayer();
    this.tryRecoverEssence();

    const exit = exitAt(this.map, this.targetX, this.targetY);
    if (exit) {
      this.busy = true;
      this.state = applyExit(this.state, exit);
      this.autoSave();
      void dom.irisTransition(() => {
        this.scene.restart({ state: this.state });
      });
      return;
    }

    // Scripted one-shot battles (the first Gloop outside Hearth).
    const trigger = this.map.triggers.find((t) => t.x === this.targetX && t.y === this.targetY);
    if (trigger && !this.state.world.flags[trigger.id]) {
      const scripted = SCRIPTED_BATTLES[trigger.id];
      if (scripted) {
        this.state.world.flags[trigger.id] = true;
        this.startEncounter({
          zone: scripted.zone,
          formation: { members: [...scripted.members], weight: 1 },
          enemyLv: scripted.enemyLv,
        });
        return;
      }
    }

    const result = resolveStep(
      {
        tile: tileAt(this.map, this.targetX, this.targetY),
        zone: zoneAt(this.map, this.targetX, this.targetY)?.table ?? null,
        graceSteps: this.state.world.graceSteps,
        stepCount: this.state.stats.steps,
        playerLv: this.state.player.lv,
        eliteEligible: this.state.world.bosses.bogmaw,
      },
      this.worldRng,
    );
    this.state.world.graceSteps = result.graceSteps;
    if (result.regen) {
      const p = this.state.player;
      p.hp = Math.min(p.maxhp, p.hp + 1);
      p.mp = Math.min(p.maxmp, p.mp + 1);
      this.refreshHud();
    }
    if (result.encounter) this.startEncounter(result.encounter);
  }

  private startEncounter(encounter: EncounterRoll): void {
    this.busy = true;
    playSfx('encounter');
    console.debug(
      `[encounter] ${encounter.zone}: ${encounter.formation.members.join('+')} lv${String(encounter.enemyLv)}`,
    );
    const seed = deriveSeed(sessionSeed, this.state.stats.battles + this.state.stats.defeats + 1);
    void dom.encounterFlash(this.state.settings.reducedFlash).then(() => {
      let result: BattleResult | null = null;
      this.scene.launch('Battle', {
        state: this.state,
        encounter,
        seed,
        onDone: (r: BattleResult) => {
          result = r;
        },
      });
      this.events.once(Phaser.Scenes.Events.WAKE, () => {
        if (result) this.afterBattle(result);
        this.busy = false;
      });
      this.scene.sleep();
    });
  }

  private startBossBattle(bossId: BossId): void {
    this.busy = true;
    playSfx('encounter');
    const seed = deriveSeed(sessionSeed, this.state.stats.battles + this.state.stats.defeats + 1);
    const marker = this.map.bosses.find((b) => b.id === bossId);
    const zone = marker ? (zoneAt(this.map, marker.x, marker.y)?.table ?? null) : null;
    void dom.encounterFlash(this.state.settings.reducedFlash).then(() => {
      let result: BattleResult | null = null;
      this.scene.launch('Battle', {
        state: this.state,
        bossId,
        zone,
        seed,
        onDone: (r: BattleResult) => {
          result = r;
        },
      });
      this.events.once(Phaser.Scenes.Events.WAKE, () => {
        if (result) this.afterBattle(result);
        this.busy = false;
      });
      this.scene.sleep();
    });
  }

  private autoSave(): void {
    try {
      save(window.localStorage, 'auto', this.state);
    } catch {
      // Storage full or unavailable: play on without saving.
    }
  }

  private afterBattle(result: BattleResult): void {
    this.state = result.state;
    this.refreshHud();
    this.autoSave();
    if (result.outcome === 'defeat') {
      this.scene.restart({ state: this.state });
      const entry = DIALOGUE['defeat_wake'];
      if (entry) dom.openDialog(entry);
      if (result.essenceLost > 0) {
        dom.toast(`${String(result.essenceLost)} essence fell where you did`, true);
      }
      return;
    }
    if (result.bossId === 'valewraith' && result.outcome === 'victory') {
      // The finale: the Ending cover takes over, then restarts the world
      // for post-game free roam.
      this.scene.start('Ending', { state: this.state });
      return;
    }
    if (result.bossId && result.outcome === 'victory') {
      const toastText = BOSSES[result.bossId].sigilToast;
      playSfx('unlock');
      if (toastText) dom.toast(`✦ ${toastText}`, true);
      // Rebuild the map so the fallen Warden's marker disappears.
      this.scene.restart({ state: this.state });
    }
    if (result.xpGained > 0) dom.toast(`+${String(result.xpGained)} XP`);
    if (result.essenceGained > 0) dom.toast(`+${String(result.essenceGained)} essence`);
    result.levelsGained.forEach((lv, i) => {
      setTimeout(
        () => {
          playSfx('levelup');
          dom.toast(`★ Level ${String(lv)}! Fully restored.`);
          for (const unlock of unlocksAtLevel(lv)) {
            setTimeout(() => {
              playSfx('unlock');
              dom.toast(`✦ ${unlockToastText(unlock)}`, true);
            }, 650);
          }
        },
        500 + i * 900,
      );
    });
  }

  /**
   * Shrines sell Grimoire slots 5 and 6 (03 section 16). Offered only
   * when the next slot is affordable, so shrines never nag.
   */
  private offerSlotPurchase(): void {
    const unlocked = this.state.player.slotsUnlocked;
    if (unlocked >= 6) return;
    const slot = unlocked === 4 ? 5 : 6;
    const price = slot === 5 ? ESSENCE.slot5 : ESSENCE.slot6;
    if (this.state.player.essence < price) return;
    dom.openChoice(
      'SHRINE',
      `The shrine hums over your grimoire. A ${String(slot)}th page, for ${String(price)} essence?`,
      [`Pay ${String(price)} essence`, 'Not now'],
      (i) => {
        if (i !== 0) return;
        const bought = applySlotPurchase(this.state, ESSENCE);
        if (!bought) return;
        this.state = bought.state;
        playSfx('unlock');
        dom.toast(`✦ Grimoire slot ${String(bought.slot)} unbound`, true);
        this.autoSave();
      },
    );
  }

  private interact(): void {
    const { x, y } = facingPos(this.state.world.x, this.state.world.y, this.state.world.facing);
    const entity = this.index.get(`${String(x)},${String(y)}`) ?? null;
    const action = interactionFor(this.map, entity);
    if (!action) return;
    switch (action.kind) {
      case 'dialogue': {
        const id = action.npcId ? npcDialogueId(action.npcId, action.id, this.state) : action.id;
        const entry = DIALOGUE[id];
        if (entry) dom.openDialog(entry);
        break;
      }
      case 'spring': {
        playSfx('heal');
        this.state = applySpringRestore(this.state);
        this.state.world.respawn = {
          mapId: this.state.world.mapId,
          x: this.state.world.x,
          y: this.state.world.y,
        };
        this.refreshHud();
        this.autoSave();
        const entry = DIALOGUE['spring'];
        if (entry) dom.openDialog(entry);
        break;
      }
      case 'shrine': {
        const { state, granted } = applyShrineGrant(this.state, action.rune);
        this.state = state;
        this.refreshHud();
        this.autoSave();
        if (granted) {
          playSfx('unlock');
          const entry = DIALOGUE[`shrine_${action.rune}`];
          const runeLabel = RUNES[action.rune].label.toUpperCase();
          if (entry) {
            dom.openDialog(entry, () => {
              dom.toast(`✦ Rune of ${runeLabel} unlocked`, true);
              this.offerSlotPurchase();
            });
          }
        } else {
          const entry = DIALOGUE['shrine_used'];
          if (entry) {
            dom.openDialog(entry, () => {
              this.offerSlotPurchase();
            });
          }
        }
        break;
      }
      case 'boss':
        this.startBossBattle(action.id);
        break;
      case 'gate': {
        const entry = DIALOGUE['gate_sealed'];
        if (entry) dom.openDialog(entry);
        break;
      }
      case 'teleport': {
        const entry = DIALOGUE['teleporter'];
        if (!entry) break;
        dom.openDialog(entry, () => {
          const hearth = MAPS.hearth;
          if (!hearth) return;
          this.busy = true;
          playSfx('cast');
          this.state = applyExit(this.state, {
            x: this.state.world.x,
            y: this.state.world.y,
            to: hearth.id,
            tx: hearth.spawn.x,
            ty: hearth.spawn.y,
          });
          this.autoSave();
          void dom.irisTransition(() => {
            this.scene.restart({ state: this.state });
          });
        });
        break;
      }
    }
  }

  private refreshHud(): void {
    const p = this.state.player;
    dom.refreshHud({
      lv: p.lv,
      hp: p.hp,
      maxhp: p.maxhp,
      mp: p.mp,
      maxmp: p.maxmp,
      xp: p.xp,
      xpNext: xpNext(p.lv),
    });
  }
}
