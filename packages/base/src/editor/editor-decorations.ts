// editor-decorations.ts — CM6 ViewPlugin providing two editor decorations:
//
//  • Horizontal rule  (--- / *** / ___): the raw marks are replaced with a
//    styled visual divider widget so the line reads as a visual separator.
//
//  • Section number badge: the leading hashes+space of each heading (# / ## / …)
//    are replaced with a computed "x", "x.y", "x.y.z" … label pill.
//    Section numbers are produced by the shared `computeSectionNumbers` utility
//    (same logic as the outline panel) so there is no duplicated calculation.
//
//  Both decorations are suppressed on lines where the cursor currently sits so
//  the user can always see and edit the raw Markdown source.

import {
  Decoration,
  RangeSetBuilder,
  ViewPlugin,
  WidgetType,
} from "../../assets/codemirror6.bundle.js";
import { detectPartieNum } from "../document/rendering/markdown-helpers.js";
import { getActiveFileName } from "../workspace/files/active-file-context.js";
import { computeSectionNumbers, SectionEntry } from "./section-numbers.js";

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

// ── Widget: section number badge ──────────────────────────────────────────────

class SectionBadgeWidget extends WidgetType {
  readonly label: string;
  readonly level: number;

  constructor(label: string, level: number) {
    super();
    this.label = label;
    this.level = level;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-heading-badge";
    el.setAttribute("data-level", String(this.level));
    el.textContent = this.label;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  eq(other: WidgetType): boolean {
    const o = other as SectionBadgeWidget;
    return o.label === this.label && o.level === this.level;
  }

  ignoreEvent(): boolean { return false; }
}

// ── Section map ───────────────────────────────────────────────────────────────

// Build a map of 0-based lineNo → SectionEntry using the shared utility.
// This is called only when the document changes (not on every frame).
function buildSectionMap(doc: any): Map<number, SectionEntry> {
  const fileName = getActiveFileName();
  const body = doc.toString() as string;
  const partieNum = detectPartieNum(body, fileName);

  const entries = computeSectionNumbers(
    (i: number) => (i < doc.lines ? (doc.line(i + 1).text as string) : ""),
    doc.lines as number,
    partieNum,
  );

  return new Map(entries.map((e) => [e.lineNo, e]));
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
  sectionMap: Map<number, SectionEntry>,
): any {
  const builder = new RangeSetBuilder();
  const onCursor = cursorLineStarts(view);

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text: string = line.text;
      const onCursorLine = onCursor.has(line.from);

      if (!onCursorLine) {
        // ── Horizontal rule ────────────────────────────────────────────────
        if (HR_PATTERN.test(text)) {
          builder.add(
            line.from,
            line.to,
            Decoration.replace({ widget: new HrWidget() }),
          );
        }

        // ── Section badge ──────────────────────────────────────────────────
        // lineNo is 0-based: CM6 line numbers are 1-based, so subtract 1.
        const lineNo = (view.state.doc.lineAt(pos).number as number) - 1;
        const entry = sectionMap.get(lineNo);
        if (entry) {
          const match = text.match(HEADING_PATTERN);
          if (match) {
            const prefixEnd = line.from + match[0].length;
            builder.add(
              line.from,
              prefixEnd,
              Decoration.replace({
                widget: new SectionBadgeWidget(entry.label, entry.level),
              }),
            );
          }
        }
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
    sectionMap: Map<number, SectionEntry>;

    constructor(view: any) {
      this.sectionMap = buildSectionMap(view.state.doc);
      this.decorations = buildDecorations(view, this.sectionMap);
    }

    update(update: any): void {
      if (update.docChanged) {
        // Rebuild the section map only when the document actually changes.
        this.sectionMap = buildSectionMap(update.view.state.doc);
      }
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view, this.sectionMap);
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
