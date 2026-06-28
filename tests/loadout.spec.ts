import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/save.ts';
import { deriveLoadout, LOADOUT_POWER_CAP } from '../src/systems/loadout.ts';
import { initBattle } from '../src/systems/battle.ts';
import type { GearItem } from '../src/core/items.ts';

function gear(uid: string, base: string, slot: GearItem['slot'], affixes: string[] = []): GearItem {
  return { uid, base, slot, rarity: 'fine', affixes };
}

describe('deriveLoadout', () => {
  it('is the empty identity for a gearless player (keeps the sim unchanged)', () => {
    expect(deriveLoadout(newGame().player)).toEqual({});
  });

  it('aggregates equipped gear into one StatMods', () => {
    const g = newGame();
    const robe = gear('v1', 'warded_robe', 'vestment'); // maxhp 12, defense 1
    g.player.inventory.gear = [robe];
    g.player.equipment.vestment = 'v1';
    const mods = deriveLoadout(g.player);
    expect(mods.maxhp).toBe(12);
    expect(mods.defense).toBe(1);
  });

  it('ignores equipped uids that are not owned', () => {
    const g = newGame();
    g.player.equipment.implement = 'ghost';
    expect(deriveLoadout(g.player)).toEqual({});
  });

  it('clamps aggregate powerMult to the cap', () => {
    const g = newGame();
    // focus_rod (1.1) + fierce (1.06) + of_power (1.08) => ~1.26; add another
    // power source by stacking affixes to exceed the cap, then assert clamp.
    g.player.inventory.gear = [gear('i1', 'focus_rod', 'implement', ['fierce', 'of_power'])];
    g.player.equipment.implement = 'i1';
    const mods = deriveLoadout(g.player);
    expect(mods.powerMult).toBeLessThanOrEqual(LOADOUT_POWER_CAP);
  });
});

describe('initBattle applies the loadout', () => {
  it('adds gear maxhp to the battle player and snapshots mods', () => {
    const g = newGame();
    const robe = gear('v1', 'warded_robe', 'vestment'); // maxhp 12
    g.player.inventory.gear = [robe];
    g.player.equipment.vestment = 'v1';
    const state = initBattle(g, ['gloop'], 2, 'hearthvale.meadow').state;
    expect(state.player.maxhp).toBe(g.player.maxhp + 12);
    expect(state.player.mods.maxhp).toBe(12);
  });

  it('leaves the battle player untouched when gearless', () => {
    const g = newGame();
    const state = initBattle(g, ['gloop'], 2, 'hearthvale.meadow').state;
    expect(state.player.maxhp).toBe(g.player.maxhp);
    expect(state.player.mods).toEqual({});
  });
});
