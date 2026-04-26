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
    // Bypass the browser HTTP cache so a hard-reload in the editor tab
    // picks up CSS edits immediately (was a recurring DX pain during
    // iterating on pdf.css).
    const resp = await fetch(url, { cache: "no-store" });
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

// Expose cached pdf.css text so other modules (e.g. toolbar tooltips) can
// inline it instead of relying on `<link rel=stylesheet>` — which fails
// under Electron's file:// origin where relative URLs can't resolve.
export async function getCachedPdfCss(): Promise<string | null> {
  await prefetchCss();
  return _cssCache?.pdfCss ?? null;
}

export async function getCachedGoogleFonts(): Promise<string | null> {
  await prefetchCss();
  return _cssCache?.googleFonts ?? null;
}

// Sync access to cached CSS — returns null if prefetch hasn't resolved yet.
// Callers should fall back to a `<link>` tag in that case.
export function getCachedPdfCssSync(): string | null {
  return _cssCache?.pdfCss ?? null;
}

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

// Thrown when a render() call is preempted by a newer one before it has
// started running. Callers should treat this as a no-op (do not clear the
// preview, do not log) — a more recent render is already on its way.
export class RenderSupersededError extends Error {
  constructor() {
    super("Render superseded by newer request");
    this.name = "RenderSupersededError";
  }
}

// Tagged console logger — default OFF.  Enable at runtime via
// `window.__pagedRenderDebug = true` or `localStorage.pagedRenderDebug = "1"`.
declare global { interface Window { __pagedRenderDebug?: boolean } }
function rlog(msg: string, ...rest: any[]): void {
  if ((globalThis as any).window && window.__pagedRenderDebug === false) return;
  // performance.now() gives sub-ms resolution which matters for ordering races.
  const t = typeof performance !== "undefined" ? performance.now().toFixed(1) : "?";
  // eslint-disable-next-line no-console
  console.log(`[render +${t}ms] ${msg}`, ...rest);
}
if (typeof window !== "undefined" && window.__pagedRenderDebug === undefined) {
  // Default OFF.  Flip on at runtime via `window.__pagedRenderDebug = true`
  // (or in localStorage by setting key `pagedRenderDebug` to `"1"`).
  window.__pagedRenderDebug =
    typeof localStorage !== "undefined" && localStorage.getItem("pagedRenderDebug") === "1";
}

export class PreviewRenderer {
  previewFrame: Element;
  previewPages: Element;
  currentPreviewer: any;
  lineMap: any[];
  pendingLineMapData: boolean | null;
  // Serialization state — see render() below.
  private _renderChain: Promise<unknown>;
  private _latestRenderId: number;

  constructor({ previewFrame, previewPages }: { previewFrame: Element; previewPages: Element }) {
    this.previewFrame = previewFrame;
    this.previewPages = previewPages;
    this.currentPreviewer = null;
    this.lineMap = [];
    this.pendingLineMapData = null;
    this._renderChain = Promise.resolve();
    this._latestRenderId = 0;
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
    this._disposePreviewer(prev);
    // Belt-and-braces: remove any orphaned Paged.js styles that the polisher's
    // own destroy() may have missed (prior crash, etc.).  Only safe here
    // because dispose() is invoked between renders, never alongside one.
    for (const el of document.querySelectorAll("style[data-pagedjs-inserted-styles]")) {
      el.remove();
    }
  }

