/**
 * Status effect parameters, transcribed from docs/02-GAME-DESIGN
 * (status tables) and docs/03-CONTENT-DATA section 1 (DoT values).
 */
import type { EnemyStatusId, PlayerStatusId } from '../core/state.ts';

/** Statuses ON ENEMIES, inflicted by player elements. */
export interface EnemyStatusDef {
  id: EnemyStatusId;
  /** Battle log name, e.g. "Burning". */
  label: string;
  /** Turns the status lasts. Reapplication refreshes duration. */
  duration: number;
  /** DoT at the start of its turn: base + ceil(playerLv * perLv). */
  dot?: { base: number; perLv: number };
  /** Multiplier on damage the enemy deals (chilled). */
  dealtMult?: number;
  /** Multiplier on damage the enemy takes (withered). */
  takenMult?: number;
  /** Skips the enemy turn (stunned). */
  skipsTurn?: boolean;
  /** Turns of immunity after the status expires (stun rule, 02). */
  immunityAfter?: number;
}

export const ENEMY_STATUSES: Record<EnemyStatusId, EnemyStatusDef> = {
  burning: { id: 'burning', label: 'Burning', duration: 3, dot: { base: 4, perLv: 1.2 } },
  chilled: { id: 'chilled', label: 'Chilled', duration: 2, dealtMult: 0.65 },
  stunned: { id: 'stunned', label: 'Stunned', duration: 1, skipsTurn: true, immunityAfter: 1 },
  envenomed: { id: 'envenomed', label: 'Envenomed', duration: 3, dot: { base: 6, perLv: 1.5 } },
  withered: { id: 'withered', label: 'Withered', duration: 2, takenMult: 1.25 },
};

/**
 * Statuses ON PLAYER, inflicted by some enemy moves (Act 2+). No player
 * stun. Focus cleanses one (oldest first); all clear when battle ends.
 * No duration is specified in the docs: they persist until cleansed or
 * the battle ends.
 */
export interface PlayerStatusDef {
  id: PlayerStatusId;
  label: string;
  /** DoT as a fraction of max HP. */
  dotPctMaxHp?: number;
  /** Multiplier on the player's spell power (chilled). */
  spellPowerMult?: number;
  /** Multiplier on damage the player takes (withered). */
  takenMult?: number;
}

export const PLAYER_STATUSES: Record<PlayerStatusId, PlayerStatusDef> = {
  burning: { id: 'burning', label: 'Burning', dotPctMaxHp: 0.05 },
  chilled: { id: 'chilled', label: 'Chilled', spellPowerMult: 0.7 },
  envenomed: { id: 'envenomed', label: 'Envenomed', dotPctMaxHp: 0.07 },
  withered: { id: 'withered', label: 'Withered', takenMult: 1.25 },
};
