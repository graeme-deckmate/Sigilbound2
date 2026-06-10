/** Essence economy numbers, transcribed from docs/03 section 16 (v1.1). */

export const ESSENCE = {
  /** Battle victory base (NG+ doubles it, Phase 15). */
  victory: 1,
  /** Per promoted elite felled. */
  elite: 5,
  /** Extra for a sealed elite. */
  sealedBonus: 1,
  /** Glimmerkin caught before it flees. */
  glimmerCaught: 6,
  /** Grimoire slot purchases, at any shrine. */
  slot5: 40,
  slot6: 80,
  /** Phase 13 prices, recorded now so the table reads complete. */
  charmCraft: 25,
  scroll: 8,
  wyrdRune: 30,
  relicHint: 5,
  rematchEntry: 10,
  rematchFirstClear: 25,
} as const;

/** Defeat drops ceil(essence / 2) at the defeat tile (one marker only). */
export function defeatDrop(essence: number): number {
  return Math.ceil(essence / 2);
}
