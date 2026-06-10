/**
 * Act 4 (docs/03 sections 22-23): the Call familiar, trial stones,
 * and the Hollow Warden's three shape-keyed bars with Unwriting.
 *
 * Familiar hit = [variance, crit, proc] per hit; enemy attack with a
 * familiar up = [movePick, variance, redirect]. Sealed trial hits add
 * only the proc draws (the blow itself is nulled, no variance/crit).
 */
import { describe, expect, it } from 'vitest';
import type { Rng } from '../src/core/rng.ts';
import { newGame } from '../src/core/save.ts';
import type { Spell } from '../src/core/state.ts';
import { makeSpell, spellCost } from '../src/systems/spellcraft.ts';
import {
  commitBattle,
  initBattle,
  initBossBattle,
  reduce,
  type BattleEvent,
  type BattleState,
} from '../src/systems/battle.ts';
import { FAMILIAR } from '../src/data/forms.ts';

function rngSeq(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i];
    if (v === undefined) throw new Error(`rngSeq exhausted at draw ${String(i)}`);
    i += 1;
    return v;
  };
}

function ready(spells: (Spell | null)[]): ReturnType<typeof newGame> {
  const gs = newGame();
  gs.player.starter = 'ember';
  gs.player.spells = [...spells, null, null, null, null, null].slice(0, 6);
  return gs;
}

function find<K extends BattleEvent['kind']>(
  events: BattleEvent[],
  kind: K,
): Extract<BattleEvent, { kind: K }>[] {
  return events.filter((e): e is Extract<BattleEvent, { kind: K }> => e.kind === kind);
}

/* ---------- the Call familiar (03 section 22) ---------- */

function callArena(callSpell: Spell): BattleState {
  const state = initBattle(ready([callSpell]), ['pondscale'], 2, 'hearthvale.marsh').state;
  const foe = state.enemies[0];
  if (foe) {
    foe.hp = 500;
    foe.maxhp = 500;
  }
  state.player.hp = 200;
  state.player.maxhp = 200;
  return state;
}

