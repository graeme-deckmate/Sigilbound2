/**
 * Elite affixes, rare encounters, and the essence economy in the battle
 * reducer (docs/03 sections 13 and 16, v1.1).
 *
 * Draw orders: player cast single hit = [variance, crit, proc,
 * (mirror roll vs a living mirrorhide)]; sealed non-key hits consume no
 * draws; minion turn = [move pick, variance, (rider roll)].
 */
import { describe, expect, it } from 'vitest';
import type { Rng } from '../src/core/rng.ts';
import { newGame } from '../src/core/save.ts';
import { makeSpell } from '../src/systems/spellcraft.ts';
import {
  battleEssence,
  commitBattle,
  initBattle,
  reduce,
  type BattleEvent,
  type BattleVariance,
} from '../src/systems/battle.ts';
import { ELITE, GLIMMERKIN } from '../src/data/elites.ts';
import { ESSENCE } from '../src/data/essence.ts';

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

function readyState(spells: ReturnType<typeof makeSpell>[]): ReturnType<typeof newGame> {
  const gs = newGame();
  gs.player.starter = 'ember';
  gs.player.spells = [...spells, null, null, null, null, null].slice(0, 6);
  return gs;
}

function start(
  members: Parameters<typeof initBattle>[1],
  lv: number,
  variance?: BattleVariance,
  spells: ReturnType<typeof makeSpell>[] = [makeSpell('ember', 'bolt', 'none')],
  rng?: Rng,
): ReturnType<typeof initBattle> {
  return initBattle(readyState(spells), members, lv, 'hearthvale.meadow', variance, rng);
}

describe('veiled elite', () => {
  it('enters with shield 10 + 2 * lv and the prefixed name', () => {
    const { state } = start(['gloop'], 2, { elites: ['veiled'] });
    expect(state.enemies[0]?.displayName).toBe('Veiled Gloop');
    expect(state.enemies[0]?.shield).toBe(14);
  });
});

describe('sealed elite', () => {
  it('takes 0 from off-key elements, names the key, and breaks on its weakness', () => {
    // quartzling: weak volt, resists rime and ember.
    const { state } = start(['quartzling'], 2, { elites: ['sealed'] }, [
      makeSpell('thorn', 'bolt', 'none'),
      makeSpell('volt', 'bolt', 'none'),
    ]);
    const hp0 = state.enemies[0]?.hp ?? 0;
    // Off-key hit: no rng draws beyond the enemy's reply.
    const r1 = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.0, 0.5]));
    const sealed = r1.events.find((e) => e.kind === 'sealedHit');
    expect(sealed && 'key' in sealed && sealed.key).toBe('volt');
    expect(r1.state.enemies[0]?.hp).toBe(hp0);
    expect(r1.state.enemies[0]?.sealed).toBe(true);
    // The weakness element cracks it and the hit lands at full force.
    const r2 = reduce(
      r1.state,
      { type: 'cast', slot: 1, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(kinds(r2.events)).toContain('sealBreak');
    expect(r2.state.enemies[0]?.sealed).toBe(false);
    expect(r2.state.enemies[0]?.hp).toBeLessThan(hp0);
  });
});

describe('fleet elite', () => {
  it('acts twice per round, each blow at x0.6', () => {
    const { state } = start(['gloop'], 2, { elites: ['fleet'] });
    // [cast: variance, crit, proc] then two enemy acts [move, variance] each.
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.0, 0.5]),
    );
    const moves = r.events.filter((e) => e.kind === 'enemyMove');
    expect(moves).toHaveLength(2);
    const hits = r.events.filter((e) => e.kind === 'playerHit');
    expect(hits).toHaveLength(2);
    // gloop atk at lv2 = 5 + 1.6*2 = 8.2; move 0 mult 1.0; x0.6 = 4.92 -> 5
    for (const h of hits) {
      if ('amount' in h) expect(h.amount).toBe(5);
    }
  });
});

describe('frenzied elite', () => {
  it('announces once below half HP and ramps damage x1.4', () => {
    const init = start(['gloop'], 2, { elites: ['frenzied'] }, [
      makeSpell('ember', 'wisp', 'none'),
    ]);
    const enemy = init.state.enemies[0];
    if (!enemy) throw new Error('no enemy');
    // maxhp 38: park it at the half-health threshold with room to survive
    // a low-roll wisp (12 dmg at the ember weakness).
    enemy.hp = 19;
    const r = reduce(
      init.state,
      { type: 'cast', slot: 0, target: 0 },
      // cast survives the kill: variance low, no crit, no proc; enemy: move, variance
      rngSeq([0.0, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(r.state.enemies[0]?.hp).toBeGreaterThan(0);
    expect(kinds(r.events)).toContain('frenzy');
    const hit = r.events.find((e) => e.kind === 'playerHit');
    // 8.2 * 1.4 = 11.48 -> 11
    if (hit && 'amount' in hit) expect(hit.amount).toBe(11);
    // second round: no second frenzy line
    const r2 = reduce(
      r.state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.0, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(kinds(r2.events)).not.toContain('frenzy');
  });
});

describe('mirrorhide elite', () => {
  it('reflects the striking element status at 35%', () => {
    const { state } = start(['gloop'], 2, { elites: ['mirrorhide'] }, [
      makeSpell('thorn', 'bolt', 'none'),
    ]);
    // [variance, crit, proc(fail 1.0), mirror(0.0 success)] + enemy [move, variance]
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.0, 0.5]),
    );
    expect(r.state.player.statuses).toContain('envenomed');
  });

  it('volt reflections drain 4 MP instead (no player stun exists)', () => {
    const { state } = start(['gloop'], 2, { elites: ['mirrorhide'] }, [
      makeSpell('volt', 'bolt', 'none'),
    ]);
    const mp0 = state.player.mp;
    const cost = 6;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.0, 0.5]),
    );
    const drain = r.events.find((e) => e.kind === 'mpDrain');
    expect(drain && 'amount' in drain && drain.amount).toBe(ELITE.mirrorVoltMpDrain);
    expect(r.state.player.mp).toBe(mp0 - cost - ELITE.mirrorVoltMpDrain);
  });
});

