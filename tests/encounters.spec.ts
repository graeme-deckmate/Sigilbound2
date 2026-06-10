/** Step resolution: grace, regen cadence, encounter rolls (docs/02). */
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng.ts';
import { resolveStep, weightedPick } from '../src/systems/encounters.ts';
import { ZONES } from '../src/data/formations.ts';

describe('resolveStep', () => {
  it('decrements grace before rolling anything', () => {
    const rng = mulberry32(1);
    const r = resolveStep(
      {
        tile: ',',
        zone: 'hearthvale.meadow',
        graceSteps: 3,
        stepCount: 1,
        playerLv: 3,
        eliteEligible: false,
      },
      rng,
    );
    expect(r.graceSteps).toBe(2);
    expect(r.encounter).toBeNull();
  });

  it('never rolls encounters off tall grass or outside zones', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 200; i++) {
      expect(
        resolveStep(
          {
            tile: '.',
            zone: 'hearthvale.meadow',
            graceSteps: 0,
            stepCount: i,
            playerLv: 3,
            eliteEligible: false,
          },
          rng,
        ).encounter,
      ).toBeNull();
      expect(
        resolveStep(
          { tile: ',', zone: null, graceSteps: 0, stepCount: i, playerLv: 3, eliteEligible: false },
          rng,
        ).encounter,
      ).toBeNull();
    }
  });

  it('regen ticks every 6th step', () => {
    const rng = mulberry32(3);
    const regens = [1, 2, 3, 4, 5, 6, 7, 12, 13].map(
      (n) =>
        resolveStep(
          { tile: '.', zone: null, graceSteps: 0, stepCount: n, playerLv: 3, eliteEligible: false },
          rng,
        ).regen,
    );
    expect(regens).toEqual([false, false, false, false, false, true, false, true, false]);
  });

  it('rolls encounters at roughly 14% on zoned tall grass', () => {
    const rng = mulberry32(424242);
    let hits = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const r = resolveStep(
        {
          tile: ',',
          zone: 'hearthvale.meadow',
          graceSteps: 0,
          stepCount: 1,
          playerLv: 3,
          eliteEligible: false,
        },
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
        {
          tile: ',',
          zone: 'hearthvale.marsh',
          graceSteps: 0,
          stepCount: 1,
          playerLv: 3,
          eliteEligible: false,
        },
        rng,
      );
      if (r.encounter) {
        expect(r.encounter.enemyLv).toBeGreaterThanOrEqual(1);
        expect(r.encounter.enemyLv).toBeLessThanOrEqual(4);
        // glimmer rares carry their own synthetic formation (v1.1)
        if (!r.encounter.glimmer) {
          expect(ZONES['hearthvale.marsh'].formations).toContain(r.encounter.formation);
        }
      }
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 500; i++) {
      const ra = resolveStep(
        {
          tile: ',',
          zone: 'hearthvale.meadow',
          graceSteps: 0,
          stepCount: i,
          playerLv: 3,
          eliteEligible: false,
        },
        a,
      );
      const rb = resolveStep(
        {
          tile: ',',
          zone: 'hearthvale.meadow',
          graceSteps: 0,
          stepCount: i,
          playerLv: 3,
          eliteEligible: false,
        },
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

describe('v1.1 variance rolls (docs/03 section 13)', () => {
  const grass = (zone: 'hearthvale.meadow' | 'hearthvale.marsh', lv: number, elite: boolean) => ({
    tile: ',',
    zone,
    graceSteps: 0,
    stepCount: 1,
    playerLv: lv,
    eliteEligible: elite,
  });

  it('Lv 1 meadow never rolls 2+ member packs; Lv 2 can again', () => {
    const rng = mulberry32(11);
    let multisAt1 = 0;
    let multisAt2 = 0;
    for (let i = 0; i < 4000; i++) {
      const r1 = resolveStep(grass('hearthvale.meadow', 1, false), rng).encounter;
      if (r1 && !r1.glimmer && r1.formation.members.length > 1) multisAt1 += 1;
      const r2 = resolveStep(grass('hearthvale.meadow', 2, false), rng).encounter;
      if (r2 && !r2.glimmer && r2.formation.members.length > 1) multisAt2 += 1;
    }
    expect(multisAt1).toBe(0);
    expect(multisAt2).toBeGreaterThan(0);
  });

  it('marsh is unchanged at Lv 1 (walking south early is meant to sting)', () => {
    const rng = mulberry32(12);
    let multis = 0;
    for (let i = 0; i < 4000; i++) {
      const r = resolveStep(grass('hearthvale.marsh', 1, false), rng).encounter;
      if (r && !r.glimmer && r.formation.members.length > 1) multis += 1;
    }
    expect(multis).toBeGreaterThan(0);
  });

  it('no elites roll before Bogmaw falls', () => {
    const rng = mulberry32(13);
    for (let i = 0; i < 4000; i++) {
      const r = resolveStep(grass('hearthvale.meadow', 4, false), rng).encounter;
      expect(r?.elites === undefined || r.elites.every((a) => a === null)).toBe(true);
    }
  });

  it('post-Bogmaw, roughly 10% of formations promote exactly one member', () => {
    const rng = mulberry32(14);
    let encounters = 0;
    let promoted = 0;
    for (let i = 0; i < 30000; i++) {
      const r = resolveStep(grass('hearthvale.marsh', 5, true), rng).encounter;
      if (!r || r.glimmer || r.ambush) continue;
      encounters += 1;
      const count = (r.elites ?? []).filter((a) => a !== null).length;
      if (count > 0) promoted += 1;
      if (count > 0 && r.elites && r.elites.length === r.formation.members.length) {
        // single promotion unless it was an elite pack (all promoted)
        expect(count === 1 || count === r.formation.members.length).toBe(true);
      }
    }
    const rate = promoted / encounters;
    expect(rate).toBeGreaterThan(0.07);
    expect(rate).toBeLessThan(0.16);
  });

  it('rare rolls land near 4% split ambush/glimmer/elite-pack 2:1:1', () => {
    const rng = mulberry32(15);
    let n = 0;
    let ambush = 0;
    let glimmer = 0;
    for (let i = 0; i < 60000; i++) {
      const r = resolveStep(grass('hearthvale.marsh', 5, true), rng).encounter;
      if (!r) continue;
      n += 1;
      if (r.ambush) ambush += 1;
      if (r.glimmer) glimmer += 1;
    }
    expect(ambush / n).toBeGreaterThan(0.012);
    expect(ambush / n).toBeLessThan(0.03);
    expect(glimmer / n).toBeGreaterThan(0.005);
    expect(glimmer / n).toBeLessThan(0.018);
  });

  it('glimmer rolls carry the synthetic glimmerkin single', () => {
    const rng = mulberry32(16);
    for (let i = 0; i < 60000; i++) {
      const r = resolveStep(grass('hearthvale.meadow', 5, false), rng).encounter;
      if (r?.glimmer) {
        expect(r.formation.members).toEqual(['glimmerkin']);
        return;
      }
    }
    throw new Error('no glimmer rolled in 60000 steps');
  });
});
