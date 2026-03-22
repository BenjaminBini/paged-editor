// app.js — Main orchestrator
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
  openFolder, saveCurrentFile, doSaveAs, isDirty,
  activateFolder, setDirHandle, setStorageMode,
  activeFileIdx, storageMode, idbGet, idbSet, setStandaloneHandle,
} from './file-manager.js';
import { openGoogleDrive, openDriveFile, tryRestoreGdrive, restoreDriveFile, saveGoogleSettings, closeFolder } from './google-drive.js';
import { closeDiffModal, resolveConflict } from './diff-merge.js';
import './resize.js'; // self-initializing

// ── Wire hooks ──────────────────────────────────────────────────────────────

// When cm.setValue is called, destroy stale widgets, refresh, dismiss welcome, update menus
registerOnSetValue(() => {
  hideWelcome();
  for (const tw of tableWidgets.values()) destroyTableWidget(tw);
  setTimeout(refreshTableWidgets, 50);
  setTimeout(updateMenuState, 0);
});

// When a section finishes rendering in its iframe
let _scaleTimer = null;
let _anchorTimer = null;
registerOnSectionReady((sectionIdx) => {
  const state = getSectionStates()[sectionIdx];
  // Setup click handler for the section that just rendered
  if (state?.frame) {
    setupPreviewClick(state.frame);
  }
  // Debounce scale + anchor rebuild to avoid flicker from multiple section-ready events
  clearTimeout(_scaleTimer);
  clearTimeout(_anchorTimer);
  _scaleTimer = setTimeout(scalePreview, 300);
  _anchorTimer = setTimeout(rebuildAnchorMap, 350);
  setupScrollSync();
  setTimeout(refreshTableWidgets, 50);
});

// Rebuild anchor map after window resize (scale changes Y positions)
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
  // Refresh table widgets when user edits markdown directly
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
let outlineHeadings = []; // [{line, level, text}]
let stuckObserver = null;

function buildOutline() {
  outlineHeadings = [];
  for (let i = 0; i < cm.lineCount(); i++) {
    const m = cm.getLine(i)?.match(/^(#{1,4}) (.+)/);
    if (m) outlineHeadings.push({ line: i, level: m[1].length, text: m[2].trim() });
  }

  if (!outlineList) return;

  // Disconnect previous observer
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

    // Track sticky items (h1, h2, h3) for stuck detection
    if (h.level <= 3) stickyItems.push(el);
  });

  // Observe sticky items to toggle .stuck class
  if (stickyItems.length > 0) {
    stuckObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          // When the element's top edge is at or above its sticky offset,
          // it's not fully intersecting → it's stuck
          entry.target.classList.toggle('stuck', entry.intersectionRatio < 1);
        });
      },
      { root: outlineList, threshold: 1.0 }
    );
    stickyItems.forEach(el => stuckObserver.observe(el));
  }

  // Show outline section in sidebar (even without a folder open)
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

  // Find which headings are "visible" (their section overlaps the viewport)
  let firstVisible = -1, lastVisible = -1;
  for (let i = 0; i < outlineHeadings.length; i++) {
    const sectionStart = outlineHeadings[i].line;
    const sectionEnd = (i + 1 < outlineHeadings.length) ? outlineHeadings[i + 1].line - 1 : cm.lineCount() - 1;
    if (sectionEnd >= topLine && sectionStart <= bottomLine) {
      if (firstVisible < 0) firstVisible = i;
      lastVisible = i;
    }
  }

  // Find the heading that contains the cursor
  let activeIdx = -1;
  for (let i = outlineHeadings.length - 1; i >= 0; i--) {
    if (outlineHeadings[i].line <= cursorLine) { activeIdx = i; break; }
  }

  // Find the center line of the viewport
  const centerLine = cm.lineAtHeight(info.top + info.clientHeight / 2, "local");

  // Compute proximity to center for each visible heading (0 = edge, 1 = center)
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

  // Skip DOM update if nothing changed
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

  // Center visible range in the outline panel
  if (firstVisible >= 0 && items[firstVisible] && items[lastVisible]) {
    const firstEl = items[firstVisible];
    const lastEl = items[lastVisible];
    const rangeTop = firstEl.offsetTop - outlineList.offsetTop;
    const rangeBottom = lastEl.offsetTop - outlineList.offsetTop + lastEl.offsetHeight;
    const rangeCenter = (rangeTop + rangeBottom) / 2;
    outlineList.scrollTop = rangeCenter - outlineList.clientHeight / 2;
  }
}

// Rebuild outline on content change (debounced)
let outlineTimer = null;
cm.on("change", () => {
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(buildOutline, 300);
});

// Update highlight on cursor move and scroll
cm.on("cursorActivity", updateOutlineHighlight);
cm.on("scroll", updateOutlineHighlight);

// Build initial outline after startup
setTimeout(buildOutline, 200);

// ── Desktop-style menu bar ──────────────────────────────────────────────────

