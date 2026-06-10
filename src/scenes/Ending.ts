import Phaser from 'phaser';
import type { GameState } from '../core/state.ts';
import { FONT_DISPLAY, FONT_UI, PALETTE } from '../data/constants.ts';
import * as dom from '../render/dom.ts';
import { playMusic, applyAudioSettings } from '../audio/music.ts';
import { playSfx } from '../audio/synth.ts';
import { beginNgPlus } from '../systems/ngplus.ts';
import { save } from '../core/save.ts';

const HEADING = 'THE VALE RESTS';
const PROLOGUE = 'The Wraith is undone. Light returns to the Vale.';
const BUTTON_LABEL = 'KEEP WANDERING';
const ROAM_TOAST = 'The Vale is yours to wander.';
const NG_LABEL = 'BEGIN AGAIN (NG+)';
const NG_ARMED_LABEL = 'THE VALE FORGETS?';
const NG_TOAST = 'The Vale forgets. You do not.';
const NG_ARM_MS = 3000;

interface EndingSceneData {
  state: GameState;
}

function color(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

/**
 * Ending cover, ported from the prototype: spinning sigil, THE VALE RESTS,
 * run stats, KEEP WANDERING back into post-game free roam. Doc 02 adds
 * defeats to the prototype's four stat lines.
 */
export class EndingScene extends Phaser.Scene {
  private params!: EndingSceneData;
  private bg!: Phaser.GameObjects.Graphics;
  private sigil!: Phaser.GameObjects.Text;
  private heading!: Phaser.GameObjects.Text;
  private prologue!: Phaser.GameObjects.Text;
  private statLines!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Container;
  private buttonFace!: Phaser.GameObjects.Graphics;
  private buttonLabel!: Phaser.GameObjects.Text;
  private ngButton!: Phaser.GameObjects.Container;
  private ngFace!: Phaser.GameObjects.Graphics;
  private ngLabel!: Phaser.GameObjects.Text;
  private ngArmed = false;
  private ngArmTimer: Phaser.Time.TimerEvent | null = null;
  private leaving = false;

  constructor() {
    super({ key: 'Ending' });
  }

  init(data: EndingSceneData): void {
    this.params = data;
    this.leaving = false;
    this.ngArmed = false;
  }

  create(): void {
    applyAudioSettings(this.params.state.settings);
    playMusic('ending');
    dom.showWorldUi(false);
    this.bg = this.add.graphics();

    this.sigil = this.add.text(0, 0, '❖', {
      fontFamily: FONT_UI,
      fontSize: '18px',
      color: PALETTE.gold,
    });
    this.sigil.setOrigin(0.5);

    this.heading = this.add.text(0, 0, HEADING, {
      fontFamily: FONT_DISPLAY,
      color: PALETTE.gold,
    });
    this.heading.setOrigin(0.5);
    this.heading.setShadow(2, 2, PALETTE.night, 0, false, true);

    this.prologue = this.add.text(0, 0, PROLOGUE, {
      fontFamily: FONT_UI,
      fontSize: '12px',
      color: PALETTE.parch,
      align: 'center',
      lineSpacing: 2,
    });
    this.prologue.setOrigin(0.5);

    const s = this.params.state.stats;
    const lines = [
      `Level reached ${String(this.params.state.player.lv)}`,
      `Battles won ${String(s.battles)}`,
      `Spells inscribed ${String(s.inscribed)}`,
      `Steps wandered ${String(s.steps)}`,
      `Defeats endured ${String(s.defeats)}`,
    ].join('\n');
    this.statLines = this.add.text(0, 0, lines, {
      fontFamily: FONT_UI,
      fontSize: '11px',
      color: PALETTE.parch,
      align: 'center',
      lineSpacing: 4,
    });
    this.statLines.setOrigin(0.5);

    this.button = this.buildRoamButton();
    this.ngButton = this.buildNgButton();

    // Finishing the loop again earns its feat (03 section 24).
    if (this.params.state.player.ngPlus > 0 && !this.params.state.feats.includes('twice_written')) {
      this.params.state.feats.push('twice_written');
      playSfx('unlock');
      dom.toast('✦ Feat: Twice Written', true);
    }

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
    this.cameras.main.fadeIn(400, 13, 10, 28);
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

    this.heading.setFontSize(Math.max(11, Math.min(16, Math.floor(w / 16))));
    this.prologue.setWordWrapWidth(Math.min(w - 16, 230));

    this.sigil.setPosition(cx, h * 0.13);
    this.heading.setPosition(cx, h * 0.22);
    this.prologue.setPosition(cx, h * 0.33);
    this.statLines.setPosition(cx, h * 0.53);
    this.button.setPosition(cx, h * 0.72);
    this.ngButton.setPosition(cx, h * 0.84);
  };

  private buildRoamButton(): Phaser.GameObjects.Container {
    // Sized so the hit target stays >= 44 CSS px at the minimum zoom of 2.
    const bw = 142;
    const bh = 26;

    const shadow = this.add.graphics();
    shadow.fillStyle(color('#a87f2f'), 1);
    shadow.fillRoundedRect(-bw / 2, -bh / 2 + 3, bw, bh, 6);

    this.buttonFace = this.add.graphics();
    this.buttonLabel = this.add.text(0, 0, BUTTON_LABEL, {
      fontFamily: FONT_DISPLAY,
      fontSize: '9px',
      color: PALETTE.ink,
    });
    this.buttonLabel.setOrigin(0.5);
    this.drawButtonFace(0);

    const container = this.add.container(0, 0, [shadow, this.buttonFace, this.buttonLabel]);
    container.setSize(bw, bh + 3);
    container.setInteractive({ useHandCursor: true });

    container.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.drawButtonFace(2);
    });
    container.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.drawButtonFace(0);
    });
    container.on(Phaser.Input.Events.POINTER_UP, () => {
      this.drawButtonFace(0);
      this.onRoam();
    });
    return container;
  }

  private drawButtonFace(pressOffset: number): void {
    const bw = 142;
    const bh = 26;
    this.buttonFace.clear();
    this.buttonFace.fillStyle(color(PALETTE.gold), 1);
    this.buttonFace.fillRoundedRect(-bw / 2, -bh / 2 + pressOffset, bw, bh, 6);
    this.buttonLabel.setY(pressOffset);
  }

  /** Violet sibling of the roam button; arms before it erases. */
  private buildNgButton(): Phaser.GameObjects.Container {
    const bw = 142;
    const bh = 26;
    const shadow = this.add.graphics();
    shadow.fillStyle(color('#46357a'), 1);
    shadow.fillRoundedRect(-bw / 2, -bh / 2 + 3, bw, bh, 6);
    this.ngFace = this.add.graphics();
    this.ngLabel = this.add.text(0, 0, NG_LABEL, {
      fontFamily: FONT_DISPLAY,
      fontSize: '8px',
      color: PALETTE.parch,
    });
    this.ngLabel.setOrigin(0.5);
    this.drawNgFace(0);
    const container = this.add.container(0, 0, [shadow, this.ngFace, this.ngLabel]);
    container.setSize(bw, bh + 3);
    container.setInteractive({ useHandCursor: true });
    container.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.drawNgFace(2);
    });
    container.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.drawNgFace(0);
    });
    container.on(Phaser.Input.Events.POINTER_UP, () => {
      this.drawNgFace(0);
      this.onNgPlus();
    });
    return container;
  }

  private drawNgFace(pressOffset: number): void {
    const bw = 142;
    const bh = 26;
    this.ngFace.clear();
    this.ngFace.fillStyle(color(this.ngArmed ? '#b04a5a' : PALETTE.arcane2), 1);
    this.ngFace.fillRoundedRect(-bw / 2, -bh / 2 + pressOffset, bw, bh, 6);
    this.ngLabel.setText(this.ngArmed ? NG_ARMED_LABEL : NG_LABEL);
    this.ngLabel.setY(pressOffset);
  }

  /** First tap arms, second within the window begins the next cycle. */
  private onNgPlus(): void {
    if (this.leaving) return;
    if (!this.ngArmed) {
      this.ngArmed = true;
      playSfx('select');
      this.drawNgFace(0);
      this.ngArmTimer?.remove();
      this.ngArmTimer = this.time.delayedCall(NG_ARM_MS, () => {
        this.ngArmed = false;
        this.drawNgFace(0);
      });
      return;
    }
    this.leaving = true;
    this.ngArmTimer?.remove();
    playSfx('confirm');
    const next = beginNgPlus(this.params.state);
    try {
      save(window.localStorage, 'auto', next);
    } catch {
      // Storage full: the run still starts; the next auto-save retries.
    }
    this.cameras.main.fadeOut(250, 13, 10, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      dom.toast(NG_TOAST);
      this.scene.start('World', { state: next });
    });
  }

  private onRoam(): void {
    if (this.leaving) return;
    this.leaving = true;
    playSfx('confirm');
    this.cameras.main.fadeOut(250, 13, 10, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      dom.toast(ROAM_TOAST);
      this.scene.start('World', { state: this.params.state });
    });
  }
}
