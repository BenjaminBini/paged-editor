// document.js — Export document wrapper and cover/sommaire builders.

import { getAssets } from "../core/assets.js";
import { escapeHtml } from "../core/utils.js";

// ── Header text ─────────────────────────────────────────────────────────────

export function buildHeaderText(fm) {
  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";
  const parts = title.split(/\s*[—–]\s*/);
  const projectName = parts.length > 1 ? parts.slice(1).join(" — ") : title;
  return escapeHtml(projectName) + " \u2014 " + escapeHtml(doctype);
}

const GOOGLE_FONTS_FALLBACK_TAG =
  '<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&display=swap" rel="stylesheet" />';

function buildPagedJsTag({ PAGED_JS_BLOB_URL, PAGED_JS_TEXT }) {
  if (PAGED_JS_BLOB_URL) return `<script src="${PAGED_JS_BLOB_URL}"><\/script>`;
  if (PAGED_JS_TEXT) return `<script>${PAGED_JS_TEXT}<\/script>`;
  throw new Error("Paged.js assets are not loaded yet.");
}

function buildExportBootstrapScript() {
  return `<script>
(async function() {
  try {
    const previewer = new Paged.Previewer();
    await previewer.preview();
  } catch (error) {
    console.error("Paged export bootstrap failed:", error);
  }
})();
<\/script>`;
}

export function wrapInDocument(bodyHtml, opts) {
  const {
    assetBaseHref = "",
    headerText,
    language,
    hasCoverPage = false,
    rootPageName = "",
  } = opts;
  const {
    PDF_CSS,
    PAGED_CSS,
    FONTS_CSS,
    PAGED_JS_BLOB_URL,
    PAGED_JS_TEXT,
    BEORN_LOGO_DATA_URI,
    BEORN_LOGO_BLOB_URL,
  } = getAssets();

  // Prefer blob URL for the logo too (avoids inlining large base64 payloads).
  const logoUrl = BEORN_LOGO_BLOB_URL || BEORN_LOGO_DATA_URI;
  const fontsTag = FONTS_CSS ? `<style>${FONTS_CSS}</style>` : GOOGLE_FONTS_FALLBACK_TAG;
  const baseTag = assetBaseHref ? `<base href="${escapeHtml(assetBaseHref)}" />` : "";
  const logoStyle = logoUrl
    ? `<style>.pagedjs_page::after { background-image: url("${logoUrl}"); }</style>`
    : "";
  const includeRunningElements = !rootPageName;
  const runningHeader = headerText
    && includeRunningElements
    ? `<div class="pdf-running-header">${headerText}</div>`
    : "";
  const sectionEntryCss = `<style>
  .pdf-content > section.level2 > h1:first-child {
    break-before: auto !important;
    page-break-before: auto !important;
  }
  </style>`;
  const firstPageCss = hasCoverPage || rootPageName
    ? ""
    : `<style>
  @page :first {
    margin: 20mm 18mm 25mm 18mm;
    @top {
      content: element(pdf-page-gradient);
    }
    @top-center {
      content: element(pdf-running-header);
    }
    @bottom {
      content: counter(page);
      font-family: "Hanken Grotesk", sans-serif;
      font-size: 8pt;
      color: #718096;
    }
  }
  </style>`;
  const pdfContentAttrs = rootPageName
    ? ` class="pdf-content" style="page: ${escapeHtml(rootPageName)};"`
    : ` class="pdf-content"`;
  const bodyAttrs = rootPageName
    ? ` style="page: ${escapeHtml(rootPageName)};"`
    : "";

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="UTF-8" />
  ${baseTag}
  ${fontsTag}
  <style>${PDF_CSS}</style>
  <style>${PAGED_CSS}</style>
  ${sectionEntryCss}
  ${firstPageCss}
  ${logoStyle}
  <script>window.PagedConfig = { auto: false };</script>
</head>
<body${bodyAttrs}>
  ${includeRunningElements ? '<div class="pdf-page-gradient"></div>' : ""}
  ${runningHeader}
  <div${pdfContentAttrs}>${bodyHtml}</div>
  ${buildPagedJsTag({ PAGED_JS_BLOB_URL, PAGED_JS_TEXT })}
  ${buildExportBootstrapScript()}
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
