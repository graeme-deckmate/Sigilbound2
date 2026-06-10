/**
 * Scripted battle triggers referenced by map @trigger directives.
 * Stepping on the trigger tile fires the battle once; the world flag
 * with the same id records it (docs/03 section 9: the scripted first
 * Gloop fight outside Hearth's south exit).
 */
import type { EnemySpeciesId } from './enemies.ts';
import type { ZoneId } from './formations.ts';

export interface ScriptedBattle {
  members: readonly EnemySpeciesId[];
  enemyLv: number;
  /** Backdrop zone for the fight. */
  zone: ZoneId;
}

export const SCRIPTED_BATTLES: Record<string, ScriptedBattle> = {
  gloop_intro: { members: ['gloop'], enemyLv: 1, zone: 'hearthvale.meadow' },
};
