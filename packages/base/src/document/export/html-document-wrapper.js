// html-wrapper.js — Builds the full <!doctype> HTML document for PDF export.

import { escapeHtml } from "../../infrastructure/text-utils.js";
import {
  GOOGLE_FONTS_TAG,
  SECTION_ENTRY_CSS,
} from "../pdf-constants.js";

export function buildHeaderText(fm) {
  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";
  const parts = title.split(/\s*[—–]\s*/);
  const projectName = parts.length > 1 ? parts.slice(1).join(" — ") : title;
  return escapeHtml(projectName) + " \u2014 " + escapeHtml(doctype);
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
</script>`;
}

export function resolveAppAssetPrefix() {
  try {
    const loc = globalThis.location;
    if (!loc?.href) return "";
    if (loc.origin && loc.origin !== "null") {
      const base = loc.pathname.replace(/\/[^/]*$/, "");
      return loc.origin + base + "/";
    }
    if (loc.href.startsWith("file://")) {
      return loc.href.replace(/\/[^/]*$/, "/");
    }
  } catch {}
  return "";
}

export function wrapInDocument(bodyHtml, opts) {
  const {
    assetBaseHref = "",
    headerText,
    language,
    rootPageName = "",
  } = opts;
  const baseTag = assetBaseHref ? `<base href="${escapeHtml(assetBaseHref)}" />` : "";
  const isCover = rootPageName === "cover";
  const includeRunningElements = !isCover;
  const runningHeader = headerText && includeRunningElements
    ? `<div class="pdf-running-header">${headerText}</div>`
    : "";
  const pageAttr = rootPageName ? ` style="page: ${escapeHtml(rootPageName)};"` : "";
  const appPrefix = assetBaseHref ? resolveAppAssetPrefix() : "";

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="UTF-8" />
  ${baseTag}
  ${GOOGLE_FONTS_TAG}
  <link rel="stylesheet" href="${appPrefix}css/preview/pdf.css" />
  <link rel="stylesheet" href="${appPrefix}css/preview/paged.css" />
  <style>${SECTION_ENTRY_CSS}</style>
  <script>window.PagedConfig = { auto: false };</script>
</head>
<body class="pdf-preview-root"${pageAttr}>
  ${includeRunningElements ? '<div class="pdf-page-gradient"></div>' : ""}
  ${runningHeader}
  ${includeRunningElements ? `<div class="pdf-footer-logo"><img src="${appPrefix}assets/beorn-logo.png" alt="BEORN"></div>` : ""}
  ${includeRunningElements ? '<div class="pdf-footer-confidential">Document confidentiel — Reproduction interdite</div>' : ""}
  <div class="pdf-content"${pageAttr}>${bodyHtml}</div>
  <script src="${appPrefix}assets/paged.polyfill.js"></script>
  ${buildExportBootstrapScript()}
</body>
</html>`;
}
