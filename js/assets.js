// assets.js — Preload CSS, JS, and image assets at startup.

let PAGED_JS_TEXT = "";
let SECTION_INIT_TEXT = "";
let PDF_CSS = "";
let PAGED_CSS = "";
let FONTS_CSS = "";
let BEORN_LOGO_DATA_URI = "";
let PARTNER_LOGO_DATA_URI = "";

async function toDataUri(url, mime) {
  try {
    const r = await fetch(url);
    if (!r.ok) return "";
    const buf = await r.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return "data:" + mime + ";base64," + b64;
  } catch (e) {
    return "";
  }
}

function fetchText(url) {
  return fetch(url).then((r) => r.text());
}

const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&display=swap";

export const pagedReady = Promise.all([
  fetchText("assets/paged.polyfill.js").then((t) => {
    PAGED_JS_TEXT = t;
  }),
  fetchText("js/section-init.js").then((t) => {
    SECTION_INIT_TEXT = t;
  }),
  fetchText("css/pdf.css").then((t) => {
    PDF_CSS = t;
  }),
  fetchText("css/paged.css").then((t) => {
    PAGED_CSS = t;
  }),
  fetch(GOOGLE_FONTS_URL).then((r) => r.ok ? r.text() : "").then((t) => {
    FONTS_CSS = t;
  }).catch(() => {}),
  toDataUri("assets/beorn-logo.png", "image/png").then((u) => {
    BEORN_LOGO_DATA_URI = u;
  }),
  toDataUri("assets/region-idf-logo.svg", "image/svg+xml").then((u) => {
    PARTNER_LOGO_DATA_URI = u;
  }),
]);

export function getAssets() {
  return {
    PAGED_JS_TEXT,
    SECTION_INIT_TEXT,
    PDF_CSS,
    PAGED_CSS,
    FONTS_CSS,
    BEORN_LOGO_DATA_URI,
    PARTNER_LOGO_DATA_URI,
  };
}
