/** Runes, transcribed from docs/03-CONTENT-DATA section 3. */
import type { RuneId } from '../core/state.ts';

export interface RuneDef {
  id: RuneId;
  label: string;
  /** One-line player-facing tooltip (02 tone rules). */
  blurb: string;
  /** MP cost multiplier. */
  mp: number;
  /** Spell-name suffix including leading space, '' for none. */
  suffix: string;
  /** Power multiplier (fury). */
  pw?: number;
  /** Fraction of damage dealt returned as healing; for Veil, healed on
   *  shield break as a fraction of total absorbed (thirst). */
  healFrac?: number;
  /** Hit count (echo). */
  hits?: number;
  /** Per-hit power factor when hits > 1 (echo). */
  pwEach?: number;
  /** Added to the element's status proc chance; also boosts the Veil
   *  rider proc (hex). */
  procBonus?: number;
  /** Crit override (keen). No effect on Veil; the UI must say so. */
  crit?: { chance: number; mult: number };
  /** Veil only: the shield re-applies once after breaking (echo). */
  veilReapply?: boolean;
  /** Every cast rolls the surge table (wyrd, 03 section 18). */
  surges?: boolean;
  /** Reactions from this spell keep the setup status (stormcoil). */
  keepsReactionSetup?: boolean;
  /** Enemy resists count as neutral for this spell (emberglass). */
  resistAsNeutral?: boolean;
  /** Variance floor override: no low rolls (stillwater). */
  varianceMin?: number;
  /** Kills refund the spell's full MP cost (hollowlight). */
  refundOnKill?: boolean;
  /** Potency cap extension; always stable (wraithmark, Phase 14). */
  potencyMax?: number;
  alwaysStable?: boolean;
}

export const RUNE_IDS: readonly RuneId[] = [
  'none',
  'fury',
  'thirst',
  'echo',
  'hex',
  'keen',
  'wyrd',
  'emberglass',
  'stillwater',
  'stormcoil',
  'hollowlight',
  'wraithmark',
];

export const RUNES: Record<RuneId, RuneDef> = {
  none: {
    id: 'none',
    label: 'No rune',
    blurb: 'Plain ink. Cheap, honest, dependable.',
    mp: 1.0,
    suffix: '',
  },
  fury: {
    id: 'fury',
    label: 'Fury',
    blurb: 'Hits half again harder. The ink bill stings.',
    mp: 1.65,
    suffix: ' of Fury',
    pw: 1.5,
  },
  thirst: {
    id: 'thirst',
    label: 'Thirst',
    blurb: 'Drinks back a share of the harm it does.',
    mp: 1.35,
    suffix: ' of Thirst',
    healFrac: 0.35,
  },
  echo: {
    id: 'echo',
    label: 'Echo',
    blurb: 'One casting, two strikes. Veils re-form once.',
    mp: 1.45,
    suffix: ' of Echoes',
    hits: 2,
    pwEach: 0.62,
    veilReapply: true,
  },
  hex: {
    id: 'hex',
    label: 'Hex',
    blurb: 'Marks land far more often.',
    mp: 1.3,
    suffix: ' of Hexes',
    procBonus: 0.4,
  },
  keen: {
    id: 'keen',
    label: 'Keen',
    blurb: 'Seeks the seam. Crits often, and hard.',
    mp: 1.2,
    suffix: ' of Keening',
    crit: { chance: 0.26, mult: 1.75 },
  },
  wyrd: {
    id: 'wyrd',
    label: 'Wyrd',
    blurb: 'Strong and cheap, and it ALWAYS surges. The wyrd loves a gambler.',
    mp: 1.15,
    suffix: ' of the Wyrd',
    pw: 1.35,
    surges: true,
  },
  /* Relic runes: hidden, one rule-bend each. pw 1.0, default crit/proc.
     Effects land with their systems (stormcoil in Phase 12's Wheel;
     the rest in Phase 13's caches). */
  emberglass: {
    id: 'emberglass',
    label: 'Emberglass',
    blurb: 'Resistance reads as an invitation. Resists count as neutral.',
    mp: 1.1,
    suffix: ' of Emberglass',
    resistAsNeutral: true,
  },
  stillwater: {
    id: 'stillwater',
    label: 'Stillwater',
    blurb: 'The water never ripples. No low damage rolls, ever.',
    mp: 1.15,
    suffix: ' of Stillwater',
    varianceMin: 1.0,
  },
  stormcoil: {
    id: 'stormcoil',
    label: 'Stormcoil',
    blurb: 'Reactions spend nothing. The mark survives the blast.',
    mp: 1.25,
    suffix: ' of the Stormcoil',
    keepsReactionSetup: true,
  },
  hollowlight: {
    id: 'hollowlight',
    label: 'Hollowlight',
    blurb: 'A killing blow returns every drop of ink.',
    mp: 1.0,
    suffix: ' of Hollowlight',
    refundOnKill: true,
  },
  wraithmark: {
    id: 'wraithmark',
    label: 'Wraithmark',
    blurb: 'Never surges. The potency slider runs to 1.80.',
    mp: 1.0,
    suffix: ' of the Wraithmark',
    potencyMax: 1.8,
    alwaysStable: true,
  },
};
