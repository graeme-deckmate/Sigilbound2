/**
 * Map validation: parse the ASCII sources fresh, run the full validator
 * (connectivity, exits, references), and guard against drift between
 * sources and the generated modules the game imports.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMapSource, reachableTiles, validateAll } from '../scripts/maplib.ts';
import { entities, type CompiledMap } from '../src/core/mapdefs.ts';
import { MAPS } from '../src/data/maps/index.ts';

const mapsDir = join(__dirname, '..', 'content', 'maps');
const dialogueDir = join(__dirname, '..', 'content', 'dialogue');

function compileAll(): CompiledMap[] {
  const maps: CompiledMap[] = [];
  for (const f of readdirSync(mapsDir)
    .filter((f) => f.endsWith('.map.txt'))
    .sort()) {
    const { map, errors } = parseMapSource(readFileSync(join(mapsDir, f), 'utf8'), f);
    expect(errors).toEqual([]);
    expect(map).not.toBeNull();
    if (map) maps.push(map);
  }
  return maps;
}

function dialogueIds(): Set<string> {
  const ids = new Set<string>();
  for (const f of readdirSync(dialogueDir).filter((f) => f.endsWith('.json'))) {
    const parsed: unknown = JSON.parse(readFileSync(join(dialogueDir, f), 'utf8'));
    if (typeof parsed === 'object' && parsed !== null) {
      for (const k of Object.keys(parsed)) ids.add(k);
    }
  }
  return ids;
}

describe('map sources', () => {
  it('all maps through Act 4 are authored', () => {
    const maps = compileAll();
    expect(maps.map((m) => m.id).sort()).toEqual([
      'ashenreach',
      'cinderwaste',
      'circuitvault',
      'hearth',
      'hearthvale',
      'hoarfrost',
      'northhollow',
      'sanctum',
      'sunkencrypt',
      'wayhold',
      'westwood',
    ]);
  });

  it('northhollow content matches doc 03: zones, shrine, boss, gate route', () => {
    const maps = compileAll();
    const hollow = maps.find((m) => m.id === 'northhollow');
    expect(hollow?.zones.map((z) => z.table).sort()).toEqual([
      'northhollow.cliffs',
      'northhollow.hollow',
    ]);
    expect(hollow?.shrines).toEqual([{ rune: 'keen', x: 2, y: 23 }]);
    expect(hollow?.bosses.map((b) => b.id)).toEqual(['valewraith']);
    expect(hollow?.exits.some((e) => e.to === 'hearth')).toBe(true);
    const hearth = maps.find((m) => m.id === 'hearth');
    expect(hearth?.exits.some((e) => e.to === 'northhollow')).toBe(true);
    expect(hearth?.gates).toHaveLength(1);
  });

  it('pass the full validator (references, exits, connectivity)', () => {
    expect(validateAll(compileAll(), dialogueIds())).toEqual([]);
  });

  it('every entity and exit is reachable from the spawn', () => {
    for (const map of compileAll()) {
      const reached = reachableTiles(map);
      expect(reached.size).toBeGreaterThan(50);
      for (const x of map.exits) {
        if (map.gates.some((g) => g.x === x.x && g.y === x.y)) {
          const adjacent =
            reached.has(`${String(x.x + 1)},${String(x.y)}`) ||
            reached.has(`${String(x.x - 1)},${String(x.y)}`) ||
            reached.has(`${String(x.x)},${String(x.y + 1)}`) ||
            reached.has(`${String(x.x)},${String(x.y - 1)}`);
          expect(adjacent, `${map.id} gated exit ${String(x.x)},${String(x.y)}`).toBe(true);
          continue;
        }
        expect(reached.has(`${String(x.x)},${String(x.y)}`)).toBe(true);
      }
      for (const e of entities(map)) {
        const adjacent =
          reached.has(`${String(e.x + 1)},${String(e.y)}`) ||
          reached.has(`${String(e.x - 1)},${String(e.y)}`) ||
          reached.has(`${String(e.x)},${String(e.y + 1)}`) ||
          reached.has(`${String(e.x)},${String(e.y - 1)}`);
        expect(adjacent, `${map.id} ${e.kind} ${e.ref}`).toBe(true);
      }
    }
  });

  it('exits between hearth and hearthvale are bidirectional', () => {
    const maps = compileAll();
    const hearth = maps.find((m) => m.id === 'hearth');
    const vale = maps.find((m) => m.id === 'hearthvale');
    expect(hearth?.exits.some((e) => e.to === 'hearthvale')).toBe(true);
    expect(vale?.exits.some((e) => e.to === 'hearth')).toBe(true);
  });

  it('generated modules in src/data/maps match the sources (run npm run genmaps)', () => {
    for (const map of compileAll()) {
      const generated = MAPS[map.id];
      expect(generated, `generated module for ${map.id}`).toBeDefined();
      expect(generated).toEqual(map);
    }
  });

  it('hearthvale content matches doc 03: zones, shrine, boss, signs', () => {
    const vale = compileAll().find((m) => m.id === 'hearthvale');
    expect(vale?.zones.map((z) => z.table).sort()).toEqual([
      'hearthvale.marsh',
      'hearthvale.meadow',
    ]);
    expect(vale?.shrines).toEqual([{ rune: 'fury', x: 4, y: 36 }]);
    expect(vale?.bosses.map((b) => b.id)).toEqual(['bogmaw']);
    expect(vale?.signs).toHaveLength(4); // +1 wheel-teaching sign (v1.1 Phase 12)
    expect(vale?.lore).toHaveLength(1);
    expect(vale?.springs).toHaveLength(1);
  });

  it('hearth is safe: no encounter zones, villagers + the v2 armorer', () => {
    const hearth = compileAll().find((m) => m.id === 'hearth');
    expect(hearth?.zones).toEqual([]);
    // six original villagers + the v2 armorer (W3 town vendor)
    expect(hearth?.npcs).toHaveLength(7);
  });
});
