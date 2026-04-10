import { escapeHtml } from "../core/utils.js";
import { getFileEntries, getFolderPath, readFile } from "../workspace/file-manager.js";
import { getActiveTab, getTabs } from "../workspace/tab-bar.js";
import { cm } from "../editor/editor.js";
import * as platform from "../core/platform.js";
import { buildCoverHtml, buildHeaderText, buildSommaireHtml } from "./document.js";
import { renderMarkdown } from "./render-pipeline.js";

export const COVER_TAB_KIND = "cover";
export const TOC_TAB_KIND = "toc";
export const TOC_VIRTUAL_BASENAME = "__paged_editor_virtual_toc__";

function prettyJson(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function normalizeProjectData(project = {}) {
  return {
    ...project,
    title: project.title || "Document",
    doctype: project.doctype || "Memoire technique",
    ref: project.ref || project.reference || project.ao_ref || "",
    reference: project.reference || project.ref || project.ao_ref || "",
    ao_ref: project.ao_ref || project.ref || project.reference || "",
    acheteur: project.acheteur || project.client || "",
    candidat: project.candidat || "BEORN Technologies",
    confidential: project.confidential ?? true,
  };
}

function buildDefaultProjectData(folderPath = "") {
  return normalizeProjectData({
    title: folderPath ? folderPath.split("/").pop() : "Document",
    doctype: "Memoire technique",
    ao_ref: "",
    acheteur: "",
    candidat: "BEORN Technologies",
    confidential: true,
  });
}

function buildPreviewErrorHtml(title, message) {
  return `<section class="level2">
    <h1>${escapeHtml(title)}</h1>
    <div class="preview-error-box">
      <p>${escapeHtml(message)}</p>
    </div>
  </section>`;
}

export function getProjectJsonPath(folderPath = getFolderPath()) {
  if (platform.isWebMode) return "project.json";
  if (!folderPath) return null;
  return `${folderPath}/project.json`;
}

export function getTocVirtualPath(folderPath = getFolderPath()) {
  if (platform.isWebMode) return TOC_VIRTUAL_BASENAME;
  if (!folderPath) return null;
  return `${folderPath}/${TOC_VIRTUAL_BASENAME}`;
}

export function getMemoireSidebarEntries(folderPath = getFolderPath()) {
  if (!folderPath) return [];
  return [
    { kind: COVER_TAB_KIND, name: "Cover", path: getProjectJsonPath(folderPath), icon: "🗂️" },
    { kind: TOC_TAB_KIND, name: "TOC", path: getTocVirtualPath(folderPath), icon: "☰" },
  ];
}

export function isCoverTab(tab) {
  return tab?.kind === COVER_TAB_KIND;
}

export function isTocTab(tab) {
  return tab?.kind === TOC_TAB_KIND;
}

export function isReadOnlyTab(tab) {
  return isTocTab(tab) || !!tab?.readOnly;
}

export function isMarkdownTab(tab) {
  return !tab?.kind || (tab.kind !== COVER_TAB_KIND && tab.kind !== TOC_TAB_KIND);
}

export async function loadProjectJsonSource(folderPath = getFolderPath()) {
  const projectPath = getProjectJsonPath(folderPath);
  if (!projectPath) return prettyJson(buildDefaultProjectData(folderPath));

  try {
    const content = await readFile(projectPath);
    if (content == null) return prettyJson(buildDefaultProjectData(folderPath));
    return content;
  } catch {
    return prettyJson(buildDefaultProjectData(folderPath));
  }
}

export function parseProjectJsonSource(source, folderPath = getFolderPath()) {
  const text = String(source || "").trim();
  if (!text) return buildDefaultProjectData(folderPath);
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("project.json must contain a JSON object.");
  }
  return normalizeProjectData(parsed);
}

export async function getProjectMetadata(folderPath = getFolderPath()) {
  try {
    return parseProjectJsonSource(await loadProjectJsonSource(folderPath), folderPath);
  } catch {
    return buildDefaultProjectData(folderPath);
  }
}

export function buildCoverRenderResult(projectSource, folderPath = getFolderPath()) {
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
  let headerText = buildHeaderText(project);
  let language = project.language || "fr";

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

  let sectionHtml = buildSommaireHtml(headings);
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
