/**
 * Battle reducer acceptance tests (docs/04 Phase 3): weakness mult,
 * echo double-proc, stun immunity turn, chill on both sides, veil
 * break + thirst heal, focus cleanse order. Plus commits and extras.
 */
import { describe, expect, it } from 'vitest';
import type { Rng } from '../src/core/rng.ts';
import { newGame } from '../src/core/save.ts';
import { makeSpell } from '../src/systems/spellcraft.ts';
import {
  commitBattle,
  initBattle,
  initBossBattle,
  reduce,
  type BattleEvent,
  type BattleState,
} from '../src/systems/battle.ts';

/** Rng yielding an exact sequence; throws if the test miscounts draws. */
function rngSeq(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i];
    if (v === undefined) throw new Error(`rngSeq exhausted at draw ${String(i)}`);
    i += 1;
    return v;
  };
}

function freshBattle(
  members: Parameters<typeof initBattle>[1],
  enemyLv: number,
  setup?: (gs: ReturnType<typeof newGame>) => void,
): BattleState {
  const gs = newGame();
  setup?.(gs);
  return initBattle(gs, members, enemyLv, 'hearthvale.meadow').state;
}

function kinds(events: BattleEvent[]): string[] {
  return events.map((e) => e.kind);
}

function find<K extends BattleEvent['kind']>(
  events: BattleEvent[],
  kind: K,
): Extract<BattleEvent, { kind: K }>[] {
  return events.filter((e): e is Extract<BattleEvent, { kind: K }> => e.kind === kind);
}

/* draws per step: cast single hit = [variance, crit, proc]; enemy turn =
   [move pick, variance, (rider/veil-rider roll if applicable)] */

describe('weakness and resistance multipliers', () => {
  it('volt vs gloop (weak) deals round(13 * 1.6) = 21 at neutral variance', () => {
    const state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('volt', 'bolt', 'none');
    });
    const { events } = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([
        0.5,
        0.99,
        0.99, // cast: variance 1.0, no crit, no proc
        0.0,
        0.5, // enemy: move, variance
      ]),
    );
    const hit = find(events, 'enemyHit')[0];
    expect(hit?.amount).toBe(21);
    expect(hit?.mult).toBe(1.6);
  });

  it('thorn vs gloop (resist) deals round(13 * 0.6) = 8', () => {
    const state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('thorn', 'bolt', 'none');
    });
    const { events } = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 0.99, 0.99, 0.0, 0.5]),
    );
    const hit = find(events, 'enemyHit')[0];
    expect(hit?.amount).toBe(8);
    expect(hit?.mult).toBe(0.6);
  });
});

describe('echo double hit and per-hit proc', () => {
  it('casts two hits at 0.62 power, each rolling its own proc', () => {
    const state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('ember', 'bolt', 'echo');
    });
    const { state: after, events } = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([
        0.5,
        0.99,
        0.0, // hit 1: var 1.0, no crit, proc (0 < 0.35)
        0.5,
        0.99,
        0.0, // hit 2: same, proc refreshes Burning
        0.0,
        0.5, // enemy turn: move, variance
      ]),
    );
    const hits = find(events, 'enemyHit');
    expect(hits).toHaveLength(2);
    // per-hit power 8 (13 * 0.62 rounded), vs weak ember: round(8 * 1.6) = 13
    expect(hits[0]?.amount).toBe(13);
    expect(hits[1]?.amount).toBe(13);
    expect(find(events, 'enemyStatus')).toHaveLength(2);
    // applied at 3, then the enemy's own turn in this round ticks it once
    expect(find(events, 'enemyDot')).toHaveLength(1);
    expect(after.enemies[0]?.statuses.burning).toBe(2);
  });
});

describe('stun immunity turn', () => {
  it('a stun expires into one turn of immunity before it can land again', () => {
    let state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('volt', 'wisp', 'none');
    });
    // T1: stun lands; enemy skips its turn (no enemy rng draws).
    let r = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 0.99, 0.0]));
    expect(find(r.events, 'enemyStatus')[0]?.status).toBe('stunned');
    expect(kinds(r.events)).toContain('enemySkip');
    state = r.state;
    expect(state.enemies[0]?.stunImmunity).toBe(1);

    // T2: proc rolls success but stun is blocked by immunity; enemy acts.
    r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([
        0.5,
        0.99,
        0.0, // proc roll consumed, application blocked
        0.0,
        0.5, // enemy acts
      ]),
    );
    expect(find(r.events, 'enemyStatus')).toHaveLength(0);
    expect(kinds(r.events)).toContain('enemyMove');
    state = r.state;
    expect(state.enemies[0]?.stunImmunity).toBe(0);

    // T3: stun lands again.
    r = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 0.99, 0.0]));
    expect(find(r.events, 'enemyStatus')[0]?.status).toBe('stunned');
  });
});

