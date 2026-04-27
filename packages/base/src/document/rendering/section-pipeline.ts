// section-pipeline.js — Markdown→HTML pipeline for section tabs.
// Configures marked once at load time; sets per-render context before each parse.
// Used by render-scheduler.js (preview) and pdf-export-service.js (export).

import {
  parseFrontmatter,
  escapeHtml,
} from "../../infrastructure/text-utils.js";
import {
  buildBlockEntries,
  type BlockEntry,
  type StyleError,
} from "./block-model.js";
import { renderStyleAttr, type StyleValues } from "./style-directive.js";
import {
  COLOR_PAIRS,
  detectPartieNum,
  getColorIndex,
  wrapSection,
  stripLeadingNumber,
  slugify,
  decodeEntities,
  buildUnderline,
} from "./markdown-helpers.js";
import {
  resetMermaidQueue,
  pushToMermaidQueue,
  getMermaidQueue,
  resolveMermaid,
} from "./mermaid-renderer.js";
import { MD_ALERT_KINDS, MD_KNOWN_CONTAINERS } from "./container-registry.js";
// ── Per-render context (set before each parse, read by renderer) ───────────
// This is module-scoped, not global — only section-pipeline.js reads/writes it.
// Safe because renders are awaited sequentially (never concurrent).

let _ctx: Record<string, any> | null = null;

const PAGE_BREAK_TEXT_RE: RegExp = /\n[ \t]*:::newpage[ \t]*$/;
const PAGE_BREAK_RAW_RE: RegExp = /\n\n?[ \t]*:::newpage[ \t]*$/;
const STANDALONE_PAGE_BREAK_RE: RegExp = /^[ \t]*:::newpage[ \t]*$/;
const AO_GRID_COL_HEADER_RE: RegExp =
  /^:::col(?:-(\d+))?(?![a-z0-9-])[ \t]*\r?\n?/gm;
// Generic `:::name [attrs]\n…body…\n:::` container — depth-tracked tokenizer
// inside `marked.use({ extensions })` below. Inner directives (col-N, card,
// feature, step) reuse the `:::name` syntax but carry trailing text and do
// not open a depth level.
const MD_CONTAINER_START_RE: RegExp = /(?:^|\n):::[a-z]/;
// MD_ALERT_KINDS and MD_KNOWN_CONTAINERS are derived from container-registry.ts.
const MD_STEP_HEADER_RE: RegExp = /^:::step[ \t]+([^\n]+)\r?\n/gm;
const MD_ATTR_RE: RegExp = /(\w+)="([^"]*)"/g;
const IMAGE_ALIGNMENT_VALUES: Set<string> = new Set([
  "left",
  "center",
  "right",
]);
const IMAGE_MAX_WIDTH_RE: RegExp =
  /^\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|cm|mm|in|pt|pc|ch|ex)$/i;

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
    ...(token.rows || []).map((row: MarkedToken[]) =>
      row.map((cell: MarkedToken) => cell.text || "").join(" "),
    ),
  ];
  return rows.join("\n");
}

function getListText(token: MarkedToken): string {
  return (token.items || [])
    .map((item: MarkedToken) => item.text || "")
    .join("\n");
}

function buildSourceBlocks(
  tokens: MarkedToken[],
): Array<{ start: number; end: number; kind: string; text: string }> {
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
          kind: isStandalonePageBreak(token.text || "")
            ? "pageBreak"
            : "paragraph",
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

function parseImageOptions(rawHref = ""): {
  href: string;
  align: string | null;
  maxWidth: string | null;
} {
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

function renderImageTag(
  parser: {
    parseInline: (tokens: MarkedToken[], renderer?: unknown) => string;
    textRenderer?: unknown;
  },
  token: MarkedToken,
): { html: string; text: string; align: string | null } {
  const text = token.tokens
    ? parser.parseInline(token.tokens, parser.textRenderer)
    : token.text || "";
  const options = parseImageOptions((token.href as string) || "");
  const href = resolveAssetUrl(options.href);
  let html = `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"`;
  if (token.title) html += ` title="${escapeHtml(token.title as string)}"`;
  if (options.maxWidth)
    html += ` style="max-width:min(100%, ${options.maxWidth})"`;
  html += ">";
  return { html, text, align: options.align };
}

function pruneEmptyTrailingTokens(tokens: MarkedToken[]): void {
  while (tokens.length) {
    const last = tokens[tokens.length - 1];
    const emptyText = typeof last.text === "string" && last.text.length === 0;
    const emptyRaw = typeof last.raw === "string" && last.raw.length === 0;
    const emptyChildren =
      Array.isArray(last.tokens) && last.tokens.length === 0;
    if (!emptyText && !emptyRaw && !emptyChildren) break;
    tokens.pop();
  }
}

function stripTrailingPageBreakFromToken(token: MarkedToken): void {
  if (!token) return;
  if (typeof token.raw === "string")
    token.raw = stripTrailingPageBreakRaw(token.raw);
  if (typeof token.text === "string")
    token.text = stripTrailingPageBreakText(token.text);
  if (Array.isArray(token.tokens) && token.tokens.length) {
    stripTrailingPageBreakFromToken(token.tokens[token.tokens.length - 1]);
    pruneEmptyTrailingTokens(token.tokens);
  }
}

function extractTrailingListPageBreak(listToken: MarkedToken): number | null {
  const lastItem = listToken.items?.[listToken.items.length - 1];
  if (!lastItem || !PAGE_BREAK_TEXT_RE.test(lastItem.text || "")) return null;

  let sourceLine = null;
  if (
    typeof listToken._sourceLine === "number" &&
    typeof listToken.raw === "string"
  ) {
    const rawBeforeBreak = stripTrailingPageBreakRaw(listToken.raw);
    sourceLine =
      listToken._sourceLine + (rawBeforeBreak.split("\n").length - 1);
  }

  lastItem.text = stripTrailingPageBreakText(lastItem.text);
  if (typeof lastItem.raw === "string")
    lastItem.raw = stripTrailingPageBreakRaw(lastItem.raw);
  if (Array.isArray(lastItem.tokens) && lastItem.tokens.length) {
    stripTrailingPageBreakFromToken(
      lastItem.tokens[lastItem.tokens.length - 1],
    );
    pruneEmptyTrailingTokens(lastItem.tokens);
  }
  if (typeof listToken.raw === "string")
    listToken.raw = stripTrailingPageBreakRaw(listToken.raw);

  return sourceLine;
}

// ── Style directive helper (shared by every stylable renderer) ────────────
// Reads token._blockId / token._style attached by renderMarkdown and returns
// the `data-block-id` attribute fragment + an inline CSS string. The CSS is
// appended to whatever `style=""` the renderer already builds.
function blockAnnotations(token: any): {
  blockIdAttr: string;
  styleCss: string;
} {
  const blockIdAttr = token?._blockId
    ? ` data-block-id="${token._blockId}"`
    : "";
  const styleCss = renderStyleAttr(token?._style as StyleValues | undefined);
  return { blockIdAttr, styleCss };
}

// ── Configure marked once at module load ───────────────────────────────────

function parseContainerAttrs(attrs: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!attrs) return out;
  MD_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_ATTR_RE.exec(attrs)) !== null) out[m[1]] = m[2];
  return out;
}

