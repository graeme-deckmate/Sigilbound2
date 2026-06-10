/**
 * WebAudio synth fallback, ported from the prototype's tone()/SFX table
 * and extended to cover every id in docs/03 section 11. Recipe tables
 * are plain data (Node-testable); the AudioContext is created lazily on
 * first play so importing this module never touches browser APIs.
 */
import type { SfxId } from '../data/audio.ts';

export interface ToneStep {
  /** Start frequency in Hz. */
  f: number;
  /** Duration in seconds. */
  dur: number;
  type: OscillatorType;
  /** Peak gain before the mix bus. */
  vol: number;
  /** Start offset in seconds. */
  delay?: number;
  /** Hz added (or removed) by an exponential ramp over dur. */
  slide?: number;
}

/**
 * One recipe per manifest id. Prototype-canon recipes are kept verbatim;
 * the ids the prototype lacked are authored in the same voice.
 * step_grass is deliberately silent, like the prototype's step().
 */
export const SFX_RECIPES: Record<SfxId, readonly ToneStep[]> = {
  select: [{ f: 620, dur: 0.05, type: 'square', vol: 0.04 }],
  confirm: [
    { f: 520, dur: 0.06, type: 'square', vol: 0.045 },
    { f: 780, dur: 0.08, type: 'square', vol: 0.045, delay: 0.06 },
  ],
  deny: [{ f: 140, dur: 0.12, type: 'sawtooth', vol: 0.05, slide: -60 }],
  cast: [{ f: 300, dur: 0.12, type: 'triangle', vol: 0.05, slide: 400 }],
  hit: [
    { f: 180, dur: 0.1, type: 'sawtooth', vol: 0.07, slide: -120 },
    { f: 90, dur: 0.12, type: 'square', vol: 0.05, delay: 0.02, slide: -40 },
  ],
  crit: [
    { f: 900, dur: 0.06, type: 'square', vol: 0.06 },
    { f: 1200, dur: 0.1, type: 'square', vol: 0.06, delay: 0.05 },
  ],
  hurt: [{ f: 120, dur: 0.16, type: 'sawtooth', vol: 0.07, slide: -70 }],
  heal: [
    { f: 520, dur: 0.09, type: 'sine', vol: 0.05 },
    { f: 660, dur: 0.09, type: 'sine', vol: 0.05, delay: 0.08 },
    { f: 880, dur: 0.12, type: 'sine', vol: 0.05, delay: 0.16 },
  ],
  shield_up: [
    { f: 330, dur: 0.1, type: 'sine', vol: 0.05 },
    { f: 440, dur: 0.14, type: 'sine', vol: 0.05, delay: 0.08 },
  ],
  shield_break: [
    { f: 500, dur: 0.08, type: 'square', vol: 0.06, slide: -200 },
    { f: 160, dur: 0.14, type: 'sawtooth', vol: 0.06, delay: 0.05, slide: -80 },
  ],
  status_apply: [
    { f: 420, dur: 0.09, type: 'triangle', vol: 0.05, slide: -120 },
    { f: 360, dur: 0.09, type: 'triangle', vol: 0.05, delay: 0.08, slide: -100 },
  ],
  encounter: [
    { f: 220, dur: 0.1, type: 'square', vol: 0.06, slide: 300 },
    { f: 220, dur: 0.1, type: 'square', vol: 0.06, delay: 0.12, slide: 300 },
  ],
  victory: [
    { f: 523, dur: 0.14, type: 'square', vol: 0.05 },
    { f: 659, dur: 0.14, type: 'square', vol: 0.05, delay: 0.12 },
    { f: 784, dur: 0.14, type: 'square', vol: 0.05, delay: 0.24 },
    { f: 1046, dur: 0.14, type: 'square', vol: 0.05, delay: 0.36 },
  ],
  defeat: [
    { f: 300, dur: 0.2, type: 'triangle', vol: 0.06 },
    { f: 250, dur: 0.2, type: 'triangle', vol: 0.06, delay: 0.18 },
    { f: 200, dur: 0.2, type: 'triangle', vol: 0.06, delay: 0.36 },
    { f: 150, dur: 0.2, type: 'triangle', vol: 0.06, delay: 0.54 },
  ],
  levelup: [
    { f: 392, dur: 0.12, type: 'square', vol: 0.05 },
    { f: 494, dur: 0.12, type: 'square', vol: 0.05, delay: 0.1 },
    { f: 587, dur: 0.12, type: 'square', vol: 0.05, delay: 0.2 },
    { f: 784, dur: 0.12, type: 'square', vol: 0.05, delay: 0.3 },
  ],
  unlock: [
    { f: 660, dur: 0.08, type: 'square', vol: 0.045 },
    { f: 990, dur: 0.1, type: 'square', vol: 0.045, delay: 0.07 },
    { f: 1320, dur: 0.14, type: 'sine', vol: 0.04, delay: 0.14 },
  ],
  step_grass: [],
  reaction: [
    { f: 740, dur: 0.07, type: 'square', vol: 0.055 },
    { f: 1110, dur: 0.09, type: 'square', vol: 0.05, delay: 0.05 },
    { f: 555, dur: 0.12, type: 'triangle', vol: 0.05, delay: 0.1, slide: 240 },
  ],
  surge: [
    { f: 220, dur: 0.16, type: 'sawtooth', vol: 0.05, slide: 520 },
    { f: 660, dur: 0.12, type: 'triangle', vol: 0.045, delay: 0.12, slide: -300 },
  ],
  gate_open: [
    { f: 196, dur: 0.18, type: 'triangle', vol: 0.06 },
    { f: 392, dur: 0.16, type: 'triangle', vol: 0.05, delay: 0.14 },
    { f: 784, dur: 0.2, type: 'sine', vol: 0.045, delay: 0.28 },
  ],
  essence_pickup: [
    { f: 880, dur: 0.07, type: 'sine', vol: 0.05 },
    { f: 1175, dur: 0.1, type: 'sine', vol: 0.045, delay: 0.06 },
  ],
  scroll_cast: [
    { f: 400, dur: 0.1, type: 'triangle', vol: 0.055, slide: 600 },
    { f: 1000, dur: 0.14, type: 'square', vol: 0.05, delay: 0.08, slide: 300 },
  ],
  commission_done: [
    { f: 523, dur: 0.12, type: 'square', vol: 0.05 },
    { f: 784, dur: 0.12, type: 'square', vol: 0.05, delay: 0.1 },
    { f: 659, dur: 0.16, type: 'sine', vol: 0.05, delay: 0.2 },
  ],
  summon: [
    { f: 311, dur: 0.14, type: 'triangle', vol: 0.05, slide: 160 },
    { f: 622, dur: 0.16, type: 'sine', vol: 0.045, delay: 0.12 },
  ],
  mastery_tier: [
    { f: 587, dur: 0.1, type: 'square', vol: 0.05 },
    { f: 880, dur: 0.1, type: 'square', vol: 0.05, delay: 0.09 },
    { f: 1174, dur: 0.16, type: 'sine', vol: 0.045, delay: 0.18 },
  ],
  boss_telegraph: [
    { f: 110, dur: 0.3, type: 'triangle', vol: 0.07, slide: -30 },
    { f: 82, dur: 0.4, type: 'triangle', vol: 0.07, delay: 0.25, slide: -20 },
  ],
};

