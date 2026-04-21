# Typed Event Bus & Reactive Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the untyped event bus with a fully generic typed version, and add a minimal reactive signal primitive to eliminate manual `render*()` call chains.

**Architecture:** Two new infrastructure modules (`event-bus.ts` rewrite, `signal.ts` new) that the rest of the codebase imports. The typed event bus uses TypeScript generics to enforce event name + payload matching at compile time. The signal module provides `signal()`, `computed()`, and `effect()` primitives (~60 LOC) that auto-trigger DOM updates when state changes. Migration proceeds module-by-module — each task produces a working build.

**Tech Stack:** TypeScript 5.7 (strict), no new dependencies, ES2022 modules

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Rewrite | `src/infrastructure/event-bus.ts` | Typed pub/sub with generic `EventMap` |
| Create | `src/infrastructure/signal.ts` | Reactive primitives: `signal`, `computed`, `effect`, `batch` |
| Modify | `src/collaboration/chat-sidebar-controller.ts` | Replace closure state with signals |
| Modify | `src/workspace/tabs/tab-bar-controller.ts` | Replace closure state with signals |
| Modify | `src/collaboration/agent-connection-manager.ts` | Migrate callback events → typed bus |
| Modify | `src/shell/app-orchestrator.ts` | Update event subscriptions to typed API |
| Modify | `src/editor/formatting-toolbar.ts` | Update `busOn` → typed `on` |
| Modify | `src/shell/tab-integration.ts` | Update wiring for new event patterns |
| Modify | `src/workspace/files/file-operations.ts` | Update `emit` call |

---

### Task 1: Rewrite the typed event bus

**Files:**
- Rewrite: `src/infrastructure/event-bus.ts`

The current event bus uses `string` keys and `any` payloads. We replace it with a generic `EventMap` interface that maps event names to their argument tuples. The `on`, `off`, and `emit` functions become generic, so TypeScript enforces correct event names and payload types at every call site.

- [ ] **Step 1: Rewrite `event-bus.ts` with typed generics**

```typescript
// event-bus.ts — Typed publish/subscribe for cross-module communication.

// ── Event map ────────────────────────────────────────────────────────────────
// Every event the app can emit is declared here with its payload tuple.
// Adding a new event = one line here; the compiler enforces all call sites.

export interface EventMap {
  "content-loaded": [];
  "section-ready": [];
  "file-saved": [payload: { file: string; name: string }];
}

// ── Implementation ───────────────────────────────────────────────────────────

type Listener<Args extends unknown[]> = (...args: Args) => void;

const listeners = new Map<string, Listener<any[]>[]>();

export function on<K extends keyof EventMap>(
  event: K,
  fn: Listener<EventMap[K]>,
): void {
  if (!listeners.has(event as string)) listeners.set(event as string, []);
  listeners.get(event as string)!.push(fn as Listener<any[]>);
}

export function off<K extends keyof EventMap>(
  event: K,
  fn: Listener<EventMap[K]>,
): void {
  const fns = listeners.get(event as string);
  if (!fns) return;
  const idx = fns.indexOf(fn as Listener<any[]>);
  if (idx >= 0) fns.splice(idx, 1);
}

export function emit<K extends keyof EventMap>(
  event: K,
  ...args: EventMap[K]
): void {
  const fns = listeners.get(event as string);
  if (!fns) return;
  for (const fn of fns) fn(...args);
}
```

- [ ] **Step 2: Build and verify no type errors**

Run: `cd packages/base && npm run build`

Expected: The existing call sites already match these signatures:
- `emit("content-loaded")` — matches `[]` payload ✓
- `emit("section-ready")` — matches `[]` payload ✓
- `emit("file-saved", { file: tab.path, name: tab.name })` — matches `[{ file: string; name: string }]` ✓
- `busOn("content-loaded", ...)` — callback with no args ✓
- `busOn("file-saved", ({ file, name }) => ...)` — destructured payload ✓

- [ ] **Step 3: Update import aliases across the codebase**

Several files import the bus as `busOn`. Update to use the typed import directly:

In `src/shell/app-orchestrator.ts`, the import is already:
```typescript
import { on as busOn } from "../infrastructure/event-bus.js";
```
This works as-is because the alias preserves the type. No changes needed to import style — only the types are now enforced.

