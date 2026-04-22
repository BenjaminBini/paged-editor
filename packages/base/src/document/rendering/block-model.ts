// block-model.ts — Canonical block model for the style-mode feature.
//
// Every selectable block gets a BlockEntry. Entries are produced by
// buildBlockEntries (two-pass tokenization, §5.1 of the design spec) and
// consumed by the inspector, preview-interaction, editor decorations, and
// the source writer. All exported offsets are document-absolute (editor
// buffer coordinates, including frontmatter).

import type { StyleValues } from "./style-directive.js";

export type BlockType =
  | "heading"
  | "paragraph"
  | "blockquote"
  | "list"
  | "table"
  | "hr"
  | "code"
  | "figure"
  | `mdContainer:${string}`;

export type StyleErrorCode =
  | "unknown-key"
  | "invalid-value"
  | "duplicate-key"
  | "malformed-directive"
  | "orphan-directive";

export interface StyleError {
  code: StyleErrorCode;
  line: number; // 0-based editor-buffer line (frontmatter included)
  styleDirectiveRange: { from: number; to: number }; // document-absolute
  blockId: string | null;
  message: string;
}

export interface BlockEntry {
  blockId: string;
  blockType: BlockType;
  sourceLineStart: number;
  sourceLineEnd: number;
  styleDirectiveRange: { from: number; to: number } | null;
  styleValues: StyleValues;
  errors: StyleError[];
  parentBlockId: string | null; // v1: always null (see spec §6)
}

// Stylable top-level token kinds (see spec §3.4 / §5.2).
export function isStylableToken(token: unknown): boolean {
  const t = (token as { type?: string })?.type;
  return (
    t === "heading" ||
    t === "paragraph" ||
    t === "blockquote" ||
    t === "list" ||
    t === "table" ||
    t === "hr" ||
    t === "code" ||
    t === "mdContainer"
  );
}
