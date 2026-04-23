// formatting-toolbar.js — Editor-local formatting actions and toolbar wiring.

import { on as busOn } from "../infrastructure/event-bus.js";
import { showContextMenu } from "../shell/ui/context-menu.js";
import { cm, status as _status } from "./codemirror-editor.js";
const status = _status!;
import { getActiveTab } from "../workspace/tabs/tab-bar-controller.js";
import { getTableRangeAt, insertTable } from "./table-widget.js";
import { saveImageAsset } from "../workspace/files/asset-manager.js";

const WORD_CHAR_RE: RegExp = /[\p{L}\p{N}_-]/u;
const SYMBOLS: { value: string; label: string }[] = [
  { value: "•", label: "Bullet" },
  { value: "→", label: "Arrow" },
  { value: "✓", label: "Check" },
  { value: "⚠", label: "Warning" },
  { value: "§", label: "Section" },
  { value: "€", label: "Euro" },
  { value: "—", label: "Dash" },
];

function selectionRange(): { doc: any; from: any; to: any; start: number; end: number; hasSelection: boolean } {
  const doc = cm.getDoc();
  const from = doc.getCursor("from");
  const to = doc.getCursor("to");
  const start = doc.indexFromPos(from);
  const end = doc.indexFromPos(to);
  return {
    doc,
    from,
    to,
    start,
    end,
    hasSelection: start !== end,
  };
}

function applyReplacement(doc: any, start: number, end: number, replacement: string, options: { selectStartOffset?: number; selectEndOffset?: number; cursorOffset?: number } = {}): void {
  const from = doc.posFromIndex(start);
  const to = doc.posFromIndex(end);
  doc.replaceRange(replacement, from, to);

  if (options.selectStartOffset != null && options.selectEndOffset != null) {
    doc.setSelection(
      doc.posFromIndex(start + options.selectStartOffset),
      doc.posFromIndex(start + options.selectEndOffset),
    );
  } else if (options.cursorOffset != null) {
    doc.setCursor(doc.posFromIndex(start + options.cursorOffset));
  }
}

function replaceSelection(text: string): void {
  const { doc, start, end } = selectionRange();
  applyReplacement(doc, start, end, text, { cursorOffset: text.length });
  cm.focus();
}

function insertSnippet(text: string, selectionStartOffset: number | null = null, selectionEndOffset: number | null = null): void {
  const { doc, start, end } = selectionRange();
  const options: { selectStartOffset?: number; selectEndOffset?: number; cursorOffset?: number } = {};
  if (selectionStartOffset != null && selectionEndOffset != null) {
    options.selectStartOffset = selectionStartOffset;
    options.selectEndOffset = selectionEndOffset;
  } else {
    options.cursorOffset = text.length;
  }
  applyReplacement(doc, start, end, text, options);
  cm.focus();
}

function isWordChar(char: string): boolean {
  return !!char && WORD_CHAR_RE.test(char);
}

function findWordRange(text: string, index: number): { start: number; end: number } | null {
  let pivot = index;
  if (!isWordChar(text[pivot]) && isWordChar(text[pivot - 1])) pivot -= 1;
  if (!isWordChar(text[pivot])) return null;

  let start = pivot;
  let end = pivot + 1;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  return { start, end };
}

function isRepeatedMarkdownMarker(text: string, index: number, marker: string): boolean {
  if (marker !== "*" && marker !== "**") return false;
  const markerChar = marker[0];
  return text[index - 1] === markerChar || text[index + marker.length] === markerChar;
}

function isMarkerAt(text: string, index: number, marker: string): boolean {
  return text.slice(index, index + marker.length) === marker;
}

function hasExactWrapper(text: string, start: number, end: number, prefix: string, suffix: string): boolean {
  const openIndex = start - prefix.length;
  const closeIndex = end;
  if (openIndex < 0 || closeIndex + suffix.length > text.length) return false;
  if (!isMarkerAt(text, openIndex, prefix) || !isMarkerAt(text, closeIndex, suffix)) return false;
  if (isRepeatedMarkdownMarker(text, openIndex, prefix)) return false;
  if (isRepeatedMarkdownMarker(text, closeIndex, suffix)) return false;
  return true;
}