describe('chill on both sides', () => {
  it('a chilled enemy deals x0.65 damage', () => {
    const state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('rime', 'wisp', 'none');
    });
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([
        0.5,
        0.99,
        0.0, // chill procs
        0.0,
        0.5, // enemy: squelches (1.0), variance 1.0
      ]),
    );
    // gloop lv4 atkRaw = 5 + 1.6*4 = 11.4; * 1.0 * 1.0 * 0.65 = 7.41 -> 7
    const hit = find(r.events, 'playerHit')[0];
    expect(hit?.amount).toBe(7);
    expect(hit?.chilled).toBe(true);
  });

  it('a chilled player casts at x0.7 spell power', () => {
    const state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('ember', 'bolt', 'none');
    });
    state.player.statuses = ['chilled'];
    const { events } = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 0.99, 0.99, 0.0, 0.5]),
    );
    // 13 * 0.7 * 1.0 * 1.6 (weak) = 14.56 -> 15 (vs 21 unchilled)
    expect(find(events, 'enemyHit')[0]?.amount).toBe(15);
  });
});

describe('veil break + thirst heal', () => {
  it('absorbs before HP, heals 35% of total absorbed on break', () => {
    let state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('ember', 'veil', 'thirst');
      gs.player.spells[1] = makeSpell('ember', 'wisp', 'none');
    });
    // Lv1 veil of thirst: round(14 * 1 * 1 * 0.9) = 13 shield.
    let r = reduce(
      state,
      { type: 'cast', slot: 0 },
      rngSeq([
        0.0,
        0.5,
        0.99, // enemy: move squelches, var 1.0 -> 11 dmg, veil rider no proc
      ]),
    );
    expect(find(r.events, 'veilUp')[0]?.amount).toBe(13);
    let hit = find(r.events, 'playerHit')[0];
    expect(hit?.amount).toBe(11);
    expect(hit?.absorbed).toBe(11);
    expect(hit?.hpAfter).toBe(46); // fully absorbed
    state = r.state;
    expect(state.player.veil?.shield).toBe(2);

    // Next round: 11 dmg again -> absorb 2, 9 through, veil breaks,
    // thirst heals round(13 * 0.35) = 5.
    r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.5, 0.99]));
    hit = find(r.events, 'playerHit')[0];
    expect(hit?.absorbed).toBe(2);
    expect(kinds(r.events)).toContain('veilBreak');
    const heal = find(r.events, 'playerHeal')[0];
    expect(heal?.amount).toBe(5);
    // hp: 46 - 9 through + 5 heal = 42 (focus first healed +5 hp, capped at 46)
    expect(r.state.player.hp).toBe(42);
    expect(r.state.player.veil).toBeNull();
  });

  it('echo veil re-applies once after breaking', () => {
    let state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('ember', 'veil', 'echo');
    });
    let r = reduce(state, { type: 'cast', slot: 0 }, rngSeq([0.0, 0.5, 0.99]));
    state = r.state;
    // shield 13, absorbed 11, 2 left
    r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.5, 0.99]));
    expect(kinds(r.events)).toContain('veilBreak');
    const re = find(r.events, 'veilReapply')[0];
    expect(re?.amount).toBe(13);
    expect(r.state.player.veil?.shield).toBe(13);
    expect(r.state.player.veil?.reapplied).toBe(true);
  });

  it('striking the veil can afflict the attacker with the veil element status', () => {
    const state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('thorn', 'veil', 'none');
    });
    const r = reduce(
      state,
      { type: 'cast', slot: 0 },
      rngSeq([
        0.0,
        0.5,
        0.0, // rider roll 0 < 0.40 -> envenomed
      ]),
    );
    expect(find(r.events, 'enemyStatus')[0]?.status).toBe('envenomed');
  });
});

