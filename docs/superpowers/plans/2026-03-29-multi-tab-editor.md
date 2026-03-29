# Multi-Tab Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tab support so multiple files can be open simultaneously, each with its own tab, undo history, and dirty state.

**Architecture:** A new `tab-bar.js` module owns the tab collection and tab bar DOM. `file-manager.js` is simplified to a pure I/O layer (read/write/dir/conflict). The single CodeMirror instance uses `cm.swapDoc()` to swap between per-tab `Doc` instances. The pane header becomes the tab bar with toggles pushed right.

**Tech Stack:** Vanilla ES6 modules, CodeMirror 5 (`swapDoc` API), existing CSS variable system.

**Spec:** `docs/superpowers/specs/2026-03-29-multi-tab-editor-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `js/tab-bar.js` | Create | Tab collection state, tab bar DOM, open/close/switch logic |
| `js/file-manager.js` | Modify | Strip single-file state, become pure I/O layer |
| `js/app.js` | Modify | Wire tab-bar instead of file-manager for state, update all consumers |
| `css/editor.css` | Modify | Add tab bar styles |
| `css/sidebar.css` | Modify | Remove `.file-item.dirty::after` |
| `index.html` | Modify | Replace pane-header content with tab bar container |

---

### Task 1: Create `tab-bar.js` — tab state and DOM

**Files:**
- Create: `js/tab-bar.js`

This is the core module. It manages an array of tab objects, renders the tab bar, and handles open/close/switch using `cm.swapDoc()`.

- [ ] **Step 1: Create `js/tab-bar.js` with tab state management**

```javascript
// tab-bar.js — Multi-tab state and tab bar UI

import { cm } from './editor.js';

// ── Tab state ───────────────────────────────────────────────────────────────

const tabs = [];      // [{ path, name, doc, savedContent, localFileModTime, dirty }]
let activeTabIdx = -1;

// ── DOM refs ────────────────────────────────────────────────────────────────

const tabBarTabs = document.getElementById("tabBarTabs");

// ── Callbacks ───────────────────────────────────────────────────────────────

let _onSwitch = null;   // called after tab switch (for render, outline, etc.)
let _onAllClosed = null; // called when last tab is closed

export function onTabSwitch(fn) { _onSwitch = fn; }
export function onAllTabsClosed(fn) { _onAllClosed = fn; }

// ── Public API ──────────────────────────────────────────────────────────────

export function openTab(path, name, content, modTime) {
  // If already open, switch to it
  const existing = tabs.findIndex(t => t.path && t.path === path);
  if (existing >= 0) {
    switchToTab(existing);
    return existing;
  }

  // Create new CodeMirror Doc
  const doc = CodeMirror.Doc(content || "", "markdown");

  const tab = {
    path,          // null for unsaved new docs
    name,
    doc,
    savedContent: content || "",
    localFileModTime: modTime || 0,
    dirty: false,
  };

  tabs.push(tab);
  const idx = tabs.length - 1;
  switchToTab(idx);
  return idx;
}

export function closeTab(idx) {
  if (idx < 0 || idx >= tabs.length) return;

  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    activeTabIdx = -1;
    // Swap to a blank doc so CM has something
    cm.swapDoc(CodeMirror.Doc("", "markdown"));
    renderTabBar();
    if (_onAllClosed) _onAllClosed();
    return;
  }

  // Adjust active index
  if (idx <= activeTabIdx) {
    activeTabIdx = Math.max(0, activeTabIdx - 1);
  }
  switchToTab(activeTabIdx);
}

export function closeActiveTab() {
  if (activeTabIdx >= 0) closeTab(activeTabIdx);
}

export function switchToTab(idx) {
  if (idx < 0 || idx >= tabs.length) return;

  // Save scroll position of current tab before switching
  if (activeTabIdx >= 0 && activeTabIdx < tabs.length) {
    tabs[activeTabIdx].scrollPos = cm.getScrollInfo();
  }

  activeTabIdx = idx;
  const tab = tabs[idx];
  cm.swapDoc(tab.doc);

  // Restore scroll position
  if (tab.scrollPos) {
    setTimeout(() => cm.scrollTo(tab.scrollPos.left, tab.scrollPos.top), 0);
  }

  renderTabBar();
  if (_onSwitch) _onSwitch(tab);
}

export function getActiveTab() {
  if (activeTabIdx < 0 || activeTabIdx >= tabs.length) return null;
  return tabs[activeTabIdx];
}

export function getActiveTabIdx() { return activeTabIdx; }
export function getTabs() { return tabs; }
export function getTabCount() { return tabs.length; }

export function markActiveTabDirty() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.dirty = true;
  renderTabBar();
}

export function markActiveTabClean(newSavedContent, modTime) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.dirty = false;
  tab.savedContent = newSavedContent;
  if (modTime !== undefined) tab.localFileModTime = modTime;
  renderTabBar();
}

export function updateActiveTabPath(path, name) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.path = path;
  tab.name = name;
  renderTabBar();
}

export function isActiveTabDirty() {
  const tab = getActiveTab();
  return tab ? tab.dirty : false;
}

export function hasOpenTabs() {
  return tabs.length > 0;
}

// Find tab by path (for sidebar highlight)
export function findTabByPath(path) {
  return tabs.findIndex(t => t.path === path);
}

// ── Tab bar rendering ───────────────────────────────────────────────────────