(function initMenubar() {
  const menubar = document.querySelector('.menubar');
  if (!menubar) return;

  // Create click-away backdrop
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

  // Click trigger to toggle
  menubar.querySelectorAll('.menu-trigger').forEach(trigger => {
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const item = trigger.closest('.menu-item');
      if (openMenu === item) { closeAll(); } else { openItem(item); }
    });
  });

  // Hover to switch when a menu is already open
  menubar.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      if (openMenu && openMenu !== item) openItem(item);
    });
  });

  // Click dropdown item closes menu
  menubar.querySelectorAll('.menu-dropdown button').forEach(btn => {
    btn.addEventListener('click', () => closeAll());
  });

  // Backdrop closes menus
  backdrop.addEventListener('click', closeAll);

  // Escape closes menus
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openMenu) closeAll();
  });
})();

// ── Drag & drop .md files ───────────────────────────────────────────────────

const cmEl = cm.getWrapperElement();
cmEl.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
cmEl.addEventListener("drop", e => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.name.endsWith(".md")) {
    e.preventDefault();
    e.stopPropagation();
    const reader = new FileReader();
    reader.onload = ev => { cm.setValue(ev.target.result); triggerRender(); };
    reader.readAsText(file);
  }
});

// ── Warn before closing with unsaved changes ────────────────────────────────

window.addEventListener("beforeunload", e => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ── Expose globals for onclick handlers in HTML ─────────────────────────────
// (toolbar buttons use onclick="functionName()")

// ── Open single file (File System Access API) ──────────────────────────────

let isUrlDocument = false; // true when file loaded from URL (read-only, no Save)

async function openLocalFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      multiple: false,
    });
    showLoading("Loading " + handle.name + "...");
    const file = await handle.getFile();
    const text = await file.text();
    setStandaloneHandle(handle, text);
    isUrlDocument = false;
    cm.setValue(text);
    cm.clearHistory();
    hideLoading();
    document.getElementById("paneFileName").textContent = handle.name;
    document.title = handle.name + " — Paged.js Editor";
    // Persist handle with unique ID so refresh re-opens the file
    const fileId = crypto.randomUUID();
    try {
      await idbSet("file:" + fileId, handle);
    } catch(e) { console.warn("Failed to persist file handle:", e); }
    const url = new URL(location.href);
    url.searchParams.set("file", fileId);
    history.replaceState(null, "", url);
    triggerRender();
  } catch(e) {
    hideLoading();
    if (e.name !== 'AbortError') console.warn("Open file failed:", e);
  }
}

function openUrl() {
  const current = urlParams.get("file") || "";
  const path = prompt("URL or path to open:", current);
  if (!path) return;
  const url = new URL(location.href);
  url.searchParams.set("file", path);
  location.href = url.toString();
}

window.openLocalFile = openLocalFile;
window.openUrl = openUrl;
window.openDriveFile = openDriveFile;
window.openFolder = openFolder;
window.openGoogleDrive = openGoogleDrive;
window.saveCurrentFile = () => {
  if (isUrlDocument) return doSaveAs();
  return saveCurrentFile();
};
window.saveAs = doSaveAs;
window.insertTable = insertTable;
window.triggerRender = triggerRender;
window.openPreviewTab = openPreviewTab;
window.toggleWrap = toggleWrap;
window.saveGoogleSettings = saveGoogleSettings;
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

const hasFileSystemAccess = typeof window.showOpenFilePicker === "function";

function updateMenuState() {
  const hasContent = !!cm.getValue();
  const hasFile = activeFileIdx >= 0 || isUrlDocument;
  const hasFolder = storageMode === "local" || storageMode === "gdrive";
  const canSave = hasFile && !isUrlDocument;

  const set = (id, enabled) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  };

  // File menu
  set("btnOpenLocal", hasFileSystemAccess);
  set("btnOpenFolder", hasFileSystemAccess);
  set("welcomeOpenLocal", hasFileSystemAccess);
  set("welcomeOpenFolder", hasFileSystemAccess);
  set("btnSave", canSave);
  set("btnSaveAs", hasContent);
  set("btnCloseFile", hasContent);
  set("btnCloseFolder", hasFolder);

  // Edit menu
  set("btnInsertTable", hasContent);
  set("btnUndo", hasContent);
  set("btnRedo", hasContent);

  // View menu
  set("btnRender", hasContent);
  set("btnPreviewTab", hasContent);
  set("btnToggleWrap", true);
}

function closeFile() {
  if (isDirty() && !confirm("Discard unsaved changes?")) return;
  isUrlDocument = false;
  setStandaloneHandle(null, "");
  cm.setValue("");
  cm.clearHistory();
  document.getElementById("paneFileName").textContent = "";
  document.title = "Paged.js Editor";
  const url = new URL(location.href);
  url.searchParams.delete("file");
  url.searchParams.delete("driveFile");
  history.replaceState(null, "", url);
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
  cm.setCursor({ line: 1, ch: 8 }); // inside title quotes
  cm.focus();
  document.getElementById("paneFileName").textContent = "";
  document.title = "New Document — Paged.js Editor";
}

