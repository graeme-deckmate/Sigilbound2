/**
 * The Vale's Wheel in the reducer (docs/03 section 14), surges
 * (section 18), mastery ticks (17), and the aspect snapshot (25).
 *
 * Reactions are deterministic and add NO rng draws. Cast single hit =
 * [variance, crit, proc]; a surge adds [d10] plus its effect draws.
 */
import { describe, expect, it } from 'vitest';
import type { Rng } from '../src/core/rng.ts';
import { newGame } from '../src/core/save.ts';
import { makeSpell } from '../src/systems/spellcraft.ts';
import {
  commitBattle,
  initBattle,
  reduce,
  type BattleEvent,
  type BattleState,
} from '../src/systems/battle.ts';
import { REACTION } from '../src/data/wheel.ts';

function rngSeq(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i];
    if (v === undefined) throw new Error(`rngSeq exhausted at draw ${String(i)}`);
    i += 1;
    return v;
  };
}

function kinds(events: BattleEvent[]): string[] {
  return events.map((e) => e.kind);
}

function reactionOf(events: BattleEvent[]): Extract<BattleEvent, { kind: 'reaction' }> | undefined {
  return events.find((e): e is Extract<BattleEvent, { kind: 'reaction' }> => e.kind === 'reaction');
}

function ready(spells: ReturnType<typeof makeSpell>[]): ReturnType<typeof newGame> {
  const gs = newGame();
  gs.player.starter = 'ember';
  gs.player.spells = [...spells, null, null, null, null, null].slice(0, 6);
  return gs;
}

/** A tanky pondscale so reactions resolve before anything dies. */
function arena(spells: ReturnType<typeof makeSpell>[], lv = 2): BattleState {
  const state = initBattle(ready(spells), ['pondscale'], lv, 'hearthvale.marsh').state;
  const foe = state.enemies[0];
  if (foe) {
    foe.hp = 500;
    foe.maxhp = 500;
  }
  return state;
}

describe('the five reactions (docs/03 section 14)', () => {
  it('Scald: rime hit on Burning deals 2 * burnTick and consumes it', () => {
    const state = arena([makeSpell('rime', 'bolt', 'none')]);
    state.enemies[0]!.statuses.burning = 2;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    const reaction = reactionOf(r.events);
    expect(reaction?.reaction).toBe('scald');
    // burnTick at player Lv 1 = 4 + ceil(1 * 1.2) = 6; scald = 12
    expect(reaction?.amount).toBe(12);
    expect(r.state.enemies[0]?.statuses.burning).toBeUndefined();
  });

  it('Shatter: volt hit on Chilled deals +60% and consumes it', () => {
    const state = arena([makeSpell('volt', 'bolt', 'none')]);
    state.enemies[0]!.statuses.chilled = 2;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    const hit = r.events.find((e) => e.kind === 'enemyHit');
    // 13 * 1.0(var .5) * 1.0(neutral) = 13; * 1.6 = 20.8 -> 21
    if (hit && 'amount' in hit) expect(hit.amount).toBe(21);
    expect(reactionOf(r.events)?.reaction).toBe('shatter');
    expect(r.state.enemies[0]?.statuses.chilled).toBeUndefined();
  });

  it('Snare: thorn hit on Stunned applies Envenomed for 4 and consumes the stun', () => {
    const state = arena([makeSpell('thorn', 'bolt', 'none')]);
    state.enemies[0]!.statuses.stunned = 1;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(reactionOf(r.events)?.reaction).toBe('snare');
    expect(r.state.enemies[0]?.statuses.stunned).toBeUndefined();
    // venom outlasts this round's end-of-turn decay bookkeeping
    expect(r.state.enemies[0]?.statuses.envenomed).toBeGreaterThanOrEqual(
      REACTION.snareVenomTurns - 1,
    );
  });

  it('Blight: gloom hit on Envenomed cashes all remaining ticks', () => {
    const state = arena([makeSpell('gloom', 'bolt', 'none')]);
    state.enemies[0]!.statuses.envenomed = 3;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    const reaction = reactionOf(r.events);
    expect(reaction?.reaction).toBe('blight');
    // venomTick at player Lv 1 = 6 + ceil(1 * 1.5) = 8; x3 turns = 24
    expect(reaction?.amount).toBe(24);
    expect(r.state.enemies[0]?.statuses.envenomed).toBeUndefined();
  });

  it('Kindle: ember hit on Withered deals +40% and ignites at 100%', () => {
    const state = arena([makeSpell('ember', 'bolt', 'none')]);
    state.enemies[0]!.statuses.withered = 2;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    const hit = r.events.find((e) => e.kind === 'enemyHit');
    // pondscale resists ember: 13 * 0.6 = 7.8; * 1.4 (kindle) = 10.92;
    // * 1.25 (withered amp) = 13.65 -> 14
    if (hit && 'amount' in hit) expect(hit.amount).toBe(14);
    expect(reactionOf(r.events)?.reaction).toBe('kindle');
    expect(r.state.enemies[0]?.statuses.withered).toBeUndefined();
    expect(r.state.enemies[0]?.statuses.burning).toBeGreaterThan(0);
  });
});

