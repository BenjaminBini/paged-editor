// parse-context.js — Active file context for the markdown parse pipeline.
// Tracks the currently open filename so renderers can derive section numbers.

let _activeFileName: string = "";
let _activeFilePath: string = "";

export function setActiveFileName(name: string): void {
  _activeFileName = name || "";
}

export function setActiveFilePath(path: string): void {
  _activeFilePath = path || "";
}

export function setActiveFileContext(name: string, path: string): void {
  setActiveFileName(name);
  setActiveFilePath(path);
}

export function getActiveFileName(): string {
  return _activeFileName;
}

export function getActiveFilePath(): string {
  return _activeFilePath;
}
