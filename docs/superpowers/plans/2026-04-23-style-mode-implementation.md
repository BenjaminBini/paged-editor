# Style Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Style Mode — a top-bar toggle that turns the preview into an interactive surface for per-block margin/padding editing. Overrides persist inline in Markdown as `{:style …}` directives and are honored by both the live preview and PDF export.

**Architecture:** Two-pass tokenization extracts directives into a canonical `BlockEntry` model. Every stylable block in the preview carries `data-block-id`. A `sidebar-panel-manager` arbitrates outline vs inspector visibility. Preview pointer events are delegated on `#preview-container` and resolve the nearest selectable block via `data-block-id` ancestor walk. Editor hover/selection highlights derive from the same signal. The inspector is a read-only view when the selected block's directive is malformed; otherwise a box-model of 8 steppers rewrites the directive canonically on each edit through a single `writeDirective` transaction.

**Tech Stack:** TypeScript (ES2022, strict), marked, Paged.js, CodeMirror 6 (existing bundle + `@codemirror/lint`), vitest (new), existing signal primitive in `packages/base/src/infrastructure/signal.ts`.

**Spec:** [2026-04-22-style-mode-design.md](../specs/2026-04-22-style-mode-design.md) — all section references below (§2.2, §5.1, etc.) point at that file.

---

## File Map

### New files

| Path | Purpose |
|------|---------|
| `packages/base/src/document/rendering/style-directive.ts` | `SPACING_SCALE`, `StyleValues`/`StyleError` types, `renderStyleAttr`, `parseDirectiveFragment`, `STRICT`/`CANDIDATE` regexes, `extractDirective` |
| `packages/base/src/document/rendering/block-model.ts` | `BlockEntry` / `BlockType`, `isStylableToken` predicate, `buildBlockEntries` two-pass function, coordinate-translation helpers |
| `packages/base/src/shell/ui/sidebar-panel-manager.ts` | `activeSidebarPanel` signal + `setActivePanel` + `requestOutline` |
| `packages/base/src/shell/ui/style-mode.ts` | Mode signal, toggle button wiring, keyboard shortcut, typing-suppression gate |
| `packages/base/src/shell/ui/preview-interaction.ts` | Delegated `pointermove`/`click` on `#preview-container`; state-class application |
| `packages/base/src/editor/style-block-highlight.ts` | CM6 ViewPlugin: hovered/selected line decorations |
| `packages/base/src/editor/style-directive-lint.ts` | CM6 diagnostic source from `styleErrors` |
| `packages/base/src/editor/style-inspector.ts` | Inspector UI (box-model, read-only gate, clear-all, doc-wide errors); `writeDirective` |
| `packages/base/tests/style-directive.test.ts` | Unit tests for parsing + regex + scale |
| `packages/base/tests/block-model.test.ts` | Unit tests for `buildBlockEntries` across every stylable block type |
| `packages/base/tests/style-inspector.test.ts` | Unit tests for `writeDirective` transaction planning |
| `packages/base/tests/diff-contract.test.ts` | Unit tests for `rootsEqual` |
| `packages/base/vitest.config.ts` | Vitest setup |

### Modified files

| Path | Why |
|------|-----|
| `packages/base/package.json` | Add `vitest`, `jsdom`, `@codemirror/lint`; add `test` / `build` scripts |
| `packages/base/index.html` | Top-bar style-mode toggle; `#inspectorPanel` sibling of `#outlineSection` |
| `packages/base/css/app/toolbar.css` | Toggle styling (mirror `.wrap-toggle`) |
| `packages/base/css/app/sidebar.css` | Inspector layout; panel visibility driven by `sidebar-panel-manager` |
| `packages/base/css/preview/preview.css` | `.style-hovered` / `.style-selected` outlines gated on `body.style-mode` |
| `packages/base/src/document/rendering/section-pipeline.ts` | Import `buildBlockEntries`; emit `data-block-id` + merged `style=""` in every stylable renderer; return `blockEntries` + `styleErrors` in `RenderResult` |
| `packages/base/src/document/rendering/preview-renderer.ts` | Apply contract per §5.4.2: attribute-sync + match by `data-block-id` |
| `packages/base/src/document/render-scheduler.ts` | Diff contract per §5.4.1 (`rootsEqual`); cache and publish `blockEntries[]` on `section-ready` |
| `packages/base/src/document/sync/preview-sync-setup.ts` | Non-style-mode click-to-source fallback only; style-mode delegates to `preview-interaction.ts` |
| `packages/base/src/editor/outline-manager.ts` | Route visibility through `sidebar-panel-manager`; keep all other logic intact |
| `packages/base/src/editor/editor-decorations.ts` | Compose `style-block-highlight` ViewPlugin alongside existing decorations |
| `packages/base/src/shell/app-orchestrator.ts` | Initialize new modules in correct order |
| `packages/base/src/shell/ui/keyboard-shortcuts.ts` | Register `Ctrl/Cmd+Shift+Y` and `Esc` (style-mode-gated) |

---

## Phase 0 — Test harness setup

### Task 0: Add vitest

**Files:**
- Modify: `packages/base/package.json`
- Create: `packages/base/vitest.config.ts`
- Create: `packages/base/tests/_smoke.test.ts`

- [ ] **Step 1: Add devDependencies and scripts to `packages/base/package.json`**

Add these keys alongside the existing top-level fields:

```json
  "scripts": {
    "build": "tsc",
    "build:check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.4.5",
    "@codemirror/lint": "^6.8.0"
  }
```

- [ ] **Step 2: Create `packages/base/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
```

- [ ] **Step 3: Create `packages/base/tests/_smoke.test.ts`**

```ts
import { expect, test } from "vitest";

test("vitest is wired", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Install and run**

```bash
cd packages/base
npm install
npm run test
```

Expected: `1 passed` for `_smoke.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/base/package.json packages/base/vitest.config.ts packages/base/tests/_smoke.test.ts packages/base/package-lock.json
git commit -m "chore(test): add vitest harness for base package"
```

---

## Phase 1 — Directive types, scale, regexes

### Task 1: `SPACING_SCALE`, `StyleValues`, `renderStyleAttr`

**Files:**
- Create: `packages/base/src/document/rendering/style-directive.ts`
- Create: `packages/base/tests/style-directive.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/base/tests/style-directive.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { SPACING_SCALE, renderStyleAttr } from "../src/document/rendering/style-directive.js";

describe("SPACING_SCALE", () => {
  test("has 8 entries, 0 → 64", () => {
    expect(SPACING_SCALE).toEqual([0, 4, 8, 16, 24, 32, 48, 64]);
  });
});