In `src/editor/formatting-toolbar.ts`:
```typescript
import { on as busOn } from "../infrastructure/event-bus.js";
```
Same — already works.

- [ ] **Step 4: Build again to confirm all call sites type-check**

Run: `cd packages/base && npm run build`
Expected: Clean build, zero errors.

- [ ] **Step 5: Commit**

```
git add packages/base/src/infrastructure/event-bus.ts
git commit -m "refactor(event-bus): add generic EventMap for compile-time event safety"
```

---

### Task 2: Create the signal primitives module

**Files:**
- Create: `src/infrastructure/signal.ts`

A minimal reactive primitives library (~60 LOC, zero dependencies). Provides:
- `signal<T>(initial)` — a reactive value container
- `computed<T>(fn)` — a derived value that auto-tracks dependencies
- `effect(fn)` — a side-effect that re-runs when its tracked signals change
- `batch(fn)` — groups multiple signal writes into one update flush

The implementation uses a tracking stack: when an `effect` or `computed` runs, it records which signals were read. When those signals are written, the dependent effects/computeds re-run.

- [ ] **Step 1: Create `src/infrastructure/signal.ts`**

```typescript
// signal.ts — Minimal reactive primitives for UI state management.
// Replaces manual render*() call chains with automatic dependency tracking.
//
// Usage:
//   const count = signal(0);
//   effect(() => console.log(count.value));  // logs 0
//   count.value = 1;                         // logs 1
//   batch(() => { a.value = 1; b.value = 2; }); // one flush

// ── Dependency tracking ──────────────────────────────────────────────────────

type Effect = () => void;

let activeEffect: Effect | null = null;
let batchDepth = 0;
const pendingEffects = new Set<Effect>();

// ── signal ───────────────────────────────────────────────────────────────────

export interface ReadonlySignal<T> {
  readonly value: T;
}

export interface Signal<T> {
  value: T;
}

export function signal<T>(initial: T): Signal<T> {
  let _value = initial;
  const subscribers = new Set<Effect>();

  return {
    get value(): T {
      if (activeEffect) subscribers.add(activeEffect);
      return _value;
    },
    set value(next: T) {
      if (Object.is(_value, next)) return;
      _value = next;
      for (const sub of subscribers) {
        if (batchDepth > 0) {
          pendingEffects.add(sub);
        } else {
          sub();
        }
      }
    },
  };
}

// ── computed ─────────────────────────────────────────────────────────────────

export function computed<T>(fn: () => T): ReadonlySignal<T> {
  const s = signal<T>(undefined as T);
  effect(() => { s.value = fn(); });
  return s;
}

// ── effect ───────────────────────────────────────────────────────────────────

export function effect(fn: () => void): () => void {
  const execute: Effect = () => {
    const prev = activeEffect;
    activeEffect = execute;
    try {
      fn();
    } finally {
      activeEffect = prev;
    }
  };
  execute();  // run immediately to capture dependencies
  return () => { /* disposal: effects are GC'd when signals are GC'd */ };
}

// ── batch ────────────────────────────────────────────────────────────────────

export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = [...pendingEffects];
      pendingEffects.clear();
      for (const eff of effects) eff();
    }
  }
}
```

- [ ] **Step 2: Build to confirm the module compiles**

Run: `cd packages/base && npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```
git add packages/base/src/infrastructure/signal.ts
git commit -m "feat(signal): add minimal reactive primitives (signal, computed, effect, batch)"
```

---

### Task 3: Migrate chat-sidebar-controller to signals

**Files:**
- Modify: `src/collaboration/chat-sidebar-controller.ts`

This is the cleanest migration target. Three state variables (`agents`, `activeAgentKey`, `pendingContext`) each trigger 1-3 manual `render*()` calls when changed. We replace them with signals and wire effects to auto-render.

- [ ] **Step 1: Add signal imports and replace state declarations**

At the top of the file, add import:
```typescript
import { signal, effect, batch } from '../infrastructure/signal.js';
```

Replace the state section (lines 20-22):
```typescript
// OLD:
// let activeAgentKey: string | null = null;
// let agents: Agent[] = [];
// let pendingContext: Context | null = null;

