import { getAssets } from "../core/assets.js";
import { buildLineMap } from "./line-map.js";

function buildPreviewDocument({ bodyHtml, headerText, rootPageName = "" }) {
  const rootAttrs = rootPageName
    ? ` class="pdf-preview-root" style="page: ${rootPageName};"`
    : ` class="pdf-preview-root"`;
  const includeRunningElements = !rootPageName;
  const pdfContentAttrs = rootPageName
    ? ` class="pdf-content" style="page: ${rootPageName};"`
    : ` class="pdf-content"`;
  return `
    <div${rootAttrs}>
      ${includeRunningElements ? '<div class="pdf-page-gradient"></div>' : ""}
      ${includeRunningElements ? `<div class="pdf-running-header">${headerText || ""}</div>` : ""}
      <div${pdfContentAttrs}>${bodyHtml}</div>
    </div>
  `;
}

function buildPreviewStyles({ rootPageName = "" } = {}) {
  const {
    PDF_CSS,
    PAGED_CSS,
    FONTS_CSS,
    BEORN_LOGO_BLOB_URL,
    BEORN_LOGO_DATA_URI,
  } = getAssets();

  const logoUrl = BEORN_LOGO_BLOB_URL || BEORN_LOGO_DATA_URI;
  const logoCss = logoUrl
    ? `.pagedjs_page::after { background-image: url("${logoUrl}"); }`
    : "";
  const firstPageCss = rootPageName ? "" : `
    @page :first {
      margin: 20mm 18mm 25mm 18mm;
      @top {
        content: element(pdf-page-gradient);
      }
      @top-center {
        content: element(pdf-running-header);
      }
      @bottom {
        content: counter(page);
        font-family: "Hanken Grotesk", sans-serif;
        font-size: 8pt;
        color: #718096;
      }
    }

    .pdf-content > section.level2 > h1:first-child {
      break-before: auto !important;
      page-break-before: auto !important;
    }
  `;

  return [
    FONTS_CSS ? { "preview-fonts.css": FONTS_CSS } : null,
    PDF_CSS ? { "preview-pdf.css": PDF_CSS } : null,
    PAGED_CSS || logoCss || firstPageCss
      ? { "preview-paged.css": `${PAGED_CSS}\n${logoCss}\n${firstPageCss}` }
      : null,
  ].filter(Boolean);
}

// Extend DOMPurify's default URI allowlist to include file: (Electron local
// assets) and blob: (pre-fetched logo/font object URLs). Both are safe in
// Electron's controlled renderer context.
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
  }

  dispose() {
    if (!this.currentPreviewer) return;
    this.currentPreviewer.chunker?.removePages?.(0);
    this.currentPreviewer.chunker?.destroy?.();
    this.currentPreviewer.polisher?.destroy?.();
    this.currentPreviewer = null;
  }

  async render(renderResult) {
  const previewMarkup = sanitizePreviewHtml(buildPreviewDocument({
      bodyHtml: renderResult.sectionHtml,
      headerText: renderResult.headerText,
      rootPageName: renderResult.rootPageName || "",
    }));

    this.dispose();
    this.previewPages.replaceChildren();

    const PreviewerCtor = window.Paged?.Previewer;
    if (!PreviewerCtor) throw new Error("Paged.js previewer is not available.");

    this.currentPreviewer = new PreviewerCtor();
    const startedAt = performance.now();
    const flow = await this.currentPreviewer.preview(
      previewMarkup,
      buildPreviewStyles({ rootPageName: renderResult.rootPageName || "" }),
      this.previewPages,
    );

    await new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    this.lineMap = buildLineMap(
      renderResult.sourceBlocks || [],
      renderResult.lineStarts || [0],
      renderResult.lineNumberOffset || 0,
      this.previewFrame,
      this.previewPages,
    );

    return {
      elapsed: Math.round(performance.now() - startedAt),
      totalPages: this.previewPages.querySelectorAll(".pagedjs_page").length || flow.total || 0,
    };
  }
}
