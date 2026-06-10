/**
 * The discovery layer (docs/03 sections 19-21, 24): charm effects,
 * active relic runes, scrolls, gates, commissions, and spell codes.
 */
import { describe, expect, it } from 'vitest';
import type { Rng } from '../src/core/rng.ts';
import { newGame } from '../src/core/save.ts';
import { makeSpell } from '../src/systems/spellcraft.ts';
import { battleEssence, commitBattle, initBattle, reduce } from '../src/systems/battle.ts';
import {
  applyGateOpen,
  commissionSatisfied,
  gateById,
  gateOpeners,
} from '../src/systems/worldstate.ts';
import { exportCode, importCode } from '../src/systems/spellcodes.ts';
import { resolveStep } from '../src/systems/encounters.ts';
import { mulberry32 } from '../src/core/rng.ts';
import { CHARM, GATES, gateFlag, SCROLL } from '../src/data/discovery.ts';

function rngSeq(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i];
    if (v === undefined) throw new Error(`rngSeq exhausted at draw ${String(i)}`);
    i += 1;
    return v;
  };
}

function ready(
  spells: ReturnType<typeof makeSpell>[],
  charms: string[] = [],
): ReturnType<typeof newGame> {
  const gs = newGame();
  gs.player.starter = 'ember';
  gs.player.spells = [...spells, null, null, null, null, null].slice(0, 6);
  gs.player.charms.owned = [...charms];
  gs.player.charms.equipped = [charms[0] ?? null, charms[1] ?? null];
  return gs;
}

describe('charms in battle (03 section 20)', () => {
  it('emberknot opens every battle with a 10-point shield', () => {
    const { state } = initBattle(
      ready([makeSpell('ember', 'bolt', 'none')], ['emberknot']),
      ['gloop'],
      2,
      'hearthvale.meadow',
    );
    expect(state.player.veil?.shield).toBe(CHARM.emberknotShield);
  });

  it('stillmind Focus cleanses every status at once', () => {
    const init = initBattle(
      ready([makeSpell('ember', 'bolt', 'none')], ['stillmind']),
      ['gloop'],
      2,
      'hearthvale.meadow',
    );
    init.state.player.statuses = ['burning', 'chilled', 'withered'];
    const r = reduce(init.state, { type: 'focus' }, rngSeq([0.0, 0.5]));
    expect(r.state.player.statuses).toEqual([]);
    expect(r.events.filter((e) => e.kind === 'playerCleanse')).toHaveLength(3);
  });

  it('longbrand stretches applied statuses by a turn', () => {
    const init = initBattle(
      ready([makeSpell('thorn', 'bolt', 'none')], ['longbrand']),
      ['pondscale'],
      2,
      'hearthvale.marsh',
    );
    init.state.enemies[0]!.hp = 500;
    // proc succeeds (0.0): envenomed 3 + 1 longbrand, then end-of-turn
    // bookkeeping does not decay dots until they tick
    const r = reduce(
      init.state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 0.0, 0.0, 0.5]),
    );
    expect(r.state.enemies[0]?.statuses.envenomed).toBe(3 + CHARM.longbrandBonusTurns - 1);
  });

  it('graverobber pays one extra essence per victory', () => {
    const init = initBattle(ready([], ['graverobber']), ['gloop'], 2, 'hearthvale.meadow');
    for (const e of init.state.enemies) e.hp = 0;
    init.state.phase = 'victory';
    expect(battleEssence(init.state)).toBe(1 + CHARM.graverobberEssence);
  });

  it('wheelwright multiplies reaction portions by 1.2', () => {
    const init = initBattle(
      ready([makeSpell('rime', 'bolt', 'none')], ['wheelwright']),
      ['pondscale'],
      2,
      'hearthvale.marsh',
    );
    init.state.enemies[0]!.hp = 500;
    init.state.enemies[0]!.statuses.burning = 2;
    const r = reduce(
      init.state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    const reaction = r.events.find((e) => e.kind === 'reaction');
    // scald 12 (Lv 1) * 1.2 = 14.4 -> 14
    expect(reaction && 'amount' in reaction && reaction.amount).toBe(14);
  });

  it('springstep regen ticks every 4 steps', () => {
    const rng = mulberry32(3);
    const at = (n: number, every: number): boolean =>
      resolveStep(
        {
          tile: '.',
          zone: null,
          graceSteps: 0,
          stepCount: n,
          playerLv: 3,
          eliteEligible: false,
          regenEvery: every,
        },
        rng,
      ).regen;
    expect(at(4, CHARM.springstepRegen)).toBe(true);
    expect(at(4, 6)).toBe(false);
    expect(at(6, 6)).toBe(true);
  });
});

