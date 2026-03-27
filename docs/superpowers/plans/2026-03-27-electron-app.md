# Electron App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Paged.js Markdown Editor from a browser-based app to an Electron desktop app, removing Google Drive/URL features and using Node.js `fs` for file I/O with native dialogs and menus.

**Architecture:** Electron main process (`main.js`) handles window creation, native menus, file dialogs, and IPC handlers for all filesystem operations. A `preload.js` script exposes a safe `window.electronAPI` bridge via `contextBridge`. The renderer process (existing JS modules) is modified to call `electronAPI` instead of File System Access API / IndexedDB. Google Drive module is deleted entirely.

**Tech Stack:** Electron 35+, Node.js `fs/promises`, `contextBridge`/`ipcRenderer`/`ipcMain`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `main.js` | Electron main process: BrowserWindow, native menu, IPC handlers for fs ops, app state persistence, recent files |
| `preload.js` | contextBridge exposing `window.electronAPI` — file read/write, dialogs, dir listing, state, title |

### Modified files
| File | Changes |
|------|---------|
| `package.json` | Add `electron` dep, `"main": "main.js"`, scripts `start`, `build` |
| `.gitignore` | Add `dist/` (already there), `out/` (already there) |
| `index.html` | Remove Google API scripts, Drive UI, settings modal, URL-loading script; simplify welcome screen to only Local File, Local Folder, Blank, Template |
| `js/app.js` | Remove all Google Drive imports/wiring, remove `openUrl()`, remove URL-based state restore, replace `openLocalFile()` with `electronAPI` calls, remove `tryLoadFromUrl()`, simplify `tryRestore()` to use `electronAPI.getAppState()` |
| `js/file-manager.js` | Replace File System Access API with `electronAPI.readFile`/`writeFile`/`readDir`, remove IndexedDB, replace `showOpenFilePicker`/`showDirectoryPicker` with `electronAPI` dialog calls, remove Google Drive setters no longer needed |
| `js/editor.js` | No changes |
| `js/render.js` | No changes |
| `js/sync.js` | No changes |
| `js/table-widget.js` | No changes |
| `js/resize.js` | No changes |
| `js/diff-merge.js` | No changes |
| `js/section-init.js` | No changes |

### Deleted files
| File | Reason |
|------|--------|
| `js/google-drive.js` | Google Drive integration removed entirely |

---

### Task 1: Scaffold Electron — `package.json`, `main.js`, `preload.js`

**Files:**
- Modify: `package.json`
- Create: `main.js`
- Create: `preload.js`

- [ ] **Step 1: Update `package.json`**

Add electron as a dev dependency, set main entry, add scripts:

```json
{
  "name": "paged-editor",
  "version": "1.0.0",
  "description": "Markdown to PDF editor with Paged.js",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "echo 'TODO: add electron-builder config'"
  },
  "devDependencies": {
    "electron": "^35.0.0"
  },
  "dependencies": {
    "marked": "^15.0.7"
  }
}
```

- [ ] **Step 2: Create `main.js` with window, IPC handlers, native menu, state persistence**

