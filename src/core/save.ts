/**
 * Versioned save/load (docs/01-ARCHITECTURE). Storage is injected so
 * everything here runs under Vitest in Node; scenes pass localStorage.
 * Single auto slot + single manual slot. Never called mid-battle;
 * battle-only statuses are stripped on save.
 */
import type { Dir, ElementId, GameState, MapId, Spell } from './state.ts';
import type { Equipment, GearItem, ItemRarity } from './items.ts';
import { EQUIP_SLOT_IDS, RARITY_IDS, emptyEquipment } from './items.ts';
import { COMBAT, DIRS, MAP_IDS, SHRINE_IDS, START, WORLD_BOSS_IDS } from '../data/constants.ts';
import { ELEMENT_IDS } from '../data/elements.ts';
import { FORM_IDS } from '../data/forms.ts';
import { RUNE_IDS } from '../data/runes.ts';
import { GEAR_BASES } from '../data/gear.ts';
import { affixById } from '../data/affixes.ts';
import { DIFFICULTY_IDS } from '../data/difficulty.ts';
import type { DifficultyId } from '../data/difficulty.ts';
import { CLASS_IDS } from '../data/classes.ts';
import type { ClassId } from '../data/classes.ts';
import {
  BASE_HP,
  BASE_MP,
  BASE_SLOTS,
  INVENTORY_CAPACITY,
  MAX_SLOTS,
} from '../data/progression.ts';

export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveSlot = 'auto' | 'manual';

/** The documented key (01) is the auto slot; manual gets a suffix. */
export const SAVE_KEYS: Record<SaveSlot, string> = {
  auto: 'sigilbound2.save.v1',
  manual: 'sigilbound2.save.v1.manual',
};

export class SaveError extends Error {}

export function newGame(): GameState {
  return {
    version: 3,
    player: {
      lv: 1,
      xp: 0,
      hp: BASE_HP,
      mp: BASE_MP,
      maxhp: BASE_HP,
      maxmp: BASE_MP,
      // Slots stay empty until the Elder's starter choice fills 1-2.
      spells: Array.from({ length: MAX_SLOTS }, () => null),
      slotsUnlocked: BASE_SLOTS,
      starter: null,
      essence: 0,
      mastery: { ember: 0, rime: 0, volt: 0, thorn: 0, gloom: 0 },
      charms: { owned: [], equipped: [null, null] },
      scrolls: [],
      ngPlus: 0,
      gold: 0,
      equipment: emptyEquipment(),
      inventory: { gear: [], capacity: INVENTORY_CAPACITY },
      klass: null,
      appearance: { palette: 'default' },
      statuses: {},
    },
    world: {
      mapId: START.mapId,
      x: START.x,
      y: START.y,
      facing: START.facing,
      shrines: { fury: false, thirst: false, echo: false, keen: false },
      bosses: {
        bogmaw: false,
        thornveil: false,
        ashenwarden: false,
        valewraith: false,
        hollowwarden: false,
        emberjaw: false,
        pyrewarden: false,
        rimehound: false,
        hoarwarden: false,
        galecaller: false,
        tempest: false,
        bramblemaw: false,
        gloamwarden: false,
      },
      graceSteps: 0,
      respawn: { mapId: START.mapId, x: START.x, y: START.y },
      flags: {},
      aspect: null,
      essenceMarker: null,
      dungeon: null,
      run: { difficulty: 'standard', modifiers: [], seed: 0 },
    },
    notes: [],
    feats: [],
    bestiary: {},
    settings: {
      master: 1,
      sfx: 1,
      music: 1,
      reducedFlash: false,
      textSpeed: 1,
      dpadSide: 'left',
      dpadScale: 1,
    },
    stats: {
      battles: 0,
      inscribed: 0,
      steps: 0,
      defeats: 0,
      playMs: 0,
      severeSurges: 0,
      glimmersCaught: 0,
      elitesFelled: 0,
    },
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
    // v1 spells carry no potency: they were inscribed at 1.0.
    const rawP = num(v['p'], 1);
    const p = Math.min(COMBAT.potencyMax, Math.max(COMBAT.potencyMin, rawP));
    const given = typeof v['given'] === 'string' ? v['given'].slice(0, 18) : undefined;
    const spell = { element, form, rune, p } as Spell;
    if (given && given.length > 0) spell.given = given;
    return spell;
  }
  return null;
}

