import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/save.ts';
import {
  applyRematchEntry,
  applyRematchReward,
  canAffordRematch,
  rematchClearFlag,
  REMATCH_PRICE,
} from '../src/systems/worldstate.ts';
import { ESSENCE } from '../src/data/essence.ts';
import type { BossId } from '../src/core/state.ts';

describe('waystone rematch', () => {
  it('offers a rematch only when the entry fee is affordable, and charges it', () => {
    const g = newGame();
    g.player.essence = REMATCH_PRICE;
    expect(canAffordRematch(g)).toBe(true);

    const paid = applyRematchEntry(g);
    expect(paid.player.essence).toBe(0);
    expect(canAffordRematch(paid)).toBe(false);
    // pure function: the input state is untouched
    expect(g.player.essence).toBe(REMATCH_PRICE);
  });

  it('grants the first-clear bonus exactly once per boss', () => {
    let g = newGame();
    const boss: BossId = 'bogmaw';

    const first = applyRematchReward(g, boss);
    expect(first.firstClear).toBe(true);
    expect(first.reward).toBe(ESSENCE.rematchFirstClear);
    expect(first.state.world.flags[rematchClearFlag(boss)]).toBe(true);

    g = first.state;
    const second = applyRematchReward(g, boss);
    expect(second.firstClear).toBe(false);
    expect(second.reward).toBe(0);
  });

  it('stays rematchable across many rematches (the v1 re-fight bug regression)', () => {
    let g = newGame();
    const boss: BossId = 'bogmaw';
    g.world.bosses[boss] = true; // defeated once -> the waystone now exists
    g.player.essence = 1000;

    const rounds = 5;
    for (let i = 0; i < rounds; i++) {
      // The waystone persists: the reward flag must never gate world.bosses.
      expect(g.world.bosses[boss]).toBe(true);
      // The offer appears whenever the player can pay.
      expect(canAffordRematch(g)).toBe(true);
      g = applyRematchEntry(g); // pay the entry fee
      const r = applyRematchReward(g, boss); // win the rematch
      g = r.state;
      // The bonus lands only on the first clear; later clears still succeed.
      expect(r.firstClear).toBe(i === 0);
    }

    // Five entry fees paid, exactly one first-clear bonus received.
    expect(g.player.essence).toBe(1000 - rounds * REMATCH_PRICE + ESSENCE.rematchFirstClear);
    expect(g.world.bosses[boss]).toBe(true);
  });
});
