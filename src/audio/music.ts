/**
 * Music: per-track .ogg loader with a synth-loop fallback (docs/03
 * section 11). Files are looked up under audio/music/<id>.ogg (served
 * from content/audio via Vite's publicDir); any missing file falls back
 * to the generative chiptune loop defined in TRACKS. Track tables are
 * plain data so tests can assert manifest coverage in Node.
 */
import type { MusicId } from '../data/audio.ts';
import { musicBus, setVolumes } from './synth.ts';
import type { GameState } from '../core/state.ts';

export interface TrackDef {
  bpm: number;
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  /** 16 eighth-note steps; values are MIDI note numbers. */
  bass: readonly (number | null)[];
  lead: readonly (number | null)[];
}

const N = null;

export const TRACKS: Record<MusicId, TrackDef> = {
  title: {
    bpm: 76,
    bassWave: 'triangle',
    leadWave: 'triangle',
    bass: [45, N, N, N, 41, N, N, N, 43, N, N, N, 45, N, N, N],
    lead: [69, N, 72, N, 76, N, 72, N, 71, N, 67, N, 69, N, N, N],
  },
  hearth: {
    bpm: 84,
    bassWave: 'triangle',
    leadWave: 'sine',
    bass: [48, N, N, N, 45, N, N, N, 43, N, N, N, 48, N, N, N],
    lead: [64, N, 67, N, 72, N, 67, N, 69, N, 65, N, 67, N, 64, N],
  },
  hearthvale: {
    bpm: 92,
    bassWave: 'triangle',
    leadWave: 'square',
    bass: [43, N, N, N, 47, N, N, N, 48, N, N, N, 43, N, N, N],
    lead: [67, N, 71, N, 74, N, 71, N, 72, 69, 67, N, 74, N, N, N],
  },
  westwood: {
    bpm: 88,
    bassWave: 'triangle',
    leadWave: 'triangle',
    bass: [40, N, N, N, 43, N, N, N, 45, N, N, N, 40, N, N, N],
    lead: [64, N, 67, N, 71, N, 67, N, 69, N, 66, N, 64, N, N, N],
  },
  ashenreach: {
    bpm: 80,
    bassWave: 'sawtooth',
    leadWave: 'triangle',
    bass: [38, N, N, N, 38, N, N, N, 41, N, N, N, 36, N, N, N],
    lead: [62, N, N, N, 65, N, 62, N, 60, N, N, N, 57, N, N, N],
  },
  northhollow: {
    bpm: 86,
    bassWave: 'triangle',
    leadWave: 'sine',
    bass: [35, N, N, N, N, N, N, N, 38, N, N, N, N, N, N, N],
    lead: [71, N, N, N, 74, N, N, N, N, N, 73, N, 71, N, N, N],
  },
  battle: {
    bpm: 144,
    bassWave: 'square',
    leadWave: 'square',
    bass: [45, 45, N, 45, 48, N, 45, N, 43, 43, N, 43, 45, N, 43, N],
    lead: [69, N, 69, 71, 72, N, 71, 69, 67, N, 67, 69, 71, N, 69, 67],
  },
  boss: {
    bpm: 152,
    bassWave: 'square',
    leadWave: 'square',
    bass: [38, 38, N, 38, 38, N, 41, N, 38, 38, N, 38, 36, N, 38, N],
    lead: [62, N, 65, N, 62, N, 61, N, 62, N, 65, N, 69, N, 68, N],
  },
  ending: {
    bpm: 72,
    bassWave: 'triangle',
    leadWave: 'sine',
    bass: [48, N, N, N, 52, N, N, N, 55, N, N, N, 48, N, N, N],
    lead: [72, N, N, N, 71, N, 67, N, 69, N, N, N, 72, N, N, N],
  },
};

const BASS_VOL = 0.045;
const LEAD_VOL = 0.038;
const LOOKAHEAD_S = 0.25;
const TICK_MS = 80;
const FILE_BASE = 'audio/music/';

function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* ---------- engine state ---------- */

let current: MusicId | null = null;
let token = 0;
let el: HTMLAudioElement | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let trackGain: GainNode | null = null;
let elVolume = 1;
const fileCache = new Map<MusicId, Promise<boolean>>();

function fileAvailable(id: MusicId): Promise<boolean> {
  let probe = fileCache.get(id);
  if (!probe) {
    probe = fetch(`${FILE_BASE}${id}.ogg`, { method: 'HEAD' })
      .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
      .catch(() => false);
    fileCache.set(id, probe);
  }
  return probe;
}

function stopPlayback(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (trackGain) {
    const bus = musicBus();
    if (bus) {
      // Quick fade so loop teardown never clicks.
      trackGain.gain.setTargetAtTime(0.0001, bus.ctx.currentTime, 0.08);
      const dying = trackGain;
      setTimeout(() => {
        dying.disconnect();
      }, 400);
    }
    trackGain = null;
  }
  if (el) {
    el.pause();
    el = null;
  }
}

function startSynthLoop(id: MusicId): void {
  const bus = musicBus();
  if (!bus) return;
  const def = TRACKS[id];
  const stepDur = 30 / def.bpm; // eighth notes
  const gain = bus.ctx.createGain();
  gain.gain.value = 1;
  gain.connect(bus.out);
  trackGain = gain;

  let nextTime = bus.ctx.currentTime + 0.05;
  let step = 0;
  const note = (midi: number, wave: OscillatorType, vol: number, at: number, dur: number): void => {
    const o = bus.ctx.createOscillator();
    const g = bus.ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq(midi), at);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(gain);
    o.start(at);
    o.stop(at + dur + 0.02);
  };
  timer = setInterval(() => {
    if (bus.ctx.state === 'suspended') return;
    while (nextTime < bus.ctx.currentTime + LOOKAHEAD_S) {
      const b = def.bass[step % 16] ?? null;
      const l = def.lead[step % 16] ?? null;
      if (b !== null) note(b, def.bassWave, BASS_VOL, nextTime, stepDur * 1.7);
      if (l !== null) note(l, def.leadWave, LEAD_VOL, nextTime, stepDur * 0.92);
      nextTime += stepDur;
      step += 1;
    }
  }, TICK_MS);
}

/** Switch tracks; restarting the current track is a no-op. */
export function playMusic(id: MusicId): void {
  if (current === id) return;
  current = id;
  token += 1;
  const my = token;
  stopPlayback();
  void fileAvailable(id).then((hasFile) => {
    if (my !== token) return;
    if (hasFile) {
      el = new Audio(`${FILE_BASE}${id}.ogg`);
      el.loop = true;
      el.volume = elVolume;
      void el.play().catch(() => {
        // Autoplay refused before the first gesture: the next
        // applyAudioSettings or unlock retries via play().
      });
      return;
    }
    startSynthLoop(id);
  });
}

export function stopMusic(): void {
  current = null;
  token += 1;
  stopPlayback();
}

/**
 * Push the settings volumes into both engines: the synth mix bus and
 * any playing file element (which bypasses WebAudio).
 */
export function applyAudioSettings(settings: GameState['settings']): void {
  setVolumes(settings.master, settings.sfx, settings.music);
  elVolume = Math.min(1, Math.max(0, settings.master * settings.music));
  if (el) {
    el.volume = elVolume;
    if (el.paused) void el.play().catch(() => undefined);
  }
}