describe('relic runes activate (03 section 3)', () => {
  it('emberglass turns resists neutral: ember vs pondscale deals full', () => {
    const init = initBattle(
      ready([makeSpell('ember', 'bolt', 'emberglass')]),
      ['pondscale'],
      2,
      'hearthvale.marsh',
    );
    init.state.enemies[0]!.hp = 500;
    const r = reduce(
      init.state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    const hit = r.events.find((e) => e.kind === 'enemyHit');
    if (hit && 'mult' in hit) expect(hit.mult).toBe(1);
    if (hit && 'amount' in hit) expect(hit.amount).toBe(13);
  });

  it('stillwater floors variance at 1.0 (a zero roll still hits full)', () => {
    const init = initBattle(
      ready([makeSpell('ember', 'bolt', 'stillwater')]),
      ['gloop'],
      2,
      'hearthvale.meadow',
    );
    init.state.enemies[0]!.hp = 500;
    const r = reduce(
      init.state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.0, 1.0, 1.0, 0.0, 0.5]),
    );
    const hit = r.events.find((e) => e.kind === 'enemyHit');
    // variance 0.0 roll -> 1.0 floor: 13 * 1.0 * 1.6 = 20.8 -> 21
    if (hit && 'amount' in hit) expect(hit.amount).toBe(21);
  });

  it('hollowlight refunds the full cost on a kill', () => {
    const gs = ready([makeSpell('ember', 'bolt', 'hollowlight')]);
    const init = initBattle(gs, ['gloop'], 1, 'hearthvale.meadow');
    init.state.enemies[0]!.hp = 5;
    const mp0 = init.state.player.mp;
    const r = reduce(init.state, { type: 'cast', slot: 0, target: 0 }, rngSeq([0.5, 1.0]));
    expect(r.state.phase).toBe('victory');
    expect(r.state.player.mp).toBe(mp0); // cost paid, then refunded
  });
});

describe('scrolls (03 section 24)', () => {
  it('casts the held composition at potency 2.5 for 0 MP, once', () => {
    const gs = ready([]);
    gs.player.scrolls = [makeSpell('ember', 'bolt', 'none')];
    const init = initBattle(gs, ['gloop'], 2, 'hearthvale.meadow');
    init.state.enemies[0]!.hp = 500;
    init.state.enemies[0]!.maxhp = 500;
    const mp0 = init.state.player.mp;
    const r = reduce(
      init.state,
      { type: 'scroll', index: 0, target: 0 },
      // scroll at p2.5 surges below tier 2: [var, crit, proc, d10, enemy move, var]
      rngSeq([0.5, 1.0, 1.0, 0.05, 0.0, 0.5]),
    );
    const hit = r.events.find((e) => e.kind === 'enemyHit');
    // 13 * 2.5 = 32.5 -> 33 power; x1.6 weak = 52.8 -> 52? power rounds first: round(32.5)=33; 33*1.6=52.8->53
    if (hit && 'amount' in hit) expect(hit.amount).toBe(53);
    expect(r.state.player.mp).toBe(mp0);
    expect(r.state.player.scrolls).toHaveLength(0);
    // and the spent scroll persists through commit
    const survived = structuredClone(r.state);
    for (const e of survived.enemies) e.hp = 0;
    survived.phase = 'victory';
    const committed = commitBattle(gs, survived);
    expect(committed.state.player.scrolls).toHaveLength(0);
  });

  it('scroll cap is 3, scrollsash lifts it to 4 (data)', () => {
    expect(SCROLL.cap).toBe(3);
    expect(CHARM.scrollsashCap).toBe(4);
  });
});

