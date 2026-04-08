// markdown.js — Parse state accessors and parseMarkdownSync.

import { state } from "./markdown-state.js";
import { resetMermaidQueue } from "./mermaid-render.js";
import { getActiveFileName } from "./parse-context.js";
import { COLOR_PAIRS } from "./markdown-helpers.js";
import "./marked-renderer.js"; // registers marked plugins (side-effect import)

export { COLOR_PAIRS };

// ── State accessors ──────────────────────────────────────────────────────────

export function setHeadingCollector(arr) {
  state.headingCollector = arr;
}

export function resetHeadingIdCounter() {
  state.headingIdCounter = 0;
}

// ── Parse markdown (sync, mermaid → placeholders) ───────────────────────────

export function parseMarkdownSync(md, colorIdx, startLine) {
  state.colorIdx = colorIdx;
  resetMermaidQueue();
  state.h2Count = 0;
  state.h3Count = 0;

  // Detect partie number: from markdown H1, or from filename prefix
  const partieMatch = md.match(/^#\s+Partie\s+(\d+)/im);
  if (partieMatch) {
    state.partieNum = parseInt(partieMatch[1], 10);
  } else {
    const fnMatch = getActiveFileName().match(/^(\d+)/);
    state.partieNum = fnMatch ? parseInt(fnMatch[1], 10) : 0;
  }

  const tokens = marked.lexer(md);

  if (startLine != null) {
    let cursor = 0;
    for (const token of tokens) {
      const idx = md.indexOf(token.raw, cursor);
      if (idx >= 0) {
        const lineInSection = md.substring(0, idx).split("\n").length - 1;
        token._sourceLine = startLine + lineInSection;
        cursor = idx + token.raw.length;
      }
    }
  }

  return marked.parser(tokens).replace(/\{src:[^}]+\}/g, "");
}
