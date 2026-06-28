/**
 * Dungeon registry (v2 W2). A dungeon is an ordinary compiled map entered
 * through an overworld @portal; this table holds its display name, the
 * shown suggested level, and the one-time completion reward. Objectives map
 * to a fixed strong formation in W2 (W5 promotes them to dungeon bosses).
 */
import type { EnemySpeciesId } from './enemies.ts';
import type { CacheReward } from './discovery.ts';

export interface DungeonDef {
  id: string;
  name: string;
  /** Shown at the mouth, the explicit difficulty signal players asked for. */
  suggestedLv: number;
  /** Granted once, on first completion. */
  reward: CacheReward;
}

export const DUNGEONS: Record<string, DungeonDef> = {
  sunkencrypt: {
    id: 'sunkencrypt',
    name: 'The Sunken Crypt',
    suggestedLv: 6,
    reward: { kind: 'essence', amount: 40 },
  },
};

/**
 * Dungeon objective battles (W2: a fixed strong formation; W5 adds a
 * `boss` variant keyed to DungeonBossId). Keyed by the @objective battle id.
 */
export interface DungeonObjective {
  id: string;
  members: readonly EnemySpeciesId[];
  lv: number;
}

export const DUNGEON_OBJECTIVES: Record<string, DungeonObjective> = {
  crypt_guardians: {
    id: 'crypt_guardians',
    members: ['hollowshade', 'pondscale', 'hollowshade'],
    lv: 6,
  },
};

export function dungeonById(id: string): DungeonDef | null {
  return DUNGEONS[id] ?? null;
}

export function dungeonObjective(id: string): DungeonObjective | null {
  return DUNGEON_OBJECTIVES[id] ?? null;
}

/** Persistent flag marking a dungeon cleared once (reward granted). */
export function dungeonClearFlag(id: string): string {
  return `dungeon_clear_${id}`;
}
