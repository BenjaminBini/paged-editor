// assets.js — Preload CSS, JS, and image assets at startup.

let PAGED_JS_TEXT = "";
let SECTION_INIT_TEXT = "";
let PDF_CSS = "";
let PAGED_CSS = "";
let FONTS_CSS = "";
let BEORN_LOGO_DATA_URI = "";
let PARTNER_LOGO_DATA_URI = "";

// Stable blob URLs created once so Firefox can cache the compiled bytecode
// across renders (keyed by URL in SpiderMonkey's JIT cache).
// Images also become blob URLs so the per-render HTML drops from ~1MB to ~50KB.
let PAGED_JS_BLOB_URL = "";
let SECTION_INIT_BLOB_URL = "";
let BEORN_LOGO_BLOB_URL = "";

function arrayBufferToBase64(buf) {
  // Chunk to avoid hitting the max-argument-count limit in spread calls.
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(binary);
}

async function toDataUri(url, mime) {
  try {
    const r = await fetch(url);
    if (!r.ok) return "";
    const buf = await r.arrayBuffer();
    return "data:" + mime + ";base64," + arrayBufferToBase64(buf);
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
    PAGED_JS_BLOB_URL = URL.createObjectURL(
      new Blob([t], { type: "application/javascript; charset=utf-8" })
    );
  }),
  fetchText("js/section-init.js").then((t) => {
    SECTION_INIT_TEXT = t;
    SECTION_INIT_BLOB_URL = URL.createObjectURL(
      new Blob([t], { type: "application/javascript; charset=utf-8" })
    );
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
  fetch("assets/beorn-logo.png").then(async (r) => {
    if (!r.ok) return;
    const buf = await r.arrayBuffer();
    BEORN_LOGO_BLOB_URL = URL.createObjectURL(new Blob([buf], { type: "image/png" }));
    // Keep data URI as well (pdf-export needs a self-contained serialisation).
    BEORN_LOGO_DATA_URI = "data:image/png;base64," + arrayBufferToBase64(buf);
  }).catch(() => {}),
  toDataUri("assets/region-idf-logo.svg", "image/svg+xml").then((u) => {
    PARTNER_LOGO_DATA_URI = u;
  }),
]);

export function getAssets() {
  return {
    PAGED_JS_TEXT,
    SECTION_INIT_TEXT,
    PAGED_JS_BLOB_URL,
    SECTION_INIT_BLOB_URL,
    PDF_CSS,
    PAGED_CSS,
    FONTS_CSS,
    BEORN_LOGO_DATA_URI,
    BEORN_LOGO_BLOB_URL,
    PARTNER_LOGO_DATA_URI,
  };
}