function findLineBounds(text: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", end);
  return {
    lineStart,
    lineEnd: nextBreak === -1 ? text.length : nextBreak,
  };
}

function findEnclosingWrapper(text: string, targetStart: number, targetEnd: number, prefix: string, suffix: string): { fullStart: number; fullEnd: number; innerStart: number; innerEnd: number } | null {
  const { lineStart, lineEnd } = findLineBounds(text, targetStart, targetEnd);
  let openIndex = text.lastIndexOf(prefix, targetStart - 1);

  while (openIndex >= lineStart) {
    const innerStart = openIndex + prefix.length;
    const closeIndex = text.indexOf(suffix, Math.max(targetEnd, innerStart));
    if (closeIndex !== -1 && closeIndex < lineEnd) {
      if (
        innerStart <= targetStart &&
        closeIndex >= targetEnd &&
        !isRepeatedMarkdownMarker(text, openIndex, prefix) &&
        !isRepeatedMarkdownMarker(text, closeIndex, suffix)
      ) {
        return {
          fullStart: openIndex,
          fullEnd: closeIndex + suffix.length,
          innerStart,
          innerEnd: closeIndex,
        };
      }
    }
    openIndex = text.lastIndexOf(prefix, openIndex - 1);
  }

  return null;
}

function getInlineFormatContext(prefix: string, suffix: string): { doc: any; from: any; to: any; start: number; end: number; hasSelection: boolean; text: string; active: boolean; targetStart: number; targetEnd: number; fullStart?: number; fullEnd?: number; innerStart?: number; innerEnd?: number } {
  const context = selectionRange();
  const text = context.doc.getValue();
  const selectedText = text.slice(context.start, context.end);

  if (
    context.hasSelection &&
    selectedText.startsWith(prefix) &&
    selectedText.endsWith(suffix)
  ) {
    return {
      ...context,
      text,
      active: true,
      targetStart: context.start,
      targetEnd: context.end,
      fullStart: context.start,
      fullEnd: context.end,
      innerStart: context.start + prefix.length,
      innerEnd: context.end - suffix.length,
    };
  }

  const target = context.hasSelection
    ? { start: context.start, end: context.end }
    : findWordRange(text, context.start);

  if (target && hasExactWrapper(text, target.start, target.end, prefix, suffix)) {
    return {
      ...context,
      text,
      active: true,
      targetStart: target.start,
      targetEnd: target.end,
      fullStart: target.start - prefix.length,
      fullEnd: target.end + suffix.length,
      innerStart: target.start,
      innerEnd: target.end,
    };
  }

  if (target) {
    const enclosing = findEnclosingWrapper(text, target.start, target.end, prefix, suffix);
    if (enclosing) {
      return {
        ...context,
        text,
        active: true,
        targetStart: target.start,
        targetEnd: target.end,
        ...enclosing,
      };
    }
  }

  return {
    ...context,
    text,
    active: false,
    targetStart: target?.start ?? context.start,
    targetEnd: target?.end ?? context.end,
  };
}

function toggleInlineFormat(prefix: string, suffix: string): void {
  const state = getInlineFormatContext(prefix, suffix);
  const { doc, text } = state;

  if (state.active) {
    const s = state as any;
    const inner = text.slice(s.innerStart, s.innerEnd);
    applyReplacement(doc, s.fullStart, s.fullEnd, inner, {
      selectStartOffset: 0,
      selectEndOffset: inner.length,
    });
  } else if (state.targetStart !== state.targetEnd) {
    const inner = text.slice(state.targetStart, state.targetEnd);
    const wrapped = prefix + inner + suffix;
    applyReplacement(doc, state.targetStart, state.targetEnd, wrapped, {
      selectStartOffset: prefix.length,
      selectEndOffset: prefix.length + inner.length,
    });
  } else {
    applyReplacement(doc, state.start, state.end, prefix + suffix, {
      cursorOffset: prefix.length,
    });
  }

  cm.focus();
  refreshToolbarState();
}

