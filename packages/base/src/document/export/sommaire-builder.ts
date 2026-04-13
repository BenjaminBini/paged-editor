// sommaire.js — Builds the table of contents (sommaire) HTML fragment.

import { escapeHtml } from "../../infrastructure/text-utils.js";
import { resolveAppAssetPrefix } from "./html-document-wrapper.js";

// Bundled app logos that must not resolve against the workspace <base> tag.
const BUNDLED_LOGO_FILES: Set<string> = new Set([
  "assets/beorn-logo.png",
  "assets/liferay-logo.svg",
  "assets/lumapps-logo.svg",
]);

export function buildSommaireHtml(headings: Array<{ num?: number | null; id: string; title: string }>, fm: Record<string, any> = {}): string {
  const entries = headings.map((h: { num?: number | null; id: string; title: string }) => {
    const numStr = h.num != null ? String(h.num).padStart(2, "0") : "";
    return `<a class="beorn-toc-entry" href="#${h.id}">
          <span class="beorn-toc-num">${escapeHtml(numStr)}</span>
          <span class="beorn-toc-title">${escapeHtml(h.title)}</span>
          <span class="beorn-toc-dots"></span>
        </a>`;
  });

  const candidatLogo = fm.logos?.candidat;
  const rawUrl = candidatLogo?.showInCover
    ? (candidatLogo.file || "")
    : "";
  const candidatUrl = rawUrl && BUNDLED_LOGO_FILES.has(rawUrl)
    ? resolveAppAssetPrefix() + rawUrl
    : rawUrl;
  const logoHtml = candidatUrl
    ? `<div class="beorn-cover-logos"><img class="beorn-cover-logo" src="${candidatUrl}" alt="${escapeHtml(fm.candidat || "BEORN Technologies")}" style="max-width:120px;" /></div>`
    : "";

  return `<div class="beorn-cover beorn-cover-sommaire">
  <div class="beorn-cover-body">
    ${logoHtml}
    <div class="beorn-cover-doctype">Sommaire</div>
    <div class="beorn-cover-underline" style="margin-bottom:2.5rem;">
      <span class="solid"></span>
      <span class="chunk" style="width:40px;"></span>
      <span class="chunk" style="width:24px; opacity:0.7;"></span>
    </div>
    <nav role="doc-toc" class="beorn-toc">${entries.join("\n")}</nav>
  </div>
</div>`;
}