// NEW:
const activeAgentKey = signal<string | null>(null);
const agents = signal<Agent[]>([]);
const pendingContext = signal<Context | null>(null);
```

- [ ] **Step 2: Wire effects to replace manual render calls**

Add after the state declarations, before the exported functions:
```typescript
// ── Reactive effects ───────────────────────────────────────────────────────
// These replace manual renderTabs()/renderMessages()/etc. calls scattered
// throughout the module. When any tracked signal changes, the effect re-runs.

effect(() => { renderTabs(agents.value, activeAgentKey.value); });
effect(() => { renderMessages(activeAgentKey.value); });
effect(() => { updateInputState(activeAgentKey.value, agents.value); });
effect(() => { renderContextPill(pendingContext.value); });
```

- [ ] **Step 3: Update functions to write signals instead of calling render**

`setAgents`:
```typescript
export function setAgents(agentList: Agent[]): void {
  batch(() => {
    agents.value = agentList;
    if (agentList.length > 0 && !activeAgentKey.value) {
      activeAgentKey.value = agentList[0].key;
    }
    if (activeAgentKey.value && !agentList.find(a => a.key === activeAgentKey.value)) {
      activeAgentKey.value = agentList.length > 0 ? agentList[0].key : null;
    }
  });
}
```

`getActiveAgentKey`:
```typescript
export function getActiveAgentKey(): string | null { return activeAgentKey.value; }
```

`focusWithContext`:
```typescript
export function focusWithContext(context: Context): void {
  if (!input) return;
  pendingContext.value = context;
  input.focus();
}
```

`focusForAgent`:
```typescript
export function focusForAgent(agentKey: string): void {
  if (agents.value.find(a => a.key === agentKey)) {
    activeAgentKey.value = agentKey;
  }
  if (input) input.focus();
}
```

`refresh`:
```typescript
export function refresh(): void {
  // Force re-render by toggling the signal (touch it so effects re-fire).
  // Since renderMessages reads from _getConversation which may have changed
  // externally, we need a way to trigger it.
  activeAgentKey.value = activeAgentKey.value;
}
```

Note: `refresh()` is a special case — the conversation data lives outside this module (in agent-connection-manager). The signal won't auto-detect that change. We handle this by making `refresh()` do a no-op write that triggers the effect. An alternative is to accept a conversation signal from outside, but that's a larger refactor.

Update the tab click handler inside `renderTabs` to write the signal:
```typescript
el.onclick = () => {
  activeAgentKey.value = agent.key;
};
```

Update `doSend` to write the signal:
```typescript
function doSend(): void {
  if (!input || !activeAgentKey.value || !_onSend) return;
  const prompt = input.value.trim();
  if (!prompt) return;
  const context = pendingContext.value || getAutoContext();
  pendingContext.value = null;
  _onSend(activeAgentKey.value, prompt, context);
  input.value = "";
}
```

Update `getAutoContext` to read from signal:
```typescript
function getAutoContext(): Context | null {
  if (!cm) return null;
  const sel = cm.getSelection();
  if (sel) {
    const from = cm.getCursor("from");
    const to = cm.getCursor("to");
    return { text: sel, lineStart: from.line, lineEnd: to.line, label: null as string | null };
  }
  if (_getSection) return _getSection();
  return null;
}
```

- [ ] **Step 4: Update render functions to accept parameters instead of reading closures**

The render functions currently read module-scoped variables. With signals, the effects pass the values as arguments. Update the render function signatures:

`renderTabs`:
```typescript
function renderTabs(agentList: Agent[], activeKey: string | null): void {
  if (!agentTabs) return;
  agentTabs.innerHTML = "";

  if (agentList.length <= 1 && agentList.length > 0) {
    const el = document.createElement("div");
    el.className = "chat-agent-tab active";
    el.innerHTML = '<span class="chat-agent-dot"></span>' + escapeHtml(agentList[0].name);
    agentTabs.appendChild(el);
    return;
  }

  for (const agent of agentList) {
    const el = document.createElement("div");
    el.className = "chat-agent-tab" + (agent.key === activeKey ? " active" : "");
    el.innerHTML = '<span class="chat-agent-dot"></span>' + escapeHtml(agent.name);
    el.onclick = () => {
      activeAgentKey.value = agent.key;
    };
    agentTabs.appendChild(el);
  }
}
```

`renderMessages` — still needs to read `_getConversation` and `agents`, so it takes `activeKey`:
```typescript
function renderMessages(activeKey: string | null): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = "";

  if (!activeKey || !_getConversation) {
    messagesEl.innerHTML = '<div class="chat-empty">No conversation yet</div>';
    return;
  }

  const conv = _getConversation(activeKey);
  if (!conv || conv.length === 0) {
    messagesEl.innerHTML = '<div class="chat-empty">Start a conversation</div>';
    return;
  }

  const agentName = agents.value.find(a => a.key === activeKey)?.name || "Agent";

  // ... rest of function body unchanged, just replace:
  // - `activeAgentKey` → `activeKey` in the function body
  // - `agents` reads → `agents.value` reads
  // The entry-level rendering loop stays the same.
  // Update the two places that read activeAgentKey directly:
  //   if (_onAnswer && activeAgentKey) → if (_onAnswer && activeKey)
  // These are inside onclick handlers — they should still read the current
  // value from the signal at click time, so use activeAgentKey.value there.
}
```

`updateInputState`:
```typescript
function updateInputState(activeKey: string | null, agentList: Agent[]): void {
  if (!input || !sendBtn) return;
  const hasAgent = activeKey && agentList.length > 0;
  const hasFile = cm && cm.getValue().length > 0;

  if (!hasAgent) {
    input.disabled = true;
    sendBtn.disabled = true;
    input.placeholder = "No agent connected";
  } else if (!hasFile) {
    input.disabled = true;
    sendBtn.disabled = true;
    input.placeholder = "Open a file to start";
  } else {
    input.disabled = false;
    sendBtn.disabled = false;
    input.placeholder = "Ask about your document...";
  }
}
```

`renderContextPill`:
```typescript
function renderContextPill(context: Context | null): void {
  if (!contextPill) return;
  if (!context) {
    contextPill.style.display = "none";
    return;
  }
  contextPill.style.display = "";
  const preview = context.text.length > 60
    ? context.text.substring(0, 60) + "..."
    : context.text;
  contextPill.textContent = context.label
    ? "\uD83D\uDCCE " + context.label
    : "\uD83D\uDCCE Lines " + (context.lineStart + 1) + "-" + (context.lineEnd + 1) + ': "' + preview + '"';
}
```

- [ ] **Step 5: Remove the question/answer onclick handlers' direct reference to activeAgentKey closure**

Inside `renderMessages`, the onclick handlers for choice buttons and reply buttons reference `activeAgentKey` directly. Change these to read from the signal:

```typescript
// In the choices onclick:
btn.onclick = () => {
  if (_onAnswer && activeAgentKey.value) _onAnswer(activeAgentKey.value, entry.id, choice);
  entry.answered = true;
  activeAgentKey.value = activeAgentKey.value; // trigger re-render
};

