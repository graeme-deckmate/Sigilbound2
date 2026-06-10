/**
 * World interaction and transition logic (pure). Scenes ask "what does
 * facing this tile mean" and apply the returned state changes.
 */
import type { CompiledMap, EntityAt, ExitDef } from '../core/mapdefs.ts';
import type { BossId, Dir, ElementId, GameState, ShrineId } from '../core/state.ts';
import type { Rng } from '../core/rng.ts';
import type { Spell } from '../core/state.ts';
import { ELEMENT_IDS } from '../data/elements.ts';
import { spellTargeting } from './spellcraft.ts';
import { GATES, gateFlag, type GateDef } from '../data/discovery.ts';

export function facingPos(x: number, y: number, facing: Dir): { x: number; y: number } {
  switch (facing) {
    case 'up':
      return { x, y: y - 1 };
    case 'down':
      return { x, y: y + 1 };
    case 'left':
      return { x: x - 1, y };
    case 'right':
      return { x: x + 1, y };
  }
}

export type Interaction =
  | { kind: 'dialogue'; id: string; npcId?: string }
  | { kind: 'spring' }
  | { kind: 'shrine'; rune: ShrineId }
  | { kind: 'boss'; id: BossId }
  | { kind: 'gate'; id: string }
  | { kind: 'teleport'; bossId: string }
  | { kind: 'egate'; id: string }
  | { kind: 'murk' };

/** What interacting with the faced tile means, if anything. */
export function interactionFor(map: CompiledMap, entity: EntityAt | null): Interaction | null {
  if (!entity) return null;
  switch (entity.kind) {
    case 'npc': {
      if (entity.ref === 'murk') return { kind: 'murk' };
      const npc = map.npcs.find((n) => n.id === entity.ref);
      return npc ? { kind: 'dialogue', id: npc.dialogue, npcId: npc.id } : null;
    }
    case 'sign':
    case 'lore':
      return { kind: 'dialogue', id: entity.ref };
    case 'spring':
      return { kind: 'spring' };
    case 'shrine':
      return { kind: 'shrine', rune: entity.ref as ShrineId };
    case 'boss':
      return { kind: 'boss', id: entity.ref as BossId };
    case 'gate':
      return { kind: 'gate', id: entity.ref };
    case 'teleporter':
      return { kind: 'teleport', bossId: entity.ref };
    case 'egate':
      return { kind: 'egate', id: entity.ref };
  }
}

/**
 * Rotate the Vale Aspect at a shrine or spring rest (03 section 25):
 * a seeded pick that never repeats the current element.
 */
export function rotateAspect(state: GameState, rng: Rng): GameState {
  const pool = ELEMENT_IDS.filter((e) => e !== state.world.aspect);
  const next = pool[Math.floor(rng() * pool.length)] as ElementId;
  return { ...state, world: { ...state.world, aspect: next } };
}

/** Springs fully restore HP and MP (docs/02 Encounters). */
export function applySpringRestore(state: GameState): GameState {
  return {
    ...state,
    player: { ...state.player, hp: state.player.maxhp, mp: state.player.maxmp },
  };
}

/**
 * Rune shrine use (docs/03 section 5): grants the rune once, fully
 * restores (shrines heal, docs/02), and becomes the respawn point.
 * granted is false on revisits.
 */
export function applyShrineGrant(
  state: GameState,
  rune: ShrineId,
): { state: GameState; granted: boolean } {
  const granted = !state.world.shrines[rune];
  return {
    state: {
      ...state,
      player: { ...state.player, hp: state.player.maxhp, mp: state.player.maxmp },
      world: {
        ...state.world,
        shrines: { ...state.world.shrines, [rune]: true },
        respawn: { mapId: state.world.mapId, x: state.world.x, y: state.world.y },
      },
    },
    granted,
  };
}

