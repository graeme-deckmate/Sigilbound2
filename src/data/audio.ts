/** Audio manifest ids, transcribed from docs/03-CONTENT-DATA section 11. */

export const MUSIC_IDS = [
  'title',
  'hearth',
  'hearthvale',
  'westwood',
  'ashenreach',
  'northhollow',
  'battle',
  'boss',
  'ending',
] as const;
export type MusicId = (typeof MUSIC_IDS)[number];

export const SFX_IDS = [
  'select',
  'confirm',
  'deny',
  'cast',
  'hit',
  'crit',
  'hurt',
  'heal',
  'shield_up',
  'shield_break',
  'status_apply',
  'encounter',
  'victory',
  'defeat',
  'levelup',
  'unlock',
  'step_grass',
  'boss_telegraph',
] as const;
export type SfxId = (typeof SFX_IDS)[number];
