// render-scheduler.js — Schedules renders, picks the right pipeline, pushes to the preview renderer.

import { editor, previewContainer, status } from "../editor/codemirror-editor.js";
import { getActiveFileName, getActiveFilePath } from "../workspace/files/active-file-context.js";
import { getActiveTab } from "../workspace/tabs/tab-bar-controller.js";
import { getFolderPath } from "../workspace/files/file-manager.js";
import { renderMarkdown } from "./rendering/section-pipeline.js";
import { PreviewRenderer } from "./rendering/preview-renderer.js";
import { emit } from "../infrastructure/event-bus.js";
import { getAssetBaseHref } from "../workspace/files/asset-manager.js";
import { buildHeaderText } from "./export/html-document-wrapper.js";
import { buildCoverRenderResult, buildCoverErrorRenderResult } from "./rendering/cover-pipeline.js";
import { buildTocRenderResult } from "./rendering/toc-pipeline.js";
import { getProjectMetadata, isCoverTab, isTocTab } from "./model/memoire-views.js";

const A4_WIDTH_PX = 794;
const previewWrapper = document.getElementById("preview-wrapper");

const previewSurface = document.createElement("div");
previewSurface.className = "preview-surface";
previewWrapper.appendChild(previewSurface);

const previewRenderer = new PreviewRenderer({
  previewFrame: previewContainer,
  previewPages: previewSurface,
});

let _userZoom = 1;
let renderTimeout = null;
let renderStartTime = 0;
let renderGeneration = 0;
let pendingMarkdown = null;
let isRendering = false;
let lastRenderStats = {
  elapsed: 0,
  totalPages: 0,
};
let _cachedCoverAssetBaseHref = null;

function capturePreviewScrollState() {
  const maxScrollTop = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
  return {
    scrollTop: previewContainer.scrollTop,
    ratio: maxScrollTop > 0 ? previewContainer.scrollTop / maxScrollTop : 0,
  };
}

function restorePreviewScrollState(state) {
  if (!state) return;
  const maxScrollTop = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
  const nextScrollTop = maxScrollTop > 0
    ? Math.min(maxScrollTop, Math.round(state.ratio * maxScrollTop))
    : 0;
  previewContainer.scrollTop = nextScrollTop;
}

function computeFrontmatterOffset(md) {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return match ? match[0].split("\n").length - 1 : 0;
}

function measurePreviewSurface() {
  const pagesRoot = previewSurface.querySelector(".pagedjs_pages");
  const firstPage = previewSurface.querySelector(".pagedjs_page");
  const contentWidth = firstPage?.offsetWidth || pagesRoot?.scrollWidth || A4_WIDTH_PX;
  const contentHeight = pagesRoot?.scrollHeight || previewSurface.scrollHeight || 0;
  return { contentWidth, contentHeight };
}

function scaleSurface() {
  const { contentWidth, contentHeight } = measurePreviewSurface();
  const containerW = Math.max(0, previewContainer.clientWidth - 40);
  const fitScale = contentWidth > 0 ? Math.min(1, containerW / contentWidth) : 1;
  const scale = fitScale * _userZoom;

  previewSurface.style.transform = `scale(${scale})`;
  previewWrapper.style.width = `${Math.ceil(contentWidth * scale)}px`;
  previewWrapper.style.height = `${Math.ceil(contentHeight * scale)}px`;
}

async function renderRequest(request) {
  const { markdown, generation } = request;
  renderStartTime = performance.now();
  status.textContent = "Rendering...";
  const previewScrollState = capturePreviewScrollState();

  const activeTab = getActiveTab();
  const assetBaseTarget = isTocTab(activeTab) || isCoverTab(activeTab)
    ? getFolderPath()
    : getActiveFilePath();
  const assetBaseHref = await getAssetBaseHref(assetBaseTarget);
  let renderResult;

  if (isCoverTab(activeTab)) {
    _cachedCoverAssetBaseHref = assetBaseHref;
    try {
      renderResult = buildCoverRenderResult(markdown, getFolderPath());
    } catch (error) {
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

  if (generation !== renderGeneration) return false;

  lastRenderStats = await previewRenderer.render(renderResult);
  if (generation !== renderGeneration) return false;

  scaleSurface();
  previewRenderer.rebuildLineMap();
  restorePreviewScrollState(previewScrollState);
  const elapsed = Math.round(performance.now() - renderStartTime);
  lastRenderStats.elapsed = elapsed;
  status.textContent = `${lastRenderStats.totalPages} pages — ${elapsed}ms`;
  emit("section-ready");
  return true;
}

async function flushRenderQueue() {
  if (isRendering || !pendingMarkdown) return;

  isRendering = true;
  while (pendingMarkdown) {
    const request = pendingMarkdown;
    pendingMarkdown = null;

    try {
      const rendered = await renderRequest(request);
      if (!rendered && pendingMarkdown == null) {
        status.textContent = "Rendering...";
      }
    } catch (error) {
      console.error(error);
      previewRenderer.clear();
      scaleSurface();
      status.textContent = "Preview failed";
    }
  }
  isRendering = false;
}

export async function triggerRender() {
  const markdown = editor.value;
  const activeTab = getActiveTab();
  if (!markdown.trim() && !isTocTab(activeTab) && !isCoverTab(activeTab)) {
    pendingMarkdown = null;
    previewRenderer.clear();
    scaleSurface();
    status.textContent = "Empty";
    return;
  }

  renderGeneration += 1;
  pendingMarkdown = {
    markdown,
    generation: renderGeneration,
  };
  await flushRenderQueue();
}

export function scalePreview() {
  scaleSurface();
}

export function zoomIn() {
  _userZoom = Math.min(3, _userZoom + 0.15);
  scaleSurface();
  return Math.round(_userZoom * 100);
}

export function zoomOut() {
  _userZoom = Math.max(0.25, _userZoom - 0.15);
  scaleSurface();
  return Math.round(_userZoom * 100);
}

export function zoomReset() {
  _userZoom = 1;
  scaleSurface();
}

export function getZoom() {
  return Math.round(_userZoom * 100);
}

export function clearRenderTimeout() {
  clearTimeout(renderTimeout);
}

export function scheduleRender(ms) {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    void triggerRender();
  }, ms);
}

