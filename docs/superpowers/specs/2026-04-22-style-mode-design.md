# Style Mode — Design Spec

**Date:** 2026-04-22
**Status:** Approved (brainstorming), awaiting implementation plan
**Scope:** Paged.js Markdown Editor (`packages/base`)

---

## 1. Goal

Give authors a WYSIWYG way to tweak per-block spacing (margin and padding, four sides each) directly from the preview, persisting the overrides inline in the Markdown source so they survive reloads and PDF export.

Entering **Style Mode** turns the preview into an interactive surface: hovering a block highlights it in both the preview and the editor; clicking selects it and swaps the outline panel for an **Inspector** that edits the block's spacing.

---

## 2. User-facing behavior

### 2.1 Mode toggle

- A pill toggle in the top bar, **right of the existing `.status` element**.
- Visual style matches the existing `.wrap-toggle` component (compact track + thumb, uppercase "STYLE" label).
- Keyboard shortcut: `Ctrl/Cmd + Shift + Y`.
- Active state applies `body.style-mode` — used as a global CSS hook and as an event-handler gate.

### 2.2 Hover behavior (preview → editor)

When Style Mode is active and the mouse is over the preview:

- The nearest ancestor carrying `data-source-line` receives a **hover outline** (1px inset, BEORN blue) and a subtle background tint.
- The editor highlights the **source-line range of that block** using a CM6 line decoration. The range is `[token._sourceLine, nextToken._sourceLine − 1]`, or to end-of-document for the last block.
- Hover outline uses CSS only (`body.style-mode [data-source-line]:hover`), but editor highlight requires JS because we need the source-line range.
- Event delegation on `#preview-container` (NOT `.preview-surface`, which Paged.js replaces on each render).

### 2.3 Click behavior (selection)

- Click on a `data-source-line` element in Style Mode: that element gets a **persistent "selected" outline** (thicker, accent color, distinct from hover).
- Editor cursor jumps to the block's first source line (reuses existing behavior).
- Inspector panel (`#inspectorPanel`, a sibling of `#outlineSection`) becomes visible while `#outlineSection` is hidden. Both are controlled purely by `body.style-mode` CSS rules — no DOM is destroyed, so turning mode off restores the outline exactly as it was.
- Click on empty area in the preview, or `Esc`: deselect, inspector shows the empty state (`Click a block in the preview to edit its spacing`).

### 2.4 Inspector UI

Layout, top-to-bottom inside `#outlineSection` when mode is active:

1. **Header** — block type + short text preview, e.g. `h2 — "Introduction"`. Truncated to one line.
2. **Box-model visualization** — a nested-box graphic with 8 stepper fields:
   - Outer ring: `margin-top`, `margin-right`, `margin-bottom`, `margin-left`.
   - Inner ring: `padding-top`, `padding-right`, `padding-bottom`, `padding-left`.
   - Each stepper shows the current scale step (`0`…`7`) with `−`/`+` buttons and a small label showing the resolved px value.
   - Clicking the step number opens a popover with numeric entry (still constrained to `0`…`7`).
3. **Errors section** (hidden unless errors exist for the selected block or elsewhere in the document).

All edits rewrite the block's `{:style …}` directive on its first source line in a single CodeMirror transaction. When all eight values are `0`, the entire `{:style …}` directive is removed from the line.

---

## 3. Markdown syntax

### 3.1 Directive form

```
<block's first source line> {:style <key=value ...>}
```

- **Suffix only** — the directive must appear at the **end** of the block's first source line, after its existing content, separated by at least one space.
- **Allowed keys** (all optional): `mt`, `mr`, `mb`, `ml`, `pt`, `pr`, `pb`, `pl`.
- **Values**: integers `0`…`7`, mapped through the preset scale (§ 3.3).

### 3.2 Examples

```markdown
## Introduction {:style mt=3 pb=2}

A paragraph whose first line ends with a styling directive. {:style mt=4}
It continues on the next line normally.

:::info {:style mt=5 pb=3}
Alert content here.
:::

| Header | Cell | {:style mt=3 pb=2}
| ------ | ---- |
| body   | body |

![Caption](./image.png) {:style mt=2 mb=2}

--- {:style mt=5 mb=5}

```js {:style mt=3}
const x = 1;
```
```

