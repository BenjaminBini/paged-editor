// sync.js — Source-line-based scroll synchronization
// Uses data-source-line attributes injected during markdown rendering
// to build an anchor map for bidirectional scroll position mapping.
// Stops syncing when scrolled past the last anchor (document extremes).

import { cm, previewContainer } from './editor.js';
import { getSectionStates, getPreviewScale } from './render.js';

// ── Anchor map ──────────────────────────────────────────────────────────────

let anchorMap = []; // [{line: number, y: number}]

function computeElementY(el, frame) {
  const scale = getPreviewScale();
  const wrapper = frame.closest('.section-wrapper');
  if (!wrapper) return 0;

  const elRect = el.getBoundingClientRect();
  const doc = frame.contentDocument;
  const pages = doc?.querySelector('.pagedjs_pages');
  const refRect = (pages || doc.body).getBoundingClientRect();

  const yInIframe = elRect.top - refRect.top + elRect.height / 2;
  const wrapperTop = wrapper.offsetTop;
  return wrapperTop + yInIframe * scale;
}

export function rebuildAnchorMap() {
  anchorMap = [];
  const states = getSectionStates();

  for (const state of states) {
    const frame = state.frame;
    if (!frame) continue;
    try {
      const doc = frame.contentDocument;
      if (!doc) continue;
      const els = doc.querySelectorAll('[data-source-line]');
      for (const el of els) {
        const line = parseInt(el.dataset.sourceLine, 10);
        if (isNaN(line)) continue;
        anchorMap.push({ line, y: computeElementY(el, frame) });
      }
    } catch (e) { /* iframe not ready */ }
  }

  anchorMap.sort((a, b) => a.line - b.line);
}

// ── Interpolation helpers ───────────────────────────────────────────────────

function lineToY(targetLine) {
  if (anchorMap.length === 0) return 0;

  let lo = 0, hi = anchorMap.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (anchorMap[mid].line < targetLine) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(anchorMap[lo - 1].line - targetLine) <= Math.abs(anchorMap[lo].line - targetLine)) {
    lo = lo - 1;
  }

  const a = anchorMap[lo];
  if (a.line === targetLine || anchorMap.length === 1) return a.y;

  let prev, next;
  if (a.line < targetLine && lo + 1 < anchorMap.length) {
    prev = a; next = anchorMap[lo + 1];
  } else if (a.line > targetLine && lo > 0) {
    prev = anchorMap[lo - 1]; next = a;
  } else {
    return a.y;
  }

  const t = (targetLine - prev.line) / Math.max(1, next.line - prev.line);
  return prev.y + t * (next.y - prev.y);
}

function yToLine(targetY) {
  if (anchorMap.length === 0) return 0;

  let lo = 0;
  while (lo < anchorMap.length - 1 && anchorMap[lo + 1].y < targetY) lo++;

  const a = anchorMap[lo];
  if (lo + 1 >= anchorMap.length) return a.line;

  const b = anchorMap[lo + 1];
  if (b.y === a.y) return a.line;

  const t = (targetY - a.y) / (b.y - a.y);
  return Math.round(a.line + t * (b.line - a.line));
}

// ── Sync state ──────────────────────────────────────────────────────────────

let toPreview = false;  // editor→preview in progress, suppress preview→editor
let toEditor = false;   // preview→editor in progress, suppress editor→preview
let pvTimer = null;
let edTimer = null;

// ── Editor → Preview ────────────────────────────────────────────────────────

function syncEditorToPreview() {
  if (toEditor || anchorMap.length === 0) return;

  const info = cm.getScrollInfo();
  if (info.height - info.clientHeight <= 0) return;
  if (info.top + info.clientHeight >= info.height - 10) return;

  toPreview = true;
  clearTimeout(pvTimer);
  try {
    const centerLine = cm.lineAtHeight(info.top + info.clientHeight / 2, "local");
    const targetY = lineToY(centerLine);
    previewContainer.scrollTop = Math.max(0, targetY - previewContainer.clientHeight / 2);
  } catch (e) { /* ignore */ }
  pvTimer = setTimeout(() => { toPreview = false; }, 80);
}

// ── Preview → Editor ────────────────────────────────────────────────────────

function syncPreviewToEditor() {
  if (toPreview || anchorMap.length === 0) return;

  const previewMax = previewContainer.scrollHeight - previewContainer.clientHeight;
  if (previewMax <= 0) return;
  if (previewContainer.scrollTop + previewContainer.clientHeight >= previewContainer.scrollHeight - 10) return;

  toEditor = true;
  clearTimeout(edTimer);
  try {
    const centerY = previewContainer.scrollTop + previewContainer.clientHeight / 2;
    const line = yToLine(centerY);
    const info = cm.getScrollInfo();
    cm.scrollTo(null, cm.heightAtLine(line, "local") - info.clientHeight / 2);
  } catch (e) { /* ignore */ }
  edTimer = setTimeout(() => { toEditor = false; }, 80);
}

// ── Click preview → set cursor (no scroll) ──────────────────────────────────

export function setupPreviewClick(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener("click", e => {
      let el = e.target;
      while (el && !el.dataset?.sourceLine) el = el.parentElement;
      if (!el) return;
      const line = parseInt(el.dataset.sourceLine, 10);
      if (isNaN(line)) return;
      cm.setCursor({ line, ch: 0 });
      cm.focus();
    });
  } catch (e) { /* ignore */ }
}

// ── Setup ───────────────────────────────────────────────────────────────────

export function setupScrollSync() {
  if (setupScrollSync._done) return;
  setupScrollSync._done = true;

  cm.on("scroll", syncEditorToPreview);
  previewContainer.addEventListener("scroll", syncPreviewToEditor);
  previewContainer.addEventListener("scrollend", () => {
    clearTimeout(pvTimer);
    toPreview = false;
  });
}
