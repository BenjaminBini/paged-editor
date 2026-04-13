// event-bus.js — Lightweight publish/subscribe for cross-module communication.
// Replaces the inconsistent register*/on*/set* callback patterns.

const listeners: Map<string, ((...args: any[]) => void)[]> = new Map();

export function on(event: string, fn: (...args: any[]) => void): void {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event)!.push(fn);
}

export function off(event: string, fn: (...args: any[]) => void): void {
  const fns = listeners.get(event);
  if (!fns) return;
  const idx = fns.indexOf(fn);
  if (idx >= 0) fns.splice(idx, 1);
}

export function emit(event: string, ...args: any[]): void {
  const fns = listeners.get(event);
  if (!fns) return;
  for (const fn of fns) fn(...args);
}
