// file-ops.js — File open/save/reload operations.
// Uses direct imports instead of a context bag for static-analyzable dependencies.

import { cm, status, showLoading, hideLoading } from "../../editor/codemirror-editor.js";
import {
  readFile, writeFile, getFileModTime, saveWithConflictDetection,
  showSaveAsDialog, showOpenFileDialog, addRecentFile, applyPrettify,
  updateTitle, renderFileList, openFolderByPath,
} from "./file-manager.js";
import {
  openTab, closeTab, getActiveTab, getActiveTabIdx, getTabs, markActiveTabClean,
  switchToTab, updateActiveTabPath, findTabByPath,
} from "../tabs/tab-bar-controller.js";
import { triggerRender } from "../../document/render-scheduler.js";
import { hideWelcome } from "../../shell/ui/menu-state-manager.js";
import { updateGutterMarkers } from "../../editor/editor-decorations.js";
import * as platform from "../../infrastructure/platform-adapter.js";
import { emit } from "../../infrastructure/event-bus.js";
import { setActiveFileContext } from "./active-file-context.js";
import { isCoverTab, isReadOnlyTab } from "../../document/model/memoire-views.js";
import { isCoverFormVisible, syncCoverFormToEditor } from "../../editor/cover-form-editor.js";

// ── Late-bound callbacks (set once at init to avoid circular deps) ─────────

let _buildRecentUI: (() => void) | null = null;

export function initFileOps({ buildRecentUI }: { buildRecentUI: () => void }): void {
  _buildRecentUI = buildRecentUI;
}

// ── Open a file by path ────────────────────────────────────────────────────

export async function openFilePath(filePath: string): Promise<void> {
  const existing = findTabByPath(filePath);
  if (existing >= 0) {
    openTab(filePath, filePath.split("/").pop() || filePath, undefined, undefined);
    return;
  }

  try {
    showLoading("Loading...");
    const [text, modTime] = await Promise.all([readFile(filePath), getFileModTime(filePath)]);
    const name = filePath.split("/").pop() || filePath;
    openTab(filePath, name, text, modTime);
    hideLoading();
    hideWelcome();
    triggerRender();
    addRecentFile(filePath);
    await platform.setAppState({ lastFile: filePath });
    if (_buildRecentUI) _buildRecentUI();
    if (status) status.textContent ="Loaded " + name;
  } catch (e: any) {
    hideLoading();
    if (status) status.textContent ="Failed to load file: " + e.message;
  }
}

// ── Reload tab from disk ───────────────────────────────────────────────────

export async function reloadTabFromDisk(tab: { path: string; name: string; readOnly?: boolean; [key: string]: any }): Promise<void> {
  if (!tab || !tab.path || tab.readOnly) return;
  try {
    showLoading("Reloading " + tab.name + "...");
    const [content, modTime] = await Promise.all([readFile(tab.path), getFileModTime(tab.path)]);
    cm.setValue(content);
    markActiveTabClean(content, modTime);
    updateGutterMarkers();
    renderFileList();
    hideLoading();
    if (status) status.textContent ="Reloaded " + tab.name + " from disk";
  } catch (e: any) {
    hideLoading();
    if (status) status.textContent ="Failed to reload: " + e.message;
  }
}

// ── Save ───────────────────────────────────────────────────────────────────

