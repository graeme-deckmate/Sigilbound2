/**
 * Enemy roster, transcribed from docs/03-CONTENT-DATA section 7.
 * Stats: hp = h0 + hpl * lv, atkRaw = a0 + al * lv,
 * damage = atkRaw * move.mult * variance, x0.65 if Chilled.
 * Bosses fight at a fixed level with flat hp.
 */
import type { BossId, ElementId, PlayerStatusId } from '../core/state.ts';

export type EnemySpeciesId =
  | 'gloop'
  | 'pondscale'
  | 'burrowkin'
  | 'gloomwing'
  | 'thornling'
  | 'mossback'
  | 'cindermote'
  | 'hexbinder'
  | 'ashling'
  | 'quartzling'
  | 'galeharrow'
  | 'hollowshade'
  | 'glimmerkin'
  | 'trialguardian'
  | 'cryptcrawler'
  | 'boneshade'
  | 'marshlurk'
  | 'bonelord'
  | 'circuitwarden';

export type MoveRider =
  | { type: 'playerStatus'; status: PlayerStatusId; chance: number }
  | { type: 'mpDrain'; amount: number }
  | { type: 'selfShield'; amount: number };

export interface EnemyMove {
  name: string;
  /** Damage multiplier on atkRaw; 0 for non-damaging moves. */
  mult: number;
  rider?: MoveRider;
  /** Relative pick weight, default 1. */
  weight?: number;
}

export interface EnemyDef {
  id: EnemySpeciesId;
  name: string;
  h0: number;
  hpl: number;
  a0: number;
  al: number;
  /** XP on kill = xpBase + xpPerLv * lv. */
  xpBase: number;
  xpPerLv: number;
  weak: readonly ElementId[];
  resist: readonly ElementId[];
  moves: readonly EnemyMove[];
}

/** Trial Guardians fight at a fixed level (03 section 23). */
export const TRIAL_GUARDIAN_LV = 11;

export const ENEMY_IDS: readonly EnemySpeciesId[] = [
  'gloop',
  'pondscale',
  'burrowkin',
  'gloomwing',
  'thornling',
  'mossback',
  'cindermote',
  'hexbinder',
  'ashling',
  'quartzling',
  'galeharrow',
  'hollowshade',
  'glimmerkin',
  'trialguardian',
  'cryptcrawler',
  'boneshade',
  'marshlurk',
  'bonelord',
  'circuitwarden',
];

