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

- **Hover resolution** — on each `pointermove`/`pointerover` in the preview, resolve the **nearest selectable block** under the cursor by walking ancestors from the event target until a `data-block-id` element is found. If none, clear hover. In v1 all selectable blocks are top-level (§6), so "nearest" equals "containing"; this contract stays correct when nested blocks are added in v2.
- **Selection resolution** — on `click`, use the same resolution rule.
- **State classes** (applied via JS, NOT CSS `:hover`):
  - `.style-hovered` — on the currently hovered selectable block.
  - `.style-selected` — on the currently selected selectable block.
  - Both classes are driven by `data-block-id` so they survive Paged.js DOM rewrites (see §4 Canonical model and §5.4 Patch contract).
- **Event delegation** — a single handler on `#preview-container` (the stable outer element). Handlers are installed once and gated by the style-mode signal.
- **Passive during edits** — while the user is actively typing in the editor (debounced render pending), hover resolution is suspended to avoid flicker when the preview patch lands.
- **Raw `:hover` is NOT used** — semantic hover is decoupled from physical pointer-over so we can match the `data-block-id` currently under the pointer after a re-render without waiting for a fresh pointermove.
- **Ancestor navigation (`Alt+click`, ancestor chip) is deferred to v2** — it requires a non-null `parentBlockId` chain, which v1 does not produce (§6). Until nested extraction lands, there is nothing to walk.

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

1. **Header** — `blockType — "first 40 chars of block text"`, truncated to one line. (An ancestor-chip is deferred to v2 — no ancestors exist in the v1 model.)
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

### 5.1 Parsing contract (two-pass tokenization)

Trying to hand-scrub the directive out of marked's token tree is unreliable — each block type exposes the directive through different fields (`token.lang` for fenced code, `token.attrs` for `:::` containers, nested `token.items[].tokens` for lists, nested `token.header[].tokens` / `token.rows[].cells[].tokens` for tables, inline children for headings/paragraphs). Instead we edit the **source text** and re-tokenize. Marked then produces already-clean tokens and every renderer consumes them without special cases.

The contract is:

**Pass 1 — probe.** Run `marked.lexer(body)` once. This tells us which lines begin stylable top-level blocks. For each such token:
  a. Compute its `sourceLineStart`, `sourceLineEnd`, and absolute source range `[tokenFrom, tokenTo)` in `body` (reusing the `_sourceLine` mechanism already used by sync anchors; `tokenFrom` is the offset into `body` where `token.raw` begins).
  b. Extract the **first source line** of the token: `body.slice(firstLineFrom, firstLineTo)` where both bounds are clamped to the token's range.
  c. Attempt the regex `/(\s+)\{:style\s+([^}\n]*)\}\s*$/` against that first line.
  d. On match, record `{ blockType, tokenFrom, firstLineFrom, firstLineTo, styleDirectiveRange: { from, to }, rawDirectiveText }`, where `from`/`to` are absolute offsets in `body` covering the leading whitespace + full `{:style …}`.

**Build `cleanedBody`.** Apply all recorded `styleDirectiveRange` strips to `body` in reverse order (to keep later offsets valid). The cleaned source now has no directive text anywhere.

**Pass 2 — final.** Run `marked.lexer(cleanedBody)` again. The resulting tokens are pristine — directive text is gone from `token.raw`, `token.text`, `token.lang`, `token.attrs`, and every nested structure (list items, table cells, container bodies), because marked is now parsing a source that never contained it.

**Build `BlockEntry[]`.** Walk pass-2 top-level tokens. For each stylable one, match it back to a probe record by `sourceLineStart` in the cleaned source (the line numbers shift only if a directive-strip removed a whole line; since we only strip trailing fragments the line count is preserved). Parse the recorded `rawDirectiveText` into `styleValues` + per-block `errors` (§3.5). Assign `blockId = "b" + index-in-tokens`. Emit the `BlockEntry`.