```javascript
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");

// ── App state persistence ────────────────────────────────────────────────────
const STATE_FILE = path.join(app.getPath("userData"), "app-state.json");
let appState = { lastFolder: null, lastFile: null, recentFiles: [] };

async function loadAppState() {
  try {
    const data = await fs.readFile(STATE_FILE, "utf-8");
    appState = { ...appState, ...JSON.parse(data) };
  } catch {}
}

async function saveAppState() {
  await fs.writeFile(STATE_FILE, JSON.stringify(appState, null, 2));
}

function addRecentFile(filePath) {
  appState.recentFiles = [filePath, ...appState.recentFiles.filter(f => f !== filePath)].slice(0, 10);
  saveAppState();
  buildMenu();
}

// ── Window ───────────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile("index.html");
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("read-file", async (_e, filePath) => {
  return fs.readFile(filePath, "utf-8");
});

ipcMain.handle("write-file", async (_e, filePath, content) => {
  await fs.writeFile(filePath, content, "utf-8");
});

ipcMain.handle("read-dir", async (_e, dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith(".md"))
    .map(e => ({ name: e.name, path: path.join(dirPath, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

ipcMain.handle("get-file-mod-time", async (_e, filePath) => {
  const stat = await fs.stat(filePath);
  return stat.mtimeMs;
});

ipcMain.handle("show-open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: "Markdown", extensions: ["md"] }],
    properties: ["openFile"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("show-open-folder-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("show-save-dialog", async (_e, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: "Markdown", extensions: ["md"] }],
    defaultPath: defaultName || "document.md",
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle("set-title", (_e, title) => {
  if (mainWindow) mainWindow.setTitle(title);
});

ipcMain.handle("get-app-state", () => ({ ...appState }));

ipcMain.handle("set-app-state", async (_e, partial) => {
  Object.assign(appState, partial);
  await saveAppState();
  if (partial.recentFiles !== undefined || partial.lastFile !== undefined) buildMenu();
});

// ── Native menu ──────────────────────────────────────────────────────────────

function buildMenu() {
  const recentSubmenu = appState.recentFiles.length > 0
    ? [
        ...appState.recentFiles.map(f => ({
          label: path.basename(f),
          sublabel: f,
          click: () => mainWindow.webContents.send("open-file-path", f),
        })),
        { type: "separator" },
        { label: "Clear Recent", click: () => {
          appState.recentFiles = [];
          saveAppState();
          buildMenu();
        }},
      ]
    : [{ label: "No Recent Files", enabled: false }];

  const template = [
    {
      label: "File",
      submenu: [
        { label: "New File", accelerator: "CmdOrCtrl+N", click: () => mainWindow.webContents.send("menu-new") },
        { type: "separator" },
        { label: "Open File...", accelerator: "CmdOrCtrl+O", click: () => mainWindow.webContents.send("menu-open-file") },
        { label: "Open Folder...", click: () => mainWindow.webContents.send("menu-open-folder") },
        { type: "separator" },
        { label: "Open Recent", submenu: recentSubmenu },
        { type: "separator" },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: () => mainWindow.webContents.send("menu-save") },
        { label: "Save As...", accelerator: "CmdOrCtrl+Shift+S", click: () => mainWindow.webContents.send("menu-save-as") },
        { type: "separator" },
        { label: "Close File", click: () => mainWindow.webContents.send("menu-close-file") },
        { label: "Close Folder", click: () => mainWindow.webContents.send("menu-close-folder") },
        { type: "separator" },
        ...(process.platform !== "darwin" ? [{ role: "quit" }] : []),
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        { label: "Insert Table", click: () => mainWindow.webContents.send("menu-insert-table") },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Render Preview", accelerator: "CmdOrCtrl+Enter", click: () => mainWindow.webContents.send("menu-render") },
        { label: "Open in New Window", click: () => mainWindow.webContents.send("menu-preview-tab") },
        { type: "separator" },
        { label: "Toggle Line Wrap", click: () => mainWindow.webContents.send("menu-toggle-wrap") },
        { type: "separator" },
        { role: "toggleDevTools" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "togglefullscreen" },
      ],
    },
    ...(process.platform === "darwin" ? [{
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    }] : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await loadAppState();
  createWindow();
  buildMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 3: Create `preload.js`**

```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("write-file", filePath, content),
  readDir: (dirPath) => ipcRenderer.invoke("read-dir", dirPath),
  getFileModTime: (filePath) => ipcRenderer.invoke("get-file-mod-time", filePath),
  showOpenFileDialog: () => ipcRenderer.invoke("show-open-file-dialog"),
  showOpenFolderDialog: () => ipcRenderer.invoke("show-open-folder-dialog"),
  showSaveDialog: (defaultName) => ipcRenderer.invoke("show-save-dialog", defaultName),
  setTitle: (title) => ipcRenderer.invoke("set-title", title),
  getAppState: () => ipcRenderer.invoke("get-app-state"),
  setAppState: (partial) => ipcRenderer.invoke("set-app-state", partial),
  onMenuAction: (callback) => ipcRenderer.on("menu-new", () => callback("new")),
  // Register all menu event listeners
  on: (channel, callback) => {
    const validChannels = [
      "menu-new", "menu-open-file", "menu-open-folder",
      "menu-save", "menu-save-as", "menu-close-file", "menu-close-folder",
      "menu-insert-table", "menu-render", "menu-preview-tab", "menu-toggle-wrap",
      "open-file-path",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
});
```

- [ ] **Step 4: Install electron**

Run: `npm install --save-dev electron@latest`

- [ ] **Step 5: Test that the app launches**

Run: `npm start`
Expected: Electron window opens, loads `index.html`, shows the existing app (Google APIs will fail to load — that's expected and will be cleaned up next).

- [ ] **Step 6: Commit**

```bash
git add main.js preload.js package.json package-lock.json
git commit -m "feat: scaffold Electron main process, preload, and IPC handlers"
```

---

### Task 2: Strip Google Drive, URL features, and settings modal from `index.html`

**Files:**
- Modify: `index.html`
- Delete: `js/google-drive.js`

- [ ] **Step 1: Remove Google API script tags from `<head>`**

Remove these two lines from `index.html`:
```html
  <script src="https://apis.google.com/js/api.js"></script>
  <script src="https://accounts.google.com/gsi/client"></script>
