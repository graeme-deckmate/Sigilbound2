/**
 * Formula table from docs/03-CONTENT-DATA, exact values. These pin the
 * validated combat math; if one fails, the code drifted from the spec.
 */
import { describe, expect, it } from 'vitest';
import {
  critProfile,
  elementMult,
  makeSpell,
  spellCost,
  spellHits,
  spellPower,
  spellProc,
  veilRiderProc,
  veilShield,
} from '../src/systems/spellcraft.ts';
import { maxHpAt, maxMpAt, xpNext } from '../src/systems/leveling.ts';
import { ELEMENT_IDS } from '../src/data/elements.ts';
import { FORM_IDS } from '../src/data/forms.ts';
import { RUNE_IDS } from '../src/data/runes.ts';
import { ENEMIES } from '../src/data/enemies.ts';
import { COMBAT } from '../src/data/constants.ts';

describe('spell power (rounded per-hit, before variance/mult)', () => {
  it('Lv1 Emberbolt has power 13', () => {
    expect(spellPower(makeSpell('ember', 'bolt', 'none'), 1)).toBe(13);
  });

  it('Lv6 Voltlance of Fury has power 58, and 93 vs weak', () => {
    const sp = makeSpell('volt', 'lance', 'fury');
    const power = spellPower(sp, 6);
    expect(power).toBe(58);
    expect(Math.round(power * COMBAT.weakMult)).toBe(93);
  });

  it('Lv1 Emberwisp has power 8', () => {
    expect(spellPower(makeSpell('ember', 'wisp', 'none'), 1)).toBe(8);
  });

  it('echo hits twice at 0.62 power each: Lv1 Emberbolt of Echoes is 8 x2', () => {
    const sp = makeSpell('ember', 'bolt', 'echo');
    expect(spellPower(sp, 1)).toBe(8);
    expect(spellHits(sp)).toBe(2);
    expect(spellHits(makeSpell('ember', 'bolt', 'none'))).toBe(1);
  });

  it('Lv5 nova has per-target power 13', () => {
    expect(spellPower(makeSpell('ember', 'nova', 'none'), 5)).toBe(13);
  });

  it('level scaling is 22% per level: Lv12 bolt is 44', () => {
    // 13 * 1.0 * (1 + 11 * 0.22) = 44.46 -> 44
    expect(spellPower(makeSpell('ember', 'bolt', 'none'), 12)).toBe(44);
  });
});

describe('spell cost: max(2, round(6 * form.mp * rune.mp))', () => {
  it('Lv-independent: Emberbolt costs 6', () => {
    expect(spellCost(makeSpell('ember', 'bolt', 'none'))).toBe(6);
  });

  it('Voltlance of Fury costs 15', () => {
    expect(spellCost(makeSpell('volt', 'lance', 'fury'))).toBe(15);
  });

  it('wisp halves cost: Emberwisp costs 3, of Keening costs 4', () => {
    expect(spellCost(makeSpell('ember', 'wisp', 'none'))).toBe(3);
    expect(spellCost(makeSpell('ember', 'wisp', 'keen'))).toBe(4);
  });

  it('Rimelance of Thirst costs 13', () => {
    expect(spellCost(makeSpell('rime', 'lance', 'thirst'))).toBe(13);
  });

  it('Emberbolt of Echoes costs 9', () => {
    expect(spellCost(makeSpell('ember', 'bolt', 'echo'))).toBe(9);
  });

  it('no combination goes below the floor of 2', () => {
    for (const e of ELEMENT_IDS)
      for (const f of FORM_IDS)
        for (const r of RUNE_IDS) {
          expect(spellCost(makeSpell(e, f, r))).toBeGreaterThanOrEqual(2);
        }
  });
});

