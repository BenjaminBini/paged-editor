// platform.js — Platform abstraction layer.
// Provides a single import point for all platform capabilities.
// In Electron: populated by preload.js via window.electronAPI.
// In web mode: populated by web-api.js via the same global.
//
// Modules import from here instead of reading window.electronAPI directly.

const api = window.electronAPI;

if (!api) {
  throw new Error("Platform API not available. Ensure preload.js (Electron) or web-api.js (web) is loaded.");
}

// ── Core file I/O ──────────────────────────────────────────────────────────

export const readFile       = (path) => api.readFile(path);
export const writeFile      = (path, content) => api.writeFile(path, content);
export const deleteFile     = (path) => api.deleteFile(path);
export const readDir        = (path) => api.readDir(path);
export const getFileModTime = (path) => api.getFileModTime(path);

// ── Dialogs ────────────────────────────────────────────────────────────────

export const showOpenFileDialog   = () => api.showOpenFileDialog();
export const showOpenFolderDialog = () => api.showOpenFolderDialog();
export const showSaveDialog       = (name) => api.showSaveDialog(name);
export const showInFinder         = (path) => api.showInFinder?.(path);

// ── Window ─────────────────────────────────────────────────────────────────

export const setTitle   = (title) => api.setTitle(title);
export const previewPdf = (html, name) => api.previewPdf?.(html, name);
export const savePdfAs  = (name) => api.savePdfAs?.(name);

// ── State persistence ──────────────────────────────────────────────────────

export const getAppState = () => api.getAppState();
export const setAppState = (partial) => api.setAppState(partial);

// ── Startup ────────────────────────────────────────────────────────────────

export const hasStartupPath = () => api.hasStartupPath();

// ── AI agent collaboration ─────────────────────────────────────────────────

export const getWsPort       = () => api.getWsPort();
export const getWsHost       = () => api.getWsHost();
export const generateAgentKey = () => api.generateAgentKey();
export const revokeAgentKey  = (key) => api.revokeAgentKey(key);
export const sendToAgent     = (key, msg) => api.sendToAgent(key, msg);

// ── Event listener registration ────────────────────────────────────────────

export const on = (channel, callback) => api.on(channel, callback);

// ── Capability detection ───────────────────────────────────────────────────

export const isWebMode = !!window.__pagedEditorWebMode;
export const canShowInFinder = typeof api.showInFinder === "function" && !isWebMode;
