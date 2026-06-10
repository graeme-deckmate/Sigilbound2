/**
 * Battle resolution: a pure reducer (docs/01). One reduce() call takes
 * the player's action, then runs every living enemy's turn, then ticks
 * player DoTs and returns to the player phase (or ends the battle).
 * Scenes animate the emitted events; the balance sim ignores them.
 * All randomness comes from the injected Rng.
 */
import type { Rng } from '../core/rng.ts';
import { randInt } from '../core/rng.ts';
import type {
  BossId,
  ElementId,
  EnemyStatusId,
  GameState,
  PlayerStatusId,
  Spell,
} from '../core/state.ts';
import { COMBAT } from '../data/constants.ts';
import { FAMILIAR } from '../data/forms.ts';
import { ELEMENTS } from '../data/elements.ts';
import { RUNES } from '../data/runes.ts';
import { BOSSES, ENEMIES, type EnemyMove, type EnemySpeciesId } from '../data/enemies.ts';
import { ENEMY_STATUSES, PLAYER_STATUSES } from '../data/statuses.ts';
import { AFFIXES, AFFIX_IDS, ELITE, GLIMMERKIN, type AffixId } from '../data/elites.ts';
import { ESSENCE, defeatDrop } from '../data/essence.ts';
import { CHARM, SCROLL } from '../data/discovery.ts';
import {
  ASPECT,
  DEPTH_NO_SHIELD_TURNS,
  MASTERY,
  masteryTier,
  NIGHT_WITHER_TAKEN,
  REACTION,
  REACTIONS,
  STATIC_SHATTER_BONUS,
  STEAM_NEXT_MOVE_MULT,
  STORM_ARC_FRAC,
  SURGE,
  SURGE_PAIR_MP,
  SURGE_TABLE,
  TWIN,
  twinPair,
  type ReactionId,
  type SurgeDef,
  type TwinRider,
} from '../data/wheel.ts';
import type { ZoneId } from '../data/formations.ts';
import {
  GRACE_AFTER_BATTLE,
  GRACE_AFTER_DEFEAT,
  FOCUS_HP_FRAC,
  FOCUS_MP_FRAC,
  FLEE_CHANCE,
  NG_PLUS,
} from '../data/progression.ts';
import {
  castSurges,
  critProfile,
  elementMult,
  spellCost,
  spellHits,
  displayName,
  spellPower,
  spellProc,
  spellTargeting,
  twinElementMult,
  veilRiderProc,
  veilShield,
  type CastMods,
} from './spellcraft.ts';
import { applyXp } from './leveling.ts';
import { weightedPick } from './encounters.ts';

/* ---------- state ---------- */

export interface VeilState {
  spell: Spell;
  shield: number;
  /** Total damage absorbed by this veil instance (thirst heal basis). */
  absorbed: number;
  /** Echo: the shield re-applies once after breaking. */
  reapplied: boolean;
}

export interface BattlePlayer {
  lv: number;
  hp: number;
  mp: number;
  maxhp: number;
  maxmp: number;
  spells: (Spell | null)[];
  /** Mastery points per element, snapshotted at battle start (v1.1). */
  mastery: Record<ElementId, number>;
  /** Equipped charm ids, snapshotted at battle start (Phase 13). */
  charms: string[];
  /** Carried scrolls; casting consumes one (Phase 13). */
  scrolls: Spell[];
  /** Ordered: Focus cleanses the oldest first. No durations (PROGRESS). */
  statuses: PlayerStatusId[];
  veil: VeilState | null;
}

export interface BattleEnemy {
  index: number;
  kind: 'minion' | 'boss';
  /** Species id, or the boss id for kind 'boss'. */
  species: EnemySpeciesId | BossId;
  /** "Gloop", or "Gloop A" when the formation repeats a species. */
  displayName: string;
  lv: number;
  hp: number;
  maxhp: number;
  /** Self shield from moves like hardens; absorbs before HP. */
  shield: number;
  statuses: Partial<Record<EnemyStatusId, number>>;
  /** Turns of stun immunity after a stun expires (docs/02). */
  stunImmunity: number;
  /** Elite promotion affix (v1.1, 03 section 13). */
  affix?: AffixId;
  /** Sealed elites take 0 damage until the seal breaks. */
  sealed?: boolean;
  /** Frenzy announced (one-shot log line). */
  frenzied?: boolean;
  /** Glimmerkin: never attacks, flees at the end of round 2. */
  glimmer?: boolean;
  /** Fled the battle (no XP, no essence). hp is 0 but it did not fall. */
  escaped?: boolean;
  /** Trial guardian: only this reaction breaks the seal (03 s23). */
  trialKey?: ReactionId;
  /** Twin riders (03 section 15). */
  steamed?: boolean;
  mired?: boolean;
  noShieldTurns?: number;
  witherAmp?: boolean;
  rotDots?: boolean;
}

/** Unified combat numbers for minions and bosses. */
interface CombatDef {
  a0: number;
  al: number;
  weak: readonly ElementId[];
  resist: readonly ElementId[];
  moves: readonly EnemyMove[];
  xpFor: (lv: number) => number;
}

function defOf(enemy: BattleEnemy): CombatDef {
  if (enemy.kind === 'boss') {
    const b = BOSSES[enemy.species as BossId];
    return {
      a0: b.a0,
      al: b.al,
      weak: b.weak,
      resist: b.resist,
      moves: b.moves,
      xpFor: () => b.xp,
    };
  }
  const d = ENEMIES[enemy.species as EnemySpeciesId];
  return {
    a0: d.a0,
    al: d.al,
    weak: d.weak,
    resist: d.resist,
    moves: d.moves,
    xpFor: (lv) => d.xpBase + d.xpPerLv * lv,
  };
}

export type BattlePhase = 'player' | 'victory' | 'defeat' | 'fled';

/** Per-boss battle machines (docs/03 section 7). */
export type BossBattleState =
  | {
      /** Bogmaw: dive cycle. Turns count acted turns only. */
      kind: 'submerge';
      turns: number;
      submerged: boolean;
      breachArmed: boolean;
    }
  | {
      /** Thornveil: one summon wave + a recurring self shield. */
      kind: 'summonVeil';
      turns: number;
      summoned: boolean;
    }
  | {
      /** Ashen Warden: announced damage ramp below the threshold. */
      kind: 'enrage';
      enraged: boolean;
    }
  | {
      /** Hollow Warden: three shape-keyed bars (03 section 23). */
      kind: 'bars';
      turns: number;
      unwriteArmed: boolean;
      barBrokeSinceArmed: boolean;
    }
  | {
      /** Vale Wraith: shifting attunement, adds, and the Doom cycle. */
      kind: 'attune';
      element: ElementId | null;
      shiftIn: number;
      stage: 1 | 2 | 3;
      summoned: boolean;
      doomArmed: boolean;
    };

export interface BattleState {
  phase: BattlePhase;
  round: number;
  boss: boolean;
  bossId?: BossId;
  bossState?: BossBattleState;
  zone: ZoneId | null;
  /** Vale Aspect, snapshotted at battle start (03 section 25). */
  aspect: ElementId | null;
  /** Elements that landed at least one hit (mastery ticks on victory). */
  elementsHit: Partial<Record<ElementId, boolean>>;
  /** Feat + bestiary tracking (Phase 13). */
  reactionsFired: ReactionId[];
  formsCast: string[];
  playerTookHit: boolean;
  severeSurges: number;
  /** Per-species discovery captured this battle. */
  seen: Record<string, { weak: ElementId[]; statuses: string[]; reactions: string[] }>;
  /** NG+ cycle active: enemies x1.5 hp/atk, essence x2 (03 s25). */
  ng: boolean;
  /** Summoned familiar (Call form, 03 section 22). Battle-scoped. */
  familiar: { spell: Spell; hp: number; maxhp: number } | null;
  player: BattlePlayer;
  enemies: BattleEnemy[];
}

export type BattleAction =
  | { type: 'cast'; slot: number; target?: number }
  | { type: 'scroll'; index: number; target?: number }
  | { type: 'focus' }
  | { type: 'flee' };

/* ---------- events ---------- */

/**
 * Compact view of the battle the moment an event happened. Scenes
 * render bars and status icons from this, so the UI changes step by
 * step with the playback instead of jumping to the end-of-round state.
 */
export interface UiSnapshot {
  player: {
    hp: number;
    mp: number;
    shield: number;
    statuses: PlayerStatusId[];
  };
  enemies: {
    index: number;
    hp: number;
    maxhp: number;
    shield: number;
    statuses: Partial<Record<EnemyStatusId, number>>;
  }[];
}

export function snapshotOf(state: BattleState): UiSnapshot {
  return {
    player: {
      hp: state.player.hp,
      mp: state.player.mp,
      shield: state.player.veil?.shield ?? 0,
      statuses: [...state.player.statuses],
    },
    enemies: state.enemies.map((e) => ({
      index: e.index,
      hp: e.hp,
      maxhp: e.maxhp,
      shield: e.shield,
      statuses: { ...e.statuses },
    })),
  };
}