export const ENEMIES: Record<EnemySpeciesId, EnemyDef> = {
  /* Act 1: Hearthvale (enemy Lv 1-4) */
  gloop: {
    id: 'gloop',
    name: 'Gloop',
    h0: 22,
    hpl: 8,
    a0: 5,
    al: 1.6,
    xpBase: 11,
    xpPerLv: 3,
    weak: ['ember', 'volt'],
    resist: [],
    moves: [
      { name: 'squelches forward', mult: 1.0 },
      { name: 'spits stinging ooze', mult: 0.85 },
      { name: 'wobbles, then slams', mult: 1.15 },
    ],
  },
  pondscale: {
    id: 'pondscale',
    name: 'Pondscale',
    h0: 24,
    hpl: 8,
    a0: 5,
    al: 1.7,
    xpBase: 12,
    xpPerLv: 3,
    weak: ['rime'],
    resist: ['ember'],
    moves: [
      { name: 'tongue lash', mult: 1.0 },
      { name: 'bog hop', mult: 0.9 },
      { name: 'mire croak', mult: 1.1 },
    ],
  },
  burrowkin: {
    id: 'burrowkin',
    name: 'Burrowkin',
    h0: 26,
    hpl: 9,
    a0: 6,
    al: 1.7,
    xpBase: 13,
    xpPerLv: 3,
    weak: ['ember'],
    resist: ['volt'],
    moves: [
      { name: 'claw swipe', mult: 1.0 },
      { name: 'flings dirt', mult: 0.8 },
      { name: 'undermines', mult: 1.2 },
    ],
  },

  /* Act 2a: Westwood (enemy Lv 4-7) */
  gloomwing: {
    id: 'gloomwing',
    name: 'Gloomwing',
    h0: 24,
    hpl: 7,
    a0: 6,
    al: 1.4,
    xpBase: 14,
    xpPerLv: 3,
    weak: ['rime'],
    resist: ['ember'],
    moves: [
      { name: 'hooked claws', mult: 1.0 },
      {
        name: 'numbing shriek',
        mult: 0.8,
        rider: { type: 'playerStatus', status: 'chilled', chance: 0.3 },
      },
      { name: 'dives from the dark', mult: 1.2 },
    ],
  },
  thornling: {
    id: 'thornling',
    name: 'Thornling',
    h0: 30,
    hpl: 9,
    a0: 7,
    al: 1.3,
    xpBase: 16,
    xpPerLv: 3,
    weak: ['ember'],
    resist: ['volt', 'thorn'],
    moves: [
      { name: 'bramble lash', mult: 1.0 },
      {
        name: 'needle seeds',
        mult: 0.85,
        rider: { type: 'playerStatus', status: 'envenomed', chance: 0.3 },
      },
      { name: 'root surge', mult: 1.2 },
    ],
  },
  mossback: {
    id: 'mossback',
    name: 'Mossback',
    h0: 36,
    hpl: 11,
    a0: 6,
    al: 1.4,
    xpBase: 18,
    xpPerLv: 3,
    weak: ['volt'],
    resist: ['ember', 'rime'],
    moves: [
      { name: 'shell ram', mult: 1.0 },
      { name: 'hardens', mult: 0, rider: { type: 'selfShield', amount: 16 } },
      {
        name: 'moss spores',
        mult: 0.8,
        rider: { type: 'playerStatus', status: 'withered', chance: 0.3 },
      },
    ],
  },

  /* Act 2b: Ashen Reach (enemy Lv 5-8) */
  cindermote: {
    id: 'cindermote',
    name: 'Cindermote',
    h0: 28,
    hpl: 10,
    a0: 4.5,
    al: 1.4,
    xpBase: 16,
    xpPerLv: 3,
    weak: ['rime'],
    resist: ['ember'],
    moves: [
      { name: 'spark snap', mult: 1.0 },
      {
        name: 'flare',
        mult: 0.85,
        rider: { type: 'playerStatus', status: 'burning', chance: 0.35 },
      },
      { name: 'popping burst', mult: 1.25 },
    ],
  },
  hexbinder: {
    id: 'hexbinder',
    name: 'Hexbinder',
    h0: 28,
    hpl: 9,
    a0: 6,
    al: 1.4,
    xpBase: 18,
    xpPerLv: 3,
    weak: ['volt', 'gloom'],
    resist: ['rime'],
    moves: [
      { name: 'binding sigil', mult: 0.9, rider: { type: 'mpDrain', amount: 6 } },
      {
        name: 'muttered curse',
        mult: 0.8,
        rider: { type: 'playerStatus', status: 'withered', chance: 0.35 },
      },
      { name: 'staff strike', mult: 1.0 },
    ],
  },
  ashling: {
    id: 'ashling',
    name: 'Ashling',
    h0: 28,
    hpl: 9,
    a0: 5,
    al: 1.2,
    xpBase: 17,
    xpPerLv: 3,
    weak: ['rime'],
    resist: ['ember', 'thorn'],
    moves: [
      { name: 'cinder swipe', mult: 1.0 },
      {
        name: 'smolders',
        mult: 0.85,
        rider: { type: 'playerStatus', status: 'burning', chance: 0.3 },
      },
      { name: 'ash veil', mult: 0, rider: { type: 'selfShield', amount: 12 } },
    ],
  },

  /* Rare roll bonus creature (v1.1, 03 section 13): never attacks,
     flees at the end of round 2; the reducer drives that behavior. */
  glimmerkin: {
    id: 'glimmerkin',
    name: 'Glimmerkin',
    h0: 14,
    hpl: 4,
    a0: 0,
    al: 0,
    xpBase: 30,
    xpPerLv: 6,
    weak: [],
    resist: [],
    moves: [{ name: 'glimmers softly', mult: 0 }],
  },

  /* Act 4 trial stones (03 section 23): flat-statted, fixed level,
     permanently Sealed until the named reaction lands. */
  trialguardian: {
    id: 'trialguardian',
    name: 'Trial Guardian',
    h0: 120,
    hpl: 0,
    a0: 8,
    al: 1.3,
    xpBase: 80,
    xpPerLv: 0,
    weak: [],
    resist: [],
    moves: [
      { name: 'stone fist', mult: 1.0 },
      { name: 'graven stare', mult: 0.85 },
      { name: 'judgment knell', mult: 1.2 },
    ],
  },

  /* Act 3: North Hollow (enemy Lv 8-12) */
  quartzling: {
    id: 'quartzling',
    name: 'Quartzling',
    h0: 34,
    hpl: 8,
    a0: 5,
    al: 1.25,
    xpBase: 20,
    xpPerLv: 4,
    weak: ['volt'],
    resist: ['rime', 'ember'],
    moves: [
      { name: 'crystal claw', mult: 1.0 },
      { name: 'shard volley', mult: 0.9 },
      { name: 'refracted beam', mult: 1.25 },
    ],
  },
  galeharrow: {
    id: 'galeharrow',
    name: 'Galeharrow',
    h0: 30,
    hpl: 5,
    a0: 3.75,
    al: 1.05,
    xpBase: 21,
    xpPerLv: 4,
    weak: ['thorn'],
    resist: ['volt'],
    moves: [
      { name: 'talon dive', mult: 1.1 },
      {
        name: 'tailwind shriek',
        mult: 0.8,
        rider: { type: 'playerStatus', status: 'chilled', chance: 0.15 },
      },
      { name: 'gale rake', mult: 1.0 },
    ],
  },
  hollowshade: {
    id: 'hollowshade',
    name: 'Hollowshade',
    h0: 32,
    hpl: 6,
    a0: 4,
    al: 1.1,
    xpBase: 22,
    xpPerLv: 4,
    weak: ['gloom'],
    resist: ['thorn', 'rime'],
    moves: [
      { name: 'rending grasp', mult: 1.0 },
      { name: 'soul leech', mult: 0.8, rider: { type: 'mpDrain', amount: 5 } },
      {
        name: 'gloom lash',
        mult: 1.15,
        rider: { type: 'playerStatus', status: 'withered', chance: 0.15 },
      },
    ],
  },

  /* v2 W4: dungeon and overworld additions (off the balance-sim critical path) */
  cryptcrawler: {
    id: 'cryptcrawler',
    name: 'Cryptcrawler',
    h0: 30,
    hpl: 9,
    a0: 7,
    al: 1.6,
    xpBase: 16,
    xpPerLv: 3,
    weak: ['ember'],
    resist: ['gloom'],
    moves: [
      { name: 'skitters close', mult: 1.0 },
      {
        name: 'venom nip',
        mult: 0.85,
        rider: { type: 'playerStatus', status: 'envenomed', chance: 0.2 },
      },
      { name: 'shell slam', mult: 1.2 },
    ],
  },
  boneshade: {
    id: 'boneshade',
    name: 'Boneshade',
    h0: 28,
    hpl: 8,
    a0: 7,
    al: 1.5,
    xpBase: 17,
    xpPerLv: 3,
    weak: ['ember', 'volt'],
    resist: ['rime'],
    moves: [
      { name: 'rattling claw', mult: 1.0 },
      {
        name: 'grave chill',
        mult: 0.85,
        rider: { type: 'playerStatus', status: 'chilled', chance: 0.2 },
      },
      { name: 'marrow shriek', mult: 1.15 },
    ],
  },
  marshlurk: {
    id: 'marshlurk',
    name: 'Marshlurk',
    h0: 26,
    hpl: 8,
    a0: 6,
    al: 1.6,
    xpBase: 14,
    xpPerLv: 3,
    weak: ['volt'],
    resist: ['ember'],
    moves: [
      { name: 'lunges from the reeds', mult: 1.0 },
      { name: 'silt spray', mult: 0.85 },
      { name: 'drag under', mult: 1.2, rider: { type: 'mpDrain', amount: 3 } },
    ],
  },

  /* v2 W5: boss-like dungeon objectives (single tough foe, regular battle path) */
  bonelord: {
    id: 'bonelord',
    name: 'The Bonelord',
    h0: 90,
    hpl: 6,
    a0: 9,
    al: 1.4,
    xpBase: 40,
    xpPerLv: 5,
    weak: ['ember'],
    resist: ['gloom', 'rime'],
    moves: [
      { name: 'grave cleaver', mult: 1.0 },
      {
        name: 'wave of rot',
        mult: 0.9,
        rider: { type: 'playerStatus', status: 'envenomed', chance: 0.35 },
      },
      { name: 'crushing toll', mult: 1.3 },
    ],
  },
  circuitwarden: {
    id: 'circuitwarden',
    name: 'The Circuit Warden',
    h0: 110,
    hpl: 6,
    a0: 10,
    al: 1.3,
    xpBase: 50,
    xpPerLv: 5,
    weak: ['rime'],
    resist: ['volt', 'ember'],
    moves: [
      { name: 'arc lash', mult: 1.0 },
      { name: 'overload', mult: 0.9, rider: { type: 'mpDrain', amount: 6 } },
      { name: 'thunderfall', mult: 1.35 },
    ],
  },
};

