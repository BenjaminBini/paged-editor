// editor-decorations.js — CM6 migration fallback.
// CM5 inline marks and gutter classes are temporarily disabled.

let _cursorLine = -1;

export function updateGutterMarkers(): void {}

export function applyPageBreakMarks(): void {}

export function applyHeadingMarks(): void {}

export function getCursorLine(): number { return _cursorLine; }

export function setCursorLine(line: number): void { _cursorLine = line; }

export function resetPageBreakCache(): void {}