export function renderTabBar() {
  if (!tabBarTabs) return;
  tabBarTabs.innerHTML = "";

  tabs.forEach((tab, i) => {
    const el = document.createElement("div");
    el.className = "tab" + (i === activeTabIdx ? " active" : "");
    el.onclick = (e) => {
      if (e.target.classList.contains("tab-close")) return;
      switchToTab(i);
    };

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = tab.name || "Untitled";
    el.appendChild(nameSpan);

    if (tab.dirty) {
      const dot = document.createElement("span");
      dot.className = "tab-dirty-dot";
      el.appendChild(dot);
    } else {
      const closeBtn = document.createElement("span");
      closeBtn.className = "tab-close";
      closeBtn.textContent = "\u00d7";
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(i);
      };
      el.appendChild(closeBtn);
    }

    // Middle-click to close
    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) { e.preventDefault(); closeTab(i); }
    });

    tabBarTabs.appendChild(el);
  });
}

// ── Session persistence helpers ─────────────────────────────────────────────

export function getSessionState() {
  return {
    openTabs: tabs.map(t => ({ path: t.path, name: t.name })),
    activeTab: activeTabIdx >= 0 ? tabs[activeTabIdx]?.path || tabs[activeTabIdx]?.name : null,
  };
}
```

- [ ] **Step 2: Verify the file loads without errors**

Open `index.html` in the Electron app. Check DevTools console — there should be no errors from tab-bar.js (it will fail to find `tabBarTabs` element, which is expected since we haven't updated HTML yet).

- [ ] **Step 3: Commit**

```bash
git add js/tab-bar.js
git commit -m "feat: add tab-bar.js module with tab state and DOM rendering"
```

---

### Task 2: Update HTML — tab bar container in pane header

**Files:**
- Modify: `index.html:167-177`

Replace the pane header content with a tab bar container and a controls section for the toggles.

- [ ] **Step 1: Replace the editor pane header**

In `index.html`, replace lines 168-177:

```html
    <div class="editor-pane" id="editorPane">
      <div class="pane-header" id="tabBar">
        <div class="tab-bar-tabs" id="tabBarTabs"></div>
        <div class="tab-bar-controls">
          <div id="btnTableEditor" class="wrap-toggle active" onclick="toggleTableEditor()" title="Toggle table editor">
            <span>Tables</span>
            <div class="wrap-track"><div class="wrap-thumb"></div></div>
          </div>
          <div id="btnWrap" class="wrap-toggle active" onclick="toggleWrap()" title="Toggle word wrap">
            <span>Wrap</span>
            <div class="wrap-track"><div class="wrap-thumb"></div></div>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Remove the `paneFileName` span from the toolbar**

In `index.html`, remove line 75:

```html
    <span id="paneFileName" class="pane-filename"></span>
```

