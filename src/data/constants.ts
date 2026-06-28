/**
 * Render and UI constants. The core palette is the prototype palette
 * family (docs/03-CONTENT-DATA section 9). Region accent palettes join
 * this file in Phase 2+.
 */

export const PALETTE = {
  /** Deep page background behind everything. */
  abyss: '#0d0a1c',
  ink: '#16112b',
  night: '#241d42',
  night2: '#2e2554',
  arcane: '#9d7bff',
  arcane2: '#6f4fd8',
  gold: '#ffc857',
  parch: '#efe6d0',
  dim: '#9c92c0',
  danger: '#ff6b6b',
} as const;

/** Tile size in pixels, matching the prototype. */
export const TILE = 16;

/**
 * Viewport sizing, ported from the prototype: pick the largest integer
 * scale that still fits at least MIN_VIEW_TILES tiles along the shorter
 * screen edge, never below MIN_SCALE.
 */
export const MIN_VIEW_TILES = 12;
export const MIN_SCALE = 2;

export const FONT_DISPLAY = "'Press Start 2P', 'VT323', ui-monospace, monospace";
export const FONT_UI = "'VT323', ui-monospace, 'Courier New', monospace";

export const PLAYER_NAME = 'Wrender';

/** Spell and damage formula constants (docs/03-CONTENT-DATA section 4). */
export const COMBAT = {
  /** Base of powerPerHit = base * form.pw * (rune.pw ?? 1) * lvScale. */
  basePower: 13,
  /** lvScale = 1 + (lv - 1) * levelScaling. */
  levelScaling: 0.22,
  /** cost = max(costMin, round(costBase * form.mp * rune.mp)). */
  costBase: 6,
  costMin: 2,
  varianceMin: 0.9,
  varianceMax: 1.1,
  critChance: 0.08,
  critMult: 1.5,
  procCap: 0.95,
  weakMult: 1.6,
  resistMult: 0.6,
  /** Potency slider (v1.1, 03 section 4): 0.70..1.50 step 0.05,
   *  default 1.00, locked at inscribe. Wraithmark extends to 1.80
   *  (Phase 14). */
  potencyMin: 0.7,
  potencyMax: 1.5,
  potencyStep: 0.05,
  potencyDefault: 1,
  /** Snap detents for the slider handle (02 UX). */
  potencyDetents: [0.7, 1, 1.5],
  /** potCost piecewise-linear anchor points (p, costMult). */
  potCostAnchors: [
    [0.7, 0.6],
    [1, 1],
    [1.5, 2],
  ],
  /** Every resolved hit deals at least this much. */
  minDamage: 1,
  /** veilShield = round(veilBase * (rune.pw ?? 1) * lvScale * form.pw). */
  veilBase: 14,
  /** Veil rider proc on shield hit; volt's stun rider is lower. */
  veilRiderProc: 0.4,
  veilRiderProcVolt: 0.25,
} as const;

/**
 * New-game spawn. Provisional until Phase 2 authors the hearth map;
 * the map's spawn-point metadata then becomes the source of truth.
 */
export const START = { mapId: 'hearth', x: 15, y: 10, facing: 'down' } as const;

/**
 * Battle log pacing, ported from the prototype: a line shows for
 * max(min, perChar * length) ms, scaled by the textSpeed setting
 * (0 slow, 1 normal, 2 fast).
 */
export const SAY_MIN_MS = 650;
export const SAY_PER_CHAR_MS = 26;
export const TEXT_SPEED_MULT = [1.45, 1, 0.55] as const;

/** Battle backdrop palettes per encounter zone (prototype family). */
export interface ZoneBackdrop {
  sky: readonly [string, string];
  hill: string;
  ground: string;
}

