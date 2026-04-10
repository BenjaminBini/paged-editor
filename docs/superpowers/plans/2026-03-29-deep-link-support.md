# Deep Link Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable opening files and folders in Paged Editor via a `paged` CLI command and the `paged://` custom protocol, with auto-detection of file vs directory.

**Architecture:** Add single-instance lock to `main.js` so second launches forward paths to the running window. Register `paged://` protocol via `app.setAsDefaultProtocolClient()`. Add a `bin/paged` Node script that resolves paths and delegates to the protocol handler. On macOS, protocol URLs arrive via the `open-url` event; on Linux/Windows they arrive as process argv.

**Tech Stack:** Electron (single-instance lock, protocol client), Node.js (bin script), electron-builder (protocol association in build config)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `main.js` | Modify | Add single-instance lock, protocol registration, path handling from argv/URL |
| `bin/paged.js` | Create | CLI entry point — resolves path, opens `paged://` URL |
| `package.json` | Modify | Add `"bin"` field, add `"protocols"` to electron-builder config |

---

### Task 1: Single-instance lock and argv path handling in main.js

**Files:**
- Modify: `main.js:30-44` (window creation), `main.js:238-286` (lifecycle)

- [ ] **Step 1: Add single-instance lock and argv handler**

In `main.js`, add these pieces:

1. A `handlePathArg(pathStr)` function that stats the path and sends the appropriate IPC event to the renderer:

```js
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
```

2. A `extractPathFromArgs(argv)` function that finds the first non-flag, non-electron argument that looks like a path (not a `paged://` URL):

```js
function extractPathFromArgs(argv) {
  // Skip: electron binary, main.js, flags (--), paged:// URLs
  for (const arg of argv.slice(1)) {
    if (arg.startsWith("--") || arg.startsWith("-")) continue;
    if (arg.endsWith("main.js") || arg.endsWith("electron")) continue;
    if (arg.startsWith("paged://")) continue;
    if (arg === ".") continue;
    return arg;
  }
  return null;
}
```

3. Single-instance lock before `app.whenReady()`. Replace the lifecycle section starting at line 238:

```js
// ── Single instance lock ────────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    // Another instance was launched — focus window and handle args
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Check for paged:// URL in argv (Linux/Windows)
    const url = argv.find(a => a.startsWith("paged://"));
    if (url) {
      handleProtocolUrl(url);
    } else {
      const pathArg = extractPathFromArgs(argv);
      if (pathArg) handlePathArg(pathArg);
    }
  });

  app.whenReady().then(async () => {
    await loadAppState();
    createWindow();
    buildMenu();

    // Handle path argument from initial launch
    const pathArg = extractPathFromArgs(process.argv);
    if (pathArg) {
      mainWindow.webContents.once("did-finish-load", () => handlePathArg(pathArg));
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
```

- [ ] **Step 2: Verify the app still launches normally**

Run: `npm start`
Expected: App opens normally, restores last session as before.

- [ ] **Step 3: Test argv path handling**

Run: `npx electron . /path/to/some/folder`
Expected: App opens and loads that folder in the sidebar.

Run: `npx electron . /path/to/some/file.md`
Expected: App opens and loads that file in the editor.

- [ ] **Step 4: Commit**

```bash
git add main.js
git commit -m "feat: add single-instance lock and argv path handling for deep links"
```

---

### Task 2: Register `paged://` protocol and handle protocol URLs

**Files:**
- Modify: `main.js` (add protocol registration + URL handler)

- [ ] **Step 1: Add protocol URL handler function**

Add this function in `main.js` near the `handlePathArg` function:

```js
function handleProtocolUrl(url) {
  // paged:///absolute/path/to/thing → extract path
  // URL format: paged:///path or paged://open/path
  let pathStr;
  try {
    const parsed = new URL(url);
    // pathname gives us the path (e.g., /Users/you/folder)
    pathStr = decodeURIComponent(parsed.pathname);
  } catch {
    console.error("Invalid paged:// URL:", url);
    return;
  }
  if (pathStr) handlePathArg(pathStr);
}
```

- [ ] **Step 2: Register the protocol and wire macOS `open-url` event**

Add this BEFORE the `app.whenReady()` call (inside the `else` block of the single-instance check):

```js
// Register paged:// protocol (must happen before ready on macOS)
if (process.defaultApp) {
  // Dev mode: register with full argv so Electron finds main.js
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
    // App not ready yet — defer until window is loaded
    app.whenReady().then(() => {
      mainWindow.webContents.once("did-finish-load", () => handleProtocolUrl(url));
    });
  }
});
```

- [ ] **Step 3: Handle protocol URL in initial argv (Linux/Windows)**

Inside the `app.whenReady()` callback, add this after the `pathArg` check:

```js
// Handle paged:// URL from initial launch (Linux/Windows)
const protocolUrl = process.argv.find(a => a.startsWith("paged://"));
if (protocolUrl) {
  mainWindow.webContents.once("did-finish-load", () => handleProtocolUrl(protocolUrl));
}
```

