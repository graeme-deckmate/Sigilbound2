/** Step resolution: grace, regen cadence, encounter rolls (docs/02). */
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng.ts';
import { resolveStep, weightedPick } from '../src/systems/encounters.ts';
import { ZONES } from '../src/data/formations.ts';

describe('resolveStep', () => {
  it('decrements grace before rolling anything', () => {
    const rng = mulberry32(1);
    const r = resolveStep(
      { tile: ',', zone: 'hearthvale.meadow', graceSteps: 3, stepCount: 1 },
      rng,
    );
    expect(r.graceSteps).toBe(2);
    expect(r.encounter).toBeNull();
  });

  it('never rolls encounters off tall grass or outside zones', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 200; i++) {
      expect(
        resolveStep({ tile: '.', zone: 'hearthvale.meadow', graceSteps: 0, stepCount: i }, rng)
          .encounter,
      ).toBeNull();
      expect(
        resolveStep({ tile: ',', zone: null, graceSteps: 0, stepCount: i }, rng).encounter,
      ).toBeNull();
    }
  });

  it('regen ticks every 6th step', () => {
    const rng = mulberry32(3);
    const regens = [1, 2, 3, 4, 5, 6, 7, 12, 13].map(
      (n) => resolveStep({ tile: '.', zone: null, graceSteps: 0, stepCount: n }, rng).regen,
    );
    expect(regens).toEqual([false, false, false, false, false, true, false, true, false]);
  });

  it('rolls encounters at roughly 14% on zoned tall grass', () => {
    const rng = mulberry32(424242);
    let hits = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const r = resolveStep(
        { tile: ',', zone: 'hearthvale.meadow', graceSteps: 0, stepCount: 1 },
        rng,
      );
      if (r.encounter) hits++;
    }
    expect(hits / n).toBeGreaterThan(0.12);
    expect(hits / n).toBeLessThan(0.16);
  });

  it('encounter levels stay inside the zone band', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const r = resolveStep(
        { tile: ',', zone: 'hearthvale.marsh', graceSteps: 0, stepCount: 1 },
        rng,
      );
      if (r.encounter) {
        expect(r.encounter.enemyLv).toBeGreaterThanOrEqual(1);
        expect(r.encounter.enemyLv).toBeLessThanOrEqual(4);
        expect(ZONES['hearthvale.marsh'].formations).toContain(r.encounter.formation);
      }
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 500; i++) {
      const ra = resolveStep(
        { tile: ',', zone: 'hearthvale.meadow', graceSteps: 0, stepCount: i },
        a,
      );
      const rb = resolveStep(
        { tile: ',', zone: 'hearthvale.meadow', graceSteps: 0, stepCount: i },
        b,
      );
      expect(ra).toEqual(rb);
    }
  });
});

describe('weightedPick', () => {
  it('respects weights over many draws', () => {
    const rng = mulberry32(5);
    const items = [
      { id: 'a', weight: 3 },
      { id: 'b', weight: 1 },
    ];
    let a = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) if (weightedPick(rng, items).id === 'a') a++;
    expect(a / n).toBeGreaterThan(0.7);
    expect(a / n).toBeLessThan(0.8);
  });

  it('throws on empty or zero-weight input', () => {
    const rng = mulberry32(1);
    expect(() => weightedPick(rng, [])).toThrow();
    expect(() => weightedPick(rng, [{ weight: 0 }])).toThrow();
  });
});
