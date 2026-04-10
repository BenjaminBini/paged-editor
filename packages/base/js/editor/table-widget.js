// table-widget.js — CM6 migration fallback.
// The CM5 line-widget table editor is disabled during the CM6 transition.

import { cm, status } from "./editor.js";
import { triggerRender, clearRenderTimeout } from "../preview/render.js";

export function isTableLine(line) { return /^\s*\|/.test(line || ""); }

export function getTableRangeAt(lineNum) {
  const line = cm.getLine(lineNum);
  if (!isTableLine(line)) return null;
  let start = lineNum;
  let end = lineNum;
  while (start > 0 && isTableLine(cm.getLine(start - 1))) start -= 1;
  const lastLine = cm.lastLine();
  while (end < lastLine && isTableLine(cm.getLine(end + 1))) end += 1;
  return { start, end };
}

export const tableWidgets = new Map();
export let twSyncing = false;
export let _tableRangesDirty = true;

let tableEditorEnabled = false;

export function setTableRangesDirty() {
  _tableRangesDirty = true;
}

export function destroyTableWidget() {}

export function toggleTableEditor() {
  tableEditorEnabled = !tableEditorEnabled;
  document.getElementById("btnTableEditor")?.classList.toggle("active", tableEditorEnabled);
  status.textContent = tableEditorEnabled
    ? "Live table widget is temporarily unavailable in the CM6 migration"
    : "Table widget disabled";
}

export function refreshTableWidgets() {}

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
  clearRenderTimeout();
  triggerRender();
}

cm.setOption("extraKeys", {
  "Ctrl-Enter": () => { clearRenderTimeout(); triggerRender(); },
  "Cmd-Enter": () => { clearRenderTimeout(); triggerRender(); },
  "Tab": (editor) => { editor.replaceSelection("  "); },
  "Shift-Tab": (editor) => { editor.indentSelection("subtract"); },
});