```

- [ ] **Step 2: Remove Google Drive settings modal**

Remove the entire `#settingsModal` div (lines 80-94 of current `index.html`):
```html
  <div class="modal-overlay" id="settingsModal">
    ...
  </div>
```

- [ ] **Step 3: Remove Google Drive and URL items from the File menu**

In the `.menu-dropdown` inside `data-menu="file"`, remove:
- `<button onclick="openDriveFile()">` line
- `<button onclick="openUrl()">` line
- `<button onclick="openGoogleDrive()">` line (Open Drive Folder)
- The `<div class="menu-divider">` between Drive Folder and Save (since Drive items above it are gone)

Also remove the Settings button from the View menu:
```html
<button onclick="document.getElementById('settingsModal').classList.add('open')"><span class="menu-label">Settings</span></button>
```

The File menu should become:
```html
<div class="menu-dropdown">
  <button onclick="newDocument()"><span class="menu-label">New File</span><span class="menu-shortcut">Ctrl+N</span></button>
  <div class="menu-divider"></div>
  <button onclick="openLocalFile()" id="btnOpenLocal"><span class="menu-label">Open File...</span><span class="menu-shortcut">Ctrl+O</span></button>
  <button onclick="openFolder()" id="btnOpenFolder"><span class="menu-label">Open Folder...</span></button>
  <div class="menu-divider"></div>
  <button onclick="saveCurrentFile()" id="btnSave" disabled><span class="menu-label">Save</span><span class="menu-shortcut">Ctrl+S</span></button>
  <button onclick="saveAs()" id="btnSaveAs" disabled><span class="menu-label">Save As...</span><span class="menu-shortcut">Ctrl+Shift+S</span></button>
  <div class="menu-divider"></div>
  <button onclick="closeFile()" id="btnCloseFile" disabled><span class="menu-label">Close File</span></button>
  <button onclick="closeFolder()" id="btnCloseFolder" disabled><span class="menu-label">Close Folder</span></button>
</div>
```

- [ ] **Step 4: Simplify welcome screen — remove Drive and URL buttons**

Remove the three buttons for Drive File, Drive Folder, and From URL from the welcome screen. The "Open" section should only have:
```html
<div class="welcome-section">
  <h2>Open</h2>
  <button onclick="openLocalFile()" id="welcomeOpenLocal">
    <svg ...file icon...></svg>
    <span>Open File</span>
  </button>
  <button onclick="openFolder()" id="welcomeOpenFolder">
    <svg ...folder icon...></svg>
    <span>Open Folder</span>
  </button>
</div>
```

- [ ] **Step 5: Remove the URL-param welcome-hide script**

Remove the inline `<script>` block (lines 152-160) that checks for `driveFile`/`driveFolder` URL params. Replace with a simpler version:
```html
<script>
  // Welcome screen visibility is handled by app.js after restore
</script>
```

