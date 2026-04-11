import { buildLineMap } from "./line-map.js";

// ── Asset loading ─────────────────────────────────────────────────────────────
// Paged.js, CSS, and fonts are loaded once at startup. Consumers destructure
// from `assets` after awaiting `pagedReady`.

// ── CSS for Paged.js preview() API ───────────────────────────────────────────
// Paged.js's programmatic preview(html, styles, container) API requires CSS as
// JS objects — plain <link> tags are not supported. These are fetched once at
// startup and used only by the live renderer. Export HTML uses <link>/<script>
// references directly (see document.js).

export const previewCss = { PDF_CSS: "", PAGED_CSS: "", FONTS_CSS: "" };

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700" +
  "&family=Montserrat:wght@400;500;600;700;800" +
  "&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500" +
  "&display=swap";

export const pagedReady = Promise.all([
  fetch("css/preview/pdf.css").then((r) => r.text()).then((t) => { previewCss.PDF_CSS = t; }),
  fetch("css/preview/paged.css").then((r) => r.text()).then((t) => { previewCss.PAGED_CSS = t; }),
  fetch(GOOGLE_FONTS_URL)
    .then((r) => (r.ok ? r.text() : ""))
    .then((t) => { previewCss.FONTS_CSS = t; })
    .catch(() => {}),
]);

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
  const { PDF_CSS, PAGED_CSS, FONTS_CSS } = previewCss;

  const logoCss = `.pagedjs_page::after { background-image: url("assets/beorn-logo.png"); }`;
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
// assets) and blob: (Paged.js is injected via a blob URL). Both are safe in
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
      totalPages: this.previewPages.querySelectorAll(".pagedjs_page").length || flow.total || 0,
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
