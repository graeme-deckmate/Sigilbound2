/**
 * Input action abstraction (docs/01-ARCHITECTURE): sources (keyboard,
 * touch d-pad, later gamepad) feed this state machine; scenes consume
 * actions and the currently held direction. Engine-agnostic.
 */
import type { Dir } from './state.ts';

export type GameAction = 'interact' | 'cancel' | 'menu';

/** Polling order matches the prototype: up, down, left, right. */
const DIR_PRIORITY: readonly Dir[] = ['up', 'down', 'left', 'right'];

export class InputState {
  private readonly held = new Set<Dir>();
  private readonly handlers = new Set<(a: GameAction) => void>();

  pressDir(d: Dir): void {
    this.held.add(d);
  }

  releaseDir(d: Dir): void {
    this.held.delete(d);
  }

  /** Drop all held directions, e.g. when a scene loses focus. */
  clearDirs(): void {
    this.held.clear();
  }

  /** The direction movement should use this frame, or null. */
  currentDir(): Dir | null {
    for (const d of DIR_PRIORITY) if (this.held.has(d)) return d;
    return null;
  }

  onAction(fn: (a: GameAction) => void): () => void {
    this.handlers.add(fn);
    return () => {
      this.handlers.delete(fn);
    };
  }

  dispatch(action: GameAction): void {
    for (const fn of [...this.handlers]) fn(action);
  }
}

/** Keyboard bindings: WASD + arrows move, E/Enter/Space interact, Esc cancels. */
export const KEY_TO_DIR: Readonly<Record<string, Dir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

export const KEY_TO_ACTION: Readonly<Record<string, GameAction>> = {
  e: 'interact',
  E: 'interact',
  Enter: 'interact',
  ' ': 'interact',
  Escape: 'cancel',
};
