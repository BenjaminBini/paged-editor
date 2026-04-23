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
function computeHeadingLabels(doc: any): Map<number, HeadingInfo> {
  const map = new Map<number, HeadingInfo>();
  // counters[1..6] — 0-slot unused for 1-indexed clarity.
  const counters: number[] = [0, 0, 0, 0, 0, 0, 0];
  const lineCount = doc.lines as number;
  for (let lineNo = 1; lineNo <= lineCount; lineNo++) {
    const line = doc.line(lineNo);
    const match = (line.text as string).match(HEADING_PATTERN);
    if (!match) continue;
    const level = match[1].length;
    if (level < 1 || level > MAX_HEADING_LEVEL) continue;
    counters[level] += 1;
    for (let k = level + 1; k <= MAX_HEADING_LEVEL; k++) counters[k] = 0;
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

export const mdDecorations = ViewPlugin.fromClass(
  class {
    decorations: any;
    labels: Map<number, HeadingInfo>;

    constructor(view: any) {
      this.labels = computeHeadingLabels(view.state.doc);
      this.decorations = buildDecorations(view, this.labels);
    }

    update(update: any): void {
      if (update.docChanged) {
        // Recompute only when the text itself changes — scrolling and
        // cursor moves reuse the cached labels.
        this.labels = computeHeadingLabels(update.view.state.doc);
      }
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view, this.labels);
      }
    }
  },
  { decorations: (v: any) => v.decorations },
);
