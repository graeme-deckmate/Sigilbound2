/**
 * Mastery tiers, aspect modifiers, and surge gating in the formulas
 * (docs/03 sections 17, 18, 25, v1.1). Exact values.
 */
import { describe, expect, it } from 'vitest';
import { masteryTier } from '../src/data/wheel.ts';
import {
  castSurges,
  makeSpell,
  spellCost,
  spellPower,
  spellProc,
} from '../src/systems/spellcraft.ts';

describe('masteryTier thresholds (10 / 25 / 50)', () => {
  it('maps points to tiers with the cap at 50', () => {
    expect(masteryTier(0)).toBe(0);
    expect(masteryTier(9)).toBe(0);
    expect(masteryTier(10)).toBe(1);
    expect(masteryTier(24)).toBe(1);
    expect(masteryTier(25)).toBe(2);
    expect(masteryTier(49)).toBe(2);
    expect(masteryTier(50)).toBe(3);
  });
});

describe('tier effects in the formulas', () => {
  const bolt = makeSpell('ember', 'bolt', 'none');

  it('tier 1: +5% power (bolt Lv 4: 22 -> 23)', () => {
    expect(spellPower(bolt, 4)).toBe(22);
    expect(spellPower(bolt, 4, { mastery: 10 })).toBe(23); // 21.6 * 1.05 = 22.7
  });

  it('tier 2: +10% proc (ember 0.35 -> 0.45)', () => {
    expect(spellProc(bolt)).toBeCloseTo(0.35, 10);
    expect(spellProc(bolt, { mastery: 25 })).toBeCloseTo(0.45, 10);
    expect(spellProc(bolt, { mastery: 10 })).toBeCloseTo(0.35, 10);
  });

  it('tier 3: -1 MP with the 2 MP floor intact', () => {
    expect(spellCost(bolt)).toBe(6);
    expect(spellCost(bolt, { mastery: 50 })).toBe(5);
    const wisp = makeSpell('ember', 'wisp', 'none', 0.7); // floors at 2
    expect(spellCost(wisp, { mastery: 50 })).toBe(2);
  });

  it('the proc cap still clamps at 0.95', () => {
    const hexThorn = makeSpell('thorn', 'bolt', 'hex'); // 0.5 + 0.4 = 0.9
    expect(spellProc(hexThorn, { mastery: 25, aspect: 'thorn' })).toBeCloseTo(0.95, 10);
  });
});

describe('aspect modifiers (battle-snapshotted element)', () => {
  const bolt = makeSpell('rime', 'bolt', 'none');

  it('x1.10 power and +0.10 proc only for the ascendant element', () => {
    expect(spellPower(bolt, 4, { aspect: 'rime' })).toBe(24); // 21.6 * 1.1 = 23.76
    expect(spellPower(bolt, 4, { aspect: 'ember' })).toBe(22);
    expect(spellProc(bolt, { aspect: 'rime' })).toBeCloseTo(0.5, 10);
    expect(spellProc(bolt, { aspect: 'volt' })).toBeCloseTo(0.4, 10);
  });

  it('stacks with mastery tier 1 (1.05 * 1.10)', () => {
    expect(spellPower(bolt, 4, { mastery: 10, aspect: 'rime' })).toBe(25); // 21.6*1.155=24.9
  });
});

describe('surge gating (03 section 18)', () => {
  it('wyrd always surges, any potency, any mastery', () => {
    expect(castSurges(makeSpell('ember', 'bolt', 'wyrd', 0.7), 50)).toBe(true);
  });

  it('greedy potency (>= 1.30) surges below tier 2 and stabilizes at it', () => {
    const greedy = makeSpell('ember', 'bolt', 'none', 1.3);
    expect(castSurges(greedy, 0)).toBe(true);
    expect(castSurges(greedy, 24)).toBe(true);
    expect(castSurges(greedy, 25)).toBe(false);
    const tame = makeSpell('ember', 'bolt', 'none', 1.25);
    expect(castSurges(tame, 0)).toBe(false);
  });

  it('wraithmark is always stable even at full greed', () => {
    expect(castSurges(makeSpell('ember', 'bolt', 'wraithmark', 1.5), 0)).toBe(false);
  });
});