The filename is now shown in the active tab, not in the toolbar.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: replace editor pane header with tab bar container"
```

---

### Task 3: Add tab bar CSS

**Files:**
- Modify: `css/editor.css`
- Modify: `css/sidebar.css`

- [ ] **Step 1: Add tab bar styles to `css/editor.css`**

Append to `css/editor.css`:

```css
/* ── Tab bar ── */
.tab-bar-tabs {
  display: flex; align-items: stretch; overflow: hidden; gap: 0;
  min-width: 0; flex: 1;
}
.tab-bar-controls {
  margin-left: auto; display: flex; align-items: center; gap: 6px;
  flex-shrink: 0; padding: 0 8px;
}
.tab {
  display: flex; align-items: center; gap: 6px;
  padding: 0 12px; cursor: pointer; font-size: 11px;
  color: #6c7086; white-space: nowrap; min-width: 0;
  border-top: 2px solid transparent;
  transition: color 0.1s;
  flex-shrink: 1;
}
.tab:hover { color: #a0a0c0; }
.tab.active {
  background: #1e1e2e; color: #cdd6f4;
  border-top-color: #3373b3;
}
.tab-name {
  overflow: hidden; text-overflow: ellipsis;
}
.tab-close {
  font-size: 14px; line-height: 1; color: #4a4a6a;
  cursor: pointer; flex-shrink: 0; padding: 0 2px;
  border-radius: 3px;
}
.tab-close:hover { color: #cdd6f4; background: rgba(255,255,255,0.1); }
.tab-dirty-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #f0a840; flex-shrink: 0;
}
```

- [ ] **Step 2: Remove dirty dot from sidebar in `css/sidebar.css`**

Remove the `.file-list .file-item.dirty::after` rule (lines 31-34):

```css
/* DELETE THIS RULE: */
.file-list .file-item.dirty::after {
  content: ""; width: 6px; height: 6px; border-radius: 50%;
  background: #f0a840; flex-shrink: 0; margin-left: auto;
}
```

- [ ] **Step 3: Commit**

```bash
git add css/editor.css css/sidebar.css
git commit -m "feat: add tab bar CSS, remove sidebar dirty dot"
```

---

### Task 4: Refactor `file-manager.js` — strip single-file state

**Files:**
- Modify: `js/file-manager.js`

Convert file-manager to a pure I/O layer. Remove single-file state tracking (`activeFileIdx`, `savedContent`, `dirtyFlag`, etc.). File open/save now receive state from the caller (tab-bar).

- [ ] **Step 1: Rewrite `file-manager.js`**

Replace the entire file with:

```javascript
// file-manager.js — file I/O and folder management (pure I/O, no tab state)

import { cm, status, showLoading, hideLoading } from './editor.js';
import { escapeHtml } from './render.js';
import { showDiffModal, threeWayMerge } from './diff-merge.js';

const api = window.electronAPI;

// ── Folder state ────────────────────────────────────────────────────────────

let folderPath = null;
let fileEntries = [];  // [{name, path}] sorted

// ── DOM refs ────────────────────────────────────────────────────────────────

const fileSidebar  = document.getElementById("fileSidebar");
const fileList     = document.getElementById("fileList");
const folderNameEl = document.getElementById("folderName");
const btnSave      = document.getElementById("btnSave");

// ── refreshTableWidgets hook ────────────────────────────────────────────────

let _refreshTableWidgets = null;

export function refreshTableWidgets() {
  if (typeof _refreshTableWidgets === "function") _refreshTableWidgets();
}

export function registerRefreshTableWidgets(fn) {
  _refreshTableWidgets = fn;
}

// ── Markdown prettifier ─────────────────────────────────────────────────────

function prettifyMarkdown(text) {
  let fm = "";
  let body = text;
  const fmMatch = text.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/);
  if (fmMatch) {
    fm = fmMatch[1];
    body = text.slice(fm.length);
  }

  let lines = body.split("\n");
  lines = lines.map(l => l.replace(/\s+$/, ""));
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

function prettifyTables(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\s*\|/.test(lines[i])) {
      const tableStart = i;
      while (i < lines.length && /^\s*\|/.test(lines[i])) i++;
      const tableLines = lines.slice(tableStart, i);
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
  const rows = tableLines.map(line => {
    const cells = line.split("|").slice(1);
    if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
    return cells.map(c => c.trim());
  });

  let sepIdx = -1;
  for (let i = 0; i < tableLines.length; i++) {
    if (/^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(tableLines[i])) { sepIdx = i; break; }
  }

  const colCount = Math.max(...rows.map(r => r.length));
  const widths = Array(colCount).fill(3);
  rows.forEach((row, ri) => {
    if (ri === sepIdx) return;
    row.forEach((cell, ci) => { widths[ci] = Math.max(widths[ci], cell.length); });
  });

  return rows.map((row, ri) => {
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

export function applyPrettify() {
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

// ── File I/O ────────────────────────────────────────────────────────────────

export async function readFile(filePath) {
  return api.readFile(filePath);
}

export async function writeFile(filePath, content) {
  return api.writeFile(filePath, content);
}

export async function getFileModTime(filePath) {
  return api.getFileModTime(filePath);
}

// ── Conflict-aware save ─────────────────────────────────────────────────────

export async function saveWithConflictDetection(filePath, content, savedContent, localFileModTime) {
  const currentModTime = await api.getFileModTime(filePath);
  if (localFileModTime && currentModTime > localFileModTime) {
    const remoteText = await api.readFile(filePath);
    if (remoteText !== savedContent) {
      const fileName = filePath.split("/").pop();
      const action = await showDiffModal(content, remoteText, fileName);
      if (action === "cancel") return { action: "cancel" };
      if (action === "reload") return { action: "reload", content: remoteText, modTime: currentModTime };
      if (action === "merge") {
        const merged = threeWayMerge(savedContent, content, remoteText);
        return { action: "merge", content: merged.text, hasConflicts: merged.hasConflicts };
      }
    }
  }

  await api.writeFile(filePath, content);
  const newModTime = await api.getFileModTime(filePath);
  return { action: "saved", modTime: newModTime };
}

// ── Save As dialog ──────────────────────────────────────────────────────────

export async function showSaveAsDialog(defaultName) {
  return api.showSaveDialog(defaultName || "document.md");
}

// ── Open file dialog ────────────────────────────────────────────────────────

export async function showOpenFileDialog() {
  return api.showOpenFileDialog();
}

// ── Folder operations ───────────────────────────────────────────────────────

export async function openFolder() {
  const dirPath = await api.showOpenFolderDialog();
  if (!dirPath) return null;
  folderPath = dirPath;
  return activateFolder();
}

export async function openFolderByPath(dirPath) {
  folderPath = dirPath;
  return activateFolder();
}

async function activateFolder() {
  folderNameEl.textContent = folderPath.split("/").pop() || folderPath;
  fileSidebar.classList.add("open");
  btnSave.style.display = "";
  cm.refresh();

  const state = await api.getAppState();
  const recentFolders = [folderPath, ...(state.recentFolders || []).filter(f => f !== folderPath)].slice(0, 10);
  await api.setAppState({ lastFolder: folderPath, recentFolders });

  await refreshFileList();
  return { folderPath, fileEntries };
}

export async function refreshFileList() {
  fileEntries = await api.readDir(folderPath);
  renderFileList();
}

// ── Sidebar rendering ───────────────────────────────────────────────────────

let _onFileClick = null;
let _getActiveFilePath = null;

export function setOnFileClick(fn) { _onFileClick = fn; }
export function setGetActiveFilePath(fn) { _getActiveFilePath = fn; }

export function renderFileList() {
  fileList.innerHTML = "";
  const activePath = _getActiveFilePath ? _getActiveFilePath() : null;
  fileEntries.forEach((f, i) => {
    const el = document.createElement("div");
    el.className = "file-item" + (f.path === activePath ? " active" : "");
    el.innerHTML = '<span class="file-icon">\uD83D\uDCC4</span>' + escapeHtml(f.name);
    el.onclick = () => {
      if (_onFileClick) _onFileClick(f.path, f.name);
    };
    fileList.appendChild(el);
  });
}

// ── Close folder ────────────────────────────────────────────────────────────

export function closeFolder() {
  fileSidebar.classList.remove("open");
  fileEntries = [];
  folderPath = null;
  api.setAppState({ lastFolder: null, lastFile: null });
}

// ── Accessors ───────────────────────────────────────────────────────────────

export function getFolderPath() { return folderPath; }
export function getFileEntries() { return fileEntries; }

// ── Recent files helper ─────────────────────────────────────────────────────

export async function addRecentFile(filePath) {
  const state = await api.getAppState();
  const recent = [filePath, ...(state.recentFiles || []).filter(f => f !== filePath)].slice(0, 10);
  await api.setAppState({ recentFiles: recent });
}

// ── Title helper ────────────────────────────────────────────────────────────

export function updateTitle(fileName, dirty) {
  const prefix = dirty ? "\u2022 " : "";
  const title = fileName ? prefix + fileName + " \u2014 BEORN Editor" : "BEORN Editor";
  document.title = title;
  api.setTitle(title);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/file-manager.js
git commit -m "refactor: strip single-file state from file-manager, make pure I/O layer"
```

---

### Task 5: Rewire `app.js` — integrate tab-bar

**Files:**
- Modify: `js/app.js`

This is the biggest change. Replace all single-file state references with tab-bar calls. Wire sidebar clicks through tab-bar. Update save/close/open flows.

- [ ] **Step 1: Rewrite `app.js`**

Replace the entire file with:

```javascript
// app.js — Main orchestrator (Electron version)

import { cm, status, toggleWrap, registerOnSetValue, showLoading, hideLoading } from './editor.js';
import {
  pagedReady, triggerRender, scalePreview, openPreviewTab,
  registerOnSectionReady, getSectionStates, toggleCover,
  clearRenderTimeout, scheduleRender,
} from './render.js';
import { setupPreviewClick, setupScrollSync, rebuildAnchorMap } from './sync.js';
import {
  refreshTableWidgets, insertTable, getTableRangeAt, toggleTableEditor,
  setTableRangesDirty, twSyncing, tableWidgets, destroyTableWidget,
} from './table-widget.js';
import {
  openFolder, openFolderByPath, closeFolder, refreshFileList, renderFileList,
  readFile, writeFile, getFileModTime, saveWithConflictDetection,
  showSaveAsDialog, showOpenFileDialog, addRecentFile,
  applyPrettify, updateTitle, getFolderPath, getFileEntries,
  setOnFileClick, setGetActiveFilePath, registerRefreshTableWidgets,
} from './file-manager.js';
import {
  openTab, closeActiveTab, getActiveTab, getActiveTabIdx,
  getTabCount, hasOpenTabs, markActiveTabDirty, markActiveTabClean,
  updateActiveTabPath, isActiveTabDirty, renderTabBar,
  onTabSwitch, onAllTabsClosed, getSessionState, findTabByPath,
} from './tab-bar.js';
import { closeDiffModal, resolveConflict } from './diff-merge.js';
import { init as initAiCollab, addAgent } from './ai-collab.js';
import './resize.js';

const api = window.electronAPI;

// ── Wire tab-bar callbacks ─────────────────────────────────────────────────

onTabSwitch((tab) => {
  updateTitle(tab.name, tab.dirty);
  renderFileList(); // update sidebar highlight
  triggerRender();
  setTimeout(buildOutline, 50);
  setTimeout(refreshTableWidgets, 50);
  updateMenuState();
});

onAllTabsClosed(() => {
  updateTitle(null, false);
  if (getFolderPath()) {
    // Folder open — show empty editor
    renderFileList();
  } else {
    // No folder — show welcome
    showWelcome();
  }
  updateMenuState();
});

// ── Wire sidebar → tab-bar ─────────────────────────────────────────────────

setOnFileClick(async (filePath, fileName) => {
  // Check if already open in a tab
  const existingIdx = findTabByPath(filePath);
  if (existingIdx >= 0) {
    // Already have this import — use switchToTab via openTab
    openTab(filePath, fileName); // openTab handles the switch internally
    return;
  }

  showLoading("Loading " + fileName + "...");
  try {
    const content = await readFile(filePath);
    const modTime = await getFileModTime(filePath);
    openTab(filePath, fileName, content, modTime);
    hideLoading();
    hideWelcome();
    status.textContent = "Loaded " + fileName;
  } catch (e) {
    hideLoading();
    status.textContent = "Load failed: " + e.message;
  }
});

setGetActiveFilePath(() => {
  const tab = getActiveTab();
  return tab ? tab.path : null;
});

// ── Wire hooks ─────────────────────────────────────────────────────────────

registerOnSetValue(() => {
  if (cm.getValue()) hideWelcome();
  else if (!hasOpenTabs()) showWelcome();
  for (const tw of tableWidgets.values()) destroyTableWidget(tw);
  setTimeout(refreshTableWidgets, 50);
  setTimeout(updateMenuState, 0);
});

let _scaleTimer = null;
let _anchorTimer = null;
registerOnSectionReady((sectionIdx) => {
  const state = getSectionStates()[sectionIdx];
  if (state?.frame) setupPreviewClick(state.frame);
  clearTimeout(_scaleTimer);
  clearTimeout(_anchorTimer);
  _scaleTimer = setTimeout(scalePreview, 300);
  _anchorTimer = setTimeout(rebuildAnchorMap, 350);
  setupScrollSync();
  setTimeout(refreshTableWidgets, 50);
});

window.addEventListener("resize", () => setTimeout(rebuildAnchorMap, 400));

// ── Auto-render on pause ───────────────────────────────────────────────────

let restoreDone = false;
let twRefreshTimer = null;

cm.on("change", () => {
  if (!restoreDone || twSyncing) return;
  setTableRangesDirty();
  clearRenderTimeout();
  status.textContent = "Typing...";
  scheduleRender(800);
  clearTimeout(twRefreshTimer);
  twRefreshTimer = setTimeout(refreshTableWidgets, 200);
});

// ── Dirty tracking ─────────────────────────────────────────────────────────

cm.on("change", () => {
  if (!hasOpenTabs()) return;
  markActiveTabDirty();
  const tab = getActiveTab();
  if (tab) updateTitle(tab.name, true);
});

// ── Format table button visibility ─────────────────────────────────────────

const btnFormatTable = document.getElementById("btnFormatTable");
if (btnFormatTable) {
  cm.on("cursorActivity", () => {
    btnFormatTable.style.display = getTableRangeAt(cm.getCursor().line) ? "" : "none";
  });
}

// ── Document outline ───────────────────────────────────────────────────────

const outlineList = document.getElementById("outlineList");
const outlineSection = document.getElementById("outlineSection");
let outlineHeadings = [];
let stuckObserver = null;

function buildOutline() {
  outlineHeadings = [];
  for (let i = 0; i < cm.lineCount(); i++) {
    const m = cm.getLine(i)?.match(/^(#{1,4}) (.+)/);
    if (m) outlineHeadings.push({ line: i, level: m[1].length, text: m[2].trim() });
  }

  if (!outlineList) return;
  if (stuckObserver) { stuckObserver.disconnect(); stuckObserver = null; }

  outlineList.innerHTML = '';
  const stickyItems = [];

  outlineHeadings.forEach((h, idx) => {
    const el = document.createElement('div');
    el.className = 'outline-item';
    el.dataset.level = h.level;
    el.dataset.idx = idx;
    el.textContent = h.text;
    el.onclick = () => {
      cm.setCursor({ line: h.line, ch: 0 });
      cm.scrollIntoView({ line: h.line, ch: 0 }, cm.getScrollInfo().clientHeight / 3);
      cm.focus();
    };
    outlineList.appendChild(el);
    if (h.level <= 3) stickyItems.push(el);
  });

  if (stickyItems.length > 0) {
    stuckObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          entry.target.classList.toggle('stuck', entry.intersectionRatio < 1);
        });
      },
      { root: outlineList, threshold: 1.0 }
    );
    stickyItems.forEach(el => stuckObserver.observe(el));
  }

  if (outlineSection && outlineHeadings.length > 0) {
    outlineSection.style.display = '';
  }
  updateOutlineHighlight();
}

let lastVisibleRange = '';

function updateOutlineHighlight() {
  if (!outlineList || outlineHeadings.length === 0) return;

  const cursorLine = cm.getCursor().line;
  const info = cm.getScrollInfo();
  const topLine = cm.lineAtHeight(info.top, "local");
  const bottomLine = cm.lineAtHeight(info.top + info.clientHeight, "local");

  let firstVisible = -1, lastVisible = -1;
  for (let i = 0; i < outlineHeadings.length; i++) {
    const sectionStart = outlineHeadings[i].line;
    const sectionEnd = (i + 1 < outlineHeadings.length) ? outlineHeadings[i + 1].line - 1 : cm.lineCount() - 1;
    if (sectionEnd >= topLine && sectionStart <= bottomLine) {
      if (firstVisible < 0) firstVisible = i;
      lastVisible = i;
    }
  }

  let activeIdx = -1;
  for (let i = outlineHeadings.length - 1; i >= 0; i--) {
    if (outlineHeadings[i].line <= cursorLine) { activeIdx = i; break; }
  }

  const centerLine = cm.lineAtHeight(info.top + info.clientHeight / 2, "local");
  const proximity = new Array(outlineHeadings.length).fill(0);
  if (firstVisible >= 0 && lastVisible >= firstVisible) {
    for (let i = firstVisible; i <= lastVisible; i++) {
      const headLine = outlineHeadings[i].line;
      const nextLine = (i + 1 < outlineHeadings.length) ? outlineHeadings[i + 1].line : cm.lineCount();
      const sectionMid = (headLine + nextLine) / 2;
      const halfSpan = Math.max(1, (bottomLine - topLine) / 2);
      const dist = Math.abs(sectionMid - centerLine) / halfSpan;
      proximity[i] = Math.max(0, 1 - dist);
    }
  }

  const visKey = firstVisible + ':' + lastVisible + ':' + activeIdx + ':' + centerLine;
  if (visKey === lastVisibleRange) return;
  lastVisibleRange = visKey;

  const items = outlineList.querySelectorAll('.outline-item');
  items.forEach((el, i) => {
    el.classList.toggle('active', i === activeIdx);
    const isVisible = i >= firstVisible && i <= lastVisible && i !== activeIdx;
    el.classList.toggle('visible', isVisible);
    el.style.setProperty('--prox', isVisible ? proximity[i].toFixed(2) : '0');
  });

  if (firstVisible >= 0 && items[firstVisible] && items[lastVisible]) {
    const firstEl = items[firstVisible];
    const lastEl = items[lastVisible];
    const rangeTop = firstEl.offsetTop - outlineList.offsetTop;
    const rangeBottom = lastEl.offsetTop - outlineList.offsetTop + lastEl.offsetHeight;
    const rangeCenter = (rangeTop + rangeBottom) / 2;
    outlineList.scrollTop = rangeCenter - outlineList.clientHeight / 2;
  }
}

let outlineTimer = null;
cm.on("change", () => {
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(buildOutline, 300);
});
cm.on("cursorActivity", updateOutlineHighlight);
cm.on("scroll", updateOutlineHighlight);
setTimeout(buildOutline, 200);

// ── Desktop-style menu bar ─────────────────────────────────────────────────

(function initMenubar() {
  const menubar = document.querySelector('.menubar');
  if (!menubar) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'menu-backdrop';
  document.body.appendChild(backdrop);

  let openMenu = null;

  function openItem(item) {
    if (openMenu === item) return;
    closeAll();
    item.classList.add('open');
    backdrop.classList.add('active');
    openMenu = item;
  }

  function closeAll() {
    if (openMenu) openMenu.classList.remove('open');
    backdrop.classList.remove('active');
    openMenu = null;
  }

  menubar.querySelectorAll('.menu-trigger').forEach(trigger => {
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const item = trigger.closest('.menu-item');
      if (openMenu === item) { closeAll(); } else { openItem(item); }
    });
  });

  menubar.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      if (openMenu && openMenu !== item) openItem(item);
    });
  });

  menubar.querySelectorAll('.menu-dropdown button').forEach(btn => {
    btn.addEventListener('click', () => closeAll());
  });

  backdrop.addEventListener('click', closeAll);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openMenu) closeAll();
  });
})();

