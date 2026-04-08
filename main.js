const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const os = require("os");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

// ── App state persistence ────────────────────────────────────────────────────
const STATE_FILE = path.join(app.getPath("userData"), "app-state.json");
let appState = { lastFolder: null, lastFile: null, recentFiles: [], recentFolders: [] };
let startupPathPending = false;

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

ipcMain.handle("delete-file", async (_e, filePath) => {
  await fs.unlink(filePath);
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

// ── PDF generation helper ─────────────────────────────────────────────────

async function generatePdf(htmlContent) {
  const printWin = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { contextIsolation: true },
  });
  const tmpPath = path.join(app.getPath("temp"), "paged-editor-print.html");
  await fs.writeFile(tmpPath, Buffer.from(htmlContent, "utf-8"));
  await printWin.loadFile(tmpPath);

  // Wait for Paged.js to finish rendering
  await new Promise((resolve) => {
    const check = () => {
      printWin.webContents.executeJavaScript(
        `document.querySelector('.pagedjs_pages') !== null`
      ).then((ready) => {
        if (ready) resolve();
        else setTimeout(check, 200);
      }).catch(() => setTimeout(check, 200));
    };
    setTimeout(check, 500);
  });
  await new Promise((r) => setTimeout(r, 500));

  // Extract heading outline for PDF bookmarks
  const outline = await printWin.webContents.executeJavaScript(`
    (function() {
      var result = [];
      document.querySelectorAll('h1[id], h2[id], h3[id]').forEach(function(h) {
        var page = h.closest('.pagedjs_page');
        if (!page) return;
        var pageNum = parseInt(page.dataset.pageNumber, 10) || 0;
        var depth = parseInt(h.tagName[1], 10);
        var text = h.textContent.replace(/[\\u25CF]/g, '').replace(/\\s+/g, ' ').trim();
        result.push({ depth: depth, title: text, page: pageNum });
      });
      return result;
    })()
  `);

  const buf = await printWin.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
  });
  printWin.close();

  // Add PDF bookmarks
  const { PDFDocument } = require("pdf-lib");
  const pdfDoc = await PDFDocument.load(buf);
  if (outline && outline.length > 0) {
    try {
      const pages = pdfDoc.getPages();
      const outlineItems = [];
      for (const entry of outline) {
        if (entry.depth > 2) continue;
        const pageIdx = Math.max(0, Math.min(entry.page - 1, pages.length - 1));
        outlineItems.push({ title: entry.title, pageIdx, depth: entry.depth });
      }
      if (outlineItems.length > 0) addPdfOutline(pdfDoc, outlineItems);
    } catch (e) {
      console.warn("Could not add PDF outline:", e);
    }
  }
  return Buffer.from(await pdfDoc.save());
}

function addPdfOutline(pdfDoc, items) {
  const ctx = pdfDoc.context;
  const pages = pdfDoc.getPages();
  const outlineRef = ctx.nextRef();
  const itemRefs = items.map(() => ctx.nextRef());

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const pageRef = pages[item.pageIdx].ref;
    const dict = new Map();
    dict.set('Title', ctx.obj(item.title));
    dict.set('Parent', outlineRef);
    dict.set('Dest', ctx.obj([pageRef, 'Fit']));
    if (i > 0) dict.set('Prev', itemRefs[i - 1]);
    if (i < items.length - 1) dict.set('Next', itemRefs[i + 1]);
    ctx.assign(itemRefs[i], ctx.obj(Object.fromEntries(dict)));
  }
  ctx.assign(outlineRef, ctx.obj({
    Type: 'Outlines',
    First: itemRefs[0],
    Last: itemRefs[itemRefs.length - 1],
    Count: items.length,
  }));
  pdfDoc.catalog.set(ctx.obj('Outlines'), outlineRef);
  pdfDoc.catalog.set(ctx.obj('PageMode'), ctx.obj('UseOutlines'));
}

// ── PDF preview & save ────────────────────────────────────────────────────

let _lastPdfBuffer = null;
let _lastPdfName = "document.pdf";

ipcMain.handle("preview-pdf", async (_e, htmlContent, defaultName) => {
  _lastPdfName = (defaultName || "document").replace(/\.md$/i, "") + ".pdf";
  _lastPdfBuffer = await generatePdf(htmlContent);

  const tempPdf = path.join(app.getPath("temp"), "paged-preview.pdf");
  await fs.writeFile(tempPdf, _lastPdfBuffer);
  return { tempPath: tempPdf, name: _lastPdfName };
});

