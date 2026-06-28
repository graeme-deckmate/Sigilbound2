/**
 * Phaser texture builders for pixel-grid art (port of the prototype's
 * spriteFromGrid). Grids and palettes live in grids.ts.
 */
import type Phaser from 'phaser';
import {
  PLAYER_BACK,
  PLAYER_FRONT,
  PLAYER_PAL,
  PLAYER_PALETTES,
  VILLAGER_PALS,
  type Palette,
  type PixelGrid,
} from './grids.ts';

export function textureFromGrid(
  scene: Phaser.Scene,
  key: string,
  rows: PixelGrid,
  pal: Palette,
): void {
  if (scene.textures.exists(key)) return;
  const w = rows[0]?.length ?? 0;
  const h = rows.length;
  const tex = scene.textures.createCanvas(key, Math.max(1, w), Math.max(1, h));
  if (!tex) return;
  const ctx = tex.getContext();
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const ch = row.charAt(x);
      const color = pal[ch];
      if (ch === '.' || !color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  tex.refresh();
}

/** Create the player and villager textures once, at preload. */
export function createActorTextures(scene: Phaser.Scene, palette = 'default'): void {
  const pal = PLAYER_PALETTES[palette] ?? PLAYER_PAL;
  // Rebuild the player textures so a chosen cosmetic palette takes effect (v2 V3).
  for (const key of ['player_front', 'player_back']) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }
  textureFromGrid(scene, 'player_front', PLAYER_FRONT, pal);
  textureFromGrid(scene, 'player_back', PLAYER_BACK, pal);
  for (const [npcId, npcPal] of Object.entries(VILLAGER_PALS)) {
    textureFromGrid(scene, `npc_${npcId}`, PLAYER_FRONT, npcPal);
  }
}

/** Texture key for an NPC, falling back to the scout villager. */
export function npcTextureKey(scene: Phaser.Scene, npcId: string): string {
  const key = `npc_${npcId}`;
  return scene.textures.exists(key) ? key : 'npc_scout';
}
