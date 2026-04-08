// app.js — Main orchestrator (Electron version)

import {
  cm,
  status,
  toggleWrap,
  registerOnSetValue,
  showLoading,
  hideLoading,
} from "./editor.js";
import { pagedReady } from "./assets.js";
import {
  openPreviewTab,
  previewPdf,
  previewFullMemoire,
  closePdfPanel,
  savePdfAs,
} from "./pdf-export.js";
import {
  triggerRender,
  scalePreview,
  registerOnSectionReady,
  getPreviewFrame,
  clearRenderTimeout,
  scheduleRender,
  zoomIn, zoomOut, zoomReset,
} from "./render.js";
import {
  setupPreviewClick,
  setupScrollSync,
  rebuildAnchorMap,
} from "./sync.js";
import {
  refreshTableWidgets,
  insertTable,
  getTableRangeAt,
  toggleTableEditor,
  setTableRangesDirty,
  twSyncing,
  tableWidgets,
  destroyTableWidget,
} from "./table-widget.js";
import {
  openFolder,
  openFolderByPath,
  closeFolder,
  renderFileList,
  readFile,
  writeFile,
  getFileModTime,
  saveWithConflictDetection,
  showSaveAsDialog,
  showOpenFileDialog,
  addRecentFile,
  applyPrettify,
  updateTitle,
  getFolderPath,
  getFileEntries,
  createNewFile,
  refreshFileList,
} from "./file-manager.js";
import {
  openTab,
  closeActiveTab,
  getActiveTab,
  getTabs,
  hasOpenTabs,
  markActiveTabClean,
  updateActiveTabPath,
  isActiveTabDirty,
  findTabByPath,
} from "./tab-bar.js";
import { closeDiffModal, resolveConflict } from "./diff-merge.js";
import {
  init as initAiCollab, addAgent,
  getConnectedAgents, sendRequest, sendAnswer,
  onConversationUpdate, getConversation, onAgentClick, onAgentsChanged,
} from "./ai-collab.js";
import {
  show as showChat, hide as hideChat, setAgents as setChatAgents,
  focusWithContext, focusForAgent, refresh as refreshChat,
  onSend as onChatSend, onAnswer as onChatAnswer,
  setGetConversation, setGetSection,
} from './chat-sidebar.js';
import { buildOutline, updateOutlineHighlight } from "./outline-manager.js";
import { tryRestore as _tryRestore, buildRecentUI as _buildRecentUI } from "./session.js";
import { setupKeyboardShortcuts, wireElectronMenus } from "./keyboard-shortcuts.js";
import {
  hideWelcome, showWelcome, initMenubar,
  updateMenuState as _updateMenuState,
} from "./menu-state.js";
import {
  wireTabCallbacks, wireSidebarCallbacks,
  onChangeDirtyTracking,
} from "./tab-wiring.js";
import {
  initFileOps, openFilePath, reloadTabFromDisk, doSave, doSaveAs,
  closeCurrentTab, openLocalFile, openFolderAndLoadFirst, openFolderByPathAndLoad,
} from "./file-ops.js";
import {
  updateGutterMarkers as _updateGutterMarkers,
  applyPageBreakMarks,
  applyHeadingMarks as _applyHeadingMarks,
  getCursorLine,
  setCursorLine,
} from "./editor-decorations.js";
import "./resize.js";

const api = window.electronAPI;

// ── Initialize file operations module ──────────────────────────────────────
// (deferred: initFileOps called after all local functions are defined)

// ── Tab lifecycle & sidebar wiring (delegated to tab-wiring.js) ────────────

function detachCmListeners() {
  cm.off("change", onChangeAutoRender);
  cm.off("change", onChangeDirtyTracking);
  cm.off("change", onChangeGutterMarkers);
  cm.off("change", onChangePageBreaks);
  cm.off("change", onChangeHeadingBadges);
  cm.off("change", onChangeOutline);
  cm.off("cursorActivity", onCursorPageBreaks);
  cm.off("cursorActivity", onCursorHeadingBadges);
  cm.off("cursorActivity", updateOutlineHighlight);
  cm.off("scroll", updateOutlineHighlight);
}

