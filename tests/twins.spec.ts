/**
 * Twin-element spells (docs/03 section 15): cost x1.6, matchup capped
 * at 1.3, dual procs at half fraction, left-first reactions, and all
 * ten pair riders.
 *
 * Draw orders: twin cast single hit = [variance, crit, proc(e1),
 * proc(e2)]; a storm arc inserts [arcPick] before the procs; enemy
 * attack = [movePick, variance] (+1 rider chance when the move has
 * one). Reactions add no draws.
 */
import { describe, expect, it } from 'vitest';
import type { Rng } from '../src/core/rng.ts';
import { newGame } from '../src/core/save.ts';
import type { Spell } from '../src/core/state.ts';
import { castSurges, makeSpell, spellCost, spellName } from '../src/systems/spellcraft.ts';
import { initBattle, reduce, type BattleEvent, type BattleState } from '../src/systems/battle.ts';
import { TWIN_PAIRS, twinPair } from '../src/data/wheel.ts';

function rngSeq(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i];
    if (v === undefined) throw new Error(`rngSeq exhausted at draw ${String(i)}`);
    i += 1;
    return v;
  };
}

function twin(e1: Spell['element'], e2: Spell['element'], form: Spell['form'] = 'bolt'): Spell {
  return { ...makeSpell(e1, form, 'none'), e2 };
}

function ready(spells: Spell[]): ReturnType<typeof newGame> {
  const gs = newGame();
  gs.player.starter = 'ember';
  gs.player.spells = [...spells, null, null, null, null, null].slice(0, 6);
  return gs;
}

function arena(spells: Spell[], members: ('pondscale' | 'gloop' | 'mossback')[]): BattleState {
  const state = initBattle(ready(spells), members, 2, 'hearthvale.marsh').state;
  for (const foe of state.enemies) {
    foe.hp = 500;
    foe.maxhp = 500;
  }
  return state;
}

function hits(events: BattleEvent[]): Extract<BattleEvent, { kind: 'enemyHit' }>[] {
  return events.filter(
    (e): e is Extract<BattleEvent, { kind: 'enemyHit' }> => e.kind === 'enemyHit',
  );
}

describe('twin fundamentals (03 section 15)', () => {
  it('all ten pairs exist, each pair of distinct elements resolves', () => {
    expect(TWIN_PAIRS).toHaveLength(10);
    const elements = ['ember', 'rime', 'volt', 'thorn', 'gloom'] as const;
    for (const a of elements) {
      for (const b of elements) {
        if (a === b) continue;
        expect(twinPair(a, b), `${a}+${b}`).not.toBeNull();
      }
    }
  });

  it('twin MP cost runs x1.6: Steambolt costs 10 where a bolt costs 6', () => {
    expect(spellCost(makeSpell('ember', 'bolt', 'none'))).toBe(6);
    expect(spellCost(twin('ember', 'rime'))).toBe(10);
  });

  it('matchup takes the better element, capped at 1.3', () => {
    // Pondscale: weak rime (1.6), resists ember (0.6). Steam = ember+rime.
    const state = arena([twin('ember', 'rime')], ['pondscale']);
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.0, 0.5]),
    );
    // round(13 * 1.0 * 1.3) = 17, not round(13 * 1.6) = 21
    expect(hits(r.events)[0]?.amount).toBe(17);
  });

  it('neutral-vs-resist twin reads the better side without a cap', () => {
    // Hollowflame = ember+gloom vs pondscale: max(0.6, 1.0) = 1.0.
    const state = arena([twin('ember', 'gloom')], ['pondscale']);
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(hits(r.events)[0]?.amount).toBe(13);
  });

  it('twin names take the pair prefix: Steambolt', () => {
    expect(spellName(twin('ember', 'rime'))).toBe('Steambolt');
    expect(spellName(twin('rime', 'ember'))).toBe('Steambolt');
    expect(spellName(twin('thorn', 'gloom'))).toBe('Rotbolt');
  });

  it('both natures roll procs at half fraction', () => {
    const state = arena([twin('ember', 'rime')], ['pondscale']);
    // proc draws 0.0 land both: ember 0.35*0.5, rime 0.4*0.5.
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 0.0, 0.0, 0.0, 0.5]),
    );
    const foe = r.state.enemies[0];
    expect(foe?.statuses.burning).toBeDefined();
    expect(foe?.statuses.chilled).toBeDefined();
  });

  it('reactions check the left element first', () => {
    // Static = rime+volt on a foe Burning AND Chilled: rime sees the
    // burn first, Scald fires, the chill is left standing.
    const state = arena([twin('rime', 'volt')], ['pondscale']);
    state.enemies[0]!.statuses.burning = 2;
    state.enemies[0]!.statuses.chilled = 2;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.0, 0.5]),
    );
    const reaction = r.events.find(
      (e): e is Extract<BattleEvent, { kind: 'reaction' }> => e.kind === 'reaction',
    );
    expect(reaction?.reaction).toBe('scald');
    expect(r.state.enemies[0]?.statuses.burning).toBeUndefined();
    // Chilled survives the cast (it decays by 1 at end of round).
    expect(r.state.enemies[0]?.statuses.chilled).toBe(1);
  });

  it('twin surge gating reads the LOWER mastery tier', () => {
    const greedy: Spell = { ...twin('ember', 'rime'), p: 1.3 };
    expect(castSurges(greedy, 25, 0)).toBe(true);
    expect(castSurges(greedy, 25, 25)).toBe(false);
    expect(castSurges({ ...makeSpell('ember', 'bolt', 'none'), p: 1.3 }, 25)).toBe(false);
  });
});

