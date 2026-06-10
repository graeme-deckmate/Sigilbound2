/** Forms, transcribed from docs/03-CONTENT-DATA section 2. */
import type { FormId } from '../core/state.ts';

export type Targeting = 'single' | 'all' | 'self';

export interface FormDef {
  id: FormId;
  /** Display label; the lowercase id is the spell-name root (03 section 4). */
  label: string;
  /** Power multiplier. For nova it applies per target. */
  pw: number;
  /** MP cost multiplier. */
  mp: number;
  targeting: Targeting;
}

export const FORM_IDS: readonly FormId[] = ['wisp', 'bolt', 'lance', 'nova', 'veil', 'call'];

export const FORMS: Record<FormId, FormDef> = {
  wisp: { id: 'wisp', label: 'Wisp', pw: 0.62, mp: 0.5, targeting: 'single' },
  bolt: { id: 'bolt', label: 'Bolt', pw: 1.0, mp: 1.0, targeting: 'single' },
  lance: { id: 'lance', label: 'Lance', pw: 1.42, mp: 1.55, targeting: 'single' },
  nova: { id: 'nova', label: 'Nova', pw: 0.55, mp: 1.45, targeting: 'all' },
  veil: { id: 'veil', label: 'Veil', pw: 0.9, mp: 1.1, targeting: 'self' },
  /** Call (Act 4, 03 section 22): summons a familiar. */
  call: { id: 'call', label: 'Call', pw: 0.55, mp: 1.7, targeting: 'self' },
};

/** Familiar tuning for the Call form (03 section 22). */
export const FAMILIAR = {
  /** familiar hp = round((hpBase + hpPerLv * lv) * potency). */
  hpBase: 20,
  hpPerLv: 6,
  /** Chance an enemy attack is drawn to the familiar instead. */
  redirectChance: 0.4,
  /** Familiar proc = element proc * this, unless the rune restores it. */
  procFrac: 0.5,
} as const;
