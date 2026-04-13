// section-pipeline.js — Markdown→HTML pipeline for section tabs.
// Configures marked once at load time; sets per-render context before each parse.
// Used by render-scheduler.js (preview) and pdf-export-service.js (export).

import { parseFrontmatter, escapeHtml } from "../../infrastructure/text-utils.js";
import {
  COLOR_PAIRS, detectPartieNum, getColorIndex, wrapSection,
  stripLeadingNumber, slugify, decodeEntities, buildUnderline,
} from "./markdown-helpers.js";
import { resetMermaidQueue, pushToMermaidQueue, getMermaidQueue, resolveMermaid } from "./mermaid-renderer.js";
// ── Per-render context (set before each parse, read by renderer) ───────────
// This is module-scoped, not global — only section-pipeline.js reads/writes it.
// Safe because renders are awaited sequentially (never concurrent).

let _ctx: Record<string, any> | null = null;

const PAGE_BREAK_TEXT_RE: RegExp = /\n[ \t]*(?:\\newpage|\/newpage)[ \t]*$/;
const PAGE_BREAK_RAW_RE: RegExp = /\n\n?[ \t]*(?:\\newpage|\/newpage)[ \t]*$/;
const STANDALONE_PAGE_BREAK_RE: RegExp = /^[ \t]*(?:\\newpage|\/newpage)[ \t]*$/;
const IMAGE_ALIGNMENT_VALUES: Set<string> = new Set(["left", "center", "right"]);
const IMAGE_MAX_WIDTH_RE: RegExp = /^\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|cm|mm|in|pt|pc|ch|ex)$/i;

function getLineStarts(source = ""): number[] {
  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") lineStarts.push(index + 1);
  }
  return lineStarts;
}

function isStandalonePageBreak(value = ""): boolean {
  return STANDALONE_PAGE_BREAK_RE.test(String(value || "").trim());
}

function getTableText(token: MarkedToken): string {
  const rows = [
    (token.header || []).map((cell: MarkedToken) => cell.text || "").join(" "),
    ...((token.rows || []).map((row: MarkedToken[]) => row.map((cell: MarkedToken) => cell.text || "").join(" "))),
  ];
  return rows.join("\n");
}

function getListText(token: MarkedToken): string {
  return (token.items || []).map((item: MarkedToken) => item.text || "").join("\n");
}

function buildSourceBlocks(tokens: MarkedToken[]): Array<{ start: number; end: number; kind: string; text: string }> {
  const blocks = [];
  let offset = 0;

  for (const token of tokens) {
    const start = offset;
    const end = start + (token.raw?.length ?? 0);

    switch (token.type) {
      case "blockquote":
        blocks.push({ start, end, kind: "blockquote", text: token.text || "" });
        break;
      case "code":
        blocks.push({ start, end, kind: "code", text: token.text || "" });
        break;
      case "heading":
        blocks.push({ start, end, kind: "heading", text: token.text || "" });
        break;
      case "hr":
        blocks.push({ start, end, kind: "hr", text: "" });
        break;
      case "list":
        blocks.push({ start, end, kind: "list", text: getListText(token) });
        break;
      case "paragraph":
      case "text":
        blocks.push({
          start,
          end,
          kind: isStandalonePageBreak(token.text || "") ? "pageBreak" : "paragraph",
          text: token.text || "",
        });
        break;
      case "table":
        blocks.push({ start, end, kind: "table", text: getTableText(token) });
        break;
      default:
        break;
    }

    offset = end;
  }

  return blocks;
}

function stripTrailingPageBreakText(value = ""): string {
  return value.replace(PAGE_BREAK_TEXT_RE, "");
}

function stripTrailingPageBreakRaw(value = ""): string {
  return value.replace(PAGE_BREAK_RAW_RE, "");
}

function isAbsoluteUrl(value = ""): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//");
}

function resolveAssetUrl(href = ""): string {
  if (!href) return href;
  if (href.startsWith("#") || isAbsoluteUrl(href)) return href;
  if (!_ctx?.assetBaseHref) return href;

  try {
    return new URL(href, _ctx.assetBaseHref).href;
  } catch {
    return href;
  }
}