// Variant B chip markup: inline SVG glyph + French kind label, rendered into
// the top-left of the alert. Glyphs are kept minimal (bare "i", "!", "×",
// "✓", document outline, lightbulb) at stroke-width 1.6 so they read as
// light line-icons, not heavy badges, at the 12 px chip size.
const ALERT_CHIPS: Record<string, string> = {
  info: `<div class="md-alert-chip"><svg class="md-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7v5.5"/><path d="M8 3.8v0.01"/></svg><span>Information</span></div>`,
  warning: `<div class="md-alert-chip"><svg class="md-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.8v6.4"/><path d="M8 12.2v0.01"/></svg><span>Attention</span></div>`,
  danger: `<div class="md-alert-chip"><svg class="md-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg><span>Critique</span></div>`,
  success: `<div class="md-alert-chip"><svg class="md-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.2 8.6l3.3 3.3L13 4.8"/></svg><span>Succès</span></div>`,
  note: `<div class="md-alert-chip"><svg class="md-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 2.5h5l3.5 3.5v8a0.5 0.5 0 0 1-0.5 0.5h-8a0.5 0.5 0 0 1-0.5-0.5v-11a0.5 0.5 0 0 1 0.5-0.5z"/><path d="M8.5 2.5v3.5h3.5"/><path d="M5.5 9h5M5.5 11.5h3"/></svg><span>Note</span></div>`,
  tip: `<div class="md-alert-chip"><svg class="md-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.3a3.7 3.7 0 0 0-2.2 6.7v1.6h4.4V9A3.7 3.7 0 0 0 8 2.3z"/><path d="M6.6 12.4h2.8"/><path d="M7.1 13.9h1.8"/></svg><span>Conseil</span></div>`,
};

function renderAlertContainer(kind: string, body: string, sl: string): string {
  const inner = marked.parse(body) as string;
  const chip = ALERT_CHIPS[kind] ?? ALERT_CHIPS.info;
  return `<div class="md-alert md-alert-${kind}"${sl}>\n${chip}\n${inner}</div>\n`;
}

// `:::stat-tiles` — each non-empty body line becomes a stat tile.
// Line syntax: `VALUE | LABEL [| NOTE]` (pipes are trimmed).
function renderStatTilesContainer(body: string, sl: string): string {
  const items = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        value: parts[0] || "",
        label: parts[1] || "",
        note: parts[2] || "",
      };
    });
  if (!items.length) return "";
  const tiles = items
    .map((it) => {
      const label = it.label
        ? `<div class="md-stat-tiles-label">${marked.parseInline(it.label)}</div>`
        : "";
      const note = it.note
        ? `<div class="md-stat-tiles-note">${marked.parseInline(it.note)}</div>`
        : "";
      return `<div class="md-stat-tiles-item">\n<div class="md-stat-tiles-value">${marked.parseInline(it.value)}</div>\n${label}${note}</div>`;
    })
    .join("\n");
  return `<div class="md-stat-tiles"${sl}>\n${tiles}\n</div>\n`;
}

// `:::numbered-grid` — editorial "project pillars" grid.
// Each non-empty body line becomes a numbered tile (auto 01…07) with a title
// and optional pitch, rendered in a rotating BEORN palette colour.
// Line syntax: `TITLE | PITCH` (PITCH optional). Cap at 7 items (palette size);
// author a second `:::numbered-grid` block for more.
function renderNumberedGridContainer(body: string, sl: string): string {
  const items = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return { title: parts[0] || "", pitch: parts[1] || "" };
    })
    .slice(0, 7);
  if (!items.length) return "";
  const tiles = items
    .map((it, i) => {
      const num = String(i + 1).padStart(2, "0");
      const title = it.title
        ? `<div class="md-numbered-grid-title">${marked.parseInline(it.title)}</div>`
        : "";
      const pitch = it.pitch
        ? `<p class="md-numbered-grid-pitch">${marked.parseInline(it.pitch)}</p>`
        : "";
      return `<div class="md-numbered-grid-item">\n<div class="md-numbered-grid-num-row"><span class="md-numbered-grid-num">${num}</span></div>\n${title}${pitch}</div>`;
    })
    .join("\n");
  return `<div class="md-numbered-grid"${sl}>\n${tiles}\n</div>\n`;
}

