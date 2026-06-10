/** Sprite grid integrity (docs/03 section 12: uniform row widths). */
import { describe, expect, it } from 'vitest';
import {
  ALL_GRIDS,
  BATTLE_SPRITES,
  PLAYER_FRONT,
  PLAYER_BACK,
  PLAYER_PAL,
  VILLAGER_PALS,
  type Palette,
  type PixelGrid,
} from '../src/render/grids.ts';

function expectPaletteCovered(name: string, grid: PixelGrid, pal: Palette): void {
  for (const row of grid) {
    for (const ch of row) {
      if (ch === '.') continue;
      expect(pal[ch], `${name} char '${ch}'`).toBeDefined();
    }
  }
}

describe('pixel grids', () => {
  it('every registered grid has uniform row widths', () => {
    for (const [name, grid] of Object.entries(ALL_GRIDS)) {
      expect(grid.length, name).toBeGreaterThan(0);
      const w = grid[0]?.length ?? 0;
      expect(w, name).toBeGreaterThan(0);
      for (const row of grid) {
        expect(row.length, `${name} row width`).toBe(w);
      }
    }
  });

  it('grids only use their own palette characters or transparency', () => {
    expectPaletteCovered('player_front', PLAYER_FRONT, PLAYER_PAL);
    expectPaletteCovered('player_back', PLAYER_BACK, PLAYER_PAL);
    for (const [name, sprite] of Object.entries(BATTLE_SPRITES)) {
      expectPaletteCovered(name, sprite.grid, sprite.pal);
    }
  });

  it('all six villagers have palettes', () => {
    expect(Object.keys(VILLAGER_PALS).sort()).toEqual([
      'dreamer',
      'elder',
      'keeper',
      'scout',
      'twin_a',
      'twin_b',
    ]);
  });
});