function parseImageOptions(rawHref = ""): { href: string; align: string | null; maxWidth: string | null } {
  const href = String(rawHref || "");
  if (!href.includes("|")) {
    return { href, align: null, maxWidth: null };
  }

  const parts = href.split("|").map((part) => part.trim());
  const baseHref = parts.shift() || "";

  if (!baseHref) {
    return { href, align: null, maxWidth: null };
  }

  let align = null;
  let maxWidth = null;
  let hasDirective = false;

  for (const part of parts) {
    if (!part) continue;

    const lower = part.toLowerCase();
    if (!align && IMAGE_ALIGNMENT_VALUES.has(lower)) {
      align = lower;
      hasDirective = true;
      continue;
    }
    if (!maxWidth && IMAGE_MAX_WIDTH_RE.test(part)) {
      maxWidth = part;
      hasDirective = true;
      continue;
    }

    return { href, align: null, maxWidth: null };
  }

  if (!hasDirective) {
    return { href, align: null, maxWidth: null };
  }

  return { href: baseHref, align, maxWidth };
}

function renderImageTag(parser: { parseInline: (tokens: MarkedToken[], renderer?: unknown) => string; textRenderer?: unknown }, token: MarkedToken): { html: string; text: string; align: string | null } {
  const text = token.tokens
    ? parser.parseInline(token.tokens, parser.textRenderer)
    : token.text || "";
  const options = parseImageOptions((token.href as string) || "");
  const href = resolveAssetUrl(options.href);
  let html = `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"`;
  if (token.title) html += ` title="${escapeHtml(token.title as string)}"`;
  if (options.maxWidth) html += ` style="max-width:min(100%, ${options.maxWidth})"`;
  html += ">";
  return { html, text, align: options.align };
}

function pruneEmptyTrailingTokens(tokens: MarkedToken[]): void {
  while (tokens.length) {
    const last = tokens[tokens.length - 1];
    const emptyText = typeof last.text === "string" && last.text.length === 0;
    const emptyRaw = typeof last.raw === "string" && last.raw.length === 0;
    const emptyChildren = Array.isArray(last.tokens) && last.tokens.length === 0;
    if (!emptyText && !emptyRaw && !emptyChildren) break;
    tokens.pop();
  }
}

function stripTrailingPageBreakFromToken(token: MarkedToken): void {
  if (!token) return;
  if (typeof token.raw === "string") token.raw = stripTrailingPageBreakRaw(token.raw);
  if (typeof token.text === "string") token.text = stripTrailingPageBreakText(token.text);
  if (Array.isArray(token.tokens) && token.tokens.length) {
    stripTrailingPageBreakFromToken(token.tokens[token.tokens.length - 1]);
    pruneEmptyTrailingTokens(token.tokens);
  }
}

function extractTrailingListPageBreak(listToken: MarkedToken): number | null {
  const lastItem = listToken.items?.[listToken.items.length - 1];
  if (!lastItem || !PAGE_BREAK_TEXT_RE.test(lastItem.text || "")) return null;

  let sourceLine = null;
  if (typeof listToken._sourceLine === "number" && typeof listToken.raw === "string") {
    const rawBeforeBreak = stripTrailingPageBreakRaw(listToken.raw);
    sourceLine = listToken._sourceLine + (rawBeforeBreak.split("\n").length - 1);
  }

  lastItem.text = stripTrailingPageBreakText(lastItem.text);
  if (typeof lastItem.raw === "string") lastItem.raw = stripTrailingPageBreakRaw(lastItem.raw);
  if (Array.isArray(lastItem.tokens) && lastItem.tokens.length) {
    stripTrailingPageBreakFromToken(lastItem.tokens[lastItem.tokens.length - 1]);
    pruneEmptyTrailingTokens(lastItem.tokens);
  }
  if (typeof listToken.raw === "string") listToken.raw = stripTrailingPageBreakRaw(listToken.raw);

  return sourceLine;
}

// ── Configure marked once at module load ───────────────────────────────────

