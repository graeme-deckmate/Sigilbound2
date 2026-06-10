/**
 * World interaction and transition logic (pure). Scenes ask "what does
 * facing this tile mean" and apply the returned state changes.
 */
import type { CompiledMap, EntityAt, ExitDef } from '../core/mapdefs.ts';
import type { BossId, Dir, GameState, ShrineId } from '../core/state.ts';

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
  | { kind: 'teleport' };

/** What interacting with the faced tile means, if anything. */
export function interactionFor(map: CompiledMap, entity: EntityAt | null): Interaction | null {
  if (!entity) return null;
  switch (entity.kind) {
    case 'npc': {
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
      return { kind: 'teleport' };
  }
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

/** Apply a map exit: land on the target map at the target tile. */
export function applyExit(state: GameState, exit: ExitDef): GameState {
  return {
    ...state,
    world: { ...state.world, mapId: exit.to, x: exit.tx, y: exit.ty },
  };
}