Or just remove it entirely — `app.js` already handles welcome screen show/hide after startup.

- [ ] **Step 6: Remove the Google Drive folder icon SVG from sidebar header**

In the sidebar header, remove the `#folderIcon` span that contains the Google Drive logo SVG. Replace with nothing — local folders don't need a special icon.

Remove:
```html
<span id="folderIcon" style="display:none;">
  <svg ...google drive icon...></svg>
</span>
```

- [ ] **Step 7: Delete `js/google-drive.js`**

```bash
rm js/google-drive.js
```

- [ ] **Step 8: Commit**

```bash
git add index.html
git rm js/google-drive.js
git commit -m "feat: remove Google Drive, URL features, and settings modal from UI"
```

---

### Task 3: Rewrite `js/file-manager.js` to use `electronAPI`

**Files:**
- Modify: `js/file-manager.js`

This is the core rewrite. Replace File System Access API + IndexedDB with `window.electronAPI` calls.

- [ ] **Step 1: Rewrite `js/file-manager.js`**

Replace the entire file with:

```javascript
// file-manager.js — file management via Electron IPC

import { cm, editor, status, showLoading, hideLoading } from './editor.js';
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

export async function doSave() {
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
  // Update title with dirty indicator
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
```

- [ ] **Step 2: Commit**

```bash
git add js/file-manager.js
git commit -m "feat: rewrite file-manager to use Electron IPC instead of File System Access API"
```

---

### Task 4: Rewrite `js/app.js` — remove Drive/URL, wire Electron IPC

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Rewrite `js/app.js`**

Replace the entire file with:

