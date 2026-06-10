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
  p: number = COMBAT.potencyDefault,
): Spell {
  return { element, form, rune, p };
}

/**
 * Potency cost multiplier (v1.1, 03 section 4): piecewise linear
 * through (0.70, 0.60), (1.00, 1.00), (1.50, 2.00). Clamped to the
 * anchor range; the wraithmark segment extends it in Phase 14.
 */
export function potCost(p: number): number {
  const anchors = COMBAT.potCostAnchors;
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!first || !last) return 1;
  if (p <= first[0]) return first[1];
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (a && b && p <= b[0]) {
      const t = (p - a[0]) / (b[0] - a[0]);
      return a[1] + t * (b[1] - a[1]);
    }
  }
  return last[1];
}

/** ElementPrefix + FormRoot + RuneSuffix, e.g. "Gloomnova of Hexes". */
export function spellName(spell: Spell): string {
  return ELEMENTS[spell.element].label + spell.form + RUNES[spell.rune].suffix;
}

/** What logs and slots show: the given name, else the generated one. */
export function displayName(spell: Spell): string {
  return spell.given && spell.given.length > 0 ? spell.given : spellName(spell);
}

/** Trim and bound a player-entered name; null when unusable (1-18 chars). */
export function sanitizeGivenName(raw: string): string | null {
  const t = raw.trim().slice(0, 18);
  return t.length >= 1 ? t : null;
}

/** MP cost: max(2, round(6 * form.mp * rune.mp * potCost(p))). */
export function spellCost(spell: Spell): number {
  const form = FORMS[spell.form];
  const rune = RUNES[spell.rune];
  return Math.max(
    COMBAT.costMin,
    Math.round(COMBAT.costBase * form.mp * rune.mp * potCost(spell.p)),
  );
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
  let power = COMBAT.basePower * form.pw * (rune.pw ?? 1) * spell.p * levelScale(lv);
  if (rune.hits !== undefined) power *= rune.pwEach ?? 1;
  return Math.round(power);
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

/** Shield: round(14 * (rune.pw ?? 1) * p * lvScale * form.pw). */
export function veilShield(spell: Spell, lv: number): number {
  const form = FORMS[spell.form];
  const rune = RUNES[spell.rune];
  return Math.round(COMBAT.veilBase * (rune.pw ?? 1) * spell.p * levelScale(lv) * form.pw);
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
