import Phaser from 'phaser';

/**
 * First scene: earliest one-time setup, then straight to Preload.
 * Registry seeding and save probing join here in later phases.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    this.scene.start('Preload');
  }
}
