// editor-decorations.js — Page break widgets, heading badges, and gutter change markers.
// Extracted from app.js to reduce god-module size.

import { cm } from "./editor.js";
import { computeDiff } from "./diff-merge.js";

// ── Gutter change markers ──────────────────────────────────────────────────

const GUTTER_MODIFIED = "gutter-modified";
const GUTTER_ADDED = "gutter-added";

export function updateGutterMarkers(getActiveTab) {
  const tab = getActiveTab();
  if (!tab) return;

  cm.eachLine((lineHandle) => {
    cm.removeLineClass(lineHandle, "gutter", GUTTER_MODIFIED);
    cm.removeLineClass(lineHandle, "gutter", GUTTER_ADDED);
  });

  const savedLines = (tab.savedContent || "").split("\n");
  const currentLines = cm.getValue().split("\n");
  const diff = computeDiff(savedLines, currentLines);

  const modifiedLines = new Set();
  const addedLines = new Set();

  let i = 0;
  while (i < diff.length) {
    if (diff[i].type === "del") {
      const delStart = i;
      while (i < diff.length && diff[i].type === "del") i++;
      const addStart = i;
      while (i < diff.length && diff[i].type === "add") i++;
      const addEnd = i;
      const delCount = addStart - delStart;
      const addCount = addEnd - addStart;
      const paired = Math.min(delCount, addCount);
      for (let j = 0; j < paired; j++) {
        modifiedLines.add(diff[addStart + j].newLine - 1);
      }
      for (let j = paired; j < addCount; j++) {
        addedLines.add(diff[addStart + j].newLine - 1);
      }
    } else if (diff[i].type === "add") {
      addedLines.add(diff[i].newLine - 1);
      i++;
    } else {
      i++;
    }
  }

  for (const line of modifiedLines) cm.addLineClass(line, "gutter", GUTTER_MODIFIED);
  for (const line of addedLines) cm.addLineClass(line, "gutter", GUTTER_ADDED);
}

// ── Page break decorations (inline replacement, cursor-aware) ─────────────

let _pageBreakMarks = [];
let _pbCursorLine = -1;

function isPageBreakLine(lineNum) {
  const text = cm.getLine(lineNum)?.trim();
  return text === '/newpage' || text === '\\newpage';
}

export function applyPageBreakMarks() {
  const cursorLine = cm.getCursor().line;
  const prevLine = _pbCursorLine;
  _pbCursorLine = cursorLine;
  // Skip rebuild if cursor hasn't moved, or moved between non-pagebreak lines
  if (cursorLine === prevLine) return;
  if (!isPageBreakLine(cursorLine) && !isPageBreakLine(prevLine) && _pageBreakMarks.length > 0) return;

  for (const pm of _pageBreakMarks) pm.mark.clear();
  _pageBreakMarks = [];

  for (let i = 0; i < cm.lineCount(); i++) {
    const text = cm.getLine(i).trim();
    if (text !== '/newpage' && text !== '\\newpage') continue;
    if (i === cursorLine) continue;

    const el = document.createElement("span");
    el.className = "cm-pagebreak-widget";
    el.innerHTML = '<span class="cm-pagebreak-line"></span>'
      + '<span class="cm-pagebreak-label">page break</span>'
      + '<span class="cm-pagebreak-line"></span>'
      + '<button class="cm-pagebreak-delete" title="Remove page break">\u00d7</button>';
    el.querySelector(".cm-pagebreak-delete").addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = i + 1 < cm.lineCount() ? { line: i + 1, ch: 0 } : { line: i, ch: cm.getLine(i).length };
      cm.replaceRange("", { line: i, ch: 0 }, next);
    });

    const lineLen = cm.getLine(i).length;
    const mark = cm.markText(
      { line: i, ch: 0 },
      { line: i, ch: lineLen },
      { replacedWith: el, handleMouseEvents: true },
    );
    _pageBreakMarks.push({ line: i, mark });
  }
}

// ── Heading number badges ────────────────────────────────────────────────────

let _headingMarks = [];
let _cursorLine = -1;

function computeHeadingLabels(getActiveTab) {
  const labels = [];
  let partieNum = 0;
  for (let i = 0; i < cm.lineCount(); i++) {
    const m = cm.getLine(i).match(/^#\s+(?:\d+\.?\s+)?Partie\s+(\d+)/i);
    if (m) { partieNum = parseInt(m[1], 10); break; }
  }
  if (!partieNum) {
    const tab = getActiveTab();
    const fnMatch = tab?.name?.match(/^(\d+)/);
    partieNum = fnMatch ? parseInt(fnMatch[1], 10) : 0;
  }
  if (!partieNum) return labels;

  let h2Count = 0, h3Count = 0;
  for (let i = 0; i < cm.lineCount(); i++) {
    const line = cm.getLine(i);
    const m = line.match(/^(#{1,3}) /);
    if (!m) continue;
    const depth = m[1].length;
    let label = '';
    if (depth === 1) { label = 'P' + partieNum; h2Count = 0; h3Count = 0; }
    else if (depth === 2) { h2Count++; h3Count = 0; label = partieNum + '.' + h2Count; }
    else if (depth === 3) { h3Count++; label = partieNum + '.' + h2Count + '.' + h3Count; }
    if (label) labels.push({ line: i, depth, label, hashLen: m[1].length + 1 });
  }
  return labels;
}

export function applyHeadingMarks(getActiveTab) {
  for (const hm of _headingMarks) hm.mark.clear();
  _headingMarks = [];

  const labels = computeHeadingLabels(getActiveTab);
  const cursorLine = cm.getCursor().line;

  for (const { line, depth, label, hashLen } of labels) {
    if (line === cursorLine) continue;

    const badge = document.createElement("span");
    badge.className = "cm-heading-badge";
    badge.dataset.level = String(depth);
    badge.textContent = label;

    const mark = cm.markText(
      { line, ch: 0 },
      { line, ch: hashLen },
      { replacedWith: badge, handleMouseEvents: true },
    );
    _headingMarks.push({ line, mark });
  }
}

export function getCursorLine() { return _cursorLine; }
export function setCursorLine(line) { _cursorLine = line; }

export function resetPageBreakCache() { _pbCursorLine = -1; }