describe('focus cleanse order', () => {
  it('cleanses the oldest status first', () => {
    const state = freshBattle(['gloop'], 4);
    state.player.statuses = ['burning', 'chilled'];
    const r = reduce(
      state,
      { type: 'focus' },
      rngSeq([
        0.0,
        0.5, // enemy turn
      ]),
    );
    expect(find(r.events, 'playerCleanse')[0]?.status).toBe('burning');
    expect(r.state.player.statuses).toEqual(['chilled']);
    const f = find(r.events, 'focus')[0];
    expect(f?.mp).toBe(8); // round(22 * 0.35)
    expect(f?.hp).toBe(5); // round(46 * 0.10)
  });
});

describe('multi-enemy', () => {
  it('duplicate species get letter suffixes', () => {
    const state = freshBattle(['gloop', 'gloop'], 2);
    expect(state.enemies.map((e) => e.displayName)).toEqual(['Gloop A', 'Gloop B']);
  });

  it('nova hits every living enemy with independent rolls', () => {
    const state = freshBattle(['gloop', 'gloop'], 2, (gs) => {
      gs.player.spells[0] = makeSpell('ember', 'nova', 'none');
    });
    const { events } = reduce(
      state,
      { type: 'cast', slot: 0 },
      rngSeq([
        0.5,
        0.99,
        0.99, // target A: var, crit, proc
        0.5,
        0.99,
        0.99, // target B
        0.0,
        0.5, // enemy A acts
        0.0,
        0.5, // enemy B acts
      ]),
    );
    const hits = find(events, 'enemyHit');
    expect(hits.map((h) => h.index)).toEqual([0, 1]);
    // nova lv1: round(13 * 0.55) = 7, vs weak: round(7 * 1.6) = 11
    expect(hits[0]?.amount).toBe(11);
  });

  it('single-target casts require a living target', () => {
    const state = freshBattle(['gloop', 'gloop'], 2);
    state.enemies[0]!.hp = 0;
    expect(() =>
      reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 0.99, 0.99])),
    ).toThrow('invalid target');
  });
});

describe('riders and shields', () => {
  it('mp drain rider siphons up to the rider amount', () => {
    const state = freshBattle(['hexbinder'], 6);
    // hexbinder moves: binding sigil (drain 6) is index 0
    const r = reduce(
      state,
      { type: 'focus' },
      rngSeq([
        0.0,
        0.5, // move 0 = binding sigil, variance
      ]),
    );
    const drain = find(r.events, 'mpDrain')[0];
    expect(drain?.amount).toBe(6);
    // focus capped at maxmp 22 first, then the sigil drains 6
    expect(r.state.player.mp).toBe(16);
  });

  it('enemy self shield absorbs spell damage before HP', () => {
    const state = freshBattle(['mossback'], 5, (gs) => {
      gs.player.spells[0] = makeSpell('volt', 'bolt', 'none');
    });
    // Force mossback to harden (move index 1 of 3 -> roll in [1/3, 2/3))
    let r = reduce(state, { type: 'focus' }, rngSeq([0.5]));
    expect(find(r.events, 'enemyShield')[0]?.amount).toBe(16);
    // volt bolt vs weak volt: round(13 * 1.6) = 21 -> 16 shield + 5 hp
    const before = r.state.enemies[0]!.hp;
    r = reduce(r.state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 0.99, 0.99, 0.0, 0.5]));
    const hit = find(r.events, 'enemyHit')[0];
    expect(hit?.amount).toBe(21);
    expect(hit?.shieldAfter).toBe(0);
    expect(r.state.enemies[0]!.hp).toBe(before - 5);
  });

  it('enemy DoT values follow 03: burning = 4 + ceil(lv * 1.2)', () => {
    const state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.lv = 3;
      gs.player.spells[0] = makeSpell('ember', 'bolt', 'none');
    });
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([
        0.5,
        0.99,
        0.0, // burn procs
        0.0,
        0.5, // enemy acts
      ]),
    );
    // next round: DoT ticks at the start of the enemy's turn
    const r2 = reduce(r.state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    const dot = find(r2.events, 'enemyDot')[0];
    expect(dot?.amount).toBe(4 + Math.ceil(3 * 1.2)); // 8
  });
});

