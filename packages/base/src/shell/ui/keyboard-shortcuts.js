// keyboard-shortcuts.js — Keyboard bindings and Electron menu event wiring.

export function setupKeyboardShortcuts(actions) {
  const { doSave, doSaveAs, openLocalFile, newDocument, closeCurrentTab, hasOpenTabs } = actions;

  document.addEventListener("keydown", (e) => {
    const key = e.key?.toLowerCase();

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "s") {
      e.preventDefault();
      doSaveAs();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === "s") {
      e.preventDefault();
      if (hasOpenTabs()) doSave();
      else doSaveAs();
    }
    if ((e.ctrlKey || e.metaKey) && key === "o") {
      e.preventDefault();
      openLocalFile();
    }
    if ((e.ctrlKey || e.metaKey) && key === "n") {
      e.preventDefault();
      newDocument();
    }
    if ((e.ctrlKey || e.metaKey) && key === "w") {
      e.preventDefault();
      closeCurrentTab();
    }
  });
}

export function wireElectronMenus(api, actions) {
  if (!api?.on) return;

  const { newDocument, openLocalFile, doSave, doSaveAs, closeCurrentTab,
    hasOpenTabs, insertTable, triggerRender, openPreviewTab, toggleWrap,
    openFilePath, openFolderByPathAndLoad, buildRecentUI } = actions;

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
  api.on("menu-download-pdf", () => window.downloadPdf());
  api.on("menu-download-memoire", () => window.downloadFullMemoire());
  api.on("menu-toggle-wrap", () => toggleWrap());
  api.on("open-file-path", (filePath) => openFilePath(filePath));
  api.on("open-folder-path", (folderPath) => openFolderByPathAndLoad(folderPath));
  api.on("recent-cleared", () => buildRecentUI());
}
