import { buildLineMap } from "./line-map-builder.js";
import {
  GOOGLE_FONTS_URL,
  SECTION_ENTRY_CSS,
} from "../pdf-constants.js";

// pagedReady — kept for API compatibility with app.js startup sequence.
export const pagedReady: Promise<void> = Promise.resolve();

function buildPreviewDocument({ bodyHtml, headerText, rootPageName = "" }: { bodyHtml: string; headerText: string; rootPageName?: string }): string {
  const isCover = rootPageName === "cover";
  const isSommaire = rootPageName === "sommaire";
  const includeRunningElements = !isCover;

  // Running elements use `position: running(...)` — Paged.js moves them into
  // margin boxes.  They must appear before the content.
  const runningHtml: string = includeRunningElements ? `
    <div class="pdf-page-gradient"></div>
    <div class="pdf-running-header">${headerText || ""}</div>
    <div class="pdf-footer-logo"><img src="assets/beorn-logo.png" alt="BEORN"></div>
    <div class="pdf-footer-confidential">Document confidentiel — Reproduction interdite</div>
  ` : "";

  // Cover and sommaire HTML already declare their own `page:` via CSS class
  // (`.beorn-cover` → cover, `.beorn-cover-sommaire` → sommaire).  Wrapping
  // them in extra divs creates an unnamed page context that Paged.js renders
  // as a blank first page.  Emit their body HTML directly.
  if (isCover) {
    return bodyHtml;
  }

  // Sommaire: running elements must live *inside* the `.beorn-cover-sommaire`
  // div so they share its `page: sommaire` context.  If placed before it,
  // Paged.js creates a blank unnamed page for them.
  if (isSommaire) {
    return bodyHtml.replace(
      /(<div class="beorn-cover beorn-cover-sommaire">)/,
      `$1\n  ${runningHtml}`,
    );
  }

  // Regular sections: wrap in pdf-preview-root / pdf-content for line mapping.
  const pageStyle: string = rootPageName ? ` style="page: ${rootPageName};"` : "";
  return `
    ${runningHtml}
    <div class="pdf-preview-root"${pageStyle}>
      <div class="pdf-content"${pageStyle}>${bodyHtml}</div>
    </div>
  `;
}

function buildPreviewStyles({ rootPageName = "" } = {}): Array<string | Record<string, string>> {
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
const PREVIEW_URI_REGEXP: RegExp =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|file|blob):|[^a-z]|[a-z+\-.]+(?:[^a-z+\-.:]|$))/i;

function sanitizePreviewHtml(html: string): string {
  const purifier = window.DOMPurify;
  if (!purifier?.sanitize) return html;

  return purifier.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: PREVIEW_URI_REGEXP,
  });
}

export class PreviewRenderer {
  previewFrame: Element;
  previewPages: Element;
  currentPreviewer: any;
  lineMap: any[];
  pendingLineMapData: any;

  constructor({ previewFrame, previewPages }: { previewFrame: Element; previewPages: Element }) {
    this.previewFrame = previewFrame;
    this.previewPages = previewPages;
    this.currentPreviewer = null;
    this.lineMap = [];
    this.pendingLineMapData = null;
  }

  getLineMap(): any[] {
    return this.lineMap;
  }

  clear(): void {
    this.dispose();
    this.previewPages.replaceChildren();
    this.lineMap = [];
    this.pendingLineMapData = null;
  }

  dispose(): void {
    if (!this.currentPreviewer) return;
    const prev = this.currentPreviewer;
    this.currentPreviewer = null;
    // Paged.js destroy methods assume pagesArea exists — guard against
    // disposal of a previewer whose preview() call hasn't finished yet.
    try { prev.chunker?.removePages?.(0); } catch {}
    try { prev.chunker?.destroy?.(); } catch {}
    try { prev.polisher?.destroy?.(); } catch {}
  }

  async render(renderResult: Record<string, any>): Promise<{ elapsed: number; totalPages: number }> {
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

    // Paged.js requires the render target to be attached to a visible part of the
    // DOM (it calls getBoundingClientRect on internal elements whose offsetParent
    // must be non-null).  During session restore, renders fire before the preview
    // pane is visible.  Insert a probe element and wait until it has layout.
    const probe: HTMLDivElement = document.createElement("div");
    probe.style.cssText = "position:absolute;width:1px;height:1px;pointer-events:none;";
    this.previewPages.appendChild(probe);
    if (!(probe as HTMLElement).offsetParent) {
      await new Promise<void>((resolve) => {
        const check = (): void => {
          if ((probe as HTMLElement).offsetParent) { resolve(); return; }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
    }
    probe.remove();

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

  rebuildLineMap(): void {
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
