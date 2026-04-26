// preview-pool.ts — Maintains one PreviewRenderer per tab inside a shared
// `#preview-wrapper`.  Switching the active tab toggles `display` on the
// surfaces; the rendered DOM stays in memory so re-activation is instant
// and scroll position is preserved per tab.
//
// Trade-off: memory grows linearly with open tabs (each tab holds its
// rendered Paged.js pages + Mermaid SVG).  For typical workflows (4–10 open
// files) this is a few tens of MB and the UX win is large.  If we ever need
// to bound it, add an LRU that disposes the least-recently-used tabs after
// N total or M minutes idle.

import { PreviewRenderer } from "./preview-renderer.js";

interface TabPreview {
  key: string;
  renderer: PreviewRenderer;
  lastRenderedHtml: string | null;
  lastTotalPages: number;
  scrollTop: number;
}

export class PreviewPool {
  private pool: Map<string, TabPreview> = new Map();
  private activeKey: string | null = null;

  constructor(
    private wrapper: HTMLElement,
    private container: HTMLElement,
  ) {}

  // Active tab key (path / virtual id).
  getActiveKey(): string | null {
    return this.activeKey;
  }

  // Whether the pool already has a surface for this tab — useful to decide
  // whether to skip rendering on a re-activation.
  has(key: string): boolean {
    return this.pool.has(key);
  }

  getLastRenderedHtml(key: string): string | null {
    return this.pool.get(key)?.lastRenderedHtml ?? null;
  }

  getLastTotalPages(key: string): number {
    return this.pool.get(key)?.lastTotalPages ?? 0;
  }

  // Returns the surface element currently associated with this tab.  The
  // reference can change across renders (PreviewRenderer swaps it on each
  // render), so callers should re-read whenever they need it.
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

  // Allocate (or reuse) the per-tab preview entry.  Newly created surfaces
  // start hidden so they can be rendered into without flashing on top of
  // the currently-visible tab.
  ensure(key: string): TabPreview {
    const existing = this.pool.get(key);
    if (existing) return existing;

    const surface: HTMLDivElement = document.createElement("div");
    surface.className = "preview-surface";
    surface.dataset.previewKey = key;
    surface.style.display = "none";
    this.wrapper.appendChild(surface);

    const renderer = new PreviewRenderer({
      previewFrame: this.container,
      previewPages: surface,
    });

    const tp: TabPreview = {
      key,
      renderer,
      lastRenderedHtml: null,
      lastTotalPages: 0,
      scrollTop: 0,
    };
    this.pool.set(key, tp);
    return tp;
  }

  // Toggle visibility to the given tab.  Stashes the outgoing tab's scroll
  // position; restores the incoming tab's scroll on next frame so the
  // surface measurements have settled before the assignment lands.
  setActive(key: string): void {
    if (this.activeKey === key) return;

    if (this.activeKey) {
      const cur = this.pool.get(this.activeKey);
      if (cur) {
        cur.scrollTop = this.container.scrollTop;
        const surface = cur.renderer.previewPages as HTMLElement;
        surface.style.display = "none";
      }
    }

    const next = this.ensure(key);
    const surface = next.renderer.previewPages as HTMLElement;
    surface.style.display = "";
    this.activeKey = key;

    requestAnimationFrame(() => {
      this.container.scrollTop = next.scrollTop;
    });
  }

  // Render markup into the per-tab surface.  Returns the renderer's stats so
  // the caller can update the global status line.
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
  // and the caller wants the displayed preview to go blank.  Other pooled
  // tabs are untouched.
  clearActive(): void {
    if (!this.activeKey) return;
    const tp = this.pool.get(this.activeKey);
    if (!tp) return;
    tp.renderer.clear();
    tp.lastRenderedHtml = null;
    tp.lastTotalPages = 0;
    tp.scrollTop = 0;
  }

  // Dispose a tab's preview (called from tab close).  No-op if not pooled.
  dispose(key: string): void {
    const tp = this.pool.get(key);
    if (!tp) return;
    tp.renderer.dispose();
    const surface = tp.renderer.previewPages as HTMLElement;
    surface.remove();
    this.pool.delete(key);
    if (this.activeKey === key) this.activeKey = null;
  }
}