export type BattleEventBody =
  | { kind: 'intro'; names: string[] }
  | { kind: 'playerCast'; spell: Spell; name: string; element: ElementId; targets: number[] }
  | {
      kind: 'enemyHit';
      index: number;
      amount: number;
      crit: boolean;
      mult: number;
      hpAfter: number;
      shieldAfter: number;
    }
  | { kind: 'enemyStatus'; index: number; status: EnemyStatusId }
  | { kind: 'enemyDot'; index: number; status: EnemyStatusId; amount: number; hpAfter: number }
  | { kind: 'enemyDown'; index: number }
  | { kind: 'enemySkip'; index: number }
  | { kind: 'enemyMove'; index: number; move: string }
  | { kind: 'enemyShield'; index: number; amount: number }
  | { kind: 'playerHit'; amount: number; absorbed: number; hpAfter: number; chilled: boolean }
  | { kind: 'playerStatus'; status: PlayerStatusId }
  | { kind: 'playerDot'; status: PlayerStatusId; amount: number; hpAfter: number }
  | { kind: 'playerCleanse'; status: PlayerStatusId }
  | { kind: 'playerHeal'; amount: number; hpAfter: number }
  | { kind: 'mpDrain'; amount: number; mpAfter: number }
  | { kind: 'focus'; mp: number; hp: number }
  | { kind: 'veilUp'; amount: number }
  | { kind: 'veilBreak' }
  | { kind: 'veilReapply'; amount: number }
  | { kind: 'fleeFail' }
  | { kind: 'fled' }
  | { kind: 'ambush' }
  | { kind: 'reaction'; reaction: ReactionId; index: number; amount?: number; hpAfter: number }
  | { kind: 'surge'; roll: number; id: SurgeDef['id']; severity: SurgeDef['severity'] }
  | { kind: 'sealedHit'; index: number; key: ElementId | null; demand?: ReactionId }
  | { kind: 'familiarSummon'; element: ElementId; hp: number }
  | { kind: 'familiarAct'; element: ElementId }
  | { kind: 'familiarHit'; amount: number; hpAfter: number }
  | { kind: 'familiarFade'; reason: 'replaced' | 'fallen' }
  | { kind: 'barBreak'; index: number; nextKey: 'choir' | 'wheel' | 'author' }
  | { kind: 'sealBreak'; index: number }
  | { kind: 'frenzy'; index: number }
  | { kind: 'glimmerFlee'; index: number }
  | { kind: 'victory'; xp: number }
  | { kind: 'defeat' }
  | { kind: 'bossIntro'; text: string }
  | { kind: 'bossSubmerge'; index: number }
  | { kind: 'bossSurface'; index: number; reason: 'shocked' | 'breach' }
  | { kind: 'bossSummon'; index: number; spawned: { index: number; name: string }[] }
  | { kind: 'bossEnrage'; index: number }
  | { kind: 'bossAttune'; index: number; element: ElementId; first: boolean }
  | { kind: 'bossDoom'; index: number; name: string }
  | {
      kind: 'bossUnwrite';
      index: number;
      phase: 'arm' | 'cancel';
      reason?: 'veil' | 'chill' | 'bar';
    }
  | { kind: 'miss'; index: number };

/** Every emitted event carries the post-event snapshot for the UI. */
export type BattleEvent = BattleEventBody & { ui: UiSnapshot };

type Emit = (body: BattleEventBody) => void;

export interface ReduceResult {
  state: BattleState;
  events: BattleEvent[];
}

/* ---------- setup ---------- */

export interface BattleVariance {
  /** Enemies act first in round 1 ("You are set upon!"). */
  ambush?: boolean;
  /** Per-member elite affixes from the encounter roll. */
  elites?: (AffixId | null)[];
  /** Glimmerkin bonus encounter. */
  glimmer?: boolean;
  /** Trial stone: the guardian is Sealed until this reaction (03 s23). */
  trialKey?: ReactionId;
}

export function initBattle(
  gs: GameState,
  members: readonly EnemySpeciesId[],
  enemyLv: number,
  zone: ZoneId | null,
  variance?: BattleVariance,
  rng?: Rng,
): ReduceResult {
  const counts = new Map<EnemySpeciesId, number>();
  for (const m of members) counts.set(m, (counts.get(m) ?? 0) + 1);
  const seen = new Map<EnemySpeciesId, number>();
  const enemies = members.map((species, index) => {
    const def = ENEMIES[species];
    const dupes = (counts.get(species) ?? 0) > 1;
    const nth = seen.get(species) ?? 0;
    seen.set(species, nth + 1);
    const suffix = dupes ? ` ${String.fromCharCode(65 + nth)}` : '';
    const affix = variance?.elites?.[index] ?? null;
    const isGlimmer = variance?.glimmer === true && species === 'glimmerkin';
    const ngHp = gs.player.ngPlus > 0 ? NG_PLUS.hpMult : 1;
    const maxhp = Math.round(
      (isGlimmer ? GLIMMERKIN.h0 + GLIMMERKIN.hpl * enemyLv : def.h0 + def.hpl * enemyLv) * ngHp,
    );
    const enemy: BattleEnemy = {
      index,
      kind: 'minion',
      species,
      displayName: affix ? `${AFFIXES[affix].prefix} ${def.name}${suffix}` : `${def.name}${suffix}`,
      lv: enemyLv,
      hp: maxhp,
      maxhp,
      shield: 0,
      statuses: {},
      stunImmunity: 0,
    };
    if (affix) {
      enemy.affix = affix;
      if (affix === 'veiled') {
        enemy.shield = ELITE.veiledShieldBase + ELITE.veiledShieldPerLv * enemyLv;
      }
      if (affix === 'sealed') enemy.sealed = true;
    }
    if (isGlimmer) enemy.glimmer = true;
    if (variance?.trialKey && species === 'trialguardian') {
      enemy.sealed = true;
      enemy.trialKey = variance.trialKey;
    }
    return enemy;
  });
  const state: BattleState = {
    phase: 'player',
    round: 1,
    boss: false,
    zone,
    aspect: gs.world.aspect,
    elementsHit: {},
    reactionsFired: [],
    formsCast: [],
    playerTookHit: false,
    severeSurges: 0,
    seen: {},
    ng: gs.player.ngPlus > 0,
    familiar: null,
    player: {
      lv: gs.player.lv,
      hp: gs.player.hp,
      mp: gs.player.mp,
      maxhp: gs.player.maxhp,
      maxmp: gs.player.maxmp,
      spells: gs.player.spells.map((s) => (s ? { ...s } : null)),
      mastery: { ...gs.player.mastery },
      charms: gs.player.charms.equipped.filter((c): c is string => c !== null),
      scrolls: gs.player.scrolls.map((sc) => ({ ...sc })),
      statuses: [],
      veil: emberknotVeil(gs),
    },
    enemies,
  };
  const events: BattleEvent[] = [
    { kind: 'intro', names: enemies.map((e) => e.displayName), ui: snapshotOf(state) },
  ];
  // Ambush: the pack acts before the player's first turn (03 section 13).
  if (variance?.ambush && rng) {
    const emit: Emit = (body) => {
      events.push({ ...body, ui: snapshotOf(state) });
    };
    emit({ kind: 'ambush' });
    enemyPhase(state, emit, rng);
  }
  return { state, events };
}

/** Rematch adds, one elite per (03 section 16): a fitting local add. */
const REMATCH_ADDS: Record<BossId, { species: EnemySpeciesId; count: number }> = {
  bogmaw: { species: 'pondscale', count: 1 },
  thornveil: { species: 'thornling', count: 1 },
  ashenwarden: { species: 'ashling', count: 1 },
  valewraith: { species: 'hollowshade', count: 2 },
  hollowwarden: { species: 'hollowshade', count: 2 },
};

/** Boss battles: flat hp, fixed level, special state machine (docs/03). */
export function initBossBattle(
  gs: GameState,
  bossId: BossId,
  zone: ZoneId | null,
  rematch?: { lvBonus: number; rng: Rng },
): ReduceResult {
  const def = BOSSES[bossId];
  const ng = gs.player.ngPlus > 0;
  const ngHp = ng ? NG_PLUS.hpMult : 1;
  // The Hollow Warden fights two levels up in NG+ (03 section 25).
  const lvBonus =
    (rematch?.lvBonus ?? 0) + (ng && bossId === 'hollowwarden' ? NG_PLUS.wardenLvBonus : 0);
  const enemy: BattleEnemy = {
    index: 0,
    kind: 'boss',
    species: bossId,
    displayName: def.name,
    lv: def.lv + lvBonus,
    hp: Math.round(def.hp * ngHp),
    maxhp: Math.round(def.hp * ngHp),
    shield: 0,
    statuses: {},
    stunImmunity: 0,
  };
  let bossState: BossBattleState | undefined;
  switch (def.special.kind) {
    case 'submerge':
      bossState = { kind: 'submerge', turns: 0, submerged: false, breachArmed: false };
      break;
    case 'summonAndVeil':
      bossState = { kind: 'summonVeil', turns: 0, summoned: false };
      break;
    case 'enrage':
      bossState = { kind: 'enrage', enraged: false };
      break;
    case 'bars':
      bossState = { kind: 'bars', turns: 0, unwriteArmed: false, barBrokeSinceArmed: false };
      break;
    case 'attune':
      bossState = {
        kind: 'attune',
        element: null,
        shiftIn: 0,
        stage: 1,
        summoned: false,
        doomArmed: false,
      };
      break;
  }
  const state: BattleState = {
    phase: 'player',
    round: 1,
    boss: true,
    bossId,
    bossState,
    zone,
    aspect: gs.world.aspect,
    elementsHit: {},
    reactionsFired: [],
    formsCast: [],
    playerTookHit: false,
    severeSurges: 0,
    seen: {},
    ng,
    familiar: null,
    player: {
      lv: gs.player.lv,
      hp: gs.player.hp,
      mp: gs.player.mp,
      maxhp: gs.player.maxhp,
      maxmp: gs.player.maxmp,
      spells: gs.player.spells.map((s) => (s ? { ...s } : null)),
      mastery: { ...gs.player.mastery },
      charms: gs.player.charms.equipped.filter((c): c is string => c !== null),
      scrolls: gs.player.scrolls.map((sc) => ({ ...sc })),
      statuses: [],
      veil: emberknotVeil(gs),
    },
    enemies: [enemy],
  };
  // Rematches field elite adds beside the boss (03 section 16).
  if (rematch) {
    const add = REMATCH_ADDS[bossId];
    const addDef = ENEMIES[add.species];
    for (let i = 0; i < add.count; i++) {
      const index = state.enemies.length;
      const lv = def.lv + lvBonus - 2;
      const maxhp = Math.round((addDef.h0 + addDef.hpl * lv) * ngHp);
      const affix = AFFIX_IDS[
        Math.min(AFFIX_IDS.length - 1, Math.floor(rematch.rng() * AFFIX_IDS.length))
      ] as AffixId;
      const elite: BattleEnemy = {
        index,
        kind: 'minion',
        species: add.species,
        displayName: `${AFFIXES[affix].prefix} ${addDef.name}`,
        lv,
        hp: maxhp,
        maxhp,
        shield: affix === 'veiled' ? ELITE.veiledShieldBase + ELITE.veiledShieldPerLv * lv : 0,
        statuses: {},
        stunImmunity: 0,
        affix,
      };
      if (affix === 'sealed') elite.sealed = true;
      state.enemies.push(elite);
    }
  }
  return { state, events: [{ kind: 'bossIntro', text: def.intro, ui: snapshotOf(state) }] };
}

