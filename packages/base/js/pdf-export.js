// pdf-export.js — PDF export, full mémoire assembly, and in-app PDF viewer.

import { editor, status } from "./editor.js";
import { parseFrontmatter } from "./utils.js";
import { getActiveFileName, getActiveFilePath } from "./parse-context.js";
import { renderMarkdown } from "./render-pipeline.js";
import { buildHeaderText, buildCoverHtml, buildSommaireHtml, wrapInDocument } from "./document.js";
import * as platform from "./platform.js";
import { getFolderPath } from "./file-manager.js";
import { getAssetBaseHref } from "./workspace-assets.js";

async function resolveAssetBaseHref() {
  return await getAssetBaseHref(getActiveFilePath() || getFolderPath() || "workspace");
}

// ── Single-document export ──────────────────────────────────────────────────

export async function buildPagedHtml(md) {
  const assetBaseHref = await resolveAssetBaseHref();
  const result = await renderMarkdown(md, {
    assetBaseHref,
    fileName: getActiveFileName(),
  });
  return result.documentHtml;
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
  const first = sections[0];
  const { fm } = parseFrontmatter(first.markdown);
  const headerText = buildHeaderText(fm);
  const language = fm.language || "fr";
  const assetBaseHref = await resolveAssetBaseHref();

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

  const coverHtml = buildCoverHtml(fm);
  const sommaireHtml =
    allHeadings.length > 0 ? buildSommaireHtml(allHeadings) : "";
  const bodyHtml =
    coverHtml + "\n" + sommaireHtml + "\n" + sectionHtmlParts.join("\n");

  return wrapInDocument(bodyHtml, {
    assetBaseHref,
    gen: 0,
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
