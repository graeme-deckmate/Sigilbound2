/**
 * NG+ (docs/03 section 25): a fresh Vale that remembers the author.
 * Carries the grimoire (renames included), starter, mastery, charms,
 * slots, relic runes, feats, bestiary, lifetime stats and settings;
 * resets level, essence, scrolls, notes, sigils, world flags, gates
 * and caches. Repeatable; scaling is flat per cycle, never compounded.
 */
import type { GameState } from '../core/state.ts';
import { newGame } from '../core/save.ts';

/** Relic rune flags survive the forgetting (03 section 25). */
const RELIC_FLAGS = [
  'rune_emberglass',
  'rune_stillwater',
  'rune_stormcoil',
  'rune_hollowlight',
  'rune_wraithmark',
] as const;

export function beginNgPlus(gs: GameState): GameState {
  const next = newGame();
  const carried = structuredClone(gs);

  next.player.spells = carried.player.spells;
  next.player.slotsUnlocked = carried.player.slotsUnlocked;
  next.player.starter = carried.player.starter;
  next.player.mastery = carried.player.mastery;
  next.player.charms = carried.player.charms;
  next.player.ngPlus = carried.player.ngPlus + 1;

  for (const flag of RELIC_FLAGS) {
    if (carried.world.flags[flag]) next.world.flags[flag] = true;
  }

  next.feats = carried.feats;
  next.bestiary = carried.bestiary;
  next.stats = carried.stats;
  next.settings = carried.settings;
  return next;
}