/* ---------- helpers ---------- */

function variance(rng: Rng, spell?: Spell): number {
  // Stillwater relic: no low rolls (variance floor 1.0).
  const min = spell ? (RUNES[spell.rune].varianceMin ?? COMBAT.varianceMin) : COMBAT.varianceMin;
  return min + rng() * (COMBAT.varianceMax - min);
}

function seenRow(
  state: BattleState,
  species: string,
): { weak: ElementId[]; statuses: string[]; reactions: string[] } {
  let row = state.seen[species];
  if (!row) {
    row = { weak: [], statuses: [], reactions: [] };
    state.seen[species] = row;
  }
  return row;
}

function hasCharm(player: BattlePlayer, charm: string): boolean {
  return player.charms.includes(charm);
}

/** Emberknot charm: battles start with a 10-point shield (Phase 13). */
function emberknotVeil(gs: GameState): VeilState | null {
  if (!gs.player.charms.equipped.includes('emberknot')) return null;
  return {
    spell: { element: 'ember', form: 'veil', rune: 'none', p: 1 },
    shield: CHARM.emberknotShield,
    absorbed: 0,
    reapplied: true, // a knot, not an echo: it never re-forms
  };
}

function aliveEnemies(state: BattleState): BattleEnemy[] {
  return state.enemies.filter((e) => e.hp > 0);
}

/** Apply a status to an enemy, honoring stun rules. Returns applied. */
function applyEnemyStatus(enemy: BattleEnemy, status: EnemyStatusId): boolean {
  if (status === 'stunned') {
    if ((enemy.statuses.stunned ?? 0) > 0 || enemy.stunImmunity > 0) return false;
  }
  enemy.statuses[status] = ENEMY_STATUSES[status].duration;
  return true;
}

function applyPlayerStatus(player: BattlePlayer, status: PlayerStatusId): boolean {
  if (player.statuses.includes(status)) return false;
  player.statuses.push(status);
  return true;
}

function enemyWitheredMult(enemy: BattleEnemy): number {
  if ((enemy.statuses.withered ?? 0) > 0 && enemy.witherAmp) return NIGHT_WITHER_TAKEN;
  return (enemy.statuses.withered ?? 0) > 0 ? (ENEMY_STATUSES.withered.takenMult ?? 1) : 1;
}

/* ---------- reducer ---------- */

export function reduce(prev: BattleState, action: BattleAction, rng: Rng): ReduceResult {
  if (prev.phase !== 'player') {
    throw new Error(`reduce: battle is over (${prev.phase})`);
  }
  const state = structuredClone(prev);
  const events: BattleEvent[] = [];
  const emit: Emit = (body) => {
    events.push({ ...body, ui: snapshotOf(state) });
  };

  const endsRound = applyPlayerAction(state, action, emit, rng);
  if (state.phase !== 'player') return { state, events };
  if (!endsRound) return { state, events };

  familiarPhase(state, emit, rng);
  if (state.phase !== 'player') return { state, events };

  enemyPhase(state, emit, rng);
  if (state.phase !== 'player') return { state, events };

  playerDotPhase(state, emit);
  if (state.phase !== 'player') return { state, events };

  state.round += 1;
  return { state, events };
}

/** Returns true when the action consumes the turn (enemies respond). */
function applyPlayerAction(
  state: BattleState,
  action: BattleAction,
  emit: Emit,
  rng: Rng,
): boolean {
  switch (action.type) {
    case 'cast':
      return castSpell(state, action, emit, rng);
    case 'scroll':
      return castScroll(state, action, emit, rng);
    case 'focus':
      return doFocus(state, emit);
    case 'flee':
      return doFlee(state, emit, rng);
  }
}

/**
 * Scroll cast (03 section 24): the held composition fires once at
 * fixed potency 2.5 for 0 MP, then the scroll is spent. It rides the
 * normal cast pipeline (reactions, surges below tier 2, the lot).
 */
function castScroll(
  state: BattleState,
  action: { index: number; target?: number },
  emit: Emit,
  rng: Rng,
): boolean {
  const held = state.player.scrolls[action.index];
  if (!held) throw new Error(`scroll: none held at ${String(action.index)}`);
  state.player.scrolls.splice(action.index, 1);
  const overcharged: Spell = { ...held, p: SCROLL.potency };
  return performCast(state, overcharged, 0, action.target, emit, rng);
}

function castSpell(
  state: BattleState,
  action: { slot: number; target?: number },
  emit: Emit,
  rng: Rng,
): boolean {
  const player = state.player;
  const spell = player.spells[action.slot];
  if (!spell) throw new Error(`cast: empty slot ${String(action.slot)}`);
  const mods: CastMods = {
    mastery: player.mastery[spell.element] ?? 0,
    aspect: state.aspect,
  };
  const cost = spellCost(spell, mods);
  if (player.mp < cost) throw new Error('cast: not enough MP');
  return performCast(state, spell, cost, action.target, emit, rng);
}

