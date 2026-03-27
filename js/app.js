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
  openFolder, openFolderByPath, doSaveAs, doSave, isDirty,
  activateFolder, closeFolder,
  setStandaloneFile, activeFileIdx, folderPath, standaloneFilePath,
} from './file-manager.js';
import { closeDiffModal, resolveConflict } from './diff-merge.js';
import './resize.js';

const api = window.electronAPI;

// ── Wire hooks ──────────────────────────────────────────────────────────────

registerOnSetValue(() => {
  if (cm.getValue()) hideWelcome();
  else showWelcome();
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

// ── Desktop-style menu bar ──────────────────────────────────────────────────

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

// ── Open a file by path ─────────────────────────────────────────────────────

async function openFilePath(filePath) {
  try {
    showLoading("Loading...");
    const text = await api.readFile(filePath);
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
    const state = await api.getAppState();
    const recent = [filePath, ...(state.recentFiles || []).filter(f => f !== filePath)].slice(0, 10);
    await api.setAppState({ lastFile: filePath, recentFiles: recent });
    buildRecentUI();
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
window.toggleCover = toggleCover;
window.toggleTableEditor = toggleTableEditor;
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

// ── Recent items UI ─────────────────────────────────────────────────────────

async function buildRecentUI() {
  const state = await api.getAppState();
  const recentFiles = state.recentFiles || [];
  const recentFolders = state.recentFolders || [];

  // File menu submenu
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

  // Welcome screen
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

      const folderIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>';
      const fileIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5M10 9H8m8 4H8m8 4H8"/></svg>';

      function parentDir(p) {
        const parts = p.split("/");
        parts.pop();
        return parts.length > 3 ? ".../" + parts.slice(-2).join("/") : parts.join("/");
      }

      if (recentFolders.length > 0) {
        const label = document.createElement("div");
        label.className = "welcome-recent-label";
        label.textContent = "Folders";
        welcomeFolders.appendChild(label);
        for (const f of recentFolders) {
          const link = document.createElement("button");
          link.className = "recent-link";
          link.innerHTML = folderIcon + '<span class="recent-name">' + f.split("/").pop() + '</span><span class="recent-path">' + parentDir(f) + '</span>';
          link.title = f;
          link.onclick = () => openFolderByPath(f);
          welcomeFolders.appendChild(link);
        }
      }
      if (recentFiles.length > 0) {
        const label = document.createElement("div");
        label.className = "welcome-recent-label";
        label.textContent = "Files";
        welcomeFiles.appendChild(label);
        for (const f of recentFiles) {
          const link = document.createElement("button");
          link.className = "recent-link";
          link.innerHTML = fileIcon + '<span class="recent-name">' + f.split("/").pop() + '</span><span class="recent-path">' + parentDir(f) + '</span>';
          link.title = f;
          link.onclick = () => openFilePath(f);
          welcomeFiles.appendChild(link);
        }
      }
    }
  }
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
  api.on("menu-toggle-cover", () => toggleCover());
  api.on("open-file-path", (filePath) => openFilePath(filePath));
  api.on("open-folder-path", (folderPath) => openFolderByPath(folderPath));
  api.on("recent-cleared", () => buildRecentUI());
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
  buildRecentUI();
}).catch(e => {
  hideLoading();
  if (status) status.textContent = "Startup error: " + e.message;
  console.error("pagedReady failed:", e);
});
