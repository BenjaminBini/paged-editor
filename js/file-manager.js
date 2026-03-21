// file-manager.js — local file management (IndexedDB + File System Access API)

import { cm, editor, status, showLoading, hideLoading } from './editor.js';
import { triggerRender, escapeHtml } from './render.js';
import { showDiffModal, threeWayMerge } from './diff-merge.js';

// ── IndexedDB helpers (persist FileSystemDirectoryHandle) ───────────────────

const IDB_NAME = "paged-editor";
const IDB_STORE = "state";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, val) {
  const db = await idbOpen();
  const tx = db.transaction(IDB_STORE, "readwrite");
  tx.objectStore(IDB_STORE).put(val, key);
  return new Promise(r => { tx.oncomplete = r; });
}

async function idbGet(key) {
  const db = await idbOpen();
  const tx = db.transaction(IDB_STORE, "readonly");
  const req = tx.objectStore(IDB_STORE).get(key);
  return new Promise(r => { req.onsuccess = () => r(req.result); });
}

// ── File state ───────────────────────────────────────────────────────────────

let dirHandle = null;       // DirectoryHandle for the opened folder
let fileHandles = [];       // [{name, handle}] sorted
let activeFileIdx = -1;     // index in fileHandles
let activeFileName = "";    // name of active file (for restore after reload)
let savedContent = "";      // content at last save/load (for conflict detection)
let dirtyFlag = false;      // true when content differs from last save/load
let localFileModTime = 0;   // lastModified timestamp of file when loaded/saved
let storageMode = null;     // "local" | "gdrive" | null
let standaloneHandle = null; // FileHandle for single-file open (no folder)

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

export function isDirty() { return activeFileIdx >= 0 && dirtyFlag; }

export async function openFolder() {
  try {
    dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  } catch(e) { return; } // user cancelled

  await activateFolder();
}

export async function activateFolder(restoreFile) {
  storageMode = "local";
  folderNameEl.textContent = dirHandle.name;
  document.getElementById("folderIcon").style.display = "none";
  fileSidebar.classList.add("open");
  btnSave.style.display = "";
  cm.refresh();

  // Clear GDrive state so restore picks local
  localStorage.removeItem("gd_folder_id");
  localStorage.removeItem("gd_drive_id");
  localStorage.removeItem("gd_folder_name");
  sessionStorage.removeItem("gd_token");

  // Persist handle for reload
  await idbSet("dirHandle", dirHandle);

  await refreshFileList();

  // Restore previously active file, or open first
  let idx = 0;
  if (restoreFile) {
    const found = fileHandles.findIndex(f => f.name === restoreFile);
    if (found >= 0) idx = found;
  }
  if (fileHandles.length > 0) await openFile(idx);
}

export async function refreshFileList() {
  fileHandles = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file" && name.endsWith(".md")) {
      fileHandles.push({ name, handle });
    }
  }
  fileHandles.sort((a, b) => a.name.localeCompare(b.name));
  renderFileList();
}

export function renderFileList() {
  fileList.innerHTML = "";
  fileHandles.forEach((f, i) => {
    const el = document.createElement("div");
    el.className = "file-item" + (i === activeFileIdx ? " active" : "");
    if (i === activeFileIdx && isDirty()) el.classList.add("dirty");
    el.innerHTML = '<span class="file-icon">📄</span>' + escapeHtml(f.name);
    el.onclick = () => openFile(i);
    fileList.appendChild(el);
  });
}

export let openFile = async function(idx) {
  // Save current if dirty
  if (isDirty()) await doSave();

  activeFileIdx = idx;
  const fh = fileHandles[idx];
  activeFileName = fh.name;
  showLoading("Loading " + fh.name + "...");

  // Re-obtain handle from directory to avoid stale getFile() cache
  let text, file;
  try {
    const freshHandle = await dirHandle.getFileHandle(fh.name);
    file = await freshHandle.getFile();
    text = await file.text();
  } catch(e) {
    file = await fh.handle.getFile();
    text = await file.text();
  }
  savedContent = text;
  dirtyFlag = false;
  localFileModTime = file.lastModified;
  cm.setValue(text);
  cm.clearHistory();
  hideLoading();
  paneFileName.textContent = fh.name;
  document.title = fh.name + " — Paged.js Editor";
  renderFileList();
  triggerRender();

  // Remember active file for reload
  await idbSet("activeFile", fh.name);
};