**Orphan detection.** In pass 1, a line may contain a directive that looks valid but belongs to no stylable token (e.g., the directive sits inside a `token.type === "html"` block, or on a line that's not the first line of a top-level stylable block). Those matches are recorded as `orphan-directive` errors with `blockId = null` and **NOT stripped** — their text stays as content.

**Double-lex cost.** Marked's lexer is fast (<1 ms on typical BEORN section bodies). The profile shows render cost is dominated by Paged.js pagination and CSS apply, not lexing; doubling the lex pass is imperceptible.

**Why this is safe for every block type:**

| Token kind | Why double-lex handles it without per-type cleanup |
|------------|----------------------------------------------------|
| `heading` | Directive stripped from source; pass 2 parses clean inline children |
| `paragraph` | Directive stripped from first line only; continuation lines untouched |
| `blockquote` | Body re-lexed after strip; inner blockquote tokens have no leaked directive |
| `list` | `list.items[].text/.raw/.tokens` all derive from pass-2 source |
| `table` | Pipe-splitting of the header row happens on already-cleaned source — no stray cell |
| `hr` | Directive stripped; pass 2 sees bare `---` |
| `code` | `token.lang` is computed from the fence opener in pass 2 — directive gone |
| `mdContainer` | `token.attrs` is computed from the opener line in pass 2 — directive gone |
| `paragraph → figure` (standalone image) | Cleaned source produces a clean image token |

No renderer needs to know about the directive. The single change to every renderer is emitting `data-block-id` + the merged `style=""` attribute (§5.2).

**What we explicitly do NOT do:**
- Mutate marked's token trees in place.
- Re-implement any of marked's tokenizers.
- Scan source lines without knowing their block context.

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

### 5.4 Patch contract (diff + apply)

The fast path has **two** halves today, both of which must understand root-attribute changes for style-only edits to patch instead of forcing a full re-render.

#### 5.4.1 Diff contract (in `render-scheduler.diffSourceBlocks`)

Today, `diffSourceBlocks` flags an element as changed iff `oldEl.innerHTML !== newEl.innerHTML`. Style-only edits change the element's **attributes** (specifically `style=""`), leaving `innerHTML` untouched — so they never enter `changedLines`, the patch path never runs, and the 800 ms full-render timer ends up firing instead.

The diff is updated to a **root-signature** comparison:

```ts
function rootsEqual(a: Element, b: Element): boolean {
  if (a.innerHTML !== b.innerHTML) return false;
  if (a.tagName !== b.tagName) return false;
  const aAttrs = a.attributes;
  const bAttrs = b.attributes;
  if (aAttrs.length !== bAttrs.length) return false;
  for (let i = 0; i < aAttrs.length; i++) {
    const name = aAttrs[i].name;
    if (b.getAttribute(name) !== aAttrs[i].value) return false;
  }
  return true;
}

// in diffSourceBlocks: if (!rootsEqual(oldEl, newEl)) changed.add(line);
```

This is O(attrs + innerHTML size), same order as today's check, and correctly flags `style=""` changes, `data-block-id` changes, class changes, and any other future root-attribute edits.

`diffSourceBlocks` also starts keying by `data-block-id` in addition to `data-source-line`, because after a block insertion two blocks may briefly share the same line (§4.1 re-match logic) and we want the diff to stay stable.

#### 5.4.2 Apply contract (in `PreviewRenderer.patchVisiblePages`)

Once the diff flags an element, the apply path must update both `innerHTML` and root attributes — today it does only the former. The updated loop:

1. Locate the live element by `data-block-id` first, falling back to `data-source-line` for pre-id rendered content.
2. If the live element has no Paged.js ref attributes (`data-ref`, `data-split-from`, `data-split-to`, and any `data-split-*` family member) → `liveEl.replaceWith(newEl.cloneNode(true))`. This is the clean path.
3. Otherwise → **attribute sync**: for every attribute on `newEl`, `setAttribute` on `liveEl`; for every attribute on `liveEl` not in `newEl`, `removeAttribute` — EXCEPT `data-source-line`, `data-block-id`, and the Paged.js `data-ref` / `data-split-*` family, which are preserved. Then `liveEl.innerHTML = newEl.innerHTML`. This preserves Paged.js chunker state on split elements.

With both halves updated, style-only edits correctly hit the fast path and repaint in the incremental window rather than queuing a full paginated render.

### 5.5 Export / print

Because styles remain inline on the elements, PDF export (which reuses `renderMarkdown`) is automatically correct. `pdf-export-service.ts` needs no changes.

---

## 6. Nested selection policy (v1)

**v1 supports top-level selectable blocks only.** Children inside `:::containers` (alert body paragraphs, KPI tiles, timeline steps, etc.) are NOT individually stylable.

Rationale:
- `renderAlertContainer` and friends call `marked.parse(body)` on inner content, which does NOT propagate `_sourceLine` through nested parsing. Fixing that requires recursive source mapping — out of scope for v1.
- With only top-level blocks in the model, every block's `parentBlockId` is `null`, so there is no ancestor chain to walk. All ancestor-navigation UX (`Alt+click`, header ancestor-chip) is therefore **deferred to v2** — it would be unreachable in v1 anyway.

**v2 (future)**: a recursive extraction pass on container bodies would populate child `BlockEntry`s with `parentBlockId` set. Ancestor navigation (`Alt+click`, header chip) lands alongside that recursion so the UX matches the model.

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
| `packages/base/src/shell/ui/preview-interaction.ts` | Delegated pointer handling on `#preview-container`; resolves nearest `data-block-id` ancestor; applies `.style-hovered`/`.style-selected`; gated on style-mode signal |
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

- **Ancestor vs deepest selection** — deferred to v2 with the rest of the nested-block work. In v1, pointer resolution always lands on a top-level block (there is no deeper selectable layer), so no disambiguation is needed.
- **Is `blockId` stable?** — No. Runtime identity only, valid within one render. Selection survives re-renders via `sourceLineStart` re-match.
- **Malformed directive + partially valid values** — inspector is read-only; shows parsed values but disables edits; provides a `Jump to error` link. The user must fix the source to re-enable editing.

---

## 11. Out of scope (v1)

- Inline-element styling (span, strong, em).
- Per-list-item and per-table-cell styling.
- Nested selection inside `:::containers` (§6).
- Ancestor navigation (`Alt+click`, inspector ancestor-chip) — lands with v2 nesting.
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
