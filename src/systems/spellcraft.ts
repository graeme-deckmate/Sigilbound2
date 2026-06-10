/**
 * Spellcraft: pure derivations from a spell's composition. Formulas are
 * docs/03-CONTENT-DATA section 4; rounding order matches the prototype
 * (spellPower rounds the per-hit base before variance/multipliers).
 */
import type { ElementId, Spell } from '../core/state.ts';
import { COMBAT } from '../data/constants.ts';
import { ELEMENTS } from '../data/elements.ts';
import { FORMS, type Targeting } from '../data/forms.ts';
import { RUNES } from '../data/runes.ts';

export function makeSpell(
  element: Spell['element'],
  form: Spell['form'],
  rune: Spell['rune'],
): Spell {
  return { element, form, rune };
}

/** ElementPrefix + FormRoot + RuneSuffix, e.g. "Gloomnova of Hexes". */
export function spellName(spell: Spell): string {
  return ELEMENTS[spell.element].label + spell.form + RUNES[spell.rune].suffix;
}

/** MP cost: max(2, round(6 * form.mp * rune.mp)). */
export function spellCost(spell: Spell): number {
  const form = FORMS[spell.form];
  const rune = RUNES[spell.rune];
  return Math.max(COMBAT.costMin, Math.round(COMBAT.costBase * form.mp * rune.mp));
}

/** 1 + (lv - 1) * 0.22 */
function levelScale(lv: number): number {
  return 1 + (lv - 1) * COMBAT.levelScaling;
}

/**
 * Rounded per-hit power before variance, element multiplier, and crit.
 * This is also the number the Grimoire displays.
 */
export function spellPower(spell: Spell, lv: number): number {
  const form = FORMS[spell.form];
  const rune = RUNES[spell.rune];
  let p = COMBAT.basePower * form.pw * (rune.pw ?? 1) * levelScale(lv);
  if (rune.hits !== undefined) p *= rune.pwEach ?? 1;
  return Math.round(p);
}

/** Number of hits per cast (echo gives 2). */
export function spellHits(spell: Spell): number {
  return RUNES[spell.rune].hits ?? 1;
}

/** Status proc chance: clamp(element.proc + rune bonus, 0, 0.95). */
export function spellProc(spell: Spell): number {
  const raw = ELEMENTS[spell.element].proc + (RUNES[spell.rune].procBonus ?? 0);
  return Math.min(COMBAT.procCap, Math.max(0, raw));
}

/** Crit profile; keen overrides the base. Ignored for Veil casts. */
export function critProfile(spell: Spell): { chance: number; mult: number } {
  return RUNES[spell.rune].crit ?? { chance: COMBAT.critChance, mult: COMBAT.critMult };
}

/** Shield from casting a Veil spell: round(14 * (rune.pw ?? 1) * lvScale * form.pw). */
export function veilShield(spell: Spell, lv: number): number {
  const form = FORMS[spell.form];
  const rune = RUNES[spell.rune];
  return Math.round(COMBAT.veilBase * (rune.pw ?? 1) * levelScale(lv) * form.pw);
}

/** Veil rider proc chance when an enemy strikes the shield. */
export function veilRiderProc(spell: Spell): number {
  const base = spell.element === 'volt' ? COMBAT.veilRiderProcVolt : COMBAT.veilRiderProc;
  const raw = base + (RUNES[spell.rune].procBonus ?? 0);
  return Math.min(COMBAT.procCap, raw);
}

export function spellTargeting(spell: Spell): Targeting {
  return FORMS[spell.form].targeting;
}

/** weak 1.6 | resist 0.6 | neutral 1.0 (bosses may override in battle). */
export function elementMult(
  attack: ElementId,
  weak: readonly ElementId[],
  resist: readonly ElementId[],
): number {
  if (weak.includes(attack)) return COMBAT.weakMult;
  if (resist.includes(attack)) return COMBAT.resistMult;
  return 1.0;
}