// In the reply doReply:
const doReply = () => {
  const val = replyInput.value.trim();
  if (!val) return;
  if (_onAnswer && activeAgentKey.value) _onAnswer(activeAgentKey.value, entry.id, val);
  entry.answered = true;
  activeAgentKey.value = activeAgentKey.value; // trigger re-render
};
```

- [ ] **Step 6: Build and verify**

Run: `cd packages/base && npm run build`
Expected: Clean build.

- [ ] **Step 7: Commit**

```
git add packages/base/src/collaboration/chat-sidebar-controller.ts
git commit -m "refactor(chat-sidebar): replace closure state with reactive signals"
```

---

### Task 4: Migrate tab-bar-controller to signals

**Files:**
- Modify: `src/workspace/tabs/tab-bar-controller.ts`

The tab bar has two key state variables (`tabs` array and `activeTabIdx`) that trigger `renderTabBar()` at 8 call sites. We replace them with signals so `renderTabBar()` runs automatically.

**Important constraint:** The `tabs` array is mutated in place (`.push()`, `.splice()`). Signals use `Object.is()` for change detection, so array mutations won't trigger updates. We must use immutable updates (spread/filter/map) or explicitly re-assign the array after mutation.

- [ ] **Step 1: Add signal imports and replace state declarations**

```typescript
import { signal, effect, batch } from '../../infrastructure/signal.js';
```

Replace:
```typescript
// OLD:
// const tabs: Tab[] = [];
// let activeTabIdx: number = -1;

