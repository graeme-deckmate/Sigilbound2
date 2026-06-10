/** Unlock gating (docs/03 section 5) and level-up behavior. */
import { describe, expect, it } from 'vitest';
import {
  applyXp,
  unlockedIds,
  unlockHint,
  unlocksAtLevel,
  unlocksAtShrine,
  type ShrineFlags,
} from '../src/systems/leveling.ts';
import { UNLOCKS } from '../src/data/unlocks.ts';
import { newGame } from '../src/core/save.ts';

const noShrines: ShrineFlags = { fury: false, thirst: false, echo: false, keen: false };
const allShrines: ShrineFlags = { fury: true, thirst: true, echo: true, keen: true };

describe('unlock gating', () => {
  it('start set is exactly Ember; Wisp, Bolt; no rune', () => {
    expect(unlockedIds('element', 1, noShrines)).toEqual(['ember']);
    expect(unlockedIds('form', 1, noShrines)).toEqual(['wisp', 'bolt']);
    expect(unlockedIds('rune', 1, noShrines)).toEqual(['none']);
  });

  it('levels gate elements and forms per the schedule', () => {
    expect(unlockedIds('element', 2, noShrines)).toEqual(['ember', 'rime']);
    expect(unlockedIds('form', 3, noShrines)).toEqual(['wisp', 'bolt', 'lance']);
    expect(unlockedIds('element', 4, noShrines)).toContain('volt');
    expect(unlockedIds('form', 5, noShrines)).toContain('nova');
    expect(unlockedIds('element', 6, noShrines)).toContain('thorn');
    expect(unlockedIds('form', 7, noShrines)).toContain('veil');
    expect(unlockedIds('element', 8, noShrines)).toContain('gloom');
    expect(unlockedIds('element', 7, noShrines)).not.toContain('gloom');
  });

  it('hex is the only level-gated rune (Lv 9)', () => {
    expect(unlockedIds('rune', 8, noShrines)).toEqual(['none']);
    expect(unlockedIds('rune', 9, noShrines)).toEqual(['none', 'hex']);
  });

  it('shrines gate the other runes independently of level', () => {
    expect(unlockedIds('rune', 1, { ...noShrines, fury: true })).toEqual(['none', 'fury']);
    expect(unlockedIds('rune', 1, allShrines)).toEqual(['none', 'fury', 'thirst', 'echo', 'keen']);
  });

  it('everything is unlocked at Lv 9 with all shrines', () => {
    expect(unlockedIds('element', 9, allShrines)).toHaveLength(5);
    expect(unlockedIds('form', 9, allShrines)).toHaveLength(5);
    expect(unlockedIds('rune', 9, allShrines)).toHaveLength(6);
  });

  it('unlocksAtLevel finds toast content', () => {
    expect(unlocksAtLevel(5).map((u) => u.id)).toEqual(['nova']);
    expect(unlocksAtLevel(9).map((u) => u.id)).toEqual(['hex']);
    expect(unlocksAtLevel(10)).toEqual([]);
  });

  it('unlocksAtShrine maps shrines to their runes', () => {
    expect(unlocksAtShrine('echo').map((u) => u.id)).toEqual(['echo']);
    expect(unlocksAtShrine('keen').map((u) => u.id)).toEqual(['keen']);
  });

  it('hints read per the doc', () => {
    const veil = UNLOCKS.find((u) => u.id === 'veil');
    const echo = UNLOCKS.find((u) => u.id === 'echo');
    const keen = UNLOCKS.find((u) => u.id === 'keen');
    expect(veil && unlockHint(veil)).toBe('Reach Lv 7');
    expect(echo && unlockHint(echo)).toBe('Pray at the Ashen Reach shrine.');
    expect(keen && unlockHint(keen)).toBe('Pray at the North Hollow shrine.');
  });

  it('the starting loadout only uses start-unlocked parts', () => {
    const g = newGame();
    const elements = unlockedIds('element', 1, noShrines);
    const forms = unlockedIds('form', 1, noShrines);
    const runes = unlockedIds('rune', 1, noShrines);
    for (const sp of g.player.spells) {
      if (!sp) continue;
      expect(elements).toContain(sp.element);
      expect(forms).toContain(sp.form);
      expect(runes).toContain(sp.rune);
    }
  });
});

describe('applyXp', () => {
  it('levels up at exactly xpNext with carryover and full restore', () => {
    const p0 = { ...newGame().player, hp: 10, mp: 2 };
    const { player: p1, levelsGained } = applyXp(p0, 18);
    expect(levelsGained).toEqual([2]);
    expect(p1.lv).toBe(2);
    expect(p1.xp).toBe(0);
    expect(p1.maxhp).toBe(54);
    expect(p1.maxmp).toBe(26);
    expect(p1.hp).toBe(54);
    expect(p1.mp).toBe(26);
  });

  it('does not level below the threshold', () => {
    const { player, levelsGained } = applyXp(newGame().player, 17);
    expect(levelsGained).toEqual([]);
    expect(player.lv).toBe(1);
    expect(player.xp).toBe(17);
  });

  it('chains multiple levels from one award', () => {
    // 18 (Lv1->2) + 32 (Lv2->3) = 50, plus 5 left over
    const { player, levelsGained } = applyXp(newGame().player, 55);
    expect(levelsGained).toEqual([2, 3]);
    expect(player.lv).toBe(3);
    expect(player.xp).toBe(5);
  });

  it('stops at the cap of 12', () => {
    const capped = {
      ...newGame().player,
      lv: 12,
      maxhp: 134,
      maxmp: 66,
      hp: 134,
      mp: 66,
    };
    const { player, levelsGained } = applyXp(capped, 10000);
    expect(levelsGained).toEqual([]);
    expect(player.lv).toBe(12);
    expect(player.maxhp).toBe(134);
  });

  it('is pure: the input player is not mutated', () => {
    const p0 = newGame().player;
    applyXp(p0, 100);
    expect(p0.lv).toBe(1);
    expect(p0.xp).toBe(0);
  });
});
