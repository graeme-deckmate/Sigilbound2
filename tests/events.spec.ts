import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events.ts';

interface TestEvents extends Record<string, unknown> {
  ping: { n: number };
  note: string;
}

describe('EventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = new EventBus<TestEvents>();
    const got: number[] = [];
    bus.on('ping', (p) => got.push(p.n));
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(got).toEqual([1, 2]);
  });

  it('only notifies listeners of the emitted event', () => {
    const bus = new EventBus<TestEvents>();
    const notes: string[] = [];
    let pings = 0;
    bus.on('note', (s) => notes.push(s));
    bus.on('ping', () => pings++);
    bus.emit('note', 'hello');
    expect(notes).toEqual(['hello']);
    expect(pings).toBe(0);
  });

  it('supports multiple listeners per event', () => {
    const bus = new EventBus<TestEvents>();
    let a = 0;
    let b = 0;
    bus.on('ping', () => a++);
    bus.on('ping', () => b++);
    bus.emit('ping', { n: 0 });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('on() returns an unsubscribe function', () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    const off = bus.on('ping', () => count++);
    bus.emit('ping', { n: 0 });
    off();
    bus.emit('ping', { n: 0 });
    expect(count).toBe(1);
  });

  it('off() removes a specific listener', () => {
    const bus = new EventBus<TestEvents>();
    let a = 0;
    let b = 0;
    const fnA = (): void => {
      a++;
    };
    bus.on('ping', fnA);
    bus.on('ping', () => b++);
    bus.off('ping', fnA);
    bus.emit('ping', { n: 0 });
    expect(a).toBe(0);
    expect(b).toBe(1);
  });

  it('once() fires a single time', () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    bus.once('ping', () => count++);
    bus.emit('ping', { n: 0 });
    bus.emit('ping', { n: 0 });
    expect(count).toBe(1);
  });

  it('a listener may unsubscribe itself during emit without breaking others', () => {
    const bus = new EventBus<TestEvents>();
    const order: string[] = [];
    const offA = bus.on('ping', () => {
      order.push('a');
      offA();
    });
    bus.on('ping', () => order.push('b'));
    bus.emit('ping', { n: 0 });
    bus.emit('ping', { n: 0 });
    expect(order).toEqual(['a', 'b', 'b']);
  });

  it('clear() drops everything', () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    bus.on('ping', () => count++);
    bus.on('note', () => count++);
    bus.clear();
    bus.emit('ping', { n: 0 });
    bus.emit('note', 'x');
    expect(count).toBe(0);
  });

  it('emitting with no listeners is a no-op', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('ping', { n: 0 })).not.toThrow();
  });
});