export const ZONE_BACKDROPS: Record<string, ZoneBackdrop> = {
  'hearthvale.meadow': { sky: ['#1c3b4f', '#27604f'], hill: '#163a31', ground: '#2c6e49' },
  'hearthvale.marsh': { sky: ['#14253c', '#1d4034'], hill: '#0f2c22', ground: '#23553a' },
  'westwood.outer': { sky: ['#14253c', '#1d4034'], hill: '#0f2c22', ground: '#23553a' },
  'westwood.deep': { sky: ['#101e33', '#16332a'], hill: '#0b231b', ground: '#1c4630' },
  'ashenreach.outer': { sky: ['#2c1f44', '#473057'], hill: '#241a3a', ground: '#3e2f56' },
  'ashenreach.inner': { sky: ['#241936', '#3a2747'], hill: '#1d1530', ground: '#332646' },
  'northhollow.cliffs': { sky: ['#181436', '#2a2358'], hill: '#13102b', ground: '#34306b' },
  'northhollow.hollow': { sky: ['#0c0918', '#241d42'], hill: '#0a0714', ground: '#1d1838' },
  /** Drowned violet (03 section 23). */
  'sanctum.halls': { sky: ['#120e2e', '#2c2363'], hill: '#0e0b24', ground: '#3b3375' },
  /** The Sunken Crypt: black water under cold stone (v2 W2). */
  'sunkencrypt.flooded': { sky: ['#0a1418', '#13313a'], hill: '#08171b', ground: '#16414a' },
  /** The Dead Circuit Vault: rust and dead sparks (v2 W5). */
  'circuitvault.live': { sky: ['#1a1006', '#3a2410'], hill: '#140c04', ground: '#4a3016' },
  /** Reaches - Cinderwaste (Ember): scorched red rock. */
  'cinderwaste.wastes': { sky: ['#2a1006', '#5a2410'], hill: '#3a1408', ground: '#6e3018' },
  'cinderwaste.deep': { sky: ['#1a0a04', '#451a0a'], hill: '#2a0e06', ground: '#552410' },
  /** Reaches - Hoarfrost Hold (Rime): pale blue ice. */
  'hoarfrost.fields': { sky: ['#0c2440', '#2a5a8a'], hill: '#0a1c33', ground: '#3a6e9b' },
  'hoarfrost.deep': { sky: ['#08182e', '#1d4068'], hill: '#06121f', ground: '#2a5078' },
  /** Reaches - Stormreach (Volt): bruised violet sky. */
  'stormreach.heights': { sky: ['#1a1038', '#3a2a6a'], hill: '#140c28', ground: '#4a3a7a' },
  'stormreach.deep': { sky: ['#0e0820', '#2a1e52'], hill: '#0a0618', ground: '#352a5e' },
  /** Reaches - The Mire (Thorn/Gloom): sickly green dusk. */
  'themire.bog': { sky: ['#0e2414', '#1d4a2a'], hill: '#0a1a0e', ground: '#244e2e' },
  'themire.deep': { sky: ['#080f0a', '#142e1a'], hill: '#060b08', ground: '#163a20' },
  /** Reaches side dungeon - the Emberforge: molten orange. */
  'emberforge.forge': { sky: ['#2a0e04', '#6e2810'], hill: '#1a0802', ground: '#7e3414' },
  /** Fallback for scripted or boss battles without a zone. */
  default: { sky: ['#181436', '#2a2358'], hill: '#13102b', ground: '#34306b' },
};

/** Runtime id lists mirroring the unions in core/state.ts. */
export const MAP_IDS = [
  'hearth',
  'hearthvale',
  'westwood',
  'ashenreach',
  'northhollow',
  'sanctum',
  'sunkencrypt',
  'circuitvault',
  'wayhold',
  'cinderwaste',
  'hoarfrost',
  'stormreach',
  'themire',
  'emberforge',
] as const;
export const SHRINE_IDS = ['fury', 'thirst', 'echo', 'keen'] as const;
export const WORLD_BOSS_IDS = [
  'bogmaw',
  'thornveil',
  'ashenwarden',
  'valewraith',
  'hollowwarden',
  'emberjaw',
  'pyrewarden',
  'rimehound',
  'hoarwarden',
  'galecaller',
  'tempest',
  'bramblemaw',
  'gloamwarden',
] as const;
export const DIRS = ['up', 'down', 'left', 'right'] as const;
