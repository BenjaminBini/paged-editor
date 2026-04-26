// formatting-toolbar.js — Editor-local formatting actions and toolbar wiring.

import { on as busOn } from "../infrastructure/event-bus.js";
import { showContextMenu } from "../shell/ui/context-menu.js";
import { cm, status as _status } from "./codemirror-editor.js";
const status = _status!;
import { getActiveTab } from "../workspace/tabs/tab-bar-controller.js";
import { getTableRangeAt, insertTable } from "./table-widget.js";
import { saveImageAsset } from "../workspace/files/asset-manager.js";
import { getCachedPdfCssSync } from "../document/rendering/preview-renderer.js";

const WORD_CHAR_RE: RegExp = /[\p{L}\p{N}_-]/u;
const SYMBOLS: { value: string; label: string }[] = [
  { value: "•", label: "Bullet" },
  { value: "→", label: "Arrow" },
  { value: "✓", label: "Check" },
  { value: "⚠", label: "Warning" },
  { value: "§", label: "Section" },
  { value: "€", label: "Euro" },
  { value: "—", label: "Dash" },
];

function selectionRange(): { doc: any; from: any; to: any; start: number; end: number; hasSelection: boolean } {
  const doc = cm.getDoc();
  const from = doc.getCursor("from");
  const to = doc.getCursor("to");
  const start = doc.indexFromPos(from);
  const end = doc.indexFromPos(to);
  return {
    doc,
    from,
    to,
    start,
    end,
    hasSelection: start !== end,
  };
}

function applyReplacement(doc: any, start: number, end: number, replacement: string, options: { selectStartOffset?: number; selectEndOffset?: number; cursorOffset?: number } = {}): void {
  const from = doc.posFromIndex(start);
  const to = doc.posFromIndex(end);
  doc.replaceRange(replacement, from, to);

  if (options.selectStartOffset != null && options.selectEndOffset != null) {
    doc.setSelection(
      doc.posFromIndex(start + options.selectStartOffset),
      doc.posFromIndex(start + options.selectEndOffset),
    );
  } else if (options.cursorOffset != null) {
    doc.setCursor(doc.posFromIndex(start + options.cursorOffset));
  }
}

function replaceSelection(text: string): void {
  const { doc, start, end } = selectionRange();
  applyReplacement(doc, start, end, text, { cursorOffset: text.length });
  cm.focus();
}

function insertSnippet(text: string, selectionStartOffset: number | null = null, selectionEndOffset: number | null = null): void {
  const { doc, start, end } = selectionRange();
  const options: { selectStartOffset?: number; selectEndOffset?: number; cursorOffset?: number } = {};
  if (selectionStartOffset != null && selectionEndOffset != null) {
    options.selectStartOffset = selectionStartOffset;
    options.selectEndOffset = selectionEndOffset;
  } else {
    options.cursorOffset = text.length;
  }
  applyReplacement(doc, start, end, text, options);
  cm.focus();
}

function isWordChar(char: string): boolean {
  return !!char && WORD_CHAR_RE.test(char);
}

function findWordRange(text: string, index: number): { start: number; end: number } | null {
  let pivot = index;
  if (!isWordChar(text[pivot]) && isWordChar(text[pivot - 1])) pivot -= 1;
  if (!isWordChar(text[pivot])) return null;

  let start = pivot;
  let end = pivot + 1;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  return { start, end };
}

function isRepeatedMarkdownMarker(text: string, index: number, marker: string): boolean {
  if (marker !== "*" && marker !== "**") return false;
  const markerChar = marker[0];
  return text[index - 1] === markerChar || text[index + marker.length] === markerChar;
}

function isMarkerAt(text: string, index: number, marker: string): boolean {
  return text.slice(index, index + marker.length) === marker;
}

function hasExactWrapper(text: string, start: number, end: number, prefix: string, suffix: string): boolean {
  const openIndex = start - prefix.length;
  const closeIndex = end;
  if (openIndex < 0 || closeIndex + suffix.length > text.length) return false;
  if (!isMarkerAt(text, openIndex, prefix) || !isMarkerAt(text, closeIndex, suffix)) return false;
  if (isRepeatedMarkdownMarker(text, openIndex, prefix)) return false;
  if (isRepeatedMarkdownMarker(text, closeIndex, suffix)) return false;
  return true;
}

function findLineBounds(text: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", end);
  return {
    lineStart,
    lineEnd: nextBreak === -1 ? text.length : nextBreak,
  };
}

function findEnclosingWrapper(text: string, targetStart: number, targetEnd: number, prefix: string, suffix: string): { fullStart: number; fullEnd: number; innerStart: number; innerEnd: number } | null {
  const { lineStart, lineEnd } = findLineBounds(text, targetStart, targetEnd);
  let openIndex = text.lastIndexOf(prefix, targetStart - 1);

  while (openIndex >= lineStart) {
    const innerStart = openIndex + prefix.length;
    const closeIndex = text.indexOf(suffix, Math.max(targetEnd, innerStart));
    if (closeIndex !== -1 && closeIndex < lineEnd) {
      if (
        innerStart <= targetStart &&
        closeIndex >= targetEnd &&
        !isRepeatedMarkdownMarker(text, openIndex, prefix) &&
        !isRepeatedMarkdownMarker(text, closeIndex, suffix)
      ) {
        return {
          fullStart: openIndex,
          fullEnd: closeIndex + suffix.length,
          innerStart,
          innerEnd: closeIndex,
        };
      }
    }
    openIndex = text.lastIndexOf(prefix, openIndex - 1);
  }

  return null;
}

function getInlineFormatContext(prefix: string, suffix: string): { doc: any; from: any; to: any; start: number; end: number; hasSelection: boolean; text: string; active: boolean; targetStart: number; targetEnd: number; fullStart?: number; fullEnd?: number; innerStart?: number; innerEnd?: number } {
  const context = selectionRange();
  const text = context.doc.getValue();
  const selectedText = text.slice(context.start, context.end);

  if (
    context.hasSelection &&
    selectedText.startsWith(prefix) &&
    selectedText.endsWith(suffix)
  ) {
    return {
      ...context,
      text,
      active: true,
      targetStart: context.start,
      targetEnd: context.end,
      fullStart: context.start,
      fullEnd: context.end,
      innerStart: context.start + prefix.length,
      innerEnd: context.end - suffix.length,
    };
  }

  const target = context.hasSelection
    ? { start: context.start, end: context.end }
    : findWordRange(text, context.start);

  if (target && hasExactWrapper(text, target.start, target.end, prefix, suffix)) {
    return {
      ...context,
      text,
      active: true,
      targetStart: target.start,
      targetEnd: target.end,
      fullStart: target.start - prefix.length,
      fullEnd: target.end + suffix.length,
      innerStart: target.start,
      innerEnd: target.end,
    };
  }

  if (target) {
    const enclosing = findEnclosingWrapper(text, target.start, target.end, prefix, suffix);
    if (enclosing) {
      return {
        ...context,
        text,
        active: true,
        targetStart: target.start,
        targetEnd: target.end,
        ...enclosing,
      };
    }
  }

  return {
    ...context,
    text,
    active: false,
    targetStart: target?.start ?? context.start,
    targetEnd: target?.end ?? context.end,
  };
}

