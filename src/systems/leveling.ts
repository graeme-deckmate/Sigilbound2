/**
 * XP, level-ups, and unlock evaluation. Pure functions over GameState
 * fragments; numbers come from src/data/.
 */
import type { GameState, ShrineId } from '../core/state.ts';
import {
  BASE_HP,
  BASE_MP,
  HP_PER_LEVEL,
  LEVEL_CAP,
  MP_PER_LEVEL,
  XP_BASE,
  XP_PER_LEVEL,
} from '../data/progression.ts';
import { UNLOCKS, type UnlockDef } from '../data/unlocks.ts';

export type PlayerState = GameState['player'];
export type ShrineFlags = Record<ShrineId, boolean>;

/** XP needed to clear the given level. Infinity at the cap. */
export function xpNext(lv: number): number {
  if (lv >= LEVEL_CAP) return Infinity;
  return XP_BASE + (lv - 1) * XP_PER_LEVEL;
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

export function isUnlocked(def: UnlockDef, lv: number, shrines: ShrineFlags): boolean {
  const t = def.trigger;
  switch (t.type) {
    case 'start':
      return true;
    case 'level':
      return lv >= t.lv;
    case 'shrine':
      return shrines[t.shrine];
  }
}

/** Ids of unlocked parts of one kind, in UNLOCKS order. */
export function unlockedIds(kind: UnlockDef['kind'], lv: number, shrines: ShrineFlags): string[] {
  return UNLOCKS.filter((u) => u.kind === kind && isUnlocked(u, lv, shrines)).map((u) => u.id);
}

/** Parts that unlock exactly at this level (level-up toasts). */
export function unlocksAtLevel(lv: number): UnlockDef[] {
  return UNLOCKS.filter((u) => u.trigger.type === 'level' && u.trigger.lv === lv);
}

/** Parts granted by this shrine (shrine toasts). */
export function unlocksAtShrine(shrine: ShrineId): UnlockDef[] {
  return UNLOCKS.filter((u) => u.trigger.type === 'shrine' && u.trigger.shrine === shrine);
}

/** Locked-chip hint text (docs/03-CONTENT-DATA section 5). */
export function unlockHint(def: UnlockDef): string {
  const t = def.trigger;
  switch (t.type) {
    case 'start':
      return '';
    case 'level':
      return `Reach Lv ${String(t.lv)}`;
    case 'shrine':
      return `Pray at the ${t.region} shrine.`;
  }
}