function performCast(
  state: BattleState,
  spell: Spell,
  cost: number,
  targetIndex: number | undefined,
  emit: Emit,
  rng: Rng,
): boolean {
  const player = state.player;
  const mods: CastMods = {
    mastery: player.mastery[spell.element] ?? 0,
    aspect: state.aspect,
  };
  player.mp -= cost;
  if (!state.formsCast.includes(spell.form)) state.formsCast.push(spell.form);

  const targeting = spellTargeting(spell);
  if (spell.form === 'call') {
    // Call (03 section 22): summon a familiar; recast replaces it.
    if (state.familiar) emit({ kind: 'familiarFade', reason: 'replaced' });
    const fHp = Math.round((FAMILIAR.hpBase + FAMILIAR.hpPerLv * player.lv) * spell.p);
    state.familiar = { spell: { ...spell }, hp: fHp, maxhp: fHp };
    emit({
      kind: 'playerCast',
      spell,
      name: displayName(spell),
      element: spell.element,
      targets: [],
    });
    emit({ kind: 'familiarSummon', element: spell.element, hp: fHp });
    if (state.phase === 'player' && castSurges(spell, mods.mastery ?? 0)) {
      rollSurge(state, spell, [], emit, rng);
    }
    return true;
  }
  if (targeting === 'self') {
    const shield = veilShield(spell, player.lv);
    player.veil = { spell: { ...spell }, shield, absorbed: 0, reapplied: false };
    emit({
      kind: 'playerCast',
      spell,
      name: displayName(spell),
      element: spell.element,
      targets: [],
    });
    emit({ kind: 'veilUp', amount: shield });
    return true;
  }

  let targets: BattleEnemy[];
  if (targeting === 'all') {
    targets = aliveEnemies(state);
  } else {
    const target = state.enemies[targetIndex ?? -1];
    if (!target || target.hp <= 0) throw new Error('cast: invalid target');
    targets = [target];
  }
  emit({
    kind: 'playerCast',
    spell,
    name: displayName(spell),
    element: spell.element,
    targets: targets.map((t) => t.index),
  });

  const hits = spellHits(spell);
  const crit = critProfile(spell);
  let refunded = false;
  const chilledMult = player.statuses.includes('chilled')
    ? (PLAYER_STATUSES.chilled.spellPowerMult ?? 1)
    : 1;
  let totalDealt = 0;

  for (let h = 0; h < hits; h++) {
    for (const target of targets) {
      if (target.hp <= 0) continue;
      const def = defOf(target);

      // Bogmaw submerged: only volt connects, at the special multiplier;
      // a volt hit cancels the breach and resurfaces it (docs/03).
      let submergedOverride: number | null = null;
      if (
        target.kind === 'boss' &&
        state.bossState?.kind === 'submerge' &&
        state.bossState.submerged
      ) {
        if (spell.element !== 'volt') {
          emit({ kind: 'miss', index: target.index });
          continue;
        }
        const special = BOSSES[target.species as BossId].special;
        submergedOverride = special.kind === 'submerge' ? special.voltMult : null;
      }

      // The Wheel (03 section 14): a hit of element E on a foe bearing
      // the status before E reacts. Twins check left element first,
      // max one reaction per hit (03 section 15).
      let reactionDef = REACTIONS[spell.element];
      let setupTurns = target.statuses[reactionDef.setup] ?? 0;
      if (setupTurns <= 0 && spell.e2) {
        const second = REACTIONS[spell.e2];
        const t2 = target.statuses[second.setup] ?? 0;
        if (t2 > 0) {
          reactionDef = second;
          setupTurns = t2;
        }
      }
      const reacts = setupTurns > 0;
      const rider = spell.e2 ? twinPair(spell.element, spell.e2)?.rider : undefined;

      // Sealed elites: 0 damage until the seal breaks. Any weakness
      // element cracks it, and so does any Wheel reaction.
      if (target.sealed) {
        const trialBreak = target.trialKey
          ? reacts && reactionDef.id === target.trialKey
          : def.weak.includes(spell.element) || reacts;
        if (trialBreak) {
          target.sealed = false;
          if (state.bossState?.kind === 'bars') state.bossState.barBrokeSinceArmed = true;
          emit({ kind: 'sealBreak', index: target.index });
        } else {
          emit({
            kind: 'sealedHit',
            index: target.index,
            key: def.weak[0] ?? null,
            demand: target.trialKey,
          });
          // Trial stones (03 s23): the seal nulls the blow, but marks
          // still take, or the demanded reaction could never be set up.
          if (target.trialKey) rollProcs(state, target, spell, mods, rider, emit, rng);
          continue;
        }
      }

      // The amp is read before consumption: reaction damage portions
      // are affected by the Withered amp like any damage (03 section 14),
      // including the Kindle hit that consumes Withered itself.
      const witheredMult = enemyWitheredMult(target);

      // Reactions consume their setup unless the Stormcoil holds it.
      if (reacts && !RUNES[spell.rune].keepsReactionSetup) {
        delete target.statuses[reactionDef.setup];
      }

      // The Wraith fears what it attunes to; everything else glances.
      let attuneOverride: number | null = null;
      if (target.kind === 'boss' && state.bossState?.kind === 'attune' && state.bossState.element) {
        const special = BOSSES[target.species as BossId].special;
        if (special.kind === 'attune') {
          attuneOverride =
            spell.element === state.bossState.element ? special.attunedMult : special.otherMult;
        }
      }

      let baseMult = spell.e2
        ? twinElementMult(spell, def.weak, def.resist)
        : elementMult(spell.element, def.weak, def.resist);
      // Emberglass relic: enemy resists count as neutral for this spell.
      if (RUNES[spell.rune].resistAsNeutral && baseMult === COMBAT.resistMult) baseMult = 1;
      const mult = submergedOverride ?? attuneOverride ?? baseMult;
      let dmg = spellPower(spell, player.lv, mods) * chilledMult * variance(rng, spell) * mult;
      const isCrit = rng() < crit.chance;
      if (isCrit) dmg *= crit.mult;
      // Shatter and Kindle amplify the triggering hit itself.
      const wheelwrightHit = hasCharm(player, 'wheelwright') ? CHARM.wheelwrightMult : 1;
      if (reacts && reactionDef.id === 'shatter') {
        const bonus = rider === 'static' ? STATIC_SHATTER_BONUS : REACTION.shatterBonus;
        dmg *= 1 + bonus * wheelwrightHit;
      }
      if (reacts && reactionDef.id === 'kindle') dmg *= 1 + REACTION.kindleBonus * wheelwrightHit;
      dmg *= witheredMult;
      dmg = Math.max(COMBAT.minDamage, Math.round(dmg));

      let remaining = dmg;
      if (target.shield > 0 && rider !== 'hollowflame') {
        const absorbed = Math.min(target.shield, remaining);
        target.shield -= absorbed;
        remaining -= absorbed;
      }
      // Hollow Warden bars: off-key hits glance, damage clamps at the
      // bar boundary so each bar must be broken on its own key. The
      // adjusted number is the one shown, or the glance is unreadable.
      let barsShown: number | null = null;
      if (target.kind === 'boss' && state.bossState?.kind === 'bars') {
        remaining = barsAdjust(state, target, spell, reacts, targets.length, remaining, emit);
        barsShown = remaining;
      }
      target.hp = Math.max(0, target.hp - remaining);
      totalDealt += barsShown ?? dmg;
      state.elementsHit[spell.element] = true;
      if (spell.e2) state.elementsHit[spell.e2] = true;
      // Bestiary: a hit above neutral reveals the weakness (03 s24).
      if (mult > 1 && target.kind === 'minion') {
        const row = seenRow(state, target.species);
        if (!row.weak.includes(spell.element)) row.weak.push(spell.element);
      }
      emit({
        kind: 'enemyHit',
        index: target.index,
        amount: barsShown ?? dmg,
        crit: isCrit,
        mult,
        hpAfter: target.hp,
        shieldAfter: target.shield,
      });

      // Twin pair riders that key off a landed hit (03 section 15).
      if (rider === 'steam') target.steamed = true;
      if (rider === 'mire') target.mired = true;
      if (rider === 'depth') target.noShieldTurns = DEPTH_NO_SHIELD_TURNS;
      if (rider === 'surge') {
        player.mp = Math.min(player.maxmp, player.mp + SURGE_PAIR_MP);
      }
      if (reacts) {
        state.reactionsFired.push(reactionDef.id);
        if (target.kind === 'minion') {
          const row = seenRow(state, target.species);
          if (!row.reactions.includes(reactionDef.id)) row.reactions.push(reactionDef.id);
        }
        resolveReaction(state, target, reactionDef.id, setupTurns, emit, {
          spell,
          targetCount: targets.length,
        });
      }

      // Storm: single-target casts arc to one other enemy for 50%.
      if (rider === 'storm' && targeting === 'single' && target.hp >= 0) {
        const others = aliveEnemies(state).filter((e) => e.index !== target.index);
        if (others.length > 0) {
          const arcTo = others[randInt(rng, 0, others.length - 1)];
          if (arcTo) {
            const arcDmg = Math.max(1, Math.round(dmg * STORM_ARC_FRAC));
            let arcRemaining = arcDmg;
            if (arcTo.shield > 0) {
              const absorbed = Math.min(arcTo.shield, arcRemaining);
              arcTo.shield -= absorbed;
              arcRemaining -= absorbed;
            }
            let arcShown: number | null = null;
            if (arcTo.kind === 'boss' && state.bossState?.kind === 'bars') {
              // The arc made this a two-target cast (choir-keyed).
              arcRemaining = barsAdjust(state, arcTo, spell, false, 2, arcRemaining, emit);
              arcShown = arcRemaining;
            }
            arcTo.hp = Math.max(0, arcTo.hp - arcRemaining);
            emit({
              kind: 'enemyHit',
              index: arcTo.index,
              amount: arcShown ?? arcDmg,
              crit: false,
              mult: 1,
              hpAfter: arcTo.hp,
              shieldAfter: arcTo.shield,
            });
            if (arcTo.hp <= 0) emit({ kind: 'enemyDown', index: arcTo.index });
          }
        }
      }

      // Wildfire: a kill ignites everything still standing.
      if (rider === 'wildfire' && target.hp <= 0) {
        for (const other of aliveEnemies(state)) {
          if (applyEnemyStatus(other, 'burning')) {
            emit({ kind: 'enemyStatus', index: other.index, status: 'burning' });
          }
        }
      }

      // The volt hit interrupts the dive: the breach is canceled, the
      // boss resurfaces, and the shock stuns it (docs/03).
      if (submergedOverride !== null && state.bossState?.kind === 'submerge') {
        state.bossState.submerged = false;
        state.bossState.breachArmed = false;
        if (target.hp > 0) {
          emit({ kind: 'bossSurface', index: target.index, reason: 'shocked' });
          if (applyEnemyStatus(target, 'stunned')) {
            emit({ kind: 'enemyStatus', index: target.index, status: 'stunned' });
          }
        }
      }

      if (target.hp <= 0) {
        emit({ kind: 'enemyDown', index: target.index });
        // Hollowlight relic: a kill refunds the spell's full cost.
        if (RUNES[spell.rune].refundOnKill && !refunded) {
          refunded = true;
          player.mp = Math.min(player.maxmp, player.mp + cost);
        }
        continue;
      }
      rollProcs(state, target, spell, mods, rider, emit, rng);
      // Mirrorhide: the struck hide answers with the element's own
      // affliction (volt has no player stun: it drains MP instead).
      if (target.affix === 'mirrorhide' && rng() < ELITE.mirrorChance) {
        if (spell.element === 'volt') {
          const drained = Math.min(player.mp, ELITE.mirrorVoltMpDrain);
          if (drained > 0) {
            player.mp -= drained;
            emit({ kind: 'mpDrain', amount: drained, mpAfter: player.mp });
          }
        } else {
          const reflected = ELEMENTS[spell.element].status;
          if (reflected !== 'stunned' && applyPlayerStatus(player, reflected)) {
            emit({ kind: 'playerStatus', status: reflected });
          }
        }
      }
    }
  }

  const healFrac = RUNES[spell.rune].healFrac ?? 0;
  if (healFrac > 0 && totalDealt > 0) {
    const heal = Math.max(1, Math.round(totalDealt * healFrac));
    player.hp = Math.min(player.maxhp, player.hp + heal);
    emit({ kind: 'playerHeal', amount: heal, hpAfter: player.hp });
  }

  checkVictory(state, emit);

  // Unstable craft (03 section 18): the spell has fully resolved; now
  // the wyrd collects. One roll per cast; never rolled into a won
  // battle (no surge can end one either way).
  if (state.phase === 'player' && castSurges(spell, mods.mastery ?? 0)) {
    rollSurge(state, spell, targets, emit, rng);
  }
  return true;
}

/**
 * Hollow Warden bars (03 section 23): the current bar takes full
 * damage only from its keyed shape; off-key hits deal x0.25; damage
 * clamps at the bar boundary; transitions announce and summon.
 */
/**
 * Status proc rolls for one resolved hit. Twins roll both natures at
 * TWIN.procFrac each (03 section 15); night and rot pair riders key
 * off the mark they just left.
 */
function rollProcs(
  state: BattleState,
  target: BattleEnemy,
  spell: Spell,
  mods: CastMods,
  rider: TwinRider | undefined,
  emit: Emit,
  rng: Rng,
): void {
  const player = state.player;
  const procElements: { element: ElementId; frac: number }[] = spell.e2
    ? [
        { element: spell.element, frac: TWIN.procFrac },
        { element: spell.e2, frac: TWIN.procFrac },
      ]
    : [{ element: spell.element, frac: 1 }];
  for (const pe of procElements) {
    if (target.hp <= 0) break;
    const procSpell: Spell = { ...spell, element: pe.element, e2: undefined };
    if (rng() < spellProc(procSpell, mods) * pe.frac) {
      const status = ELEMENTS[pe.element].status;
      if (applyEnemyStatus(target, status)) {
        // Longbrand charm: marks you leave last one turn longer.
        if (hasCharm(player, 'longbrand') && status !== 'stunned') {
          target.statuses[status] = (target.statuses[status] ?? 0) + CHARM.longbrandBonusTurns;
        }
        // Night: Withered from this spell bites harder; Rot: DoTs
        // from this spell tick start AND end of turn (03 s15).
        if (rider === 'night' && status === 'withered') target.witherAmp = true;
        if (rider === 'rot' && (status === 'burning' || status === 'envenomed')) {
          target.rotDots = true;
        }
        if (target.kind === 'minion') {
          const row = seenRow(state, target.species);
          if (!row.statuses.includes(status)) row.statuses.push(status);
        }
        emit({ kind: 'enemyStatus', index: target.index, status });
      }
    }
  }
}

