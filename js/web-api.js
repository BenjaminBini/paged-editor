// web-api.js — Drop-in replacement for window.electronAPI in web mode
//
// This script MUST be loaded as a regular <script> (not type="module")
// so it executes synchronously before ES module evaluation.
// It creates window.electronAPI backed by REST fetch() calls.
//
// If window.electronAPI already exists (Electron), this script does nothing.

(function () {
  "use strict";

  if (window.electronAPI) return; // Running inside Electron — nothing to do

  // ── Configuration ──────────────────────────────────────────────────────────

  // API base URL resolution order:
  // 1. Explicit global: window.__PAGED_EDITOR_API_URL
  // 2. Hash parameter: #apiBase=/some/path (used when embedded in another app's iframe)
  // 3. Auto-detect from pathname (when served at a sub-path like /editor/)
  function resolveApiBase() {
    if (window.__PAGED_EDITOR_API_URL) return window.__PAGED_EDITOR_API_URL;

    const hashParams = new URLSearchParams(location.hash.slice(1));
    const fromHash = hashParams.get("apiBase");
    if (fromHash) return decodeURIComponent(fromHash);

    return location.pathname.replace(/\/(?:index\.html)?$/, "") || "";
  }

  const API_BASE = resolveApiBase();

  // State key for localStorage
  const STATE_KEY = "paged-editor-state";

  // ── Helpers ────────────────────────────────────────────────────────────────

  // When API_BASE is auto-detected (standalone server), paths include /api prefix.
  // When API_BASE is explicit (embedded via hash), it already points to the API root,
  // so we strip the /api prefix from paths.
  const _hasExplicitBase = !!window.__PAGED_EDITOR_API_URL ||
    new URLSearchParams(location.hash.slice(1)).has("apiBase");

  function api(path, opts) {
    const cleanPath = _hasExplicitBase ? path.replace(/^\/api/, "") : path;
    return fetch(API_BASE + cleanPath, opts);
  }

  function encName(name) {
    return encodeURIComponent(name);
  }

  function getLocalState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function setLocalState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  // Track whether we've fetched config yet
  let _configPromise = null;

  function fetchConfig() {
    if (!_configPromise) {
      _configPromise = api("/api/config").then((r) => r.json());
    }
    return _configPromise;
  }

  // ── Event listeners (limited web support) ──────────────────────────────────

  const _listeners = {};

  // ── Web-mode electronAPI ───────────────────────────────────────────────────

  window.electronAPI = {
    // Read a file by path (path = filename in web mode)
    async readFile(filePath) {
      const resp = await api("/api/files/" + encName(filePath));
      if (!resp.ok) throw new Error("Failed to read file: " + filePath);
      const data = await resp.json();
      return data.content;
    },

    // Write a file
    async writeFile(filePath, content) {
      const resp = await api("/api/files/" + encName(filePath), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!resp.ok) throw new Error("Failed to write file: " + filePath);
    },

    // List .md files in workspace
    async readDir(_dirPath) {
      const resp = await api("/api/files");
      if (!resp.ok) throw new Error("Failed to list files");
      return resp.json();
    },

    // Get file modification time
    async getFileModTime(filePath) {
      const resp = await api("/api/files/" + encName(filePath) + "/meta");
      if (!resp.ok) return 0;
      const data = await resp.json();
      return data.modifiedAt;
    },

    // Dialogs — not available in web mode
    async showOpenFileDialog() {
      return null;
    },
    async showOpenFolderDialog() {
      return null;
    },
    async showSaveDialog(defaultName) {
      return defaultName; // auto-save to same name
    },

    // Finder — no-op on web
    async showInFinder(_filePath) {},

    // Window title — update document.title
    async setTitle(title) {
      document.title = title;
    },

    // PDF — no-op on web (could be enhanced later)
    async previewPdf(_htmlContent, _defaultName) {},
    async savePdfAs(_defaultName) {},

    // App state — backed by localStorage, seeded from server config on first call
    async getAppState() {
      const local = getLocalState();
      if (!local._initialized) {
        // First load — seed from server config
        const config = await fetchConfig();
        local._initialized = true;
        local.lastFolder = config.folderName;
        local.recentFolders = [];
        local.recentFiles = [];
        local.openTabs = [];
        local.activeTab = null;
        setLocalState(local);
      }
      return local;
    },

    async setAppState(partial) {
      const state = getLocalState();
      Object.assign(state, partial);
      setLocalState(state);
    },

    // Startup path — not used in web mode
    async hasStartupPath() {
      return false;
    },

    // AI agent collaboration — minimal web stubs
    async getWsPort() {
      return 0;
    },
    async getWsHost() {
      return location.hostname;
    },
    async generateAgentKey() {
      return crypto.randomUUID();
    },
    async revokeAgentKey(_key) {},
    async sendToAgent(_key, _message) {},

    // Event listener registration
    on(channel, callback) {
      if (!_listeners[channel]) _listeners[channel] = [];
      _listeners[channel].push(callback);
    },
  };

  // ── Web-mode feature flags ─────────────────────────────────────────────────

  window.__pagedEditorWebMode = true;

  // ── PostMessage bridge for React component communication ───────────────────

  window.addEventListener("message", (event) => {
    if (!event.data || event.data.source !== "paged-editor-host") return;

    const { type, payload } = event.data;

    if (type === "open-file" && payload?.path) {
      const cbs = _listeners["open-file-path"] || [];
      cbs.forEach((cb) => cb(payload.path));
    }
  });

  // Notify parent frame that the editor is ready
  function notifyParent(type, payload) {
    if (window.parent !== window) {
      window.parent.postMessage(
        { source: "paged-editor", type, payload },
        "*"
      );
    }
  }

  // Expose for use by other modules
  window.__pagedEditorNotifyParent = notifyParent;

  // Signal ready after DOM loads and apply web-mode class
  window.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("web-mode");
    notifyParent("ready", {});
  });
})();