// `:::card title="…" phase="…" num="…"` — single card. Body is rendered as
// markdown (typically a bulleted list). Embed multiple `:::card` blocks inside
// `:::ao-grid` to lay them out in a grid; CSS provides nth-child colour
// rotation when cards are direct children of `.ao-grid`.
function renderCardContainer(
  attrsRaw: string,
  body: string,
  sl: string,
): string {
  const attrs = parseContainerAttrs(attrsRaw);
  const title = attrs.title || "";
  const phase = attrs.phase || "";
  const num = attrs.num || "";
  const inner = marked.parse(body) as string;
  const numHtml = num
    ? `<span class="md-card-num">${marked.parseInline(num)}</span>`
    : "";
  const titleHtml = title
    ? `<span class="md-card-title">${marked.parseInline(title)}</span>`
    : "";
  const phaseHtml = phase
    ? `<span class="md-card-phase">${marked.parseInline(phase)}</span>`
    : "";
  return `<div class="md-card"${sl}>\n<div class="md-card-left">${numHtml}${titleHtml}${phaseHtml}</div>\n${inner}</div>\n`;
}

// `:::feature title="…" status="…" level="…" image="…" caption="…" layout="row|col"`.
// Standalone fiche de fonctionnalité (formerly an inner directive of feature-grid).
// Body is rendered as markdown and becomes the card description. Layout = row
// (text + image side-by-side, full-width); col or no image (text + optional
// image below, half-width). Embed multiple `:::feature` inside `:::ao-grid` to
// dispose them in a grid.
// Status → Conforme (green) / Paramétrage (amber) / À préciser (grey).
// Level  → Obligatoire (red) / Souhaitée (blue) / Information (grey).
const FEATURE_STATUS_LABELS: Record<string, string> = {
  conforme: "CONFORME",
  "conforme-standard": "CONFORME STD",
  "conforme-dev": "CONFORME DEV",
  "partiel-standard": "PARTIEL STD",
  "partiel-dev": "PARTIEL DEV",
  "non-conforme": "NON CONFORME",
  parametrage: "PARAMÉTRAGE",
  "a-verifier": "À VÉRIFIER",
  preciser: "À PRÉCISER",
};
const FEATURE_LEVEL_LABELS: Record<string, string> = {
  obligatoire: "OBLIGATOIRE",
  souhaitee: "SOUHAITÉE",
  information: "INFORMATION",
  optionnel: "OPTIONNEL",
};
function normalizeFeatureStatus(value: string): string {
  const v = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_]/g, "");
  if (!v) return "";
  if (v.startsWith("nonconform")) return "non-conforme";
  // More-specific conforme variants must come before the plain "conform" prefix.
  if (v.startsWith("conformestandard") || v === "conformestd") return "conforme-standard";
  if (v.startsWith("conformedev")) return "conforme-dev";
  if (v.startsWith("partielstandard") || v === "partielstd") return "partiel-standard";
  if (v.startsWith("partieldev")) return "partiel-dev";
  if (v.startsWith("conform")) return "conforme";
  if (v.startsWith("param") || v === "setup" || v === "config")
    return "parametrage";
  if (v.startsWith("averifier") || v === "verify") return "a-verifier";
  if (
    v.startsWith("preciser") ||
    v.startsWith("apreciser") ||
    v === "tbd" ||
    v === "unknown"
  )
    return "preciser";
  return "";
}
function normalizeFeatureLevel(value: string): string {
  const v = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "");
  if (!v) return "";
  if (v.startsWith("oblig") || v === "required" || v === "mandatory")
    return "obligatoire";
  if (v.startsWith("souhait") || v === "desired" || v === "nice")
    return "souhaitee";
  if (v.startsWith("option") || v === "optional") return "optionnel";
  if (v.startsWith("info")) return "information";
  return "";
}
function renderFeatureContainer(
  attrsRaw: string,
  body: string,
  sl: string,
): string {
  const attrs = parseContainerAttrs(attrsRaw);
  const title = attrs.title || "";
  const requirement = attrs.requirement || "";
  const statusKey = normalizeFeatureStatus(attrs.status || "");
  const levelKey = normalizeFeatureLevel(attrs.level || "");
  const refCode = attrs.ref || "";
  const image = attrs.image || "";
  const caption = attrs.caption || "";
  // Coverage sources. Priority:
  //   1. coverageSources — JSON array of {label,url} written by ao-analyser
  //   2. sources         — pipe-separated labels (manual authoring)
  //   3. coverageSource  — single label (backward-compat fallback)
  let sourceLabels: string[] = [];
  let sourceHrefs: string[] = [];
  if (attrs.coverageSources) {
    try {
      const parsed: Array<{ label?: string; url?: string }> = JSON.parse(attrs.coverageSources);
      if (Array.isArray(parsed)) {
        sourceLabels = parsed.map((s) => s.label || "").filter(Boolean);
        sourceHrefs = parsed.map((s) => s.url || "");
      }
    } catch {
      // malformed JSON — fall through to pipe-separated path
    }
  }
  if (sourceLabels.length === 0) {
    const rawSources = attrs.sources || attrs.coverageSource || attrs.source || "";
    const rawSourcesHref =
      attrs.sourcesHref ||
      attrs.coverageSourceHref ||
      attrs.coverageSourceUrl ||
      attrs.sourceHref ||
      attrs.sourceUrl ||
      "";
    sourceLabels = rawSources ? rawSources.split("|").map((s: string) => s.trim()).filter(Boolean) : [];
    sourceHrefs = rawSourcesHref ? rawSourcesHref.split("|").map((s: string) => s.trim()) : [];
  }
  const wantsRow = (attrs.layout || "").toLowerCase() === "row";
  // row → full-width card, meta column on the left (design "non-compact");
  // col → half-width card, inline meta rail at top (design "compact").
  const layout = wantsRow ? "row" : "col";
  const innerHtml = body.trim() ? (marked.parse(body) as string) : "";

  const statusLabel = statusKey ? FEATURE_STATUS_LABELS[statusKey] : "";
  const levelLabel = levelKey ? FEATURE_LEVEL_LABELS[levelKey] : "";
  const titleHtml = title
    ? `<span class="md-feature-title">${marked.parseInline(title)}</span>`
    : "";
  const requirementHtml = requirement
    ? `<div class="md-feature-requirement">${marked.parseInline(requirement)}</div>`
    : "";
  const bodyHtml = innerHtml
    ? `<div class="md-feature-body">${innerHtml}</div>`
    : "";

  // Status dot (small colored circle) used in both layouts next to the status label.
  const statusDot = statusKey
    ? `<span class="md-feature-dot md-feature-dot-${statusKey}"></span>`
    : "";

  // Meta column (row/non-compact) — stacked Statut / Exigence / Réf.
  const metaColHtml =
    statusLabel || levelLabel || refCode
      ? `<div class="md-feature-meta">` +
        (statusLabel
          ? `<div class="md-feature-meta-block"><div class="md-feature-meta-label">Statut</div>` +
            `<div class="md-feature-meta-value">${statusDot}${escapeHtml(statusLabel)}</div></div>`
          : "") +
        (levelLabel
          ? `<div class="md-feature-meta-block"><div class="md-feature-meta-label">Exigence</div>` +
            `<div class="md-feature-meta-value md-feature-level-${levelKey}">${escapeHtml(levelLabel)}</div></div>`
          : "") +
        (refCode
          ? `<div class="md-feature-meta-block"><div class="md-feature-meta-label">Réf.</div>` +
            `<div class="md-feature-meta-value">${escapeHtml(refCode)}</div></div>`
          : "") +
        `</div>`
      : "";

  // Inline rail (col/compact) — Statut · Exigence · Réf on one line.
  const railItems: string[] = [];
  if (statusLabel)
    railItems.push(
      `<span class="md-feature-rail-item">${statusDot}${escapeHtml(statusLabel)}</span>`,
    );
  if (levelLabel)
    railItems.push(
      `<span class="md-feature-rail-item"><span class="md-feature-rail-hint">Exig.</span><span class="md-feature-level-${levelKey}">${escapeHtml(levelLabel)}</span></span>`,
    );
  if (refCode)
    railItems.push(
      `<span class="md-feature-rail-item"><span class="md-feature-rail-hint">Réf.</span>${escapeHtml(refCode)}</span>`,
    );
  const railHtml = railItems.length
    ? `<div class="md-feature-rail">${railItems.join("")}</div>`
    : "";

  let mediaHtml = "";
  if (image) {
    const href = resolveAssetUrl(image);
    const captionHtml = caption
      ? `<figcaption class="md-feature-caption">${marked.parseInline(caption)}</figcaption>`
      : "";
    mediaHtml = `<figure class="md-feature-media"><div class="md-feature-media-frame"><img src="${escapeHtml(href)}" alt="${escapeHtml(title)}"></div>${captionHtml}</figure>`;
  }

  // Render each source label; zip with hrefs (missing href = no link).
  const sourceItemsHtml = sourceLabels
    .map((label: string, i: number) => {
      const href = sourceHrefs[i] || "";
      return href
        ? `<a class="md-feature-source" href="${escapeHtml(href)}">${marked.parseInline(label)}</a>`
        : `<span class="md-feature-source">${marked.parseInline(label)}</span>`;
    })
    .join('<span class="md-feature-source-sep">, </span>');
  const sourceHtml = sourceLabels.length
    ? `<div class="md-feature-source-line">${sourceItemsHtml}</div>`
    : "";

  const statusClass = statusKey ? ` md-feature-status-${statusKey}` : "";
  const layoutClass = ` md-feature-${layout}`;

  if (layout === "row") {
    // Non-compact: meta col left, body right; if image, body splits into text+image (image 200px right).
    const bodyCol = mediaHtml
      ? `<div class="md-feature-body-split">${bodyHtml}${mediaHtml}</div>`
      : bodyHtml;
    return `<div class="md-feature${layoutClass}${statusClass}"${sl}>${metaColHtml}<div class="md-feature-content">${titleHtml}${requirementHtml}${bodyCol}${sourceHtml}</div></div>\n`;
  }
  // Compact: rail on top, title, requirement, body, optional image below, source link at the foot.
  return `<div class="md-feature${layoutClass}${statusClass}"${sl}>${railHtml}${titleHtml}${requirementHtml}${bodyHtml}${mediaHtml}${sourceHtml}</div>\n`;
}

