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
  // Pre-declare the orphan accumulator so both pass 1 (whitespace-only probe
  // skip) and the post-pass scan can contribute.
  const styleErrors: StyleError[] = [];

  const emitOrphan = (
    sourceLineStart: number,
    bodyFrom: number,
    bodyTo: number,
  ): void => {
    styleErrors.push({
      code: "orphan-directive",
      line: opts.frontmatterLineOffset + sourceLineStart,
      styleDirectiveRange: {
        from: opts.frontmatterCharOffset + bodyFrom,
        to: opts.frontmatterCharOffset + bodyTo,
      },
      blockId: null,
      message: "Directive is not attached to any stylable block.",
    });
  };

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
    const lineStart = countLines(body.slice(0, tokenFrom)) - 1;
    const firstNewline = raw.indexOf("\n");
    const firstLine = firstNewline >= 0 ? raw.slice(0, firstNewline) : raw;

    const match = extractDirective(firstLine);
    if (match.kind === "none") continue;

    // If the line's non-directive prefix is whitespace-only, the directive is
    // the entire content of the block — stripping would make the block vanish.
    // Record it as orphan (don't strip, don't attach to a block).
    const prefix = firstLine.slice(0, match.spanStart);
    if (/^\s*$/.test(prefix) && match.kind === "wellFormed") {
      emitOrphan(
        lineStart,
        tokenFrom + match.spanStart,
        tokenFrom + match.spanEnd,
      );
      continue;
    }
    // Malformed fragments with whitespace-only prefix are also orphans —
    // but malformed-directive error needs to attach to a block; for now skip.
    if (/^\s*$/.test(prefix)) continue;

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

    if (probe?.malformed) {
      styleDirectiveRange = {
        from: opts.frontmatterCharOffset + probe.bodySpanFrom,
        to: opts.frontmatterCharOffset + probe.bodySpanTo,
      };
      errors.push({
        code: "malformed-directive",
        line: opts.frontmatterLineOffset + probe.sourceLineStart,
        styleDirectiveRange,
        blockId,
        message: "Directive is not closed properly (missing `}`).",
      });
    } else if (probe?.fragment != null) {
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

  // Orphan scan — lines outside every stylable pass-2 block that still hold a
  // STRICT match. These are directive-like lines that will never attach to
  // any BlockEntry (directive inside an html block, trailing blank line, etc).
  // CANDIDATE-only matches on non-block-start lines are ignored (noisy).
  const claimedLines = new Set<number>();
  for (const entry of blockEntries) {
    // Claim every line of every stylable top-level block in the ORIGINAL body
    // so orphan scan only looks at gaps. Pass-2 line numbers align with body
    // line numbers when offset by the well-formed strips... but strips never
    // remove newlines, so they align exactly.
    const start = entry.sourceLineStart - opts.frontmatterLineOffset;
    const end = entry.sourceLineEnd - opts.frontmatterLineOffset;
    for (let l = start; l <= end; l++) claimedLines.add(l);
  }
  // Also claim every line of non-stylable pass-1 tokens (html, space) so
  // content inside those isn't flagged.
  {
    let scan = 0;
    for (const token of pass1) {
      const raw = (token.raw as string) ?? "";
      const tokenStartLine = countLines(body.slice(0, scan)) - 1;
      const tokenLineCount = countLines(raw) - (raw.endsWith("\n") ? 1 : 0);
      if (!isStylableToken(token)) {
        for (let l = tokenStartLine; l < tokenStartLine + tokenLineCount; l++) {
          claimedLines.add(l);
        }
      }
      scan += raw.length;
    }
  }

  const bodyLines = body.split("\n");
  let bodyLineOffset = 0;
  const alreadyEmitted = new Set(styleErrors.map((e) => e.line));
  for (let li = 0; li < bodyLines.length; li++) {
    const lineText = bodyLines[li];
    const lineStartOffset = bodyLineOffset;
    bodyLineOffset += lineText.length + 1; // +1 for '\n'
    if (claimedLines.has(li)) continue;
    if (alreadyEmitted.has(opts.frontmatterLineOffset + li)) continue;
    const m = extractDirective(lineText);
    if (m.kind !== "wellFormed") continue;
    emitOrphan(
      li,
      lineStartOffset + m.spanStart,
      lineStartOffset + m.spanEnd,
    );
  }

  return { blockEntries, styleErrors, cleanedBody };
}
