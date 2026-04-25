// render-scheduler.js — Schedules renders, picks the right pipeline, pushes to the preview renderer.

import { editor, previewContainer as _previewContainer, status as _status } from "../editor/codemirror-editor.js";

// Tagged logger — mirrors the one in preview-renderer.ts.  Same toggle.
function rsl(msg: string, ...rest: any[]): void {
  if (typeof window !== "undefined" && (window as any).__pagedRenderDebug === false) return;
  const t = typeof performance !== "undefined" ? performance.now().toFixed(1) : "?";
  // eslint-disable-next-line no-console
  console.log(`[render +${t}ms] ${msg}`, ...rest);
}

// These DOM elements are guaranteed to exist when this module loads.
const previewContainer: HTMLElement = _previewContainer!;
const status: HTMLElement = _status!;
import { getActiveFileName, getActiveFilePath } from "../workspace/files/active-file-context.js";
import { getActiveTab } from "../workspace/tabs/tab-bar-controller.js";
import { getFolderPath } from "../workspace/files/file-manager.js";
import { renderMarkdown } from "./rendering/section-pipeline.js";
import { PreviewRenderer, RenderSupersededError } from "./rendering/preview-renderer.js";
import { emit } from "../infrastructure/event-bus.js";
import { getAssetBaseHref } from "../workspace/files/asset-manager.js";
import { buildHeaderText } from "./export/html-document-wrapper.js";
import { buildCoverRenderResult, buildCoverErrorRenderResult } from "./rendering/cover-pipeline.js";
import { buildTocRenderResult } from "./rendering/toc-pipeline.js";
import { getProjectMetadata, isCoverTab, isTocTab } from "./model/memoire-views.js";
import { lockEditorScroll, unlockEditorScroll } from "./sync/preview-sync-setup.js";
import type { BlockEntry, StyleError } from "./rendering/block-model.js";
import { rootsEqual } from "./rendering/element-equal.js";
import { restoreSelection } from "../shell/ui/preview-interaction.js";
import {
  setBlockEntries,
  setStyleErrors,
} from "./rendering/block-entries-store.js";

const A4_WIDTH_PX: number = 794;
const previewWrapper: HTMLElement = document.getElementById("preview-wrapper")!;

const initialSurface: HTMLDivElement = document.createElement("div");
initialSurface.className = "preview-surface";
previewWrapper.appendChild(initialSurface);

const previewRenderer: PreviewRenderer = new PreviewRenderer({
  previewFrame: previewContainer!,
  previewPages: initialSurface,
});

// The renderer replaces the previewPages element on each render (fresh DOM).
// Always read the current element via this getter.
function previewSurface(): HTMLDivElement {
  return previewRenderer.previewPages as HTMLDivElement;
}

let _userZoom: number = 1;
let renderTimeout: ReturnType<typeof setTimeout> | null = null;
let renderStartTime: number = 0;
let renderGeneration: number = 0;
// Separate counter for cover renders so that a cover render does NOT bump
// renderGeneration and invalidate a freshly-queued markdown pending request
// (Firefox bug: active-tab activation can fire triggerRender before cover's
// bump, then cover's bump caused renderRequest to gen-mismatch and bail,
// stranding the active-tab render and leaving the cover visible).
let coverGeneration: number = 0;
let pendingMarkdown: { markdown: string; generation: number } | null = null;
let isRendering: boolean = false;
let lastRenderStats: { elapsed: number; totalPages: number } = {
  elapsed: 0,
  totalPages: 0,
};
let _cachedCoverAssetBaseHref: string | null = null;
let _lastRenderedHtml: string | null = null;
// Tracks WHAT is currently shown in previewPages — independent of the html
// cache (which only updates from the markdown render path). Cache-skip in
// renderRequest must require BOTH html match AND target match, otherwise a
// cover render that swapped previewPages will be ignored when switching
// back to a markdown tab whose html happens to match _lastRenderedHtml.
let _lastDisplayedTarget: string | null = null;
let _patchTimeout: ReturnType<typeof setTimeout> | null = null;
let _lastSourceBlocks: Array<{ start: number; end: number; kind: string; text: string }> = [];
let _lastBlockEntries: BlockEntry[] = [];
let _lastStyleErrors: StyleError[] = [];
let _isPatching: boolean = false;

