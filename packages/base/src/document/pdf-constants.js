// pdf-constants.js — Shared CSS/URL constants for PDF preview and export.

export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700" +
  "&family=Montserrat:wght@400;500;600;700;800" +
  "&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500" +
  "&display=swap";

export const GOOGLE_FONTS_TAG = `<link href="${GOOGLE_FONTS_URL}" rel="stylesheet" />`;

// Prevents a forced page-break before the first h1 of each top-level section.
export const SECTION_ENTRY_CSS = `
.pdf-content > section.level2 > h1:first-child {
  break-before: auto !important;
  page-break-before: auto !important;
}`;
