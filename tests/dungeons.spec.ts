import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/save.ts';
import {
  doorOpen,
  dungeonComplete,
  dungeonEject,
  dungeonEnter,
  isDungeonCleared,
  type PuzzleState,
} from '../src/systems/dungeon.ts';
import { dungeonClearFlag } from '../src/data/dungeons.ts';

function puzzle(p: Partial<Record<keyof PuzzleState, string[]>>): PuzzleState {
  return {
    levers: new Set(p.levers ?? []),
    keys: new Set(p.keys ?? []),
    plates: new Set(p.plates ?? []),
    seq: p.seq ?? [],
  };
}

describe('door predicates', () => {
  it('opens lever/key/plate doors when the named token is present', () => {
    expect(doorOpen('lever:a', puzzle({ levers: ['a'] }))).toBe(true);
    expect(doorOpen('lever:a', puzzle({ levers: ['b'] }))).toBe(false);
    expect(doorOpen('key:bone', puzzle({ keys: ['bone'] }))).toBe(true);
    expect(doorOpen('plate:p1', puzzle({ plates: ['p1'] }))).toBe(true);
    expect(doorOpen('plate:p1', puzzle({}))).toBe(false);
  });

  it('opens a seq door only when the last throws match the order', () => {
    expect(doorOpen('seq:a,b,c', puzzle({ seq: ['a', 'b', 'c'] }))).toBe(true);
    expect(doorOpen('seq:a,b,c', puzzle({ seq: ['a', 'c', 'b'] }))).toBe(false);
    // a wrong start can be corrected by re-pulling in order
    expect(doorOpen('seq:a,b,c', puzzle({ seq: ['c', 'a', 'b', 'c'] }))).toBe(true);
    // unrelated levers in between do not break the order
    expect(doorOpen('seq:a,b,c', puzzle({ seq: ['a', 'x', 'b', 'y', 'c'] }))).toBe(true);
  });

  it('rejects malformed predicates', () => {
    expect(doorOpen('nonsense', puzzle({}))).toBe(false);
    expect(doorOpen('rune:fire', puzzle({}))).toBe(false);
  });
});

describe('dungeon run transitions', () => {
  it('enter remembers the entrance and lands on the entry tile', () => {
    let g = newGame();
    g.world.mapId = 'hearthvale';
    g.world.x = 12;
    g.world.y = 7;
    g = dungeonEnter(g, 'sunkencrypt', 'sanctum', 4, 4);
    expect(g.world.dungeon).toEqual({
      id: 'sunkencrypt',
      entrance: { mapId: 'hearthvale', x: 12, y: 7 },
      flags: {},
    });
    expect(g.world.mapId).toBe('sanctum');
    expect(g.world.x).toBe(4);
    expect(g.world.y).toBe(4);
  });

  it('eject returns to the entrance and refunds a defeat marker dropped inside', () => {
    let g = newGame();
    g.world.mapId = 'hearthvale';
    g.world.x = 12;
    g.world.y = 7;
    g.player.essence = 5;
    g = dungeonEnter(g, 'sunkencrypt', 'sanctum', 4, 4);
    // a wipe inside the dungeon drops a marker on the dungeon map
    g.world.essenceMarker = { mapId: 'sanctum', x: 4, y: 5, amount: 8 };
    g = dungeonEject(g);
    expect(g.world.dungeon).toBeNull();
    expect(g.world.mapId).toBe('hearthvale');
    expect(g.world.x).toBe(12);
    expect(g.world.y).toBe(7);
    // essence kept: the in-dungeon marker is refunded, not lost
    expect(g.player.essence).toBe(13);
    expect(g.world.essenceMarker).toBeNull();
  });

  it('eject keeps a marker that is not on the dungeon map', () => {
    let g = newGame();
    g = dungeonEnter(g, 'sunkencrypt', 'sanctum', 4, 4);
    g.world.essenceMarker = { mapId: 'westwood', x: 1, y: 1, amount: 9 };
    const before = g.player.essence;
    g = dungeonEject(g);
    expect(g.player.essence).toBe(before);
    expect(g.world.essenceMarker).toEqual({ mapId: 'westwood', x: 1, y: 1, amount: 9 });
  });

  it('eject is a no-op when not in a dungeon', () => {
    const g = newGame();
    expect(dungeonEject(g)).toEqual(g);
  });

  it('complete marks the dungeon cleared and ends the run', () => {
    let g = newGame();
    g = dungeonEnter(g, 'sunkencrypt', 'sanctum', 4, 4);
    expect(isDungeonCleared(g, 'sunkencrypt')).toBe(false);
    g = dungeonComplete(g, 'sunkencrypt');
    expect(g.world.dungeon).toBeNull();
    expect(g.world.flags[dungeonClearFlag('sunkencrypt')]).toBe(true);
    expect(isDungeonCleared(g, 'sunkencrypt')).toBe(true);
  });
});