/* ---------- Bosses ---------- */

export type BarKey = 'choir' | 'wheel' | 'author';

export type BossSpecial =
  | {
      /** Hollow Warden (03 section 23): three shape-keyed HP bars. */
      kind: 'bars';
      barHp: number;
      barKeys: readonly BarKey[];
      offKeyMult: number;
      summonSpecies: EnemySpeciesId;
      summonLv: number;
      unwriteEvery: number;
      unwriteMult: number;
      unwriteName: string;
    }
  | {
      /** Bogmaw: every Nth turn submerge (telegraphed). While submerged
       *  only volt hits, at voltMult, and a volt hit cancels the breach
       *  and Stuns. If not interrupted, next turn: Crashing Breach. */
      kind: 'submerge';
      every: number;
      voltMult: number;
      breachName: string;
      breachMult: number;
    }
  | {
      /** Thornveil: summons adds at an HP fraction; recasts its own
       *  shield every Nth turn. */
      kind: 'summonAndVeil';
      summonAtHpFrac: number;
      summonSpecies: EnemySpeciesId;
      summonCount: number;
      summonLv: number;
      veilName: string;
      veilEvery: number;
      veilShield: number;
    }
  | {
      /** Ashen Warden: below the HP fraction, damage scales up
       *  (announced) and the named move is weighted up. */
      kind: 'enrage';
      belowHpFrac: number;
      dmgMult: number;
      weightedMove: string;
      enragedWeightMult: number;
    }
  | {
      /** Vale Wraith: attunement phases, adds, and the Doom telegraph. */
      kind: 'attune';
      attunedMult: number;
      otherMult: number;
      shiftEveryPhase1: number;
      shiftEveryPhase2: number;
      phase2AtHpFrac: number;
      phase3AtHpFrac: number;
      summonSpecies: EnemySpeciesId;
      summonCount: number;
      summonLv: number;
      doomName: string;
      doomMult: number;
    };