  // Tear down a *specific* previewer without sweeping all pagedjs styles in
  // the document head.  Used by the staged render path so we don't accidentally
  // strip the styles of a freshly-rendered (and now-current) previewer.
  private _disposePreviewer(prev: any): void {
    if (!prev) return;
    try { prev.chunker?.removePages?.(0); } catch {}
    try { prev.chunker?.destroy?.(); } catch {}
    try { prev.polisher?.destroy?.(); } catch {}
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

  // Public entry point — serializes concurrent render() calls. When several
  // renders fire in quick succession (e.g. session restore opens 4 tabs back
  // to back), we MUST NOT let them run concurrently: dispose() detaches the
  // previous chunker's pagesArea mid-flight, and Paged.js's Layout class then
  // throws "Cannot read properties of null (reading 'getBoundingClientRect')"
  // on the now-orphaned page element.
  //
  // Strategy: each call gets a monotonically increasing id and queues behind
  // the previous chain entry. When its turn comes, it checks whether a newer
  // render has been requested in the meantime — if so, it throws
  // RenderSupersededError so callers can no-op instead of clearing the
  // preview. Only the latest queued render actually runs Paged.js.
  async render(renderResult: Record<string, any>): Promise<{ elapsed: number; totalPages: number }> {
    const myId = ++this._latestRenderId;
    const prev = this._renderChain;
    const tag = renderResult?.rootPageName || "(default)";
    rlog(`render() enqueued id=${myId} latestId=${this._latestRenderId} tag=${tag}`);
    const promise = (async () => {
      try { await prev; } catch { /* prior render's failure is its own concern */ }
      if (myId !== this._latestRenderId) {
        rlog(`render() id=${myId} SUPERSEDED (latestId=${this._latestRenderId}) tag=${tag}`);
        throw new RenderSupersededError();
      }
      rlog(`render() id=${myId} starting _doRender tag=${tag}`);
      const r = await this._doRender(renderResult, myId);
      rlog(`render() id=${myId} done tag=${tag} pages=${r.totalPages} elapsed=${r.elapsed}ms`);
      return r;
    })();
    // Always advance the chain, even on rejection, so the next caller can
    // proceed.  Use a swallowed copy to avoid unhandled-rejection warnings.
    this._renderChain = promise.catch(() => undefined);
    return promise;
  }

  private async _doRender(renderResult: Record<string, any>, idForLog: number = -1): Promise<{ elapsed: number; totalPages: number }> {
    const rootPageName = renderResult.rootPageName || "";
    rlog(`_doRender id=${idForLog} tag=${rootPageName || "(default)"} bodyLen=${(renderResult.sectionHtml || "").length}`);
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

    // Render into an OFF-SCREEN staging container, swap into the live
    // surface only once Paged.js has produced all pages.  Without this the
    // user sees a blank flash during every render (file switch, restore,
    // edit re-render) because the previous DOM is wiped before the new one
    // is built.  Off-screen positioning still gives Paged.js valid layout
    // metrics (offsetParent / getBoundingClientRect work as long as no
    // ancestor is display:none).
    const live = this.previewPages as HTMLElement;
    const wrapper: HTMLElement | null = live.parentElement;
    if (!wrapper) throw new Error("Preview surface has no parent — cannot render.");

    const staging: HTMLDivElement = document.createElement("div");
    staging.className = live.className;
    // Stage on top of the live surface but hidden — same coordinate space so
    // layout metrics match exactly, but invisible to the user until the swap.
    // visibility:hidden preserves layout (offsetParent valid, getBoundingClientRect
    // returns real dimensions) in every engine, unlike off-screen translation
    // (top:-100000px) which Firefox sometimes treats as having zero size for
    // layout measurement during async flow ticks.
    staging.style.cssText =
      "position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;";
    wrapper.appendChild(staging);
    rlog(
      `_doRender id=${idForLog} staging-attached wrapper=${wrapper.tagName}#${wrapper.id}` +
      ` liveRect=${JSON.stringify(live.getBoundingClientRect())}`,
    );

    // Paged.js requires the render target to be attached to a visible part of
    // the DOM (getBoundingClientRect / offsetParent on internal elements).
    // During session restore renders fire before the preview pane is visible.
    // Insert a probe element and wait until it has layout.
    const probe: HTMLDivElement = document.createElement("div");
    probe.style.cssText = "position:absolute;width:1px;height:1px;pointer-events:none;";
    staging.appendChild(probe);
    if (!(probe as HTMLElement).offsetParent) {
      rlog(`_doRender id=${idForLog} probe.offsetParent=null — waiting for layout`);
      await new Promise<void>((resolve) => {
        const check = (): void => {
          if ((probe as HTMLElement).offsetParent) { resolve(); return; }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
      rlog(`_doRender id=${idForLog} probe.offsetParent now valid`);
    }
    probe.remove();

    // Paged.js's internal Queue ticks via requestAnimationFrame. When the tab is
    // hidden (refresh in a background tab, minimized window, occluded), browsers
    // throttle rAF to ~0Hz and the chunker render loop never advances —
    // `previewer.preview()` hangs forever and the preview is stuck on
    // "Rendering...". Wait for the document to be visible before kicking off
    // Paged.js so the queue is guaranteed to drain.
    if (document.visibilityState !== "visible") {
      rlog(`_doRender id=${idForLog} visibilityState=${document.visibilityState} — waiting`);
      await new Promise<void>((resolve, reject) => {
        const cleanup = (): void => {
          document.removeEventListener("visibilitychange", onVisible);
        };
        const onVisible = (): void => {
          // If a newer render() call landed while we were waiting, bail so
          // the chain can advance.  Otherwise the chain (and the closures
          // it retains: sectionHtml, blockEntries, …) grows unbounded for
          // every render queued during a long hidden-tab session.
          if (idForLog !== this._latestRenderId) {
            cleanup();
            staging.remove();
            reject(new RenderSupersededError());
            return;
          }
          if (document.visibilityState === "visible") {
            cleanup();
            resolve();
          }
        };
        document.addEventListener("visibilitychange", onVisible);
      });
      rlog(`_doRender id=${idForLog} visibility now visible`);
    }

    // Wrap *all* the build-time work below in try/finally — if anything
    // (Previewer constructor, polisher init, preview() rejection) throws
    // before we get to the swap, we must take staging back out of the DOM
    // or it leaks as an invisible orphan child of #preview-wrapper.
    let swapped = false;
    let previewer: any = null;
    let flow: any;
    const startedAt = performance.now();
    try {
      const PreviewerCtor = globalThis.Paged?.Previewer;
      if (!PreviewerCtor) throw new Error("Paged.js previewer is not available.");
      previewer = new PreviewerCtor();
      rlog(`_doRender id=${idForLog} preview() begin tag=${rootPageName || "(default)"}`);
      flow = await previewer.preview(
        previewMarkup,
        buildPreviewStyles({ rootPageName }) as any,
        staging,
      );
      rlog(
        `_doRender id=${idForLog} preview() done pages=${staging.querySelectorAll(".pagedjs_page").length}` +
        ` flowTotal=${flow?.total} elapsed=${(performance.now() - startedAt).toFixed(0)}ms`,
      );

      // Render succeeded.  Atomic swap: dispose the previous previewer, then
      // replace the live surface with the (now fully-painted) staging div.
      const previous = this.currentPreviewer;
      this.currentPreviewer = previewer;
      this._disposePreviewer(previous);

      // Reset the off-screen positioning so the staged surface drops into place
      // exactly where the previous one was.  Carry forward the live surface's
      // current `transform: scale(...)` so the swap is seamless — without
      // this, the new surface paints unscaled for one frame until the
      // caller's next scaleSurface() call, which the user perceives as a
      // flicker on every render.
      const liveTransform = (live as HTMLElement).style.transform;
      staging.style.cssText = "";
      staging.className = live.className;
      if (liveTransform) (staging as HTMLElement).style.transform = liveTransform;
      live.replaceWith(staging);
      swapped = true;
      this.previewPages = staging;
      rlog(`_doRender id=${idForLog} swapped staging→live tag=${rootPageName || "(default)"}`);
    } catch (e) {
      rlog(`_doRender id=${idForLog} build/preview THREW: ${(e as any)?.message || e}`);
      // Tear down the half-built previewer so it doesn't keep its polisher
      // styles in document head.
      if (previewer) this._disposePreviewer(previewer);
      throw e;
    } finally {
      // If we never swapped, staging is still parented to wrapper as an
      // invisible orphan — strip it.  When swap succeeded, staging IS the
      // live surface now, so leave it.
      if (!swapped && staging.parentNode) staging.remove();
    }

    await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));

    this.pendingLineMapData = true;
    this.lineMap = [];

    return {
      elapsed: Math.round(performance.now() - startedAt),
      totalPages:
        flow?.total ||
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