function capturePreviewScrollState(): { scrollTop: number; ratio: number } {
  const maxScrollTop = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
  return {
    scrollTop: previewContainer.scrollTop,
    ratio: maxScrollTop > 0 ? previewContainer.scrollTop / maxScrollTop : 0,
  };
}

function restorePreviewScrollState(state: { scrollTop: number; ratio: number } | null): void {
  if (!state) return;
  const maxScrollTop = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
  const nextScrollTop = maxScrollTop > 0
    ? Math.min(maxScrollTop, Math.round(state.ratio * maxScrollTop))
    : 0;
  previewContainer.scrollTop = nextScrollTop;
}

function computeFrontmatterOffset(md: string): number {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return match ? match[0].split("\n").length - 1 : 0;
}

function measurePreviewSurface(): { contentWidth: number; contentHeight: number } {
  const pagesRoot = previewSurface().querySelector(".pagedjs_pages");
  const firstPage = previewSurface().querySelector(".pagedjs_page") as HTMLElement | null;
  const contentWidth = firstPage?.offsetWidth || pagesRoot?.scrollWidth || A4_WIDTH_PX;
  const contentHeight = pagesRoot?.scrollHeight || previewSurface().scrollHeight || 0;
  return { contentWidth, contentHeight };
}

function scaleSurface(): void {
  const { contentWidth, contentHeight } = measurePreviewSurface();
  const containerW = Math.max(0, previewContainer.clientWidth - 40);
  const fitScale = contentWidth > 0 ? Math.min(1, containerW / contentWidth) : 1;
  const scale = fitScale * _userZoom;

  previewSurface().style.transform = `scale(${scale})`;
  previewWrapper.style.width = `${Math.ceil(contentWidth * scale)}px`;
  previewWrapper.style.height = `${Math.ceil(contentHeight * scale)}px`;
}

// ── Incremental patch utilities ─────────────────────────────────────

/** Returns the page number range currently visible in the preview viewport. */
function getVisiblePageRange(): { first: number; last: number } {
  const pages = previewSurface().querySelectorAll(".pagedjs_page");
  if (!pages.length) return { first: -1, last: -1 };
  const containerRect = previewContainer.getBoundingClientRect();
  let first = -1;
  let last = -1;
  for (const page of pages) {
    const rect = page.getBoundingClientRect();
    if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
      const num = parseInt((page as HTMLElement).dataset.pageNumber || "0", 10);
      if (first < 0) first = num;
      last = num;
    }
  }
  return { first, last };
}

/**
 * Compare old and new sourceBlocks to find which data-source-line values changed.
 * Returns null if the block structure changed (additions/deletions) — caller should
 * fall back to a full re-render in that case.
 */
function diffSourceBlocks(
  oldBlocks: Array<{ start: number; end: number; kind: string; text: string }>,
  newBlocks: Array<{ start: number; end: number; kind: string; text: string }>,
  oldHtml: string,
  newHtml: string,
): Set<string> | null {
  // If block count changed, we can't safely patch (insertions/deletions shift lines).
  if (oldBlocks.length !== newBlocks.length) return null;

  // Build a quick lookup: extract all data-source-line values and their outer HTML
  // from old and new rendered HTML to detect which elements actually changed.
  const lineRe = /data-source-line="(\d+)"/g;
  const oldLines = new Set<string>();
  const newLines = new Set<string>();
  for (const m of oldHtml.matchAll(lineRe)) oldLines.add(m[1]);
  for (const m of newHtml.matchAll(lineRe)) newLines.add(m[1]);

  // If the set of source lines differs, structure changed — fall back.
  if (oldLines.size !== newLines.size) return null;
  for (const l of oldLines) { if (!newLines.has(l)) return null; }

  // Compare elements by data-source-line in the rendered HTML.
  const changed = new Set<string>();
  const tmpOld = document.createElement("div");
  tmpOld.innerHTML = oldHtml;
  const tmpNew = document.createElement("div");
  tmpNew.innerHTML = newHtml;

  for (const line of oldLines) {
    const oldEl = tmpOld.querySelector(`[data-source-line="${line}"]`);
    const newEl = tmpNew.querySelector(`[data-source-line="${line}"]`);
    if (!oldEl || !newEl) { return null; }
    // Use rootsEqual instead of raw innerHTML so style-only edits on the
    // root element (e.g. `{:style mt=3}` changes) enter changedLines and
    // reach patchVisiblePages.
    if (!rootsEqual(oldEl, newEl)) {
      changed.add(line);
    }
  }

  return changed;
}


