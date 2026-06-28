import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/save.ts';
import { buyGear, sellGear, equipGear, unequipSlot, grantGear } from '../src/systems/shop.ts';
import { rollGear, itemValue } from '../src/systems/gear.ts';
import type { GearItem } from '../src/core/items.ts';

function item(seed: number): GearItem {
  const g = rollGear('spark_wand', 'fine', seed);
  if (!g) throw new Error('roll failed');
  return g;
}

describe('shop buy/sell', () => {
  it('buys gear when gold and capacity allow, debiting gold', () => {
    let g = newGame();
    g.player.gold = 50;
    const r = buyGear(g, item(1), 30);
    expect(r.ok).toBe(true);
    g = r.state;
    expect(g.player.gold).toBe(20);
    expect(g.player.inventory.gear).toHaveLength(1);
  });

  it('refuses a purchase that costs more gold than held', () => {
    const g = newGame();
    g.player.gold = 5;
    const r = buyGear(g, item(2), 30);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('gold');
    expect(r.state.player.inventory.gear).toHaveLength(0);
  });

  it('refuses a purchase when the inventory is full', () => {
    let g = newGame();
    g.player.gold = 9999;
    g.player.inventory.capacity = 1;
    g = buyGear(g, item(3), 1).state;
    const r = buyGear(g, item(4), 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('full');
  });

  it('sells gear for its value and unequips it', () => {
    let g = newGame();
    const it = item(5);
    g = grantGear(g, it);
    g = equipGear(g, it.uid);
    expect(g.player.equipment.implement).toBe(it.uid);
    const r = sellGear(g, it.uid);
    expect(r.gold).toBe(itemValue(it));
    expect(r.state.player.gold).toBe(itemValue(it));
    expect(r.state.player.inventory.gear).toHaveLength(0);
    expect(r.state.player.equipment.implement).toBeNull();
  });
});

describe('equip/unequip', () => {
  it('equips into the item slot and clears it on unequip', () => {
    let g = newGame();
    const it = item(6);
    g = grantGear(g, it);
    g = equipGear(g, it.uid);
    expect(g.player.equipment.implement).toBe(it.uid);
    g = unequipSlot(g, 'implement');
    expect(g.player.equipment.implement).toBeNull();
  });

  it('ignores equipping an unowned uid', () => {
    const g = newGame();
    expect(equipGear(g, 'ghost')).toEqual(g);
  });
});
