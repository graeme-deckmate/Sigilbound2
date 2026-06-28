/**
 * Encounter formations, transcribed from docs/03-CONTENT-DATA section 8.
 * Enemy level rolls within the zone band (the region band from section 7).
 */
import type { EnemySpeciesId } from './enemies.ts';

export type ZoneId =
  | 'hearthvale.meadow'
  | 'hearthvale.marsh'
  | 'westwood.outer'
  | 'westwood.deep'
  | 'ashenreach.outer'
  | 'ashenreach.inner'
  | 'northhollow.cliffs'
  | 'northhollow.hollow'
  | 'sanctum.halls'
  | 'sunkencrypt.flooded';

export interface Formation {
  members: readonly EnemySpeciesId[];
  weight: number;
}

export interface ZoneTable {
  zone: ZoneId;
  levelMin: number;
  levelMax: number;
  formations: readonly Formation[];
  /** Per-zone elite promotion chance override (03 s23: sanctum 15%). */
  eliteChance?: number;
}

export const ZONE_IDS: readonly ZoneId[] = [
  'hearthvale.meadow',
  'hearthvale.marsh',
  'westwood.outer',
  'westwood.deep',
  'ashenreach.outer',
  'ashenreach.inner',
  'northhollow.cliffs',
  'northhollow.hollow',
  'sanctum.halls',
  'sunkencrypt.flooded',
];

export const ZONES: Record<ZoneId, ZoneTable> = {
  'hearthvale.meadow': {
    zone: 'hearthvale.meadow',
    levelMin: 1,
    levelMax: 4,
    formations: [
      { members: ['gloop'], weight: 3 },
      { members: ['gloop', 'gloop'], weight: 2 },
      { members: ['pondscale'], weight: 2 },
      { members: ['gloop', 'pondscale'], weight: 1 },
    ],
  },
  'hearthvale.marsh': {
    zone: 'hearthvale.marsh',
    levelMin: 1,
    levelMax: 4,
    formations: [
      { members: ['pondscale'], weight: 3 },
      { members: ['pondscale', 'gloop'], weight: 2 },
      { members: ['burrowkin'], weight: 2 },
      { members: ['burrowkin', 'pondscale'], weight: 1 },
    ],
  },
  'westwood.outer': {
    zone: 'westwood.outer',
    levelMin: 4,
    levelMax: 7,
    formations: [
      { members: ['gloomwing'], weight: 3 },
      { members: ['thornling'], weight: 2 },
      { members: ['gloomwing', 'gloomwing'], weight: 2 },
    ],
  },
  'westwood.deep': {
    zone: 'westwood.deep',
    levelMin: 4,
    levelMax: 7,
    formations: [
      { members: ['thornling', 'gloomwing'], weight: 2 },
      { members: ['mossback'], weight: 2 },
      { members: ['thornling', 'thornling'], weight: 2 },
      { members: ['mossback', 'gloomwing'], weight: 1 },
    ],
  },
  'ashenreach.outer': {
    zone: 'ashenreach.outer',
    levelMin: 5,
    levelMax: 8,
    formations: [
      { members: ['cindermote'], weight: 3 },
      { members: ['ashling'], weight: 2 },
      { members: ['cindermote', 'cindermote'], weight: 2 },
    ],
  },
  'ashenreach.inner': {
    zone: 'ashenreach.inner',
    levelMin: 5,
    levelMax: 8,
    formations: [
      { members: ['hexbinder'], weight: 2 },
      { members: ['ashling', 'cindermote'], weight: 2 },
      { members: ['hexbinder', 'ashling'], weight: 2 },
      { members: ['ashling', 'ashling', 'cindermote'], weight: 1 },
    ],
  },
  'northhollow.cliffs': {
    zone: 'northhollow.cliffs',
    levelMin: 8,
    levelMax: 10,
    formations: [
      { members: ['quartzling'], weight: 2 },
      { members: ['galeharrow'], weight: 2 },
      { members: ['quartzling', 'galeharrow'], weight: 2 },
      { members: ['quartzling', 'quartzling'], weight: 1 },
    ],
  },
  'northhollow.hollow': {
    zone: 'northhollow.hollow',
    levelMin: 8,
    levelMax: 10,
    formations: [
      { members: ['hollowshade'], weight: 2 },
      { members: ['hollowshade', 'galeharrow'], weight: 2 },
      { members: ['quartzling', 'hollowshade'], weight: 2 },
      { members: ['hollowshade', 'hollowshade', 'galeharrow'], weight: 1 },
    ],
  },
  /* Act 4 (03 section 23): Lv 11-12 remixes, elites at 15%. */
  'sanctum.halls': {
    zone: 'sanctum.halls',
    levelMin: 11,
    levelMax: 12,
    eliteChance: 0.15,
    formations: [
      { members: ['hollowshade', 'quartzling'], weight: 2 },
      { members: ['galeharrow', 'hollowshade'], weight: 2 },
      { members: ['quartzling', 'quartzling', 'hollowshade'], weight: 1 },
      { members: ['hollowshade', 'hollowshade'], weight: 1 },
    ],
  },
  /* Dungeon: The Sunken Crypt (v2 W2), suggested Lv 6, elite-leaning. */
  'sunkencrypt.flooded': {
    zone: 'sunkencrypt.flooded',
    levelMin: 5,
    levelMax: 7,
    eliteChance: 0.12,
    formations: [
      { members: ['cryptcrawler', 'marshlurk'], weight: 3 },
      { members: ['boneshade', 'cryptcrawler'], weight: 2 },
      { members: ['marshlurk', 'marshlurk', 'boneshade'], weight: 1 },
    ],
  },
};
