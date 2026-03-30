// app.js — Main orchestrator (Electron version)

import {
  cm,
  status,
  toggleWrap,
  registerOnSetValue,
  showLoading,
  hideLoading,
} from "./editor.js";
import {
  pagedReady,
  triggerRender,
  scalePreview,
  openPreviewTab,
  registerOnSectionReady,
  getPreviewFrame,
  clearRenderTimeout,
  scheduleRender,
  setActiveFileName,
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
  setOnFileClick,
  setGetActiveFilePath,
  setIsFileDirty,
} from "./file-manager.js";
import {
  openTab,
  closeActiveTab,
  getActiveTab,
  getTabs,
  hasOpenTabs,
  markActiveTabDirty,
  markActiveTabClean,
  updateActiveTabPath,
  isActiveTabDirty,
  onTabSwitch,
  onAllTabsClosed,
  getSessionState,
  findTabByPath,
} from "./tab-bar.js";
import { closeDiffModal, resolveConflict, computeDiff } from "./diff-merge.js";
import { init as initAiCollab, addAgent } from "./ai-collab.js";
import "./resize.js";

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
  setActiveFileName(tab.name);
  triggerRender();
  setTimeout(buildOutline, 50);
  setTimeout(refreshTableWidgets, 150);
  setTimeout(updateGutterMarkers, 50);
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

setIsFileDirty((path) => {
  const idx = findTabByPath(path);
  if (idx < 0) return false;
  return getTabs()[idx].dirty;
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

window.addEventListener("resize", () => setTimeout(rebuildAnchorMap, 400));

// ── Auto-render on pause ───────────────────────────────────────────────────

let restoreDone = false;
let twRefreshTimer = null;

cm.on("change", () => {
  if (!restoreDone) return;
  clearRenderTimeout();
  status.textContent = "Typing...";
  scheduleRender(800);
  if (!twSyncing) {
    setTableRangesDirty();
    clearTimeout(twRefreshTimer);
    twRefreshTimer = setTimeout(refreshTableWidgets, 200);
  }
});

// ── Dirty tracking ─────────────────────────────────────────────────────────

let sidebarDirtyTimer = null;
cm.on("change", () => {
  if (!hasOpenTabs()) return;
  markActiveTabDirty();
  const tab = getActiveTab();
  if (tab) updateTitle(tab.name, true);
  clearTimeout(sidebarDirtyTimer);
  sidebarDirtyTimer = setTimeout(renderFileList, 300);
});

// ── Gutter change markers ──────────────────────────────────────────────────

let gutterTimer = null;
const GUTTER_MODIFIED = "gutter-modified";
const GUTTER_ADDED = "gutter-added";

function updateGutterMarkers() {
  const tab = getActiveTab();
  if (!tab) return;

  // Clear all existing markers
  cm.eachLine((lineHandle) => {
    cm.removeLineClass(lineHandle, "gutter", GUTTER_MODIFIED);
    cm.removeLineClass(lineHandle, "gutter", GUTTER_ADDED);
  });

  const savedLines = (tab.savedContent || "").split("\n");
  const currentLines = cm.getValue().split("\n");
  const diff = computeDiff(savedLines, currentLines);

  // Walk the diff to find modified and added lines in current content.
  // A "del" followed by "add" at the same position = modified line.
  // A standalone "add" = new line.
  const modifiedLines = new Set();
  const addedLines = new Set();

  let i = 0;
  while (i < diff.length) {
    if (diff[i].type === "del") {
      // Collect consecutive deletes
      const delStart = i;
      while (i < diff.length && diff[i].type === "del") i++;
      // Collect consecutive adds following
      const addStart = i;
      while (i < diff.length && diff[i].type === "add") i++;
      const addEnd = i;
      // Pair them: min(dels, adds) are modifications, rest are pure add/del
      const delCount = addStart - delStart;
      const addCount = addEnd - addStart;
      const paired = Math.min(delCount, addCount);
      for (let j = 0; j < paired; j++) {
        modifiedLines.add(diff[addStart + j].newLine - 1);
      }
      for (let j = paired; j < addCount; j++) {
        addedLines.add(diff[addStart + j].newLine - 1);
      }
    } else if (diff[i].type === "add") {
      addedLines.add(diff[i].newLine - 1);
      i++;
    } else {
      i++;
    }
  }

  for (const line of modifiedLines) cm.addLineClass(line, "gutter", GUTTER_MODIFIED);
  for (const line of addedLines) cm.addLineClass(line, "gutter", GUTTER_ADDED);
}

cm.on("change", () => {
  if (!hasOpenTabs()) return;
  clearTimeout(gutterTimer);
  gutterTimer = setTimeout(updateGutterMarkers, 400);
});

// ── Page break decorations (inline replacement, cursor-aware) ─────────────

let _pageBreakMarks = []; // {line, mark}

function applyPageBreakMarks() {
  for (const pm of _pageBreakMarks) pm.mark.clear();
  _pageBreakMarks = [];

  const cursorLine = cm.getCursor().line;

  for (let i = 0; i < cm.lineCount(); i++) {
    const text = cm.getLine(i).trim();
    if (text !== '/newpage' && text !== '\\newpage') continue;
    if (i === cursorLine) continue; // show raw text when cursor is on line

    const el = document.createElement("span");
    el.className = "cm-pagebreak-widget";
    el.innerHTML = '<span class="cm-pagebreak-line"></span>'
      + '<span class="cm-pagebreak-label">page break</span>'
      + '<span class="cm-pagebreak-line"></span>'
      + '<button class="cm-pagebreak-delete" title="Remove page break">\u00d7</button>';
    el.querySelector(".cm-pagebreak-delete").addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = i + 1 < cm.lineCount() ? { line: i + 1, ch: 0 } : { line: i, ch: cm.getLine(i).length };
      cm.replaceRange("", { line: i, ch: 0 }, next);
    });

    const lineLen = cm.getLine(i).length;
    const mark = cm.markText(
      { line: i, ch: 0 },
      { line: i, ch: lineLen },
      { replacedWith: el, handleMouseEvents: true },
    );
    _pageBreakMarks.push({ line: i, mark });
  }
}

