// sync.js — Scroll synchronization, highlight, and click-to-navigate module
// Updated for multi-iframe section-based rendering.
// Sync is scoped per-section to avoid cross-section jumps on duplicate text.

import { cm, previewContainer } from './editor.js';
import { getSectionFrames } from './render.js';

// ── Shared sync utilities ─────────────────────────────────────────────────────

export const BLOCK_SEL =
  ".pdf-content h1,.pdf-content h2,.pdf-content h3,.pdf-content h4," +
  ".pdf-content p,.pdf-content li,.pdf-content blockquote," +
  ".pdf-content pre,.pdf-content td,.pdf-content th";

// Cover sections don't have .pdf-content, so also match cover elements
const COVER_BLOCK_SEL =
  ".beorn-cover-title,.beorn-cover-doctype,.beorn-toc-title";

export const normalizeText = s => s
  .replace(/[#*_`>\-|]/g, "")   // strip markdown formatting
  .replace(/^\d+\.\s+/, "")     // strip ordered list markers (1. 2. etc.)
  .replace(/\s+/g, " ")
  .trim()
  .substring(0, 80);

// ── Section boundary mapping ──────────────────────────────────────────────────
// Maps editor line numbers to section indices (matching render.js splitting).
// Section 0 = cover (frontmatter), sections 1+ = content chunks split at # and /newpage.

function buildSectionBoundaries() {
  const boundaries = []; // [{startLine, endLine}] indexed by section index
  let fmEnd = 0;

  // Find frontmatter end
  const lineCount = cm.lineCount();
  if (cm.getLine(0)?.trim() === '---') {
    for (let i = 1; i < lineCount; i++) {
      if (cm.getLine(i)?.trim() === '---') {
        fmEnd = i + 1;
        break;
      }
    }
  }

  // Section 0: cover = frontmatter lines
  boundaries.push({ startLine: 0, endLine: fmEnd });

  // Walk lines after frontmatter to find section splits
  let sectionStart = fmEnd;
  let foundFirstH1 = false;

  for (let i = fmEnd; i < lineCount; i++) {
    const line = cm.getLine(i);
    const trimmed = line?.trim();

    if (/^# /.test(line)) {
      if (foundFirstH1 && i > sectionStart) {
        // Skip "Page de garde" to match render.js splitMarkdownSections
        const prevTitle = cm.getLine(sectionStart)?.match(/^# (.+)/)?.[1]?.trim() || '';
        if (!/^page de garde$/i.test(prevTitle)) {
          boundaries.push({ startLine: sectionStart, endLine: i });
        }
      }
      foundFirstH1 = true;
      sectionStart = i;
    } else if (foundFirstH1 && (trimmed === '/newpage' || trimmed === '\\newpage')) {
      if (i > sectionStart) {
        boundaries.push({ startLine: sectionStart, endLine: i });
      }
      sectionStart = i + 1; // skip the /newpage line itself
    }
  }
  // Last section (skip if "Page de garde")
  if (foundFirstH1 && sectionStart < lineCount) {
    const lastTitle = cm.getLine(sectionStart)?.match(/^# (.+)/)?.[1]?.trim() || '';
    if (!/^page de garde$/i.test(lastTitle)) {
      boundaries.push({ startLine: sectionStart, endLine: lineCount });
    }
  }

  return boundaries;
}

function sectionIndexForLine(line) {
  const bounds = buildSectionBoundaries();
  for (let i = bounds.length - 1; i >= 0; i--) {
    if (line >= bounds[i].startLine) return i;
  }
  return 0;
}

// ── Subsection scoping (h1–h4) ────────────────────────────────────────────────
// Finds the finest-grained heading subsection containing a given editor line.

function getEditorSubsection(line) {
  // Scan backwards for nearest heading (any level)
  for (let i = line; i >= 0; i--) {
    const m = cm.getLine(i)?.match(/^(#{1,4}) (.+)/);
    if (m) {
      const headingLevel = m[1].length;
      const headingText = m[2].trim();
      // Scan forward for end: next heading of same or higher level
      let endLine = cm.lineCount();
      for (let j = i + 1; j < cm.lineCount(); j++) {
        const mj = cm.getLine(j)?.match(/^(#{1,4}) /);
        if (mj && mj[1].length <= headingLevel) { endLine = j; break; }
      }
      return { startLine: i, endLine, headingText, headingLevel };
    }
  }
  return null;
}

// Find the nearest heading preceding a preview element (in document order).
function getPreviewElSubsection(el) {
  const doc = el.ownerDocument;
  if (!doc) return null;
  const allEls = doc.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre,td,th');
  let headingText = null, headingLevel = 0;
  for (const e of allEls) {
    if (e === el) break;
    if (/^H[1-4]$/i.test(e.tagName)) {
      headingText = normalizeText(e.textContent || '');
      headingLevel = parseInt(e.tagName[1]);
    }
  }
  if (!headingText || headingText.length < 4) return null;
  return { headingText, headingLevel };
}

// ── Find preview element scoped to subsection ─────────────────────────────────
// If subsection info is given, only match elements under that heading in the iframe.

export function findPreviewEl(text, sectionIdx, subsection) {
  try {
    const needle = normalizeText(text);
    if (needle.length < 4) return null;

    const frames = getSectionFrames();
    const searchFrames = (sectionIdx != null && frames[sectionIdx])
      ? [frames[sectionIdx]]
      : frames;

    // If subsection is given, do a document-order walk scoped to that heading
    if (subsection) {
      const headingNeedle = normalizeText(subsection.headingText);
      for (const frame of searchFrames) {
        const doc = frame.contentDocument;
        if (!doc) continue;
        const allEls = doc.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre,td,th');
        let inTarget = false;
        let best = null, bestScore = 0;
        for (const el of allEls) {
          if (/^H[1-4]$/i.test(el.tagName)) {
            const level = parseInt(el.tagName[1]);
            if (level <= subsection.headingLevel) {
              // Same or higher level heading — enters target only if it matches
              const ht = normalizeText(el.textContent || '');
              inTarget = ht.length >= 4 && (ht.includes(headingNeedle) || headingNeedle.includes(ht));
            }
            // Fall through — headings are also match candidates
          }
          if (!inTarget) continue;
          const t = normalizeText(el.textContent || '');
          if (!t) continue;
          if (t.includes(needle) || needle.includes(t)) {
            const score = Math.min(needle.length, t.length);
            if (score > bestScore) { bestScore = score; best = el; }
          }
        }
        if (best) return best;
      }
      return null;
    }

    // Fallback: search all elements in the target iframe(s)
    let best = null, bestScore = 0;
    for (const frame of searchFrames) {
      const doc = frame.contentDocument;
      if (!doc) continue;
      const sel = BLOCK_SEL + "," + COVER_BLOCK_SEL;
      doc.querySelectorAll(sel).forEach(el => {
        const t = normalizeText(el.textContent || "");
        if (!t) return;
        if (t.includes(needle) || needle.includes(t)) {
          const score = Math.min(needle.length, t.length);
          if (score > bestScore) { bestScore = score; best = el; }
        }
      });
    }
    return best;
  } catch(e) { return null; }
}

// ── Find editor line scoped to subsection line range ──────────────────────────

export function findEditorLine(text, bounds) {
  const needle = normalizeText(text);
  if (needle.length < 4) return -1;
  let best = -1, bestScore = 0;
  const start = bounds?.startLine ?? 0;
  const end = bounds?.endLine ?? cm.lineCount();
  for (let i = start; i < end; i++) {
    const t = normalizeText(cm.getLine(i));
    if (!t) continue;
    if (t.includes(needle) || needle.includes(t)) {
      const score = Math.min(needle.length, t.length);
      if (score > bestScore) { bestScore = score; best = i; }
    }
  }
  return best;
}

// ── Preview element vertical position ─────────────────────────────────────────

// Scaled vertical midpoint of a preview element relative to previewContainer.
// Accounts for the element's section iframe position within the wrapper.
function previewElMid(el) {
  for (const frame of getSectionFrames()) {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.contains(el)) continue;

      const pages = doc.querySelector(".pagedjs_pages");
      if (!pages) return 0;

      const scale = parseFloat(frame.style.transform.replace(/[^0-9.]/g, "")) || 1;
      const rect = el.getBoundingClientRect();
      const pRect = pages.getBoundingClientRect();
      const posInIframe = (rect.top - pRect.top + rect.height / 2) * scale;

      // Wrapper position relative to scroll container's content area
      const wrapper = frame.closest('.section-wrapper');
      if (!wrapper) return posInIframe;
      const containerRect = previewContainer.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const wrapperOffset = wrapperRect.top - containerRect.top + previewContainer.scrollTop;
      return wrapperOffset + posInIframe;
    } catch(e) {}
  }
  return 0;
}

// Two directional flags: each side suppresses only its own echo
let toPreviewSync = false; // preview is being scrolled by us → suppress preview→editor
let toEditorSync  = false; // editor  is being scrolled by us → suppress editor→preview
let pvSyncTimer   = null;  // single shared timer, reset on every centerPreviewOnEl call

// Center a preview element in the preview pane (instant — smooth causes sync loops)
function centerPreviewOnEl(el) {
  const top = Math.max(0, previewElMid(el) - previewContainer.clientHeight / 2);
  toPreviewSync = true;
  previewContainer.scrollTo({ top });
  clearTimeout(pvSyncTimer);
  pvSyncTimer = setTimeout(() => { toPreviewSync = false; }, 100);
}

// Center an editor line in the editor pane (instant — no smooth scroll API in CM)
function centerEditorOnLine(line) {
  toEditorSync = true;
  cm.scrollIntoView({ line, ch: 0 }, cm.getScrollInfo().clientHeight / 2);
  requestAnimationFrame(() => { toEditorSync = false; });
}

// Element closest to the vertical center of the preview pane (across all iframes)
function previewCenterEl() {
  try {
    const center = previewContainer.scrollTop + previewContainer.clientHeight / 2;
    let best = null, bestDist = Infinity;

    for (const frame of getSectionFrames()) {
      const doc = frame.contentDocument;
      if (!doc) continue;
      const sel = BLOCK_SEL + "," + COVER_BLOCK_SEL;
      doc.querySelectorAll(sel).forEach(el => {
        const dist = Math.abs(previewElMid(el) - center);
        if (dist < bestDist) { bestDist = dist; best = el; }
      });
    }
    return best;
  } catch(e) { return null; }
}

// Which section iframe contains this element?
function sectionIndexOfEl(el) {
  const frames = getSectionFrames();
  for (let i = 0; i < frames.length; i++) {
    try {
      if (frames[i].contentDocument?.contains(el)) return i;
    } catch(e) {}
  }
  return -1;
}

// ── Highlight state ───────────────────────────────────────────────────────────

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

// ── Highlight + center sync on cursor activity ────────────────────────────────

export function highlightAtCursor() {
  try {
    const cursorLine = cm.getCursor().line;
    setGutterHighlight(cursorLine);

    // Update preview highlight — scoped to the current subsection
    // Does NOT scroll the preview — sync is scroll-driven only
    const text = cm.getLine(cursorLine)?.trim();
    if (!text) { clearPreviewHighlight(); return; }
    const secIdx = sectionIndexForLine(cursorLine);
    const sub = getEditorSubsection(cursorLine);
    const el = findPreviewEl(text, secIdx, sub);
    setPreviewHighlight(el, true);
  } catch(e) { console.warn("highlightAtCursor failed", e); }
}

let _highlightDebTimer = null;
cm.on("cursorActivity", () => {
  clearTimeout(_highlightDebTimer);
  _highlightDebTimer = setTimeout(highlightAtCursor, 80);
});

// ── Click preview → center both views ────────────────────────────────────────

export function setupPreviewClick(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener("click", e => {
      let el = e.target;
      const blockTags = new Set(["H1","H2","H3","H4","P","LI","BLOCKQUOTE","PRE","TD","TH"]);
      while (el && !blockTags.has(el.tagName)) el = el.parentElement;
      if (!el) return;
      const needle = normalizeText(el.textContent || "");
      if (needle.length < 4) return;

      setPreviewHighlight(el, true);
      centerPreviewOnEl(el);
      // Scope editor search to the subsection that was clicked
      const secIdx = sectionIndexOfEl(el);
      let editorBounds = buildSectionBoundaries()[secIdx];
      const previewSub = getPreviewElSubsection(el);
      if (previewSub) {
        const headingLine = findEditorLine(previewSub.headingText, editorBounds);
        if (headingLine >= 0) {
          const sub = getEditorSubsection(headingLine);
          if (sub) editorBounds = sub;
        }
      }
      const line = findEditorLine(needle, editorBounds);
      if (line >= 0) {
        setGutterHighlight(line);
        cm.setCursor({ line, ch: 0 });
        cm.focus();
        centerEditorOnLine(line);
      }
    });
  } catch(e) { console.warn("setupPreviewClick failed", e); }
}

// ── Scroll sync (center-element based, both directions) ───────────────────────

export function setupScrollSync() {
  if (setupScrollSync._done) return;
  setupScrollSync._done = true;

  // Clear toPreviewSync exactly when the smooth scroll animation ends
  previewContainer.addEventListener("scrollend", () => {
    clearTimeout(pvSyncTimer);
    pvSyncTimer = null;
    toPreviewSync = false;
  });

  // Editor scrolled by user → center matching element in preview (same section only)
  cm.on("scroll", () => {
    if (toEditorSync) return;
    try {
      const info = cm.getScrollInfo();
      const centerLine = cm.lineAtHeight(info.top + info.clientHeight / 2, "local");
      // Find nearest non-empty line around the center
      let line = centerLine, text = '';
      const maxSearch = 10;
      for (let d = 0; d <= maxSearch; d++) {
        if (centerLine + d < cm.lineCount()) {
          text = cm.getLine(centerLine + d)?.trim();
          if (text && normalizeText(text).length >= 4) { line = centerLine + d; break; }
        }
        if (d > 0 && centerLine - d >= 0) {
          text = cm.getLine(centerLine - d)?.trim();
          if (text && normalizeText(text).length >= 4) { line = centerLine - d; break; }
        }
        text = '';
      }
      if (text) {
        const secIdx = sectionIndexForLine(line);
        const sub = getEditorSubsection(line);
        const el = findPreviewEl(text, secIdx, sub);
        setGutterHighlight(line);
        setPreviewHighlight(el, false);
        if (el) centerPreviewOnEl(el);
      }
    } catch(e) { console.warn("scroll sync (editor) failed", e); }
  });

  // Preview scrolled by user → center matching line in editor (same section only)
  previewContainer.addEventListener("scroll", () => {
    if (toPreviewSync) return;
    try {
      const el = previewCenterEl();
      if (el) {
        // Find the subsection in the preview, then match to editor line range
        const secIdx = sectionIndexOfEl(el);
        const previewSub = getPreviewElSubsection(el);
        let editorBounds = buildSectionBoundaries()[secIdx];
        if (previewSub) {
          // Find the matching heading in the editor and use its subsection bounds
          const headingLine = findEditorLine(previewSub.headingText, editorBounds);
          if (headingLine >= 0) {
            const sub = getEditorSubsection(headingLine);
            if (sub) editorBounds = sub;
          }
        }
        const line = findEditorLine(el.textContent || "", editorBounds);
        setPreviewHighlight(el, false);
        if (line >= 0) {
          setGutterHighlight(line);
          centerEditorOnLine(line);
        }
      }
    } catch(e) { console.warn("scroll sync (preview) failed", e); }
  });
}
