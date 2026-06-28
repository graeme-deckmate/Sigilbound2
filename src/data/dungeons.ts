/**
 * Dungeon registry (v2 W2). A dungeon is an ordinary compiled map entered
 * through an overworld @portal; this table holds its display name, the
 * shown suggested level, and the one-time completion reward. Objectives map
 * to a fixed strong formation in W2 (W5 promotes them to dungeon bosses).
 */
import type { EnemySpeciesId } from './enemies.ts';
import type { CacheReward } from './discovery.ts';
import type { ItemRarity } from '../core/items.ts';

export interface DungeonDef {
  id: string;
  name: string;
  /** Shown at the mouth, the explicit difficulty signal players asked for. */
  suggestedLv: number;
  /** Granted once, on first completion. */
  reward: CacheReward;
  /** Gold granted on first completion (v2 W5). */
  gold: number;
  /** A gear base granted (rolled to this rarity) on first completion (v2 W5). */
  gearReward?: { base: string; rarity: ItemRarity };
}

export const DUNGEONS: Record<string, DungeonDef> = {
  sunkencrypt: {
    id: 'sunkencrypt',
    name: 'The Sunken Crypt',
    suggestedLv: 6,
    reward: { kind: 'essence', amount: 40 },
    gold: 35,
    gearReward: { base: 'warded_robe', rarity: 'fine' },
  },
  circuitvault: {
    id: 'circuitvault',
    name: 'The Dead Circuit Vault',
    suggestedLv: 8,
    reward: { kind: 'essence', amount: 60 },
    gold: 60,
    gearReward: { base: 'focus_rod', rarity: 'rare' },
  },
  emberforge: {
    id: 'emberforge',
    name: 'The Emberforge',
    suggestedLv: 7,
    reward: { kind: 'essence', amount: 50 },
    gold: 55,
    gearReward: { base: 'keen_eye', rarity: 'rare' },
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
  crypt_lord: {
    id: 'crypt_lord',
    members: ['bonelord'],
    lv: 6,
  },
  circuit_core: {
    id: 'circuit_core',
    members: ['circuitwarden'],
    lv: 8,
  },
  forge_heart: {
    id: 'forge_heart',
    members: ['cindermote', 'ashling', 'cindermote'],
    lv: 7,
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
