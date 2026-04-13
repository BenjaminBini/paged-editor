// session.js — Session persistence, restoration, and recent items UI.

import * as platform from "../infrastructure/platform-adapter.js";
import { readFile, getFileModTime, openFolderByPath, closeFolder, getFileEntries } from "../workspace/files/file-manager.js";
import { openTab, findTabByPath } from "../workspace/tabs/tab-bar-controller.js";
import { openFilePath, openFolderByPathAndLoad } from "../workspace/files/file-operations.js";
import {
  COVER_TAB_KIND,
  TOC_TAB_KIND,
  getProjectJsonPath,
  getTocVirtualPath,
  loadProjectJsonSource,
} from "../document/model/memoire-views.js";

// ── Session restore ────────────────────────────────────────────────────────

export async function tryRestore(): Promise<boolean> {
  const state = await platform.getAppState() as Record<string, any>;

  if (state.lastFolder) {
    try {
      await openFolderByPath(state.lastFolder);
      const openTabNames = state.openTabs || [];
      const activeTabName = state.activeTab;
      const entries = getFileEntries();

      if (openTabNames.length > 0) {
        for (const tabInfo of openTabNames) {
          if (tabInfo?.kind === COVER_TAB_KIND) {
            const projectPath = getProjectJsonPath(state.lastFolder);
            if (!projectPath) continue;
            const content = await loadProjectJsonSource(state.lastFolder);
            let modTime = 0;
            try {
              modTime = await getFileModTime(projectPath);
            } catch {}
            openTab(projectPath, tabInfo.name || "Cover", content, modTime, { kind: COVER_TAB_KIND });
            continue;
          }
          if (tabInfo?.kind === TOC_TAB_KIND) {
            const tocPath = getTocVirtualPath(state.lastFolder);
            if (!tocPath) continue;
            openTab(tocPath, tabInfo.name || "TOC", "", 0, {
              kind: TOC_TAB_KIND,
              readOnly: true,
              editorDisabled: true,
            });
          }
          const name = typeof tabInfo === "string" ? tabInfo : tabInfo.name;
          const path = typeof tabInfo === "object" ? tabInfo.path : null;
          const entry = (path && entries.find((e) => e.path === path))
            || entries.find((e) => e.name === name);
          if (entry) {
            const [content, modTime] = await Promise.all([readFile(entry.path), getFileModTime(entry.path)]);
            openTab(entry.path, entry.name, content, modTime);
          }
        }
        if (activeTabName) {
          if (typeof activeTabName === "object" && activeTabName.kind === COVER_TAB_KIND) {
            const coverPath = getProjectJsonPath(state.lastFolder);
            if (coverPath) {
              const idx = findTabByPath(coverPath);
              if (idx >= 0) openTab(coverPath, activeTabName.name || "Cover", undefined, undefined);
            }
          } else if (typeof activeTabName === "object" && activeTabName.kind === TOC_TAB_KIND) {
            const tocPath = getTocVirtualPath(state.lastFolder);
            if (tocPath) {
              const idx = findTabByPath(tocPath);
              if (idx >= 0) openTab(tocPath, activeTabName.name || "TOC", undefined, undefined);
            }
          } else {
            const activePath = typeof activeTabName === "object"
              ? activeTabName.path || activeTabName.name
              : activeTabName;
            const entry = entries.find((e) => e.path === activePath)
              || entries.find((e) => e.name === activePath);
            if (entry) {
              const idx = findTabByPath(entry.path);
              if (idx >= 0) openTab(entry.path, entry.name, undefined, undefined);
            }
          }
        }
      } else if (state.lastFile) {
        const entry = entries.find((e) => e.name === state.lastFile);
        if (entry) {
          const [content, modTime] = await Promise.all([readFile(entry.path), getFileModTime(entry.path)]);
          openTab(entry.path, entry.name, content, modTime);
        }
      } else if (platform.isWebMode && entries.length > 0) {
        const first = entries[0];
        const [content, modTime] = await Promise.all([readFile(first.path), getFileModTime(first.path)]);
        openTab(first.path, first.name, content, modTime);
      }
      return true;
    } catch (e) {
      console.warn("Folder restore failed:", e);
      closeFolder();
    }
  }

  // No folder — restore standalone file tabs
  const standaloneOpenTabs = state.openTabs || [];
  if (!state.lastFolder && standaloneOpenTabs.length > 0) {
    for (const tabInfo of standaloneOpenTabs) {
      const filePath = typeof tabInfo === "string" ? tabInfo : tabInfo.path;
      if (filePath) {
        try { await openFilePath(filePath); } catch (e) { console.warn("Tab restore failed:", filePath, e); }
      }
    }
    if (state.activeTab) {
      const activePath = typeof state.activeTab === "object"
        ? state.activeTab.path || state.activeTab.name
        : state.activeTab;
      const idx = findTabByPath(activePath);
      if (idx >= 0 && activePath) openTab(activePath, activePath.split("/").pop() ?? activePath, undefined, undefined);
    }
    return standaloneOpenTabs.length > 0;
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

export async function buildRecentUI(): Promise<void> {
  const state = await platform.getAppState() as Record<string, any>;
  const recentFiles = (state.recentFiles as string[]) || [];
  const recentFolders = (state.recentFolders as string[]) || [];

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
          btn.textContent = f.split("/").pop() ?? f;
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
          btn.textContent = f.split("/").pop() ?? f;
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
        link.onclick = (e) => { e.preventDefault(); openFolderByPathAndLoad(f); };
        welcomeFolders.appendChild(link);
      }
      for (const f of recentFiles) {
        const link = document.createElement("a");
        link.className = "recent-link";
        link.textContent = f;
        link.href = "#";
        link.onclick = (e) => { e.preventDefault(); openFilePath(f); };
        welcomeFiles.appendChild(link);
      }
    }
  }
}
