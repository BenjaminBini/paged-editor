const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("write-file", filePath, content),
  readDir: (dirPath) => ipcRenderer.invoke("read-dir", dirPath),
  getFileModTime: (filePath) => ipcRenderer.invoke("get-file-mod-time", filePath),
  showOpenFileDialog: () => ipcRenderer.invoke("show-open-file-dialog"),
  showOpenFolderDialog: () => ipcRenderer.invoke("show-open-folder-dialog"),
  showSaveDialog: (defaultName) => ipcRenderer.invoke("show-save-dialog", defaultName),
  setTitle: (title) => ipcRenderer.invoke("set-title", title),
  getAppState: () => ipcRenderer.invoke("get-app-state"),
  setAppState: (partial) => ipcRenderer.invoke("set-app-state", partial),
  on: (channel, callback) => {
    const validChannels = [
      "menu-new", "menu-open-file", "menu-open-folder",
      "menu-save", "menu-save-as", "menu-close-file", "menu-close-folder",
      "menu-insert-table", "menu-render", "menu-preview-tab", "menu-toggle-wrap", "menu-toggle-cover",
      "open-file-path", "open-folder-path", "recent-cleared",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
});
