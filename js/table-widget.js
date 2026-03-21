// table-widget.js — Interactive table editing widget

import { cm, status } from './editor.js';
import { triggerRender, clearRenderTimeout, scheduleRender } from './render.js';

// ── Table editing helpers ─────────────────────────────────────────────────────

export function isTableLine(line) { return /^\s*\|/.test(line); }
function isSeparatorLine(line) { return /^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(line); }

// Find table range around a given line (or cursor)
export function getTableRangeAt(lineNum) {
  const line = cm.getLine(lineNum);
  if (!isTableLine(line)) return null;
  let start = lineNum, end = lineNum;
  while (start > 0 && isTableLine(cm.getLine(start - 1))) start--;
  const lastLine = cm.lastLine();
  while (end < lastLine && isTableLine(cm.getLine(end + 1))) end++;
  return { start, end };
}
function parseTable(start, end) {
  const rows = [];
  for (let i = start; i <= end; i++) {
    const line = cm.getLine(i);
    const cells = line.split("|").slice(1);
    if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
    rows.push(cells.map(c => c.trim()));
  }
  return rows;
}

// ── Table editor widgets (always visible, live-synced) ────────────────────────

export const tableWidgets = new Map(); // startHandle → { startHandle, endHandle, widget, wrapper }
const twWrapperMap = new WeakMap(); // wrapper DOM element → tw object
export let twSyncing = false; // prevent cm.on("change") loops during writeback

// Cache for findAllTableRanges
let _tableRangesCache = null;
export let _tableRangesDirty = true;

export function setTableRangesDirty() {
  _tableRangesDirty = true;
}

function findAllTableRanges() {
  if (!_tableRangesDirty && _tableRangesCache !== null) return _tableRangesCache;
  const ranges = [];
  const total = cm.lineCount();
  let i = 0;
  while (i < total) {
    if (isTableLine(cm.getLine(i))) {
      const start = i;
      while (i < total && isTableLine(cm.getLine(i))) i++;
      const end = i - 1;
      let hasSep = false;
      for (let j = start; j <= end; j++) {
        if (isSeparatorLine(cm.getLine(j))) { hasSep = true; break; }
      }
      if (hasSep && end > start) {
        ranges.push({
          start,
          end,
          startHandle: cm.getLineHandle(start),
          endHandle: cm.getLineHandle(end),
        });
      }
    } else { i++; }
  }
  _tableRangesCache = ranges;
  _tableRangesDirty = false;
  return ranges;
}

// Build markdown lines from widget DOM
function widgetToMarkdown(tw) {
  const table = tw.wrapper.querySelector("table");
  if (!table) return null;
  const headerCells = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent);
  const bodyRows = Array.from(table.querySelectorAll("tbody tr")).map(tr =>
    Array.from(tr.querySelectorAll("td")).map(td => td.textContent)
  );
  const colCount = Math.max(headerCells.length, ...bodyRows.map(r => r.length));
  const allRows = [headerCells, null, ...bodyRows];
  const widths = Array(colCount).fill(3);
  allRows.forEach(row => {
    if (!row) return;
    row.forEach((cell, ci) => { widths[ci] = Math.max(widths[ci], (cell || "").length, 3); });
  });
  return allRows.map(row => {
    if (!row) return "| " + widths.map(w => "-".repeat(w)).join(" | ") + " |";
    const cells = [];
    for (let ci = 0; ci < colCount; ci++) cells.push((row[ci] || "").padEnd(widths[ci]));
    return "| " + cells.join(" | ") + " |";
  });
}