describe('flee', () => {
  it('succeeds at the 65% threshold and ends the battle', () => {
    const state = freshBattle(['gloop'], 2);
    const r = reduce(state, { type: 'flee' }, rngSeq([0.5]));
    expect(r.state.phase).toBe('fled');
    expect(kinds(r.events)).toContain('fled');
  });

  it('failure wastes the turn and enemies act', () => {
    const state = freshBattle(['gloop'], 2);
    const r = reduce(state, { type: 'flee' }, rngSeq([0.9, 0.0, 0.5]));
    expect(r.state.phase).toBe('player');
    expect(kinds(r.events)).toContain('fleeFail');
    expect(kinds(r.events)).toContain('enemyMove');
  });
});

describe('ui snapshots track the playback step by step', () => {
  it('mp drops at the cast, enemy hp per hit, player hp per enemy attack', () => {
    const state = freshBattle(['gloop', 'gloop'], 2, (gs) => {
      gs.player.spells[0] = makeSpell('ember', 'bolt', 'echo');
    });
    const { events } = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([
        0.5,
        0.99,
        0.99, // hit 1
        0.5,
        0.99,
        0.99, // hit 2
        0.0,
        0.5, // enemy A acts
        0.0,
        0.5, // enemy B acts
      ]),
    );
    const cast = find(events, 'playerCast')[0];
    // cost is paid when the cast event shows, hp untouched
    expect(cast?.ui.player.mp).toBe(22 - 9);
    expect(cast?.ui.player.hp).toBe(46);

    // echo hits land one at a time on the snapshot
    const hits = find(events, 'enemyHit');
    expect(hits[0]?.ui.enemies[0]?.hp).toBe(hits[0]?.hpAfter);
    expect(hits[1]?.ui.enemies[0]?.hp).toBe(hits[1]?.hpAfter);
    expect((hits[0]?.ui.enemies[0]?.hp ?? 0) > (hits[1]?.ui.enemies[0]?.hp ?? 0)).toBe(true);
    // the other gloop is untouched in both snapshots
    expect(hits[0]?.ui.enemies[1]?.hp).toBe(hits[0]?.ui.enemies[1]?.maxhp);

    // player hp falls per enemy attack, not all at once
    const playerHits = find(events, 'playerHit');
    expect(playerHits).toHaveLength(2);
    expect(playerHits[0]?.ui.player.hp).toBe(playerHits[0]?.hpAfter);
    expect(playerHits[1]?.ui.player.hp).toBe(playerHits[1]?.hpAfter);
    expect((playerHits[0]?.ui.player.hp ?? 0) > (playerHits[1]?.ui.player.hp ?? 0)).toBe(true);
    // mp in the enemy-attack snapshot still only reflects the cast cost
    expect(playerHits[0]?.ui.player.mp).toBe(22 - 9);
  });

  it('focus and veil snapshots carry restored values and shield', () => {
    const state = freshBattle(['gloop'], 4, (gs) => {
      gs.player.spells[0] = makeSpell('ember', 'veil', 'none');
      gs.player.hp = 20;
    });
    const r = reduce(state, { type: 'cast', slot: 0 }, rngSeq([0.0, 0.5, 0.99]));
    const veilUp = find(r.events, 'veilUp')[0];
    expect(veilUp?.ui.player.shield).toBe(13);
    const hit = find(r.events, 'playerHit')[0];
    expect(hit?.ui.player.shield).toBe(2); // 13 shield - 11 absorbed
  });
});

