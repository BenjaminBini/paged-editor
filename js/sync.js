// sync.js — Source-line-based scroll synchronization
// Uses data-source-line attributes injected during markdown rendering
// to build an anchor map for O(log n) bidirectional scroll sync.

import { cm, previewContainer } from './editor.js';
import { getSectionStates, getPreviewScale } from './render.js';

// ── Anchor map ──────────────────────────────────────────────────────────────
// Sorted array of {line, el, frame, y} built after each section render.

let anchorMap = []; // [{line: number, el: Element, frame: HTMLIFrameElement, y: number}]

function computeElementY(el, frame) {
  const scale = getPreviewScale();
  const wrapper = frame.closest('.section-wrapper');
  if (!wrapper) return 0;

  const elRect = el.getBoundingClientRect();
  const doc = frame.contentDocument;
  const pages = doc?.querySelector('.pagedjs_pages');
  const refRect = (pages || doc.body).getBoundingClientRect();

  // Y of element midpoint within the (unscaled) iframe content
  const yInIframe = elRect.top - refRect.top + elRect.height / 2;

  // Scale and add wrapper offset within preview container
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
        const y = computeElementY(el, frame);
        anchorMap.push({ line, el, frame, y });
      }
    } catch (e) { /* iframe not ready */ }
  }

  anchorMap.sort((a, b) => a.line - b.line);
}

// ── Binary search helpers ───────────────────────────────────────────────────

function findClosestByLine(targetLine) {
  if (anchorMap.length === 0) return -1;
  let lo = 0, hi = anchorMap.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (anchorMap[mid].line < targetLine) lo = mid + 1;
    else hi = mid;
  }
  // lo is the first anchor with line >= targetLine; check lo-1 too
  if (lo > 0 && Math.abs(anchorMap[lo - 1].line - targetLine) <= Math.abs(anchorMap[lo].line - targetLine)) {
    return lo - 1;
  }
  return lo;
}