export async function doSave(): Promise<boolean> {
  const tab = getActiveTab();
  if (!tab) return false;
  if (isReadOnlyTab(tab)) return false;

  if (!isCoverTab(tab)) applyPrettify();
  if (isCoverTab(tab) && isCoverFormVisible()) {
    syncCoverFormToEditor();
  }
  let content = cm.getValue();
  if (isCoverTab(tab)) {
    try {
      content = JSON.stringify(JSON.parse(content), null, 2) + "\n";
      cm.setValue(content);
    } catch {
      if (status) status.textContent ="Save failed: project.json is not valid JSON";
      return false;
    }
  }

  if (!tab.path) {
    return doSaveAs();
  }

  try {
    const result = await saveWithConflictDetection(
      tab.path, content, tab.savedContent || "", tab.localFileModTime || 0,
    );

    if (result.action === "cancel") {
      if (status) status.textContent ="Save cancelled";
      return false;
    }
    if (result.action === "reload") {
      cm.setValue(result.content!);
      markActiveTabClean(result.content!, result.modTime);
      updateGutterMarkers();
      renderFileList();
      if (status) status.textContent ="Loaded disk version of " + tab.name;
      return true;
    }
    if (result.action === "merge") {
      cm.setValue(result.content);
      if (result.hasConflicts) {
        if (status) status.textContent =
          "Merged with conflicts \u2014 search for <<<<<<< to resolve";
        return false;
      }
      await writeFile(tab.path, cm.getValue());
      const modTime = await getFileModTime(tab.path);
      markActiveTabClean(cm.getValue(), modTime);
      updateGutterMarkers();
      renderFileList();
      if (status) status.textContent ="Saved " + tab.name;
      return true;
    }

    // Normal save
    markActiveTabClean(content, result.modTime);
    updateTitle(tab.name, false);
    updateGutterMarkers();
    renderFileList();
    if (status) status.textContent ="Saved " + tab.name;
    emit("file-saved", { file: tab.path, name: tab.name });
    return true;
  } catch (e: any) {
    if (status) status.textContent ="Save failed: " + e.message;
    return false;
  }
}

export async function doSaveAs(): Promise<boolean> {
  const tab = getActiveTab();
  if (!tab) return false;
  if (isReadOnlyTab(tab) || isCoverTab(tab)) return false;

  const filePath = await showSaveAsDialog(tab.name || "document.md");
  if (!filePath) return false;

  applyPrettify();
  try {
    await writeFile(filePath, cm.getValue());
    const modTime = await getFileModTime(filePath);
    const name = filePath.split("/").pop() || filePath;
    updateActiveTabPath(filePath, name);
    setActiveFileContext(name, filePath);
    markActiveTabClean(cm.getValue(), modTime);
    updateTitle(name, false);
    updateGutterMarkers();
    renderFileList();
    if (status) status.textContent ="Saved as " + name;
    addRecentFile(filePath);
    return true;
  } catch (e: any) {
    if (status) status.textContent ="Save As failed: " + e.message;
    return false;
  }
}

// ── Unsaved changes dialog ─────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (char: string) => (
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    } as Record<string, string>)[char]
  ));
}

function restoreActiveTab(idx: number): void {
  const tabs = getTabs();
  if (!tabs.length || idx < 0) return;
  switchToTab(Math.min(idx, tabs.length - 1));
}

