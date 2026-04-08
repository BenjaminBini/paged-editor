const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("write-file", filePath, content),
  readDir: (dirPath) => ipcRenderer.invoke("read-dir", dirPath),
  getFileModTime: (filePath) => ipcRenderer.invoke("get-file-mod-time", filePath),
  deleteFile: (filePath) => ipcRenderer.invoke("delete-file", filePath),
  showOpenFileDialog: () => ipcRenderer.invoke("show-open-file-dialog"),
  showOpenFolderDialog: () => ipcRenderer.invoke("show-open-folder-dialog"),
  showSaveDialog: (defaultName) => ipcRenderer.invoke("show-save-dialog", defaultName),
  showInFinder: (filePath) => ipcRenderer.invoke("show-in-finder", filePath),
  setTitle: (title) => ipcRenderer.invoke("set-title", title),
  previewPdf: (htmlContent, defaultName) => ipcRenderer.invoke("preview-pdf", htmlContent, defaultName),
  savePdfAs: (defaultName) => ipcRenderer.invoke("save-pdf-as", defaultName),
  getAppState: () => ipcRenderer.invoke("get-app-state"),
  setAppState: (partial) => ipcRenderer.invoke("set-app-state", partial),
  hasStartupPath: () => ipcRenderer.invoke("has-startup-path"),
  // AI agent collaboration
  getWsPort: () => ipcRenderer.invoke("get-ws-port"),
  getWsHost: () => ipcRenderer.invoke("get-ws-host"),
  generateAgentKey: () => ipcRenderer.invoke("generate-agent-key"),
  revokeAgentKey: (key) => ipcRenderer.invoke("revoke-agent-key", key),
  sendToAgent: (key, message) => ipcRenderer.invoke("send-to-agent", key, message),
  on: (channel, callback) => {
    const validChannels = [
      "menu-new", "menu-open-file", "menu-open-folder",
      "menu-save", "menu-save-as", "menu-close-file", "menu-close-folder",
      "menu-insert-table", "menu-render", "menu-preview-tab", "menu-download-pdf", "menu-download-memoire", "menu-toggle-wrap", "menu-toggle-cover",
      "open-file-path", "open-folder-path", "recent-cleared",
      "agent-connected", "agent-disconnected", "agent-message",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
});
