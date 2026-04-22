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
  sourceLineStart: number; // body-relative, 0-based — the block-start line in the ORIGINAL body
  cleanedLineStart: number; // body-relative line after strip (well-formed only)
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
  // Pass 1 — probe. Walk top-level tokens and record directive spans.
  // We don't trust pass 1's blockType: stripping the directive can change
  // how marked tokenizes the line (e.g. `--- {:style mt=3}` is a paragraph
  // before strip but an hr after). We use pass 2 for final blockType.
  const pass1 = opts.lex(body);
  const probes: ProbeRecord[] = [];
  let offset = 0;
  for (const token of pass1) {
    const raw = (token.raw as string) ?? "";
    const tokenFrom = offset;
    offset += raw.length;
    // Scan every top-level token's first line — both stylable and not —
    // because stripping can promote a paragraph to hr/code/heading in pass 2.
    // Non-stylable spans (html, blank space) are checked too; the first-line
    // regex rarely matches on those and any false positives become orphans.
    const lineStart = countLines(body.slice(0, tokenFrom)) - 1;
    const firstNewline = raw.indexOf("\n");
    const firstLine = firstNewline >= 0 ? raw.slice(0, firstNewline) : raw;

    const match = extractDirective(firstLine);
    if (match.kind === "none") continue;

    probes.push({
      sourceLineStart: lineStart,
      cleanedLineStart: lineStart, // strips never remove newlines, so lines align
      bodySpanFrom: tokenFrom + match.spanStart,
      bodySpanTo: tokenFrom + match.spanEnd,
      fragment: match.kind === "wellFormed" ? match.fragment : null,
      malformed: match.kind === "malformed",
    });
  }

  // Build cleanedBody by stripping WELL-FORMED directive spans in reverse
  // offset order so earlier offsets stay valid. Malformed directives stay in
  // source per the spec so the user sees their broken text.
  const stripSpans = probes
    .filter((p) => p.fragment !== null)
    .map((p) => ({ from: p.bodySpanFrom, to: p.bodySpanTo }))
    .sort((a, b) => b.from - a.from);

  let cleanedBody = body;
  for (const s of stripSpans) {
    cleanedBody = cleanedBody.slice(0, s.from) + cleanedBody.slice(s.to);
  }

  // Pass 2 — final tokens, rendered from cleaned source. blockType comes
  // from here.
  const pass2 = opts.lex(cleanedBody);
  const probeByLine = new Map(
    probes.map((p) => [p.cleanedLineStart, p] as const),
  );

  const blockEntries: BlockEntry[] = [];
  const styleErrors: StyleError[] = [];
  let blockIndex = 0;
  let offset2 = 0;
  for (const token of pass2) {
    const raw = (token.raw as string) ?? "";
    const tokenFrom = offset2;
    offset2 += raw.length;
    if (!isStylableToken(token)) continue;

    const lineStart = countLines(cleanedBody.slice(0, tokenFrom)) - 1;
    const tokenLineCount = countLines(raw) - (raw.endsWith("\n") ? 1 : 0);
    const lineEnd = lineStart + Math.max(0, tokenLineCount - 1);
    const probe = probeByLine.get(lineStart) ?? null;

    const blockId = `b${blockIndex++}`;
    let styleValues: StyleValues = {};
    const errors: StyleError[] = [];
    let styleDirectiveRange: BlockEntry["styleDirectiveRange"] = null;

    if (probe?.fragment != null) {
      const parsed = parseDirectiveFragment(probe.fragment);
      styleValues = parsed.values;
      styleDirectiveRange = {
        from: opts.frontmatterCharOffset + probe.bodySpanFrom,
        to: opts.frontmatterCharOffset + probe.bodySpanTo,
      };
      for (const e of parsed.errors) {
        errors.push({
          code: e.code,
          line: opts.frontmatterLineOffset + probe.sourceLineStart,
          styleDirectiveRange,
          blockId,
          message: `${e.code}: ${e.token}`,
        });
      }
    }

    blockEntries.push({
      blockId,
      blockType: tokenBlockType(token),
      sourceLineStart: opts.frontmatterLineOffset + lineStart,
      sourceLineEnd: opts.frontmatterLineOffset + lineEnd,
      styleDirectiveRange,
      styleValues,
      errors,
      parentBlockId: null,
    });
  }

  return { blockEntries, styleErrors, cleanedBody };
}
