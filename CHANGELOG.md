# Changelog

## [1.8.1] – 2026-04-21

### Fixes
- **Tab switching crash** — Fixed `RangeError: Selection points outside of document` thrown by `checkSelection` when switching tabs from a longer file to a shorter one. `createState` now resolves `{line, ch}` selection indices against the target document's `Text` instead of the live `view.state.doc`, so a cached selection from the previous tab is clamped into the new document instead of overrunning it.

## [1.8.0] – 2026-04-21

### Features
- **KPI tiles (`:::kpi`)** — horizontal row of call-out figures. Body is one `VALUE | LABEL | NOTE` per line; each line renders as a card with large navy value, small label and optional italic note. Best paired with `ao-grid` for custom layouts, or used as-is for a flex row.
- **Quote / testimonial (`:::quote author="…" role="…"`)** — attributed blockquote with purple left border and tinted background. Attribution rendered as a footer (`— Author, Role`). Body accepts full markdown, including citations.
- **Timeline (`:::timeline` + `:::step TITLE | META`)** — vertical timeline with a colored dot per step. Each `:::step` auto-closes on the next `:::step` or the outer `:::`. Body accepts full markdown.
- **Task-list polish** — GFM `- [ ]` / `- [x]` lists now get a styled checkbox (blue accent, no native bullet). CSS-only — no change to agent-facing syntax.

### Refactor
- Alert / kpi / quote / timeline containers share a single `mdContainer` marked extension with name-based dispatch, replacing the dedicated `mdAlert` extension from 1.7.0.

## [1.7.0] – 2026-04-21

### Features
- **Alert blocks (`:::info` / `:::warning` / `:::danger` / `:::success` / `:::note` / `:::tip`)** — Previously documented but unimplemented. Now rendered as colored, left-bordered call-out containers with tinted backgrounds (blue / orange / red / green / teal). Body is parsed as full markdown (nested lists, headings, citations, grids all work). `break-inside: avoid` keeps a callout from splitting across pages.

## [1.6.0] – 2026-04-20

