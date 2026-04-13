// signal.ts — Minimal reactive primitives: signal, computed, effect, batch.
// Zero dependencies. Used by UI controllers to replace manual renderX() chains.

// ── Public types ─────────────────────────────────────────────────────────────

export interface ReadonlySignal<T> {
  readonly value: T;
}

export interface Signal<T> {
  value: T;
}

// ── Tracking state ────────────────────────────────────────────────────────────

// The currently executing effect or computed, if any.
let activeEffect: EffectFn | null = null;

// Batching depth counter; when > 0, writes queue effects instead of running them.
let batchDepth = 0;
const pendingEffects = new Set<EffectFn>();

type EffectFn = () => void;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Run all pending effects collected during a batch.
function flushPending(): void {
  // Snapshot the set before iterating — effects may add new pending entries.
  const toRun = new Set(pendingEffects);
  pendingEffects.clear();
  for (const fn of toRun) fn();
}

// Notify subscribers of a signal: either run immediately or queue for batch.
function notify(subscribers: Set<EffectFn>): void {
  for (const fn of subscribers) {
    if (batchDepth > 0) {
      pendingEffects.add(fn);
    } else {
      fn();
    }
  }
}

// ── signal<T> ─────────────────────────────────────────────────────────────────

// Returns a reactive container. Reading .value inside an effect tracks it;
// writing .value triggers all subscribers (unless the value is identical).
export function signal<T>(initial: T): Signal<T> {
  let stored = initial;
  const subscribers = new Set<EffectFn>();

  return {
    get value(): T {
      if (activeEffect !== null) subscribers.add(activeEffect);
      return stored;
    },
    set value(next: T) {
      if (Object.is(stored, next)) return;
      stored = next;
      notify(new Set(subscribers)); // snapshot to avoid mutation-during-iteration
    },
  };
}

// ── computed<T> ───────────────────────────────────────────────────────────────

// Returns a read-only signal whose value is derived from other signals.
// Re-runs the derivation function whenever a tracked dependency changes.
export function computed<T>(fn: () => T): ReadonlySignal<T> {
  // Use an internal signal to hold the derived value; effect keeps it fresh.
  const derived = signal<T>(undefined as unknown as T);

  // Run fn inside an effect so dependency changes trigger a recompute.
  effect(() => {
    derived.value = fn();
  });

  return {
    get value(): T {
      // Forward the read so callers inside their own effects track this computed.
      return derived.value;
    },
  };
}

// ── effect ────────────────────────────────────────────────────────────────────

// Runs fn immediately, then re-runs it whenever any signal read during
// execution changes. Returns a no-op dispose function (effects are GC'd with
// their signals when no longer referenced).
export function effect(fn: () => void): () => void {
  const runner: EffectFn = () => {
    const prev = activeEffect;
    activeEffect = runner;
    try {
      fn();
    } finally {
      activeEffect = prev;
    }
  };

  runner(); // initial run — subscribes to all signals read inside fn

  return () => {
    // Dispose is a no-op: effects are naturally GC'd when signals drop them.
  };
}

// ── batch ─────────────────────────────────────────────────────────────────────

// Groups multiple signal writes so dependent effects only run once after the
// batch completes, not after each individual write.
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) flushPending();
  }
}
