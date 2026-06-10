import Phaser from 'phaser';

/**
 * Asset preparation. All art is procedural, so there is nothing to fetch;
 * we only wait for the pixel fonts so Title text does not flash a
 * fallback face. Procedural texture generation joins here in Phase 2.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  create(): void {
    void this.waitForFonts().then(() => {
      this.scene.start('Title');
    });
  }

  private async waitForFonts(): Promise<void> {
    try {
      await Promise.all([
        document.fonts.load("16px 'Press Start 2P'"),
        document.fonts.load('24px VT323'),
      ]);
    } catch {
      // Offline or fonts blocked: monospace fallbacks are fine.
    }
  }
}
