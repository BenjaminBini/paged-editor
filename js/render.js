// render.js — Single-section Markdown→HTML rendering pipeline
// Renders the editor content as one section in a single Paged.js iframe.
// Mermaid diagrams are cached by definition — unchanged diagrams are not re-rendered.

import { editor, previewContainer, status } from './editor.js';

// ── Asset preloading ──────────────────────────────────────────────────────────

let PAGED_JS_TEXT = "";
let SECTION_INIT_TEXT = "";
let PDF_CSS = "";
let PAGED_CSS = "";
let BEORN_LOGO_DATA_URI = "";
let LUMAPPS_LOGO_DATA_URI = "";

async function toDataUri(url, mime) {
  try {
    const r = await fetch(url);
    if (!r.ok) return "";
    const buf = await r.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return "data:" + mime + ";base64," + b64;
  } catch(e) { return ""; }
}

function fetchText(url) {
  return fetch(url).then(r => r.text());
}

export const pagedReady = Promise.all([
  fetchText("assets/paged.polyfill.js").then(t => { PAGED_JS_TEXT = t; }),
  fetchText("js/section-init.js").then(t => { SECTION_INIT_TEXT = t; }),
  fetchText("css/pdf.css").then(t => { PDF_CSS = t; }),
  fetchText("css/paged.css").then(t => { PAGED_CSS = t; }),
  toDataUri("assets/beorn-logo.png", "image/png").then(u => { BEORN_LOGO_DATA_URI = u; }),
  toDataUri("assets/lumapps-logo.svg", "image/svg+xml").then(u => { LUMAPPS_LOGO_DATA_URI = u; }),
]);

// ── Hooks ─────────────────────────────────────────────────────────────────────

let onSectionReady = null;
export function registerOnSectionReady(fn) { onSectionReady = fn; }

// ── Utilities ─────────────────────────────────────────────────────────────────

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  m[1].split("\n").forEach(line => {
    const kv = line.match(/^(\w+)\s*:\s*"?(.+?)"?\s*$/);
    if (kv) fm[kv[1]] = kv[2];
  });
  return { fm, body: text.slice(m[0].length) };
}

export function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ── Mermaid SVG cache ─────────────────────────────────────────────────────────

const mermaidCache = new Map(); // definition string → SVG string
let _mermaidQueue = [];
let _mermaidCounter = 0;
let _mermaidLoading = null;

function ensureMermaid() {
  if (typeof mermaid !== 'undefined') return Promise.resolve();
  if (_mermaidLoading) return _mermaidLoading;
  _mermaidLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    script.onload = () => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict',
        look: 'handDrawn', theme: 'base',
        themeVariables: {
          primaryColor: '#e8f0fa', primaryBorderColor: '#3373b3', primaryTextColor: '#193658',
          secondaryColor: '#eef8fa', secondaryBorderColor: '#0096ae', secondaryTextColor: '#193658',
          tertiaryColor: '#f3f0fa', tertiaryBorderColor: '#493a8b', tertiaryTextColor: '#193658',
          lineColor: '#94a3b8', textColor: '#2d3748',
          fontFamily: '"Hanken Grotesk", -apple-system, sans-serif', fontSize: '13px',
          nodeBorder: '#3373b3', mainBkg: '#e8f0fa',
          edgeLabelBackground: '#fff', clusterBkg: '#f8f9fc', clusterBorder: '#e2e8f0',
          titleColor: '#193658',
        }
      });
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _mermaidLoading;
}

// ── Marked plugins ───────────────────────────────────────────────────────────

const COLOR_PAIRS = [
  ["#2a5fa0", "#4a8fd4"],
  ["#3d2f78", "#6a5aaf"],
  ["#9e1f63", "#d44a9a"],
  ["#cc7a1a", "#f0a840"],
  ["#007a92", "#20b8d0"],
];

let _colorIdx = 0;
let _partieNum = 0;  // detected from "# Partie N" in H1, set before each parse
let _h2Count = 0;
let _h3Count = 0;

function stripLeadingNumber(html) {
  return html.replace(/^\d+(?:\.\d+)*\.?\s+/, '');
}

function buildUnderline(pair) {
  return '<span class="beorn-underline">'
    + '<span class="beorn-solid" style="background:linear-gradient(90deg,' + pair[0] + ',' + pair[1] + ')"></span>'
    + '<span class="beorn-chunk" style="width:50px;background:' + pair[1] + ';opacity:0.88"></span>'
    + '<span class="beorn-chunk" style="width:32px;background:' + pair[1] + ';opacity:0.76"></span>'
    + '<span class="beorn-chunk" style="width:18px;background:' + pair[1] + ';opacity:0.64"></span>'
    + '<span class="beorn-chunk" style="width:8px;background:' + pair[1] + ';opacity:0.50"></span>'
    + '<span class="beorn-chunk" style="width:4px;height:4px;border-radius:50%;background:' + pair[1] + ';opacity:0.35"></span>'
    + '</span>';
}

