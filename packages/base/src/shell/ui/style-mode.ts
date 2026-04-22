// style-mode.ts — the signal that flips Style Mode on/off plus helpers that
// compose it with the sidebar panel manager. Subscribers listen via effect().

import { effect, signal } from "../../infrastructure/signal.js";
import {
  activeSidebarPanel,
  requestOutline,
  setActivePanel,
} from "./sidebar-panel-manager.js";

const _active = signal<boolean>(false);
const _suspended = signal<boolean>(false);

export function isStyleModeActive(): boolean {
  return _active.value;
}

export function isInteractionSuspended(): boolean {
  return _suspended.value;
}

export function suspendInteraction(): void {
  _suspended.value = true;
}

export function resumeInteraction(): void {
  _suspended.value = false;
}

export function enable(): void {
  if (_active.value) return;
  _active.value = true;
  document.body.classList.add("style-mode");
  setActivePanel("inspector");
}

export function disable(): void {
  if (!_active.value) return;
  _active.value = false;
  document.body.classList.remove("style-mode");
  // Hand the sidebar back to the outline manager. It will re-request
  // visibility on its next buildOutline, but we set "none" here so the
  // transition is clean if the outline happens to be empty.
  if (activeSidebarPanel() === "inspector") {
    requestOutline(false);
  }
}

export function toggle(): void {
  if (_active.value) disable();
  else enable();
}

// Bind a toolbar pill/button: flips the toggle on click and reflects the
// current state via the `active` class (matches .wrap-toggle convention).
export function bindToggleButton(btn: HTMLElement): void {
  effect(() => {
    btn.classList.toggle("active", _active.value);
  });
  btn.addEventListener("click", () => toggle());
}

// Used by effect()-based consumers (preview-interaction, editor decorations).
export function onStyleModeChange(fn: (on: boolean) => void): () => void {
  return effect(() => fn(_active.value));
}