function toggleInlineFormat(prefix: string, suffix: string): void {
  const state = getInlineFormatContext(prefix, suffix);
  const { doc, text } = state;

  if (state.active) {
    const s = state as any;
    const inner = text.slice(s.innerStart, s.innerEnd);
    applyReplacement(doc, s.fullStart, s.fullEnd, inner, {
      selectStartOffset: 0,
      selectEndOffset: inner.length,
    });
  } else if (state.targetStart !== state.targetEnd) {
    const inner = text.slice(state.targetStart, state.targetEnd);
    const wrapped = prefix + inner + suffix;
    applyReplacement(doc, state.targetStart, state.targetEnd, wrapped, {
      selectStartOffset: prefix.length,
      selectEndOffset: prefix.length + inner.length,
    });
  } else {
    applyReplacement(doc, state.start, state.end, prefix + suffix, {
      cursorOffset: prefix.length,
    });
  }

  cm.focus();
  refreshToolbarState();
}

function getSelectedLineRange(): { startLine: number; endLine: number } {
  const { from, to } = selectionRange();
  return {
    startLine: from.line,
    endLine: to.ch === 0 && to.line > from.line ? to.line - 1 : to.line,
  };
}

function getHeadingLevel(line: string): number {
  const match = /^(#{1,6})\s+/.exec(line || "");
  return match ? match[1].length : 0;
}

function getHeadingState(): { startLine: number; endLine: number; active: boolean; level: number | null } {
  const { doc } = selectionRange();
  const { startLine, endLine } = getSelectedLineRange();
  const levels: number[] = [];

  for (let lineNo = startLine; lineNo <= endLine; lineNo += 1) {
    levels.push(getHeadingLevel(doc.getLine(lineNo)));
  }

  const active = levels.some((level) => level > 0);
  const uniformLevel = levels.length && levels.every((level) => level === levels[0])
    ? levels[0]
    : null;

  return {
    startLine,
    endLine,
    active,
    level: uniformLevel,
  };
}

function applyHeadingLevel(level: number): void {
  const { doc } = selectionRange();
  const state = getHeadingState();
  const nextLevel = state.level === level ? 0 : level;

  cm.operation(() => {
    for (let lineNo = state.startLine; lineNo <= state.endLine; lineNo += 1) {
      const line = doc.getLine(lineNo) || "";
      const clean = line.replace(/^#{1,6}\s+/, "");
      const next = nextLevel ? `${"#".repeat(nextLevel)} ${clean}` : clean;
      doc.replaceRange(next, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
    }
  });

  cm.focus();
  refreshToolbarState();
}

function showButtonMenu(button: HTMLElement, items: any[]): void {
  const rect = button.getBoundingClientRect();
  showContextMenu(rect.left, rect.bottom + 6, items);
}

function openHeadingMenu(button: HTMLElement): void {
  showButtonMenu(button, [
    {
      label: "Paragraph",
      action: () => applyHeadingLevel(0),
    },
    { separator: true },
    ...[1, 2, 3, 4, 5, 6].map((level) => ({
      label: `Heading ${level}`,
      action: () => applyHeadingLevel(level),
    })),
  ]);
}

function getSymbolTarget(): { doc: any; from: any; to: any; start: number; end: number; hasSelection: boolean; text: string; targetStart: number; targetEnd: number } {
  const context = selectionRange();
  const text = context.doc.getValue();
  const target = context.hasSelection
    ? { start: context.start, end: context.end }
    : findWordRange(text, context.start);
  return {
    ...context,
    text,
    targetStart: target?.start ?? context.start,
    targetEnd: target?.end ?? context.end,
  };
}

function getSymbolPrefixState(): string {
  const { text, targetStart } = getSymbolTarget();

  for (const symbol of SYMBOLS) {
    const prefix = `${symbol.value} `;
    if (targetStart >= prefix.length && text.slice(targetStart - prefix.length, targetStart) === prefix) {
      return symbol.value;
    }
  }

  return "";
}

function toggleSymbol(symbol: string): void {
  const { doc, text, targetStart, targetEnd } = getSymbolTarget();
  const prefix = `${symbol} `;

  if (targetStart >= prefix.length && text.slice(targetStart - prefix.length, targetStart) === prefix) {
    const inner = text.slice(targetStart, targetEnd);
    applyReplacement(doc, targetStart - prefix.length, targetEnd, inner, {
      selectStartOffset: 0,
      selectEndOffset: inner.length,
    });
  } else if (targetStart !== targetEnd) {
    const inner = text.slice(targetStart, targetEnd);
    applyReplacement(doc, targetStart, targetEnd, prefix + inner, {
      selectStartOffset: prefix.length,
      selectEndOffset: prefix.length + inner.length,
    });
  } else {
    applyReplacement(doc, targetStart, targetEnd, prefix, {
      cursorOffset: prefix.length,
    });
  }

  cm.focus();
  refreshToolbarState();
}

function openSymbolMenu(button: HTMLElement): void {
  showButtonMenu(button, SYMBOLS.map((symbol) => ({
    label: `${symbol.label} ${symbol.value}`,
    action: () => toggleSymbol(symbol.value),
  })));
}

// ── Block-level snippets ──────────────────────────────────────────────────
// Each entry inserts a snippet on a fresh line below the cursor. We pad with
// surrounding blank lines so the inserted block isn't merged into the current
// paragraph by marked.

function insertBlockSnippet(snippet: string, selectionStartOffset?: number, selectionEndOffset?: number): void {
  const { doc, from } = selectionRange();
  const cursorLine = from.line as number;
  const lineText: string = doc.getLine(cursorLine) ?? "";
  const needLeadingBlank = lineText.trim().length > 0;
  const prefix = needLeadingBlank ? "\n\n" : (cursorLine === 0 ? "" : "\n");
  const full = `${prefix}${snippet}\n`;
  const insertPos = { line: cursorLine, ch: lineText.length };
  const insertIndex = doc.indexFromPos(insertPos);
  applyReplacement(doc, insertIndex, insertIndex, full, {
    selectStartOffset: selectionStartOffset != null ? prefix.length + selectionStartOffset : undefined,
    selectEndOffset: selectionEndOffset != null ? prefix.length + selectionEndOffset : undefined,
    cursorOffset: selectionStartOffset == null ? full.length : undefined,
  });
  cm.focus();
  refreshToolbarState();
}

function previewHtmlForLabel(src: MenuPreview | undefined): string {
  if (!src) return "";
  if (src.html) return src.html;
  if (src.renderMd) {
    const rendered = renderSnippetHtml(src.renderMd);
    if (!rendered) return "";
    // Tooltips are smaller than the help modal; embed the iframe with a
    // fixed inline width so srcdoc layout settles immediately.
    return `<iframe class="help-preview-frame help-preview-frame-tooltip" srcdoc="${escapeHtmlAttr(buildPreviewSrcdoc(rendered))}" style="width:100%;border:none;background:#fff;border-radius:4px;min-height:80px;"></iframe>`;
  }
  return "";
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPreviewSrcdoc(renderedHtml: string): string {
  // Inline cached pdf.css instead of <link rel=stylesheet href="...">.
  // Under Electron's file:// origin, relative URLs in srcdoc iframes don't
  // resolve (base href = file:/// can't reach the bundled assets). The
  // preview-renderer prefetches pdf.css on app load; we reuse that cache.
  const cachedCss = getCachedPdfCssSync();
  const pdfCssTag = cachedCss
    ? `<style>${cachedCss}</style>`
    : `<link rel="stylesheet" href="css/preview/pdf.css">`;
  return `<!DOCTYPE html><html><head><base href="${location.origin}/">${pdfCssTag}<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=JetBrains+Mono&family=Source+Serif+4&display=swap" rel="stylesheet"><style>html,body{margin:0;padding:0;background:#fff;}body{padding:10px;font-size:7.5pt;}@page{margin:0;}.pdf-content{padding:0;}section.level2{padding:0;}section.level2>:first-child{margin-top:0;}section.level2>:last-child{margin-bottom:0;}.md-heatmap{font-size:6.5pt;}.md-stat-tiles-value{font-size:12pt;}.md-numbered-grid-num{font-size:14pt;}</style></head><body><section class="level2" style="${PREVIEW_SECTION_VARS}"><div class="pdf-content" style="${PREVIEW_SECTION_VARS}">${renderedHtml}</div></section></body></html>`;
}

function blockItem(label: string, action: () => void): { label: string; action: () => void; preview?: string } {
  return { label, action, preview: previewHtmlForLabel(BLOCK_PREVIEWS[label]) };
}

function openBlocksMenu(button: HTMLElement): void {
  showButtonMenu(button, [
    blockItem("Bullet list", () => insertBlockSnippet("- Item 1\n- Item 2\n- Item 3", 2, 8)),
    blockItem("Numbered list", () => insertBlockSnippet("1. First\n2. Second\n3. Third", 3, 8)),
    blockItem("Blockquote", () => insertBlockSnippet("> Quote text.", 2, 13)),
    { separator: true },
    blockItem("Code block", () => insertBlockSnippet("```\ncode\n```", 4, 8)),
    blockItem("Horizontal rule", () => insertBlockSnippet("---")),
    { separator: true },
    blockItem("Page break  (:::newpage)", () => insertBlockSnippet(":::newpage")),
    blockItem("Spacer  (:::spacer 20px)", () => insertBlockSnippet(":::spacer 20px")),
  ]);
}

function compItem(label: string, action: () => void): { label: string; action: () => void; preview?: string } {
  return { label, action, preview: previewHtmlForLabel(COMPONENT_PREVIEWS[label]) };
}

function openComponentsMenu(button: HTMLElement): void {
  showButtonMenu(button, [
    compItem("Alert — Info", () => insertBlockSnippet(":::info\nInformation message.\n:::", 7, 26)),
    compItem("Alert — Warning", () => insertBlockSnippet(":::warning\nWarning message.\n:::", 11, 27)),
    compItem("Alert — Danger", () => insertBlockSnippet(":::danger\nCritical message.\n:::", 10, 27)),
    compItem("Alert — Success", () => insertBlockSnippet(":::success\nSuccess message.\n:::", 11, 27)),
    compItem("Alert — Note", () => insertBlockSnippet(":::note\nEditorial note.\n:::", 8, 22)),
    compItem("Alert — Tip", () => insertBlockSnippet(":::tip\nHelpful tip.\n:::", 7, 18)),
    { separator: true },
    compItem("Stat tiles", () =>
      insertBlockSnippet(
        ":::stat-tiles\n18 ans | Expertise portails | Depuis 2007\n100+ | Projets livrés\n< 4 h | Temps de réponse garanti | SLA P1\n99,9 % | Disponibilité cible\n:::",
      ),
    ),
    compItem("Numbered grid", () =>
      insertBlockSnippet(
        ":::numbered-grid\nQualité | Zéro régression, revue systématique\nRéactivité | SLA < 4 h, astreinte 24/7\nSécurité | DevSecOps intégré, audits\n:::",
      ),
    ),
    compItem("Card grid", () =>
      insertBlockSnippet(
        ':::ao-grid\n:::card title="Cadrage" phase="Phase 1" num="01"\n- Atelier besoins\n- Architecture cible\n:::\n\n:::card title="Implémentation" phase="Phase 2" num="02"\n- Dev itératif\n- Tests automatisés\n:::\n:::',
      ),
    ),
    compItem("Heatmap", () =>
      insertBlockSnippet(
        ":::heatmap\ncolumns: S1, S2, S3:mise, S4:expl, S5:expl, S6:fin\nmilestones: Kick-off@0, Go-live@3:Prod, Clôture@6\n---\nAnalyse | X X o . . .\nDéveloppement | . X X X . .\nTests | . . X X X .\nProduction | . . . o X X\n:::",
      ),
    ),
    compItem("Quote", () =>
      insertBlockSnippet(':::quote author="Nom Prénom" role="Rôle"\nTexte de la citation.\n:::'),
    ),
    compItem("Timeline", () =>
      insertBlockSnippet(
        ":::timeline\n:::step Étape 1 | J+0\nDescription de l'étape 1.\n:::step Étape 2 | J+5\nDescription de l'étape 2.\n:::step Étape 3 | J+10\nDescription de l'étape 3.\n:::",
      ),
    ),
    { separator: true },
    compItem("12-col grid  (ao-grid)", () =>
      insertBlockSnippet(
        ":::ao-grid\n:::col-8\nColonne principale (8/12)\n:::col-4\nColonne latérale (4/12)\n:::",
      ),
    ),
  ]);
}

// ── Help modal ─────────────────────────────────────────────────────────────

interface HelpItem {
  name: string;
  desc: string;
  syntax: string;
  // `renderMd` means: render this markdown snippet through marked and drop
  // the result into a sandbox iframe that loads pdf.css. That way the
  // preview matches the real preview exactly (alert chips with their real
  // SVG icons, stat-tiles / numbered-grid / cards / heatmap / timeline, etc.).
  // `preview` is a static inline-styled HTML string for things that don't
  // exercise pdf.css (bold/italic/heading mockup).
  renderMd?: string;
  preview?: string;
}
interface HelpCategory {
  title: string;
  items: HelpItem[];
}

// ── Live-render sandbox iframe ─────────────────────────────────────────────
// srcdoc iframes inherit the parent's URL as their base so the <link> to
// pdf.css resolves. The iframe gets a minimal wrapper that matches the real
// preview's section context (`<section class="level2">` + `.pdf-content`).
// After load, we size the iframe to its content's height so previews don't
// scroll internally.

const PREVIEW_SECTION_VARS =
  "--section-color:#3373b3;--section-color-light:#7ab4e8;";

function makePreviewIframe(renderedHtml: string, maxWidthPx = 260): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.className = "help-preview-frame";
  iframe.style.cssText =
    `width:100%;border:none;background:#fff;border-radius:4px;min-height:60px;`;
  const cachedCss = getCachedPdfCssSync();
  const pdfCssTag = cachedCss
    ? `<style>${cachedCss}</style>`
    : `<link rel="stylesheet" href="css/preview/pdf.css">`;
  const src = `<!DOCTYPE html>
<html>
<head>
<base href="${location.origin}/">
${pdfCssTag}
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=JetBrains+Mono&family=Source+Serif+4&display=swap" rel="stylesheet">
<style>
  html, body { margin:0; padding:0; background:#fff; }
  body { padding:12px; font-size:8pt; }
  /* Trim print-only resets that otherwise leave tiny margins visible. */
  @page { margin:0; }
  .pdf-content { padding:0; }
  /* Keep components visually tight so they fit a 260px tooltip. */
  section.level2 { padding:0; }
  section.level2 > :first-child { margin-top:0; }
  section.level2 > :last-child { margin-bottom:0; }
  .md-heatmap { font-size:7pt; }
  .md-stat-tiles-value { font-size:14pt; }
  .md-numbered-grid-num { font-size:16pt; }
</style>
</head>
<body>
<section class="level2" style="${PREVIEW_SECTION_VARS}">
  <div class="pdf-content" style="${PREVIEW_SECTION_VARS}">${renderedHtml}</div>
</section>
<script>
  // Report content height so the parent can size the iframe.
  function report() {
    const h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    parent.postMessage({ type: "help-preview-size", h, id: ${JSON.stringify("preview-" + Math.random())} }, "*");
  }
  window.addEventListener("load", () => setTimeout(report, 50));
  // Mermaid / fonts can reflow after load; send once more.
  setTimeout(report, 500);
</script>
</body>
</html>`;
  iframe.srcdoc = src;
  iframe.addEventListener("load", () => {
    const fit = (): void => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const h = Math.max(doc.body?.scrollHeight || 0, doc.documentElement?.scrollHeight || 0);
        if (h > 0) iframe.style.height = `${h}px`;
      } catch {
        /* cross-origin (shouldn't happen for srcdoc) */
      }
    };
    fit();
    setTimeout(fit, 120);
    setTimeout(fit, 500);
  });
  void maxWidthPx;
  return iframe;
}

// Render a markdown snippet to HTML using the globally-configured marked
// instance. Works for `:::info`, `:::stat-tiles`, `:::numbered-grid`, etc. because those
// extensions are registered in section-pipeline at module load. Headings
// need the section-pipeline's per-render _ctx so we avoid them here and
// fall back to static previews for anything heading-driven.
function renderSnippetHtml(md: string): string {
  try {
    const html = (window as any).marked?.parse?.(md) ?? "";
    return typeof html === "string" ? html : "";
  } catch {
    return "";
  }
}

function previewNode(item: HelpItem): HTMLElement | string {
  if (item.renderMd) {
    const html = renderSnippetHtml(item.renderMd);
    if (html) return makePreviewIframe(html);
  }
  if (item.preview) return item.preview;
  return "";
}

// ── Inline-styled preview mockups ──────────────────────────────────────────
// Fonts, colours and box styles chosen to match the real preview roughly —
// not pixel-perfect, but enough to recognise a component at a glance.

const PV_FONT = "font-family:Nunito,sans-serif";
const alertMock = (label: string, body: string, color: string, bg: string): string => `
  <div style="${PV_FONT};border-left:3px solid ${color};background:${bg};padding:10px 12px;border-radius:4px;color:#1f2937;">
    <div style="display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${color};margin-bottom:4px;">${label}</div>
    <div style="font-size:12px;">${body}</div>
  </div>`;

const previewBold = `<span style="${PV_FONT};font-weight:700;color:#1f2937;">bold text</span>`;
const previewItalic = `<span style="${PV_FONT};font-style:italic;color:#1f2937;">italic text</span>`;
const previewUnderline = `<span style="${PV_FONT};text-decoration:underline;color:#1f2937;">underlined</span>`;
const previewCode = `<code style="background:#1e293b;color:#a6e3a1;padding:2px 6px;border-radius:3px;font-family:JetBrains Mono,monospace;font-size:11px;">code</code>`;
const previewLink = `<a href="#" style="${PV_FONT};color:#3373b3;text-decoration:underline;">label</a>`;

const previewHeadings = `
  <div style="${PV_FONT};color:#1f2937;">
    <div style="font-size:20px;font-weight:800;color:#193658;margin-bottom:4px;">H1 Title</div>
    <div style="font-size:16px;font-weight:700;color:#3373b3;margin-bottom:4px;"><span style="background:#3373b3;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;margin-right:6px;">1.1</span>H2 Subtitle</div>
    <div style="font-size:14px;font-weight:600;color:#493a8b;"><span style="color:#493a8b;font-size:11px;margin-right:6px;">1.1.1</span>● H3 Section</div>
  </div>`;

const previewList = `
  <ul style="${PV_FONT};color:#1f2937;font-size:12px;margin:0;padding-left:20px;line-height:1.6;">
    <li>Item 1</li><li>Item 2</li><li>Item 3</li>
  </ul>`;
const previewOrderedList = `
  <ol style="${PV_FONT};color:#1f2937;font-size:12px;margin:0;padding-left:20px;line-height:1.6;">
    <li>First</li><li>Second</li><li>Third</li>
  </ol>`;
const previewBlockquote = `
  <blockquote style="${PV_FONT};margin:0;padding:8px 12px;border-left:3px solid #3373b3;background:#f1f5f9;color:#334155;font-style:italic;font-size:12px;">
    Quote text.
  </blockquote>`;
const previewHr = `<hr style="border:none;border-top:1px solid #cbd5e1;margin:10px 0;" />`;
const previewPageBreak = `
  <div style="${PV_FONT};display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;">
    <span style="flex:1;border-top:1.5px dashed #94a3b8;"></span>
    <span>Page break</span>
    <span style="flex:1;border-top:1.5px dashed #94a3b8;"></span>
  </div>`;
const previewSpacer = `
  <div style="${PV_FONT};color:#64748b;font-size:10px;font-style:italic;border:1px dashed #cbd5e1;border-radius:3px;padding:10px;text-align:center;">
    ↕ 40px vertical spacer (invisible)
  </div>`;
const previewCodeBlock = `
  <pre style="background:#0f172a;color:#a6e3a1;padding:10px 12px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:11px;margin:0;overflow-x:auto;"><span style="color:#cba6f7;">const</span> x <span style="color:#e2e8f0;">=</span> <span style="color:#f9e2af;">1</span>;</pre>`;

const previewTable = `
  <table style="${PV_FONT};border-collapse:collapse;font-size:11px;color:#1f2937;width:100%;">
    <thead><tr><th style="background:#193658;color:#fff;padding:6px 10px;text-align:left;">Header</th><th style="background:#193658;color:#fff;padding:6px 10px;text-align:left;">Cell</th></tr></thead>
    <tbody><tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">A</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">B</td></tr><tr><td style="padding:6px 10px;">C</td><td style="padding:6px 10px;">D</td></tr></tbody>
  </table>`;
const previewImage = `
  <figure style="${PV_FONT};margin:0;text-align:center;">
    <div style="background:#cbd5e1;height:80px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:11px;">image</div>
    <figcaption style="color:#64748b;font-size:10px;margin-top:4px;">Caption</figcaption>
  </figure>`;
const previewMermaid = `
  <div style="${PV_FONT};background:#f8f9fc;border:1px dashed #cbd5e1;border-radius:4px;padding:16px;text-align:center;color:#64748b;font-size:11px;">
    <span style="display:inline-block;background:#3373b3;color:#fff;padding:2px 10px;border-radius:3px;">A</span>
    <span style="margin:0 8px;">→</span>
    <span style="display:inline-block;background:#3373b3;color:#fff;padding:2px 10px;border-radius:3px;">B</span>
  </div>`;

const previewStatTiles = `
  <div style="${PV_FONT};display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
    <div style="background:#f1f5f9;padding:12px;border-radius:4px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#193658;">18 ans</div><div style="font-size:10px;color:#64748b;margin-top:2px;">Expertise</div></div>
    <div style="background:#f1f5f9;padding:12px;border-radius:4px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#193658;">100+</div><div style="font-size:10px;color:#64748b;margin-top:2px;">Projets</div></div>
    <div style="background:#f1f5f9;padding:12px;border-radius:4px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#193658;">&lt; 4 h</div><div style="font-size:10px;color:#64748b;margin-top:2px;">Temps</div></div>
    <div style="background:#f1f5f9;padding:12px;border-radius:4px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#193658;">99,9 %</div><div style="font-size:10px;color:#64748b;margin-top:2px;">Dispo</div></div>
  </div>`;
const previewNumberedGrid = `
  <div style="${PV_FONT};display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
    <div style="border-top:3px solid #193658;padding:10px 8px;background:#f8f9fc;"><div style="font-size:14px;font-weight:800;color:#193658;">01</div><div style="font-size:11px;font-weight:700;color:#193658;margin-top:4px;">Qualité</div><div style="font-size:10px;color:#64748b;margin-top:2px;">Zéro régression</div></div>
    <div style="border-top:3px solid #3373b3;padding:10px 8px;background:#f8f9fc;"><div style="font-size:14px;font-weight:800;color:#3373b3;">02</div><div style="font-size:11px;font-weight:700;color:#3373b3;margin-top:4px;">Réactivité</div><div style="font-size:10px;color:#64748b;margin-top:2px;">SLA &lt; 4 h</div></div>
    <div style="border-top:3px solid #0096ae;padding:10px 8px;background:#f8f9fc;"><div style="font-size:14px;font-weight:800;color:#0096ae;">03</div><div style="font-size:11px;font-weight:700;color:#0096ae;margin-top:4px;">Sécurité</div><div style="font-size:10px;color:#64748b;margin-top:2px;">DevSecOps</div></div>
  </div>`;
const previewCardGrid = `
  <div style="${PV_FONT};display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:11px;color:#1f2937;">
    <div style="background:#f8f9fc;padding:8px 10px;border-left:3px solid #193658;"><div style="font-weight:700;"><span style="color:#193658;">01</span> Cadrage · <em style="color:#64748b;">Phase 1</em></div><ul style="margin:4px 0 0 16px;padding:0;font-size:10px;color:#334155;"><li>Atelier besoins</li><li>Architecture</li></ul></div>
    <div style="background:#f8f9fc;padding:8px 10px;border-left:3px solid #3373b3;"><div style="font-weight:700;"><span style="color:#3373b3;">02</span> Implémentation · <em style="color:#64748b;">Phase 2</em></div><ul style="margin:4px 0 0 16px;padding:0;font-size:10px;color:#334155;"><li>Dev itératif</li><li>Tests</li></ul></div>
  </div>`;
const previewHeatmap = `
  <div style="${PV_FONT};font-size:10px;color:#1f2937;">
    <div style="display:grid;grid-template-columns:80px repeat(6,1fr);gap:2px;color:#64748b;font-size:9px;text-align:center;margin-bottom:4px;">
      <div></div><div>S1</div><div>S2</div><div>S3</div><div>S4</div><div>S5</div><div>S6</div>
    </div>
    <div style="display:grid;grid-template-columns:80px repeat(6,1fr);gap:2px;margin-bottom:2px;color:#193658;">
      <div style="font-weight:700;">Analyse</div><div style="background:#193658;height:10px;border-radius:2px;"></div><div style="background:#193658;height:10px;border-radius:2px;"></div><div style="background:#193658;opacity:0.3;height:10px;border-radius:2px;"></div><div></div><div></div><div></div>
    </div>
    <div style="display:grid;grid-template-columns:80px repeat(6,1fr);gap:2px;margin-bottom:2px;color:#3373b3;">
      <div style="font-weight:700;">Dev</div><div></div><div style="background:#3373b3;height:10px;border-radius:2px;"></div><div style="background:#3373b3;height:10px;border-radius:2px;"></div><div style="background:#3373b3;height:10px;border-radius:2px;"></div><div></div><div></div>
    </div>
  </div>`;
const previewQuote = `
  <blockquote style="${PV_FONT};margin:0;padding:12px 16px;background:#f1f5f9;border-left:4px solid #193658;color:#1f2937;font-size:12px;">
    <div style="font-style:italic;">"Texte de la citation."</div>
    <footer style="margin-top:6px;font-size:10px;color:#64748b;">— <cite style="font-style:normal;font-weight:700;">Nom Prénom</cite> <span>· Rôle</span></footer>
  </blockquote>`;
const previewTimeline = `
  <div style="${PV_FONT};font-size:11px;color:#1f2937;position:relative;padding-left:22px;">
    <div style="position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:#cbd5e1;"></div>
    <div style="position:relative;margin-bottom:10px;"><span style="position:absolute;left:-19px;top:3px;width:10px;height:10px;border-radius:50%;background:#193658;"></span><div style="font-weight:700;">Étape 1 <span style="color:#64748b;font-size:10px;">· J+0</span></div></div>
    <div style="position:relative;margin-bottom:10px;"><span style="position:absolute;left:-19px;top:3px;width:10px;height:10px;border-radius:50%;background:#3373b3;"></span><div style="font-weight:700;">Étape 2 <span style="color:#64748b;font-size:10px;">· J+5</span></div></div>
    <div style="position:relative;"><span style="position:absolute;left:-19px;top:3px;width:10px;height:10px;border-radius:50%;background:#0096ae;"></span><div style="font-weight:700;">Étape 3 <span style="color:#64748b;font-size:10px;">· J+10</span></div></div>
  </div>`;
const previewGrid = `
  <div style="${PV_FONT};display:grid;grid-template-columns:2fr 1fr;gap:8px;font-size:11px;color:#1f2937;">
    <div style="background:#eff6ff;padding:10px 12px;border-radius:3px;">Colonne principale <span style="color:#64748b;">(8/12)</span></div>
    <div style="background:#fef3c7;padding:10px 12px;border-radius:3px;">Latérale <span style="color:#64748b;">(4/12)</span></div>
  </div>`;
const previewStyle = `
  <div style="${PV_FONT};color:#1f2937;">
    <div style="font-weight:700;margin-bottom:16px;padding-bottom:8px;"><span style="background:#e0c070;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;margin-right:6px;">2.1</span>Heading with mt=16 pb=8</div>
    <div style="font-size:10px;color:#64748b;font-family:JetBrains Mono,monospace;background:#f8f9fc;padding:4px 8px;border-radius:3px;">## Heading {:style mt=16 pb=8}</div>
  </div>`;

const HELP_CATEGORIES: HelpCategory[] = [
  {
    title: "Inline formatting",
    items: [
      { name: "Bold", desc: "Emphasise a span of text.", syntax: "**bold text**", preview: previewBold },
      { name: "Italic", desc: "Italicise a span of text.", syntax: "*italic text*", preview: previewItalic },
      { name: "Underline", desc: "Inline HTML — passes through the renderer.", syntax: "<u>underlined</u>", preview: previewUnderline },
      { name: "Inline code", desc: "Fixed-width span.", syntax: "`code`", preview: previewCode },
      { name: "Link", desc: "External or anchor link.", syntax: "[label](https://example.com)", preview: previewLink },
    ],
  },
  {
    title: "Text structure",
    items: [
      { name: "Headings (h1–h4)", desc: "Section titles. First digit of the number badge comes from the filename (`01-foo.md` → 1.x) or an explicit `# Partie N` header.", syntax: "# H1\n## H2\n### H3\n#### H4", preview: previewHeadings },
      { name: "Bullet list", desc: "Unordered list.", syntax: "- Item 1\n- Item 2", preview: previewList },
      { name: "Numbered list", desc: "Ordered list.", syntax: "1. First\n2. Second", preview: previewOrderedList },
      { name: "Blockquote", desc: "Quoted paragraph.", syntax: "> Quote text.", preview: previewBlockquote },
      { name: "Horizontal rule", desc: "Section divider.", syntax: "---", preview: previewHr },
      { name: "Code block", desc: "Fenced code; optional language for syntax highlighting.", syntax: "```js\nconst x = 1;\n```", preview: previewCodeBlock },
    ],
  },
  {
    title: "Media",
    items: [
      { name: "Table", desc: "GitHub-Flavored Markdown table.", syntax: "| H1 | H2 |\n| -- | -- |\n| a  | b  |", preview: previewTable },
      { name: "Image", desc: "Standalone image renders as a figure with optional caption.", syntax: "![Caption](./image.png)", preview: previewImage },
      { name: "Image (aligned, sized)", desc: "Pipe-separated options after the URL: alignment (left|center|right) and max-width.", syntax: "![Caption](./image.png|right|200px)", preview: previewImage },
      { name: "Mermaid diagram", desc: "Rendered via Mermaid 11 into an SVG.", syntax: "```mermaid\nflowchart LR\n  A --> B\n```", preview: previewMermaid },
    ],
  },
  {
    title: "Page flow",
    items: [
      { name: "Page break", desc: "Force a page break at the current location (export + preview).", syntax: ":::newpage", preview: previewPageBreak },
      { name: "Spacer", desc: "Invisible full-width block with a caller-chosen height. Accepts any CSS length.", syntax: ":::spacer 40px\n\nor\n\n:::spacer 2rem", preview: previewSpacer },
    ],
  },
  {
    title: "Alert containers",
    items: [
      { name: ":::info", desc: "Editorial information.", syntax: ":::info\nInformation message.\n:::", renderMd: ":::info\nInformation message.\n:::" },
      { name: ":::warning", desc: "Caution or reminder.", syntax: ":::warning\nWarning message.\n:::", renderMd: ":::warning\nWarning message.\n:::" },
      { name: ":::danger", desc: "Critical issue.", syntax: ":::danger\nCritical message.\n:::", renderMd: ":::danger\nCritical message.\n:::" },
      { name: ":::success", desc: "Positive outcome.", syntax: ":::success\nSuccess message.\n:::", renderMd: ":::success\nSuccess message.\n:::" },
      { name: ":::note", desc: "Annotation or aside.", syntax: ":::note\nEditorial note.\n:::", renderMd: ":::note\nEditorial note.\n:::" },
      { name: ":::tip", desc: "Helpful advice.", syntax: ":::tip\nHelpful tip.\n:::", renderMd: ":::tip\nHelpful tip.\n:::" },
    ],
  },
  {
    title: "BEORN layout components",
    items: [
      { name: ":::stat-tiles", desc: "Grid of large-number tiles with label and optional note. One non-empty line per tile. Syntax: `VALUE | LABEL | NOTE`. NOTE is optional.", syntax: ":::stat-tiles\n18 ans | Expertise portails | Depuis 2007\n100+ | Projets livrés\n< 4 h | Temps de réponse | SLA P1\n99,9 % | Disponibilité cible\n:::", renderMd: ":::stat-tiles\n18 ans | Expertise | Depuis 2007\n100+ | Projets livrés\n< 4 h | Réponse\n99,9 % | Dispo\n:::" },
      { name: ":::numbered-grid", desc: "Numbered tile grid (auto 01-07, capped at 7). Syntax: `TITLE | PITCH`.", syntax: ":::numbered-grid\nQualité | Zéro régression\nRéactivité | SLA < 4 h\nSécurité | DevSecOps intégré\n:::", renderMd: ":::numbered-grid\nQualité | Zéro régression\nRéactivité | SLA < 4 h\nSécurité | DevSecOps\n:::" },
      { name: ":::card", desc: "Standalone card (title + phase tag + body). Embed multiple `:::card` inside `:::ao-grid` to lay them out in a 4-up grid with palette rotation.", syntax: ':::ao-grid\n:::card title="Cadrage" phase="Phase 1" num="01"\n- Atelier besoins\n- Architecture\n:::\n:::card title="Implémentation" phase="Phase 2" num="02"\n- Dev itératif\n- Tests\n:::\n:::', renderMd: ':::ao-grid\n:::card title="Cadrage" phase="Phase 1" num="01"\n- Atelier besoins\n- Architecture\n:::\n:::card title="Implémentation" phase="Phase 2" num="02"\n- Dev itératif\n:::\n:::' },
      { name: ":::feature", desc: "Standalone fiche de fonctionnalité (titre + statut + niveau + description + image optionnelle). Embed dans `:::ao-grid` pour disposer plusieurs fiches : `layout=\"row\"` = pleine largeur, `layout=\"col\"` = demi-largeur.", syntax: ':::ao-grid\n:::feature title="Brouillons" status="conforme" level="obligatoire"\nSave as draft natif sur tous les content types.\n:::\n:::', renderMd: ':::ao-grid\n:::feature title="Brouillons" status="conforme" level="obligatoire"\nSave as draft natif sur tous les content types.\n:::\n:::' },
      { name: ":::heatmap", desc: "Heat matrix with optional milestone track. Config block (columns/milestones) + `---` + data rows `Title | T T T …` where T is X/■ = on, o/• = event, else off.", syntax: ":::heatmap\ncolumns: S1, S2, S3:mise, S4:expl, S5:fin\nmilestones: Kick-off@0, Go-live@3\n---\nAnalyse | X X o . .\nDev     | . X X X .\n:::", renderMd: ":::heatmap\ncolumns: S1, S2, S3:mise, S4:expl, S5:fin\nmilestones: Kick-off@0, Go-live@3\n---\nAnalyse | X X o . .\nDev | . X X X .\nTests | . . X X X\n:::" },
      { name: ":::quote", desc: "Blockquote with author/role attribution.", syntax: ':::quote author="Nom Prénom" role="Rôle"\nTexte de la citation.\n:::', renderMd: ':::quote author="Nom Prénom" role="Rôle"\nTexte de la citation.\n:::' },
      { name: ":::timeline", desc: "Vertical timeline. Each `:::step TITLE | META` starts a new step with markdown body.", syntax: ":::timeline\n:::step Étape 1 | J+0\nDescription.\n:::step Étape 2 | J+5\nDescription.\n:::", renderMd: ":::timeline\n:::step Étape 1 | J+0\nDescription.\n:::step Étape 2 | J+5\nDescription.\n:::step Étape 3 | J+10\nDescription.\n:::" },
      { name: ":::ao-grid", desc: "Grille 12 colonnes. `:::col-N` (N = 1..12) fixe la largeur ; `:::col` (sans largeur) partage à parts égales les colonnes restantes.", syntax: ":::ao-grid\n:::col-8\nColonne principale\n:::col\nColonne latérale (largeur auto)\n:::", renderMd: ":::ao-grid\n:::col-8\nColonne principale (8/12)\n:::col\nLatérale (auto 4/12)\n:::" },
    ],
  },
  {
    title: "Style directive",
    items: [
      { name: "{:style …}", desc: "Inline per-block spacing override. Goes at the end of the block's first source line. Keys: mt/mr/mb/ml/pt/pr/pb/pl. Values are raw px (0–500). Use the Style Mode toggle for a visual editor.", syntax: "## Heading {:style mt=16 pb=8}\n\nParagraph. {:style mt=24}\n\n--- {:style mt=32 mb=32}", preview: previewStyle },
    ],
  },
  {
    title: "Frontmatter",
    items: [
      { name: "Document metadata", desc: "Optional YAML-like frontmatter at the top of each file. Read by the renderer for document-wide settings.", syntax: "---\ntitle: \"Document title\"\ndoctype: \"Mémoire technique\"\n---" },
    ],
  },
];

// Map component-menu labels to their preview source — either a markdown
// snippet (renderMd) to sandbox-render via pdf.css, or a static HTML mock
// for things that don't exercise the real renderer.
interface MenuPreview {
  renderMd?: string;
  html?: string;
}

const COMPONENT_PREVIEWS: Record<string, MenuPreview> = {
  "Alert — Info": { renderMd: ":::info\nInformation message.\n:::" },
  "Alert — Warning": { renderMd: ":::warning\nWarning message.\n:::" },
  "Alert — Danger": { renderMd: ":::danger\nCritical message.\n:::" },
  "Alert — Success": { renderMd: ":::success\nSuccess message.\n:::" },
  "Alert — Note": { renderMd: ":::note\nEditorial note.\n:::" },
  "Alert — Tip": { renderMd: ":::tip\nHelpful tip.\n:::" },
  "Stat tiles": { renderMd: ":::stat-tiles\n18 ans | Expertise | Depuis 2007\n100+ | Projets\n< 4 h | Réponse\n99,9 % | Dispo\n:::" },
  "Numbered grid": { renderMd: ":::numbered-grid\nQualité | Zéro régression\nRéactivité | SLA < 4 h\nSécurité | DevSecOps\n:::" },
  "Card grid": { renderMd: ':::ao-grid\n:::card title="Cadrage" phase="Phase 1" num="01"\n- Atelier\n- Architecture\n:::\n:::card title="Impl" phase="Phase 2" num="02"\n- Dev\n:::\n:::' },
  "Heatmap": { renderMd: ":::heatmap\ncolumns: S1, S2, S3:mise, S4:expl, S5:fin\nmilestones: Kick@0, Go-live@3\n---\nAnalyse | X X o . .\nDev | . X X X .\n:::" },
  "Quote": { renderMd: ':::quote author="Nom Prénom" role="Rôle"\nTexte de la citation.\n:::' },
  "Timeline": { renderMd: ":::timeline\n:::step Étape 1 | J+0\nDescription.\n:::step Étape 2 | J+5\nDescription.\n:::" },
  "12-col grid  (ao-grid)": { renderMd: ":::ao-grid\n:::col-8\nColonne principale\n:::col-4\nLatérale\n:::" },
};

const BLOCK_PREVIEWS: Record<string, MenuPreview> = {
  "Bullet list": { renderMd: "- Item 1\n- Item 2\n- Item 3" },
  "Numbered list": { renderMd: "1. First\n2. Second\n3. Third" },
  "Blockquote": { renderMd: "> Quote text." },
  "Code block": { renderMd: "```js\nconst x = 1;\n```" },
  "Horizontal rule": { renderMd: "---" },
  "Page break  (:::newpage)": { html: previewPageBreak },
  "Spacer  (:::spacer 20px)": { html: previewSpacer },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let _helpBuilt = false;

function openHelpModal(): void {
  const overlay = document.getElementById("helpModal");
  if (!overlay) return;
  if (!_helpBuilt) {
    const body = document.getElementById("helpBody");
    if (body) {
      // Render category shells with placeholders for previews; we'll mount
      // the preview iframes / static mockups after innerHTML is set so they
      // aren't clobbered by the template literal.
      body.innerHTML = HELP_CATEGORIES.map((cat, ci) => `
        <div class="help-category">
          <div class="help-category-title">${escapeHtml(cat.title)}</div>
          ${cat.items.map((item, ii) => {
            const hasPreview = !!(item.renderMd || item.preview);
            return `
            <div class="help-item${hasPreview ? " has-preview" : ""}" data-cat="${ci}" data-idx="${ii}">
              <div class="help-item-head">
                <div class="help-item-name">${escapeHtml(item.name)}</div>
                <div class="help-item-desc">${escapeHtml(item.desc)}</div>
              </div>
              <pre class="help-item-syntax">${escapeHtml(item.syntax)}</pre>
              ${hasPreview ? `<div class="help-item-preview" data-cat="${ci}" data-idx="${ii}"></div>` : ""}
            </div>
          `;
          }).join("")}
        </div>
      `).join("");
      // Mount previews (either iframes or static HTML).
      for (const slot of body.querySelectorAll<HTMLElement>(".help-item-preview")) {
        const ci = Number(slot.dataset.cat);
        const ii = Number(slot.dataset.idx);
        const item = HELP_CATEGORIES[ci]?.items[ii];
        if (!item) continue;
        const node = previewNode(item);
        if (node instanceof HTMLElement) {
          slot.appendChild(node);
        } else if (typeof node === "string" && node) {
          slot.innerHTML = node;
        }
      }
    }
    const closeBtn = document.getElementById("btnHelpClose");
    closeBtn?.addEventListener("click", closeHelpModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeHelpModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("active")) closeHelpModal();
    });
    _helpBuilt = true;
  }
  overlay.classList.add("active");
}

