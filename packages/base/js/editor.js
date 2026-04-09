// editor.js — CodeMirror 6 editor module with a CM5-style compatibility layer.

import {
  Compartment,
  LanguageDescription,
  EditorSelection,
  EditorState,
  EditorView,
  HighlightStyle,
  css,
  crosshairCursor,
  defaultKeymap,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  html,
  history,
  historyKeymap,
  javascript,
  keymap,
  lineNumbers,
  markdown,
  rectangularSelection,
  redo,
  searchKeymap,
  syntaxHighlighting,
  tags,
  undo,
} from "../assets/codemirror6.bundle.js";
import { emit } from "./event-bus.js";

export const markdownMode = {
  name: "markdown",
  fencedCodeBlockHighlighting: true,
  tokenTypeOverrides: { code: "code" },
};

const textarea = document.getElementById("editor-textarea");
const lineWrappingCompartment = new Compartment();
const codeLanguages = [
  LanguageDescription.of({
    name: "JavaScript",
    alias: ["javascript", "js", "mjs", "cjs"],
    support: javascript(),
  }),
  LanguageDescription.of({
    name: "TypeScript",
    alias: ["typescript", "ts"],
    support: javascript({ typescript: true }),
  }),
  LanguageDescription.of({
    name: "JSX",
    alias: ["jsx"],
    support: javascript({ jsx: true }),
  }),
  LanguageDescription.of({
    name: "TSX",
    alias: ["tsx"],
    support: javascript({ typescript: true, jsx: true }),
  }),
  LanguageDescription.of({
    name: "HTML",
    alias: ["html", "xml"],
    support: html(),
  }),
  LanguageDescription.of({
    name: "CSS",
    alias: ["css", "scss", "less"],
    support: css(),
  }),
];

const editorHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "#f0a840", fontWeight: "700" },
  { tag: tags.heading1, color: "#f0a840", fontWeight: "700", fontSize: "1.2em" },
  { tag: tags.heading2, color: "#e0c070", fontWeight: "700", fontSize: "1.1em" },
  { tag: tags.heading3, color: "#c8d880", fontWeight: "700" },
  { tag: tags.strong, color: "#f9e2af", fontWeight: "700" },
  { tag: tags.emphasis, color: "#cba6f7", fontStyle: "italic" },
  { tag: tags.link, color: "#89b4fa", textDecoration: "none" },
  { tag: tags.url, color: "#6c7086" },
  { tag: tags.quote, color: "#a6adc8", fontStyle: "italic" },
  { tag: tags.monospace, color: "#f6c177", fontWeight: "600" },
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.operatorKeyword,
      tags.modifier,
    ],
    color: "#cba6f7",
  },
  { tag: [tags.atom, tags.bool, tags.number, tags.integer, tags.float], color: "#fab387" },
  { tag: [tags.string, tags.special(tags.string), tags.attributeValue], color: "#a6e3a1" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: "#8b91ab" },
  { tag: tags.contentSeparator, color: "#585b70" },
  { tag: tags.tagName, color: "#f38ba8" },
  { tag: tags.attributeName, color: "#89b4fa" },
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: "#89dceb" },
]);

const eventListeners = new Map();
const options = {
  lineWrapping: true,
  extraKeys: {},
};

function onEvent(type, fn) {
  if (!eventListeners.has(type)) eventListeners.set(type, new Set());
  eventListeners.get(type).add(fn);
}

function offEvent(type, fn) {
  eventListeners.get(type)?.delete(fn);
}

function emitEvent(type, ...args) {
  for (const fn of eventListeners.get(type) || []) fn(...args);
}

function normalizeKeyName(key) {
  if (key === "Esc") return "Escape";
  if (key === "Space") return " ";
  if (key.length === 1) return key.toLowerCase();
  return key;
}

