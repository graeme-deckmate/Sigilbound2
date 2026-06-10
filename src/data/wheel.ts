/** The Vale's Wheel, transcribed from docs/03 section 14 (v1.1). */
import type { ElementId, EnemyStatusId } from '../core/state.ts';

/** Wheel order: each element cashes in the status before it. */
export const WHEEL_ORDER: readonly ElementId[] = ['ember', 'rime', 'volt', 'thorn', 'gloom'];

/** The element BEFORE e on the wheel (gloom precedes ember). */
export function wheelBefore(e: ElementId): ElementId {
  const i = WHEEL_ORDER.indexOf(e);
  return WHEEL_ORDER[(i + WHEEL_ORDER.length - 1) % WHEEL_ORDER.length] as ElementId;
}

export type ReactionId = 'scald' | 'shatter' | 'snare' | 'blight' | 'kindle';

export interface ReactionDef {
  id: ReactionId;
  /** Status the reaction consumes (the element before the trigger). */
  setup: EnemyStatusId;
  /** Player hit element that fires it. */
  trigger: ElementId;
  /** Final log copy (03 section 14). */
  line: string;
}

/** Keyed by trigger element for the reducer's per-hit lookup. */
export const REACTIONS: Record<ElementId, ReactionDef> = {
  rime: { id: 'scald', setup: 'burning', trigger: 'rime', line: 'Scalding burst!' },
  volt: { id: 'shatter', setup: 'chilled', trigger: 'volt', line: 'The frost SHATTERS!' },
  thorn: { id: 'snare', setup: 'stunned', trigger: 'thorn', line: 'Snared!' },
  gloom: { id: 'blight', setup: 'envenomed', trigger: 'gloom', line: 'The venom BLOOMS!' },
  ember: { id: 'kindle', setup: 'withered', trigger: 'ember', line: 'It KINDLES!' },
};

export const REACTION = {
  /** Scald: instant damage = 2 * burnTick (burnTick = dot base + ceil(lv * perLv)). */
  scaldTickMult: 2,
  /** Shatter: the triggering hit deals +60%. */
  shatterBonus: 0.6,
  /** Snare: applies Envenomed at 100% with this duration. */
  snareVenomTurns: 4,
  /** Kindle: the triggering hit deals +40% and applies Burning at 100%. */
  kindleBonus: 0.4,
  /** Wheelwright charm multiplies reaction damage portions (Phase 13). */
  wheelwrightMult: 1.2,
} as const;

/* ---------- surges (03 section 18) ---------- */

export type SurgeSeverity = 'mild' | 'moderate' | 'severe';

export interface SurgeDef {
  /** d10 face, 1-10. */
  roll: number;
  severity: SurgeSeverity;
  id:
    | 'afterglow'
    | 'crow'
    | 'bite'
    | 'warmth'
    | 'gift'
    | 'sureStatus'
    | 'echoEcho'
    | 'grasp'
    | 'collect'
    | 'reversal';
  /** Log copy, authored per 02 tone rules. */
  line: string;
}

export const SURGE_TABLE: readonly SurgeDef[] = [
  { roll: 1, severity: 'mild', id: 'afterglow', line: 'A violet afterglow clings to you.' },
  { roll: 2, severity: 'mild', id: 'crow', line: 'Somewhere, a crow caws wrong.' },
  { roll: 3, severity: 'mild', id: 'bite', line: 'The cast bites deeper.' },
  { roll: 4, severity: 'mild', id: 'warmth', line: 'Stolen warmth seeps back.' },
  { roll: 5, severity: 'mild', id: 'gift', line: 'A quick gift: the ink returns.' },
  { roll: 6, severity: 'moderate', id: 'sureStatus', line: 'The wyrd makes it certain.' },
  { roll: 7, severity: 'moderate', id: 'echoEcho', line: 'The echo echoes.' },
  { roll: 8, severity: 'moderate', id: 'grasp', line: 'Shadows grasp at a foe.' },
  { roll: 9, severity: 'severe', id: 'collect', line: 'The dark collects its fee.' },
  { roll: 10, severity: 'severe', id: 'reversal', line: 'The spell turns in your hand!' },
];

