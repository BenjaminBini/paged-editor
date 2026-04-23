// preview-interaction.ts — delegated pointer handling on #preview-container.
// Resolves the nearest `data-block-id` ancestor under the pointer, publishes
// hovered/selected block ids on signals, and mirrors them to DOM state
// classes (.style-hovered / .style-selected). Gated on style-mode so the
// preview remains a normal click-to-source surface when the mode is off.

import { effect, signal } from "../../infrastructure/signal.js";
import { isInteractionSuspended, isStyleModeActive } from "./style-mode.js";
import { on as busOn } from "../../infrastructure/event-bus.js";

const _hovered = signal<string | null>(null);
const _selected = signal<string | null>(null);
let _lastSelectedSourceLine: number | null = null;

export function hoveredBlockId(): string | null {
  return _hovered.value;
}

export function selectedBlockId(): string | null {
  return _selected.value;
}

// effect()-flavoured subscriptions for consumers (editor decorations, inspector).
export function onHoverChange(fn: (id: string | null) => void): () => void {
  return effect(() => fn(_hovered.value));
}

export function onSelectionChange(fn: (id: string | null) => void): () => void {
  return effect(() => fn(_selected.value));
}

export function deselect(): void {
  _selected.value = null;
  _lastSelectedSourceLine = null;
}

// Called by the inspector each time it renders for a selected block so that
// selection survives re-renders via sourceLineStart re-match (§4.1).
export function rememberSelectedSourceLine(line: number | null): void {
  _lastSelectedSourceLine = line;
}

// Called by render-scheduler after each section-ready. If the previously
// selected block's source line still starts a block, reattach the selection;
// otherwise clear it.
export function restoreSelection(
  entries: Array<{ blockId: string; sourceLineStart: number }>,
): void {
  if (_lastSelectedSourceLine === null) {
    _selected.value = null;
    return;
  }
  const match = entries.find(
    (e) => e.sourceLineStart === _lastSelectedSourceLine,
  );
  _selected.value = match ? match.blockId : null;
}

function resolveBlockId(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>("[data-block-id]");
  return el?.dataset.blockId ?? null;
}

function applyClasses(
  container: HTMLElement,
  hoveredId: string | null,
  selectedId: string | null,
): void {
  for (const el of container.querySelectorAll<HTMLElement>(".style-hovered")) {
    el.classList.remove("style-hovered");
  }
  for (const el of container.querySelectorAll<HTMLElement>(".style-selected")) {
    el.classList.remove("style-selected");
  }
  if (hoveredId) {
    for (const el of container.querySelectorAll<HTMLElement>(
      `[data-block-id="${hoveredId}"]`,
    )) {
      el.classList.add("style-hovered");
    }
  }
  if (selectedId) {
    for (const el of container.querySelectorAll<HTMLElement>(
      `[data-block-id="${selectedId}"]`,
    )) {
      el.classList.add("style-selected");
    }
  }
}

// Install the delegated handlers. Called once at app startup; safe to call
// even before the DOM has any data-block-id children.
export function install(container: HTMLElement): void {
  container.addEventListener("pointermove", (e) => {
    if (!isStyleModeActive() || isInteractionSuspended()) {
      if (_hovered.value !== null) _hovered.value = null;
      return;
    }
    const id = resolveBlockId(e.target);
    if (id !== _hovered.value) _hovered.value = id;
  });

  container.addEventListener("pointerleave", () => {
    if (_hovered.value !== null) _hovered.value = null;
  });

  container.addEventListener("click", (e) => {
    if (!isStyleModeActive()) return;
    const id = resolveBlockId(e.target);
    if (id !== null) {
      e.preventDefault();
      e.stopPropagation();
      _selected.value = id;
    } else {
      deselect();
    }
  });

  // Mirror signal state to the DOM whenever either signal changes.
  effect(() => {
    applyClasses(container, _hovered.value, _selected.value);
  });
  // Also re-apply after each render — patchVisiblePages and the full-render
  // path both replace preview elements, which clears the .style-hovered /
  // .style-selected classes. The signals may still hold the same block ids
  // (so the effect above wouldn't re-fire), but the DOM needs a repaint.
  busOn("section-ready", () => {
    applyClasses(container, _hovered.value, _selected.value);
  });
  // When Style Mode turns off, drop the hover + selection so highlights
  // vanish from both the preview and the editor immediately.
  effect(() => {
    if (!isStyleModeActive()) {
      if (_hovered.value !== null) _hovered.value = null;
      if (_selected.value !== null) {
        _selected.value = null;
        _lastSelectedSourceLine = null;
      }
    }
  });
}