- [ ] **Step 4: Test protocol on macOS**

Run: `open paged:///Users/$(whoami)/path/to/folder`
Expected: Paged Editor activates/launches and opens that folder.

Run: `open paged:///Users/$(whoami)/path/to/file.md`
Expected: Paged Editor activates/launches and opens that file.

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat: register paged:// protocol handler with file/folder auto-detection"
```

---

### Task 3: Create `bin/paged.js` CLI command

**Files:**
- Create: `bin/paged.js`
- Modify: `package.json`

- [ ] **Step 1: Create the bin script**

Create `bin/paged.js`:

```js
#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");

const target = process.argv[2];

if (!target) {
  console.log("Usage: paged <path>");
  console.log("  Opens a file or folder in Paged Editor.");
  console.log("");
  console.log("Examples:");
  console.log("  paged .                    # open current directory");
  console.log("  paged ~/projects/my-doc    # open a folder");
  console.log("  paged ./readme.md          # open a single file");
  process.exit(0);
}

const resolved = path.resolve(target);
const url = `paged:///${resolved}`;

if (process.platform === "darwin") {
  execSync(`open "${url}"`);
} else if (process.platform === "linux") {
  execSync(`xdg-open "${url}"`);
} else {
  // Windows
  execSync(`start "" "${url}"`);
}
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x bin/paged.js`

- [ ] **Step 3: Add bin field to package.json**

Add to the top-level of `package.json`:

```json
"bin": {
  "paged": "./bin/paged.js"
},
```

- [ ] **Step 4: Add protocol config to electron-builder**

In `package.json` under `"build"`, add protocols config:

```json
"protocols": [
  {
    "name": "Paged Editor",
    "schemes": ["paged"]
  }
]
```

Also add `"bin/paged.js"` to the `"files"` array in the build config.

- [ ] **Step 5: Test the CLI locally**

Run: `npm link`
Then: `paged .`
Expected: Paged Editor activates and opens the current directory.

Run: `paged /path/to/file.md`
Expected: Paged Editor activates and opens that file.

- [ ] **Step 6: Commit**

```bash
git add bin/paged.js package.json
git commit -m "feat: add paged CLI command and protocol build config"
```

---

### Task 4: Skip session restore when a deep link path is provided

**Files:**
- Modify: `main.js` (pass a flag to the renderer)
- Modify: `preload.js` (expose the flag)
- Modify: `js/app.js` (check the flag before restoring)

The app currently always runs `tryRestore()` on startup, which would fight with a deep link path. When a path is provided via CLI or protocol, we should skip the restore.

- [ ] **Step 1: Track whether a deep link path was provided in main.js**

Add a variable near the top of `main.js`:

```js
let startupPathPending = false;
```

Set it to `true` wherever we detect an argv path or protocol URL during startup. In the `app.whenReady()` block, after the existing argv/protocol checks:

```js
const pathArg = extractPathFromArgs(process.argv);
const protocolUrl = process.argv.find(a => a.startsWith("paged://"));
if (pathArg || protocolUrl) {
  startupPathPending = true;
  mainWindow.webContents.once("did-finish-load", () => {
    if (protocolUrl) handleProtocolUrl(protocolUrl);
    else handlePathArg(pathArg);
  });
}
```

Also in the `open-url` handler, when the app isn't ready yet:

```js
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
```

- [ ] **Step 2: Expose the flag via IPC**

In `main.js`, add a new IPC handler:

```js
ipcMain.handle("has-startup-path", () => startupPathPending);
```

In `preload.js`, add to the exposed API:

```js
hasStartupPath: () => ipcRenderer.invoke("has-startup-path"),
```

- [ ] **Step 3: Skip restore when deep link is pending**

In `js/app.js`, modify the startup block (around line 588):

```js
pagedReady.then(async () => {
  const hasStartupPath = await api.hasStartupPath();
  const loaded = hasStartupPath ? false : await tryRestore();
  hideLoading();
  if (!loaded && !cm.getValue()) {
    showWelcome();
  } else {
    hideWelcome();
  }
  restoreDone = true;
  updateMenuState();
  buildRecentUI();

  // Initialize AI agent collaboration
  initAiCollab(cm, () => standaloneFilePath || (activeFileIdx >= 0 && fileEntries[activeFileIdx]?.path) || null);
}).catch(e => {
  hideLoading();
  if (status) status.textContent = "Startup error: " + e.message;
  console.error("pagedReady failed:", e);
});
```

- [ ] **Step 4: Test deep link skips restore**

1. Open a folder normally, close the app (so last session is saved).
2. Run: `paged /path/to/different/folder`
3. Expected: App opens directly to the specified folder, NOT the previously saved session.

- [ ] **Step 5: Commit**

```bash
git add main.js preload.js js/app.js
git commit -m "feat: skip session restore when deep link path is provided"
```