function matchesKeySpec(event, spec) {
  const parts = String(spec || "").split("-");
  const key = normalizeKeyName(parts.pop() || "");
  const wantCtrl = parts.includes("Ctrl");
  const wantMeta = parts.includes("Cmd") || parts.includes("Meta");
  const wantShift = parts.includes("Shift");
  const wantAlt = parts.includes("Alt");
  const wantMod = parts.includes("Mod");

  if ((wantCtrl || (wantMod && !event.metaKey)) && !event.ctrlKey) return false;
  if ((wantMeta || (wantMod && !event.ctrlKey)) && !event.metaKey) return false;
  if (event.shiftKey !== wantShift && !(key.length === 1 && event.shiftKey && wantShift)) return false;
  if (event.altKey !== wantAlt) return false;

  if (!wantCtrl && !wantMod && event.ctrlKey) return false;
  if (!wantMeta && !wantMod && event.metaKey) return false;

  return normalizeKeyName(event.key) === key || normalizeKeyName(event.code) === key;
}

function createExtraKeysHandler() {
  return EditorView.domEventHandlers({
    keydown(_view, event) {
      const extraKeys = options.extraKeys || {};
      for (const [spec, handler] of Object.entries(extraKeys)) {
        if (!matchesKeySpec(event, spec)) continue;
        if (typeof handler === "function") {
          event.preventDefault();
          handler(cm);
          return true;
        }
      }
      return false;
    },
  });
}

function createExtensions() {
  return [
    EditorState.allowMultipleSelections.of(true),
    lineNumbers(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    syntaxHighlighting(editorHighlightStyle),
    markdown({ codeLanguages }),
    lineWrappingCompartment.of(options.lineWrapping ? EditorView.lineWrapping : []),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
    ]),
    createExtraKeysHandler(),
    EditorView.contentAttributes.of({
      spellcheck: "false",
      autocorrect: "off",
      autocapitalize: "off",
      autocomplete: "off",
    }),
    EditorView.updateListener.of((update) => {
      syncLegacyDomClasses();
      emitEvent("update", cm, update);
      if (update.docChanged) emitEvent("change", cm, update);
      if (update.selectionSet || update.docChanged) emitEvent("cursorActivity", cm, update);
      requestAnimationFrame(updateScrollPastEndPadding);
    }),
  ];
}

function lineInfoForNumber(lineNo) {
  const line = Math.min(Math.max(0, Number(lineNo) || 0), view.state.doc.lines - 1) + 1;
  return view.state.doc.line(line);
}

function posToIndex(pos = { line: 0, ch: 0 }) {
  const line = lineInfoForNumber(pos.line);
  const ch = Math.max(0, Math.min(Number(pos.ch) || 0, line.length));
  return line.from + ch;
}

function indexToPos(index) {
  const bounded = Math.max(0, Math.min(Number(index) || 0, view.state.doc.length));
  const line = view.state.doc.lineAt(bounded);
  return { line: line.number - 1, ch: bounded - line.from };
}

function selectionForState(selection) {
  if (!selection) return undefined;
  return EditorSelection.single(
    posToIndex(selection.anchor || { line: 0, ch: 0 }),
    posToIndex(selection.head || selection.anchor || { line: 0, ch: 0 }),
  );
}

function createState(docText = "", selection = null) {
  return EditorState.create({
    doc: docText,
    selection: selectionForState(selection),
    extensions: createExtensions(),
  });
}

let view = new EditorView({
  state: createState(textarea?.value || ""),
});

if (textarea?.parentNode) {
  textarea.parentNode.insertBefore(view.dom, textarea);
  textarea.style.display = "none";
}

function syncLegacyDomClasses() {
  view.dom.classList.add("CodeMirror");
  view.dom.CodeMirror = cm;
  view.scrollDOM.classList.add("CodeMirror-scroll");
  view.contentDOM.classList.add("CodeMirror-sizer");
  view.dom.querySelector(".cm-gutters")?.classList.add("CodeMirror-gutters");
  view.dom.querySelectorAll(".cm-gutterElement").forEach((el) => {
    el.classList.add("CodeMirror-linenumber");
  });
}

function updateScrollPastEndPadding() {
  const wrapper = cm.getWrapperElement();
  const scroller = view.scrollDOM || wrapper.querySelector(".CodeMirror-scroll");
  const sizer = view.contentDOM || wrapper.querySelector(".CodeMirror-sizer");
  if (!scroller || !sizer) return;

  const lineHeight = cm.defaultTextHeight();
  const extraBottom = Math.max(0, Math.round(scroller.clientHeight / 2 - lineHeight));
  sizer.style.paddingBottom = extraBottom + "px";
}

