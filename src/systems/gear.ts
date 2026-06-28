/**
 * Gear logic (v2 V1), pure and testable. Stat aggregation, deterministic
 * rolls, and value. Gear effects flow into combat in V2 via deriveLoadout,
 * which reuses sumMods from here.
 */
import type { GearItem, ItemRarity, StatMods } from '../core/items.ts';
import { RARITY_IDS } from '../core/items.ts';
import { GEAR_BASES } from '../data/gear.ts';
import { AFFIXES, RARITY_AFFIX_COUNT, RARITY_VALUE_MULT, affixById } from '../data/affixes.ts';
import { mulberry32 } from '../core/rng.ts';

const ELEMENTS_IN: readonly string[] = ['ember', 'rime', 'volt', 'thorn', 'gloom'];

/** Merge StatMods: flats add, *Mult multiply (identity 1), crit/proc add, resist add. */
export function sumMods(mods: readonly StatMods[]): StatMods {
  const out: StatMods = {};
  let powerMult = 1;
  let costMult = 1;
  let hasMult = false;
  for (const m of mods) {
    if (m.maxhp) out.maxhp = (out.maxhp ?? 0) + m.maxhp;
    if (m.maxmp) out.maxmp = (out.maxmp ?? 0) + m.maxmp;
    if (m.critChance) out.critChance = (out.critChance ?? 0) + m.critChance;
    if (m.critMult) out.critMult = (out.critMult ?? 0) + m.critMult;
    if (m.procBonus) out.procBonus = (out.procBonus ?? 0) + m.procBonus;
    if (m.defense) out.defense = (out.defense ?? 0) + m.defense;
    if (m.regenStep) out.regenStep = (out.regenStep ?? 0) + m.regenStep;
    if (m.powerMult !== undefined) {
      powerMult *= m.powerMult;
      hasMult = true;
    }
    if (m.costMult !== undefined) {
      costMult *= m.costMult;
      hasMult = true;
    }
    if (m.resist) {
      out.resist = { ...out.resist };
      for (const e of ELEMENTS_IN) {
        const v = m.resist[e as keyof typeof m.resist];
        if (v)
          out.resist[e as keyof NonNullable<StatMods['resist']>] =
            (out.resist[e as keyof NonNullable<StatMods['resist']>] ?? 0) + v;
      }
    }
  }
  if (hasMult) {
    if (powerMult !== 1) out.powerMult = powerMult;
    if (costMult !== 1) out.costMult = costMult;
  }
  return out;
}

/** Aggregate a single item's base + affix mods. */
export function gearMods(item: GearItem): StatMods {
  const base = GEAR_BASES[item.base];
  if (!base) return {};
  const mods: StatMods[] = [base.mods];
  for (const a of item.affixes) {
    const def = affixById(a);
    if (def) mods.push(def.mods);
  }
  return sumMods(mods);
}

function rarityRank(r: ItemRarity): number {
  return RARITY_IDS.indexOf(r);
}

/** Deterministically roll a gear instance from a base id, rarity, and seed. */
export function rollGear(baseId: string, rarity: ItemRarity, seed: number): GearItem | null {
  const base = GEAR_BASES[baseId];
  if (!base) return null;
  const rng = mulberry32(seed >>> 0);
  const count = RARITY_AFFIX_COUNT[rarity];
  const pool = AFFIXES.filter((a) => rarityRank(a.minRarity) <= rarityRank(rarity)).map(
    (a) => a.id,
  );
  const affixes: string[] = [];
  while (affixes.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    const pick = pool.splice(i, 1)[0];
    if (pick) affixes.push(pick);
  }
  return {
    uid: `g${(seed >>> 0).toString(36)}_${baseId}`,
    base: baseId,
    slot: base.slot,
    rarity,
    affixes,
  };
}

/** Shop/sell value of an item. */
export function itemValue(item: GearItem): number {
  const base = GEAR_BASES[item.base];
  if (!base) return 0;
  return Math.round(base.value * RARITY_VALUE_MULT[item.rarity]);
}

/** Display name: "Keen Spark Wand of Focus". */
export function itemLabel(item: GearItem): string {
  const base = GEAR_BASES[item.base];
  if (!base) return 'Unknown';
  const prefix = item.affixes
    .map(affixById)
    .filter((a) => a?.place === 'prefix')
    .map((a) => a?.label)
    .join(' ');
  const suffix = item.affixes
    .map(affixById)
    .filter((a) => a?.place === 'suffix')
    .map((a) => a?.label)
    .join(' ');
  return [prefix, base.label, suffix].filter((s) => s.length > 0).join(' ');
}