// NEW:
const tabs = signal<Tab[]>([]);
const activeTabIdx = signal<number>(-1);
```

- [ ] **Step 2: Wire the render effect**

Add after state declarations:
```typescript
effect(() => {
  renderTabBar(tabs.value, activeTabIdx.value);
});
```

- [ ] **Step 3: Update all state mutations to use signal writes**

`openTab`:
```typescript
export function openTab(path: string, name: string, content: string | undefined, modTime: number | undefined, options: { kind?: string; readOnly?: boolean; editorDisabled?: boolean } = {}): number {
  const existing = tabs.value.findIndex((t) => t.path && t.path === path);
  if (existing >= 0) {
    switchToTab(existing);
    return existing;
  }

  const tab: Tab = {
    path,
    name,
    editorState: {
      content: content || "",
      selection: { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } },
      scroll: { left: 0, top: 0 },
    },
    savedContent: content || "",
    localFileModTime: modTime || 0,
    dirty: false,
    kind: options.kind || "file",
    readOnly: !!options.readOnly,
    editorDisabled: !!options.editorDisabled,
  };

  tabs.value = [...tabs.value, tab];
  const idx = tabs.value.length - 1;
  switchToTab(idx);
  return idx;
}
```

`closeTab`:
```typescript
export function closeTab(idx: number): void {
  if (idx < 0 || idx >= tabs.value.length) return;
  if (idx === activeTabIdx.value) storeActiveEditorState();

  tabs.value = tabs.value.filter((_, i) => i !== idx);

  if (tabs.value.length === 0) {
    activeTabIdx.value = -1;
    if (_onBeforeSwap) _onBeforeSwap();
    setEditorReadOnly(false);
    restoreEditorSnapshot(blankEditorState());
    if (_onAllClosed) _onAllClosed();
    return;
  }

  if (idx <= activeTabIdx.value) {
    activeTabIdx.value = Math.max(0, activeTabIdx.value - 1);
  }
  switchToTab(activeTabIdx.value);
}
```

`closeAllTabs`:
```typescript
export function closeAllTabs(): void {
  batch(() => {
    tabs.value = [];
    activeTabIdx.value = -1;
  });
  if (_onBeforeSwap) _onBeforeSwap();
  setEditorReadOnly(false);
  restoreEditorSnapshot(blankEditorState());
  if (_onAllClosed) _onAllClosed();
}
```

`closeTabsToRight`:
```typescript
export function closeTabsToRight(idx: number): void {
  if (idx < 0 || idx >= tabs.value.length - 1) return;
  if (activeTabIdx.value > idx) storeActiveEditorState();
  batch(() => {
    tabs.value = tabs.value.slice(0, idx + 1);
    if (activeTabIdx.value > idx) activeTabIdx.value = idx;
  });
  switchToTab(Math.min(activeTabIdx.value, tabs.value.length - 1));
}
```

`closeTabsToLeft`:
```typescript
export function closeTabsToLeft(idx: number): void {
  if (idx <= 0 || idx >= tabs.value.length) return;
  if (activeTabIdx.value < idx) storeActiveEditorState();
  const prevActive = activeTabIdx.value;
  batch(() => {
    tabs.value = tabs.value.slice(idx);
    activeTabIdx.value = prevActive < idx ? 0 : prevActive - idx;
  });
  switchToTab(Math.max(0, activeTabIdx.value));
}
```

`switchToTab`:
```typescript
export function switchToTab(idx: number): void {
  if (idx < 0 || idx >= tabs.value.length) return;

  if (activeTabIdx.value >= 0 && activeTabIdx.value < tabs.value.length) {
    storeActiveEditorState();
  }

  activeTabIdx.value = idx;
  const tab = tabs.value[idx];
  if (_onBeforeSwap) _onBeforeSwap();
  setEditorReadOnly(!!tab.readOnly);
  restoreEditorSnapshot(tab.editorState || blankEditorState());
  cm.refresh();

  // renderTabBar() is now automatic via effect
  if (_onSwitch) _onSwitch(tab);
}
```

`markActiveTabDirty`:
```typescript
export function markActiveTabDirty(): void {
  const tab = getActiveTab();
  if (!tab || tab.dirty) return;
  tab.dirty = true;
  // Trigger re-render by re-assigning the array (mutation isn't detected)
  tabs.value = [...tabs.value];
}
```

`markActiveTabClean`:
```typescript
export function markActiveTabClean(newSavedContent: string, modTime: number | undefined): void {
  const tab = getActiveTab();
  if (!tab) return;
  tab.dirty = false;
  tab.savedContent = newSavedContent;
  tab.editorState = captureEditorSnapshot();
  if (modTime !== undefined) tab.localFileModTime = modTime;
  tabs.value = [...tabs.value];
}
```

`updateActiveTabPath`:
```typescript
export function updateActiveTabPath(path: string, name: string): void {
  const tab = getActiveTab();
  if (!tab) return;
  tab.path = path;
  tab.name = name;
  tabs.value = [...tabs.value];
}
```

- [ ] **Step 4: Update accessor functions to read from signals**

```typescript
export function getActiveTab(): Tab | null {
  if (activeTabIdx.value < 0 || activeTabIdx.value >= tabs.value.length) return null;
  return tabs.value[activeTabIdx.value];
}

