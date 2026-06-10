/**
 * Spellcraft: pure derivations from a spell's composition. Formulas are
 * docs/03-CONTENT-DATA section 4; rounding order matches the prototype
 * (spellPower rounds the per-hit base before variance/multipliers).
 */
import type { ElementId, Spell } from '../core/state.ts';
import { COMBAT } from '../data/constants.ts';
import { ASPECT, MASTERY, masteryTier, SURGE, TWIN, twinPair } from '../data/wheel.ts';
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
 * Casting context for the v1.1 modifiers. Everything defaults off so
 * v1.0 call sites and the Grimoire's bare previews stay exact.
 */
export interface CastMods {
  /** Mastery points in the spell's element (tiers from data/wheel). */
  mastery?: number;
  /** The battle's snapshotted Vale Aspect element. */
  aspect?: ElementId | null;
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

/** ElementPrefix + FormRoot + RuneSuffix, e.g. "Gloomnova of Hexes".
 *  Twin spells use the pair prefix ("Stormlance of Fury"). */
export function spellName(spell: Spell): string {
  const prefix = spell.e2
    ? (twinPair(spell.element, spell.e2)?.prefix ?? ELEMENTS[spell.element].label)
    : ELEMENTS[spell.element].label;
  return prefix + spell.form + RUNES[spell.rune].suffix;
}

/** What logs and slots show: the given name, else the generated one. */
export function displayName(spell: Spell): string {
  return spell.given && spell.given.length > 0 ? spell.given : spellName(spell);
}

/** Slider ceiling for a rune: wraithmark extends to 1.80 (03 s4). */
export function potencyCapFor(rune: Spell['rune']): number {
  return RUNES[rune].potencyMax ?? COMBAT.potencyMax;
}

/** Trim and bound a player-entered name; null when unusable (1-18 chars). */
export function sanitizeGivenName(raw: string): string | null {
  const t = raw.trim().slice(0, 18);
  return t.length >= 1 ? t : null;
}

/** MP cost: max(2, round(6 * form.mp * rune.mp * potCost(p) * twinMp)).
 *  Mastery tier 3 takes 1 MP off the spell's element (min 2 holds). */
export function spellCost(spell: Spell, mods: CastMods = {}): number {
  const form = FORMS[spell.form];
  const rune = RUNES[spell.rune];
  const twinMp = spell.e2 ? TWIN.mpMult : 1;
  let cost = Math.round(COMBAT.costBase * form.mp * rune.mp * potCost(spell.p) * twinMp);
  if (masteryTier(mods.mastery ?? 0) >= 3) cost += MASTERY.tier3CostDelta;
  return Math.max(COMBAT.costMin, cost);
}

/**
 * Twin matchup (03 section 15): the better element's multiplier,
 * capped at 1.3. Single-element spells fall through to elementMult.
 */
export function twinElementMult(
  spell: Spell,
  weak: readonly ElementId[],
  resist: readonly ElementId[],
): number {
  if (!spell.e2) return elementMult(spell.element, weak, resist);
  const a = elementMult(spell.element, weak, resist);
  const b = elementMult(spell.e2, weak, resist);
  return Math.min(TWIN.matchupCap, Math.max(a, b));
}

/** 1 + (lv - 1) * 0.22 */
function levelScale(lv: number): number {
  return 1 + (lv - 1) * COMBAT.levelScaling;
}

/**
 * Rounded per-hit power before variance, element multiplier, and crit.
 * This is also the number the Grimoire displays.
 */
export function spellPower(spell: Spell, lv: number, mods: CastMods = {}): number {
  const form = FORMS[spell.form];
  const rune = RUNES[spell.rune];
  let power = COMBAT.basePower * form.pw * (rune.pw ?? 1) * spell.p * levelScale(lv);
  if (rune.hits !== undefined) power *= rune.pwEach ?? 1;
  // v1.1 modifiers: mastery tier 1 and the Vale Aspect favor the element.
  if (masteryTier(mods.mastery ?? 0) >= 1) power *= MASTERY.tier1PowerMult;
  if (mods.aspect && mods.aspect === spell.element) power *= ASPECT.powerMult;
  return Math.round(power);
}

/** Number of hits per cast (echo gives 2). */
export function spellHits(spell: Spell): number {
  return RUNES[spell.rune].hits ?? 1;
}

/** Status proc chance: clamp(element.proc + rune bonus + v1.1 bonuses, 0, 0.95). */
export function spellProc(spell: Spell, mods: CastMods = {}): number {
  let raw = ELEMENTS[spell.element].proc + (RUNES[spell.rune].procBonus ?? 0);
  if (masteryTier(mods.mastery ?? 0) >= 2) raw += MASTERY.tier2ProcBonus;
  if (mods.aspect && mods.aspect === spell.element) raw += ASPECT.procBonus;
  return Math.min(COMBAT.procCap, Math.max(0, raw));
}

/**
 * Does this cast roll the surge table (03 section 18)? Wyrd always;
 * Greedy potency (>= 1.30) while the GATING element sits below mastery
 * tier 2 (twins gate on the lower of the pair, 03 section 15);
 * always-stable runes (wraithmark) never do unless they are Wyrd.
 */
export function castSurges(spell: Spell, masteryPoints: number, mastery2?: number): boolean {
  const rune = RUNES[spell.rune];
  if (rune.surges) return true;
  if (rune.alwaysStable) return false;
  const gating = spell.e2 ? Math.min(masteryPoints, mastery2 ?? 0) : masteryPoints;
  return spell.p >= SURGE.greedyAt && masteryTier(gating) < 2;
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
