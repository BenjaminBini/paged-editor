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
    if (line == null) continue; // stale line number after doc change/swap
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

// Build markdown lines from widget DOM — uses direct DOM traversal (O(n)) instead of querySelectorAll
function widgetToMarkdown(tw) {
  const table = tw.wrapper.querySelector("table");
  if (!table) return null;
  const thead = table.tHead;
  const tbody = table.tBodies[0];
  if (!thead || !tbody) return null;
  const headRow = thead.rows[0];
  if (!headRow) return null;
  const headerCells = Array.from(headRow.cells).map(th => th.textContent);
  const bodyRows = Array.from(tbody.rows).map(tr =>
    Array.from(tr.cells).map(td => td.textContent)
  );
  const colCount = Math.max(headerCells.length, ...bodyRows.map(r => r.length));
  const allRows = [headerCells, null, ...bodyRows];
  const widths = Array(colCount).fill(3);
  for (const row of allRows) {
    if (!row) continue;
    for (let ci = 0; ci < row.length; ci++) {
      widths[ci] = Math.max(widths[ci], (row[ci] || "").length, 3);
    }
  }
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
  el.addEventListener("focus", () => {
    // Select all text on focus (Tab navigation, click still works naturally)
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
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
  hint.textContent = "Tab: navigate · Enter: next row · Alt+\u2191\u2193: reorder";
  toolbar.appendChild(hint);
  const spacer = document.createElement("span");
  spacer.className = "tw-spacer";
  toolbar.appendChild(spacer);

  const endHandle = cm.getLineHandle(endLine);
  const tw = { startHandle, endHandle, wrapper, widget: null, controls: {}, lastFocused: null };

  wrapper.addEventListener("focusin", (e) => {
    if (e.target?.matches?.("th, td")) {
      tw.lastFocused = getCellPosition(e.target);
    }
    updateToolbarState(tw);
  });
  wrapper.addEventListener("focusout", () => setTimeout(() => updateToolbarState(tw), 0));

  for (const [key, label, title, fn] of [
    ["moveRowUp", "\u2191", "Move row up", () => {
      const state = getToolbarState(tw);
      if (!state.canMoveUp) return;
      widgetMoveRow(tw, tbody, state.row, -1, state.col);
      syncWidgetToCM(tw);
      updateToolbarState(tw);
    }],
    ["moveRowDown", "\u2193", "Move row down", () => {
      const state = getToolbarState(tw);
      if (!state.canMoveDown) return;
      widgetMoveRow(tw, tbody, state.row, 1, state.col);
      syncWidgetToCM(tw);
      updateToolbarState(tw);
    }],
    ["addRow", "+ Row", "Add row after current", () => {
      const state = getToolbarState(tw);
      const afterIdx = state.hasFocusedCell ? (state.inBody ? state.row : -1) : undefined;
      widgetAddRow(tw, tbody, afterIdx, state.col);
      syncWidgetToCM(tw);
      updateToolbarState(tw);
    }],
    ["removeRow", "\u2212 Row", "Remove current row", () => {
      const state = getToolbarState(tw);
      if (!state.canRemoveRow) return;
      widgetDelRow(tw, tbody, state.row, state.col);
      syncWidgetToCM(tw);
      updateToolbarState(tw);
    }],
    ["addCol", "+ Col", "Add column after current", () => {
      const state = getToolbarState(tw);
      widgetAddCol(table, state.hasFocusedCell ? state.col : undefined, state);
      syncWidgetToCM(tw);
      updateToolbarState(tw);
    }],
    ["removeCol", "\u2212 Col", "Remove current column", () => {
      const state = getToolbarState(tw);
      if (!state.canRemoveCol) return;
      widgetDelCol(table, state.col, state);
      syncWidgetToCM(tw);
      updateToolbarState(tw);
    }],
  ]) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.onclick = fn;
    tw.controls[key] = btn;
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
  updateToolbarState(tw);
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

let tableEditorEnabled = true;

export function toggleTableEditor() {
  tableEditorEnabled = !tableEditorEnabled;
  document.getElementById('btnTableEditor')?.classList.toggle('active', tableEditorEnabled);
  if (tableEditorEnabled) {
    refreshTableWidgets();
  } else {
    for (const tw of tableWidgets.values()) destroyTableWidget(tw);
  }
}

export function refreshTableWidgets() {
  if (!tableEditorEnabled) return;
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
  if (!table || !table.tHead || !table.tBodies[0]) return false;
  const wHeaders = Array.from(table.tHead.rows[0].cells).map(th => th.textContent);
  const wBody = Array.from(table.tBodies[0].rows).map(tr =>
    Array.from(tr.cells).map(td => td.textContent)
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
  if (!tableEditorEnabled) return;
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

// Get the active cell's position within the table widget
function getActivePosition(tw) {
  const active = tw.wrapper.querySelector("th:focus, td:focus");
  if (active) {
    const position = getCellPosition(active);
    tw.lastFocused = position;
    return { ...position, cell: active };
  }
  if (tw.wrapper.contains(document.activeElement) && tw.lastFocused) {
    return { ...tw.lastFocused, cell: null };
  }
  return { row: null, col: null, inBody: false, cell: null };
}

function getCellPosition(cell) {
  const tr = cell.parentElement;
  const col = Array.from(tr.cells).indexOf(cell);
  const inBody = tr.parentElement.tagName === "TBODY";
  const row = inBody ? Array.from(tr.parentElement.rows).indexOf(tr) : -1;
  return { row, col, inBody };
}

function setLastFocusedPosition(tw, position) {
  if (!tw || position?.col == null || position.col < 0) return;
  tw.lastFocused = {
    row: position.inBody ? position.row : -1,
    col: position.col,
    inBody: !!position.inBody,
  };
}

function getToolbarState(tw) {
  const position = getActivePosition(tw);
  const table = tw.wrapper.querySelector("table");
  const tbody = table?.querySelector("tbody");
  const colCount = table?.querySelector("thead tr")?.cells.length ?? 0;
  const bodyRowCount = tbody?.rows.length ?? 0;
  const hasFocusedCell = position.col != null && position.col >= 0;
  const hasFocusedBodyRow = position.inBody && position.row != null && position.row >= 0;
  return {
    ...position,
    bodyRowCount,
    colCount,
    hasFocusedCell,
    hasFocusedBodyRow,
    canMoveUp: hasFocusedBodyRow && position.row > 0,
    canMoveDown: hasFocusedBodyRow && position.row < bodyRowCount - 1,
    canRemoveRow: hasFocusedBodyRow && bodyRowCount > 1,
    canRemoveCol: hasFocusedCell && colCount > 1,
  };
}

function updateToolbarState(tw) {
  const state = getToolbarState(tw);
  if (tw.controls.moveRowUp) tw.controls.moveRowUp.disabled = !state.canMoveUp;
  if (tw.controls.moveRowDown) tw.controls.moveRowDown.disabled = !state.canMoveDown;
  if (tw.controls.removeRow) tw.controls.removeRow.disabled = !state.canRemoveRow;
  if (tw.controls.removeCol) tw.controls.removeCol.disabled = !state.canRemoveCol;
}

function getRowInsertReference(tbody, afterIdx) {
  if (!tbody?.rows.length) return null;
  if (afterIdx === -1) return tbody.rows[0];
  if (afterIdx != null && afterIdx >= 0 && afterIdx < tbody.rows.length) return tbody.rows[afterIdx];
  return tbody.rows[tbody.rows.length - 1];
}

function clampCellIndex(colCount, colIdx) {
  if (!colCount) return 0;
  if (colIdx == null || colIdx < 0) return 0;
  return Math.min(colIdx, colCount - 1);
}

function widgetAddRow(tw, tbody, afterIdx, focusCol) {
  const colCount = tw.wrapper.querySelector("thead tr").cells.length;
  const referenceRow = getRowInsertReference(tbody, afterIdx);
  const referenceHeight = referenceRow?.cells[0]?.getBoundingClientRect().height ?? 0;
  let insertedRowIdx = tbody.rows.length;
  const tr = document.createElement("tr");
  for (let ci = 0; ci < colCount; ci++) {
    const td = makeCell("td", "");
    if (referenceHeight > 0) td.style.height = `${Math.ceil(referenceHeight)}px`;
    tr.appendChild(td);
  }
  if (afterIdx === -1 && tbody.rows.length) {
    tbody.insertBefore(tr, tbody.rows[0]);
    insertedRowIdx = 0;
  } else if (afterIdx != null && afterIdx >= 0 && afterIdx < tbody.rows.length) {
    tbody.rows[afterIdx].after(tr);
    insertedRowIdx = afterIdx + 1;
  } else {
    tbody.appendChild(tr);
    insertedRowIdx = tbody.rows.length - 1;
  }
  if (tw.widget) tw.widget.changed();
  const nextCol = clampCellIndex(colCount, focusCol);
  setLastFocusedPosition(tw, { row: insertedRowIdx, col: nextCol, inBody: true });
  tr.cells[nextCol]?.focus();
}

function widgetDelRow(tw, tbody, rowIdx, focusCol) {
  if (tbody.rows.length <= 1) return;
  const idx = rowIdx != null ? rowIdx : tbody.rows.length - 1;
  if (idx < 0 || idx >= tbody.rows.length) return;
  tbody.deleteRow(idx);
  if (tw.widget) tw.widget.changed();
  // Focus nearest row
  const focusIdx = Math.min(idx, tbody.rows.length - 1);
  const colCount = tbody.rows[focusIdx]?.cells.length ?? 0;
  const colIdx = clampCellIndex(colCount, focusCol);
  setLastFocusedPosition(tw, { row: focusIdx, col: colIdx, inBody: true });
  tbody.rows[focusIdx]?.cells[colIdx]?.focus();
}

function widgetAddCol(table, afterIdx, focusState) {
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  const insertAt = afterIdx != null ? afterIdx + 1 : thead.rows[0].cells.length;
  const headRow = thead.rows[0];
  const newTh = makeCell("th", "");
  if (insertAt >= headRow.cells.length) {
    headRow.appendChild(newTh);
  } else {
    headRow.insertBefore(newTh, headRow.cells[insertAt]);
  }
  for (const tr of tbody.rows) {
    const newTd = makeCell("td", "");
    if (insertAt >= tr.cells.length) {
      tr.appendChild(newTd);
    } else {
      tr.insertBefore(newTd, tr.cells[insertAt]);
    }
  }
  const focusRow = focusState?.hasFocusedBodyRow ? tbody.rows[focusState.row] : headRow;
  const tw = findOwnerWidget(table);
  const nextCol = clampCellIndex(focusRow?.cells.length ?? 0, insertAt);
  setLastFocusedPosition(tw, {
    row: focusState?.hasFocusedBodyRow ? focusState.row : -1,
    col: nextCol,
    inBody: !!focusState?.hasFocusedBodyRow,
  });
  focusRow?.cells[nextCol]?.focus();
  if (tw?.widget) tw.widget.changed();
}

function widgetDelCol(table, colIdx, focusState) {
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  if (thead.rows[0].cells.length <= 1) return;
  const idx = colIdx != null ? colIdx : thead.rows[0].cells.length - 1;
  if (idx < 0 || idx >= thead.rows[0].cells.length) return;
  thead.rows[0].deleteCell(idx);
  for (const tr of tbody.rows) { if (tr.cells.length > idx) tr.deleteCell(idx); }
  const nextCol = clampCellIndex(thead.rows[0].cells.length, Math.min(idx, thead.rows[0].cells.length - 1));
  const focusRow = focusState?.hasFocusedBodyRow ? tbody.rows[focusState.row] : thead.rows[0];
  const tw = findOwnerWidget(table);
  setLastFocusedPosition(tw, {
    row: focusState?.hasFocusedBodyRow ? focusState.row : -1,
    col: nextCol,
    inBody: !!focusState?.hasFocusedBodyRow,
  });
  focusRow?.cells[nextCol]?.focus();
  if (tw?.widget) tw.widget.changed();
}

function widgetMoveRow(tw, tbody, fromIdx, direction, focusCol) {
  const toIdx = fromIdx + direction;
  if (fromIdx < 0 || fromIdx >= tbody.rows.length) return;
  if (toIdx < 0 || toIdx >= tbody.rows.length) return;
  const row = tbody.rows[fromIdx];
  if (direction < 0) {
    tbody.insertBefore(row, tbody.rows[toIdx]);
  } else {
    tbody.rows[toIdx].after(row);
  }
  if (tw.widget) tw.widget.changed();
  // Keep focus on the moved row
  const nextCol = clampCellIndex(row.cells.length, focusCol);
  setLastFocusedPosition(tw, { row: toIdx, col: nextCol, inBody: true });
  row.cells[nextCol]?.focus();
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
        if (tw) {
          const state = getToolbarState(tw);
          const afterIdx = state.hasFocusedCell ? (state.inBody ? state.row : -1) : undefined;
          widgetAddRow(tw, table.querySelector("tbody"), afterIdx, state.col);
          syncWidgetToCM(tw);
          updateToolbarState(tw);
        }
      }
    }
  } else if (e.key === "ArrowUp" && e.altKey) {
    e.preventDefault();
    const cell = e.target;
    const tw = findOwnerWidget(cell);
    if (tw) {
      const state = getToolbarState(tw);
      if (state.canMoveUp) {
        widgetMoveRow(tw, cell.closest("table").querySelector("tbody"), state.row, -1, state.col);
        syncWidgetToCM(tw);
        updateToolbarState(tw);
      }
    }
  } else if (e.key === "ArrowDown" && e.altKey) {
    e.preventDefault();
    const cell = e.target;
    const tw = findOwnerWidget(cell);
    if (tw) {
      const state = getToolbarState(tw);
      if (state.canMoveDown) {
        widgetMoveRow(tw, cell.closest("table").querySelector("tbody"), state.row, 1, state.col);
        syncWidgetToCM(tw);
        updateToolbarState(tw);
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
