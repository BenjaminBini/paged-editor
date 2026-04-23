// pdf-constants.js — Shared CSS/URL constants for PDF preview and export.

// Must stay in sync with the <link> in packages/base/index.html so the
// standalone export HTML (html-document-wrapper.ts) loads the same fonts
// the editor's pdf.css references. Earlier font migrations updated
// index.html and the CSS files but left this constant on the old bundle,
// which made export fall back to system sans-serif while the preview
// silently inherited Nunito from the host document.
export const GOOGLE_FONTS_URL: string =
  "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900" +
  "&family=JetBrains+Mono:wght@400;500;600" +
  "&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500" +
  "&display=swap";

export const GOOGLE_FONTS_TAG: string = `<link href="${GOOGLE_FONTS_URL}" rel="stylesheet" />`;

// Prevents a forced page-break before the first h1 of each top-level section.
export const SECTION_ENTRY_CSS: string = `
.pdf-content > section.level2 > h1:first-child {
  break-before: auto !important;
  page-break-before: auto !important;
}`;
