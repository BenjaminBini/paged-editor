// section-numbers.ts — Shared utility for computing heading section numbers.
//
// Used by both outline-manager.ts (for the outline panel) and
// editor-decorations.ts (for the heading badge ViewPlugin) so the numbering
// logic lives in exactly one place.

export interface SectionEntry {
  /** 0-based line number in the document. */
  lineNo: number;
  /** Human-readable label, e.g. "2", "2.1", "2.1.3". */
  label: string;
  /** Heading depth: 1 = H1 … 6 = H6. */
  level: number;
}

const HEADING_RE = /^(#{1,4}) (.+)/;

/**
 * Walk all lines and compute section numbers for every heading.
 *
 * @param getLine   0-based line accessor (return "" for out-of-range).
 * @param lineCount Total number of lines.
 * @param partieNum Partie prefix from the file name / H1 content (0 = none).
 */
export function computeSectionNumbers(
  getLine: (lineNo: number) => string,
  lineCount: number,
  partieNum: number,
): SectionEntry[] {
  const entries: SectionEntry[] = [];
  // counters[0] = H2, counters[1] = H3, counters[2] = H4
  const counters = [0, 0, 0];

  for (let i = 0; i < lineCount; i++) {
    const m = getLine(i).match(HEADING_RE);
    if (!m) continue;

    const level = m[1].length; // 1-based depth

    if (level === 1) {
      counters[0] = 0;
      counters[1] = 0;
      counters[2] = 0;
      // H1 gets a top-level label derived from partieNum (or empty).
      const label = partieNum ? String(partieNum) : "1";
      entries.push({ lineNo: i, label, level });
      continue;
    }

    const lvl = level - 2; // 0-indexed into counters (H2→0, H3→1, H4→2)
    counters[lvl]++;
    for (let k = lvl + 1; k < counters.length; k++) counters[k] = 0;

    const prefix = partieNum ? `${partieNum}.` : "";
    const label = prefix + counters.slice(0, lvl + 1).join(".");
    entries.push({ lineNo: i, label, level });
  }

  return entries;
}
