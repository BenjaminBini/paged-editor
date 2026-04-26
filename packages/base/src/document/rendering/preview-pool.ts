// preview-pool.ts — One per-tab pane (.preview-tab) inside #preview-container.
// Each pane has its own:
//   .preview-tab     ← scroll container (overflow-y:auto), the pool toggles
//                       display:none/block on this; the browser preserves
//                       scrollTop per element across the toggle.
//     .preview-wrapper  ← scaled to the rendered content's pixel size.
//       .preview-surface  ← Paged.js renders pages into this (with transform).
//
// Switching tabs only toggles `display`; the rendered DOM and the per-pane
// scrollTop both stay alive.  No manual save/restore.
//
// Trade-off: memory grows linearly with open tabs.  For typical workflows
// (4–10 open files) this is a few tens of MB.  If we ever need to bound it,
// add an LRU that disposes the least-recently-used tabs after N total or
// M minutes idle.

import { PreviewRenderer } from "./preview-renderer.js";

interface TabPreview {
  key: string;
  pane: HTMLDivElement;          // .preview-tab — the per-tab scroll container
  wrapper: HTMLDivElement;       // .preview-wrapper — scaled to content size
  renderer: PreviewRenderer;
  lastRenderedHtml: string | null;
  lastTotalPages: number;
}

export type ScrollerChangeListener = (scroller: HTMLElement | null) => void;

export class PreviewPool {
  private pool: Map<string, TabPreview> = new Map();
  private activeKey: string | null = null;
  private scrollerListeners: Set<ScrollerChangeListener> = new Set();

  constructor(private host: HTMLElement) {}

  // Active tab key (path / virtual id).
  getActiveKey(): string | null {
    return this.activeKey;
  }

  has(key: string): boolean {
    return this.pool.has(key);
  }

  getLastRenderedHtml(key: string): string | null {
    return this.pool.get(key)?.lastRenderedHtml ?? null;
  }

  getLastTotalPages(key: string): number {
    return this.pool.get(key)?.lastTotalPages ?? 0;
  }

  // The reference can change across renders (PreviewRenderer swaps it on
  // each render), so callers should re-read whenever they need it.
  getSurface(key: string): HTMLDivElement | null {
    const tp = this.pool.get(key);
    return tp ? (tp.renderer.previewPages as HTMLDivElement) : null;
  }

  getActiveSurface(): HTMLDivElement | null {
    return this.activeKey ? this.getSurface(this.activeKey) : null;
  }

  getRenderer(key: string): PreviewRenderer | null {
    return this.pool.get(key)?.renderer ?? null;
  }

  getActiveRenderer(): PreviewRenderer | null {
    return this.activeKey ? this.getRenderer(this.activeKey) : null;
  }

  // The per-tab wrapper that scaleSurface() sizes to the scaled content.
  getActiveWrapper(): HTMLDivElement | null {
    return this.activeKey ? this.pool.get(this.activeKey)?.wrapper ?? null : null;
  }

  // The per-tab scroll container (`.preview-tab`).  Sync controllers + scroll
  // capture/restore must read scrollTop from this element, not from the host.
  getActiveScroller(): HTMLElement | null {
    return this.activeKey ? this.pool.get(this.activeKey)?.pane ?? null : null;
  }

  // Subscribe to scroller swaps.  Fires on every setActive() that changes the
  // active key, plus once when called if there is already an active scroller.
  // Returns an unsubscribe function.
  onScrollerChange(fn: ScrollerChangeListener): () => void {
    this.scrollerListeners.add(fn);
    const current = this.getActiveScroller();
    if (current) fn(current);
    return () => { this.scrollerListeners.delete(fn); };
  }

  private notifyScrollerChange(): void {
    const next = this.getActiveScroller();
    for (const fn of this.scrollerListeners) fn(next);
  }

  // Allocate (or reuse) the per-tab pane.  Newly created panes start hidden
  // so they can be rendered into without flashing on top of the active tab.
  ensure(key: string): TabPreview {
    const existing = this.pool.get(key);
    if (existing) return existing;

    const pane: HTMLDivElement = document.createElement("div");
    pane.className = "preview-tab";
    pane.dataset.previewKey = key;
    pane.style.display = "none";

    const wrapper: HTMLDivElement = document.createElement("div");
    wrapper.className = "preview-wrapper";
    pane.appendChild(wrapper);

    const surface: HTMLDivElement = document.createElement("div");
    surface.className = "preview-surface";
    surface.dataset.previewKey = key;
    wrapper.appendChild(surface);

    this.host.appendChild(pane);

    const renderer = new PreviewRenderer({
      // PreviewRenderer uses these for offsetParent probing.  The pane is
      // the natural "frame" (scroll container) for sync controllers; the
      // surface is its render target.
      previewFrame: pane,
      previewPages: surface,
    });

    const tp: TabPreview = {
      key,
      pane,
      wrapper,
      renderer,
      lastRenderedHtml: null,
      lastTotalPages: 0,
    };
    this.pool.set(key, tp);
    return tp;
  }

  // Toggle visibility to the given tab.  We don't touch scrollTop — each
  // pane owns its own scroll position via overflow:auto.
  setActive(key: string): void {
    if (this.activeKey === key) return;

    if (this.activeKey) {
      const cur = this.pool.get(this.activeKey);
      if (cur) cur.pane.style.display = "none";
    }

    const next = this.ensure(key);
    next.pane.style.display = "";
    this.activeKey = key;
    this.notifyScrollerChange();
  }

  async render(
    key: string,
    renderResult: Record<string, any>,
  ): Promise<{ elapsed: number; totalPages: number }> {
    const tp = this.ensure(key);
    const result = await tp.renderer.render(renderResult);
    tp.lastRenderedHtml = renderResult?.sectionHtml ?? null;
    tp.lastTotalPages = result.totalPages;
    return result;
  }

  // Clear *only* the active tab's surface — used when the editor is empty
  // and the caller wants the displayed preview to go blank.
  clearActive(): void {
    if (!this.activeKey) return;
    const tp = this.pool.get(this.activeKey);
    if (!tp) return;
    tp.renderer.clear();
    tp.lastRenderedHtml = null;
    tp.lastTotalPages = 0;
  }

  // Dispose a tab's preview (called from tab close).  No-op if not pooled.
  dispose(key: string): void {
    const tp = this.pool.get(key);
    if (!tp) return;
    tp.renderer.dispose();
    tp.pane.remove();
    this.pool.delete(key);
    if (this.activeKey === key) {
      this.activeKey = null;
      this.notifyScrollerChange();
    }
  }
}
