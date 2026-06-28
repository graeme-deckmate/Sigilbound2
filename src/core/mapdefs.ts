/**
 * Compiled map format and pure tile helpers. Maps are authored as ASCII
 * in content/maps/ and compiled by `npm run genmaps` into generated
 * modules under src/data/maps/. Terrain legend is docs/03 section 9.
 */
import type { BossId, Dir, MapId, ShrineId } from './state.ts';
import type { ZoneId } from '../data/formations.ts';
import type { EnemySpeciesId } from '../data/enemies.ts';

/** Terrain characters. x is void fill at map edges. */
export type TerrainChar = '#' | 'o' | '^' | '~' | '=' | '.' | ',' | '*' | '-' | 'x';

/** Visual theme for a map's tiles and battle backdrop (v2 W1). */
export type MapTheme = 'vale' | 'cave' | 'ash' | 'hollow';
export const MAP_THEMES: readonly MapTheme[] = ['vale', 'cave', 'ash', 'hollow'];

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

/*
 * Dungeon entities (v2 W1). Solid facing-entities (portal/lever/door/chest/
 * objective/miniboss/waystone) are faced to use and block walking; step-on
 * triggers (plate/ambush) sit on walkable tiles and fire from finishStep.
 * These are parsed and carried in Phase W1 (W2 wires the behavior).
 */

/** A dungeon mouth: face it to enter the named dungeon's entry map. */
export interface PortalDef {
  dungeon: string;
  x: number;
  y: number;
  to: MapId;
  tx: number;
  ty: number;
}

export interface LeverDef {
  id: string;
  x: number;
  y: number;
}

/** A door, solid until its `needs` predicate holds (lever:/key:/seq:/plate:). */
export interface DoorDef {
  id: string;
  x: number;
  y: number;
  needs: string;
}

export interface ChestDef {
  id: string;
  x: number;
  y: number;
  reward: string;
}

/** A dungeon objective: facing it starts the named battle (complete-or-fail). */
export interface ObjectiveDef {
  id: string;
  x: number;
  y: number;
  battle: string;
}

/** A visible fixed enemy: facing it shows its level then fights at it. */
export interface MinibossDef {
  id: string;
  x: number;
  y: number;
  species: EnemySpeciesId;
  lv: number;
}

export interface WaystoneDef {
  id: string;
  x: number;
  y: number;
}

/** Step-on pressure plate (latches or holds a door open). */
export interface PlateDef {
  id: string;
  x: number;
  y: number;
}

/** Step-on tile that fires a fixed encounter (repeatable when repeat). */
export interface AmbushDef {
  id: string;
  x: number;
  y: number;
  table: ZoneId;
  lv: number;
  repeat: boolean;
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
  /** Visual theme (v2 W1); defaults to 'vale'. */
  theme: MapTheme;
  /** Dungeon entities (v2 W1); empty on the overworld maps. */
  portals: readonly PortalDef[];
  levers: readonly LeverDef[];
  doors: readonly DoorDef[];
  chests: readonly ChestDef[];
  objectives: readonly ObjectiveDef[];
  minibosses: readonly MinibossDef[];
  waystones: readonly WaystoneDef[];
  plates: readonly PlateDef[];
  ambushes: readonly AmbushDef[];
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
    | 'trial'
    | 'portal'
    | 'lever'
    | 'door'
    | 'chest'
    | 'objective'
    | 'miniboss'
    | 'waystone';
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
    // Dungeon entities (v2 W2). Doors are solid here (closed); the scene
    // opens them in place when their puzzle predicate holds.
    ...map.portals.map<EntityAt>((p) => ({ kind: 'portal', x: p.x, y: p.y, ref: p.dungeon })),
    ...map.levers.map<EntityAt>((l) => ({ kind: 'lever', x: l.x, y: l.y, ref: l.id })),
    ...map.doors.map<EntityAt>((d) => ({ kind: 'door', x: d.x, y: d.y, ref: d.id })),
    ...map.chests.map<EntityAt>((c) => ({ kind: 'chest', x: c.x, y: c.y, ref: c.id })),
    ...map.objectives.map<EntityAt>((o) => ({ kind: 'objective', x: o.x, y: o.y, ref: o.id })),
    ...map.minibosses.map<EntityAt>((m) => ({ kind: 'miniboss', x: m.x, y: m.y, ref: m.id })),
    ...map.waystones.map<EntityAt>((w) => ({ kind: 'waystone', x: w.x, y: w.y, ref: w.id })),
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
