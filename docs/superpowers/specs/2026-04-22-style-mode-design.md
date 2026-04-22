# Style Mode — Design Spec

**Date:** 2026-04-22 (revised 2026-04-23)
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
- Active state applies `body.style-mode` — used as a global CSS hook AND as the broadcast channel that other modules (preview interaction, sidebar panel manager, editor decorations) subscribe to.

### 2.2 Preview interaction contract

The preview is a **scaled, re-rendered DOM** (Paged.js rewrites `.preview-surface` on each full render). All interaction is delegated, stateless between events, and semantic rather than visual.

- **Hover resolution** — on each `pointermove`/`pointerover` in the preview, resolve the **deepest selectable block** under the cursor by walking ancestors from the event target until a `data-block-id` element is found. If none, clear hover.
- **Selection resolution** — on `click`, use the same deepest-selectable-block rule.
- **Ancestor picker** — holding `Alt` (or `Option`) while hovering or clicking resolves the **parent selectable block** instead of the deepest one; repeated `Alt+click` walks upward one level at a time. The currently hovered/selected block's `data-block-id` is the reference point for the walk.
- **State classes** (applied via JS, NOT CSS `:hover`):
  - `.style-hovered` — on the currently hovered selectable block.
  - `.style-selected` — on the currently selected selectable block.
  - Both classes are driven by `data-block-id` so they survive Paged.js DOM rewrites (see §4 Canonical model and §5.4 Patch contract).
- **Event delegation** — a single handler on `#preview-container` (the stable outer element). Handlers are installed once and gated by the style-mode signal.
- **Passive during edits** — while the user is actively typing in the editor (debounced render pending), hover resolution is suspended to avoid flicker when the preview patch lands.
- **Raw `:hover` is NOT used** — semantic hover is decoupled from physical pointer-over so we can (a) match the `data-block-id` currently under the pointer after a re-render without a fresh pointermove, and (b) support the Alt-key ancestor picker.

### 2.3 Editor highlight contract

Editor hover/selection decorations are driven by **block identity**, not by recomputing ranges on pointer events.

- When a block becomes hovered or selected in the preview, its `sourceLineStart` and `sourceLineEnd` (from the canonical model) are published on the shared signal.
- A CM6 ViewPlugin reads the signal and emits line decorations for the `[sourceLineStart, sourceLineEnd]` range, with distinct styles for hovered vs selected.
- Lint decorations for directive errors are a **separate** CM6 diagnostic source driven from the `styleErrors` array and each error's `styleDirectiveRange` (absolute offsets).

### 2.4 Inspector behavior

- The inspector appears when Style Mode is active. If nothing is selected, it shows the empty state (`Click a block in the preview to edit its spacing`).
- On selection, it shows the selected block's parsed `styleValues` in the box-model UI (§2.5) and any errors attached to that block.
- **Invalid-directive policy** — if the selected block has ANY recorded directive error (unknown key, invalid value, duplicate key, malformed syntax), the inspector is **read-only**: steppers show parsed values but are disabled, with a banner `Directive has errors — fix in source first` and a `Jump to error` link that moves the editor cursor to the error range.
- A "Clear all spacing" button appears only when the block has any non-zero value AND no errors. Clicking it removes the directive entirely from source.

### 2.5 Inspector UI

Layout, top-to-bottom inside `#inspectorPanel`:

1. **Header** — `blockType — "first 40 chars of block text"`. Includes a chip for the selected block's ancestor (if any) so the user can jump up with one click (equivalent to `Alt+click`).
2. **Errors banner** (only when the selected block has errors) — per §2.4.
3. **Box-model visualization** — a nested-box graphic with 8 stepper fields:
   - Outer ring: `margin-top`, `margin-right`, `margin-bottom`, `margin-left`.
   - Inner ring: `padding-top`, `padding-right`, `padding-bottom`, `padding-left`.
   - Each stepper: `−` / current step / `+`, with a small label showing the resolved px. Step is clamped to `0`…`7`. Clicking the step number opens a popover for direct numeric entry (still clamped).