function reattachCmListeners() {
  cm.on("change", onChangeAutoRender);
  cm.on("change", onChangeDirtyTracking);
  cm.on("change", onChangeGutterMarkers);
  cm.on("change", onChangePageBreaks);
  cm.on("change", onChangeHeadingBadges);
  cm.on("change", onChangeOutline);
  cm.on("cursorActivity", onCursorPageBreaks);
  cm.on("cursorActivity", onCursorHeadingBadges);
  cm.on("cursorActivity", updateOutlineHighlight);
  cm.on("scroll", updateOutlineHighlight);
}

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
registerOnSectionReady(() => {
  const frame = getPreviewFrame();
  if (frame) setupPreviewClick(frame);
  clearTimeout(_scaleTimer);
  clearTimeout(_anchorTimer);
  _scaleTimer = setTimeout(scalePreview, 300);
  _anchorTimer = setTimeout(rebuildAnchorMap, 350);
  setupScrollSync();
  setTimeout(refreshTableWidgets, 50);
});

let _anchorRebuildTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_anchorRebuildTimer);
  _anchorRebuildTimer = setTimeout(rebuildAnchorMap, 400);
});

// ── Auto-render on pause ───────────────────────────────────────────────────

let restoreDone = false;
let twRefreshTimer = null;

function onChangeAutoRender() {
  if (!restoreDone) return;
  clearRenderTimeout();
  status.textContent = "Typing...";
  scheduleRender(800);
  if (!twSyncing) {
    setTableRangesDirty();
    clearTimeout(twRefreshTimer);
    twRefreshTimer = setTimeout(refreshTableWidgets, 200);
  }
}
cm.on("change", onChangeAutoRender);

// ── Dirty tracking (delegated to tab-wiring.js) ──────────────────────────

cm.on("change", onChangeDirtyTracking);

// ── Editor decorations (delegated to editor-decorations.js) ────────────────

const updateGutterMarkers = () => _updateGutterMarkers(getActiveTab);
const applyHeadingMarks = () => _applyHeadingMarks(getActiveTab);

let gutterTimer = null;
function onChangeGutterMarkers() {
  if (!hasOpenTabs()) return;
  clearTimeout(gutterTimer);
  gutterTimer = setTimeout(updateGutterMarkers, 400);
}
cm.on("change", onChangeGutterMarkers);

let pageBreakTimer = null;
function onChangePageBreaks() {
  clearTimeout(pageBreakTimer);
  pageBreakTimer = setTimeout(applyPageBreakMarks, 150);
}
function onCursorPageBreaks() {
  applyPageBreakMarks();
}
cm.on("change", onChangePageBreaks);
cm.on("cursorActivity", onCursorPageBreaks);
setTimeout(applyPageBreakMarks, 200);

let headingBadgeTimer = null;
function onChangeHeadingBadges() {
  clearTimeout(headingBadgeTimer);
  headingBadgeTimer = setTimeout(applyHeadingMarks, 150);
}
function onCursorHeadingBadges() {
  const cur = cm.getCursor().line;
  if (cur !== getCursorLine()) {
    setCursorLine(cur);
    applyHeadingMarks();
  }
}
cm.on("change", onChangeHeadingBadges);
cm.on("cursorActivity", onCursorHeadingBadges);
setTimeout(applyHeadingMarks, 200);

// ── Format table button visibility ─────────────────────────────────────────

const btnFormatTable = document.getElementById("btnFormatTable");
if (btnFormatTable) {
  cm.on("cursorActivity", () => {
    btnFormatTable.style.display = getTableRangeAt(cm.getCursor().line)
      ? ""
      : "none";
  });
}

// ── Document outline ───────────────────────────────────────────────────────

// Outline: delegated to outline-manager.js
const _buildOutline = () => buildOutline(getActiveTab);

let outlineTimer = null;
function onChangeOutline() {
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(_buildOutline, 300);
}
cm.on("change", onChangeOutline);
cm.on("cursorActivity", updateOutlineHighlight);
cm.on("scroll", updateOutlineHighlight);
setTimeout(_buildOutline, 200);

// ── Wire tab & sidebar callbacks (delegated to tab-wiring.js) ─────────────

