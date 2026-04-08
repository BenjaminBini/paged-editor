// render.js — Preview rendering orchestrator.
// Manages the single-iframe lifecycle: trigger render, swap frames, scale/zoom.

import { editor, previewContainer, status } from "./editor.js";
import { parseFrontmatter } from "./utils.js";
import { COLOR_PAIRS, parseMarkdownSync } from "./markdown.js";
import { getActiveFileName } from "./parse-context.js";
import { resolveMermaid, getMermaidQueue } from "./mermaid-render.js";
import { wrapInDocument, buildHeaderText } from "./document.js";

// ── Hooks ───────────────────────────────────────────────────────────────────

let onSectionReady = null;
export function registerOnSectionReady(fn) {
  onSectionReady = fn;
}

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

  const { fm, body } = parseFrontmatter(md);
  const headerText = buildHeaderText(fm);
  const language = fm.language || "fr";

  // Compute frontmatter line offset for source-line tracking
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const startLine = fmMatch ? fmMatch[0].split("\n").length - 1 : 0;

  // Detect Partie number for color selection: from markdown or filename
  const partieMatch2 = body.match(/^#\s+Partie\s+(\d+)/im);
  let partieNum;
  if (partieMatch2) {
    partieNum = parseInt(partieMatch2[1], 10);
  } else {
    const fnMatch = getActiveFileName().match(/^(\d+)/);
    partieNum = fnMatch ? parseInt(fnMatch[1], 10) : 0;
  }
  const colorIdx = partieNum > 0 ? (partieNum - 1) % COLOR_PAIRS.length : 0;

  // Phase 1: Sync parse (mermaid → placeholders)
  let html = parseMarkdownSync(body, colorIdx, startLine);
  const queue = getMermaidQueue();

  // Phase 2: Resolve mermaid (cached where possible)
  html = await resolveMermaid(html, queue);

  // Wrap in section element
  const pair = COLOR_PAIRS[colorIdx % COLOR_PAIRS.length];
  const sectionHtml = `<section class="level2" data-color-index="${colorIdx % 5}" style="--section-color:${pair[0]};--section-color-light:${pair[1]}">\n${html}\n</section>`;

  // Phase 3: Create iframe
  currentGen++;
  const gen = currentGen;

  const doc = wrapInDocument(sectionHtml, { gen, headerText, language });
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

  // Position off-screen until ready
  if (currentFrame) {
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.visibility = "hidden";
  }

  // Remove previous pending frame if a newer render started
  if (pendingFrame) {
    if (pendingFrame._blobUrl) URL.revokeObjectURL(pendingFrame._blobUrl);
    pendingFrame.remove();
  }
  pendingFrame = iframe;

  previewWrapper.appendChild(iframe);
  iframe.src = url;

  // Store blob URL for cleanup
  iframe._blobUrl = url;
}

// ── Section-ready handler ───────────────────────────────────────────────────

window.addEventListener("message", (e) => {
  if (e.data?.type !== "section-ready") return;
  const gen = e.data.gen;
  if (gen !== currentGen) return; // stale render

  const pages = e.data.pages;
  const iframe = pendingFrame;
  if (!iframe) return;

  // Swap: reveal new frame, remove old
  if (currentFrame) currentFrame.remove();
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);

  currentFrame = iframe;
  currentBlobUrl = iframe._blobUrl;
  pendingFrame = null;

  iframe.style.position = "";
  iframe.style.left = "";
  iframe.style.visibility = "";

  scalePreview();

  const elapsed = Math.round(performance.now() - renderStartTime);
  status.textContent = pages + " pages — " + elapsed + "ms";

  if (typeof onSectionReady === "function") onSectionReady();
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

export function scalePreview() {
  scaleFrame();
}

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
