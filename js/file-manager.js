// file-manager.js — file management via Electron IPC

import { cm, status, showLoading, hideLoading } from './editor.js';
import { triggerRender, escapeHtml } from './render.js';
import { showDiffModal, threeWayMerge } from './diff-merge.js';

const api = window.electronAPI;

// ── File state ───────────────────────────────────────────────────────────────

let folderPath = null;        // path of opened folder
let fileEntries = [];         // [{name, path}] sorted
let activeFileIdx = -1;       // index in fileEntries
let activeFileName = "";      // name of active file
let savedContent = "";        // content at last save/load
let dirtyFlag = false;        // true when content differs from last save/load
let localFileModTime = 0;     // mtime when file was loaded/saved
let standaloneFilePath = null; // path for single-file open (no folder)

// ── DOM refs ─────────────────────────────────────────────────────────────────

const fileSidebar  = document.getElementById("fileSidebar");
const fileList     = document.getElementById("fileList");
const folderNameEl = document.getElementById("folderName");
const paneFileName = document.getElementById("paneFileName");
const btnSave      = document.getElementById("btnSave");

// ── refreshTableWidgets hook ─────────────────────────────────────────────────

let _refreshTableWidgets = null;

export function refreshTableWidgets() {
  if (typeof _refreshTableWidgets === "function") _refreshTableWidgets();
}

export function registerRefreshTableWidgets(fn) {
  _refreshTableWidgets = fn;
}

// ── Markdown prettifier ──────────────────────────────────────────────────────

function prettifyMarkdown(text) {
  // Preserve frontmatter
  let fm = "";
  let body = text;
  const fmMatch = text.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/);
  if (fmMatch) {
    fm = fmMatch[1];
    body = text.slice(fm.length);
  }

  let lines = body.split("\n");

  // 1. Trim trailing whitespace from each line
  lines = lines.map(l => l.replace(/\s+$/, ""));

  // 2. Align table columns
  lines = prettifyTables(lines);

  // 3. Collapse 3+ consecutive blank lines into 2
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

  // 4. Ensure blank line before headings (unless first line)
  for (let i = 1; i < lines.length; i++) {
    if (/^#{1,6} /.test(lines[i]) && lines[i - 1] !== "") {
      lines.splice(i, 0, "");
      i++;
    }
  }

  // 5. Ensure trailing newline
  body = lines.join("\n");
  if (!body.endsWith("\n")) body += "\n";

  return fm + body;
}

