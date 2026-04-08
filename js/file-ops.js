// file-ops.js — File open/save/reload operations (extracted from app.js).
// Receives dependencies via init() to avoid circular imports.
// Access via ctx.functionName() — initialized once at startup.

let ctx = null;

export function initFileOps(dependencies) {
  ctx = dependencies;
}

export async function openFilePath(filePath) {
  const existing = ctx.findTabByPath(filePath);
  if (existing >= 0) {
    ctx.openTab(filePath, filePath.split("/").pop());
    return;
  }

  try {
    ctx.showLoading("Loading...");
    const [text, modTime] = await Promise.all([ctx.readFile(filePath), ctx.getFileModTime(filePath)]);
    const name = filePath.split("/").pop();
    ctx.openTab(filePath, name, text, modTime);
    ctx.hideLoading();
    ctx.hideWelcome();
    ctx.triggerRender();
    ctx.addRecentFile(filePath);
    await ctx.api.setAppState({ lastFile: filePath });
    ctx.buildRecentUI();
    ctx.status.textContent = "Loaded " + name;
  } catch (e) {
    ctx.hideLoading();
    ctx.status.textContent = "Failed to load file: " + e.message;
  }
}

export async function reloadTabFromDisk(tab) {
  if (!tab || !tab.path) return;
  try {
    ctx.showLoading("Reloading " + tab.name + "...");
    const [content, modTime] = await Promise.all([ctx.readFile(tab.path), ctx.getFileModTime(tab.path)]);
    ctx.cm.setValue(content);
    ctx.markActiveTabClean(content, modTime);
    ctx.updateGutterMarkers();
    ctx.renderFileList();
    ctx.hideLoading();
    ctx.status.textContent = "Reloaded " + tab.name + " from disk";
  } catch (e) {
    ctx.hideLoading();
    ctx.status.textContent = "Failed to reload: " + e.message;
  }
}

export async function doSave() {
  const tab = ctx.getActiveTab();
  if (!tab) return;

  ctx.applyPrettify();
  const content = ctx.cm.getValue();

  if (!tab.path) {
    await doSaveAs();
    return;
  }

  try {
    const result = await ctx.saveWithConflictDetection(
      tab.path, content, tab.savedContent, tab.localFileModTime,
    );

    if (result.action === "cancel") {
      ctx.status.textContent = "Save cancelled";
      return;
    }
    if (result.action === "reload") {
      ctx.cm.setValue(result.content);
      ctx.markActiveTabClean(result.content, result.modTime);
      ctx.updateGutterMarkers();
      ctx.renderFileList();
      ctx.status.textContent = "Loaded disk version of " + tab.name;
      return;
    }
    if (result.action === "merge") {
      ctx.cm.setValue(result.content);
      if (result.hasConflicts) {
        ctx.status.textContent =
          "Merged with conflicts \u2014 search for <<<<<<< to resolve";
        return;
      }
      await ctx.writeFile(tab.path, ctx.cm.getValue());
      const modTime = await ctx.getFileModTime(tab.path);
      ctx.markActiveTabClean(ctx.cm.getValue(), modTime);
      ctx.updateGutterMarkers();
      ctx.renderFileList();
      ctx.status.textContent = "Saved " + tab.name;
      return;
    }

    // Normal save
    ctx.markActiveTabClean(content, result.modTime);
    ctx.updateTitle(tab.name, false);
    ctx.updateGutterMarkers();
    ctx.renderFileList();
    ctx.status.textContent = "Saved " + tab.name;
    if (window.__pagedEditorNotifyParent) {
      window.__pagedEditorNotifyParent("save", { file: tab.path, name: tab.name });
    }
  } catch (e) {
    ctx.status.textContent = "Save failed: " + e.message;
  }
}

export async function doSaveAs() {
  const tab = ctx.getActiveTab();
  if (!tab) return;

  const filePath = await ctx.showSaveAsDialog(tab.name || "document.md");
  if (!filePath) return;

  ctx.applyPrettify();
  try {
    await ctx.writeFile(filePath, ctx.cm.getValue());
    const modTime = await ctx.getFileModTime(filePath);
    const name = filePath.split("/").pop();
    ctx.updateActiveTabPath(filePath, name);
    ctx.markActiveTabClean(ctx.cm.getValue(), modTime);
    ctx.updateTitle(name, false);
    ctx.updateGutterMarkers();
    ctx.renderFileList();
    ctx.status.textContent = "Saved as " + name;
    ctx.addRecentFile(filePath);
  } catch (e) {
    ctx.status.textContent = "Save As failed: " + e.message;
  }
}

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

export async function closeCurrentTab() {
  const tab = ctx.getActiveTab();
  if (!tab) return;

  if (tab.dirty) {
    const action = await showUnsavedDialog(tab.name || "Untitled");
    if (action === "cancel") return;
    if (action === "save") await doSave();
  }

  ctx.closeActiveTab();
}

export async function openLocalFile() {
  const filePath = await ctx.showOpenFileDialog();
  if (!filePath) return;
  await openFilePath(filePath);
}

export async function openFolderAndLoadFirst(result) {
  if (result && result.fileEntries.length > 0) {
    const first = result.fileEntries[0];
    const [content, modTime] = await Promise.all([ctx.readFile(first.path), ctx.getFileModTime(first.path)]);
    ctx.openTab(first.path, first.name, content, modTime);
    ctx.hideWelcome();
  }
}

export async function openFolderByPathAndLoad(dirPath) {
  const result = await ctx.openFolderByPath(dirPath);
  await openFolderAndLoadFirst(result);
}