function closeHelpModal(): void {
  const overlay = document.getElementById("helpModal");
  overlay?.classList.remove("active");
}

function isSeparatorLine(line: string): boolean {
  return /^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(line || "");
}

function parseTableLine(line: string): string[] {
  const cells = (line || "").split("|").slice(1);
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((cell) => cell.trim());
}

function toggleTableBlock(): void {
  const { doc } = selectionRange();
  const range = getTableRangeAt(cm.getCursor("from").line);

  if (!range) {
    insertTable();
    cm.focus();
    refreshToolbarState();
    return;
  }

  const plainLines = [];
  for (let lineNo = range.start; lineNo <= range.end; lineNo += 1) {
    const line = doc.getLine(lineNo) || "";
    if (isSeparatorLine(line)) continue;
    plainLines.push(parseTableLine(line).join("\t"));
  }

  const replacement = plainLines.join("\n");
  const start = doc.indexFromPos({ line: range.start, ch: 0 });
  const end = doc.indexFromPos({ line: range.end, ch: (doc.getLine(range.end) || "").length });
  applyReplacement(doc, start, end, replacement, {
    selectStartOffset: 0,
    selectEndOffset: replacement.length,
  });
  cm.focus();
  refreshToolbarState();
}

function getFenceBlockAtLine(lineNum: number): { startLine: number; endLine: number; lang: string } | null {
  let open = null;
  const lastLine = cm.lastLine();

  for (let i = 0; i <= lastLine; i += 1) {
    const line = (cm.getLine(i) || "").trim();
    if (!line.startsWith("```")) continue;

    if (!open) {
      open = {
        startLine: i,
        lang: line.slice(3).trim().toLowerCase(),
      };
      continue;
    }

    const block = {
      startLine: open.startLine,
      endLine: i,
      lang: open.lang,
    };
    if (lineNum >= block.startLine && lineNum <= block.endLine) return block;
    open = null;
  }

  return null;
}