### Features
- **12-column grid layout** — New fenced block `` ```ao-grid `` renders a 12-column CSS grid inside a section. Each inner `:::col-N` header (N = 1..12) opens a column spanning N/12 of the row. Columns are implicitly closed by the next `:::col-N` or by the closing fence. Any markdown is allowed inside columns (headings, images, lists, tables, `:::info`/`:::warning`, Mermaid/ECharts). Gap and pagination rules match the rest of the pdf.css layout.

## [1.4.0] – 2026-04-09

### Features
- **Paste screenshots as assets** — You can now paste clipboard images directly into the editor. The image is written to an `assets/` folder next to the current Markdown file and a Markdown image link is inserted automatically.
- **Image captions from Markdown labels** — Standalone Markdown images now render their label text as a caption below the image.

### Fixes
- **Workspace asset resolution** — Relative image assets now resolve correctly in web preview, Electron preview, and PDF export.
- **Outline contrast** — Sidebar outline contrast was refined for better readability.

---

## [1.3.0] – 2026-04-09

### Features
- **Graceful window close** — Electron now intercepts the window-close event and asks the frontend to handle unsaved tabs before confirming. Closing with dirty files presents a save/discard/cancel dialog.
- **Batch unsaved-changes flow** — All close actions (close tab, close tabs to left/right, close all, close window) now route through a unified resolver. When multiple dirty tabs are open, a single dialog offers "Save all / Discard all / Keep open" instead of one prompt per tab.
- **Table widget: disabled toolbar states** — Toolbar buttons (move row up/down, remove row/col) are now disabled when the action is unavailable (e.g. "move up" on the first row). State updates on every focus change.
- **Table widget: column focus persistence** — Operations on rows and columns now land on the same column index after the change, instead of always jumping to column 0.

### Fixes
- **Inline code syntax highlighting** — Fenced code spans inside Markdown are now styled in sky-blue bold via a custom `cm-code` token, matching the dark-theme palette.
- **Outline sidebar readability** — Active heading is now displayed in bold white; H1–H4 hierarchy uses higher-contrast colours and slightly larger font sizes.
- **Ctrl+W reliability** — Key detection now checks both `e.key` and `e.code` to handle keyboard layouts where `key` may not match the Latin letter.
- **doSave return value** — `doSave` now returns a boolean so callers can detect a cancelled or failed save and abort a close sequence.

---

## [1.1.0] – 2026-04-09

### Features
- **Scroll-past-end** — CodeMirror now adds bottom padding so the last line can be centred in the viewport, matching the feel of modern editors.
- **Page breaks inside lists** — Trailing `\newpage` / `/newpage` markers at the end of a list item are now extracted and rendered as a CSS page-break after the list, instead of leaking into the last `<li>`.
- **First-page layout for single-file previews** — When previewing a single content file (no cover page), the first page now uses standard margins and page-number footer instead of the blank cover-page style.

### Fixes
- **No flicker on re-render** — The previous iframe is kept visible while the new one renders in the background; both are swapped in one paint, eliminating the blank-flash between renders.
- **Scroll sync at document boundaries** — Scrolling editor or preview to the very top or bottom now snaps the other pane to its boundary instead of freezing it.
- **Table widgets missing after tab switch or file load** — The table-range cache was not invalidated on content load / tab switch, causing widgets to be skipped or placed at wrong positions.
- **List item text invisible on dark background** — CodeMirror's default `.cm-variable-2` token colour (dark navy) was unreadable on the dark editor theme; overridden to the base text colour.
- **Page-break marks not rebuilt after edits** — Added a dirty flag so the page-break decoration pass always re-scans after content changes, not only after cursor moves.
- **Page-break CSS** — Switched from `break-after` on `.page-break` to `break-before` on `.page-break + *`, which Paged.js handles more reliably.
- **Startup experience** — The welcome screen now shows a loading spinner while session restore runs, then transitions to the welcome content or disappears.
- **parseTable crash** — Guard against null lines returned by a stale line number after a document swap.
- **headingIdCounter race** — Counter is captured before the first async yield to prevent a null `_ctx` when two renders overlap.

### Performance
- **Render time** — Old pending iframe is killed immediately before starting a new render, preventing CPU-split between two Paged.js instances (2-4× speedup on Firefox).
- **Blob URL stability** — Paged.js blob URLs are now stable across re-renders, enabling Firefox bytecode caching and reducing JIT recompilation.
- **Google Fonts inlined** — Fonts CSS is inlined at startup so each render no longer triggers a network fetch.
- **Mermaid preloaded** — Mermaid is loaded at app start instead of lazily on first diagram, eliminating the first-diagram delay.
- **marked.use() accumulation fixed** — Calling `marked.use()` on every render was accumulating thousands of extension entries; extensions are now registered once at module load.

### Refactoring
- Extracted render pipeline into focused modules (`render-pipeline.js`, `document.js`, `markdown-helpers.js`).
- Introduced `platform.js` abstraction over Electron IPC / REST API.
- Introduced event bus; removed monkey-patching and consolidated timers.
- Modularised `app.js` from 1487 to ~609 lines.
- Eliminated shared mutable render state with a per-render context object.

---

## [1.0.0] – 2026-03-28

Initial release.

- Markdown-to-PDF editor using Paged.js for live A4 preview.
- Electron desktop app, web server mode (`@benjaminbini/paged-editor-server`), and React component (`@benjaminbini/paged-editor-react`).
- CodeMirror 5 editor with syntax highlighting, table widget, live scroll sync, and page-break decorations.
- BEORN PDF template with cover page, table of contents, running headers, and section colours.
- Google Drive integration with conflict detection and three-way merge.
- Multi-tab support with session persistence.