```javascript
// app.js — Main orchestrator (Electron version)
// This is the only script loaded by index.html.
// It imports all feature modules and wires them together.

import { cm, status, toggleWrap, registerOnSetValue, showLoading, hideLoading } from './editor.js';
import {
  pagedReady, triggerRender, scalePreview, openPreviewTab,
  registerOnSectionReady, getSectionStates,
  clearRenderTimeout, scheduleRender,
} from './render.js';
import { setupPreviewClick, setupScrollSync, rebuildAnchorMap } from './sync.js';
import {
  refreshTableWidgets, insertTable, getTableRangeAt,
  setTableRangesDirty, twSyncing, tableWidgets, destroyTableWidget,
} from './table-widget.js';
import {
  openFolder, saveCurrentFile, doSaveAs, doSave, isDirty,
  activateFolder, openFile, closeFolder, renderFileList,
  setStandaloneFile, activeFileIdx, folderPath, fileEntries, standaloneFilePath,
} from './file-manager.js';
import { closeDiffModal, resolveConflict } from './diff-merge.js';
import './resize.js';

const api = window.electronAPI;

// ── Wire hooks ──────────────────────────────────────────────────────────────

registerOnSetValue(() => {
  hideWelcome();
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

// ── Auto-render on pause ────────────────────────────────────────────────────

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

// ── Format table button visibility ──────────────────────────────────────────

const btnFormatTable = document.getElementById("btnFormatTable");
if (btnFormatTable) {
  cm.on("cursorActivity", () => {
    btnFormatTable.style.display = getTableRangeAt(cm.getCursor().line) ? "" : "none";
  });
}

// ── Document outline ────────────────────────────────────────────────────────

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

// ── Desktop-style menu bar (HTML-based, kept for in-window fallback) ────────

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

// ── Drag & drop .md files ───────────────────────────────────────────────────

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

// ── Open a file by path (used by drag-drop, recent files, restore) ──────────

async function openFilePath(filePath) {
  try {
    showLoading("Loading...");
    const text = await api.readFile(filePath);
    const modTime = await api.getFileModTime(filePath);
    setStandaloneFile(filePath, text);
    cm.setValue(text);
    cm.clearHistory();
    hideLoading();
    const name = filePath.split("/").pop();
    document.getElementById("paneFileName").textContent = name;
    const title = name + " \u2014 BEORN Editor";
    document.title = title;
    api.setTitle(title);
    triggerRender();
    // Add to recent files
    const state = await api.getAppState();
    const recent = [filePath, ...(state.recentFiles || []).filter(f => f !== filePath)].slice(0, 10);
    await api.setAppState({ lastFile: filePath, recentFiles: recent });
    status.textContent = "Loaded " + name;
  } catch (e) {
    hideLoading();
    status.textContent = "Failed to load file: " + e.message;
  }
}

// ── Open single file via dialog ─────────────────────────────────────────────

async function openLocalFile() {
  const filePath = await api.showOpenFileDialog();
  if (!filePath) return;
  await openFilePath(filePath);
}

// ── Expose globals for onclick handlers in HTML ─────────────────────────────

window.openLocalFile = openLocalFile;
window.openFolder = openFolder;
window.saveCurrentFile = () => {
  if (standaloneFilePath || activeFileIdx >= 0) return doSave();
  return doSaveAs();
};
window.saveAs = doSaveAs;
window.insertTable = insertTable;
window.triggerRender = triggerRender;
window.openPreviewTab = openPreviewTab;
window.toggleWrap = toggleWrap;
window.closeDiffModal = closeDiffModal;
window.resolveConflict = resolveConflict;
window.closeFolder = closeFolder;
window.closeFile = closeFile;
window.newDocument = newDocument;
window.newFromTemplate = newFromTemplate;

// ── Welcome screen ──────────────────────────────────────────────────────────

const welcomeScreen = document.getElementById("welcomeScreen");

function hideWelcome() {
  if (welcomeScreen) welcomeScreen.classList.add("hidden");
}

function showWelcome() {
  if (welcomeScreen) welcomeScreen.classList.remove("hidden");
}

// ── Menu state ──────────────────────────────────────────────────────────────

function updateMenuState() {
  const hasContent = !!cm.getValue();
  const hasFile = activeFileIdx >= 0 || !!standaloneFilePath;
  const hasFolder = !!folderPath;
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
  set("btnCloseFile", hasContent);
  set("btnCloseFolder", hasFolder);

  set("btnInsertTable", hasContent);
  set("btnUndo", hasContent);
  set("btnRedo", hasContent);
  set("btnRender", hasContent);
  set("btnPreviewTab", hasContent);
  set("btnToggleWrap", true);
}

function closeFile() {
  if (isDirty() && !confirm("Discard unsaved changes?")) return;
  setStandaloneFile(null, "");
  cm.setValue("");
  cm.clearHistory();
  document.getElementById("paneFileName").textContent = "";
  const title = "BEORN Editor";
  document.title = title;
  api.setTitle(title);
  showWelcome();
  updateMenuState();
}

const BLANK_FRONTMATTER = `---
title: ""
doctype: ""
---