// ── Drag & drop .md files ──────────────────────────────────────────────────

const cmEl = cm.getWrapperElement();
cmEl.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
cmEl.addEventListener("drop", e => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.name.endsWith(".md") && file.path) {
    e.preventDefault();
    e.stopPropagation();
    openFilePath(file.path);
  }
});

// ── Open a file by path ────────────────────────────────────────────────────

async function openFilePath(filePath) {
  // Check if already open
  const existing = findTabByPath(filePath);
  if (existing >= 0) {
    openTab(filePath, filePath.split("/").pop());
    return;
  }

  try {
    showLoading("Loading...");
    const text = await readFile(filePath);
    const modTime = await getFileModTime(filePath);
    const name = filePath.split("/").pop();
    openTab(filePath, name, text, modTime);
    hideLoading();
    hideWelcome();
    triggerRender();
    addRecentFile(filePath);
    await api.setAppState({ lastFile: filePath });
    buildRecentUI();
    status.textContent = "Loaded " + name;
  } catch (e) {
    hideLoading();
    status.textContent = "Failed to load file: " + e.message;
  }
}

// ── Save active tab ────────────────────────────────────────────────────────

async function doSave() {
  const tab = getActiveTab();
  if (!tab) return;

  applyPrettify();
  const content = cm.getValue();

  if (!tab.path) {
    // Unsaved — trigger Save As
    await doSaveAs();
    return;
  }

  try {
    const result = await saveWithConflictDetection(
      tab.path, content, tab.savedContent, tab.localFileModTime
    );

    if (result.action === "cancel") {
      status.textContent = "Save cancelled";
      return;
    }
    if (result.action === "reload") {
      cm.setValue(result.content);
      markActiveTabClean(result.content, result.modTime);
      status.textContent = "Loaded disk version of " + tab.name;
      return;
    }
    if (result.action === "merge") {
      cm.setValue(result.content);
      if (result.hasConflicts) {
        status.textContent = "Merged with conflicts \u2014 search for <<<<<<< to resolve";
        return;
      }
      // Fall through to save the merged content
      await writeFile(tab.path, cm.getValue());
      const modTime = await getFileModTime(tab.path);
      markActiveTabClean(cm.getValue(), modTime);
      status.textContent = "Saved " + tab.name;
      return;
    }

    // Normal save
    markActiveTabClean(content, result.modTime);
    updateTitle(tab.name, false);
    status.textContent = "Saved " + tab.name;
  } catch (e) {
    status.textContent = "Save failed: " + e.message;
  }
}