function getMermaidBlockForSelection(): { startLine: number; endLine: number; lang: string } | null {
  const { from } = selectionRange();
  const { endLine } = getSelectedLineRange();
  const block = getFenceBlockAtLine(from.line);
  if (!block || block.lang !== "mermaid") return null;
  return endLine <= block.endLine ? block : null;
}

function toggleMermaidBlock(): void {
  const { doc, from, to, start, end, hasSelection } = selectionRange();
  const block = getMermaidBlockForSelection();

  if (block) {
    const innerLines = [];
    for (let lineNo = block.startLine + 1; lineNo < block.endLine; lineNo += 1) {
      innerLines.push(doc.getLine(lineNo) || "");
    }

    const replacement = innerLines.join("\n");
    const blockStart = doc.indexFromPos({ line: block.startLine, ch: 0 });
    const blockEnd = doc.indexFromPos({
      line: block.endLine,
      ch: (doc.getLine(block.endLine) || "").length,
    });

    applyReplacement(doc, blockStart, blockEnd, replacement, {
      selectStartOffset: 0,
      selectEndOffset: replacement.length,
    });
    cm.focus();
    refreshToolbarState();
    return;
  }

  if (hasSelection) {
    const selectionText = doc.getRange(from, to);
    const wrapped = `\`\`\`mermaid\n${selectionText}\n\`\`\``;
    applyReplacement(doc, start, end, wrapped, {
      selectStartOffset: 11,
      selectEndOffset: 11 + selectionText.length,
    });
    cm.focus();
    refreshToolbarState();
    return;
  }

  const blockText = [
    "```mermaid",
    "flowchart TD",
    "  A[Start] --> B[Next step]",
    "```",
  ].join("\n");
  const editableText = "flowchart TD\n  A[Start] --> B[Next step]";
  const offset = blockText.indexOf(editableText);
  insertSnippet(blockText, offset, offset + editableText.length);
  refreshToolbarState();
}