describe('Bogmaw submerge state machine', () => {
  function bogmawBattle(playerLv = 4): BattleState {
    const gs = newGame();
    gs.player.lv = playerLv;
    gs.player.maxhp = 70;
    gs.player.hp = 70;
    gs.player.maxmp = 34;
    gs.player.mp = 34;
    gs.player.spells[0] = makeSpell('volt', 'bolt', 'none');
    gs.player.spells[1] = makeSpell('ember', 'bolt', 'none');
    return initBossBattle(gs, 'bogmaw', 'hearthvale.marsh').state;
  }

  /** Focus through two boss turns so turn 3 is the dive. */
  function reachSubmerge(state: BattleState): BattleState {
    let s = state;
    s = reduce(s, { type: 'focus' }, rngSeq([0.0, 0.5])).state;
    s = reduce(s, { type: 'focus' }, rngSeq([0.0, 0.5])).state;
    const r = reduce(s, { type: 'focus' }, rngSeq([]));
    expect(kinds(r.events)).toContain('bossSubmerge');
    return r.state;
  }

  it('opens with the canon intro line and boss flags', () => {
    const gs = newGame();
    const { state, events } = initBossBattle(gs, 'bogmaw', 'hearthvale.marsh');
    expect(state.boss).toBe(true);
    expect(state.enemies[0]?.hp).toBe(150);
    expect(state.enemies[0]?.lv).toBe(4);
    const intro = find(events, 'bossIntro')[0];
    expect(intro?.text).toBe('The marsh heaves. Bogmaw surfaces!');
  });

  it('submerges on its third acted turn instead of attacking', () => {
    const state = reachSubmerge(bogmawBattle());
    expect(state.bossState).toEqual({
      kind: 'submerge',
      turns: 3,
      submerged: true,
      breachArmed: true,
    });
  });

  it('non-volt spells find only water while it is submerged', () => {
    const state = reachSubmerge(bogmawBattle());
    const hpBefore = state.enemies[0]?.hp ?? 0;
    const mpBefore = state.player.mp;
    // ember bolt: the miss consumes no combat rng; the unanswered dive
    // becomes Crashing Breach at 1.6 on the boss turn [variance only].
    const r = reduce(state, { type: 'cast', slot: 1, target: 0 }, rngSeq([0.5]));
    expect(kinds(r.events)).toContain('miss');
    expect(find(r.events, 'enemyHit')).toHaveLength(0);
    expect(r.state.enemies[0]?.hp).toBe(hpBefore);
    expect(r.state.player.mp).toBe(mpBefore - 6);
    const breach = find(r.events, 'enemyMove')[0];
    expect(breach?.move).toBe('Crashing Breach');
    // atkRaw 17 * 1.6 * 1.0 variance = 27.2 -> 27
    expect(find(r.events, 'playerHit')[0]?.amount).toBe(27);
    expect(r.state.bossState?.kind === 'submerge' && r.state.bossState.submerged).toBe(false);
  });

  it('a volt hit strikes at x2.0, cancels the breach, and stuns it', () => {
    const state = reachSubmerge(bogmawBattle());
    // volt bolt: var 1.0, no crit, proc roll unused after forced stun
    const r = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 0.99, 0.99]));
    const hit = find(r.events, 'enemyHit')[0];
    expect(hit?.mult).toBe(2.0);
    // Lv4 volt bolt power: round(13 * 1.66) = 22; x2.0 = 44
    expect(hit?.amount).toBe(44);
    expect(find(r.events, 'bossSurface')[0]?.reason).toBe('shocked');
    expect(find(r.events, 'enemyStatus')[0]?.status).toBe('stunned');
    // the stunned boss skips: no breach, no damage to the player
    expect(kinds(r.events)).toContain('enemySkip');
    expect(find(r.events, 'playerHit')).toHaveLength(0);
    expect(r.state.bossState).toEqual({
      kind: 'submerge',
      turns: 3,
      submerged: false,
      breachArmed: false,
    });
  });

  it('the dive cycle resumes after the counter: next dive 3 acted turns later', () => {
    let state = reachSubmerge(bogmawBattle());
    state = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 0.99, 0.99])).state;
    // boss acted turns: 4 and 5 attack, 6 dives again
    let r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    expect(kinds(r.events)).toContain('enemyMove');
    r = reduce(r.state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    expect(kinds(r.events)).toContain('enemyMove');
    r = reduce(r.state, { type: 'focus' }, rngSeq([]));
    expect(kinds(r.events)).toContain('bossSubmerge');
    expect(r.state.bossState?.kind === 'submerge' ? r.state.bossState.turns : -1).toBe(6);
  });

  it('flee is disabled and victory claims the sigil with 60 xp', () => {
    const gs = newGame();
    gs.player.lv = 4;
    const init = initBossBattle(gs, 'bogmaw', 'hearthvale.marsh');
    expect(() => reduce(init.state, { type: 'flee' }, rngSeq([]))).toThrow('boss');

    const state = init.state;
    state.enemies[0]!.hp = 0;
    state.phase = 'victory';
    const { state: committed, xpGained } = commitBattle(gs, state);
    expect(xpGained).toBe(60);
    expect(committed.world.bosses.bogmaw).toBe(true);
    expect(committed.stats.battles).toBe(1);
  });
});

