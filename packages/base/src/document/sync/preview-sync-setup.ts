// preview-sync-setup.js — Sets up scroll and click sync between the editor and preview.

import { cm, previewContainer as _previewContainer } from "../../editor/codemirror-editor.js";
const previewContainer: HTMLElement = _previewContainer!;
import {
  getPreviewFrame,
  handlePreviewLayoutChange,
  onPreviewScrollerChange,
  getActivePreviewScroller,
} from "../render-scheduler.js";
import { ScrollSyncController } from "./scroll-sync-controller.js";

let controller: ScrollSyncController | null = null;
let scrollSyncReady: boolean = false;
let clickBindingReady: boolean = false;
// Track the scroller we currently have a "scroll" listener bound to so we
// can detach it before binding to a new one (per-tab `.preview-tab` scrolls
// independently — switching tabs swaps the active scroller).
let boundScroller: HTMLElement | null = null;
let boundScrollHandler: (() => void) | null = null;

function ensureController(): ScrollSyncController {
  if (controller) return controller;

  controller = new ScrollSyncController({
    editorApi: cm,
    getPreviewPages: getPreviewFrame,
    // Initial frame: the active pane if there's one, otherwise the host
    // (acts as a sentinel until a tab is activated).
    previewFrame: getActivePreviewScroller() ?? previewContainer,
  });

  // Keep `previewFrame` pointing at the visible scroller as the user
  // switches tabs.  Pool fires immediately with the current value if any.
  onPreviewScrollerChange((scroller) => {
    if (!controller) return;
    controller.previewFrame = scroller ?? previewContainer;
    // Re-bind the scroll listener once the sync has been wired up.  Before
    // setupScrollSync() runs there's nothing to bind.
    if (scrollSyncReady) bindPreviewScrollListener();
  });

  return controller;
}

function bindPreviewScrollListener(): void {
  if (!controller) return;
  if (boundScroller && boundScrollHandler) {
    boundScroller.removeEventListener("scroll", boundScrollHandler);
  }
  const next = getActivePreviewScroller() ?? previewContainer;
  const handler = () => controller!.handlePreviewScroll();
  next.addEventListener("scroll", handler, { passive: true });
  boundScroller = next;
  boundScrollHandler = handler;
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
  bindPreviewScrollListener();
}
