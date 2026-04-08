// marked-renderer.js — Configures marked.js with custom renderers and hooks.
// Reads/writes shared parse state via markdown-state.js.

import { escapeHtml } from "./utils.js";
import { COLOR_PAIRS } from "./markdown-helpers.js";
import { state } from "./markdown-state.js";
import { pushToMermaidQueue } from "./mermaid-render.js";
import {
  stripLeadingNumber,
  slugify,
  decodeEntities,
  buildUnderline,
} from "./markdown-helpers.js";

marked.use({
  renderer: {
    heading(token) {
      const { tokens, depth } = token;
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const text = this.parser.parseInline(tokens);
      const pair = COLOR_PAIRS[state.colorIdx % COLOR_PAIRS.length];
      const [primary] = pair;
      const vars = `--section-color:${primary};--section-color-light:${pair[1]}`;

      const plainText = text.replace(/<[^>]+>/g, "");
      const hid = `h-${state.headingIdCounter++}-${slugify(plainText)}`;
      const idAttr = ` id="${hid}"`;

      if (depth >= 5)
        return `<h${depth}${idAttr}${sl} style="color:${primary};${vars}">${text}</h${depth}>\n`;

      if (depth === 1) {
        const clean = stripLeadingNumber(text);
        const stripped = clean.replace(/^Partie\s+\d+\s*[—●\-]\s*/i, "");
        const disc = '<span class="beorn-disc">&#x25CF;</span>';
        const title = state.partieNum
          ? `Partie ${state.partieNum} ${disc} ${stripped}`
          : clean;
        if (state.headingCollector) {
          const tocTitle = decodeEntities(
            (stripped || clean).replace(/<[^>]+>/g, ""),
          );
          state.headingCollector.push({
            depth: 1,
            id: hid,
            title: tocTitle,
            num: state.partieNum || null,
            colorPair: pair,
          });
        }
        return `<h1${idAttr}${sl} data-color-index="${state.colorIdx % 5}" style="color:${primary};${vars}">${title}${buildUnderline(pair)}</h1>\n`;
      }

      if (depth === 2) {
        state.h2Count++;
        state.h3Count = 0;
      } else if (depth === 3) {
        state.h3Count++;
      }

      const clean = stripLeadingNumber(text);

      if (!state.partieNum) {
        return `<h${depth}${idAttr}${sl} style="color:${primary};${vars}">${clean}</h${depth}>\n`;
      }

      const num =
        depth === 2
          ? `${state.partieNum}.${state.h2Count}`
          : `${state.partieNum}.${state.h2Count}.${state.h3Count}`;
      const disc = '<span class="beorn-disc">&#x25CF;</span>';

      if (depth === 2) {
        return `<h2${idAttr}${sl} style="color:${primary};${vars}"><span class="beorn-num" style="background:${primary};color:#fff">${escapeHtml(num)}</span><span class="beorn-text">${clean}</span></h2>\n`;
      }
      if (depth === 3) {
        return `<h3${idAttr}${sl} style="color:${primary};padding:0.3rem 0.7rem;border-radius:4px;background:color-mix(in srgb, ${primary} 6%, transparent);width:fit-content;max-width:100%;${vars}"><span class="beorn-num" style="color:${primary}">${escapeHtml(num)}</span> ${disc} ${clean}</h3>\n`;
      }
      return `<h${depth}${idAttr}${sl} style="color:${primary};${vars}">${clean}</h${depth}>\n`;
    },

    paragraph(token) {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      return `<p${sl}>${this.parser.parseInline(token.tokens)}</p>\n`;
    },

    blockquote(token) {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const body = this.parser.parse(token.tokens);
      return `<blockquote${sl}>\n${body}</blockquote>\n`;
    },

    list(token) {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      const tag = token.ordered ? "ol" : "ul";
      const startAttr =
        token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
      let body = "";
      for (const item of token.items) {
        body += this.listitem(item);
      }
      return `<${tag}${startAttr}${sl}>\n${body}</${tag}>\n`;
    },

    table(token) {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      let header = "";
      for (const cell of token.header) {
        const align = cell.align ? ` align="${cell.align}"` : "";
        header += `<th${align}>${this.parser.parseInline(cell.tokens)}</th>\n`;
      }
      header = `<tr>\n${header}</tr>\n`;
      let body = "";
      for (const row of token.rows) {
        let rowContent = "";
        for (const cell of row) {
          const align = cell.align ? ` align="${cell.align}"` : "";
          rowContent += `<td${align}>${this.parser.parseInline(cell.tokens)}</td>\n`;
        }
        body += `<tr>\n${rowContent}</tr>\n`;
      }
      return `<table${sl}>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
    },

    hr(token) {
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      return `<hr${sl} />\n`;
    },

    code(token) {
      const { text, lang } = token;
      const sl =
        token._sourceLine != null
          ? ` data-source-line="${token._sourceLine}"`
          : "";
      if (lang === "mermaid") {
        const idx = pushToMermaidQueue(text);
        return `<div class="mermaid-diagram"${sl} data-mermaid-idx="${idx}"></div>\n`;
      }
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre${sl}><code${langClass}>${escapeHtml(text)}</code></pre>\n`;
    },
  },

  hooks: {
    postprocess(html) {
      const pair = COLOR_PAIRS[state.colorIdx % COLOR_PAIRS.length];
      const vars = `--section-color:${pair[0]};--section-color-light:${pair[1]}`;

      html = html.replace(
        /<(p|ul|ol|li|blockquote|table|thead|tbody|tr|td|th|pre|code)(\s|>)/gi,
        (_m, tag, after) => `<${tag} style="${vars}"${after}`,
      );

      // French typography: non-breaking spaces before :;!?
      html = html
        .replace(/(\w) :/g, "$1\u00a0:")
        .replace(/(\w) ;/g, "$1\u00a0;")
        .replace(/(\w) !/g, "$1\u00a0!")
        .replace(/(\w) \?/g, "$1\u00a0?");

      return html;
    },
  },
});