// `:::heatmap` — contract-lifecycle heat-matrix with milestones on top.
// Syntax (config block + `---` + data rows):
//   columns: LABEL[:phase], LABEL[:phase], …   (phase = mise|expl|fin, optional)
//   milestones: LABEL@POS[:SUB], …             (POS = 0…N column-index; SUB = optional subtitle)
//   ---
//   Row title | T T T T T T T                   (T: X/■ = on, o/• = event, any else = off)
// Rows are auto-numbered 01…N and assigned a rotating BEORN palette colour.
function renderHeatmapContainer(body: string, sl: string): string {
  const parts = body.split(/\n---\s*\n/);
  const configRaw = parts[0] || "";
  const rowsRaw = parts.slice(1).join("\n---\n") || "";

  // Parse `key: value` config directives
  const cfg: Record<string, string> = {};
  for (const line of configRaw.split("\n")) {
    const m = line.trim().match(/^(\w+)\s*:\s*(.+)$/);
    if (m) cfg[m[1].toLowerCase()] = m[2].trim();
  }

  // Columns — each segment is `label` or `label:phase`
  type Col = { label: string; phase: string };
  const columns: Col[] = (cfg.columns || "")
    .split(",")
    .map((s) => {
      const t = s.trim();
      if (!t) return null;
      const colonIdx = t.indexOf(":");
      const label = colonIdx >= 0 ? t.slice(0, colonIdx).trim() : t;
      const phase = colonIdx >= 0 ? t.slice(colonIdx + 1).trim() : "";
      return { label, phase };
    })
    .filter((c): c is Col => c !== null && !!c.label);
  const ncols = columns.length;
  if (!ncols) return "";

  // Milestones — `label@POS` or `label@POS:subtitle`
  type Milestone = { label: string; pos: number; sub: string };
  const milestones: Milestone[] = (cfg.milestones || "")
    .split(",")
    .map((seg) => {
      const t = seg.trim();
      const atIdx = t.indexOf("@");
      if (atIdx < 0) return null;
      const label = t.slice(0, atIdx).trim();
      const rest = t.slice(atIdx + 1);
      const subIdx = rest.indexOf(":");
      const posStr = subIdx >= 0 ? rest.slice(0, subIdx).trim() : rest.trim();
      const sub = subIdx >= 0 ? rest.slice(subIdx + 1).trim() : "";
      const posNum = parseFloat(posStr);
      if (!Number.isFinite(posNum)) return null;
      const pos = (Math.max(0, Math.min(ncols, posNum)) / ncols) * 100;
      return { label, pos, sub };
    })
    .filter((m): m is Milestone => m !== null);

  // Data rows — `Title | T T T T …`
  type Row = { title: string; cells: string[] };
  const rows: Row[] = rowsRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf("|");
      if (pipe < 0) return null;
      const title = line.slice(0, pipe).trim();
      const tokens = line
        .slice(pipe + 1)
        .trim()
        .split(/\s+/);
      const cells: string[] = [];
      for (let i = 0; i < ncols; i++) {
        const tok = tokens[i] || ".";
        if (tok === "X" || tok === "x" || tok === "■") cells.push("on");
        else if (tok === "o" || tok === "O" || tok === "•") cells.push("event");
        else cells.push("off");
      }
      return { title, cells };
    })
    .filter((r): r is Row => r !== null);
  if (!rows.length) return "";

  const palette = [
    "var(--navy)",
    "var(--blue)",
    "var(--teal)",
    "var(--purple)",
    "var(--green)",
    "var(--orange)",
    "var(--magenta)",
  ];

  const milestonesHtml = milestones
    .map((m) => {
      let posClass = "";
      if (m.pos <= 0.01) posClass = " start";
      else if (m.pos >= 99.99) posClass = " end";
      const subHtml = m.sub
        ? `<span class="md-heatmap-milestone-sub">${marked.parseInline(m.sub)}</span>`
        : "";
      return (
        `<div class="md-heatmap-milestone${posClass}" style="left:${m.pos}%">` +
        `<span class="md-heatmap-milestone-label">${marked.parseInline(m.label)}</span>` +
        subHtml +
        `<span class="md-heatmap-milestone-arrow">▼</span>` +
        `</div>`
      );
    })
    .join("");

  const colsHtml = columns
    .map((c) => {
      const phaseClass = c.phase ? ` md-heatmap-col-${c.phase}` : "";
      return `<div class="md-heatmap-col${phaseClass}">${marked.parseInline(c.label)}</div>`;
    })
    .join("");

  const rowsHtml = rows
    .map((r, i) => {
      const num = String(i + 1).padStart(2, "0");
      const color = palette[i % palette.length];
      const cellsHtml = r.cells
        .map((c) => `<div class="md-heatmap-cell ${c}"></div>`)
        .join("");
      return (
        `<div class="md-heatmap-row" style="color:${color}">` +
        `<div class="md-heatmap-row-label">` +
        `<span class="md-heatmap-row-num">${num}</span>` +
        `<span class="md-heatmap-row-name">${marked.parseInline(r.title)}</span>` +
        `</div>` +
        cellsHtml +
        `</div>`
      );
    })
    .join("");

  return (
    `<div class="md-heatmap" style="--md-heatmap-cols:${ncols}"${sl}>\n` +
    `<div class="md-heatmap-milestones"><div></div><div class="md-heatmap-milestones-track">${milestonesHtml}</div></div>\n` +
    `<div class="md-heatmap-head"><div></div>${colsHtml}</div>\n` +
    rowsHtml +
    `\n</div>\n`
  );
}