export let doSave = async function() {
  // Standalone file mode (single file opened without folder)
  if (activeFileIdx < 0 && standaloneHandle) {
    try {
      const writable = await standaloneHandle.createWritable();
      await writable.write(cm.getValue());
      await writable.close();
      savedContent = cm.getValue();
      dirtyFlag = false;
      const file = await standaloneHandle.getFile();
      localFileModTime = file.lastModified;
      status.textContent = "Saved " + standaloneHandle.name;
    } catch (e) {
      status.textContent = "Save failed: " + e.message;
    }
    return;
  }
  if (activeFileIdx < 0) return;
  const fh = fileHandles[activeFileIdx];
  try {
    // Check if file was modified externally since we loaded/saved it
    if (localFileModTime && storageMode !== "gdrive") {
      let currentFile;
      try {
        const freshHandle = await dirHandle.getFileHandle(fh.name);
        currentFile = await freshHandle.getFile();
      } catch(e) {
        currentFile = await fh.handle.getFile();
      }
      if (currentFile.lastModified > localFileModTime) {
        status.textContent = "Conflict detected — reviewing changes...";
        const remoteText = await currentFile.text();
        const localText = cm.getValue();
        if (remoteText !== savedContent) {
          // Show diff modal — reuse the same one as Google Drive
          const action = await showDiffModal(localText, remoteText, fh.name);
          if (action === "cancel") { status.textContent = "Save cancelled"; return; }
          if (action === "reload") {
            savedContent = remoteText;
            dirtyFlag = false;
            localFileModTime = currentFile.lastModified;
            cm.setValue(remoteText);
            status.textContent = "Loaded disk version of " + fh.name;
            renderFileList();
            return;
          }
          if (action === "merge") {
            const merged = threeWayMerge(savedContent, localText, remoteText);
            cm.setValue(merged.text);
            if (merged.hasConflicts) {
              status.textContent = "Merged with conflicts — search for <<<<<<< to resolve";
              return; // don't auto-save, let user resolve conflicts first
            }
            // Clean merge — fall through to save
          }
          // action === "force" or clean merge: fall through to save
        }
      }
    }

    const writable = await fh.handle.createWritable();
    await writable.write(cm.getValue());
    await writable.close();
    savedContent = cm.getValue();
    dirtyFlag = false;
    // Update mod time after save
    try {
      const freshFile = await (await dirHandle.getFileHandle(fh.name)).getFile();
      localFileModTime = freshFile.lastModified;
    } catch(e) {}
    status.textContent = "Saved " + fh.name;
    renderFileList();
  } catch(e) {
    status.textContent = "Save failed: " + e.message;
  }
};

export async function saveCurrentFile() {
  await doSave();
}

// ── Save As (File System Access API) ─────────────────────────────────────────

export async function doSaveAs() {
  try {
    const handle = await window.showSaveFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      suggestedName: activeFileName || 'document.md',
    });
    const writable = await handle.createWritable();
    await writable.write(cm.getValue());
    await writable.close();

    // Track as standalone file
    standaloneHandle = handle;
    savedContent = cm.getValue();
    dirtyFlag = false;
    const file = await handle.getFile();
    localFileModTime = file.lastModified;

    const name = handle.name;
    paneFileName.textContent = name;
    document.title = name + " — Paged.js Editor";
    status.textContent = "Saved as " + name;
    renderFileList();
  } catch (e) {
    if (e.name !== 'AbortError') status.textContent = "Save As failed: " + e.message;
  }
}

// ── Standalone file support ──────────────────────────────────────────────────

export function setStandaloneHandle(handle, content) {
  standaloneHandle = handle;
  savedContent = content;
  dirtyFlag = false;
  localFileModTime = 0;
  // Not in folder mode, but enable save
  activeFileIdx = -1;
}

// ── Setters for google-drive.js (mutates module-level variables) ─────────────

export function setOpenFile(fn)        { openFile = fn; }
export function setDoSave(fn)          { doSave = fn; }
export function setStorageMode(m)      { storageMode = m; }
export function setDirHandle(h)        { dirHandle = h; }
export function setActiveFileIdx(i)    { activeFileIdx = i; }
export function setActiveFileName(n)   { activeFileName = n; }
export function setSavedContent(c)     { savedContent = c; }
export function setDirtyFlag(f)        { dirtyFlag = f; }
export function setFileHandles(h)      { fileHandles = h; }
export function setLocalFileModTime(t) { localFileModTime = t; }

// ── Named re-exports for consumers ───────────────────────────────────────────

export { idbSet, idbGet };
export { dirHandle, fileHandles, activeFileIdx, activeFileName, savedContent, dirtyFlag, storageMode };

// ── Dirty tracking ────────────────────────────────────────────────────────────

// Update only the active file's indicator, not the whole list
cm.on("change", () => {
  if (activeFileIdx < 0) return;
  dirtyFlag = true;
  const activeEl = fileList.children[activeFileIdx];
  if (!activeEl) return;
  activeEl.classList.add("dirty");
});

// ── Ctrl+S / Cmd+S to save ────────────────────────────────────────────────────

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
    e.preventDefault();
    doSaveAs();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (activeFileIdx >= 0 || standaloneHandle) doSave();
    else doSaveAs(); // No file open yet — prompt Save As
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "o") {
    e.preventDefault();
    if (typeof window.openLocalFile === "function") window.openLocalFile();
  }
});
