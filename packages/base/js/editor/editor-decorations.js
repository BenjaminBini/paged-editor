// editor-decorations.ts — CM6 ViewPlugin providing two editor decorations:
//
//  • Horizontal rule  (--- / *** / ___): the raw marks are replaced with a
//    styled visual divider widget so the line reads as a visual separator.
//
//  • Section number badge: the leading hashes+space of each heading (# / ## / …)
//    are replaced with a computed "x", "x.y", "x.y.z" … label pill.
//    The number is calculated by walking the entire document from the top, so
//    "## Introduction" in the third H2 group correctly shows "3.2" etc.
//
//  Both decorations are suppressed on lines where the cursor currently sits so
//  the user can always see and edit the raw Markdown source.
import { Decoration, RangeSetBuilder, ViewPlugin, WidgetType, } from "../../assets/codemirror6.bundle.js";
// ── Constants ─────────────────────────────────────────────────────────────────
const HR_PATTERN = /^(\-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING_PATTERN = /^(#{1,6}) /;
// ── Widget: horizontal rule ───────────────────────────────────────────────────
class HrWidget extends WidgetType {
    toDOM() {
        const wrap = document.createElement("span");
        wrap.className = "cm-hr-widget";
        wrap.setAttribute("aria-hidden", "true");
        const line = document.createElement("span");
        line.className = "cm-hr-line";
        wrap.appendChild(line);
        return wrap;
    }
    eq(_other) { return true; }
    ignoreEvent() { return false; }
}
// ── Widget: section number badge ──────────────────────────────────────────────
class SectionBadgeWidget extends WidgetType {
    label;
    level;
    constructor(label, level) {
        super();
        this.label = label;
        this.level = level;
    }
    toDOM() {
        const el = document.createElement("span");
        el.className = "cm-heading-badge";
        el.setAttribute("data-level", String(this.level));
        el.textContent = this.label;
        el.setAttribute("aria-hidden", "true");
        return el;
    }
    eq(other) {
        const o = other;
        return o.label === this.label && o.level === this.level;
    }
    ignoreEvent() { return false; }
}
// ── Section numbering ─────────────────────────────────────────────────────────
// Walk the entire document and build a map of line-start-pos → section label.
// Labels look like "1", "1.2", "1.2.3" … matching the heading depth.
function buildSectionMap(doc) {
    const result = new Map();
    const counts = [0, 0, 0, 0, 0, 0];
    for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
        const line = doc.line(lineNo);
        const match = line.text.match(HEADING_PATTERN);
        if (!match)
            continue;
        const depth = match[1].length; // 1 = H1 … 6 = H6
        const idx = depth - 1; // 0-based index into counts
        counts[idx]++;
        // Reset all deeper counters.
        for (let j = idx + 1; j < 6; j++)
            counts[j] = 0;
        // Build label from the top down to this depth.
        const label = counts.slice(0, depth).join(".");
        result.set(line.from, { label, level: depth });
    }
    return result;
}
// ── Cursor guard ──────────────────────────────────────────────────────────────
function cursorLineStarts(view) {
    const starts = new Set();
    for (const range of view.state.selection.ranges) {
        starts.add(view.state.doc.lineAt(range.head).from);
    }
    return starts;
}
// ── Decoration builder ────────────────────────────────────────────────────────
function buildDecorations(view, sectionMap) {
    const builder = new RangeSetBuilder();
    const onCursor = cursorLineStarts(view);
    for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
            const line = view.state.doc.lineAt(pos);
            const text = line.text;
            const onCursorLine = onCursor.has(line.from);
            if (!onCursorLine) {
                // ── Horizontal rule ────────────────────────────────────────────────
                if (HR_PATTERN.test(text)) {
                    builder.add(line.from, line.to, Decoration.replace({ widget: new HrWidget() }));
                }
                // ── Section badge ──────────────────────────────────────────────────
                const entry = sectionMap.get(line.from);
                if (entry) {
                    const match = text.match(HEADING_PATTERN);
                    if (match) {
                        const prefixEnd = line.from + match[0].length;
                        builder.add(line.from, prefixEnd, Decoration.replace({
                            widget: new SectionBadgeWidget(entry.label, entry.level),
                        }));
                    }
                }
            }
            pos = line.to + 1;
        }
    }
    return builder.finish();
}
// ── Plugin ────────────────────────────────────────────────────────────────────
export const mdDecorations = ViewPlugin.fromClass(class {
    decorations;
    sectionMap;
    constructor(view) {
        this.sectionMap = buildSectionMap(view.state.doc);
        this.decorations = buildDecorations(view, this.sectionMap);
    }
    update(update) {
        if (update.docChanged) {
            // Rebuild the full section map whenever the document changes.
            this.sectionMap = buildSectionMap(update.view.state.doc);
        }
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = buildDecorations(update.view, this.sectionMap);
        }
    }
}, { decorations: (v) => v.decorations });
// ── Legacy stubs (kept for API compatibility with existing call-sites) ─────────
let _cursorLine = -1;
export function updateGutterMarkers() { }
export function applyPageBreakMarks() { }
export function applyHeadingMarks() { }
export function getCursorLine() { return _cursorLine; }
export function setCursorLine(line) { _cursorLine = line; }
export function resetPageBreakCache() { }
//# sourceMappingURL=editor-decorations.js.map