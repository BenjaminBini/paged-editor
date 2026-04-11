// render.js — Direct paged preview orchestrator using in-DOM Paged.js rendering.

import { editor, previewContainer, status } from "../editor/editor.js";
import { getActiveFileName, getActiveFilePath } from "../workspace/parse-context.js";
import { getActiveTab } from "../workspace/tab-bar.js";
import { getFolderPath } from "../workspace/file-manager.js";
import { renderMarkdown } from "./pipeline/render-pipeline.js";
import { PreviewRenderer } from "./renderer/preview-renderer.js";
import { emit } from "../core/event-bus.js";
import { getAssetBaseHref } from "../workspace/workspace-assets.js";
import { buildHeaderText } from "./export/document.js";
import {
  buildCoverErrorRenderResult,
  buildCoverRenderResult,
  buildTocRenderResult,
  getProjectMetadata,
  isCoverTab,
  isTocTab,
} from "./model/memoire-views.js";

const A4_WIDTH_PX = 794;
const previewWrapper = document.getElementById("preview-wrapper");

const previewSurface = document.createElement("div");
previewSurface.className = "preview-surface";
previewWrapper.appendChild(previewSurface);

const previewRenderer = new PreviewRenderer({
  previewFrame: previewContainer,
  previewPages: previewSurface,
});

let _userZoom = 1.0;
let renderTimeout = null;
let renderStartTime = 0;
let renderGeneration = 0;
let pendingMarkdown = null;
let isRendering = false;
let lastRenderStats = {
  elapsed: 0,
  totalPages: 0,
};

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
  _userZoom = 1.0;
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

window.addEventListener("resize", scalePreview);

export { renderTimeout };
