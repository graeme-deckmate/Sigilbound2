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
import { ELEMENTS } from '../data/elements.ts';
import { RUNES } from '../data/runes.ts';
import { BOSSES, ENEMIES, type EnemyMove, type EnemySpeciesId } from '../data/enemies.ts';
import { ENEMY_STATUSES, PLAYER_STATUSES } from '../data/statuses.ts';
import { AFFIXES, ELITE, GLIMMERKIN, type AffixId } from '../data/elites.ts';
import { ESSENCE, defeatDrop } from '../data/essence.ts';
import {
  ASPECT,
  MASTERY,
  masteryTier,
  REACTION,
  REACTIONS,
  SURGE,
  SURGE_TABLE,
  type ReactionId,
  type SurgeDef,
} from '../data/wheel.ts';
import type { ZoneId } from '../data/formations.ts';
import {
  GRACE_AFTER_BATTLE,
  GRACE_AFTER_DEFEAT,
  FOCUS_HP_FRAC,
  FOCUS_MP_FRAC,
  FLEE_CHANCE,
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
  player: BattlePlayer;
  enemies: BattleEnemy[];
}

export type BattleAction =
  | { type: 'cast'; slot: number; target?: number }
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
  | { kind: 'sealedHit'; index: number; key: ElementId | null }
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
    const maxhp = isGlimmer ? GLIMMERKIN.h0 + GLIMMERKIN.hpl * enemyLv : def.h0 + def.hpl * enemyLv;
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
    return enemy;
  });
  const state: BattleState = {
    phase: 'player',
    round: 1,
    boss: false,
    zone,
    aspect: gs.world.aspect,
    elementsHit: {},
    player: {
      lv: gs.player.lv,
      hp: gs.player.hp,
      mp: gs.player.mp,
      maxhp: gs.player.maxhp,
      maxmp: gs.player.maxmp,
      spells: gs.player.spells.map((s) => (s ? { ...s } : null)),
      mastery: { ...gs.player.mastery },
      statuses: [],
      veil: null,
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

/** Boss battles: flat hp, fixed level, special state machine (docs/03). */
export function initBossBattle(gs: GameState, bossId: BossId, zone: ZoneId | null): ReduceResult {
  const def = BOSSES[bossId];
  const enemy: BattleEnemy = {
    index: 0,
    kind: 'boss',
    species: bossId,
    displayName: def.name,
    lv: def.lv,
    hp: def.hp,
    maxhp: def.hp,
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
    player: {
      lv: gs.player.lv,
      hp: gs.player.hp,
      mp: gs.player.mp,
      maxhp: gs.player.maxhp,
      maxmp: gs.player.maxmp,
      spells: gs.player.spells.map((s) => (s ? { ...s } : null)),
      mastery: { ...gs.player.mastery },
      statuses: [],
      veil: null,
    },
    enemies: [enemy],
  };
  return { state, events: [{ kind: 'bossIntro', text: def.intro, ui: snapshotOf(state) }] };
}

/* ---------- helpers ---------- */

function variance(rng: Rng): number {
  return COMBAT.varianceMin + rng() * (COMBAT.varianceMax - COMBAT.varianceMin);
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
    case 'focus':
      return doFocus(state, emit);
    case 'flee':
      return doFlee(state, emit, rng);
  }
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
  player.mp -= cost;

  const targeting = spellTargeting(spell);
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
    const target = state.enemies[action.target ?? -1];
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
      // the status before E reacts. Checked up front because Shatter
      // and Kindle change this very hit.
      const reactionDef = REACTIONS[spell.element];
      const setupTurns = target.statuses[reactionDef.setup] ?? 0;
      const reacts = setupTurns > 0;

      // Sealed elites: 0 damage until the seal breaks. Any weakness
      // element cracks it, and so does any Wheel reaction.
      if (target.sealed) {
        if (def.weak.includes(spell.element) || reacts) {
          target.sealed = false;
          emit({ kind: 'sealBreak', index: target.index });
        } else {
          emit({ kind: 'sealedHit', index: target.index, key: def.weak[0] ?? null });
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

      const mult =
        submergedOverride ?? attuneOverride ?? elementMult(spell.element, def.weak, def.resist);
      let dmg = spellPower(spell, player.lv, mods) * chilledMult * variance(rng) * mult;
      const isCrit = rng() < crit.chance;
      if (isCrit) dmg *= crit.mult;
      // Shatter and Kindle amplify the triggering hit itself.
      if (reacts && reactionDef.id === 'shatter') dmg *= 1 + REACTION.shatterBonus;
      if (reacts && reactionDef.id === 'kindle') dmg *= 1 + REACTION.kindleBonus;
      dmg *= witheredMult;
      dmg = Math.max(COMBAT.minDamage, Math.round(dmg));

      let remaining = dmg;
      if (target.shield > 0) {
        const absorbed = Math.min(target.shield, remaining);
        target.shield -= absorbed;
        remaining -= absorbed;
      }
      target.hp = Math.max(0, target.hp - remaining);
      totalDealt += dmg;
      state.elementsHit[spell.element] = true;
      emit({
        kind: 'enemyHit',
        index: target.index,
        amount: dmg,
        crit: isCrit,
        mult,
        hpAfter: target.hp,
        shieldAfter: target.shield,
      });

      if (reacts) {
        resolveReaction(state, target, reactionDef.id, setupTurns, emit);
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
        continue;
      }
      if (rng() < spellProc(spell, mods)) {
        const status = ELEMENTS[spell.element].status;
        if (applyEnemyStatus(target, status)) {
          emit({ kind: 'enemyStatus', index: target.index, status });
        }
      }
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

/** The non-hit halves of the five reactions (03 section 14). */
function resolveReaction(
  state: BattleState,
  target: BattleEnemy,
  reaction: ReactionId,
  setupTurns: number,
  emit: Emit,
): void {
  const lv = state.player.lv;
  let amount: number | undefined;

  if (reaction === 'scald') {
    const burn = ENEMY_STATUSES.burning.dot;
    const tick = (burn?.base ?? 0) + Math.ceil(lv * (burn?.perLv ?? 0));
    amount = Math.max(1, Math.round(tick * REACTION.scaldTickMult * enemyWitheredMult(target)));
  }
  if (reaction === 'blight') {
    const venom = ENEMY_STATUSES.envenomed.dot;
    const tick = (venom?.base ?? 0) + Math.ceil(lv * (venom?.perLv ?? 0));
    amount = Math.max(1, Math.round(tick * setupTurns * enemyWitheredMult(target)));
  }
  if (amount !== undefined) {
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
        const half = spellPower(spell, player.lv) * SURGE.echoPowerFrac * variance(rng) * mult;
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

function enemyPhase(state: BattleState, emit: Emit, rng: Rng): void {
  // Iterate a snapshot: mid-phase summons join next round, not this one.
  for (const enemy of [...state.enemies]) {
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

    for (const decaying of ['chilled', 'withered'] as const) {
      const turns = enemy.statuses[decaying] ?? 0;
      if (turns > 0) {
        enemy.statuses[decaying] = turns - 1;
        if (turns - 1 <= 0) delete enemy.statuses[decaying];
      }
    }
    if (enemy.stunImmunity > 0) enemy.stunImmunity -= 1;
  }
}

/** DoTs at the start of the enemy's turn. Returns false if it died. */
function tickEnemyDots(state: BattleState, enemy: BattleEnemy, emit: Emit): boolean {
  for (const status of ['burning', 'envenomed'] as const) {
    const turns = enemy.statuses[status] ?? 0;
    if (turns <= 0) continue;
    enemy.statuses[status] = turns - 1;
    if (turns - 1 <= 0) delete enemy.statuses[status];
    const def = ENEMY_STATUSES[status];
    let base = (def.dot?.base ?? 0) + Math.ceil(state.player.lv * (def.dot?.perLv ?? 0));
    if (state.aspect && ELEMENTS[state.aspect].status === status) base *= ASPECT.dotMult;
    const dmg = Math.max(1, Math.round(base * enemyWitheredMult(enemy)));
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
          const maxhp = def.h0 + def.hpl * special.summonLv;
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
          const maxhp = def.h0 + def.hpl * special.summonLv;
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
  if (chilled) dmg *= ENEMY_STATUSES.chilled.dealtMult ?? 1;
  if (player.statuses.includes('withered')) dmg *= PLAYER_STATUSES.withered.takenMult ?? 1;
  if (enemy.kind === 'boss' && state.bossState?.kind === 'enrage' && state.bossState.enraged) {
    const special = BOSSES[enemy.species as BossId].special;
    if (special.kind === 'enrage') dmg *= special.dmgMult;
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

/** Essence earned by a won battle (03 section 16). */
export function battleEssence(state: BattleState): number {
  let total = ESSENCE.victory;
  for (const e of state.enemies) {
    if (e.escaped) continue;
    if (e.affix) total += ESSENCE.elite;
    if (e.affix === 'sealed') total += ESSENCE.sealedBonus;
    if (e.glimmer) total += ESSENCE.glimmerCaught;
  }
  return total;
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
}

/** Fold a finished battle back into the GameState (docs/02 rules). */
export function commitBattle(gs: GameState, battle: BattleState): CommitResult {
  if (battle.phase === 'player') throw new Error('commit: battle still running');
  const next = structuredClone(gs);
  next.player.statuses = {};

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
    };
  }

  next.stats.battles += 1;
  if (battle.bossId) next.world.bosses[battle.bossId] = true;
  const essence = battleEssence(battle);
  next.player.essence += essence;

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
  };
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