const PATCH_DEBOUNCE_MS = 300;
const PAGED_DEBOUNCE_MS = 800;

/** Fast path: re-parse markdown and patch only changed elements in visible pages. */
async function patchRequest(): Promise<void> {
  const markdown = editor.value;
  const activeTab = getActiveTab();

  // Patch only applies to regular markdown sections with existing Paged.js output.
  if (!markdown.trim() || isTocTab(activeTab) || isCoverTab(activeTab)) return;
  if (!_lastRenderedHtml || !_lastSourceBlocks.length) return;
  // Don't start a patch while a full render is running OR while another
  // patch is still mid-await. Concurrent patches can double-advance the
  // cached baseline; concurrent patch+render can leave Paged.js outputs
  // layered in the DOM.
  if (isRendering || _isPatching) return;

  _isPatching = true;
  try {
    const startedAt = performance.now();
    const assetBaseHref = await getAssetBaseHref(getActiveFilePath() || "");
    const project = await getProjectMetadata(getFolderPath());
    const startLine = computeFrontmatterOffset(markdown);

    const renderResult = await renderMarkdown(markdown, {
      assetBaseHref,
      fileName: getActiveFileName(),
      startLine,
      headerText: buildHeaderText(project),
      language: project?.language || "fr",
    });

    // Bail if a full render started while we were parsing.
    if (isRendering) return;

    const newHtml = renderResult.sectionHtml;
    const newBlocks = renderResult.sourceBlocks || [];

    // Diff source blocks to find changed elements.
    const changedLines = diffSourceBlocks(_lastSourceBlocks, newBlocks, _lastRenderedHtml!, newHtml);

    // If structure changed (blocks added/removed) or no changes, skip patching.
    if (changedLines === null || changedLines.size === 0) return;

    // Find visible page range and patch.
    const visibleRange = getVisiblePageRange();
    if (visibleRange.first < 0) return;

    const patched = previewRenderer.patchVisiblePages(newHtml, changedLines, visibleRange);
    if (patched > 0) {
      const elapsed = Math.round(performance.now() - startedAt);
      status.textContent = `Patched ${patched} — ${elapsed}ms`;

      // The patch covered all visible changes. Advance the cached baseline
      // (HTML, sourceBlocks, blockEntries, styleErrors) so the next diff
      // starts from the patched state, and CANCEL the pending full-render
      // timer — the preview is already correct; firing triggerRender would
      // cause a visible flicker from the Paged.js re-layout.
      _lastRenderedHtml = newHtml;
      _lastSourceBlocks = newBlocks as typeof _lastSourceBlocks;
      _lastBlockEntries = ((renderResult as any).blockEntries || []) as BlockEntry[];
      _lastStyleErrors = ((renderResult as any).styleErrors || []) as StyleError[];
      setBlockEntries(_lastBlockEntries);
      setStyleErrors(_lastStyleErrors);
      restoreSelection(_lastBlockEntries);
      // Notify listeners so editor decorations + inspector reflect the new
      // blockEntries without waiting for a full render.
      emit("section-ready");
      clearTimeout(renderTimeout ?? undefined);
      renderTimeout = null;
    }
  } finally {
    _isPatching = false;
  }
}