marked.use({
  renderer: {
    heading(this: any, token): string {
      const ctx = _ctx;
      if (!ctx) return "";
      const { tokens, depth } = token;
      const sl = token._sourceLine != null
        ? ` data-source-line="${token._sourceLine}"` : "";
      const text = this.parser.parseInline(tokens);
      const pair = COLOR_PAIRS[ctx.colorIdx % COLOR_PAIRS.length];
      const [primary] = pair;
      const vars = `--section-color:${primary};--section-color-light:${pair[1]}`;

      const plainText = text.replace(/<[^>]+>/g, "");
      const hid = `h-${ctx.headingIdCounter++}-${slugify(plainText)}`;
      const idAttr = ` id="${hid}"`;

      if ((depth ?? 5) >= 5)
        return `<h${depth}${idAttr}${sl} style="color:${primary};${vars}">${text}</h${depth}>\n`;

      if (depth === 1) {
        const clean = stripLeadingNumber(text);
        const stripped = clean.replace(/^Partie\s+\d+\s*[—●\-]\s*/i, "");
        const disc = '<span class="beorn-disc">&#x25CF;</span>';
        const title = ctx.partieNum
          ? `Partie ${ctx.partieNum} ${disc} ${stripped}`
          : clean;
        if (ctx.headingCollector) {
          const tocTitle = decodeEntities((stripped || clean).replace(/<[^>]+>/g, ""));
          ctx.headingCollector.push({
            depth: 1, id: hid, title: tocTitle,
            num: ctx.partieNum || null, colorPair: pair,
          });
        }
        return `<h1${idAttr}${sl} data-color-index="${ctx.colorIdx % 5}" style="color:${primary};${vars}">${title}${buildUnderline(pair as [string, string])}</h1>\n`;
      }

      if (depth === 2) { ctx.h2Count++; ctx.h3Count = 0; }
      else if (depth === 3) { ctx.h3Count++; }

      const clean = stripLeadingNumber(text);

      if (!ctx.partieNum) {
        return `<h${depth}${idAttr}${sl} style="color:${primary};${vars}">${clean}</h${depth}>\n`;
      }

      const num = depth === 2
        ? `${ctx.partieNum}.${ctx.h2Count}`
        : `${ctx.partieNum}.${ctx.h2Count}.${ctx.h3Count}`;
      const disc = '<span class="beorn-disc">&#x25CF;</span>';

      if (depth === 2) {
        return `<h2${idAttr}${sl} style="color:${primary};${vars}"><span class="beorn-num" style="background:${primary};color:#fff">${escapeHtml(num)}</span><span class="beorn-text">${clean}</span></h2>\n`;
      }
      if (depth === 3) {
        return `<h3${idAttr}${sl} style="color:${primary};padding:0.3rem 0.7rem;border-radius:4px;background:color-mix(in srgb, ${primary} 6%, transparent);width:fit-content;max-width:100%;${vars}"><span class="beorn-num" style="color:${primary}">${escapeHtml(num)}</span> ${disc} ${clean}</h3>\n`;
      }
      return `<h${depth}${idAttr}${sl} style="color:${primary};${vars}">${clean}</h${depth}>\n`;
    },

    paragraph(this: any, token): string {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      const standaloneImage = token.tokens?.length === 1 && token.tokens[0]?.type === "image"
        ? token.tokens[0]
        : null;
      if (standaloneImage) {
        const image = renderImageTag(this.parser, standaloneImage);
        const caption = image.text
          ? `\n<figcaption>${escapeHtml(image.text)}</figcaption>`
          : "";
        const alignClass = image.align ? ` md-image-align-${image.align}` : "";
        return `<figure class="md-image${alignClass}"${sl}>${image.html}${caption}\n</figure>\n`;
      }
      const text = this.parser.parseInline(token.tokens);
      const stripped = text.replace(/<[^>]*>/g, "").trim();
      if (stripped === "\\newpage" || stripped === "/newpage") {
        return `<div class="page-break"${sl}></div>\n`;
      }
      return `<p${sl}>${text}</p>\n`;
    },

    blockquote(this: any, token): string {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      const body = this.parser.parse(token.tokens);
      return `<blockquote${sl}>\n${body}</blockquote>\n`;
    },

    list(this: any, token): string {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      const tag = token.ordered ? "ol" : "ul";
      const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
      const trailingPageBreakLine = extractTrailingListPageBreak(token);
      let body = "";
      for (const item of (token.items ?? [])) body += this.listitem(item);
      const pbSl = trailingPageBreakLine != null
        ? ` data-source-line="${trailingPageBreakLine}"`
        : "";
      const pageBreakHtml = trailingPageBreakLine != null
        ? `<div class="page-break"${pbSl}></div>\n`
        : "";
      return `<${tag}${startAttr}${sl}>\n${body}</${tag}>\n${pageBreakHtml}`;
    },

    table(this: any, token): string {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      let header = "";
      for (const cell of (token.header ?? [])) {
        const align = cell.align ? ` align="${cell.align}"` : "";
        header += `<th${align}>${this.parser.parseInline(cell.tokens)}</th>\n`;
      }
      header = `<tr>\n${header}</tr>\n`;
      let body = "";
      for (const row of (token.rows ?? [])) {
        let rowContent = "";
        for (const cell of row) {
          const align = cell.align ? ` align="${cell.align}"` : "";
          rowContent += `<td${align}>${this.parser.parseInline(cell.tokens)}</td>\n`;
        }
        body += `<tr>\n${rowContent}</tr>\n`;
      }
      return `<table${sl}>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
    },

    hr(token): string {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      return `<hr${sl} />\n`;
    },

    code(token): string {
      const { text, lang } = token;
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      if (lang === "mermaid") {
        const idx = pushToMermaidQueue(text || "");
        return `<div class="mermaid-diagram"${sl} data-mermaid-idx="${idx}"></div>\n`;
      }
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre${sl}><code${langClass}>${escapeHtml(text || "")}</code></pre>\n`;
    },

    image(this: any, token): string {
      return renderImageTag(this.parser, token).html;
    },
  },

  hooks: {
    postprocess(html: string): string {
      return html
        .replace(/(\w) :/g, "$1\u00a0:")
        .replace(/(\w) ;/g, "$1\u00a0;")
        .replace(/(\w) !/g, "$1\u00a0!")
        .replace(/(\w) \?/g, "$1\u00a0?");
    },
  },
});

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render markdown to a full paged HTML document.
 * @param {string} md - Raw markdown (with frontmatter)
 * @param {object} options
 * @param {string} options.fileName - Active file name (for partie detection)
 * @param {string} [options.assetBaseHref] - Base URL used by relative asset links
 * @param {number} [options.startLine=0] - Line offset for source-line tracking
 * @param {Array} [options.headingCollector] - Array to push heading data into (for TOC)
 * @param {number} [options.headingIdOffset=0] - Starting heading ID counter
 * @param {string} [options.headerText="Document — Memoire technique"] - Running header text
 * @param {string} [options.language="fr"] - Output language
 */