describe('consumption exceptions and ordering', () => {
  it('Stormcoil keeps the setup status while the reaction still fires', () => {
    const state = arena([makeSpell('volt', 'bolt', 'stormcoil')]);
    state.enemies[0]!.statuses.chilled = 2;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(reactionOf(r.events)?.reaction).toBe('shatter');
    // chilled survives (it decays by the normal end-of-turn bookkeeping only)
    expect(r.state.enemies[0]?.statuses.chilled).toBeGreaterThan(0);
  });

  it('Echo: hit 1 reacts and consumes, hit 2 re-applies via its proc', () => {
    const state = arena([makeSpell('volt', 'bolt', 'echo')]);
    state.enemies[0]!.statuses.chilled = 2;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      // hit1 [var, crit, proc fail], hit2 [var, crit, proc success], enemy [move, var]
      rngSeq([0.5, 1.0, 1.0, 0.5, 1.0, 0.0, 0.0, 0.5]),
    );
    const reactions = r.events.filter((e) => e.kind === 'reaction');
    expect(reactions).toHaveLength(1); // only hit 1 had the setup
    // hit 2's proc applied volt's own status (stunned)
    expect(r.state.enemies[0]?.statuses.chilled).toBeUndefined();
    expect(kinds(r.events)).toContain('enemySkip'); // it was stunned for its turn
  });

  it('a Wheel reaction cracks a Sealed elite', () => {
    const state = initBattle(
      ready([makeSpell('gloom', 'bolt', 'none')]),
      ['quartzling'],
      3,
      'northhollow.cliffs',
      { elites: ['sealed'] },
    ).state;
    state.enemies[0]!.hp = 300;
    state.enemies[0]!.maxhp = 300;
    state.enemies[0]!.statuses.envenomed = 2;
    // gloom is NOT quartzling's weakness; the reaction is the key.
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(kinds(r.events)).toContain('sealBreak');
    expect(reactionOf(r.events)?.reaction).toBe('blight');
    expect(r.state.enemies[0]?.sealed).toBe(false);
  });
});

describe('surges (docs/03 section 18)', () => {
  it('wyrd casts roll exactly one d10 after resolving, deterministic per seed', () => {
    const cast = (seedVals: number[]): ReturnType<typeof reduce> => {
      const state = arena([makeSpell('ember', 'bolt', 'wyrd')]);
      return reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq(seedVals));
    };
    // [var, crit, proc, d10 -> 0.05 = roll 1 (afterglow), enemy move, var]
    const a = cast([0.5, 1.0, 1.0, 0.05, 0.0, 0.5]);
    const b = cast([0.5, 1.0, 1.0, 0.05, 0.0, 0.5]);
    const sa = a.events.find((e) => e.kind === 'surge');
    const sb = b.events.find((e) => e.kind === 'surge');
    expect(sa && 'roll' in sa && sa.roll).toBe(1);
    expect(JSON.stringify(sa)).toBe(JSON.stringify(sb));
  });

  it('roll 9 (the dark collects) bites 8% maxHP and cannot KO', () => {
    const state = arena([makeSpell('ember', 'bolt', 'wyrd')]);
    state.player.hp = 3; // collect would exceed this; floors at 1
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.85, 0.0, 0.5]), // d10 0.85 -> roll 9
    );
    const surge = r.events.find((e) => e.kind === 'surge');
    expect(surge && 'id' in surge && surge.id).toBe('collect');
    // floored at 1: the fee event shows the clamped hit
    const fee = r.events.find((e) => e.kind === 'playerHit');
    expect(fee && 'hpAfter' in fee && fee.hpAfter).toBe(1);
  });

  it('roll 10 reversal afflicts the caster with the spell status', () => {
    const state = arena([makeSpell('thorn', 'bolt', 'wyrd')]);
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.95, 0.0, 0.5]), // d10 -> 10
    );
    expect(r.state.player.statuses).toContain('envenomed');
  });

  it('greedy casts stabilize at mastery tier 2 (no d10 draw at all)', () => {
    const greedy = makeSpell('ember', 'bolt', 'none', 1.3);
    const unstable = arena([greedy]);
    // below tier 2: the d10 is drawn (sequence needs the extra value)
    const r1 = reduce(
      unstable,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.05, 0.0, 0.5]),
    );
    expect(kinds(r1.events)).toContain('surge');

    const stable = arena([greedy]);
    stable.player.mastery.ember = 25;
    // tier 2: the same sequence WITHOUT the d10 must fit exactly
    const r2 = reduce(
      stable,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(kinds(r2.events)).not.toContain('surge');
  });
});

describe('mastery ticks and the aspect snapshot', () => {
  it('victory grants +1 per element that landed a hit, with tier-ups reported', () => {
    const gs = ready([makeSpell('ember', 'bolt', 'none'), makeSpell('volt', 'bolt', 'none')]);
    gs.player.mastery.ember = 9; // one tick from tier 1
    const state = initBattle(gs, ['gloop'], 2, 'hearthvale.meadow').state;
    state.elementsHit.ember = true;
    state.elementsHit.volt = true;
    for (const e of state.enemies) e.hp = 0;
    state.phase = 'victory';
    const r = commitBattle(gs, state);
    expect(r.state.player.mastery.ember).toBe(10);
    expect(r.state.player.mastery.volt).toBe(1);
    expect(r.masteryTierUps).toEqual([{ element: 'ember', tier: 1 }]);
  });

  it('the battle snapshots the world aspect and boosts that element', () => {
    const gs = ready([makeSpell('rime', 'bolt', 'none')]);
    gs.world.aspect = 'rime';
    const state = initBattle(gs, ['pondscale'], 2, 'hearthvale.marsh').state;
    expect(state.aspect).toBe('rime');
    state.enemies[0]!.hp = 500;
    state.enemies[0]!.maxhp = 500;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    const hit = r.events.find((e) => e.kind === 'enemyHit');
    // rime vs pondscale weak: round(13 * 1.1 aspect) = 14 power; 14 * 1.6 = 22.4 -> 22
    if (hit && 'amount' in hit) expect(hit.amount).toBe(22);
  });
});
