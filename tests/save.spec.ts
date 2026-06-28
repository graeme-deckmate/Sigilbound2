/** Save/load/migrate v1 (docs/01-ARCHITECTURE). */
import { describe, expect, it } from 'vitest';
import {
  clearSlot,
  load,
  migrate,
  newGame,
  save,
  SaveError,
  SAVE_KEYS,
  type KVStore,
} from '../src/core/save.ts';

function memStore(): KVStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('newGame', () => {
  it('starts per v1.1: Lv1, 46/26, empty slots awaiting the Elder, Hearth', () => {
    const g = newGame();
    expect(g.version).toBe(3);
    expect(g.player.lv).toBe(1);
    expect(g.player.hp).toBe(46);
    expect(g.player.maxhp).toBe(46);
    expect(g.player.mp).toBe(26);
    expect(g.player.maxmp).toBe(26);
    expect(g.player.spells).toEqual([null, null, null, null, null, null]);
    expect(g.player.starter).toBeNull();
    expect(g.player.slotsUnlocked).toBe(4);
    expect(g.player.essence).toBe(0);
    expect(g.player.mastery).toEqual({ ember: 0, rime: 0, volt: 0, thorn: 0, gloom: 0 });
    expect(g.player.charms).toEqual({ owned: [], equipped: [null, null] });
    expect(g.world.aspect).toBeNull();
    expect(g.world.essenceMarker).toBeNull();
    expect(g.notes).toEqual([]);
    expect(g.world.mapId).toBe('hearth');
    expect(Object.values(g.world.shrines).every((v) => !v)).toBe(true);
    expect(Object.values(g.world.bosses).every((v) => !v)).toBe(true);
  });
});

describe('save/load round trip', () => {
  it('persists and restores a state', () => {
    const store = memStore();
    const g = newGame();
    g.player.xp = 12;
    g.world.x = 3;
    g.world.shrines.fury = true;
    g.stats.battles = 4;
    save(store, 'auto', g);
    const back = load(store, 'auto');
    expect(back).toEqual(g);
  });

  it('uses the documented localStorage key for the auto slot', () => {
    expect(SAVE_KEYS.auto).toBe('sigilbound2.save.v1');
  });

  it('keeps auto and manual slots independent', () => {
    const store = memStore();
    const a = newGame();
    a.stats.steps = 1;
    const m = newGame();
    m.stats.steps = 999;
    save(store, 'auto', a);
    save(store, 'manual', m);
    expect(load(store, 'auto')?.stats.steps).toBe(1);
    expect(load(store, 'manual')?.stats.steps).toBe(999);
    clearSlot(store, 'manual');
    expect(load(store, 'manual')).toBeNull();
    expect(load(store, 'auto')).not.toBeNull();
  });

  it('strips battle-only statuses on save without mutating the input', () => {
    const store = memStore();
    const g = newGame();
    g.player.statuses = { burning: 2 };
    save(store, 'auto', g);
    expect(load(store, 'auto')?.player.statuses).toEqual({});
    expect(g.player.statuses).toEqual({ burning: 2 });
  });

  it('returns null for an empty slot or corrupt JSON', () => {
    const store = memStore();
    expect(load(store, 'auto')).toBeNull();
    store.setItem(SAVE_KEYS.auto, '{not json');
    expect(load(store, 'auto')).toBeNull();
  });
});