export async function renderMarkdown(md: string, options: Record<string, any> = {}): Promise<{ sectionHtml: string; headerText: string; language: string; headingIdCounter: number; lineNumberOffset: number; lineStarts: number[]; sourceBlocks: Array<{ start: number; end: number; kind: string; text: string }> }> {
  const {
    assetBaseHref = "",
    fileName = "",
    startLine = 0,
    headingCollector = null,
    headingIdOffset = 0,
    headerText = "Document — Memoire technique",
    language = "fr",
  } = options;

  const { body } = parseFrontmatter(md);
  const lineStarts = getLineStarts(body);

  const partieNum = detectPartieNum(body, fileName);
  const colorIdx = getColorIndex(partieNum);

  // Set per-render context (read by the renderer registered above)
  _ctx = {
    assetBaseHref,
    colorIdx,
    partieNum,
    h2Count: 0,
    h3Count: 0,
    headingCollector,
    headingIdCounter: headingIdOffset,
  };

  resetMermaidQueue();

  // Tokenize and add source-line info
  const tokens = marked.lexer(body);
  const sourceBlocks = buildSourceBlocks(tokens);
  if (startLine > 0) {
    let cursor = 0;
    for (const token of tokens) {
      const idx = body.indexOf(token.raw, cursor);
      if (idx >= 0) {
        const lineInSection = body.substring(0, idx).split("\n").length - 1;
        token._sourceLine = startLine + lineInSection;
        cursor = idx + token.raw.length;
      }
    }
  }

  let html = marked.parser(tokens).replace(/\{src:[^}]+\}/g, "");

  // Capture heading counter immediately after sync parse (before any await)
  const headingIdCounter = _ctx.headingIdCounter;

  const queue = getMermaidQueue();
  html = await resolveMermaid(html, queue);

  const sectionHtml = wrapSection(html, colorIdx);

  return {
    sectionHtml,
    headerText,
    language,
    headingIdCounter,
    lineNumberOffset: startLine,
    lineStarts,
    sourceBlocks,
  };
}