wireTabCallbacks({
  reattachCmListeners, detachCmListeners,
  updateGutterMarkers, applyHeadingMarks,
  buildOutline: _buildOutline, updateMenuState,
  hideWelcome, showWelcome, doSave, reloadTabFromDisk,
});

wireSidebarCallbacks({ hideWelcome, reloadTabFromDisk });

// ── Desktop-style menu bar (delegated to menu-state.js) ───────────────────

initMenubar();

// ── Drag & drop .md files ──────────────────────────────────────────────────

const cmEl = cm.getWrapperElement();
cmEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});
cmEl.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.name.endsWith(".md") && file.path) {
    e.preventDefault();
    e.stopPropagation();
    openFilePath(file.path);
  }
});

// ── Expose globals for onclick handlers in HTML ────────────────────────────

window.openLocalFile = openLocalFile;
window.openFolder = async () => {
  const result = await openFolder();
  await openFolderAndLoadFirst(result);
};
window.saveCurrentFile = () => {
  if (hasOpenTabs()) return doSave();
  return doSaveAs();
};
window.saveAs = doSaveAs;
window.insertTable = insertTable;
window.triggerRender = triggerRender;
window.openPreviewTab = openPreviewTab;
window.pdfViewerClose = closePdfPanel;
window.pdfViewerSaveAs = savePdfAs;
window.downloadPdf = () => {
  const tab = getActiveTab();
  previewPdf(tab ? tab.name : "document");
};
window.downloadFullMemoire = async () => {
  const entries = getFileEntries();
  if (!entries.length) return;
  const openTabs = getTabs();
  const sections = [];
  for (const entry of entries) {
    const tab = openTabs.find(t => t.path === entry.path);
    const markdown = tab ? tab.doc.getValue() : await readFile(entry.path);
    sections.push({ name: entry.name, markdown });
  }
  const folderName = getFolderPath()?.split("/").pop() || "memoire";
  await previewFullMemoire(sections, folderName);
};
window.previewZoomIn = () => {
  const pct = zoomIn();
  const el = document.getElementById("previewZoomLevel");
  if (el) el.textContent = pct + "%";
};
window.previewZoomOut = () => {
  const pct = zoomOut();
  const el = document.getElementById("previewZoomLevel");
  if (el) el.textContent = pct + "%";
};
window.previewZoomReset = () => {
  zoomReset();
  const el = document.getElementById("previewZoomLevel");
  if (el) el.textContent = "100%";
};
window.toggleWrap = toggleWrap;
window.toggleCover = () => {}; // no-op: single-section mode
window.toggleTableEditor = toggleTableEditor;
window.closeDiffModal = closeDiffModal;
window.resolveConflict = resolveConflict;
window.closeFolder = () => {
  closeFolder();
  renderFileList();
  updateMenuState();
  if (!hasOpenTabs()) showWelcome();
};
window.refreshSidebar = () => refreshFileList();
window.createNewFile = createNewFile;
window.closeFile = closeCurrentTab;
window.newDocument = newDocument;
window.newFromTemplate = newFromTemplate;
window.addAgent = addAgent;

// ── Initialize file-ops module with dependencies ──────────────────────────

initFileOps({
  cm, api, status,
  findTabByPath, openTab, showLoading, hideLoading,
  hideWelcome: () => hideWelcome(),
  triggerRender, readFile, getFileModTime, addRecentFile,
  buildRecentUI: () => buildRecentUI(),
  getActiveTab, applyPrettify, saveWithConflictDetection,
  markActiveTabClean, updateTitle, updateGutterMarkers, renderFileList,
  writeFile, updateActiveTabPath, showSaveAsDialog, showOpenFileDialog,
  closeActiveTab, openFolderByPath,
});

// ── Menu state (delegated to menu-state.js) ───────────────────────────────

