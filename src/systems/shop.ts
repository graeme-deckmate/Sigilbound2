/**
 * Shop and inventory logic (v2 V1), pure and testable. Gold is the town
 * currency (distinct from essence, the spellcraft currency): nothing here
 * touches essence. The shop UI in W3 drives these transitions.
 */
import type { GameState } from '../core/state.ts';
import type { GearItem } from '../core/items.ts';
import { itemValue } from './gear.ts';

export interface BuyResult {
  state: GameState;
  ok: boolean;
  reason?: 'gold' | 'full';
}

/** Buy a gear item for gold, into the inventory. */
export function buyGear(state: GameState, item: GearItem, price: number): BuyResult {
  if (state.player.gold < price) return { state, ok: false, reason: 'gold' };
  if (state.player.inventory.gear.length >= state.player.inventory.capacity) {
    return { state, ok: false, reason: 'full' };
  }
  return {
    state: {
      ...state,
      player: {
        ...state.player,
        gold: state.player.gold - price,
        inventory: {
          ...state.player.inventory,
          gear: [...state.player.inventory.gear, item],
        },
      },
    },
    ok: true,
  };
}

/** Sell a gear item by uid; credits its value, unequipping it if worn. */
export function sellGear(state: GameState, uid: string): { state: GameState; gold: number } {
  const item = state.player.inventory.gear.find((g) => g.uid === uid);
  if (!item) return { state, gold: 0 };
  const value = itemValue(item);
  const equipment = { ...state.player.equipment };
  if (equipment[item.slot] === uid) equipment[item.slot] = null;
  return {
    state: {
      ...state,
      player: {
        ...state.player,
        gold: state.player.gold + value,
        equipment,
        inventory: {
          ...state.player.inventory,
          gear: state.player.inventory.gear.filter((g) => g.uid !== uid),
        },
      },
    },
    gold: value,
  };
}

/** Equip an owned item into its slot (replaces whatever is there). */
export function equipGear(state: GameState, uid: string): GameState {
  const item = state.player.inventory.gear.find((g) => g.uid === uid);
  if (!item) return state;
  return {
    ...state,
    player: {
      ...state.player,
      equipment: { ...state.player.equipment, [item.slot]: uid },
    },
  };
}

/** Clear a slot. */
export function unequipSlot(state: GameState, slot: GearItem['slot']): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      equipment: { ...state.player.equipment, [slot]: null },
    },
  };
}

/** Grant gear directly (drops, debug, dungeon rewards in V5). */
export function grantGear(state: GameState, item: GearItem): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      inventory: {
        ...state.player.inventory,
        gear: [...state.player.inventory.gear, item],
      },
    },
  };
}
