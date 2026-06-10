/**
 * DOM overlay control: HUD, d-pad, dialog, toasts, iris transitions.
 * Ported from the prototype's overlay. Scenes call these; nothing here
 * holds game logic.
 */
import { InputState, KEY_TO_ACTION, KEY_TO_DIR } from '../core/input.ts';
import type { DialogueEntry } from '../data/dialogue.ts';
import { playSfx } from '../audio/synth.ts';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing overlay element #${id}`);
  return node as T;
}

/* ---------- input binding (once per page) ---------- */

let boundInput: InputState | null = null;

export function ensureInput(): InputState {
  if (boundInput) return boundInput;
  const input = new InputState();
  document.addEventListener('keydown', (e) => {
    const dir = KEY_TO_DIR[e.key];
    if (dir) {
      if (!e.repeat) input.pressDir(dir);
      e.preventDefault();
      return;
    }
    const action = KEY_TO_ACTION[e.key];
    if (action && !e.repeat) {
      input.dispatch(action);
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', (e) => {
    const dir = KEY_TO_DIR[e.key];
    if (dir) input.releaseDir(dir);
  });
  window.addEventListener('blur', () => {
    input.clearDirs();
  });

  for (const btn of document.querySelectorAll<HTMLElement>('.dbtn[data-d]')) {
    const dir = btn.dataset['d'] as 'up' | 'down' | 'left' | 'right' | undefined;
    if (!dir) continue;
    const on = (e: Event): void => {
      e.preventDefault();
      input.pressDir(dir);
      btn.classList.add('active');
    };
    const off = (e: Event): void => {
      e.preventDefault();
      input.releaseDir(dir);
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
  }
  el('btnA').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.dispatch('interact');
  });
  el('dialog').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    advanceDialog();
  });
  boundInput = input;
  return input;
}

/* ---------- world UI ---------- */

export function showWorldUi(visible: boolean): void {
  for (const id of ['hud', 'dpad', 'btnA', 'topbtns']) {
    el(id).classList.toggle('hidden', !visible);
  }
}

/** Hide the world controls during battle (the HUD stays). */
export function showTouchControls(visible: boolean): void {
  for (const id of ['dpad', 'btnA', 'topbtns']) {
    el(id).classList.toggle('hidden', !visible);
  }
}

/** Brief red flash on the battle panel when the player is hit. */
export function flashPanel(): void {
  const p = el('bpanel');
  p.style.boxShadow = 'inset 0 0 0 3px #ff6b6b';
  setTimeout(() => {
    p.style.boxShadow = '';
  }, 220);
}

export interface HudData {
  lv: number;
  hp: number;
  maxhp: number;
  mp: number;
  maxmp: number;
  xp: number;
  xpNext: number;
}

export function refreshHud(d: HudData): void {
  el('hlv').textContent = `Lv ${String(d.lv)}`;
  el('hhp').style.width = `${String((100 * d.hp) / d.maxhp)}%`;
  el('hmp').style.width = `${String((100 * d.mp) / d.maxmp)}%`;
  const xpFrac = Number.isFinite(d.xpNext) ? Math.min(1, d.xp / d.xpNext) : 1;
  el('hxp').style.width = `${String(100 * xpFrac)}%`;
  el('hhpn').textContent = `${String(d.hp)}/${String(d.maxhp)}`;
  el('hmpn').textContent = `${String(d.mp)}/${String(d.maxmp)}`;
}

export function applyDpadSettings(side: 'left' | 'right', scale: number): void {
  const dpad = el('dpad');
  const btnA = el('btnA');
  dpad.classList.toggle('right', side === 'right');
  btnA.classList.toggle('left', side === 'right');
  dpad.style.transform = `scale(${String(scale)})`;
}

export function toast(txt: string, violet = false): void {
  const d = document.createElement('div');
  d.className = `toast${violet ? ' violet' : ''}`;
  d.textContent = txt;
  el('toasts').appendChild(d);
  setTimeout(() => {
    d.remove();
  }, 3100);
}

/* ---------- dialog ---------- */

let dlgQueue: string[] = [];
let dlgDone: (() => void) | null = null;
let dialogOpen = false;

export function isDialogOpen(): boolean {
  return dialogOpen;
}

export function openDialog(entry: DialogueEntry, onDone?: () => void): void {
  dlgQueue = [...entry.pages];
  dlgDone = onDone ?? null;
  dialogOpen = true;
  choiceOpen = false;
  el('dchoices').style.display = 'none';
  const name = el('dname');
  name.textContent = entry.speaker;
  name.style.display = entry.speaker ? 'block' : 'none';
  el('dialog').style.display = 'block';
  nextDialogLine();
}

let choiceOpen = false;

/**
 * A dialog page with tappable options (v1.1: the Elder's starter ask,
 * shrine slot purchases). The A button cannot skip past it; picking an
 * option closes the dialog and fires onPick.
 */
export function openChoice(
  speaker: string,
  prompt: string,
  options: readonly string[],
  onPick: (index: number) => void,
): void {
  dialogOpen = true;
  choiceOpen = true;
  dlgQueue = [];
  dlgDone = null;
  const name = el('dname');
  name.textContent = speaker;
  name.style.display = speaker ? 'block' : 'none';
  el('dtext').textContent = prompt;
  const wrap = el('dchoices');
  wrap.replaceChildren(
    ...options.map((label, i) => {
      const b = document.createElement('button');
      b.className = 'spbtn util';
      b.textContent = label;
      b.onclick = () => {
        playSfx('confirm');
        choiceOpen = false;
        dialogOpen = false;
        wrap.style.display = 'none';
        el('dialog').style.display = 'none';
        onPick(i);
      };
      return b;
    }),
  );
  wrap.style.display = 'flex';
  el('dialog').style.display = 'block';
  playSfx('select');
}

function nextDialogLine(): void {
  playSfx('select');
  el('dtext').textContent = dlgQueue.shift() ?? '';
}

export function advanceDialog(): void {
  if (!dialogOpen) return;
  if (choiceOpen) return; // choices take a tap on an option, not A
  if (dlgQueue.length > 0) {
    nextDialogLine();
    return;
  }
  dialogOpen = false;
  el('dialog').style.display = 'none';
  const done = dlgDone;
  dlgDone = null;
  if (done) done();
}

/* ---------- transitions ---------- */

let transiting = false;

export function isTransiting(): boolean {
  return transiting;
}

/** Encounter strike: white flash, or a 200ms fade when reducedFlash is on. */
export function encounterFlash(reduced: boolean): Promise<void> {
  const iris = el('iris');
  return new Promise((resolve) => {
    iris.className = reduced ? 'fadepulse' : 'flash';
    setTimeout(
      () => {
        iris.className = '';
        resolve();
      },
      reduced ? 420 : 900,
    );
  });
}

/** Iris close, run the swap, iris open. */
export function irisTransition(mid: () => void): Promise<void> {
  const iris = el('iris');
  transiting = true;
  return new Promise((resolve) => {
    iris.className = 'closein';
    setTimeout(() => {
      mid();
      iris.className = 'openout';
      setTimeout(() => {
        iris.className = '';
        transiting = false;
        resolve();
      }, 520);
    }, 470);
  });
}
