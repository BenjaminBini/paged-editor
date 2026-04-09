// render.js — Preview rendering orchestrator.
// Uses two persistent iframes (double-buffer). Each render writes into the hidden
// frame via document.open/write/close so the browser JSContext — and with it
// SpiderMonkey's JIT cache — is reused across renders.  Paged.js (921 KB) is
// therefore compiled only once per session instead of once per render.

import { editor, previewContainer, status } from "./editor.js";
import { getActiveFileName } from "./parse-context.js";
import { renderMarkdown } from "./render-pipeline.js";
import { emit } from "./event-bus.js";


// ── Constants ────────────────────────────────────────────────────────────────

const A4_WIDTH_PX = 794;
const previewWrapper = document.getElementById("preview-wrapper");

// ── Persistent double-buffer frames ─────────────────────────────────────────
// frameA is always the currently visible frame.
// frameB is always the hidden frame we write new content into.
// After a successful render they are swapped.

let frameA = null;
let frameB = null;
let currentGen = 0;
let renderStartTime = 0;

// Blob URL of the current visible frame's document — kept for cleanup.
let currentBlobUrl = null;

function makeFrame(hidden) {
  const iframe = document.createElement("iframe");
  iframe.className = "section-frame";
  iframe.style.width = A4_WIDTH_PX + "px";
  iframe.style.height = "20000px";
  iframe.style.transformOrigin = "top left";
  iframe.style.border = "none";
  iframe.style.background = "transparent";
  if (hidden) {
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.visibility = "hidden";
  }
  previewWrapper.appendChild(iframe);
  return iframe;
}

function ensureFrames() {
  if (frameA) return;
  frameA = makeFrame(false);  // visible
  frameB = makeFrame(true);   // hidden
}

// ── Render ──────────────────────────────────────────────────────────────────

export async function triggerRender() {
  const md = editor.value;
  if (!md.trim()) {
    status.textContent = "Empty";
    return;
  }

  status.textContent = "Rendering...";
  renderStartTime = performance.now();

  // Compute frontmatter line offset for source-line tracking
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const startLine = fmMatch ? fmMatch[0].split("\n").length - 1 : 0;

  currentGen++;
  const gen = currentGen;

  const result = await renderMarkdown(md, {
    fileName: getActiveFileName(),
    startLine,
    gen,
  });

  // Stale render check: a newer render started while we were awaiting.
  if (gen !== currentGen) return;

  const doc = result.documentHtml;

  ensureFrames();

  // Write new content into the hidden frame, reusing its JSContext.
  // document.open/write/close keeps the same Window object, so SpiderMonkey's
  // JIT cache (keyed per-JSContext) is preserved — Paged.js only compiles once.
  const pendingDoc = frameB.contentDocument;
  pendingDoc.open();
  pendingDoc.write(doc);
  pendingDoc.close();

  // Tag the frame with the generation so the message handler can verify it.
  frameB.dataset.gen = String(gen);
}

// ── Section-ready handler ───────────────────────────────────────────────────

window.addEventListener("message", (e) => {
  if (e.data?.type !== "section-ready") return;
  const gen = e.data.gen;
  if (gen !== currentGen) return; // stale render

  const pages = e.data.pages;

  // Verify it came from the pending frame (frameB at message time).
  if (!frameB || String(frameB.dataset.gen) !== String(gen)) return;

  // Swap: reveal frameB, hide frameA.
  frameA.style.position = "absolute";
  frameA.style.left = "-9999px";
  frameA.style.visibility = "hidden";

  frameB.style.position = "";
  frameB.style.left = "";
  frameB.style.visibility = "";

  // Rotate the double-buffer.
  const tmp = frameA;
  frameA = frameB;
  frameB = tmp;

  // Cleanup old blob URL from the now-hidden frame (if it had one).
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }

  scalePreview();

  const elapsed = Math.round(performance.now() - renderStartTime);
  status.textContent = pages + " pages — " + elapsed + "ms";

  emit("section-ready");
});

// ── Scaling ─────────────────────────────────────────────────────────────────

let _userZoom = 1.0;

function scaleFrame() {
  if (!frameA) return;

  const containerW = previewContainer.clientWidth - 40;
  const fitScale = Math.min(1, containerW / A4_WIDTH_PX);
  const scale = fitScale * _userZoom;
  frameA.style.transform = `scale(${scale})`;
  frameA.style.width = A4_WIDTH_PX + "px";

  try {
    const doc =
      frameA.contentDocument || frameA.contentWindow.document;
    const pagedPages = doc.querySelector(".pagedjs_pages");
    const h = pagedPages
      ? pagedPages.scrollHeight
      : Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);

    if (h > 100) {
      frameA.style.height = h + "px";
      previewWrapper.style.width = Math.ceil(A4_WIDTH_PX * scale) + "px";
      previewWrapper.style.height = Math.ceil(h * scale) + "px";
    }
  } catch (e) {
    setTimeout(scaleFrame, 500);
  }
}

export const scalePreview = scaleFrame;

export function zoomIn() {
  _userZoom = Math.min(3, _userZoom + 0.15);
  scaleFrame();
  return Math.round(_userZoom * 100);
}

export function zoomOut() {
  _userZoom = Math.max(0.25, _userZoom - 0.15);
  scaleFrame();
  return Math.round(_userZoom * 100);
}

export function zoomReset() {
  _userZoom = 1.0;
  scaleFrame();
}

export function getZoom() {
  return Math.round(_userZoom * 100);
}

window.addEventListener("resize", scalePreview);

// ── Render timeout helpers ──────────────────────────────────────────────────

export let renderTimeout = null;

export function clearRenderTimeout() {
  clearTimeout(renderTimeout);
}

export function scheduleRender(ms) {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(triggerRender, ms);
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getPreviewFrame() {
  return frameA;
}

export function getPreviewScale() {
  const containerW = previewContainer.clientWidth - 40;
  return Math.min(1, containerW / A4_WIDTH_PX);
}
