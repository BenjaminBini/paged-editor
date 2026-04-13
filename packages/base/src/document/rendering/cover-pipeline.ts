// cover-pipeline.js — Builds the render result for the Cover tab.
// Input: raw project.json source string.
// Output: a renderResult object ready for PreviewRenderer.render().

import { buildHeaderText } from "../export/html-document-wrapper.js";
import { buildCoverHtml } from "../export/cover-page-builder.js";
import { escapeHtml } from "../../infrastructure/text-utils.js";
import { parseProjectJsonSource } from "../model/memoire-views.js";

function buildPreviewErrorHtml(title: string, message: string): string {
  return `<section class="level2">
    <h1>${escapeHtml(title)}</h1>
    <div class="preview-error-box">
      <p>${escapeHtml(message)}</p>
    </div>
  </section>`;
}

export function buildCoverRenderResult(projectSource: string, folderPath: string, assetBaseHref: string = ""): { sectionHtml: string; headerText: string; language: string; rootPageName: string; lineNumberOffset: number; lineStarts: number[]; sourceBlocks: unknown[] } {
  const project = parseProjectJsonSource(projectSource, folderPath);
  return {
    sectionHtml: buildCoverHtml(project, assetBaseHref),
    headerText: buildHeaderText(project),
    language: project.language || "fr",
    rootPageName: "cover",
    lineNumberOffset: 0,
    lineStarts: [0],
    sourceBlocks: [] as unknown[],
  };
}

export function buildCoverErrorRenderResult(error: Error | { message?: string }): { sectionHtml: string; headerText: string; language: string; lineNumberOffset: number; lineStarts: number[]; sourceBlocks: unknown[] } {
  return {
    sectionHtml: buildPreviewErrorHtml("Cover", (error as Error).message || String(error)),
    headerText: "Project metadata error",
    language: "fr",
    lineNumberOffset: 0,
    lineStarts: [0],
    sourceBlocks: [] as unknown[],
  };
}
