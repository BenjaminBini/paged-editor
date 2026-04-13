// file-manager.js — file I/O and folder management (pure I/O, no tab state)

import { cm } from '../../editor/codemirror-editor.js';
import { escapeHtml } from '../../infrastructure/text-utils.js';
import { showDiffModal, threeWayMerge } from './diff-merge-service.js';
import { showContextMenu } from '../../shell/ui/context-menu.js';
import * as platform from '../../infrastructure/platform-adapter.js';

// ── Folder state ────────────────────────────────────────────────────────────

let folderPath: string | null = null;
let fileEntries: Array<{ name: string; path: string; [key: string]: any }> = [];  // [{name, path}] sorted

// ── DOM refs ────────────────────────────────────────────────────────────────

const fileSidebar  : HTMLElement | null = document.getElementById("fileSidebar");
const fileList     : HTMLElement | null = document.getElementById("fileList");
const folderNameEl : HTMLElement | null = document.getElementById("folderName");
const btnSave      : HTMLElement | null = document.getElementById("btnSave");

// ── Markdown prettifier ─────────────────────────────────────────────────────

function prettifyMarkdown(text: string): string {
  let fm = "";
  let body = text;
  const fmMatch = text.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/);
  if (fmMatch) {
    fm = fmMatch[1];
    body = text.slice(fm.length);
  }

  let lines = body.split("\n");
  lines = lines.map((l: string) => l.replace(/\s+$/, ""));
  lines = prettifyTables(lines);

  const result = [];
  let blankCount = 0;
  for (const line of lines) {
    if (line === "") {
      blankCount++;
      if (blankCount <= 2) result.push(line);
    } else {
      blankCount = 0;
      result.push(line);
    }
  }
  lines = result;

  for (let i = 1; i < lines.length; i++) {
    if (/^#{1,6} /.test(lines[i]) && lines[i - 1] !== "") {
      lines.splice(i, 0, "");
      i++;
    }
  }

  body = lines.join("\n");
  if (!body.endsWith("\n")) body += "\n";
  return fm + body;
}

function prettifyTables(lines: string[]): string[] {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\s*\|/.test(lines[i])) {
      const tableStart = i;
      while (i < lines.length && /^\s*\|/.test(lines[i])) i++;
      const tableLines = lines.slice(tableStart, i);
      const hasSep = tableLines.some((l: string) => /^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(l));
      if (hasSep && tableLines.length >= 2) {
        out.push(...alignTable(tableLines));
      } else {
        out.push(...tableLines);
      }
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out;
}

function alignTable(tableLines: string[]): string[] {
  const rows = tableLines.map((line: string) => {
    const cells = line.split("|").slice(1);
    if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
    return cells.map((c: string) => c.trim());
  });

  let sepIdx = -1;
  for (let i = 0; i < tableLines.length; i++) {
    if (/^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(tableLines[i])) { sepIdx = i; break; }
  }

  const colCount = Math.max(...rows.map((r: string[]) => r.length));
  const widths = Array(colCount).fill(3);
  rows.forEach((row: string[], ri: number) => {
    if (ri === sepIdx) return;
    row.forEach((cell: string, ci: number) => { widths[ci] = Math.max(widths[ci], cell.length); });
  });

  return rows.map((row: string[], ri: number) => {
    if (ri === sepIdx) {
      const sepCells = tableLines[ri].split("|").slice(1);
      if (sepCells.length && sepCells[sepCells.length - 1].trim() === "") sepCells.pop();
      const parts = [];
      for (let ci = 0; ci < colCount; ci++) {
        const raw = (sepCells[ci] || "").trim();
        const left = raw.startsWith(":");
        const right = raw.endsWith(":");
        const inner = widths[ci] - (left ? 1 : 0) - (right ? 1 : 0);
        parts.push((left ? ":" : "") + "-".repeat(Math.max(1, inner)) + (right ? ":" : ""));
      }
      return "| " + parts.join(" | ") + " |";
    }
    const cells = [];
    for (let ci = 0; ci < colCount; ci++) {
      cells.push((row[ci] || "").padEnd(widths[ci]));
    }
    return "| " + cells.join(" | ") + " |";
  });
}

// ── Prettify (public, operates on CM) ───────────────────────────────────────