/** Validate a parsed gear item (v2 V1); drops malformed instances. */
function asGearItem(v: unknown): GearItem | null {
  if (!isObj(v)) return null;
  const base = v['base'];
  const uid = v['uid'];
  if (typeof base !== 'string' || !(base in GEAR_BASES)) return null;
  if (typeof uid !== 'string') return null;
  const def = GEAR_BASES[base];
  if (!def) return null;
  const rarity: ItemRarity = oneOf<ItemRarity>(RARITY_IDS, v['rarity'], 'common');
  const affixes = (Array.isArray(v['affixes']) ? v['affixes'] : []).filter(
    (a): a is string => typeof a === 'string' && affixById(a) !== null,
  );
  return { uid, base, slot: def.slot, rarity, affixes };
}

/** Normalize equipment, keeping only slots whose uid is actually owned. */
function asEquipment(v: unknown, ownedUids: ReadonlySet<string>): Equipment {
  const out = emptyEquipment();
  if (!isObj(v)) return out;
  for (const slot of EQUIP_SLOT_IDS) {
    const uid = v[slot];
    if (typeof uid === 'string' && ownedUids.has(uid)) out[slot] = uid;
  }
  return out;
}

/**
 * Normalize a parsed save payload into a valid v2 GameState.
 * v1 payloads upgrade in place: spells gain potency 1.0, the starter
 * backfills as Ember (every v1 run started with it), and the v1.1
 * fields take their defaults. Throws SaveError when the payload is not
 * a v1 or v2 save at all; missing or malformed leaf fields fall back
 * to sane defaults instead.
 */
