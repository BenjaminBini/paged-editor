// block-model.ts — Canonical block model for the style-mode feature.
//
// Every selectable block gets a BlockEntry. Entries are produced by
// buildBlockEntries (two-pass tokenization, §5.1 of the design spec) and
// consumed by the inspector, preview-interaction, editor decorations, and
// the source writer. All exported offsets are document-absolute (editor
// buffer coordinates, including frontmatter).

import type { StyleValues } from "./style-directive.js";
import {
  extractDirective,
  parseDirectiveFragment,
} from "./style-directive.js";

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

// ── buildBlockEntries ──────────────────────────────────────────────────────
// Two-pass tokenization (spec §5.1). Accepts a `lex` function so the module
// stays usable in both the browser (where `marked` is a global) and Node
// tests (where `marked` is imported via npm).

type RawToken = Record<string, unknown>;
type LexFn = (src: string) => RawToken[];

export interface BuildOptions {
  frontmatterCharOffset: number;
  frontmatterLineOffset: number;
  lex: LexFn;
}

interface ProbeRecord {
  blockType: BlockType;
  sourceLineStart: number; // body-relative, 0-based
  sourceLineEnd: number;
  bodySpanFrom: number; // body-relative char offset (leading space included)
  bodySpanTo: number;
  fragment: string | null; // well-formed → fragment text; else null
  malformed: boolean;
}

function tokenBlockType(token: RawToken): BlockType {
  const t = token.type as string;
  if (t === "mdContainer") {
    return `mdContainer:${(token.name as string) ?? "unknown"}`;
  }
  return t as BlockType;
}

function countLines(str: string): number {
  let n = 1;
  for (let i = 0; i < str.length; i++) if (str[i] === "\n") n++;
  return n;
}

export function buildBlockEntries(
  body: string,
  opts: BuildOptions,
): { blockEntries: BlockEntry[]; styleErrors: StyleError[]; cleanedBody: string } {
  // Pass 1 — probe. Walk top-level tokens, record per-stylable-block directive
  // info without touching token internals.
  const pass1 = opts.lex(body);
  const probes: ProbeRecord[] = [];
  let offset = 0;
  for (const token of pass1) {
    const raw = (token.raw as string) ?? "";
    const tokenFrom = offset;
    offset += raw.length;
    if (!isStylableToken(token)) continue;

    const lineStart = countLines(body.slice(0, tokenFrom)) - 1;
    const firstNewline = raw.indexOf("\n");
    const firstLine = firstNewline >= 0 ? raw.slice(0, firstNewline) : raw;
    const tokenLineCount = countLines(raw) - (raw.endsWith("\n") ? 1 : 0);
    const lineEnd = lineStart + Math.max(0, tokenLineCount - 1);

    const match = extractDirective(firstLine);
    if (match.kind === "none") {
      probes.push({
        blockType: tokenBlockType(token),
        sourceLineStart: lineStart,
        sourceLineEnd: lineEnd,
        bodySpanFrom: 0,
        bodySpanTo: 0,
        fragment: null,
        malformed: false,
      });
      continue;
    }

    probes.push({
      blockType: tokenBlockType(token),
      sourceLineStart: lineStart,
      sourceLineEnd: lineEnd,
      bodySpanFrom: tokenFrom + match.spanStart,
      bodySpanTo: tokenFrom + match.spanEnd,
      fragment: match.kind === "wellFormed" ? match.fragment : null,
      malformed: match.kind === "malformed",
    });
  }

  // Build cleanedBody by stripping WELL-FORMED directive spans (reverse order
  // so earlier offsets stay valid). Malformed directives are left in source
  // per the spec so the user sees their broken text.
  const stripSpans = probes
    .filter((p) => p.fragment !== null)
    .map((p) => ({ from: p.bodySpanFrom, to: p.bodySpanTo }))
    .sort((a, b) => b.from - a.from);

  let cleanedBody = body;
  for (const s of stripSpans) {
    cleanedBody = cleanedBody.slice(0, s.from) + cleanedBody.slice(s.to);
  }

  const blockEntries: BlockEntry[] = [];
  const styleErrors: StyleError[] = [];

  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    const blockId = `b${i}`;
    let styleValues: StyleValues = {};
    const errors: StyleError[] = [];
    let styleDirectiveRange: BlockEntry["styleDirectiveRange"] = null;

    if (p.fragment !== null) {
      const parsed = parseDirectiveFragment(p.fragment);
      styleValues = parsed.values;
      styleDirectiveRange = {
        from: opts.frontmatterCharOffset + p.bodySpanFrom,
        to: opts.frontmatterCharOffset + p.bodySpanTo,
      };
      for (const e of parsed.errors) {
        errors.push({
          code: e.code,
          line: opts.frontmatterLineOffset + p.sourceLineStart,
          styleDirectiveRange,
          blockId,
          message: `${e.code}: ${e.token}`,
        });
      }
    }

    blockEntries.push({
      blockId,
      blockType: p.blockType,
      sourceLineStart: opts.frontmatterLineOffset + p.sourceLineStart,
      sourceLineEnd: opts.frontmatterLineOffset + p.sourceLineEnd,
      styleDirectiveRange,
      styleValues,
      errors,
      parentBlockId: null,
    });
  }

  return { blockEntries, styleErrors, cleanedBody };
}
