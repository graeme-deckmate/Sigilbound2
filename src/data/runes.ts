/** Runes, transcribed from docs/03-CONTENT-DATA section 3. */
import type { RuneId } from '../core/state.ts';

export interface RuneDef {
  id: RuneId;
  label: string;
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
  none: { id: 'none', label: 'No rune', mp: 1.0, suffix: '' },
  fury: { id: 'fury', label: 'Fury', mp: 1.65, suffix: ' of Fury', pw: 1.5 },
  thirst: { id: 'thirst', label: 'Thirst', mp: 1.35, suffix: ' of Thirst', healFrac: 0.35 },
  echo: {
    id: 'echo',
    label: 'Echo',
    mp: 1.45,
    suffix: ' of Echoes',
    hits: 2,
    pwEach: 0.62,
    veilReapply: true,
  },
  hex: { id: 'hex', label: 'Hex', mp: 1.3, suffix: ' of Hexes', procBonus: 0.4 },
  keen: {
    id: 'keen',
    label: 'Keen',
    mp: 1.2,
    suffix: ' of Keening',
    crit: { chance: 0.26, mult: 1.75 },
  },
  wyrd: {
    id: 'wyrd',
    label: 'Wyrd',
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
    mp: 1.1,
    suffix: ' of Emberglass',
    resistAsNeutral: true,
  },
  stillwater: {
    id: 'stillwater',
    label: 'Stillwater',
    mp: 1.15,
    suffix: ' of Stillwater',
    varianceMin: 1.0,
  },
  stormcoil: {
    id: 'stormcoil',
    label: 'Stormcoil',
    mp: 1.25,
    suffix: ' of the Stormcoil',
    keepsReactionSetup: true,
  },
  hollowlight: {
    id: 'hollowlight',
    label: 'Hollowlight',
    mp: 1.0,
    suffix: ' of Hollowlight',
    refundOnKill: true,
  },
  wraithmark: {
    id: 'wraithmark',
    label: 'Wraithmark',
    mp: 1.0,
    suffix: ' of the Wraithmark',
    potencyMax: 1.8,
    alwaysStable: true,
  },
};
