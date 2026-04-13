// html-wrapper.js — Builds the full <!doctype> HTML document for PDF export.

import { escapeHtml } from "../../infrastructure/text-utils.js";
import {
  GOOGLE_FONTS_TAG,
  SECTION_ENTRY_CSS,
} from "../pdf-constants.js";

export function buildHeaderText(fm: Record<string, any>): string {
  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";
  const parts = title.split(/\s*[—–]\s*/);
  const projectName = parts.length > 1 ? parts.slice(1).join(" — ") : title;
  return escapeHtml(projectName) + " \u2014 " + escapeHtml(doctype);
}

function buildExportBootstrapScript(): string {
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

/**
 * Compute the absolute URL prefix for app-level static assets (CSS, JS, polyfill).
 *
 * When a `<base href>` tag redirects relative URLs to the workspace, app assets
 * like `css/preview/pdf.css` or `assets/paged.polyfill.js` would resolve against
 * the workspace path instead of the editor's own static root.  This function
 * returns a prefix so those paths become absolute and bypass `<base>`.
 */
export function resolveAppAssetPrefix(): string {
  try {
    const loc = globalThis.location;
    if (!loc?.href) return "";

    // Web mode (http/https): derive prefix from origin + path directory.
    if (loc.origin && loc.origin !== "null") {
      const base = loc.pathname.replace(/\/[^/]*$/, "");
      return loc.origin + base + "/";
    }

    // Electron (file:// — origin is "null"): derive from href directly.
    if (loc.href.startsWith("file://")) {
      return loc.href.replace(/\/[^/]*$/, "/");
    }
  } catch {}
  return "";
}

export function wrapInDocument(bodyHtml: string, opts: Record<string, any>): string {
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

  // When <base> is set, app assets need absolute URLs to bypass it.
  const appPrefix = assetBaseHref ? resolveAppAssetPrefix() : "";

  // Build running-element markup.  These have `position: running(…)` in CSS
  // so Paged.js removes them from flow and places them in margin boxes.
  const runningHtml: string = includeRunningElements ? [
    '<div class="pdf-page-gradient"></div>',
    runningHeader,
    `<div class="pdf-footer-logo"><img src="${appPrefix}assets/beorn-logo.png" alt="BEORN"></div>`,
    '<div class="pdf-footer-confidential">Document confidentiel — Reproduction interdite</div>',
  ].filter(Boolean).join("\n  ") : "";

  // Inject running elements inside the sommaire container (if present) so they
  // share its `page: sommaire` context and don't generate a phantom blank page.
  // Running elements use `position: running(…)` — Paged.js extracts them from
  // flow and makes them available to all pages via margin-box rules.
  let finalBody: string = bodyHtml;
  if (runningHtml && !isCover) {
    const injected = finalBody.replace(
      /(<div class="beorn-cover beorn-cover-sommaire">)/,
      `$1\n  ${runningHtml}`,
    );
    if (injected !== finalBody) {
      finalBody = injected;
    } else {
      // No sommaire container — prepend running elements
      finalBody = runningHtml + "\n" + finalBody;
    }
  }

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
  <div class="pdf-content"${pageAttr}>${finalBody}</div>
  <script src="${appPrefix}assets/paged.polyfill.js"></script>
  ${buildExportBootstrapScript()}
</body>
</html>`;
}