function barsAdjust(
  state: BattleState,
  boss: BattleEnemy,
  spell: Spell,
  reacted: boolean,
  targetCount: number,
  dmg: number,
  emit: Emit,
): number {
  const def = BOSSES[boss.species as BossId].special;
  if (def.kind !== 'bars') return dmg;
  // NG+ scales the boss x1.5, so the bars stretch with it (3 x 210).
  const barHp = Math.round(def.barHp * (state.ng ? NG_PLUS.hpMult : 1));
  const barIndex = Math.min(def.barKeys.length - 1, Math.floor((boss.maxhp - boss.hp) / barHp));
  const key = def.barKeys[barIndex];
  // Choir: 03 s23 names nova as a qualifying shape, so an all-cast
  // counts even when the Warden stands alone.
  const onKey =
    key === 'choir'
      ? spellTargeting(spell) === 'all' || targetCount >= 2
      : key === 'wheel'
        ? reacted
        : spell.p >= SURGE.greedyAt;
  let adjusted = onKey ? dmg : Math.max(1, Math.round(dmg * def.offKeyMult));
  // clamp at the bar boundary
  const barFloor = boss.maxhp - barHp * (barIndex + 1);
  const room = boss.hp - Math.max(0, barFloor);
  if (adjusted >= room && boss.hp - adjusted > 0) {
    adjusted = room;
  }
  const willCross = boss.hp - adjusted <= Math.max(0, barFloor) && boss.hp - adjusted > 0;
  if (willCross && state.bossState?.kind === 'bars') {
    state.bossState.barBrokeSinceArmed = true;
    const nextKey = def.barKeys[barIndex + 1];
    if (nextKey) {
      emit({ kind: 'barBreak', index: boss.index, nextKey });
      // the transition summons one shade (03 section 23)
      const addDef = ENEMIES[def.summonSpecies];
      const index = state.enemies.length;
      const maxhp = Math.round(
        (addDef.h0 + addDef.hpl * def.summonLv) * (state.ng ? NG_PLUS.hpMult : 1),
      );
      state.enemies.push({
        index,
        kind: 'minion',
        species: def.summonSpecies,
        displayName: `${addDef.name} ${String.fromCharCode(65 + index)}`,
        lv: def.summonLv,
        hp: maxhp,
        maxhp,
        shield: 0,
        statuses: {},
        stunImmunity: 0,
      });
      emit({
        kind: 'bossSummon',
        index: boss.index,
        spawned: [{ index, name: `${addDef.name} ${String.fromCharCode(65 + index)}` }],
      });
    }
  }
  return adjusted;
}

/** The non-hit halves of the five reactions (03 section 14). */
function resolveReaction(
  state: BattleState,
  target: BattleEnemy,
  reaction: ReactionId,
  setupTurns: number,
  emit: Emit,
  /** The cast that triggered it, for the Warden's bar key/clamp. */
  bars?: { spell: Spell; targetCount: number },
): void {
  const lv = state.player.lv;
  let amount: number | undefined;

  const wheelwright = hasCharm(state.player, 'wheelwright') ? CHARM.wheelwrightMult : 1;
  if (reaction === 'scald') {
    const burn = ENEMY_STATUSES.burning.dot;
    const tick = (burn?.base ?? 0) + Math.ceil(lv * (burn?.perLv ?? 0));
    amount = Math.max(
      1,
      Math.round(tick * REACTION.scaldTickMult * wheelwright * enemyWitheredMult(target)),
    );
  }
  if (reaction === 'blight') {
    const venom = ENEMY_STATUSES.envenomed.dot;
    const tick = (venom?.base ?? 0) + Math.ceil(lv * (venom?.perLv ?? 0));
    amount = Math.max(1, Math.round(tick * setupTurns * wheelwright * enemyWitheredMult(target)));
  }
  if (amount !== undefined) {
    // Reaction portions are wheel-keyed hits (03 s23): full on the
    // Wheel bar, a glance elsewhere, and always clamped at the floor.
    if (bars && target.kind === 'boss' && state.bossState?.kind === 'bars') {
      amount = barsAdjust(state, target, bars.spell, true, bars.targetCount, amount, emit);
    }
    target.hp = Math.max(0, target.hp - amount);
  }
  emit({ kind: 'reaction', reaction, index: target.index, amount, hpAfter: target.hp });

  if (reaction === 'snare' && target.hp > 0) {
    target.statuses.envenomed = REACTION.snareVenomTurns;
    emit({ kind: 'enemyStatus', index: target.index, status: 'envenomed' });
  }
  if (reaction === 'kindle' && target.hp > 0) {
    if (applyEnemyStatus(target, 'burning')) {
      emit({ kind: 'enemyStatus', index: target.index, status: 'burning' });
    }
  }
  if (target.hp <= 0) {
    emit({ kind: 'enemyDown', index: target.index });
    checkVictory(state, emit);
  }
}

/** One d10 on the battle stream; the table is data (03 section 18). */
function rollSurge(
  state: BattleState,
  spell: Spell,
  targets: BattleEnemy[],
  emit: Emit,
  rng: Rng,
): void {
  const roll = randInt(rng, 1, 10);
  const def = SURGE_TABLE[roll - 1] as SurgeDef;
  const player = state.player;
  if (def.severity === 'severe') state.severeSurges += 1;
  emit({ kind: 'surge', roll, id: def.id, severity: def.severity });

  const firstAliveTarget = targets.find((t) => t.hp > 0);
  switch (def.id) {
    case 'afterglow':
    case 'crow':
      break; // cosmetic / log only
    case 'bite': {
      if (firstAliveTarget) {
        const dmg = SURGE.biteDamage;
        firstAliveTarget.hp = Math.max(0, firstAliveTarget.hp - dmg);
        emit({
          kind: 'enemyHit',
          index: firstAliveTarget.index,
          amount: dmg,
          crit: false,
          mult: 1,
          hpAfter: firstAliveTarget.hp,
          shieldAfter: firstAliveTarget.shield,
        });
        if (firstAliveTarget.hp <= 0) {
          emit({ kind: 'enemyDown', index: firstAliveTarget.index });
          checkVictory(state, emit);
        }
      }
      break;
    }
    case 'warmth': {
      player.hp = Math.min(player.maxhp, player.hp + SURGE.warmthHp);
      emit({ kind: 'playerHeal', amount: SURGE.warmthHp, hpAfter: player.hp });
      break;
    }
    case 'gift': {
      player.mp = Math.min(player.maxmp, player.mp + SURGE.giftMp);
      break;
    }
    case 'sureStatus': {
      if (firstAliveTarget) {
        const status = ELEMENTS[spell.element].status;
        if (applyEnemyStatus(firstAliveTarget, status)) {
          emit({ kind: 'enemyStatus', index: firstAliveTarget.index, status });
        }
      }
      break;
    }
    case 'echoEcho': {
      // The spell re-casts at half power, free, contained: typed hits
      // on the original targeting, no procs, no reactions, no surge.
      for (const t of targets) {
        if (t.hp <= 0) continue;
        const def2 = defOf(t);
        const mult = elementMult(spell.element, def2.weak, def2.resist);
        const half =
          spellPower(spell, player.lv) * SURGE.echoPowerFrac * variance(rng, spell) * mult;
        const dmg = Math.max(1, Math.round(half * enemyWitheredMult(t)));
        let remaining = dmg;
        if (t.shield > 0) {
          const absorbed = Math.min(t.shield, remaining);
          t.shield -= absorbed;
          remaining -= absorbed;
        }
        t.hp = Math.max(0, t.hp - remaining);
        emit({
          kind: 'enemyHit',
          index: t.index,
          amount: dmg,
          crit: false,
          mult,
          hpAfter: t.hp,
          shieldAfter: t.shield,
        });
        if (t.hp <= 0) emit({ kind: 'enemyDown', index: t.index });
      }
      checkVictory(state, emit);
      break;
    }
    case 'grasp': {
      const alive = aliveEnemies(state);
      const pick = alive[randInt(rng, 0, Math.max(0, alive.length - 1))];
      if (pick) {
        pick.statuses.withered = SURGE.graspWitherTurns;
        emit({ kind: 'enemyStatus', index: pick.index, status: 'withered' });
      }
      break;
    }
    case 'collect': {
      const fee = Math.round(player.maxhp * SURGE.collectFrac);
      const before = player.hp;
      player.hp = Math.max(1, player.hp - fee); // cannot KO
      emit({
        kind: 'playerHit',
        amount: before - player.hp,
        absorbed: 0,
        chilled: false,
        hpAfter: player.hp,
      });
      break;
    }
    case 'reversal': {
      if (spell.element === 'volt') {
        const drained = Math.min(player.mp, SURGE.reversalVoltMp);
        if (drained > 0) {
          player.mp -= drained;
          emit({ kind: 'mpDrain', amount: drained, mpAfter: player.mp });
        }
      } else {
        const status = ELEMENTS[spell.element].status;
        if (status !== 'stunned' && applyPlayerStatus(player, status)) {
          emit({ kind: 'playerStatus', status });
        }
      }
      break;
    }
  }
}

