// toc-pipeline.js — Builds the render result for the TOC tab.
// Reads all memoire sections, renders each for heading collection,
// then assembles the sommaire HTML.

import { getFileEntries, getFolderPath, readFile } from "../../workspace/files/file-manager.js";
import { getActiveTab, getTabs } from "../../workspace/tabs/tab-bar-controller.js";
import { cm } from "../../editor/codemirror-editor.js";
import { escapeHtml } from "../../infrastructure/text-utils.js";
import { buildHeaderText } from "../export/html-document-wrapper.js";
import { buildSommaireHtml } from "../export/sommaire-builder.js";
import { renderMarkdown } from "./section-pipeline.js";
import { getProjectMetadata } from "../model/memoire-views.js";

function buildPreviewErrorHtml(title, message) {
  return `<section class="level2">
    <h1>${escapeHtml(title)}</h1>
    <div class="preview-error-box">
      <p>${escapeHtml(message)}</p>
    </div>
  </section>`;
}

async function getMemoireSections() {
  const entries = getFileEntries();
  const tabs = getTabs();
  const sections = [];

  for (const entry of entries) {
    const openTab = tabs.find((tab) => tab.path === entry.path);
    let markdown;
    if (openTab) {
      markdown = getActiveTab()?.path === entry.path
        ? cm.getValue()
        : openTab.editorState?.content || openTab.savedContent || "";
    } else {
      markdown = await readFile(entry.path);
    }
    sections.push({ name: entry.name, markdown });
  }

  return sections;
}

export async function buildTocRenderResult({ assetBaseHref = "", folderPath = getFolderPath() } = {}) {
  const sections = await getMemoireSections();
  const headings = [];
  let headingIdOffset = 0;
  const project = await getProjectMetadata(folderPath);
  const headerText = buildHeaderText(project);
  const language = project.language || "fr";

  for (const section of sections) {
    const result = await renderMarkdown(section.markdown, {
      assetBaseHref,
      fileName: section.name,
      headingCollector: headings,
      headingIdOffset,
      headerText,
      language,
    });
    headingIdOffset = result.headingIdCounter;
  }

  let sectionHtml = buildSommaireHtml(headings, project);
  if (headings.length === 0) {
    sectionHtml = buildPreviewErrorHtml("TOC", "No headings found in the current memoire.");
  }

  return {
    sectionHtml,
    headerText,
    language,
    rootPageName: "sommaire",
    lineNumberOffset: 0,
    lineStarts: [0],
    sourceBlocks: [],
  };
}
