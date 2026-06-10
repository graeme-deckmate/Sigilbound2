/** Progression numbers, transcribed from docs/03-CONTENT-DATA section 6. */
import type { Spell } from '../core/state.ts';

export const LEVEL_CAP = 12;

/** xpNext(lv) = round(XP_BASE + (lv - 1)^XP_EXP * XP_SCALE) (v1.1 reshape:
 *  cheaper levels 2-3, pricier 9-11). */
export const XP_BASE = 14;
export const XP_SCALE = 14;
export const XP_EXP = 1.35;

export const BASE_HP = 46;
/** v1.1: +4 starting MP (the Lv 1 fourth-bolt fix). */
export const BASE_MP = 26;
export const HP_PER_LEVEL = 8;
export const MP_PER_LEVEL = 4;

/** +1 HP and +1 MP per this many overworld steps. */
export const REGEN_STEPS = 6;

/** Encounter chance per tall-grass step once grace expires. */
export const ENCOUNTER_RATE = 0.14;
export const GRACE_AFTER_BATTLE = 4;
export const GRACE_AFTER_DEFEAT = 6;

/** Focus: restore fractions of max, then cleanse one player status. */
export const FOCUS_MP_FRAC = 0.35;
export const FOCUS_HP_FRAC = 0.1;

/** Flee success chance; disabled in boss battles. */
export const FLEE_CHANCE = 0.65;

/** Spell slots available before essence purchases (slots 5-6). */
export const BASE_SLOTS = 4;
export const MAX_SLOTS = 6;

/**
 * The Elder's gift once the starter is chosen (03 section 5): the
 * starter element's Wisp and Bolt at default potency, slots 1-2.
 */
export function starterSpells(element: Spell['element']): readonly (Spell | null)[] {
  return [
    { element, form: 'wisp', rune: 'none', p: 1 },
    { element, form: 'bolt', rune: 'none', p: 1 },
    null,
    null,
    null,
    null,
  ];
}

/** NG+ scaling (03 section 25): flat per cycle, never compounding. */
export const NG_PLUS = {
  hpMult: 1.5,
  atkMult: 1.5,
  /** Victory base and elite/glimmer bonuses double. */
  essenceMult: 2,
  /** The Hollow Warden fights two levels up. */
  wardenLvBonus: 2,
  /** A relic cache already claimed pays essence instead. */
  relicCacheEssence: 15,
} as const;
