/**
 * Unit tests for the v2 dungeon map directives (W1). These parse in
 * isolation (parseMapSource does structural checks only); cross-map
 * reachability lives in mapConnectivity.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import { parseMapSource } from '../scripts/maplib.ts';

const HEADER = ['@id sanctum', '@size 6x5', '@music test_theme', '@spawn 1,1 down'];
const BODY = ['---', '......', '......', '......', '......', '......'];

function source(extra: string[]): string {
  return [...HEADER, ...extra, ...BODY].join('\n');
}

describe('v2 dungeon directives', () => {
  it('parses @theme and every dungeon entity into the compiled map', () => {
    const { map, errors } = parseMapSource(
      source([
        '@theme cave',
        '@portal sunkencrypt 2,1 -> sanctum 3,3',
        '@lever lever_a 1,2',
        '@door door_a 2,2 needs:lever:lever_a',
        '@plate plate_a 3,2',
        '@chest chest_a 4,2 reward:crypt_relic',
        '@objective obj_a 4,1 battle:bonelord',
        '@miniboss mb_a 1,3 species:gloop lv:9',
        '@waystone way_a 4,3',
        '@ambush amb_a 2,3 table:sanctum.halls lv:7 repeat',
      ]),
      'test.map.txt',
    );
    expect(errors).toEqual([]);
    expect(map).not.toBeNull();
    if (!map) return;
    expect(map.theme).toBe('cave');
    expect(map.portals).toEqual([
      { dungeon: 'sunkencrypt', x: 2, y: 1, to: 'sanctum', tx: 3, ty: 3 },
    ]);
    expect(map.levers).toEqual([{ id: 'lever_a', x: 1, y: 2 }]);
    expect(map.doors).toEqual([{ id: 'door_a', x: 2, y: 2, needs: 'lever:lever_a' }]);
    expect(map.plates).toEqual([{ id: 'plate_a', x: 3, y: 2 }]);
    expect(map.chests).toEqual([{ id: 'chest_a', x: 4, y: 2, reward: 'crypt_relic' }]);
    expect(map.objectives).toEqual([{ id: 'obj_a', x: 4, y: 1, battle: 'bonelord' }]);
    expect(map.minibosses).toEqual([{ id: 'mb_a', x: 1, y: 3, species: 'gloop', lv: 9 }]);
    expect(map.waystones).toEqual([{ id: 'way_a', x: 4, y: 3 }]);
    expect(map.ambushes).toEqual([
      { id: 'amb_a', x: 2, y: 3, table: 'sanctum.halls', lv: 7, repeat: true },
    ]);
  });

  it('defaults theme to vale and leaves dungeon arrays empty', () => {
    const { map, errors } = parseMapSource(source([]), 'plain.map.txt');
    expect(errors).toEqual([]);
    expect(map?.theme).toBe('vale');
    expect(map?.portals).toEqual([]);
    expect(map?.ambushes).toEqual([]);
  });

  it('rejects an unknown theme', () => {
    const { errors } = parseMapSource(source(['@theme swamp']), 'bad.map.txt');
    expect(errors.some((e) => e.includes('@theme'))).toBe(true);
  });

  it('rejects a door with no needs predicate', () => {
    const { errors } = parseMapSource(source(['@door d 2,2']), 'bad.map.txt');
    expect(errors.some((e) => e.includes('@door'))).toBe(true);
  });

  it('rejects a miniboss with an unknown species', () => {
    const { errors } = parseMapSource(
      source(['@miniboss mb 1,3 species:dragon lv:9']),
      'bad.map.txt',
    );
    expect(errors.some((e) => e.includes('species'))).toBe(true);
  });

  it('rejects an ambush with an unknown zone table', () => {
    const { errors } = parseMapSource(
      source(['@ambush a 2,3 table:nowhere.zone lv:7']),
      'bad.map.txt',
    );
    expect(errors.some((e) => e.includes('@ambush'))).toBe(true);
  });
});
