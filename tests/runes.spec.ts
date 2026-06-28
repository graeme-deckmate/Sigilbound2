import { describe, expect, it } from 'vitest';
import {
  makeSpell,
  spellPower,
  spellProc,
  spellCost,
  critProfile,
} from '../src/systems/spellcraft.ts';
import { RUNES } from '../src/data/runes.ts';
import { ELEMENTS } from '../src/data/elements.ts';

describe('v2 runes (one rule-bend each, reusing honored fields)', () => {
  it('weight: heavy power at a heavy MP cost vs the plain rune', () => {
    const plain = makeSpell('ember', 'bolt', 'none');
    const heavy = makeSpell('ember', 'bolt', 'weight');
    expect(spellPower(heavy, 5)).toBeGreaterThan(spellPower(plain, 5));
    expect(spellCost(heavy)).toBeGreaterThan(spellCost(plain));
    // power scales by roughly the rune's pw factor (single-round tolerance)
    expect(spellPower(heavy, 5)).toBeCloseTo(spellPower(plain, 5) * (RUNES.weight.pw ?? 1), -1);
  });

  it('ruin: a rarer but much bigger crit than the base profile', () => {
    const c = critProfile(makeSpell('ember', 'bolt', 'ruin'));
    expect(c.chance).toBe(0.15);
    expect(c.mult).toBe(2.2);
  });

  it('ward: cheap, weak, but a strong status setup', () => {
    const ward = makeSpell('thorn', 'bolt', 'ward');
    const plain = makeSpell('thorn', 'bolt', 'none');
    expect(spellPower(ward, 5)).toBeLessThan(spellPower(plain, 5));
    expect(spellProc(ward)).toBeCloseTo(
      Math.min(0.95, ELEMENTS.thorn.proc + (RUNES.ward.procBonus ?? 0)),
      5,
    );
  });
});
