// parse-context.js — Active file context for the markdown parse pipeline.
// Tracks the currently open filename so renderers can derive section numbers.

let _activeFileName = "";
let _activeFilePath = "";

export function setActiveFileName(name) {
  _activeFileName = name || "";
}

export function setActiveFilePath(path) {
  _activeFilePath = path || "";
}

export function setActiveFileContext(name, path) {
  setActiveFileName(name);
  setActiveFilePath(path);
}

export function getActiveFileName() {
  return _activeFileName;
}

export function getActiveFilePath() {
  return _activeFilePath;
}