function dispatchSelection(anchor, head = anchor) {
  view.dispatch({
    selection: {
      anchor: posToIndex(anchor),
      head: posToIndex(head),
    },
    scrollIntoView: true,
  });
}

function dispatchChanges(changes, selection = null) {
  const spec = { changes };
  if (selection) spec.selection = selection;
  view.dispatch(spec);
}

function indentSelection(direction) {
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from).number - 1;
  const endLine = view.state.doc.lineAt(to).number - 1;
  const lines = [];

  for (let lineNo = startLine; lineNo <= endLine; lineNo += 1) {
    const line = cm.getLine(lineNo);
    lines.push(direction === "subtract" ? line.replace(/^ {1,2}/, "") : `  ${line}`);
  }

  const fromIndex = posToIndex({ line: startLine, ch: 0 });
  const toLine = lineInfoForNumber(endLine);
  const toIndex = toLine.from + toLine.length;
  const replacement = lines.join("\n");
  dispatchChanges(
    { from: fromIndex, to: toIndex, insert: replacement },
    EditorSelection.single(fromIndex, fromIndex + replacement.length),
  );
}

function scrollLineIntoView(line, margin = 0) {
  const top = cm.heightAtLine(line, "local");
  cm.scrollTo(null, Math.max(0, top - margin));
}

const docApi = {
  getCursor(which) { return cm.getCursor(which); },
  indexFromPos(pos) { return posToIndex(pos); },
  posFromIndex(index) { return indexToPos(index); },
  getRange(from, to) { return view.state.sliceDoc(posToIndex(from), posToIndex(to)); },
  replaceRange(text, from, to = from) { cm.replaceRange(text, from, to); },
  setSelection(from, to) { cm.setSelection(from, to); },
  setCursor(pos) { cm.setCursor(pos); },
  getLine(lineNo) { return cm.getLine(lineNo); },
  getValue() { return cm.getValue(); },
};

export const cm = {
  get state() { return view.state; },
  getValue() {
    return view.state.doc.toString();
  },
  setValue(text) {
    view.setState(createState(String(text ?? "")));
    syncLegacyDomClasses();
    requestAnimationFrame(() => {
      updateScrollPastEndPadding();
      emit("content-loaded");
    });
  },
  getDoc() {
    return docApi;
  },
  getCursor(which) {
    const main = view.state.selection.main;
    if (which === "from") return indexToPos(Math.min(main.anchor, main.head));
    if (which === "to") return indexToPos(Math.max(main.anchor, main.head));
    return indexToPos(main.head);
  },
  setCursor(posOrLine, ch = null) {
    if (typeof posOrLine === "number") {
      dispatchSelection({ line: posOrLine, ch: ch ?? 0 });
      return;
    }
    dispatchSelection(posOrLine || { line: 0, ch: 0 });
  },
  setSelection(from, to) {
    dispatchSelection(from, to);
  },
  getSelection() {
    const main = view.state.selection.main;
    return view.state.sliceDoc(main.from, main.to);
  },
  replaceSelection(text) {
    view.dispatch(view.state.replaceSelection(String(text ?? "")));
  },
  replaceRange(text, from, to = from) {
    dispatchChanges({
      from: posToIndex(from),
      to: posToIndex(to),
      insert: String(text ?? ""),
    });
  },
  lineCount() {
    return view.state.doc.lines;
  },
  lastLine() {
    return Math.max(0, view.state.doc.lines - 1);
  },
  getLine(lineNo) {
    if (lineNo < 0 || lineNo >= view.state.doc.lines) return "";
    return view.state.doc.line(lineNo + 1).text;
  },
  lineAtHeight(height) {
    const line = view.lineBlockAtHeight(Math.max(0, Number(height) || 0));
    return view.state.doc.lineAt(line.from).number - 1;
  },
  heightAtLine(lineNo) {
    return view.lineBlockAt(posToIndex({ line: lineNo, ch: 0 })).top;
  },
  cursorCoords(pos) {
    const rect = view.coordsAtPos(posToIndex(pos || cm.getCursor()));
    if (!rect) return { left: 0, right: 0, top: 0, bottom: 0 };
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  },
  scrollIntoView(pos, margin = 0) {
    const target = typeof pos === "number" ? indexToPos(pos) : pos;
    scrollLineIntoView(target?.line ?? 0, margin);
  },
  getScrollInfo() {
    return {
      left: view.scrollDOM.scrollLeft,
      top: view.scrollDOM.scrollTop,
      height: view.scrollDOM.scrollHeight,
      clientHeight: view.scrollDOM.clientHeight,
    };
  },
  scrollTo(x, y) {
    view.scrollDOM.scrollTo(
      x == null ? view.scrollDOM.scrollLeft : x,
      y == null ? view.scrollDOM.scrollTop : y,
    );
  },
  focus() {
    view.focus();
  },
  refresh() {
    syncLegacyDomClasses();
    requestAnimationFrame(updateScrollPastEndPadding);
  },
  getWrapperElement() {
    return view.dom;
  },
  getScrollerElement() {
    return view.scrollDOM;
  },
  defaultTextHeight() {
    return parseFloat(getComputedStyle(view.contentDOM).lineHeight) || 22;
  },
  on(type, fn) {
    onEvent(type, fn);
  },
  off(type, fn) {
    offEvent(type, fn);
  },
  operation(fn) {
    return fn();
  },
  getOption(name) {
    return options[name];
  },
  setOption(name, value) {
    if (name === "lineWrapping") {
      options.lineWrapping = !!value;
      view.dispatch({
        effects: lineWrappingCompartment.reconfigure(options.lineWrapping ? EditorView.lineWrapping : []),
      });
      return;
    }
    if (name === "extraKeys") {
      options.extraKeys = value || {};
    }
  },
  indentSelection(direction) {
    indentSelection(direction);
  },
  undo() {
    undo(view);
  },
  redo() {
    redo(view);
  },
};

