/**
 * The discovery layer, transcribed from docs/03 sections 19-21 and 24
 * (v1.1): element gates and caches, charms, the peddler, commissions,
 * scrolls, and feats.
 */
import type { ElementId, MapId, RuneId } from '../core/state.ts';

/* ---------- gates and caches (section 19) ---------- */

export type CacheReward =
  | { kind: 'relic'; rune: RuneId }
  | { kind: 'charm'; charm: CharmId }
  | { kind: 'essence'; amount: number }
  | { kind: 'essenceAndCharm'; amount: number; charm: CharmId }
  | { kind: 'essenceAndSign'; amount: number; dialogue: string }
  | { kind: 'relicAndLore'; rune: RuneId; dialogue: string };

export interface GateDef {
  id: string;
  map: MapId;
  /** Plain-stated element key; 'any' = any damaging element. */
  element: ElementId | 'any';
  /** Display name for the gate copy. */
  label: string;
  reward: CacheReward;
}

export const GATES: readonly GateDef[] = [
  {
    id: 'shed',
    map: 'hearth',
    element: 'any',
    label: 'the cracked shed',
    reward: { kind: 'essenceAndSign', amount: 5, dialogue: 'gate_shed_sign' },
  },
  {
    id: 'briarfall',
    map: 'hearthvale',
    element: 'ember',
    label: 'Briarfall',
    reward: { kind: 'relicAndLore', rune: 'emberglass', dialogue: 'gate_briarfall_lore' },
  },
  {
    id: 'mirepool',
    map: 'hearthvale',
    element: 'rime',
    label: 'Mirepool',
    reward: { kind: 'essenceAndCharm', amount: 12, charm: 'springstep' },
  },
  {
    id: 'lightless',
    map: 'westwood',
    element: 'gloom',
    label: 'the Lightless Hollow',
    reward: { kind: 'relic', rune: 'stillwater' },
  },
  {
    id: 'trellis',
    map: 'westwood',
    element: 'thorn',
    label: 'the Barren Trellis',
    reward: { kind: 'charm', charm: 'longbrand' },
  },
  {
    id: 'circuit',
    map: 'ashenreach',
    element: 'volt',
    label: 'the Dead Circuit',
    reward: { kind: 'relic', rune: 'stormcoil' },
  },
  {
    id: 'scalded',
    map: 'ashenreach',
    element: 'rime',
    label: 'the Scalded Spring',
    reward: { kind: 'essenceAndCharm', amount: 15, charm: 'sigilglass' },
  },
  {
    id: 'frozenfall',
    map: 'northhollow',
    element: 'ember',
    label: 'the Frozen Fall',
    reward: { kind: 'charm', charm: 'stillmind' },
  },
  {
    id: 'hungrydark',
    map: 'northhollow',
    element: 'gloom',
    label: 'the Hungry Dark',
    reward: { kind: 'relic', rune: 'hollowlight' },
  },
];

export function gateFlag(id: string): string {
  return `gate_${id}`;
}

/* ---------- charms (section 20) ---------- */

export type CharmId =
  | 'emberknot'
  | 'springstep'
  | 'stillmind'
  | 'longbrand'
  | 'wheelwright'
  | 'scrollsash'
  | 'sigilglass'
  | 'graverobber';

export interface CharmDef {
  id: CharmId;
  label: string;
  /** Player-facing one-liner (02 tone rules). */
  blurb: string;
}

export const CHARM_IDS: readonly CharmId[] = [
  'emberknot',
  'springstep',
  'stillmind',
  'longbrand',
  'wheelwright',
  'scrollsash',
  'sigilglass',
  'graverobber',
];

export const CHARMS: Record<CharmId, CharmDef> = {
  emberknot: {
    id: 'emberknot',
    label: 'Emberknot',
    blurb: 'Battles start with a 10-point shield.',
  },
  springstep: {
    id: 'springstep',
    label: 'Springstep',
    blurb: 'The road restores you every 4 steps.',
  },
  stillmind: { id: 'stillmind', label: 'Stillmind', blurb: 'Focus cleanses everything at once.' },
  longbrand: {
    id: 'longbrand',
    label: 'Longbrand',
    blurb: 'Marks you leave last one turn longer.',
  },
  wheelwright: {
    id: 'wheelwright',
    label: 'Wheelwright',
    blurb: 'Wheel reactions strike 20% harder.',
  },
  scrollsash: { id: 'scrollsash', label: 'Scrollsash', blurb: 'Carry a fourth scroll.' },
  sigilglass: {
    id: 'sigilglass',
    label: 'Sigilglass',
    blurb: 'Foes show their weaknesses in battle.',
  },
  graverobber: { id: 'graverobber', label: 'Graverobber', blurb: 'One extra essence per victory.' },
};

export const CHARM = {
  emberknotShield: 10,
  springstepRegen: 4,
  longbrandBonusTurns: 1,
  wheelwrightMult: 1.2,
  scrollsashCap: 4,
  graverobberEssence: 1,
} as const;

