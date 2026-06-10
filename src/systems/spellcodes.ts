/**
 * Spell codes (docs/03 section 24, v1.1): `sb1:` + base64url of
 * {v:1, e, e2?, f, r, p, name}. Export shares a composition; import
 * validates, names exactly which parts the player lacks (never grants
 * them), and inscribes only when every part is owned.
 */
import type { ElementId, FormId, GameState, RuneId, Spell } from '../core/state.ts';
import { ELEMENT_IDS, ELEMENTS } from '../data/elements.ts';
import { FORM_IDS, FORMS } from '../data/forms.ts';
import { RUNE_IDS, RUNES } from '../data/runes.ts';
import { COMBAT } from '../data/constants.ts';
import { unlockedIds } from './leveling.ts';

interface CodePayload {
  v: 1;
  e: ElementId;
  e2?: ElementId;
  f: FormId;
  r: RuneId;
  p: number;
  name?: string;
}

function toBase64Url(s: string): string {
  const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string | null {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/** Encode a spell as a shareable sb1 code. */
export function exportCode(spell: Spell): string {
  const payload: CodePayload = {
    v: 1,
    e: spell.element,
    f: spell.form,
    r: spell.rune,
    p: spell.p,
  };
  if (spell.given) payload.name = spell.given;
  return `sb1:${toBase64Url(JSON.stringify(payload))}`;
}

export type CodeResult =
  | { ok: true; spell: Spell }
  | { ok: false; reason: 'malformed' }
  | { ok: false; reason: 'missing'; parts: string[] };

/**
 * Decode and check a code against what this save owns. Missing parts
 * come back named ("the Keen rune", "Gloom") and nothing is granted.
 */
export function importCode(raw: string, gs: GameState): CodeResult {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('sb1:')) return { ok: false, reason: 'malformed' };
  const json = fromBase64Url(trimmed.slice(4));
  if (!json) return { ok: false, reason: 'malformed' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, reason: 'malformed' };
  const c = parsed as Record<string, unknown>;
  if (c['v'] !== 1) return { ok: false, reason: 'malformed' };
  const e = c['e'];
  const f = c['f'];
  const r = c['r'];
  if (
    typeof e !== 'string' ||
    !(ELEMENT_IDS as readonly string[]).includes(e) ||
    typeof f !== 'string' ||
    !(FORM_IDS as readonly string[]).includes(f) ||
    typeof r !== 'string' ||
    !(RUNE_IDS as readonly string[]).includes(r)
  ) {
    return { ok: false, reason: 'malformed' };
  }
  const pRaw = typeof c['p'] === 'number' && Number.isFinite(c['p']) ? c['p'] : 1;
  const p = Math.min(COMBAT.potencyMax, Math.max(COMBAT.potencyMin, pRaw));

  const lv = gs.player.lv;
  const shrines = gs.world.shrines;
  const starter = gs.player.starter;
  const flags = gs.world.flags;
  const missing: string[] = [];
  if (!unlockedIds('element', lv, shrines, starter, flags).includes(e)) {
    missing.push(ELEMENTS[e as ElementId].label);
  }
  if (!unlockedIds('form', lv, shrines, starter, flags).includes(f)) {
    missing.push(`the ${FORMS[f as FormId].label} form`);
  }
  if (!unlockedIds('rune', lv, shrines, starter, flags).includes(r)) {
    missing.push(`the ${RUNES[r as RuneId].label} rune`);
  }
  if (missing.length > 0) return { ok: false, reason: 'missing', parts: missing };

  const spell: Spell = { element: e as ElementId, form: f as FormId, rune: r as RuneId, p };
  if (typeof c['name'] === 'string' && c['name'].trim().length > 0) {
    spell.given = c['name'].trim().slice(0, 18);
  }
  return { ok: true, spell };
}