/** Wardens freed so far (Grand Sigils held). */
export function sigilCount(state: GameState): number {
  const wardens: BossId[] = ['bogmaw', 'thornveil', 'ashenwarden'];
  return wardens.filter((b) => state.world.bosses[b]).length;
}

/**
 * Story-aware NPC dialogue (docs/02 beats): the elder reacts to the
 * sigils and the Wraith; everyone else keeps their map-given line.
 */
export function npcDialogueId(npcId: string, fallback: string, state: GameState): string {
  // After Act 1 the second twin teaches the Wheel (03 section 26, final).
  if (npcId === 'twin_b' && state.world.bosses.bogmaw) return 'twins_gossip_wheel';
  if (npcId !== 'elder') return fallback;
  if (state.world.bosses.valewraith) return 'elder_postgame';
  const sigils = sigilCount(state);
  if (sigils >= 3) return 'elder_gate';
  if (sigils >= 1) return 'elder_progress';
  return fallback;
}

/**
 * Buy the next Grimoire slot at a shrine (03 section 16): slot 5 costs
 * 40 essence, slot 6 costs 80. Returns null when maxed or unaffordable.
 */
export function applySlotPurchase(
  state: GameState,
  prices: { slot5: number; slot6: number },
): { state: GameState; slot: 5 | 6; price: number } | null {
  const unlocked = state.player.slotsUnlocked;
  if (unlocked >= 6) return null;
  const slot = unlocked === 4 ? 5 : 6;
  const price = slot === 5 ? prices.slot5 : prices.slot6;
  if (state.player.essence < price) return null;
  return {
    state: {
      ...state,
      player: {
        ...state.player,
        essence: state.player.essence - price,
        slotsUnlocked: slot,
      },
    },
    slot,
    price,
  };
}

/** Inscribed spells that can open this gate (any matching element,
 *  damaging forms only; 'any' gates take any damaging element). */
export function gateOpeners(state: GameState, gate: GateDef): { slot: number; spell: Spell }[] {
  const out: { slot: number; spell: Spell }[] = [];
  state.player.spells.forEach((spell, slot) => {
    if (!spell) return;
    if (spellTargeting(spell) === 'self') return; // veils clear nothing
    if (gate.element !== 'any' && spell.element !== gate.element) return;
    out.push({ slot, spell });
  });
  return out;
}

export function gateById(id: string): GateDef | null {
  return GATES.find((g) => g.id === id) ?? null;
}

/** Open a gate: pay the spell's MP, set the flag. Caller grants the cache. */
export function applyGateOpen(state: GameState, gate: GateDef, cost: number): GameState | null {
  if (state.world.flags[gateFlag(gate.id)]) return null;
  if (state.player.mp < cost) return null;
  return {
    ...state,
    player: { ...state.player, mp: state.player.mp - cost },
    world: { ...state.world, flags: { ...state.world.flags, [gateFlag(gate.id)]: true } },
  };
}

/** Commission predicates (03 section 21) against INSCRIBED spells. */
export function commissionSatisfied(state: GameState, id: string): boolean {
  const spells = state.player.spells.filter((s): s is Spell => s !== null);
  switch (id) {
    case 'fisher':
      return spells.some((s) => s.element === 'ember' && s.form === 'veil');
    case 'scout':
      return spells.some((s) => s.element === 'volt' && s.form === 'lance' && s.p >= 1.2);
    case 'dreamer':
      return spells.some((s) => s.element === 'gloom' && s.form === 'nova');
    case 'keeper':
      // any twin-element spell (Phase 14 adds e2; absent until then)
      return spells.some((s) => 'e2' in s && (s as { e2?: string }).e2 !== undefined);
    default:
      return false;
  }
}

/** Apply a map exit: land on the target map at the target tile. */
export function applyExit(state: GameState, exit: ExitDef): GameState {
  return {
    ...state,
    world: { ...state.world, mapId: exit.to, x: exit.tx, y: exit.ty },
  };
}
