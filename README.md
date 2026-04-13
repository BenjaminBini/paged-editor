# Paged Editor

Markdown-to-PDF editor with live Paged.js preview. Built for BEORN technical proposals with French typography, CodeMirror 5 editing, and conflict-aware saving.

The editor runs in three modes:

| Mode | Storage | Use case |
|------|---------|----------|
| **Electron desktop app** | Local filesystem | Full-featured desktop editor |
| **Web standalone server** | Server-side files | Quick preview/editing server |
| **Web embedded (Express router)** | Server-side files | Embed in an existing app |

## 1. Electron Desktop App

The primary mode. Full native experience with file dialogs, Finder integration, and window management.

### Install & Run

```bash
npm install
npm start          # launches Electron
```

### Build Distributables

```bash
npm run build          # macOS .dmg + .zip
npm run build:win      # Windows NSIS installer
npm run build:linux    # Linux AppImage + .deb
npm run build:all      # All platforms
```

### Features (Electron-only)

- Native Open File / Open Folder / Save As dialogs
- Show in Finder / Explorer
- App state persistence across restarts
- Deep link protocol (`paged://`)
- AI agent collaboration via WebSocket

---

## 2. Web Standalone Server

Serves the editor as a web page backed by a REST API. Files are real `.md` files on disk.

### Install & Run

```bash
cd server
npm install
WORKSPACE=/path/to/folder PORT=3000 node index.js
```

Then open `http://localhost:3000` in a browser.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE` | Current directory | Path to a folder of `.md` files, or a single `.md` file |
| `PORT` | `3000` | Server port |

### Folder vs. Single-File Mode

The server auto-detects the mode from the `WORKSPACE` path:

```bash
# Folder mode — edit all .md files in the directory
WORKSPACE=/path/to/docs node server/index.js

# Single-file mode — edit just one file
WORKSPACE=/path/to/document.md node server/index.js
```

In folder mode, the sidebar shows all `.md` files and you can create/delete files. In single-file mode, only the specified file is editable.

---

## 3. Web Embedded (Express Router)

Mount the editor inside an existing Express application at any path.

### Install

```bash
# In your project
npm install @paged-editor/server
```

Or, since the package isn't published to npm yet, reference it locally:

```bash
npm install ./path-to/paged-editor/server
```

### Mount in Express

```js
import express from "express";
import { createEditorRouter } from "@paged-editor/server/router";

const app = express();

// Your existing routes
app.get("/api/users", (req, res) => { /* ... */ });
app.get("/dashboard", (req, res) => { /* ... */ });

// Mount the editor at /editor
app.use("/editor", createEditorRouter({
  workspace: "/var/data/my-docs",
}));

app.listen(3000);
// Editor available at http://localhost:3000/editor/
```

### Router Options

```js
createEditorRouter({
  workspace: "/path/to/folder",   // Required — folder or single .md file
  editorRoot: "/path/to/editor",  // Optional — path to editor static files
                                  //            (defaults to paged-editor project root)
})
```

### React Component

A ready-made React wrapper is available in `packages/react/`:

```bash
cd packages/react
npm install
npm run build
```

Then in your React app:

```jsx
import { PagedEditor } from "@paged-editor/react";

function DocsPage() {
  return (
    <PagedEditor
      apiUrl="/editor"
      onSave={(file, name) => console.log("Saved:", name)}
      onChange={(file, name) => console.log("Changed:", name)}
      onReady={() => console.log("Editor loaded")}
      style={{ width: "100%", height: "100vh" }}
    />
  );
}
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `apiUrl` | `string` | **Required.** URL or same-origin path where the editor server is mounted |
| `className` | `string` | CSS class for the container div |
| `style` | `CSSProperties` | Inline styles for the container div |
| `onReady` | `() => void` | Called when the editor iframe finishes loading |
| `onSave` | `(file, name) => void` | Called after a file is saved |
| `onChange` | `(file, name) => void` | Called when content changes (debounced ~500ms) |

---

## REST API Reference

All three web modes (standalone + embedded) expose the same API. When embedded, all paths are relative to the mount point.

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/config` | — | `{ mode, folderPath, folderName, singleFile }` |
| `GET` | `/api/files` | — | `[{ name, path }]` |
| `GET` | `/api/files/:name` | — | `{ content, modifiedAt }` |
| `PUT` | `/api/files/:name` | `{ content }` | `{ ok, modifiedAt }` |
| `POST` | `/api/files` | `{ name, content? }` | `{ name, path, modifiedAt }` |
| `DELETE` | `/api/files/:name` | — | `{ ok }` |
| `GET` | `/api/files/:name/meta` | — | `{ modifiedAt }` |

### Implementing the API in another language

If your backend isn't Express, you can implement these 7 endpoints in any language. The editor frontend only needs the API contract above. Point the React component (or iframe) at your backend and set `window.__PAGED_EDITOR_API_URL` if the API origin differs from the editor origin.

---

## Architecture

### How Web Mode Works

The editor frontend was originally built for Electron, where all file I/O goes through `window.electronAPI` (defined in `preload.js` and handled by `main.js` via IPC).

For web mode, `src/workspace/web-api-shim.js` (compiled to `dist/js/workspace/web-api-shim.js`) provides a drop-in replacement for `window.electronAPI` backed by REST `fetch()` calls. It loads as a regular `<script>` (not a module) so it executes before the ES module graph evaluates. The rest of the editor code is unchanged.

```
Electron mode:
  dist/js/shell/app-orchestrator.js → window.electronAPI → IPC → main.js → Node fs

Web mode:
  dist/js/shell/app-orchestrator.js → window.electronAPI (web-api-shim.js) → fetch → Express server → Node fs
```

### Sub-Path Mounting

When mounted at a sub-path (e.g., `/editor`), the web-api shim auto-detects the base path from `location.pathname`. All API calls are automatically prefixed. No configuration needed.

### Key Files

| File | Role |
|------|------|
| `packages/base/src/` | TypeScript source (compiled to `dist/js/` via `npm run build`) |
| `packages/base/dist/js/` | Compiled ES modules (browser runtime) |
| `server/router.js` | Express router factory (`createEditorRouter`) |
| `server/index.js` | Standalone server entrypoint |
| `packages/react/src/PagedEditor.tsx` | React component (iframe + postMessage) |