// `:::quote author="…" role="…"` — blockquote with attribution footer.
function renderQuoteContainer(
  attrsRaw: string,
  body: string,
  sl: string,
): string {
  const attrs = parseContainerAttrs(attrsRaw);
  const inner = marked.parse(body) as string;
  const parts: string[] = [];
  if (attrs.author)
    parts.push(
      `<cite class="md-quote-author">${escapeHtml(attrs.author)}</cite>`,
    );
  if (attrs.role)
    parts.push(`<span class="md-quote-role">${escapeHtml(attrs.role)}</span>`);
  const footer = parts.length
    ? `<footer class="md-quote-footer">${parts.join("")}</footer>\n`
    : "";
  return `<blockquote class="md-quote"${sl}>\n${inner}${footer}</blockquote>\n`;
}

// `:::timeline` with inner `:::step TITLE | META` headers (no per-step closer).
function renderTimelineContainer(body: string, sl: string): string {
  MD_STEP_HEADER_RE.lastIndex = 0;
  const headers: Array<{
    title: string;
    meta: string;
    at: number;
    end: number;
  }> = [];
  let hm: RegExpExecArray | null;
  while ((hm = MD_STEP_HEADER_RE.exec(body)) !== null) {
    const parts = hm[1].split("|").map((p) => p.trim());
    headers.push({
      title: parts[0] || "",
      meta: parts[1] || "",
      at: hm.index,
      end: hm.index + hm[0].length,
    });
  }
  if (!headers.length) return "";
  const steps = headers
    .map((h, i) => {
      const start = h.end;
      const end = i + 1 < headers.length ? headers[i + 1].at : body.length;
      const content = body.slice(start, end).replace(/\n+$/, "");
      const inner = marked.parse(content) as string;
      const meta = h.meta
        ? `<span class="md-step-meta">${marked.parseInline(h.meta)}</span>`
        : "";
      return `<div class="md-step">\n<div class="md-step-dot"></div>\n<div class="md-step-head"><span class="md-step-title">${marked.parseInline(h.title)}</span>${meta}</div>\n<div class="md-step-body">\n${inner}</div>\n</div>`;
    })
    .join("\n");
  return `<div class="md-timeline"${sl}>\n${steps}\n</div>\n`;
}