async function renderRequest(request: { markdown: string; generation: number }): Promise<boolean> {
  const { markdown, generation } = request;
  renderStartTime = performance.now();
  status.textContent = "Rendering...";
  lockEditorScroll();
  const previewScrollState = capturePreviewScrollState();

  const activeTab = getActiveTab();
  rsl(
    `renderRequest enter gen=${generation}/${renderGeneration}` +
    ` activeTabKind=${(activeTab as any)?.kind || "md"}` +
    ` activePath=${getActiveFilePath()}` +
    ` mdLen=${markdown?.length || 0}`,
  );
  const assetBaseTarget = isTocTab(activeTab) || isCoverTab(activeTab)
    ? getFolderPath()
    : getActiveFilePath();
  const assetBaseHref = await getAssetBaseHref(assetBaseTarget || "");
  let renderResult;

  if (isCoverTab(activeTab)) {
    _cachedCoverAssetBaseHref = assetBaseHref;
    try {
      renderResult = buildCoverRenderResult(markdown, getFolderPath() || "", assetBaseHref);
    } catch (error: any) {
      renderResult = buildCoverErrorRenderResult(error);
    }
  } else if (isTocTab(activeTab)) {
    renderResult = await buildTocRenderResult({
      assetBaseHref,
      folderPath: getFolderPath(),
    });
  } else {
    const project = await getProjectMetadata(getFolderPath());
    const startLine = computeFrontmatterOffset(markdown);
    renderResult = await renderMarkdown(markdown, {
      assetBaseHref,
      fileName: getActiveFileName(),
      startLine,
      headerText: buildHeaderText(project),
      language: project?.language || "fr",
    });
  }

  if (generation !== renderGeneration) {
    rsl(`renderRequest gen-mismatch pre-render gen=${generation} latest=${renderGeneration} → bail`);
    return false;
  }

  // Skip Paged.js entirely if HTML output hasn't changed since last render
  // AND the preview is currently showing the same target (cover renders go
  // through a different path and swap previewPages without touching
  // _lastRenderedHtml — without the target check we'd skip rendering and
  // leave cover visible when switching back to a markdown tab).
  const html = renderResult.sectionHtml;
  const currentTarget = isCoverTab(activeTab)
    ? "cover"
    : isTocTab(activeTab)
      ? "toc"
      : `md:${getActiveFilePath() || ""}`;
  if (html != null && html === _lastRenderedHtml && currentTarget === _lastDisplayedTarget) {
    const elapsed = Math.round(performance.now() - renderStartTime);
    rsl(`renderRequest cache-hit target=${currentTarget} elapsed=${elapsed}ms`);
    status.textContent = `${lastRenderStats.totalPages} pages — ${elapsed}ms (cached)`;
    unlockEditorScroll();
    return true;
  }
  rsl(
    `renderRequest invoking previewRenderer.render` +
    ` target=${currentTarget} prevTarget=${_lastDisplayedTarget}` +
    ` htmlChanged=${html !== _lastRenderedHtml}`,
  );

  lastRenderStats = await previewRenderer.render(renderResult);
  if (generation !== renderGeneration) {
    rsl(`renderRequest gen-mismatch post-render gen=${generation} latest=${renderGeneration} → bail`);
    return false;
  }

  _lastRenderedHtml = html ?? null;
  _lastDisplayedTarget = currentTarget;
  _lastSourceBlocks = (renderResult.sourceBlocks || []) as typeof _lastSourceBlocks;
  // Only renderMarkdown emits blockEntries/styleErrors; cover/TOC pipelines
  // don't carry stylable blocks, so default to empty.
  _lastBlockEntries = ((renderResult as any).blockEntries || []) as BlockEntry[];
  _lastStyleErrors = ((renderResult as any).styleErrors || []) as StyleError[];
  setBlockEntries(_lastBlockEntries);
  setStyleErrors(_lastStyleErrors);
  restoreSelection(_lastBlockEntries);

  scaleSurface();
  previewRenderer.rebuildLineMap();
  restorePreviewScrollState(previewScrollState);
  const elapsed = Math.round(performance.now() - renderStartTime);
  lastRenderStats.elapsed = elapsed;
  status.textContent = `${lastRenderStats.totalPages} pages — ${elapsed}ms`;
  emit("section-ready");
  // Unlock after the deferred rebuildAnchorMap (350ms) and scalePreview (300ms)
  // have finished so their syncFromCurrentSource calls cannot touch the editor.
  setTimeout(unlockEditorScroll, 500);
  return true;
}

