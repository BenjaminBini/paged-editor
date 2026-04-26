// preview-sync-setup.js — Sets up scroll and click sync between the editor and preview.

import { cm, previewContainer as _previewContainer } from "../../editor/codemirror-editor.js";
const previewContainer: HTMLElement = _previewContainer!;
import { getPreviewFrame, handlePreviewLayoutChange } from "../render-scheduler.js";
import { ScrollSyncController } from "./scroll-sync-controller.js";

let controller: ScrollSyncController | null = null;
let scrollSyncReady: boolean = false;
let clickBindingReady: boolean = false;

function ensureController(): ScrollSyncController {
  if (controller) return controller;

  controller = new ScrollSyncController({
    editorApi: cm,
    getPreviewPages: getPreviewFrame,
    previewFrame: previewContainer,
  });

  return controller;
}

export function rebuildAnchorMap(): void {
  const syncController = ensureController();
  handlePreviewLayoutChange();
  syncController.handleLayoutChange();
}

// Lock/unlock the editor scroll position.  While locked, the sync controller
// silently drops all programmatic writes to the editor scroll — guaranteeing
// the editor never jumps during a preview render cycle.
export function lockEditorScroll(): void {
  ensureController().editorScrollLocked = true;
}

export function unlockEditorScroll(): void {
  ensureController().editorScrollLocked = false;
}

// Suppress editor↔preview scroll-sync events for the next `durationMs`.  Used
// by tab switches: CodeMirror's snapshot restore fires a scroll event that
// would otherwise drive `followScrollTop` and animate the preview to the new
// position; we want the new tab to snap instead.
export function suppressScrollSync(durationMs: number = 500): void {
  const controller = ensureController();
  const until = performance.now() + durationMs;
  controller.ignoredScrollUntil.editor = until;
  controller.ignoredScrollUntil.preview = until;
  controller.cancelAllFollowAnimations();
}

export function setupPreviewClick(): void {
  if (clickBindingReady) return;
  clickBindingReady = true;

  previewContainer.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement)?.closest?.("[data-source-line]");
    if (!target) return;

    const line = Number.parseInt((target as HTMLElement).dataset.sourceLine || "", 10);
    if (Number.isNaN(line)) return;

    cm.setCursor({ line, ch: 0 });
    cm.focus();
  });
}

export function setupScrollSync(): void {
  if (scrollSyncReady) return;
  scrollSyncReady = true;

  const syncController = ensureController();

  cm.on("change", () => {
    syncController.handleDocumentChange();
  });
  cm.on("scroll", () => {
    syncController.handleEditorScroll();
  });
  previewContainer.addEventListener("scroll", () => {
    syncController.handlePreviewScroll();
  }, { passive: true });
}
