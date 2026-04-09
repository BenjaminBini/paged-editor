// formatting-toolbar.js — Editor-local formatting actions and toolbar wiring.

import { on as busOn } from "./event-bus.js";
import { showContextMenu } from "./context-menu.js";
import { cm, status } from "./editor.js";
import { getActiveTab } from "./tab-bar.js";
import { getTableRangeAt, insertTable } from "./table-widget.js";
import { saveImageAsset } from "./workspace-assets.js";

const WORD_CHAR_RE = /[\p{L}\p{N}_-]/u;
const SYMBOLS = [
  { value: "•", label: "Bullet" },
  { value: "→", label: "Arrow" },
  { value: "✓", label: "Check" },
  { value: "⚠", label: "Warning" },
  { value: "§", label: "Section" },
  { value: "€", label: "Euro" },
  { value: "—", label: "Dash" },
];

function selectionRange() {
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

function applyReplacement(doc, start, end, replacement, options = {}) {
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

function replaceSelection(text) {
  const { doc, start, end } = selectionRange();
  applyReplacement(doc, start, end, text, { cursorOffset: text.length });
  cm.focus();
}

function insertSnippet(text, selectionStartOffset = null, selectionEndOffset = null) {
  const { doc, start, end } = selectionRange();
  const options = {};
  if (selectionStartOffset != null && selectionEndOffset != null) {
    options.selectStartOffset = selectionStartOffset;
    options.selectEndOffset = selectionEndOffset;
  } else {
    options.cursorOffset = text.length;
  }
  applyReplacement(doc, start, end, text, options);
  cm.focus();
}

function isWordChar(char) {
  return !!char && WORD_CHAR_RE.test(char);
}

function findWordRange(text, index) {
  let pivot = index;
  if (!isWordChar(text[pivot]) && isWordChar(text[pivot - 1])) pivot -= 1;
  if (!isWordChar(text[pivot])) return null;

  let start = pivot;
  let end = pivot + 1;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  return { start, end };
}

function isRepeatedMarkdownMarker(text, index, marker) {
  if (marker !== "*" && marker !== "**") return false;
  const markerChar = marker[0];
  return text[index - 1] === markerChar || text[index + marker.length] === markerChar;
}

function isMarkerAt(text, index, marker) {
  return text.slice(index, index + marker.length) === marker;
}

function hasExactWrapper(text, start, end, prefix, suffix) {
  const openIndex = start - prefix.length;
  const closeIndex = end;
  if (openIndex < 0 || closeIndex + suffix.length > text.length) return false;
  if (!isMarkerAt(text, openIndex, prefix) || !isMarkerAt(text, closeIndex, suffix)) return false;
  if (isRepeatedMarkdownMarker(text, openIndex, prefix)) return false;
  if (isRepeatedMarkdownMarker(text, closeIndex, suffix)) return false;
  return true;
}

function findLineBounds(text, start, end) {
  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", end);
  return {
    lineStart,
    lineEnd: nextBreak === -1 ? text.length : nextBreak,
  };
}

function findEnclosingWrapper(text, targetStart, targetEnd, prefix, suffix) {
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

function getInlineFormatContext(prefix, suffix) {
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

function toggleInlineFormat(prefix, suffix) {
  const state = getInlineFormatContext(prefix, suffix);
  const { doc, text } = state;

  if (state.active) {
    const inner = text.slice(state.innerStart, state.innerEnd);
    applyReplacement(doc, state.fullStart, state.fullEnd, inner, {
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

function getSelectedLineRange() {
  const { from, to } = selectionRange();
  return {
    startLine: from.line,
    endLine: to.ch === 0 && to.line > from.line ? to.line - 1 : to.line,
  };
}

function getHeadingLevel(line) {
  const match = /^(#{1,6})\s+/.exec(line || "");
  return match ? match[1].length : 0;
}

function getHeadingState() {
  const { doc } = selectionRange();
  const { startLine, endLine } = getSelectedLineRange();
  const levels = [];

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

function applyHeadingLevel(level) {
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

function showButtonMenu(button, items) {
  const rect = button.getBoundingClientRect();
  showContextMenu(rect.left, rect.bottom + 6, items);
}

function openHeadingMenu(button) {
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

function getSymbolTarget() {
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

function getSymbolPrefixState() {
  const { text, targetStart } = getSymbolTarget();

  for (const symbol of SYMBOLS) {
    const prefix = `${symbol.value} `;
    if (targetStart >= prefix.length && text.slice(targetStart - prefix.length, targetStart) === prefix) {
      return symbol.value;
    }
  }

  return "";
}

function toggleSymbol(symbol) {
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

function openSymbolMenu(button) {
  showButtonMenu(button, SYMBOLS.map((symbol) => ({
    label: `${symbol.label} ${symbol.value}`,
    action: () => toggleSymbol(symbol.value),
  })));
}

function isSeparatorLine(line) {
  return /^\s*\|([\s:]*-[\s:-]*\|)+\s*$/.test(line || "");
}

function parseTableLine(line) {
  const cells = (line || "").split("|").slice(1);
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((cell) => cell.trim());
}

function toggleTableBlock() {
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

function getFenceBlockAtLine(lineNum) {
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

function getMermaidBlockForSelection() {
  const { from } = selectionRange();
  const { endLine } = getSelectedLineRange();
  const block = getFenceBlockAtLine(from.line);
  if (!block || block.lang !== "mermaid") return null;
  return endLine <= block.endLine ? block : null;
}

function toggleMermaidBlock() {
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

async function insertImages(files) {
  const tab = getActiveTab();
  if (!tab?.path) {
    status.textContent = "Save the Markdown file before inserting images";
    return;
  }

  const assets = [];
  for (const file of files) {
    try {
      assets.push(await saveImageAsset(tab.path, file));
    } catch (err) {
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

function setButtonActive(id, active) {
  const button = document.getElementById(id);
  if (!button) return;
  button.classList.toggle("active", !!active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
}

function refreshToolbarState() {
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

export function initFormattingToolbar() {
  const toolbar = document.getElementById("editorFormatBar");
  if (!toolbar) return;

  const imageInput = document.getElementById("toolbarImageInput");

  imageInput?.addEventListener("change", async () => {
    const files = Array.from(imageInput.files || []).filter((file) => file.type.startsWith("image/"));
    imageInput.value = "";
    if (!files.length) return;
    await insertImages(files);
    refreshToolbarState();
  });

  toolbar.addEventListener("click", (e) => {
    const button = e.target.closest("[data-format-action]");
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
      default:
        break;
    }
  });

  toolbar.addEventListener("mousedown", (e) => {
    if (e.target.closest("button[data-format-action]")) {
      e.preventDefault();
    }
  });

  cm.on("cursorActivity", refreshToolbarState);
  cm.on("change", refreshToolbarState);
  busOn("content-loaded", refreshToolbarState);
  refreshToolbarState();
}
