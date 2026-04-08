// document.js — HTML document wrapper and cover/sommaire builders.

import { getAssets } from "./assets.js";
import { escapeHtml } from "./utils.js";

// ── Header text ─────────────────────────────────────────────────────────────

export function buildHeaderText(fm) {
  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";
  const parts = title.split(/\s*[—–]\s*/);
  const projectName = parts.length > 1 ? parts.slice(1).join(" — ") : title;
  return escapeHtml(projectName) + " \u2014 " + escapeHtml(doctype);
}

// ── Iframe HTML wrapper ─────────────────────────────────────────────────────

export function wrapInDocument(bodyHtml, opts) {
  const { gen, headerText, language } = opts;
  const {
    PDF_CSS,
    PAGED_CSS,
    PAGED_JS_TEXT,
    SECTION_INIT_TEXT,
    BEORN_LOGO_DATA_URI,
  } = getAssets();

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&display=swap" rel="stylesheet" />
  <style>${PDF_CSS}</style>
  <style>${PAGED_CSS}</style>
  ${BEORN_LOGO_DATA_URI ? "<style>.pagedjs_page::after { background-image: url(" + BEORN_LOGO_DATA_URI + "); }</style>" : ""}
  <script>window.PagedConfig = { auto: false };<\/script>
</head>
<body>
  <div class="pdf-page-gradient"></div>
  ${headerText ? '<div class="pdf-running-header">' + headerText + "</div>" : ""}
  <div class="pdf-content">${bodyHtml}</div>
  <script>${PAGED_JS_TEXT}<\/script>
  <script>window.__gen = ${gen};<\/script>
  <script>${SECTION_INIT_TEXT}<\/script>
</body>
</html>`;
}

// ── Cover page ──────────────────────────────────────────────────────────────

export function buildCoverHtml(fm) {
  const { BEORN_LOGO_DATA_URI, PARTNER_LOGO_DATA_URI } = getAssets();

  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";
  const ref = fm.ref || fm.reference || "";
  const acheteur = fm.acheteur || fm.client || "";
  const candidat = fm.candidat || "BEORN Technologies";
  const confidential = fm.confidential !== "false";

  // Logos
  let logosHtml = "";
  if (BEORN_LOGO_DATA_URI) {
    logosHtml += `<img class="beorn-cover-logo" src="${BEORN_LOGO_DATA_URI}" alt="BEORN Technologies" />`;
  }
  if (PARTNER_LOGO_DATA_URI) {
    logosHtml += `<div class="beorn-cover-logo-separator"></div>`;
    logosHtml += `<img class="beorn-cover-logo-partner" src="${PARTNER_LOGO_DATA_URI}" alt="" />`;
  }

  // Info blocks
  const infoBlocks = [];
  infoBlocks.push(
    `<div class="beorn-cover-info-block"><div class="beorn-cover-info-label">Candidat</div><div class="beorn-cover-info-value"><strong>${escapeHtml(candidat)}</strong></div></div>`,
  );
  if (acheteur) {
    infoBlocks.push(
      `<div class="beorn-cover-info-block"><div class="beorn-cover-info-label">Acheteur</div><div class="beorn-cover-info-value"><strong>${escapeHtml(acheteur)}</strong></div></div>`,
    );
  }

  return `<div class="beorn-cover beorn-cover-hero">
  <div class="beorn-cover-body">
    <div class="beorn-cover-logos">${logosHtml}</div>
    <div class="beorn-cover-doctype">${escapeHtml(doctype)}</div>
    <div class="beorn-cover-title">${escapeHtml(title)}</div>
    <div class="beorn-cover-underline">
      <span class="solid"></span>
      <span class="chunk" style="width:40px;"></span>
      <span class="chunk" style="width:24px; opacity:0.7;"></span>
      <span class="chunk" style="width:14px; opacity:0.45;"></span>
      <span class="chunk" style="width:6px; opacity:0.25;"></span>
      <span class="chunk" style="width:4px; height:4px; border-radius:50%; opacity:0.15;"></span>
    </div>
    ${ref ? `<div class="beorn-cover-ref">${escapeHtml(ref)}</div>` : ""}
    <div class="beorn-cover-bottom-section">
      <div class="beorn-cover-info-grid">${infoBlocks.join("\n")}</div>
      ${confidential ? '<div class="beorn-cover-confidential">Document confidentiel — Reproduction interdite</div>' : ""}
    </div>
  </div>
</div>`;
}

// ── Sommaire (table of contents) ────────────────────────────────────────────

export function buildSommaireHtml(headings) {
  const { BEORN_LOGO_DATA_URI } = getAssets();

  const entries = headings.map((h) => {
    const numStr = h.num != null ? String(h.num).padStart(2, "0") : "";
    return `<a class="beorn-toc-entry" href="#${h.id}">
          <span class="beorn-toc-num">${escapeHtml(numStr)}</span>
          <span class="beorn-toc-title">${escapeHtml(h.title)}</span>
          <span class="beorn-toc-dots"></span>
        </a>`;
  });

  const logoHtml = BEORN_LOGO_DATA_URI
    ? `<div class="beorn-cover-logos"><img class="beorn-cover-logo" src="${BEORN_LOGO_DATA_URI}" alt="BEORN Technologies" style="max-width:120px;" /></div>`
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