let pageBreakTimer = null;
cm.on("change", () => {
  clearTimeout(pageBreakTimer);
  pageBreakTimer = setTimeout(applyPageBreakMarks, 150);
});
cm.on("cursorActivity", () => {
  // Re-apply immediately so cursor line gets raw text
  applyPageBreakMarks();
});
setTimeout(applyPageBreakMarks, 200);

// ── Heading number badges (inline, replacing # symbols) ───────────────────
// markText replaces "# " / "## " / "### " with a badge showing the computed
// section number. The mark is removed when the cursor is on that line so the
// raw markdown is editable.

let _headingMarks = []; // {line, mark}
let _cursorLine = -1;

function computeHeadingLabels() {
  const labels = []; // {line, depth, label, hashLen}
  // Detect partie number from markdown H1 or filename
  let partieNum = 0;
  for (let i = 0; i < cm.lineCount(); i++) {
    const m = cm.getLine(i).match(/^#\s+(?:\d+\.?\s+)?Partie\s+(\d+)/i);
    if (m) { partieNum = parseInt(m[1], 10); break; }
  }
  if (!partieNum) {
    const tab = getActiveTab();
    const fnMatch = tab?.name?.match(/^(\d+)/);
    partieNum = fnMatch ? parseInt(fnMatch[1], 10) : 0;
  }
  if (!partieNum) return labels;

  let h2Count = 0, h3Count = 0;
  for (let i = 0; i < cm.lineCount(); i++) {
    const line = cm.getLine(i);
    const m = line.match(/^(#{1,3}) /);
    if (!m) continue;
    const depth = m[1].length;
    let label = '';
    if (depth === 1) { label = 'P' + partieNum; h2Count = 0; h3Count = 0; }
    else if (depth === 2) { h2Count++; h3Count = 0; label = partieNum + '.' + h2Count; }
    else if (depth === 3) { h3Count++; label = partieNum + '.' + h2Count + '.' + h3Count; }
    if (label) labels.push({ line: i, depth, label, hashLen: m[1].length + 1 }); // +1 for the space
  }
  return labels;
}

function applyHeadingMarks() {
  // Clear old marks
  for (const hm of _headingMarks) hm.mark.clear();
  _headingMarks = [];

  const labels = computeHeadingLabels();
  const cursorLine = cm.getCursor().line;

  for (const { line, depth, label, hashLen } of labels) {
    if (line === cursorLine) continue; // don't replace on cursor line

    const badge = document.createElement("span");
    badge.className = "cm-heading-badge";
    badge.dataset.level = String(depth);
    badge.textContent = label;

    const mark = cm.markText(
      { line, ch: 0 },
      { line, ch: hashLen },
      { replacedWith: badge, handleMouseEvents: true },
    );
    _headingMarks.push({ line, mark });
  }
}

let headingBadgeTimer = null;
function scheduleHeadingBadges() {
  clearTimeout(headingBadgeTimer);
  headingBadgeTimer = setTimeout(applyHeadingMarks, 150);
}
cm.on("change", scheduleHeadingBadges);
cm.on("cursorActivity", () => {
  const cur = cm.getCursor().line;
  if (cur !== _cursorLine) {
    _cursorLine = cur;
    applyHeadingMarks(); // immediate — no debounce on cursor move
  }
});
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

const outlineList = document.getElementById("outlineList");
const outlineSection = document.getElementById("outlineSection");
let outlineHeadings = [];
let stuckObserver = null;

function buildOutline() {
  outlineHeadings = [];
  for (let i = 0; i < cm.lineCount(); i++) {
    const m = cm.getLine(i)?.match(/^(#{1,4}) (.+)/);
    if (m)
      outlineHeadings.push({ line: i, level: m[1].length, text: m[2].trim() });
  }

  if (!outlineList) return;
  if (stuckObserver) {
    stuckObserver.disconnect();
    stuckObserver = null;
  }

  outlineList.innerHTML = "";
  const stickyItems = [];

  // Compute section numbering using partie number from filename
  const tab = getActiveTab();
  const fnMatch = tab?.name?.match(/^(\d+)/);
  const partieNum = fnMatch ? parseInt(fnMatch[1], 10) : 0;
  const counters = [0, 0, 0]; // h2, h3, h4 counters
  const numbers = outlineHeadings.map((h) => {
    if (h.level === 1) {
      // H1 = partie title, reset sub-counters
      counters[0] = 0; counters[1] = 0; counters[2] = 0;
      return partieNum ? `Partie ${partieNum}` : "";
    }
    const lvl = h.level - 2; // h2→0, h3→1, h4→2
    counters[lvl]++;
    for (let k = lvl + 1; k < counters.length; k++) counters[k] = 0;
    const prefix = partieNum ? `${partieNum}.` : "";
    return prefix + counters.slice(0, lvl + 1).join(".");
  });

  outlineHeadings.forEach((h, idx) => {
    const el = document.createElement("div");
    el.className = "outline-item";
    el.dataset.level = h.level;
    el.dataset.idx = idx;
    // Strip existing leading number/partie prefix to avoid duplication
    const cleanText = h.text.replace(/^(?:Partie\s+\d+\s*[—●\-]\s*|[\d.]+\s*)/i, "");
    const num = numbers[idx];
    el.textContent = num ? num + " " + cleanText : cleanText;
    el.onclick = () => {
      cm.setCursor({ line: h.line, ch: 0 });
      cm.scrollIntoView(
        { line: h.line, ch: 0 },
        cm.getScrollInfo().clientHeight / 3,
      );
      cm.focus();
    };
    outlineList.appendChild(el);
    if (h.level <= 3) stickyItems.push(el);
  });

  if (stickyItems.length > 0) {
    stuckObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("stuck", entry.intersectionRatio < 1);
        });
      },
      { root: outlineList, threshold: 1.0 },
    );
    stickyItems.forEach((el) => stuckObserver.observe(el));
  }

  if (outlineSection && outlineHeadings.length > 0) {
    outlineSection.style.display = "";
  }
  updateOutlineHighlight();
}

let lastVisibleRange = "";

function updateOutlineHighlight() {
  if (!outlineList || outlineHeadings.length === 0) return;

  const cursorLine = cm.getCursor().line;
  const info = cm.getScrollInfo();
  const topLine = cm.lineAtHeight(info.top, "local");
  const bottomLine = cm.lineAtHeight(info.top + info.clientHeight, "local");

  let firstVisible = -1,
    lastVisible = -1;
  for (let i = 0; i < outlineHeadings.length; i++) {
    const sectionStart = outlineHeadings[i].line;
    const sectionEnd =
      i + 1 < outlineHeadings.length
        ? outlineHeadings[i + 1].line - 1
        : cm.lineCount() - 1;
    if (sectionEnd >= topLine && sectionStart <= bottomLine) {
      if (firstVisible < 0) firstVisible = i;
      lastVisible = i;
    }
  }

  let activeIdx = -1;
  for (let i = outlineHeadings.length - 1; i >= 0; i--) {
    if (outlineHeadings[i].line <= cursorLine) {
      activeIdx = i;
      break;
    }
  }

  const centerLine = cm.lineAtHeight(info.top + info.clientHeight / 2, "local");
  const proximity = new Array(outlineHeadings.length).fill(0);
  if (firstVisible >= 0 && lastVisible >= firstVisible) {
    for (let i = firstVisible; i <= lastVisible; i++) {
      const headLine = outlineHeadings[i].line;
      const nextLine =
        i + 1 < outlineHeadings.length
          ? outlineHeadings[i + 1].line
          : cm.lineCount();
      const sectionMid = (headLine + nextLine) / 2;
      const halfSpan = Math.max(1, (bottomLine - topLine) / 2);
      const dist = Math.abs(sectionMid - centerLine) / halfSpan;
      proximity[i] = Math.max(0, 1 - dist);
    }
  }

  const visKey =
    firstVisible + ":" + lastVisible + ":" + activeIdx + ":" + centerLine;
  if (visKey === lastVisibleRange) return;
  lastVisibleRange = visKey;

  const items = outlineList.querySelectorAll(".outline-item");
  items.forEach((el, i) => {
    el.classList.toggle("active", i === activeIdx);
    const isVisible = i >= firstVisible && i <= lastVisible;
    el.classList.toggle("visible", isVisible);
    el.style.setProperty("--prox", isVisible ? proximity[i].toFixed(2) : "0");
  });

  if (firstVisible >= 0 && items[firstVisible] && items[lastVisible]) {
    const firstEl = items[firstVisible];
    const lastEl = items[lastVisible];
    const rangeTop = firstEl.offsetTop - outlineList.offsetTop;
    const rangeBottom =
      lastEl.offsetTop - outlineList.offsetTop + lastEl.offsetHeight;
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
  const menubar = document.querySelector(".menubar");
  if (!menubar) return;

  const backdrop = document.createElement("div");
  backdrop.className = "menu-backdrop";
  document.body.appendChild(backdrop);

  let openMenu = null;

  function openItem(item) {
    if (openMenu === item) return;
    closeAll();
    item.classList.add("open");
    backdrop.classList.add("active");
    openMenu = item;
  }

  function closeAll() {
    if (openMenu) openMenu.classList.remove("open");
    backdrop.classList.remove("active");
    openMenu = null;
  }

  menubar.querySelectorAll(".menu-trigger").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = trigger.closest(".menu-item");
      if (openMenu === item) {
        closeAll();
      } else {
        openItem(item);
      }
    });
  });

  menubar.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      if (openMenu && openMenu !== item) openItem(item);
    });
  });

  menubar.querySelectorAll(".menu-dropdown button").forEach((btn) => {
    btn.addEventListener("click", () => closeAll());
  });

  backdrop.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openMenu) closeAll();
  });
})();

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
      tab.path,
      content,
      tab.savedContent,
      tab.localFileModTime,
    );

    if (result.action === "cancel") {
      status.textContent = "Save cancelled";
      return;
    }
    if (result.action === "reload") {
      cm.setValue(result.content);
      markActiveTabClean(result.content, result.modTime);
      updateGutterMarkers();
      renderFileList();
      status.textContent = "Loaded disk version of " + tab.name;
      return;
    }
    if (result.action === "merge") {
      cm.setValue(result.content);
      if (result.hasConflicts) {
        status.textContent =
          "Merged with conflicts \u2014 search for <<<<<<< to resolve";
        return;
      }
      // Fall through to save the merged content
      await writeFile(tab.path, cm.getValue());
      const modTime = await getFileModTime(tab.path);
      markActiveTabClean(cm.getValue(), modTime);
      updateGutterMarkers();
      renderFileList();
      status.textContent = "Saved " + tab.name;
      return;
    }

    // Normal save
    markActiveTabClean(content, result.modTime);
    updateTitle(tab.name, false);
    updateGutterMarkers();
    renderFileList();
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
    updateGutterMarkers();
    renderFileList();
    status.textContent = "Saved as " + name;
    addRecentFile(filePath);
  } catch (e) {
    status.textContent = "Save As failed: " + e.message;
  }
}

