/**
 * Encounter and step resolution (docs/02 Encounters; v1.1 adds the Lv 1
 * meadow rule, rare rolls, and elite promotion per docs/03 section 13).
 * Pure: the caller supplies the rng so tests are deterministic.
 */
import { randInt, type Rng } from '../core/rng.ts';
import { ENCOUNTER_RATE, REGEN_STEPS } from '../data/progression.ts';
import { ZONES, type Formation, type ZoneId } from '../data/formations.ts';
import { AFFIX_IDS, ELITE, RARE, type AffixId, type RareKind } from '../data/elites.ts';

export interface StepArgs {
  /** Terrain char the player just stepped onto. */
  tile: string;
  /** Encounter zone covering that tile, if any. */
  zone: ZoneId | null;
  /** Grace steps remaining before encounters can roll. */
  graceSteps: number;
  /** Total steps taken including this one (drives regen cadence). */
  stepCount: number;
  /** Player level (the Lv 1 meadow single-enemy rule). */
  playerLv: number;
  /** Elites can roll once Bogmaw has fallen (world.bosses.bogmaw). */
  eliteEligible: boolean;
  /** Regen cadence in steps (6 base; 4 with Springstep). */
  regenEvery?: number;
}

export interface EncounterRoll {
  zone: ZoneId;
  formation: Formation;
  enemyLv: number;
  /** Enemies act first in round 1 ("You are set upon!"). */
  ambush?: boolean;
  /** Single Glimmerkin bonus encounter (overrides formation). */
  glimmer?: boolean;
  /** Per-member affix; null = not promoted. Absent = no promotions. */
  elites?: (AffixId | null)[];
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

function rareKind(rng: Rng): RareKind {
  const entries = (Object.keys(RARE.weights) as RareKind[]).map((kind) => ({
    kind,
    weight: RARE.weights[kind],
  }));
  return weightedPick(rng, entries).kind;
}

/**
 * Formations eligible for this roll. v1.1: while the player is Lv 1,
 * hearthvale.meadow never rolls 2+ member packs (the table re-weights
 * to singles). Marsh is unchanged; walking south early is meant to sting.
 */
export function eligibleFormations(zone: ZoneId, playerLv: number): readonly Formation[] {
  const table = ZONES[zone];
  if (zone === 'hearthvale.meadow' && playerLv <= 1) {
    const singles = table.formations.filter((f) => f.members.length === 1);
    if (singles.length > 0) return singles;
  }
  return table.formations;
}

/** Roll one promotion affix, uniformly (docs/03 section 13). */
function rollAffix(rng: Rng): AffixId {
  return AFFIX_IDS[Math.min(AFFIX_IDS.length - 1, Math.floor(rng() * AFFIX_IDS.length))] as AffixId;
}

/**
 * Promote per section 13: normally one member (the highest-level one;
 * pack members share a level here, so the first slot), elite packs all.
 */
function promote(memberCount: number, all: boolean, rng: Rng): (AffixId | null)[] {
  return Array.from({ length: memberCount }, (_, i) => (all || i === 0 ? rollAffix(rng) : null));
}

/** Resolve one completed step: grace decay, regen tick, encounter roll. */
export function resolveStep(args: StepArgs, rng: Rng): StepResult {
  const every = args.regenEvery ?? REGEN_STEPS;
  const regen = args.stepCount > 0 && args.stepCount % every === 0;
  if (args.graceSteps > 0) {
    return { graceSteps: args.graceSteps - 1, regen, encounter: null };
  }
  if (args.tile !== ',' || args.zone === null) {
    return { graceSteps: 0, regen, encounter: null };
  }
  if (rng() >= ENCOUNTER_RATE) {
    return { graceSteps: 0, regen, encounter: null };
  }
  const zone = args.zone;
  const table = ZONES[zone];

  // Rare roll first, independent of the formation pick (03 section 13).
  let rare: RareKind | null = null;
  if (rng() < RARE.chance) rare = rareKind(rng);

  if (rare === 'glimmer') {
    const enemyLv = randInt(rng, table.levelMin, table.levelMax);
    return {
      graceSteps: 0,
      regen,
      encounter: {
        zone,
        formation: { members: ['glimmerkin'], weight: 1 },
        enemyLv,
        glimmer: true,
      },
    };
  }

  const formation = weightedPick(rng, eligibleFormations(zone, args.playerLv));
  const enemyLv = randInt(rng, table.levelMin, table.levelMax);
  const roll: EncounterRoll = { zone, formation, enemyLv };
  if (rare === 'ambush') roll.ambush = true;

  if (rare === 'elitePack' && args.eliteEligible) {
    roll.elites = promote(formation.members.length, true, rng);
  } else if (args.eliteEligible && rng() < ELITE.chance) {
    roll.elites = promote(formation.members.length, false, rng);
  }
  return { graceSteps: 0, regen, encounter: roll };
}
