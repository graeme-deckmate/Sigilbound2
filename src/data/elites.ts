/** Elites and rare encounters, transcribed from docs/03 section 13 (v1.1). */

export type AffixId = 'veiled' | 'frenzied' | 'mirrorhide' | 'fleet' | 'sealed';

export interface AffixDef {
  id: AffixId;
  /** Display name prefix, e.g. "Veiled Gloop". */
  prefix: string;
}

export const AFFIX_IDS: readonly AffixId[] = [
  'veiled',
  'frenzied',
  'mirrorhide',
  'fleet',
  'sealed',
];

export const AFFIXES: Record<AffixId, AffixDef> = {
  veiled: { id: 'veiled', prefix: 'Veiled' },
  frenzied: { id: 'frenzied', prefix: 'Frenzied' },
  mirrorhide: { id: 'mirrorhide', prefix: 'Mirrorhide' },
  fleet: { id: 'fleet', prefix: 'Fleet' },
  sealed: { id: 'sealed', prefix: 'Sealed' },
};

export const ELITE = {
  /** Promotion chance per formation roll once Bogmaw has fallen. */
  chance: 0.1,
  /** NG+ promotion chance (Phase 15). */
  chanceNgPlus: 0.25,
  /** Veiled: starting shield 10 + 2 * lv. */
  veiledShieldBase: 10,
  veiledShieldPerLv: 2,
  /** Frenzied: damage multiplier below half HP. */
  frenziedMult: 1.4,
  frenziedAtHpFrac: 0.5,
  /** Mirrorhide: chance to reflect the striking element's status. */
  mirrorChance: 0.35,
  /** Mirrorhide vs volt (no player stun exists): MP drained instead. */
  mirrorVoltMpDrain: 4,
  /** Fleet: acts twice per round, each act at this damage multiplier. */
  fleetMult: 0.6,
  /** Promoted enemies pay double XP. */
  xpMult: 2,
} as const;

/** Independent rare-encounter roll, before the formation pick. */
export const RARE = {
  chance: 0.04,
  /** NG+ glimmer chance (Phase 15). */
  glimmerChanceNgPlus: 0.06,
  weights: { ambush: 2, glimmer: 1, elitePack: 1 },
} as const;

export type RareKind = keyof typeof RARE.weights;

/** Glimmerkin: never attacks, flees at the end of round 2. */
export const GLIMMERKIN = {
  h0: 14,
  hpl: 4,
  xpBase: 30,
  xpPerLv: 6,
  fleesAfterRound: 2,
} as const;