describe('element gates (03 section 19)', () => {
  it('lists inscribed spells of the right element, never veils', () => {
    const gs = ready([
      makeSpell('ember', 'bolt', 'none'),
      makeSpell('ember', 'veil', 'none'),
      makeSpell('rime', 'lance', 'none'),
    ]);
    const briarfall = gateById('briarfall');
    expect(briarfall).not.toBeNull();
    if (!briarfall) return;
    const openers = gateOpeners(gs, briarfall);
    expect(openers.map((o) => o.slot)).toEqual([0]);
    const shed = gateById('shed');
    if (!shed) return;
    // 'any' gates accept any damaging element
    expect(gateOpeners(gs, shed).map((o) => o.slot)).toEqual([0, 2]);
  });

  it('opening pays the MP, sets the flag once, and never re-opens', () => {
    const gs = ready([makeSpell('ember', 'bolt', 'none')]);
    const gate = gateById('briarfall');
    if (!gate) return;
    const opened = applyGateOpen(gs, gate, 6);
    expect(opened).not.toBeNull();
    expect(opened?.player.mp).toBe(gs.player.mp - 6);
    expect(opened?.world.flags[gateFlag('briarfall')]).toBe(true);
    // second open attempt: refused (the cache pays exactly once)
    expect(opened && applyGateOpen(opened, gate, 6)).toBeNull();
  });

  it('all nine gates exist with their 03 placements', () => {
    expect(GATES).toHaveLength(9);
    expect(GATES.filter((g) => g.map === 'hearthvale')).toHaveLength(2);
    expect(GATES.filter((g) => g.map === 'northhollow')).toHaveLength(2);
  });
});

describe('commission predicates (03 section 21)', () => {
  it('fisher: ember veil; scout: volt lance at >= 1.2; dreamer: gloom nova', () => {
    const gs = ready([]);
    expect(commissionSatisfied(gs, 'fisher')).toBe(false);
    gs.player.spells[0] = makeSpell('ember', 'veil', 'none');
    expect(commissionSatisfied(gs, 'fisher')).toBe(true);
    expect(commissionSatisfied(gs, 'scout')).toBe(false);
    gs.player.spells[1] = makeSpell('volt', 'lance', 'none', 1.2);
    expect(commissionSatisfied(gs, 'scout')).toBe(true);
    gs.player.spells[2] = makeSpell('volt', 'lance', 'none', 1.15);
    expect(commissionSatisfied(gs, 'dreamer')).toBe(false);
    gs.player.spells[3] = makeSpell('gloom', 'nova', 'hex');
    expect(commissionSatisfied(gs, 'dreamer')).toBe(true);
    // keeper waits for twins (Phase 14)
    expect(commissionSatisfied(gs, 'keeper')).toBe(false);
  });
});

describe('spell codes (03 section 24)', () => {
  it('round-trips composition, potency, and the given name', () => {
    const spell = makeSpell('rime', 'lance', 'keen', 1.45);
    spell.given = 'Coldsnap';
    const code = exportCode(spell);
    expect(code.startsWith('sb1:')).toBe(true);
    const gs = ready([]);
    gs.player.lv = 12;
    gs.world.shrines.keen = true;
    const result = importCode(code, gs);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spell).toEqual({
        element: 'rime',
        form: 'lance',
        rune: 'keen',
        p: 1.45,
        given: 'Coldsnap',
      });
    }
  });

  it('names exactly the missing parts and grants nothing', () => {
    const code = exportCode(makeSpell('gloom', 'nova', 'keen', 1.5));
    const gs = ready([]); // Lv 1 ember starter: no gloom, no nova, no keen
    const result = importCode(code, gs);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'missing') {
      expect(result.parts).toEqual(['Gloom', 'the Nova form', 'the Keen rune']);
    } else {
      throw new Error('expected missing parts');
    }
  });

  it('rejects garbage politely', () => {
    const gs = ready([]);
    expect(importCode('sb1:!!!!', gs)).toEqual({ ok: false, reason: 'malformed' });
    expect(importCode('hello', gs)).toEqual({ ok: false, reason: 'malformed' });
    expect(importCode('sb1:' + Buffer.from('{"v":9}').toString('base64'), gs)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});