describe('the Call familiar (03 section 22)', () => {
  it('Call costs round(6 * 1.7) = 10 MP', () => {
    expect(spellCost(makeSpell('ember', 'call', 'none'))).toBe(10);
  });

  it('summons at round((20 + 6lv) * p) hp and acts the same round', () => {
    const state = callArena(makeSpell('ember', 'call', 'none'));
    const r = reduce(state, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.9]));
    const summon = find(r.events, 'familiarSummon')[0];
    expect(summon?.hp).toBe(26); // (20 + 6*1) * 1.0 at player Lv 1
    expect(r.state.familiar?.maxhp).toBe(26);
    // It already fights: one ember hit at Call power into the resist.
    expect(find(r.events, 'familiarAct')).toHaveLength(1);
    // round(round(13 * 0.55) * 1.0 * 0.6) = round(7 * 0.6) = 4
    expect(find(r.events, 'enemyHit')[0]?.amount).toBe(4);
  });

  it('a recast replaces the old familiar', () => {
    const state = callArena(makeSpell('ember', 'call', 'none'));
    const r1 = reduce(state, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.9]));
    r1.state.familiar!.hp = 3;
    const r2 = reduce(r1.state, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.9]));
    expect(find(r2.events, 'familiarFade')[0]?.reason).toBe('replaced');
    expect(r2.state.familiar?.hp).toBe(26);
  });

  it('an echo familiar strikes twice', () => {
    const state = callArena(makeSpell('ember', 'call', 'echo'));
    const r = reduce(
      state,
      { type: 'cast', slot: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.5, 1.0, 1.0, 0.0, 0.5, 0.9]),
    );
    expect(find(r.events, 'enemyHit')).toHaveLength(2);
  });

  it('a thirst familiar feeds its keeper', () => {
    const state = callArena(makeSpell('ember', 'call', 'thirst'));
    state.player.hp = 100;
    const r = reduce(state, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.9]));
    const heal = find(r.events, 'playerHeal')[0];
    expect(heal).toBeDefined();
    expect(r.state.player.hp).toBeGreaterThan(100 - 20); // healed, then hit
  });

  it('a hex familiar marks at the full element proc', () => {
    // Draw 0.3: under ember 0.35 with hex, over 0.175 without.
    const hexed = callArena(makeSpell('ember', 'call', 'hex'));
    const r1 = reduce(hexed, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 0.3, 0.0, 0.5, 0.9]));
    expect(r1.state.enemies[0]?.statuses.burning).toBeDefined();
    const plain = callArena(makeSpell('ember', 'call', 'none'));
    const r2 = reduce(plain, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 0.3, 0.0, 0.5, 0.9]));
    expect(r2.state.enemies[0]?.statuses.burning).toBeUndefined();
  });

  it('a twin Call alternates its nature each round', () => {
    const state = callArena({ ...makeSpell('ember', 'call', 'none'), e2: 'rime' });
    const r1 = reduce(state, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.9]));
    expect(find(r1.events, 'familiarAct')[0]?.element).toBe('ember');
    const r2 = reduce(r1.state, { type: 'focus' }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.9]));
    expect(find(r2.events, 'familiarAct')[0]?.element).toBe('rime');
  });

  it('draws 40% of enemy attacks, and falls in your place', () => {
    const state = callArena(makeSpell('ember', 'call', 'none'));
    const hpBefore = state.player.hp;
    // enemy [pick, var, redirect 0.1 < 0.4] -> the familiar takes it
    const r1 = reduce(state, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.1]));
    const hit = find(r1.events, 'familiarHit')[0];
    expect(hit?.amount).toBe(8); // atkRaw 8.4 * 1.0 * 1.0 var
    expect(r1.state.player.hp).toBe(hpBefore);
    expect(r1.state.familiar?.hp).toBe(26 - 8);

    r1.state.familiar!.hp = 5;
    const r2 = reduce(r1.state, { type: 'focus' }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 0.1]));
    expect(find(r2.events, 'familiarFade')[0]?.reason).toBe('fallen');
    expect(r2.state.familiar).toBeNull();
  });
});

/* ---------- trial stones (03 section 23) ---------- */

function trialArena(spells: (Spell | null)[]): BattleState {
  const state = initBattle(ready(spells), ['trialguardian'], 11, 'sanctum.halls', {
    trialKey: 'shatter',
  }).state;
  state.player.hp = 500;
  state.player.maxhp = 500;
  return state;
}

describe('trial stones (03 section 23)', () => {
  it('the seal nulls every blow that is not the demanded reaction', () => {
    const state = trialArena([makeSpell('ember', 'bolt', 'none')]);
    expect(state.enemies[0]?.sealed).toBe(true);
    expect(state.enemies[0]?.hp).toBe(120);
    const r = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([1.0, 0.0, 0.5]));
    const sealed = find(r.events, 'sealedHit')[0];
    expect(sealed?.demand).toBe('shatter');
    expect(r.state.enemies[0]?.hp).toBe(120);
  });

  it('marks land through the seal, and the named reaction cracks it', () => {
    const state = trialArena([
      makeSpell('rime', 'bolt', 'none'),
      makeSpell('volt', 'bolt', 'none'),
    ]);
    // Rime: sealed, no damage, but the chill takes (proc draw 0.0).
    const r1 = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.0, 0.0, 0.5]));
    expect(r1.state.enemies[0]?.hp).toBe(120);
    expect(r1.state.enemies[0]?.statuses.chilled).toBeDefined();
    // Volt on Chilled: SHATTER, the demand, breaks the seal and lands.
    const r2 = reduce(
      r1.state,
      { type: 'cast', slot: 1, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    expect(find(r2.events, 'sealBreak')).toHaveLength(1);
    expect(r2.state.enemies[0]?.sealed).toBe(false);
    // round(13 * 1.0 * 1.6 shatter) = 21
    expect(find(r2.events, 'enemyHit')[0]?.amount).toBe(21);
  });

  it('a non-demanded reaction does not crack a trial seal', () => {
    const state = trialArena([
      makeSpell('ember', 'bolt', 'none'),
      makeSpell('rime', 'bolt', 'none'),
    ]);
    // Burn it through the seal, then Scald (rime on Burning): wrong key.
    const r1 = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.0, 0.0, 0.5]));
    expect(r1.state.enemies[0]?.statuses.burning).toBeDefined();
    const r2 = reduce(r1.state, { type: 'cast', slot: 1, target: 0 }, rngSeq([0.0, 0.0, 0.5]));
    expect(find(r2.events, 'sealBreak')).toHaveLength(0);
    expect(r2.state.enemies[0]?.sealed).toBe(true);
    // The burn decays but never bites through the seal.
    expect(r2.state.enemies[0]?.hp).toBe(120);
  });

  it('a felled guardian pays its fixed 80 xp', () => {
    const state = trialArena([makeSpell('volt', 'bolt', 'none')]);
    state.enemies[0]!.sealed = false;
    state.enemies[0]!.hp = 1;
    const r = reduce(state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 1.0]));
    expect(r.state.phase).toBe('victory');
    const done = commitBattle(ready([]), r.state);
    expect(done.xpGained).toBe(80);
  });
});

