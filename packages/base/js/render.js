// render.js — Preview rendering orchestrator.
// Manages the single-iframe lifecycle: trigger render, swap frames, scale/zoom.

import { editor, previewContainer, status } from "./editor.js";
import { getActiveFileName } from "./parse-context.js";
import { renderMarkdown } from "./render-pipeline.js";
import { emit } from "./event-bus.js";


// ── Single iframe state ─────────────────────────────────────────────────────

const A4_WIDTH_PX = 794;
const previewWrapper = document.getElementById("preview-wrapper");

let currentFrame = null;
let pendingFrame = null;
let currentBlobUrl = null;
let currentGen = 0;
let renderStartTime = 0;

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
  const doc = result.documentHtml;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.className = "section-frame";
  iframe.style.width = A4_WIDTH_PX + "px";
  iframe.style.height = "20000px";
  iframe.style.transformOrigin = "top left";
  iframe.style.border = "none";
  iframe.style.background = "transparent";
  iframe.dataset.gen = String(gen);

  // Kill only the pending frame immediately — it's still rendering and would
  // compete for CPU with the new one (splitting Paged.js CPU, turning a 200ms
  // render into 2-4s on Firefox). The current frame stays alive and visible so
  // there is no blank flicker while the new frame loads.
  if (pendingFrame) {
    if (pendingFrame._blobUrl) URL.revokeObjectURL(pendingFrame._blobUrl);
    pendingFrame.remove();
    pendingFrame = null;
  }

  // Overlay the new frame invisibly; it will be swapped in on section-ready.
  iframe.style.position = "absolute";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  pendingFrame = iframe;
  iframe._blobUrl = url;
  previewWrapper.appendChild(iframe);
  iframe.src = url;
}

// ── Section-ready handler ───────────────────────────────────────────────────

window.addEventListener("message", (e) => {
  if (e.data?.type !== "section-ready") return;
  const gen = e.data.gen;
  if (gen !== currentGen) return; // stale render

  const pages = e.data.pages;
  const iframe = pendingFrame;
  if (!iframe) return;

  const oldFrame = currentFrame;
  const oldBlobUrl = currentBlobUrl;

  // Swap: scale new frame while still invisible, then reveal + remove old.
  // Both operations are synchronous so the browser paints them as one frame.
  currentFrame = iframe;
  currentBlobUrl = iframe._blobUrl;
  pendingFrame = null;

  scalePreview(); // sets transform + wrapper dimensions on the new frame

  iframe.style.position = "";
  iframe.style.top = "";
  iframe.style.left = "";
  iframe.style.opacity = "";
  iframe.style.pointerEvents = "";

  if (oldFrame) {
    oldFrame.remove();
    if (oldBlobUrl) URL.revokeObjectURL(oldBlobUrl);
  }

  const elapsed = Math.round(performance.now() - renderStartTime);
  status.textContent = pages + " pages — " + elapsed + "ms";

  emit("section-ready");
});

// ── Scaling ─────────────────────────────────────────────────────────────────

let _userZoom = 1.0;

function scaleFrame() {
  if (!currentFrame) return;

  const containerW = previewContainer.clientWidth - 40;
  const fitScale = Math.min(1, containerW / A4_WIDTH_PX);
  const scale = fitScale * _userZoom;
  currentFrame.style.transform = `scale(${scale})`;
  currentFrame.style.width = A4_WIDTH_PX + "px";

  try {
    const doc =
      currentFrame.contentDocument || currentFrame.contentWindow.document;
    const pagedPages = doc.querySelector(".pagedjs_pages");
    const h = pagedPages
      ? pagedPages.scrollHeight
      : Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);

    if (h > 100) {
      currentFrame.style.height = h + "px";
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
  return currentFrame;
}

export function getPreviewScale() {
  const containerW = previewContainer.clientWidth - 40;
  return Math.min(1, containerW / A4_WIDTH_PX);
}
