// tab-wiring.js — Connects tab-bar events to the rest of the app.
// Handles tab switch reactions, sidebar↔tab wiring, dirty tracking, persistence.

import { cm, status, showLoading, hideLoading, setEditorPaneMode } from "../editor/editor.js";
import { setActiveFileContext } from "../workspace/parse-context.js";
import { triggerRender } from "../memoire/render.js";
import { refreshTableWidgets, setTableRangesDirty } from "../editor/table-widget.js";
import {
  COVER_TAB_KIND,
  TOC_TAB_KIND,
  getMemoireSidebarEntries,
  getProjectJsonPath,
  getTocVirtualPath,
  loadProjectJsonSource,
  isMarkdownTab,
  isCoverTab,
  isTocTab,
} from "../memoire/model/memoire-views.js";
import { showCoverForm, hideCoverForm, populateCoverForm, setOnRender, setOnDirty } from "../editor/cover-form.js";
import {
  renderFileList, readFile, getFileModTime, updateTitle, getFolderPath,
  setOnFileClick, setOnFileRefresh, setGetActiveFilePath, setIsFileDirty,
  setOnFileDelete, setGetExtraFileEntries,
} from "../workspace/file-manager.js";
import {
  openTab, switchToTab, closeTab, getActiveTab, getTabs, hasOpenTabs,
  markActiveTabDirty, onTabSwitch, onAllTabsClosed, onTabSaveRequest,
  onTabRefreshRequest, onBeforeDocSwap, getSessionState, findTabByPath,
} from "../workspace/tab-bar.js";
import * as platform from "../core/platform.js";

// ── Cover form render/dirty wiring ────────────────────────────────────────

setOnRender(() => triggerRender());
setOnDirty(() => { markActiveTabDirty(); renderFileList(); });

// ── Persist tab state (debounced) ──────────────────────────────────────────

function persistTabState() {
  const session = getSessionState();
  platform.setAppState({ openTabs: session.openTabs, activeTab: session.activeTab });
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
  const tab = getActiveTab();
  if (tab?.readOnly) return;
  markActiveTabDirty();
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
    hideLoading();
    reattachCmListeners();
    updateTitle(tab.name, tab.dirty);
    renderFileList();
    setActiveFileContext(tab.name, tab.path);
    if (isCoverTab(tab)) {
      setEditorPaneMode("default");
      showCoverForm();
      populateCoverForm(cm.getValue());
      const formatBar = document.getElementById("editorFormatBar");
      if (formatBar) formatBar.style.display = "none";
    } else if (isTocTab(tab)) {
      hideCoverForm();
      setEditorPaneMode("disabled", "TOC is generated from the current memoire and cannot be edited directly.");
      const formatBar = document.getElementById("editorFormatBar");
      if (formatBar) formatBar.style.display = "";
    } else {
      hideCoverForm();
      setEditorPaneMode("default");
      const formatBar = document.getElementById("editorFormatBar");
      if (formatBar) formatBar.style.display = "";
    }
    triggerRender();
    setTimeout(buildOutline, 50);
    if (isMarkdownTab(tab)) {
      setTableRangesDirty();
      setTimeout(refreshTableWidgets, 150);
      setTimeout(updateGutterMarkers, 50);
      setTimeout(applyHeadingMarks, 50);
    }
    updateMenuState();
    schedulePersist();
  });

  onAllTabsClosed(() => {
    hideLoading();
    hideCoverForm();
    reattachCmListeners();
    updateTitle(null, false);
    setActiveFileContext("", "");
    setEditorPaneMode("default");
    const formatBar = document.getElementById("editorFormatBar");
    if (formatBar) formatBar.style.display = "";
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
  setGetExtraFileEntries(() => getMemoireSidebarEntries(getFolderPath()));

  setOnFileClick(async (item) => {
    const { path: filePath, name: fileName, kind = "file" } = item;
    const existingIdx = findTabByPath(filePath);
    if (existingIdx >= 0) {
      openTab(filePath, fileName);
      return;
    }

    if (kind === COVER_TAB_KIND) {
      showLoading("Loading Cover...");
      try {
        const content = await loadProjectJsonSource(getFolderPath());
        let modTime = 0;
        try {
          modTime = await getFileModTime(filePath);
        } catch {}
        openTab(filePath, fileName, content, modTime, { kind: COVER_TAB_KIND });
        hideLoading();
        hideWelcome();
        status.textContent = "Loaded Cover";
      } catch (e) {
        hideLoading();
        status.textContent = "Load failed: " + e.message;
      }
      return;
    }

    if (kind === TOC_TAB_KIND) {
      openTab(filePath, fileName, "", 0, {
        kind: TOC_TAB_KIND,
        readOnly: true,
        editorDisabled: true,
      });
      hideWelcome();
      status.textContent = "Loaded TOC";
      return;
    }

    showLoading("Loading " + fileName + "...");
    try {
      const [content, modTime] = await Promise.all([readFile(filePath), getFileModTime(filePath)]);
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
    if (filePath === getProjectJsonPath(getFolderPath())) {
      const existingIdx = findTabByPath(filePath);
      if (existingIdx >= 0) {
        switchToTab(existingIdx);
        await reloadTabFromDisk(getTabs()[existingIdx]);
      }
      return;
    }

    if (filePath === getTocVirtualPath(getFolderPath())) {
      const existingIdx = findTabByPath(filePath);
      if (existingIdx >= 0) switchToTab(existingIdx);
      return;
    }

    const existingIdx = findTabByPath(filePath);
    if (existingIdx >= 0) {
      switchToTab(existingIdx);
      await reloadTabFromDisk(getTabs()[existingIdx]);
    } else {
      showLoading("Loading " + fileName + "...");
      try {
        const [content, modTime] = await Promise.all([readFile(filePath), getFileModTime(filePath)]);
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