function doFocus(state: BattleState, emit: Emit): boolean {
  const p = state.player;
  const mp = Math.round(p.maxmp * FOCUS_MP_FRAC);
  const hp = Math.round(p.maxhp * FOCUS_HP_FRAC);
  p.mp = Math.min(p.maxmp, p.mp + mp);
  p.hp = Math.min(p.maxhp, p.hp + hp);
  emit({ kind: 'focus', mp, hp });
  if (hasCharm(p, 'stillmind')) {
    // Stillmind charm: Focus cleanses everything at once.
    while (p.statuses.length > 0) {
      const cleansed = p.statuses.shift();
      if (cleansed) emit({ kind: 'playerCleanse', status: cleansed });
    }
    return true;
  }
  const cleansed = p.statuses.shift();
  if (cleansed) emit({ kind: 'playerCleanse', status: cleansed });
  return true;
}

function doFlee(state: BattleState, emit: Emit, rng: Rng): boolean {
  if (state.boss) throw new Error('flee: disabled in boss battles');
  if (rng() < FLEE_CHANCE) {
    state.phase = 'fled';
    emit({ kind: 'fled' });
    return false;
  }
  emit({ kind: 'fleeFail' });
  return true;
}

/* ---------- enemy phase ---------- */

/**
 * The familiar acts after the player each round (03 section 22): one
 * typed hit at the Call spell's computed power, proc at element.proc/2
 * (hex restores the full proc), echo strikes twice, thirst heals the
 * player for 35% of familiar damage. Twin Calls alternate elements per
 * round. Immune to statuses; rune crit applies.
 */
function familiarPhase(state: BattleState, emit: Emit, rng: Rng): void {
  const fam = state.familiar;
  if (!fam || fam.hp <= 0) return;
  const spell = fam.spell;
  const element = spell.e2 && state.round % 2 === 0 ? spell.e2 : spell.element;
  const alive = aliveEnemies(state);
  const target = alive[0];
  if (!target) return;
  emit({ kind: 'familiarAct', element });
  const rune = RUNES[spell.rune];
  const hits = spellHits(spell);
  const crit = critProfile(spell);
  let total = 0;
  for (let h = 0; h < hits; h++) {
    if (target.hp <= 0) break;
    const def = defOf(target);
    const mult = elementMult(element, def.weak, def.resist);
    let dmg = spellPower(spell, state.player.lv) * variance(rng, spell) * mult;
    const isCrit = rng() < crit.chance;
    if (isCrit) dmg *= crit.mult;
    dmg *= enemyWitheredMult(target);
    dmg = Math.max(COMBAT.minDamage, Math.round(dmg));
    let remaining = dmg;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
    }
    let shown: number | null = null;
    if (target.kind === 'boss' && state.bossState?.kind === 'bars') {
      remaining = barsAdjust(state, target, spell, false, 1, remaining, emit);
      shown = remaining;
    }
    target.hp = Math.max(0, target.hp - remaining);
    total += shown ?? dmg;
    state.elementsHit[element] = true;
    emit({
      kind: 'enemyHit',
      index: target.index,
      amount: shown ?? dmg,
      crit: isCrit,
      mult,
      hpAfter: target.hp,
      shieldAfter: target.shield,
    });
    if (target.hp <= 0) {
      emit({ kind: 'enemyDown', index: target.index });
      break;
    }
    const baseProc = ELEMENTS[element].proc;
    const proc = rune.procBonus !== undefined ? baseProc : baseProc * FAMILIAR.procFrac;
    if (rng() < proc) {
      const status = ELEMENTS[element].status;
      if (applyEnemyStatus(target, status)) {
        emit({ kind: 'enemyStatus', index: target.index, status });
      }
    }
  }
  if (total > 0 && rune.healFrac) {
    const heal = Math.max(1, Math.round(total * rune.healFrac));
    state.player.hp = Math.min(state.player.maxhp, state.player.hp + heal);
    emit({ kind: 'playerHeal', amount: heal, hpAfter: state.player.hp });
  }
  checkVictory(state, emit);
}

function enemyPhase(state: BattleState, emit: Emit, rng: Rng): void {
  // Iterate a snapshot: mid-phase summons join next round, not this one.
  // Mire pair rider: mired enemies act last this round (03 s15).
  const order = [...state.enemies].sort(
    (a, b) => Number(a.mired ?? false) - Number(b.mired ?? false),
  );
  for (const enemy of order) {
    if (enemy.hp <= 0) continue;

    if (!tickEnemyDots(state, enemy, emit)) continue;

    if ((enemy.statuses.stunned ?? 0) > 0) {
      enemy.statuses.stunned = 0;
      delete enemy.statuses.stunned;
      enemy.stunImmunity = 1;
      emit({ kind: 'enemySkip', index: enemy.index });
      continue;
    }

    if (enemy.glimmer) {
      // Never attacks; at the end of round 2 it slips away (03 section 13).
      if (state.round >= GLIMMERKIN.fleesAfterRound) {
        enemy.hp = 0;
        enemy.escaped = true;
        emit({ kind: 'glimmerFlee', index: enemy.index });
        checkVictory(state, emit);
        if (state.phase !== 'player') return;
      } else {
        emit({ kind: 'enemyMove', index: enemy.index, move: 'glimmers softly' });
      }
      continue;
    }

    enemyAct(state, enemy, emit, rng);
    if (state.phase !== 'player') return;
    // Fleet elites act twice, each blow softened (03 section 13).
    if (enemy.affix === 'fleet' && enemy.hp > 0 && (enemy.statuses.stunned ?? 0) <= 0) {
      enemyAct(state, enemy, emit, rng);
      if (state.phase !== 'player') return;
    }

    // Rot pair rider: DoTs from that spell tick at the END of the
    // enemy turn too (03 section 15).
    if (enemy.rotDots && enemy.hp > 0) {
      if (!tickEnemyDots(state, enemy, emit)) continue;
    }

    for (const decaying of ['chilled', 'withered'] as const) {
      const turns = enemy.statuses[decaying] ?? 0;
      if (turns > 0) {
        enemy.statuses[decaying] = turns - 1;
        if (turns - 1 <= 0) delete enemy.statuses[decaying];
      }
    }
    if (enemy.stunImmunity > 0) enemy.stunImmunity -= 1;
    if (enemy.mired) enemy.mired = false;
    if (enemy.noShieldTurns !== undefined && enemy.noShieldTurns > 0) enemy.noShieldTurns -= 1;
  }
}

/** DoTs at the start of the enemy's turn. Returns false if it died. */
function tickEnemyDots(state: BattleState, enemy: BattleEnemy, emit: Emit): boolean {
  for (const status of ['burning', 'envenomed'] as const) {
    const turns = enemy.statuses[status] ?? 0;
    if (turns <= 0) continue;
    enemy.statuses[status] = turns - 1;
    if (turns - 1 <= 0) delete enemy.statuses[status];
    // Sealed takes 0 damage from every source; the mark still decays.
    if (enemy.sealed) continue;
    const def = ENEMY_STATUSES[status];
    let base = (def.dot?.base ?? 0) + Math.ceil(state.player.lv * (def.dot?.perLv ?? 0));
    if (state.aspect && ELEMENTS[state.aspect].status === status) base *= ASPECT.dotMult;
    let dmg = Math.max(1, Math.round(base * enemyWitheredMult(enemy)));
    if (enemy.kind === 'boss' && state.bossState?.kind === 'bars') {
      const special = BOSSES[enemy.species as BossId].special;
      if (special.kind === 'bars') {
        // A tick is never the bar's key: it glances (03 s23, "full
        // damage only from..."), and it cannot finish a bar; the last
        // point falls to a keyed hit so the break announces properly.
        dmg = Math.max(1, Math.round(dmg * special.offKeyMult));
        const ngBar = Math.round(special.barHp * (state.ng ? NG_PLUS.hpMult : 1));
        const barIndex = Math.min(
          special.barKeys.length - 1,
          Math.floor((enemy.maxhp - enemy.hp) / ngBar),
        );
        const floorHp = Math.max(0, enemy.maxhp - ngBar * (barIndex + 1) + 1);
        dmg = Math.min(dmg, Math.max(0, enemy.hp - floorHp));
        if (dmg <= 0) continue;
      }
    }
    enemy.hp = Math.max(0, enemy.hp - dmg);
    emit({ kind: 'enemyDot', index: enemy.index, status, amount: dmg, hpAfter: enemy.hp });
    if (enemy.hp <= 0) {
      emit({ kind: 'enemyDown', index: enemy.index });
      checkVictory(state, emit);
      return false;
    }
  }
  return true;
}

