// file-ops.js — File open/save/reload operations.
// Uses direct imports instead of a context bag for static-analyzable dependencies.

import { cm, status, showLoading, hideLoading } from "./editor.js";
import {
  readFile, writeFile, getFileModTime, saveWithConflictDetection,
  showSaveAsDialog, showOpenFileDialog, addRecentFile, applyPrettify,
  updateTitle, renderFileList, openFolderByPath,
} from "./file-manager.js";
import {
  openTab, closeTab, getActiveTab, getActiveTabIdx, getTabs, markActiveTabClean,
  switchToTab, updateActiveTabPath, findTabByPath,
} from "./tab-bar.js";
import { triggerRender } from "./render.js";
import { hideWelcome } from "./menu-state.js";
import { updateGutterMarkers } from "./editor-decorations.js";
import * as platform from "./platform.js";
import { emit } from "./event-bus.js";
import { setActiveFileContext } from "./parse-context.js";

// ── Late-bound callbacks (set once at init to avoid circular deps) ─────────

let _buildRecentUI = null;

export function initFileOps({ buildRecentUI }) {
  _buildRecentUI = buildRecentUI;
}

// ── Open a file by path ────────────────────────────────────────────────────

export async function openFilePath(filePath) {
  const existing = findTabByPath(filePath);
  if (existing >= 0) {
    openTab(filePath, filePath.split("/").pop());
    return;
  }

  try {
    showLoading("Loading...");
    const [text, modTime] = await Promise.all([readFile(filePath), getFileModTime(filePath)]);
    const name = filePath.split("/").pop();
    openTab(filePath, name, text, modTime);
    hideLoading();
    hideWelcome();
    triggerRender();
    addRecentFile(filePath);
    await platform.setAppState({ lastFile: filePath });
    if (_buildRecentUI) _buildRecentUI();
    status.textContent = "Loaded " + name;
  } catch (e) {
    hideLoading();
    status.textContent = "Failed to load file: " + e.message;
  }
}

// ── Reload tab from disk ───────────────────────────────────────────────────

export async function reloadTabFromDisk(tab) {
  if (!tab || !tab.path) return;
  try {
    showLoading("Reloading " + tab.name + "...");
    const [content, modTime] = await Promise.all([readFile(tab.path), getFileModTime(tab.path)]);
    cm.setValue(content);
    markActiveTabClean(content, modTime);
    updateGutterMarkers(getActiveTab);
    renderFileList();
    hideLoading();
    status.textContent = "Reloaded " + tab.name + " from disk";
  } catch (e) {
    hideLoading();
    status.textContent = "Failed to reload: " + e.message;
  }
}

// ── Save ───────────────────────────────────────────────────────────────────

export async function doSave() {
  const tab = getActiveTab();
  if (!tab) return false;

  applyPrettify();
  const content = cm.getValue();

  if (!tab.path) {
    return doSaveAs();
  }

  try {
    const result = await saveWithConflictDetection(
      tab.path, content, tab.savedContent, tab.localFileModTime,
    );

    if (result.action === "cancel") {
      status.textContent = "Save cancelled";
      return false;
    }
    if (result.action === "reload") {
      cm.setValue(result.content);
      markActiveTabClean(result.content, result.modTime);
      updateGutterMarkers(getActiveTab);
      renderFileList();
      status.textContent = "Loaded disk version of " + tab.name;
      return true;
    }
    if (result.action === "merge") {
      cm.setValue(result.content);
      if (result.hasConflicts) {
        status.textContent =
          "Merged with conflicts \u2014 search for <<<<<<< to resolve";
        return false;
      }
      await writeFile(tab.path, cm.getValue());
      const modTime = await getFileModTime(tab.path);
      markActiveTabClean(cm.getValue(), modTime);
      updateGutterMarkers(getActiveTab);
      renderFileList();
      status.textContent = "Saved " + tab.name;
      return true;
    }

    // Normal save
    markActiveTabClean(content, result.modTime);
    updateTitle(tab.name, false);
    updateGutterMarkers(getActiveTab);
    renderFileList();
    status.textContent = "Saved " + tab.name;
    emit("file-saved", { file: tab.path, name: tab.name });
    return true;
  } catch (e) {
    status.textContent = "Save failed: " + e.message;
    return false;
  }
}

