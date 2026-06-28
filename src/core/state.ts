/**
 * GameState: the single object that owns truth (docs/01-ARCHITECTURE).
 * Types only; numbers and tables land in src/data/ in Phase 1.
 * Identifier unions are transcribed from docs/03-CONTENT-DATA.
 */
import type { Equipment, Inventory } from './items.ts';
import type { DifficultyId } from '../data/difficulty.ts';

export type ElementId = 'ember' | 'rime' | 'volt' | 'thorn' | 'gloom';
export type FormId = 'wisp' | 'bolt' | 'lance' | 'nova' | 'veil' | 'call';
export type RuneId =
  | 'none'
  | 'fury'
  | 'thirst'
  | 'echo'
  | 'hex'
  | 'keen'
  /* v1.1: peddler trade */
  | 'wyrd'
  /* v2 V4: level-gated runes (one rule-bend each, reusing honored fields) */
  | 'weight'
  | 'ruin'
  | 'ward'
  /* v1.1: hidden relic runes, one rule-bend each (03 section 3) */
  | 'emberglass'
  | 'stillwater'
  | 'stormcoil'
  | 'hollowlight'
  | 'wraithmark';

export type MapId =
  | 'hearth'
  | 'hearthvale'
  | 'westwood'
  | 'ashenreach'
  | 'northhollow'
  | 'sanctum'
  | 'sunkencrypt'
  | 'circuitvault';

/** Rune shrines, keyed by the rune they grant. */
export type ShrineId = 'fury' | 'thirst' | 'echo' | 'keen';

export type BossId = 'bogmaw' | 'thornveil' | 'ashenwarden' | 'valewraith' | 'hollowwarden';

export type Dir = 'up' | 'down' | 'left' | 'right';

/** Statuses enemies can inflict on the player. No player stun (docs/02). */
export type PlayerStatusId = 'burning' | 'chilled' | 'envenomed' | 'withered';

/** Statuses the player can inflict on enemies. */
export type EnemyStatusId = PlayerStatusId | 'stunned';

/** Turns remaining per active status. Absent key = not afflicted. */
export type StatusMap = Partial<Record<PlayerStatusId, number>>;

/** A crafted spell is its composition; stats and name derive from it. */
export interface Spell {
  element: ElementId;
  /** Twin element (Act 4 unlock, 03 section 15). Order matters for
   *  naming and reaction-check order only. */
  e2?: ElementId;
  form: FormId;
  rune: RuneId;
  /** Potency, locked at inscribe (docs/03 section 4). v1.1. */
  p: number;
  /** Player-given name (1-18 chars); the generated name becomes the
   *  subtitle. Absent = the generated name is the name. v1.1. */
  given?: string;
}

export interface GameState {
  version: 3;
  player: {
    lv: number;
    xp: number;
    hp: number;
    mp: number;
    maxhp: number;
    maxmp: number;
    /** Equip slots, fixed length 6; slots beyond slotsUnlocked are null. */
    spells: (Spell | null)[];
    /** How many spell slots are usable (4 base; 5 and 6 bought). v1.1. */
    slotsUnlocked: 4 | 5 | 6;
    /** Starter element; null until the Elder has asked (v1.1). */
    starter: ElementId | null;
    /** Essence held (v1.1 single currency). */
    essence: number;
    /** Per-element mastery points (effects activate in Phase 12). */
    mastery: Record<ElementId, number>;
    /** Charms owned and the two equip slots (Phase 13 fills these). */
    charms: { owned: string[]; equipped: [string | null, string | null] };
    /** Carried scrolls: compositions cast once at potency 2.5 for 0 MP. */
    scrolls: Spell[];
    /** NG+ cycles completed (03 section 25). */
    ngPlus: number;
    /** Gold: the town/gear currency (v2 V1), kept distinct from essence. */
    gold: number;
    /** Worn gear per slot (v2 V1); stat effects activate in V2. */
    equipment: Equipment;
    /** Owned gear (equipped or not) plus its capacity. */
    inventory: Inventory;
    /** Battle-only, cleared on save. */
    statuses: StatusMap;
  };
  world: {
    mapId: MapId;
    x: number;
    y: number;
    facing: Dir;
    shrines: Record<ShrineId, boolean>;
    bosses: Record<BossId, boolean>;
    graceSteps: number;
    /**
     * Defeat respawn point: the tile where the player last used a
     * shrine or spring (docs/02 defeat rule). Not in the 01 interface;
     * added because the rule needs persistent state. Flagged in
     * PROGRESS.md questions.
     */
    respawn: { mapId: MapId; x: number; y: number };
    /**
     * Story and one-shot flags (scripted triggers, elder beats). 01
     * names "flags" as worldstate's job but the interface had no slot;
     * same treatment as respawn.
     */
    flags: Record<string, boolean>;
    /** Vale Aspect element; Phase 12 rotates it. Null until then. */
    aspect: ElementId | null;
    /**
     * Dropped essence from the last unrecovered defeat (03 section 16).
     * One marker only; a second defeat forfeits the older drop.
     */
    essenceMarker: { mapId: MapId; x: number; y: number; amount: number } | null;
    /**
     * Active dungeon run (v2 W1/W2). Null on the overworld. `entrance` is
     * where a fail (wipe or leave) ejects the player; `flags` holds only
     * cross-floor puzzle state (single-map puzzle state is scene-local and
     * resets for free). Cleared on eject and on completion.
     */
    dungeon: {
      id: string;
      entrance: { mapId: MapId; x: number; y: number };
      flags: Record<string, boolean>;
    } | null;
    /** Run-level options (v2 V5): difficulty + modifiers, chosen at new game. */
    run: { difficulty: DifficultyId; modifiers: string[]; seed: number };
  };
  /** Grimoire Notes page lines, player voice (Phase 13 fills). v1.1. */
  notes: string[];
  /** Feat ids earned (03 section 24). v1.1. */
  feats: string[];
  /**
   * Bestiary, filled by play only (03 section 24): kills, weaknesses
   * actually discovered, statuses landed, reactions triggered.
   */
  bestiary: Record<
    string,
    { kills: number; weak: ElementId[]; statuses: string[]; reactions: string[] }
  >;
  settings: {
    master: number;
    sfx: number;
    music: number;
    reducedFlash: boolean;
    textSpeed: 0 | 1 | 2;
    dpadSide: 'left' | 'right';
    dpadScale: number;
  };
  stats: {
    battles: number;
    inscribed: number;
    steps: number;
    defeats: number;
    playMs: number;
    /** v1.1 feat counters (03 section 24). */
    severeSurges: number;
    glimmersCaught: number;
    elitesFelled: number;
  };
}
