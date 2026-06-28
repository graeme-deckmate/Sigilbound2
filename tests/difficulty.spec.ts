import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/save.ts';
import { initBattle } from '../src/systems/battle.ts';
import { DIFFICULTIES } from '../src/data/difficulty.ts';

describe('difficulty profiles', () => {
  it('STANDARD is the numerical identity', () => {
    expect(DIFFICULTIES.standard).toEqual({ hpMult: 1, atkMult: 1, econMult: 1 });
  });

  it('standard battle enemy hp matches the raw formula (sim-safe)', () => {
    const g = newGame(); // run.difficulty defaults to 'standard'
    const state = initBattle(g, ['gloop'], 2, 'hearthvale.meadow').state;
    // gloop: h0 22 + hpl 8 * lv 2 = 38
    expect(state.enemies[0]?.maxhp).toBe(38);
  });

  it('harsh scales enemy hp by the profile', () => {
    const g = newGame();
    g.world.run.difficulty = 'harsh';
    const state = initBattle(g, ['gloop'], 2, 'hearthvale.meadow').state;
    expect(state.enemies[0]?.maxhp).toBe(Math.round(38 * DIFFICULTIES.harsh.hpMult));
    expect(state.diff).toEqual(DIFFICULTIES.harsh);
  });

  it('story softens enemy hp', () => {
    const g = newGame();
    g.world.run.difficulty = 'story';
    const state = initBattle(g, ['gloop'], 2, 'hearthvale.meadow').state;
    expect(state.enemies[0]?.maxhp).toBe(Math.round(38 * DIFFICULTIES.story.hpMult));
  });
});
