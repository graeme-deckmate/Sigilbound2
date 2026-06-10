/**
 * Procedural tile and entity textures, ported from the prototype's
 * drawTile. Tiles are baked once into a tileset strip; animated tiles
 * (water, tall grass) get two frames, and the World scene toggles
 * between two prebuilt layers to animate them.
 */
import type Phaser from 'phaser';
import { TILE } from '../data/constants.ts';
import type { ShrineId } from '../core/state.ts';

/** Deterministic per-cell hash for cosmetic variation. */
export function cellHash(x: number, y: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Tileset indices. Grass variants 0-3; frame pairs (a, b) for water and tall grass. */
export const TILE_INDEX = {
  grassA: 0,
  grassB: 1,
  grassSpeckA: 2,
  grassSpeckB: 3,
  tallA: 4,
  tallB: 5,
  flowersA: 6,
  flowersB: 7,
  pathA: 8,
  pathB: 9,
  waterA: 10,
  waterB: 11,
  bridge: 12,
  tree: 13,
  rock: 14,
  cliff: 15,
  voidFill: 16,
} as const;

const TILE_COUNT = 17;

type Ctx = CanvasRenderingContext2D;

function baseGrass(ctx: Ctx, ox: number, dark: boolean, speck: boolean): void {
  ctx.fillStyle = dark ? '#2a6845' : '#2c6e49';
  ctx.fillRect(ox, 0, TILE, TILE);
  if (speck) {
    ctx.fillStyle = '#36815a';
    ctx.fillRect(ox + (dark ? 4 : 9), dark ? 10 : 4, 2, 1);
  }
}

function drawTall(ctx: Ctx, ox: number, sway: number): void {
  baseGrass(ctx, ox, false, false);
  for (let i = 0; i < 3; i++) {
    const gx = ox + 3 + i * 4 + (i === 1 ? 1 : 0);
    ctx.fillStyle = '#1f5d3b';
    ctx.fillRect(gx, 7, 2, 7);
    ctx.fillStyle = '#69c98b';
    ctx.fillRect(gx + sway, 5, 2, 3);
  }
}

function drawFlowers(ctx: Ctx, ox: number, alt: boolean): void {
  baseGrass(ctx, ox, alt, false);
  ctx.fillStyle = alt ? '#ff8fb3' : '#ffc857';
  ctx.fillRect(ox + 4, 5, 3, 3);
  ctx.fillStyle = alt ? '#c9b8ff' : '#ff8fb3';
  ctx.fillRect(ox + 10, 9, 3, 3);
  ctx.fillStyle = '#69c98b';
  ctx.fillRect(ox + 5, 8, 1, 4);
  ctx.fillRect(ox + 11, 12, 1, 3);
}

function drawPath(ctx: Ctx, ox: number, alt: boolean): void {
  ctx.fillStyle = '#b99a63';
  ctx.fillRect(ox, 0, TILE, TILE);
  ctx.fillStyle = '#a8884f';
  if (alt) {
    ctx.fillRect(ox + 3, 9, 3, 2);
    ctx.fillRect(ox + 10, 4, 2, 2);
  } else {
    ctx.fillRect(ox + 8, 3, 3, 2);
    ctx.fillRect(ox + 4, 11, 2, 2);
  }
}

function drawWater(ctx: Ctx, ox: number, frame: number): void {
  ctx.fillStyle = '#1d4e89';
  ctx.fillRect(ox, 0, TILE, TILE);
  ctx.fillStyle = '#3f7fc1';
  const w = frame === 0 ? 1 : -1;
  ctx.fillRect(ox + 3 + w, 4, 6, 1);
  ctx.fillRect(ox + 8 - w, 11, 5, 1);
}

function drawBridge(ctx: Ctx, ox: number): void {
  ctx.fillStyle = '#1d4e89';
  ctx.fillRect(ox, 0, TILE, TILE);
  ctx.fillStyle = '#8a6a3f';
  ctx.fillRect(ox, 2, TILE, 12);
  ctx.fillStyle = '#6e5330';
  for (let i = 0; i < 4; i++) ctx.fillRect(ox, 3 + i * 3, TILE, 1);
  ctx.fillStyle = '#a8884f';
  ctx.fillRect(ox, 2, 2, 12);
  ctx.fillRect(ox + 14, 2, 2, 12);
}

function drawTree(ctx: Ctx, ox: number): void {
  baseGrass(ctx, ox, false, false);
  ctx.fillStyle = '#3b2a18';
  ctx.fillRect(ox + 6, 10, 4, 5);
  ctx.fillStyle = '#1b4d2e';
  ctx.beginPath();
  ctx.arc(ox + 8, 6, 7, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#2c7a48';
  ctx.beginPath();
  ctx.arc(ox + 6, 4, 3, 0, 7);
  ctx.fill();
}

function drawRock(ctx: Ctx, ox: number): void {
  baseGrass(ctx, ox, true, false);
  ctx.fillStyle = '#5d5a78';
  ctx.beginPath();
  ctx.arc(ox + 8, 9, 6, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#79759a';
  ctx.fillRect(ox + 5, 5, 4, 3);
  ctx.fillStyle = '#43405c';
  ctx.fillRect(ox + 4, 12, 9, 2);
}

function drawCliff(ctx: Ctx, ox: number): void {
  ctx.fillStyle = '#43405c';
  ctx.fillRect(ox, 0, TILE, TILE);
  ctx.fillStyle = '#5d5a78';
  ctx.fillRect(ox, 0, TILE, 4);
  ctx.fillStyle = '#2e2b45';
  ctx.fillRect(ox + 4, 6, 1, 6);
  ctx.fillRect(ox + 11, 8, 1, 5);
}

/** Bake the world tileset strip once. */
export function createTilesetTexture(scene: Phaser.Scene): void {
  const key = 'world_tiles';
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, TILE_COUNT * TILE, TILE);
  if (!tex) return;
  const ctx = tex.getContext();
  const at = (i: number): number => i * TILE;
  baseGrass(ctx, at(TILE_INDEX.grassA), false, false);
  baseGrass(ctx, at(TILE_INDEX.grassB), true, false);
  baseGrass(ctx, at(TILE_INDEX.grassSpeckA), false, true);
  baseGrass(ctx, at(TILE_INDEX.grassSpeckB), true, true);
  drawTall(ctx, at(TILE_INDEX.tallA), 1);
  drawTall(ctx, at(TILE_INDEX.tallB), -1);
  drawFlowers(ctx, at(TILE_INDEX.flowersA), false);
  drawFlowers(ctx, at(TILE_INDEX.flowersB), true);
  drawPath(ctx, at(TILE_INDEX.pathA), false);
  drawPath(ctx, at(TILE_INDEX.pathB), true);
  drawWater(ctx, at(TILE_INDEX.waterA), 0);
  drawWater(ctx, at(TILE_INDEX.waterB), 1);
  drawBridge(ctx, at(TILE_INDEX.bridge));
  drawTree(ctx, at(TILE_INDEX.tree));
  drawRock(ctx, at(TILE_INDEX.rock));
  drawCliff(ctx, at(TILE_INDEX.cliff));
  ctx.fillStyle = '#0d0a1c';
  ctx.fillRect(at(TILE_INDEX.voidFill), 0, TILE, TILE);
  tex.refresh();
}

/** Terrain char + position -> tileset index for the given anim frame. */
export function tileIndexFor(ch: string, x: number, y: number, frame: 0 | 1): number {
  const h = cellHash(x, y);
  switch (ch) {
    case '.':
      if (h > 0.78) return h > 0.89 ? TILE_INDEX.grassSpeckB : TILE_INDEX.grassSpeckA;
      return h > 0.5 ? TILE_INDEX.grassA : TILE_INDEX.grassB;
    case ',':
      return frame === 0 ? TILE_INDEX.tallA : TILE_INDEX.tallB;
    case '*':
      return h > 0.5 ? TILE_INDEX.flowersA : TILE_INDEX.flowersB;
    case '-':
      return h > 0.5 ? TILE_INDEX.pathA : TILE_INDEX.pathB;
    case '~':
      return frame === 0 ? TILE_INDEX.waterA : TILE_INDEX.waterB;
    case '=':
      return TILE_INDEX.bridge;
    case '#':
      return TILE_INDEX.tree;
    case 'o':
      return TILE_INDEX.rock;
    case '^':
      return TILE_INDEX.cliff;
    default:
      return TILE_INDEX.voidFill;
  }
}

const SHRINE_GLOW: Record<ShrineId, string> = {
  fury: '#ff6b4a',
  thirst: '#7dde6a',
  echo: '#5ad1ff',
  keen: '#ffd84a',
};

function makeEntityTexture(scene: Phaser.Scene, key: string, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, TILE, TILE);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

/** Bake entity textures: sign, lore stone, spring, shrines, gate, boss marker. */
export function createEntityTextures(scene: Phaser.Scene): void {
  makeEntityTexture(scene, 'ent_sign', (ctx) => {
    ctx.fillStyle = '#6e5330';
    ctx.fillRect(7, 6, 2, 9);
    ctx.fillStyle = '#8a6a3f';
    ctx.fillRect(3, 3, 10, 6);
    ctx.fillStyle = '#3b2a18';
    ctx.fillRect(5, 5, 6, 1);
  });
  makeEntityTexture(scene, 'ent_lore', (ctx) => {
    ctx.fillStyle = '#5d5a78';
    ctx.beginPath();
    ctx.arc(8, 9, 6, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#79759a';
    ctx.fillRect(4, 4, 8, 3);
    ctx.fillStyle = '#9d7bff';
    ctx.fillRect(7, 6, 2, 5);
    ctx.fillRect(6, 8, 4, 1);
  });
  makeEntityTexture(scene, 'ent_spring', (ctx) => {
    ctx.fillStyle = '#5d5a78';
    ctx.beginPath();
    ctx.arc(8, 8, 7, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#3f9fd1';
    ctx.beginPath();
    ctx.arc(8, 8, 5, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#bfe8ff';
    ctx.fillRect(6, 6, 2, 1);
    ctx.fillRect(9, 9, 1, 1);
  });
  makeEntityTexture(scene, 'ent_gate', (ctx) => {
    ctx.fillStyle = '#43405c';
    ctx.fillRect(1, 2, 14, 13);
    ctx.fillStyle = '#5d5a78';
    ctx.fillRect(1, 2, 3, 13);
    ctx.fillRect(12, 2, 3, 13);
    ctx.fillRect(1, 2, 14, 3);
    ctx.fillStyle = '#16112b';
    ctx.fillRect(5, 6, 2, 9);
    ctx.fillRect(9, 6, 2, 9);
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(7, 8, 2, 2);
  });
  makeEntityTexture(scene, 'ent_boss_marker', (ctx) => {
    ctx.fillStyle = '#1a1433';
    ctx.beginPath();
    ctx.ellipse(8, 11, 7, 4, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#3a2f6b';
    ctx.beginPath();
    ctx.ellipse(8, 11, 5, 2, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#9d7bff';
    ctx.fillRect(5, 10, 2, 1);
    ctx.fillRect(10, 11, 2, 1);
  });
  makeEntityTexture(scene, 'ent_egate', (ctx) => {
    ctx.fillStyle = '#43405c';
    ctx.fillRect(2, 3, 12, 12);
    ctx.fillStyle = '#5d5a78';
    ctx.fillRect(2, 3, 12, 2);
    ctx.fillRect(2, 3, 2, 12);
    ctx.fillRect(12, 3, 2, 12);
    ctx.fillStyle = '#efe6d0';
    ctx.fillRect(7, 6, 2, 2);
    ctx.fillRect(6, 9, 4, 1);
    ctx.fillRect(7, 11, 2, 2);
  });
  makeEntityTexture(scene, 'ent_trial', (ctx) => {
    ctx.fillStyle = '#3c3650';
    ctx.fillRect(3, 4, 10, 11);
    ctx.fillStyle = '#6b6480';
    ctx.fillRect(3, 4, 10, 2);
    ctx.fillRect(3, 4, 2, 11);
    ctx.fillStyle = '#16112b';
    ctx.fillRect(5, 13, 6, 2);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(7, 7, 2, 2);
    ctx.fillRect(6, 10, 1, 1);
    ctx.fillRect(9, 10, 1, 1);
  });
  makeEntityTexture(scene, 'ent_essence', (ctx) => {
    ctx.fillStyle = '#6f4fd8';
    ctx.beginPath();
    ctx.ellipse(8, 12, 5, 2.5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#9d7bff';
    ctx.fillRect(6, 7, 2, 4);
    ctx.fillRect(9, 5, 2, 6);
    ctx.fillRect(4, 9, 1, 2);
    ctx.fillStyle = '#d9ccff';
    ctx.fillRect(9, 5, 1, 1);
    ctx.fillRect(6, 7, 1, 1);
  });
  makeEntityTexture(scene, 'ent_teleporter', (ctx) => {
    ctx.fillStyle = '#2e2554';
    ctx.beginPath();
    ctx.ellipse(8, 11, 7, 4, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#6f4fd8';
    ctx.beginPath();
    ctx.ellipse(8, 11, 5, 2.5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#16112b';
    ctx.beginPath();
    ctx.ellipse(8, 11, 3, 1.5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(7, 4, 2, 2);
    ctx.fillStyle = '#9d7bff';
    ctx.fillRect(7, 7, 2, 3);
    ctx.fillRect(4, 9, 1, 1);
    ctx.fillRect(11, 9, 1, 1);
  });
  for (const [rune, glow] of Object.entries(SHRINE_GLOW)) {
    makeEntityTexture(scene, `ent_shrine_${rune}`, (ctx) => {
      ctx.fillStyle = '#5d5a78';
      ctx.fillRect(3, 9, 10, 6);
      ctx.fillStyle = '#79759a';
      ctx.fillRect(4, 9, 8, 2);
      ctx.fillStyle = glow;
      ctx.fillRect(6, 2, 4, 8);
      ctx.fillRect(7, 1, 2, 1);
    });
  }
}
