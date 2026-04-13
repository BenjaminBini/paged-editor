# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paged.js Markdown Editor — a Markdown-to-PDF editor using Paged.js for live A4 preview. Built for BEORN technical proposals with French typography support, conflict detection, and three-way merge.

Runs in three modes:
- **Electron desktop app** (`npm start`) — full native experience
- **Web standalone** (`cd server && WORKSPACE=/path node index.js`) — quick web server
- **Web embedded** — mount `createEditorRouter()` in any Express app; React component available

## Development

**TypeScript source in `packages/base/src/`, compiled to `dist/js/` as ES modules.**

- Build: `cd packages/base && npm run build` (runs tsc)
- Type check: `cd packages/base && npm run build:check`
- Electron: `npm install && npm start`
- Web server: `cd server && npm install && WORKSPACE=/path/to/folder node index.js`
- React component: `cd packages/react && npm install && npm run build`
- tsconfig uses `strict: false` — types are being tightened progressively

## Architecture

### Module System

TypeScript source in `src/`, compiled to `dist/js/` as ES modules. Entry point: `dist/js/shell/app-orchestrator.js` (loaded via `<script type="module">`). Modules communicate through:

- **Event bus**: `infrastructure/event-bus.js` — lightweight pub/sub for cross-module events
- **Setter injection**: `setOpenFile()`, `setDoSave()` — dependency injection to break circular deps
- **Global function exposure**: `app-orchestrator.js` assigns functions to `window.*` for HTML `onclick` handlers

### Folder Structure (js/)

Organized by **layers** (bottom→top dependency direction) and **topics** within each layer:

```
src/                        (TypeScript source → compiled to dist/js/)
├── types/                  ← Type declarations for external libs
├── infrastructure/         ← Foundation: no app deps
│   ├── event-bus.js              Lightweight pub/sub
│   ├── platform-adapter.js       Platform abstraction (Electron/web)
│   └── text-utils.js             Frontmatter parsing, HTML escaping
│
├── editor/                 ← CodeMirror editor layer
│   ├── codemirror-editor.js      CM6 editor initialization & compat API
│   ├── cover-form-editor.js      Form-based editor for project.json
│   ├── editor-decorations.js     Gutter markers, heading badges
│   ├── formatting-toolbar.js     Bold/italic/table/image toolbar
│   ├── markdown-helpers.js       HTML rendering utilities
│   ├── outline-manager.js        Document outline panel
│   └── table-widget.js           WYSIWYG table editor overlay
│
├── document/               ← Document model, rendering & export
│   ├── pdf-constants.js          CSS/URL constants
│   ├── render-scheduler.js       Schedules renders, picks pipeline, pushes to renderer
│   ├── model/
│   │   └── memoire-views.js      Project metadata & view types
│   ├── rendering/
│   │   ├── section-pipeline.js   Markdown→HTML pipeline (marked config)
│   │   ├── cover-pipeline.js     Cover tab render pipeline
│   │   ├── toc-pipeline.js       TOC tab render pipeline
│   │   ├── mermaid-renderer.js   Lazy Mermaid loading & SVG cache
│   │   ├── preview-renderer.js   HTML→iframe renderer
│   │   └── line-map-builder.js   Editor↔preview line mapping
│   ├── sync/
│   │   ├── preview-sync-setup.js   Scroll/click sync setup
│   │   └── scroll-sync-controller.js  Bidirectional smooth scroll
│   └── export/
│       ├── pdf-export-service.js   PDF export & full mémoire assembly
│       ├── cover-page-builder.js   BEORN-branded hero cover HTML
│       ├── sommaire-builder.js     Table of contents HTML
│       └── html-document-wrapper.js  Full HTML document wrapper
│
├── workspace/              ← File & tab management
│   ├── web-api-shim.js           REST-backed window.electronAPI (web mode)
│   ├── files/
│   │   ├── file-manager.js       Folder state, file I/O, conflict detection
│   │   ├── file-operations.js    Open/save/reload logic
│   │   ├── asset-manager.js      Pasted image asset management
│   │   ├── diff-merge-service.js LCS diff & three-way merge
│   │   └── active-file-context.js  Active file name/path tracker
│   └── tabs/
│       └── tab-bar-controller.js Multi-tab state & UI
│
├── collaboration/          ← AI agent features
│   ├── agent-connection-manager.js  WebSocket agent pool & conversations
│   └── chat-sidebar-controller.js   Chat sidebar UI
│
└── shell/                  ← App orchestration & chrome
    ├── app-orchestrator.js       Main entry: wires everything together
    ├── session-restore.js        Session persistence & recent items
    ├── tab-integration.js        Tab↔editor↔preview integration
    └── ui/
        ├── context-menu.js       Shared context menu renderer
        ├── keyboard-shortcuts.js Global keyboard bindings
        ├── menu-state-manager.js Menu bar & welcome screen state
        └── resize-handle.js      Editor/preview pane resize
```

### Rendering Pipeline

1. Markdown parsed via `marked` with frontmatter extraction (`---key: value---`)
2. French typography spacing applied (non-breaking spaces before `:;!?`)
3. HTML injected into hidden iframe, Paged.js paginated
4. Double-buffered: two iframes swap on render completion (no flicker)

### Storage & Conflict Handling

Two storage backends, both sharing the same `window.electronAPI` interface:
- **Electron** — Node fs via IPC (`preload.js` → `main.js`)
- **Web** — REST API via `fetch()` (`dist/js/workspace/web-api-shim.js` → `server/router.js`)

All backends detect external modifications on save and present a three-way merge UI when conflicts arise.

### Web Mode Architecture

`dist/js/workspace/web-api-shim.js` is loaded as a regular `<script>` before ES modules. It creates `window.electronAPI` backed by REST calls to the server. This means all existing modules (`file-manager.js`, `app-orchestrator.js`, `tab-bar-controller.js`) work unchanged — they call the same API, just routed differently.

`server/router.js` exports `createEditorRouter({ workspace })` — an Express router that serves the editor frontend + file CRUD API. Can be used standalone (`server/index.js`) or mounted in an existing Express app at any path.

`packages/react/` provides a `<PagedEditor>` component that wraps the editor in an iframe with `postMessage` communication for React integration.

### External Dependencies (CDN)

- CodeMirror 5 (editor)
- marked (markdown parsing, also in node_modules/)
- Paged.js (self-hosted in `assets/paged.polyfill.js`)
- Mermaid 11 (diagram rendering)
- Google APIs (gapi, gis, picker)