/* ---------- mix bus ---------- */

interface Mixer {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
}

let mixer: Mixer | null = null;
let volumes = { master: 1, sfx: 1, music: 1 };

function getMixer(): Mixer | null {
  if (mixer) return mixer;
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    const music = ctx.createGain();
    master.connect(ctx.destination);
    sfx.connect(master);
    music.connect(master);
    mixer = { ctx, master, sfx, music };
    applyVolumes();
  } catch {
    mixer = null;
  }
  return mixer;
}

function applyVolumes(): void {
  if (!mixer) return;
  mixer.master.gain.value = volumes.master;
  mixer.sfx.gain.value = volumes.sfx;
  mixer.music.gain.value = volumes.music;
}

/** Push the current settings volumes into the mix bus. */
export function setVolumes(master: number, sfx: number, music: number): void {
  volumes = { master, sfx, music };
  applyVolumes();
}

/**
 * Browsers gate audio behind a user gesture: call from any pointer or
 * key handler. Safe to call repeatedly.
 */
export function unlockAudio(): void {
  const m = getMixer();
  if (m && m.ctx.state === 'suspended') void m.ctx.resume();
}

/** The music engine renders through this bus (volume + mute follow it). */
export function musicBus(): { ctx: AudioContext; out: GainNode } | null {
  const m = getMixer();
  return m ? { ctx: m.ctx, out: m.music } : null;
}

function tone(m: Mixer, step: ToneStep): void {
  const t0 = m.ctx.currentTime + (step.delay ?? 0);
  const o = m.ctx.createOscillator();
  const g = m.ctx.createGain();
  o.type = step.type;
  o.frequency.setValueAtTime(step.f, t0);
  if (step.slide) {
    o.frequency.exponentialRampToValueAtTime(Math.max(30, step.f + step.slide), t0 + step.dur);
  }
  g.gain.setValueAtTime(step.vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + step.dur);
  o.connect(g).connect(m.sfx);
  o.start(t0);
  o.stop(t0 + step.dur + 0.02);
}

/** Fire one manifest SFX through the mix bus. */
export function playSfx(id: SfxId): void {
  if (volumes.master <= 0 || volumes.sfx <= 0) return;
  const m = getMixer();
  if (!m || m.ctx.state === 'suspended') return;
  for (const step of SFX_RECIPES[id]) tone(m, step);
}
