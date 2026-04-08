// tab-wiring.js — Connects tab-bar events to the rest of the app.
// Handles tab switch reactions, sidebar↔tab wiring, dirty tracking, persistence.

import { status, showLoading, hideLoading } from "./editor.js";
import { setActiveFileName } from "./parse-context.js";
import { triggerRender } from "./render.js";
import { refreshTableWidgets } from "./table-widget.js";
import {
  renderFileList, readFile, getFileModTime, updateTitle, getFolderPath,
  setOnFileClick, setOnFileRefresh, setGetActiveFilePath, setIsFileDirty,
  setOnFileDelete,
} from "./file-manager.js";
import {
  openTab, switchToTab, closeTab, getActiveTab, getTabs, hasOpenTabs,
  markActiveTabDirty, onTabSwitch, onAllTabsClosed, onTabSaveRequest,
  onTabRefreshRequest, onBeforeDocSwap, getSessionState, findTabByPath,
} from "./tab-bar.js";

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

// ── Dirty tracking ─────────────────────────────────────────────────────────

let sidebarDirtyTimer = null;
let changeNotifyTimer = null;

export function onChangeDirtyTracking() {
  if (!hasOpenTabs()) return;
  markActiveTabDirty();
  const tab = getActiveTab();
  if (tab) updateTitle(tab.name, true);
  clearTimeout(sidebarDirtyTimer);
  sidebarDirtyTimer = setTimeout(renderFileList, 300);
  if (window.__pagedEditorNotifyParent) {
    clearTimeout(changeNotifyTimer);
    changeNotifyTimer = setTimeout(() => {
      const t = getActiveTab();
      if (t) window.__pagedEditorNotifyParent("change", { file: t.path, name: t.name });
    }, 500);
  }
}

// ── Tab lifecycle wiring ───────────────────────────────────────────────────

export function wireTabCallbacks({
  reattachCmListeners, updateGutterMarkers, applyHeadingMarks,
  buildOutline, updateMenuState, hideWelcome, showWelcome,
  doSave, reloadTabFromDisk, detachCmListeners,
}) {
  onTabSwitch((tab) => {
    reattachCmListeners();
    updateTitle(tab.name, tab.dirty);
    renderFileList();
    setActiveFileName(tab.name);
    triggerRender();
    setTimeout(buildOutline, 50);
    setTimeout(refreshTableWidgets, 150);
    setTimeout(updateGutterMarkers, 50);
    setTimeout(applyHeadingMarks, 50);
    updateMenuState();
    schedulePersist();
  });

  onAllTabsClosed(() => {
    reattachCmListeners();
    updateTitle(null, false);
    if (getFolderPath()) {
      renderFileList();
    } else {
      showWelcome();
    }
    updateMenuState();
    schedulePersist();
  });

  onTabSaveRequest(() => doSave());
  onTabRefreshRequest((tab) => reloadTabFromDisk(tab));

  onBeforeDocSwap(() => detachCmListeners());
}

// ── Sidebar → tab-bar wiring ───────────────────────────────────────────────

export function wireSidebarCallbacks({ hideWelcome, reloadTabFromDisk }) {
  setOnFileClick(async (filePath, fileName) => {
    const existingIdx = findTabByPath(filePath);
    if (existingIdx >= 0) {
      openTab(filePath, fileName);
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

  setOnFileDelete((filePath) => {
    const idx = findTabByPath(filePath);
    if (idx >= 0) closeTab(idx);
  });

  setOnFileRefresh(async (filePath, fileName) => {
    const existingIdx = findTabByPath(filePath);
    if (existingIdx >= 0) {
      switchToTab(existingIdx);
      await reloadTabFromDisk(getTabs()[existingIdx]);
    } else {
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
    }
  });
}
