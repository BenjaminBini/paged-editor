// table-widget.js — CM6 migration fallback.
// The CM5 line-widget table editor is disabled during the CM6 transition.

import { cm, status as _status } from "./codemirror-editor.js";
const status = _status!;
import { triggerRender, clearRenderTimeout } from "../document/render-scheduler.js";

export function isTableLine(line: string): boolean { return /^\s*\|/.test(line || ""); }

export function getTableRangeAt(lineNum: number): { start: number; end: number } | null {
  const line = cm.getLine(lineNum);
  if (!isTableLine(line)) return null;
  let start = lineNum;
  let end = lineNum;
  while (start > 0 && isTableLine(cm.getLine(start - 1))) start -= 1;
  const lastLine = cm.lastLine();
  while (end < lastLine && isTableLine(cm.getLine(end + 1))) end += 1;
  return { start, end };
}

export const tableWidgets: Map<number, any> = new Map();
export let twSyncing: boolean = false;
export let _tableRangesDirty: boolean = true;

let tableEditorEnabled: boolean = false;

export function setTableRangesDirty(): void {
  _tableRangesDirty = true;
}

export function destroyTableWidget(): void {}

export function toggleTableEditor(): void {
  tableEditorEnabled = !tableEditorEnabled;
  document.getElementById("btnTableEditor")?.classList.toggle("active", tableEditorEnabled);
  status.textContent = tableEditorEnabled
    ? "Live table widget is temporarily unavailable in the CM6 migration"
    : "Table widget disabled";
}

export function refreshTableWidgets(): void {}

export function insertTable(): void {
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
  "Tab": (editor: any) => { editor.replaceSelection("  "); },
  "Shift-Tab": (editor: any) => { editor.indentSelection("subtract"); },
});
