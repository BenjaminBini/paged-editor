const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

// ── App state persistence ────────────────────────────────────────────────────
const STATE_FILE = path.join(app.getPath("userData"), "app-state.json");
let appState = { lastFolder: null, lastFile: null, recentFiles: [], recentFolders: [] };

// ── Agent keys & WebSocket ──────────────────────────────────────────────────
const agentKeys = new Map(); // key -> { used: false }
let wss = null;
let wsPort = 0;
const agentConnections = new Map(); // key -> { ws, name }

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

ipcMain.handle("get-ws-port", () => wsPort);

ipcMain.handle("generate-agent-key", () => {
  const key = crypto.randomUUID();
  agentKeys.set(key, { used: false });
  return key;
});

ipcMain.handle("revoke-agent-key", (_e, key) => {
  agentKeys.delete(key);
  const conn = agentConnections.get(key);
  if (conn) {
    conn.ws.close();
    agentConnections.delete(key);
  }
});

ipcMain.handle("send-to-agent", (_e, key, message) => {
  const conn = agentConnections.get(key);
  if (conn && conn.ws.readyState === 1) {
    conn.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
});

// ── Native menu ──────────────────────────────────────────────────────────────

function buildMenu() {
  const recentFiles = appState.recentFiles || [];
  const recentFolders = appState.recentFolders || [];
  const hasRecent = recentFiles.length > 0 || recentFolders.length > 0;

  const recentSubmenu = hasRecent
    ? [
        ...(recentFolders.length > 0 ? [
          { label: "Folders", enabled: false },
          ...recentFolders.map(f => ({
            label: path.basename(f),
            sublabel: f,
            click: () => mainWindow.webContents.send("open-folder-path", f),
          })),
        ] : []),
        ...(recentFolders.length > 0 && recentFiles.length > 0 ? [{ type: "separator" }] : []),
        ...(recentFiles.length > 0 ? [
          { label: "Files", enabled: false },
          ...recentFiles.map(f => ({
            label: path.basename(f),
            sublabel: f,
            click: () => mainWindow.webContents.send("open-file-path", f),
          })),
        ] : []),
        { type: "separator" },
        { label: "Clear Recent", click: () => {
          appState.recentFiles = [];
          appState.recentFolders = [];
          saveAppState();
          buildMenu();
          mainWindow.webContents.send("recent-cleared");
        }},
      ]
    : [{ label: "No Recent Items", enabled: false }];

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

  // Start WebSocket server on random available port
  wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve) => wss.on("listening", resolve));
  wsPort = wss.address().port;
  console.log("AI collab WebSocket server on port", wsPort);

  wss.on("connection", (ws) => {
    let authenticatedKey = null;

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (!authenticatedKey) {
        if (msg.type === "auth" && msg.key && agentKeys.has(msg.key) && !agentKeys.get(msg.key).used) {
          authenticatedKey = msg.key;
          agentKeys.get(msg.key).used = true;
          const name = msg.name || "Agent";
          agentConnections.set(msg.key, { ws, name });
          ws.send(JSON.stringify({ type: "auth_ok" }));
          mainWindow?.webContents.send("agent-connected", { key: msg.key, name });
        } else {
          ws.send(JSON.stringify({ type: "auth_error", message: "Invalid or already used key" }));
          ws.close();
        }
        return;
      }

      // Authenticated — forward to renderer
      mainWindow?.webContents.send("agent-message", { key: authenticatedKey, message: msg });
    });

    ws.on("close", () => {
      if (authenticatedKey) {
        agentConnections.delete(authenticatedKey);
        mainWindow?.webContents.send("agent-disconnected", { key: authenticatedKey });
      }
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