export function getActiveTabIdx(): number { return activeTabIdx.value; }
export function getTabs(): Tab[] { return [...tabs.value]; }
export function getTabCount(): number { return tabs.value.length; }

export function isActiveTabDirty(): boolean {
  const tab = getActiveTab();
  return tab ? !!tab.dirty : false;
}

export function hasOpenTabs(): boolean {
  return tabs.value.length > 0;
}

export function findTabByPath(path: string): number {
  return tabs.value.findIndex((t) => t.path === path);
}
```

- [ ] **Step 5: Update `storeActiveEditorState` and render helpers**

```typescript
function storeActiveEditorState(): void {
  if (activeTabIdx.value < 0 || activeTabIdx.value >= tabs.value.length) return;
  tabs.value[activeTabIdx.value].editorState = captureEditorSnapshot();
}
```

Update `renderTabBar` signature to accept parameters:
```typescript
function renderTabBar(tabList: Tab[], activeIdx: number): void {
  if (!tabBarTabs) return;
  tabBarTabs.innerHTML = "";

  tabList.forEach((tab, i) => {
    const el = document.createElement("div");
    el.className = "tab" + (i === activeIdx ? " active" : "");
    el.onclick = (e) => {
      if ((e.target as HTMLElement).classList.contains("tab-close")) return;
      switchToTab(i);
    };

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = tab.name || "Untitled";
    el.appendChild(nameSpan);

    const indicator = document.createElement("span");
    indicator.className = "tab-indicator";

    if (tab.dirty) {
      const dot = document.createElement("span");
      dot.className = "tab-dirty-dot";
      indicator.appendChild(dot);
    }

    const closeBtn = document.createElement("span");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      requestCloseTab(i);
    };
    indicator.appendChild(closeBtn);

    el.appendChild(indicator);

    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) { e.preventDefault(); requestCloseTab(i); }
    });

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTabContextMenu(e.clientX, e.clientY, i);
    });

    tabBarTabs.appendChild(el);
  });
}
```

Update `showTabContextMenu` and internal helpers to read from signals:
```typescript
function requestCloseTab(idx: number): void {
  if (_onCloseRequest) return _onCloseRequest(idx);
  return closeTab(idx);
}

function requestCloseTabsToLeft(idx: number): void {
  if (_onCloseTabsToLeftRequest) return _onCloseTabsToLeftRequest(idx);
  return closeTabsToLeft(idx);
}

function requestCloseTabsToRight(idx: number): void {
  if (_onCloseTabsToRightRequest) return _onCloseTabsToRightRequest(idx);
  return closeTabsToRight(idx);
}

