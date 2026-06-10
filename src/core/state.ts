/**
 * GameState: the single object that owns truth (docs/01-ARCHITECTURE).
 * Types only; numbers and tables land in src/data/ in Phase 1.
 * Identifier unions are transcribed from docs/03-CONTENT-DATA.
 */

export type ElementId = 'ember' | 'rime' | 'volt' | 'thorn' | 'gloom';
export type FormId = 'wisp' | 'bolt' | 'lance' | 'nova' | 'veil';
export type RuneId = 'none' | 'fury' | 'thirst' | 'echo' | 'hex' | 'keen';

export type MapId = 'hearth' | 'hearthvale' | 'westwood' | 'ashenreach' | 'northhollow';

/** Rune shrines, keyed by the rune they grant. */
export type ShrineId = 'fury' | 'thirst' | 'echo' | 'keen';

export type BossId = 'bogmaw' | 'thornveil' | 'ashenwarden' | 'valewraith';

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
  form: FormId;
  rune: RuneId;
}

export interface GameState {
  version: 1;
  player: {
    lv: number;
    xp: number;
    hp: number;
    mp: number;
    maxhp: number;
    maxmp: number;
    /** Equip slots, fixed length 4. */
    spells: (Spell | null)[];
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
  };
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
  };
}