/* ---------- scrolls (section 24) ---------- */

export const SCROLL = {
  cap: 3,
  potency: 2.5,
  cost: 0,
  essencePrice: 8,
} as const;

/* ---------- the peddler (section 20) ---------- */

export const MURK = {
  intro: 'Murk. Purveyor of the misplaced. Essence only. Coin is a lowland superstition.',
  wyrdPrice: 30,
  hintPrice: 5,
  charmPrice: 25,
  /** Charms Murk can stock (graverobber is peddler-exclusive). */
  stockPool: CHARM_IDS,
  stockSize: 3,
} as const;

/** Murk's spot by progress: sigils held (bogmaw counts via its flag). */
export function murkLocation(
  bogmawDown: boolean,
  sigils: number,
  wraithDown: boolean,
): { map: MapId; x: number; y: number } | null {
  if (!bogmawDown) return null;
  if (wraithDown) return { map: 'northhollow', x: 26, y: 5 }; // Sanctum entrance basin
  if (sigils >= 3) return { map: 'northhollow', x: 41, y: 23 }; // midway camp
  if (sigils >= 2) return { map: 'hearth', x: 16, y: 2 }; // the North gate
  return { map: 'hearth', x: 13, y: 12 }; // the Hearth well
}

/* ---------- commissions (section 21) ---------- */

export interface CommissionDef {
  id: string;
  npcId: string;
  /** Ask copy (final, 03 section 21). */
  ask: string;
  /** Notes page line, player voice. */
  noteLine: string;
  reward: { essence?: number; charm?: CharmId; hint?: boolean; feat?: string };
}

export const COMMISSIONS: readonly CommissionDef[] = [
  {
    id: 'fisher',
    npcId: 'fisher',
    ask: 'My nets freeze stiff before dawn. Write me something warm that wears a shield, and I will owe you.',
    noteLine: 'The fisher wants something warm that wears a shield.',
    reward: { essence: 10, charm: 'emberknot' },
  },
  {
    id: 'scout',
    npcId: 'scout',
    ask: 'Something far-striking and storm-flavored, with real ink behind it.',
    noteLine: 'The scout wants a far-striking storm with real ink behind it.',
    reward: { essence: 15, hint: true },
  },
  {
    id: 'dreamer',
    npcId: 'dreamer',
    ask: 'In the dream the dark spread everywhere at once. Make it real.',
    noteLine: 'The dreamer wants the dark, everywhere at once.',
    reward: { essence: 10 },
  },
  {
    id: 'keeper',
    npcId: 'keeper',
    ask: 'Two natures on one page. The old books say it cannot be done.',
    noteLine: 'The keeper wants two natures on one page.',
    reward: { essence: 15, charm: 'wheelwright' },
  },
];

export function commissionFlag(id: string): string {
  return `commission_${id}`;
}

export function commissionHeardFlag(id: string): string {
  return `commission_heard_${id}`;
}

/* ---------- feats (section 24) ---------- */

export interface FeatDef {
  id: string;
  label: string;
  blurb: string;
}

export const FEATS: readonly FeatDef[] = [
  { id: 'first_page', label: 'First Page', blurb: 'Inscribe a spell.' },
  { id: 'wordsmith', label: 'Wordsmith', blurb: 'Rename a spell.' },
  { id: 'wheel_turns', label: 'The Wheel Turns', blurb: 'Trigger all five reactions.' },
  { id: 'shatterstorm', label: 'Shatterstorm', blurb: 'Three reactions in one battle.' },
  { id: 'quiet_hands', label: 'Quiet Hands', blurb: 'Win with only Wisp casts.' },
  { id: 'patient_author', label: 'Patient Author', blurb: 'Win a battle untouched.' },
  { id: 'greedy_ink', label: 'Greedy Ink', blurb: 'Inscribe at potency 1.5.' },
  { id: 'thrift', label: 'Thrift', blurb: 'Beat a Warden with nothing above potency 1.0.' },
  { id: 'gatewright', label: 'Gatewright', blurb: 'Open every gate.' },
  { id: 'relic_road', label: 'Relic Road', blurb: 'Own all five relics.' },
  { id: 'commissioned', label: 'Commissioned', blurb: 'Complete all four commissions.' },
  { id: 'surge_rider', label: 'Surge Rider', blurb: 'Survive five severe surges.' },
  { id: 'glimmer_catcher', label: 'Glimmer Catcher', blurb: 'Catch three glimmerkin.' },
  { id: 'elite_hunter', label: 'Elite Hunter', blurb: 'Fell ten elites.' },
  { id: 'fourth_warden', label: 'Fourth Warden', blurb: 'Fell the Hollow Warden.' },
  { id: 'twice_written', label: 'Twice Written', blurb: 'Finish New Game Plus.' },
];
