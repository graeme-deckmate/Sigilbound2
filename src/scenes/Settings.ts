import Phaser from 'phaser';
import type { GameState } from '../core/state.ts';
import { load, save } from '../core/save.ts';
import { closeSettings, isSettingsOpen, openSettings } from '../render/settingsdom.ts';
import * as dom from '../render/dom.ts';

interface SettingsData {
  state: GameState;
}

/**
 * Thin overlay scene (the UI is DOM, render/settingsdom.ts), mirroring
 * the Grimoire pattern. Setting changes mutate the live GameState the
 * World scene owns, so the next auto-save persists them. Manual save
 * and load use the single manual slot (docs/01 save rules).
 */
export class SettingsScene extends Phaser.Scene {
  private params!: SettingsData;

  constructor() {
    super({ key: 'Settings' });
  }

  init(data: SettingsData): void {
    this.params = data;
  }

  create(): void {
    openSettings({
      state: this.params.state,
      onManualSave: () => {
        try {
          save(window.localStorage, 'manual', this.params.state);
          return true;
        } catch {
          return false;
        }
      },
      loadManual: () => load(window.localStorage, 'manual'),
      onLoadState: (state) => {
        // Loading always lands in World (docs/01).
        this.scene.stop('World');
        this.scene.start('World', { state });
      },
      onClose: () => {
        if (this.scene.isActive()) this.scene.stop();
      },
    });
    const input = dom.ensureInput();
    const offAction = input.onAction((action) => {
      if (action === 'cancel' && this.scene.isActive() && isSettingsOpen()) {
        closeSettings();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offAction);
  }
}
