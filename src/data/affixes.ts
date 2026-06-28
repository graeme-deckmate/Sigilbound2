/**
 * Affix pool for gear rolls (v2 V1). A rarity grants a fixed number of affixes
 * (drawn deterministically from a seed). Each affix is a small StatMods rider.
 */
import type { AffixDef, ItemRarity } from '../core/items.ts';

export const AFFIXES: readonly AffixDef[] = [
  { id: 'sturdy', label: 'Sturdy', place: 'prefix', minRarity: 'common', mods: { maxhp: 5 } },
  { id: 'arcane', label: 'Arcane', place: 'prefix', minRarity: 'common', mods: { maxmp: 4 } },
  { id: 'keen', label: 'Keen', place: 'prefix', minRarity: 'fine', mods: { critChance: 0.03 } },
  { id: 'fierce', label: 'Fierce', place: 'prefix', minRarity: 'fine', mods: { powerMult: 1.06 } },
  { id: 'warding', label: 'Warding', place: 'prefix', minRarity: 'fine', mods: { defense: 1 } },
  {
    id: 'of_haste',
    label: 'of Haste',
    place: 'suffix',
    minRarity: 'common',
    mods: { regenStep: 1 },
  },
  {
    id: 'of_focus',
    label: 'of Focus',
    place: 'suffix',
    minRarity: 'fine',
    mods: { costMult: 0.95 },
  },
  { id: 'of_ruin', label: 'of Ruin', place: 'suffix', minRarity: 'rare', mods: { critMult: 0.15 } },
  {
    id: 'of_the_bear',
    label: 'of the Bear',
    place: 'suffix',
    minRarity: 'rare',
    mods: { maxhp: 10 },
  },
  {
    id: 'of_power',
    label: 'of Power',
    place: 'suffix',
    minRarity: 'rare',
    mods: { powerMult: 1.08 },
  },
];

/** How many affixes each rarity rolls. */
export const RARITY_AFFIX_COUNT: Record<ItemRarity, number> = {
  common: 0,
  fine: 1,
  rare: 2,
  relic: 3,
};

/** Sell/shop value multiplier per rarity. */
export const RARITY_VALUE_MULT: Record<ItemRarity, number> = {
  common: 1,
  fine: 1.8,
  rare: 3.2,
  relic: 6,
};

export function affixById(id: string): AffixDef | null {
  return AFFIXES.find((a) => a.id === id) ?? null;
}