### 3.3 Preset scale

| Step | px | Guidance |
|------|----|---------|
| 0    | 0  | Reset (equivalent to no directive for that side) |
| 1    | 4  | Hair |
| 2    | 8  | Small |
| 3    | 16 | Base |
| 4    | 24 | Medium |
| 5    | 32 | Large |
| 6    | 48 | X-large |
| 7    | 64 | Section break |

The scale is a single source of truth exported from `style-directive.ts`; the inspector and renderer both import it.

### 3.4 Parsing rules and errors

- Directive regex: `/\s+\{:style\s+([^}]*)\}\s*$/` — matches ONLY at end of line, preceded by whitespace, with at least one key=value inside. Inline-mid-line occurrences or prefix placements are **not** directives (they stay as content).
- Pre-pass strips the directive and attaches it to the block token; after-pass errors if:
  - The key is not one of the 8 known keys → `unknown-key`.
  - The value is not in `0..7` → `invalid-value`.
  - The line has a valid-looking directive but no block starts on that line → `orphan-directive`.
  - A key appears more than once → `duplicate-key`.
- Errors do **not** block rendering. The element still renders (with whatever valid subset parsed); the error just surfaces in the UI.

### 3.5 Error surfacing

Each recorded error is shown in **two** places:

- **Editor gutter + squiggle** via the CodeMirror 6 `@codemirror/lint` extension (a small red squiggle on the exact `{:style …}` span plus a gutter icon on the line). Clicking the gutter icon pans the tooltip with the message.
- **Inspector "Errors" section** — a compact list of `<line> <message>` entries, visible regardless of the currently selected block so document-wide issues don't hide.

---

## 4. Rendering / persistence

### 4.1 Pre-pass (section-pipeline)

Added at the top of `renderMarkdown` before `marked.lexer`:

```text
input body (post-frontmatter)
   │
   ├── for each line: match /\s+\{:style\s+([^}]*)\}\s*$/
   │     if match → strip from line, record directive + line number
   │
   ├── cleaned body → marked.lexer
   │
   └── walk tokens: for each with _sourceLine matching a recorded directive,
       attach token._style = { mt, mr, mb, ml, pt, pr, pb, pl } (absent → undefined)
```

Recorded directives whose line did not map to any token become **orphan errors** kept in `renderResult.styleErrors`.

### 4.2 Renderer updates

Every renderer in `section-pipeline.ts` that already reads `token._sourceLine` (`heading`, `paragraph`, `blockquote`, `list`, `table`, `hr`, `code`, `image`-figure, and every branch of `mdContainer`) is updated once:

```ts
const styleCss = styleToCss(token._style); // "margin-top:16px;..."
// merge into the element's existing style attribute (append with `;` separator)
```

The `styleToCss` helper is defined in `style-directive.ts` and shared with the inspector.

### 4.3 Output attribute

Styles are emitted as inline `style="…"` on the block's **root** rendered element. When the block type wraps (e.g. `paragraph` with standalone image → `<figure>`), style applies to the outer wrapper (`<figure>`), not the `<img>`.

### 4.4 Patch path

The existing `patchVisiblePages` flow already diffs source-blocks and replaces changed elements. Since `{:style}` changes the element's `style=""` attribute, the outer HTML will differ and the existing diff will trigger a patch — no special handling needed.

### 4.5 Export / print

Because styles are inline on the elements, **PDF export works automatically** — it uses the same `renderMarkdown` pipeline. No changes to `pdf-export-service.ts`.

---

## 5. Implementation breakdown

### 5.1 Files to create

| File | Responsibility |
|------|---------------|
| `packages/base/src/document/rendering/style-directive.ts` | Regex, pre-pass, preset scale, `styleToCss` helper, error types |
| `packages/base/src/shell/ui/style-mode.ts` | Mode state (signal), toggle wiring, keyboard shortcut, body-class management |
| `packages/base/src/editor/style-inspector.ts` | Inspector UI (box-model), reads/writes directive on source, handles selection state |
| `packages/base/src/editor/style-directive-lint.ts` | CM6 diagnostic source for `{:style}` errors |

