import { describe, expect, it } from 'vitest';
import { gearMods, itemLabel, itemValue, rollGear, sumMods } from '../src/systems/gear.ts';
import { GEAR_BASES } from '../src/data/gear.ts';
import { RARITY_AFFIX_COUNT } from '../src/data/affixes.ts';

describe('sumMods', () => {
  it('adds flats and multiplies *Mult fields', () => {
    const m = sumMods([
      { maxhp: 5, powerMult: 1.1 },
      { maxhp: 3, powerMult: 1.1 },
      { critChance: 0.02 },
    ]);
    expect(m.maxhp).toBe(8);
    expect(m.powerMult).toBeCloseTo(1.21, 5);
    expect(m.critChance).toBeCloseTo(0.02, 5);
  });

  it('returns {} for no mods (the gearless identity)', () => {
    expect(sumMods([])).toEqual({});
    expect(sumMods([{}, {}])).toEqual({});
  });

  it('merges resist maps additively', () => {
    const m = sumMods([{ resist: { ember: 0.1 } }, { resist: { ember: 0.1, rime: 0.2 } }]);
    expect(m.resist?.ember).toBeCloseTo(0.2, 5);
    expect(m.resist?.rime).toBeCloseTo(0.2, 5);
  });
});

describe('rollGear', () => {
  it('is deterministic for the same seed', () => {
    const a = rollGear('focus_rod', 'rare', 12345);
    const b = rollGear('focus_rod', 'rare', 12345);
    expect(a).toEqual(b);
    expect(a?.affixes.length).toBe(RARITY_AFFIX_COUNT.rare);
  });

  it('rolls the right affix count per rarity and only eligible affixes', () => {
    expect(rollGear('spark_wand', 'common', 1)?.affixes.length).toBe(0);
    expect(rollGear('spark_wand', 'fine', 1)?.affixes.length).toBe(1);
    const relic = rollGear('warded_robe', 'relic', 7);
    expect(relic?.affixes.length).toBe(RARITY_AFFIX_COUNT.relic);
  });

  it('returns null for an unknown base', () => {
    expect(rollGear('nope', 'common', 1)).toBeNull();
  });
});

describe('gearMods / value / label', () => {
  it('aggregates base + affix mods', () => {
    const item = {
      uid: 'x',
      base: 'apprentice_robe',
      slot: 'vestment' as const,
      rarity: 'common' as const,
      affixes: ['sturdy'],
    };
    // apprentice_robe maxhp 6 + sturdy maxhp 5
    expect(gearMods(item).maxhp).toBe(11);
  });

  it('scales value by rarity', () => {
    const base = GEAR_BASES.spark_wand?.value ?? 0;
    const common = itemValue({
      uid: 'a',
      base: 'spark_wand',
      slot: 'implement',
      rarity: 'common',
      affixes: [],
    });
    const rare = itemValue({
      uid: 'b',
      base: 'spark_wand',
      slot: 'implement',
      rarity: 'rare',
      affixes: [],
    });
    expect(common).toBe(base);
    expect(rare).toBeGreaterThan(common);
  });

  it('builds a prefix/base/suffix label', () => {
    const item = {
      uid: 'x',
      base: 'spark_wand',
      slot: 'implement' as const,
      rarity: 'rare' as const,
      affixes: ['keen', 'of_power'],
    };
    expect(itemLabel(item)).toBe('Keen Spark Wand of Power');
  });
});
