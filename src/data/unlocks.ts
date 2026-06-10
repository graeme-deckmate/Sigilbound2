/** Unlock schedule, transcribed from docs/03-CONTENT-DATA section 5 (v1.1). */
import type { ElementId, FormId, RuneId, ShrineId } from '../core/state.ts';

export type UnlockTrigger =
  | { type: 'start' }
  | { type: 'level'; lv: number }
  | { type: 'shrine'; shrine: ShrineId; region: string }
  /** One of the three starter elements; its level depends on the pick. */
  | { type: 'starter' }
  /** Granted by a world flag (peddler trades, gate caches, Sanctum). */
  | { type: 'flag'; flag: string; hint: string };

export type UnlockDef =
  | { kind: 'element'; id: ElementId; trigger: UnlockTrigger }
  | { kind: 'form'; id: FormId; trigger: UnlockTrigger }
  | { kind: 'rune'; id: RuneId; trigger: UnlockTrigger };

/** The Elder's offered starters, in wheel order among themselves. */
export const STARTERS = ['ember', 'rime', 'thorn'] as const;
export type StarterId = (typeof STARTERS)[number];

/** The unpicked starters backfill at these levels, wheel order. */
export const BACKFILL_LEVELS = [2, 6] as const;

export function isStarterElement(id: ElementId): id is StarterId {
  return (STARTERS as readonly string[]).includes(id);
}

/**
 * The level a starter element unlocks at, given the chosen starter:
 * 1 for the pick itself, then 2 and 6 in wheel order from it
 * (chose Ember: Rime at 2, Thorn at 6; Rime: Thorn 2, Ember 6;
 * Thorn: Ember 2, Rime 6). A null starter reads as Ember so pre-choice
 * code paths stay safe.
 */
export function starterElementLevel(id: StarterId, starter: StarterId | null): 1 | 2 | 6 {
  const s = STARTERS.indexOf(starter ?? 'ember');
  const offset = (STARTERS.indexOf(id) - s + STARTERS.length) % STARTERS.length;
  if (offset === 0) return 1;
  return offset === 1 ? BACKFILL_LEVELS[0] : BACKFILL_LEVELS[1];
}

export const UNLOCKS: readonly UnlockDef[] = [
  { kind: 'element', id: 'ember', trigger: { type: 'starter' } },
  { kind: 'form', id: 'wisp', trigger: { type: 'start' } },
  { kind: 'form', id: 'bolt', trigger: { type: 'start' } },
  { kind: 'rune', id: 'none', trigger: { type: 'start' } },
  { kind: 'element', id: 'rime', trigger: { type: 'starter' } },
  { kind: 'form', id: 'lance', trigger: { type: 'level', lv: 3 } },
  { kind: 'element', id: 'volt', trigger: { type: 'level', lv: 4 } },
  { kind: 'form', id: 'nova', trigger: { type: 'level', lv: 5 } },
  { kind: 'element', id: 'thorn', trigger: { type: 'starter' } },
  { kind: 'form', id: 'veil', trigger: { type: 'level', lv: 7 } },
  { kind: 'element', id: 'gloom', trigger: { type: 'level', lv: 8 } },
  { kind: 'rune', id: 'hex', trigger: { type: 'level', lv: 9 } },
  { kind: 'rune', id: 'fury', trigger: { type: 'shrine', shrine: 'fury', region: 'Hearthvale' } },
  { kind: 'rune', id: 'thirst', trigger: { type: 'shrine', shrine: 'thirst', region: 'Westwood' } },
  { kind: 'rune', id: 'echo', trigger: { type: 'shrine', shrine: 'echo', region: 'Ashen Reach' } },
  { kind: 'rune', id: 'keen', trigger: { type: 'shrine', shrine: 'keen', region: 'North Hollow' } },
  {
    kind: 'rune',
    id: 'wyrd',
    trigger: { type: 'flag', flag: 'rune_wyrd', hint: 'Murk trades in such things.' },
  },
  {
    kind: 'rune',
    id: 'emberglass',
    trigger: { type: 'flag', flag: 'rune_emberglass', hint: 'Sealed behind an old gate.' },
  },
  {
    kind: 'rune',
    id: 'stillwater',
    trigger: { type: 'flag', flag: 'rune_stillwater', hint: 'Sealed behind an old gate.' },
  },
  {
    kind: 'rune',
    id: 'stormcoil',
    trigger: { type: 'flag', flag: 'rune_stormcoil', hint: 'Sealed behind an old gate.' },
  },
  {
    kind: 'rune',
    id: 'hollowlight',
    trigger: { type: 'flag', flag: 'rune_hollowlight', hint: 'Sealed behind an old gate.' },
  },
  {
    kind: 'rune',
    id: 'wraithmark',
    trigger: { type: 'flag', flag: 'rune_wraithmark', hint: 'The Sanctum remembers.' },
  },
];
