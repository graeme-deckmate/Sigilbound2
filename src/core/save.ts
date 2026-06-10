/**
 * Versioned save/load (docs/01-ARCHITECTURE). Storage is injected so
 * everything here runs under Vitest in Node; scenes pass localStorage.
 * Single auto slot + single manual slot. Never called mid-battle;
 * battle-only statuses are stripped on save.
 */
import type { Dir, GameState, MapId, Spell } from './state.ts';
import { DIRS, MAP_IDS, SHRINE_IDS, START, WORLD_BOSS_IDS } from '../data/constants.ts';
import { ELEMENT_IDS } from '../data/elements.ts';
import { FORM_IDS } from '../data/forms.ts';
import { RUNE_IDS } from '../data/runes.ts';
import { BASE_HP, BASE_MP, STARTING_SPELLS } from '../data/progression.ts';

export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveSlot = 'auto' | 'manual';

/** The documented key (01) is the auto slot; manual gets a suffix. */
export const SAVE_KEYS: Record<SaveSlot, string> = {
  auto: 'sigilbound.save.v1',
  manual: 'sigilbound.save.v1.manual',
};

export class SaveError extends Error {}

export function newGame(): GameState {
  return {
    version: 1,
    player: {
      lv: 1,
      xp: 0,
      hp: BASE_HP,
      mp: BASE_MP,
      maxhp: BASE_HP,
      maxmp: BASE_MP,
      spells: STARTING_SPELLS.map((s) => (s ? { ...s } : null)),
      statuses: {},
    },
    world: {
      mapId: START.mapId,
      x: START.x,
      y: START.y,
      facing: START.facing,
      shrines: { fury: false, thirst: false, echo: false, keen: false },
      bosses: { bogmaw: false, thornveil: false, ashenwarden: false, valewraith: false },
      graceSteps: 0,
      respawn: { mapId: START.mapId, x: START.x, y: START.y },
      flags: {},
    },
    settings: {
      master: 1,
      sfx: 1,
      music: 1,
      reducedFlash: false,
      textSpeed: 1,
      dpadSide: 'left',
      dpadScale: 1,
    },
    stats: { battles: 0, inscribed: 0, steps: 0, defeats: 0, playMs: 0 },
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function oneOf<T extends string>(list: readonly T[], v: unknown, fallback: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

function asSpell(v: unknown): Spell | null {
  if (!isObj(v)) return null;
  const element = v['element'];
  const form = v['form'];
  const rune = v['rune'];
  if (
    typeof element === 'string' &&
    (ELEMENT_IDS as readonly string[]).includes(element) &&
    typeof form === 'string' &&
    (FORM_IDS as readonly string[]).includes(form) &&
    typeof rune === 'string' &&
    (RUNE_IDS as readonly string[]).includes(rune)
  ) {
    return { element, form, rune } as Spell;
  }
  return null;
}

/**
 * Normalize a parsed save payload into a valid v1 GameState.
 * Throws SaveError when the payload is not a v1 save at all; missing or
 * malformed leaf fields fall back to sane defaults instead.
 */
export function migrate(raw: unknown): GameState {
  if (!isObj(raw)) throw new SaveError('save: not an object');
  if (raw['version'] !== 1) throw new SaveError('save: unknown version');
  if (!isObj(raw['player']) || !isObj(raw['world'])) {
    throw new SaveError('save: missing player or world');
  }
  const fresh = newGame();
  const p = raw['player'];
  const w = raw['world'];
  const s = isObj(raw['settings']) ? raw['settings'] : {};
  const st = isObj(raw['stats']) ? raw['stats'] : {};

  const maxhp = Math.max(1, num(p['maxhp'], fresh.player.maxhp));
  const maxmp = Math.max(0, num(p['maxmp'], fresh.player.maxmp));
  const rawSpells = Array.isArray(p['spells']) ? p['spells'] : [];
  const spells = Array.from({ length: 4 }, (_, i) => asSpell(rawSpells[i]));

  const shrines = isObj(w['shrines']) ? w['shrines'] : {};
  const bosses = isObj(w['bosses']) ? w['bosses'] : {};
  const respawnRaw = isObj(w['respawn']) ? w['respawn'] : {};

  const ts = num(s['textSpeed'], 1);
  const textSpeed: 0 | 1 | 2 = ts === 0 ? 0 : ts === 2 ? 2 : 1;

  return {
    version: 1,
    player: {
      lv: Math.max(1, num(p['lv'], 1)),
      xp: Math.max(0, num(p['xp'], 0)),
      hp: Math.min(maxhp, Math.max(0, num(p['hp'], maxhp))),
      mp: Math.min(maxmp, Math.max(0, num(p['mp'], maxmp))),
      maxhp,
      maxmp,
      spells,
      statuses: {}, // battle-only, never restored from disk
    },
    world: {
      mapId: oneOf<MapId>(MAP_IDS, w['mapId'], fresh.world.mapId),
      x: num(w['x'], fresh.world.x),
      y: num(w['y'], fresh.world.y),
      facing: oneOf<Dir>(DIRS, w['facing'], 'down'),
      shrines: Object.fromEntries(
        SHRINE_IDS.map((id) => [id, bool(shrines[id], false)]),
      ) as GameState['world']['shrines'],
      bosses: Object.fromEntries(
        WORLD_BOSS_IDS.map((id) => [id, bool(bosses[id], false)]),
      ) as GameState['world']['bosses'],
      graceSteps: Math.max(0, num(w['graceSteps'], 0)),
      respawn: {
        mapId: oneOf<MapId>(MAP_IDS, respawnRaw['mapId'], fresh.world.respawn.mapId),
        x: num(respawnRaw['x'], fresh.world.respawn.x),
        y: num(respawnRaw['y'], fresh.world.respawn.y),
      },
      flags: ((): Record<string, boolean> => {
        const out: Record<string, boolean> = {};
        if (isObj(w['flags'])) {
          for (const [k, v] of Object.entries(w['flags'])) {
            if (typeof v === 'boolean') out[k] = v;
          }
        }
        return out;
      })(),
    },
    settings: {
      master: Math.min(1, Math.max(0, num(s['master'], 1))),
      sfx: Math.min(1, Math.max(0, num(s['sfx'], 1))),
      music: Math.min(1, Math.max(0, num(s['music'], 1))),
      reducedFlash: bool(s['reducedFlash'], false),
      textSpeed,
      dpadSide: oneOf(['left', 'right'], s['dpadSide'], 'left'),
      dpadScale: Math.min(2, Math.max(0.5, num(s['dpadScale'], 1))),
    },
    stats: {
      battles: Math.max(0, num(st['battles'], 0)),
      inscribed: Math.max(0, num(st['inscribed'], 0)),
      steps: Math.max(0, num(st['steps'], 0)),
      defeats: Math.max(0, num(st['defeats'], 0)),
      playMs: Math.max(0, num(st['playMs'], 0)),
    },
  };
}

/** Serialize and store. Battle statuses are stripped (01). */
export function save(store: KVStore, slot: SaveSlot, state: GameState): void {
  const clean: GameState = {
    ...state,
    player: { ...state.player, statuses: {} },
  };
  store.setItem(SAVE_KEYS[slot], JSON.stringify(clean));
}

/** Load a slot. Returns null when absent or unusable. */
export function load(store: KVStore, slot: SaveSlot): GameState | null {
  const raw = store.getItem(SAVE_KEYS[slot]);
  if (raw === null) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSlot(store: KVStore, slot: SaveSlot): void {
  store.removeItem(SAVE_KEYS[slot]);
}