export interface BossDef {
  id: BossId;
  name: string;
  lv: number;
  hp: number;
  a0: number;
  al: number;
  xp: number;
  weak: readonly ElementId[];
  resist: readonly ElementId[];
  moves: readonly EnemyMove[];
  /** Battle log intro line (03 section 10). */
  intro: string;
  /** Victory toast for the freed Warden's Grand Sigil; absent for the finale. */
  sigilToast?: string;
  special: BossSpecial;
}

export const BOSS_IDS: readonly BossId[] = [
  'bogmaw',
  'thornveil',
  'ashenwarden',
  'valewraith',
  'hollowwarden',
];

export const BOSSES: Record<BossId, BossDef> = {
  bogmaw: {
    id: 'bogmaw',
    name: 'Bogmaw',
    lv: 4,
    hp: 150,
    a0: 9,
    al: 2.0,
    xp: 60,
    weak: ['ember', 'thorn'],
    resist: [],
    moves: [
      { name: 'maw crush', mult: 1.1 },
      { name: 'mire wave', mult: 0.85 },
    ],
    intro: 'The marsh heaves. Bogmaw surfaces!',
    sigilToast: 'The Marsh Warden is freed. Grand Sigil claimed.',
    special: {
      kind: 'submerge',
      every: 3,
      voltMult: 2.0,
      breachName: 'Crashing Breach',
      breachMult: 1.6,
    },
  },
  thornveil: {
    id: 'thornveil',
    name: 'Thornveil Warden',
    lv: 6,
    hp: 165,
    a0: 9,
    al: 1.4,
    xp: 110,
    weak: ['ember'],
    resist: ['thorn', 'volt'],
    moves: [
      { name: "warden's lash", mult: 1.1 },
      {
        name: 'thorn volley',
        mult: 0.8,
        rider: { type: 'playerStatus', status: 'envenomed', chance: 0.35 },
      },
    ],
    intro: 'The grove knots itself into a Warden!',
    sigilToast: 'The Wood Warden is freed. Grand Sigil claimed.',
    special: {
      kind: 'summonAndVeil',
      summonAtHpFrac: 0.6,
      summonSpecies: 'thornling',
      summonCount: 2,
      summonLv: 3,
      veilName: 'Bramble Veil',
      veilEvery: 4,
      veilShield: 30,
    },
  },
  ashenwarden: {
    id: 'ashenwarden',
    name: 'Ashen Warden',
    lv: 8,
    hp: 215,
    a0: 8,
    al: 1.5,
    xp: 130,
    weak: ['rime'],
    resist: ['ember'],
    moves: [
      {
        name: "warden's brand",
        mult: 0.9,
        rider: { type: 'playerStatus', status: 'burning', chance: 0.5 },
      },
      { name: 'pyre sweep', mult: 1.15 },
      { name: 'collapsing pillar', mult: 1.3 },
    ],
    intro: 'The ash takes a burning shape!',
    sigilToast: 'The Ash Warden is freed. Grand Sigil claimed.',
    special: {
      kind: 'enrage',
      belowHpFrac: 0.3,
      dmgMult: 1.4,
      weightedMove: 'collapsing pillar',
      // 03 says "weighted up while enraged" without a value; x2 pending
      // an answer in PROGRESS.md. Tunable data, not formula.
      enragedWeightMult: 2,
    },
  },
  valewraith: {
    id: 'valewraith',
    name: 'Vale Wraith',
    lv: 11,
    hp: 300,
    a0: 13,
    al: 0.85,
    xp: 0,
    weak: [],
    resist: [],
    moves: [
      { name: 'reaps with a crescent of shadow', mult: 1.15 },
      { name: 'siphons your spirit', mult: 0.7, rider: { type: 'mpDrain', amount: 5 } },
      { name: 'howls the cold of the Vale', mult: 1.35 },
    ],
    intro: 'The Vale Wraith rises from the Hollow!',
    special: {
      kind: 'attune',
      attunedMult: 1.8,
      otherMult: 0.85,
      shiftEveryPhase1: 2,
      shiftEveryPhase2: 1,
      phase2AtHpFrac: 0.5,
      phase3AtHpFrac: 0.2,
      summonSpecies: 'hollowshade',
      summonCount: 2,
      summonLv: 8,
      doomName: 'Doom of the Vale',
      doomMult: 2.6,
    },
  },
  hollowwarden: {
    id: 'hollowwarden',
    name: 'Hollow Warden',
    lv: 13,
    hp: 420, // three bars of 140 (03 section 23)
    a0: 12,
    al: 1.4,
    xp: 0,
    weak: [],
    resist: [],
    moves: [
      { name: 'hollow rend', mult: 1.1 },
      { name: 'unmaking sigh', mult: 0.8, rider: { type: 'mpDrain', amount: 6 } },
      {
        name: 'the vale forgets',
        mult: 1.3,
        rider: { type: 'playerStatus', status: 'withered', chance: 0.35 },
      },
    ],
    intro: 'The Hollow Warden unfolds. Its script is older than the Vale.',
    sigilToast: '',
    special: {
      kind: 'bars',
      barHp: 140,
      barKeys: ['choir', 'wheel', 'author'],
      offKeyMult: 0.25,
      summonSpecies: 'hollowshade',
      summonLv: 11,
      unwriteEvery: 4,
      unwriteMult: 2.2,
      unwriteName: 'Unwriting',
    },
  },
};
