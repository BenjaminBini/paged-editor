// editor-decorations.ts — CM6 ViewPlugin providing editor decorations:
//
//  • Horizontal rule (--- / *** / ___): the raw marks are replaced with a
//    styled visual divider widget so the line reads as a visual separator.
//
//  • Heading number badges (1 / 1.2 / 1.2.3 …): every heading line receives
//    a Line decoration carrying `class="cm-md-h{level}"` and
//    `data-sec="<label>"`. CSS reads the label via `content: attr(data-sec)`.
//    The label map is rebuilt only when the document changes — not on
//    viewport/selection updates — so scrolling is allocation-free.
//
//  NOTE on why CSS `counter()` doesn't work here: CodeMirror virtualises the
//  viewport and removes off-screen lines from the DOM. CSS counters walk the
//  live DOM tree, so a heading that scrolls out of view stops contributing to
//  its counter, and subsequent visible headings render with resets to zero.
//  Precomputing the label in JS and emitting it as an attribute avoids the
//  issue while still doing the numeric display purely in CSS.
//
//  The HR widget is suppressed on the line where the cursor sits so the user
//  can always see and edit the raw Markdown source.

import {
  Decoration,
  RangeSetBuilder,
  ViewPlugin,
  WidgetType,
} from "../../assets/codemirror6.bundle.js";
import { detectPartieNum } from "../document/rendering/markdown-helpers.js";
import { getActiveFileName } from "../workspace/files/active-file-context.js";
import { on as busOn, off as busOff } from "../infrastructure/event-bus.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const HR_PATTERN = /^(\-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING_PATTERN = /^(#{1,6}) /;
const MAX_HEADING_LEVEL = 6;

// ── Widget: horizontal rule ───────────────────────────────────────────────────

class HrWidget extends WidgetType {
  toDOM(): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-hr-widget";
    wrap.setAttribute("aria-hidden", "true");

    const line = document.createElement("span");
    line.className = "cm-hr-line";
    wrap.appendChild(line);

    return wrap;
  }

  eq(_other: WidgetType): boolean { return true; }
  ignoreEvent(): boolean { return false; }
}

// ── Heading label map ─────────────────────────────────────────────────────────

interface HeadingInfo {
  level: number;
  label: string; // e.g. "1", "1.2", "1.2.3"
}

// Walk the whole document once, compute section numbers with stable counters.
// O(lines); runs only when the document changes.
//
// If the filename (or an explicit "# Partie N" line) yields a partie number,
// that number seeds the h1 counter — so in a file like "01-typography.md",
// the first h2 renders as "1.1" instead of ".1", even when the document has
// no top-level h1. h1 lines in the body don't increment the partie number;
// they just reset child counters.
function computeHeadingLabels(doc: any, partieNum: number): Map<number, HeadingInfo> {
  const map = new Map<number, HeadingInfo>();
  // counters[1..6] — 0-slot unused for 1-indexed clarity.
  const counters: number[] = [0, 0, 0, 0, 0, 0, 0];
  if (partieNum > 0) counters[1] = partieNum;

  const lineCount = doc.lines as number;
  for (let lineNo = 1; lineNo <= lineCount; lineNo++) {
    const line = doc.line(lineNo);
    const match = (line.text as string).match(HEADING_PATTERN);
    if (!match) continue;
    const level = match[1].length;
    if (level < 1 || level > MAX_HEADING_LEVEL) continue;
    if (level === 1 && partieNum > 0) {
      // Partie number is document-wide — h1 lines don't shift it.
      counters[1] = partieNum;
      for (let k = 2; k <= MAX_HEADING_LEVEL; k++) counters[k] = 0;
    } else {
      counters[level] += 1;
      for (let k = level + 1; k <= MAX_HEADING_LEVEL; k++) counters[k] = 0;
    }
    const parts: number[] = [];
    for (let k = 1; k <= level; k++) parts.push(counters[k]);
    map.set(line.from, { level, label: parts.join(".") });
  }
  return map;
}

// ── Cursor guard ──────────────────────────────────────────────────────────────

function cursorLineStarts(view: any): Set<number> {
  const starts = new Set<number>();
  for (const range of view.state.selection.ranges) {
    starts.add(view.state.doc.lineAt(range.head).from);
  }
  return starts;
}

// ── Decoration builder ────────────────────────────────────────────────────────

function buildDecorations(
  view: any,
  labels: Map<number, HeadingInfo>,
): any {
  const builder = new RangeSetBuilder();
  const onCursor = cursorLineStarts(view);

  // Collect visible line starts so HR decorations stay scoped to the viewport.
  // Heading Line decorations are emitted for EVERY heading in the document
  // (not just visible) so the attribute-based numbering stays correct even
  // for lines CM6 hasn't mounted yet.
  const visibleStarts = new Set<number>();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      visibleStarts.add(line.from);
      pos = line.to + 1;
    }
  }

  // Walk lines in document order so RangeSetBuilder receives rising `from`s.
  const doc = view.state.doc;
  const lineCount = doc.lines as number;
  for (let lineNo = 1; lineNo <= lineCount; lineNo++) {
    const line = doc.line(lineNo);
    const heading = labels.get(line.from);
    if (heading) {
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          class: `cm-md-h${heading.level}`,
          attributes: { "data-sec": heading.label },
        }),
      );
    }
    if (
      visibleStarts.has(line.from) &&
      !onCursor.has(line.from) &&
      HR_PATTERN.test(line.text as string)
    ) {
      builder.add(
        line.from,
        line.to,
        Decoration.replace({ widget: new HrWidget() }),
      );
    }
  }

  return builder.finish();
}

// ── Plugin ────────────────────────────────────────────────────────────────────

function currentPartieNum(doc: any): number {
  return detectPartieNum(doc.toString() as string, getActiveFileName() || "");
}

export const mdDecorations = ViewPlugin.fromClass(
  class {
    decorations: any;
    labels: Map<number, HeadingInfo>;
    partieNum: number;
    private _onContentLoaded: () => void;

    constructor(view: any) {
      this.partieNum = currentPartieNum(view.state.doc);
      this.labels = computeHeadingLabels(view.state.doc, this.partieNum);
      this.decorations = buildDecorations(view, this.labels);

      // `content-loaded` fires after a tab switch completes — setValue
      // updates the doc first, then tab-integration sets the active-file
      // context, then content-loaded publishes. Rebuild labels here so the
      // new filename drives the partie number.
      this._onContentLoaded = (): void => {
        this.partieNum = currentPartieNum(view.state.doc);
        this.labels = computeHeadingLabels(view.state.doc, this.partieNum);
        this.decorations = buildDecorations(view, this.labels);
        view.dispatch({}); // force CM to pick up the new decoration set
      };
      busOn("content-loaded", this._onContentLoaded);
    }

    update(update: any): void {
      if (update.docChanged) {
        // Text changes may reveal/hide a `# Partie N` directive — recompute
        // the partie number too. The filename check is a cheap string op.
        this.partieNum = currentPartieNum(update.view.state.doc);
        this.labels = computeHeadingLabels(update.view.state.doc, this.partieNum);
      }
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view, this.labels);
      }
    }

    destroy(): void {
      busOff("content-loaded", this._onContentLoaded);
    }
  },
  { decorations: (v: any) => v.decorations },
);
