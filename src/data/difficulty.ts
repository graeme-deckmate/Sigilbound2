/**
 * Difficulty profiles (v2 V5). STANDARD is the numerical identity, so the
 * balance sim (which never selects a difficulty) reproduces v1 numbers exactly.
 * Non-standard tiers scale enemy hp/attack and the economy; they get their own
 * sim windows, never the floor assertions.
 */
export type DifficultyId = 'story' | 'standard' | 'harsh' | 'nightmare';

export interface DifficultyDef {
  /** Enemy hp multiplier. */
  hpMult: number;
  /** Enemy attack multiplier. */
  atkMult: number;
  /** Gold/essence drop multiplier. */
  econMult: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  story: { hpMult: 0.8, atkMult: 0.7, econMult: 1 },
  standard: { hpMult: 1, atkMult: 1, econMult: 1 },
  harsh: { hpMult: 1.3, atkMult: 1.25, econMult: 1.25 },
  nightmare: { hpMult: 1.6, atkMult: 1.5, econMult: 1.5 },
};

export const STANDARD: DifficultyDef = DIFFICULTIES.standard;

export const DIFFICULTY_IDS: readonly DifficultyId[] = ['story', 'standard', 'harsh', 'nightmare'];

export function difficultyOf(id: DifficultyId): DifficultyDef {
  return DIFFICULTIES[id] ?? STANDARD;
}
