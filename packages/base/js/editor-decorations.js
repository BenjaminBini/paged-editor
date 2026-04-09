// editor-decorations.js — CM6 migration fallback.
// CM5 inline marks and gutter classes are temporarily disabled.

let _cursorLine = -1;

export function updateGutterMarkers() {}

export function applyPageBreakMarks() {}

export function applyHeadingMarks() {}

export function getCursorLine() { return _cursorLine; }

export function setCursorLine(line) { _cursorLine = line; }

export function resetPageBreakCache() {}
