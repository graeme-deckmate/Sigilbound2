/**
 * Gear and item types (v2 V1). Gear augments the grimoire, it never replaces
 * it: a GearItem is a *composition* (base + rarity + affixes) and derives its
 * stat mods, exactly like a Spell derives its numbers. The single contract the
 * battle layer reads is StatMods; everything defaults off so a gearless player
 * (and the balance sim) sees byte-identical numbers (effects wired in V2).
 */
import type { ElementId } from './state.ts';

export type EquipSlotId = 'vestment' | 'implement' | 'talisman' | 'boots';
export const EQUIP_SLOT_IDS: readonly EquipSlotId[] = [
  'vestment',
  'implement',
  'talisman',
  'boots',
];

export type ItemRarity = 'common' | 'fine' | 'rare' | 'relic';
export const RARITY_IDS: readonly ItemRarity[] = ['common', 'fine', 'rare', 'relic'];

/**
 * Every stat axis gear / affixes / talents / class passives can touch. Flats
 * add; *Mult fields multiply (1 = identity); proc/crit add. Empty object = no
 * effect, which is what keeps the gearless sim unchanged.
 */
export interface StatMods {
  maxhp?: number;
  maxmp?: number;
  powerMult?: number;
  costMult?: number;
  critChance?: number;
  critMult?: number;
  procBonus?: number;
  defense?: number;
  resist?: Partial<Record<ElementId, number>>;
  regenStep?: number;
}

/** An affix template, drawn from data/affixes.ts. */
export interface AffixDef {
  id: string;
  label: string;
  place: 'prefix' | 'suffix';
  mods: StatMods;
  minRarity: ItemRarity;
}

/** A static gear base, drawn from data/gear.ts. */
export interface GearBaseDef {
  id: string;
  slot: EquipSlotId;
  label: string;
  mods: StatMods;
  /** Base shop/sell value before rarity scaling. */
  value: number;
}

/** An owned item instance. Stats are NOT stored; they derive from base + affixes. */
export interface GearItem {
  uid: string;
  base: string;
  slot: EquipSlotId;
  rarity: ItemRarity;
  affixes: string[];
}

/** Equipped slots reference inventory uids (null = empty). */
export type Equipment = Record<EquipSlotId, string | null>;

export interface Inventory {
  gear: GearItem[];
  capacity: number;
}

export function emptyEquipment(): Equipment {
  return { vestment: null, implement: null, talisman: null, boots: null };
}
