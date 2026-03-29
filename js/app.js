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
  openFolder, openFolderByPath, closeFolder, renderFileList,
  readFile, writeFile, getFileModTime, saveWithConflictDetection,
  showSaveAsDialog, showOpenFileDialog, addRecentFile,
  applyPrettify, updateTitle, getFolderPath, getFileEntries,
  setOnFileClick, setGetActiveFilePath,
} from './file-manager.js';
import {
  openTab, closeActiveTab, getActiveTab,
  hasOpenTabs, markActiveTabDirty, markActiveTabClean,
  updateActiveTabPath, isActiveTabDirty,
  onTabSwitch, onAllTabsClosed, getSessionState, findTabByPath,
} from './tab-bar.js';
import { closeDiffModal, resolveConflict } from './diff-merge.js';
import { init as initAiCollab, addAgent } from './ai-collab.js';
import './resize.js';

const api = window.electronAPI;

// ── Persist tab state (debounced) ──────────────────────────────────────────

function persistTabState() {
  const session = getSessionState();
  api.setAppState({ openTabs: session.openTabs, activeTab: session.activeTab });
}

let persistTimer = null;
function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistTabState, 500);
}

// ── Wire tab-bar callbacks ─────────────────────────────────────────────────

onTabSwitch((tab) => {
  updateTitle(tab.name, tab.dirty);
  renderFileList(); // update sidebar highlight
  triggerRender();
  setTimeout(buildOutline, 50);
  setTimeout(refreshTableWidgets, 50);
  updateMenuState();
  schedulePersist();
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
  schedulePersist();
});

// ── Wire sidebar → tab-bar ─────────────────────────────────────────────────

setOnFileClick(async (filePath, fileName) => {
  // Check if already open in a tab
  const existingIdx = findTabByPath(filePath);
  if (existingIdx >= 0) {
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
