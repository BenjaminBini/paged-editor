// platform.js — Platform abstraction layer.
// Provides a single import point for all platform capabilities.
// In Electron: populated by preload.js via window.electronAPI.
// In web mode: populated by web-api.js via the same global.
//
// Modules import from here instead of reading window.electronAPI directly.

const api: ElectronAPI = window.electronAPI as ElectronAPI;

if (!api) {
  throw new Error("Platform API not available. Ensure preload.js (Electron) or web-api.js (web) is loaded.");
}

// ── Core file I/O ──────────────────────────────────────────────────────────

export const readFile       = (path: string): Promise<string> => api.readFile(path);
export const writeFile      = (path: string, content: string): Promise<void> => api.writeFile(path, content);
export const writeBinaryFile = (path: string, base64: ArrayBuffer): Promise<void> => api.writeBinaryFile(path, base64);
export const deleteFile     = (path: string): Promise<void> => api.deleteFile(path);
export const readDir        = (path: string): Promise<Array<{ name: string; path: string }>> => api.readDir(path);
export const getFileModTime = (path: string): Promise<number> => api.getFileModTime(path);

// ── Dialogs ────────────────────────────────────────────────────────────────

export const showOpenFileDialog   = (): Promise<string | null> => api.showOpenFileDialog();
export const showOpenFolderDialog = (): Promise<string | null> => api.showOpenFolderDialog();
export const showSaveDialog       = (name: string): Promise<string | null> => api.showSaveDialog(name);
export const showInFinder         = (path: string): void => api.showInFinder?.(path);
export const confirmWindowClose  = (): Promise<void> | undefined => api.confirmWindowClose?.();
export const cancelWindowClose   = (): Promise<void> | undefined => api.cancelWindowClose?.();

// ── Window ─────────────────────────────────────────────────────────────────

export const setTitle   = (title: string): void => api.setTitle(title);
export const previewPdf = (html: string, name: string): Promise<{ tempPath: string; name: string } | null> | void => api.previewPdf?.(html, name);
export const savePdfAs  = (name: string): void => api.savePdfAs?.(name);

// ── State persistence ──────────────────────────────────────────────────────

export const getAppState = (): Promise<Record<string, unknown>> => api.getAppState();
export const setAppState = (partial: Record<string, unknown>): Promise<void> => api.setAppState(partial);

// ── Startup ────────────────────────────────────────────────────────────────

export const hasStartupPath = (): Promise<boolean> => api.hasStartupPath();
export const getWorkspaceAssetBaseHref = (path: string): string => api.getWorkspaceAssetBaseHref?.(path) || "";

// ── AI agent collaboration ─────────────────────────────────────────────────

export const getWsPort       = (): Promise<number> => api.getWsPort();
export const getWsHost       = (): Promise<string> => api.getWsHost();
export const generateAgentKey = (): Promise<string> => api.generateAgentKey();
export const revokeAgentKey  = (key: string): Promise<void> => api.revokeAgentKey(key);
export const sendToAgent     = (key: string, msg: unknown): void => api.sendToAgent(key, msg);

// ── Event listener registration ────────────────────────────────────────────

export const on = (channel: string, callback: (...args: any[]) => void): void => api?.on(channel, callback);

// ── Capability detection ───────────────────────────────────────────────────

export const isWebMode = !!window.__pagedEditorWebMode;
export const canShowInFinder = typeof api.showInFinder === "function" && !isWebMode;