describe('ambush', () => {
  it('the pack acts before the first player turn', () => {
    const gs = readyState([makeSpell('ember', 'bolt', 'none')]);
    const hp0 = gs.player.hp;
    const { state, events } = initBattle(
      gs,
      ['gloop'],
      2,
      'hearthvale.meadow',
      { ambush: true },
      rngSeq([0.0, 0.5]),
    );
    expect(kinds(events)).toContain('ambush');
    expect(kinds(events)).toContain('enemyMove');
    expect(state.player.hp).toBeLessThan(hp0);
    expect(state.phase).toBe('player');
  });
});

describe('glimmerkin', () => {
  it('never attacks and slips away at the end of round 2', () => {
    const { state } = start(['glimmerkin'], 3, { glimmer: true });
    expect(state.enemies[0]?.maxhp).toBe(GLIMMERKIN.h0 + GLIMMERKIN.hpl * 3);
    // round 1: it glimmers; player whiffs with a weak hit
    const r1 = reduce(state, { type: 'focus' }, rngSeq([]));
    expect(r1.events.some((e) => e.kind === 'enemyMove')).toBe(true);
    expect(r1.state.player.hp).toBe(46); // untouched
    // round 2: it flees and the battle resolves
    const r2 = reduce(r1.state, { type: 'focus' }, rngSeq([]));
    expect(kinds(r2.events)).toContain('glimmerFlee');
    expect(r2.state.phase).toBe('victory');
    expect(r2.state.enemies[0]?.escaped).toBe(true);
    // an escaped glimmer pays nothing
    const committed = commitBattle(readyState([]), r2.state);
    expect(committed.xpGained).toBe(0);
    expect(committed.essenceGained).toBe(ESSENCE.victory);
  });

  it('caught in time it pays 30 + 6 * lv XP and +6 essence', () => {
    const { state } = start(['glimmerkin'], 3, { glimmer: true }, [
      makeSpell('ember', 'lance', 'none', 1.5),
    ]);
    const r = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([1.0, 0.0]));
    expect(r.state.phase).toBe('victory');
    const committed = commitBattle(readyState([]), r.state);
    expect(committed.xpGained).toBe(GLIMMERKIN.xpBase + GLIMMERKIN.xpPerLv * 3);
    expect(committed.essenceGained).toBe(ESSENCE.victory + ESSENCE.glimmerCaught);
  });
});

describe('essence accounting (03 section 16)', () => {
  it('victory pays 1; elites +5 each; sealed +1 extra; xp doubles', () => {
    const init = start(['gloop', 'gloop'], 2, { elites: ['sealed', null] });
    for (const e of init.state.enemies) {
      e.hp = 0;
      e.sealed = false;
    }
    init.state.phase = 'victory';
    expect(battleEssence(init.state)).toBe(ESSENCE.victory + ESSENCE.elite + ESSENCE.sealedBonus);
    const committed = commitBattle(readyState([]), init.state);
    // gloop xp at lv2 = 11 + 3*2 = 17; sealed elite doubles to 34
    expect(committed.xpGained).toBe(34 + 17);
    expect(committed.state.player.essence).toBe(7);
  });

  it('defeat drops ceil(essence/2) as a marker; a second death forfeits the first', () => {
    const gs = readyState([]);
    gs.player.essence = 9;
    gs.world.mapId = 'hearthvale';
    gs.world.x = 12;
    gs.world.y = 30;
    const battle = initBattle(gs, ['gloop'], 2, 'hearthvale.marsh').state;
    battle.phase = 'defeat';
    const first = commitBattle(gs, battle);
    expect(first.essenceLost).toBe(5);
    expect(first.state.player.essence).toBe(4);
    expect(first.state.world.essenceMarker).toEqual({
      mapId: 'hearthvale',
      x: 12,
      y: 30,
      amount: 5,
    });

    // die again elsewhere before recovering: the old marker is forfeit
    const gs2 = first.state;
    gs2.world.mapId = 'westwood';
    gs2.world.x = 5;
    gs2.world.y = 6;
    const battle2 = initBattle(gs2, ['gloop'], 2, 'westwood.outer').state;
    battle2.phase = 'defeat';
    const second = commitBattle(gs2, battle2);
    expect(second.essenceLost).toBe(2);
    expect(second.state.player.essence).toBe(2);
    expect(second.state.world.essenceMarker).toEqual({
      mapId: 'westwood',
      x: 5,
      y: 6,
      amount: 2,
    });
  });

  it('with zero essence a defeat leaves no marker', () => {
    const gs = readyState([]);
    const battle = initBattle(gs, ['gloop'], 2, 'hearthvale.marsh').state;
    battle.phase = 'defeat';
    const r = commitBattle(gs, battle);
    expect(r.essenceLost).toBe(0);
    expect(r.state.world.essenceMarker).toBeNull();
  });
});