function getSelectedLineRange(): { startLine: number; endLine: number } {
  const { from, to } = selectionRange();
  return {
    startLine: from.line,
    endLine: to.ch === 0 && to.line > from.line ? to.line - 1 : to.line,
  };
}

function getHeadingLevel(line: string): number {
  const match = /^(#{1,6})\s+/.exec(line || "");
  return match ? match[1].length : 0;
}

function getHeadingState(): { startLine: number; endLine: number; active: boolean; level: number | null } {
  const { doc } = selectionRange();
  const { startLine, endLine } = getSelectedLineRange();
  const levels: number[] = [];

  for (let lineNo = startLine; lineNo <= endLine; lineNo += 1) {
    levels.push(getHeadingLevel(doc.getLine(lineNo)));
  }

  const active = levels.some((level) => level > 0);
  const uniformLevel = levels.length && levels.every((level) => level === levels[0])
    ? levels[0]
    : null;

  return {
    startLine,
    endLine,
    active,
    level: uniformLevel,
  };
}

function applyHeadingLevel(level: number): void {
  const { doc } = selectionRange();
  const state = getHeadingState();
  const nextLevel = state.level === level ? 0 : level;

  cm.operation(() => {
    for (let lineNo = state.startLine; lineNo <= state.endLine; lineNo += 1) {
      const line = doc.getLine(lineNo) || "";
      const clean = line.replace(/^#{1,6}\s+/, "");
      const next = nextLevel ? `${"#".repeat(nextLevel)} ${clean}` : clean;
      doc.replaceRange(next, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
    }
  });

  cm.focus();
  refreshToolbarState();
}

function showButtonMenu(button: HTMLElement, items: any[]): void {
  const rect = button.getBoundingClientRect();
  showContextMenu(rect.left, rect.bottom + 6, items);
}

function openHeadingMenu(button: HTMLElement): void {
  showButtonMenu(button, [
    {
      label: "Paragraph",
      action: () => applyHeadingLevel(0),
    },
    { separator: true },
    ...[1, 2, 3, 4, 5, 6].map((level) => ({
      label: `Heading ${level}`,
      action: () => applyHeadingLevel(level),
    })),
  ]);
}

function getSymbolTarget(): { doc: any; from: any; to: any; start: number; end: number; hasSelection: boolean; text: string; targetStart: number; targetEnd: number } {
  const context = selectionRange();
  const text = context.doc.getValue();
  const target = context.hasSelection
    ? { start: context.start, end: context.end }
    : findWordRange(text, context.start);
  return {
    ...context,
    text,
    targetStart: target?.start ?? context.start,
    targetEnd: target?.end ?? context.end,
  };
}

function getSymbolPrefixState(): string {
  const { text, targetStart } = getSymbolTarget();

  for (const symbol of SYMBOLS) {
    const prefix = `${symbol.value} `;
    if (targetStart >= prefix.length && text.slice(targetStart - prefix.length, targetStart) === prefix) {
      return symbol.value;
    }
  }

  return "";
}

function toggleSymbol(symbol: string): void {
  const { doc, text, targetStart, targetEnd } = getSymbolTarget();
  const prefix = `${symbol} `;

  if (targetStart >= prefix.length && text.slice(targetStart - prefix.length, targetStart) === prefix) {
    const inner = text.slice(targetStart, targetEnd);
    applyReplacement(doc, targetStart - prefix.length, targetEnd, inner, {
      selectStartOffset: 0,
      selectEndOffset: inner.length,
    });
  } else if (targetStart !== targetEnd) {
    const inner = text.slice(targetStart, targetEnd);
    applyReplacement(doc, targetStart, targetEnd, prefix + inner, {
      selectStartOffset: prefix.length,
      selectEndOffset: prefix.length + inner.length,
    });
  } else {
    applyReplacement(doc, targetStart, targetEnd, prefix, {
      cursorOffset: prefix.length,
    });
  }

  cm.focus();
  refreshToolbarState();
}

function openSymbolMenu(button: HTMLElement): void {
  showButtonMenu(button, SYMBOLS.map((symbol) => ({
    label: `${symbol.label} ${symbol.value}`,
    action: () => toggleSymbol(symbol.value),
  })));
}

// ── Block-level snippets ──────────────────────────────────────────────────
// Each entry inserts a snippet on a fresh line below the cursor. We pad with
// surrounding blank lines so the inserted block isn't merged into the current
// paragraph by marked.

function insertBlockSnippet(snippet: string, selectionStartOffset?: number, selectionEndOffset?: number): void {
  const { doc, from } = selectionRange();
  const cursorLine = from.line as number;
  const lineText: string = doc.getLine(cursorLine) ?? "";
  const needLeadingBlank = lineText.trim().length > 0;
  const prefix = needLeadingBlank ? "\n\n" : (cursorLine === 0 ? "" : "\n");
  const full = `${prefix}${snippet}\n`;
  const insertPos = { line: cursorLine, ch: lineText.length };
  const insertIndex = doc.indexFromPos(insertPos);
  applyReplacement(doc, insertIndex, insertIndex, full, {
    selectStartOffset: selectionStartOffset != null ? prefix.length + selectionStartOffset : undefined,
    selectEndOffset: selectionEndOffset != null ? prefix.length + selectionEndOffset : undefined,
    cursorOffset: selectionStartOffset == null ? full.length : undefined,
  });
  cm.focus();
  refreshToolbarState();
}

function openBlocksMenu(button: HTMLElement): void {
  showButtonMenu(button, [
    {
      label: "Bullet list",
      action: () => insertBlockSnippet("- Item 1\n- Item 2\n- Item 3", 2, 8),
    },
    {
      label: "Numbered list",
      action: () => insertBlockSnippet("1. First\n2. Second\n3. Third", 3, 8),
    },
    {
      label: "Blockquote",
      action: () => insertBlockSnippet("> Quote text.", 2, 13),
    },
    { separator: true },
    {
      label: "Code block",
      action: () => insertBlockSnippet("```\ncode\n```", 4, 8),
    },
    {
      label: "Horizontal rule",
      action: () => insertBlockSnippet("---"),
    },
    { separator: true },
    {
      label: "Page break  (\\newpage)",
      action: () => insertBlockSnippet("\\newpage"),
    },
    {
      label: "Spacer  (\\spacer[20px])",
      action: () => insertBlockSnippet("\\spacer[20px]"),
    },
  ]);
}

function openComponentsMenu(button: HTMLElement): void {
  showButtonMenu(button, [
    {
      label: "Alert — Info",
      action: () => insertBlockSnippet(":::info\nInformation message.\n:::", 7, 26),
    },
    {
      label: "Alert — Warning",
      action: () => insertBlockSnippet(":::warning\nWarning message.\n:::", 11, 27),
    },
    {
      label: "Alert — Danger",
      action: () => insertBlockSnippet(":::danger\nCritical message.\n:::", 10, 27),
    },
    {
      label: "Alert — Success",
      action: () => insertBlockSnippet(":::success\nSuccess message.\n:::", 11, 27),
    },
    {
      label: "Alert — Note",
      action: () => insertBlockSnippet(":::note\nEditorial note.\n:::", 8, 22),
    },
    {
      label: "Alert — Tip",
      action: () => insertBlockSnippet(":::tip\nHelpful tip.\n:::", 7, 18),
    },
    { separator: true },
    {
      label: "KPI tiles",
      action: () =>
        insertBlockSnippet(
          ":::kpi\n18 ans | Expertise portails | Depuis 2007\n100+ | Projets livrés\n< 4 h | Temps de réponse garanti | SLA P1\n99,9 % | Disponibilité cible\n:::",
        ),
    },
    {
      label: "Enjeux / pillars",
      action: () =>
        insertBlockSnippet(
          ":::enjeux\nQualité | Zéro régression, revue systématique\nRéactivité | SLA < 4 h, astreinte 24/7\nSécurité | DevSecOps intégré, audits\n:::",
        ),
    },
    {
      label: "Breakdown",
      action: () =>
        insertBlockSnippet(
          ":::breakdown\n:::item Cadrage | Phase 1\n- Atelier besoins\n- Architecture cible\n:::item Implémentation | Phase 2\n- Dev itératif\n- Tests automatisés\n:::",
        ),
    },
    {
      label: "Planning heat-matrix",
      action: () =>
        insertBlockSnippet(
          ":::planning\ncolumns: S1, S2, S3:mise, S4:expl, S5:expl, S6:fin\nmilestones: Kick-off@0, Go-live@3:Prod, Clôture@6\n---\nAnalyse | X X o . . .\nDéveloppement | . X X X . .\nTests | . . X X X .\nProduction | . . . o X X\n:::",
        ),
    },
    {
      label: "Quote",
      action: () =>
        insertBlockSnippet(
          ':::quote author="Nom Prénom" role="Rôle"\nTexte de la citation.\n:::',
        ),
    },
    {
      label: "Timeline",
      action: () =>
        insertBlockSnippet(
          ":::timeline\n:::step Étape 1 | J+0\nDescription de l'étape 1.\n:::step Étape 2 | J+5\nDescription de l'étape 2.\n:::step Étape 3 | J+10\nDescription de l'étape 3.\n:::",
        ),
    },
    { separator: true },
    {
      label: "12-col grid  (ao-grid)",
      action: () =>
        insertBlockSnippet(
          "```ao-grid\n:::col-8\nColonne principale (8/12)\n:::col-4\nColonne latérale (4/12)\n```",
        ),
    },
  ]);
}

// ── Help modal ─────────────────────────────────────────────────────────────

interface HelpItem {
  name: string;
  desc: string;
  syntax: string;
}
interface HelpCategory {
  title: string;
  items: HelpItem[];
}

const HELP_CATEGORIES: HelpCategory[] = [
  {
    title: "Inline formatting",
    items: [
      { name: "Bold", desc: "Emphasise a span of text.", syntax: "**bold text**" },
      { name: "Italic", desc: "Italicise a span of text.", syntax: "*italic text*" },
      { name: "Underline", desc: "Inline HTML — passes through the renderer.", syntax: "<u>underlined</u>" },
      { name: "Inline code", desc: "Fixed-width span.", syntax: "`code`" },
      { name: "Link", desc: "External or anchor link.", syntax: "[label](https://example.com)" },
    ],
  },
  {
    title: "Text structure",
    items: [
      { name: "Headings (h1–h4)", desc: "Section titles. First digit of the number badge comes from the filename (`01-foo.md` → 1.x) or an explicit `# Partie N` header.", syntax: "# H1\n## H2\n### H3\n#### H4" },
      { name: "Bullet list", desc: "Unordered list.", syntax: "- Item 1\n- Item 2" },
      { name: "Numbered list", desc: "Ordered list.", syntax: "1. First\n2. Second" },
      { name: "Blockquote", desc: "Quoted paragraph.", syntax: "> Quote text." },
      { name: "Horizontal rule", desc: "Section divider.", syntax: "---" },
      { name: "Code block", desc: "Fenced code; optional language for syntax highlighting.", syntax: "```js\nconst x = 1;\n```" },
    ],
  },
  {
    title: "Media",
    items: [
      { name: "Table", desc: "GitHub-Flavored Markdown table.", syntax: "| H1 | H2 |\n| -- | -- |\n| a  | b  |" },
      { name: "Image", desc: "Standalone image renders as a figure with optional caption.", syntax: "![Caption](./image.png)" },
      { name: "Image (aligned, sized)", desc: "Pipe-separated options after the URL: alignment (left|center|right) and max-width.", syntax: "![Caption](./image.png|right|200px)" },
      { name: "Mermaid diagram", desc: "Rendered via Mermaid 11 into an SVG.", syntax: "```mermaid\nflowchart LR\n  A --> B\n```" },
    ],
  },
  {
    title: "Page flow",
    items: [
      { name: "Page break", desc: "Force a page break at the current location (export + preview).", syntax: "\\newpage\n\nor\n\n/newpage" },
      { name: "Spacer", desc: "Invisible full-width block with a caller-chosen height. Accepts any CSS length.", syntax: "\\spacer[40px]\n\nor\n\n/spacer[2rem]" },
    ],
  },
  {
    title: "Alert containers",
    items: [
      { name: ":::info", desc: "Editorial information.", syntax: ":::info\nInformation message.\n:::" },
      { name: ":::warning", desc: "Caution or reminder.", syntax: ":::warning\nWarning message.\n:::" },
      { name: ":::danger", desc: "Critical issue.", syntax: ":::danger\nCritical message.\n:::" },
      { name: ":::success", desc: "Positive outcome.", syntax: ":::success\nSuccess message.\n:::" },
      { name: ":::note", desc: "Annotation or aside.", syntax: ":::note\nEditorial note.\n:::" },
      { name: ":::tip", desc: "Helpful advice.", syntax: ":::tip\nHelpful tip.\n:::" },
    ],
  },
  {
    title: "BEORN layout components",
    items: [
      { name: ":::kpi", desc: "KPI tiles. One non-empty line per tile. Syntax: `VALUE | LABEL | NOTE`. NOTE is optional.", syntax: ":::kpi\n18 ans | Expertise portails | Depuis 2007\n100+ | Projets livrés\n< 4 h | Temps de réponse | SLA P1\n99,9 % | Disponibilité cible\n:::" },
      { name: ":::enjeux", desc: "Numbered pillar tiles (auto 01-07, capped at 7). Syntax: `TITLE | PITCH`.", syntax: ":::enjeux\nQualité | Zéro régression\nRéactivité | SLA < 4 h\nSécurité | DevSecOps intégré\n:::" },
      { name: ":::breakdown", desc: "Multi-card deliverables view. Uses `:::item TITLE | PHASE` sub-headers with a bulleted body per card.", syntax: ":::breakdown\n:::item Cadrage | Phase 1\n- Atelier besoins\n- Architecture\n:::item Implémentation | Phase 2\n- Dev itératif\n- Tests\n:::" },
      { name: ":::planning", desc: "Contract-lifecycle heat matrix. Config block (columns/milestones) + `---` + data rows `Title | T T T …` where T is X/■ = on, o/• = event, else off.", syntax: ":::planning\ncolumns: S1, S2, S3:mise, S4:expl, S5:fin\nmilestones: Kick-off@0, Go-live@3\n---\nAnalyse | X X o . .\nDev     | . X X X .\n:::" },
      { name: ":::quote", desc: "Blockquote with author/role attribution.", syntax: ':::quote author="Nom Prénom" role="Rôle"\nTexte de la citation.\n:::' },
      { name: ":::timeline", desc: "Vertical timeline. Each `:::step TITLE | META` starts a new step with markdown body.", syntax: ":::timeline\n:::step Étape 1 | J+0\nDescription.\n:::step Étape 2 | J+5\nDescription.\n:::" },
      { name: "12-column grid (`ao-grid`)", desc: "Fenced code block of kind `ao-grid`. Each `:::col-N` opens a column spanning N/12.", syntax: "```ao-grid\n:::col-8\nColonne principale\n:::col-4\nColonne latérale\n```" },
    ],
  },
  {
    title: "Style directive",
    items: [
      { name: "{:style …}", desc: "Inline per-block spacing override. Goes at the end of the block's first source line. Keys: mt/mr/mb/ml/pt/pr/pb/pl. Values are raw px (0–500). Use the Style Mode toggle for a visual editor.", syntax: "## Heading {:style mt=16 pb=8}\n\nParagraph. {:style mt=24}\n\n--- {:style mt=32 mb=32}" },
    ],
  },
  {
    title: "Frontmatter",
    items: [
      { name: "Document metadata", desc: "Optional YAML-like frontmatter at the top of each file. Read by the renderer for document-wide settings.", syntax: "---\ntitle: \"Document title\"\ndoctype: \"Mémoire technique\"\n---" },
    ],
  },
];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let _helpBuilt = false;

function openHelpModal(): void {
  const overlay = document.getElementById("helpModal");
  if (!overlay) return;
  if (!_helpBuilt) {
    const body = document.getElementById("helpBody");
    if (body) {
      body.innerHTML = HELP_CATEGORIES.map((cat) => `
        <div class="help-category">
          <div class="help-category-title">${escapeHtml(cat.title)}</div>
          ${cat.items.map((item) => `
            <div class="help-item">
              <div>
                <div class="help-item-name">${escapeHtml(item.name)}</div>
                <div class="help-item-desc">${escapeHtml(item.desc)}</div>
              </div>
              <pre class="help-item-syntax">${escapeHtml(item.syntax)}</pre>
            </div>
          `).join("")}
        </div>
      `).join("");
    }
    const closeBtn = document.getElementById("btnHelpClose");
    closeBtn?.addEventListener("click", closeHelpModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeHelpModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("active")) closeHelpModal();
    });
    _helpBuilt = true;
  }
  overlay.classList.add("active");
}

function closeHelpModal(): void {
  const overlay = document.getElementById("helpModal");
  overlay?.classList.remove("active");
}

function isSeparatorLine(line: string): boolean {
  return /^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(line || "");
}

function parseTableLine(line: string): string[] {
  const cells = (line || "").split("|").slice(1);
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((cell) => cell.trim());
}

function toggleTableBlock(): void {
  const { doc } = selectionRange();
  const range = getTableRangeAt(cm.getCursor("from").line);

  if (!range) {
    insertTable();
    cm.focus();
    refreshToolbarState();
    return;
  }

  const plainLines = [];
  for (let lineNo = range.start; lineNo <= range.end; lineNo += 1) {
    const line = doc.getLine(lineNo) || "";
    if (isSeparatorLine(line)) continue;
    plainLines.push(parseTableLine(line).join("\t"));
  }

  const replacement = plainLines.join("\n");
  const start = doc.indexFromPos({ line: range.start, ch: 0 });
  const end = doc.indexFromPos({ line: range.end, ch: (doc.getLine(range.end) || "").length });
  applyReplacement(doc, start, end, replacement, {
    selectStartOffset: 0,
    selectEndOffset: replacement.length,
  });
  cm.focus();
  refreshToolbarState();
}

function getFenceBlockAtLine(lineNum: number): { startLine: number; endLine: number; lang: string } | null {
  let open = null;
  const lastLine = cm.lastLine();

  for (let i = 0; i <= lastLine; i += 1) {
    const line = (cm.getLine(i) || "").trim();
    if (!line.startsWith("```")) continue;

    if (!open) {
      open = {
        startLine: i,
        lang: line.slice(3).trim().toLowerCase(),
      };
      continue;
    }

    const block = {
      startLine: open.startLine,
      endLine: i,
      lang: open.lang,
    };
    if (lineNum >= block.startLine && lineNum <= block.endLine) return block;
    open = null;
  }

  return null;
}

function getMermaidBlockForSelection(): { startLine: number; endLine: number; lang: string } | null {
  const { from } = selectionRange();
  const { endLine } = getSelectedLineRange();
  const block = getFenceBlockAtLine(from.line);
  if (!block || block.lang !== "mermaid") return null;
  return endLine <= block.endLine ? block : null;
}

function toggleMermaidBlock(): void {
  const { doc, from, to, start, end, hasSelection } = selectionRange();
  const block = getMermaidBlockForSelection();

  if (block) {
    const innerLines = [];
    for (let lineNo = block.startLine + 1; lineNo < block.endLine; lineNo += 1) {
      innerLines.push(doc.getLine(lineNo) || "");
    }

    const replacement = innerLines.join("\n");
    const blockStart = doc.indexFromPos({ line: block.startLine, ch: 0 });
    const blockEnd = doc.indexFromPos({
      line: block.endLine,
      ch: (doc.getLine(block.endLine) || "").length,
    });

    applyReplacement(doc, blockStart, blockEnd, replacement, {
      selectStartOffset: 0,
      selectEndOffset: replacement.length,
    });
    cm.focus();
    refreshToolbarState();
    return;
  }

  if (hasSelection) {
    const selectionText = doc.getRange(from, to);
    const wrapped = `\`\`\`mermaid\n${selectionText}\n\`\`\``;
    applyReplacement(doc, start, end, wrapped, {
      selectStartOffset: 11,
      selectEndOffset: 11 + selectionText.length,
    });
    cm.focus();
    refreshToolbarState();
    return;
  }

  const blockText = [
    "```mermaid",
    "flowchart TD",
    "  A[Start] --> B[Next step]",
    "```",
  ].join("\n");
  const editableText = "flowchart TD\n  A[Start] --> B[Next step]";
  const offset = blockText.indexOf(editableText);
  insertSnippet(blockText, offset, offset + editableText.length);
  refreshToolbarState();
}

async function insertImages(files: File[]): Promise<void> {
  const tab = getActiveTab();
  if (!tab?.path) {
    status.textContent = "Save the Markdown file before inserting images";
    return;
  }

  const assets = [];
  for (const file of files) {
    try {
      assets.push(await saveImageAsset(tab.path, file));
    } catch (err: any) {
      status.textContent = "Failed to insert image: " + err.message;
      return;
    }
  }

  if (!assets.length) return;

  const markdown = assets
    .map((asset) => `![${asset.altText}](${asset.markdownPath})`)
    .join("\n\n");
  replaceSelection(markdown);
  status.textContent = assets.length === 1
    ? "Inserted image " + assets[0].markdownPath
    : "Inserted " + assets.length + " images";
}

function setButtonActive(id: string, active: boolean): void {
  const button = document.getElementById(id);
  if (!button) return;
  button.classList.toggle("active", !!active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
}

function refreshToolbarState(): void {
  setButtonActive("btnFmtBold", getInlineFormatContext("**", "**").active);
  setButtonActive("btnFmtItalic", getInlineFormatContext("*", "*").active);
  setButtonActive("btnFmtUnderline", getInlineFormatContext("<u>", "</u>").active);

  const headingState = getHeadingState();
  setButtonActive("btnFmtHeading", headingState.active);
  const headingButton = document.getElementById("btnFmtHeading");
  if (headingButton) {
    headingButton.title = headingState.level
      ? `Title levels (current: H${headingState.level})`
      : "Title levels";
  }

  setButtonActive("btnFmtSymbol", !!getSymbolPrefixState());
  setButtonActive("btnFmtTable", !!getTableRangeAt(cm.getCursor("from").line));
  setButtonActive("btnFmtMermaid", !!getMermaidBlockForSelection());
}

export function initFormattingToolbar(): void {
  const toolbar = document.getElementById("editorFormatBar");
  if (!toolbar) return;

  const imageInput = document.getElementById("toolbarImageInput") as HTMLInputElement | null;

  imageInput?.addEventListener("change", async () => {
    const files = Array.from(imageInput.files || []).filter((file) => file.type.startsWith("image/"));
    imageInput.value = "";
    if (!files.length) return;
    await insertImages(files);
    refreshToolbarState();
  });

  toolbar.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-format-action]");
    if (!button || button.disabled) return;

    const action = button.dataset.formatAction;
    switch (action) {
      case "bold":
        toggleInlineFormat("**", "**");
        break;
      case "italic":
        toggleInlineFormat("*", "*");
        break;
      case "underline":
        toggleInlineFormat("<u>", "</u>");
        break;
      case "heading-menu":
        openHeadingMenu(button);
        break;
      case "symbol-menu":
        openSymbolMenu(button);
        break;
      case "table":
        toggleTableBlock();
        break;
      case "image":
        if (!imageInput) return;
        imageInput.value = "";
        imageInput.click();
        break;
      case "mermaid":
        toggleMermaidBlock();
        break;
      case "blocks-menu":
        openBlocksMenu(button);
        break;
      case "components-menu":
        openComponentsMenu(button);
        break;
      case "help":
        openHelpModal();
        break;
      default:
        break;
    }
  });

  toolbar.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button[data-format-action]")) {
      e.preventDefault();
    }
  });

  cm.on("cursorActivity", refreshToolbarState);
  cm.on("change", refreshToolbarState);
  busOn("content-loaded", refreshToolbarState);
  refreshToolbarState();
}
