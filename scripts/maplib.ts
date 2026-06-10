/**
 * Map source parser, validator, and emitter shared by the genmaps CLI
 * and mapConnectivity tests. Pure: text in, objects/errors out.
 *
 * Source format (docs/01-ARCHITECTURE):
 *   @id hearthvale
 *   @size 60x40
 *   @music vale_theme
 *   @spawn 30,2 down
 *   @zone meadow 2,4 57,20 hearthvale.meadow
 *   @exit 30,0 -> hearth 15,18
 *   @npc elder 12,8 dialogue:elder_intro
 *   @sign 10,5 dialogue:hearthvale_1
 *   @lore 5,5 dialogue:lore_vale
 *   @spring 16,12
 *   @shrine fury 4,35
 *   @boss bogmaw 54,36
 *   @gate north 15,0
 *   ---
 *   <height rows of width terrain chars>
 */
import {
  SOLID_TERRAIN,
  entities,
  entityIndex,
  tileAt,
  walkableAt,
  type CompiledMap,
} from '../src/core/mapdefs.ts';
import { MAP_IDS, SHRINE_IDS, WORLD_BOSS_IDS, DIRS } from '../src/data/constants.ts';
import { ZONE_IDS } from '../src/data/formations.ts';
import { SCRIPTED_BATTLES } from '../src/data/triggers.ts';
import type { Dir, MapId } from '../src/core/state.ts';

const TERRAIN_CHARS = new Set(['#', 'o', '^', '~', '=', '.', ',', '*', '-', 'x']);

export interface ParseResult {
  map: CompiledMap | null;
  errors: string[];
}