export function applyPrettify(): void {
  const cursor = cm.getCursor("head");
  const scroll = cm.getScrollInfo();
  const before = cm.getValue();
  const after = prettifyMarkdown(before);
  if (after !== before) {
    cm.setValue(after);
    cm.setCursor(Math.min(cursor.line, cm.lineCount() - 1), cursor.ch);
    cm.scrollTo(scroll.left, scroll.top);
  }
}

// ── File I/O ────────────────────────────────────────────────────────────────

export async function readFile(filePath: string): Promise<string> {
  return platform.readFile(filePath);
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  return platform.writeFile(filePath, content);
}

export async function getFileModTime(filePath: string): Promise<number> {
  return platform.getFileModTime(filePath);
}

// ── Conflict-aware save ─────────────────────────────────────────────────────

export async function saveWithConflictDetection(filePath: string, content: string, savedContent: string, localFileModTime: number): Promise<{ action: string; content?: string; modTime?: number; hasConflicts?: boolean }> {
  let currentModTime = 0;
  try {
    currentModTime = await platform.getFileModTime(filePath);
  } catch {
    currentModTime = 0;
  }
  if (localFileModTime && currentModTime > localFileModTime) {
    const remoteText = await platform.readFile(filePath);
    if (remoteText !== savedContent) {
      const fileName = filePath.split("/").pop() || filePath;
      const action = await showDiffModal(content, remoteText, fileName, undefined);
      if (action === "cancel") return { action: "cancel" };
      if (action === "reload") return { action: "reload", content: remoteText, modTime: currentModTime };
      if (action === "merge") {
        const merged = threeWayMerge(savedContent, content, remoteText);
        return { action: "merge", content: merged.text, hasConflicts: merged.hasConflicts };
      }
    }
  }

  await platform.writeFile(filePath, content);
  const newModTime = await platform.getFileModTime(filePath);
  return { action: "saved", modTime: newModTime };
}

// ── Save As dialog ──────────────────────────────────────────────────────────

export async function showSaveAsDialog(defaultName: string): Promise<string | null> {
  return platform.showSaveDialog(defaultName || "document.md");
}

// ── Open file dialog ────────────────────────────────────────────────────────

export async function showOpenFileDialog(): Promise<string | null> {
  return platform.showOpenFileDialog();
}

// ── Folder operations ───────────────────────────────────────────────────────

export async function openFolder(): Promise<{ folderPath: string; fileEntries: Array<{ name: string; path: string; [key: string]: any }> } | null> {
  const dirPath = await platform.showOpenFolderDialog();
  if (!dirPath) return null;
  folderPath = dirPath;
  return activateFolder();
}

export async function openFolderByPath(dirPath: string): Promise<{ folderPath: string; fileEntries: Array<{ name: string; path: string; [key: string]: any }> } | null> {
  folderPath = dirPath;
  return activateFolder();
}

async function activateFolder(): Promise<{ folderPath: string; fileEntries: Array<{ name: string; path: string; [key: string]: any }> } | null> {
  if (!folderPath || !folderNameEl || !fileSidebar || !btnSave) return null;
  folderNameEl.textContent = folderPath.split("/").pop() || folderPath;
  fileSidebar.classList.add("open");
  btnSave.style.display = "";
  cm.refresh();

  const state = await platform.getAppState();
  const recentFolders = [folderPath, ...((state.recentFolders as string[]) || []).filter(f => f !== folderPath)].slice(0, 10);
  await platform.setAppState({ lastFolder: folderPath, recentFolders });

  await refreshFileList();
  return { folderPath, fileEntries };
}

export async function refreshFileList(): Promise<void> {
  if (!folderPath) return;
  fileEntries = await platform.readDir(folderPath);
  renderFileList();
}

// ── Sidebar rendering ───────────────────────────────────────────────────────

type FileEntry = { name: string; path: string; kind?: string; icon?: string; [key: string]: any };

let _onFileClick: ((f: FileEntry) => void) | null = null;
let _onFileRefresh: ((path: string, name: string) => void) | null = null;
let _getActiveFilePath: (() => string | null) | null = null;
let _isFileDirty: ((path: string) => boolean) | null = null;
let _getExtraFileEntries: (() => FileEntry[]) | null = null;