async function insertImages(files: File[]): Promise<void> {
  const tab = getActiveTab();
  if (!tab?.path) {
    status.textContent = "Save the Markdown file before inserting images";
    return;
  }

  const assets = [];
  for (const file of files) {
    try {
      assets.push(await saveImageAsset(tab.path, file));
    } catch (err: any) {
      status.textContent = "Failed to insert image: " + err.message;
      return;
    }
  }

  if (!assets.length) return;

  const markdown = assets
    .map((asset) => `![${asset.altText}](${asset.markdownPath})`)
    .join("\n\n");
  replaceSelection(markdown);
  status.textContent = assets.length === 1
    ? "Inserted image " + assets[0].markdownPath
    : "Inserted " + assets.length + " images";
}

function setButtonActive(id: string, active: boolean): void {
  const button = document.getElementById(id);
  if (!button) return;
  button.classList.toggle("active", !!active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
}

function refreshToolbarState(): void {
  setButtonActive("btnFmtBold", getInlineFormatContext("**", "**").active);
  setButtonActive("btnFmtItalic", getInlineFormatContext("*", "*").active);
  setButtonActive("btnFmtUnderline", getInlineFormatContext("<u>", "</u>").active);

  const headingState = getHeadingState();
  setButtonActive("btnFmtHeading", headingState.active);
  const headingButton = document.getElementById("btnFmtHeading");
  if (headingButton) {
    headingButton.title = headingState.level
      ? `Title levels (current: H${headingState.level})`
      : "Title levels";
  }

  setButtonActive("btnFmtSymbol", !!getSymbolPrefixState());
  setButtonActive("btnFmtTable", !!getTableRangeAt(cm.getCursor("from").line));
  setButtonActive("btnFmtMermaid", !!getMermaidBlockForSelection());
}

export function initFormattingToolbar(): void {
  const toolbar = document.getElementById("editorFormatBar");
  if (!toolbar) return;

  const imageInput = document.getElementById("toolbarImageInput") as HTMLInputElement | null;

  imageInput?.addEventListener("change", async () => {
    const files = Array.from(imageInput.files || []).filter((file) => file.type.startsWith("image/"));
    imageInput.value = "";
    if (!files.length) return;
    await insertImages(files);
    refreshToolbarState();
  });

  toolbar.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-format-action]");
    if (!button || button.disabled) return;

    const action = button.dataset.formatAction;
    switch (action) {
      case "bold":
        toggleInlineFormat("**", "**");
        break;
      case "italic":
        toggleInlineFormat("*", "*");
        break;
      case "underline":
        toggleInlineFormat("<u>", "</u>");
        break;
      case "heading-menu":
        openHeadingMenu(button);
        break;
      case "symbol-menu":
        openSymbolMenu(button);
        break;
      case "table":
        toggleTableBlock();
        break;
      case "image":
        if (!imageInput) return;
        imageInput.value = "";
        imageInput.click();
        break;
      case "mermaid":
        toggleMermaidBlock();
        break;
      case "blocks-menu":
        openBlocksMenu(button);
        break;
      case "components-menu":
        openComponentsMenu(button);
        break;
      case "help":
        openHelpModal();
        break;
      default:
        break;
    }
  });

  toolbar.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button[data-format-action]")) {
      e.preventDefault();
    }
  });

  cm.on("cursorActivity", refreshToolbarState);
  cm.on("change", refreshToolbarState);
  busOn("content-loaded", refreshToolbarState);
  refreshToolbarState();
}