export const SURGE = {
  /** Greedy potency threshold: at or above this, below tier 2, surges. */
  greedyAt: 1.3,
  /** bite: flat extra damage rider. */
  biteDamage: 2,
  /** warmth: HP healed. */
  warmthHp: 3,
  /** gift: MP refunded. */
  giftMp: 3,
  /** echoEcho: recast power fraction. */
  echoPowerFrac: 0.5,
  /** grasp: withered turns on a random enemy. */
  graspWitherTurns: 1,
  /** collect: caster takes this fraction of maxHP (cannot KO). */
  collectFrac: 0.08,
  /** reversal vs volt (no player stun): MP drained instead. */
  reversalVoltMp: 5,
} as const;

/* ---------- mastery (03 section 17) ---------- */

export const MASTERY = {
  cap: 50,
  /** Tier thresholds: index 0 = tier 1. */
  thresholds: [10, 25, 50],
  /** Tier 1: +5% power for that element's spells. */
  tier1PowerMult: 1.05,
  /** Tier 2: +10% status proc; Greedy potency becomes stable. */
  tier2ProcBonus: 0.1,
  /** Tier 3: -1 MP for that element's spells (min 2 still applies). */
  tier3CostDelta: -1,
} as const;

/** 0 (none) through 3. */
export function masteryTier(points: number): 0 | 1 | 2 | 3 {
  if (points >= (MASTERY.thresholds[2] ?? 50)) return 3;
  if (points >= (MASTERY.thresholds[1] ?? 25)) return 2;
  if (points >= (MASTERY.thresholds[0] ?? 10)) return 1;
  return 0;
}

/* ---------- Vale Aspects (03 section 25) ---------- */

export const ASPECT = {
  /** Player spells of the ascendant element. */
  powerMult: 1.1,
  procBonus: 0.1,
  /** Enemy moves inflicting the ascendant element's player-status. */
  enemyRiderProcBonus: 0.1,
  /** DoTs of the ascendant element tick harder. */
  dotMult: 1.1,
} as const;

/* ---------- twin-element spells (03 section 15, Act 4) ---------- */

export const TWIN = {
  mpMult: 1.6,
  matchupCap: 1.3,
  procFrac: 0.5,
} as const;

export type TwinRider =
  | 'steam' // target's next move x0.7
  | 'storm' // single-target arcs to one other enemy at 50%
  | 'wildfire' // on kill, Burning 100% to all remaining
  | 'hollowflame' // ignores shields
  | 'static' // Shatter from this spell +120% instead of +60%
  | 'mire' // target acts last next round
  | 'depth' // target cannot gain shields 2 turns
  | 'surge' // +3 MP per enemy hit
  | 'night' // Withered applied is +40% taken
  | 'rot'; // DoTs applied tick start AND end of turn

export interface TwinPairDef {
  a: ElementId;
  b: ElementId;
  prefix: string;
  rider: TwinRider;
}

export const TWIN_PAIRS: readonly TwinPairDef[] = [
  { a: 'ember', b: 'rime', prefix: 'Steam', rider: 'steam' },
  { a: 'ember', b: 'volt', prefix: 'Storm', rider: 'storm' },
  { a: 'ember', b: 'thorn', prefix: 'Wildfire', rider: 'wildfire' },
  { a: 'ember', b: 'gloom', prefix: 'Hollowflame', rider: 'hollowflame' },
  { a: 'rime', b: 'volt', prefix: 'Static', rider: 'static' },
  { a: 'rime', b: 'thorn', prefix: 'Mire', rider: 'mire' },
  { a: 'rime', b: 'gloom', prefix: 'Depth', rider: 'depth' },
  { a: 'volt', b: 'thorn', prefix: 'Surge', rider: 'surge' },
  { a: 'volt', b: 'gloom', prefix: 'Night', rider: 'night' },
  { a: 'thorn', b: 'gloom', prefix: 'Rot', rider: 'rot' },
];

export function twinPair(e1: ElementId, e2: ElementId): TwinPairDef | null {
  return TWIN_PAIRS.find((p) => (p.a === e1 && p.b === e2) || (p.a === e2 && p.b === e1)) ?? null;
}

export const STATIC_SHATTER_BONUS = 1.2;
export const STEAM_NEXT_MOVE_MULT = 0.7;
export const STORM_ARC_FRAC = 0.5;
export const NIGHT_WITHER_TAKEN = 1.4;
export const SURGE_PAIR_MP = 3;
export const DEPTH_NO_SHIELD_TURNS = 2;