describe('the ten pair riders (03 section 15)', () => {
  it('Steam: the scalded target hits soft once', () => {
    const state = arena([twin('ember', 'rime')], ['pondscale']);
    const hpBefore = state.player.hp;
    // cast [var, crit, p1, p2], enemy [pick=tongue lash, var]
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.0, 0.5]),
    );
    // atkRaw 5 + 1.7*2 = 8.4; x1.0 move x1.0 var x0.7 steam = 6 (else 8)
    expect(hpBefore - r.state.player.hp).toBe(6);
    expect(r.state.enemies[0]?.steamed).toBe(false);
  });

  it('Storm: a single-target cast arcs to one other foe at 50%', () => {
    const state = arena([twin('ember', 'volt')], ['pondscale', 'pondscale']);
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 0.0, 1.0, 1.0, 0.0, 0.5, 0.0, 0.5]),
    );
    const h = hits(r.events);
    expect(h[0]?.index).toBe(0);
    expect(h[0]?.amount).toBe(13);
    expect(h[1]?.index).toBe(1);
    expect(h[1]?.amount).toBe(7); // round(13 * 0.5)
  });

  it('Wildfire: a kill ignites everything still standing', () => {
    const state = arena([twin('ember', 'thorn')], ['gloop', 'gloop']);
    state.enemies[0]!.hp = 1;
    const r = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 1.0, 0.0, 0.5]));
    expect(r.state.enemies[0]?.hp).toBe(0);
    expect(r.state.enemies[1]?.statuses.burning).toBeDefined();
  });

  it('Hollowflame: the hit ignores shields entirely', () => {
    const state = arena([twin('ember', 'gloom')], ['pondscale']);
    state.enemies[0]!.shield = 20;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(r.state.enemies[0]?.shield).toBe(20);
    expect(r.state.enemies[0]?.hp).toBe(487);
  });

  it('Static: Shatter from this spell lands +120% instead of +60%', () => {
    const state = arena([twin('rime', 'volt')], ['pondscale']);
    state.enemies[0]!.statuses.chilled = 2;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.0, 0.5]),
    );
    // round(13 * 1.3 cap) = 16.9 -> x2.2 static = 37
    expect(hits(r.events)[0]?.amount).toBe(37);
    expect(r.state.enemies[0]?.statuses.chilled).toBeUndefined();
  });

  it('Mire: the struck target acts last next round', () => {
    const state = arena([twin('rime', 'thorn')], ['pondscale', 'pondscale']);
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.0, 0.5, 0.0, 0.5]),
    );
    const order = r.events
      .filter((e): e is Extract<BattleEvent, { kind: 'enemyMove' }> => e.kind === 'enemyMove')
      .map((e) => e.index);
    expect(order).toEqual([1, 0]);
    expect(r.state.enemies[0]?.mired).toBe(false);
  });

  it('Depth: the target cannot raise shields for two turns', () => {
    const state = arena([twin('rime', 'gloom')], ['mossback']);
    // movePick 0.4 -> hardens (selfShield 16), blocked by the rider.
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.4]),
    );
    expect(r.state.enemies[0]?.shield).toBe(0);
    expect(r.state.enemies[0]?.noShieldTurns).toBe(1);
  });

  it('Surge: each enemy hit returns 3 MP against the 10 MP cost', () => {
    const state = arena([twin('volt', 'thorn')], ['pondscale']);
    const mpBefore = state.player.mp;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(mpBefore - r.state.player.mp).toBe(7); // 10 paid, 3 back
  });

  it('Night: Withered left by this spell is taken at +40%', () => {
    const state = arena([twin('volt', 'gloom'), makeSpell('volt', 'bolt', 'none')], ['pondscale']);
    // Round 1: gloom proc lands withered, night amps it.
    const r1 = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.0, 0.5]),
    );
    expect(r1.state.enemies[0]?.witherAmp).toBe(true);
    // Round 2: a plain volt bolt bites at x1.4 (else x1.25 -> 16).
    const r2 = reduce(
      r1.state,
      { type: 'cast', slot: 1, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(hits(r2.events)[0]?.amount).toBe(18); // round(13 * 1.4)
  });

  it('Rot: DoTs from this spell tick at both ends of the turn', () => {
    const state = arena([twin('thorn', 'gloom')], ['pondscale']);
    // thorn proc lands envenomed; rot doubles the tick cadence.
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 0.0, 1.0, 0.0, 0.5]),
    );
    // hit 13, then venom tick 8 at turn start AND turn end: 500-13-16
    expect(r.state.enemies[0]?.hp).toBe(471);
    expect(r.state.enemies[0]?.statuses.envenomed).toBe(1);
  });
});
