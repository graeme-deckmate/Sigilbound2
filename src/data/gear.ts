/**
 * Static gear bases (v2 V1). Modest envelopes so gear augments the grimoire
 * rather than dominating spell composition. Stat effects activate in V2.
 */
import type { GearBaseDef } from '../core/items.ts';

export const GEAR_BASES: Record<string, GearBaseDef> = {
  // Vestments (robes): hp / defense / resist
  apprentice_robe: {
    id: 'apprentice_robe',
    slot: 'vestment',
    label: 'Apprentice Robe',
    value: 10,
    mods: { maxhp: 6 },
  },
  warded_robe: {
    id: 'warded_robe',
    slot: 'vestment',
    label: 'Warded Robe',
    value: 26,
    mods: { maxhp: 12, defense: 1 },
  },
  // Implements (foci): power / cost
  spark_wand: {
    id: 'spark_wand',
    slot: 'implement',
    label: 'Spark Wand',
    value: 12,
    mods: { powerMult: 1.05 },
  },
  focus_rod: {
    id: 'focus_rod',
    slot: 'implement',
    label: 'Focus Rod',
    value: 30,
    mods: { powerMult: 1.1, costMult: 0.95 },
  },
  // Talismans: mp / crit / proc
  quartz_charm: {
    id: 'quartz_charm',
    slot: 'talisman',
    label: 'Quartz Charm',
    value: 10,
    mods: { maxmp: 4 },
  },
  keen_eye: {
    id: 'keen_eye',
    slot: 'talisman',
    label: 'Keen Eye',
    value: 24,
    mods: { critChance: 0.04 },
  },
  // Boots: regen
  travel_boots: {
    id: 'travel_boots',
    slot: 'boots',
    label: 'Travel Boots',
    value: 10,
    mods: { regenStep: 1 },
  },
  warded_boots: {
    id: 'warded_boots',
    slot: 'boots',
    label: 'Warded Boots',
    value: 22,
    mods: { regenStep: 1, defense: 1 },
  },
};

export const GEAR_BASE_IDS: readonly string[] = Object.keys(GEAR_BASES);