ipcMain.handle("save-pdf-as", async (_e, defaultName) => {
  if (!_lastPdfBuffer) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: "PDF", extensions: ["pdf"] }],
    defaultPath: defaultName || _lastPdfName,
  });
  if (result.canceled) return null;
  await fs.writeFile(result.filePath, _lastPdfBuffer);
  return result.filePath;
});

ipcMain.handle("get-app-state", () => ({ ...appState }));

ipcMain.handle("set-app-state", async (_e, partial) => {
  Object.assign(appState, partial);
  await saveAppState();
  if (partial.recentFiles !== undefined || partial.lastFile !== undefined) buildMenu();
});

ipcMain.handle("get-ws-port", () => wsPort);
ipcMain.handle("get-ws-host", () => os.hostname());
ipcMain.handle("has-startup-path", () => startupPathPending);

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

ipcMain.handle("show-in-finder", (_e, filePath) => {
  shell.showItemInFolder(filePath);
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
        { label: "Download PDF", accelerator: "CmdOrCtrl+Shift+E", click: () => mainWindow.webContents.send("menu-download-pdf") },
        { label: "Download Full Mémoire", click: () => mainWindow.webContents.send("menu-download-memoire") },
        { type: "separator" },
        { label: "Toggle Line Wrap", click: () => mainWindow.webContents.send("menu-toggle-wrap") },
        { label: "Toggle Cover & Sommaire", click: () => mainWindow.webContents.send("menu-toggle-cover") },
        { type: "separator" },
        { role: "reload" },
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

// ── Deep link / CLI path handling ───────────────────────────────────────────

async function handlePathArg(pathStr) {
  if (!pathStr || !mainWindow) return;
  try {
    const resolved = path.resolve(pathStr);
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) {
      mainWindow.webContents.send("open-folder-path", resolved);
    } else if (stat.isFile()) {
      mainWindow.webContents.send("open-file-path", resolved);
    }
  } catch (e) {
    console.error("Failed to open path:", pathStr, e.message);
  }
}

function extractPathFromArgs(argv) {
  // Skip: electron binary, main.js, flags (--), paged:// URLs, app root dir
  const appRoot = path.resolve(__dirname);
  for (const arg of argv.slice(1)) {
    if (arg.startsWith("--") || arg.startsWith("-")) continue;
    if (arg.endsWith("main.js") || arg.endsWith("electron")) continue;
    if (arg.startsWith("paged://")) continue;
    if (arg === ".") continue; // "." is the app root in `electron .`, not a user path
    if (path.resolve(arg) === appRoot) continue; // skip app root passed by CLI
    return arg;
  }
  return null;
}

function handleProtocolUrl(url) {
  // paged:///absolute/path/to/thing → extract path
  let pathStr;
  try {
    const parsed = new URL(url);
    pathStr = decodeURIComponent(parsed.pathname);
  } catch {
    console.error("Invalid paged:// URL:", url);
    return;
  }
  if (pathStr) handlePathArg(pathStr);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    // Focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Handle path or protocol URL from second instance
    const protocolUrl = argv.find(a => a.startsWith("paged://"));
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl);
    } else {
      const pathArg = extractPathFromArgs(argv);
      if (pathArg) handlePathArg(pathArg);
    }
  });

  // Register paged:// protocol (must happen before ready on macOS)
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient("paged", process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient("paged");
  }

  // macOS: protocol URL arrives via open-url event
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (mainWindow) {
      handleProtocolUrl(url);
    } else {
      startupPathPending = true;
      app.whenReady().then(() => {
        mainWindow.webContents.once("did-finish-load", () => handleProtocolUrl(url));
      });
    }
  });

  app.whenReady().then(async () => {
    await loadAppState();
    createWindow();
    buildMenu();

    // Handle path arg or protocol URL from initial launch
    const pathArg = extractPathFromArgs(process.argv);
    const protocolUrl = process.argv.find(a => a.startsWith("paged://"));
    if (pathArg || protocolUrl) {
      startupPathPending = true;
      mainWindow.webContents.once("did-finish-load", () => {
        if (protocolUrl) handleProtocolUrl(protocolUrl);
        else handlePathArg(pathArg);
      });
    }

    // Start WebSocket server on all interfaces (supports remote agents)
    wss = new WebSocketServer({ host: "0.0.0.0", port: 0 });
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
}
