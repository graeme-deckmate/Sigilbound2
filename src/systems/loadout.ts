/**
 * Loadout aggregation (v2 V2): fold the player's equipped gear (and, from V3,
 * class passive + talents) into one StatMods. A gearless/classless player
 * yields {}, so every consumer's `?? 1`/`?? 0` short-circuits and the balance
 * sim reproduces v1 numbers exactly. This is the single seam combat reads.
 */
import type { GameState } from '../core/state.ts';
import type { StatMods } from '../core/items.ts';
import { EQUIP_SLOT_IDS } from '../core/items.ts';
import { gearMods, sumMods } from './gear.ts';

/** Cap on aggregate spell-power multiplier so gear cannot blow the ceiling. */
export const LOADOUT_POWER_CAP = 1.35;

export function deriveLoadout(player: GameState['player']): StatMods {
  const mods: StatMods[] = [];
  for (const slot of EQUIP_SLOT_IDS) {
    const uid = player.equipment[slot];
    if (!uid) continue;
    const item = player.inventory.gear.find((g) => g.uid === uid);
    if (item) mods.push(gearMods(item));
  }
  const agg = sumMods(mods);
  if (agg.powerMult !== undefined) agg.powerMult = Math.min(agg.powerMult, LOADOUT_POWER_CAP);
  return agg;
}
