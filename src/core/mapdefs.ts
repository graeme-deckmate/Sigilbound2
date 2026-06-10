/**
 * Compiled map format and pure tile helpers. Maps are authored as ASCII
 * in content/maps/ and compiled by `npm run genmaps` into generated
 * modules under src/data/maps/. Terrain legend is docs/03 section 9.
 */
import type { BossId, Dir, MapId, ShrineId } from './state.ts';
import type { ZoneId } from '../data/formations.ts';

/** Terrain characters. x is void fill at map edges. */
export type TerrainChar = '#' | 'o' | '^' | '~' | '=' | '.' | ',' | '*' | '-' | 'x';

export const SOLID_TERRAIN: ReadonlySet<string> = new Set(['#', 'o', '^', '~', 'x']);

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ZoneRef {
  name: string;
  rect: Rect;
  table: ZoneId;
}

export interface ExitDef {
  x: number;
  y: number;
  to: MapId;
  tx: number;
  ty: number;
}

export interface NpcDef {
  id: string;
  x: number;
  y: number;
  dialogue: string;
}

export interface SignDef {
  x: number;
  y: number;
  dialogue: string;
}

export interface LoreDef {
  x: number;
  y: number;
  dialogue: string;
}

export interface SpringDef {
  x: number;
  y: number;
}

export interface RuneShrineDef {
  rune: ShrineId;
  x: number;
  y: number;
}

export interface BossMarkerDef {
  id: BossId;
  x: number;
  y: number;
}

export interface GateDef {
  id: string;
  x: number;
  y: number;
}

export interface SpawnDef {
  x: number;
  y: number;
  facing: Dir;
}

/** Walkable tile that fires a scripted battle once (data/triggers.ts). */
export interface TriggerDef {
  id: string;
  x: number;
  y: number;
}

export interface CompiledMap {
  id: MapId;
  width: number;
  height: number;
  music: string;
  /** Terrain rows, one string per row, width chars each. */
  tiles: readonly string[];
  spawn: SpawnDef;
  zones: readonly ZoneRef[];
  exits: readonly ExitDef[];
  npcs: readonly NpcDef[];
  signs: readonly SignDef[];
  lore: readonly LoreDef[];
  springs: readonly SpringDef[];
  shrines: readonly RuneShrineDef[];
  /** Element gates (v1.1, 03 section 19): id keys into data/discovery. */
  egates: readonly { id: string; x: number; y: number }[];
  bosses: readonly BossMarkerDef[];
  gates: readonly GateDef[];
  triggers: readonly TriggerDef[];
  /** Trial stones (03 section 23): ref is the demanded reaction. */
  trials: readonly { key: 'shatter' | 'blight' | 'kindle'; x: number; y: number }[];
}

/** Solid interactable entity positions (block walking, face to use). */
export interface EntityAt {
  kind:
    | 'npc'
    | 'sign'
    | 'lore'
    | 'spring'
    | 'shrine'
    | 'boss'
    | 'gate'
    | 'teleporter'
    | 'egate'
    | 'trial';
  x: number;
  y: number;
  /** dialogue id, npc id, shrine rune, or boss id depending on kind. */
  ref: string;
}

export function tileAt(map: CompiledMap, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return 'x';
  const row = map.tiles[y];
  return row?.charAt(x) ?? 'x';
}

export function entities(map: CompiledMap): EntityAt[] {
  return [
    ...map.npcs.map<EntityAt>((n) => ({ kind: 'npc', x: n.x, y: n.y, ref: n.id })),
    ...map.signs.map<EntityAt>((s) => ({ kind: 'sign', x: s.x, y: s.y, ref: s.dialogue })),
    ...map.lore.map<EntityAt>((l) => ({ kind: 'lore', x: l.x, y: l.y, ref: l.dialogue })),
    ...map.springs.map<EntityAt>((s) => ({ kind: 'spring', x: s.x, y: s.y, ref: 'spring' })),
    ...map.shrines.map<EntityAt>((s) => ({ kind: 'shrine', x: s.x, y: s.y, ref: s.rune })),
    ...map.bosses.map<EntityAt>((b) => ({ kind: 'boss', x: b.x, y: b.y, ref: b.id })),
    ...map.gates.map<EntityAt>((g) => ({ kind: 'gate', x: g.x, y: g.y, ref: g.id })),
    ...map.egates.map<EntityAt>((g) => ({ kind: 'egate', x: g.x, y: g.y, ref: g.id })),
    ...map.trials.map<EntityAt>((t) => ({ kind: 'trial', x: t.x, y: t.y, ref: t.key })),
  ];
}

export function entityAt(map: CompiledMap, x: number, y: number): EntityAt | null {
  return entities(map).find((e) => e.x === x && e.y === y) ?? null;
}

/**
 * Precomputed entity lookup keyed by "x,y". Build once per map; scenes
 * and flood fills must not rebuild entity arrays per query.
 */
export function entityIndex(map: CompiledMap): ReadonlyMap<string, EntityAt> {
  return new Map(entities(map).map((e) => [`${String(e.x)},${String(e.y)}`, e]));
}

/** Walkable terrain with no solid entity on it. */
export function walkableAt(
  map: CompiledMap,
  x: number,
  y: number,
  index?: ReadonlyMap<string, EntityAt>,
): boolean {
  if (SOLID_TERRAIN.has(tileAt(map, x, y))) return false;
  if (index) return !index.has(`${String(x)},${String(y)}`);
  return entityAt(map, x, y) === null;
}

export function exitAt(map: CompiledMap, x: number, y: number): ExitDef | null {
  return map.exits.find((e) => e.x === x && e.y === y) ?? null;
}

export function zoneAt(map: CompiledMap, x: number, y: number): ZoneRef | null {
  return (
    map.zones.find((z) => x >= z.rect.x1 && x <= z.rect.x2 && y >= z.rect.y1 && y <= z.rect.y2) ??
    null
  );
}
