/**
 * Content validation: the data tables stay internally consistent and
 * every player-facing string obeys the writing rules (no em dashes).
 */
import { describe, expect, it } from 'vitest';
import { ELEMENT_IDS, ELEMENTS } from '../src/data/elements.ts';
import { FORM_IDS, FORMS } from '../src/data/forms.ts';
import { RUNE_IDS, RUNES } from '../src/data/runes.ts';
import { BOSS_IDS, BOSSES, ENEMIES, ENEMY_IDS } from '../src/data/enemies.ts';
import { ZONE_IDS, ZONES } from '../src/data/formations.ts';
import { UNLOCKS } from '../src/data/unlocks.ts';
import { ENEMY_STATUSES, PLAYER_STATUSES } from '../src/data/statuses.ts';
import { makeSpell, spellName } from '../src/systems/spellcraft.ts';
import { unlockHint } from '../src/systems/leveling.ts';
import { DIALOGUE } from '../src/data/dialogue.ts';
import { SHRINE_IDS } from '../src/data/constants.ts';

describe('table completeness', () => {
  it('has 5 elements, 6 forms, 12 runes (6 + wyrd + 5 relics)', () => {
    expect(ELEMENT_IDS).toHaveLength(5);
    expect(FORM_IDS).toHaveLength(6);
    expect(RUNE_IDS).toHaveLength(12);
    expect(Object.keys(ELEMENTS)).toHaveLength(5);
    expect(Object.keys(FORMS)).toHaveLength(6);
    expect(Object.keys(RUNES)).toHaveLength(12);
  });

  it('every rune carries a player-facing blurb (tooltip copy)', () => {
    for (const id of RUNE_IDS) {
      const blurb = RUNES[id].blurb;
      expect(blurb.length, id).toBeGreaterThan(10);
      expect(blurb.length, id).toBeLessThanOrEqual(70);
    }
  });

  it('has 17 enemy species (14 + v2 crypt/marsh trio) and 5 bosses', () => {
    expect(ENEMY_IDS).toHaveLength(17);
    expect(Object.keys(ENEMIES)).toHaveLength(17);
    expect(BOSS_IDS).toHaveLength(5);
    expect(Object.keys(BOSSES)).toHaveLength(5);
  });

  it('covers 23 unlock entries: 5 elements + 6 forms + 12 runes', () => {
    expect(UNLOCKS).toHaveLength(23);
    expect(UNLOCKS.filter((u) => u.kind === 'element')).toHaveLength(5);
    expect(UNLOCKS.filter((u) => u.kind === 'form')).toHaveLength(6);
    expect(UNLOCKS.filter((u) => u.kind === 'rune')).toHaveLength(12);
  });
});