function requestCloseAllTabs(): void {
  if (_onCloseAllTabsRequest) return _onCloseAllTabsRequest();
  return closeAllTabs();
}

function showTabContextMenu(x: number, y: number, tabIdx: number): void {
  const tab = tabs.value[tabIdx];
  showContextMenu(x, y, [
    { label: "Save", disabled: !tab.dirty, action: () => { if (_onSave) { switchToTab(tabIdx); _onSave(); } } },
    { label: "Refresh from Disk", disabled: !tab.path, action: () => { if (_onRefresh) { switchToTab(tabIdx); _onRefresh(tab); } } },
    { separator: true },
    { label: "Close", action: () => requestCloseTab(tabIdx) },
    { label: "Close Tabs to the Left", disabled: tabIdx === 0, action: () => requestCloseTabsToLeft(tabIdx) },
    { label: "Close Tabs to the Right", disabled: tabIdx >= tabs.value.length - 1, action: () => requestCloseTabsToRight(tabIdx) },
    { label: "Close All", action: () => requestCloseAllTabs() },
    { separator: true },
    { label: "Copy Path", disabled: !tab.path, action: () => tab.path && navigator.clipboard.writeText(tab.path) },
    { label: "Show in Finder", disabled: !tab.path || !canShowInFinder, action: () => tab.path && showInFinder(tab.path) },
  ]);
}
```

Update `getSessionState`:
```typescript
export function getSessionState(): { openTabs: Array<{ path: string; name: string; kind: string | undefined; readOnly: boolean | undefined; editorDisabled: boolean | undefined }>; activeTab: { path: string | null; name: string | null; kind: string | null } | null } {
  return {
    openTabs: tabs.value.map((t) => ({
      path: t.path,
      name: t.name,
      kind: t.kind,
      readOnly: t.readOnly,
      editorDisabled: t.editorDisabled,
    })),
    activeTab: activeTabIdx.value >= 0
      ? {
        path: tabs.value[activeTabIdx.value]?.path || null,
        name: tabs.value[activeTabIdx.value]?.name || null,
        kind: tabs.value[activeTabIdx.value]?.kind || null,
      }
      : null,
  };
}
```

- [ ] **Step 6: Remove the now-unused `export` from `renderTabBar`**

The `renderTabBar` function was exported because external code called it. With signals, it auto-runs. Check if any external file calls `renderTabBar`:

External callers: `tab-integration.ts` imports and calls `renderFileList` (from file-manager), NOT `renderTabBar`. Grep confirms `renderTabBar` is only called within `tab-bar-controller.ts` itself.

Remove the `export` keyword from `renderTabBar` — it's now private, called only by the effect.

Note: the existing export of `renderTabBar` was not imported by any other file. The tab-integration module imports other functions but not `renderTabBar`.

- [ ] **Step 7: Build and verify**

Run: `cd packages/base && npm run build`
Expected: Clean build. The tab bar should auto-render on any state change.

- [ ] **Step 8: Commit**

```
git add packages/base/src/workspace/tabs/tab-bar-controller.ts
git commit -m "refactor(tab-bar): replace manual renderTabBar() calls with reactive signal + effect"
```

---

### Task 5: Migrate agent-connection-manager events to the typed bus

**Files:**
- Modify: `src/infrastructure/event-bus.ts` (add new events)
- Modify: `src/collaboration/agent-connection-manager.ts` (emit events instead of callbacks)
- Modify: `src/shell/app-orchestrator.ts` (subscribe to events instead of registering callbacks)

The agent-connection-manager has three callback setters that are purely event-like (they broadcast to a single listener set by app-orchestrator). We migrate them to the typed event bus.

- [ ] **Step 1: Add new events to the EventMap**

In `src/infrastructure/event-bus.ts`, extend the `EventMap`:

```typescript
export interface EventMap {
  "content-loaded": [];
  "section-ready": [];
  "file-saved": [payload: { file: string; name: string }];
  "agents-changed": [agents: Array<{ key: string; name: string }>];
  "conversation-updated": [agentKey: string];
  "agent-click": [agentKey: string];
}
```

- [ ] **Step 2: Update agent-connection-manager to emit typed events**

Add import:
```typescript
import { emit } from '../infrastructure/event-bus.js';
```

Replace the three callback patterns:

Remove:
```typescript
let _onConversationUpdate: ((key: string) => void) | null = null;
export function onConversationUpdate(fn: (key: string) => void): void { _onConversationUpdate = fn; }

