/**
 * Settings overlay (docs/04 Phase 8): volume sliders, comfort toggles,
 * text speed, d-pad options, manual save/load. Pure DOM; the thin
 * Settings scene drives open/close. Changes apply live and land on the
 * GameState the World scene already owns, so the next auto-save
 * persists them.
 */
import type { GameState } from '../core/state.ts';
import { applyAudioSettings } from '../audio/music.ts';
import { playSfx } from '../audio/synth.ts';
import { applyDpadSettings, toast } from './dom.ts';
import { importCode } from '../systems/spellcodes.ts';
import { displayName } from '../systems/spellcraft.ts';
import { DIFFICULTY_IDS } from '../data/difficulty.ts';

export interface SettingsCtx {
  state: GameState;
  /** Persist to the manual slot; returns false when storage failed. */
  onManualSave: () => boolean;
  /** Returns the manual-slot state, or null if none exists. */
  loadManual: () => GameState | null;
  /** Restart the world from a manually loaded state. */
  onLoadState: (state: GameState) => void;
  onClose: () => void;
}

let ctx: SettingsCtx | null = null;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing overlay element #${id}`);
  return node as T;
}

export function isSettingsOpen(): boolean {
  return ctx !== null;
}

const DPAD_SCALES: readonly { label: string; value: number }[] = [
  { label: 'Small', value: 0.85 },
  { label: 'Normal', value: 1 },
  { label: 'Large', value: 1.2 },
];

function chip(label: string, selected: boolean, onPick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `chip${selected ? ' sel' : ''}`;
  b.textContent = label;
  b.onclick = () => {
    playSfx('select');
    onPick();
    rebuildChips();
  };
  return b;
}

function applyLive(): void {
  if (!ctx) return;
  const s = ctx.state.settings;
  applyAudioSettings(s);
  applyDpadSettings(s.dpadSide, s.dpadScale);
}

function rebuildChips(): void {
  if (!ctx) return;
  const s = ctx.state.settings;
  const run = ctx.state.world.run;

  const diff = el('chDifficulty');
  diff.replaceChildren(
    ...DIFFICULTY_IDS.map((id) =>
      chip(`${id[0]?.toUpperCase() ?? ''}${id.slice(1)}`, run.difficulty === id, () => {
        run.difficulty = id;
        rebuildChips();
      }),
    ),
  );

  const comfort = el('chComfort');
  comfort.replaceChildren(
    chip(`Reduced flash: ${s.reducedFlash ? 'ON' : 'OFF'}`, s.reducedFlash, () => {
      s.reducedFlash = !s.reducedFlash;
    }),
  );

  const speed = el('chTextSpeed');
  speed.replaceChildren(
    ...(['Slow', 'Normal', 'Fast'] as const).map((label, i) =>
      chip(label, s.textSpeed === i, () => {
        s.textSpeed = i as 0 | 1 | 2;
      }),
    ),
  );

  const dpad = el('chDpad');
  dpad.replaceChildren(
    ...(['left', 'right'] as const).map((side) =>
      chip(side === 'left' ? 'Left side' : 'Right side', s.dpadSide === side, () => {
        s.dpadSide = side;
        applyLive();
      }),
    ),
    ...DPAD_SCALES.map(({ label, value }) =>
      chip(label, Math.abs(s.dpadScale - value) < 0.01, () => {
        s.dpadScale = value;
        applyLive();
      }),
    ),
  );
}

function bindSlider(id: string, get: () => number, set: (v: number) => void): void {
  const input = el<HTMLInputElement>(id);
  const valueEl = el(`${id}V`);
  const render = (): void => {
    input.value = String(Math.round(get() * 100));
    valueEl.textContent = `${String(Math.round(get() * 100))}%`;
  };
  render();
  input.oninput = () => {
    set(Number(input.value) / 100);
    valueEl.textContent = `${input.value}%`;
    applyLive();
  };
  // A blip on release so the new level is audible immediately.
  input.onchange = () => {
    playSfx('select');
  };
}

function refreshSaveRow(): void {
  if (!ctx) return;
  const hasManual = ctx.loadManual() !== null;
  el<HTMLButtonElement>('loadManual').disabled = !hasManual;
  el('saveNote').textContent = hasManual
    ? 'A manual save exists. Auto-save still runs on its own.'
    : 'No manual save yet. Auto-save still runs on its own.';
}

export function openSettings(c: SettingsCtx): void {
  ctx = c;
  const s = c.state.settings;
  bindSlider(
    'volMaster',
    () => s.master,
    (v) => {
      s.master = v;
    },
  );
  bindSlider(
    'volMusic',
    () => s.music,
    (v) => {
      s.music = v;
    },
  );
  bindSlider(
    'volSfx',
    () => s.sfx,
    (v) => {
      s.sfx = v;
    },
  );
  rebuildChips();
  refreshSaveRow();

  el('saveManual').onclick = () => {
    if (!ctx) return;
    if (ctx.onManualSave()) {
      playSfx('confirm');
      toast('Game saved.');
    } else {
      playSfx('deny');
      toast('Could not save. Storage may be full.');
    }
    refreshSaveRow();
  };
  el('loadManual').onclick = () => {
    if (!ctx) return;
    const loaded = ctx.loadManual();
    if (!loaded) return;
    playSfx('confirm');
    const apply = ctx.onLoadState;
    closeSettings();
    toast('Save loaded.');
    apply(loaded);
  };
  el('codeImport').onclick = () => {
    if (!ctx) return;
    const raw = el<HTMLInputElement>('codeField').value;
    const result = importCode(raw, ctx.state);
    const note = el('codeNote');
    if (!result.ok) {
      playSfx('deny');
      note.textContent =
        result.reason === 'malformed'
          ? 'That code does not read as spellcraft.'
          : `You are missing: ${result.parts.join(', ')}. Nothing granted.`;
      return;
    }
    const slots = ctx.state.player.slotsUnlocked;
    const free = ctx.state.player.spells.findIndex((sp, i) => sp === null && i < slots);
    if (free < 0) {
      playSfx('deny');
      note.textContent = 'Every page is full. Clear a slot first.';
      return;
    }
    ctx.state.player.spells[free] = result.spell;
    ctx.state.stats.inscribed += 1;
    playSfx('confirm');
    note.textContent = `Inscribed ${displayName(result.spell)} into slot ${String(free + 1)}.`;
    el<HTMLInputElement>('codeField').value = '';
  };
  el('setclose').onclick = () => {
    playSfx('select');
    closeSettings();
  };
  el('settings').style.display = 'block';
}

export function closeSettings(): void {
  if (!ctx) return;
  const done = ctx.onClose;
  ctx = null;
  el('settings').style.display = 'none';
  done();
}
