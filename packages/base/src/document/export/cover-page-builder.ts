// cover-pages.js — Builds the BEORN-branded hero cover page HTML fragment.

import { escapeHtml } from "../../infrastructure/text-utils.js";
import { resolveAppAssetPrefix } from "./html-document-wrapper.js";

// Editor-bundled preset logos — these are served from the editor's own static
// root (packages/base/assets/), not from the workspace.  They must NOT be
// resolved against the workspace asset base href.
const BUNDLED_LOGO_FILES: Set<string> = new Set([
  "assets/beorn-logo.png",
  "assets/liferay-logo.svg",
  "assets/lumapps-logo.svg",
]);

function resolveLogoUrl(file: string, assetBaseHref: string): string {
  if (!file) return "";
  if (file.startsWith("data:") || file.startsWith("http:") || file.startsWith("https:") || file.startsWith("//")) return file;
  // Bundled app assets need absolute URLs when <base> points to the workspace.
  if (BUNDLED_LOGO_FILES.has(file)) return resolveAppAssetPrefix() + file;
  if (!assetBaseHref) return file;
  try { return new URL(file, assetBaseHref).href; } catch { return file; }
}

export function buildCoverHtml(fm: Record<string, any>, assetBaseHref: string = ""): string {
  const title: string = fm.title || "Document";
  const doctype: string = fm.doctype || "Mémoire technique";
  const ref: string = fm.ref || fm.reference || "";
  const acheteur: string = fm.acheteur || fm.client || "";
  const candidat: string = fm.candidat || "BEORN Technologies";
  const confidential: boolean = fm.confidential !== "false";

  // Logos — use project.logos when available, fall back to preloaded assets
  const logos: Record<string, any> = fm.logos || {};
  let logosHtml: string = "";

  const candidatLogo = logos.candidat;
  const candidatUrl: string = candidatLogo?.showInCover
    ? resolveLogoUrl(candidatLogo.file || "", assetBaseHref)
    : "";
  if (candidatUrl) {
    const w: number = candidatLogo.coverWidth || 180;
    const tx: number = candidatLogo.coverX || 0;
    const ty: number = candidatLogo.coverY || 0;
    logosHtml += `<img class="beorn-cover-logo" src="${candidatUrl}" alt="${escapeHtml(candidat)}" style="max-width:${w}px;transform:translate(${tx}px,${ty}px);" />`;
  }

  const partenaireLogo = logos.partenaire;
  const partenaireUrl: string = partenaireLogo?.showInCover
    ? resolveLogoUrl(partenaireLogo.file || "", assetBaseHref)
    : "";
  if (partenaireUrl) {
    const w: number = partenaireLogo.coverWidth || 180;
    const tx: number = partenaireLogo.coverX || 0;
    const ty: number = partenaireLogo.coverY || 0;
    logosHtml += `<img class="beorn-cover-logo-partner" src="${partenaireUrl}" alt="" style="max-width:${w}px;transform:translate(${tx}px,${ty}px);" />`;
  }

  const acheteurLogo = logos.acheteur;
  const acheteurUrl: string = acheteurLogo?.showInCover
    ? resolveLogoUrl(acheteurLogo.file || "", assetBaseHref)
    : "";
  if (acheteurUrl) {
    const w: number = acheteurLogo.coverWidth || 180;
    const tx: number = acheteurLogo.coverX || 0;
    const ty: number = acheteurLogo.coverY || 0;
    logosHtml += `<img class="beorn-cover-logo-acheteur" src="${acheteurUrl}" alt="${escapeHtml(acheteur)}" style="max-width:${w}px;transform:translate(${tx}px,${ty}px);" />`;
  }

  const infoBlocks = [
    `<div class="beorn-cover-info-block"><div class="beorn-cover-info-label">Candidat</div><div class="beorn-cover-info-value"><strong>${escapeHtml(candidat)}</strong></div></div>`,
  ];
  if (acheteur) {
    infoBlocks.push(
      `<div class="beorn-cover-info-block"><div class="beorn-cover-info-label">Acheteur</div><div class="beorn-cover-info-value"><strong>${escapeHtml(acheteur)}</strong></div></div>`,
    );
  }

  return `<div class="beorn-cover beorn-cover-hero">
  <div class="beorn-cover-body">
    <div class="beorn-cover-logos">${logosHtml}</div>
    <div class="beorn-cover-doctype">${escapeHtml(doctype)}</div>
    <div class="beorn-cover-title">${escapeHtml(title).replace(/\n/g, "<br>")}</div>
    <div class="beorn-cover-underline">
      <span class="solid"></span>
      <span class="chunk" style="width:40px;"></span>
      <span class="chunk" style="width:24px; opacity:0.7;"></span>
      <span class="chunk" style="width:14px; opacity:0.45;"></span>
      <span class="chunk" style="width:6px; opacity:0.25;"></span>
    </div>
    ${ref ? `<div class="beorn-cover-ref">${escapeHtml(ref)}</div>` : ""}
  </div>
  <div class="beorn-cover-bottom-section">
    <div class="beorn-cover-info-grid">${infoBlocks.join("\n")}</div>
    ${confidential ? '<div class="beorn-cover-confidential">Document confidentiel — Reproduction interdite</div>' : ""}
  </div>
</div>`;
}