async function flushRenderQueue(): Promise<void> {
  if (isRendering || !pendingMarkdown) {
    rsl(`flushRenderQueue noop isRendering=${isRendering} pending=${!!pendingMarkdown}`);
    return;
  }

  isRendering = true;
  while (pendingMarkdown) {
    const request = pendingMarkdown;
    pendingMarkdown = null;
    rsl(`flushRenderQueue iterate gen=${request.generation} mdLen=${request.markdown.length}`);

    try {
      const rendered = await renderRequest(request);
      if (!rendered && pendingMarkdown == null) {
        status.textContent = "Rendering...";
      }
    } catch (error) {
      // A newer render has already taken over — leave the preview alone and
      // let the newer call finish.  Clearing here would wipe a freshly-
      // rendered preview belonging to a different (still-running) request.
      // Still unlock the editor scroll so subsequent re-locks balance.
      if (error instanceof RenderSupersededError) {
        unlockEditorScroll();
        continue;
      }
      console.error(error);
      previewRenderer.clear();
      scaleSurface();
      status.textContent = "Preview failed";
      unlockEditorScroll();
    }
  }
  isRendering = false;
}

export async function triggerRender(): Promise<void> {
  const markdown = editor.value;
  const activeTab = getActiveTab();
  rsl(
    `triggerRender activeTabKind=${(activeTab as any)?.kind || "md"}` +
    ` activePath=${getActiveFilePath()}` +
    ` mdLen=${markdown?.length || 0}` +
    ` renderGenBefore=${renderGeneration}`,
  );
  if (!markdown.trim() && !isTocTab(activeTab) && !isCoverTab(activeTab)) {
    pendingMarkdown = null;
    previewRenderer.clear();
    scaleSurface();
    status.textContent = "Empty";
    rsl(`triggerRender → empty (no content, not TOC/cover)`);
    return;
  }

  renderGeneration += 1;
  pendingMarkdown = {
    markdown,
    generation: renderGeneration,
  };
  rsl(`triggerRender queued gen=${renderGeneration}`);
  await flushRenderQueue();
}

export function scalePreview(): void {
  scaleSurface();
}

export function zoomIn(): number {
  _userZoom = Math.min(3, _userZoom + 0.15);
  scaleSurface();
  return Math.round(_userZoom * 100);
}

export function zoomOut(): number {
  _userZoom = Math.max(0.25, _userZoom - 0.15);
  scaleSurface();
  return Math.round(_userZoom * 100);
}

export function zoomReset(): void {
  _userZoom = 1;
  scaleSurface();
}

export function getZoom(): number {
  return Math.round(_userZoom * 100);
}

export function clearRenderTimeout(): void {
  clearTimeout(renderTimeout ?? undefined);
  clearTimeout(_patchTimeout ?? undefined);
}

export function scheduleRender(_ms?: number): void {
  // Fast timer: patch visible pages after short pause.
  clearTimeout(_patchTimeout ?? undefined);
  _patchTimeout = setTimeout(() => {
    if (!isRendering) void patchRequest();
  }, PATCH_DEBOUNCE_MS);

  // Slow timer: full Paged.js paginated render after longer pause.
  clearTimeout(renderTimeout ?? undefined);
  renderTimeout = setTimeout(() => {
    void triggerRender();
  }, PAGED_DEBOUNCE_MS);
}

export function getPreviewFrame(): HTMLDivElement {
  return previewSurface();
}

export function getBlockEntries(): BlockEntry[] {
  return _lastBlockEntries;
}

export function getStyleErrors(): StyleError[] {
  return _lastStyleErrors;
}

export function getPreviewScale(): number {
  const { contentWidth } = measurePreviewSurface();
  const containerW = Math.max(0, previewContainer.clientWidth - 40);
  return contentWidth > 0 ? Math.min(1, containerW / contentWidth) * _userZoom : _userZoom;
}

