// event-bus.js — Lightweight publish/subscribe for cross-module communication.
// Replaces the inconsistent register*/on*/set* callback patterns.

export interface EventMap {
  "content-loaded": [];
  "section-ready": [];
  "file-saved": [payload: { file: string; name: string }];
  "agents-changed": [agents: Array<{ key: string; name: string }>];
  "conversation-updated": [agentKey: string];
  "agent-click": [agentKey: string];
}

type Listener<K extends keyof EventMap> = (...args: EventMap[K]) => void;

const listeners: Map<string, Listener<keyof EventMap>[]> = new Map();

export function on<K extends keyof EventMap>(event: K, fn: Listener<K>): void {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event)!.push(fn as Listener<keyof EventMap>);
}

export function off<K extends keyof EventMap>(event: K, fn: Listener<K>): void {
  const fns = listeners.get(event);
  if (!fns) return;
  const idx = fns.indexOf(fn as Listener<keyof EventMap>);
  if (idx >= 0) fns.splice(idx, 1);
}

export function emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): void {
  const fns = listeners.get(event);
  if (!fns) return;
  for (const fn of fns) (fn as (...a: EventMap[K]) => void)(...args);
}