### 5.2 Files to modify

| File | Change |
|------|--------|
| `packages/base/index.html` | Add toggle button in toolbar; add an `#inspectorPanel` as a sibling of `#outlineSection` inside `.file-sidebar`. Visibility of the two is toggled via `body.style-mode` CSS rules (no JS DOM moves). |
| `packages/base/css/app/toolbar.css` | Toggle styling (match `.wrap-toggle`) |
| `packages/base/css/app/sidebar.css` | Inspector layout, hide outline when mode active |
| `packages/base/css/preview/preview.css` | Hover + selected outlines (gated on `body.style-mode`) |
| `packages/base/src/document/rendering/section-pipeline.ts` | Call pre-pass; attach `_style` to tokens; apply `styleToCss` in every renderer; return `styleErrors` in `RenderResult` |
| `packages/base/src/document/sync/preview-sync-setup.ts` | Add hover-delegation handler (gated on mode state); selection click-handling |
| `packages/base/src/editor/editor-decorations.ts` | Add a second ViewPlugin: hover-block line range + selected-block line range (both driven by a shared signal from `style-mode.ts`) |
| `packages/base/src/shell/app-orchestrator.ts` | Initialize style-mode module; connect inspector lifecycle |
| `packages/base/src/shell/ui/keyboard-shortcuts.ts` | Register `Ctrl/Cmd+Shift+Y` |

### 5.3 External dependencies

- `@codemirror/lint` — needed for diagnostics. Will verify it's already available via the CM6 bundle before starting; if not, add it.

---

## 6. Edge cases & decisions

| Case | Decision |
|------|---------|
| Directive on a block that later becomes a different type (e.g. user converts a heading to a paragraph) | Re-tokenization attaches the directive to whatever block now starts on that line. If no block starts there, it becomes an orphan error. |
| Inline elements (hovering a `<strong>` inside a paragraph) | Hover resolves to the nearest ancestor with `data-source-line` — effectively the enclosing paragraph. |
| Nested blocks (`:::info` containing a paragraph) | Hover targets the deepest `data-source-line` element under the cursor. User can style either the container or the paragraph. |
| Blocks with no `data-source-line` (e.g. inline images rendered outside a figure) | Not selectable in v1. |
| Tables — styling header row vs body | Directive on the header line styles the whole `<table>`. Styling individual cells is out of scope in v1. |
| List items — per-item vs per-list | Directive on the first line (first item) styles the whole `<ol>`/`<ul>`. Per-item is out of scope in v1. |
| Two directives in separate `{:style …}` groups on one line | Only the trailing one matches the regex (since it must be at end-of-line). Earlier ones stay as plain content — no special error, just ignored. |
| Very long first line in paragraph (wrap in editor) | Directive is still at end-of-line in source; editor line-wrap is cosmetic. No parser impact. |
| Mode toggled off mid-selection | Selection outline clears, inspector hides, outline panel reappears. Markdown source unchanged. |
| Paged.js re-render while hovering | `#preview-container` delegation survives. Hover state is stateless (re-derived from DOM on each mouseover event). Selection state is keyed by `data-source-line`; if the element still exists after re-render, selection is preserved; otherwise, it clears. |

---

## 7. Out of scope (v1)

- Inline-element styling (span, strong, em).
- Per-list-item and per-table-cell styling.
- Non-spacing properties (color, font, borders, etc.).
- Negative spacing values.
- Unit selection (px-only via the preset scale).
- Undo grouping with non-style edits (each inspector change is its own CM transaction — regular undo handles them one at a time).
- Global "spacing scale" editing from the UI (scale is fixed in code).

---

## 8. Open implementation questions (for the plan)

- Exact CSS tokens for hover vs selected outlines (needs a brief visual pass).
- Whether to expose the `styleErrors` list through the existing `event-bus` or as a direct import from the inspector.
- Confirming `@codemirror/lint` availability in the CM6 bundle; if missing, whether to pull it in or implement a lightweight diagnostic via existing decoration APIs.
