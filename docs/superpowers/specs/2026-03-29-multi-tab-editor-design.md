# Multi-Tab Editor

## Overview

Add multi-tab support to the editor pane. Each open file gets its own tab. Tabs live in the existing pane header row. The sidebar shows the folder tree without per-file open/dirty indicators — only the active tab's file is highlighted.

## Tab Bar

- **Location**: replaces the current `.pane-header` content in the editor pane
- **Layout**: horizontal row of tabs on the left, Wrap/Tables toggles pushed to the right (via `margin-left: auto`)
- **Active tab**: background matches editor (`#1e1e2e`), blue top border (`2px solid #3373b3`), white text
- **Inactive tab**: background matches tab bar (`#2d2d3f`), muted text (`#6c7086`)
- **Each tab shows**: filename + close button (×)
- **Dirty tab**: orange dot (`#f0a840`, 6px) replaces the × close button
- **Overflow**: tabs shrink with `text-overflow: ellipsis`; no scroll — tabs compress to fit

## Tab Behavior

### Opening tabs

- **Sidebar click**: if file is already open in a tab, switch to it. Otherwise open a new tab and switch to it.
- **Open File dialog / drag-drop / deep link**: same logic — reuse existing tab or create new one.
- **New Document / New from Template**: opens in a new tab (no file path associated until saved).

### Closing tabs

- **Close button (×)**: closes the tab. If dirty, auto-save first.
- **Cmd+W / Ctrl+W**: closes the active tab.
- **Closing last tab with folder open**: show empty editor (no welcome screen, sidebar stays).
- **Closing last tab with no folder**: show welcome screen.

### Switching tabs

- Click a tab to make it active.
- The single CodeMirror instance swaps its document (`cm.swapDoc()`).
- Preview re-renders on switch.
- Outline rebuilds on switch.

## Per-Tab State

Each tab stores:

- `path` — file path (null for unsaved new documents)
- `name` — display name
- `doc` — CodeMirror `Doc` instance (carries content, cursor, scroll position, undo history)
- `savedContent` — content at last save/load (for dirty detection)
- `localFileModTime` — mtime at last save/load (for conflict detection)
- `dirty` — boolean

Using `cm.swapDoc()` means each tab's undo history, cursor, and selections are preserved automatically by CodeMirror.

## Sidebar Changes

- **Remove**: the dirty dot (`::after` pseudo-element on `.file-item.dirty`)
- **Keep**: active file highlighting (`.file-item.active` with blue left border)
- Active highlight tracks which tab is currently selected, not which files are open
- Files that are open in tabs but not active get no special styling in the sidebar

## File Manager Refactoring

The current `file-manager.js` manages a single-file state (`activeFileIdx`, `savedContent`, `dirtyFlag`, etc.). This needs to become a tab collection:

- New `tabs` array holding tab state objects
- New `activeTabIdx` tracking the current tab
- `openFile(idx)` becomes: create tab if needed, switch to it
- `doSave()` operates on the active tab's state
- `isDirty()` checks the active tab
- Dirty tracking (`cm.on("change")`) updates the active tab's dirty flag and re-renders the tab bar
- The exported `activeFileIdx`, `activeFileName`, `savedContent`, etc. are replaced by accessors that read from the active tab

## Keyboard Shortcuts

- `Cmd+W` / `Ctrl+W` — close active tab
- `Cmd+S` / `Ctrl+S` — save active tab (existing, unchanged)
- `Cmd+Shift+S` / `Ctrl+Shift+S` — save as (existing, unchanged)

## Window Title

- No open tabs: "BEORN Editor"
- Active tab clean: "{filename} — BEORN Editor"
- Active tab dirty: "• {filename} — BEORN Editor"

## Session Restore

On startup, restore the set of open tabs and which one was active. Store in app state:

```json
{
  "openTabs": ["01-intro.md", "02-approach.md"],
  "activeTab": "01-intro.md"
}
```

## New Module: `tab-bar.js`

Owns the tab bar DOM and tab collection state. Exports:

- `openTab(path, name)` — open or switch to tab
- `closeTab(idx)` — close tab (auto-save if dirty)
- `getActiveTab()` — returns current tab state
- `renderTabBar()` — re-renders tab bar DOM
- `restoreTabs(tabNames)` — bulk open for session restore

Depends on: `editor.js` (cm instance), `render.js` (triggerRender), `file-manager.js` (read/write).

`file-manager.js` loses its single-file state tracking and becomes a pure I/O layer (read file, write file, read dir, conflict detection). Tab state management moves to `tab-bar.js`.

## HTML Changes

The `.pane-header` in the editor pane becomes:

```html
<div class="pane-header" id="tabBar">
  <!-- tabs rendered dynamically by tab-bar.js -->
  <div class="tab-bar-tabs" id="tabBarTabs"></div>
  <div class="tab-bar-controls">
    <div id="btnTableEditor" class="wrap-toggle active" onclick="toggleTableEditor()" title="Toggle table editor">
      <span>Tables</span>
      <div class="wrap-track"><div class="wrap-thumb"></div></div>
    </div>
    <div id="btnWrap" class="wrap-toggle active" onclick="toggleWrap()" title="Toggle word wrap">
      <span>Wrap</span>
      <div class="wrap-track"><div class="wrap-thumb"></div></div>
    </div>
  </div>
</div>
```

## CSS Changes

New styles in `css/editor.css` (or a new `css/tabs.css`):

- `.tab-bar-tabs` — flex container, overflow hidden, gap 0
- `.tab` — flex item with padding, close button, ellipsis overflow
- `.tab.active` — editor background, blue top border
- `.tab .dirty-dot` — 6px orange circle
- `.tab .close-btn` — × button, hidden when dirty (dot shown instead)
- `.tab-bar-controls` — margin-left auto, contains toggles

Remove `.file-item.dirty::after` from `sidebar.css`.
