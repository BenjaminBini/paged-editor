// pdf-export.js — PDF export, full mémoire assembly, and in-app PDF viewer.

import { editor, status } from "../editor/editor.js";
import { getActiveFileName, getActiveFilePath } from "../workspace/parse-context.js";
import { getActiveTab } from "../workspace/tab-bar.js";
import { renderMarkdown } from "./render-pipeline.js";
import { buildHeaderText, buildCoverHtml, buildSommaireHtml, wrapInDocument } from "./document.js";
import * as platform from "../core/platform.js";
import { getFolderPath } from "../workspace/file-manager.js";
import { getAssetBaseHref } from "../workspace/workspace-assets.js";
import {
  buildCoverRenderResult,
  buildTocRenderResult,
  getProjectMetadata,
  isCoverTab,
  isTocTab,
  loadProjectJsonSource,
  parseProjectJsonSource,
} from "./memoire-views.js";

async function resolveAssetBaseHref() {
  const activeTab = getActiveTab();
  const target = isCoverTab(activeTab) || isTocTab(activeTab)
    ? getFolderPath()
    : (getActiveFilePath() || getFolderPath() || "workspace");
  return await getAssetBaseHref(target);
}

// ── Single-document export ──────────────────────────────────────────────────

export async function buildPagedHtml(md) {
  const activeTab = getActiveTab();
  const assetBaseHref = await resolveAssetBaseHref();

  if (isCoverTab(activeTab)) {
    const result = buildCoverRenderResult(md, getFolderPath());
    return wrapInDocument(result.sectionHtml, {
      assetBaseHref,
      headerText: result.headerText,
      language: result.language,
      rootPageName: result.rootPageName,
    });
  }

  if (isTocTab(activeTab)) {
    const result = await buildTocRenderResult({ assetBaseHref, folderPath: getFolderPath() });
    return wrapInDocument(result.sectionHtml, {
      assetBaseHref,
      headerText: result.headerText,
      language: result.language,
      rootPageName: result.rootPageName,
    });
  }

  const project = await getProjectMetadata(getFolderPath());
  const result = await renderMarkdown(md, {
    assetBaseHref,
    fileName: getActiveFileName(),
    headerText: buildHeaderText(project),
    language: project.language || "fr",
  });
  return wrapInDocument(result.sectionHtml, {
    assetBaseHref,
    headerText: result.headerText,
    language: result.language,
  });
}

export async function openPreviewTab() {
  const html = await buildPagedHtml(editor.value);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function previewPdf(defaultName) {
  if (!platform.previewPdf) return;

  status.textContent = "Generating PDF...";
  const html = await buildPagedHtml(editor.value);
  const result = await platform.previewPdf(html, defaultName);
  status.textContent = "Ready";
  if (result) showPdfPanel(result.tempPath, result.name);
}

// ── Full mémoire export (all sidebar sections) ─────────────────────────────

export async function buildFullMemoireHtml(sections) {
  const assetBaseHref = await resolveAssetBaseHref();
  const project = parseProjectJsonSource(
    await loadProjectJsonSource(getFolderPath()),
    getFolderPath(),
  );
  const headerText = buildHeaderText(project);
  const language = project.language || "fr";

  const allHeadings = [];
  const sectionHtmlParts = [];
  let headingIdOffset = 0;

  for (const sec of sections) {
    const result = await renderMarkdown(sec.markdown, {
      assetBaseHref,
      fileName: sec.name,
      headingCollector: allHeadings,
      headingIdOffset,
    });
    sectionHtmlParts.push(result.sectionHtml);
    headingIdOffset = result.headingIdCounter;
  }

  const coverHtml = buildCoverHtml(project);
  const sommaireHtml =
    allHeadings.length > 0 ? buildSommaireHtml(allHeadings) : "";
  const bodyHtml =
    coverHtml + "\n" + sommaireHtml + "\n" + sectionHtmlParts.join("\n");

  return wrapInDocument(bodyHtml, {
    assetBaseHref,
    headerText,
    language,
    hasCoverPage: true,
  });
}

export async function previewFullMemoire(sections, defaultName) {
  if (!platform.previewPdf) return;

  status.textContent = "Generating full PDF...";
  const html = await buildFullMemoireHtml(sections);
  const result = await platform.previewPdf(html, defaultName);
  status.textContent = "Ready";
  if (result) showPdfPanel(result.tempPath, result.name);
}

// ── In-app PDF viewer panel ─────────────────────────────────────────────────

let _currentPdfName = "";

function showPdfPanel(tempPath, name) {
  _currentPdfName = name;
  const panel = document.getElementById("pdf-viewer-panel");
  const embed = document.getElementById("pdfViewerEmbed");
  const nameEl = document.getElementById("pdfViewerName");
  nameEl.textContent = name;
  embed.src = "";
  embed.src = "file://" + tempPath;
  panel.hidden = false;
}

export function closePdfPanel() {
  const panel = document.getElementById("pdf-viewer-panel");
  const embed = document.getElementById("pdfViewerEmbed");
  embed.src = "";
  panel.hidden = true;
}

export async function savePdfAs() {
  if (!api?.savePdfAs) return;
  await platform.savePdfAs(_currentPdfName);
}
