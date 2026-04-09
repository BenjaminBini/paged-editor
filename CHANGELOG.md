# Changelog

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