export function handlePreviewLayoutChange(): void {
  scaleSurface();
}

// Re-render the cover page from an already-normalized project object, bypassing
// the full triggerRender pipeline (no markdown parse, no async asset-href lookup).
export async function renderCoverFromProject(project: Record<string, any>): Promise<void> {
  // Use a private counter — must NOT bump renderGeneration (see comment near
  // its declaration).  Cover renders are sequenced by PreviewRenderer's
  // id-based supersede, so concurrent cover/markdown calls are safe.
  const myCoverGen = ++coverGeneration;
  const pendingAtEntry = pendingMarkdown;
  rsl(
    `renderCoverFromProject ENTER coverGen=${myCoverGen} renderGen=${renderGeneration}` +
    ` pending=${!!pendingMarkdown} pendingGen=${pendingMarkdown?.generation}` +
    ` isRendering=${isRendering}`,
  );
  const assetBaseHref = _cachedCoverAssetBaseHref ?? await getAssetBaseHref(getFolderPath() || "");
  _cachedCoverAssetBaseHref = assetBaseHref;

  // If a newer triggerRender came in during our await, yield to it — the
  // active tab is no longer the cover (or a fresher cover refresh exists).
  if (myCoverGen !== coverGeneration) {
    rsl(`renderCoverFromProject newer cover gen=${coverGeneration} → yield`);
    return;
  }
  if (pendingMarkdown && pendingMarkdown !== pendingAtEntry) {
    rsl(
      `renderCoverFromProject newer pending markdown gen=${pendingMarkdown.generation}` +
      ` (pendingAtEntry=${pendingAtEntry?.generation ?? "null"}) → yield`,
    );
    return;
  }

  let renderResult;
  try {
    renderResult = buildCoverRenderResult(JSON.stringify(project), getFolderPath() || "", assetBaseHref);
  } catch (error: any) {
    renderResult = buildCoverErrorRenderResult(error);
  }

  if (myCoverGen !== coverGeneration) {
    rsl(`renderCoverFromProject pre-render newer cover gen=${coverGeneration} → bail`);
    return;
  }

  // Mark cover as currently displayed so the markdown render path's
  // cache-skip won't fire on the next markdown tab activation (it requires
  // BOTH html match and target match — see renderRequest).
  _lastDisplayedTarget = "cover";

  try {
    lastRenderStats = await previewRenderer.render(renderResult);
  } catch (error: any) {
    // Newer render has taken over — no-op so we don't clobber it.
    if (error instanceof RenderSupersededError) {
      rsl(`renderCoverFromProject SUPERSEDED coverGen=${myCoverGen}`);
      return;
    }
    console.error("Cover preview render failed:", error);
    previewRenderer.clear();
    scaleSurface();
    status.textContent = "Preview failed";
    return;
  }

  if (myCoverGen !== coverGeneration) {
    rsl(`renderCoverFromProject post-render newer cover gen=${coverGeneration} → bail`);
    return;
  }
  rsl(`renderCoverFromProject COMPLETE coverGen=${myCoverGen} pages=${lastRenderStats.totalPages}`);

  scaleSurface();
  previewRenderer.rebuildLineMap();
  const elapsed: number = Math.round(performance.now() - renderStartTime);
  lastRenderStats.elapsed = elapsed;
  status.textContent = `${lastRenderStats.totalPages} pages — ${elapsed}ms`;
  emit("section-ready");
}

function isCoverStructuralChange(page: Element, project: Record<string, any>): boolean {
  const logos = project.logos || {};
  const candidatVisible: boolean = !!(logos.candidat?.showInCover && logos.candidat?.file);
  const partenaireVisible: boolean = !!(logos.partenaire?.showInCover && logos.partenaire?.file);
  const acheteurVisible: boolean = !!(logos.acheteur?.showInCover && logos.acheteur?.file);
  if (!!page.querySelector(".beorn-cover-logo") !== candidatVisible) return true;
  if (!!page.querySelector(".beorn-cover-logo-partner") !== partenaireVisible) return true;
  if (!!page.querySelector(".beorn-cover-logo-acheteur") !== acheteurVisible) return true;

  const hasRef = !!(project.ref || project.reference || "").trim();
  if (!!page.querySelector(".beorn-cover-ref") !== hasRef) return true;

  const hasAcheteur = !!(project.acheteur || project.client || "").trim();
  const acheteurBlock = page.querySelector(".beorn-cover-info-block:nth-child(2)");
  const currentHasAcheteur = !!acheteurBlock
    && acheteurBlock.querySelector(".beorn-cover-info-label")?.textContent === "Acheteur";
  return currentHasAcheteur !== hasAcheteur;
}

