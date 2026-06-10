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

export const FORM_IDS: readonly FormId[] = ['wisp', 'bolt', 'lance', 'nova', 'veil'];

export const FORMS: Record<FormId, FormDef> = {
  wisp: { id: 'wisp', label: 'Wisp', pw: 0.62, mp: 0.5, targeting: 'single' },
  bolt: { id: 'bolt', label: 'Bolt', pw: 1.0, mp: 1.0, targeting: 'single' },
  lance: { id: 'lance', label: 'Lance', pw: 1.42, mp: 1.55, targeting: 'single' },
  nova: { id: 'nova', label: 'Nova', pw: 0.55, mp: 1.45, targeting: 'all' },
  veil: { id: 'veil', label: 'Veil', pw: 0.9, mp: 1.1, targeting: 'self' },
};