describe('enemy roster integrity', () => {
  it('weakness/resist lists are valid elements and never overlap', () => {
    for (const id of ENEMY_IDS) {
      const e = ENEMIES[id];
      for (const el of [...e.weak, ...e.resist]) {
        expect(ELEMENT_IDS).toContain(el);
      }
      for (const el of e.weak) {
        expect(e.resist).not.toContain(el);
      }
    }
  });

  it('every species has positive stats and at least one damaging move', () => {
    for (const id of ENEMY_IDS) {
      if (id === 'glimmerkin') continue; // never attacks, by design (v1.1)
      const e = ENEMIES[id];
      expect(e.h0).toBeGreaterThan(0);
      // Trial guardians scale by fixed trial level, not per-level HP.
      expect(e.hpl).toBeGreaterThanOrEqual(id === 'trialguardian' ? 0 : 1);
      expect(e.a0).toBeGreaterThan(0);
      expect(e.al).toBeGreaterThan(0);
      expect(e.xpBase).toBeGreaterThan(0);
      expect(e.xpPerLv).toBeGreaterThanOrEqual(id === 'trialguardian' ? 0 : 1);
      expect(e.moves.length).toBeGreaterThanOrEqual(3);
      expect(e.moves.some((m) => m.mult > 0)).toBe(true);
      for (const m of e.moves) {
        expect(m.mult).toBeGreaterThanOrEqual(0);
        if (m.rider?.type === 'playerStatus') {
          expect(Object.keys(PLAYER_STATUSES)).toContain(m.rider.status);
          expect(m.rider.chance).toBeGreaterThan(0);
          expect(m.rider.chance).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('Act 1 enemies inflict no player statuses (riders begin in Act 2)', () => {
    for (const id of ['gloop', 'pondscale', 'burrowkin'] as const) {
      for (const m of ENEMIES[id].moves) {
        expect(m.rider?.type).not.toBe('playerStatus');
      }
    }
  });

  it('bosses reference real summon species and carry intro lines', () => {
    for (const id of BOSS_IDS) {
      const b = BOSSES[id];
      expect(b.hp).toBeGreaterThan(0);
      expect(b.lv).toBeGreaterThan(0);
      expect(b.intro.length).toBeGreaterThan(0);
      const sp = b.special;
      if (sp.kind === 'summonAndVeil' || sp.kind === 'attune') {
        expect(ENEMY_IDS).toContain(sp.summonSpecies);
      }
      if (sp.kind === 'enrage') {
        expect(b.moves.map((m) => m.name)).toContain(sp.weightedMove);
      }
    }
  });

  it('boss tuning matches the balanced values (03 + PROGRESS tuning log)', () => {
    expect(BOSSES.bogmaw.lv).toBe(4);
    expect(BOSSES.bogmaw.hp).toBe(150);
    expect(BOSSES.bogmaw.xp).toBe(60);
    expect(BOSSES.thornveil.lv).toBe(6);
    expect(BOSSES.thornveil.hp).toBe(165); // tuned from 230, see PROGRESS
    expect(BOSSES.ashenwarden.lv).toBe(8);
    expect(BOSSES.ashenwarden.hp).toBe(215); // tuned from 280, see PROGRESS
    expect(BOSSES.valewraith.lv).toBe(11);
    expect(BOSSES.valewraith.hp).toBe(300); // tuned from 520, see PROGRESS
    expect(BOSSES.valewraith.xp).toBe(0);
  });
});

describe('formation integrity', () => {
  it('all 10 zones exist with sane bands and members', () => {
    expect(ZONE_IDS).toHaveLength(10);
    for (const z of ZONE_IDS) {
      const t = ZONES[z];
      expect(t.levelMin).toBeGreaterThanOrEqual(1);
      expect(t.levelMax).toBeGreaterThanOrEqual(t.levelMin);
      expect(t.levelMax).toBeLessThanOrEqual(12);
      expect(t.formations.length).toBeGreaterThan(0);
      for (const f of t.formations) {
        expect(f.weight).toBeGreaterThan(0);
        expect(f.members.length).toBeGreaterThanOrEqual(1);
        expect(f.members.length).toBeLessThanOrEqual(3);
        for (const m of f.members) {
          expect(ENEMY_IDS).toContain(m);
        }
      }
    }
  });
});

describe('status tables', () => {
  it('durations match the 02 table', () => {
    expect(ENEMY_STATUSES.burning.duration).toBe(3);
    expect(ENEMY_STATUSES.chilled.duration).toBe(2);
    expect(ENEMY_STATUSES.stunned.duration).toBe(1);
    expect(ENEMY_STATUSES.envenomed.duration).toBe(3);
    expect(ENEMY_STATUSES.withered.duration).toBe(2);
  });

  it('every element maps to a defined enemy status', () => {
    for (const id of ELEMENT_IDS) {
      expect(Object.keys(ENEMY_STATUSES)).toContain(ELEMENTS[id].status);
    }
  });
});

describe('writing rules', () => {
  it('no em or en dashes in any player-facing string', () => {
    const strings: string[] = [];
    for (const e of Object.values(ELEMENTS)) strings.push(e.label);
    for (const f of Object.values(FORMS)) strings.push(f.label);
    for (const r of Object.values(RUNES)) strings.push(r.label, r.suffix);
    for (const e of Object.values(ENEMIES)) {
      strings.push(e.name, ...e.moves.map((m) => m.name));
    }
    for (const b of Object.values(BOSSES)) {
      strings.push(b.name, b.intro, ...b.moves.map((m) => m.name));
      if (b.sigilToast) strings.push(b.sigilToast);
    }
    for (const u of UNLOCKS) strings.push(unlockHint(u));
    for (const e of ELEMENT_IDS)
      for (const f of FORM_IDS)
        for (const r of RUNE_IDS) strings.push(spellName(makeSpell(e, f, r)));
    for (const entry of Object.values(DIALOGUE)) {
      strings.push(entry.speaker, ...entry.pages);
    }
    for (const s of strings) {
      expect(s).not.toMatch(/[–—]/);
    }
  });

  it('dialogue pages stay short (tone rules: 1-3 lines per page)', () => {
    for (const [id, entry] of Object.entries(DIALOGUE)) {
      expect(entry.pages.length, id).toBeGreaterThan(0);
      for (const page of entry.pages) {
        expect(page.length, `${id} page length`).toBeLessThanOrEqual(140);
      }
    }
  });
});

describe('required dialogue ids', () => {
  it('shrines, spring, defeat wake, and help all have copy', () => {
    for (const shrine of SHRINE_IDS) {
      expect(DIALOGUE[`shrine_${shrine}`], `shrine_${shrine}`).toBeDefined();
    }
    expect(DIALOGUE['shrine_used']).toBeDefined();
    expect(DIALOGUE['spring']).toBeDefined();
    expect(DIALOGUE['defeat_wake']).toBeDefined();
    expect(DIALOGUE['help']).toBeDefined();
  });
});