function enemyAct(state: BattleState, enemy: BattleEnemy, emit: Emit, rng: Rng): void {
  if (enemy.kind === 'boss' && state.bossState) {
    const special = BOSSES[enemy.species as BossId].special;
    const bs = state.bossState;

    if (special.kind === 'submerge' && bs.kind === 'submerge') {
      bs.turns += 1;
      if (bs.breachArmed) {
        // The dive went unanswered: surface with the empowered attack.
        bs.breachArmed = false;
        bs.submerged = false;
        emit({ kind: 'bossSurface', index: enemy.index, reason: 'breach' });
        performMove(
          state,
          enemy,
          { name: special.breachName, mult: special.breachMult },
          emit,
          rng,
        );
        return;
      }
      if (bs.turns % special.every === 0) {
        bs.submerged = true;
        bs.breachArmed = true;
        emit({ kind: 'bossSubmerge', index: enemy.index });
        return;
      }
    }

    if (special.kind === 'summonAndVeil' && bs.kind === 'summonVeil') {
      bs.turns += 1;
      if (!bs.summoned && enemy.hp <= enemy.maxhp * special.summonAtHpFrac) {
        bs.summoned = true;
        const spawned: { index: number; name: string }[] = [];
        const def = ENEMIES[special.summonSpecies];
        for (let i = 0; i < special.summonCount; i++) {
          const index = state.enemies.length;
          const maxhp = Math.round(
            (def.h0 + def.hpl * special.summonLv) * (state.ng ? NG_PLUS.hpMult : 1),
          );
          state.enemies.push({
            index,
            kind: 'minion',
            species: special.summonSpecies,
            displayName: `${def.name} ${String.fromCharCode(65 + i)}`,
            lv: special.summonLv,
            hp: maxhp,
            maxhp,
            shield: 0,
            statuses: {},
            stunImmunity: 0,
          });
          spawned.push({ index, name: `${def.name} ${String.fromCharCode(65 + i)}` });
        }
        emit({ kind: 'bossSummon', index: enemy.index, spawned });
        return;
      }
      if (bs.turns % special.veilEvery === 0) {
        enemy.shield = special.veilShield;
        emit({ kind: 'enemyMove', index: enemy.index, move: special.veilName });
        emit({ kind: 'enemyShield', index: enemy.index, amount: enemy.shield });
        return;
      }
    }

    if (special.kind === 'attune' && bs.kind === 'attune') {
      // Stage by hp before acting.
      if (bs.stage < 3 && enemy.hp <= enemy.maxhp * special.phase3AtHpFrac) {
        bs.stage = 3;
      } else if (bs.stage < 2 && enemy.hp <= enemy.maxhp * special.phase2AtHpFrac) {
        bs.stage = 2;
        bs.shiftIn = 0; // attunement loosens immediately
      }

      // Phase 2 entry: the Hollow answers once.
      if (bs.stage >= 2 && !bs.summoned) {
        bs.summoned = true;
        const def = ENEMIES[special.summonSpecies];
        const spawned: { index: number; name: string }[] = [];
        for (let i = 0; i < special.summonCount; i++) {
          const index = state.enemies.length;
          const maxhp = Math.round(
            (def.h0 + def.hpl * special.summonLv) * (state.ng ? NG_PLUS.hpMult : 1),
          );
          state.enemies.push({
            index,
            kind: 'minion',
            species: special.summonSpecies,
            displayName: `${def.name} ${String.fromCharCode(65 + i)}`,
            lv: special.summonLv,
            hp: maxhp,
            maxhp,
            shield: 0,
            statuses: {},
            stunImmunity: 0,
          });
          spawned.push({ index, name: `${def.name} ${String.fromCharCode(65 + i)}` });
        }
        emit({ kind: 'bossSummon', index: enemy.index, spawned });
        return;
      }

      // Attunement shifts alongside its action.
      bs.shiftIn -= 1;
      if (bs.shiftIn <= 0 || bs.element === null) {
        const pool = (['ember', 'rime', 'volt', 'thorn', 'gloom'] as const).filter(
          (e) => e !== bs.element,
        );
        const next = pool[Math.floor(rng() * pool.length)] ?? 'ember';
        const first = bs.element === null;
        bs.element = next;
        bs.shiftIn = bs.stage >= 2 ? special.shiftEveryPhase2 : special.shiftEveryPhase1;
        emit({ kind: 'bossAttune', index: enemy.index, element: next, first });
      }

      // Phase 3: gather, then Doom, then gather again.
      if (bs.stage === 3) {
        if (!bs.doomArmed) {
          bs.doomArmed = true;
          emit({ kind: 'bossDoom', index: enemy.index, name: special.doomName });
          return;
        }
        bs.doomArmed = false;
        performMove(state, enemy, { name: special.doomName, mult: special.doomMult }, emit, rng);
        return;
      }
    }

    if (special.kind === 'bars' && bs.kind === 'bars') {
      bs.turns += 1;
      if (bs.unwriteArmed) {
        // The gathered word lands at x2.2 unless answered (03 s23):
        // a raised Veil, a Chill on the Warden, or a broken bar all
        // spoil the page. A spoiled Unwriting wastes the Warden's turn.
        bs.unwriteArmed = false;
        const reason =
          state.player.veil !== null
            ? ('veil' as const)
            : (enemy.statuses.chilled ?? 0) > 0
              ? ('chill' as const)
              : bs.barBrokeSinceArmed
                ? ('bar' as const)
                : null;
        if (reason) {
          // The word dies, not the turn: the Warden falls back to a
          // plain move (03 s23 cancels the x2.2, nothing more).
          emit({ kind: 'bossUnwrite', index: enemy.index, phase: 'cancel', reason });
        } else {
          performMove(
            state,
            enemy,
            { name: special.unwriteName, mult: special.unwriteMult },
            emit,
            rng,
          );
          return;
        }
      } else if (bs.turns % special.unwriteEvery === 0) {
        bs.unwriteArmed = true;
        bs.barBrokeSinceArmed = false;
        emit({ kind: 'bossUnwrite', index: enemy.index, phase: 'arm' });
        return;
      }
    }

    if (special.kind === 'enrage' && bs.kind === 'enrage') {
      if (!bs.enraged && enemy.hp <= enemy.maxhp * special.belowHpFrac) {
        bs.enraged = true;
        emit({ kind: 'bossEnrage', index: enemy.index });
      }
      const def = defOf(enemy);
      const move = weightedPick(
        rng,
        def.moves.map((m) => ({
          move: m,
          weight:
            (m.weight ?? 1) *
            (bs.enraged && m.name === special.weightedMove ? special.enragedWeightMult : 1),
        })),
      ).move;
      performMove(state, enemy, move, emit, rng);
      return;
    }
  }
  // Frenzied elites announce the ramp once, crossing half health.
  if (
    enemy.affix === 'frenzied' &&
    !enemy.frenzied &&
    enemy.hp <= enemy.maxhp * ELITE.frenziedAtHpFrac
  ) {
    enemy.frenzied = true;
    emit({ kind: 'frenzy', index: enemy.index });
  }
  const def = defOf(enemy);
  const move = weightedPick(
    rng,
    def.moves.map((m) => ({ move: m, weight: m.weight ?? 1 })),
  ).move;
  performMove(state, enemy, move, emit, rng);
}

function performMove(
  state: BattleState,
  enemy: BattleEnemy,
  move: EnemyMove,
  emit: Emit,
  rng: Rng,
): void {
  emit({ kind: 'enemyMove', index: enemy.index, move: move.name });
  const chilled = (enemy.statuses.chilled ?? 0) > 0;
  if (move.mult > 0) {
    dealDamageToPlayer(state, enemy, move, chilled, emit, rng);
    if (state.phase !== 'player') return;
  }
  applyMoveRider(state, enemy, move, emit, rng);
}

function dealDamageToPlayer(
  state: BattleState,
  enemy: BattleEnemy,
  move: EnemyMove,
  chilled: boolean,
  emit: Emit,
  rng: Rng,
): void {
  const def = defOf(enemy);
  const player = state.player;
  let dmg = (def.a0 + def.al * enemy.lv) * move.mult * variance(rng);
  if (state.ng) dmg *= NG_PLUS.atkMult;
  if (chilled) dmg *= ENEMY_STATUSES.chilled.dealtMult ?? 1;
  if (player.statuses.includes('withered')) dmg *= PLAYER_STATUSES.withered.takenMult ?? 1;
  if (enemy.kind === 'boss' && state.bossState?.kind === 'enrage' && state.bossState.enraged) {
    const special = BOSSES[enemy.species as BossId].special;
    if (special.kind === 'enrage') dmg *= special.dmgMult;
  }
  // Steam pair rider: the scalded target's next move lands soft.
  if (enemy.steamed) {
    dmg *= STEAM_NEXT_MOVE_MULT;
    enemy.steamed = false;
  }
  // A living familiar draws 40% of enemy attacks (03 section 22).
  if (state.familiar && state.familiar.hp > 0 && rng() < FAMILIAR.redirectChance) {
    const fam = state.familiar;
    const famDmg = Math.max(1, Math.round(dmg));
    fam.hp = Math.max(0, fam.hp - famDmg);
    emit({ kind: 'familiarHit', amount: famDmg, hpAfter: fam.hp });
    if (fam.hp <= 0) {
      state.familiar = null;
      emit({ kind: 'familiarFade', reason: 'fallen' });
    }
    return;
  }
  // Elite affixes (v1.1): fleet softens each of its two blows;
  // frenzied ramps below half health.
  if (enemy.affix === 'fleet') dmg *= ELITE.fleetMult;
  if (enemy.affix === 'frenzied' && enemy.hp <= enemy.maxhp * ELITE.frenziedAtHpFrac) {
    dmg *= ELITE.frenziedMult;
  }
  dmg = Math.max(1, Math.round(dmg));

  let absorbed = 0;
  const veil = player.veil;
  if (veil && veil.shield > 0) {
    absorbed = Math.min(veil.shield, dmg);
    veil.shield -= absorbed;
    veil.absorbed += absorbed;
  }
  const through = dmg - absorbed;
  if (through > 0) state.playerTookHit = true;
  player.hp = Math.max(0, player.hp - through);
  emit({ kind: 'playerHit', amount: dmg, absorbed, hpAfter: player.hp, chilled });

  if (veil && absorbed > 0) {
    // Element rider: striking the veil can afflict the attacker.
    if (rng() < veilRiderProc(veil.spell)) {
      const status = ELEMENTS[veil.spell.element].status;
      if (applyEnemyStatus(enemy, status)) {
        emit({ kind: 'enemyStatus', index: enemy.index, status });
      }
    }
    if (veil.shield <= 0) {
      emit({ kind: 'veilBreak' });
      const veilHealFrac = RUNES[veil.spell.rune].healFrac ?? 0;
      if (veilHealFrac > 0 && veil.absorbed > 0) {
        const heal = Math.max(1, Math.round(veil.absorbed * veilHealFrac));
        player.hp = Math.min(player.maxhp, player.hp + heal);
        emit({ kind: 'playerHeal', amount: heal, hpAfter: player.hp });
      }
      if (veil.spell.rune === 'echo' && !veil.reapplied) {
        veil.shield = veilShield(veil.spell, player.lv);
        veil.absorbed = 0;
        veil.reapplied = true;
        emit({ kind: 'veilReapply', amount: veil.shield });
      } else {
        player.veil = null;
      }
    }
  }

  if (player.hp <= 0) {
    state.phase = 'defeat';
    emit({ kind: 'defeat' });
  }
}

