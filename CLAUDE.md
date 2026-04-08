# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paged.js Markdown Editor — a Markdown-to-PDF editor using Paged.js for live A4 preview. Built for BEORN technical proposals with French typography support, conflict detection, and three-way merge.

Runs in three modes:
- **Electron desktop app** (`npm start`) — full native experience
- **Web standalone** (`cd server && WORKSPACE=/path node index.js`) — quick web server
- **Web embedded** — mount `createEditorRouter()` in any Express app; React component available

## Development

**No build step for the editor frontend.** Vanilla JavaScript (ES6 modules) served as static files.

- Electron: `npm install && npm start`
- Web server: `cd server && npm install && WORKSPACE=/path/to/folder node index.js`
- React component: `cd packages/react && npm install && npm run build`
- No linting, testing, or TypeScript in the editor frontend — just raw JS modules

## Architecture

### Module System

Pure ES6 modules loaded from `js/app.js` (the single entry point via `<script type="module">`). Modules communicate through:

- **Hook registration**: `registerOnSetValue()`, `registerOnPagedReady()`, `registerOnSwap()`, `registerRefreshTableWidgets()` — callbacks for cross-module events
- **Setter injection**: `setOpenFile()`, `setDoSave()`, `setStorageMode()` — dependency injection between modules
- **Global function exposure**: `app.js` assigns functions to `window.*` for HTML `onclick` handlers

### Key Modules (js/)

| Module | Responsibility |
|--------|---------------|
| `app.js` | Orchestrator: wires modules together, manages auto-render (800ms debounce), state restoration, drag-drop |
| `render.js` | Markdown→HTML pipeline (marked + frontmatter + French typography fixes), double-buffered iframe rendering with Paged.js |
| `file-manager.js` | File I/O, folder management, conflict-aware save. Uses `window.electronAPI` (Electron IPC or web-api.js REST shim) |
| `web-api.js` | Web mode: drop-in `window.electronAPI` replacement backed by REST `fetch()`. Loaded as regular script before ES modules |
| `google-drive.js` | OAuth2 flow, Drive API v3, conflict detection via `modifiedTime` |
| `diff-merge.js` | Myers-like LCS diff, three-way merge (base/local/remote), conflict resolution modal |
| `table-widget.js` | Live WYSIWYG table editor overlaid on CodeMirror, lazy-loaded within viewport |
| `sync.js` | Bidirectional scroll sync between editor and preview, click-to-navigate, cursor line highlight |
| `editor.js` | CodeMirror 5 wrapper and DOM references |
| `resize.js` | Drag handle for pane resizing |
| `pdf-styles.js` | CSS constants for the BEORN PDF template (cover, TOC, headers, branding) |

### Rendering Pipeline

1. Markdown parsed via `marked` with frontmatter extraction (`---key: value---`)
2. French typography spacing applied (non-breaking spaces before `:;!?`)
3. HTML injected into hidden iframe, Paged.js paginated
4. Double-buffered: two iframes swap on render completion (no flicker)

### Storage & Conflict Handling

Three storage backends, all sharing the same `window.electronAPI` interface:
- **Electron** — Node fs via IPC (`preload.js` → `main.js`)
- **Web** — REST API via `fetch()` (`js/web-api.js` → `server/router.js`)
- **Google Drive** — OAuth2 + Drive API v3

All backends detect external modifications on save and present a three-way merge UI when conflicts arise.

### Web Mode Architecture

`js/web-api.js` is loaded as a regular `<script>` before ES modules. It creates `window.electronAPI` backed by REST calls to the server. This means all existing modules (`file-manager.js`, `app.js`, `tab-bar.js`) work unchanged — they call the same API, just routed differently.

`server/router.js` exports `createEditorRouter({ workspace })` — an Express router that serves the editor frontend + file CRUD API. Can be used standalone (`server/index.js`) or mounted in an existing Express app at any path.

`packages/react/` provides a `<PagedEditor>` component that wraps the editor in an iframe with `postMessage` communication for React integration.

### External Dependencies (CDN)

- CodeMirror 5 (editor)
- marked (markdown parsing, also in node_modules/)
- Paged.js (self-hosted in `assets/paged.polyfill.js`)
- Mermaid 11 (diagram rendering)
- Google APIs (gapi, gis, picker)