// Render the body of a `:::ao-grid … :::` container as a 12-column grid.
// Two modes:
//   (a) Column headers — `:::col-8` / `:::col` lines split the body. Explicit
//       `:::col-N` spans N/12; bare `:::col` shares the remainder evenly.
//       Columns are implicitly closed by the next `:::col[-N]` or end of body.
//   (b) No column headers — the body is parsed as standard markdown and
//       embedded directly inside `.ao-grid`. Useful for embedding
//       `:::card` / `:::feature` containers; their CSS layout classes
//       (e.g. `.md-feature-row` → `grid-column: 1 / -1`) impose the width.
function renderAoGridBlock(body: string, rootAttrs: string): string {
  AO_GRID_COL_HEADER_RE.lastIndex = 0;
  const headers: Array<{
    rawSpan: number | null;
    headerStart: number;
    contentStart: number;
  }> = [];
  let hm: RegExpExecArray | null;
  while ((hm = AO_GRID_COL_HEADER_RE.exec(body)) !== null) {
    const widthRaw = hm[1];
    const parsed = widthRaw != null ? parseInt(widthRaw, 10) : NaN;
    const rawSpan = Number.isFinite(parsed)
      ? Math.max(1, Math.min(12, parsed))
      : null;
    headers.push({
      rawSpan,
      headerStart: hm.index,
      contentStart: hm.index + hm[0].length,
    });
  }
  if (!headers.length) {
    // Direct-embed mode — body is rendered as markdown; nested containers
    // (`:::card`, `:::feature`, …) are tokenized by mdContainer recursively.
    const inner = body.trim() ? (marked.parse(body) as string) : "";
    return `<div class="ao-grid"${rootAttrs}>\n${inner}</div>\n`;
  }
  const explicitTotal = headers.reduce(
    (acc, h) => acc + (h.rawSpan ?? 0),
    0,
  );
  const bareCount = headers.filter((h) => h.rawSpan == null).length;
  const remaining = Math.max(0, 12 - explicitTotal);
  const baseShare = bareCount > 0 ? Math.floor(remaining / bareCount) : 0;
  const extraShare = bareCount > 0 ? remaining - baseShare * bareCount : 0;
  let bareIdx = 0;
  const cols = headers.map((h, i) => {
    let span: number;
    if (h.rawSpan != null) {
      span = h.rawSpan;
    } else {
      span = baseShare + (bareIdx < extraShare ? 1 : 0);
      span = Math.max(1, Math.min(12, span));
      bareIdx++;
    }
    const start = h.contentStart;
    const end =
      i + 1 < headers.length ? headers[i + 1].headerStart : body.length;
    const content = body.slice(start, end).replace(/\n+$/, "");
    const inner = marked.parse(content) as string;
    return `<div class="ao-grid-col" style="grid-column: span ${span}">\n${inner}</div>`;
  });
  return `<div class="ao-grid"${rootAttrs}>\n${cols.join("\n")}\n</div>\n`;
}

