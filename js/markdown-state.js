// markdown-state.js — Shared mutable state for the markdown rendering pipeline.
// Exported as a single object so both markdown.js and marked-renderer.js
// reference the same live values without circular imports.

export const state = {
  colorIdx: 0,
  partieNum: 0,
  headingCollector: null,
  headingIdCounter: 0,
  h2Count: 0,
  h3Count: 0,
};
