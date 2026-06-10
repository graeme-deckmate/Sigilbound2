import { describe, expect, it } from 'vitest';
import { chance, deriveSeed, mulberry32, pick, randInt } from '../src/core/rng.ts';

describe('mulberry32', () => {
  it('is deterministic: same seed, same sequence', () => {
    const a = mulberry32(123456);
    const b = mulberry32(123456);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('different seeds give different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(987654321);
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has a roughly uniform mean', () => {
    const rng = mulberry32(42);
    let sum = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) sum += rng();
    expect(sum / n).toBeGreaterThan(0.47);
    expect(sum / n).toBeLessThan(0.53);
  });

  it('treats seeds as uint32 (seed and seed + 2^32 match)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7 + 2 ** 32);
    expect(a()).toBe(b());
  });
});

describe('deriveSeed', () => {
  it('is deterministic', () => {
    expect(deriveSeed(99, 3)).toBe(deriveSeed(99, 3));
  });

  it('changes with the counter', () => {
    const seen = new Set<number>();
    for (let n = 0; n < 50; n++) seen.add(deriveSeed(1234, n));
    expect(seen.size).toBe(50);
  });

  it('returns a uint32', () => {
    for (let n = 0; n < 20; n++) {
      const s = deriveSeed(0xdeadbeef, n);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('randInt', () => {
  it('covers the inclusive range and nothing else', () => {
    const rng = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = randInt(rng, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('handles a single-value range', () => {
    const rng = mulberry32(9);
    expect(randInt(rng, 7, 7)).toBe(7);
  });
});

describe('chance', () => {
  it('p=0 never hits, p=1 always hits', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 100; i++) {
      expect(chance(rng, 0)).toBe(false);
      expect(chance(rng, 1)).toBe(true);
    }
  });

  it('approximates p over many rolls', () => {
    const rng = mulberry32(31337);
    let hits = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) if (chance(rng, 0.35)) hits++;
    expect(hits / n).toBeGreaterThan(0.32);
    expect(hits / n).toBeLessThan(0.38);
  });
});

describe('pick', () => {
  it('only returns array members and reaches all of them', () => {
    const rng = mulberry32(77);
    const arr = ['a', 'b', 'c'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(pick(rng, arr));
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
  });

  it('throws on an empty array', () => {
    const rng = mulberry32(1);
    expect(() => pick(rng, [])).toThrow('pick: empty array');
  });
});
