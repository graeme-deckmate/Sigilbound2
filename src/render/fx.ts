/**
 * Battle FX: pooled floating damage numbers and cast particle bursts
 * (docs/01: no allocations in the steady-state frame loop).
 */
import Phaser from 'phaser';
import { FONT_DISPLAY } from '../data/constants.ts';

const POOL_SIZE = 14;

export class FloaterPool {
  private readonly pool: Phaser.GameObjects.Text[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (let i = 0; i < POOL_SIZE; i++) {
      const t = scene.add
        .text(0, 0, '', { fontFamily: FONT_DISPLAY, fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(50)
        .setVisible(false);
      t.setShadow(1, 1, '#16112b', 0, false, true);
      this.pool.push(t);
    }
  }

  spawn(x: number, y: number, text: string, color: string, big = false): void {
    const t = this.pool.find((p) => !p.visible);
    if (!t) return; // pool exhausted: drop the floater, never allocate
    t.setText(text);
    t.setColor(color);
    t.setFontSize(big ? 14 : 10);
    t.setPosition(x, y);
    t.setAlpha(1);
    t.setVisible(true);
    this.scene.tweens.add({
      targets: t,
      y: y - 22,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        t.setVisible(false);
      },
    });
  }
}

/** Ensure the shared 2x2 particle texture exists. */
export function ensureParticleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('px')) return;
  const tex = scene.textures.createCanvas('px', 2, 2);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 2, 2);
  tex.refresh();
}

/** One-shot element-colored burst at a point. */
export function burst(scene: Phaser.Scene, x: number, y: number, colorHex: string): void {
  ensureParticleTexture(scene);
  const tint = Phaser.Display.Color.HexStringToColor(colorHex).color;
  const emitter = scene.add.particles(x, y, 'px', {
    speed: { min: 30, max: 90 },
    angle: { min: 0, max: 360 },
    lifespan: { min: 250, max: 480 },
    scale: { start: 1.4, end: 0 },
    tint,
    emitting: false,
  });
  emitter.setDepth(40);
  emitter.explode(16);
  scene.time.delayedCall(600, () => {
    emitter.destroy();
  });
}
