// cover-pipeline.js — Builds the render result for the Cover tab.
// Input: raw project.json source string.
// Output: a renderResult object ready for PreviewRenderer.render().

import { buildHeaderText } from "../export/html-document-wrapper.js";
import { buildCoverHtml } from "../export/cover-page-builder.js";
import { escapeHtml } from "../../infrastructure/text-utils.js";
import { parseProjectJsonSource } from "../model/memoire-views.js";

function buildPreviewErrorHtml(title, message) {
  return `<section class="level2">
    <h1>${escapeHtml(title)}</h1>
    <div class="preview-error-box">
      <p>${escapeHtml(message)}</p>
    </div>
  </section>`;
}

export function buildCoverRenderResult(projectSource, folderPath) {
  const project = parseProjectJsonSource(projectSource, folderPath);
  return {
    sectionHtml: buildCoverHtml(project),
    headerText: buildHeaderText(project),
    language: project.language || "fr",
    rootPageName: "cover",
    lineNumberOffset: 0,
    lineStarts: [0],
    sourceBlocks: [],
  };
}

export function buildCoverErrorRenderResult(error) {
  return {
    sectionHtml: buildPreviewErrorHtml("Cover", error.message || String(error)),
    headerText: "Project metadata error",
    language: "fr",
    lineNumberOffset: 0,
    lineStarts: [0],
    sourceBlocks: [],
  };
}