function applyCoverPatch(page: Element, project: Record<string, any>): void {
  const logos = project.logos || {};
  const title = project.title || "Document";
  const doctype = project.doctype || "Mémoire technique";
  const candidat = project.candidat || "BEORN Technologies";

  const titleEl = page.querySelector(".beorn-cover-title");
  if (titleEl) titleEl.innerHTML = title.replaceAll("\n", "<br>");

  const doctypeEl = page.querySelector(".beorn-cover-doctype");
  if (doctypeEl) doctypeEl.textContent = doctype;

  const refEl = page.querySelector(".beorn-cover-ref");
  if (refEl) refEl.textContent = project.ref || project.reference || "";

  const candidatValueEl = page.querySelector(".beorn-cover-info-block:first-child .beorn-cover-info-value strong");
  if (candidatValueEl) candidatValueEl.textContent = candidat;

  const acheteurBlock = page.querySelector(".beorn-cover-info-block:nth-child(2)");
  if (acheteurBlock) {
    const acheteurValueEl = acheteurBlock.querySelector(".beorn-cover-info-value strong");
    if (acheteurValueEl) acheteurValueEl.textContent = project.acheteur || project.client || "";
  }

  const confidentialEl = page.querySelector(".beorn-cover-confidential") as HTMLElement | null;
  const wantConfidential = project.confidential !== false && project.confidential !== "false";
  if (confidentialEl) confidentialEl.style.display = wantConfidential ? "" : "none";

  // Patch logo dimensions and transform only — don't overwrite src (it was
  // resolved to a full URL during the initial render; writing back the raw
  // relative path would 404 for workspace-uploaded logos).
  const candidatImg = page.querySelector(".beorn-cover-logo") as HTMLImageElement | null;
  if (candidatImg && logos.candidat) {
    candidatImg.alt = candidat;
    candidatImg.style.maxWidth = `${logos.candidat.coverWidth || 180}px`;
    candidatImg.style.transform = `translate(${logos.candidat.coverX || 0}px,${logos.candidat.coverY || 0}px)`;
  }

  const partenaireImg = page.querySelector(".beorn-cover-logo-partner") as HTMLImageElement | null;
  if (partenaireImg && logos.partenaire) {
    partenaireImg.style.maxWidth = `${logos.partenaire.coverWidth || 180}px`;
    partenaireImg.style.transform = `translate(${logos.partenaire.coverX || 0}px,${logos.partenaire.coverY || 0}px)`;
  }

  const acheteurImg = page.querySelector(".beorn-cover-logo-acheteur") as HTMLImageElement | null;
  if (acheteurImg && logos.acheteur) {
    acheteurImg.style.maxWidth = `${logos.acheteur.coverWidth || 180}px`;
    acheteurImg.style.transform = `translate(${logos.acheteur.coverX || 0}px,${logos.acheteur.coverY || 0}px)`;
  }
}

// Update the cover preview from a normalized project object.
// Patches the DOM in-place for cosmetic changes; runs a fast Paged.js re-render
// for structural changes (logo added/removed, ref/acheteur toggling empty↔filled).
// Always returns true — the caller does not need to fall back to triggerRender.
export function updateCoverPreview(project: Record<string, any>): boolean {
  const page = previewSurface().querySelector(".pagedjs_page");
  if (!page || isCoverStructuralChange(page, project)) {
    void renderCoverFromProject(project);
  } else {
    applyCoverPatch(page, project);
  }
  return true;
}

window.addEventListener("resize", scalePreview);

