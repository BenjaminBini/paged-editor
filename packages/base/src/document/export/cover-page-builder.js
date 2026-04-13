// cover-pages.js — Builds the BEORN-branded hero cover page HTML fragment.

import { escapeHtml } from "../../infrastructure/text-utils.js";
import { resolveAppAssetPrefix } from "./html-document-wrapper.js";

const BUNDLED_LOGO_FILES = new Set([
  "assets/beorn-logo.png",
  "assets/liferay-logo.svg",
  "assets/lumapps-logo.svg",
]);

function resolveLogoUrl(file, assetBaseHref) {
  if (!file) return "";
  if (file.startsWith("data:") || file.startsWith("http:") || file.startsWith("https:") || file.startsWith("//")) return file;
  if (BUNDLED_LOGO_FILES.has(file)) return resolveAppAssetPrefix() + file;
  if (!assetBaseHref) return file;
  try { return new URL(file, assetBaseHref).href; } catch { return file; }
}

export function buildCoverHtml(fm, assetBaseHref = "") {
  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";
  const ref = fm.ref || fm.reference || "";
  const acheteur = fm.acheteur || fm.client || "";
  const candidat = fm.candidat || "BEORN Technologies";
  const confidential = fm.confidential !== "false";

  // Logos — use project.logos when available, fall back to preloaded assets
  const logos = fm.logos || {};
  let logosHtml = "";

  const candidatLogo = logos.candidat;
  const candidatUrl = candidatLogo?.showInCover
    ? resolveLogoUrl(candidatLogo.file || "", assetBaseHref)
    : "";
  if (candidatUrl) {
    const w = candidatLogo.coverWidth || 180;
    logosHtml += `<img class="beorn-cover-logo" src="${candidatUrl}" alt="${escapeHtml(candidat)}" style="max-width:${w}px;" />`;
  }

  const partenaireLogo = logos.partenaire;
  const partenaireUrl = partenaireLogo?.showInCover
    ? resolveLogoUrl(partenaireLogo.file || "", assetBaseHref)
    : "";
  if (partenaireUrl) {
    const w = partenaireLogo.coverWidth || 180;
    logosHtml += `<img class="beorn-cover-logo-partner" src="${partenaireUrl}" alt="" style="max-width:${w}px;" />`;
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