export function showUnsavedDialog(targetLabel: string, options: { count?: number; saveLabel?: string; discardLabel?: string; cancelLabel?: string; title?: string } = {}): Promise<string> {
  return new Promise<string>((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    const count = options.count || 1;
    const safeLabel = escapeHtml(targetLabel || "Untitled");
    const saveLabel = options.saveLabel || (count > 1 ? "Save all" : "Save");
    const discardLabel = options.discardLabel || (count > 1 ? "Discard all" : "Discard");
    const cancelLabel = options.cancelLabel || "Keep open";
    const verb = count > 1 ? "have" : "has";

    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      cleanup();
      resolve("cancel");
    };

    function cleanup(): void {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
    }

    overlay.innerHTML = `
      <div class="modal">
        <h3>${escapeHtml(options.title || "Unsaved Changes")}</h3>
        <p style="color:#94a3b8;margin-bottom:4px;">
          <strong style="color:#cdd6f4;">${safeLabel}</strong> ${verb} unsaved changes.
        </p>
        <div class="btn-row">
          <button class="btn-cancel" data-action="cancel">${escapeHtml(cancelLabel)}</button>
          <button class="btn-discard" data-action="discard">${escapeHtml(discardLabel)}</button>
          <button class="btn-save" data-action="save">${escapeHtml(saveLabel)}</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).dataset?.action;
      if (action) {
        cleanup();
        resolve(action);
      }
    });

    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  });
}

async function resolveUnsavedTabs(tabIndexes: number[]): Promise<boolean> {
  const requestedIndexes = [...new Set(tabIndexes)]
    .filter((idx) => Number.isInteger(idx) && idx >= 0)
    .sort((a, b) => a - b);

  if (!requestedIndexes.length) return true;

  const tabs = getTabs();
  const dirtyTabs = requestedIndexes
    .map((idx) => ({ idx, tab: tabs[idx] }))
    .filter(({ tab }) => tab?.dirty);

  if (!dirtyTabs.length) return true;

  const originalActiveIdx = getActiveTabIdx();
  const count = dirtyTabs.length;
  const action = await showUnsavedDialog(
    count === 1 ? (dirtyTabs[0].tab.name || "Untitled") : `${count} files`,
    { count },
  );

  if (action === "cancel") {
    restoreActiveTab(originalActiveIdx);
    return false;
  }

  if (action === "save") {
    for (const { idx } of dirtyTabs) {
      if (!getTabs()[idx]) continue;
      switchToTab(idx);
      await doSave();
      if (getTabs()[idx]?.dirty) {
        restoreActiveTab(originalActiveIdx);
        return false;
      }
    }
  }

  restoreActiveTab(originalActiveIdx);
  return true;
}

function closeTabsByIndexes(tabIndexes: number[]): void {
  [...new Set(tabIndexes)]
    .filter((idx) => Number.isInteger(idx) && idx >= 0)
    .sort((a, b) => b - a)
    .forEach((idx) => closeTab(idx));
}

// ── Close active tab ───────────────────────────────────────────────────────

export async function requestCloseTab(idx: number): Promise<boolean> {
  if (!(await resolveUnsavedTabs([idx]))) return false;
  closeTabsByIndexes([idx]);
  return true;
}

export async function requestCloseTabsToLeft(idx: number): Promise<boolean> {
  const indexes = [];
  for (let i = 0; i < idx; i++) indexes.push(i);
  if (!(await resolveUnsavedTabs(indexes))) return false;
  closeTabsByIndexes(indexes);
  return true;
}

export async function requestCloseTabsToRight(idx: number): Promise<boolean> {
  const indexes = [];
  for (let i = idx + 1; i < getTabs().length; i++) indexes.push(i);
  if (!(await resolveUnsavedTabs(indexes))) return false;
  closeTabsByIndexes(indexes);
  return true;
}

export async function requestCloseAllTabs(): Promise<boolean> {
  const indexes = getTabs().map((_tab, idx) => idx);
  if (!(await resolveUnsavedTabs(indexes))) return false;
  closeTabsByIndexes(indexes);
  return true;
}

let pendingWindowClose: Promise<boolean> | null = null;

export async function requestWindowClose(): Promise<boolean> {
  if (pendingWindowClose) return pendingWindowClose;
  pendingWindowClose = (async () => {
    const indexes = getTabs().map((_tab, idx) => idx);
    if (!(await resolveUnsavedTabs(indexes))) {
      await platform.cancelWindowClose?.();
      return false;
    }
    await platform.confirmWindowClose?.();
    return true;
  })();
  try {
    return await pendingWindowClose;
  } finally {
    pendingWindowClose = null;
  }
}

export async function closeCurrentTab(): Promise<boolean> {
  const idx = getActiveTabIdx();
  if (idx < 0) return false;
  return requestCloseTab(idx);
}

// ── Open dialogs ───────────────────────────────────────────────────────────

export async function openLocalFile(): Promise<void> {
  const filePath = await showOpenFileDialog();
  if (!filePath) return;
  await openFilePath(filePath);
}

export async function openFolderAndLoadFirst(result: { fileEntries: Array<{ path: string; name: string }> } | null): Promise<void> {
  if (result && result.fileEntries.length > 0) {
    const first = result.fileEntries[0];
    const [content, modTime] = await Promise.all([readFile(first.path), getFileModTime(first.path)]);
    openTab(first.path, first.name, content, modTime);
    hideWelcome();
  }
}

export async function openFolderByPathAndLoad(dirPath: string): Promise<void> {
  const result = await openFolderByPath(dirPath);
  await openFolderAndLoadFirst(result);
}
