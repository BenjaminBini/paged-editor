// preview-sync-setup.js — Sets up scroll and click sync between the editor and preview.

import { cm, previewContainer as _previewContainer } from "../../editor/codemirror-editor.js";
const previewContainer: HTMLElement = _previewContainer!;
import { getLineMap, handlePreviewLayoutChange } from "../render-scheduler.js";
import { ScrollSyncController } from "./scroll-sync-controller.js";

let controller: ScrollSyncController | null = null;
let scrollSyncReady: boolean = false;
let clickBindingReady: boolean = false;

function ensureController(): ScrollSyncController {
  if (controller) return controller;

  controller = new ScrollSyncController({
    editorApi: cm,
    getLineMap,
    previewFrame: previewContainer,
  });

  return controller;
}

export function rebuildAnchorMap(): void {
  const syncController = ensureController();
  handlePreviewLayoutChange();
  syncController.handleLayoutChange();
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
