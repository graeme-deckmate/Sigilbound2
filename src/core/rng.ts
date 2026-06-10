/**
 * Seeded RNG (mulberry32). All battle logic must draw from an Rng created
 * here so tests are deterministic. Math.random() is allowed only for
 * cosmetic FX (docs/01-ARCHITECTURE).
 */

export type Rng = () => number;

/** mulberry32: fast 32-bit seeded generator, returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a child seed from a base seed and a counter, e.g. battle N of a
 * run. Distinct counters give uncorrelated streams from the same run seed.
 */
export function deriveSeed(base: number, n: number): number {
  let h = (base >>> 0) ^ Math.imul(n + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** True with probability p (clamped to [0, 1]). */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Uniform pick from a non-empty array. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick: empty array');
  // rng() < 1 guarantees the index is in range.
  return arr[Math.floor(rng() * arr.length)] as T;
}
