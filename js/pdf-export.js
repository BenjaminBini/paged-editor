// pdf-export.js — PDF export, full mémoire assembly, and in-app PDF viewer.

import { editor, status } from "./editor.js";
import { parseFrontmatter } from "./utils.js";
import {
  COLOR_PAIRS,
  parseMarkdownSync,
  setHeadingCollector,
  resetHeadingIdCounter,
} from "./markdown.js";
import { setActiveFileName, getActiveFileName } from "./parse-context.js";
import { resolveMermaid, getMermaidQueue } from "./mermaid-render.js";
import {
  wrapInDocument,
  buildHeaderText,
  buildCoverHtml,
  buildSommaireHtml,
} from "./document.js";

// ── Single-document export ──────────────────────────────────────────────────

export async function buildPagedHtml(md) {
  const { fm, body } = parseFrontmatter(md);
  const headerText = buildHeaderText(fm);
  const language = fm.language || "fr";

  const pm = body.match(/^#\s+Partie\s+(\d+)/im);
  let partieNum;
  if (pm) {
    partieNum = parseInt(pm[1], 10);
  } else {
    const fnMatch = getActiveFileName().match(/^(\d+)/);
    partieNum = fnMatch ? parseInt(fnMatch[1], 10) : 0;
  }
  const ci = partieNum > 0 ? (partieNum - 1) % COLOR_PAIRS.length : 0;

  const html = parseMarkdownSync(body, ci, 0);
  const queue = getMermaidQueue();
  const resolved = await resolveMermaid(html, queue);

  const pair = COLOR_PAIRS[ci % COLOR_PAIRS.length];
  const sectionHtml = `<section class="level2" style="--section-color:${pair[0]};--section-color-light:${pair[1]}">\n${resolved}\n</section>`;

  return wrapInDocument(sectionHtml, { gen: 0, headerText, language });
}

export async function openPreviewTab() {
  const html = await buildPagedHtml(editor.value);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export async function previewPdf(defaultName) {
  const api = window.electronAPI;
  if (!api?.previewPdf) return;

  status.textContent = "Generating PDF...";
  const html = await buildPagedHtml(editor.value);
  const result = await api.previewPdf(html, defaultName);
  status.textContent = "Ready";
  if (result) showPdfPanel(result.tempPath, result.name);
}

// ── Full mémoire export (all sidebar sections) ─────────────────────────────

export async function buildFullMemoireHtml(sections) {
  const first = sections[0];
  const { fm } = parseFrontmatter(first.markdown);
  const headerText = buildHeaderText(fm);
  const language = fm.language || "fr";

  const allHeadings = [];
  const sectionHtmlParts = [];
  resetHeadingIdCounter();

  for (const sec of sections) {
    const { body } = parseFrontmatter(sec.markdown);

    const pm = body.match(/^#\s+Partie\s+(\d+)/im);
    let partieNum;
    if (pm) {
      partieNum = parseInt(pm[1], 10);
    } else {
      const fnMatch = sec.name.match(/^(\d+)/);
      partieNum = fnMatch ? parseInt(fnMatch[1], 10) : 0;
    }
    const ci = partieNum > 0 ? (partieNum - 1) % COLOR_PAIRS.length : 0;
    const pair = COLOR_PAIRS[ci % COLOR_PAIRS.length];

    const prevFileName = getActiveFileName();
    setActiveFileName(sec.name);
    setHeadingCollector(allHeadings);

    let html = parseMarkdownSync(body, ci, 0);
    const queue = getMermaidQueue();
    html = await resolveMermaid(html, queue);

    setHeadingCollector(null);
    setActiveFileName(prevFileName);

    sectionHtmlParts.push(
      `<section class="level2" data-color-index="${ci % 5}" style="--section-color:${pair[0]};--section-color-light:${pair[1]}">\n${html}\n</section>`,
    );
  }

  const coverHtml = buildCoverHtml(fm);
  const sommaireHtml =
    allHeadings.length > 0 ? buildSommaireHtml(allHeadings) : "";
  const bodyHtml =
    coverHtml + "\n" + sommaireHtml + "\n" + sectionHtmlParts.join("\n");

  return wrapInDocument(bodyHtml, { gen: 0, headerText, language });
}

export async function previewFullMemoire(sections, defaultName) {
  const api = window.electronAPI;
  if (!api?.previewPdf) return;

  status.textContent = "Generating full PDF...";
  const html = await buildFullMemoireHtml(sections);
  const result = await api.previewPdf(html, defaultName);
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
  const api = window.electronAPI;
  if (!api?.savePdfAs) return;
  await api.savePdfAs(_currentPdfName);
}