async function doSaveAs() {
  const tab = getActiveTab();
  if (!tab) return;

  const filePath = await showSaveAsDialog(tab.name || "document.md");
  if (!filePath) return;

  applyPrettify();
  try {
    await writeFile(filePath, cm.getValue());
    const modTime = await getFileModTime(filePath);
    const name = filePath.split("/").pop();
    updateActiveTabPath(filePath, name);
    markActiveTabClean(cm.getValue(), modTime);
    updateTitle(name, false);
    status.textContent = "Saved as " + name;
    addRecentFile(filePath);
  } catch (e) {
    status.textContent = "Save As failed: " + e.message;
  }
}

// ── Close active tab (with auto-save) ──────────────────────────────────────

async function closeCurrentTab() {
  const tab = getActiveTab();
  if (!tab) return;
  if (tab.dirty && tab.path) await doSave();
  closeActiveTab();
}

// ── Open single file via dialog ────────────────────────────────────────────

async function openLocalFile() {
  const filePath = await showOpenFileDialog();
  if (!filePath) return;
  await openFilePath(filePath);
}

// ── Expose globals for onclick handlers in HTML ────────────────────────────

window.openLocalFile = openLocalFile;
window.openFolder = async () => {
  const result = await openFolder();
  if (result && result.fileEntries.length > 0) {
    // Open first file in a tab
    const first = result.fileEntries[0];
    const content = await readFile(first.path);
    const modTime = await getFileModTime(first.path);
    openTab(first.path, first.name, content, modTime);
    hideWelcome();
  }
};
window.saveCurrentFile = () => {
  if (hasOpenTabs()) return doSave();
  return doSaveAs();
};
window.saveAs = doSaveAs;
window.insertTable = insertTable;
window.triggerRender = triggerRender;
window.openPreviewTab = openPreviewTab;
window.toggleWrap = toggleWrap;
window.toggleCover = toggleCover;
window.toggleTableEditor = toggleTableEditor;
window.closeDiffModal = closeDiffModal;
window.resolveConflict = resolveConflict;
window.closeFolder = () => {
  closeFolder();
  // Close all tabs from folder? No — tabs persist, they just lose the sidebar
  renderFileList();
  updateMenuState();
};
window.closeFile = closeCurrentTab;
window.newDocument = newDocument;
window.newFromTemplate = newFromTemplate;
window.addAgent = addAgent;

