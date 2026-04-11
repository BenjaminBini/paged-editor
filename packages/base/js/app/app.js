// app.js — Main orchestrator (Electron version)

import {
  cm,
  status,
  toggleWrap,
  hideLoading,
} from "../editor/editor.js";
import { on as busOn } from "../core/event-bus.js";
import { pagedReady } from "../core/assets.js";
import {
  openPreviewTab,
  previewPdf,
  previewFullMemoire,
  closePdfPanel,
  savePdfAs,
} from "../memoire/export/pdf-export.js";
import {
  triggerRender,
  scalePreview,
  getPreviewFrame,
  clearRenderTimeout,
  scheduleRender,
  zoomIn, zoomOut, zoomReset,
} from "../memoire/render.js";
import {
  setupPreviewClick,
  setupScrollSync,
  rebuildAnchorMap,
} from "../memoire/sync/sync.js";
import {
  refreshTableWidgets,
  insertTable,
  getTableRangeAt,
  toggleTableEditor,
  setTableRangesDirty,
  twSyncing,
  tableWidgets,
  destroyTableWidget,
} from "../editor/table-widget.js";
import {
  openFolder,
  closeFolder,
  renderFileList,
  readFile,
  getFolderPath,
  getFileEntries,
  createNewFile,
  refreshFileList,
} from "../workspace/file-manager.js";
import { saveImageAsset } from "../workspace/workspace-assets.js";
import {
  openTab,
  getActiveTab,
  getTabs,
  hasOpenTabs,
  onAllTabsCloseRequest,
  onTabCloseRequest,
  onTabsToLeftCloseRequest,
  onTabsToRightCloseRequest,
} from "../workspace/tab-bar.js";
import { closeDiffModal, resolveConflict } from "../workspace/diff-merge.js";
import {
  init as initAiCollab, addAgent,
  getConnectedAgents, sendRequest, sendAnswer,
  onConversationUpdate, getConversation, onAgentClick, onAgentsChanged,
} from "../collaboration/ai-collab.js";
import {
  show as showChat, hide as hideChat, setAgents as setChatAgents,
  focusWithContext, focusForAgent, refresh as refreshChat,
  onSend as onChatSend, onAnswer as onChatAnswer,
  setGetConversation, setGetSection,
} from '../collaboration/chat-sidebar.js';
import { buildOutline, updateOutlineHighlight } from "../editor/outline-manager.js";
import { tryRestore, buildRecentUI } from "./session.js";
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
  requestCloseAllTabs, requestCloseTab, requestCloseTabsToLeft, requestCloseTabsToRight,
  requestWindowClose,
} from "../workspace/file-ops.js";
import { initFormattingToolbar } from "../editor/formatting-toolbar.js";
import {
  updateGutterMarkers as _updateGutterMarkers,
  applyPageBreakMarks,
  applyHeadingMarks as _applyHeadingMarks,
  getCursorLine,
  setCursorLine,
  resetPageBreakCache,
} from "../editor/editor-decorations.js";
import "./resize.js";
import * as platform from "../core/platform.js";
import { isMarkdownTab } from "../memoire/model/memoire-views.js";

// ── Initialize file operations module ──────────────────────────────────────
// (deferred: initFileOps called after all local functions are defined)

// ── Tab lifecycle & sidebar wiring (delegated to tab-wiring.js) ────────────

function detachCmListeners() {
  cm.off("change", onChangeAutoRender);
  cm.off("change", onChangeDirtyTracking);
  cm.off("change", onChangeDecorations);
  cm.off("cursorActivity", onCursorDecorations);
  cm.off("scroll", updateOutlineHighlight);
}

function reattachCmListeners() {
  cm.on("change", onChangeAutoRender);
  cm.on("change", onChangeDirtyTracking);
  cm.on("change", onChangeDecorations);
  cm.on("cursorActivity", onCursorDecorations);
  cm.on("scroll", updateOutlineHighlight);
}

function isEditableMarkdownContext() {
  return isMarkdownTab(getActiveTab());
}

// ── Event bus subscriptions ────────────────────────────────────────────────

busOn("content-loaded", () => {
  if (cm.getValue()) hideWelcome();
  else if (!hasOpenTabs()) showWelcome();
  for (const tw of tableWidgets.values()) destroyTableWidget(tw);
  if (isEditableMarkdownContext()) {
    setTableRangesDirty();
    setTimeout(refreshTableWidgets, 50);
  }
  setTimeout(updateMenuState, 0);
});

