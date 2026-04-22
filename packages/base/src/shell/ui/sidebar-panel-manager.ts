// sidebar-panel-manager.ts — arbitrates visibility of #outlineSection vs
// #inspectorPanel so style-mode and outline-manager don't fight over DOM
// style.display writes. All mutations go through setActivePanel or
// requestOutline. The DOM binding is a single `effect()` installed by
// bindSidebarDom at app startup.

import { effect, signal } from "../../infrastructure/signal.js";

export type SidebarPanel = "outline" | "inspector" | "none";

const _active = signal<SidebarPanel>("outline");

export function activeSidebarPanel(): SidebarPanel {
  return _active.value;
}

// Direct mutator — used by style-mode to claim or release the inspector slot.
export function setActivePanel(panel: SidebarPanel): void {
  _active.value = panel;
}

// Non-invasive mutator — used by outline-manager. Upgrades outline to visible
// when nothing else claims the slot; never overrides an active inspector.
export function requestOutline(show: boolean): void {
  if (_active.value === "inspector") return;
  _active.value = show ? "outline" : "none";
}

// Install the DOM binding. Call once at app startup after both panels exist.
export function bindSidebarDom(
  outlineSection: HTMLElement,
  inspectorPanel: HTMLElement,
): void {
  effect(() => {
    const panel = _active.value;
    outlineSection.style.display = panel === "outline" ? "" : "none";
    inspectorPanel.style.display = panel === "inspector" ? "" : "none";
  });
}