view.scrollDOM.addEventListener("scroll", () => {
  emitEvent("scroll", cm);
});

window.addEventListener("resize", () => requestAnimationFrame(updateScrollPastEndPadding));
syncLegacyDomClasses();
requestAnimationFrame(updateScrollPastEndPadding);

export function captureEditorSnapshot() {
  const main = view.state.selection.main;
  return {
    content: cm.getValue(),
    selection: {
      anchor: indexToPos(main.anchor),
      head: indexToPos(main.head),
    },
    scroll: {
      left: view.scrollDOM.scrollLeft,
      top: view.scrollDOM.scrollTop,
    },
  };
}

export function restoreEditorSnapshot(snapshot = {}) {
  const content = typeof snapshot.content === "string" ? snapshot.content : "";
  view.setState(createState(content, snapshot.selection || null));
  syncLegacyDomClasses();
  requestAnimationFrame(() => {
    if (snapshot.scroll) cm.scrollTo(snapshot.scroll.left || 0, snapshot.scroll.top || 0);
    updateScrollPastEndPadding();
    emit("content-loaded");
  });
}

export const editor = {
  get value() { return cm.getValue(); },
  set value(v) { cm.setValue(v); },
  get scrollTop() { return cm.getScrollInfo().top; },
  set scrollTop(v) { cm.scrollTo(null, v); },
  get scrollHeight() { return cm.getScrollInfo().height; },
  get clientHeight() { return cm.getScrollInfo().clientHeight; },
};

export const status = document.getElementById("status");
export const previewContainer = document.getElementById("preview-container");

const loadingEl = document.getElementById("editor-loading");
const loadingText = loadingEl?.querySelector("span");

export function showLoading(msg) {
  if (!loadingEl) return;
  if (loadingText) loadingText.textContent = msg || "Loading...";
  loadingEl.style.display = "";
}

export function hideLoading() {
  if (loadingEl) loadingEl.style.display = "none";
}

export function toggleWrap() {
  const on = !cm.getOption("lineWrapping");
  cm.setOption("lineWrapping", on);
  requestAnimationFrame(updateScrollPastEndPadding);
  document.getElementById("btnToggleWrap")?.classList.toggle("active", on);
}
