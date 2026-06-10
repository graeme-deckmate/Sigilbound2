import Phaser from 'phaser';
import { MIN_SCALE, MIN_VIEW_TILES, PALETTE, TILE } from './data/constants.ts';
import { BootScene } from './scenes/Boot.ts';
import { PreloadScene } from './scenes/Preload.ts';
import { TitleScene } from './scenes/Title.ts';
import { WorldScene } from './scenes/World.ts';
import { BattleScene } from './scenes/Battle.ts';
import { GrimoireScene } from './scenes/Grimoire.ts';
import { EndingScene } from './scenes/Ending.ts';
import { SettingsScene } from './scenes/Settings.ts';
import { unlockAudio } from './audio/synth.ts';

/**
 * Viewport sizing ported from the prototype: render at a low internal
 * resolution and scale up by an integer zoom factor, chosen so at least
 * MIN_VIEW_TILES tiles fit along the shorter screen edge.
 */
function computeView(): { width: number; height: number; zoom: number } {
  const el = document.getElementById('app');
  const w = el?.clientWidth ?? window.innerWidth;
  const h = el?.clientHeight ?? window.innerHeight;
  const zoom = Math.max(MIN_SCALE, Math.floor(Math.min(w, h) / (TILE * MIN_VIEW_TILES)));
  return { width: Math.ceil(w / zoom), height: Math.ceil(h / zoom), zoom };
}

const view = computeView();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: PALETTE.abyss,
  pixelArt: true,
  roundPixels: true,
  width: view.width,
  height: view.height,
  zoom: view.zoom,
  scale: { mode: Phaser.Scale.NONE },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    WorldScene,
    BattleScene,
    GrimoireScene,
    SettingsScene,
    EndingScene,
  ],
});

function fitToWindow(): void {
  const v = computeView();
  game.scale.setZoom(v.zoom);
  game.scale.resize(v.width, v.height);
}

if (import.meta.env.DEV) {
  // Dev-only handle for debugging from the browser console.
  (window as unknown as Record<string, unknown>)['__game'] = game;
}

// Browsers gate audio behind a user gesture; resume on any input.
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

game.events.once(Phaser.Core.Events.READY, () => {
  // Observe the container, not just the window: it catches viewport
  // emulation, orientation changes, and the max-width clamp on #app.
  const el = document.getElementById('app');
  if (el) new ResizeObserver(fitToWindow).observe(el);
  window.addEventListener('resize', fitToWindow);
  fitToWindow();
});