// ── Unsaved changes dialog ─────────────────────────────────────────────────

function showUnsavedDialog(fileName) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";

    overlay.innerHTML = `
      <div class="modal">
        <h3>Unsaved Changes</h3>
        <p style="color:#94a3b8;margin-bottom:4px;">
          <strong style="color:#cdd6f4;">${fileName}</strong> has unsaved changes.
        </p>
        <div class="btn-row">
          <button class="btn-cancel" data-action="cancel">Keep open</button>
          <button class="btn-discard" data-action="discard">Discard</button>
          <button class="btn-save" data-action="save">Save</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      const action = e.target.dataset?.action;
      if (action) {
        overlay.remove();
        resolve(action);
      }
    });

    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        resolve("cancel");
      }
    });

    document.body.appendChild(overlay);
  });
}

// ── Close active tab ───────────────────────────────────────────────────────

async function closeCurrentTab() {
  const tab = getActiveTab();
  if (!tab) return;

  if (tab.dirty) {
    const action = await showUnsavedDialog(tab.name || "Untitled");
    if (action === "cancel") return;
    if (action === "save") await doSave();
    // "discard" falls through
  }

  closeActiveTab();
}

// ── Open single file via dialog ────────────────────────────────────────────

async function openLocalFile() {
  const filePath = await showOpenFileDialog();
  if (!filePath) return;
  await openFilePath(filePath);
}

// ── Open folder and load first file ─────────────────────────────────────────

async function openFolderAndLoadFirst(result) {
  if (result && result.fileEntries.length > 0) {
    const first = result.fileEntries[0];
    const content = await readFile(first.path);
    const modTime = await getFileModTime(first.path);
    openTab(first.path, first.name, content, modTime);
    hideWelcome();
  }
}

async function openFolderByPathAndLoad(dirPath) {
  const result = await openFolderByPath(dirPath);
  await openFolderAndLoadFirst(result);
}

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
          const entry = entries.find((e) => e.name === name);
          if (entry) {
            const content = await readFile(entry.path);
            const modTime = await getFileModTime(entry.path);
            openTab(entry.path, entry.name, content, modTime);
          }
        }
        // Switch to previously active tab
        if (activeTabName) {
          const entry = entries.find((e) => e.name === activeTabName);
          if (entry) {
            const idx = findTabByPath(entry.path);
            if (idx >= 0) openTab(entry.path, entry.name);
          }
        }
      } else if (state.lastFile) {
        // Legacy: restore single file
        const entry = entries.find((e) => e.name === state.lastFile);
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
          btn.onclick = () => openFolderByPathAndLoad(f);
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
        link.onclick = (e) => {
          e.preventDefault();
          openFolderByPathAndLoad(f);
        };
        welcomeFolders.appendChild(link);
      }
      for (const f of recentFiles) {
        const link = document.createElement("a");
        link.className = "recent-link";
        link.textContent = f;
        link.href = "#";
        link.onclick = (e) => {
          e.preventDefault();
          openFilePath(f);
        };
        welcomeFiles.appendChild(link);
      }
    }
  }
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
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
  api.on("menu-toggle-cover", () => {}); // no-op: single-section mode
  api.on("open-file-path", (filePath) => openFilePath(filePath));
  api.on("open-folder-path", (folderPath) => openFolderByPathAndLoad(folderPath));
  api.on("recent-cleared", () => buildRecentUI());
}

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
  })
  .catch((e) => {
    hideLoading();
    if (status) status.textContent = "Startup error: " + e.message;
    console.error("pagedReady failed:", e);
  });
