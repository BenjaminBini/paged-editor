// tab-integration.js — Connects tab-bar events to the rest of the app.
// Handles tab switch reactions, sidebar↔tab integration, dirty tracking, persistence.

import {
  cm,
  status,
  showLoading,
  hideLoading,
  setEditorPaneMode,
} from "../editor/codemirror-editor.js";
import { setActiveFileContext } from "../workspace/files/active-file-context.js";
import {
  triggerRender,
  updateCoverPreview,
  renderCoverFromProject,
} from "../document/render-scheduler.js";
import {
  refreshTableWidgets,
  setTableRangesDirty,
} from "../editor/table-widget.js";
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
  parseProjectJsonSource,
} from "../document/model/memoire-views.js";
import {
  showCoverForm,
  hideCoverForm,
  populateCoverForm,
  setOnDirty,
  setOnPatchPreview,
} from "../editor/cover-form-editor.js";
import {
  renderFileList,
  readFile,
  getFileModTime,
  updateTitle,
  getFolderPath,
  setOnFileClick,
  setOnFileRefresh,
  setGetActiveFilePath,
  setIsFileDirty,
  setOnFileDelete,
  setGetExtraFileEntries,
} from "../workspace/files/file-manager.js";
import {
  openTab,
  switchToTab,
  closeTab,
  getActiveTab,
  getTabs,
  hasOpenTabs,
  markActiveTabDirty,
  onTabSwitch,
  onAllTabsClosed,
  onTabSaveRequest,
  onTabRefreshRequest,
  onBeforeDocSwap,
  getSessionState,
  findTabByPath,
} from "../workspace/tabs/tab-bar-controller.js";
import * as platform from "../infrastructure/platform-adapter.js";

// ── Cover form render/dirty wiring ────────────────────────────────────────

setOnDirty(() => {
  markActiveTabDirty();
  renderFileList();
});
setOnPatchPreview((project: Record<string, unknown>) => updateCoverPreview(project));

// ── Persist tab state (debounced) ──────────────────────────────────────────

function persistTabState(): void {
  const session = getSessionState();
  platform.setAppState({
    openTabs: session.openTabs,
    activeTab: session.activeTab,
  });
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(): void {
  clearTimeout(persistTimer ?? undefined);
  persistTimer = setTimeout(persistTabState, 500);
}

// ── Dirty tracking ─────────────────────────────────────────────────────────

let sidebarDirtyTimer: ReturnType<typeof setTimeout> | null = null;
let changeNotifyTimer: ReturnType<typeof setTimeout> | null = null;

export function onChangeDirtyTracking(): void {
  if (!hasOpenTabs()) return;
  const tab = getActiveTab();
  if (tab?.readOnly) return;
  markActiveTabDirty();
  if (tab) updateTitle(tab.name, true);
  clearTimeout(sidebarDirtyTimer ?? undefined);
  sidebarDirtyTimer = setTimeout(renderFileList, 300);
  const notifyParent = window.__pagedEditorNotifyParent;
  if (notifyParent) {
    clearTimeout(changeNotifyTimer ?? undefined);
    changeNotifyTimer = setTimeout(() => {
      const t = getActiveTab();
      if (t)
        notifyParent("change", {
          file: t.path,
          name: t.name,
        });
    }, 500);
  }
}

// ── Tab lifecycle wiring ───────────────────────────────────────────────────

export function wireTabCallbacks({
  reattachCmListeners,
  buildOutline,
  updateMenuState,
  hideWelcome,
  showWelcome,
  doSave,
  reloadTabFromDisk,
  detachCmListeners,
}: {
  reattachCmListeners: () => void;
  buildOutline: () => void;
  updateMenuState: () => void;
  hideWelcome: () => void;
  showWelcome: () => void;
  doSave: () => void;
  reloadTabFromDisk: (tab: any) => void;
  detachCmListeners: () => void;
}): void {
  onTabSwitch((tab: any) => {
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
      setEditorPaneMode(
        "disabled",
        "TOC is generated from the current memoire and cannot be edited directly.",
      );
      const formatBar = document.getElementById("editorFormatBar");
      if (formatBar) formatBar.style.display = "";
    } else {
      hideCoverForm();
      setEditorPaneMode("default");
      const formatBar = document.getElementById("editorFormatBar");
      if (formatBar) formatBar.style.display = "";
    }
    if (isCoverTab(tab)) {
      void renderCoverFromProject(parseProjectJsonSource(cm.getValue()));
    } else {
      triggerRender();
    }
    setTimeout(buildOutline, 50);
    if (isMarkdownTab(tab)) {
      setTableRangesDirty();
      setTimeout(refreshTableWidgets, 150);
    }
    updateMenuState();
    schedulePersist();
  });

  onAllTabsClosed(() => {
    hideLoading();
    hideCoverForm();
    reattachCmListeners();
    updateTitle("", false);
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
  onTabRefreshRequest((tab: any) => reloadTabFromDisk(tab));

  onBeforeDocSwap(() => detachCmListeners());
}

// ── Sidebar → tab-bar wiring ───────────────────────────────────────────────

export function wireSidebarCallbacks({ hideWelcome, reloadTabFromDisk }: { hideWelcome: () => void; reloadTabFromDisk: (tab: any) => void }): void {
  setGetExtraFileEntries(() => getMemoireSidebarEntries(getFolderPath()).filter(e => e.path != null) as any[]);

  setOnFileClick(async (item: any) => {
    const { path: filePath, name: fileName, kind = "file" } = item;
    const existingIdx = findTabByPath(filePath);
    if (existingIdx >= 0) {
      openTab(filePath, fileName, undefined, undefined);
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
        if (status) status.textContent = "Loaded Cover";
      } catch (e: any) {
        hideLoading();
        if (status) status.textContent = "Load failed: " + e.message;
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
      if (status) status.textContent = "Loaded TOC";
      return;
    }

    showLoading("Loading " + fileName + "...");
    try {
      const [content, modTime] = await Promise.all([
        readFile(filePath),
        getFileModTime(filePath),
      ]);
      openTab(filePath, fileName, content, modTime);
      hideLoading();
      hideWelcome();
      if (status) status.textContent = "Loaded " + fileName;
    } catch (e: any) {
      hideLoading();
      if (status) status.textContent = "Load failed: " + e.message;
    }
  });

  setGetActiveFilePath(() => {
    const tab = getActiveTab();
    return tab ? tab.path : null;
  });

  setIsFileDirty((path: string) => {
    const idx = findTabByPath(path);
    if (idx < 0) return false;
    return getTabs()[idx].dirty ?? false;
  });

  setOnFileDelete((filePath: string) => {
    const idx = findTabByPath(filePath);
    if (idx >= 0) closeTab(idx);
  });

  setOnFileRefresh(async (filePath: string, fileName: string) => {
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
        const [content, modTime] = await Promise.all([
          readFile(filePath),
          getFileModTime(filePath),
        ]);
        openTab(filePath, fileName, content, modTime);
        hideLoading();
        hideWelcome();
        if (status) status.textContent = "Loaded " + fileName;
      } catch (e: any) {
        hideLoading();
        if (status) status.textContent = "Load failed: " + e.message;
      }
    }
  });
}