// Sync widget DOM → CM text (debounced, no focus disruption)
const twSyncTimers = new WeakMap();
function syncWidgetToCM(tw) {
  clearTimeout(twSyncTimers.get(tw));
  twSyncTimers.set(tw, setTimeout(() => {
    const lines = widgetToMarkdown(tw);
    if (!lines) return;
    twSyncing = true;
    try {
      cm.operation(() => {
        const startLine = cm.getLineNumber(tw.startHandle);
        const endLine = cm.getLineNumber(tw.endHandle);
        if (startLine === null || endLine === null) return;
        const from = { line: startLine, ch: 0 };
        const to = { line: endLine, ch: cm.getLine(endLine).length };
        cm.replaceRange(lines.join("\n"), from, to);
        tw.endHandle = cm.getLineHandle(startLine + lines.length - 1);
        // Re-hide any new lines
        for (let i = startLine; i <= startLine + lines.length - 1; i++) {
          cm.addLineClass(i, "text", "tw-hidden-text");
          cm.addLineClass(i, "gutter", "tw-hidden-gutter");
        }
      });
    } finally {
      twSyncing = false;
    }
  }, 300));
}

function makeCell(tag, text) {
  const el = document.createElement(tag);
  el.contentEditable = "plaintext-only";
  el.spellcheck = false;
  el.textContent = text || "";
  el.addEventListener("keydown", tableWidgetKeydown);
  el.addEventListener("input", onCellInput);
  return el;
}

function onCellInput(e) {
  const tw = findOwnerWidget(e.target);
  if (tw) syncWidgetToCM(tw);
  // Trigger auto-render like normal typing
  clearRenderTimeout();
  status.textContent = "Typing...";
  scheduleRender(800);
}

function findOwnerWidget(el) {
  const wrapper = el.closest(".table-widget");
  if (!wrapper) return null;
  return twWrapperMap.get(wrapper) || null;
}

