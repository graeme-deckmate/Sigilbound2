/**
 * Audio manifest coverage (docs/03 section 11): the synth fallback must
 * cover every SFX id, and every music id needs a loop definition. Tables
 * are plain data so this runs in Node without an AudioContext.
 */
import { describe, expect, it } from 'vitest';
import { MUSIC_IDS, SFX_IDS } from '../src/data/audio.ts';
import { SFX_RECIPES } from '../src/audio/synth.ts';
import { TRACKS } from '../src/audio/music.ts';
import { MAPS } from '../src/data/maps/index.ts';

describe('audio manifest coverage', () => {
  it('manifest matches docs/03 section 11 exactly', () => {
    expect([...MUSIC_IDS]).toEqual([
      'title',
      'hearth',
      'hearthvale',
      'westwood',
      'ashenreach',
      'northhollow',
      'battle',
      'boss',
      'ending',
      'sanctum',
      'hollowwarden',
    ]);
    expect(SFX_IDS).toHaveLength(26);
  });

  it('the synth covers every SFX id', () => {
    for (const id of SFX_IDS) {
      expect(SFX_RECIPES[id], id).toBeDefined();
    }
    // step_grass is deliberately silent (prototype behavior); everything
    // else makes a sound.
    for (const id of SFX_IDS) {
      if (id === 'step_grass') continue;
      expect(SFX_RECIPES[id].length, id).toBeGreaterThan(0);
    }
  });

  it('every recipe step is well formed', () => {
    for (const id of SFX_IDS) {
      for (const step of SFX_RECIPES[id]) {
        expect(step.f, id).toBeGreaterThan(20);
        expect(step.dur, id).toBeGreaterThan(0);
        expect(step.vol, id).toBeGreaterThan(0);
        expect(step.vol, id).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it('every map plays a manifest track', () => {
    for (const map of Object.values(MAPS)) {
      expect(MUSIC_IDS, `${map.id} music "${map.music}"`).toContain(map.music);
    }
  });

  it('every music id has a 16-step loop with sane notes', () => {
    for (const id of MUSIC_IDS) {
      const t = TRACKS[id];
      expect(t, id).toBeDefined();
      expect(t.bpm, id).toBeGreaterThanOrEqual(60);
      expect(t.bpm, id).toBeLessThanOrEqual(180);
      expect(t.bass, id).toHaveLength(16);
      expect(t.lead, id).toHaveLength(16);
      for (const n of [...t.bass, ...t.lead]) {
        if (n !== null) {
          expect(n, id).toBeGreaterThanOrEqual(24); // C1
          expect(n, id).toBeLessThanOrEqual(96); // C7
        }
      }
      // a loop with no notes at all is a data bug
      expect(
        [...t.bass, ...t.lead].some((n) => n !== null),
        id,
      ).toBe(true);
    }
  });
});