describe('status proc: clamp(element.proc + rune bonus, 0, 0.95)', () => {
  it('Thornbolt procs at 0.50, of Hexes at 0.90', () => {
    expect(spellProc(makeSpell('thorn', 'bolt', 'none'))).toBeCloseTo(0.5, 10);
    expect(spellProc(makeSpell('thorn', 'bolt', 'hex'))).toBeCloseTo(0.9, 10);
  });

  it('Voltbolt procs at 0.28, of Hexes at 0.68', () => {
    expect(spellProc(makeSpell('volt', 'bolt', 'none'))).toBeCloseTo(0.28, 10);
    expect(spellProc(makeSpell('volt', 'bolt', 'hex'))).toBeCloseTo(0.68, 10);
  });

  it('never exceeds the 0.95 cap for any combination', () => {
    for (const e of ELEMENT_IDS)
      for (const r of RUNE_IDS) {
        expect(spellProc(makeSpell(e, 'bolt', r))).toBeLessThanOrEqual(0.95);
      }
  });
});

describe('crit: 8% x1.5 base; keen 26% x1.75', () => {
  it('base profile', () => {
    expect(critProfile(makeSpell('ember', 'bolt', 'none'))).toEqual({ chance: 0.08, mult: 1.5 });
  });

  it('keen overrides', () => {
    expect(critProfile(makeSpell('ember', 'bolt', 'keen'))).toEqual({ chance: 0.26, mult: 1.75 });
  });
});

describe('veil shield: round(14 * (rune.pw ?? 1) * lvScale * 0.90)', () => {
  it('Lv7 Emberveil grants 29', () => {
    expect(veilShield(makeSpell('ember', 'veil', 'none'), 7)).toBe(29);
  });

  it('Lv7 Emberveil of Fury grants 44', () => {
    expect(veilShield(makeSpell('ember', 'veil', 'fury'), 7)).toBe(44);
  });

  it('Lv12 Emberveil of Fury grants 65', () => {
    expect(veilShield(makeSpell('ember', 'veil', 'fury'), 12)).toBe(65);
  });

  it('rider proc is 0.40 base, 0.25 for volt, +0.40 with hex', () => {
    expect(veilRiderProc(makeSpell('ember', 'veil', 'none'))).toBeCloseTo(0.4, 10);
    expect(veilRiderProc(makeSpell('volt', 'veil', 'none'))).toBeCloseTo(0.25, 10);
    expect(veilRiderProc(makeSpell('ember', 'veil', 'hex'))).toBeCloseTo(0.8, 10);
    expect(veilRiderProc(makeSpell('volt', 'veil', 'hex'))).toBeCloseTo(0.65, 10);
  });
});

describe('element multiplier vs enemy tables', () => {
  it('weak 1.6, resist 0.6, neutral 1.0 across the Act 1 tables', () => {
    const gloop = ENEMIES.gloop;
    expect(elementMult('ember', gloop.weak, gloop.resist)).toBe(1.6);
    expect(elementMult('volt', gloop.weak, gloop.resist)).toBe(1.6);
    // v1.1 tuning: gloop lost its thorn resist (starter cliff fix)
    expect(elementMult('thorn', gloop.weak, gloop.resist)).toBe(1.0);
    expect(elementMult('gloom', gloop.weak, gloop.resist)).toBe(1.0);
    const pond = ENEMIES.pondscale;
    expect(elementMult('rime', pond.weak, pond.resist)).toBe(1.6);
    expect(elementMult('ember', pond.weak, pond.resist)).toBe(0.6);
  });
});

describe('progression formula table', () => {
  it('xpNext v1.1 reshape: 14 at Lv1, 28 at Lv2, 50 at Lv3, 327 at Lv11, Infinity at cap', () => {
    expect(xpNext(1)).toBe(14);
    expect(xpNext(2)).toBe(28);
    expect(xpNext(3)).toBe(50);
    expect(xpNext(11)).toBe(327);
    expect(xpNext(12)).toBe(Infinity);
  });

  it('Lv1 is 46 HP / 26 MP; Lv12 is 134 HP / 70 MP (v1.1 MP base)', () => {
    expect(maxHpAt(1)).toBe(46);
    expect(maxMpAt(1)).toBe(26);
    expect(maxHpAt(12)).toBe(134);
    expect(maxMpAt(12)).toBe(70);
  });
});