marked.use({
  renderer: {
    heading(token) {
      const { tokens, depth } = token;
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      const text = this.parser.parseInline(tokens);
      const pair = COLOR_PAIRS[_colorIdx % COLOR_PAIRS.length];
      const [primary] = pair;
      const vars = `--section-color:${primary};--section-color-light:${pair[1]}`;

      if (depth >= 5) return `<h${depth}${sl} style="color:${primary};${vars}">${text}</h${depth}>\n`;

      if (depth === 1) {
        const clean = stripLeadingNumber(text);
        const stripped = clean.replace(/^Partie\s+\d+\s*[—●\-]\s*/i, '');
        const disc = '<span class="beorn-disc">&#x25CF;</span>';
        const title = _partieNum ? `Partie ${_partieNum} ${disc} ${stripped}` : clean;
        return `<h1${sl} data-color-index="${_colorIdx % 5}" style="color:${primary};${vars}">${title}${buildUnderline(pair)}</h1>\n`;
      }

      if (depth === 2) { _h2Count++; _h3Count = 0; }
      else if (depth === 3) { _h3Count++; }

      const clean = stripLeadingNumber(text);

      if (!_partieNum) {
        return `<h${depth}${sl} style="color:${primary};${vars}">${clean}</h${depth}>\n`;
      }

      const num = depth === 2
        ? `${_partieNum}.${_h2Count}`
        : `${_partieNum}.${_h2Count}.${_h3Count}`;
      const disc = '<span class="beorn-disc">&#x25CF;</span>';

      if (depth === 2) {
        return `<h2${sl} style="color:${primary};${vars}"><span class="beorn-num" style="background:${primary};color:#fff">${escapeHtml(num)}</span><span class="beorn-text">${clean}</span></h2>\n`;
      }
      if (depth === 3) {
        return `<h3${sl} style="color:${primary};padding:0.3rem 0.7rem;border-radius:4px;background:color-mix(in srgb, ${primary} 6%, transparent);width:fit-content;max-width:100%;${vars}"><span class="beorn-num" style="color:${primary}">${escapeHtml(num)}</span> ${disc} ${clean}</h3>\n`;
      }
      return `<h${depth}${sl} style="color:${primary};${vars}">${clean}</h${depth}>\n`;
    },

    paragraph(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      return `<p${sl}>${this.parser.parseInline(token.tokens)}</p>\n`;
    },

    blockquote(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      const body = this.parser.parse(token.tokens);
      return `<blockquote${sl}>\n${body}</blockquote>\n`;
    },

    list(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      const tag = token.ordered ? 'ol' : 'ul';
      const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
      let body = '';
      for (const item of token.items) {
        body += this.listitem(item);
      }
      return `<${tag}${startAttr}${sl}>\n${body}</${tag}>\n`;
    },

    table(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      let header = '';
      for (const cell of token.header) {
        const align = cell.align ? ` align="${cell.align}"` : '';
        header += `<th${align}>${this.parser.parseInline(cell.tokens)}</th>\n`;
      }
      header = `<tr>\n${header}</tr>\n`;
      let body = '';
      for (const row of token.rows) {
        let rowContent = '';
        for (const cell of row) {
          const align = cell.align ? ` align="${cell.align}"` : '';
          rowContent += `<td${align}>${this.parser.parseInline(cell.tokens)}</td>\n`;
        }
        body += `<tr>\n${rowContent}</tr>\n`;
      }
      return `<table${sl}>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
    },

    hr(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      return `<hr${sl} />\n`;
    },

    code(token) {
      const { text, lang } = token;
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      if (lang === 'mermaid') {
        const idx = _mermaidQueue.length;
        _mermaidQueue.push(text);
        return `<div class="mermaid-diagram"${sl} data-mermaid-idx="${idx}"></div>\n`;
      }
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      return `<pre${sl}><code${langClass}>${escapeHtml(text)}</code></pre>\n`;
    },
  },

  hooks: {
    postprocess(html) {
      const pair = COLOR_PAIRS[_colorIdx % COLOR_PAIRS.length];
      const vars = `--section-color:${pair[0]};--section-color-light:${pair[1]}`;

      html = html.replace(/<(p|ul|ol|li|blockquote|table|thead|tbody|tr|td|th|pre|code)(\s|>)/gi,
        (_m, tag, after) => `<${tag} style="${vars}"${after}`);

      html = html
        .replace(/(\w) :/g, "$1\u00a0:")
        .replace(/(\w) ;/g, "$1\u00a0;")
        .replace(/(\w) !/g, "$1\u00a0!")
        .replace(/(\w) \?/g, "$1\u00a0?");

      return html;
    }
  }
});

// ── Parse markdown (sync, mermaid → placeholders) ────────────────────────────

function parseMarkdownSync(md, colorIdx, startLine) {
  _colorIdx = colorIdx;
  _mermaidQueue = [];
  _h2Count = 0;
  _h3Count = 0;

  // Detect "# Partie N" in H1 for auto-numbering
  const partieMatch = md.match(/^#\s+Partie\s+(\d+)/im);
  _partieNum = partieMatch ? parseInt(partieMatch[1], 10) : 0;

  const tokens = marked.lexer(md);

  if (startLine != null) {
    let cursor = 0;
    for (const token of tokens) {
      const idx = md.indexOf(token.raw, cursor);
      if (idx >= 0) {
        const lineInSection = md.substring(0, idx).split('\n').length - 1;
        token._sourceLine = startLine + lineInSection;
        cursor = idx + token.raw.length;
      }
    }
  }

  return marked.parser(tokens).replace(/\{src:[^}]+\}/g, '');
}

// ── Resolve mermaid placeholders (with SVG cache) ────────────────────────────

async function resolveMermaid(html, queue) {
  if (queue.length === 0) return html;
  await ensureMermaid();

  let result = html;
  for (let i = 0; i < queue.length; i++) {
    const definition = queue[i];

    // Cache hit → inject cached SVG
    const cached = mermaidCache.get(definition);
    if (cached) {
      result = result.replace(`data-mermaid-idx="${i}"></div>`, `>${cached}</div>`);
      continue;
    }

    // Cache miss → render, cache, inject
    try {
      const id = 'mermaid-pre-' + (_mermaidCounter++);
      const { svg } = await mermaid.render(id, definition);
      mermaidCache.set(definition, svg);
      result = result.replace(`data-mermaid-idx="${i}"></div>`, `>${svg}</div>`);
    } catch(e) {
      console.warn('Mermaid render error:', e);
    }
  }
  return result;
}

// ── HTML document wrapper ────────────────────────────────────────────────────

function buildHeaderText(fm) {
  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";
  const parts = title.split(/\s*[—–]\s*/);
  const projectName = parts.length > 1 ? parts.slice(1).join(" — ") : title;
  return escapeHtml(projectName) + " \u2014 " + escapeHtml(doctype);
}

function wrapInDocument(bodyHtml, opts) {
  const { gen, headerText, language } = opts;

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${PDF_CSS}</style>
  <style>${PAGED_CSS}</style>
  <style>@page :first { margin: 20mm 18mm 25mm 18mm; }</style>
  <style>.pagedjs_pages { padding: 12px 0; }</style>
  ${BEORN_LOGO_DATA_URI ? '<style>.pagedjs_page::after { background-image: url(' + BEORN_LOGO_DATA_URI + '); }</style>' : ''}
  <script>window.PagedConfig = { auto: false };<\/script>
</head>
<body>
  <div class="pdf-page-gradient"></div>
  ${headerText ? '<div class="pdf-running-header">' + headerText + '</div>' : ''}
  <div class="pdf-content">${bodyHtml}</div>
  <script>${PAGED_JS_TEXT}<\/script>
  <script>window.__gen = ${gen};<\/script>
  <script>${SECTION_INIT_TEXT}<\/script>
</body>
</html>`;
}

// ── Single iframe state ──────────────────────────────────────────────────────

const A4_WIDTH_PX = 794;
const previewWrapper = document.getElementById("preview-wrapper");

let currentFrame = null;
let pendingFrame = null;
let currentBlobUrl = null;
let currentGen = 0;
let renderStartTime = 0;

// ── Render ───────────────────────────────────────────────────────────────────

export async function triggerRender() {
  const md = editor.value;
  if (!md.trim()) {
    status.textContent = "Empty";
    return;
  }

  status.textContent = "Rendering...";
  renderStartTime = performance.now();

  const { fm, body } = parseFrontmatter(md);
  const headerText = buildHeaderText(fm);
  const language = fm.language || 'fr';

  // Compute frontmatter line offset for source-line tracking
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const startLine = fmMatch ? fmMatch[0].split('\n').length - 1 : 0;

  // Detect Partie number for color selection before parsing
  const partieMatch = body.match(/^#\s+Partie\s+(\d+)/im);
  const partieNum = partieMatch ? parseInt(partieMatch[1], 10) : 0;
  const colorIdx = partieNum > 0 ? (partieNum - 1) % COLOR_PAIRS.length : 0;

  // Phase 1: Sync parse (mermaid → placeholders)
  let html = parseMarkdownSync(body, colorIdx, startLine);
  const queue = [..._mermaidQueue];

  // Phase 2: Resolve mermaid (cached where possible)
  html = await resolveMermaid(html, queue);

  // Wrap in section element
  const pair = COLOR_PAIRS[colorIdx % COLOR_PAIRS.length];
  const sectionHtml = `<section class="level2" data-color-index="${colorIdx % 5}" style="--section-color:${pair[0]};--section-color-light:${pair[1]}">\n${html}\n</section>`;

  // Phase 3: Create iframe
  currentGen++;
  const gen = currentGen;

  const doc = wrapInDocument(sectionHtml, { gen, headerText, language });
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.className = 'section-frame';
  iframe.style.width = A4_WIDTH_PX + 'px';
  iframe.style.height = '20000px';
  iframe.style.transformOrigin = 'top left';
  iframe.style.border = 'none';
  iframe.style.background = 'transparent';
  iframe.dataset.gen = String(gen);

  // Position off-screen until ready
  if (currentFrame) {
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.visibility = 'hidden';
  }

  // Remove previous pending frame if a newer render started
  if (pendingFrame) pendingFrame.remove();
  pendingFrame = iframe;

  previewWrapper.appendChild(iframe);
  iframe.src = url;

  // Store blob URL for cleanup
  iframe._blobUrl = url;
}

// ── Section-ready handler ────────────────────────────────────────────────────

window.addEventListener("message", e => {
  if (e.data?.type !== "section-ready") return;
  const gen = e.data.gen;
  if (gen !== currentGen) return; // stale render

  const pages = e.data.pages;
  const iframe = pendingFrame;
  if (!iframe) return;

  // Swap: reveal new frame, remove old
  if (currentFrame) currentFrame.remove();
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);

  currentFrame = iframe;
  currentBlobUrl = iframe._blobUrl;
  pendingFrame = null;

  iframe.style.position = '';
  iframe.style.left = '';
  iframe.style.visibility = '';

  scalePreview();

  const elapsed = Math.round(performance.now() - renderStartTime);
  status.textContent = pages + " pages — " + elapsed + "ms";

  if (typeof onSectionReady === "function") onSectionReady();
});

// ── Scaling ──────────────────────────────────────────────────────────────────

function scaleFrame() {
  if (!currentFrame) return;

  const containerW = previewContainer.clientWidth - 40;
  const scale = Math.min(1, containerW / A4_WIDTH_PX);
  currentFrame.style.transform = `scale(${scale})`;
  currentFrame.style.width = A4_WIDTH_PX + "px";

  try {
    const doc = currentFrame.contentDocument || currentFrame.contentWindow.document;
    const pagedPages = doc.querySelector(".pagedjs_pages");
    const h = pagedPages
      ? pagedPages.scrollHeight
      : Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);

    if (h > 100) {
      currentFrame.style.height = h + "px";
      previewWrapper.style.width = (A4_WIDTH_PX * scale) + "px";
      previewWrapper.style.height = (h * scale) + "px";
      previewWrapper.style.overflow = "hidden";
    }
  } catch(e) {
    // iframe not ready yet, retry
    setTimeout(scaleFrame, 500);
  }
}

export function scalePreview() {
  scaleFrame();
}

window.addEventListener("resize", scalePreview);

// ── Render timeout helpers ───────────────────────────────────────────────────

export let renderTimeout = null;

export function clearRenderTimeout() {
  clearTimeout(renderTimeout);
}

export function scheduleRender(ms) {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(triggerRender, ms);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getPreviewFrame() {
  return currentFrame;
}

export function getPreviewScale() {
  const containerW = previewContainer.clientWidth - 40;
  return Math.min(1, containerW / A4_WIDTH_PX);
}

// ── Full document export (for "Open in new tab") ─────────────────────────────

export async function buildPagedHtml(md) {
  const { fm, body } = parseFrontmatter(md);
  const headerText = buildHeaderText(fm);
  const language = fm.language || 'fr';

  const pm = body.match(/^#\s+Partie\s+(\d+)/im);
  const ci = pm ? (parseInt(pm[1], 10) - 1) % COLOR_PAIRS.length : 0;

  const html = parseMarkdownSync(body, ci, 0);
  const queue = [..._mermaidQueue];
  const resolved = await resolveMermaid(html, queue);

  const pair = COLOR_PAIRS[ci % COLOR_PAIRS.length];
  const sectionHtml = `<section class="level2" style="--section-color:${pair[0]};--section-color-light:${pair[1]}">\n${resolved}\n</section>`;

  return wrapInDocument(sectionHtml, { gen: 0, headerText, language });
}

export async function openPreviewTab() {
  const html = await buildPagedHtml(editor.value);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