// ── Welcome screen ─────────────────────────────────────────────────────────

const welcomeScreen = document.getElementById("welcomeScreen");

function hideWelcome() {
  if (welcomeScreen) welcomeScreen.classList.add("hidden");
}

function showWelcome() {
  if (welcomeScreen) welcomeScreen.classList.remove("hidden");
}

// ── Menu state ─────────────────────────────────────────────────────────────

function updateMenuState() {
  const hasContent = !!cm.getValue();
  const hasFile = hasOpenTabs();
  const hasFolder = !!getFolderPath();
  const canSave = hasFile;

  const set = (id, enabled) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  };

  set("btnOpenLocal", true);
  set("btnOpenFolder", true);
  set("welcomeOpenLocal", true);
  set("welcomeOpenFolder", true);
  set("btnSave", canSave);
  set("btnSaveAs", hasContent);
  set("btnCloseFile", hasFile);
  set("btnCloseFolder", hasFolder);

  set("btnInsertTable", hasContent);
  set("btnUndo", hasContent);
  set("btnRedo", hasContent);
  set("btnRender", hasContent);
  set("btnPreviewTab", hasContent);
  set("btnToggleWrap", true);
}

const BLANK_FRONTMATTER = `---
title: ""
doctype: ""
---

`;

function newDocument() {
  hideWelcome();
  openTab(null, "Untitled", BLANK_FRONTMATTER, 0);
  cm.setCursor({ line: 1, ch: 8 });
  cm.focus();
}

