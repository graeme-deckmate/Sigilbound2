/**
 * Converts this game's baked data into a Worldsmith "World" document and writes it
 * to the Worldsmith repo as a bundled, editable sample. Run:
 *   node --experimental-strip-types --no-warnings scripts/to-worldsmith.ts
 *
 * Worldsmith's schema was modelled on this game's shapes, so most tables map 1:1;
 * the wheel (reactions/surges/twins) and the SOFT_GATES predicates are interpreted.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ELEMENTS } from '../src/data/elements.ts';
import { FORMS } from '../src/data/forms.ts';
import { RUNES } from '../src/data/runes.ts';
import { ENEMY_STATUSES, PLAYER_STATUSES } from '../src/data/statuses.ts';
import { ENEMIES, BOSSES } from '../src/data/enemies.ts';
import { ZONES } from '../src/data/formations.ts';
import { GEAR_BASES } from '../src/data/gear.ts';
import { AFFIXES, RARITY_AFFIX_COUNT, RARITY_VALUE_MULT } from '../src/data/affixes.ts';
import { CLASSES } from '../src/data/classes.ts';
import { DIFFICULTIES } from '../src/data/difficulty.ts';
import { CHARMS } from '../src/data/discovery.ts';
import { DUNGEONS, DUNGEON_OBJECTIVES } from '../src/data/dungeons.ts';
import { MAPS } from '../src/data/maps/index.ts';
import { UNLOCKS } from '../src/data/unlocks.ts';
import {
  WHEEL_ORDER, REACTIONS, SURGE_TABLE, TWIN_PAIRS, REACTION, SURGE, TWIN, MASTERY, ASPECT,
  STATIC_SHATTER_BONUS, STEAM_NEXT_MOVE_MULT, STORM_ARC_FRAC, NIGHT_WITHER_TAKEN,
  DEPTH_NO_SHIELD_TURNS, SURGE_PAIR_MP,
} from '../src/data/wheel.ts';
import { BATTLE_SPRITES } from '../src/render/grids.ts';
import { COMBAT, ZONE_BACKDROPS } from '../src/data/constants.ts';
import * as PROG from '../src/data/progression.ts';

const lower = (s: string): string => s.toLowerCase().replace(/[^a-z0-9_.]/g, '_');

const formArchetype = (id: string): string => (id === 'veil' ? 'veil' : id === 'call' ? 'summon' : 'projectile');

const reactionEffect = (id: string): Record<string, unknown> => {
  switch (id) {
    case 'scald': return { instantDot: { status: 'burning', mult: REACTION.scaldTickMult } };
    case 'shatter': return { hitBonus: REACTION.shatterBonus };
    case 'snare': return { applyStatus: { status: 'envenomed', turns: REACTION.snareVenomTurns } };
    case 'blight': return { instantDot: { status: 'envenomed', mult: 1, perRemainingTurn: true } };
    case 'kindle': return { hitBonus: REACTION.kindleBonus, applyStatus: { status: 'burning', turns: 3 } };
    default: return {};
  }
};

const surgeEffect = (id: string): Record<string, unknown> | undefined => {
  switch (id) {
    case 'bite': return { damage: SURGE.biteDamage };
    case 'warmth': return { healHp: SURGE.warmthHp };
    case 'gift': return { restoreMp: SURGE.giftMp };
    case 'sureStatus': return { forceElementStatus: true };
    case 'echoEcho': return { recastFrac: SURGE.echoPowerFrac };
    case 'grasp': return { randomEnemyStatus: { status: 'withered', turns: SURGE.graspWitherTurns } };
    case 'collect': return { selfHpFracFee: SURGE.collectFrac };
    case 'reversal': return { selfElementStatus: true };
    default: return undefined;
  }
};

const riderEffect = (rider: string): Record<string, unknown> | undefined => {
  switch (rider) {
    case 'steam': return { enemyNextMoveMult: STEAM_NEXT_MOVE_MULT };
    case 'storm': return { arcFrac: STORM_ARC_FRAC };
    case 'wildfire': return { spreadStatusOnKill: 'burning' };
    case 'hollowflame': return { ignoreShield: true };
    case 'static': return { reactionHitBonus: STATIC_SHATTER_BONUS };
    case 'mire': return { enemyActsLast: true };
    case 'depth': return { blockEnemyShieldTurns: DEPTH_NO_SHIELD_TURNS };
    case 'surge': return { mpOnHit: SURGE_PAIR_MP };
    case 'night': return { witherTakenMult: NIGHT_WITHER_TAKEN };
    case 'rot': return { extraDotTick: true };
    default: return undefined;
  }
};

// --- dialogue: merge every content/dialogue/*.json ---
const dialogueDir = join(import.meta.dirname, '..', 'content', 'dialogue');
const dialogue: { id: string; speaker: string; pages: string[] }[] = [];
for (const f of readdirSync(dialogueDir).filter((n) => n.endsWith('.json'))) {
  const obj = JSON.parse(readFileSync(join(dialogueDir, f), 'utf8')) as Record<string, { speaker: string; pages: string[] }>;
  for (const [id, d] of Object.entries(obj)) dialogue.push({ id, speaker: d.speaker, pages: d.pages });
}

const hasSprite = (id: string): boolean => id in BATTLE_SPRITES;

const world = {
  meta: { id: 'sundered_reaches', name: 'The Sundered Reaches (v2 game)', author: 'Sigilbound II', description: 'The full Sigilbound II game — five elements, the Wheel, 13 bosses across the Vale and the Reaches — as an editable, playtestable world.' },
  start: { map: 'hearth', level: 1, starters: ['ember', 'rime', 'thorn'], backfillLevels: [2, 6] },

  elements: Object.values(ELEMENTS).map((e) => ({ id: e.id, label: e.label, color: e.color, status: e.status, proc: e.proc })),
  enemyStatuses: Object.values(ENEMY_STATUSES),
  playerStatuses: Object.values(PLAYER_STATUSES),
  forms: Object.values(FORMS).map((f) => ({ id: f.id, label: f.label, pw: f.pw, mp: f.mp, targeting: f.targeting, archetype: formArchetype(f.id) })),
  runes: Object.values(RUNES),
  wheel: {
    order: [...WHEEL_ORDER],
    reactions: Object.values(REACTIONS).map((r) => ({ id: r.id, setup: r.setup, trigger: r.trigger, line: r.line, effect: reactionEffect(r.id) })),
    surges: SURGE_TABLE.map((s) => ({ roll: s.roll, severity: s.severity, id: lower(s.id), line: s.line, effect: surgeEffect(s.id) })),
    twinPairs: TWIN_PAIRS.map((t) => ({ a: t.a, b: t.b, prefix: t.prefix, rider: t.rider, effect: riderEffect(t.rider) })),
    tuning: {
      masteryCap: MASTERY.cap, masteryT1: MASTERY.thresholds[0], masteryT2: MASTERY.thresholds[1], masteryT3: MASTERY.thresholds[2],
      masteryT1Power: MASTERY.tier1PowerMult, masteryT2Proc: MASTERY.tier2ProcBonus, masteryT3Cost: MASTERY.tier3CostDelta,
      aspectPower: ASPECT.powerMult, aspectProc: ASPECT.procBonus, aspectDot: ASPECT.dotMult,
      twinMpMult: TWIN.mpMult, twinMatchupCap: TWIN.matchupCap, twinProcFrac: TWIN.procFrac, surgeChance: 0.15, steamMult: STEAM_NEXT_MOVE_MULT,
    },
  },

  enemies: Object.values(ENEMIES).map((e) => ({ ...e, ...(hasSprite(e.id) ? { sprite: e.id } : {}) })),
  bosses: Object.values(BOSSES).map((b) => ({ ...b, sigilToast: b.sigilToast ?? '', ...(hasSprite(b.id) ? { sprite: b.id } : {}) })),
  zones: Object.values(ZONES).map((z) => {
    const bd = ZONE_BACKDROPS[z.zone] ?? ZONE_BACKDROPS['default'];
    return {
      id: z.zone, levelMin: z.levelMin, levelMax: z.levelMax, formations: z.formations,
      ...(z.eliteChance !== undefined ? { eliteChance: z.eliteChance } : {}),
      ...(bd ? { backdrop: { sky: [bd.sky[0], bd.sky[1]], hill: bd.hill, ground: bd.ground } } : {}),
    };
  }),

  rarities: (['common', 'fine', 'rare', 'relic'] as const).map((r) => ({ id: r, label: r[0]!.toUpperCase() + r.slice(1), affixCount: RARITY_AFFIX_COUNT[r], valueMult: RARITY_VALUE_MULT[r] })),
  equipSlots: [{ id: 'vestment', label: 'Vestment' }, { id: 'implement', label: 'Implement' }, { id: 'talisman', label: 'Talisman' }, { id: 'boots', label: 'Boots' }],
  gearBases: Object.values(GEAR_BASES),
  gearAffixes: AFFIXES.map((a) => ({ id: a.id, label: a.label, place: a.place, minRarity: a.minRarity, mods: a.mods })),
  classes: Object.values(CLASSES),
  difficulties: Object.entries(DIFFICULTIES).map(([id, d]) => ({ id, label: id[0]!.toUpperCase() + id.slice(1), hpMult: d.hpMult, atkMult: d.atkMult, econMult: d.econMult })),
  charms: Object.values(CHARMS),

  maps: Object.values(MAPS),
  dungeons: Object.values(DUNGEONS).map((d) => ({
    id: d.id, name: d.name, suggestedLv: d.suggestedLv, gold: d.gold,
    reward: { kind: d.reward.kind, ...('amount' in d.reward ? { amount: d.reward.amount } : {}), ...('rune' in d.reward ? { ref: d.reward.rune } : 'charm' in d.reward ? { ref: d.reward.charm } : {}) },
    ...(d.gearReward ? { gearReward: d.gearReward } : {}),
  })),
  dungeonObjectives: Object.values(DUNGEON_OBJECTIVES).map((o) => ({ id: o.id, members: o.members, lv: o.lv })),
  dialogue,
  music: [],

  unlocks: UNLOCKS,
  gates: [
    { id: 'sanctum_gate', to: 'sanctum', when: { type: 'bossDefeated', boss: 'valewraith' }, barred: 'sanctum_stair_sealed' },
    { id: 'stormreach_gate', to: 'stormreach', when: { type: 'all', of: [{ type: 'bossDefeated', boss: 'pyrewarden' }, { type: 'bossDefeated', boss: 'hoarwarden' }] }, barred: 'stormreach_sealed' },
    { id: 'themire_gate', to: 'themire', when: { type: 'bossDefeated', boss: 'tempest' }, barred: 'themire_sealed' },
  ],
  sigilBosses: ['bogmaw', 'thornveil', 'ashenwarden'],

  sprites: Object.entries(BATTLE_SPRITES).map(([id, sp]) => ({ id, grid: [...sp.grid], pal: { ...sp.pal } })),

  tuning: {
    combat: { weakMult: COMBAT.weakMult, resistMult: COMBAT.resistMult, basePower: COMBAT.basePower, levelScaling: COMBAT.levelScaling, costBase: COMBAT.costBase, critChance: COMBAT.critChance, critMult: COMBAT.critMult },
    progression: { BASE_HP: PROG.BASE_HP, HP_PER_LEVEL: PROG.HP_PER_LEVEL, BASE_MP: PROG.BASE_MP, MP_PER_LEVEL: PROG.MP_PER_LEVEL, ENCOUNTER_RATE: PROG.ENCOUNTER_RATE },
  },
};

const out = join(import.meta.dirname, '..', '..', 'Worldsmith', 'src', 'model', 'sigilbound2World.ts');
writeFileSync(out, `// AUTO-GENERATED by Sigilbound2/scripts/to-worldsmith.ts — do not edit by hand.\nexport const SUNDERED_RAW: unknown = ${JSON.stringify(world)};\n`);
console.log(`wrote ${out} (${String(world.maps.length)} maps, ${String(world.bosses.length)} bosses, ${String(world.sprites.length)} sprites)`);
