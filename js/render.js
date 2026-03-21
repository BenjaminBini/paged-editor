// render.js — Section-based Markdown→HTML rendering pipeline
// Each H1 section renders independently in its own iframe.
// Only sections whose content hash changed are re-rendered.

import { editor, previewContainer, status } from './editor.js';

// ── Asset preloading ──────────────────────────────────────────────────────────
// All external CSS, JS, and images are fetched once and stored as blob URLs
// or text for injection into section iframes.

let PAGED_JS_BLOB_URL = "";
let SECTION_INIT_BLOB_URL = "";
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

function fetchBlobUrl(url) {
  return fetch(url).then(r => r.blob()).then(b => URL.createObjectURL(b));
}

function fetchText(url) {
  return fetch(url).then(r => r.text());
}

export const pagedReady = Promise.all([
  fetchBlobUrl("assets/paged.polyfill.js").then(u => { PAGED_JS_BLOB_URL = u; }),
  fetchBlobUrl("js/section-init.js").then(u => { SECTION_INIT_BLOB_URL = u; }),
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

function quickHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// ── Marked plugins ───────────────────────────────────────────────────────────
// All MD-phase transforms are registered as marked extensions:
// - Heading renderer: numbering, underlines, section colors
// - Code renderer: mermaid → SVG placeholder (resolved async after parse)
// - hooks.postprocess: French typography + CSS variable injection on block elements

const COLOR_PAIRS = [
  ["#2a5fa0", "#4a8fd4"],
  ["#3d2f78", "#6a5aaf"],
  ["#9e1f63", "#d44a9a"],
  ["#cc7a1a", "#f0a840"],
  ["#007a92", "#20b8d0"],
];

let _colorIdx = 0;           // set before each marked.parse() call
let _mermaidQueue = [];       // collected during parse, resolved after
let _mermaidCounter = 0;
let _mermaidLoading = null;  // promise for lazy-loading mermaid CDN

// Lazy-load mermaid only when first mermaid code block is encountered
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

function generateUnderline(primary, light) {
  const rand = (a, b) => a + Math.random() * (b - a);
  const chunkSizes = [rand(45, 60), rand(28, 38), rand(14, 22), rand(6, 10), Math.max(3.5, rand(3.5, 5)), 3.5];
  let chunks = '';
  chunkSizes.forEach((size, i) => {
    const opacity = (1 - i * 0.12).toFixed(2);
    const style = i === chunkSizes.length - 1
      ? `width:${size.toFixed(1)}px;height:4px;border-radius:50%;background:${light};opacity:${opacity}`
      : `width:${size.toFixed(1)}px;background:${light};opacity:${opacity}`;
    chunks += `<span class="beorn-chunk" style="${style}"></span>`;
  });
  return `<span class="beorn-underline"><span class="beorn-solid" style="background:linear-gradient(90deg,${primary},${light})"></span>${chunks}</span>`;
}

// Register all plugins once
marked.use({
  renderer: {
    // ── Headings: numbering + underlines + section colors ──
    heading(token) {
      const { tokens, depth } = token;
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      const text = this.parser.parseInline(tokens);
      const pair = COLOR_PAIRS[_colorIdx % COLOR_PAIRS.length];
      const [primary, light] = pair;
      const vars = `--section-color:${primary};--section-color-light:${light}`;

      if (depth >= 5) return `<h${depth}${sl}>${text}</h${depth}>\n`;

      const numMatch = text.match(/^(\d+(?:\.\d+)*\.?\s)/);
      let inner = text;

      if (depth === 1) {
        if (numMatch) inner = `<span class="beorn-num" style="color:${primary}">${numMatch[1]}</span>${text.slice(numMatch[1].length)}`;
        return `<h1${sl} style="${vars}">${inner}${generateUnderline(primary, light)}</h1>\n`;
      }
      if (depth === 2) {
        if (numMatch) inner = `<span class="beorn-num" style="background:${primary};color:#fff">${numMatch[1]}</span><span class="beorn-text">${text.slice(numMatch[1].length)}</span>`;
        return `<h2${sl} style="color:${primary};${vars}">${inner}</h2>\n`;
      }
      // H3, H4
      if (numMatch) inner = `<span class="beorn-num" style="color:${primary}">${numMatch[1]}</span>${text.slice(numMatch[1].length)}`;
      return `<h${depth}${sl} style="color:${primary};${vars}">${inner}</h${depth}>\n`;
    },

    // ── Paragraphs: emit data-source-line ──
    paragraph(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      return `<p${sl}>${this.parser.parseInline(token.tokens)}</p>\n`;
    },

    // ── Blockquotes: emit data-source-line ──
    blockquote(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      const body = this.parser.parse(token.tokens);
      return `<blockquote${sl}>\n${body}</blockquote>\n`;
    },

    // ── Lists: emit data-source-line ──
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

    // ── Tables: emit data-source-line ──
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

    // ── Horizontal rules: emit data-source-line ──
    hr(token) {
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      return `<hr${sl} />\n`;
    },

    // ── Code blocks: intercept mermaid, default for everything else ──
    code(token) {
      const { text, lang } = token;
      const sl = token._sourceLine != null ? ` data-source-line="${token._sourceLine}"` : '';
      if (lang === 'mermaid') {
        const idx = _mermaidQueue.length;
        _mermaidQueue.push(text);
        return `<div class="mermaid-diagram"${sl} data-mermaid-idx="${idx}"></div>\n`;
      }
      // Default code block with source line
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      return `<pre${sl}><code${langClass}>${escapeHtml(text)}</code></pre>\n`;
    },
  },

  hooks: {
    // ── Post-process: French typography + CSS variables on block elements ──
    postprocess(html) {
      const pair = COLOR_PAIRS[_colorIdx % COLOR_PAIRS.length];
      const vars = `--section-color:${pair[0]};--section-color-light:${pair[1]}`;

      // Inject CSS variables on block elements (survives Paged.js DOM restructuring)
      html = html.replace(/<(p|ul|ol|li|blockquote|table|thead|tbody|tr|td|th|pre|code)(\s|>)/gi,
        (_m, tag, after) => `<${tag} style="${vars}"${after}`);

      // French typography: non-breaking spaces before : ; ! ?
      html = html
        .replace(/(\w) :/g, "$1\u00a0:")
        .replace(/(\w) ;/g, "$1\u00a0;")
        .replace(/(\w) !/g, "$1\u00a0!")
        .replace(/(\w) \?/g, "$1\u00a0?");

      return html;
    }
  }
});

// ── Parse markdown with all plugins applied ──────────────────────────────────
// Sets colorIdx, parses with marked (sync), then resolves mermaid placeholders (async).

// Synchronous parse (no mermaid). Returns HTML string.
// When startLine is provided, block elements get data-source-line attributes for scroll sync.
function parseSectionMarkdownSync(md, colorIdx, startLine) {
  _colorIdx = colorIdx;
  _mermaidQueue = [];

  // Use separate lexer/parser to annotate tokens with source line numbers
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

  return marked.parser(tokens);
}

// Async parse (resolves mermaid placeholders if any). Returns HTML string.
async function parseSectionMarkdown(md, colorIdx) {
  const html = parseSectionMarkdownSync(md, colorIdx);
  if (_mermaidQueue.length === 0) return html;

  // Lazy-load mermaid CDN, then resolve placeholders
  await ensureMermaid();
  let result = html;
  for (let i = 0; i < _mermaidQueue.length; i++) {
    try {
      const id = 'mermaid-pre-' + (_mermaidCounter++);
      const { svg } = await mermaid.render(id, _mermaidQueue[i]);
      result = result.replace(`data-mermaid-idx="${i}"></div>`, `>${svg}</div>`);
    } catch(e) { console.warn('Mermaid render error:', e); }
  }
  return result;
}

// ── Section splitting ─────────────────────────────────────────────────────────

function splitMarkdownSections(md) {
  const { fm, body } = parseFrontmatter(md);
  const lines = body.split('\n');

  // Compute absolute line offset: frontmatter lines + body start
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const fmLineCount = fmMatch ? fmMatch[0].split('\n').length - 1 : 0;

  // Split into chunks at H1 boundaries and /newpage markers
  const chunks = []; // Each: { lines: string[], startsWithH1: boolean, bodyLineIdx: number }
  let current = [];
  let currentStartIdx = 0;
  let preamble = [];
  let foundFirstH1 = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^# /.test(line)) {
      if (foundFirstH1 && current.length > 0) {
        chunks.push({ lines: [...current], startsWithH1: /^# /.test(current[0]), bodyLineIdx: currentStartIdx });
        current = [];
      }
      foundFirstH1 = true;
      if (current.length === 0) currentStartIdx = i;
      current.push(line);
    } else if (foundFirstH1 && (trimmed === '/newpage' || trimmed === '\\newpage')) {
      // /newpage splits into a new rendering chunk (page break is implicit between iframes)
      if (current.length > 0) {
        chunks.push({ lines: [...current], startsWithH1: /^# /.test(current[0]), bodyLineIdx: currentStartIdx });
        current = [];
      }
      currentStartIdx = i + 1;
    } else if (!foundFirstH1) {
      preamble.push(line);
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    chunks.push({ lines: [...current], startsWithH1: /^# /.test(current[0] || ''), bodyLineIdx: currentStartIdx });
  }

  // Extract H1 titles for TOC (skip "Page de garde")
  const tocEntries = [];
  chunks.forEach(chunk => {
    if (!chunk.startsWithH1) return;
    const m = chunk.lines[0].match(/^# (.+)/);
    if (m && !/^page de garde$/i.test(m[1].trim())) {
      tocEntries.push(m[1].trim());
    }
  });

  const headerText = buildHeaderText(fm);
  const language = fm.language || 'fr';

  // Build section descriptors
  const sections = [];

  // Section 0: cover
  const coverKey = JSON.stringify(fm) + '|' + tocEntries.join('|');
  sections.push({ type: 'cover', fm, tocEntries, hash: quickHash(coverKey), startLine: 0 });

  // Content sections (one per chunk, skip "Page de garde")
  let colorIdx = -1;
  chunks.forEach(chunk => {
    if (chunk.startsWithH1) {
      const title = chunk.lines[0].match(/^# (.+)/)?.[1]?.trim() || '';
      if (/^page de garde$/i.test(title)) return;
      colorIdx++;
    }

    const raw = chunk.lines.join('\n');
    const pre = sections.length === 1 ? preamble.join('\n').trim() : '';
    sections.push({
      type: 'content',
      raw,
      preamble: pre,
      colorIdx: Math.max(0, colorIdx),
      startsWithH1: chunk.startsWithH1,
      startLine: fmLineCount + chunk.bodyLineIdx,
      preambleStartLine: sections.length === 1 ? fmLineCount : null,
      // Include headerText so frontmatter changes invalidate all sections
      hash: quickHash(raw + '|' + pre + '|' + headerText),
    });
  });

  return { sections, headerText, language };
}

// ── HTML generation ───────────────────────────────────────────────────────────

function buildHeaderText(fm) {
  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";
  const parts = title.split(/\s*[—–]\s*/);
  const projectName = parts.length > 1 ? parts.slice(1).join(" — ") : title;
  return escapeHtml(projectName) + " \u2014 " + escapeHtml(doctype);
}

function buildCoverContentHtml(fm, tocEntries) {
  const title = fm.title || "Document";
  const aoRef = fm.ao_ref || "";
  const acheteur = fm.acheteur || "";
  const doctype = fm.doctype || "Mémoire technique";
  const parts = title.split(/\s*[—–]\s*/);
  const projectName = parts.length > 1 ? parts.slice(1).join(" — ") : title;

  const tocHtml = tocEntries.map((t, i) =>
    '<div class="beorn-toc-entry"><span class="beorn-toc-num">' +
    String(i + 1).padStart(2, "0") + '</span><span class="beorn-toc-title">' +
    escapeHtml(t) + '</span></div>').join("\n");

  return `
<div class="beorn-cover beorn-cover-hero">
  <div class="beorn-cover-body">
    <div class="beorn-cover-logos">
      ${BEORN_LOGO_DATA_URI ? '<img class="beorn-cover-logo" src="' + BEORN_LOGO_DATA_URI + '" alt="BEORN Technologies" />' : ''}
      ${LUMAPPS_LOGO_DATA_URI ? '<img class="beorn-cover-logo-lumapps" src="' + LUMAPPS_LOGO_DATA_URI + '" alt="LumApps" />' : ''}
    </div>
    <div class="beorn-cover-doctype">${escapeHtml(doctype)}</div>
    <div class="beorn-cover-title">${escapeHtml(projectName)}</div>
    <div class="beorn-cover-underline">
      <span class="solid"></span>
      <span class="chunk" style="width:40px;"></span>
      <span class="chunk" style="width:24px; opacity:0.7;"></span>
      <span class="chunk" style="width:14px; opacity:0.45;"></span>
      <span class="chunk" style="width:6px; opacity:0.25;"></span>
      <span class="chunk" style="width:4px; height:4px; border-radius:50%; opacity:0.15;"></span>
    </div>
    ${aoRef ? '<div class="beorn-cover-ref">Consultation n\u00b0 ' + escapeHtml(aoRef) + '</div>' : ''}
    <div class="beorn-cover-bottom-section">
      <div class="beorn-cover-info-grid">
        <div class="beorn-cover-info-block">
          <div class="beorn-cover-info-label">Candidat</div>
          <div class="beorn-cover-info-value">
            <strong>BEORN TECHNOLOGIES</strong><br>
            12 rue Louis Courtois de Vi\u00e7ose<br>
            Portes Sud \u2014 B\u00e2timent 3<br>
            31100 Toulouse<br>
            T\u00e9l\u00a0: +33 (0)531 983 168<br>
            www.beorntech.com
          </div>
        </div>
        ${acheteur ? '<div class="beorn-cover-info-block"><div class="beorn-cover-info-label">Acheteur</div><div class="beorn-cover-info-value"><strong>' + escapeHtml(acheteur) + '</strong></div></div>' : ''}
      </div>
      <div class="beorn-cover-confidential">Document confidentiel \u2014 Reproduction interdite</div>
    </div>
  </div>
</div>
<div class="beorn-cover beorn-cover-sommaire">
  <div class="beorn-cover-body">
    <div class="beorn-cover-logos">
      ${BEORN_LOGO_DATA_URI ? '<img class="beorn-cover-logo" src="' + BEORN_LOGO_DATA_URI + '" alt="BEORN Technologies" style="max-width:120px;" />' : ''}
    </div>
    <div class="beorn-cover-doctype">Sommaire</div>
    <div class="beorn-cover-underline" style="margin-bottom:2.5rem;">
      <span class="solid"></span>
      <span class="chunk" style="width:40px;"></span>
      <span class="chunk" style="width:24px; opacity:0.7;"></span>
    </div>
    <div class="beorn-toc">${tocHtml}</div>
  </div>
</div>`;
}

function wrapInDocument(bodyHtml, opts) {
  const { sectionIndex, gen, isCover, headerText, language } = opts;

  // Content sections need to override @page :first (which is meant for the cover)
  const pageFirstOverride = isCover ? '' :
    '\n  <style>@page :first { margin: 20mm 18mm 25mm 18mm; }</style>';

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${PDF_CSS}</style>
  <style>${PAGED_CSS}</style>
  <style>.pagedjs_pages { padding: 12px 0; }</style>${pageFirstOverride}
  ${BEORN_LOGO_DATA_URI ? '<style>.pagedjs_page::after { background-image: url(' + BEORN_LOGO_DATA_URI + '); }</style>' : ''}
  <script>window.PagedConfig = { auto: false };<\/script>
</head>
<body>
  <div class="pdf-page-gradient"></div>
  ${!isCover ? '<div class="pdf-running-header">' + headerText + '</div>' : ''}
  ${isCover ? bodyHtml : '<div class="pdf-content">' + bodyHtml + '</div>'}
  <script src="${PAGED_JS_BLOB_URL}"><\/script>
  <script>window.__sectionIndex = ${sectionIndex}; window.__sectionGen = ${gen};<\/script>
  <script src="${SECTION_INIT_BLOB_URL}"><\/script>
</body>
</html>`;
}

// ── Section state management ──────────────────────────────────────────────────

const A4_WIDTH_PX = 794;
const previewWrapper = document.getElementById("preview-wrapper");

const sectionStates = [];
// Each entry: { type, hash, gen, wrapper, frame, pendingFrame, blobUrl, pageCount }

let pendingSectionCount = 0;
let renderStartTime = 0;

function ensureSectionSlot(count) {
  while (sectionStates.length < count) {
    const wrapper = document.createElement('div');
    wrapper.className = 'section-wrapper';
    previewWrapper.appendChild(wrapper);
    sectionStates.push({
      type: null, hash: null, gen: 0,
      wrapper, frame: null, pendingFrame: null,
      blobUrl: null, pageCount: 0, scaleTimer: null,
    });
  }
}

function removeSectionsFrom(index) {
  while (sectionStates.length > index) {
    const state = sectionStates.pop();
    if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
    if (state.frame) state.frame.remove();
    if (state.pendingFrame) state.pendingFrame.remove();
    state.wrapper.remove();
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

export async function triggerRender() {
  const md = editor.value;
  status.textContent = "Rendering...";

  const { sections, headerText, language } = splitMarkdownSections(md);

  // Adjust section slots
  ensureSectionSlot(sections.length);
  removeSectionsFrom(sections.length);

  pendingSectionCount = 0;
  renderStartTime = performance.now();

  // Phase 1: Build HTML for all changed sections (sync for non-mermaid, most common)
  const builds = []; // [{index, bodyHtml}]
  let hasMermaidSections = false;

  for (let i = 0; i < sections.length; i++) {
    if (sectionStates[i].hash === sections[i].hash) continue;
    const section = sections[i];
    if (section.type === 'cover') {
      builds.push({ index: i, bodyHtml: buildCoverContentHtml(section.fm, section.tocEntries) });
    } else {
      // Sync parse (mermaid blocks become placeholders)
      const bodyHtml = parseSectionMarkdownSync(section.raw, section.colorIdx, section.startLine);
      const hasMermaid = _mermaidQueue.length > 0;
      let preambleHtml = '';
      if (section.preamble) preambleHtml = parseSectionMarkdownSync(section.preamble, section.colorIdx, section.preambleStartLine);
      if (hasMermaid) hasMermaidSections = true;
      builds.push({
        index: i,
        bodyHtml: `<section class="level2" data-color-index="${section.colorIdx}">\n${preambleHtml}${bodyHtml}\n</section>`,
        mermaidQueue: hasMermaid ? [..._mermaidQueue] : null,
      });
    }
  }

  if (builds.length === 0) {
    status.textContent = "No changes";
    return;
  }

  // Phase 1b: Resolve mermaid placeholders if any sections have them
  if (hasMermaidSections) {
    await ensureMermaid();
    for (const build of builds) {
      if (!build.mermaidQueue) continue;
      for (let j = 0; j < build.mermaidQueue.length; j++) {
        try {
          const id = 'mermaid-pre-' + (_mermaidCounter++);
          const { svg } = await mermaid.render(id, build.mermaidQueue[j]);
          build.bodyHtml = build.bodyHtml.replace(`data-mermaid-idx="${j}"></div>`, `>${svg}</div>`);
        } catch(e) { console.warn('Mermaid render error:', e); }
      }
    }
  }

  // Phase 2: Create all iframes at once (parallel loading)
  for (const { index: i, bodyHtml } of builds) {
    const section = sections[i];
    const state = sectionStates[i];
    state.type = section.type;
    state.hash = section.hash;
    state.gen = (state.gen || 0) + 1;

    const html = wrapInDocument(bodyHtml, {
      sectionIndex: i,
      gen: state.gen,
      isCover: section.type === 'cover',
      headerText,
      language,
    });

    if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
    const blob = new Blob([html], { type: "text/html" });
    state.blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.className = 'section-frame';
    iframe.style.width = A4_WIDTH_PX + 'px';
    iframe.style.height = '20000px';
    iframe.style.transformOrigin = 'top left';
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';
    iframe.dataset.section = String(i);
    iframe.dataset.gen = String(state.gen);

    if (state.frame) {
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.visibility = 'hidden';
      if (state.pendingFrame) state.pendingFrame.remove();
      state.pendingFrame = iframe;
    } else {
      state.frame = iframe;
    }

    state.wrapper.appendChild(iframe);
    pendingSectionCount++;
    iframe.src = state.blobUrl;
  }
}

// ── Section-ready message handler ─────────────────────────────────────────────

window.addEventListener("message", e => {
  if (e.data && e.data.type === "section-ready") {
    const { index: idx, gen, pages } = e.data;
    if (idx < 0 || idx >= sectionStates.length) return;

    const state = sectionStates[idx];
    if (gen !== state.gen) return; // stale render, ignore

    state.pageCount = pages;

    // Swap pending frame → visible
    if (state.pendingFrame) {
      const oldFrame = state.frame;
      state.frame = state.pendingFrame;
      state.pendingFrame = null;

      state.frame.style.position = '';
      state.frame.style.left = '';
      state.frame.style.visibility = '';

      if (oldFrame) oldFrame.remove();
    }

    pendingSectionCount = Math.max(0, pendingSectionCount - 1);
    scaleSection(idx);

    if (pendingSectionCount === 0) {
      updatePageNumbers();
      const totalPages = sectionStates.reduce((sum, s) => sum + s.pageCount, 0);
      const elapsed = Math.round(performance.now() - renderStartTime);
      status.textContent = totalPages + " pages — " + elapsed + "ms";
    }

    if (typeof onSectionReady === "function") onSectionReady(idx);
  }
});

// ── Scaling ───────────────────────────────────────────────────────────────────

function scaleSection(idx) {
  const state = sectionStates[idx];
  if (!state?.frame) return;

  const containerW = previewContainer.clientWidth - 40;
  const scale = Math.min(1, containerW / A4_WIDTH_PX);
  state.frame.style.transform = `scale(${scale})`;
  state.frame.style.width = A4_WIDTH_PX + "px";

  try {
    const doc = state.frame.contentDocument || state.frame.contentWindow.document;
    const pagedPages = doc.querySelector(".pagedjs_pages");
    const h = pagedPages
      ? pagedPages.scrollHeight
      : Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);

    if (h > 100) {
      state.frame.style.height = h + "px";
      state.wrapper.style.width = (A4_WIDTH_PX * scale) + "px";
      state.wrapper.style.height = (h * scale) + "px";
      state.wrapper.style.overflow = "hidden";
    } else {
      clearTimeout(state.scaleTimer);
      state.scaleTimer = setTimeout(() => scaleSection(idx), 500);
    }
  } catch(e) {
    clearTimeout(state.scaleTimer);
    state.scaleTimer = setTimeout(() => scaleSection(idx), 500);
  }
}

export function scalePreview() {
  for (let i = 0; i < sectionStates.length; i++) scaleSection(i);
}

window.addEventListener("resize", scalePreview);

// ── Page number correction ────────────────────────────────────────────────────
// Each section iframe starts counter(page) at 1. We override with correct
// cumulative page numbers after all sections have rendered.

function updatePageNumbers() {
  let pageOffset = 0;
  for (const state of sectionStates) {
    if (!state.frame) { pageOffset += state.pageCount; continue; }
    try {
      const doc = state.frame.contentDocument;
      // Hide CSS-generated counter(page) pseudo-element
      let fixStyle = doc.getElementById('page-number-fix');
      if (!fixStyle) {
        fixStyle = doc.createElement('style');
        fixStyle.id = 'page-number-fix';
        doc.head.appendChild(fixStyle);
      }
      fixStyle.textContent =
        '.pagedjs_margin-bottom-center > .pagedjs_margin-content::after { content: none !important; }';

      // Write corrected page numbers
      const margins = doc.querySelectorAll('.pagedjs_margin-bottom-center > .pagedjs_margin-content');
      margins.forEach((el, i) => {
        el.textContent = '';
        if (state.type !== 'cover') {
          el.textContent = String(pageOffset + i + 1);
          el.style.fontFamily = '"Hanken Grotesk", sans-serif';
          el.style.fontSize = '8pt';
          el.style.color = '#718096';
        }
      });
    } catch(e) {}
    pageOffset += state.pageCount;
  }
}

// ── Render timeout helpers ────────────────────────────────────────────────────

export let renderTimeout = null;

export function clearRenderTimeout() {
  clearTimeout(renderTimeout);
}

export function scheduleRender(ms) {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(triggerRender, ms);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getSectionFrames() {
  return sectionStates.filter(s => s.frame).map(s => s.frame);
}

export function getSectionStates() {
  return sectionStates;
}

export function getPreviewScale() {
  const containerW = previewContainer.clientWidth - 40;
  return Math.min(1, containerW / A4_WIDTH_PX);
}

// ── Full document export (for "Open in new tab") ──────────────────────────────
// Generates a single monolithic HTML document (not section-based).

export async function buildPagedHtml(md) {
  // Reuse the same section splitting as the preview pipeline
  const { sections } = splitMarkdownSections(md);
  const fm = sections[0]?.fm || {};
  const tocEntries = sections[0]?.tocEntries || [];
  const title = fm.title || "Document";
  const doctype = fm.doctype || "Mémoire technique";

  // Parse each content section with its own colorIdx
  let sectionsHtml = "";
  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i];
    const html = await parseSectionMarkdown(sec.raw, sec.colorIdx);
    let preambleHtml = '';
    if (sec.preamble) preambleHtml = await parseSectionMarkdown(sec.preamble, sec.colorIdx);
    sectionsHtml += '<section class="level2" data-color-index="' + (sec.colorIdx % 5) + '">\n' + preambleHtml + html + '\n</section>\n';
  }

  const titleParts = title.split(/\s*[—–]\s*/);
  const projectName = titleParts.length > 1 ? titleParts.slice(1).join(" — ") : title;

  const coverHtml = buildCoverContentHtml(fm, tocEntries);

  return `<!doctype html>
<html lang="${fm.language || 'fr'}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${PDF_CSS}</style>
  <style>${PAGED_CSS}</style>
  ${BEORN_LOGO_DATA_URI ? '<style>.pagedjs_page::after { background-image: url(' + BEORN_LOGO_DATA_URI + '); }</style>' : ''}
  <script>window.PagedConfig = { auto: false };<\/script>
</head>
<body>
  <div class="pdf-page-gradient"></div>
  <div class="pdf-running-header">${escapeHtml(projectName)} \u2014 ${escapeHtml(doctype)}</div>
  ${coverHtml}
  <div class="pdf-content">
    ${sectionsHtml}
  </div>
  <script src="${PAGED_JS_BLOB_URL}"><\/script>
  <script>window.__sectionIndex = 0; window.__sectionGen = 0;<\/script>
  <script src="${SECTION_INIT_BLOB_URL}"><\/script>
</body>
</html>`;
}

export async function openPreviewTab() {
  const html = await buildPagedHtml(editor.value);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
