import {
  GOOGLE_FONTS_URL,
  SECTION_ENTRY_CSS,
} from "../pdf-constants.js";

// pagedReady — kept for API compatibility with app.js startup sequence.
export const pagedReady: Promise<void> = Promise.resolve();

// ── CSS prefetch cache ──────────────────────────────────────────────
// Fetched once at startup, then served as inline objects to Paged.js
// so its Polisher skips XHR on every render.
let _cssCache: { googleFonts: string | null; pdfCss: string | null; pagedCss: string | null } | null = null;
let _cssCachePromise: Promise<void> | null = null;

async function fetchCssText(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    return resp.ok ? await resp.text() : null;
  } catch { return null; }
}

function prefetchCss(): Promise<void> {
  if (_cssCachePromise) return _cssCachePromise;
  _cssCachePromise = Promise.all([
    fetchCssText(GOOGLE_FONTS_URL),
    fetchCssText("css/preview/pdf.css"),
    fetchCssText("css/preview/paged.css"),
  ]).then(([googleFonts, pdfCss, pagedCss]) => {
    _cssCache = { googleFonts, pdfCss, pagedCss };
  });
  return _cssCachePromise;
}

// Start prefetch immediately on module load.
prefetchCss();

function buildPreviewDocument({ bodyHtml, headerText, rootPageName = "" }: { bodyHtml: string; headerText: string; rootPageName?: string }): string {
  const isCover = rootPageName === "cover";
  const isSommaire = rootPageName === "sommaire";
  const includeRunningElements = !isCover;

  // Running elements use `position: running(...)` — Paged.js moves them into
  // margin boxes. They are wrapped in a single container because Paged.js's
  // chunker produces one extra (duplicated) first-page per running element
  // when they sit as direct siblings of the section root. Wrapping them
  // collapses the chunker loop to a single pass. See preview-renderer.test
  // scenarios M1..M5 for the exact N-running -> N+1 duplicate pattern.
  const runningHtml: string = includeRunningElements ? `
    <div class="pdf-running-elements">
      <div class="pdf-page-gradient"></div>
      <div class="pdf-running-header">${headerText || ""}</div>
      <div class="pdf-footer-logo"><img src="assets/beorn-logo.png" alt="BEORN"></div>
      <div class="pdf-footer-confidential">Document confidentiel — Reproduction interdite</div>
    </div>
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
  const c = _cssCache;

  // Use inline CSS objects when prefetch succeeded (avoids Polisher XHR).
  // Fall back to URL strings if prefetch failed or hasn't completed yet.
  const fonts = c?.googleFonts ? { "google-fonts.css": c.googleFonts } : GOOGLE_FONTS_URL;
  const pdf   = c?.pdfCss      ? { "pdf.css": c.pdfCss }              : "css/preview/pdf.css";
  const paged = c?.pagedCss    ? { "paged.css": c.pagedCss }          : "css/preview/paged.css";

  return [
    fonts,
    pdf,
    paged,
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
  pendingLineMapData: boolean | null;

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
    try { prev.chunker?.removePages?.(0); } catch {}
    try { prev.chunker?.destroy?.(); } catch {}
    try { prev.polisher?.destroy?.(); } catch {}
    // Remove any orphaned Paged.js styles that the polisher's own destroy()
    // may have missed (e.g. from a prior crash or concurrent renders).
    for (const el of document.querySelectorAll("style[data-pagedjs-inserted-styles]")) {
      el.remove();
    }
  }

  /**
   * Patch visible pages in-place by replacing changed elements identified
   * by their data-source-line attribute. Much faster than a full Paged.js
   * re-render since it only touches the DOM elements that actually changed.
   */
  patchVisiblePages(
    newHtml: string,
    changedLines: Set<string>,
    visibleRange: { first: number; last: number },
  ): number {
    if (changedLines.size === 0) return 0;

    // Parse the new section HTML to get fresh elements.
    const tmp = document.createElement("div");
    tmp.innerHTML = newHtml;

    // Attributes that are owned by Paged.js or our source/block mapping
    // and must survive an attribute-sync. data-block-id is preserved because
    // we sync it explicitly from newEl below (it may change legitimately).
    const PRESERVED_ATTRS = new Set([
      "data-source-line",
      "data-ref",
      "data-split-from",
      "data-split-to",
    ]);

    let patched = 0;
    for (const line of changedLines) {
      const newEl = tmp.querySelector(`[data-source-line="${line}"]`) as HTMLElement | null;
      if (!newEl) continue;

      // Match live elements by data-block-id first (stable even when the
      // data-source-line shifts due to an insertion). Fall back to
      // data-source-line otherwise.
      const newBlockId = newEl.getAttribute("data-block-id");
      const liveByBlockId = newBlockId
        ? this.previewPages.querySelectorAll(`[data-block-id="${newBlockId}"]`)
        : null;
      const liveEls =
        liveByBlockId && liveByBlockId.length > 0
          ? liveByBlockId
          : this.previewPages.querySelectorAll(`[data-source-line="${line}"]`);

      for (const rawEl of Array.from(liveEls)) {
        const el = rawEl as HTMLElement;
        const page = el.closest(".pagedjs_page") as HTMLElement | null;
        if (!page) continue;
        const pageNum = parseInt(page.dataset.pageNumber || "0", 10);
        if (pageNum < visibleRange.first || pageNum > visibleRange.last) continue;

        // If the element has no Paged.js ref state, a clean replace is safe
        // and cheapest.
        const hasPagedRef =
          el.hasAttribute("data-ref") ||
          el.hasAttribute("data-split-from") ||
          el.hasAttribute("data-split-to");

        if (!hasPagedRef) {
          const fresh = newEl.cloneNode(true) as HTMLElement;
          // Preserve style-mode state classes so the selected/hovered
          // outline doesn't flicker off mid-edit.
          if (el.classList.contains("style-hovered")) fresh.classList.add("style-hovered");
          if (el.classList.contains("style-selected")) fresh.classList.add("style-selected");
          el.replaceWith(fresh);
          patched++;
          continue;
        }

        // Otherwise sync attributes while keeping Paged.js's chunker state
        // on this wrapper intact.
        const hadHovered = el.classList.contains("style-hovered");
        const hadSelected = el.classList.contains("style-selected");
        for (const attr of Array.from(newEl.attributes)) {
          if (PRESERVED_ATTRS.has(attr.name)) continue;
          el.setAttribute(attr.name, attr.value);
        }
        for (const attr of Array.from(el.attributes)) {
          if (PRESERVED_ATTRS.has(attr.name)) continue;
          if (!newEl.hasAttribute(attr.name)) el.removeAttribute(attr.name);
        }
        // data-block-id tracks the fresh render (not preserved).
        if (newBlockId !== null) el.setAttribute("data-block-id", newBlockId);
        // Re-apply the style-mode state classes that got wiped by the class
        // attribute sync — the signal hasn't changed, so the preview
        // interaction's effect won't re-fire.
        if (hadHovered) el.classList.add("style-hovered");
        if (hadSelected) el.classList.add("style-selected");

        el.innerHTML = newEl.innerHTML;
        patched++;
      }
    }

    return patched;
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

    // Ensure CSS cache is ready before Paged.js runs (avoids broken first
    // render after hard refresh when Polisher would need to fetch CSS).
    await prefetchCss();

    this.dispose();
    // Replace the container with a fresh element so no stale Paged.js DOM state
    // (data-ref attributes, orphaned chunker fragments) leaks between renders.
    const fresh: HTMLDivElement = document.createElement("div");
    fresh.className = (this.previewPages as HTMLElement).className;
    (this.previewPages as HTMLElement).replaceWith(fresh);
    this.previewPages = fresh;

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
      buildPreviewStyles({ rootPageName }) as any,
      this.previewPages,
    );

    await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));

    this.pendingLineMapData = true;
    this.lineMap = [];

    return {
      elapsed: Math.round(performance.now() - startedAt),
      totalPages:
        flow.total ||
        this.previewPages.querySelectorAll(".pagedjs_page").length ||
        0,
    };
  }

  // Called after scaleSurface() so getBoundingClientRect() reflects the scaled
  // layout. Heading anchors are now read directly from the live DOM in
  // ScrollSyncController.refreshRelation() — no pre-built map needed here.
  rebuildLineMap(): void {
    this.pendingLineMapData = null;
  }
}