function notifyConversationUpdate(key: string): void {
  if (_onConversationUpdate) _onConversationUpdate(key);
}

let _onAgentsChanged: ((agents: Array<{ key: string; name: string }>) => void) | null = null;
export function onAgentsChanged(fn: (agents: Array<{ key: string; name: string }>) => void): void { _onAgentsChanged = fn; }

let _onAgentClick: ((key: string) => void) | null = null;
export function onAgentClick(fn: (key: string) => void): void { _onAgentClick = fn; }
```

Replace with:
```typescript
function notifyConversationUpdate(key: string): void {
  emit("conversation-updated", key);
}

function notifyAgentsChanged(): void {
  const list = [...agents.entries()]
    .filter(([, a]) => a.connected)
    .map(([key, a]) => ({ key, name: a.name }));
  emit("agents-changed", list);
}
```

Then find everywhere `_onAgentsChanged` was called and replace with `notifyAgentsChanged()`.
Find everywhere `_onAgentClick` was called and replace with `emit("agent-click", key)`.

- [ ] **Step 3: Update app-orchestrator to subscribe via typed bus**

In `src/shell/app-orchestrator.ts`, replace:

```typescript
// OLD:
import {
  init as initAiCollab, addAgent,
  getConnectedAgents, sendRequest, sendAnswer,
  onConversationUpdate, getConversation, onAgentClick, onAgentsChanged,
} from "../collaboration/agent-connection-manager.js";

// NEW:
import {
  init as initAiCollab, addAgent,
  getConnectedAgents, sendRequest, sendAnswer,
  getConversation,
} from "../collaboration/agent-connection-manager.js";
```

And in the startup section, replace:

```typescript
// OLD:
onConversationUpdate(() => {
  refreshChat();
});

onAgentClick((key: string) => {
  showChat();
  focusForAgent(key);
});

onAgentsChanged((connectedAgents: any[]) => {
  setChatAgents(connectedAgents);
  if (connectedAgents.length > 0) showChat();
  else hideChat();
});

// NEW:
busOn("conversation-updated", () => {
  refreshChat();
});

busOn("agent-click", (key: string) => {
  showChat();
  focusForAgent(key);
});

busOn("agents-changed", (connectedAgents) => {
  setChatAgents(connectedAgents);
  if (connectedAgents.length > 0) showChat();
  else hideChat();
});
```

- [ ] **Step 4: Build and verify**

Run: `cd packages/base && npm run build`
Expected: Clean build. The agent collaboration should work identically — events flow through the bus instead of direct callbacks.

- [ ] **Step 5: Commit**

```
git add packages/base/src/infrastructure/event-bus.ts \
       packages/base/src/collaboration/agent-connection-manager.ts \
       packages/base/src/shell/app-orchestrator.ts
git commit -m "refactor(agents): migrate agent callbacks to typed event bus"
```

---

### Task 6: Verify end-to-end in the app

**Files:** None modified — manual testing only.

- [ ] **Step 1: Start the app and verify basic functionality**

Run: `cd /Users/benjaminbini/dev/projects/paged-editor && npm start`

Test checklist:
1. Open a folder → file sidebar renders correctly
2. Click files → tabs appear, tab bar renders
3. Switch between tabs → tab bar highlights correctly, editor content swaps
4. Edit content → dirty dot appears on tab
5. Save → dirty dot disappears
6. Close tab → tab disappears, next tab activates
7. Middle-click tab → closes it
8. Right-click tab → context menu works (Save, Close, Close All, etc.)
9. Chat sidebar → if agent connected, messages render
10. Multiple agents → tab switching works in chat

- [ ] **Step 2: Verify build output is correct**

Run: `cd packages/base && npm run build`

Check that `dist/js/infrastructure/signal.js` exists and is a valid ES module.
Check that `dist/js/infrastructure/event-bus.js` has the typed exports.

- [ ] **Step 3: Final commit if any fixes needed**

Only if issues found in testing.
