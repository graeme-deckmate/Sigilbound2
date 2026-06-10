import Phaser from 'phaser';
import type { GameState, Spell } from '../core/state.ts';
import { closeGrimoire, drawSigilFrame, isGrimoireOpen, openGrimoire } from '../render/grimoire.ts';
import * as dom from '../render/dom.ts';

interface GrimoireData {
  state: GameState;
  onInscribe: (slot: number, spell: Spell) => void;
}

/**
 * Thin overlay scene: the UI itself is DOM (render/grimoire.ts); this
 * scene exists to drive the animated sigil preview from the game loop
 * and to close on the cancel action. World stays visible underneath.
 */
export class GrimoireScene extends Phaser.Scene {
  private params!: GrimoireData;

  constructor() {
    super({ key: 'Grimoire' });
  }

  init(data: GrimoireData): void {
    this.params = data;
  }

  create(): void {
    openGrimoire({
      state: this.params.state,
      onInscribe: this.params.onInscribe,
      onClose: () => {
        this.scene.stop();
      },
    });
    const input = dom.ensureInput();
    const offAction = input.onAction((action) => {
      if (action === 'cancel' && this.scene.isActive() && isGrimoireOpen()) {
        closeGrimoire();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offAction);
  }

  override update(time: number): void {
    drawSigilFrame(time / 1000);
  }
}