export function setOnFileClick(fn: (f: FileEntry) => void): void { _onFileClick = fn; }
export function setOnFileRefresh(fn: (path: string, name: string) => void): void { _onFileRefresh = fn; }
export function setGetActiveFilePath(fn: () => string | null): void { _getActiveFilePath = fn; }
export function setIsFileDirty(fn: (path: string) => boolean): void { _isFileDirty = fn; }
export function setGetExtraFileEntries(fn: () => FileEntry[]): void { _getExtraFileEntries = fn; }

export function renderFileList(): void {
  if (!fileList) return;
  fileList.innerHTML = "";
  const activePath = _getActiveFilePath ? _getActiveFilePath() : null;
  const items = [
    ...(_getExtraFileEntries ? _getExtraFileEntries() : []),
    ...fileEntries.map((entry) => ({ ...entry, kind: "file", icon: "\uD83D\uDCC4" })),
  ];
  items.forEach((f) => {
    const dirty = _isFileDirty ? _isFileDirty(f.path) : false;
    const el = document.createElement("div");
    el.className = "file-item" + (f.path === activePath ? " active" : "") + (dirty ? " dirty" : "");
    el.innerHTML = `<span class="file-icon">${escapeHtml(f.icon || "\uD83D\uDCC4")}</span>${escapeHtml(f.name)}`;
    el.onclick = () => {
      if (_onFileClick) _onFileClick(f);
    };
    if (f.kind === "file") {
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFileContextMenu(e.clientX, e.clientY, f);
      });
    }
    fileList.appendChild(el);
  });
}

// ── File context menu ────────────────────────────────────────────────────────

function showFileContextMenu(x: number, y: number, f: FileEntry): void {
  showContextMenu(x, y, [
    { label: "Open", action: () => { if (_onFileClick) _onFileClick(f); } },
    { label: "Refresh from Disk", action: () => { if (_onFileRefresh) _onFileRefresh(f.path, f.name); } },
    { separator: true },
    { label: "Copy Path", action: () => navigator.clipboard.writeText(f.path) },
    { label: "Show in Finder", disabled: !platform.canShowInFinder, action: () => platform.showInFinder(f.path) },
    { separator: true },
    { label: "Delete File", action: () => deleteFileWithConfirm(f) },
  ]);
}

// ── File creation ────────────────────────────────────────────────────────────

let _onFileDelete: ((path: string) => void) | null = null;
export function setOnFileDelete(fn: (path: string) => void): void { _onFileDelete = fn; }

export async function createNewFile(): Promise<void> {
  if (!folderPath) return;

  const name = prompt("New file name:", "untitled.md");
  if (!name) return;

  const fileName = name.endsWith(".md") ? name : name + ".md";

  try {
    await platform.writeFile(fileName, "");
    await refreshFileList();
    if (_onFileClick) _onFileClick({ path: fileName, name: fileName, kind: "file", icon: "\uD83D\uDCC4" });
  } catch (e: any) {
    alert("Failed to create file: " + e.message);
  }
}

async function deleteFileWithConfirm(f: FileEntry): Promise<void> {
  const confirmed = confirm(`Delete "${f.name}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    await platform.deleteFile(f.path);
    if (_onFileDelete) _onFileDelete(f.path);
    await refreshFileList();
  } catch (e: any) {
    alert("Failed to delete file: " + e.message);
  }
}

// ── Close folder ────────────────────────────────────────────────────────────

export function closeFolder(): void {
  if (fileSidebar) fileSidebar.classList.remove("open");
  fileEntries = [];
  folderPath = null;
  platform.setAppState({ lastFolder: null, lastFile: null });
}

// ── Accessors ───────────────────────────────────────────────────────────────

export function getFolderPath(): string | null { return folderPath; }
export function getFileEntries(): Array<{ name: string; path: string; [key: string]: any }> { return fileEntries; }

// ── Recent files helper ─────────────────────────────────────────────────────

export async function addRecentFile(filePath: string): Promise<void> {
  const state = await platform.getAppState();
  const recent = [filePath, ...((state.recentFiles as string[]) || []).filter(f => f !== filePath)].slice(0, 10);
  await platform.setAppState({ recentFiles: recent });
}

// ── Title helper ────────────────────────────────────────────────────────────

export function updateTitle(fileName: string, dirty: boolean): void {
  const prefix = dirty ? "\u2022 " : "";
  const title = fileName ? prefix + fileName + " \u2014 BEORN Editor" : "BEORN Editor";
  document.title = title;
  platform.setTitle(title);
}
