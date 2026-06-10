/**
 * XP, level-ups, and unlock evaluation. Pure functions over GameState
 * fragments; numbers come from src/data/.
 */
import type { ElementId, GameState, ShrineId } from '../core/state.ts';
import {
  BASE_HP,
  BASE_MP,
  HP_PER_LEVEL,
  LEVEL_CAP,
  MP_PER_LEVEL,
  XP_BASE,
  XP_EXP,
  XP_SCALE,
} from '../data/progression.ts';
import { isStarterElement, starterElementLevel, UNLOCKS, type UnlockDef } from '../data/unlocks.ts';
import { ELEMENTS } from '../data/elements.ts';
import { FORMS } from '../data/forms.ts';
import { RUNES } from '../data/runes.ts';

export type PlayerState = GameState['player'];
export type ShrineFlags = Record<ShrineId, boolean>;

/** XP needed to clear the given level (v1.1 reshape). Infinity at cap. */
export function xpNext(lv: number): number {
  if (lv >= LEVEL_CAP) return Infinity;
  return Math.round(XP_BASE + Math.pow(lv - 1, XP_EXP) * XP_SCALE);
}

export function maxHpAt(lv: number): number {
  return BASE_HP + (lv - 1) * HP_PER_LEVEL;
}

export function maxMpAt(lv: number): number {
  return BASE_MP + (lv - 1) * MP_PER_LEVEL;
}

/**
 * Add XP, applying level-ups with carryover (prototype behavior):
 * each level grants +8 maxHP, +4 maxMP, and a full restore.
 * Returns the new player state and the levels reached, for toasts.
 */
export function applyXp(
  player: PlayerState,
  amount: number,
): {
  player: PlayerState;
  levelsGained: number[];
} {
  const p = { ...player, xp: player.xp + amount };
  const levelsGained: number[] = [];
  while (p.lv < LEVEL_CAP && p.xp >= xpNext(p.lv)) {
    p.xp -= xpNext(p.lv);
    p.lv += 1;
    p.maxhp += HP_PER_LEVEL;
    p.maxmp += MP_PER_LEVEL;
    p.hp = p.maxhp;
    p.mp = p.maxmp;
    levelsGained.push(p.lv);
  }
  return { player: p, levelsGained };
}

/** The level a starter-triggered unlock resolves to, given the pick. */
function starterLevel(def: UnlockDef, starter: ElementId | null): number {
  if (def.kind === 'element' && isStarterElement(def.id)) {
    return starterElementLevel(def.id, starter && isStarterElement(starter) ? starter : null);
  }
  return 1;
}

export function isUnlocked(
  def: UnlockDef,
  lv: number,
  shrines: ShrineFlags,
  starter: ElementId | null = null,
): boolean {
  const t = def.trigger;
  switch (t.type) {
    case 'start':
      return true;
    case 'level':
      return lv >= t.lv;
    case 'shrine':
      return shrines[t.shrine];
    case 'starter':
      return lv >= starterLevel(def, starter);
  }
}

/** Ids of unlocked parts of one kind, in UNLOCKS order. */
export function unlockedIds(
  kind: UnlockDef['kind'],
  lv: number,
  shrines: ShrineFlags,
  starter: ElementId | null = null,
): string[] {
  return UNLOCKS.filter((u) => u.kind === kind && isUnlocked(u, lv, shrines, starter)).map(
    (u) => u.id,
  );
}

/** Parts that unlock exactly at this level (level-up toasts). */
export function unlocksAtLevel(lv: number, starter: ElementId | null = null): UnlockDef[] {
  return UNLOCKS.filter((u) => {
    if (u.trigger.type === 'level') return u.trigger.lv === lv;
    if (u.trigger.type === 'starter') return starterLevel(u, starter) === lv && lv > 1;
    return false;
  });
}

/** Parts granted by this shrine (shrine toasts). */
export function unlocksAtShrine(shrine: ShrineId): UnlockDef[] {
  return UNLOCKS.filter((u) => u.trigger.type === 'shrine' && u.trigger.shrine === shrine);
}

/** Level-up toast copy for an unlock (used by the World scene). */
export function unlockToastText(unlock: UnlockDef): string {
  switch (unlock.kind) {
    case 'element':
      return `Element unlocked: ${ELEMENTS[unlock.id].label.toUpperCase()}`;
    case 'form':
      return `Form unlocked: ${FORMS[unlock.id].label.toUpperCase()}`;
    case 'rune':
      return `Rune unlocked: ${RUNES[unlock.id].label.toUpperCase()}`;
  }
}

/** Locked-chip hint text (docs/03-CONTENT-DATA section 5). */
export function unlockHint(def: UnlockDef, starter: ElementId | null = null): string {
  const t = def.trigger;
  switch (t.type) {
    case 'start':
      return '';
    case 'level':
      return `Reach Lv ${String(t.lv)}`;
    case 'shrine':
      return `Pray at the ${t.region} shrine.`;
    case 'starter':
      return `Reach Lv ${String(starterLevel(def, starter))}`;
  }
}
