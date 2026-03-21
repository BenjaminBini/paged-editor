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
  openFolder, saveCurrentFile, isDirty,
  activateFolder, setDirHandle, setStorageMode,
  activeFileIdx, idbGet,
} from './file-manager.js';
import { openGoogleDrive, openDriveFile, tryRestoreGdrive, saveGoogleSettings, closeFolder } from './google-drive.js';
import { closeDiffModal, resolveConflict } from './diff-merge.js';
import './resize.js'; // self-initializing

// ── Wire hooks ──────────────────────────────────────────────────────────────

// When cm.setValue is called, destroy stale widgets then refresh
registerOnSetValue(() => {
  for (const tw of tableWidgets.values()) destroyTableWidget(tw);
  setTimeout(refreshTableWidgets, 50);
});

// When a section finishes rendering in its iframe
registerOnSectionReady((sectionIdx) => {
  const state = getSectionStates()[sectionIdx];
  // Setup click handler for the section that just rendered
  if (state?.frame) {
    setupPreviewClick(state.frame);
  }
  setTimeout(scalePreview, 300);
  setTimeout(scalePreview, 1000);
  setupScrollSync();
  // Rebuild anchor map after scaling settles (needed for scroll sync)
  setTimeout(rebuildAnchorMap, 350);
  setTimeout(rebuildAnchorMap, 1050);
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

  // Skip DOM update if nothing changed
  const visKey = firstVisible + ':' + lastVisible + ':' + activeIdx;
  if (visKey === lastVisibleRange) return;
  lastVisibleRange = visKey;

  const items = outlineList.querySelectorAll('.outline-item');
  items.forEach((el, i) => {
    el.classList.toggle('active', i === activeIdx);
    el.classList.toggle('visible', i >= firstVisible && i <= lastVisible && i !== activeIdx);
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

async function openLocalFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      multiple: false,
    });
    showLoading("Loading " + handle.name + "...");
    const file = await handle.getFile();
    const text = await file.text();
    cm.setValue(text);
    cm.clearHistory();
    hideLoading();
    document.getElementById("paneFileName").textContent = handle.name;
    document.title = handle.name + " — Paged.js Editor";
    triggerRender();
  } catch(e) {
    hideLoading();
    if (e.name !== 'AbortError') console.warn("Open file failed:", e);
  }
}

window.openLocalFile = openLocalFile;
window.openDriveFile = openDriveFile;
window.openFolder = openFolder;
window.openGoogleDrive = openGoogleDrive;
window.saveCurrentFile = saveCurrentFile;
window.insertTable = insertTable;
window.triggerRender = triggerRender;
window.openPreviewTab = openPreviewTab;
window.toggleWrap = toggleWrap;
window.saveGoogleSettings = saveGoogleSettings;
window.closeDiffModal = closeDiffModal;
window.resolveConflict = resolveConflict;
window.closeFolder = closeFolder;

// ── Default content ─────────────────────────────────────────────────────────

let DEFAULT_CONTENT = "";
fetch("assets/default.md").then(r => r.text()).then(t => { DEFAULT_CONTENT = t; }).catch(() => {});

// ── Restore folder on page load ─────────────────────────────────────────────

async function tryRestore() {
  // Try local folder first
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
  } catch(e) {}
  // Try Google Drive (with stored token from sessionStorage)
  try {
    const restored = await tryRestoreGdrive();
    if (restored) return;
  } catch(e) { console.log("GDrive restore failed:", e.message); }
}

// ── Startup ─────────────────────────────────────────────────────────────────

pagedReady.then(async () => {
  await tryRestore();
  hideLoading();
  restoreDone = true;
  // If no file was restored, show default content
  if (activeFileIdx < 0) {
    cm.setValue(DEFAULT_CONTENT);
    setTimeout(triggerRender, 100);
  }
}).catch(e => {
  hideLoading();
  if (status) status.textContent = "Startup error: " + e.message;
  console.error("pagedReady failed:", e);
});
