// editor-decorations.ts — CM6 ViewPlugin providing editor decorations:
//
//  • Horizontal rule (--- / *** / ___): the raw marks are replaced with a
//    styled visual divider widget so the line reads as a visual separator.
//
//  • Heading level class (cm-md-h1 … cm-md-h6): a LINE decoration that tags
//    each heading line. Section numbers are rendered via CSS counters, so no
//    JS computation of "1.2.3" labels is needed.
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

// ── Line decorations (one per heading level) ──────────────────────────────────
// Stable instances so RangeSetBuilder can add them without allocating.

const HEADING_LINE_DECORATIONS = [
  null, // 0 — unused
  Decoration.line({ class: "cm-md-h1" }),
  Decoration.line({ class: "cm-md-h2" }),
  Decoration.line({ class: "cm-md-h3" }),
  Decoration.line({ class: "cm-md-h4" }),
  Decoration.line({ class: "cm-md-h5" }),
  Decoration.line({ class: "cm-md-h6" }),
] as const;

// ── Cursor guard ──────────────────────────────────────────────────────────────

function cursorLineStarts(view: any): Set<number> {
  const starts = new Set<number>();
  for (const range of view.state.selection.ranges) {
    starts.add(view.state.doc.lineAt(range.head).from);
  }
  return starts;
}

// ── Decoration builder ────────────────────────────────────────────────────────

function buildDecorations(view: any): any {
  const builder = new RangeSetBuilder();
  const onCursor = cursorLineStarts(view);

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text: string = line.text;
      const onCursorLine = onCursor.has(line.from);

      // Heading level class — always applied (independent of cursor) so CSS
      // counters advance deterministically across every heading line.
      const headingMatch = text.match(HEADING_PATTERN);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const deco = HEADING_LINE_DECORATIONS[level];
        if (deco) builder.add(line.from, line.from, deco);
      }

      // Horizontal rule — replaced with a visual divider unless the cursor
      // is on that line.
      if (!onCursorLine && HR_PATTERN.test(text)) {
        builder.add(
          line.from,
          line.to,
          Decoration.replace({ widget: new HrWidget() }),
        );
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const mdDecorations = ViewPlugin.fromClass(
  class {
    decorations: any;

    constructor(view: any) {
      this.decorations = buildDecorations(view);
    }

    update(update: any): void {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v: any) => v.decorations },
);

// ── Legacy stubs (kept for API compatibility with existing call-sites) ─────────

let _cursorLine = -1;

export function updateGutterMarkers(): void {}
export function applyPageBreakMarks(): void {}
export function applyHeadingMarks(): void {}
export function getCursorLine(): number { return _cursorLine; }
export function setCursorLine(line: number): void { _cursorLine = line; }
export function resetPageBreakCache(): void {}