4. **Clear-all button** — per §2.4.
5. **Document-wide errors section** — collapsible list of `<line> <message>` entries for directive errors elsewhere in the document (regardless of current selection), with a `Jump to error` link on each.

All valid edits call into the **source-writer** (§3.6) which performs one CodeMirror transaction per stepper interaction.

---

## 3. Markdown syntax

### 3.1 Directive form

```
<block's first source line><SP>{:style <key=value ...>}<EOL>
```

- **Suffix only** — the directive must appear at the **end** of the block's first source line, preceded by at least one whitespace char, with only trailing whitespace allowed after the closing `}`.
- **Allowed keys**: `mt`, `mr`, `mb`, `ml`, `pt`, `pr`, `pb`, `pl`. Each appears at most once.
- **Values**: integers `0`…`7`, mapped through the preset scale (§3.3).
- **One directive per block** — the directive lives on the block's **first source line only** (the `blockId`'s `sourceLineStart`). A `{:style …}` fragment on any other line of the block is not a directive (it's content or an error, depending on context — see §5.3).

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
| 0    | 0  | Omitted from serialized directive |
| 1    | 4  | Hair |
| 2    | 8  | Small |
| 3    | 16 | Base |
| 4    | 24 | Medium |
| 5    | 32 | Large |
| 6    | 48 | X-large |
| 7    | 64 | Section break |

Single source of truth: `SPACING_SCALE` exported from `style-directive.ts`. Consumed by renderer (px output), inspector (stepper labels), and source-writer (validation).

### 3.4 Allowed contexts (where a directive can appear)

Directives are recognized ONLY on lines that are the **block start line** of a stylable top-level block. Literal `{:style …}` text is **left as content** in every other context. Specifically:

- **Recognized** — first source line of: heading, paragraph, blockquote (first `>` line), list (first list item's first line), table (first pipe row), thematic break (`---`), fenced code block (the opener line), standalone-image paragraph, and `:::name` container opener.
- **Not recognized** — interior lines of any multi-line block; lines inside fenced code blocks (``` … ```); lines inside raw HTML blocks (as detected by the tokenizer); and any non-block-start line.

### 3.5 Error categories

Errors are recorded during parsing but **do not abort rendering**. The block renders with any valid subset that could be parsed, and errors surface in §2 UI channels.

| Code | Condition | Suppress render? |
|------|-----------|------------------|
| `unknown-key` | Key not in `{mt, mr, mb, ml, pt, pr, pb, pl}` | No — key ignored, block still styled with other valid keys |
| `invalid-value` | Value not in `0..7` | No — key ignored |
| `duplicate-key` | Same key appears twice | No — first occurrence wins, rest ignored |
| `malformed-directive` | Text at EOL looks like `{:style…` but fails full regex (missing `}`, no `=`, etc.) | No — whole directive treated as content |
| `orphan-directive` | Line has valid directive syntax but is not a recognized block-start line | No — directive left as content |

Every error carries:
- `line` (0-based source line),
- `styleDirectiveRange: { from: number; to: number }` (absolute offsets within the post-frontmatter body),
- `blockId` when applicable (for `orphan-directive`, `blockId = null`),
- a human-readable `message`.

### 3.6 Canonical serialization (source writer contract)

Every inspector write goes through a single `writeDirective(blockId, styleValues)` function that:

1. Locates the block's current `sourceLineStart` via the canonical model (§4).
2. Builds the canonical directive string:
   - Keys in **fixed order**: `mt, mr, mb, ml, pt, pr, pb, pl`.
   - **Zero values are omitted** (all-zero → no directive at all).
   - Single space between the block content and the directive.
3. Computes a minimal CodeMirror transaction:
   - If the block has no existing directive AND the new directive is non-empty → insert ` {:style …}` at end of line.
   - If it has a valid existing directive → replace the exact `styleDirectiveRange` span.
   - If the new directive is empty → remove the range AND the single whitespace char preceding it.
   - If the existing directive is **invalid** (`malformed-directive`, or contains `unknown-key`/`duplicate-key`) — **the writer refuses** per §2.4; the inspector is read-only for that block.
4. Dispatches the transaction as a single CM undo step with a user-facing annotation `style-edit`.

The writer NEVER rewrites the whole directive blindly. Valid directives are replaced exactly; invalid ones are preserved verbatim until the user fixes them.

---

## 4. Canonical block model

The single source of truth for every selectable block. Built during parsing (§5.1), consumed by the inspector, preview interaction, editor decorations, and source writer.

```ts
interface BlockEntry {
  blockId: string;              // stable-within-render identity (see below)
  blockType: BlockType;         // "heading" | "paragraph" | "blockquote" | "list" |
                                // "table" | "hr" | "code" | "figure" |
                                // "mdContainer:info" | "mdContainer:kpi" | …
  sourceLineStart: number;      // 0-based, first line of the block's source range
  sourceLineEnd: number;        // 0-based, last line of the block's source range (inclusive)
  styleDirectiveRange:          // absolute document offsets (post-frontmatter body);
    | { from: number; to: number }   //   covers the leading space + full `{:style …}`
    | null;                     //   null when no directive is present
  styleValues: StyleValues;     // parsed; absent keys = undefined (NOT 0)
  errors: StyleError[];         // per-block error list (may be empty)
  parentBlockId: string | null; // set only when this block is a child of another
                                // stylable block (v1: always null — see §6)
}

type StyleValues = Partial<Record<
  "mt" | "mr" | "mb" | "ml" | "pt" | "pr" | "pb" | "pl",
  number  // 0..7, integer
>>;
```

### 4.1 blockId identity model

- `blockId` is **runtime-derived**, generated during parsing as `"b" + index-in-tokens` (e.g. `b0, b1, b2…`).
- It is **stable within a single render cycle** but **not stable across edits** above the block (inserting a block earlier shifts indices).
- Implication: the inspector holds a selection by `blockId` only within a render cycle. After each re-render:
  - The renderer publishes a new `blockEntries[]` with fresh IDs.
  - Selection is **re-matched by `sourceLineStart`** (the block starting on the previously selected line), falling back to `null` (empty inspector) if no block starts there anymore.
- `data-block-id` is emitted on every selectable block element in the preview HTML, alongside the existing `data-source-line`. This attribute drives `.style-hovered` / `.style-selected` state classes (§2.2).

### 4.2 blockEntries output

`renderMarkdown`'s `RenderResult` grows a new field:

```ts
blockEntries: BlockEntry[];   // one per top-level stylable block, in document order
styleErrors:  StyleError[];   // errors not attached to any block (orphans, etc.)
```

`render-scheduler.ts` caches the latest `blockEntries[]` alongside `_lastSourceBlocks` and broadcasts it on `section-ready`.

---

## 5. Parsing, rendering, patching

### 5.1 Parsing contract (token-aware, NOT line-scan)

The raw line-by-line pre-pass from the earlier draft is **removed**. Extraction is token-aware:

1. `marked.lexer(body)` tokenizes normally (the directive stays inside token text).
2. A single pass walks the top-level token stream. For each token whose type is one of the stylable kinds (see §3.4), we:
   a. Compute its source range (reusing `_sourceLine` logic that's already in place for sync anchors), giving `sourceLineStart` and `sourceLineEnd`.
   b. Extract the **first source line** of the token from `body` using line offsets.
   c. Try to match `/\s+\{:style\s+([^}]*)\}\s*$/` against that line.
   d. On match: record `styleDirectiveRange` (absolute offsets inside `body`), parse the key-value fragments (§3.5 error rules), build `styleValues`, and strip the directive + its leading whitespace from the token's `raw` and from any child inline tokens whose text contains it.
   e. Emit a `BlockEntry` either way (directive present or not).
3. After walking: any `{:style …}` fragments that survived in non-stylable tokens (code, html, or mid-block) are inspected once more; if a suspicious fragment exists on what would be a block-start line for a **missing** block type, record an `orphan-directive` error against the body.
4. Renderer emits HTML normally from the cleaned tokens.

**Why this is safe:**
- Code block content (`token.type === 'code'`) is only inspected at its opener line, not its body — content lines are never scanned.
- Raw HTML blocks (`token.type === 'html'`) are not stylable, so their content is never scanned.
- Paragraph continuation lines are inside a single paragraph token; we only look at the token's first source line.
- Inline-looking `{:style …}` text (mid-paragraph, mid-sentence) never matches the end-of-line anchor and is left alone.

### 5.2 Renderer updates

Every renderer in `section-pipeline.ts` that reads `token._sourceLine` (`heading`, `paragraph`, `blockquote`, `list`, `table`, `hr`, `code`, the standalone-image `paragraph → figure` branch, and every branch of `mdContainer`) is updated uniformly:

```ts
const blockId = ctx.nextBlockId();                   // "b0", "b1", …
const styleAttr = renderStyleAttr(token._style);     // ' style="margin-top:16px;…"' or ''
const blockIdAttr = ` data-block-id="${blockId}"`;
// emit:  <tag data-source-line="…" data-block-id="…" style="…">…</tag>
// existing inline style (e.g. heading color) is merged BEFORE the spacing style.
```

`ctx` gains a `nextBlockId()` counter that also drives the `BlockEntry[]` accumulator so the HTML IDs and the model array stay in sync.

### 5.3 Output contract

- Style is emitted as inline CSS on the block's **root** rendered element only. Never on child spans/nums/chips inside (e.g. the `.beorn-num` badge inside an `h2` keeps its own inline style untouched).
- For paragraph-wrapped standalone images, style applies to `<figure>`, not to `<img>`.
- `data-block-id` is emitted alongside `data-source-line` on the same root element.

### 5.4 Patch contract

The existing fast path in `PreviewRenderer.patchVisiblePages` replaces **only** `innerHTML`. Style-only edits change the **outer attributes** of a block, not its inner content, so the current fast path misses them. Fix:

1. Replace the existing `el.innerHTML = newEl.innerHTML` body of the patch loop with a **root-node replacement** that preserves Paged.js internal wrapping:
   - If the element has no Paged.js ref attributes (`data-ref`, `data-split-from`, `data-split-to`), use `el.replaceWith(newEl)`.
   - Otherwise, **sync the attributes** (copy all attributes from `newEl` to `el`, removing attributes on `el` that aren't on `newEl`, except `data-source-line` and Paged.js attrs), then replace `innerHTML`.
2. `patchVisiblePages` matches by `data-source-line` today; it also matches by `data-block-id` for redundancy, which becomes important when a line is shared by multiple blocks after an insertion.
3. Changing `style`, `data-block-id`, or any other root attribute now correctly triggers patching without a full paginated re-render.

### 5.5 Export / print

Because styles remain inline on the elements, PDF export (which reuses `renderMarkdown`) is automatically correct. `pdf-export-service.ts` needs no changes.

---

## 6. Nested selection policy (v1)

**v1 supports top-level selectable blocks only.** Children inside `:::containers` (alert body paragraphs, KPI tiles, timeline steps, etc.) are NOT individually stylable.

Rationale:
- `renderAlertContainer` and friends call `marked.parse(body)` on inner content, which does NOT propagate `_sourceLine` through nested parsing. Fixing that requires recursive source mapping — out of scope for v1.
- The ancestor picker (`Alt+click`) and parent-chip in the inspector header still work because top-level nesting (e.g. `:::info` itself) is the only level we track.
- `parentBlockId` exists in the model for forward compatibility but is always `null` in v1.

**v2 (future)**: a recursive extraction pass on container bodies would populate child `BlockEntry`s with `parentBlockId` set, and the ancestor picker would walk up the chain naturally.

---

## 7. UI state ownership

Today, `outline-manager.ts` imperatively toggles `outlineSection.style.display` from `buildOutline()` / `clearOutline()`. A pure CSS-class toggle would fight that logic.

**Ownership rule:** a new module **`packages/base/src/shell/ui/sidebar-panel-manager.ts`** is the single owner of `#outlineSection` and `#inspectorPanel` visibility.

- Exports a signal `activeSidebarPanel: "outline" | "inspector" | "none"`.
- Exports `setActivePanel(panel)` — the only way to mutate visibility.
- `outline-manager.ts` stops touching `style.display` directly; instead it calls `sidebar-panel-manager.requestOutline(show: boolean)` which updates the signal only when `activePanel !== "inspector"`.
- `style-mode.ts` drives the panel: `setActivePanel("inspector")` on enter, `setActivePanel("outline")` on exit (or `"none"` if the outline would be empty).
- The sidebar observes the signal and sets `display` on both panels.

This keeps outline behavior fully intact when Style Mode is off, and gives Style Mode exclusive control when it's on — without either side reading or overwriting the other's DOM state.

---

## 8. Implementation breakdown

### 8.1 Files to create

| File | Responsibility |
|------|---------------|
| `packages/base/src/document/rendering/style-directive.ts` | `SPACING_SCALE`, `extractDirective` regex + parser, `renderStyleAttr`, `StyleValues`/`StyleError` types, `parseDirectiveFragment` |
| `packages/base/src/document/rendering/block-model.ts` | `BlockEntry` type, `buildBlockEntries` (walks tokens per §5.1), stylable-type predicate |
| `packages/base/src/shell/ui/style-mode.ts` | Mode signal, toggle wiring, keyboard shortcut, body-class application, suspension during editor typing |
| `packages/base/src/shell/ui/sidebar-panel-manager.ts` | `activeSidebarPanel` signal and mutator (§7) |
| `packages/base/src/shell/ui/preview-interaction.ts` | Delegated pointer handling on `#preview-container`; resolves deepest-or-ancestor block; applies `.style-hovered`/`.style-selected`; gated on style-mode signal |
| `packages/base/src/editor/style-inspector.ts` | Inspector UI (box-model), source-writer, selection state, read-only mode for invalid directives |
| `packages/base/src/editor/style-directive-lint.ts` | CM6 diagnostic source driven from `styleErrors[].styleDirectiveRange` |
| `packages/base/src/editor/style-block-highlight.ts` | CM6 ViewPlugin: hovered/selected line decorations driven by block signal |

### 8.2 Files to modify

| File | Change |
|------|--------|
| `packages/base/index.html` | Toggle button in toolbar; `#inspectorPanel` as sibling of `#outlineSection` in `.file-sidebar` |
| `packages/base/css/app/toolbar.css` | Toggle styling (match `.wrap-toggle`) |
| `packages/base/css/app/sidebar.css` | Inspector layout |
| `packages/base/css/preview/preview.css` | `.style-hovered` / `.style-selected` outlines, gated on `body.style-mode` |
| `packages/base/src/document/rendering/section-pipeline.ts` | Import `buildBlockEntries`; emit `data-block-id` + merged `style` in every stylable renderer; return `blockEntries` + `styleErrors` in `RenderResult` |
| `packages/base/src/document/rendering/preview-renderer.ts` | Patch path: attribute-sync or root replacement per §5.4; match by `data-block-id` as well |
| `packages/base/src/document/render-scheduler.ts` | Cache and publish latest `blockEntries[]` on `section-ready` |
| `packages/base/src/document/sync/preview-sync-setup.ts` | Move click-to-source logic into `preview-interaction.ts`; keep only the non-style-mode fallback |
| `packages/base/src/editor/editor-decorations.ts` | Compose with new `style-block-highlight.ts` ViewPlugin |
| `packages/base/src/editor/outline-manager.ts` | Replace `style.display` writes with `sidebar-panel-manager.requestOutline(...)` calls |
| `packages/base/src/shell/app-orchestrator.ts` | Initialize the new modules and their wiring |
| `packages/base/src/shell/ui/keyboard-shortcuts.ts` | Register `Ctrl/Cmd+Shift+Y` and `Esc`-to-deselect (style-mode-gated) |

### 8.3 External dependencies

- `@codemirror/lint` — verify availability in the CM6 bundle before starting. If missing, add it; otherwise a lightweight diagnostic built on plain decorations is acceptable.

---

## 9. Edge cases & decisions

| Case | Decision |
|------|---------|
| Directive on a block that later becomes a different type (user edits `## H` into a paragraph) | Re-parse re-emits `BlockEntry` for whatever block now starts on that line. `styleValues` carry over because they're extracted from source text, not from the old block type. |
| Hovering a `<strong>` inside a paragraph | Pointer resolution walks up to the nearest `data-block-id` — the enclosing paragraph. |
| Nested blocks (`:::info` containing a paragraph) | v1: container itself is the only selectable block (§6). |
| Blocks with no `data-block-id` | Not selectable. Pointer resolution returns `null`, inspector shows empty state. |
| Tables — header vs body | Directive on header row styles the whole `<table>`. Cells are not selectable in v1. |
| List items — per-item vs per-list | Directive on the first line styles the whole `<ol>`/`<ul>`. Items are not selectable in v1. |
| Two `{:style …}` on one line | Only the trailing one matches the EOL-anchored regex. Leading one stays as content; if it looks like a directive, it's an `orphan-directive` error. |
| Paragraph wraps across many editor visual lines | Directive must be on the **logical** first source line (as delimited by `\n`). Editor soft-wrap is cosmetic only. |
| Mode toggled off mid-selection | `sidebar-panel-manager.setActivePanel("outline")`; selection signal cleared; preview class state cleared. Source unchanged. |
| Paged.js re-render while hovering | State classes re-applied after `section-ready` by re-reading the hover/selection signals and reselecting by `data-block-id` → `data-source-line` fallback. |
| Invalid directive on selected block | Inspector read-only per §2.4; valid directives on OTHER blocks still work normally. |
| Malformed syntax anywhere in doc | Shows in document-wide errors section of inspector; editor gutter shows squiggle; render still succeeds. |

---

## 10. Open questions resolved

- **Ancestor vs deepest selection** — pointer resolves deepest by default; `Alt+click` walks up; header chip in inspector also jumps up one level.
- **Is `blockId` stable?** — No. Runtime identity only, valid within one render. Selection survives re-renders via `sourceLineStart` re-match.
- **Malformed directive + partially valid values** — inspector is read-only; shows parsed values but disables edits; provides a `Jump to error` link. The user must fix the source to re-enable editing.

---

## 11. Out of scope (v1)

- Inline-element styling (span, strong, em).
- Per-list-item and per-table-cell styling.
- Nested selection inside `:::containers` (§6).
- Non-spacing properties (color, font, borders, etc.).
- Negative spacing values.
- Unit selection (px-only via the preset scale).
- Undo grouping across multiple stepper clicks (each stepper click is its own CM transaction; CM undo handles them one step at a time).
- Global "spacing scale" editing from the UI (scale is fixed in code).

---

## 12. Remaining implementation-time questions

- Exact visual tokens for `.style-hovered` vs `.style-selected` (1px blue vs 2px accent is the working assumption).
- Precise CodeMirror diagnostic API surface once `@codemirror/lint` availability is confirmed.
- Whether `render-scheduler` publishes `blockEntries` via the existing `event-bus` or as a direct getter — probably getter for cache-cheapness, but confirm during implementation.