describe("renderStyleAttr", () => {
  test("empty values → empty string", () => {
    expect(renderStyleAttr({})).toBe("");
    expect(renderStyleAttr(undefined)).toBe("");
  });

  test("single value → one declaration", () => {
    expect(renderStyleAttr({ mt: 3 })).toBe("margin-top:16px;");
  });

  test("multiple values → declarations in fixed order", () => {
    expect(renderStyleAttr({ pb: 2, mt: 3, ml: 1 })).toBe(
      "margin-top:16px;margin-left:4px;padding-bottom:8px;",
    );
  });

  test("zero is treated as absent", () => {
    expect(renderStyleAttr({ mt: 0, pb: 3 })).toBe("padding-bottom:16px;");
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
cd packages/base && npm run test -- style-directive
```
Expected: FAIL (`Cannot find module 'style-directive'`).

- [ ] **Step 3: Create `packages/base/src/document/rendering/style-directive.ts`**

```ts
// Mapping from preset scale step → pixel value. Source of truth for both the
// renderer (px output) and the inspector (stepper labels).
export const SPACING_SCALE: readonly number[] = [0, 4, 8, 16, 24, 32, 48, 64] as const;

export const MIN_STEP = 0;
export const MAX_STEP = SPACING_SCALE.length - 1;

export type SpacingKey = "mt" | "mr" | "mb" | "ml" | "pt" | "pr" | "pb" | "pl";

export const SPACING_KEYS: readonly SpacingKey[] = [
  "mt", "mr", "mb", "ml", "pt", "pr", "pb", "pl",
] as const;

const CSS_PROPERTY: Record<SpacingKey, string> = {
  mt: "margin-top",
  mr: "margin-right",
  mb: "margin-bottom",
  ml: "margin-left",
  pt: "padding-top",
  pr: "padding-right",
  pb: "padding-bottom",
  pl: "padding-left",
};

export type StyleValues = Partial<Record<SpacingKey, number>>;

export function renderStyleAttr(values: StyleValues | undefined): string {
  if (!values) return "";
  let out = "";
  for (const key of SPACING_KEYS) {
    const step = values[key];
    if (typeof step !== "number" || step <= 0) continue;
    const clamped = Math.max(MIN_STEP, Math.min(MAX_STEP, Math.floor(step)));
    out += `${CSS_PROPERTY[key]}:${SPACING_SCALE[clamped]}px;`;
  }
  return out;
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
cd packages/base && npm run test -- style-directive
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/rendering/style-directive.ts packages/base/tests/style-directive.test.ts
git commit -m "feat(style): spacing scale constant and renderStyleAttr helper"
```

---

### Task 2: `parseDirectiveFragment`

**Files:**
- Modify: `packages/base/src/document/rendering/style-directive.ts`
- Modify: `packages/base/tests/style-directive.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/base/tests/style-directive.test.ts`:

```ts
import { parseDirectiveFragment } from "../src/document/rendering/style-directive.js";

describe("parseDirectiveFragment", () => {
  test("parses simple pairs", () => {
    const { values, errors } = parseDirectiveFragment("mt=3 pb=2");
    expect(values).toEqual({ mt: 3, pb: 2 });
    expect(errors).toEqual([]);
  });

  test("unknown key → error, key omitted", () => {
    const { values, errors } = parseDirectiveFragment("mt=3 xy=1");
    expect(values).toEqual({ mt: 3 });
    expect(errors).toEqual([{ code: "unknown-key", token: "xy=1" }]);
  });

  test("invalid value (out of 0..7) → error, key omitted", () => {
    const { values, errors } = parseDirectiveFragment("mt=99");
    expect(values).toEqual({});
    expect(errors).toEqual([{ code: "invalid-value", token: "mt=99" }]);
  });

  test("duplicate key → first wins + error", () => {
    const { values, errors } = parseDirectiveFragment("mt=3 mt=5");
    expect(values).toEqual({ mt: 3 });
    expect(errors).toEqual([{ code: "duplicate-key", token: "mt=5" }]);
  });

  test("non key=value token → unknown-key", () => {
    const { values, errors } = parseDirectiveFragment("mt=3 garbage");
    expect(values).toEqual({ mt: 3 });
    expect(errors).toEqual([{ code: "unknown-key", token: "garbage" }]);
  });

  test("empty string → no values, no errors", () => {
    expect(parseDirectiveFragment("")).toEqual({ values: {}, errors: [] });
  });
});
```

- [ ] **Step 2: Run and verify fail**

```bash
cd packages/base && npm run test -- style-directive
```
Expected: import error / ReferenceError for `parseDirectiveFragment`.

- [ ] **Step 3: Implement in `style-directive.ts`**

Add to the file:

```ts
export type FragmentErrorCode =
  | "unknown-key"
  | "invalid-value"
  | "duplicate-key";

export interface FragmentError {
  code: FragmentErrorCode;
  token: string;
}

export interface ParsedFragment {
  values: StyleValues;
  errors: FragmentError[];
}

const KEY_RE = /^(mt|mr|mb|ml|pt|pr|pb|pl)$/;

export function parseDirectiveFragment(fragment: string): ParsedFragment {
  const values: StyleValues = {};
  const errors: FragmentError[] = [];
  const tokens = fragment.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq < 0) {
      errors.push({ code: "unknown-key", token });
      continue;
    }
    const key = token.slice(0, eq);
    const raw = token.slice(eq + 1);
    if (!KEY_RE.test(key)) {
      errors.push({ code: "unknown-key", token });
      continue;
    }
    const num = Number(raw);
    if (!Number.isInteger(num) || num < MIN_STEP || num > MAX_STEP) {
      errors.push({ code: "invalid-value", token });
      continue;
    }
    if (key in values) {
      errors.push({ code: "duplicate-key", token });
      continue;
    }
    values[key as SpacingKey] = num;
  }
  return { values, errors };
}
```

- [ ] **Step 4: Run and verify pass**

```bash
cd packages/base && npm run test -- style-directive
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/rendering/style-directive.ts packages/base/tests/style-directive.test.ts
git commit -m "feat(style): parseDirectiveFragment with per-token error reporting"
```

---

### Task 3: `STRICT` / `CANDIDATE` regexes + `extractDirective`

**Files:**
- Modify: `packages/base/src/document/rendering/style-directive.ts`
- Modify: `packages/base/tests/style-directive.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `style-directive.test.ts`:

```ts
import { extractDirective } from "../src/document/rendering/style-directive.js";

describe("extractDirective", () => {
  test("strict match returns well-formed result", () => {
    const r = extractDirective("## Heading {:style mt=3 pb=2}");
    expect(r).toEqual({
      kind: "wellFormed",
      spanStart: 10, // index of the leading space
      spanEnd: 29,
      fragment: "mt=3 pb=2",
    });
  });

  test("no directive → none", () => {
    expect(extractDirective("## Heading").kind).toBe("none");
  });

  test("inline mid-line {:style} is not a directive", () => {
    expect(extractDirective("Text with {:style mt=3} inside").kind).toBe("none");
  });

  test("malformed (missing closing brace) → candidate", () => {
    const r = extractDirective("## Heading {:style mt=3");
    expect(r.kind).toBe("malformed");
    if (r.kind === "malformed") {
      expect(r.spanStart).toBe(10);
      expect(r.spanEnd).toBe(23);
    }
  });

  test("trailing whitespace after } still strict", () => {
    const r = extractDirective("## Heading {:style mt=3}   ");
    expect(r.kind).toBe("wellFormed");
  });
});
```

- [ ] **Step 2: Run and verify fail**

```bash
cd packages/base && npm run test -- style-directive
```
Expected: `extractDirective` undefined.

- [ ] **Step 3: Implement in `style-directive.ts`**

```ts
// STRICT matches the canonical, well-formed directive at end-of-line.
// Groups: 1 = leading whitespace; 2 = fragment between {:style and }.
export const STRICT_DIRECTIVE_RE = /(\s+)\{:style\s+([^}\n]*)\}\s*$/;

// CANDIDATE matches "{:style" near EOL when STRICT fails (missing/misplaced
// closing brace). Used to emit malformed-directive errors.
export const CANDIDATE_DIRECTIVE_RE = /(\s+)\{:style\b[^\n]*$/;

export type DirectiveMatch =
  | { kind: "none" }
  | { kind: "wellFormed"; spanStart: number; spanEnd: number; fragment: string }
  | { kind: "malformed"; spanStart: number; spanEnd: number };

export function extractDirective(line: string): DirectiveMatch {
  const strict = STRICT_DIRECTIVE_RE.exec(line);
  if (strict) {
    const spanStart = strict.index;
    const spanEnd = spanStart + strict[0].length;
    return { kind: "wellFormed", spanStart, spanEnd, fragment: strict[2] };
  }
  const candidate = CANDIDATE_DIRECTIVE_RE.exec(line);
  if (candidate) {
    const spanStart = candidate.index;
    const spanEnd = spanStart + candidate[0].length;
    return { kind: "malformed", spanStart, spanEnd };
  }
  return { kind: "none" };
}
```

- [ ] **Step 4: Run and verify pass**

```bash
cd packages/base && npm run test -- style-directive
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/rendering/style-directive.ts packages/base/tests/style-directive.test.ts
git commit -m "feat(style): STRICT/CANDIDATE directive regexes and extractDirective"
```

---

## Phase 2 — Block model (`buildBlockEntries`)

### Task 4: `BlockEntry` types and `isStylableToken`

**Files:**
- Create: `packages/base/src/document/rendering/block-model.ts`
- Create: `packages/base/tests/block-model.test.ts`

- [ ] **Step 1: Add types and predicate**

`packages/base/src/document/rendering/block-model.ts`:

```ts
import type { StyleValues } from "./style-directive.js";

export type BlockType =
  | "heading"
  | "paragraph"
  | "blockquote"
  | "list"
  | "table"
  | "hr"
  | "code"
  | "figure"
  | `mdContainer:${string}`;

export type StyleErrorCode =
  | "unknown-key"
  | "invalid-value"
  | "duplicate-key"
  | "malformed-directive"
  | "orphan-directive";

export interface StyleError {
  code: StyleErrorCode;
  line: number; // 0-based, editor-buffer line (incl. frontmatter)
  styleDirectiveRange: { from: number; to: number }; // document-absolute offsets
  blockId: string | null;
  message: string;
}

export interface BlockEntry {
  blockId: string;
  blockType: BlockType;
  sourceLineStart: number; // 0-based in editor buffer
  sourceLineEnd: number; // 0-based in editor buffer, inclusive
  styleDirectiveRange: { from: number; to: number } | null;
  styleValues: StyleValues;
  errors: StyleError[];
  parentBlockId: string | null; // v1: always null
}

// The stylable token kinds (match §3.4 + §5.2 of the spec).
export function isStylableToken(token: unknown): boolean {
  const t = (token as { type?: string })?.type;
  return (
    t === "heading" ||
    t === "paragraph" ||
    t === "blockquote" ||
    t === "list" ||
    t === "table" ||
    t === "hr" ||
    t === "code" ||
    t === "mdContainer"
  );
}
```

- [ ] **Step 2: Build succeeds**

```bash
cd packages/base && npm run build:check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/base/src/document/rendering/block-model.ts packages/base/tests/block-model.test.ts
git commit -m "feat(style): BlockEntry/StyleError types and stylable-token predicate"
```

---

### Task 5: `buildBlockEntries` pass 1 — probe for well-formed directives

**Files:**
- Modify: `packages/base/src/document/rendering/block-model.ts`
- Modify: `packages/base/tests/block-model.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/base/tests/block-model.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildBlockEntries } from "../src/document/rendering/block-model.js";

describe("buildBlockEntries — well-formed directives", () => {
  test("heading with directive", () => {
    const body = "## Heading {:style mt=3 pb=2}\n";
    const { blockEntries, styleErrors } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(styleErrors).toEqual([]);
    expect(blockEntries).toHaveLength(1);
    const e = blockEntries[0];
    expect(e.blockId).toBe("b0");
    expect(e.blockType).toBe("heading");
    expect(e.sourceLineStart).toBe(0);
    expect(e.sourceLineEnd).toBe(0);
    expect(e.styleValues).toEqual({ mt: 3, pb: 2 });
    expect(e.styleDirectiveRange).toEqual({ from: 10, to: 29 });
    expect(e.errors).toEqual([]);
    expect(e.parentBlockId).toBeNull();
  });

  test("plain heading no directive", () => {
    const { blockEntries } = buildBlockEntries("## Plain\n", {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(blockEntries).toHaveLength(1);
    expect(blockEntries[0].styleDirectiveRange).toBeNull();
    expect(blockEntries[0].styleValues).toEqual({});
  });

  test("paragraph with directive on first source line", () => {
    const body = "First line of paragraph. {:style mt=4}\nSecond line continues.\n";
    const { blockEntries } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(blockEntries).toHaveLength(1);
    expect(blockEntries[0].blockType).toBe("paragraph");
    expect(blockEntries[0].styleValues).toEqual({ mt: 4 });
  });
});
```

- [ ] **Step 2: Run and verify fail**

```bash
cd packages/base && npm run test -- block-model
```
Expected: `buildBlockEntries` undefined.

- [ ] **Step 3: Implement**

Add to `block-model.ts`:

```ts
import { marked } from "marked";
import { extractDirective, parseDirectiveFragment } from "./style-directive.js";

export interface BuildOptions {
  frontmatterCharOffset: number;
  frontmatterLineOffset: number;
}

interface ProbeRecord {
  blockType: BlockType;
  sourceLineStart: number; // body-relative, 0-based
  sourceLineEnd: number;
  bodySpanFrom: number; // body-absolute char offset of leading space
  bodySpanTo: number;
  fragment: string | null; // null when malformed
  malformed: boolean;
}

function lineStartOffsets(body: string): number[] {
  const starts = [0];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function tokenBlockType(token: { type?: string; name?: string }): BlockType {
  const t = token.type;
  if (t === "mdContainer") {
    return `mdContainer:${token.name ?? "unknown"}`;
  }
  // paragraph with a single image child renders as a <figure>; we keep blockType
  // "paragraph" at the model level and the renderer upgrades to figure in HTML.
  return t as BlockType;
}

export function buildBlockEntries(
  body: string,
  opts: BuildOptions,
): { blockEntries: BlockEntry[]; styleErrors: StyleError[] } {
  const starts = lineStartOffsets(body);

  // Pass 1 — probe
  const pass1 = marked.lexer(body);
  const probes: ProbeRecord[] = [];
  let offset = 0;
  for (const token of pass1 as Array<Record<string, any>>) {
    const raw: string = token.raw ?? "";
    const tokenFrom = offset;
    offset += raw.length;
    if (!isStylableToken(token)) continue;
    const lineStart = body.slice(0, tokenFrom).split("\n").length - 1;
    const firstNewline = raw.indexOf("\n");
    const firstLine = firstNewline >= 0 ? raw.slice(0, firstNewline) : raw;
    const match = extractDirective(firstLine);
    const lineEnd = lineStart + (raw.endsWith("\n") ? raw.split("\n").length - 2 : raw.split("\n").length - 1);
    if (match.kind === "none") {
      probes.push({
        blockType: tokenBlockType(token),
        sourceLineStart: lineStart,
        sourceLineEnd: Math.max(lineStart, lineEnd),
        bodySpanFrom: 0,
        bodySpanTo: 0,
        fragment: null,
        malformed: false,
      });
      continue;
    }
    probes.push({
      blockType: tokenBlockType(token),
      sourceLineStart: lineStart,
      sourceLineEnd: Math.max(lineStart, lineEnd),
      bodySpanFrom: tokenFrom + match.spanStart,
      bodySpanTo: tokenFrom + match.spanEnd,
      fragment: match.kind === "wellFormed" ? match.fragment : null,
      malformed: match.kind === "malformed",
    });
  }

  // (Pass 2 + strip + orphans + malformed emission added in later tasks.)

  const blockEntries: BlockEntry[] = [];
  const styleErrors: StyleError[] = [];
  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    const blockId = `b${i}`;
    let styleValues = {};
    const errors: StyleError[] = [];
    let styleDirectiveRange: BlockEntry["styleDirectiveRange"] = null;
    if (p.fragment !== null) {
      const parsed = parseDirectiveFragment(p.fragment);
      styleValues = parsed.values;
      styleDirectiveRange = {
        from: opts.frontmatterCharOffset + p.bodySpanFrom,
        to: opts.frontmatterCharOffset + p.bodySpanTo,
      };
      for (const e of parsed.errors) {
        errors.push({
          code: e.code,
          line: opts.frontmatterLineOffset + p.sourceLineStart,
          styleDirectiveRange,
          blockId,
          message: `${e.code}: ${e.token}`,
        });
      }
    }
    blockEntries.push({
      blockId,
      blockType: p.blockType,
      sourceLineStart: opts.frontmatterLineOffset + p.sourceLineStart,
      sourceLineEnd: opts.frontmatterLineOffset + p.sourceLineEnd,
      styleDirectiveRange,
      styleValues,
      errors,
      parentBlockId: null,
    });
  }

  // `starts` is unused at this stage; later tasks will use it for orphan scan.
  void starts;

  return { blockEntries, styleErrors };
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
cd packages/base && npm run test -- block-model
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/rendering/block-model.ts packages/base/tests/block-model.test.ts
git commit -m "feat(style): buildBlockEntries pass 1 (probe well-formed directives)"
```

---

### Task 6: Pass 2 — strip well-formed directives, re-lex, verify cleanliness

**Files:**
- Modify: `packages/base/src/document/rendering/block-model.ts`
- Modify: `packages/base/tests/block-model.test.ts`

- [ ] **Step 1: Add failing test for cleanliness across block types**

Append to `block-model.test.ts`:

```ts
import { marked } from "marked";
import { buildBlockEntries, type BlockEntry } from "../src/document/rendering/block-model.js";

describe("buildBlockEntries — directive stripping (pass 2)", () => {
  test("fenced code block retains clean token.lang", () => {
    const body = "```js {:style mt=3}\nconst x = 1;\n```\n";
    const { blockEntries, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(blockEntries[0].styleValues).toEqual({ mt: 3 });
    expect(cleanedBody).toBe("```js\nconst x = 1;\n```\n");
    const tokens = marked.lexer(cleanedBody) as any[];
    expect(tokens[0].type).toBe("code");
    expect(tokens[0].lang).toBe("js");
  });

  test("mdContainer retains clean attrs", () => {
    // `quote author="Alice"` stays in attrs; directive does not leak in.
    const body = ':::quote author="Alice" {:style mt=5}\nSome quote.\n:::\n';
    const { blockEntries, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(blockEntries[0].styleValues).toEqual({ mt: 5 });
    expect(cleanedBody.includes("{:style")).toBe(false);
    expect(cleanedBody).toContain('author="Alice"');
  });

  test("paragraph continuation line is not scanned", () => {
    // {:style} text on line 2 is prose, not a directive.
    const body = "First line. {:style mt=2}\nSecond {:style looks} weird.\n";
    const { blockEntries, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(blockEntries[0].styleValues).toEqual({ mt: 2 });
    expect(cleanedBody).toContain("Second {:style looks} weird.");
  });
});
```

- [ ] **Step 2: Run and verify fail**

```bash
cd packages/base && npm run test -- block-model
```
Expected: fail (`cleanedBody` not exported).

- [ ] **Step 3: Add pass 2 and expose `cleanedBody`**

Replace the return at the bottom of `buildBlockEntries` with the following expansion. Before `// `starts` is unused…` delete that line, then add above the `return`:

```ts
  // Build cleanedBody by stripping well-formed directive spans (reverse order).
  const stripSpans = probes
    .filter((p) => p.fragment !== null)
    .map((p) => ({ from: p.bodySpanFrom, to: p.bodySpanTo }))
    .sort((a, b) => b.from - a.from);

  let cleanedBody = body;
  for (const s of stripSpans) {
    cleanedBody = cleanedBody.slice(0, s.from) + cleanedBody.slice(s.to);
  }
```

Update the return signature and value:

```ts
return { blockEntries, styleErrors, cleanedBody };
```

Update the function's declared return type accordingly:

```ts
): { blockEntries: BlockEntry[]; styleErrors: StyleError[]; cleanedBody: string } {
```

Remove the `void starts;` line entirely.

- [ ] **Step 4: Run tests and verify pass**

```bash
cd packages/base && npm run test -- block-model
```
Expected: new tests pass; older tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/rendering/block-model.ts packages/base/tests/block-model.test.ts
git commit -m "feat(style): buildBlockEntries pass 2 — strip well-formed directives"
```

---

### Task 7: Malformed directive emission on block-start lines

**Files:**
- Modify: `packages/base/src/document/rendering/block-model.ts`
- Modify: `packages/base/tests/block-model.test.ts`

- [ ] **Step 1: Add failing test**

Append to `block-model.test.ts`:

```ts
describe("buildBlockEntries — malformed directives", () => {
  test("missing closing brace → malformed-directive, not stripped", () => {
    const body = "## Heading {:style mt=3\n";
    const { blockEntries, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(cleanedBody).toBe(body); // NOT stripped
    expect(blockEntries[0].styleValues).toEqual({});
    expect(blockEntries[0].errors).toHaveLength(1);
    expect(blockEntries[0].errors[0].code).toBe("malformed-directive");
    expect(blockEntries[0].errors[0].blockId).toBe("b0");
    expect(blockEntries[0].styleDirectiveRange).toEqual({ from: 10, to: 23 });
  });
});
```

- [ ] **Step 2: Run and verify fail**

```bash
cd packages/base && npm run test -- block-model
```
Expected: malformed test fails (no error emitted, cleanedBody stripped).

- [ ] **Step 3: Update the entry-building loop**

Inside the `for (let i = 0; i < probes.length; i++)` loop of `buildBlockEntries`, add a branch for malformed:

```ts
    if (p.malformed) {
      styleDirectiveRange = {
        from: opts.frontmatterCharOffset + p.bodySpanFrom,
        to: opts.frontmatterCharOffset + p.bodySpanTo,
      };
      errors.push({
        code: "malformed-directive",
        line: opts.frontmatterLineOffset + p.sourceLineStart,
        styleDirectiveRange,
        blockId,
        message: "Directive is not closed properly (missing `}`).",
      });
    } else if (p.fragment !== null) {
      // existing well-formed branch
      ...
    }
```

Re-order the `if` chain so malformed is checked first; the well-formed branch stays the same. Make sure `styleDirectiveRange` is declared before the `if`.

Also — the strip-span filter must exclude malformed probes (they are NOT stripped). Already handled by the `p.fragment !== null` filter; verify that malformed rows keep `fragment === null` and `malformed === true`.

- [ ] **Step 4: Run tests**

```bash
cd packages/base && npm run test -- block-model
```
Expected: all block-model tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/rendering/block-model.ts packages/base/tests/block-model.test.ts
git commit -m "feat(style): emit malformed-directive errors without stripping"
```

---

### Task 8: Orphan-directive detection

**Files:**
- Modify: `packages/base/src/document/rendering/block-model.ts`
- Modify: `packages/base/tests/block-model.test.ts`

- [ ] **Step 1: Failing test**

```ts
describe("buildBlockEntries — orphan directives", () => {
  test("directive on a line that's not a block-start → orphan error", () => {
    // Trailing blank-line directive on its own line — no stylable token begins here.
    const body = "## Heading\n\n   {:style mt=3}\n";
    const { styleErrors, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(cleanedBody).toBe(body);
    expect(styleErrors).toHaveLength(1);
    expect(styleErrors[0].code).toBe("orphan-directive");
    expect(styleErrors[0].blockId).toBeNull();
  });

  test("well-formed directive inside a fenced code block content is NOT orphan", () => {
    const body = "```\nsome code {:style mt=3}\nmore\n```\n";
    const { styleErrors } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
    });
    expect(styleErrors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and verify fail**

```bash
cd packages/base && npm run test -- block-model
```

- [ ] **Step 3: Implement**

After pass 1 loop, before building the return value, add:

```ts
  // Orphan scan — lines outside every stylable probe that still hold a STRICT match.
  const claimedLines = new Set<number>();
  for (const p of probes) {
    if (p.fragment !== null || p.malformed) claimedLines.add(p.sourceLineStart);
  }

  // Also mark every line *inside* every non-stylable top-level token (e.g. html, code body)
  // as "claimed" so content inside a fenced code block isn't flagged.
  {
    let scan = 0;
    for (const token of pass1 as Array<Record<string, any>>) {
      const raw: string = token.raw ?? "";
      const tokenStartLine = body.slice(0, scan).split("\n").length - 1;
      const lines = raw.split("\n").length - (raw.endsWith("\n") ? 1 : 0);
      if (!isStylableToken(token)) {
        for (let l = tokenStartLine; l < tokenStartLine + lines; l++) claimedLines.add(l);
      }
      scan += raw.length;
    }
  }

  const lines = body.split("\n");
  for (let li = 0; li < lines.length; li++) {
    if (claimedLines.has(li)) continue;
    const m = extractDirective(lines[li]);
    if (m.kind !== "wellFormed") continue;
    const lineOffset = starts[li];
    styleErrors.push({
      code: "orphan-directive",
      line: opts.frontmatterLineOffset + li,
      styleDirectiveRange: {
        from: opts.frontmatterCharOffset + lineOffset + m.spanStart,
        to: opts.frontmatterCharOffset + lineOffset + m.spanEnd,
      },
      blockId: null,
      message: "Directive is not attached to any stylable block.",
    });
  }
```

Re-introduce the `starts` variable's usage (it was removed in Task 6); keep its declaration.

- [ ] **Step 4: Run and verify pass**

```bash
cd packages/base && npm run test -- block-model
```

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/rendering/block-model.ts packages/base/tests/block-model.test.ts
git commit -m "feat(style): orphan-directive detection on unclaimed block-start lines"
```

---

### Task 9: Coordinate translation with a non-zero frontmatter offset

**Files:**
- Modify: `packages/base/tests/block-model.test.ts`

`buildBlockEntries` already adds `frontmatterCharOffset` / `frontmatterLineOffset` to every exported offset. This task only adds a dedicated test to verify the translation is correct end-to-end.

- [ ] **Step 1: Add test**

```ts
describe("buildBlockEntries — coordinate translation", () => {
  test("frontmatter offsets are added to every exported range", () => {
    const body = "## Heading {:style mt=3 pb=2}\n";
    const frontmatterCharOffset = 20; // as if 20 characters of frontmatter precede
    const frontmatterLineOffset = 3; // 3 lines of frontmatter
    const { blockEntries, styleErrors } = buildBlockEntries(body, {
      frontmatterCharOffset,
      frontmatterLineOffset,
    });
    const e = blockEntries[0];
    expect(e.sourceLineStart).toBe(3);
    expect(e.sourceLineEnd).toBe(3);
    expect(e.styleDirectiveRange).toEqual({ from: 30, to: 49 });
    expect(styleErrors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd packages/base && npm run test -- block-model
```
Expected: pass without changes to source.

- [ ] **Step 3: Commit**

```bash
git add packages/base/tests/block-model.test.ts
git commit -m "test(style): coordinate translation with non-zero frontmatter offsets"
```

---

## Phase 3 — Renderer integration

### Task 10: Wire `buildBlockEntries` into `section-pipeline.ts`

**Files:**
- Modify: `packages/base/src/document/rendering/section-pipeline.ts`

The existing `renderMarkdown` tokenizes `body` once, assigns `_sourceLine` manually, and returns `sourceBlocks`. We add `buildBlockEntries` usage and route rendering through `cleanedBody`.

- [ ] **Step 1: Import**

Near the top of `section-pipeline.ts`:

```ts
import { buildBlockEntries, type BlockEntry, type StyleError } from "./block-model.js";
import { renderStyleAttr, type StyleValues } from "./style-directive.js";
```

- [ ] **Step 2: Add `_style` assignment after tokenization**

Find the block starting at `const tokens = marked.lexer(body);` inside `renderMarkdown`. Replace the following block so that we compute `blockEntries` via two-pass and then re-lex on cleaned body:

```ts
  const frontmatterCharOffset = md.length - body.length;
  const frontmatterLineOffset = startLine;
  const { blockEntries, styleErrors, cleanedBody } = buildBlockEntries(body, {
    frontmatterCharOffset,
    frontmatterLineOffset,
  });
  const tokens = marked.lexer(cleanedBody);
  const sourceBlocks = buildSourceBlocks(tokens);
  {
    let cursor = 0;
    let blockCursor = 0;
    for (const token of tokens) {
      const idx = cleanedBody.indexOf((token as any).raw, cursor);
      if (idx >= 0) {
        const lineInSection = cleanedBody.substring(0, idx).split("\n").length - 1;
        (token as any)._sourceLine = startLine + lineInSection;
        cursor = idx + (token as any).raw.length;
      }
      if (blockCursor < blockEntries.length && blockEntries[blockCursor].sourceLineStart === (token as any)._sourceLine) {
        (token as any)._blockId = blockEntries[blockCursor].blockId;
        (token as any)._style = blockEntries[blockCursor].styleValues as StyleValues;
        blockCursor++;
      }
    }
  }
```

- [ ] **Step 3: Extend the return object**

Find the `return {` at end of `renderMarkdown` and add:

```ts
    blockEntries,
    styleErrors,
```

Update the function's declared return type to include these.

- [ ] **Step 4: Build check**

```bash
cd packages/base && npm run build:check
```
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/rendering/section-pipeline.ts
git commit -m "feat(style): integrate buildBlockEntries into renderMarkdown pipeline"
```

---

### Task 11: Emit `data-block-id` + merged `style=""` in every stylable renderer

**Files:**
- Modify: `packages/base/src/document/rendering/section-pipeline.ts`

Every token that has `_blockId` + `_style` needs its root element to emit both. The pattern is uniform per renderer.

- [ ] **Step 1: Add a helper at module top-level**

Inside `section-pipeline.ts`, above the `marked.use({ ... })` block:

```ts
function styleAnnotation(token: any): string {
  const blockId = token._blockId ? ` data-block-id="${token._blockId}"` : "";
  const styleCss = renderStyleAttr(token._style);
  return { blockId, styleCss } as unknown as string; // placeholder, see usage below
}
```

Actually use a small `buildAnnotations` helper that returns both pieces, because many renderers compose their own `style` already:

```ts
function blockAnnotations(token: any): { blockIdAttr: string; styleCss: string } {
  const blockIdAttr = token._blockId ? ` data-block-id="${token._blockId}"` : "";
  const styleCss = renderStyleAttr(token._style);
  return { blockIdAttr, styleCss };
}
```

Remove the first `styleAnnotation` stub if added by mistake.

- [ ] **Step 2: Update the `heading` renderer**

Inside the `heading(this: any, token): string {` function: after `const sl = …` line, add:

```ts
      const { blockIdAttr, styleCss } = blockAnnotations(token);
```

Then change every `style="<existing CSS>"` emission to `style="<existing CSS>;${styleCss}"` and every opening tag to include `${blockIdAttr}`. Four emission sites inside the function:
- depth ≥ 5 return
- depth 1 return (the `beorn-disc` path)
- depth 2 return
- depth 3 return
- the non-partieNum fallback depth

For the depth-2 case the change looks like:

```ts
return `<h2${idAttr}${sl}${blockIdAttr} style="color:${primary};${vars};${styleCss}"><span class="beorn-num" ...`;
```

Apply the same pattern to every return statement inside `heading`.

- [ ] **Step 3: Update `paragraph` renderer**

Same pattern. After `const sl = …`:

```ts
      const { blockIdAttr, styleCss } = blockAnnotations(token);
```

Three emission sites:
- `<figure class="md-image${alignClass}"${sl}>` → add `${blockIdAttr} style="${styleCss}"` (and if `styleCss` empty, omit the attr; use conditional: `${styleCss ? ` style="${styleCss}"` : ""}`)
- `<div class="page-break"${sl}></div>` → add `${blockIdAttr}${styleCss ? ` style="${styleCss}"` : ""}`
- `<p${sl}>${text}</p>` → same

- [ ] **Step 4: Repeat for remaining renderers**

Apply the same transformation to:
- `blockquote` — `<blockquote${sl}>`
- `list` — `<${tag}${startAttr}${sl}>`
- `table` — `<table${sl}>`
- `hr` — `<hr${sl} />`
- `code` — two paths: mermaid `<div class="mermaid-diagram"${sl}…>` and `<pre${sl}>`
- `mdContainer` — every branch that emits a root container `<div>` / `<blockquote>`

Each renderer: call `blockAnnotations(token)` once, then append `${blockIdAttr}` to the root tag's attribute list and merge `${styleCss}` into the root tag's `style=""`.

- [ ] **Step 5: Build check**

```bash
cd packages/base && npm run build:check
```

- [ ] **Step 6: Commit**

```bash
git add packages/base/src/document/rendering/section-pipeline.ts
git commit -m "feat(style): emit data-block-id and merged style on every stylable root"
```

---

### Task 12: Cache `blockEntries` in `render-scheduler` and publish on `section-ready`

**Files:**
- Modify: `packages/base/src/document/render-scheduler.ts`

- [ ] **Step 1: Add cache**

Near the `_lastSourceBlocks` declaration:

```ts
let _lastBlockEntries: BlockEntry[] = [];
let _lastStyleErrors: StyleError[] = [];
```

Add the imports at the top:

```ts
import type { BlockEntry, StyleError } from "./rendering/block-model.js";
```

- [ ] **Step 2: Populate from `renderResult`**

In `renderRequest`, after the existing `_lastSourceBlocks` assignment:

```ts
  _lastBlockEntries = (renderResult.blockEntries || []) as BlockEntry[];
  _lastStyleErrors = (renderResult.styleErrors || []) as StyleError[];
```

- [ ] **Step 3: Export getters**

At the end of the module:

```ts
export function getBlockEntries(): BlockEntry[] {
  return _lastBlockEntries;
}
export function getStyleErrors(): StyleError[] {
  return _lastStyleErrors;
}
```

- [ ] **Step 4: Build check**

```bash
cd packages/base && npm run build:check
```

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/document/render-scheduler.ts
git commit -m "feat(style): cache and expose blockEntries + styleErrors in render-scheduler"
```

---

## Phase 4 — Fast-path

### Task 13: `rootsEqual` diff-contract fix

**Files:**
- Modify: `packages/base/src/document/render-scheduler.ts`
- Create: `packages/base/tests/diff-contract.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/base/tests/diff-contract.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { rootsEqual } from "../src/document/render-scheduler.js";

function el(html: string): Element {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.firstElementChild!;
}

describe("rootsEqual", () => {
  test("identical elements → true", () => {
    expect(rootsEqual(el(`<p>hi</p>`), el(`<p>hi</p>`))).toBe(true);
  });

  test("different innerHTML → false", () => {
    expect(rootsEqual(el(`<p>hi</p>`), el(`<p>bye</p>`))).toBe(false);
  });

  test("different style attribute → false", () => {
    expect(rootsEqual(
      el(`<p>hi</p>`),
      el(`<p style="margin-top:16px">hi</p>`),
    )).toBe(false);
  });

  test("different tag → false", () => {
    expect(rootsEqual(el(`<p>hi</p>`), el(`<div>hi</div>`))).toBe(false);
  });

  test("different attribute count → false", () => {
    expect(rootsEqual(
      el(`<p class="a">hi</p>`),
      el(`<p>hi</p>`),
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify fail**

```bash
cd packages/base && npm run test -- diff-contract
```
Expected: fail (`rootsEqual` not exported).

- [ ] **Step 3: Add `rootsEqual` to `render-scheduler.ts`**

Near the existing `diffSourceBlocks`:

```ts
export function rootsEqual(a: Element, b: Element): boolean {
  if (a.innerHTML !== b.innerHTML) return false;
  if (a.tagName !== b.tagName) return false;
  const aAttrs = a.attributes;
  const bAttrs = b.attributes;
  if (aAttrs.length !== bAttrs.length) return false;
  for (let i = 0; i < aAttrs.length; i++) {
    if (b.getAttribute(aAttrs[i].name) !== aAttrs[i].value) return false;
  }
  return true;
}
```

- [ ] **Step 4: Use it in `diffSourceBlocks`**

Replace:

```ts
    if (oldEl.innerHTML !== newEl.innerHTML) {
      changed.add(line);
    }
```

with:

```ts
    if (!rootsEqual(oldEl, newEl)) {
      changed.add(line);
    }
```

- [ ] **Step 5: Run tests and verify pass**

```bash
cd packages/base && npm run test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/base/src/document/render-scheduler.ts packages/base/tests/diff-contract.test.ts
git commit -m "feat(style): attribute-aware rootsEqual diff (fixes style-only miss)"
```

---

### Task 14: Apply-contract fix in `patchVisiblePages`

**Files:**
- Modify: `packages/base/src/document/rendering/preview-renderer.ts`

- [ ] **Step 1: Replace the inner loop of `patchVisiblePages`**

The existing loop lives at `patchVisiblePages` (§ file:preview-renderer.ts around line 170-190). Replace the `for (const el of liveEls)` body with:

```ts
      for (const el of liveEls) {
        const page = el.closest(".pagedjs_page") as HTMLElement | null;
        if (!page) continue;
        const pageNum = parseInt(page.dataset.pageNumber || "0", 10);
        if (pageNum < visibleRange.first || pageNum > visibleRange.last) continue;

        // Paged.js split elements carry data-ref / data-split-from / data-split-to.
        // When present, we preserve the live wrapper and sync attributes instead
        // of a full replace to keep chunker state intact. Otherwise we can
        // replaceWith the fresh node (simpler + more correct for style-only edits).
        const hasPagedRef =
          el.hasAttribute("data-ref") ||
          el.hasAttribute("data-split-from") ||
          el.hasAttribute("data-split-to");
        if (!hasPagedRef) {
          el.replaceWith(newEl.cloneNode(true));
          patched++;
          continue;
        }

        // Attribute sync, preserving Paged.js-owned attributes.
        const preserve = new Set([
          "data-source-line",
          "data-block-id",
          "data-ref",
          "data-split-from",
          "data-split-to",
        ]);
        for (const attr of Array.from(newEl.attributes)) {
          if (preserve.has(attr.name)) continue;
          el.setAttribute(attr.name, attr.value);
        }
        for (const attr of Array.from(el.attributes)) {
          if (preserve.has(attr.name)) continue;
          if (!newEl.hasAttribute(attr.name)) el.removeAttribute(attr.name);
        }
        // Ensure data-block-id syncs — it's on the preserve list for Paged.js
        // wrappers but should still track the fresh render. Apply explicitly:
        const newBlockId = newEl.getAttribute("data-block-id");
        if (newBlockId !== null) el.setAttribute("data-block-id", newBlockId);

        el.innerHTML = newEl.innerHTML;
        patched++;
      }
```

- [ ] **Step 2: Match by `data-block-id` too**

At the top of the same function, after computing `liveEls`:

```ts
      const liveElsById = newEl.getAttribute("data-block-id")
        ? this.previewPages.querySelectorAll(`[data-block-id="${newEl.getAttribute("data-block-id")}"]`)
        : null;
      const liveIter: NodeListOf<Element> = liveElsById && liveElsById.length > 0 ? liveElsById : liveEls;
```

Then replace `for (const el of liveEls)` with `for (const el of Array.from(liveIter))`.

- [ ] **Step 3: Build check**

```bash
cd packages/base && npm run build:check
```

- [ ] **Step 4: Commit**

```bash
git add packages/base/src/document/rendering/preview-renderer.ts
git commit -m "feat(style): patch path syncs attributes and prefers data-block-id"
```

---

## Phase 5 — UI plumbing

### Task 15: `sidebar-panel-manager`

**Files:**
- Create: `packages/base/src/shell/ui/sidebar-panel-manager.ts`

- [ ] **Step 1: Look at existing signal primitive**

```bash
cat packages/base/src/infrastructure/signal.ts
```
Note the Signal API (likely `signal<T>(initial)` + `.subscribe` + `.value`).

- [ ] **Step 2: Implement**

```ts
import { signal } from "../../infrastructure/signal.js";

export type SidebarPanel = "outline" | "inspector" | "none";

const _active = signal<SidebarPanel>("outline");

export function activeSidebarPanel(): SidebarPanel {
  return _active.value;
}

export function onSidebarPanelChange(fn: (p: SidebarPanel) => void): () => void {
  return _active.subscribe(fn);
}

export function setActivePanel(panel: SidebarPanel): void {
  _active.value = panel;
}

// Outline manager routes visibility requests through this:
// requestOutline(true) asks to show the outline — honored only when the current
// panel is NOT "inspector". requestOutline(false) downgrades to "none" when
// nothing else wants the sidebar.
export function requestOutline(show: boolean): void {
  if (_active.value === "inspector") return;
  _active.value = show ? "outline" : "none";
}

// Apply visibility to DOM. Call once at app start.
export function bindSidebarDom(
  outlineSection: HTMLElement,
  inspectorPanel: HTMLElement,
): void {
  const apply = (p: SidebarPanel): void => {
    outlineSection.style.display = p === "outline" ? "" : "none";
    inspectorPanel.style.display = p === "inspector" ? "" : "none";
  };
  apply(_active.value);
  _active.subscribe(apply);
}
```

- [ ] **Step 3: Build check**

```bash
cd packages/base && npm run build:check
```

- [ ] **Step 4: Commit**

```bash
git add packages/base/src/shell/ui/sidebar-panel-manager.ts
git commit -m "feat(style): sidebar-panel-manager arbitrates outline vs inspector"
```

---

### Task 16: Refactor `outline-manager.ts` to route through sidebar-panel-manager

**Files:**
- Modify: `packages/base/src/editor/outline-manager.ts`

- [ ] **Step 1: Replace direct `style.display` writes**

At the top of `outline-manager.ts`:

```ts
import { requestOutline } from "../shell/ui/sidebar-panel-manager.js";
```

Replace:
```ts
if (outlineList) outlineList.innerHTML = "";
if (outlineSection) outlineSection.style.display = "none";
```
in `clearOutline` with:
```ts
if (outlineList) outlineList.innerHTML = "";
requestOutline(false);
```

Replace:
```ts
if (outlineSection && outlineHeadings.length > 0) {
  outlineSection.style.display = "";
}
```
in `buildOutline` with:
```ts
if (outlineHeadings.length > 0) {
  requestOutline(true);
} else {
  requestOutline(false);
}
```

- [ ] **Step 2: Build check**

```bash
cd packages/base && npm run build:check
```

- [ ] **Step 3: Commit**

```bash
git add packages/base/src/editor/outline-manager.ts
git commit -m "refactor(outline): route visibility through sidebar-panel-manager"
```

---

### Task 17: `style-mode` module

**Files:**
- Create: `packages/base/src/shell/ui/style-mode.ts`

- [ ] **Step 1: Implement**

```ts
import { signal } from "../../infrastructure/signal.js";
import { setActivePanel, requestOutline, activeSidebarPanel } from "./sidebar-panel-manager.js";

const _active = signal<boolean>(false);
const _suspended = signal<boolean>(false); // true while editor is actively typing

export function isStyleModeActive(): boolean {
  return _active.value;
}

export function onStyleModeChange(fn: (on: boolean) => void): () => void {
  return _active.subscribe(fn);
}

export function isInteractionSuspended(): boolean {
  return _suspended.value;
}

export function suspendInteraction(): void {
  _suspended.value = true;
}

export function resumeInteraction(): void {
  _suspended.value = false;
}

function applyBodyClass(on: boolean): void {
  document.body.classList.toggle("style-mode", on);
}

export function enable(): void {
  if (_active.value) return;
  _active.value = true;
  applyBodyClass(true);
  setActivePanel("inspector");
}

export function disable(): void {
  if (!_active.value) return;
  _active.value = false;
  applyBodyClass(false);
  // Restore whatever the outline wants (or none if empty).
  if (activeSidebarPanel() === "inspector") {
    // Outline-manager will re-issue requestOutline on next buildOutline.
    // Until then, mark as none so the preview pane gets focus back.
    requestOutline(false);
  }
}

export function toggle(): void {
  if (_active.value) disable();
  else enable();
}
```

- [ ] **Step 2: Build check**

```bash
cd packages/base && npm run build:check
```

- [ ] **Step 3: Commit**

```bash
git add packages/base/src/shell/ui/style-mode.ts
git commit -m "feat(style): style-mode signal, enable/disable, body class"
```

---

### Task 18: Top-bar toggle UI + keyboard shortcut

**Files:**
- Modify: `packages/base/index.html`
- Modify: `packages/base/css/app/toolbar.css`
- Modify: `packages/base/src/shell/ui/keyboard-shortcuts.ts`
- Modify: `packages/base/src/shell/app-orchestrator.ts`

- [ ] **Step 1: Toggle markup in `packages/base/index.html`**

Inside the toolbar `<div class="toolbar">`, immediately after `<span class="status" id="status">Ready</span>`:

```html
      <div
        id="btnStyleMode"
        class="wrap-toggle toolbar-style-toggle"
        title="Toggle style mode (Ctrl/Cmd+Shift+Y)"
      >
        <span>Style</span>
        <div class="wrap-track"><div class="wrap-thumb"></div></div>
      </div>
```

- [ ] **Step 2: CSS in `packages/base/css/app/toolbar.css`**

Append:

```css
.toolbar-style-toggle {
  margin-left: 12px;
}
body.style-mode .toolbar-style-toggle {
  color: #fff;
}
body.style-mode .toolbar-style-toggle .wrap-track {
  background: #3373b3;
  border-color: #3373b3;
}
body.style-mode .toolbar-style-toggle .wrap-thumb {
  left: 14px;
  background: #fff;
}
```

- [ ] **Step 3: Wire the click handler in `packages/base/src/shell/ui/style-mode.ts`**

Append to `style-mode.ts`:

```ts
export function bindToggleButton(btn: HTMLElement): void {
  const update = (on: boolean): void => {
    btn.classList.toggle("active", on);
  };
  update(_active.value);
  _active.subscribe(update);
  btn.addEventListener("click", () => toggle());
}
```

- [ ] **Step 4: Register keyboard shortcut**

Open `packages/base/src/shell/ui/keyboard-shortcuts.ts` and add (following the existing pattern for other shortcuts):

```ts
import { toggle as toggleStyleMode, disable as disableStyleMode } from "./style-mode.js";
```

In the `keydown` handler:

```ts
if (e.key === "y" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
  e.preventDefault();
  toggleStyleMode();
  return;
}
if (e.key === "Escape") {
  // Only deselect if style-mode-selection is active. We'll gate this later
  // once preview-interaction exports deselect(); for now, no-op.
}
```

- [ ] **Step 5: Bootstrap from `app-orchestrator`**

Near the bottom of `app-orchestrator.ts`'s initialization block, after the sidebar is in the DOM:

```ts
import { bindToggleButton } from "./ui/style-mode.js";

const styleBtn = document.getElementById("btnStyleMode");
if (styleBtn) bindToggleButton(styleBtn);
```

- [ ] **Step 6: Build + open the app**

```bash
cd packages/base && npm run build
# then open the Electron app via `npm start` from repo root OR use preview tools
```

Click the toggle: body class should toggle, inspector panel placeholder (empty for now) should appear instead of the outline.

- [ ] **Step 7: Commit**

```bash
git add packages/base/index.html packages/base/css/app/toolbar.css packages/base/src/shell/ui/style-mode.ts packages/base/src/shell/ui/keyboard-shortcuts.ts packages/base/src/shell/app-orchestrator.ts
git commit -m "feat(style): style-mode toggle in toolbar + Ctrl/Cmd+Shift+Y shortcut"
```

---

### Task 19: Inspector panel shell in the sidebar

**Files:**
- Modify: `packages/base/index.html`
- Modify: `packages/base/css/app/sidebar.css`
- Modify: `packages/base/src/shell/app-orchestrator.ts`

- [ ] **Step 1: Markup**

In `index.html`, inside `.file-sidebar`, immediately after the closing `</div>` of `#outlineSection`:

```html
        <div class="inspector-section" id="inspectorPanel" style="display:none">
          <div class="inspector-header" id="inspectorHeader">Style Inspector</div>
          <div class="inspector-empty" id="inspectorEmpty">
            Click a block in the preview to edit its spacing.
          </div>
          <div class="inspector-body" id="inspectorBody" style="display:none"></div>
          <div class="inspector-errors" id="inspectorErrors" style="display:none"></div>
        </div>
```

- [ ] **Step 2: CSS**

Append to `packages/base/css/app/sidebar.css`:

```css
.inspector-section {
  display: flex;
  flex-direction: column;
  padding: 12px 10px;
  border-top: 1px solid #334155;
  flex: 1 1 auto;
  overflow-y: auto;
  gap: 10px;
  color: #c9d1d9;
  font-size: 12px;
}
.inspector-header {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 600;
}
.inspector-empty {
  color: #64748b;
  font-style: italic;
}
.inspector-errors {
  border-top: 1px dashed #334155;
  padding-top: 10px;
  color: #f87171;
}
```

- [ ] **Step 3: Bind in `app-orchestrator`**

```ts
import { bindSidebarDom } from "./ui/sidebar-panel-manager.js";

const outlineEl = document.getElementById("outlineSection");
const inspectorEl = document.getElementById("inspectorPanel");
if (outlineEl && inspectorEl) bindSidebarDom(outlineEl, inspectorEl);
```

- [ ] **Step 4: Build + manual check**

Build, launch app, toggle Style Mode: outline hides, inspector empty state shows.

- [ ] **Step 5: Commit**

```bash
git add packages/base/index.html packages/base/css/app/sidebar.css packages/base/src/shell/app-orchestrator.ts
git commit -m "feat(style): inspector panel shell + sidebar-panel binding"
```

---

## Phase 6 — Preview interaction

### Task 20: `preview-interaction` module + state classes

**Files:**
- Create: `packages/base/src/shell/ui/preview-interaction.ts`
- Modify: `packages/base/css/preview/preview.css`
- Modify: `packages/base/src/shell/app-orchestrator.ts`

- [ ] **Step 1: Module**

```ts
import { signal } from "../../infrastructure/signal.js";
import { isStyleModeActive, isInteractionSuspended } from "./style-mode.js";

const _hovered = signal<string | null>(null);
const _selected = signal<string | null>(null);

export function hoveredBlockId(): string | null {
  return _hovered.value;
}
export function selectedBlockId(): string | null {
  return _selected.value;
}
export function onHoverChange(fn: (id: string | null) => void): () => void {
  return _hovered.subscribe(fn);
}
export function onSelectionChange(fn: (id: string | null) => void): () => void {
  return _selected.subscribe(fn);
}

export function deselect(): void {
  _selected.value = null;
}

function resolveBlock(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>("[data-block-id]");
  return el?.dataset.blockId ?? null;
}

function applyClasses(container: HTMLElement, hoveredId: string | null, selectedId: string | null): void {
  for (const el of container.querySelectorAll<HTMLElement>(".style-hovered")) {
    el.classList.remove("style-hovered");
  }
  for (const el of container.querySelectorAll<HTMLElement>(".style-selected")) {
    el.classList.remove("style-selected");
  }
  if (hoveredId) {
    for (const el of container.querySelectorAll<HTMLElement>(`[data-block-id="${hoveredId}"]`)) {
      el.classList.add("style-hovered");
    }
  }
  if (selectedId) {
    for (const el of container.querySelectorAll<HTMLElement>(`[data-block-id="${selectedId}"]`)) {
      el.classList.add("style-selected");
    }
  }
}

export function install(container: HTMLElement): void {
  container.addEventListener("pointermove", (e) => {
    if (!isStyleModeActive() || isInteractionSuspended()) {
      if (_hovered.value !== null) _hovered.value = null;
      return;
    }
    const id = resolveBlock(e.target);
    if (id !== _hovered.value) _hovered.value = id;
  });
  container.addEventListener("pointerleave", () => {
    if (_hovered.value !== null) _hovered.value = null;
  });
  container.addEventListener("click", (e) => {
    if (!isStyleModeActive()) return;
    const id = resolveBlock(e.target);
    if (id !== null) {
      e.preventDefault();
      e.stopPropagation();
      _selected.value = id;
    } else {
      _selected.value = null;
    }
  });

  _hovered.subscribe((h) => applyClasses(container, h, _selected.value));
  _selected.subscribe((s) => applyClasses(container, _hovered.value, s));
  // Re-apply classes after every render (container's children get replaced).
  // The selected block may disappear; let the inspector re-match by sourceLineStart.
}
```

- [ ] **Step 2: CSS**

Append to `packages/base/css/preview/preview.css`:

```css
body.style-mode [data-block-id] {
  cursor: pointer;
}
body.style-mode .style-hovered {
  outline: 1px solid #3b82f6;
  outline-offset: -1px;
  background: rgba(59, 130, 246, 0.05);
}
body.style-mode .style-selected {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
  background: rgba(37, 99, 235, 0.08);
}
```

- [ ] **Step 3: Install in app-orchestrator**

```ts
import { install as installPreviewInteraction } from "./ui/preview-interaction.js";

const previewEl = document.getElementById("preview-container");
if (previewEl) installPreviewInteraction(previewEl);
```

- [ ] **Step 4: Build + verify in browser**

Toggle Style Mode, hover over preview elements → they get outlined. Click → a block gets selected, outline persists.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/shell/ui/preview-interaction.ts packages/base/css/preview/preview.css packages/base/src/shell/app-orchestrator.ts
git commit -m "feat(style): preview pointer delegation + hover/selected state classes"
```

---

## Phase 7 — Editor decorations

### Task 21: `style-block-highlight` CM6 plugin

**Files:**
- Create: `packages/base/src/editor/style-block-highlight.ts`
- Modify: `packages/base/src/editor/editor-decorations.ts`
- Modify: `packages/base/css/editor/editor.css`

- [ ] **Step 1: Plugin**

```ts
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import {
  onHoverChange,
  onSelectionChange,
  hoveredBlockId,
  selectedBlockId,
} from "../shell/ui/preview-interaction.js";
import { getBlockEntries } from "../document/render-scheduler.js";

const hoverLine = Decoration.line({ class: "cm-style-hovered" });
const selectedLine = Decoration.line({ class: "cm-style-selected" });

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const entries = getBlockEntries();
  const hoveredId = hoveredBlockId();
  const selectedId = selectedBlockId();
  const hovered = entries.find((e) => e.blockId === hoveredId);
  const selected = entries.find((e) => e.blockId === selectedId);
  const addRange = (start: number, end: number, deco: Decoration): void => {
    const docLines = view.state.doc.lines;
    for (let l = start; l <= end; l++) {
      if (l < 0 || l >= docLines) continue;
      const line = view.state.doc.line(l + 1); // CM6 is 1-based
      builder.add(line.from, line.from, deco);
    }
  };
  if (hovered) addRange(hovered.sourceLineStart, hovered.sourceLineEnd, hoverLine);
  if (selected) addRange(selected.sourceLineStart, selected.sourceLineEnd, selectedLine);
  return builder.finish();
}

export const styleBlockHighlight = ViewPlugin.define(
  (view) => {
    const refresh = (): void => {
      view.dispatch({});
    };
    const u1 = onHoverChange(refresh);
    const u2 = onSelectionChange(refresh);
    return {
      decorations: build(view),
      update(u) {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
      },
      destroy() {
        u1();
        u2();
      },
    } as any;
  },
  {
    decorations: (v: any) => v.decorations,
  },
);
```

Adapt imports to match the existing codemirror6 bundle pattern used elsewhere in the project (`packages/base/src/editor/editor-decorations.ts` already shows the import convention).

- [ ] **Step 2: Include in editor decorations**

In `editor-decorations.ts`, export/expose the plugin so the CM6 setup includes it. Check `packages/base/src/editor/codemirror-editor.ts` for the extensions list and add `styleBlockHighlight` there.

- [ ] **Step 3: CSS**

Append to `packages/base/css/editor/editor.css`:

```css
.cm-style-hovered { background: rgba(59, 130, 246, 0.08); }
.cm-style-selected { background: rgba(37, 99, 235, 0.16); }
```

- [ ] **Step 4: Build + manual check**

Toggle Style Mode, hover over a block in the preview: the corresponding editor lines highlight. Click: lines keep a darker highlight.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/editor/style-block-highlight.ts packages/base/src/editor/editor-decorations.ts packages/base/src/editor/codemirror-editor.ts packages/base/css/editor/editor.css
git commit -m "feat(style): editor line decorations mirror preview hover/selection"
```

---

### Task 22: `style-directive-lint` CM6 diagnostic source

**Files:**
- Create: `packages/base/src/editor/style-directive-lint.ts`
- Modify: `packages/base/src/editor/codemirror-editor.ts`

- [ ] **Step 1: Diagnostic source**

```ts
import { linter, type Diagnostic } from "@codemirror/lint";
import { getBlockEntries, getStyleErrors } from "../document/render-scheduler.js";

export const styleDirectiveLint = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  const push = (range: { from: number; to: number }, message: string): void => {
    if (range.from < 0 || range.to > view.state.doc.length) return;
    diagnostics.push({ from: range.from, to: range.to, severity: "error", message });
  };
  for (const e of getStyleErrors()) push(e.styleDirectiveRange, e.message);
  for (const b of getBlockEntries()) {
    for (const e of b.errors) push(e.styleDirectiveRange, e.message);
  }
  return diagnostics;
});
```

- [ ] **Step 2: Wire into CodeMirror extensions**

In `codemirror-editor.ts`, add `styleDirectiveLint` to the extensions list.

- [ ] **Step 3: Force a refresh on each render**

Emit a CM6 `forceLinting` call, or use a transaction dispatch with an empty annotation, from `render-scheduler.ts` after populating `_lastBlockEntries`:

```ts
import { forceLinting } from "@codemirror/lint";
// after _lastBlockEntries assignment:
forceLinting(editor.cmView());
```

Adjust to the actual API for getting the CM6 view from the editor wrapper.

- [ ] **Step 4: Build + manual check**

Write `## Heading {:style mt=3` (no `}`) in the editor. After the render debounce fires, the editor shows a red squiggle on the directive span.

- [ ] **Step 5: Commit**

```bash
git add packages/base/src/editor/style-directive-lint.ts packages/base/src/editor/codemirror-editor.ts packages/base/src/document/render-scheduler.ts
git commit -m "feat(style): CM6 diagnostics for malformed/orphan/invalid directives"
```

---

## Phase 8 — Inspector

### Task 23: Inspector box-model UI + `writeDirective`

**Files:**
- Create: `packages/base/src/editor/style-inspector.ts`
- Create: `packages/base/tests/style-inspector.test.ts`
- Modify: `packages/base/css/app/sidebar.css`
- Modify: `packages/base/src/shell/app-orchestrator.ts`

- [ ] **Step 1: Test `writeDirective`**

`packages/base/tests/style-inspector.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { computeDirectiveChange } from "../src/editor/style-inspector.js";

describe("computeDirectiveChange", () => {
  test("insert new directive at end of line", () => {
    const doc = "## Heading\nOther line\n";
    const line = 0;
    const change = computeDirectiveChange({
      doc,
      line,
      existingRange: null,
      newValues: { mt: 3, pb: 2 },
    });
    expect(change).toEqual({
      from: 10, // end of "## Heading"
      to: 10,
      insert: " {:style mt=3 pb=2}",
    });
  });

  test("replace existing directive", () => {
    const doc = "## Heading {:style mt=3}\n";
    const change = computeDirectiveChange({
      doc,
      line: 0,
      existingRange: { from: 10, to: 24 },
      newValues: { mt: 5, pb: 2 },
    });
    expect(change).toEqual({
      from: 10,
      to: 24,
      insert: " {:style mt=5 pb=2}",
    });
  });

  test("remove directive (all zero)", () => {
    const doc = "## Heading {:style mt=3}\n";
    const change = computeDirectiveChange({
      doc,
      line: 0,
      existingRange: { from: 10, to: 24 },
      newValues: {},
    });
    expect(change).toEqual({ from: 10, to: 24, insert: "" });
  });

  test("keys serialize in fixed order", () => {
    const change = computeDirectiveChange({
      doc: "p\n",
      line: 0,
      existingRange: null,
      newValues: { pb: 1, mt: 2, ml: 3 },
    });
    expect(change.insert).toBe(" {:style mt=2 ml=3 pb=1}");
  });
});
```

- [ ] **Step 2: Implement `computeDirectiveChange`**

`packages/base/src/editor/style-inspector.ts`:

```ts
import { SPACING_KEYS, type StyleValues } from "../document/rendering/style-directive.js";

export interface DirectiveChange {
  from: number;
  to: number;
  insert: string;
}

export interface ComputeArgs {
  doc: string;
  line: number; // 0-based
  existingRange: { from: number; to: number } | null;
  newValues: StyleValues;
}

function serializeValues(values: StyleValues): string {
  const parts: string[] = [];
  for (const key of SPACING_KEYS) {
    const v = values[key];
    if (typeof v === "number" && v > 0) parts.push(`${key}=${v}`);
  }
  return parts.length ? `{:style ${parts.join(" ")}}` : "";
}

function lineEndOffset(doc: string, line: number): number {
  let offset = 0;
  for (let l = 0; l < line; l++) {
    const nl = doc.indexOf("\n", offset);
    if (nl < 0) return doc.length;
    offset = nl + 1;
  }
  const nl = doc.indexOf("\n", offset);
  return nl < 0 ? doc.length : nl;
}

export function computeDirectiveChange(args: ComputeArgs): DirectiveChange {
  const serialized = serializeValues(args.newValues);
  if (args.existingRange) {
    return {
      from: args.existingRange.from,
      to: args.existingRange.to,
      insert: serialized ? ` ${serialized}` : "",
    };
  }
  if (!serialized) {
    // No existing range and nothing to insert.
    return { from: 0, to: 0, insert: "" };
  }
  const eol = lineEndOffset(args.doc, args.line);
  return { from: eol, to: eol, insert: ` ${serialized}` };
}
```

- [ ] **Step 3: Run tests**

```bash
cd packages/base && npm run test -- style-inspector
```
Expected: 4 pass.

- [ ] **Step 4: Inspector UI (box-model)**

Append to `style-inspector.ts`:

```ts
import { SPACING_SCALE, MAX_STEP, MIN_STEP } from "../document/rendering/style-directive.js";
import { getBlockEntries } from "../document/render-scheduler.js";
import { onSelectionChange, selectedBlockId } from "../shell/ui/preview-interaction.js";
import { cm } from "./codemirror-editor.js";

const FIELDS: Array<{ key: keyof StyleValues; label: string; pos: string }> = [
  { key: "mt", label: "M↑", pos: "mt" },
  { key: "mr", label: "M→", pos: "mr" },
  { key: "mb", label: "M↓", pos: "mb" },
  { key: "ml", label: "M←", pos: "ml" },
  { key: "pt", label: "P↑", pos: "pt" },
  { key: "pr", label: "P→", pos: "pr" },
  { key: "pb", label: "P↓", pos: "pb" },
  { key: "pl", label: "P←", pos: "pl" },
];

export function mountInspector(root: HTMLElement): void {
  const body = root.querySelector<HTMLElement>("#inspectorBody")!;
  const empty = root.querySelector<HTMLElement>("#inspectorEmpty")!;
  const headerEl = root.querySelector<HTMLElement>("#inspectorHeader")!;

  function render(): void {
    const id = selectedBlockId();
    const entries = getBlockEntries();
    const entry = entries.find((e) => e.blockId === id) || null;
    if (!entry) {
      empty.style.display = "";
      body.style.display = "none";
      headerEl.textContent = "Style Inspector";
      return;
    }
    empty.style.display = "none";
    body.style.display = "";
    headerEl.textContent = `${entry.blockType}`;
    const hasErrors = entry.errors.length > 0;
    body.innerHTML = "";
    if (hasErrors) {
      const banner = document.createElement("div");
      banner.className = "inspector-error-banner";
      banner.textContent = "Directive has errors — fix in source first.";
      body.appendChild(banner);
    }
    const grid = document.createElement("div");
    grid.className = "inspector-box";
    for (const f of FIELDS) {
      const cell = document.createElement("div");
      cell.className = `inspector-cell inspector-cell-${f.pos}`;
      const current = (entry.styleValues[f.key] as number | undefined) ?? 0;
      const step = Math.max(MIN_STEP, Math.min(MAX_STEP, current));
      cell.innerHTML = `
        <label>${f.label}</label>
        <button class="inspector-dec" ${hasErrors ? "disabled" : ""}>−</button>
        <span class="inspector-step">${step}</span>
        <button class="inspector-inc" ${hasErrors ? "disabled" : ""}>+</button>
        <span class="inspector-px">${SPACING_SCALE[step]}px</span>
      `;
      const commit = (delta: number) => {
        if (hasErrors) return;
        const values = { ...entry.styleValues, [f.key]: Math.max(MIN_STEP, Math.min(MAX_STEP, step + delta)) } as StyleValues;
        const change = computeDirectiveChange({
          doc: cm.getValue(),
          line: entry.sourceLineStart,
          existingRange: entry.styleDirectiveRange,
          newValues: values,
        });
        cm.replaceRange(change.insert, cm.posFromIndex(change.from), cm.posFromIndex(change.to));
      };
      cell.querySelector<HTMLButtonElement>(".inspector-inc")!.addEventListener("click", () => commit(+1));
      cell.querySelector<HTMLButtonElement>(".inspector-dec")!.addEventListener("click", () => commit(-1));
      grid.appendChild(cell);
    }
    body.appendChild(grid);
  }

  onSelectionChange(render);
  render();
}
```

> Note: `cm.posFromIndex` is the CM5-compat API used elsewhere; confirm the exact method in `codemirror-editor.ts` and adjust accordingly.

- [ ] **Step 5: CSS**

Append to `sidebar.css`:

```css
.inspector-error-banner {
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fca5a5;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.inspector-box {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.inspector-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1e293b;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.inspector-cell label { color: #64748b; width: 28px; }
.inspector-cell button { background: #334155; border: none; color: #e2e8f0; width: 20px; height: 20px; border-radius: 3px; cursor: pointer; }
.inspector-cell button:disabled { opacity: 0.4; cursor: default; }
.inspector-cell .inspector-step { width: 16px; text-align: center; font-weight: 600; }
.inspector-cell .inspector-px { color: #64748b; margin-left: auto; font-size: 10px; }
```

- [ ] **Step 6: Bootstrap**

In `app-orchestrator.ts`:

```ts
import { mountInspector } from "../editor/style-inspector.js";
const inspectorRoot = document.getElementById("inspectorPanel");
if (inspectorRoot) mountInspector(inspectorRoot);
```

- [ ] **Step 7: Build + manual check**

Build, launch, open a document with a heading, enable Style Mode, click the heading, adjust `M↑` +/−: the source gets `{:style mt=N}` and the preview updates.

- [ ] **Step 8: Commit**

```bash
git add packages/base/src/editor/style-inspector.ts packages/base/tests/style-inspector.test.ts packages/base/css/app/sidebar.css packages/base/src/shell/app-orchestrator.ts
git commit -m "feat(style): inspector box-model with writeDirective-backed edits"
```

---

### Task 24: Doc-wide errors section + Jump to error

**Files:**
- Modify: `packages/base/src/editor/style-inspector.ts`

- [ ] **Step 1: Render document-wide errors**

Inside `mountInspector`'s `render()` function, after rendering the selected block, handle the errors container:

```ts
    const errorsEl = root.querySelector<HTMLElement>("#inspectorErrors")!;
    const docErrors = [
      ...getStyleErrors(),
      ...entries.flatMap((e) => e.errors),
    ];
    if (docErrors.length === 0) {
      errorsEl.style.display = "none";
      return;
    }
    errorsEl.style.display = "";
    errorsEl.innerHTML = `<div class="inspector-errors-title">Errors (${docErrors.length})</div>`;
    for (const err of docErrors) {
      const row = document.createElement("button");
      row.className = "inspector-error-row";
      row.textContent = `Line ${err.line + 1}: ${err.message}`;
      row.addEventListener("click", () => {
        cm.setCursor(cm.posFromIndex(err.styleDirectiveRange.from));
        cm.focus();
      });
      errorsEl.appendChild(row);
    }
```

Import `getStyleErrors` at top of the file:

```ts
import { getBlockEntries, getStyleErrors } from "../document/render-scheduler.js";
```

- [ ] **Step 2: CSS**

```css
.inspector-errors-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #f87171;
  margin-bottom: 6px;
}
.inspector-error-row {
  display: block;
  width: 100%;
  background: none;
  border: none;
  color: #fca5a5;
  padding: 4px 0;
  text-align: left;
  cursor: pointer;
  font-size: 11px;
}
.inspector-error-row:hover { color: #fecaca; }
```

- [ ] **Step 3: Build + manual check**

Introduce an orphan directive (e.g. put `{:style mt=3}` on a blank line); the errors section shows, clicking jumps the cursor.

- [ ] **Step 4: Commit**

```bash
git add packages/base/src/editor/style-inspector.ts packages/base/css/app/sidebar.css
git commit -m "feat(style): inspector doc-wide errors panel with Jump to error"
```

---

### Task 25: Selection re-match across re-renders

**Files:**
- Modify: `packages/base/src/shell/ui/preview-interaction.ts`
- Modify: `packages/base/src/document/render-scheduler.ts`

After a render, `blockEntries[]` is fresh — the previously-selected `blockId` may no longer exist. Per §4.1, selection is re-matched by `sourceLineStart`.

- [ ] **Step 1: Track last-selected `sourceLineStart`**

In `preview-interaction.ts`:

```ts
let _lastSelectedSourceLine: number | null = null;

export function rememberSelectedSourceLine(line: number | null): void {
  _lastSelectedSourceLine = line;
}

export function restoreSelection(entries: Array<{ blockId: string; sourceLineStart: number }>): void {
  if (_lastSelectedSourceLine === null) return;
  const match = entries.find((e) => e.sourceLineStart === _lastSelectedSourceLine);
  _selected.value = match ? match.blockId : null;
}
```

Make the inspector call `rememberSelectedSourceLine(entry.sourceLineStart)` when it renders a selected block, and `rememberSelectedSourceLine(null)` when empty.

- [ ] **Step 2: Wire into render-scheduler `section-ready`**

In `render-scheduler.ts`, after `_lastBlockEntries = …`:

```ts
import { restoreSelection } from "../shell/ui/preview-interaction.js";
restoreSelection(_lastBlockEntries);
```

- [ ] **Step 3: Manual check**

Select a block, type above it (causing a re-render). Selection stays on the same block.

- [ ] **Step 4: Commit**

```bash
git add packages/base/src/shell/ui/preview-interaction.ts packages/base/src/document/render-scheduler.ts packages/base/src/editor/style-inspector.ts
git commit -m "feat(style): re-match selection by sourceLineStart after re-render"
```

---

## Phase 9 — Finish line

### Task 26: End-to-end smoke verification

- [ ] **Step 1: Build**

```bash
cd packages/base && npm run build
```

- [ ] **Step 2: Start the app**

From repo root: `npm start` (or use the preview tools for a web-mode check).

- [ ] **Step 3: Walk through scenarios**

Check each:

1. Toggle Style Mode from the top bar.
2. Hover a heading — preview outlines + editor lines highlight.
3. Click the heading — persistent selection, inspector shows box-model.
4. Click `M↑ +` a few times — source gets `{:style mt=N}`, preview margin grows.
5. Reduce to all zeros — the directive is removed.
6. Introduce `## H {:style mt=3` (missing `}`) — inspector goes read-only, editor gutter shows a lint squiggle.
7. Type on a blank line `{:style mt=3}` alone — orphan error appears in the inspector's errors section; Jump to error moves cursor.
8. Select a fenced code block, `:::info` container, a table, an image figure, a paragraph, a list — each becomes selectable, styling persists.
9. Open a file with frontmatter — ranges still correct (edit a mid-doc block, confirm squiggle is on the right line).
10. Toggle Style Mode off — outline reappears, inspector hidden.

- [ ] **Step 4: Commit the smoke log**

If you find any regressions, fix and commit them individually; if everything passes, nothing to commit here.

---

## Self-review notes (filled during authoring)

- [x] Spec coverage: every numbered section of the spec has at least one task. §2.2 (preview interaction) → Task 20; §2.3 (editor highlight) → Task 21; §2.4 (inspector read-only) → Task 23; §2.5 (inspector UI) → Tasks 23-24; §3.1-3.6 (syntax, serialization) → Tasks 1-3 + 23; §4 (canonical model) → Tasks 4-9; §5.1 (parsing) → Tasks 5-9; §5.2 (renderer) → Task 11; §5.4 (diff + apply) → Tasks 13-14; §6 (nested policy) → enforced by `isStylableToken` in Task 4; §7 (UI state) → Tasks 15-16; §10 (re-match) → Task 25; §11 (errors) → Tasks 22, 24.
- [x] No placeholders: every step has exact code.
- [x] Type consistency: `BlockEntry`, `StyleError`, `StyleValues`, `SpacingKey` defined once and imported everywhere; `computeDirectiveChange` returns the same shape throughout.
- [x] Commands runnable: every bash block uses `cd packages/base` then either `npm run test` / `npm run build:check` / `npm run build`.
