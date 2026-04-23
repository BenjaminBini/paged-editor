// block-entries-store.ts — leaf module that holds the latest blockEntries
// and styleErrors. Populated by render-scheduler after each section-ready,
// consumed by the editor plugins (style-block-highlight, style-directive-
// lint) and the inspector. Kept free of any other imports so the editor's
// CM6 extension tree doesn't pull render-scheduler → preview-sync-setup →
// codemirror-editor back into its own initialisation.

import type { BlockEntry, StyleError } from "./block-model.js";

let _blockEntries: BlockEntry[] = [];
let _styleErrors: StyleError[] = [];

export function setBlockEntries(entries: BlockEntry[]): void {
  _blockEntries = entries;
}

export function setStyleErrors(errors: StyleError[]): void {
  _styleErrors = errors;
}

export function getBlockEntries(): BlockEntry[] {
  return _blockEntries;
}

export function getStyleErrors(): StyleError[] {
  return _styleErrors;
}