function findClosestByY(targetY) {
  if (anchorMap.length === 0) return -1;
  // Anchor map is sorted by line, not Y, but Y is generally monotonic.
  // Use linear scan — still fast for typical document sizes.
  let bestIdx = 0, bestDist = Math.abs(anchorMap[0].y - targetY);
  for (let i = 1; i < anchorMap.length; i++) {
    const dist = Math.abs(anchorMap[i].y - targetY);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

function interpolateY(targetLine) {
  if (anchorMap.length === 0) return 0;
  const idx = findClosestByLine(targetLine);
  const a = anchorMap[idx];

  if (a.line === targetLine || anchorMap.length === 1) return a.y;

  // Interpolate between two surrounding anchors
  let prev, next;
  if (a.line < targetLine && idx + 1 < anchorMap.length) {
    prev = a; next = anchorMap[idx + 1];
  } else if (a.line > targetLine && idx > 0) {
    prev = anchorMap[idx - 1]; next = a;
  } else {
    return a.y;
  }

  const t = (targetLine - prev.line) / Math.max(1, next.line - prev.line);
  return prev.y + t * (next.y - prev.y);
}

// ── Sync state ──────────────────────────────────────────────────────────────

let toPreviewSync = false;
let toEditorSync = false;
let pvSyncTimer = null;

// ── Highlight state ─────────────────────────────────────────────────────────

let highlightEl = null;
let flashTimer = null;
let gutterHighlightLine = null;

function clearPreviewHighlight() {
  if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
  if (highlightEl) {
    highlightEl.classList.remove("paged-highlight", "paged-highlight-flash");
    highlightEl = null;
  }
}

function setPreviewHighlight(el, flash) {
  clearPreviewHighlight();
  if (!el) return;
  if (flash) {
    el.classList.add("paged-highlight-flash");
    highlightEl = el;
    flashTimer = setTimeout(() => {
      el.classList.remove("paged-highlight-flash");
      el.classList.add("paged-highlight");
    }, 50);
  } else {
    el.classList.add("paged-highlight");
    highlightEl = el;
  }
}

function setGutterHighlight(line) {
  if (gutterHighlightLine !== null && gutterHighlightLine !== line) {
    cm.removeLineClass(gutterHighlightLine, "gutter", "cm-cursor-gutter");
  }
  if (line != null && gutterHighlightLine !== line) {
    cm.addLineClass(line, "gutter", "cm-cursor-gutter");
  }
  gutterHighlightLine = line;
}

// ── Editor → Preview sync ───────────────────────────────────────────────────

function syncEditorToPreview() {
  if (toEditorSync || anchorMap.length === 0) return;
  try {
    const info = cm.getScrollInfo();
    const centerLine = cm.lineAtHeight(info.top + info.clientHeight / 2, "local");

    const targetY = interpolateY(centerLine);
    const scrollTop = Math.max(0, targetY - previewContainer.clientHeight / 2);

    toPreviewSync = true;
    previewContainer.scrollTo({ top: scrollTop });
    clearTimeout(pvSyncTimer);
    pvSyncTimer = setTimeout(() => { toPreviewSync = false; }, 150);

    // Highlight closest anchor
    const idx = findClosestByLine(centerLine);
    if (idx >= 0) {
      setGutterHighlight(centerLine);
      setPreviewHighlight(anchorMap[idx].el, false);
    }
  } catch (e) { console.warn("sync editor→preview failed", e); }
}

// ── Preview → Editor sync ───────────────────────────────────────────────────

function syncPreviewToEditor() {
  if (toPreviewSync || anchorMap.length === 0) return;
  try {
    const centerY = previewContainer.scrollTop + previewContainer.clientHeight / 2;
    const idx = findClosestByY(centerY);
    if (idx < 0) return;

    const anchor = anchorMap[idx];
    setPreviewHighlight(anchor.el, false);
    setGutterHighlight(anchor.line);

    toEditorSync = true;
    cm.scrollIntoView({ line: anchor.line, ch: 0 }, cm.getScrollInfo().clientHeight / 2);
    requestAnimationFrame(() => { toEditorSync = false; });
  } catch (e) { console.warn("sync preview→editor failed", e); }
}

// ── Highlight on cursor activity ────────────────────────────────────────────

export function highlightAtCursor() {
  try {
    const cursorLine = cm.getCursor().line;
    setGutterHighlight(cursorLine);

    const idx = findClosestByLine(cursorLine);
    if (idx >= 0 && Math.abs(anchorMap[idx].line - cursorLine) <= 3) {
      setPreviewHighlight(anchorMap[idx].el, true);
    } else {
      clearPreviewHighlight();
    }
  } catch (e) { console.warn("highlightAtCursor failed", e); }
}

let _highlightDebTimer = null;
cm.on("cursorActivity", () => {
  clearTimeout(_highlightDebTimer);
  _highlightDebTimer = setTimeout(highlightAtCursor, 80);
});

// ── Click preview → navigate editor ─────────────────────────────────────────

export function setupPreviewClick(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener("click", e => {
      let el = e.target;
      // Walk up to nearest element with data-source-line
      while (el && !el.dataset?.sourceLine) el = el.parentElement;
      if (!el) return;

      const line = parseInt(el.dataset.sourceLine, 10);
      if (isNaN(line)) return;

      setPreviewHighlight(el, true);
      setGutterHighlight(line);
      cm.setCursor({ line, ch: 0 });
      cm.focus();

      toEditorSync = true;
      cm.scrollIntoView({ line, ch: 0 }, cm.getScrollInfo().clientHeight / 2);
      requestAnimationFrame(() => { toEditorSync = false; });
    });
  } catch (e) { console.warn("setupPreviewClick failed", e); }
}

// ── Scroll sync setup ───────────────────────────────────────────────────────

export function setupScrollSync() {
  if (setupScrollSync._done) return;
  setupScrollSync._done = true;

  // Clear toPreviewSync when scroll animation ends
  previewContainer.addEventListener("scrollend", () => {
    clearTimeout(pvSyncTimer);
    pvSyncTimer = null;
    toPreviewSync = false;
  });

  cm.on("scroll", () => {
    if (toEditorSync) return;
    syncEditorToPreview();
  });

  previewContainer.addEventListener("scroll", () => {
    if (toPreviewSync) return;
    syncPreviewToEditor();
  });
}