marked.use({
  extensions: [
    {
      // Generic `:::name [attrs]\n…body…\n:::` container. Name dispatches to
      // the appropriate renderer (alert / stat-tiles / quote / timeline). Unknown
      // names return undefined so marked falls through to its default
      // tokenizers. Containers may nest: each `:::name` line opens a level,
      // each bare `:::` line closes the nearest open level. Inner directives
      // (col-N, card, feature, step) carry trailing text after `:::name`
      // and never open a depth level.
      name: "mdContainer",
      level: "block",
      start(src: string): number | undefined {
        const m = src.match(MD_CONTAINER_START_RE);
        if (!m) return undefined;
        const offset = m.index ?? 0;
        return offset + (m[0].startsWith("\n") ? 1 : 0);
      },
      tokenizer(src: string): MarkedToken | undefined {
        const openMatch = src.match(
          /^:::([a-z][a-z0-9-]*)(?:[ \t]+([^\n]*))?\r?\n/,
        );
        if (!openMatch) return undefined;
        const name = openMatch[1];
        if (!MD_KNOWN_CONTAINERS.has(name)) return undefined;
        const attrs = openMatch[2] || "";
        const bodyStart = openMatch[0].length;
        const len = src.length;
        let pos = bodyStart;
        let depth = 1;
        let bodyEnd = -1;
        let rawEnd = -1;
        while (pos < len) {
          const lineEnd = src.indexOf("\n", pos);
          const lineLast = lineEnd === -1 ? len : lineEnd;
          const line = src.slice(pos, lineLast).replace(/[ \t]+$/, "");
          if (line === ":::") {
            depth--;
            if (depth === 0) {
              bodyEnd = pos;
              rawEnd = lineEnd === -1 ? len : lineEnd + 1;
              break;
            }
          } else {
            const om = line.match(/^:::([a-z][a-z0-9-]*)(?=$|[ \t])/);
            if (om && MD_KNOWN_CONTAINERS.has(om[1])) depth++;
          }
          if (lineEnd === -1) break;
          pos = lineEnd + 1;
        }
        if (depth !== 0 || bodyEnd === -1) return undefined;
        const text = src.slice(bodyStart, bodyEnd).replace(/\n+$/, "");
        return {
          type: "mdContainer",
          raw: src.slice(0, rawEnd),
          name,
          attrs,
          text,
        } as unknown as MarkedToken;
      },
      renderer(token: MarkedToken): string {
        const sl =
          token._sourceLine != null
            ? ` data-source-line="${token._sourceLine}"`
            : "";
        const { blockIdAttr, styleCss } = blockAnnotations(token);
        // Every mdContainer sub-renderer takes a single "attrs" string that
        // is inserted into the root element after its class list. Including
        // sl/blockIdAttr/style here keeps those in one place.
        const styleAttr = styleCss ? ` style="${styleCss}"` : "";
        const rootAttrs = `${sl}${blockIdAttr}${styleAttr}`;
        const name = (token.name as string) || "";
        const body = (token.text as string) || "";
        if (MD_ALERT_KINDS.has(name))
          return renderAlertContainer(name, body, rootAttrs);
        if (name === "stat-tiles")
          return renderStatTilesContainer(body, rootAttrs);
        if (name === "numbered-grid")
          return renderNumberedGridContainer(body, rootAttrs);
        if (name === "card")
          return renderCardContainer(
            (token.attrs as string) || "",
            body,
            rootAttrs,
          );
        if (name === "feature")
          return renderFeatureContainer(
            (token.attrs as string) || "",
            body,
            rootAttrs,
          );
        if (name === "heatmap") return renderHeatmapContainer(body, rootAttrs);
        if (name === "quote")
          return renderQuoteContainer(
            (token.attrs as string) || "",
            body,
            rootAttrs,
          );
        if (name === "timeline")
          return renderTimelineContainer(body, rootAttrs);
        if (name === "ao-grid") return renderAoGridBlock(body, rootAttrs);
        return "";
      },
    },
  ],

  renderer: {
    heading(this: any, token): string {
      const ctx = _ctx;
      if (!ctx) return "";
      const { tokens, depth } = token;
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const { blockIdAttr, styleCss } = blockAnnotations(token);
      const text = this.parser.parseInline(tokens);
      const pair = COLOR_PAIRS[ctx.colorIdx % COLOR_PAIRS.length];
      const [primary] = pair;
      const vars = `--section-color:${primary};--section-color-light:${pair[1]}`;

      const plainText = text.replace(/<[^>]+>/g, "");
      const hid = `h-${ctx.headingIdCounter++}-${slugify(plainText)}`;
      const idAttr = ` id="${hid}"`;

      if ((depth ?? 5) >= 5)
        return `<h${depth}${idAttr}${sl}${blockIdAttr} style="color:${primary};${vars};${styleCss}">${text}</h${depth}>\n`;

      if (depth === 1) {
        const clean = stripLeadingNumber(text);
        const stripped = clean.replace(/^Partie\s+\d+\s*[—●\-]\s*/i, "");
        const disc = '<span class="beorn-disc">&#x25CF;</span>';
        const title = ctx.partieNum
          ? `Partie ${ctx.partieNum} ${disc} ${stripped}`
          : clean;
        if (ctx.headingCollector) {
          const tocTitle = decodeEntities(
            (stripped || clean).replace(/<[^>]+>/g, ""),
          );
          ctx.headingCollector.push({
            depth: 1,
            id: hid,
            title: tocTitle,
            num: ctx.partieNum || null,
            colorPair: pair,
          });
        }
        return `<h1${idAttr}${sl}${blockIdAttr} data-color-index="${ctx.colorIdx % 5}" style="color:${primary};${vars};${styleCss}">${title}${buildUnderline(pair as [string, string])}</h1>\n`;
      }

      if (depth === 2) {
        ctx.h2Count++;
        ctx.h3Count = 0;
      } else if (depth === 3) {
        ctx.h3Count++;
      }

      const clean = stripLeadingNumber(text);

      if (!ctx.partieNum) {
        return `<h${depth}${idAttr}${sl}${blockIdAttr} style="color:${primary};${vars};${styleCss}">${clean}</h${depth}>\n`;
      }

      const num =
        depth === 2
          ? `${ctx.partieNum}.${ctx.h2Count}`
          : `${ctx.partieNum}.${ctx.h2Count}.${ctx.h3Count}`;
      const disc = '<span class="beorn-disc">&#x25CF;</span>';

      if (depth === 2) {
        return `<h2${idAttr}${sl}${blockIdAttr} style="color:${primary};${vars};${styleCss}"><span class="beorn-num" style="background:${primary};color:#fff">${escapeHtml(num)}</span><span class="beorn-text">${clean}</span></h2>\n`;
      }
      if (depth === 3) {
        return `<h3${idAttr}${sl}${blockIdAttr} style="color:${primary};padding:0.3rem 0.7rem;border-radius:4px;background:color-mix(in srgb, ${primary} 6%, transparent);width:fit-content;max-width:100%;${vars};${styleCss}"><span class="beorn-num" style="color:${primary}">${escapeHtml(num)}</span> ${disc} ${clean}</h3>\n`;
      }
      return `<h${depth}${idAttr}${sl}${blockIdAttr} style="color:${primary};${vars};${styleCss}">${clean}</h${depth}>\n`;
    },

    paragraph(this: any, token): string {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const { blockIdAttr, styleCss } = blockAnnotations(token);
      const styleAttr = styleCss ? ` style="${styleCss}"` : "";
      const standaloneImage =
        token.tokens?.length === 1 && token.tokens[0]?.type === "image"
          ? token.tokens[0]
          : null;
      if (standaloneImage) {
        const image = renderImageTag(this.parser, standaloneImage);
        const caption = image.text
          ? `\n<figcaption>${escapeHtml(image.text)}</figcaption>`
          : "";
        const alignClass = image.align ? ` md-image-align-${image.align}` : "";
        return `<figure class="md-image${alignClass}"${sl}${blockIdAttr}${styleAttr}>${image.html}${caption}\n</figure>\n`;
      }
      const text = this.parser.parseInline(token.tokens);
      const stripped = text.replace(/<[^>]*>/g, "").trim();
      if (stripped === ":::newpage") {
        return `<div class="page-break"${sl}${blockIdAttr}${styleAttr}></div>\n`;
      }
      // :::spacer 10px — invisible full-width block.
      // Accepts any CSS length (px, rem, em, %, vh).
      const spacerMatch = stripped.match(/^:::spacer[ \t]+([^\n]+)$/);
      if (spacerMatch) {
        const rawHeight = spacerMatch[1].trim();
        const safeHeight =
          /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|cm|mm|in|pt|pc)$/.test(
            rawHeight,
          )
            ? rawHeight
            : "0";
        const mergedStyle = `height:${safeHeight};width:100%;${styleCss}`;
        return `<div class="md-spacer"${sl}${blockIdAttr} style="${mergedStyle}" aria-hidden="true"></div>\n`;
      }
      return `<p${sl}${blockIdAttr}${styleAttr}>${text}</p>\n`;
    },

    blockquote(this: any, token): string {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const { blockIdAttr, styleCss } = blockAnnotations(token);
      const styleAttr = styleCss ? ` style="${styleCss}"` : "";
      const body = this.parser.parse(token.tokens);
      return `<blockquote${sl}${blockIdAttr}${styleAttr}>\n${body}</blockquote>\n`;
    },

    list(this: any, token): string {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const { blockIdAttr, styleCss } = blockAnnotations(token);
      const styleAttr = styleCss ? ` style="${styleCss}"` : "";
      const tag = token.ordered ? "ol" : "ul";
      const startAttr =
        token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
      const trailingPageBreakLine = extractTrailingListPageBreak(token);
      let body = "";
      for (const item of token.items ?? []) body += this.listitem(item);
      const pbSl =
        trailingPageBreakLine != null
          ? ` data-source-line="${trailingPageBreakLine}"`
          : "";
      const pageBreakHtml =
        trailingPageBreakLine != null
          ? `<div class="page-break"${pbSl}></div>\n`
          : "";
      return `<${tag}${startAttr}${sl}${blockIdAttr}${styleAttr}>\n${body}</${tag}>\n${pageBreakHtml}`;
    },

    table(this: any, token): string {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const { blockIdAttr, styleCss } = blockAnnotations(token);
      const styleAttr = styleCss ? ` style="${styleCss}"` : "";
      let header = "";
      for (const cell of token.header ?? []) {
        const align = cell.align ? ` align="${cell.align}"` : "";
        header += `<th${align}>${this.parser.parseInline(cell.tokens)}</th>\n`;
      }
      header = `<tr>\n${header}</tr>\n`;
      let body = "";
      for (const row of token.rows ?? []) {
        let rowContent = "";
        for (const cell of row) {
          const align = cell.align ? ` align="${cell.align}"` : "";
          rowContent += `<td${align}>${this.parser.parseInline(cell.tokens)}</td>\n`;
        }
        body += `<tr>\n${rowContent}</tr>\n`;
      }
      return `<table${sl}${blockIdAttr}${styleAttr}>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
    },

    hr(token): string {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const { blockIdAttr, styleCss } = blockAnnotations(token);
      const styleAttr = styleCss ? ` style="${styleCss}"` : "";
      return `<hr${sl}${blockIdAttr}${styleAttr} />\n`;
    },

    code(token): string {
      const { text, lang } = token;
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const { blockIdAttr, styleCss } = blockAnnotations(token);
      const styleAttr = styleCss ? ` style="${styleCss}"` : "";
      if (lang === "mermaid") {
        const idx = pushToMermaidQueue(text || "");
        return `<div class="mermaid-diagram"${sl}${blockIdAttr}${styleAttr} data-mermaid-idx="${idx}"></div>\n`;
      }
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre${sl}${blockIdAttr}${styleAttr}><code${langClass}>${escapeHtml(text || "")}</code></pre>\n`;
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
export async function renderMarkdown(
  md: string,
  options: Record<string, any> = {},
): Promise<{
  sectionHtml: string;
  headerText: string;
  language: string;
  headingIdCounter: number;
  lineNumberOffset: number;
  lineStarts: number[];
  sourceBlocks: Array<{
    start: number;
    end: number;
    kind: string;
    text: string;
  }>;
  blockEntries: BlockEntry[];
  styleErrors: StyleError[];
}> {
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

  // Extract directives via two-pass tokenization (spec §5.1). The cleaned
  // body feeds marked.lexer; BlockEntry[] indexes every stylable block with
  // its directive-derived styleValues and document-absolute offsets.
  const frontmatterCharOffset = md.length - body.length;
  const { blockEntries, styleErrors, cleanedBody } = buildBlockEntries(body, {
    frontmatterCharOffset,
    frontmatterLineOffset: startLine,
    lex: (src: string) => marked.lexer(src) as any,
  });

  const lineStarts = getLineStarts(cleanedBody);

  const partieNum = detectPartieNum(cleanedBody, fileName);
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

  // Tokenize cleaned body. Attach _sourceLine (editor-absolute) for sync,
  // and attach _blockId + _style so each stylable renderer can emit the
  // data-block-id attribute and inline spacing CSS.
  const tokens = marked.lexer(cleanedBody);
  const sourceBlocks = buildSourceBlocks(tokens);

  const entriesByLine = new Map<number, BlockEntry>();
  for (const entry of blockEntries) {
    entriesByLine.set(entry.sourceLineStart, entry);
  }

  {
    let cursor = 0;
    for (const token of tokens) {
      const idx = cleanedBody.indexOf(token.raw, cursor);
      if (idx >= 0) {
        const lineInSection =
          cleanedBody.substring(0, idx).split("\n").length - 1;
        const editorLine = startLine + lineInSection;
        token._sourceLine = editorLine;
        cursor = idx + token.raw.length;
        const entry = entriesByLine.get(editorLine);
        if (entry) {
          token._blockId = entry.blockId;
          token._style = entry.styleValues as StyleValues;
        }
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
    blockEntries,
    styleErrors,
  };
}
