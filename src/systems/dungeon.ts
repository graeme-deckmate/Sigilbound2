/**
 * Dungeon logic (v2 W2), pure and testable. Single-map puzzle state lives
 * in the scene (levers/keys/plates/seq); this module only evaluates door
 * predicates and the GameState transitions for entering, ejecting (fail),
 * and completing a dungeon. Ejecting keeps everything earned: XP/levels are
 * already committed by the battle reducer, and any essence the reducer
 * dropped as a defeat marker inside the dungeon is refunded.
 */
import type { GameState, MapId } from '../core/state.ts';
import { dungeonClearFlag } from '../data/dungeons.ts';

/** Scene-local puzzle state, passed to doorOpen as a read-only view. */
export interface PuzzleState {
  /** Levers currently thrown. */
  levers: ReadonlySet<string>;
  /** Keys currently held. */
  keys: ReadonlySet<string>;
  /** Pressure plates currently latched/held. */
  plates: ReadonlySet<string>;
  /** Chronological log of lever throws (for seq: doors). */
  seq: readonly string[];
}

export const EMPTY_PUZZLE: PuzzleState = {
  levers: new Set(),
  keys: new Set(),
  plates: new Set(),
  seq: [],
};

/** Does the last run of relevant throws match the target order? */
function seqMatches(thrown: readonly string[], target: readonly string[]): boolean {
  const relevant = thrown.filter((l) => target.includes(l));
  if (relevant.length < target.length) return false;
  const tail = relevant.slice(-target.length);
  return tail.every((l, i) => l === target[i]);
}

/**
 * Evaluate a door's `needs` predicate against puzzle state. Forms:
 *   lever:<id>   key:<id>   plate:<id>   seq:<a,b,c>
 */
export function doorOpen(needs: string, ps: PuzzleState): boolean {
  const idx = needs.indexOf(':');
  if (idx < 0) return false;
  const kind = needs.slice(0, idx);
  const rest = needs.slice(idx + 1);
  switch (kind) {
    case 'lever':
      return ps.levers.has(rest);
    case 'key':
      return ps.keys.has(rest);
    case 'plate':
      return ps.plates.has(rest);
    case 'seq':
      return seqMatches(
        ps.seq,
        rest.split(',').map((s) => s.trim()),
      );
    default:
      return false;
  }
}

/** Enter a dungeon: remember where to eject to, then land on the entry tile. */
export function dungeonEnter(
  state: GameState,
  dungeonId: string,
  to: MapId,
  tx: number,
  ty: number,
): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      dungeon: {
        id: dungeonId,
        entrance: { mapId: state.world.mapId, x: state.world.x, y: state.world.y },
        flags: {},
      },
      mapId: to,
      x: tx,
      y: ty,
    },
  };
}

/**
 * Fail (wipe or leave): eject to the entrance, refund any defeat-marker
 * essence dropped inside the dungeon, and clear the run. Returns the state
 * unchanged when not in a dungeon.
 */
export function dungeonEject(state: GameState): GameState {
  const d = state.world.dungeon;
  if (!d) return state;
  const marker = state.world.essenceMarker;
  const refundHere = marker && marker.mapId === state.world.mapId;
  return {
    ...state,
    player: {
      ...state.player,
      essence: state.player.essence + (refundHere ? marker.amount : 0),
    },
    world: {
      ...state.world,
      essenceMarker: refundHere ? null : marker,
      mapId: d.entrance.mapId,
      x: d.entrance.x,
      y: d.entrance.y,
      dungeon: null,
    },
  };
}

/** Complete a dungeon: mark it cleared (reward granted by the caller) and end the run. */
export function dungeonComplete(state: GameState, dungeonId: string): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      flags: { ...state.world.flags, [dungeonClearFlag(dungeonId)]: true },
      dungeon: null,
    },
  };
}

export function isDungeonCleared(state: GameState, dungeonId: string): boolean {
  return state.world.flags[dungeonClearFlag(dungeonId)] === true;
}
