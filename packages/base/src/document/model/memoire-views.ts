import { getFolderPath, readFile } from "../../workspace/files/file-manager.js";
import * as platform from "../../infrastructure/platform-adapter.js";

export const COVER_TAB_KIND = "cover";
export const TOC_TAB_KIND = "toc";
export const TOC_VIRTUAL_BASENAME = "__paged_editor_virtual_toc__";

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

const LOGO_DEFAULTS: Record<string, { file: string; showInCover: boolean }> = {
  candidat:  { file: "assets/beorn-logo.png",      showInCover: true  },
  partenaire: { file: "assets/liferay-logo.svg",   showInCover: true  },
};

export function normalizeLogoEntry(entry: Record<string, any> = {}, key = ""): { file: string; showInCover: boolean; coverWidth: number; coverX: number; coverY: number; showInFooter: boolean; footerWidth: number; footerX: number; footerY: number } {
  const defaults: { file?: string; showInCover?: boolean } = LOGO_DEFAULTS[key] || {};
  return {
    file: entry.file || defaults.file || "",
    showInCover: entry.showInCover ?? (defaults.showInCover ?? false),
    coverWidth: entry.coverWidth ?? 180,
    coverX: entry.coverX ?? 0,
    coverY: entry.coverY ?? 0,
    showInFooter: entry.showInFooter ?? false,
    footerWidth: entry.footerWidth ?? 80,
    footerX: entry.footerX ?? 0,
    footerY: entry.footerY ?? 0,
  };
}

export function normalizeProjectData(project: Record<string, any> = {}): Record<string, any> {
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
    language: project.language || "",
    logos: {
      candidat: normalizeLogoEntry(project.logos?.candidat, "candidat"),
      partenaire: normalizeLogoEntry(project.logos?.partenaire, "partenaire"),
      acheteur: normalizeLogoEntry(project.logos?.acheteur, "acheteur"),
    },
  };
}

function buildDefaultProjectData(folderPath = ""): Record<string, any> {
  return normalizeProjectData({
    title: folderPath ? folderPath.split("/").pop() : "Document",
    doctype: "Memoire technique",
    ao_ref: "",
    acheteur: "",
    candidat: "BEORN Technologies",
    confidential: true,
  });
}

export function getProjectJsonPath(folderPath = getFolderPath()): string | null {
  if (platform.isWebMode) return "project.json";
  if (!folderPath) return null;
  return `${folderPath}/project.json`;
}

export function getTocVirtualPath(folderPath = getFolderPath()): string | null {
  if (platform.isWebMode) return TOC_VIRTUAL_BASENAME;
  if (!folderPath) return null;
  return `${folderPath}/${TOC_VIRTUAL_BASENAME}`;
}

export function getMemoireSidebarEntries(folderPath = getFolderPath()): Array<{ kind: string; name: string; path: string | null; icon: string }> {
  if (!folderPath) return [];
  return [
    { kind: COVER_TAB_KIND, name: "Cover", path: getProjectJsonPath(folderPath), icon: "🗂️" },
    { kind: TOC_TAB_KIND, name: "TOC", path: getTocVirtualPath(folderPath), icon: "☰" },
  ];
}

export function isCoverTab(tab: { kind?: string } | null | undefined): boolean {
  return tab?.kind === COVER_TAB_KIND;
}

export function isTocTab(tab: { kind?: string } | null | undefined): boolean {
  return tab?.kind === TOC_TAB_KIND;
}

export function isReadOnlyTab(tab: { kind?: string; readOnly?: boolean } | null | undefined): boolean {
  return isTocTab(tab) || !!tab?.readOnly;
}

export function isMarkdownTab(tab: { kind?: string } | null | undefined): boolean {
  return !tab?.kind || (tab.kind !== COVER_TAB_KIND && tab.kind !== TOC_TAB_KIND);
}

export async function loadProjectJsonSource(folderPath: string | null | undefined = getFolderPath()): Promise<string> {
  const projectPath = getProjectJsonPath(folderPath);
  if (!projectPath) return prettyJson(buildDefaultProjectData(folderPath || ""));

  try {
    const content = await readFile(projectPath);
    if (content == null) return prettyJson(buildDefaultProjectData(folderPath || ""));
    return content;
  } catch {
    return prettyJson(buildDefaultProjectData(folderPath || ""));
  }
}

export function parseProjectJsonSource(source: string, folderPath: string | null | undefined = getFolderPath()): Record<string, any> {
  const text = String(source || "").trim();
  if (!text) return buildDefaultProjectData(folderPath || "");
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("project.json must contain a JSON object.");
  }
  return normalizeProjectData(parsed);
}

export async function getProjectMetadata(folderPath: string | null | undefined = getFolderPath()): Promise<Record<string, any>> {
  try {
    return parseProjectJsonSource(await loadProjectJsonSource(folderPath), folderPath);
  } catch {
    return buildDefaultProjectData(folderPath || "");
  }
}