function parseXY(s: string): { x: number; y: number } | null {
  const m = /^(\d+),(\d+)$/.exec(s);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

/** Parse one .map.txt source. Structural errors only; cross-map checks live in validateAll. */
export function parseMapSource(text: string, sourceName: string): ParseResult {
  const errors: string[] = [];
  const err = (msg: string): void => {
    errors.push(`${sourceName}: ${msg}`);
  };

  const sep = text.indexOf('\n---');
  if (sep < 0) {
    err("missing '---' separator between header and tiles");
    return { map: null, errors };
  }
  const headerLines = text.slice(0, sep).split('\n');
  const bodyLines = text
    .slice(sep + 1)
    .split('\n')
    .slice(1) // the '---' line itself
    .filter((l) => l.length > 0);

  let id: MapId | null = null;
  let width = 0;
  let height = 0;
  let music = '';
  let spawn: CompiledMap['spawn'] | null = null;
  const zones: CompiledMap['zones'][number][] = [];
  const exits: CompiledMap['exits'][number][] = [];
  const npcs: CompiledMap['npcs'][number][] = [];
  const signs: CompiledMap['signs'][number][] = [];
  const lore: CompiledMap['lore'][number][] = [];
  const springs: CompiledMap['springs'][number][] = [];
  const shrines: CompiledMap['shrines'][number][] = [];
  const egates: { id: string; x: number; y: number }[] = [];
  const bosses: CompiledMap['bosses'][number][] = [];
  const gates: CompiledMap['gates'][number][] = [];
  const triggers: CompiledMap['triggers'][number][] = [];

  for (const raw of headerLines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const directive = parts[0] ?? '';
    const args = parts.slice(1);
    switch (directive) {
      case '@id': {
        const v = args[0] ?? '';
        if ((MAP_IDS as readonly string[]).includes(v)) id = v as MapId;
        else err(`@id '${v}' is not a known map id`);
        break;
      }
      case '@size': {
        const m = /^(\d+)x(\d+)$/.exec(args[0] ?? '');
        if (!m) err(`@size needs WxH, got '${args[0] ?? ''}'`);
        else {
          width = Number(m[1]);
          height = Number(m[2]);
        }
        break;
      }
      case '@music':
        music = args[0] ?? '';
        break;
      case '@spawn': {
        const xy = parseXY(args[0] ?? '');
        const facing = args[1] ?? 'down';
        if (!xy) err(`@spawn needs x,y`);
        else if (!(DIRS as readonly string[]).includes(facing)) err(`@spawn facing '${facing}'`);
        else spawn = { ...xy, facing: facing as Dir };
        break;
      }
      case '@zone': {
        const [name, a, b, table] = [args[0], args[1], args[2], args[3]];
        const p1 = parseXY(a ?? '');
        const p2 = parseXY(b ?? '');
        if (!name || !p1 || !p2 || !table) err(`@zone needs: name x1,y1 x2,y2 table`);
        else if (!(ZONE_IDS as readonly string[]).includes(table))
          err(`@zone table '${table}' is not in formations data`);
        else
          zones.push({
            name,
            rect: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
            table: table as CompiledMap['zones'][number]['table'],
          });
        break;
      }
      case '@exit': {
        // @exit 30,0 -> hearth 15,18
        const from = parseXY(args[0] ?? '');
        const arrow = args[1];
        const to = args[2] ?? '';
        const target = parseXY(args[3] ?? '');
        if (!from || arrow !== '->' || !target) err(`@exit needs: x,y -> map tx,ty`);
        else if (!(MAP_IDS as readonly string[]).includes(to)) err(`@exit target map '${to}'`);
        else exits.push({ x: from.x, y: from.y, to: to as MapId, tx: target.x, ty: target.y });
        break;
      }
      case '@npc': {
        const [npcId, at, dlg] = [args[0], args[1], args[2]];
        const xy = parseXY(at ?? '');
        const m = /^dialogue:(.+)$/.exec(dlg ?? '');
        if (!npcId || !xy || !m) err(`@npc needs: id x,y dialogue:<id>`);
        else npcs.push({ id: npcId, ...xy, dialogue: m[1] ?? '' });
        break;
      }
      case '@sign':
      case '@lore': {
        const xy = parseXY(args[0] ?? '');
        const m = /^dialogue:(.+)$/.exec(args[1] ?? '');
        if (!xy || !m) err(`${directive} needs: x,y dialogue:<id>`);
        else (directive === '@sign' ? signs : lore).push({ ...xy, dialogue: m[1] ?? '' });
        break;
      }
      case '@spring': {
        const xy = parseXY(args[0] ?? '');
        if (!xy) err(`@spring needs x,y`);
        else springs.push(xy);
        break;
      }
      case '@shrine': {
        const rune = args[0] ?? '';
        const xy = parseXY(args[1] ?? '');
        if (!(SHRINE_IDS as readonly string[]).includes(rune) || !xy)
          err(`@shrine needs: <fury|thirst|echo|keen> x,y`);
        else shrines.push({ rune: rune as CompiledMap['shrines'][number]['rune'], ...xy });
        break;
      }
      case '@boss': {
        const bossId = args[0] ?? '';
        const xy = parseXY(args[1] ?? '');
        if (!(WORLD_BOSS_IDS as readonly string[]).includes(bossId) || !xy)
          err(`@boss needs: <boss id> x,y`);
        else bosses.push({ id: bossId as CompiledMap['bosses'][number]['id'], ...xy });
        break;
      }
      case '@egate': {
        const [egateId, exy] = [parts[1], parseXY(parts[2] ?? '')];
        if (!egateId || !exy) err(`@egate needs: id x,y`);
        else egates.push({ id: egateId, ...exy });
        break;
      }
      case '@gate': {
        const gateId = args[0] ?? '';
        const xy = parseXY(args[1] ?? '');
        if (!gateId || !xy) err(`@gate needs: id x,y`);
        else gates.push({ id: gateId, ...xy });
        break;
      }
      case '@trigger': {
        const triggerId = args[0] ?? '';
        const xy = parseXY(args[1] ?? '');
        if (!triggerId || !xy) err(`@trigger needs: id x,y`);
        else if (!(triggerId in SCRIPTED_BATTLES))
          err(`@trigger '${triggerId}' is not in data/triggers.ts`);
        else triggers.push({ id: triggerId, ...xy });
        break;
      }
      default:
        err(`unknown directive '${directive}'`);
    }
  }

  if (!id) err('missing @id');
  if (width === 0 || height === 0) err('missing @size');
  if (!spawn) err('missing @spawn');
  if (music === '') err('missing @music');

  if (bodyLines.length !== height) {
    err(`expected ${String(height)} tile rows, got ${String(bodyLines.length)}`);
  }
  for (const [i, row] of bodyLines.entries()) {
    if (row.length !== width) {
      err(`row ${String(i)} is ${String(row.length)} chars, expected ${String(width)}`);
    }
    for (const ch of row) {
      if (!TERRAIN_CHARS.has(ch)) {
        err(`row ${String(i)} has unknown terrain char '${ch}'`);
        break;
      }
    }
  }

  if (errors.length > 0 || !id || !spawn) return { map: null, errors };
  return {
    map: {
      id,
      width,
      height,
      music,
      tiles: bodyLines,
      spawn,
      zones,
      exits,
      npcs,
      signs,
      lore,
      springs,
      shrines,
      egates,
      bosses,
      gates,
      triggers,
    },
    errors,
  };
}

/** Flood fill walkable tiles from the spawn point. Keys are "x,y". */
export function reachableTiles(map: CompiledMap): Set<string> {
  // Element gates open in play (any matching spell), so the validator
  // treats them as passable, like boss gates on exits (docs/04 P13).
  const index = new Map(entityIndex(map));
  for (const g of map.egates) index.delete(`${String(g.x)},${String(g.y)}`);
  const seen = new Set<string>();
  const queue: [number, number][] = [[map.spawn.x, map.spawn.y]];
  while (queue.length > 0) {
    const next = queue.pop();
    if (!next) break;
    const [x, y] = next;
    const key = `${String(x)},${String(y)}`;
    if (seen.has(key)) continue;
    if (!walkableAt(map, x, y, index)) continue;
    seen.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

function adjacentReachable(reached: Set<string>, x: number, y: number): boolean {
  return (
    reached.has(`${String(x + 1)},${String(y)}`) ||
    reached.has(`${String(x - 1)},${String(y)}`) ||
    reached.has(`${String(x)},${String(y + 1)}`) ||
    reached.has(`${String(x)},${String(y - 1)}`)
  );
}

/** Cross-map and reachability validation over the whole compile set. */
export function validateAll(maps: CompiledMap[], dialogueIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const byId = new Map(maps.map((m) => [m.id, m]));

  for (const map of maps) {
    const err = (msg: string): void => {
      errors.push(`${map.id}: ${msg}`);
    };
    const inBounds = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < map.width && y < map.height;

    // Entities: in bounds, on non-solid terrain, not stacked, not on spawn/exits.
    const seen = new Set<string>();
    for (const e of entities(map)) {
      const key = `${String(e.x)},${String(e.y)}`;
      if (!inBounds(e.x, e.y)) err(`${e.kind} '${e.ref}' out of bounds at ${key}`);
      else if (SOLID_TERRAIN.has(tileAt(map, e.x, e.y)))
        err(`${e.kind} '${e.ref}' sits on solid terrain at ${key}`);
      if (seen.has(key)) err(`two entities stacked at ${key}`);
      seen.add(key);
      if (e.x === map.spawn.x && e.y === map.spawn.y) err(`${e.kind} '${e.ref}' on the spawn`);
      // Gates deliberately sit on exits (the sealed north passage).
      if (e.kind !== 'gate' && map.exits.some((x) => x.x === e.x && x.y === e.y))
        err(`${e.kind} '${e.ref}' blocks an exit at ${key}`);
    }

    // Dialogue references.
    for (const n of map.npcs)
      if (!dialogueIds.has(n.dialogue))
        err(`npc '${n.id}' references missing dialogue '${n.dialogue}'`);
    for (const s of [...map.signs, ...map.lore])
      if (!dialogueIds.has(s.dialogue))
        err(`sign/lore references missing dialogue '${s.dialogue}'`);

    // Spawn.
    if (!walkableAt(map, map.spawn.x, map.spawn.y, entityIndex(map))) err('spawn is not walkable');

    // Zones.
    for (const z of map.zones) {
      const { x1, y1, x2, y2 } = z.rect;
      if (x1 > x2 || y1 > y2) err(`zone '${z.name}' has an inverted rect`);
      if (!inBounds(x1, y1) || !inBounds(x2, y2)) err(`zone '${z.name}' out of bounds`);
    }

    // Exits: walkable here, target exists, target tile walkable, return exit exists.
    for (const x of map.exits) {
      if (!inBounds(x.x, x.y)) err(`exit at ${String(x.x)},${String(x.y)} out of bounds`);
      if (SOLID_TERRAIN.has(tileAt(map, x.x, x.y)))
        err(`exit at ${String(x.x)},${String(x.y)} on solid terrain`);
      const target = byId.get(x.to);
      if (!target) {
        err(`exit targets map '${x.to}' which is not in the compile set`);
        continue;
      }
      if (!walkableAt(target, x.tx, x.ty, entityIndex(target)))
        err(`exit lands on unwalkable ${x.to} ${String(x.tx)},${String(x.ty)}`);
      if (!target.exits.some((r) => r.to === map.id)) err(`exit to '${x.to}' has no return exit`);
    }

    // Triggers: walkable tiles, unstacked, reachable.
    for (const t of map.triggers) {
      if (!inBounds(t.x, t.y)) err(`trigger '${t.id}' out of bounds`);
      else if (SOLID_TERRAIN.has(tileAt(map, t.x, t.y))) err(`trigger '${t.id}' on solid terrain`);
      if (map.exits.some((x) => x.x === t.x && x.y === t.y))
        err(`trigger '${t.id}' stacked on an exit`);
      if (entities(map).some((e) => e.x === t.x && e.y === t.y))
        err(`trigger '${t.id}' stacked on an entity`);
    }

    // Reachability from spawn.
    const reached = reachableTiles(map);
    for (const x of map.exits) {
      // A gated exit opens later; the gate's own adjacency check
      // guarantees the player can stand beside it.
      const gated = map.gates.some((g) => g.x === x.x && g.y === x.y);
      if (gated) continue;
      if (!reached.has(`${String(x.x)},${String(x.y)}`))
        err(`exit at ${String(x.x)},${String(x.y)} unreachable from spawn`);
    }
    for (const t of map.triggers) {
      if (!reached.has(`${String(t.x)},${String(t.y)}`))
        err(`trigger '${t.id}' unreachable from spawn`);
    }
    for (const e of entities(map)) {
      if (!adjacentReachable(reached, e.x, e.y))
        err(
          `${e.kind} '${e.ref}' at ${String(e.x)},${String(e.y)} not adjacent to any reachable tile`,
        );
    }
    for (const z of map.zones) {
      let hasReachableGrass = false;
      for (let y = z.rect.y1; y <= z.rect.y2 && !hasReachableGrass; y++)
        for (let x = z.rect.x1; x <= z.rect.x2 && !hasReachableGrass; x++)
          if (tileAt(map, x, y) === ',' && reached.has(`${String(x)},${String(y)}`))
            hasReachableGrass = true;
      if (!hasReachableGrass) err(`zone '${z.name}' has no reachable tall grass`);
    }
  }
  return errors;
}

/** Emit a generated TS module for one compiled map. */
export function emitMapTs(map: CompiledMap, sourceName: string): string {
  return [
    `// GENERATED by npm run genmaps from ${sourceName} - DO NOT EDIT`,
    `import type { CompiledMap } from '../../core/mapdefs.ts';`,
    ``,
    `export const ${map.id} = ${JSON.stringify(map, null, 2)} as const satisfies CompiledMap;`,
    ``,
  ].join('\n');
}

/** Emit the generated index module over all compiled maps. */
export function emitIndexTs(maps: CompiledMap[]): string {
  const sorted = [...maps].sort((a, b) => a.id.localeCompare(b.id));
  return [
    `// GENERATED by npm run genmaps - DO NOT EDIT`,
    `import type { CompiledMap } from '../../core/mapdefs.ts';`,
    `import type { MapId } from '../../core/state.ts';`,
    ...sorted.map((m) => `import { ${m.id} } from './${m.id}.ts';`),
    ``,
    `export const MAPS: Partial<Record<MapId, CompiledMap>> = {`,
    ...sorted.map((m) => `  ${m.id},`),
    `};`,
    ``,
  ].join('\n');
}