describe('Thornveil Warden: summons and Bramble Veil', () => {
  function thornveilBattle(): BattleState {
    const gs = newGame();
    gs.player.lv = 6;
    gs.player.maxhp = 86;
    gs.player.hp = 86;
    gs.player.maxmp = 42;
    gs.player.mp = 42;
    gs.player.spells[0] = makeSpell('ember', 'bolt', 'none');
    return initBossBattle(gs, 'thornveil', 'westwood.deep').state;
  }

  it('summons two Lv 3 Thornlings the turn it falls below 60%', () => {
    const state = thornveilBattle();
    state.enemies[0]!.hp = 95; // below 165 * 0.6 = 99
    const r = reduce(state, { type: 'focus' }, rngSeq([]));
    const summon = find(r.events, 'bossSummon')[0];
    expect(summon?.spawned.map((s) => s.name)).toEqual(['Thornling A', 'Thornling B']);
    expect(r.state.enemies).toHaveLength(3);
    expect(r.state.enemies[1]?.lv).toBe(3);
    expect(r.state.enemies[1]?.hp).toBe(30 + 9 * 3);
    // the wave replaces its attack, and the summons wait a round
    expect(find(r.events, 'playerHit')).toHaveLength(0);
    expect(r.state.bossState).toEqual({ kind: 'summonVeil', turns: 1, summoned: true });
  });

  it('summons act from the following round, left to right', () => {
    const state = thornveilBattle();
    state.enemies[0]!.hp = 95;
    let r = reduce(state, { type: 'focus' }, rngSeq([]));
    // boss (attack) + two thornlings (attack each): [move, var] x3
    r = reduce(r.state, { type: 'focus' }, rngSeq([0.0, 0.5, 0.0, 0.5, 0.0, 0.5]));
    expect(find(r.events, 'playerHit')).toHaveLength(3);
  });

  it('casts Bramble Veil (shield 30) every 4th acted turn', () => {
    const state = thornveilBattle();
    // keep hp above the summon threshold so turns 1-3 are plain attacks
    let r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    r = reduce(r.state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    r = reduce(r.state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    r = reduce(r.state, { type: 'focus' }, rngSeq([]));
    const shield = find(r.events, 'enemyShield')[0];
    expect(shield?.amount).toBe(30);
    expect(find(r.events, 'enemyMove')[0]?.move).toBe('Bramble Veil');
    expect(find(r.events, 'playerHit')).toHaveLength(0);
    expect(r.state.enemies[0]?.shield).toBe(30);
  });
});

describe('Ashen Warden: enrage', () => {
  function ashenBattle(): BattleState {
    const gs = newGame();
    gs.player.lv = 8;
    gs.player.maxhp = 102;
    gs.player.hp = 102;
    gs.player.maxmp = 50;
    gs.player.mp = 50;
    gs.player.spells[0] = makeSpell('rime', 'bolt', 'none');
    return initBossBattle(gs, 'ashenwarden', 'ashenreach.inner').state;
  }

  it('announces once below 30% and hits 40% harder from that turn', () => {
    const state = ashenBattle();
    state.enemies[0]!.hp = 60; // below 215 * 0.3 = 64.5
    // brand (move roll 0): atkRaw 20 * 0.9 * 1.0 var * 1.4 = 25.2 -> 25
    const r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.5, 0.99]));
    expect(kinds(r.events)).toContain('bossEnrage');
    expect(find(r.events, 'playerHit')[0]?.amount).toBe(25);
    expect(r.state.bossState).toEqual({ kind: 'enrage', enraged: true });

    // no second announcement on later turns
    const r2 = reduce(r.state, { type: 'focus' }, rngSeq([0.0, 0.5, 0.99]));
    expect(find(r2.events, 'bossEnrage')).toHaveLength(0);
  });

  it('weights collapsing pillar up while enraged', () => {
    const state = ashenBattle();
    state.enemies[0]!.hp = 60;
    // enraged weights: brand 1, pyre 1, pillar 2 -> roll 0.6 * 4 = 2.4 lands on pillar
    const r = reduce(state, { type: 'focus' }, rngSeq([0.6, 0.5]));
    expect(find(r.events, 'enemyMove')[0]?.move).toBe('collapsing pillar');
    // 20 * 1.3 * 1.0 * 1.4 = 36.4 -> 36
    expect(find(r.events, 'playerHit')[0]?.amount).toBe(36);
  });

  it('victory over a Warden claims its sigil', () => {
    const gs = newGame();
    const state = initBossBattle(gs, 'thornveil', 'westwood.deep').state;
    state.enemies[0]!.hp = 0;
    state.phase = 'victory';
    const { state: committed, xpGained } = commitBattle(gs, state);
    expect(committed.world.bosses.thornveil).toBe(true);
    expect(xpGained).toBe(110);
  });
});