/* ---------- the Hollow Warden (03 section 23) ---------- */

function wardenArena(spells: (Spell | null)[]): BattleState {
  const state = initBossBattle(ready(spells), 'hollowwarden', 'sanctum.halls').state;
  state.player.hp = 500;
  state.player.maxhp = 500;
  state.player.mp = 99;
  state.player.maxmp = 99;
  return state;
}

describe('Hollow Warden bars (03 section 23)', () => {
  it('opens at 420 hp: three bars of 140, no flee', () => {
    const state = wardenArena([]);
    expect(state.enemies[0]?.hp).toBe(420);
    expect(state.boss).toBe(true);
    expect(state.bossState).toEqual({
      kind: 'bars',
      turns: 0,
      unwriteArmed: false,
      barBrokeSinceArmed: false,
    });
  });

  it('the Choir: solo hits glance at x0.25, an all-cast sings true', () => {
    const bolt = wardenArena([
      makeSpell('volt', 'bolt', 'none'),
      makeSpell('volt', 'nova', 'none'),
    ]);
    const r1 = reduce(
      bolt,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 1.0]),
    );
    expect(find(r1.events, 'enemyHit')[0]?.amount).toBe(3); // round(13 * 0.25)
    const r2 = reduce(r1.state, { type: 'cast', slot: 1 }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 1.0]));
    expect(find(r2.events, 'enemyHit')[0]?.amount).toBe(7); // nova, on-key
  });

  it('damage clamps at the bar floor; the break announces and summons', () => {
    const state = wardenArena([makeSpell('volt', 'nova', 'none')]);
    state.enemies[0]!.hp = 281;
    const r = reduce(
      state,
      { type: 'cast', slot: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 1.0, 0.0, 0.5, 1.0]),
    );
    expect(r.state.enemies[0]?.hp).toBe(280); // clamped to the boundary
    const breaks = find(r.events, 'barBreak');
    expect(breaks[0]?.nextKey).toBe('wheel');
    expect(find(r.events, 'bossSummon')).toHaveLength(1);
    expect(r.state.enemies).toHaveLength(2); // one Hollowshade joined
  });

  it('the Wheel: only reaction hits land full', () => {
    const state = wardenArena([
      makeSpell('volt', 'nova', 'none'),
      makeSpell('volt', 'bolt', 'none'),
    ]);
    state.enemies[0]!.hp = 280; // bar 2
    const r1 = reduce(state, { type: 'cast', slot: 0 }, rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 1.0]));
    expect(find(r1.events, 'enemyHit')[0]?.amount).toBe(2); // nova glances now
    r1.state.enemies[0]!.statuses.chilled = 2;
    const r2 = reduce(
      r1.state,
      { type: 'cast', slot: 1, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 1.0]),
    );
    expect(find(r2.events, 'enemyHit')[0]?.amount).toBe(21); // shatter, on-key
  });

  it('the Author: potency at or above 1.30 writes true', () => {
    const state = wardenArena([
      { ...makeSpell('volt', 'bolt', 'none'), p: 1.5 },
      makeSpell('volt', 'bolt', 'none'),
    ]);
    state.enemies[0]!.hp = 140; // bar 3
    const r1 = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 1.0]),
    );
    expect(find(r1.events, 'enemyHit')[0]?.amount).toBe(20); // round(13*1.5)
    const r2 = reduce(
      r1.state,
      { type: 'cast', slot: 1, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5, 1.0]),
    );
    expect(find(r2.events, 'enemyHit')[0]?.amount).toBe(3); // 1.0 glances
  });
});

