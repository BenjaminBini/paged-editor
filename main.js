const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises");

// ── App state persistence ────────────────────────────────────────────────────
const STATE_FILE = path.join(app.getPath("userData"), "app-state.json");
let appState = { lastFolder: null, lastFile: null, recentFiles: [] };

async function loadAppState() {
  try {
    const data = await fs.readFile(STATE_FILE, "utf-8");
    appState = { ...appState, ...JSON.parse(data) };
  } catch {}
}

async function saveAppState() {
  await fs.writeFile(STATE_FILE, JSON.stringify(appState, null, 2));
}


// ── Window ───────────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile("index.html");
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("read-file", async (_e, filePath) => {
  return fs.readFile(filePath, "utf-8");
});

ipcMain.handle("write-file", async (_e, filePath, content) => {
  await fs.writeFile(filePath, content, "utf-8");
});

ipcMain.handle("read-dir", async (_e, dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith(".md"))
    .map(e => ({ name: e.name, path: path.join(dirPath, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

ipcMain.handle("get-file-mod-time", async (_e, filePath) => {
  const stat = await fs.stat(filePath);
  return stat.mtimeMs;
});

ipcMain.handle("show-open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: "Markdown", extensions: ["md"] }],
    properties: ["openFile"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("show-open-folder-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("show-save-dialog", async (_e, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: "Markdown", extensions: ["md"] }],
    defaultPath: defaultName || "document.md",
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle("set-title", (_e, title) => {
  if (mainWindow) mainWindow.setTitle(title);
});

ipcMain.handle("get-app-state", () => ({ ...appState }));

ipcMain.handle("set-app-state", async (_e, partial) => {
  Object.assign(appState, partial);
  await saveAppState();
  if (partial.recentFiles !== undefined || partial.lastFile !== undefined) buildMenu();
});

// ── Native menu ──────────────────────────────────────────────────────────────

function buildMenu() {
  const recentSubmenu = appState.recentFiles.length > 0
    ? [
        ...appState.recentFiles.map(f => ({
          label: path.basename(f),
          sublabel: f,
          click: () => mainWindow.webContents.send("open-file-path", f),
        })),
        { type: "separator" },
        { label: "Clear Recent", click: () => {
          appState.recentFiles = [];
          saveAppState();
          buildMenu();
        }},
      ]
    : [{ label: "No Recent Files", enabled: false }];

  const template = [
    ...(process.platform === "darwin" ? [{
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    }] : []),
    {
      label: "File",
      submenu: [
        { label: "New File", accelerator: "CmdOrCtrl+N", click: () => mainWindow.webContents.send("menu-new") },
        { type: "separator" },
        { label: "Open File...", accelerator: "CmdOrCtrl+O", click: () => mainWindow.webContents.send("menu-open-file") },
        { label: "Open Folder...", click: () => mainWindow.webContents.send("menu-open-folder") },
        { type: "separator" },
        { label: "Open Recent", submenu: recentSubmenu },
        { type: "separator" },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: () => mainWindow.webContents.send("menu-save") },
        { label: "Save As...", accelerator: "CmdOrCtrl+Shift+S", click: () => mainWindow.webContents.send("menu-save-as") },
        { type: "separator" },
        { label: "Close File", click: () => mainWindow.webContents.send("menu-close-file") },
        { label: "Close Folder", click: () => mainWindow.webContents.send("menu-close-folder") },
        ...(process.platform !== "darwin" ? [{ type: "separator" }, { role: "quit" }] : []),
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        { label: "Insert Table", click: () => mainWindow.webContents.send("menu-insert-table") },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Render Preview", accelerator: "CmdOrCtrl+Enter", click: () => mainWindow.webContents.send("menu-render") },
        { label: "Open in New Window", click: () => mainWindow.webContents.send("menu-preview-tab") },
        { type: "separator" },
        { label: "Toggle Line Wrap", click: () => mainWindow.webContents.send("menu-toggle-wrap") },
        { label: "Toggle Cover & Sommaire", click: () => mainWindow.webContents.send("menu-toggle-cover") },
        { type: "separator" },
        { role: "toggleDevTools" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await loadAppState();
  createWindow();
  buildMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
