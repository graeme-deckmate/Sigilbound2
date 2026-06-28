import Phaser from 'phaser';
import type { BossId, GameState, MapId } from '../core/state.ts';
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
import { RUNES } from '../data/runes.ts';
import { BOSSES, TRIAL_GUARDIAN_LV } from '../data/enemies.ts';
import { SCRIPTED_BATTLES } from '../data/triggers.ts';
import { maxHpAt, maxMpAt, unlockToastText, unlocksAtLevel, xpNext } from '../systems/leveling.ts';
import type { BattleResult } from './Battle.ts';
import { resolveStep, type EncounterRoll } from '../systems/encounters.ts';
import {
  applyExit,
  applyRematchEntry,
  applyRematchReward,
  applyShrineGrant,
  applySlotPurchase,
  applySpringRestore,
  canAffordRematch,
  exitLocked,
  facingPos,
  interactionFor,
  npcDialogueId,
  rotateAspect,
  sigilCount,
  TRIAL_KEYS,
  TRIALS,
  type TrialKey,
} from '../systems/worldstate.ts';
import { NG_PLUS, starterSpells } from '../data/progression.ts';
import { ELITE, RARE } from '../data/elites.ts';
import { ZONES } from '../data/formations.ts';
import { ESSENCE } from '../data/essence.ts';
import {
  CHARM,
  CHARMS,
  COMMISSIONS,
  GATES,
  MURK,
  SCROLL,
  commissionFlag,
  commissionHeardFlag,
  gateFlag,
  murkLocation,
  type CacheReward,
  type CharmId,
} from '../data/discovery.ts';
import {
  applyGateOpen,
  commissionSatisfied,
  gateById,
  gateOpeners,
} from '../systems/worldstate.ts';
import {
  doorOpen,
  dungeonComplete,
  dungeonEject,
  dungeonEnter,
  isDungeonCleared,
} from '../systems/dungeon.ts';
import { dungeonById, dungeonObjective } from '../data/dungeons.ts';
import { grantGear, buyGear, sellGear, equipGear } from '../systems/shop.ts';
import { rollGear, itemLabel, itemValue } from '../systems/gear.ts';
import { waystoneFlag } from '../systems/worldstate.ts';
import type { GearItem } from '../core/items.ts';
import { CLASS_IDS, CLASSES } from '../data/classes.ts';
import { PALETTE_IDS } from '../render/grids.ts';
import { spellCost, displayName } from '../systems/spellcraft.ts';
import { deriveSeed as derive2 } from '../core/rng.ts';
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

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}
const ANIM_MS = 380;

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
  private murkSpot: { x: number; y: number } | null = null;
  private rematchBoss: BossId | null = null;
  private pendingTrial: TrialKey | null = null;
  // Post-battle world rebuilds are deferred to the next update() tick rather
  // than calling scene.restart() from inside the WAKE handler. Restarting a
  // scene from within its own wake event is re-entrant and, on a repeated
  // flow like boss rematches, can drop the next WAKE and leave the scene
  // asleep (the v1 "can't re-fight after the first re-fight" bug).
  private pendingRebuild = false;
  // Scene-local dungeon puzzle state (v2 W2). Single-map and ephemeral: it
  // resets on every create(), so leaving or wiping resets the puzzle for free.
  private puzzle = {
    levers: new Set<string>(),
    keys: new Set<string>(),
    plates: new Set<string>(),
    seq: [] as string[],
  };
  private opened = new Set<string>();
  private doorSprites = new Map<string, Phaser.GameObjects.Image>();
  private leverSprites = new Map<string, Phaser.GameObjects.Image>();
  private pendingObjective: string | null = null;
  private pendingMiniboss: string | null = null;

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
    // Opened element gates stay open (world flags, 03 section 19).
    for (const g of map.egates) {
      if (this.state.world.flags[gateFlag(g.id)]) {
        index.delete(`${String(g.x)},${String(g.y)}`);
      }
    }
    // A cleared dungeon keeps its objective down: drop it so re-runs are free roam.
    const dungeon = this.state.world.dungeon;
    if (dungeon && isDungeonCleared(this.state, dungeon.id)) {
      for (const o of map.objectives) index.delete(`${String(o.x)},${String(o.y)}`);
    }
    // Felled minibosses stay down (v2 W4).
    for (const m of map.minibosses) {
      if (this.state.world.flags[`miniboss_${m.id}`]) {
        index.delete(`${String(m.x)},${String(m.y)}`);
      }
    }
    // Murk sets up shop by progress (03 section 20).
    const murkSpot = murkLocation(
      this.state.world.bosses.bogmaw,
      sigilCount(this.state),
      this.state.world.bosses.valewraith,
    );
    if (murkSpot && murkSpot.map === map.id) {
      index.set(`${String(murkSpot.x)},${String(murkSpot.y)}`, {
        kind: 'npc',
        x: murkSpot.x,
        y: murkSpot.y,
        ref: 'murk',
      });
      this.murkSpot = murkSpot;
    } else {
      this.murkSpot = null;
    }
    this.index = index;
    this.moving = false;
    this.busy = false;
    // Phaser reuses the scene instance across restart() without re-running
    // field initializers, so clear transient battle handoff state here.
    this.rematchBoss = null;
    this.pendingRebuild = false;
    this.pendingObjective = null;
    this.pendingMiniboss = null;
    // Dungeon puzzle state is per-entry and ephemeral: reset every build.
    this.puzzle = { levers: new Set(), keys: new Set(), plates: new Set(), seq: [] };
    this.opened = new Set();
    this.doorSprites = new Map();
    this.leverSprites = new Map();

    createTilesetTexture(this);
    createEntityTextures(this);
    createActorTextures(this, this.state.player.appearance.palette);

    this.buildTileLayers();
    this.placeEntities();
    this.applyThemeTint();

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
    const aspect = this.state.world.aspect;
    dom.setAspectGlyph(aspect, aspect ? ELEMENTS[aspect].color : null);
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
        grantWyrd: (): void => {
          this.state.world.flags['rune_wyrd'] = true;
        },
        grantStormcoil: (): void => {
          this.state.world.flags['rune_stormcoil'] = true;
        },
        addMastery: (element: ElementId, n: number): void => {
          this.state.player.mastery[element] = Math.min(50, this.state.player.mastery[element] + n);
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

  /** Shrine and spring rests turn the Vale's Wheel (03 section 25). */
  private rotateValeAspect(): void {
    const before = this.state.world.aspect;
    this.state = rotateAspect(this.state, this.worldRng);
    const aspect = this.state.world.aspect;
    if (aspect && aspect !== before) {
      dom.toast(`The Vale leans toward ${ELEMENTS[aspect].label}.`, true);
      dom.setAspectGlyph(aspect, ELEMENTS[aspect].color);
    }
  }

  /** Gate copy states the element in plain text (03 section 19). */
  private gateLine(element: string): string {
    switch (element) {
      case 'ember':
        return 'A strong flame would clear it.';
      case 'rime':
        return 'A hard frost would still it.';
      case 'volt':
        return 'A sharp shock would break it.';
      case 'thorn':
        return 'A living thorn would part it.';
      case 'gloom':
        return 'Only the dark may pass.';
      default:
        return 'Any honest blast would do.';
    }
  }

  /** Pay out a cache (03 section 19) with the right fanfare. */
  private grantCache(reward: CacheReward): void {
    const grantCharm = (charm: CharmId): void => {
      if (!this.state.player.charms.owned.includes(charm)) {
        this.state.player.charms.owned.push(charm);
        const free = this.state.player.charms.equipped.indexOf(null);
        if (free >= 0) this.state.player.charms.equipped[free] = charm;
        dom.toast(`✦ Charm found: ${CHARMS[charm].label}`, true);
      }
    };
    const grantRelic = (rune: string): void => {
      if (this.state.world.flags[`rune_${rune}`]) {
        // NG+ re-opening: the relic is already written; take its worth.
        this.state.player.essence += NG_PLUS.relicCacheEssence;
        dom.toast(`+${String(NG_PLUS.relicCacheEssence)} essence (the relic remembers you)`);
        return;
      }
      this.state.world.flags[`rune_${rune}`] = true;
      dom.toast(`✦ Relic rune: ${rune.toUpperCase()}`, true);
      this.checkRelicRoad();
    };
    switch (reward.kind) {
      case 'relic':
        grantRelic(reward.rune);
        break;
      case 'charm':
        grantCharm(reward.charm);
        break;
      case 'essence':
        this.state.player.essence += reward.amount;
        dom.toast(`+${String(reward.amount)} essence`);
        break;
      case 'essenceAndCharm':
        this.state.player.essence += reward.amount;
        dom.toast(`+${String(reward.amount)} essence`);
        grantCharm(reward.charm);
        break;
      case 'essenceAndSign': {
        this.state.player.essence += reward.amount;
        dom.toast(`+${String(reward.amount)} essence`);
        const entry = DIALOGUE[reward.dialogue];
        if (entry) dom.openDialog(entry);
        break;
      }
      case 'relicAndLore': {
        grantRelic(reward.rune);
        const entry = DIALOGUE[reward.dialogue];
        if (entry) dom.openDialog(entry);
        break;
      }
    }
  }

  private grantFeat(id: string, label: string): void {
    if (this.state.feats.includes(id)) return;
    this.state.feats.push(id);
    playSfx('unlock');
    dom.toast(`✦ Feat: ${label}`, true);
  }

  private checkRelicRoad(): void {
    const relics = ['emberglass', 'stillwater', 'stormcoil', 'hollowlight', 'wraithmark'];
    if (relics.every((r) => this.state.world.flags[`rune_${r}`])) {
      this.grantFeat('relic_road', 'Relic Road');
    }
  }

  private openEgate(id: string): void {
    const def = gateById(id);
    if (!def) return;
    const openers = gateOpeners(this.state, def);
    const line = this.gateLine(def.element);
    if (openers.length === 0) {
      dom.openDialog({ speaker: 'GATE', pages: [`${capitalize(def.label)} bars the way.`, line] });
      return;
    }
    const affordable = openers.filter(
      (o) => this.state.player.mp >= spellCost(o.spell, { mastery: 0 }),
    );
    if (affordable.length === 0) {
      dom.openDialog({
        speaker: 'GATE',
        pages: [line, 'Your ink runs too thin to cast just now.'],
      });
      return;
    }
    dom.openChoice(
      'GATE',
      `${capitalize(def.label)} bars the way. ${line}`,
      [
        ...affordable.map((o) => `Cast ${displayName(o.spell)} (${String(spellCost(o.spell))} MP)`),
        'Leave it',
      ],
      (i) => {
        const pick = affordable[i];
        if (!pick) return;
        const cost = spellCost(pick.spell);
        const opened = applyGateOpen(this.state, def, cost);
        if (!opened) return;
        this.state = opened;
        playSfx('gate_open');
        dom.toast(`${capitalize(def.label)} opens`, true);
        this.grantCache(def.reward);
        if (GATES.every((g) => this.state.world.flags[gateFlag(g.id)])) {
          this.grantFeat('gatewright', 'Gatewright');
        }
        this.refreshHud();
        this.autoSave();
        this.scene.restart({ state: this.state });
      },
    );
  }

  /** Murk's shop (03 section 20): essence only, stock rotates by visit. */
  private talkToMurk(): void {
    const introFlag = 'murk_met';
    const openShop = (): void => {
      const stockSeed = derive2(this.state.stats.battles, sigilCount(this.state) + 7);
      const rng = mulberry32(stockSeed);
      const pool = MURK.stockPool.filter((c) => !this.state.player.charms.owned.includes(c));
      const stock: CharmId[] = [];
      const bag = [...pool];
      while (stock.length < MURK.stockSize && bag.length > 0) {
        const pick = bag.splice(Math.floor(rng() * bag.length), 1)[0];
        if (pick) stock.push(pick);
      }
      const options: string[] = [];
      const acts: (() => void)[] = [];
      if (!this.state.world.flags['rune_wyrd']) {
        options.push(`The Wyrd rune (${String(MURK.wyrdPrice)} essence)`);
        acts.push(() => {
          if (this.state.player.essence < MURK.wyrdPrice) return this.murkBroke();
          this.state.player.essence -= MURK.wyrdPrice;
          this.state.world.flags['rune_wyrd'] = true;
          playSfx('unlock');
          dom.toast('✦ Rune of the WYRD unlocked', true);
          this.autoSave();
        });
      }
      options.push(`A relic hint (${String(MURK.hintPrice)} essence)`);
      acts.push(() => {
        if (this.state.player.essence < MURK.hintPrice) return this.murkBroke();
        this.state.player.essence -= MURK.hintPrice;
        const unfound = GATES.filter(
          (g) =>
            (g.reward.kind === 'relic' || g.reward.kind === 'relicAndLore') &&
            !this.state.world.flags[gateFlag(g.id)],
        );
        const target = unfound[0];
        const hintText = target
          ? `Something glints behind ${target.label}, in ${target.map}. Bring ${
              target.element === 'any' ? 'anything loud' : target.element
            }.`
          : 'Nothing left to find. Annoying, is it not.';
        dom.openDialog({ speaker: 'MURK', pages: [hintText] });
        if (target) this.state.notes.push(`Murk: ${hintText}`);
        this.autoSave();
      });
      for (const charm of stock) {
        options.push(`${CHARMS[charm].label} charm (${String(MURK.charmPrice)} essence)`);
        acts.push(() => {
          if (this.state.player.essence < MURK.charmPrice) return this.murkBroke();
          this.state.player.essence -= MURK.charmPrice;
          this.state.player.charms.owned.push(charm);
          const free = this.state.player.charms.equipped.indexOf(null);
          if (free >= 0) this.state.player.charms.equipped[free] = charm;
          playSfx('confirm');
          dom.toast(`✦ Charm bought: ${CHARMS[charm].label}`, true);
          this.autoSave();
        });
      }
      options.push('Walk away');
      acts.push(() => undefined);
      dom.openChoice('MURK', 'Murk squints at your essence pouch.', options, (i) => {
        acts[i]?.();
      });
    };
    if (!this.state.world.flags[introFlag]) {
      this.state.world.flags[introFlag] = true;
      dom.openDialog({ speaker: 'MURK', pages: [MURK.intro] }, openShop);
    } else {
      openShop();
    }
  }

  private murkBroke(): void {
    dom.openDialog({ speaker: 'MURK', pages: ['Come back heavier.'] });
  }

  /** Commission flow (03 section 21): ask, check, pay out. */
  private tryCommission(npcId: string): boolean {
    const comm = COMMISSIONS.find((c) => c.npcId === npcId);
    if (!comm) return false;
    if (comm.id === 'keeper' && !this.state.world.flags['trials_complete']) return false;
    if (this.state.world.flags[commissionFlag(comm.id)]) return false;
    if (commissionSatisfied(this.state, comm.id)) {
      this.state.world.flags[commissionFlag(comm.id)] = true;
      playSfx('commission_done');
      dom.openDialog(
        { speaker: npcId.toUpperCase(), pages: ['It works exactly as asked. I owe you.'] },
        () => {
          if (comm.reward.essence) {
            this.state.player.essence += comm.reward.essence;
            dom.toast(`+${String(comm.reward.essence)} essence`);
          }
          if (comm.reward.charm) {
            if (!this.state.player.charms.owned.includes(comm.reward.charm)) {
              this.state.player.charms.owned.push(comm.reward.charm);
              const free = this.state.player.charms.equipped.indexOf(null);
              if (free >= 0) this.state.player.charms.equipped[free] = comm.reward.charm;
            }
            dom.toast(`✦ Charm given: ${CHARMS[comm.reward.charm].label}`, true);
          }
          if (comm.reward.hint) {
            this.state.notes.push('The scout owes me a pointer to something hidden.');
          }
          if (COMMISSIONS.every((c) => this.state.world.flags[commissionFlag(c.id)])) {
            this.grantFeat('commissioned', 'Commissioned');
          }
          this.autoSave();
        },
      );
      return true;
    }
    dom.openDialog({ speaker: npcId.toUpperCase(), pages: [comm.ask] }, () => {
      if (!this.state.world.flags[commissionHeardFlag(comm.id)]) {
        this.state.world.flags[commissionHeardFlag(comm.id)] = true;
        this.state.notes.push(comm.noteLine);
        dom.toast('Noted in the grimoire', true);
        this.autoSave();
      }
    });
    return true;
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
          this.grantFeat('first_page', 'First Page');
          if (spell.given) this.grantFeat('wordsmith', 'Wordsmith');
          if (spell.p >= 1.5) this.grantFeat('greedy_ink', 'Greedy Ink');
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
    for (const g of this.map.egates) {
      if (this.state.world.flags[gateFlag(g.id)]) continue;
      const def = gateById(g.id);
      const { px, py } = at(g.x, g.y);
      const img = this.add.image(px, py, 'ent_egate').setOrigin(0, 0).setDepth(5);
      if (def && def.element !== 'any') {
        img.setTint(Phaser.Display.Color.HexStringToColor(ELEMENTS[def.element].color).color);
      }
    }
    if (this.murkSpot) {
      const { px, py } = at(this.murkSpot.x, this.murkSpot.y);
      this.add.image(px, py, npcTextureKey(this, 'murk')).setOrigin(0, 0).setDepth(6);
    }
    for (const s of this.map.signs) {
      const { px, py } = at(s.x, s.y);
      this.add.image(px, py, 'ent_sign').setOrigin(0, 0).setDepth(5);
    }
    for (const l of this.map.lore) {
      const { px, py } = at(l.x, l.y);
      this.add.image(px, py, 'ent_lore').setOrigin(0, 0).setDepth(5);
    }
    for (const t of this.map.trials) {
      const { px, py } = at(t.x, t.y);
      const img = this.add.image(px, py, 'ent_trial').setOrigin(0, 0).setDepth(5);
      if (this.state.world.flags[TRIALS[t.key].flag]) img.setAlpha(0.55);
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
    // Dungeon entities (v2 W2).
    for (const p of this.map.portals) {
      const { px, py } = at(p.x, p.y);
      this.add.image(px, py, 'ent_portal').setOrigin(0, 0).setDepth(5);
    }
    for (const l of this.map.levers) {
      const { px, py } = at(l.x, l.y);
      const img = this.add.image(px, py, 'ent_lever').setOrigin(0, 0).setDepth(5);
      if (this.puzzle.levers.has(l.id)) img.setTint(0xffc857);
      this.leverSprites.set(l.id, img);
    }
    for (const d of this.map.doors) {
      if (doorOpen(d.needs, this.puzzle)) continue;
      const { px, py } = at(d.x, d.y);
      const img = this.add.image(px, py, 'ent_door').setOrigin(0, 0).setDepth(5);
      this.doorSprites.set(d.id, img);
    }
    for (const c of this.map.chests) {
      if (this.opened.has(c.id)) continue;
      const { px, py } = at(c.x, c.y);
      this.add.image(px, py, 'ent_chest').setOrigin(0, 0).setDepth(5);
    }
    const dungeonCleared = this.state.world.dungeon
      ? isDungeonCleared(this.state, this.state.world.dungeon.id)
      : false;
    for (const o of this.map.objectives) {
      if (dungeonCleared) continue;
      const { px, py } = at(o.x, o.y);
      const img = this.add.image(px, py, 'ent_objective').setOrigin(0, 0).setDepth(6);
      this.tweens.add({ targets: img, alpha: 0.6, duration: 1100, yoyo: true, repeat: -1 });
    }
    for (const m of this.map.minibosses) {
      if (this.state.world.flags[`miniboss_${m.id}`]) continue;
      const { px, py } = at(m.x, m.y);
      const img = this.add.image(px, py, 'ent_boss_marker').setOrigin(0, 0).setDepth(6);
      this.tweens.add({ targets: img, alpha: 0.6, duration: 1300, yoyo: true, repeat: -1 });
    }
    for (const w of this.map.waystones) {
      const { px, py } = at(w.x, w.y);
      const img = this.add.image(px, py, 'ent_teleporter').setOrigin(0, 0).setDepth(5);
      if (this.state.world.flags[waystoneFlag(w.id)]) {
        this.tweens.add({ targets: img, alpha: 0.6, duration: 900, yoyo: true, repeat: -1 });
      }
    }
  }

  /** Wash non-vale themes with a translucent color over the ground (v2 W2). */
  private applyThemeTint(): void {
    const tints: Partial<Record<string, number>> = {
      cave: 0x0c2a33,
      ash: 0x331f10,
      hollow: 0x1a1038,
    };
    const tint = tints[this.map.theme];
    if (tint === undefined) return;
    const w = this.map.width * TILE;
    const h = this.map.height * TILE;
    this.add.rectangle(0, 0, w, h, tint, 0.3).setOrigin(0, 0).setDepth(1);
  }

  /** Re-evaluate doors after a lever/plate change; open any now satisfied. */
  private refreshDoors(): void {
    const idx = this.index as Map<string, EntityAt>;
    let openedOne = false;
    for (const d of this.map.doors) {
      const key = `${String(d.x)},${String(d.y)}`;
      if (!idx.has(key)) continue; // already open
      if (!doorOpen(d.needs, this.puzzle)) continue;
      idx.delete(key);
      this.doorSprites.get(d.id)?.destroy();
      this.doorSprites.delete(d.id);
      openedOne = true;
    }
    if (openedOne) {
      playSfx('unlock');
      dom.toast('Stone grinds. A way opens.');
    }
  }

  /** Grant a dungeon chest's reward (v2 W2): a key, essence, or flavor. */
  private openChest(reward: string): void {
    if (reward.startsWith('key:')) {
      this.puzzle.keys.add(reward.slice(4));
      playSfx('unlock');
      dom.toast('A key. It may fit a lock nearby.');
      return;
    }
    if (reward.startsWith('essence:')) {
      const n = Number(reward.slice('essence:'.length)) || 0;
      this.state.player.essence += n;
      playSfx('unlock');
      dom.toast(`+${String(n)} essence`);
      return;
    }
    dom.toast('Dust and old bones.');
  }

  /** Attune to a waystone, then offer travel to any other discovered one (v2 W3). */
  private useWaystone(id: string): void {
    const here = this.map.waystones.find((w) => w.id === id);
    if (!here) return;
    if (!this.state.world.flags[waystoneFlag(here.id)]) {
      this.state.world.flags[waystoneFlag(here.id)] = true;
      this.autoSave();
      dom.toast('Waystone attuned.', true);
    }
    const labels: Partial<Record<string, string>> = {
      hearth: 'Hearth',
      hearthvale: 'Hearthvale',
      westwood: 'Westwood',
      ashenreach: 'Ashen Reach',
      northhollow: 'North Hollow',
    };
    const dests: { map: MapId; x: number; y: number; label: string }[] = [];
    for (const key of Object.keys(MAPS) as MapId[]) {
      const m = MAPS[key];
      if (!m) continue;
      for (const w of m.waystones) {
        if (w.id === here.id) continue;
        if (this.state.world.flags[waystoneFlag(w.id)]) {
          dests.push({ map: key, x: w.x, y: w.y, label: labels[key] ?? key });
        }
      }
    }
    if (dests.length === 0) {
      dom.openDialog({
        speaker: 'WAYSTONE',
        pages: ['The stone hums, alone for now.', 'Attune others to travel between them.'],
      });
      return;
    }
    const options = dests.map((d) => d.label);
    options.push('Stay');
    dom.openChoice('WAYSTONE', 'Step to which waystone?', options, (i) => {
      const d = dests[i];
      if (!d) return;
      this.busy = true;
      playSfx('cast');
      this.state = applyExit(this.state, {
        x: this.state.world.x,
        y: this.state.world.y,
        to: d.map,
        tx: d.x,
        ty: d.y,
      });
      this.autoSave();
      void dom.irisTransition(() => this.scene.restart({ state: this.state }));
    });
  }

  /** A deterministic rotating gear stock for the town armorer (v2 W3). */
  private shopStock(): GearItem[] {
    const bases = ['apprentice_robe', 'spark_wand', 'quartz_charm', 'travel_boots'];
    const seed = deriveSeed(sessionSeed, Math.floor(this.state.stats.battles / 8) + 101);
    return bases
      .map((b, i) => rollGear(b, i === 0 ? 'fine' : 'common', deriveSeed(seed, i)))
      .filter((g): g is GearItem => g !== null);
  }

  private openShop(): void {
    dom.openChoice(
      'ARMORER',
      'What do you need?',
      ['Buy gear', 'Sell gear', 'Equip', 'Class', 'Appearance', 'Leave'],
      (i) => {
        if (i === 0) this.shopBuy();
        else if (i === 1) this.shopSell();
        else if (i === 2) this.shopEquip();
        else if (i === 3) this.shopClass();
        else if (i === 4) this.shopAppearance();
      },
    );
  }

  private shopEquip(): void {
    const gear = this.state.player.inventory.gear;
    if (gear.length === 0) {
      dom.toast('No gear to equip.');
      return;
    }
    const options = gear.map((it) => {
      const worn = this.state.player.equipment[it.slot] === it.uid ? ' [worn]' : '';
      return `${itemLabel(it)}${worn}`;
    });
    options.push('Back');
    dom.openChoice('EQUIP', 'Wear which?', options, (i) => {
      const it = gear[i];
      if (!it) return;
      this.state = equipGear(this.state, it.uid);
      this.autoSave();
      dom.toast(`Equipped ${itemLabel(it)}.`);
    });
  }

  private shopClass(): void {
    const cur = this.state.player.klass;
    const options = CLASS_IDS.map((id) => {
      const c = CLASSES[id];
      return `${c.label}${cur === id ? ' [yours]' : ''}: ${c.blurb}`;
    });
    options.push('Back');
    dom.openChoice('CALLING', 'Choose your calling.', options, (i) => {
      const id = CLASS_IDS[i];
      if (!id) return;
      this.state.player.klass = id;
      this.autoSave();
      dom.toast(`You are now a ${CLASSES[id].label}.`, true);
    });
  }

  private shopAppearance(): void {
    const options = [...PALETTE_IDS];
    options.push('Back');
    dom.openChoice('DYES', 'Pick a colour.', options, (i) => {
      const pal = PALETTE_IDS[i];
      if (!pal) return;
      this.state.player.appearance.palette = pal;
      this.autoSave();
      this.busy = true;
      void dom.irisTransition(() => this.scene.restart({ state: this.state }));
    });
  }

  private shopBuy(): void {
    const stock = this.shopStock();
    const options = stock.map((it) => `${itemLabel(it)} (${String(itemValue(it))}g)`);
    options.push('Back');
    dom.openChoice('BUY', `Gold: ${String(this.state.player.gold)}`, options, (i) => {
      const it = stock[i];
      if (!it) return;
      const r = buyGear(this.state, it, itemValue(it));
      if (!r.ok) {
        dom.toast(r.reason === 'gold' ? 'Not enough gold.' : 'Your pack is full.');
        return;
      }
      this.state = r.state;
      this.autoSave();
      dom.toast(`Bought ${itemLabel(it)}.`);
    });
  }

  private shopSell(): void {
    const gear = this.state.player.inventory.gear;
    if (gear.length === 0) {
      dom.toast('Nothing to sell.');
      return;
    }
    const options = gear.map((it) => `${itemLabel(it)} (+${String(itemValue(it))}g)`);
    options.push('Back');
    dom.openChoice('SELL', `Gold: ${String(this.state.player.gold)}`, options, (i) => {
      const it = gear[i];
      if (!it) return;
      const r = sellGear(this.state, it.uid);
      this.state = r.state;
      this.autoSave();
      dom.toast(`Sold for ${String(r.gold)}g.`);
    });
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
    // A battle asked the world to rebuild. Do it here, on a clean tick,
    // outside the WAKE event dispatch that requested it (see pendingRebuild).
    if (this.pendingRebuild) {
      this.pendingRebuild = false;
      this.scene.restart({ state: this.state });
      return;
    }
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

    // Pressure plates latch when stepped on (v2 W2), re-evaluating doors.
    const plate = this.map.plates.find((p) => p.x === this.targetX && p.y === this.targetY);
    if (plate && !this.puzzle.plates.has(plate.id)) {
      this.puzzle.plates.add(plate.id);
      playSfx('cast');
      dom.toast('Something clicks beneath your feet.');
      this.refreshDoors();
    }

    // Fixed ambush tiles (v2 W4): a guaranteed fight, repeatable when flagged.
    const ambush = this.map.ambushes.find((a) => a.x === this.targetX && a.y === this.targetY);
    if (ambush) {
      const flag = `ambush_${ambush.id}`;
      if (ambush.repeat || !this.state.world.flags[flag]) {
        if (!ambush.repeat) this.state.world.flags[flag] = true;
        const table = ZONES[ambush.table];
        const formation =
          table.formations[Math.floor(this.worldRng() * table.formations.length)] ??
          table.formations[0];
        if (formation) {
          this.startEncounter({
            zone: ambush.table,
            formation: { members: formation.members, weight: 1 },
            enemyLv: ambush.lv,
            ambush: true,
          });
          return;
        }
      }
    }

    const exit = exitAt(this.map, this.targetX, this.targetY);
    if (exit) {
      const sealed = exitLocked(this.state, exit.to);
      if (sealed) {
        const entry = DIALOGUE[sealed];
        if (entry) dom.openDialog(entry);
        return;
      }
      this.busy = true;
      this.state = applyExit(this.state, exit);
      // NG+: the Vale leans differently behind every door (03 s25).
      if (this.state.player.ngPlus > 0) this.state = rotateAspect(this.state, this.worldRng);
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

    const ng = this.state.player.ngPlus > 0;
    const zoneTable = zoneAt(this.map, this.targetX, this.targetY)?.table ?? null;
    const result = resolveStep(
      {
        tile: tileAt(this.map, this.targetX, this.targetY),
        zone: zoneTable,
        graceSteps: this.state.world.graceSteps,
        stepCount: this.state.stats.steps,
        playerLv: this.state.player.lv,
        eliteEligible: this.state.world.bosses.bogmaw || ng,
        eliteChance: ng ? ELITE.chanceNgPlus : zoneTable ? ZONES[zoneTable].eliteChance : undefined,
        glimmerChance: ng ? RARE.glimmerChanceNgPlus : undefined,
        regenEvery: this.state.player.charms.equipped.includes('springstep')
          ? CHARM.springstepRegen
          : undefined,
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

  private startBossBattle(bossId: BossId, rematch = false): void {
    this.busy = true;
    playSfx('encounter');
    const seed = deriveSeed(sessionSeed, this.state.stats.battles + this.state.stats.defeats + 1);
    const marker = this.map.bosses.find((b) => b.id === bossId);
    const zone = marker ? (zoneAt(this.map, marker.x, marker.y)?.table ?? null) : null;
    if (!rematch) this.rematchBoss = null;
    void dom.encounterFlash(this.state.settings.reducedFlash).then(() => {
      let result: BattleResult | null = null;
      this.scene.launch('Battle', {
        state: this.state,
        bossId,
        zone,
        rematch,
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
    const trial = this.pendingTrial;
    this.pendingTrial = null;
    const objective = this.pendingObjective;
    this.pendingObjective = null;
    const miniboss = this.pendingMiniboss;
    this.pendingMiniboss = null;
    if (trial && result.outcome === 'victory') this.completeTrial(trial);
    if (result.outcome === 'defeat') {
      // A wipe inside a dungeon ejects to the entrance, keeping all gains.
      if (this.state.world.dungeon) {
        this.state = dungeonEject(this.state);
        this.autoSave();
        this.refreshHud();
        this.pendingRebuild = true;
        dom.toast('You wake at the dungeon mouth. Nothing was lost.', true);
        return;
      }
      this.pendingRebuild = true;
      const entry = DIALOGUE['defeat_wake'];
      if (entry) dom.openDialog(entry);
      if (result.essenceLost > 0) {
        dom.toast(`${String(result.essenceLost)} essence fell where you did`, true);
      }
      return;
    }
    // Dungeon objective cleared: grant the reward once and end the run.
    if (objective && result.outcome === 'victory' && this.state.world.dungeon) {
      const def = dungeonById(objective);
      if (def && !isDungeonCleared(this.state, def.id)) {
        this.grantCache(def.reward);
        if (def.gold > 0) {
          this.state.player.gold += def.gold;
          dom.toast(`+${String(def.gold)} gold`, true);
        }
        if (def.gearReward) {
          const seed = deriveSeed(sessionSeed, this.state.stats.battles + 7);
          const item = rollGear(def.gearReward.base, def.gearReward.rarity, seed);
          if (item) {
            this.state = grantGear(this.state, item);
            dom.toast(`Found: ${itemLabel(item)}`, true);
          }
        }
      }
      this.state = dungeonComplete(this.state, objective);
      playSfx('unlock');
      dom.toast('The crypt falls silent. The way is yours.', true);
      this.autoSave();
      this.refreshHud();
      if (result.xpGained > 0) dom.toast(`+${String(result.xpGained)} XP`);
      this.pendingRebuild = true;
      return;
    }
    if (this.rematchBoss && result.bossId === this.rematchBoss) {
      if (result.outcome === 'victory') {
        const r = applyRematchReward(this.state, this.rematchBoss);
        this.state = r.state;
        if (r.firstClear) {
          dom.toast(`✦ First rematch clear: +${String(r.reward)} essence`, true);
        }
      }
      this.rematchBoss = null;
      this.autoSave();
      this.refreshHud();
      if (result.xpGained > 0) dom.toast(`+${String(result.xpGained)} XP`);
      this.pendingRebuild = true;
      return;
    }
    // Miniboss felled: mark it down and rebuild so the marker is gone.
    if (miniboss && result.outcome === 'victory') {
      this.state.world.flags[`miniboss_${miniboss}`] = true;
      this.autoSave();
      this.refreshHud();
      if (result.xpGained > 0) dom.toast(`+${String(result.xpGained)} XP`);
      if (result.essenceGained > 0) dom.toast(`+${String(result.essenceGained)} essence`);
      this.pendingRebuild = true;
      return;
    }
    if (result.bossId === 'valewraith' && result.outcome === 'victory') {
      // The finale: the Ending cover takes over, then restarts the world
      // for post-game free roam.
      this.scene.start('Ending', { state: this.state });
      return;
    }
    if (result.bossId === 'hollowwarden' && result.outcome === 'victory') {
      // The fourth Warden falls: WRAITHMARK and the feat (03 section 23).
      if (!this.state.world.flags['rune_wraithmark']) {
        this.state.world.flags['rune_wraithmark'] = true;
        playSfx('unlock');
        dom.toast('✦ The WRAITHMARK rune is yours', true);
      }
      this.grantFeat('fourth_warden', 'Fourth Warden');
      this.checkRelicRoad();
      this.autoSave();
      const entry = DIALOGUE['warden_gone'];
      if (entry) dom.openDialog(entry);
      this.pendingRebuild = true;
      return;
    }
    if (result.bossId && result.outcome === 'victory') {
      const toastText = BOSSES[result.bossId].sigilToast;
      playSfx('unlock');
      if (toastText) dom.toast(`✦ ${toastText}`, true);
      // Rebuild the map so the fallen Warden's marker disappears.
      this.pendingRebuild = true;
    }
    if (result.xpGained > 0) dom.toast(`+${String(result.xpGained)} XP`);
    if (result.essenceGained > 0) dom.toast(`+${String(result.essenceGained)} essence`);
    result.featsEarned.forEach((id, i) => {
      setTimeout(
        () => {
          playSfx('unlock');
          dom.toast(`✦ Feat: ${id.replace(/_/g, ' ')}`, true);
        },
        300 + i * 700,
      );
    });
    result.masteryTierUps.forEach(({ element, tier }, i) => {
      setTimeout(
        () => {
          playSfx('mastery_tier');
          dom.toast(
            `✦ ${ELEMENTS[element].label.toUpperCase()} mastery tier ${String(tier)}`,
            true,
          );
        },
        400 + i * 700,
      );
    });
    result.levelsGained.forEach((lv, i) => {
      setTimeout(
        () => {
          playSfx('levelup');
          dom.toast(`★ Level ${String(lv)}! Fully restored.`);
          for (const unlock of unlocksAtLevel(lv, this.state.player.starter)) {
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
    const options: string[] = [];
    const acts: (() => void)[] = [];
    const unlocked = this.state.player.slotsUnlocked;
    if (unlocked < 6) {
      const slot = unlocked === 4 ? 5 : 6;
      const price = slot === 5 ? ESSENCE.slot5 : ESSENCE.slot6;
      if (this.state.player.essence >= price) {
        options.push(`Unbind page ${String(slot)} (${String(price)} essence)`);
        acts.push(() => {
          const bought = applySlotPurchase(this.state, ESSENCE);
          if (!bought) return;
          this.state = bought.state;
          playSfx('unlock');
          dom.toast(`✦ Grimoire slot ${String(bought.slot)} unbound`, true);
          this.autoSave();
        });
      }
    }
    // Scribe a scroll of any inscribed spell (03 section 24; the
    // grimoire's inscribed pages are the craftable compositions).
    const cap = this.state.player.charms.equipped.includes('scrollsash')
      ? CHARM.scrollsashCap
      : SCROLL.cap;
    if (
      this.state.player.scrolls.length < cap &&
      this.state.player.essence >= SCROLL.essencePrice
    ) {
      const inscribed = this.state.player.spells.filter((sp) => sp !== null);
      if (inscribed.length > 0) {
        options.push(`Scribe a scroll (${String(SCROLL.essencePrice)} essence)`);
        acts.push(() => {
          const spells = this.state.player.spells
            .map((sp, i) => ({ sp, i }))
            .filter((x): x is { sp: NonNullable<typeof x.sp>; i: number } => x.sp !== null);
          dom.openChoice(
            'SHRINE',
            'Which page should the scroll carry, overcharged and once?',
            [...spells.map((x) => displayName(x.sp)), 'None'],
            (j) => {
              const pick = spells[j];
              if (!pick) return;
              this.state.player.essence -= SCROLL.essencePrice;
              this.state.player.scrolls.push({ ...pick.sp });
              playSfx('confirm');
              dom.toast(`✦ Scroll scribed: ${displayName(pick.sp)}`, true);
              this.autoSave();
            },
          );
        });
      }
    }
    if (options.length === 0) return;
    options.push('Not now');
    acts.push(() => undefined);
    dom.openChoice('SHRINE', 'The shrine hums over your grimoire.', options, (i) => {
      acts[i]?.();
    });
  }

  /** Trial stones (03 section 23): state the demand, offer the fight. */
  private openTrial(key: TrialKey): void {
    const t = TRIALS[key];
    if (this.state.world.flags[t.flag]) {
      const entry = DIALOGUE['trial_done'];
      if (entry) dom.openDialog(entry);
      return;
    }
    dom.openChoice(t.title.toUpperCase(), t.demand, ['Face the trial', 'Leave'], (i) => {
      if (i !== 0) return;
      this.pendingTrial = key;
      this.startEncounter({
        zone: 'sanctum.halls',
        formation: { members: ['trialguardian'], weight: 1 },
        enemyLv: TRIAL_GUARDIAN_LV,
        trialKey: key,
      });
    });
  }

  private completeTrial(key: TrialKey): void {
    const t = TRIALS[key];
    if (this.state.world.flags[t.flag]) return;
    this.state.world.flags[t.flag] = true;
    if (!this.state.world.flags['form_call']) {
      this.state.world.flags['form_call'] = true;
      playSfx('unlock');
      dom.toast('✦ The CALL form is yours. Something will answer.', true);
    }
    if (
      TRIAL_KEYS.every((k) => this.state.world.flags[TRIALS[k].flag]) &&
      !this.state.world.flags['trials_complete']
    ) {
      this.state.world.flags['trials_complete'] = true;
      playSfx('unlock');
      dom.toast('✦ Twin inscription unlocked. Two natures, one page.', true);
    }
    this.autoSave();
  }

  private interact(): void {
    const { x, y } = facingPos(this.state.world.x, this.state.world.y, this.state.world.facing);
    const entity = this.index.get(`${String(x)},${String(y)}`) ?? null;
    const action = interactionFor(this.map, entity);
    if (!action) return;
    switch (action.kind) {
      case 'dialogue': {
        // Town vendors intercept their gossip (v2 W3).
        if (action.npcId === 'armorer') {
          this.openShop();
          break;
        }
        // Commission NPCs intercept their base gossip (03 section 21).
        if (action.npcId && this.tryCommission(action.npcId)) break;
        const id = action.npcId ? npcDialogueId(action.npcId, action.id, this.state) : action.id;
        const entry = DIALOGUE[id];
        if (entry) dom.openDialog(entry);
        break;
      }
      case 'egate':
        this.openEgate(action.id);
        break;
      case 'murk':
        this.talkToMurk();
        break;
      case 'trial':
        this.openTrial(action.key);
        break;
      case 'portal': {
        if (this.state.world.dungeon) {
          dom.openChoice(
            'WAY OUT',
            'Leave the dungeon? The way will reset behind you.',
            ['Leave', 'Stay'],
            (i) => {
              if (i !== 0) return;
              this.state = dungeonEject(this.state);
              this.autoSave();
              this.busy = true;
              playSfx('cast');
              void dom.irisTransition(() => this.scene.restart({ state: this.state }));
            },
          );
          break;
        }
        const def = dungeonById(action.dungeon);
        const portal = this.map.portals.find((p) => p.dungeon === action.dungeon);
        if (!def || !portal) break;
        dom.openChoice(
          def.name.toUpperCase(),
          `${def.name}. Suggested skill: about Lv ${String(def.suggestedLv)}. The Vale will not weep if you turn back.`,
          ['Enter', 'Not yet'],
          (i) => {
            if (i !== 0) return;
            this.state = dungeonEnter(this.state, def.id, portal.to, portal.tx, portal.ty);
            this.autoSave();
            this.busy = true;
            playSfx('cast');
            void dom.irisTransition(() => this.scene.restart({ state: this.state }));
          },
        );
        break;
      }
      case 'lever': {
        if (this.puzzle.levers.has(action.id)) {
          dom.toast('The lever is already thrown.');
          break;
        }
        this.puzzle.levers.add(action.id);
        this.puzzle.seq.push(action.id);
        this.leverSprites.get(action.id)?.setTint(0xffc857);
        playSfx('cast');
        dom.toast('The lever grinds home.');
        this.refreshDoors();
        break;
      }
      case 'door':
        dom.toast('The door holds fast.');
        break;
      case 'chest': {
        const chest = this.map.chests.find((c) => c.id === action.id);
        if (!chest || this.opened.has(chest.id)) {
          dom.toast('Empty.');
          break;
        }
        this.opened.add(chest.id);
        this.openChest(chest.reward);
        this.refreshHud();
        this.autoSave();
        break;
      }
      case 'objective': {
        const objEntity = this.map.objectives.find((o) => o.id === action.id);
        if (!objEntity) break;
        const battle = dungeonObjective(objEntity.battle);
        if (!battle) break;
        dom.openChoice('!', 'Something stirs in the dark. Face it?', ['Fight', 'Back'], (i) => {
          if (i !== 0) return;
          this.pendingObjective = this.state.world.dungeon?.id ?? null;
          this.startEncounter({
            zone: this.map.zones[0]?.table ?? 'sunkencrypt.flooded',
            formation: { members: battle.members, weight: 1 },
            enemyLv: battle.lv,
          });
        });
        break;
      }
      case 'miniboss': {
        const mb = this.map.minibosses.find((m) => m.id === action.id);
        if (!mb || this.state.world.flags[`miniboss_${mb.id}`]) break;
        dom.openChoice(
          '!',
          `It looks about Lv ${String(mb.lv)}. Take it on?`,
          ['Fight', 'Back'],
          (i) => {
            if (i !== 0) return;
            this.pendingMiniboss = mb.id;
            this.startEncounter({
              zone: this.map.zones[0]?.table ?? 'sunkencrypt.flooded',
              formation: { members: [mb.species], weight: 1 },
              enemyLv: mb.lv,
            });
          },
        );
        break;
      }
      case 'waystone':
        this.useWaystone(action.id);
        break;
      case 'spring': {
        playSfx('heal');
        this.state = applySpringRestore(this.state);
        this.rotateValeAspect();
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
        this.rotateValeAspect();
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
        const bossId = action.bossId as BossId;
        const bossName = BOSSES[bossId].name;
        const canPay = canAffordRematch(this.state);
        const options = ['Travel to Hearth'];
        if (canPay) options.push(`Rematch ${bossName} (${String(ESSENCE.rematchEntry)} essence)`);
        options.push('Not now');
        dom.openChoice('WAYSTONE', 'The spent sigil hums, holding two roads.', options, (i) => {
          if (i === 0) {
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
            return;
          }
          if (canPay && i === 1) {
            this.state = applyRematchEntry(this.state);
            this.rematchBoss = bossId;
            this.refreshHud();
            this.startBossBattle(bossId, true);
          }
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
