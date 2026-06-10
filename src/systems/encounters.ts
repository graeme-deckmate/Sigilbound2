/**
 * Encounter and step resolution (docs/02 Encounters). Pure: the caller
 * supplies the rng so tests are deterministic.
 */
import { randInt, type Rng } from '../core/rng.ts';
import { ENCOUNTER_RATE, REGEN_STEPS } from '../data/progression.ts';
import { ZONES, type Formation, type ZoneId } from '../data/formations.ts';

export interface StepArgs {
  /** Terrain char the player just stepped onto. */
  tile: string;
  /** Encounter zone covering that tile, if any. */
  zone: ZoneId | null;
  /** Grace steps remaining before encounters can roll. */
  graceSteps: number;
  /** Total steps taken including this one (drives regen cadence). */
  stepCount: number;
}

export interface EncounterRoll {
  zone: ZoneId;
  formation: Formation;
  enemyLv: number;
}

export interface StepResult {
  graceSteps: number;
  /** True when this step grants +1 HP / +1 MP overworld regen. */
  regen: boolean;
  encounter: EncounterRoll | null;
}

export function weightedPick<T extends { weight: number }>(rng: Rng, items: readonly T[]): T {
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  if (total <= 0 || items.length === 0) throw new Error('weightedPick: no weight');
  let roll = rng() * total;
  for (const it of items) {
    roll -= it.weight;
    if (roll < 0) return it;
  }
  return items[items.length - 1] as T;
}

/** Resolve one completed step: grace decay, regen tick, encounter roll. */
export function resolveStep(args: StepArgs, rng: Rng): StepResult {
  const regen = args.stepCount > 0 && args.stepCount % REGEN_STEPS === 0;
  if (args.graceSteps > 0) {
    return { graceSteps: args.graceSteps - 1, regen, encounter: null };
  }
  if (args.tile !== ',' || args.zone === null) {
    return { graceSteps: 0, regen, encounter: null };
  }
  if (rng() >= ENCOUNTER_RATE) {
    return { graceSteps: 0, regen, encounter: null };
  }
  const table = ZONES[args.zone];
  const formation = weightedPick(rng, table.formations);
  const enemyLv = randInt(rng, table.levelMin, table.levelMax);
  return { graceSteps: 0, regen, encounter: { zone: args.zone, formation, enemyLv } };
}
