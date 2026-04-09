// file-ops.js — File open/save/reload operations.
// Uses direct imports instead of a context bag for static-analyzable dependencies.

import { cm, status, showLoading, hideLoading } from "./editor.js";
import {
  readFile, writeFile, getFileModTime, saveWithConflictDetection,
  showSaveAsDialog, showOpenFileDialog, addRecentFile, applyPrettify,
  updateTitle, renderFileList, openFolderByPath,
} from "./file-manager.js";
import {
  openTab, closeActiveTab, getActiveTab, markActiveTabClean,
  updateActiveTabPath, findTabByPath,
} from "./tab-bar.js";
import { triggerRender } from "./render.js";
import { hideWelcome } from "./menu-state.js";
import { updateGutterMarkers } from "./editor-decorations.js";
import * as platform from "./platform.js";
import { emit } from "./event-bus.js";

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
  if (!tab) return;

  applyPrettify();
  const content = cm.getValue();

  if (!tab.path) {
    await doSaveAs();
    return;
  }

  try {
    const result = await saveWithConflictDetection(
      tab.path, content, tab.savedContent, tab.localFileModTime,
    );

    if (result.action === "cancel") {
      status.textContent = "Save cancelled";
      return;
    }
    if (result.action === "reload") {
      cm.setValue(result.content);
      markActiveTabClean(result.content, result.modTime);
      updateGutterMarkers(getActiveTab);
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
      await writeFile(tab.path, cm.getValue());
      const modTime = await getFileModTime(tab.path);
      markActiveTabClean(cm.getValue(), modTime);
      updateGutterMarkers(getActiveTab);
      renderFileList();
      status.textContent = "Saved " + tab.name;
      return;
    }

    // Normal save
    markActiveTabClean(content, result.modTime);
    updateTitle(tab.name, false);
    updateGutterMarkers(getActiveTab);
    renderFileList();
    status.textContent = "Saved " + tab.name;
    emit("file-saved", { file: tab.path, name: tab.name });
  } catch (e) {
    status.textContent = "Save failed: " + e.message;
  }
}

export async function doSaveAs() {
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
    updateGutterMarkers(getActiveTab);
    renderFileList();
    status.textContent = "Saved as " + name;
    addRecentFile(filePath);
  } catch (e) {
    status.textContent = "Save As failed: " + e.message;
  }
}

// ── Unsaved changes dialog ─────────────────────────────────────────────────

export function showUnsavedDialog(fileName) {
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

export async function closeCurrentTab() {
  const tab = getActiveTab();
  if (!tab) return;

  if (tab.dirty) {
    const action = await showUnsavedDialog(tab.name || "Untitled");
    if (action === "cancel") return;
    if (action === "save") await doSave();
  }

  closeActiveTab();
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
