# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paged.js Markdown Editor — a browser-based Markdown-to-PDF editor using Paged.js for live A4 preview. Built for BEORN technical proposals with French typography support. Supports local file system (File System Access API) and Google Drive storage with conflict detection and three-way merge.

## Development

**No build step.** This is a vanilla JavaScript (ES6 modules) project served as static files. To develop:

- Open `index.html` in a browser, or serve with any static server (e.g., `npx serve .`)
- Deployed to GitHub Pages on push to `main` (`.github/workflows/pages.yml`)
- No linting, testing, or TypeScript — just raw JS modules

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
| `file-manager.js` | Local storage via File System Access API + IndexedDB persistence of directory handles |
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

Two modes: **local** (File System Access API + IndexedDB) and **google-drive** (OAuth2 + Drive API). Both detect external modifications on save and present a three-way merge UI when conflicts arise.

### External Dependencies (CDN)

- CodeMirror 5 (editor)
- marked (markdown parsing, also in node_modules/)
- Paged.js (self-hosted in `assets/paged.polyfill.js`)
- Mermaid 11 (diagram rendering)
- Google APIs (gapi, gis, picker)