describe('Vale Wraith: attunement, phases, Doom', () => {
  function wraithBattle(playerLv = 11): BattleState {
    const gs = newGame();
    gs.player.lv = playerLv;
    gs.player.maxhp = 126;
    gs.player.hp = 126;
    gs.player.maxmp = 62;
    gs.player.mp = 62;
    gs.player.spells[0] = makeSpell('ember', 'bolt', 'none');
    gs.player.spells[1] = makeSpell('rime', 'bolt', 'none');
    return initBossBattle(gs, 'valewraith', null).state;
  }

  it('attunes on its first turn and shifts every 2 turns in phase 1', () => {
    let state = wraithBattle();
    // T1: attune pick (0 -> ember from the 5-pool), move reaps, variance
    let r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.0, 0.5]));
    const attune = find(r.events, 'bossAttune')[0];
    expect(attune?.element).toBe('ember');
    expect(attune?.first).toBe(true);
    state = r.state;
    // T2: no shift (shiftIn 2 -> 1): only move + variance
    r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    expect(find(r.events, 'bossAttune')).toHaveLength(0);
    state = r.state;
    // T3: shift again
    r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.0, 0.5]));
    expect(find(r.events, 'bossAttune')).toHaveLength(1);
    expect(find(r.events, 'bossAttune')[0]?.first).toBe(false);
  });

  it('attuned element strikes at x1.8, all others at x0.85', () => {
    let state = wraithBattle();
    state = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.0, 0.5])).state; // attuned ember
    // ember bolt at Lv 11: power 42; x1.8 = 75.6 -> 76
    let r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 0.99, 0.99, 0.0, 0.5]),
    );
    expect(find(r.events, 'enemyHit')[0]?.amount).toBe(76);
    expect(find(r.events, 'enemyHit')[0]?.mult).toBe(1.8);
    // rime bolt: x0.85 = 35.7 -> 36
    r = reduce(
      r.state,
      { type: 'cast', slot: 1, target: 0 },
      rngSeq([0.5, 0.99, 0.99, 0.0, 0.0, 0.5]),
    );
    expect(find(r.events, 'enemyHit')[0]?.amount).toBe(36);
    expect(find(r.events, 'enemyHit')[0]?.mult).toBe(0.85);
  });

  it('phase 2 at 50%: summons two Hollowshades, then shifts every turn', () => {
    let state = wraithBattle();
    state = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.0, 0.5])).state;
    state.enemies[0]!.hp = 140; // below 300 * 0.5
    let r = reduce(state, { type: 'focus' }, rngSeq([]));
    const summon = find(r.events, 'bossSummon')[0];
    expect(summon?.spawned).toHaveLength(2);
    expect(r.state.enemies[1]?.species).toBe('hollowshade');
    expect(r.state.enemies[1]?.lv).toBe(8);
    state = r.state;
    // every wraith turn now shifts: [attune, wraith move+var, 2x shade move+var]
    r = reduce(state, { type: 'focus' }, rngSeq([0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5]));
    expect(find(r.events, 'bossAttune')).toHaveLength(1);
    r = reduce(r.state, { type: 'focus' }, rngSeq([0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5]));
    expect(find(r.events, 'bossAttune')).toHaveLength(1);
  });

  it('phase 3: telegraphs Doom, then strikes at 2.6x next turn', () => {
    const state = wraithBattle();
    const bs = state.bossState;
    if (bs?.kind === 'attune') {
      bs.element = 'ember';
      bs.shiftIn = 99; // hold the aura still for the test
      bs.summoned = true;
    }
    state.enemies[0]!.hp = 55; // below 300 * 0.2 = 60
    // telegraph turn: no attack, no rng beyond none
    let r = reduce(state, { type: 'focus' }, rngSeq([]));
    expect(find(r.events, 'bossDoom')[0]?.name).toBe('Doom of the Vale');
    expect(find(r.events, 'playerHit')).toHaveLength(0);
    // doom turn: 22.35 * 2.6 * 1.0 = 58.1 -> 58
    r = reduce(r.state, { type: 'focus' }, rngSeq([0.5]));
    expect(find(r.events, 'enemyMove')[0]?.move).toBe('Doom of the Vale');
    expect(find(r.events, 'playerHit')[0]?.amount).toBe(58);
    // the cycle re-arms
    r = reduce(r.state, { type: 'focus' }, rngSeq([]));
    expect(find(r.events, 'bossDoom')).toHaveLength(1);
  });

  it('Doom is blunted by chill and absorbed by a veil (listed counters)', () => {
    const state = wraithBattle();
    const bs = state.bossState;
    if (bs?.kind === 'attune') {
      bs.element = 'rime';
      bs.shiftIn = 99;
      bs.summoned = true;
      bs.doomArmed = true;
    }
    state.enemies[0]!.hp = 55;
    state.enemies[0]!.statuses.chilled = 2;
    state.player.veil = {
      spell: makeSpell('rime', 'veil', 'none'),
      shield: 25,
      absorbed: 0,
      reapplied: false,
    };
    // chilled doom: 22.35 * 2.6 * 0.65 = 37.8 -> 38; veil absorbs 25, 13 through
    const r = reduce(state, { type: 'focus' }, rngSeq([0.5, 0.99]));
    const hit = find(r.events, 'playerHit')[0];
    expect(hit?.amount).toBe(38);
    expect(hit?.absorbed).toBe(25);
    expect(r.state.player.hp).toBe(126 - 13);
  });

  it('felling the Wraith claims no xp but marks the world', () => {
    const gs = newGame();
    const state = initBossBattle(gs, 'valewraith', null).state;
    state.enemies[0]!.hp = 0;
    state.phase = 'victory';
    const { state: committed, xpGained } = commitBattle(gs, state);
    expect(xpGained).toBe(0);
    expect(committed.world.bosses.valewraith).toBe(true);
  });
});

