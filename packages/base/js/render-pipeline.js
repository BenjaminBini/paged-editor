// render-pipeline.js — Unified markdown→HTML pipeline.
// Configures marked once at load time; sets per-render context before each parse.
// Used by both render.js (preview) and pdf-export.js (export).

import { parseFrontmatter } from "./utils.js";
import {
  COLOR_PAIRS, detectPartieNum, getColorIndex, wrapSection,
  stripLeadingNumber, slugify, decodeEntities, buildUnderline,
} from "./markdown-helpers.js";
import { escapeHtml } from "./utils.js";
import { resetMermaidQueue, pushToMermaidQueue, getMermaidQueue, resolveMermaid } from "./mermaid-render.js";
import { buildHeaderText, wrapInDocument } from "./document.js";

// ── Per-render context (set before each parse, read by renderer) ───────────
// This is module-scoped, not global — only render-pipeline.js reads/writes it.
// Safe because renders are awaited sequentially (never concurrent).

let _ctx = null;

const PAGE_BREAK_TEXT_RE = /\n[ \t]*(?:\\newpage|\/newpage)[ \t]*$/;
const PAGE_BREAK_RAW_RE = /\n\n?[ \t]*(?:\\newpage|\/newpage)[ \t]*$/;

function stripTrailingPageBreakText(value = "") {
  return value.replace(PAGE_BREAK_TEXT_RE, "");
}

function stripTrailingPageBreakRaw(value = "") {
  return value.replace(PAGE_BREAK_RAW_RE, "");
}

function isAbsoluteUrl(value = "") {
  return /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//");
}

function resolveAssetUrl(href = "") {
  if (!href) return href;
  if (href.startsWith("#") || isAbsoluteUrl(href)) return href;
  if (!_ctx?.assetBaseHref) return href;

  try {
    return new URL(href, _ctx.assetBaseHref).href;
  } catch {
    return href;
  }
}

function pruneEmptyTrailingTokens(tokens) {
  while (tokens.length) {
    const last = tokens[tokens.length - 1];
    const emptyText = typeof last.text === "string" && last.text.length === 0;
    const emptyRaw = typeof last.raw === "string" && last.raw.length === 0;
    const emptyChildren = Array.isArray(last.tokens) && last.tokens.length === 0;
    if (!emptyText && !emptyRaw && !emptyChildren) break;
    tokens.pop();
  }
}

function stripTrailingPageBreakFromToken(token) {
  if (!token) return;
  if (typeof token.raw === "string") token.raw = stripTrailingPageBreakRaw(token.raw);
  if (typeof token.text === "string") token.text = stripTrailingPageBreakText(token.text);
  if (Array.isArray(token.tokens) && token.tokens.length) {
    stripTrailingPageBreakFromToken(token.tokens[token.tokens.length - 1]);
    pruneEmptyTrailingTokens(token.tokens);
  }
}

function extractTrailingListPageBreak(listToken) {
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
    heading(token) {
      const ctx = _ctx;
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

      if (depth >= 5)
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
        return `<h1${idAttr}${sl} data-color-index="${ctx.colorIdx % 5}" style="color:${primary};${vars}">${title}${buildUnderline(pair)}</h1>\n`;
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

    paragraph(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      const text = this.parser.parseInline(token.tokens);
      const stripped = text.replace(/<[^>]*>/g, "").trim();
      if (stripped === "\\newpage" || stripped === "/newpage") {
        return `<div class="page-break"${sl}></div>\n`;
      }
      return `<p${sl}>${text}</p>\n`;
    },

    blockquote(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      const body = this.parser.parse(token.tokens);
      return `<blockquote${sl}>\n${body}</blockquote>\n`;
    },

    list(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      const tag = token.ordered ? "ol" : "ul";
      const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
      const trailingPageBreakLine = extractTrailingListPageBreak(token);
      let body = "";
      for (const item of token.items) body += this.listitem(item);
      const pbSl = trailingPageBreakLine != null
        ? ` data-source-line="${trailingPageBreakLine}"`
        : "";
      const pageBreakHtml = trailingPageBreakLine != null
        ? `<div class="page-break"${pbSl}></div>\n`
        : "";
      return `<${tag}${startAttr}${sl}>\n${body}</${tag}>\n${pageBreakHtml}`;
    },

    table(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      let header = "";
      for (const cell of token.header) {
        const align = cell.align ? ` align="${cell.align}"` : "";
        header += `<th${align}>${this.parser.parseInline(cell.tokens)}</th>\n`;
      }
      header = `<tr>\n${header}</tr>\n`;
      let body = "";
      for (const row of token.rows) {
        let rowContent = "";
        for (const cell of row) {
          const align = cell.align ? ` align="${cell.align}"` : "";
          rowContent += `<td${align}>${this.parser.parseInline(cell.tokens)}</td>\n`;
        }
        body += `<tr>\n${rowContent}</tr>\n`;
      }
      return `<table${sl}>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
    },

    hr(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      return `<hr${sl} />\n`;
    },

    code(token) {
      const { text, lang } = token;
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : "";
      if (lang === "mermaid") {
        const idx = pushToMermaidQueue(text);
        return `<div class="mermaid-diagram"${sl} data-mermaid-idx="${idx}"></div>\n`;
      }
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre${sl}><code${langClass}>${escapeHtml(text)}</code></pre>\n`;
    },

    image(token) {
      const text = token.tokens
        ? this.parser.parseInline(token.tokens, this.parser.textRenderer)
        : token.text || "";
      const href = resolveAssetUrl(token.href || "");
      let html = `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"`;
      if (token.title) html += ` title="${escapeHtml(token.title)}"`;
      html += ">";
      return html;
    },
  },

  hooks: {
    postprocess(html) {
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
 * @param {number} [options.gen=0] - Generation counter for iframe swap
 * @param {Array} [options.headingCollector] - Array to push heading data into (for TOC)
 * @param {number} [options.headingIdOffset=0] - Starting heading ID counter
 */
export async function renderMarkdown(md, options = {}) {
  const {
    assetBaseHref = "",
    fileName = "",
    startLine = 0,
    gen = 0,
    headingCollector = null,
    headingIdOffset = 0,
  } = options;

  const { fm, body } = parseFrontmatter(md);
  const headerText = buildHeaderText(fm);
  const language = fm.language || "fr";

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
    documentHtml: wrapInDocument(sectionHtml, { assetBaseHref, gen, headerText, language }),
    frontmatter: fm,
    headerText,
    language,
    headingIdCounter,
  };
}
