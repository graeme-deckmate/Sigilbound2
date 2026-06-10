import Phaser from 'phaser';
import { FONT_DISPLAY, FONT_UI, PALETTE } from '../data/constants.ts';
import { load, newGame, save } from '../core/save.ts';
import type { GameState } from '../core/state.ts';
import { playMusic, applyAudioSettings } from '../audio/music.ts';
import { playSfx } from '../audio/synth.ts';

const TAGLINE = 'Craft your own spells. Roam the Vale. Battles strike from the tall grass.';
const CONTROLS =
  'Move: d-pad or WASD / arrows\nInteract: the button or E / Enter\nSpellcraft: the Grimoire, top right';
const ERASE_CONFIRM_MS = 3000;

function color(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

interface TitleButton {
  container: Phaser.GameObjects.Container;
  setLabel: (text: string) => void;
}

/**
 * Title screen, ported from the prototype cover: spinning sigil, gold
 * wordmark, tagline, controls hint. With a save present it offers
 * CONTINUE plus NEW GAME (two-tap confirm before erasing); on a fresh
 * browser it shows the single BEGIN of the prototype.
 */
export class TitleScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private sigil!: Phaser.GameObjects.Text;
  private wordmark!: Phaser.GameObjects.Text;
  private tagline!: Phaser.GameObjects.Text;
  private controls!: Phaser.GameObjects.Text;
  private primary!: TitleButton;
  private secondary: TitleButton | null = null;
  private starting = false;
  private eraseArmed = false;
  private eraseTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'Title' });
  }

  create(): void {
    this.starting = false;
    this.eraseArmed = false;
    this.secondary = null;
    playMusic('title');
    this.bg = this.add.graphics();

    this.sigil = this.add.text(0, 0, '✦', {
      fontFamily: FONT_UI,
      fontSize: '18px',
      color: PALETTE.gold,
    });
    this.sigil.setOrigin(0.5);

    this.wordmark = this.add.text(0, 0, 'SIGILBOUND', {
      fontFamily: FONT_DISPLAY,
      color: PALETTE.gold,
    });
    this.wordmark.setOrigin(0.5);
    this.wordmark.setShadow(2, 2, PALETTE.night, 0, false, true);

    this.tagline = this.add.text(0, 0, TAGLINE, {
      fontFamily: FONT_UI,
      fontSize: '12px',
      color: PALETTE.dim,
      align: 'center',
      lineSpacing: 2,
    });
    this.tagline.setOrigin(0.5);

    const saved = this.savedState();
    // NG+ pips: one mark per finished cycle (03 section 25).
    if (saved && saved.player.ngPlus > 0) {
      const pips = '✦'.repeat(Math.min(saved.player.ngPlus, 7));
      this.wordmark.setText(`SIGILBOUND ${pips}`);
      this.wordmark.setColor(PALETTE.arcane);
    }
    if (saved) {
      this.primary = this.buildButton('CONTINUE', 98, () => {
        this.start(saved);
      });
      this.secondary = this.buildButton('NEW GAME', 98, () => {
        this.onNewGame();
      });
    } else {
      this.primary = this.buildButton('BEGIN', 84, () => {
        this.start(newGame());
      });
    }

    this.controls = this.add.text(0, 0, CONTROLS, {
      fontFamily: FONT_UI,
      fontSize: '10px',
      color: PALETTE.dim,
      align: 'center',
      lineSpacing: 3,
    });
    this.controls.setOrigin(0.5);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      this.tweens.add({
        targets: this.sigil,
        angle: 360,
        duration: 9000,
        repeat: -1,
      });
    }

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout);
    });
  }

  /** Continue prefers the auto slot; an old manual save still counts. */
  private savedState(): GameState | null {
    return load(window.localStorage, 'auto') ?? load(window.localStorage, 'manual');
  }

  private layout = (): void => {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;

    this.bg.clear();
    this.bg.fillGradientStyle(
      color(PALETTE.night2),
      color(PALETTE.night2),
      color(PALETTE.abyss),
      color(PALETTE.abyss),
      1,
    );
    this.bg.fillRect(0, 0, w, h);

    this.wordmark.setFontSize(Math.max(12, Math.min(20, Math.floor(w / 13))));
    this.tagline.setWordWrapWidth(Math.min(w - 16, 220));

    this.sigil.setPosition(cx, h * 0.22);
    this.wordmark.setPosition(cx, h * 0.31);
    this.tagline.setPosition(cx, h * 0.42);
    if (this.secondary) {
      this.primary.container.setPosition(cx, h * 0.57);
      this.secondary.container.setPosition(cx, h * 0.68);
    } else {
      this.primary.container.setPosition(cx, h * 0.62);
    }
    this.controls.setPosition(cx, h * 0.84);
  };

  private buildButton(label: string, bw: number, onUp: () => void): TitleButton {
    // Sized so the hit target stays >= 44 CSS px at the minimum zoom of 2.
    const bh = 26;

    const shadow = this.add.graphics();
    shadow.fillStyle(color('#a87f2f'), 1);
    shadow.fillRoundedRect(-bw / 2, -bh / 2 + 3, bw, bh, 6);

    const face = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: FONT_DISPLAY,
      fontSize: '10px',
      color: PALETTE.ink,
    });
    text.setOrigin(0.5);
    const drawFace = (pressOffset: number): void => {
      face.clear();
      face.fillStyle(color(PALETTE.gold), 1);
      face.fillRoundedRect(-bw / 2, -bh / 2 + pressOffset, bw, bh, 6);
      text.setY(pressOffset);
    };
    drawFace(0);

    const container = this.add.container(0, 0, [shadow, face, text]);
    container.setSize(bw, bh + 3);
    container.setInteractive({ useHandCursor: true });
    container.on(Phaser.Input.Events.POINTER_DOWN, () => {
      drawFace(2);
    });
    container.on(Phaser.Input.Events.POINTER_OUT, () => {
      drawFace(0);
    });
    container.on(Phaser.Input.Events.POINTER_UP, () => {
      drawFace(0);
      onUp();
    });
    return {
      container,
      setLabel: (t: string) => {
        text.setText(t);
      },
    };
  }

  /** Two taps to erase: the first arms the button, the second begins. */
  private onNewGame(): void {
    if (this.starting || !this.secondary) return;
    if (!this.eraseArmed) {
      this.eraseArmed = true;
      playSfx('select');
      this.secondary.setLabel('ERASE + BEGIN?');
      this.eraseTimer?.remove();
      this.eraseTimer = this.time.delayedCall(ERASE_CONFIRM_MS, () => {
        this.eraseArmed = false;
        this.secondary?.setLabel('NEW GAME');
      });
      return;
    }
    this.eraseTimer?.remove();
    const fresh = newGame();
    // Overwrite the auto slot now so a stale save cannot resurrect the
    // old run before the first auto-save. The manual slot is kept.
    try {
      save(window.localStorage, 'auto', fresh);
    } catch {
      // Storage unavailable: still start; auto-save will retry later.
    }
    this.start(fresh);
  }

  private start(state: GameState): void {
    if (this.starting) return;
    this.starting = true;
    applyAudioSettings(state.settings);
    playSfx('confirm');
    this.cameras.main.fadeOut(250, 13, 10, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('World', { state });
    });
  }
}