describe('Unwriting (03 section 23)', () => {
  function passRounds(state: BattleState, n: number): BattleState {
    let s = state;
    for (let i = 0; i < n; i++) {
      // boss turn: [movePick 0 -> hollow rend, variance, redirect-less]
      s = reduce(s, { type: 'focus' }, rngSeq([0.0, 0.5])).state;
    }
    return s;
  }

  it('arms on the 4th turn and lands x2.2 when unanswered', () => {
    let state = wardenArena([]);
    state = passRounds(state, 3);
    const r4 = reduce(state, { type: 'focus' }, rngSeq([]));
    expect(find(r4.events, 'bossUnwrite')[0]?.phase).toBe('arm');
    expect(find(r4.events, 'playerHit')).toHaveLength(0); // it only gathers
    const hpBefore = r4.state.player.hp;
    const r5 = reduce(r4.state, { type: 'focus' }, rngSeq([0.5]));
    // atkRaw 12 + 1.4*13 = 30.2; x2.2 x1.0 var = 66
    expect(hpBefore - r5.state.player.hp).toBe(66);
    expect(find(r5.events, 'enemyMove').some((e) => e.move === 'Unwriting')).toBe(true);
  });

  it('a raised veil spoils the word; a plain move comes instead', () => {
    let state = wardenArena([makeSpell('ember', 'veil', 'none')]);
    state = passRounds(state, 3);
    const r4 = reduce(state, { type: 'focus' }, rngSeq([]));
    const r5 = reduce(r4.state, { type: 'cast', slot: 0 }, rngSeq([0.0, 0.5, 1.0]));
    const cancel = find(r5.events, 'bossUnwrite')[0];
    expect(cancel?.phase).toBe('cancel');
    expect(cancel?.reason).toBe('veil');
    // The word dies, not the turn: a normal move follows into the veil.
    const moves = find(r5.events, 'enemyMove');
    expect(moves).toHaveLength(1);
    expect(moves[0]?.move).not.toBe('Unwriting');
  });

  it('a chill on the Warden spoils the word', () => {
    let state = wardenArena([]);
    state = passRounds(state, 3);
    const r4 = reduce(state, { type: 'focus' }, rngSeq([]));
    r4.state.enemies[0]!.statuses.chilled = 2;
    const r5 = reduce(r4.state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    expect(find(r5.events, 'bossUnwrite')[0]?.reason).toBe('chill');
    expect(find(r5.events, 'enemyMove')[0]?.move).not.toBe('Unwriting');
  });

  it('a bar broken since the arming spoils the word', () => {
    let state = wardenArena([]);
    state = passRounds(state, 3);
    const r4 = reduce(state, { type: 'focus' }, rngSeq([]));
    if (r4.state.bossState?.kind === 'bars') r4.state.bossState.barBrokeSinceArmed = true;
    const r5 = reduce(r4.state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    expect(find(r5.events, 'bossUnwrite')[0]?.reason).toBe('bar');
  });

  it('redirect data lives in src/data (no magic 0.4)', () => {
    expect(FAMILIAR.redirectChance).toBe(0.4);
    expect(FAMILIAR.hpBase).toBe(20);
    expect(FAMILIAR.hpPerLv).toBe(6);
  });
});