describe('migrate', () => {
  it('rejects non-saves', () => {
    expect(() => migrate(42)).toThrow(SaveError);
    expect(() => migrate('hello')).toThrow(SaveError);
    expect(() => migrate({})).toThrow(SaveError);
    expect(() => migrate(null)).toThrow(SaveError);
  });

  it('rejects unknown versions', () => {
    expect(() => migrate({ version: 4, player: {}, world: {} })).toThrow(SaveError);
    expect(() => migrate({ version: 0, player: {}, world: {} })).toThrow(SaveError);
  });

  it('fills defaults for a minimal v1 payload and upgrades it to v3', () => {
    const g = migrate({ version: 1, player: {}, world: {} });
    expect(g.version).toBe(3);
    expect(g.player.lv).toBe(1);
    expect(g.player.hp).toBe(46);
    expect(g.player.spells).toEqual([null, null, null, null, null, null]);
    // every v1 run began with Ember; the elder never re-asks
    expect(g.player.starter).toBe('ember');
    expect(g.player.slotsUnlocked).toBe(4);
    expect(g.player.essence).toBe(0);
    expect(g.player.ngPlus).toBe(0);
    expect(g.world.aspect).toBeNull();
    expect(g.world.essenceMarker).toBeNull();
    expect(g.notes).toEqual([]);
    expect(g.world.mapId).toBe('hearth');
    expect(g.settings.textSpeed).toBe(1);
    expect(g.settings.dpadSide).toBe('left');
    expect(g.stats.battles).toBe(0);
  });

  it('v1 spells gain potency 1.0 in the upgrade', () => {
    const g = migrate({
      version: 1,
      player: { spells: [{ element: 'rime', form: 'lance', rune: 'keen' }] },
      world: {},
    });
    expect(g.player.spells[0]).toEqual({ element: 'rime', form: 'lance', rune: 'keen', p: 1 });
  });

  it('v2 round-trips potency, given names, essence, and the marker', () => {
    const fresh = newGame();
    fresh.player.starter = 'rime';
    fresh.player.essence = 23;
    fresh.player.slotsUnlocked = 5;
    fresh.player.mastery.rime = 7;
    fresh.player.spells[0] = {
      element: 'rime',
      form: 'bolt',
      rune: 'none',
      p: 1.5,
      given: 'Coldsnap',
    };
    fresh.world.essenceMarker = { mapId: 'westwood', x: 9, y: 12, amount: 11 };
    fresh.notes = ['A gate of frost bars the old cellar.'];
    const g = migrate(JSON.parse(JSON.stringify(fresh)));
    expect(g.player.spells[0]).toEqual({
      element: 'rime',
      form: 'bolt',
      rune: 'none',
      p: 1.5,
      given: 'Coldsnap',
    });
    expect(g.player.essence).toBe(23);
    expect(g.player.slotsUnlocked).toBe(5);
    expect(g.player.starter).toBe('rime');
    expect(g.player.mastery.rime).toBe(7);
    expect(g.world.essenceMarker).toEqual({ mapId: 'westwood', x: 9, y: 12, amount: 11 });
    expect(g.notes).toEqual(['A gate of frost bars the old cellar.']);
  });

  it('a v2 save with a null starter still asks the elder', () => {
    const fresh = newGame();
    const g = migrate(JSON.parse(JSON.stringify(fresh)));
    expect(g.player.starter).toBeNull();
  });

  it('fills dungeon=null when a pre-v3 save has no dungeon field', () => {
    const g = migrate({ version: 2, player: {}, world: {} });
    expect(g.world.dungeon).toBeNull();
  });

  it('round-trips an active v3 dungeon run', () => {
    const fresh = newGame();
    fresh.world.dungeon = {
      id: 'sunkencrypt',
      entrance: { mapId: 'hearthvale', x: 12, y: 7 },
      flags: { lever_a: true, plate_1: false },
    };
    const g = migrate(JSON.parse(JSON.stringify(fresh)));
    expect(g.world.dungeon).toEqual({
      id: 'sunkencrypt',
      entrance: { mapId: 'hearthvale', x: 12, y: 7 },
      flags: { lever_a: true, plate_1: false },
    });
  });

  it('defaults gold/equipment/inventory for a pre-V1 save', () => {
    const g = migrate({ version: 3, player: {}, world: {} });
    expect(g.player.gold).toBe(0);
    expect(g.player.equipment).toEqual({
      vestment: null,
      implement: null,
      talisman: null,
      boots: null,
    });
    expect(g.player.inventory.gear).toEqual([]);
    expect(g.player.inventory.capacity).toBeGreaterThan(0);
  });

  it('round-trips gold, owned gear, and an equipped slot; drops malformed gear', () => {
    const fresh = newGame();
    fresh.player.gold = 42;
    fresh.player.inventory.gear = [
      { uid: 'g1', base: 'spark_wand', slot: 'implement', rarity: 'fine', affixes: ['keen'] },
    ];
    fresh.player.equipment.implement = 'g1';
    const raw = JSON.parse(JSON.stringify(fresh)) as { player: { inventory: { gear: unknown[] } } };
    // inject a malformed gear entry that migrate must drop
    raw.player.inventory.gear.push({ uid: 'bad', base: 'not_a_real_base' });
    const g = migrate(raw);
    expect(g.player.gold).toBe(42);
    expect(g.player.inventory.gear).toHaveLength(1);
    expect(g.player.inventory.gear[0]?.uid).toBe('g1');
    expect(g.player.equipment.implement).toBe('g1');
  });

  it('clears an equipped slot whose uid is no longer owned', () => {
    const fresh = newGame();
    fresh.player.equipment.vestment = 'ghost';
    const g = migrate(JSON.parse(JSON.stringify(fresh)));
    expect(g.player.equipment.vestment).toBeNull();
  });

  it('round-trips class, appearance, and difficulty; defaults them for old saves', () => {
    const fresh = newGame();
    fresh.player.klass = 'reaver';
    fresh.player.appearance.palette = 'crimson';
    fresh.world.run.difficulty = 'harsh';
    const g = migrate(JSON.parse(JSON.stringify(fresh)));
    expect(g.player.klass).toBe('reaver');
    expect(g.player.appearance.palette).toBe('crimson');
    expect(g.world.run.difficulty).toBe('harsh');

    const old = migrate({ version: 3, player: {}, world: {} });
    expect(old.player.klass).toBeNull();
    expect(old.player.appearance.palette).toBe('default');
    expect(old.world.run.difficulty).toBe('standard');
  });

  it('clamps out-of-range potency back into the slider range', () => {
    const g = migrate({
      version: 2,
      player: { spells: [{ element: 'ember', form: 'bolt', rune: 'none', p: 9 }] },
      world: {},
    });
    expect(g.player.spells[0]?.p).toBe(1.5);
  });

  it('clamps hp/mp to max and sanitizes bad leaf values', () => {
    const g = migrate({
      version: 1,
      player: { hp: 9999, maxhp: 50, mp: -5, maxmp: 30, lv: 3 },
      world: { mapId: 'moon', facing: 'sideways' },
    });
    expect(g.player.hp).toBe(50);
    expect(g.player.mp).toBe(0);
    expect(g.world.mapId).toBe('hearth');
    expect(g.world.facing).toBe('down');
  });

  it('drops malformed spells but keeps valid ones', () => {
    const g = migrate({
      version: 1,
      player: {
        spells: [
          { element: 'ember', form: 'bolt', rune: 'none' },
          { element: 'fire', form: 'bolt', rune: 'none' },
          'nonsense',
          null,
        ],
      },
      world: {},
    });
    expect(g.player.spells).toEqual([
      { element: 'ember', form: 'bolt', rune: 'none', p: 1 },
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('preserves valid settings and normalizes textSpeed', () => {
    const g = migrate({
      version: 1,
      player: {},
      world: {},
      settings: { reducedFlash: true, textSpeed: 2, dpadSide: 'right', master: 0.5 },
    });
    expect(g.settings.reducedFlash).toBe(true);
    expect(g.settings.textSpeed).toBe(2);
    expect(g.settings.dpadSide).toBe('right');
    expect(g.settings.master).toBe(0.5);
  });

  it('never restores battle statuses from disk', () => {
    const g = migrate({
      version: 1,
      player: { statuses: { burning: 3 } },
      world: {},
    });
    expect(g.player.statuses).toEqual({});
  });
});