const BEORN_TEMPLATE = `---
title: "Project Name — Document Title"
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
  document.title = "New Document — Paged.js Editor";
  triggerRender();
}

// ── Restore folder on page load ─────────────────────────────────────────────

async function tryRestore() {
  // All restore logic is driven by URL params — no params means nothing to restore

  // ?file=<uuid> → local file handle from IndexedDB
  const fileId = urlParams.get("file");
  if (fileId && /^[0-9a-f]{8}-/i.test(fileId)) {
    try {
      const handle = await idbGet("file:" + fileId);
      if (handle && handle.kind === "file") {
        const perm = await handle.requestPermission({ mode: "readwrite" });
        if (perm === "granted") {
          showLoading("Loading " + handle.name + "...");
          const file = await handle.getFile();
          const text = await file.text();
          setStandaloneHandle(handle, text);
          isUrlDocument = false;
          cm.setValue(text);
          cm.clearHistory();
          document.getElementById("paneFileName").textContent = handle.name;
          document.title = handle.name + " — Paged.js Editor";
          triggerRender();
          return;
        }
      }
      // Handle not found or permission denied — clear stale param
      const url = new URL(location.href);
      url.searchParams.delete("file");
      history.replaceState(null, "", url);
    } catch(e) { console.warn("Standalone file restore failed:", e); }
    return;
  }

  // ?folder=local → local folder handle from IndexedDB
  if (urlParams.get("folder") === "local") {
    try {
      const stored = await idbGet("dirHandle");
      if (stored) {
        const perm = await stored.requestPermission({ mode: "readwrite" });
        if (perm === "granted") {
          setDirHandle(stored);
          setStorageMode("local");
          const restoreFile = await idbGet("activeFile");
          await activateFolder(restoreFile || null);
          return;
        }
      }
      // Handle not found or permission denied — clear stale param
      const url = new URL(location.href);
      url.searchParams.delete("folder");
      history.replaceState(null, "", url);
    } catch(e) {}
    return;
  }

  // ?driveFile=<id> → single Google Drive file
  const driveFileId = urlParams.get("driveFile");
  if (driveFileId) {
    try {
      const restored = await restoreDriveFile(driveFileId);
      if (restored) { isUrlDocument = true; return; }
    } catch(e) { console.warn("Drive file restore failed:", e.message); }
    return;
  }

  // ?driveFolder=<id> → Google Drive folder
  if (urlParams.has("driveFolder")) {
    try {
      const restored = await tryRestoreGdrive();
      if (restored) return;
    } catch(e) { console.warn("GDrive restore failed:", e.message); }
  }
}

// ── Startup ─────────────────────────────────────────────────────────────────

// ── Load file from URL parameter (?file=path/to/file.md) ────────────────────

const urlParams = new URLSearchParams(location.search);
const viewOnly = urlParams.get("editor") === "false";

async function tryLoadFromUrl() {
  const fileUrl = urlParams.get("file");
  if (!fileUrl) return false;
  // Skip if it's a stored handle ID (UUID), not a fetchable URL/path
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileUrl)) return false;
  // Skip if driveFile/driveFolder params are present (handled by tryRestore)
  if (urlParams.has("driveFile") || urlParams.has("driveFolder")) return false;
  try {
    showLoading("Loading " + fileUrl + "...");
    const r = await fetch(fileUrl);
    if (!r.ok) throw new Error(r.status + " " + r.statusText);
    const text = await r.text();
    isUrlDocument = true;
    cm.setValue(text);
    cm.clearHistory();
    const name = fileUrl.split("/").pop() || "document.md";
    document.getElementById("paneFileName").textContent = name;
    document.title = name + " — Paged.js Editor";
    triggerRender();
    return true;
  } catch (e) {
    console.warn("Failed to load ?file=", fileUrl, e);
    status.textContent = "Failed to load " + fileUrl;
    return false;
  }
}

// ── View-only mode (?editor=false) ──────────────────────────────────────────

function activateViewOnly() {
  document.querySelector(".toolbar")?.remove();
  document.getElementById("fileSidebar")?.remove();
  document.getElementById("editorPane")?.remove();
  document.getElementById("resizeHandle")?.remove();
  // Adjust layout: preview takes full space, no toolbar offset
  const container = document.querySelector(".container");
  if (container) container.style.height = "100%";
}

pagedReady.then(async () => {
  if (viewOnly) activateViewOnly();
  // URL parameter takes priority
  const loaded = await tryLoadFromUrl();
  if (!loaded) {
    await tryRestore();
  }
  hideLoading();
  // Show welcome screen if nothing was loaded
  if (activeFileIdx < 0 && !cm.getValue()) {
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
