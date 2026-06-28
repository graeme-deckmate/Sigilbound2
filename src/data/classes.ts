/**
 * Player classes (v2 V3): an always-on identity passive that flows through
 * deriveLoadout exactly like gear, so a classless player (and the balance sim)
 * is unaffected. Chosen/changed at the armorer (the character hub).
 */
import type { StatMods } from '../core/items.ts';

export type ClassId = 'adept' | 'warden' | 'reaver' | 'wright';

export interface ClassDef {
  id: ClassId;
  label: string;
  blurb: string;
  passive: StatMods;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  adept: {
    id: 'adept',
    label: 'Adept',
    blurb: 'Spells cost a little less.',
    passive: { costMult: 0.95 },
  },
  warden: {
    id: 'warden',
    label: 'Warden',
    blurb: 'Tougher, and shrugs off a little harm.',
    passive: { maxhp: 10, defense: 1 },
  },
  reaver: {
    id: 'reaver',
    label: 'Reaver',
    blurb: 'Hits harder, lives shorter.',
    passive: { powerMult: 1.08, maxhp: -4 },
  },
  wright: {
    id: 'wright',
    label: 'Wright',
    blurb: 'A deeper well and a keener eye.',
    passive: { maxmp: 6, critChance: 0.03 },
  },
};

export const CLASS_IDS: readonly ClassId[] = ['adept', 'warden', 'reaver', 'wright'];

export function classPassive(id: ClassId | null): StatMods {
  return id ? CLASSES[id].passive : {};
}