export async function doSaveAs() {
  const tab = getActiveTab();
  if (!tab) return false;

  const filePath = await showSaveAsDialog(tab.name || "document.md");
  if (!filePath) return false;

  applyPrettify();
  try {
    await writeFile(filePath, cm.getValue());
    const modTime = await getFileModTime(filePath);
    const name = filePath.split("/").pop();
    updateActiveTabPath(filePath, name);
    setActiveFileContext(name, filePath);
    markActiveTabClean(cm.getValue(), modTime);
    updateTitle(name, false);
    updateGutterMarkers(getActiveTab);
    renderFileList();
    status.textContent = "Saved as " + name;
    addRecentFile(filePath);
    return true;
  } catch (e) {
    status.textContent = "Save As failed: " + e.message;
    return false;
  }
}

// ── Unsaved changes dialog ─────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]
  ));
}

function restoreActiveTab(idx) {
  const tabs = getTabs();
  if (!tabs.length || idx < 0) return;
  switchToTab(Math.min(idx, tabs.length - 1));
}

export function showUnsavedDialog(targetLabel, options = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    const count = options.count || 1;
    const safeLabel = escapeHtml(targetLabel || "Untitled");
    const saveLabel = options.saveLabel || (count > 1 ? "Save all" : "Save");
    const discardLabel = options.discardLabel || (count > 1 ? "Discard all" : "Discard");
    const cancelLabel = options.cancelLabel || "Keep open";
    const verb = count > 1 ? "have" : "has";

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      cleanup();
      resolve("cancel");
    };

    function cleanup() {
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
      const action = e.target.dataset?.action;
      if (action) {
        cleanup();
        resolve(action);
      }
    });

    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  });
}

async function resolveUnsavedTabs(tabIndexes) {
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

function closeTabsByIndexes(tabIndexes) {
  [...new Set(tabIndexes)]
    .filter((idx) => Number.isInteger(idx) && idx >= 0)
    .sort((a, b) => b - a)
    .forEach((idx) => closeTab(idx));
}

// ── Close active tab ───────────────────────────────────────────────────────

export async function requestCloseTab(idx) {
  if (!(await resolveUnsavedTabs([idx]))) return false;
  closeTabsByIndexes([idx]);
  return true;
}

export async function requestCloseTabsToLeft(idx) {
  const indexes = [];
  for (let i = 0; i < idx; i++) indexes.push(i);
  if (!(await resolveUnsavedTabs(indexes))) return false;
  closeTabsByIndexes(indexes);
  return true;
}

export async function requestCloseTabsToRight(idx) {
  const indexes = [];
  for (let i = idx + 1; i < getTabs().length; i++) indexes.push(i);
  if (!(await resolveUnsavedTabs(indexes))) return false;
  closeTabsByIndexes(indexes);
  return true;
}

export async function requestCloseAllTabs() {
  const indexes = getTabs().map((_tab, idx) => idx);
  if (!(await resolveUnsavedTabs(indexes))) return false;
  closeTabsByIndexes(indexes);
  return true;
}

let pendingWindowClose = null;

export async function requestWindowClose() {
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

export async function closeCurrentTab() {
  const idx = getActiveTabIdx();
  if (idx < 0) return false;
  return requestCloseTab(idx);
}

// ── Open dialogs ───────────────────────────────────────────────────────────

export async function openLocalFile() {
  const filePath = await showOpenFileDialog();
  if (!filePath) return;
  await openFilePath(filePath);
}

export async function openFolderAndLoadFirst(result) {
  if (result && result.fileEntries.length > 0) {
    const first = result.fileEntries[0];
    const [content, modTime] = await Promise.all([readFile(first.path), getFileModTime(first.path)]);
    openTab(first.path, first.name, content, modTime);
    hideWelcome();
  }
}

export async function openFolderByPathAndLoad(dirPath) {
  const result = await openFolderByPath(dirPath);
  await openFolderAndLoadFirst(result);
}