function updateMenuState() {
  _updateMenuState(getActiveTab, hasOpenTabs, getFolderPath);
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

// ── Session restore & recent UI (delegated to session.js) ─────────────────

const sessionDeps = {
  openFolderByPath,
  openFilePath,
  readFile,
  getFileModTime,
  openTab,
  getFileEntries,
  closeFolder,
  findTabByPath,
};

function tryRestore() {
  return _tryRestore(sessionDeps);
}

function buildRecentUI() {
  return _buildRecentUI({ openFilePath, openFolderByPathAndLoad });
}

// ── Keyboard shortcuts & Electron menus (delegated to keyboard-shortcuts.js)

const shortcutActions = {
  doSave, doSaveAs, openLocalFile, newDocument, closeCurrentTab, hasOpenTabs,
  insertTable, triggerRender, openPreviewTab, toggleWrap,
  openFilePath, openFolderByPathAndLoad, buildRecentUI,
};
setupKeyboardShortcuts(shortcutActions);
wireElectronMenus(api, shortcutActions);

// ── Warn before closing with unsaved changes ───────────────────────────────

window.addEventListener("beforeunload", (e) => {
  if (isActiveTabDirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ── Startup ────────────────────────────────────────────────────────────────

pagedReady
  .then(async () => {
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

    // Wire chat sidebar
    setGetConversation((key) => getConversation(key));

    onChatSend((agentKey, prompt, context) => {
      const selection = context || { text: "", lineStart: 0, lineEnd: 0 };
      sendRequest(agentKey, prompt, selection);
      refreshChat();
    });

    onChatAnswer((agentKey, questionId, value) => {
      sendAnswer(agentKey, questionId, value);
    });

    onConversationUpdate(() => {
      refreshChat();
    });

    onAgentClick((key) => {
      showChat();
      focusForAgent(key);
    });

    onAgentsChanged((connectedAgents) => {
      setChatAgents(connectedAgents);
      if (connectedAgents.length > 0) showChat();
      else hideChat();
    });

    // Provide H1 section getter for auto-context
    setGetSection(() => {
      if (!cm.getValue()) return null;
      const cursorLine = cm.getCursor().line;
      let sectionStart = 0;
      let sectionEnd = cm.lineCount() - 1;
      let sectionTitle = "";
      for (let i = cursorLine; i >= 0; i--) {
        const m = cm.getLine(i)?.match(/^# (.+)/);
        if (m) {
          sectionStart = i;
          sectionTitle = m[1].trim();
          break;
        }
      }
      for (let i = sectionStart + 1; i < cm.lineCount(); i++) {
        if (/^# /.test(cm.getLine(i))) {
          sectionEnd = i - 1;
          break;
        }
      }
      const lines = [];
      for (let i = sectionStart; i <= sectionEnd; i++) lines.push(cm.getLine(i));
      return {
        text: lines.join("\n"),
        lineStart: sectionStart,
        lineEnd: sectionEnd,
        label: 'Section: "' + sectionTitle + '"',
      };
    });

    // Rewire spark button to focus chat
    const sparkBtn = document.getElementById("sparkBtn");
    if (sparkBtn) {
      cm.on("cursorActivity", () => {
        const sel = cm.getSelection();
        const connected = getConnectedAgents();
        if (!sel || connected.length === 0) {
          sparkBtn.classList.remove("visible");
          return;
        }
        const cursor = cm.getCursor("to");
        const coords = cm.cursorCoords(cursor, "page");
        sparkBtn.style.top = (coords.bottom + 4) + "px";
        sparkBtn.style.left = coords.left + "px";
        sparkBtn.classList.add("visible");
      });
      document.addEventListener("mouseup", () => {
        setTimeout(() => {
          const sel = cm.getSelection();
          const connected = getConnectedAgents();
          if (!sel || connected.length === 0) sparkBtn.classList.remove("visible");
        }, 10);
      });

      sparkBtn.onclick = () => {
        sparkBtn.classList.remove("visible");
        const from = cm.getCursor("from");
        const to = cm.getCursor("to");
        const text = cm.getSelection();
        if (!text) return;
        const context = { text, lineStart: from.line, lineEnd: to.line };

        const connected = getConnectedAgents();
        if (connected.length === 1) {
          focusForAgent(connected[0].key);
          focusWithContext(context);
        } else if (connected.length > 1) {
          showChat();
          focusWithContext(context);
        }
      };
    }
  })
  .catch((e) => {
    hideLoading();
    if (status) status.textContent = "Startup error: " + e.message;
    console.error("pagedReady failed:", e);
  });