`;

function newDocument() {
  hideWelcome();
  cm.setValue(BLANK_FRONTMATTER);
  cm.clearHistory();
  cm.setCursor({ line: 1, ch: 8 });
  cm.focus();
  document.getElementById("paneFileName").textContent = "";
  const title = "New Document \u2014 BEORN Editor";
  document.title = title;
  api.setTitle(title);
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
  cm.setValue(BEORN_TEMPLATE);
  cm.clearHistory();
  cm.focus();
  document.getElementById("paneFileName").textContent = "";
  const title = "New Document \u2014 BEORN Editor";
  document.title = title;
  api.setTitle(title);
  triggerRender();
}

// ── Restore last session on startup ─────────────────────────────────────────

async function tryRestore() {
  const state = await api.getAppState();

  // Restore last folder
  if (state.lastFolder) {
    try {
      folderPath = state.lastFolder;
      await activateFolder(state.lastFile || null);
      return true;
    } catch (e) {
      console.warn("Folder restore failed:", e);
      folderPath = null;
    }
  }

  // Restore last standalone file
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

// ── Wire Electron menu events ───────────────────────────────────────────────

if (api?.on) {
  api.on("menu-new", () => newDocument());
  api.on("menu-open-file", () => openLocalFile());
  api.on("menu-open-folder", () => openFolder());
  api.on("menu-save", () => {
    if (activeFileIdx >= 0 || standaloneFilePath) doSave();
    else doSaveAs();
  });
  api.on("menu-save-as", () => doSaveAs());
  api.on("menu-close-file", () => closeFile());
  api.on("menu-close-folder", () => closeFolder());
  api.on("menu-insert-table", () => insertTable());
  api.on("menu-render", () => triggerRender());
  api.on("menu-preview-tab", () => openPreviewTab());
  api.on("menu-toggle-wrap", () => toggleWrap());
  api.on("open-file-path", (filePath) => openFilePath(filePath));
}

// ── Warn before closing with unsaved changes ────────────────────────────────

window.addEventListener("beforeunload", e => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ── Startup ─────────────────────────────────────────────────────────────────

pagedReady.then(async () => {
  const loaded = await tryRestore();
  hideLoading();
  if (!loaded && !cm.getValue()) {
    showWelcome();
  } else {
    hideWelcome();
  }
  restoreDone = true;
  updateMenuState();
}).catch(e => {
  hideLoading();
  if (status) status.textContent = "Startup error: " + e.message;
  console.error("pagedReady failed:", e);
});
```

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "feat: rewrite app.js for Electron — remove Drive/URL, wire IPC menu events"
```

---

### Task 5: Clean up and verify

**Files:**
- Modify: `index.html` (remove `folderIcon` references if any remain)
- Modify: `.gitignore` (ensure Electron build output ignored)

- [ ] **Step 1: Verify no remaining references to deleted google-drive.js**

Run: `grep -r "google-drive\|google_drive\|openGoogleDrive\|openDriveFile\|openUrl\|gdrive\|gd_client\|gd_api\|settingsModal\|saveGoogleSettings\|driveFile\|driveFolder\|folderIcon" js/ index.html --include="*.js" --include="*.html"`

Expected: No matches. If any remain, fix them.

- [ ] **Step 2: Verify no remaining references to IndexedDB or File System Access API**

Run: `grep -r "indexedDB\|showOpenFilePicker\|showDirectoryPicker\|showSaveFilePicker\|idbGet\|idbSet\|idbOpen" js/ --include="*.js"`

Expected: No matches.

- [ ] **Step 3: Verify no remaining references to URL params for state**

Run: `grep -r "urlParams\|location\.search\|URLSearchParams\|history\.replaceState" js/ --include="*.js"`

Expected: No matches.

- [ ] **Step 4: Update `.gitignore` if needed**

Add if not present:
```
# Electron
out/
dist/
```

Both `out/` and `dist/` are already in `.gitignore` — verify and skip if present.

- [ ] **Step 5: Run `npm start` and test the full workflow**

Test checklist:
1. App launches, welcome screen shows
2. "New File" creates blank document with frontmatter
3. "BEORN Template" creates template document
4. "Open File" opens native file dialog, loads a `.md` file
5. "Open Folder" opens native folder dialog, lists `.md` files in sidebar
6. Clicking sidebar files switches between them
7. Save works (Ctrl+S)
8. Save As works (Ctrl+Shift+S)
9. Close File returns to welcome screen
10. Close Folder clears sidebar
11. Window title updates with filename and dirty indicator
12. Native menu works (File > Open, Save, etc.)
13. Recent files appear in File > Open Recent after opening files
14. Restarting app restores last session
15. Drag-drop `.md` file onto editor opens it
16. Markdown rendering and preview work correctly

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete Electron conversion — cleanup and verification"
```

---

### Task 6 (optional): Remove the HTML menubar

Since Electron provides a native menu bar, the HTML `.menubar` in the toolbar is redundant. However, keeping it is fine for now since:
- It provides visual menu access on platforms where native menus aren't prominent
- It matches the existing UI design

If you want to remove it:

- [ ] **Step 1: Remove the `<nav class="menubar">` block from `index.html`**
- [ ] **Step 2: Remove the `initMenubar()` function from `app.js`**
- [ ] **Step 3: Remove `css/toolbar.css` menubar-related styles**
- [ ] **Step 4: Commit**

This is optional — the app works with both menu systems.
