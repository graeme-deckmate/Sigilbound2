/**
 * Potency formulas (docs/03 section 4, v1.1): exact values at the
 * slider detents 0.7 / 1.0 / 1.5 and along the piecewise cost curve.
 */
import { describe, expect, it } from 'vitest';
import {
  makeSpell,
  potCost,
  spellCost,
  spellPower,
  veilShield,
  displayName,
  sanitizeGivenName,
  spellName,
} from '../src/systems/spellcraft.ts';

describe('potCost piecewise curve', () => {
  it('hits the anchor detents exactly: 0.70 -> 0.60, 1.00 -> 1.00, 1.50 -> 2.00', () => {
    expect(potCost(0.7)).toBeCloseTo(0.6, 10);
    expect(potCost(1)).toBeCloseTo(1, 10);
    expect(potCost(1.5)).toBeCloseTo(2, 10);
  });

  it('is linear between anchors', () => {
    expect(potCost(0.85)).toBeCloseTo(0.8, 10); // midpoint of 0.6..1.0
    expect(potCost(0.95)).toBeCloseTo(0.6 + (0.25 / 0.3) * 0.4, 10);
    expect(potCost(1.25)).toBeCloseTo(1.5, 10); // midpoint of 1.0..2.0
    expect(potCost(1.05)).toBeCloseTo(1.1, 10);
    expect(potCost(1.3)).toBeCloseTo(1.6, 10);
    expect(potCost(1.45)).toBeCloseTo(1.9, 10);
  });

  it('clamps outside the slider range', () => {
    expect(potCost(0.5)).toBeCloseTo(0.6, 10);
    expect(potCost(2)).toBeCloseTo(2, 10);
  });
});

describe('cost with potency (max(2, round(6 * form.mp * rune.mp * potCost)))', () => {
  it('plain bolt: 4 MP at 0.7, 6 at 1.0, 12 at 1.5', () => {
    expect(spellCost(makeSpell('ember', 'bolt', 'none', 0.7))).toBe(4);
    expect(spellCost(makeSpell('ember', 'bolt', 'none', 1))).toBe(6);
    expect(spellCost(makeSpell('ember', 'bolt', 'none', 1.5))).toBe(12);
  });

  it('wisp at 0.7 floors at the 2 MP minimum', () => {
    // 6 * 0.5 * 1 * 0.6 = 1.8 -> floor 2
    expect(spellCost(makeSpell('ember', 'wisp', 'none', 0.7))).toBe(2);
  });

  it('fury bolt at 1.5 costs 20 (6 * 1.65 * 2 = 19.8)', () => {
    expect(spellCost(makeSpell('ember', 'bolt', 'fury', 1.5))).toBe(20);
  });

  it('plain nova at 1.25: 6 * 1.45 * 1.5 = 13.05 -> 13', () => {
    expect(spellCost(makeSpell('gloom', 'nova', 'none', 1.25))).toBe(13);
  });
});

describe('power with potency (13 * form.pw * rune.pw * p * lvScale)', () => {
  it('plain bolt at Lv 1: 9 at 0.7, 13 at 1.0, 20 at 1.5', () => {
    expect(spellPower(makeSpell('ember', 'bolt', 'none', 0.7), 1)).toBe(9); // 9.1
    expect(spellPower(makeSpell('ember', 'bolt', 'none', 1), 1)).toBe(13);
    expect(spellPower(makeSpell('ember', 'bolt', 'none', 1.5), 1)).toBe(20); // 19.5
  });

  it('plain lance at Lv 11 and 1.5: 13 * 1.42 * 1.5 * 3.2 = 88.6 -> 89', () => {
    expect(spellPower(makeSpell('volt', 'lance', 'none', 1.5), 11)).toBe(89);
  });

  it('default potency keeps every v1.0 power value (bolt Lv 4 = 22)', () => {
    expect(spellPower(makeSpell('volt', 'bolt', 'none'), 4)).toBe(22); // 13 * 1.66
  });
});

describe('veil shield with potency (round(14 * rune.pw * p * lvScale * 0.9))', () => {
  it('plain veil at Lv 7: 31 at 1.0, 44 at 1.5, 22 at 0.7', () => {
    // 14 * 2.32 * 0.9 = 29.232... times p
    expect(veilShield(makeSpell('ember', 'veil', 'none', 1), 7)).toBe(29);
    expect(veilShield(makeSpell('ember', 'veil', 'none', 1.5), 7)).toBe(44);
    expect(veilShield(makeSpell('ember', 'veil', 'none', 0.7), 7)).toBe(20);
  });
});

describe('rename (1-18 chars; generated name becomes the subtitle)', () => {
  it('displayName prefers the given name', () => {
    const s = makeSpell('rime', 'lance', 'thirst', 1);
    expect(displayName(s)).toBe('Rimelance of Thirst');
    s.given = 'Coldsnap';
    expect(displayName(s)).toBe('Coldsnap');
    expect(spellName(s)).toBe('Rimelance of Thirst');
  });

  it('sanitizeGivenName trims, bounds to 18 chars, rejects empties', () => {
    expect(sanitizeGivenName('  Coldsnap  ')).toBe('Coldsnap');
    expect(sanitizeGivenName('')).toBeNull();
    expect(sanitizeGivenName('   ')).toBeNull();
    expect(sanitizeGivenName('A')).toBe('A');
    expect(sanitizeGivenName('123456789012345678ZZZ')).toBe('123456789012345678');
  });
});