describe('commits', () => {
  it('victory awards summed xp, counts the battle, grants 4 grace steps', () => {
    const gs = newGame();
    const state = initBattle(gs, ['gloop', 'gloop'], 2, 'hearthvale.meadow').state;
    for (const e of state.enemies) e.hp = 0;
    state.phase = 'victory';
    const { state: committed, xpGained, levelsGained } = commitBattle(gs, state);
    // gloop xp = 11 + 3*2 = 17 each
    expect(xpGained).toBe(34);
    expect(committed.stats.battles).toBe(1);
    expect(committed.world.graceSteps).toBe(4);
    expect(levelsGained).toEqual([2]); // 34 >= 18, carries 16 into Lv2
    expect(committed.player.lv).toBe(2);
    expect(committed.player.xp).toBe(16);
    expect(committed.player.statuses).toEqual({});
  });

  it('defeat restores fully and respawns at the recorded point with 6 grace steps', () => {
    const gs = newGame();
    gs.world.mapId = 'hearthvale';
    gs.world.x = 40;
    gs.world.y = 30;
    gs.world.respawn = { mapId: 'hearth', x: 21, y: 7 };
    const state = initBattle(gs, ['gloop'], 4, 'hearthvale.marsh').state;
    state.phase = 'defeat';
    state.player.hp = 0;
    const { state: committed } = commitBattle(gs, state);
    expect(committed.stats.defeats).toBe(1);
    expect(committed.stats.battles).toBe(0);
    expect(committed.player.hp).toBe(committed.player.maxhp);
    expect(committed.world.mapId).toBe('hearth');
    expect(committed.world.x).toBe(21);
    expect(committed.world.y).toBe(7);
    expect(committed.world.graceSteps).toBe(6);
  });

  it('fleeing keeps battle hp/mp, counts nothing, grants 4 grace steps', () => {
    const gs = newGame();
    const state = initBattle(gs, ['gloop'], 2, null).state;
    state.phase = 'fled';
    state.player.hp = 30;
    state.player.mp = 10;
    const { state: committed, xpGained } = commitBattle(gs, state);
    expect(xpGained).toBe(0);
    expect(committed.stats.battles).toBe(0);
    expect(committed.player.hp).toBe(30);
    expect(committed.player.mp).toBe(10);
    expect(committed.world.graceSteps).toBe(4);
  });

  it('reduce refuses to run on a finished battle', () => {
    const state = freshBattle(['gloop'], 2);
    state.phase = 'victory';
    expect(() => reduce(state, { type: 'focus' }, rngSeq([]))).toThrow('battle is over');
  });
});