const BEORN_TEMPLATE = `---
title: "Project Name \u2014 Document Title"
doctype: "Memoire technique"
ao_ref: "2024-XXX"
acheteur: "Client Name"
---

# Page de garde

# 1. Introduction

## 1.1 Context

Describe the project context here.

## 1.2 Objectives

Outline the main objectives.

# 2. Technical Approach

## 2.1 Architecture

Describe the proposed architecture.

## 2.2 Implementation

Detail the implementation plan.

# 3. Planning

## 3.1 Timeline

Provide the project timeline.

# 4. Team

## 4.1 Key Personnel

Present the team members.
`;

function newFromTemplate() {
  hideWelcome();
  openTab(null, "Untitled", BEORN_TEMPLATE, 0);
  cm.focus();
  triggerRender();
}

// ── Restore last session on startup ────────────────────────────────────────

async function tryRestore() {
  const state = await api.getAppState();

  if (state.lastFolder) {
    try {
      await openFolderByPath(state.lastFolder);
      // Restore open tabs
      const openTabNames = state.openTabs || [];
      const activeTabName = state.activeTab;
      const entries = getFileEntries();

      if (openTabNames.length > 0) {
        for (const tabInfo of openTabNames) {
          const name = typeof tabInfo === "string" ? tabInfo : tabInfo.name;
          const entry = entries.find(e => e.name === name);
          if (entry) {
            const content = await readFile(entry.path);
            const modTime = await getFileModTime(entry.path);
            openTab(entry.path, entry.name, content, modTime);
          }
        }
        // Switch to previously active tab
        if (activeTabName) {
          const entry = entries.find(e => e.name === activeTabName);
          if (entry) {
            const idx = findTabByPath(entry.path);
            if (idx >= 0) openTab(entry.path, entry.name);
          }
        }
      } else if (state.lastFile) {
        // Legacy: restore single file
        const entry = entries.find(e => e.name === state.lastFile);
        if (entry) {
          const content = await readFile(entry.path);
          const modTime = await getFileModTime(entry.path);
          openTab(entry.path, entry.name, content, modTime);
        }
      }
      return true;
    } catch (e) {
      console.warn("Folder restore failed:", e);
      closeFolder();
    }
  }

  if (state.lastFile && !state.lastFolder) {
    try {
      await openFilePath(state.lastFile);
      return true;
    } catch (e) {
      console.warn("File restore failed:", e);
    }
  }

  return false;
}

// ── Recent items UI ────────────────────────────────────────────────────────

async function buildRecentUI() {
  const state = await api.getAppState();
  const recentFiles = state.recentFiles || [];
  const recentFolders = state.recentFolders || [];

  const container = document.getElementById("recentMenuContainer");
  const menu = document.getElementById("recentMenu");
  if (container && menu) {
    if (recentFiles.length === 0 && recentFolders.length === 0) {
      container.style.display = "none";
    } else {
      container.style.display = "";
      menu.innerHTML = "";
      if (recentFolders.length > 0) {
        const label = document.createElement("div");
        label.className = "submenu-section-label";
        label.textContent = "Folders";
        menu.appendChild(label);
        for (const f of recentFolders) {
          const btn = document.createElement("button");
          btn.textContent = f.split("/").pop();
          btn.title = f;
          btn.onclick = () => openFolderByPath(f);
          menu.appendChild(btn);
        }
      }
      if (recentFolders.length > 0 && recentFiles.length > 0) {
        const div = document.createElement("div");
        div.className = "menu-divider";
        menu.appendChild(div);
      }
      if (recentFiles.length > 0) {
        const label = document.createElement("div");
        label.className = "submenu-section-label";
        label.textContent = "Files";
        menu.appendChild(label);
        for (const f of recentFiles) {
          const btn = document.createElement("button");
          btn.textContent = f.split("/").pop();
          btn.title = f;
          btn.onclick = () => openFilePath(f);
          menu.appendChild(btn);
        }
      }
    }
  }

  const welcomeRecent = document.getElementById("welcomeRecent");
  const welcomeFolders = document.getElementById("welcomeRecentFolders");
  const welcomeFiles = document.getElementById("welcomeRecentFiles");
  if (welcomeRecent && welcomeFolders && welcomeFiles) {
    if (recentFiles.length === 0 && recentFolders.length === 0) {
      welcomeRecent.style.display = "none";
    } else {
      welcomeRecent.style.display = "";
      welcomeFolders.innerHTML = "";
      welcomeFiles.innerHTML = "";

      for (const f of recentFolders) {
        const link = document.createElement("a");
        link.className = "recent-link";
        link.textContent = f;
        link.href = "#";
        link.onclick = (e) => { e.preventDefault(); openFolderByPath(f); };
        welcomeFolders.appendChild(link);
      }
      for (const f of recentFiles) {
        const link = document.createElement("a");
        link.className = "recent-link";
        link.textContent = f;
        link.href = "#";
        link.onclick = (e) => { e.preventDefault(); openFilePath(f); };
        welcomeFiles.appendChild(link);
      }
    }
  }
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
    e.preventDefault();
    doSaveAs();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (hasOpenTabs()) doSave();
    else doSaveAs();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "o") {
    e.preventDefault();
    openLocalFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    newDocument();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "w") {
    e.preventDefault();
    closeCurrentTab();
  }
});