export function getPreviewFrame() {
  return previewSurface;
}

export function getPreviewScale() {
  const { contentWidth } = measurePreviewSurface();
  const containerW = Math.max(0, previewContainer.clientWidth - 40);
  return contentWidth > 0 ? Math.min(1, containerW / contentWidth) * _userZoom : _userZoom;
}

export function getLineMap() {
  return previewRenderer.getLineMap();
}

export function handlePreviewLayoutChange() {
  scaleSurface();
}

// Re-render the cover page from an already-normalized project object, bypassing
// the full triggerRender pipeline (no markdown parse, no async asset-href lookup).
export async function renderCoverFromProject(project) {
  const assetBaseHref = _cachedCoverAssetBaseHref ?? await getAssetBaseHref(getFolderPath());
  _cachedCoverAssetBaseHref = assetBaseHref;

  renderGeneration += 1;
  const generation = renderGeneration;

  let renderResult;
  try {
    renderResult = buildCoverRenderResult(JSON.stringify(project), getFolderPath());
  } catch (error) {
    renderResult = buildCoverErrorRenderResult(error);
  }

  if (generation !== renderGeneration) return;
  lastRenderStats = await previewRenderer.render(renderResult);
  if (generation !== renderGeneration) return;

  scaleSurface();
  previewRenderer.rebuildLineMap();
  const elapsed = Math.round(performance.now() - renderStartTime);
  lastRenderStats.elapsed = elapsed;
  status.textContent = `${lastRenderStats.totalPages} pages — ${elapsed}ms`;
  emit("section-ready");
}

function isCoverStructuralChange(page, project) {
  const logos = project.logos || {};
  const candidatVisible = !!(logos.candidat?.showInCover && logos.candidat?.file);
  const partenaireVisible = !!(logos.partenaire?.showInCover && logos.partenaire?.file);
  if (!!page.querySelector(".beorn-cover-logo") !== candidatVisible) return true;
  if (!!page.querySelector(".beorn-cover-logo-partner") !== partenaireVisible) return true;

  const hasRef = !!(project.ref || project.reference || "").trim();
  if (!!page.querySelector(".beorn-cover-ref") !== hasRef) return true;

  const hasAcheteur = !!(project.acheteur || project.client || "").trim();
  const acheteurBlock = page.querySelector(".beorn-cover-info-block:nth-child(2)");
  const currentHasAcheteur = !!acheteurBlock
    && acheteurBlock.querySelector(".beorn-cover-info-label")?.textContent === "Acheteur";
  return currentHasAcheteur !== hasAcheteur;
}

function applyCoverPatch(page, project) {
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

  const confidentialEl = page.querySelector(".beorn-cover-confidential");
  const wantConfidential = project.confidential !== false && project.confidential !== "false";
  if (confidentialEl) confidentialEl.style.display = wantConfidential ? "" : "none";

  const candidatImg = page.querySelector(".beorn-cover-logo");
  if (candidatImg && logos.candidat) {
    candidatImg.src = logos.candidat.file;
    candidatImg.alt = candidat;
    candidatImg.style.maxWidth = `${logos.candidat.coverWidth || 180}px`;
  }

  const partenaireImg = page.querySelector(".beorn-cover-logo-partner");
  if (partenaireImg && logos.partenaire) {
    partenaireImg.src = logos.partenaire.file;
    partenaireImg.style.maxWidth = `${logos.partenaire.coverWidth || 180}px`;
  }
}

// Update the cover preview from a normalized project object.
// Patches the DOM in-place for cosmetic changes; runs a fast Paged.js re-render
// for structural changes (logo added/removed, ref/acheteur toggling empty↔filled).
// Always returns true — the caller does not need to fall back to triggerRender.
export function updateCoverPreview(project) {
  const page = previewSurface.querySelector(".pagedjs_page");
  if (!page || isCoverStructuralChange(page, project)) {
    void renderCoverFromProject(project);
  } else {
    applyCoverPatch(page, project);
  }
  return true;
}

window.addEventListener("resize", scalePreview);