let _scaleTimer = null;
let _anchorTimer = null;
busOn("section-ready", () => {
  const frame = getPreviewFrame();
  if (frame && isEditableMarkdownContext()) setupPreviewClick(frame);
  clearTimeout(_scaleTimer);
  clearTimeout(_anchorTimer);
  _scaleTimer = setTimeout(scalePreview, 300);
  if (isEditableMarkdownContext()) {
    _anchorTimer = setTimeout(rebuildAnchorMap, 350);
    setupScrollSync();
    setTimeout(refreshTableWidgets, 50);
  }
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
  if (!twSyncing && isEditableMarkdownContext()) {
    setTableRangesDirty();
    clearTimeout(twRefreshTimer);
    twRefreshTimer = setTimeout(refreshTableWidgets, 200);
  }
}
cm.on("change", onChangeAutoRender);

// ── Dirty tracking (delegated to tab-wiring.js) ──────────────────────────

cm.on("change", onChangeDirtyTracking);

// ── Editor decorations ─────────────────────────────────────────────────────
// Consolidated: one debounced handler for all cm.change decoration updates,
// one handler for cursorActivity. Replaces 5 independent timers.

const updateGutterMarkers = () => _updateGutterMarkers(getActiveTab);
const applyHeadingMarks = () => _applyHeadingMarks(getActiveTab);
const _buildOutline = () => buildOutline(getActiveTab);

const btnFormatTable = document.getElementById("btnFormatTable");

let _decorTimer = null;
function onChangeDecorations() {
  if (!hasOpenTabs() || !isEditableMarkdownContext()) return;
  resetPageBreakCache();
  clearTimeout(_decorTimer);
  _decorTimer = setTimeout(() => {
    applyPageBreakMarks();       // 1. page break widgets
    applyHeadingMarks();         // 2. heading number badges
    _buildOutline();             // 3. document outline
    updateGutterMarkers();       // 4. gutter change markers (heaviest — last)
  }, 200);
}

function onCursorDecorations() {
  if (!isEditableMarkdownContext()) {
    if (btnFormatTable) btnFormatTable.style.display = "none";
    return;
  }
  // Page breaks: re-apply when cursor moves to/from a \newpage line
  applyPageBreakMarks();
  // Heading badges: re-apply when cursor line changes
  const cur = cm.getCursor().line;
  if (cur !== getCursorLine()) {
    setCursorLine(cur);
    applyHeadingMarks();
  }
  // Outline highlight
  updateOutlineHighlight();
  // Table format button
  if (btnFormatTable) {
    btnFormatTable.style.display = getTableRangeAt(cm.getCursor().line) ? "" : "none";
  }
}

cm.on("change", onChangeDecorations);
cm.on("cursorActivity", onCursorDecorations);
cm.on("scroll", updateOutlineHighlight);
setTimeout(() => { applyPageBreakMarks(); applyHeadingMarks(); _buildOutline(); }, 200);

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
initFormattingToolbar();

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

cmEl.addEventListener("paste", async (e) => {
  const imageFiles = Array.from(e.clipboardData?.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);

  if (!imageFiles.length) return;

  e.preventDefault();
  e.stopPropagation();

  const tab = getActiveTab();
  if (!tab?.path) {
    status.textContent = "Save the Markdown file before pasting images";
    return;
  }

  const assets = [];
  for (const file of imageFiles) {
    try {
      assets.push(await saveImageAsset(tab.path, file));
    } catch (err) {
      status.textContent = "Failed to paste image: " + err.message;
      return;
    }
  }

  if (!assets.length) {
    status.textContent = "Clipboard image could not be read";
    return;
  }

  cm.operation(() => {
    const markdown = assets
      .map((asset) => `![${asset.altText}](${asset.markdownPath})`)
      .join("\n\n");
    cm.replaceSelection(markdown);
    cm.focus();
  });

  status.textContent = assets.length === 1
    ? "Pasted image as " + assets[0].markdownPath
    : "Pasted " + assets.length + " images";
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
  const activeTab = getActiveTab();
  const sections = [];
  for (const entry of entries) {
    const tab = openTabs.find(t => t.path === entry.path);
    const markdown = tab
      ? (activeTab?.path === entry.path ? cm.getValue() : tab.editorState?.content || tab.savedContent || "")
      : await readFile(entry.path);
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

// ── Initialize file-ops (only late-bound callbacks that can't be imported) ──

initFileOps({ buildRecentUI });
onTabCloseRequest(requestCloseTab);
onTabsToLeftCloseRequest(requestCloseTabsToLeft);
onTabsToRightCloseRequest(requestCloseTabsToRight);
onAllTabsCloseRequest(requestCloseAllTabs);

// Notify parent frame (React component) on save
busOn("file-saved", ({ file, name }) => {
  if (window.__pagedEditorNotifyParent) {
    window.__pagedEditorNotifyParent("save", { file, name });
  }
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

// session.js now imports its own deps directly — no wrappers needed

// ── Keyboard shortcuts & Electron menus (delegated to keyboard-shortcuts.js)

const shortcutActions = {
  doSave, doSaveAs, openLocalFile, newDocument, closeCurrentTab, hasOpenTabs,
  insertTable, triggerRender, openPreviewTab, toggleWrap,
  openFilePath, openFolderByPathAndLoad, buildRecentUI,
};
setupKeyboardShortcuts(shortcutActions);
wireElectronMenus(platform, shortcutActions);

// ── Close interception ─────────────────────────────────────────────────────

if (platform.isWebMode) {
  window.addEventListener("beforeunload", (e) => {
    if (getTabs().some((tab) => tab.dirty)) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
} else {
  platform.on("window-close-requested", () => {
    requestWindowClose();
  });
}

// ── Startup ────────────────────────────────────────────────────────────────

pagedReady
  .then(async () => {
    const hasStartupPath = await platform.hasStartupPath();
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