function createTableWidget(startLine, endLine) {
  const startHandle = cm.getLineHandle(startLine);
  if (tableWidgets.has(startHandle)) return;
  const rows = parseTable(startLine, endLine);
  if (rows.length < 2) return;
  let sepIdx = -1;
  for (let i = startLine; i <= endLine; i++) {
    if (isSeparatorLine(cm.getLine(i))) { sepIdx = i - startLine; break; }
  }
  if (sepIdx < 0) return;
  const headers = rows.slice(0, sepIdx).pop() || [];
  const dataRows = rows.slice(sepIdx + 1);
  const colCount = Math.max(headers.length, ...dataRows.map(r => r.length));

  const wrapper = document.createElement("div");
  wrapper.className = "table-widget";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headTr = document.createElement("tr");
  for (let ci = 0; ci < colCount; ci++) headTr.appendChild(makeCell("th", headers[ci]));
  thead.appendChild(headTr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  dataRows.forEach(row => {
    const tr = document.createElement("tr");
    for (let ci = 0; ci < colCount; ci++) tr.appendChild(makeCell("td", row[ci]));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const tableScroll = document.createElement("div");
  tableScroll.className = "tw-table-scroll";
  tableScroll.appendChild(table);
  wrapper.appendChild(tableScroll);

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "tw-toolbar";
  const hint = document.createElement("span");
  hint.className = "tw-hint";
  hint.textContent = "Tab: navigate · Enter: next row";
  toolbar.appendChild(hint);
  const spacer = document.createElement("span");
  spacer.className = "tw-spacer";
  toolbar.appendChild(spacer);

  const endHandle = cm.getLineHandle(endLine);
  const tw = { startHandle, endHandle, wrapper, widget: null };

  for (const [label, fn] of [
    ["+ Row", () => { widgetAddRow(tw, tbody); syncWidgetToCM(tw); }],
    ["− Row", () => { if (tbody.rows.length > 1) { tbody.deleteRow(tbody.rows.length - 1); syncWidgetToCM(tw); tw.widget?.changed(); } }],
    ["+ Col", () => { widgetAddCol(table); syncWidgetToCM(tw); }],
    ["− Col", () => { widgetDelCol(table); syncWidgetToCM(tw); }],
  ]) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.onclick = fn;
    toolbar.appendChild(btn);
  }
  wrapper.appendChild(toolbar);

  // Hide the raw markdown text (addLineClass "text" targets the <pre>, not the widget)
  for (let i = startLine; i <= endLine; i++) {
    cm.addLineClass(i, "text", "tw-hidden-text");
    cm.addLineClass(i, "gutter", "tw-hidden-gutter");
  }

  // Place the widget above the first table line — it's a sibling of the <pre>, not inside it
  tw.widget = cm.addLineWidget(startLine, wrapper, {
    above: true, noHScroll: false, handleMouseEvents: false
  });

  tableWidgets.set(startHandle, tw);
  twWrapperMap.set(wrapper, tw);
}

export function destroyTableWidget(tw) {
  clearTimeout(twSyncTimers.get(tw));
  if (tw.widget) { try { tw.widget.clear(); } catch(e) {} }
  const startLine = cm.getLineNumber(tw.startHandle);
  const endLine = cm.getLineNumber(tw.endHandle);
  if (startLine !== null && endLine !== null) {
    for (let i = startLine; i <= endLine; i++) {
      try { cm.removeLineClass(i, "text", "tw-hidden-text"); } catch(e) {}
      try { cm.removeLineClass(i, "gutter", "tw-hidden-gutter"); } catch(e) {}
    }
  }
  twWrapperMap.delete(tw.wrapper);
  tableWidgets.delete(tw.startHandle);
}

export function refreshTableWidgets() {
  const ranges = findAllTableRanges();
  const rangeByStartHandle = new Map(ranges.map(r => [r.startHandle, r]));

  // Remove or rebuild stale/changed widgets
  for (const [startHandle, tw] of tableWidgets) {
    const r = rangeByStartHandle.get(startHandle);
    if (!r) {
      // Table no longer exists at this line
      destroyTableWidget(tw);
    } else if (r.endHandle !== tw.endHandle || !widgetMatchesCM(tw)) {
      // Table range changed or content differs (undo/redo) — rebuild
      destroyTableWidget(tw);
    }
  }

  // Create missing widgets (lazy: near viewport)
  const scrollInfo = cm.getScrollInfo();
  const vpTop = cm.lineAtHeight(scrollInfo.top, "local");
  const vpBot = cm.lineAtHeight(scrollInfo.top + scrollInfo.clientHeight, "local");
  const margin = 50;
  for (const r of ranges) {
    if (tableWidgets.has(r.startHandle)) continue;
    if (r.end < vpTop - margin || r.start > vpBot + margin) continue;
    createTableWidget(r.start, r.end);
  }
}

// Check if widget DOM matches the CM text (detect undo/redo changes)
function widgetMatchesCM(tw) {
  const startLine = cm.getLineNumber(tw.startHandle);
  const endLine = cm.getLineNumber(tw.endHandle);
  if (startLine === null || endLine === null) return false;
  const cmRows = parseTable(startLine, endLine);
  const table = tw.wrapper.querySelector("table");
  if (!table) return false;
  const wHeaders = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent);
  const wBody = Array.from(table.querySelectorAll("tbody tr")).map(tr =>
    Array.from(tr.querySelectorAll("td")).map(td => td.textContent)
  );
  // Find separator in CM
  let sepIdx = -1;
  for (let i = startLine; i <= endLine; i++) {
    if (isSeparatorLine(cm.getLine(i))) { sepIdx = i - startLine; break; }
  }
  if (sepIdx < 0) return false;
  const cmHeaders = cmRows.slice(0, sepIdx).pop() || [];
  const cmBody = cmRows.slice(sepIdx + 1);
  // Compare header count and body row count
  if (wHeaders.length !== cmHeaders.length) return false;
  if (wBody.length !== cmBody.length) return false;
  // Compare cell contents
  for (let i = 0; i < wHeaders.length; i++) {
    if (wHeaders[i] !== cmHeaders[i]) return false;
  }
  for (let ri = 0; ri < wBody.length; ri++) {
    if (wBody[ri].length !== cmBody[ri].length) return false;
    for (let ci = 0; ci < wBody[ri].length; ci++) {
      if (wBody[ri][ci] !== cmBody[ri][ci]) return false;
    }
  }
  return true;
}

// Lazy-load on scroll (reuses findAllTableRanges cache)
let twScrollTimer = null;
cm.on("scroll", () => {
  clearTimeout(twScrollTimer);
  twScrollTimer = setTimeout(() => {
    const ranges = findAllTableRanges();
    const scrollInfo = cm.getScrollInfo();
    const vpTop = cm.lineAtHeight(scrollInfo.top, "local");
    const vpBot = cm.lineAtHeight(scrollInfo.top + scrollInfo.clientHeight, "local");
    const margin = 50;
    for (const r of ranges) {
      if (tableWidgets.has(r.startHandle)) continue;
      if (r.end >= vpTop - margin && r.start <= vpBot + margin) createTableWidget(r.start, r.end);
    }
  }, 100);
});

function widgetAddRow(tw, tbody) {
  const colCount = tw.wrapper.querySelector("thead tr").cells.length;
  const tr = document.createElement("tr");
  for (let ci = 0; ci < colCount; ci++) tr.appendChild(makeCell("td", ""));
  tbody.appendChild(tr);
  if (tw.widget) tw.widget.changed();
  tr.cells[0].focus();
}

function widgetAddCol(table) {
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  thead.rows[0].appendChild(makeCell("th", ""));
  for (const tr of tbody.rows) tr.appendChild(makeCell("td", ""));
}

function widgetDelCol(table) {
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  if (thead.rows[0].cells.length <= 1) return;
  const last = thead.rows[0].cells.length - 1;
  thead.rows[0].deleteCell(last);
  for (const tr of tbody.rows) { if (tr.cells.length > last) tr.deleteCell(last); }
}

function tableWidgetKeydown(e) {
  if (e.key === "Tab") {
    e.preventDefault();
    e.stopPropagation();
    const cell = e.target;
    const table = cell.closest("table");
    const allCells = Array.from(table.querySelectorAll("th, td"));
    const idx = allCells.indexOf(cell);
    if (e.shiftKey) {
      if (idx > 0) allCells[idx - 1].focus();
    } else {
      if (idx < allCells.length - 1) {
        allCells[idx + 1].focus();
      } else {
        const tw = findOwnerWidget(cell);
        if (tw) { widgetAddRow(tw, table.querySelector("tbody")); syncWidgetToCM(tw); }
      }
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    cm.focus();
  } else if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const cell = e.target;
    const tr = cell.parentElement;
    const ci = Array.from(tr.cells).indexOf(cell);
    const nextTr = tr.nextElementSibling ||
      (tr.parentElement.tagName === "THEAD" ? tr.closest("table").querySelector("tbody tr") : null);
    if (nextTr && nextTr.cells[ci]) nextTr.cells[ci].focus();
  }
}

// Insert a new table at cursor
export function insertTable() {
  const cursor = cm.getCursor();
  const table = [
    "",
    "| Header 1 | Header 2 | Header 3 |",
    "| --------- | --------- | --------- |",
    "| Cell      | Cell      | Cell      |",
    "| Cell      | Cell      | Cell      |",
    "",
  ].join("\n");
  cm.replaceRange(table, cursor);
  cm.setCursor({ line: cursor.line + 1, ch: 2 });
  setTimeout(refreshTableWidgets, 50);
}

// ── Extra keys: Ctrl+Enter to render, Tab to indent ───────────────────────────

cm.setOption("extraKeys", {
  "Ctrl-Enter": () => { clearRenderTimeout(); triggerRender(); },
  "Cmd-Enter": () => { clearRenderTimeout(); triggerRender(); },
  "Tab": (cm) => { cm.replaceSelection("  "); },
  "Shift-Tab": (cm) => { cm.indentSelection("subtract"); },
});