export function migrate(raw: unknown): GameState {
  if (!isObj(raw)) throw new SaveError('save: not an object');
  const version = raw['version'];
  if (version !== 1 && version !== 2 && version !== 3) {
    throw new SaveError('save: unknown version');
  }
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
  const spells = Array.from({ length: MAX_SLOTS }, (_, i) => asSpell(rawSpells[i]));

  // v1 saves predate the Elder's question; they all began with Ember.
  const starter =
    version === 1
      ? 'ember'
      : p['starter'] === null
        ? null
        : oneOf<ElementId>(['ember', 'rime', 'thorn'], p['starter'], 'ember');
  const slotsRaw = num(p['slotsUnlocked'], BASE_SLOTS);
  const slotsUnlocked: 4 | 5 | 6 = slotsRaw >= 6 ? 6 : slotsRaw === 5 ? 5 : 4;
  const masteryRaw = isObj(p['mastery']) ? p['mastery'] : {};
  const charmsRaw = isObj(p['charms']) ? p['charms'] : {};
  const ownedRaw = Array.isArray(charmsRaw['owned']) ? charmsRaw['owned'] : [];
  const equippedRaw = Array.isArray(charmsRaw['equipped']) ? charmsRaw['equipped'] : [];
  const asCharm = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const markerRaw = isObj(w['essenceMarker']) ? w['essenceMarker'] : null;

  const shrines = isObj(w['shrines']) ? w['shrines'] : {};
  const bosses = isObj(w['bosses']) ? w['bosses'] : {};
  const respawnRaw = isObj(w['respawn']) ? w['respawn'] : {};

  const ts = num(s['textSpeed'], 1);
  const textSpeed: 0 | 1 | 2 = ts === 0 ? 0 : ts === 2 ? 2 : 1;

  return {
    version: 3,
    player: {
      lv: Math.max(1, num(p['lv'], 1)),
      xp: Math.max(0, num(p['xp'], 0)),
      hp: Math.min(maxhp, Math.max(0, num(p['hp'], maxhp))),
      mp: Math.min(maxmp, Math.max(0, num(p['mp'], maxmp))),
      maxhp,
      maxmp,
      spells,
      slotsUnlocked,
      starter,
      essence: Math.max(0, Math.floor(num(p['essence'], 0))),
      mastery: Object.fromEntries(
        ELEMENT_IDS.map((id) => [id, Math.max(0, Math.floor(num(masteryRaw[id], 0)))]),
      ) as GameState['player']['mastery'],
      charms: {
        owned: ownedRaw.filter((c): c is string => typeof c === 'string'),
        equipped: [asCharm(equippedRaw[0]), asCharm(equippedRaw[1])],
      },
      scrolls: (Array.isArray(p['scrolls']) ? p['scrolls'] : [])
        .map(asSpell)
        .filter((sp): sp is Spell => sp !== null),
      ngPlus: Math.max(0, num(p['ngPlus'], 0)),
      gold: Math.max(0, Math.floor(num(p['gold'], 0))),
      inventory: ((): GameState['player']['inventory'] => {
        const inv = isObj(p['inventory']) ? p['inventory'] : {};
        const gear = (Array.isArray(inv['gear']) ? inv['gear'] : [])
          .map(asGearItem)
          .filter((g): g is GearItem => g !== null);
        return {
          gear,
          capacity: Math.max(gear.length, Math.floor(num(inv['capacity'], INVENTORY_CAPACITY))),
        };
      })(),
      equipment: ((): Equipment => {
        const inv = isObj(p['inventory']) ? p['inventory'] : {};
        const gearArr = (Array.isArray(inv['gear']) ? inv['gear'] : [])
          .map(asGearItem)
          .filter((g): g is GearItem => g !== null);
        const owned = new Set(gearArr.map((g) => g.uid));
        return asEquipment(p['equipment'], owned);
      })(),
      klass:
        typeof p['klass'] === 'string' && (CLASS_IDS as readonly string[]).includes(p['klass'])
          ? (p['klass'] as ClassId)
          : null,
      appearance: {
        palette:
          isObj(p['appearance']) && typeof p['appearance']['palette'] === 'string'
            ? p['appearance']['palette']
            : 'default',
      },
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
      aspect:
        typeof w['aspect'] === 'string'
          ? oneOf<ElementId>(ELEMENT_IDS, w['aspect'], 'ember')
          : null,
      essenceMarker:
        markerRaw && num(markerRaw['amount'], 0) > 0
          ? {
              mapId: oneOf<MapId>(MAP_IDS, markerRaw['mapId'], fresh.world.mapId),
              x: num(markerRaw['x'], 0),
              y: num(markerRaw['y'], 0),
              amount: Math.floor(num(markerRaw['amount'], 0)),
            }
          : null,
      dungeon: ((): GameState['world']['dungeon'] => {
        const d = w['dungeon'];
        if (!isObj(d)) return null;
        const ent = isObj(d['entrance']) ? d['entrance'] : null;
        if (typeof d['id'] !== 'string' || !ent) return null;
        const flags: Record<string, boolean> = {};
        if (isObj(d['flags'])) {
          for (const [k, v] of Object.entries(d['flags'])) {
            if (typeof v === 'boolean') flags[k] = v;
          }
        }
        return {
          id: d['id'],
          entrance: {
            mapId: oneOf<MapId>(MAP_IDS, ent['mapId'], fresh.world.mapId),
            x: num(ent['x'], 0),
            y: num(ent['y'], 0),
          },
          flags,
        };
      })(),
      run: ((): GameState['world']['run'] => {
        const r = isObj(w['run']) ? w['run'] : {};
        return {
          difficulty: oneOf<DifficultyId>(DIFFICULTY_IDS, r['difficulty'], 'standard'),
          modifiers: (Array.isArray(r['modifiers']) ? r['modifiers'] : []).filter(
            (m): m is string => typeof m === 'string',
          ),
          seed: Math.floor(num(r['seed'], 0)),
        };
      })(),
    },
    notes: (Array.isArray(raw['notes']) ? raw['notes'] : []).filter(
      (n): n is string => typeof n === 'string',
    ),
    feats: (Array.isArray(raw['feats']) ? raw['feats'] : []).filter(
      (n): n is string => typeof n === 'string',
    ),
    bestiary: ((): GameState['bestiary'] => {
      const out: GameState['bestiary'] = {};
      const raw2 = isObj(raw['bestiary']) ? raw['bestiary'] : {};
      for (const [k, v] of Object.entries(raw2)) {
        if (!isObj(v)) continue;
        out[k] = {
          kills: Math.max(0, num(v['kills'], 0)),
          weak: (Array.isArray(v['weak']) ? v['weak'] : []).filter(
            (e): e is ElementId =>
              typeof e === 'string' && (ELEMENT_IDS as readonly string[]).includes(e),
          ),
          statuses: (Array.isArray(v['statuses']) ? v['statuses'] : []).filter(
            (e): e is string => typeof e === 'string',
          ),
          reactions: (Array.isArray(v['reactions']) ? v['reactions'] : []).filter(
            (e): e is string => typeof e === 'string',
          ),
        };
      }
      return out;
    })(),
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
      severeSurges: Math.max(0, num(st['severeSurges'], 0)),
      glimmersCaught: Math.max(0, num(st['glimmersCaught'], 0)),
      elitesFelled: Math.max(0, num(st['elitesFelled'], 0)),
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
