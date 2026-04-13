import { buildLineMap } from "./line-map-builder.js";
import {
  GOOGLE_FONTS_URL,
  SECTION_ENTRY_CSS,
} from "../pdf-constants.js";

// pagedReady — kept for API compatibility with app.js startup sequence.
export const pagedReady = Promise.resolve();

function buildPreviewDocument({ bodyHtml, headerText, rootPageName = "" }) {
  const pageStyle = rootPageName ? ` style="page: ${rootPageName};"` : "";
  const isCover = rootPageName === "cover";
  const includeRunningElements = !isCover;
  return `
    <div class="pdf-preview-root"${pageStyle}>
      ${includeRunningElements ? '<div class="pdf-page-gradient"></div>' : ""}
      ${includeRunningElements ? `<div class="pdf-running-header">${headerText || ""}</div>` : ""}
      ${includeRunningElements ? '<div class="pdf-footer-logo"><img src="assets/beorn-logo.png" alt="BEORN"></div>' : ""}
      ${includeRunningElements ? '<div class="pdf-footer-confidential">Document confidentiel — Reproduction interdite</div>' : ""}
      <div class="pdf-content"${pageStyle}>${bodyHtml}</div>
    </div>
  `;
}

function buildPreviewStyles({ rootPageName = "" } = {}) {
  const overridesCss = rootPageName ? "" : SECTION_ENTRY_CSS;

  return [
    GOOGLE_FONTS_URL,
    "css/preview/pdf.css",
    "css/preview/paged.css",
    ...(overridesCss ? [{ "preview-overrides.css": overridesCss }] : []),
  ];
}

// Extend DOMPurify's default URI allowlist to include file: (Electron local
// assets) and blob: (Google Fonts may resolve via blob in some environments).
// Both are safe in Electron's controlled renderer context.
const PREVIEW_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|file|blob):|[^a-z]|[a-z+\-.]+(?:[^a-z+\-.:]|$))/i;

function sanitizePreviewHtml(html) {
  const purifier = window.DOMPurify;
  if (!purifier?.sanitize) return html;

  return purifier.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: PREVIEW_URI_REGEXP,
  });
}

export class PreviewRenderer {
  constructor({ previewFrame, previewPages }) {
    this.previewFrame = previewFrame;
    this.previewPages = previewPages;
    this.currentPreviewer = null;
    this.lineMap = [];
  }

  getLineMap() {
    return this.lineMap;
  }

  clear() {
    this.dispose();
    this.previewPages.replaceChildren();
    this.lineMap = [];
    this.pendingLineMapData = null;
  }

  dispose() {
    if (!this.currentPreviewer) return;
    const prev = this.currentPreviewer;
    this.currentPreviewer = null;
    // Paged.js destroy methods assume pagesArea exists — guard against
    // disposal of a previewer whose preview() call hasn't finished yet.
    try { prev.chunker?.removePages?.(0); } catch {}
    try { prev.chunker?.destroy?.(); } catch {}
    try { prev.polisher?.destroy?.(); } catch {}
  }

  async render(renderResult) {
    const rootPageName = renderResult.rootPageName || "";
    const previewMarkup = sanitizePreviewHtml(
      buildPreviewDocument({
        bodyHtml: renderResult.sectionHtml,
        headerText: renderResult.headerText,
        rootPageName,
      }),
    );

    this.dispose();
    this.previewPages.replaceChildren();

    const PreviewerCtor = globalThis.Paged?.Previewer;
    if (!PreviewerCtor) throw new Error("Paged.js previewer is not available.");

    this.currentPreviewer = new PreviewerCtor();
    const startedAt = performance.now();
    const flow = await this.currentPreviewer.preview(
      previewMarkup,
      buildPreviewStyles({ rootPageName }),
      this.previewPages,
    );

    await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));

    // Store render result data for deferred line map build — the line map must
    // be built AFTER scaleSurface() so getBoundingClientRect() reflects the
    // scaled layout.  render.js calls rebuildLineMap() at the right moment.
    this.pendingLineMapData = {
      sourceBlocks: renderResult.sourceBlocks || [],
      lineStarts: renderResult.lineStarts || [0],
      lineNumberOffset: renderResult.lineNumberOffset || 0,
    };
    this.lineMap = [];

    return {
      elapsed: Math.round(performance.now() - startedAt),
      totalPages:
        flow.total ||
        this.previewPages.querySelectorAll(".pagedjs_page").length ||
        0,
    };
  }

  rebuildLineMap() {
    const data = this.pendingLineMapData;
    if (!data) return;
    this.pendingLineMapData = null;
    this.lineMap = buildLineMap(
      data.sourceBlocks,
      data.lineStarts,
      data.lineNumberOffset,
      this.previewFrame,
      this.previewPages,
    );
  }
}
