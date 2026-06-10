/**
 * NG+ (docs/03 section 25): carry/reset rules, flat x1.5 scaling,
 * essence x2, the Warden's +2 levels, and the generous glimmer roll.
 */
import { describe, expect, it } from 'vitest';
import type { Rng } from '../src/core/rng.ts';
import { newGame } from '../src/core/save.ts';
import { makeSpell } from '../src/systems/spellcraft.ts';
import { beginNgPlus } from '../src/systems/ngplus.ts';
import { battleEssence, initBattle, initBossBattle, reduce } from '../src/systems/battle.ts';
import { resolveStep } from '../src/systems/encounters.ts';
import { BOSSES } from '../src/data/enemies.ts';
import { RARE } from '../src/data/elites.ts';

function rngSeq(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i];
    if (v === undefined) throw new Error(`rngSeq exhausted at draw ${String(i)}`);
    i += 1;
    return v;
  };
}

function veteran(): ReturnType<typeof newGame> {
  const gs = newGame();
  gs.player.lv = 12;
  gs.player.xp = 100;
  gs.player.essence = 42;
  gs.player.starter = 'rime';
  gs.player.slotsUnlocked = 6;
  gs.player.spells[0] = { ...makeSpell('gloom', 'lance', 'keen', 1.5), given: 'Nightpen' };
  gs.player.spells[5] = { ...makeSpell('ember', 'call', 'none'), e2: 'rime' };
  gs.player.mastery.volt = 50;
  gs.player.charms = { owned: ['sigilglass', 'wheelwright'], equipped: ['wheelwright', null] };
  gs.player.scrolls = [makeSpell('volt', 'bolt', 'none')];
  gs.world.bosses.bogmaw = true;
  gs.world.bosses.valewraith = true;
  gs.world.shrines.fury = true;
  gs.world.flags['rune_wraithmark'] = true;
  gs.world.flags['rune_wyrd'] = true;
  gs.world.flags['trials_complete'] = true;
  gs.world.flags['gate_shed'] = true;
  gs.feats = ['first_page', 'fourth_warden'];
  gs.bestiary = { gloop: { kills: 9, weak: ['ember'], statuses: [], reactions: [] } };
  gs.notes = ['The keeper wants two natures on one page.'];
  gs.stats.battles = 99;
  return gs;
}

describe('beginNgPlus carry and reset (03 section 25)', () => {
  it('carries grimoire, renames, mastery, charms, slots, relics, feats, bestiary', () => {
    const next = beginNgPlus(veteran());
    expect(next.player.spells[0]?.given).toBe('Nightpen');
    expect(next.player.spells[5]?.e2).toBe('rime');
    expect(next.player.slotsUnlocked).toBe(6);
    expect(next.player.starter).toBe('rime');
    expect(next.player.mastery.volt).toBe(50);
    expect(next.player.charms.owned).toContain('wheelwright');
    expect(next.world.flags['rune_wraithmark']).toBe(true);
    expect(next.feats).toContain('fourth_warden');
    expect(next.bestiary['gloop']?.kills).toBe(9);
    expect(next.stats.battles).toBe(99);
    expect(next.player.ngPlus).toBe(1);
  });

  it('resets level, essence, scrolls, notes, sigils, shrines and flags', () => {
    const next = beginNgPlus(veteran());
    expect(next.player.lv).toBe(1);
    expect(next.player.xp).toBe(0);
    expect(next.player.essence).toBe(0);
    expect(next.player.scrolls).toHaveLength(0);
    expect(next.notes).toHaveLength(0);
    expect(next.world.bosses.bogmaw).toBe(false);
    expect(next.world.bosses.valewraith).toBe(false);
    expect(next.world.shrines.fury).toBe(false);
    expect(next.world.flags['trials_complete']).toBeUndefined();
    expect(next.world.flags['gate_shed']).toBeUndefined();
    expect(next.world.flags['rune_wyrd']).toBeUndefined(); // Murk resells
    expect(next.world.mapId).toBe('hearth');
  });

  it('is repeatable: the pip count climbs', () => {
    const second = beginNgPlus(beginNgPlus(veteran()));
    expect(second.player.ngPlus).toBe(2);
  });
});

describe('NG+ scaling (03 section 25)', () => {
  function ngSave(): ReturnType<typeof newGame> {
    const gs = beginNgPlus(veteran());
    gs.player.spells[0] = makeSpell('volt', 'bolt', 'none');
    return gs;
  }

  it('enemies carry x1.5 hp and x1.5 atk', () => {
    const gs = ngSave();
    const state = initBattle(gs, ['gloop'], 2, 'hearthvale.meadow').state;
    // gloop at 2: (22 + 8*2) * 1.5 = 57
    expect(state.enemies[0]?.maxhp).toBe(57);
    const hpBefore = state.player.hp;
    const r = reduce(
      state,
      { type: 'cast', slot: 0, target: 0 },
      rngSeq([0.5, 1.0, 1.0, 0.0, 0.5]),
    );
    // atkRaw 5 + 1.6*2 = 8.2; x1.0 move x1.0 var x1.5 = 12
    expect(hpBefore - r.state.player.hp).toBe(12);
  });

  it('battle essence doubles', () => {
    const gs = ngSave();
    const state = initBattle(gs, ['gloop'], 2, 'hearthvale.meadow').state;
    expect(battleEssence(state)).toBe(2); // victory base 1 x2
  });

  it('the Hollow Warden fights two levels up with stretched bars', () => {
    const gs = ngSave();
    const state = initBossBattle(gs, 'hollowwarden', 'sanctum.halls').state;
    expect(state.enemies[0]?.lv).toBe(BOSSES.hollowwarden.lv + 2);
    expect(state.enemies[0]?.maxhp).toBe(630); // 420 x 1.5 = 3 bars of 210
  });

  it('other bosses keep their level but take the x1.5', () => {
    const gs = ngSave();
    const state = initBossBattle(gs, 'bogmaw', null).state;
    expect(state.enemies[0]?.lv).toBe(BOSSES.bogmaw.lv);
    expect(state.enemies[0]?.maxhp).toBe(Math.round(BOSSES.bogmaw.hp * 1.5));
  });

  it('glimmerkin roll runs at its own 6%', () => {
    // encounter roll 0.0 passes, glimmer pre-roll 0.05 < 0.06 fires.
    const result = resolveStep(
      {
        tile: ',',
        zone: 'hearthvale.meadow',
        graceSteps: 0,
        stepCount: 5,
        playerLv: 5,
        eliteEligible: true,
        glimmerChance: RARE.glimmerChanceNgPlus,
      },
      rngSeq([0.0, 0.05, 0.5]),
    );
    expect(result.encounter?.glimmer).toBe(true);
  });
});
