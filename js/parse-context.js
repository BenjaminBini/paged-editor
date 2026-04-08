// parse-context.js — Active file context for the markdown parse pipeline.
// Tracks the currently open filename so renderers can derive section numbers.

let _activeFileName = "";

export function setActiveFileName(name) {
  _activeFileName = name || "";
}

export function getActiveFileName() {
  return _activeFileName;
}