function prettifyTables(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    // Detect table start: line starts with |
    if (/^\s*\|/.test(lines[i])) {
      const tableStart = i;
      while (i < lines.length && /^\s*\|/.test(lines[i])) i++;
      const tableLines = lines.slice(tableStart, i);

      // Only prettify if there's a separator row (|---|)
      const hasSep = tableLines.some(l => /^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(l));
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

function alignTable(tableLines) {
  // Parse cells
  const rows = tableLines.map(line => {
    const cells = line.split("|").slice(1);
    if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
    return cells.map(c => c.trim());
  });

  // Find separator row index
  let sepIdx = -1;
  for (let i = 0; i < tableLines.length; i++) {
    if (/^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(tableLines[i])) { sepIdx = i; break; }
  }

  // Compute max column widths (min 3)
  const colCount = Math.max(...rows.map(r => r.length));
  const widths = Array(colCount).fill(3);
  rows.forEach((row, ri) => {
    if (ri === sepIdx) return;
    row.forEach((cell, ci) => { widths[ci] = Math.max(widths[ci], cell.length); });
  });

  // Rebuild lines
  return rows.map((row, ri) => {
    if (ri === sepIdx) {
      // Preserve alignment markers (:---, :---:, ---:)
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

// ── Core functions ───────────────────────────────────────────────────────────

export function isDirty() { return (activeFileIdx >= 0 || standaloneFilePath) && dirtyFlag; }

export async function openFolder() {
  const dirPath = await api.showOpenFolderDialog();
  if (!dirPath) return;
  folderPath = dirPath;
  await activateFolder();
}

export async function activateFolder(restoreFile) {
  folderNameEl.textContent = folderPath.split("/").pop() || folderPath;
  fileSidebar.classList.add("open");
  btnSave.style.display = "";
  cm.refresh();

  await api.setAppState({ lastFolder: folderPath });

  await refreshFileList();

  let idx = 0;
  if (restoreFile) {
    const found = fileEntries.findIndex(f => f.name === restoreFile);
    if (found >= 0) idx = found;
  }
  if (fileEntries.length > 0) await openFile(idx);
}

export async function refreshFileList() {
  fileEntries = await api.readDir(folderPath);
  renderFileList();
}

export function renderFileList() {
  fileList.innerHTML = "";
  fileEntries.forEach((f, i) => {
    const el = document.createElement("div");
    el.className = "file-item" + (i === activeFileIdx ? " active" : "");
    if (i === activeFileIdx && isDirty()) el.classList.add("dirty");
    el.innerHTML = '<span class="file-icon">\uD83D\uDCC4</span>' + escapeHtml(f.name);
    el.onclick = () => openFile(i);
    fileList.appendChild(el);
  });
}

export async function openFile(idx) {
  if (isDirty()) await doSave();

  activeFileIdx = idx;
  const entry = fileEntries[idx];
  activeFileName = entry.name;
  showLoading("Loading " + entry.name + "...");

  try {
    const text = await api.readFile(entry.path);
    const modTime = await api.getFileModTime(entry.path);
    savedContent = text;
    dirtyFlag = false;
    localFileModTime = modTime;
    cm.setValue(text);
    cm.clearHistory();
    hideLoading();
    paneFileName.textContent = entry.name;
    updateTitle(entry.name);
    renderFileList();
    triggerRender();
    await api.setAppState({ lastFile: entry.name });
    status.textContent = "Loaded " + entry.name;
  } catch (e) {
    hideLoading();
    status.textContent = "Load failed: " + e.message;
  }
}

function applyPrettify() {
  const cursor = cm.getCursor();
  const scroll = cm.getScrollInfo();
  const before = cm.getValue();
  const after = prettifyMarkdown(before);
  if (after !== before) {
    cm.setValue(after);
    cm.setCursor(Math.min(cursor.line, cm.lineCount() - 1), cursor.ch);
    cm.scrollTo(scroll.left, scroll.top);
  }
}

export async function doSave() {
  applyPrettify();
  // Standalone file mode
  if (activeFileIdx < 0 && standaloneFilePath) {
    try {
      await api.writeFile(standaloneFilePath, cm.getValue());
      savedContent = cm.getValue();
      dirtyFlag = false;
      localFileModTime = await api.getFileModTime(standaloneFilePath);
      status.textContent = "Saved " + standaloneFilePath.split("/").pop();
      updateTitle(standaloneFilePath.split("/").pop());
    } catch (e) {
      status.textContent = "Save failed: " + e.message;
    }
    return;
  }

  if (activeFileIdx < 0) return;
  const entry = fileEntries[activeFileIdx];

  try {
    // Conflict detection: check if file was modified externally
    if (localFileModTime) {
      const currentModTime = await api.getFileModTime(entry.path);
      if (currentModTime > localFileModTime) {
        status.textContent = "Conflict detected \u2014 reviewing changes...";
        const remoteText = await api.readFile(entry.path);
        const localText = cm.getValue();
        if (remoteText !== savedContent) {
          const action = await showDiffModal(localText, remoteText, entry.name);
          if (action === "cancel") { status.textContent = "Save cancelled"; return; }
          if (action === "reload") {
            savedContent = remoteText;
            dirtyFlag = false;
            localFileModTime = currentModTime;
            cm.setValue(remoteText);
            status.textContent = "Loaded disk version of " + entry.name;
            renderFileList();
            return;
          }
          if (action === "merge") {
            const merged = threeWayMerge(savedContent, localText, remoteText);
            cm.setValue(merged.text);
            if (merged.hasConflicts) {
              status.textContent = "Merged with conflicts \u2014 search for <<<<<<< to resolve";
              return;
            }
          }
        }
      }
    }

    await api.writeFile(entry.path, cm.getValue());
    savedContent = cm.getValue();
    dirtyFlag = false;
    localFileModTime = await api.getFileModTime(entry.path);
    status.textContent = "Saved " + entry.name;
    updateTitle(entry.name);
    renderFileList();
  } catch (e) {
    status.textContent = "Save failed: " + e.message;
  }
}

export async function saveCurrentFile() {
  await doSave();
}

// ── Save As ──────────────────────────────────────────────────────────────────

export async function doSaveAs() {
  const filePath = await api.showSaveDialog(activeFileName || "document.md");
  if (!filePath) return;

  applyPrettify();
  try {
    await api.writeFile(filePath, cm.getValue());
    standaloneFilePath = filePath;
    savedContent = cm.getValue();
    dirtyFlag = false;
    localFileModTime = await api.getFileModTime(filePath);
    const name = filePath.split("/").pop();
    paneFileName.textContent = name;
    updateTitle(name);
    status.textContent = "Saved as " + name;
    api.setAppState({ lastFile: filePath });
    addRecentFile(filePath);
  } catch (e) {
    status.textContent = "Save As failed: " + e.message;
  }
}

// ── Standalone file support ──────────────────────────────────────────────────

export function setStandaloneFile(filePath, content) {
  standaloneFilePath = filePath;
  savedContent = content;
  dirtyFlag = false;
  localFileModTime = 0;
  activeFileIdx = -1;
}

// ── Close folder ─────────────────────────────────────────────────────────────

export function closeFolder() {
  fileSidebar.classList.remove("open");
  fileEntries = [];
  activeFileIdx = -1;
  activeFileName = "";
  savedContent = "";
  dirtyFlag = false;
  folderPath = null;
  standaloneFilePath = null;
  paneFileName.textContent = "";
  updateTitle(null);
  cm.setValue("");
  cm.refresh();
  triggerRender();
  api.setAppState({ lastFolder: null, lastFile: null });
}

// ── Title helper ─────────────────────────────────────────────────────────────

function updateTitle(fileName) {
  const title = fileName ? fileName + " \u2014 BEORN Editor" : "BEORN Editor";
  document.title = title;
  api.setTitle(title);
}

// ── Recent files helper ──────────────────────────────────────────────────────

async function addRecentFile(filePath) {
  const state = await api.getAppState();
  const recent = [filePath, ...(state.recentFiles || []).filter(f => f !== filePath)].slice(0, 10);
  await api.setAppState({ recentFiles: recent });
}

// ── Dirty tracking ───────────────────────────────────────────────────────────

cm.on("change", () => {
  if (activeFileIdx < 0 && !standaloneFilePath) return;
  dirtyFlag = true;
  const name = activeFileName || (standaloneFilePath && standaloneFilePath.split("/").pop()) || "";
  if (name) {
    const title = "\u2022 " + name + " \u2014 BEORN Editor";
    document.title = title;
    api.setTitle(title);
  }
  if (activeFileIdx >= 0) {
    const activeEl = fileList.children[activeFileIdx];
    if (activeEl) activeEl.classList.add("dirty");
  }
});

// ── Keyboard shortcuts ───────────────────────────────────────────────────────

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
    e.preventDefault();
    doSaveAs();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (activeFileIdx >= 0 || standaloneFilePath) doSave();
    else doSaveAs();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "o") {
    e.preventDefault();
    if (typeof window.openLocalFile === "function") window.openLocalFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    if (typeof window.newDocument === "function") window.newDocument();
  }
});

// ── Exports ──────────────────────────────────────────────────────────────────

export { activeFileIdx, activeFileName, savedContent, dirtyFlag, folderPath, fileEntries, standaloneFilePath };
