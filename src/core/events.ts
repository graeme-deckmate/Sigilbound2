/**
 * Minimal typed event bus. Event maps are declared as interfaces of
 * event name -> payload type, so emit/on are fully type checked.
 */

export type Listener<P> = (payload: P) => void;

/** Widest listener type used for internal storage; safe because every
 *  Listener<P> is assignable to it and emit() narrows back per key. */
type StoredListener = (payload: never) => void;

export class EventBus<E extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof E, Set<StoredListener>>();

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof E>(type: K, fn: Listener<E[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn);
    return () => {
      this.off(type, fn);
    };
  }

  /** Subscribe for a single emission. Returns an unsubscribe function. */
  once<K extends keyof E>(type: K, fn: Listener<E[K]>): () => void {
    const wrapped: Listener<E[K]> = (payload) => {
      this.off(type, wrapped);
      fn(payload);
    };
    return this.on(type, wrapped);
  }

  off<K extends keyof E>(type: K, fn: Listener<E[K]>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) this.listeners.delete(type);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    // Copy so listeners may unsubscribe (or subscribe) during emission.
    for (const fn of [...set]) {
      (fn as Listener<E[K]>)(payload);
    }
  }

  /** Drop every listener. */
  clear(): void {
    this.listeners.clear();
  }
}
