// pdf-export.js — PDF export, full mémoire assembly, and in-app PDF viewer.

import { editor, status as _status } from "../../editor/codemirror-editor.js";
const status: HTMLElement = _status!;
import { getActiveFileName, getActiveFilePath } from "../../workspace/files/active-file-context.js";
import { getActiveTab } from "../../workspace/tabs/tab-bar-controller.js";
import { renderMarkdown } from "../rendering/section-pipeline.js";
import { buildCoverRenderResult } from "../rendering/cover-pipeline.js";
import { buildTocRenderResult } from "../rendering/toc-pipeline.js";
import { buildHeaderText, wrapInDocument } from "./html-document-wrapper.js";
import { buildCoverHtml } from "./cover-page-builder.js";
import { buildSommaireHtml } from "./sommaire-builder.js";
import * as platform from "../../infrastructure/platform-adapter.js";
import { getFolderPath } from "../../workspace/files/file-manager.js";
import { getAssetBaseHref } from "../../workspace/files/asset-manager.js";
import {
  getProjectMetadata,
  isCoverTab,
  isTocTab,
  loadProjectJsonSource,
  parseProjectJsonSource,
} from "../model/memoire-views.js";

async function resolveAssetBaseHref(): Promise<string> {
  const activeTab = getActiveTab();
  const target = isCoverTab(activeTab) || isTocTab(activeTab)
    ? (getFolderPath() || "")
    : (getActiveFilePath() || getFolderPath() || "workspace");
  return await getAssetBaseHref(target);
}

// ── Single-document export ──────────────────────────────────────────────────

export async function buildPagedHtml(md: string): Promise<string> {
  const activeTab = getActiveTab();
  const assetBaseHref = await resolveAssetBaseHref();

  if (isCoverTab(activeTab)) {
    const result = buildCoverRenderResult(md, getFolderPath() || "", assetBaseHref);
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

export async function openPreviewTab(): Promise<void> {
  const html = await buildPagedHtml(editor.value);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function previewPdf(defaultName: string): Promise<void> {
  if (!platform.previewPdf) return;

  status.textContent = "Generating PDF...";
  const html = await buildPagedHtml(editor.value);
  const result = await platform.previewPdf(html, defaultName);
  status.textContent = "Ready";
  if (result) showPdfPanel(result.tempPath, result.name);
}

// ── Full mémoire export (all sidebar sections) ─────────────────────────────

export async function buildFullMemoireHtml(sections: Array<{ name: string; markdown: string }>): Promise<string> {
  const assetBaseHref = await resolveAssetBaseHref();
  const project = parseProjectJsonSource(
    await loadProjectJsonSource(getFolderPath()),
    getFolderPath(),
  );
  const headerText = buildHeaderText(project);
  const language = project.language || "fr";

  const allHeadings: Array<{ depth: number; id: string; title: string; num: number | null; colorPair: [string, string] }> = [];
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

  const coverHtml = buildCoverHtml(project, assetBaseHref);
  const sommaireHtml =
    allHeadings.length > 0 ? buildSommaireHtml(allHeadings, project) : "";
  const bodyHtml: string =
    coverHtml + "\n" + sommaireHtml + "\n" + sectionHtmlParts.join("\n");

  return wrapInDocument(bodyHtml, {
    assetBaseHref,
    headerText,
    language,
  });
}

export async function previewFullMemoire(sections: Array<{ name: string; markdown: string }>, defaultName: string): Promise<void> {
  if (!platform.previewPdf) return;

  status.textContent = "Generating full PDF...";
  const html = await buildFullMemoireHtml(sections);
  const result = await platform.previewPdf(html, defaultName);
  status.textContent = "Ready";
  if (result) showPdfPanel(result.tempPath, result.name);
}

// ── In-app PDF viewer panel ─────────────────────────────────────────────────

let _currentPdfName: string = "";

function showPdfPanel(tempPath: string, name: string): void {
  _currentPdfName = name;
  const panel = document.getElementById("pdf-viewer-panel");
  const embed = document.getElementById("pdfViewerEmbed") as HTMLEmbedElement;
  const nameEl = document.getElementById("pdfViewerName");
  if (nameEl) nameEl.textContent = name;
  embed.src = "";
  embed.src = "file://" + tempPath;
  if (panel) panel.hidden = false;
}

export function closePdfPanel(): void {
  const panel = document.getElementById("pdf-viewer-panel");
  const embed = document.getElementById("pdfViewerEmbed") as HTMLEmbedElement;
  embed.src = "";
  if (panel) panel.hidden = true;
}

export async function savePdfAs(): Promise<void> {
  if (!platform?.savePdfAs) return;
  await platform.savePdfAs(_currentPdfName);
}
