/** Progression numbers, transcribed from docs/03-CONTENT-DATA section 6. */
import type { Spell } from '../core/state.ts';

export const LEVEL_CAP = 12;

/** xpNext(lv) = XP_BASE + (lv - 1) * XP_PER_LEVEL */
export const XP_BASE = 18;
export const XP_PER_LEVEL = 14;

export const BASE_HP = 46;
export const BASE_MP = 22;
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

/** Starting loadout, from the prototype (canon): slots 1-2 inscribed. */
export const STARTING_SPELLS: readonly (Spell | null)[] = [
  { element: 'ember', form: 'wisp', rune: 'none' },
  { element: 'ember', form: 'bolt', rune: 'none' },
  null,
  null,
];