// ── Wire Electron menu events ──────────────────────────────────────────────

if (api?.on) {
  api.on("menu-new", () => newDocument());
  api.on("menu-open-file", () => openLocalFile());
  api.on("menu-open-folder", () => window.openFolder());
  api.on("menu-save", () => {
    if (hasOpenTabs()) doSave();
    else doSaveAs();
  });
  api.on("menu-save-as", () => doSaveAs());
  api.on("menu-close-file", () => closeCurrentTab());
  api.on("menu-close-folder", () => window.closeFolder());
  api.on("menu-insert-table", () => insertTable());
  api.on("menu-render", () => triggerRender());
  api.on("menu-preview-tab", () => openPreviewTab());
  api.on("menu-toggle-wrap", () => toggleWrap());
  api.on("menu-toggle-cover", () => toggleCover());
  api.on("open-file-path", (filePath) => openFilePath(filePath));
  api.on("open-folder-path", (folderPath) => openFolderByPath(folderPath));
  api.on("recent-cleared", () => buildRecentUI());
}

// ── Persist tab state on changes ───────────────────────────────────────────

function persistTabState() {
  const session = getSessionState();
  api.setAppState({ openTabs: session.openTabs, activeTab: session.activeTab });
}

// Persist when tabs change — debounced
let persistTimer = null;
function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistTabState, 500);
}

// Hook into tab events
const origOnSwitch = onTabSwitch;
onTabSwitch((tab) => {
  updateTitle(tab.name, tab.dirty);
  renderFileList();
  triggerRender();
  setTimeout(buildOutline, 50);
  setTimeout(refreshTableWidgets, 50);
  updateMenuState();
  schedulePersist();
});

// ── Warn before closing with unsaved changes ───────────────────────────────

window.addEventListener("beforeunload", e => {
  if (isActiveTabDirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ── Startup ────────────────────────────────────────────────────────────────

pagedReady.then(async () => {
  const hasStartupPath = await api.hasStartupPath();
  const loaded = hasStartupPath ? false : await tryRestore();
  hideLoading();
  if (!loaded && !hasOpenTabs()) {
    showWelcome();
  } else {
    hideWelcome();
  }
  restoreDone = true;
  updateMenuState();
  buildRecentUI();

  // Initialize AI agent collaboration
  initAiCollab(cm, () => {
    const tab = getActiveTab();
    return tab ? tab.path : null;
  });
}).catch(e => {
  hideLoading();
  if (status) status.textContent = "Startup error: " + e.message;
  console.error("pagedReady failed:", e);
});
```

Note: there's a duplicate `onTabSwitch` registration at the bottom (from the persist hook). Let me fix that — the persist call should be integrated into the first registration. The second `onTabSwitch` call will override the first since `_onSwitch` is a single callback. Let me adjust.

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "feat: rewire app.js to use tab-bar for multi-tab support"
```

---

### Task 6: Fix `onTabSwitch` — merge persist into single callback

The plan above has a bug: `onTabSwitch` is called twice, and only the last callback wins. Merge the persist call into the first `onTabSwitch` block.

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Remove the duplicate `onTabSwitch` at the bottom of app.js**

Remove the second `onTabSwitch((tab) => { ... })` block near the persist section. Instead, add `schedulePersist()` to the first `onTabSwitch` callback at the top of the file.

The first `onTabSwitch` block should become:

```javascript
onTabSwitch((tab) => {
  updateTitle(tab.name, tab.dirty);
  renderFileList();
  triggerRender();
  setTimeout(buildOutline, 50);
  setTimeout(refreshTableWidgets, 50);
  updateMenuState();
  schedulePersist();
});
```

And move `persistTabState`, `persistTimer`, and `schedulePersist` declarations above the first `onTabSwitch` call.

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "fix: merge tab persist into single onTabSwitch callback"
```

---

### Task 7: Remove `paneFileName` references from toolbar CSS

**Files:**
- Modify: `css/toolbar.css`

- [ ] **Step 1: Remove `.pane-filename` style**

In `css/toolbar.css`, remove line 10:

```css
/* DELETE: */
.toolbar .pane-filename { font-size: 11px; color: #94a3b8; margin-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }
```

- [ ] **Step 2: Commit**

```bash
git add css/toolbar.css
git commit -m "chore: remove unused pane-filename toolbar style"
```

---

### Task 8: Integration testing — manual smoke test

No automated tests in this project. Verify manually:

- [ ] **Step 1: Open folder, click files**

1. Open a folder with multiple .md files
2. Click file A → tab opens, content loads, sidebar highlights A
3. Click file B → new tab opens, switches to B, sidebar highlights B
4. Click file A again → switches to existing tab A (no duplicate)

- [ ] **Step 2: Dirty state and save**

1. Edit content in tab A → orange dot appears in tab, title shows "•"
2. Cmd+S → saves, dot disappears, × button returns
3. Edit tab B → tab B shows dirty dot
4. Switch to tab A → tab A content restored with cursor position

- [ ] **Step 3: Close tabs**

1. Close tab B via × → tab A becomes active
2. Open 3 tabs, close middle one → correct tab becomes active
3. Close all tabs with folder open → empty editor, no welcome screen
4. Close folder, open standalone file, close tab → welcome screen

- [ ] **Step 4: Keyboard shortcuts**

1. Cmd+W closes active tab
2. Cmd+N opens new untitled tab
3. Cmd+S saves active tab

- [ ] **Step 5: Session restore**

1. Open folder with 3 tabs, close app
2. Reopen app → same 3 tabs restored, correct active tab

- [ ] **Step 6: Commit final fixes if any**

```bash
git add -A
git commit -m "fix: integration test fixes for multi-tab"
```