function applyMoveRider(
  state: BattleState,
  enemy: BattleEnemy,
  move: EnemyMove,
  emit: Emit,
  rng: Rng,
): void {
  const rider = move.rider;
  if (!rider) return;
  switch (rider.type) {
    case 'playerStatus': {
      // The ascendant element favors both sides (03 section 25).
      const aspectBonus =
        state.aspect && ELEMENTS[state.aspect].status === rider.status
          ? ASPECT.enemyRiderProcBonus
          : 0;
      if (rng() < rider.chance + aspectBonus && applyPlayerStatus(state.player, rider.status)) {
        emit({ kind: 'playerStatus', status: rider.status });
      }
      break;
    }
    case 'mpDrain': {
      const drained = Math.min(state.player.mp, rider.amount);
      if (drained > 0) {
        state.player.mp -= drained;
        emit({ kind: 'mpDrain', amount: drained, mpAfter: state.player.mp });
      }
      break;
    }
    case 'selfShield': {
      if ((enemy.noShieldTurns ?? 0) > 0) break; // Depth holds the water
      enemy.shield = rider.amount;
      emit({ kind: 'enemyShield', index: enemy.index, amount: enemy.shield });
      break;
    }
  }
}

/* ---------- round wrap ---------- */

function playerDotPhase(state: BattleState, emit: Emit): void {
  const player = state.player;
  for (const status of ['burning', 'envenomed'] as const) {
    if (!player.statuses.includes(status)) continue;
    const frac = PLAYER_STATUSES[status].dotPctMaxHp ?? 0;
    const aspectMult =
      state.aspect && ELEMENTS[state.aspect].status === status ? ASPECT.dotMult : 1;
    const dmg = Math.max(1, Math.round(player.maxhp * frac * aspectMult));
    player.hp = Math.max(0, player.hp - dmg);
    emit({ kind: 'playerDot', status, amount: dmg, hpAfter: player.hp });
    if (player.hp <= 0) {
      state.phase = 'defeat';
      emit({ kind: 'defeat' });
      return;
    }
  }
}

function battleXp(state: BattleState): number {
  return state.enemies.reduce((sum, e) => {
    if (e.escaped) return sum;
    const base = e.glimmer ? GLIMMERKIN.xpBase + GLIMMERKIN.xpPerLv * e.lv : defOf(e).xpFor(e.lv);
    return sum + (e.affix ? base * ELITE.xpMult : base);
  }, 0);
}

/** Essence earned by a won battle (03 section 16; x2 in NG+). */
export function battleEssence(state: BattleState): number {
  let total = ESSENCE.victory;
  if (hasCharm(state.player, 'graverobber')) total += CHARM.graverobberEssence;
  for (const e of state.enemies) {
    if (e.escaped) continue;
    if (e.affix) total += ESSENCE.elite;
    if (e.affix === 'sealed') total += ESSENCE.sealedBonus;
    if (e.glimmer) total += ESSENCE.glimmerCaught;
  }
  return total * (state.ng ? NG_PLUS.essenceMult : 1);
}

function checkVictory(state: BattleState, emit: Emit): void {
  if (state.enemies.some((e) => e.hp > 0)) return;
  state.phase = 'victory';
  emit({ kind: 'victory', xp: battleXp(state) });
}

/* ---------- commit ---------- */

export interface CommitResult {
  state: GameState;
  xpGained: number;
  levelsGained: number[];
  /** Essence earned on victory (03 section 16). */
  essenceGained: number;
  /** Essence dropped at the defeat marker. */
  essenceLost: number;
  /** Elements that crossed a mastery tier this battle (03 section 17). */
  masteryTierUps: { element: ElementId; tier: 1 | 2 | 3 }[];
  /** Feats earned by this battle (Phase 13). */
  featsEarned: string[];
}

/** Fold a finished battle back into the GameState (docs/02 rules). */
export function commitBattle(gs: GameState, battle: BattleState): CommitResult {
  if (battle.phase === 'player') throw new Error('commit: battle still running');
  const next = structuredClone(gs);
  next.player.statuses = {};
  // Spent scrolls stay spent, win or lose (03 section 24).
  next.player.scrolls = battle.player.scrolls.map((sc) => ({ ...sc }));

  if (battle.phase === 'defeat') {
    next.stats.defeats += 1;
    // Half the essence (round up) drops where you fell, as a single
    // recoverable marker. A second defeat forfeits the older drop
    // (03 section 16; flagged for Grae's playtest in PROGRESS).
    const drop = defeatDrop(next.player.essence);
    let essenceLost = 0;
    if (drop > 0) {
      next.player.essence -= drop;
      next.world.essenceMarker = {
        mapId: gs.world.mapId,
        x: gs.world.x,
        y: gs.world.y,
        amount: drop,
      };
      essenceLost = drop;
    }
    next.player.hp = next.player.maxhp;
    next.player.mp = next.player.maxmp;
    next.world.mapId = next.world.respawn.mapId;
    next.world.x = next.world.respawn.x;
    next.world.y = next.world.respawn.y;
    next.world.facing = 'down';
    next.world.graceSteps = GRACE_AFTER_DEFEAT;
    return {
      state: next,
      xpGained: 0,
      levelsGained: [],
      essenceGained: 0,
      essenceLost,
      masteryTierUps: [],
      featsEarned: [],
    };
  }

  next.player.hp = battle.player.hp;
  next.player.mp = battle.player.mp;
  next.world.graceSteps = GRACE_AFTER_BATTLE;

  if (battle.phase === 'fled') {
    return {
      state: next,
      xpGained: 0,
      levelsGained: [],
      essenceGained: 0,
      essenceLost: 0,
      masteryTierUps: [],
      featsEarned: [],
    };
  }

  next.stats.battles += 1;
  if (battle.bossId) next.world.bosses[battle.bossId] = true;
  const essence = battleEssence(battle);
  next.player.essence += essence;

  // Feat counters and bestiary fill (Phase 13, 03 section 24).
  next.stats.severeSurges += battle.severeSurges;
  for (const e of battle.enemies) {
    if (e.escaped || e.hp > 0) continue;
    if (e.glimmer) next.stats.glimmersCaught += 1;
    if (e.affix) next.stats.elitesFelled += 1;
    if (e.kind === 'minion') {
      const row = (next.bestiary[e.species] ??= {
        kills: 0,
        weak: [],
        statuses: [],
        reactions: [],
      });
      row.kills += 1;
    }
  }
  for (const [species, found] of Object.entries(battle.seen)) {
    const row = (next.bestiary[species] ??= { kills: 0, weak: [], statuses: [], reactions: [] });
    for (const w of found.weak) if (!row.weak.includes(w)) row.weak.push(w);
    for (const st2 of found.statuses) if (!row.statuses.includes(st2)) row.statuses.push(st2);
    for (const rx of found.reactions) if (!row.reactions.includes(rx)) row.reactions.push(rx);
  }
  for (const rx of battle.reactionsFired) {
    next.world.flags[`reaction_seen_${rx}`] = true;
  }
  const featsEarned = evaluateBattleFeats(next, battle);
  next.feats.push(...featsEarned);

  // Mastery (03 section 17): +1 per element that landed a hit, cap 50.
  const masteryTierUps: { element: ElementId; tier: 1 | 2 | 3 }[] = [];
  for (const element of Object.keys(battle.elementsHit) as ElementId[]) {
    if (!battle.elementsHit[element]) continue;
    const before = next.player.mastery[element];
    const after = Math.min(MASTERY.cap, before + 1);
    next.player.mastery[element] = after;
    if (masteryTier(after) > masteryTier(before)) {
      masteryTierUps.push({ element, tier: masteryTier(after) as 1 | 2 | 3 });
    }
  }

  const xp = battleXp(battle);
  const leveled = applyXp(next.player, xp);
  next.player = leveled.player;
  return {
    state: next,
    xpGained: xp,
    levelsGained: leveled.levelsGained,
    essenceGained: essence,
    essenceLost: 0,
    masteryTierUps,
    featsEarned,
  };
}

/** Battle-driven feats (03 section 24); world-driven ones live in scenes. */
function evaluateBattleFeats(gs: GameState, battle: BattleState): string[] {
  const out: string[] = [];
  const earn = (id: string): void => {
    if (!gs.feats.includes(id) && !out.includes(id)) out.push(id);
  };
  const reactions = ['scald', 'shatter', 'snare', 'blight', 'kindle'];
  if (reactions.every((r) => gs.world.flags[`reaction_seen_${r}`])) earn('wheel_turns');
  if (battle.reactionsFired.length >= 3) earn('shatterstorm');
  if (battle.formsCast.length > 0 && battle.formsCast.every((f) => f === 'wisp')) {
    earn('quiet_hands');
  }
  if (!battle.playerTookHit) earn('patient_author');
  if (
    (battle.bossId === 'thornveil' || battle.bossId === 'ashenwarden') &&
    battle.player.spells.every((sp) => !sp || sp.p <= 1.0)
  ) {
    earn('thrift');
  }
  if (gs.stats.severeSurges >= 5) earn('surge_rider');
  if (gs.stats.glimmersCaught >= 3) earn('glimmer_catcher');
  if (gs.stats.elitesFelled >= 10) earn('elite_hunter');
  return out;
}

/* ---------- helpers for UI ---------- */

export function canCast(state: BattleState, slot: number): boolean {
  const spell = state.player.spells[slot];
  if (!spell) return false;
  const mods: CastMods = {
    mastery: state.player.mastery[spell.element] ?? 0,
    aspect: state.aspect,
  };
  return state.player.mp >= spellCost(spell, mods);
}

export function randomAliveTarget(state: BattleState, rng: Rng): number {
  const alive = aliveEnemies(state);
  const pick = alive[randInt(rng, 0, alive.length - 1)];
  if (!pick) throw new Error('no alive enemies');
  return pick.index;
}
