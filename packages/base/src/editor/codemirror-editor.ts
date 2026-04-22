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
} from "../../assets/codemirror6.bundle.js";
import { emit } from "../infrastructure/event-bus.js";
import { mdDecorations } from "./editor-decorations.js";
import { styleBlockHighlight } from "./style-block-highlight.js";

export const markdownMode = {
  name: "markdown",
  fencedCodeBlockHighlighting: true,
  tokenTypeOverrides: { code: "code" },
};

const textarea = document.getElementById("editor-textarea") as HTMLTextAreaElement | null;
const lineWrappingCompartment = new Compartment();
const editableCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
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

const eventListeners: Map<string, Set<(...args: any[]) => any>> = new Map();
const options: { lineWrapping: boolean; extraKeys: Record<string, any>; readOnly: boolean } = {
  lineWrapping: true,
  extraKeys: {},
  readOnly: false,
};

function onEvent(type: string, fn: (...args: any[]) => any): void {
  if (!eventListeners.has(type)) eventListeners.set(type, new Set());
  eventListeners.get(type)!.add(fn);
}

function offEvent(type: string, fn: (...args: any[]) => any): void {
  eventListeners.get(type)?.delete(fn);
}

function emitEvent(type: string, ...args: any[]): void {
  for (const fn of eventListeners.get(type) || []) fn(...args);
}

function normalizeKeyName(key: string): string {
  if (key === "Esc") return "Escape";
  if (key === "Space") return " ";
  if (key.length === 1) return key.toLowerCase();
  return key;
}

function matchesKeySpec(event: KeyboardEvent, spec: string): boolean {
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

function createExtraKeysHandler(): any {
  return EditorView.domEventHandlers({
    keydown(_view: any, event: KeyboardEvent) {
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

function createExtensions(): any[] {
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
    mdDecorations,
    styleBlockHighlight,
    lineWrappingCompartment.of(options.lineWrapping ? EditorView.lineWrapping : []),
    editableCompartment.of(EditorView.editable.of(!options.readOnly)),
    readOnlyCompartment.of(EditorState.readOnly.of(options.readOnly)),
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
    EditorView.updateListener.of((update: any) => {
      syncLegacyDomClasses();
      emitEvent("update", cm, update);
      if (update.docChanged) emitEvent("change", cm, update);
      if (update.selectionSet || update.docChanged) emitEvent("cursorActivity", cm, update);
      requestAnimationFrame(updateScrollPastEndPadding);
    }),
  ];
}

function lineInfoForNumber(lineNo: number): any {
  const line = Math.min(Math.max(0, Number(lineNo) || 0), view.state.doc.lines - 1) + 1;
  return view.state.doc.line(line);
}

function posToIndex(pos = { line: 0, ch: 0 }): number {
  const line: any = lineInfoForNumber(pos.line);
  const ch = Math.max(0, Math.min(Number(pos.ch) || 0, line.length));
  return line.from + ch;
}

function indexToPos(index: number): { line: number; ch: number } {
  const bounded = Math.max(0, Math.min(Number(index) || 0, view.state.doc.length));
  const line = view.state.doc.lineAt(bounded);
  return { line: line.number - 1, ch: bounded - line.from };
}

function selectionForState(selection: any): any {
  if (!selection) return undefined;
  return EditorSelection.single(
    posToIndex(selection.anchor || { line: 0, ch: 0 }),
    posToIndex(selection.head || selection.anchor || { line: 0, ch: 0 }),
  );
}

// Like selectionForState, but resolves {line, ch} against an explicit Text
// (the doc being built) instead of the live view.state.doc. Used when creating
// a fresh state for a different document — e.g. switching tabs — where indices
// computed against the previous (longer) doc would overrun the new one and
// trigger CodeMirror's "Selection points outside of document" guard.
function selectionForDoc(selection: any, doc: any): any {
  if (!selection) return undefined;
  const toIndex = (pos: { line?: number; ch?: number } = {}): number => {
    const lineNo = Math.min(Math.max(0, Number(pos.line) || 0), doc.lines - 1) + 1;
    const line = doc.line(lineNo);
    const ch = Math.max(0, Math.min(Number(pos.ch) || 0, line.length));
    return line.from + ch;
  };
  return EditorSelection.single(
    toIndex(selection.anchor || { line: 0, ch: 0 }),
    toIndex(selection.head || selection.anchor || { line: 0, ch: 0 }),
  );
}

function createState(docText: string = "", selection: any = null): any {
  const base = EditorState.create({ doc: docText });
  return EditorState.create({
    doc: base.doc,
    selection: selectionForDoc(selection, base.doc),
    extensions: createExtensions(),
  });
}

let view: any = new EditorView({
  state: createState(textarea?.value || ""),
});

if (textarea?.parentNode) {
  textarea.parentNode.insertBefore(view.dom, textarea);
  textarea.style.display = "none";
}

function syncLegacyDomClasses(): void {
  view.dom.classList.add("CodeMirror");
  view.dom.CodeMirror = cm;
  view.scrollDOM.classList.add("CodeMirror-scroll");
  view.contentDOM.classList.add("CodeMirror-sizer");
  view.dom.querySelector(".cm-gutters")?.classList.add("CodeMirror-gutters");
  view.dom.querySelectorAll(".cm-gutterElement").forEach((el: Element) => {
    el.classList.add("CodeMirror-linenumber");
  });
}

function updateScrollPastEndPadding(): void {
  const wrapper = cm.getWrapperElement();
  const scroller = view.scrollDOM || wrapper.querySelector(".CodeMirror-scroll");
  const sizer = view.contentDOM || wrapper.querySelector(".CodeMirror-sizer");
  if (!scroller || !sizer) return;

  const lineHeight = cm.defaultTextHeight();
  const extraBottom = Math.max(0, Math.round(scroller.clientHeight / 2 - lineHeight));
  sizer.style.paddingBottom = extraBottom + "px";
}

function dispatchSelection(anchor: any, head: any = anchor): void {
  view.dispatch({
    selection: {
      anchor: posToIndex(anchor),
      head: posToIndex(head),
    },
    scrollIntoView: true,
  });
}

function dispatchChanges(changes: any, selection: any = null): void {
  const spec: { changes: any; selection?: any } = { changes };
  if (selection) spec.selection = selection;
  view.dispatch(spec);
}

function indentSelection(direction: string): void {
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

function scrollLineIntoView(line: number, margin = 0): void {
  const top = cm.heightAtLine(line);
  cm.scrollTo(null, Math.max(0, top - margin));
}

const docApi = {
  getCursor(which: string): { line: number; ch: number } { return cm.getCursor(which); },
  indexFromPos(pos: any): number { return posToIndex(pos); },
  posFromIndex(index: number): { line: number; ch: number } { return indexToPos(index); },
  getRange(from: any, to: any): string { return view.state.sliceDoc(posToIndex(from), posToIndex(to)); },
  replaceRange(text: string, from: any, to: any = from): void { cm.replaceRange(text, from, to); },
  setSelection(from: any, to: any): void { cm.setSelection(from, to); },
  setCursor(pos: any): void { cm.setCursor(pos); },
  getLine(lineNo: number): string { return cm.getLine(lineNo); },
  getValue(): string { return cm.getValue(); },
};

export const cm = {
  get state(): any { return view.state; },
  getValue(): string {
    return view.state.doc.toString();
  },
  setValue(text: any): void {
    view.setState(createState(String(text ?? "")));
    syncLegacyDomClasses();
    requestAnimationFrame(() => {
      updateScrollPastEndPadding();
      emit("content-loaded");
    });
  },
  getDoc(): typeof docApi {
    return docApi;
  },
  getCursor(which?: string): { line: number; ch: number } {
    const main = view.state.selection.main;
    if (which === "from") return indexToPos(Math.min(main.anchor, main.head));
    if (which === "to") return indexToPos(Math.max(main.anchor, main.head));
    return indexToPos(main.head);
  },
  setCursor(posOrLine: any, ch: number | null = null): void {
    if (typeof posOrLine === "number") {
      dispatchSelection({ line: posOrLine, ch: ch ?? 0 });
      return;
    }
    dispatchSelection(posOrLine || { line: 0, ch: 0 });
  },
  setSelection(from: any, to: any): void {
    dispatchSelection(from, to);
  },
  getSelection(): string {
    const main = view.state.selection.main;
    return view.state.sliceDoc(main.from, main.to);
  },
  replaceSelection(text: any): void {
    view.dispatch(view.state.replaceSelection(String(text ?? "")));
  },
  replaceRange(text: any, from: any, to: any = from): void {
    dispatchChanges({
      from: posToIndex(from),
      to: posToIndex(to),
      insert: String(text ?? ""),
    });
  },
  lineCount(): number {
    return view.state.doc.lines;
  },
  lastLine(): number {
    return Math.max(0, view.state.doc.lines - 1);
  },
  getLine(lineNo: number): string {
    if (lineNo < 0 || lineNo >= view.state.doc.lines) return "";
    return view.state.doc.line(lineNo + 1).text;
  },
  lineAtHeight(height: number, _mode?: string): number {
    const line = view.lineBlockAtHeight(Math.max(0, Number(height) || 0));
    return view.state.doc.lineAt(line.from).number - 1;
  },
  heightAtLine(lineNo: number): number {
    return view.lineBlockAt(posToIndex({ line: lineNo, ch: 0 })).top;
  },
  cursorCoords(pos: any): { left: number; right: number; top: number; bottom: number } {
    const rect = view.coordsAtPos(posToIndex(pos || cm.getCursor()));
    if (!rect) return { left: 0, right: 0, top: 0, bottom: 0 };
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  },
  scrollIntoView(pos: any, margin = 0): void {
    const target = typeof pos === "number" ? indexToPos(pos) : pos;
    scrollLineIntoView(target?.line ?? 0, margin);
  },
  getScrollInfo(): { left: number; top: number; height: number; clientHeight: number } {
    return {
      left: view.scrollDOM.scrollLeft,
      top: view.scrollDOM.scrollTop,
      height: view.scrollDOM.scrollHeight,
      clientHeight: view.scrollDOM.clientHeight,
    };
  },
  scrollTo(x: number | null, y: number | null): void {
    view.scrollDOM.scrollTo(
      x == null ? view.scrollDOM.scrollLeft : x,
      y == null ? view.scrollDOM.scrollTop : y,
    );
  },
  focus(): void {
    view.focus();
  },
  refresh(): void {
    syncLegacyDomClasses();
    requestAnimationFrame(updateScrollPastEndPadding);
  },
  getWrapperElement(): any {
    return view.dom;
  },
  getScrollerElement(): any {
    return view.scrollDOM;
  },
  defaultTextHeight(): number {
    return parseFloat(getComputedStyle(view.contentDOM).lineHeight) || 22;
  },
  on(type: string, fn: (...args: any[]) => any): void {
    onEvent(type, fn);
  },
  off(type: string, fn: (...args: any[]) => any): void {
    offEvent(type, fn);
  },
  operation(fn: () => any): any {
    return fn();
  },
  getOption(name: string): any {
    return (options as Record<string, any>)[name];
  },
  setOption(name: string, value: any): void {
    if (name === "lineWrapping") {
      options.lineWrapping = !!value;
      view.dispatch({
        effects: lineWrappingCompartment.reconfigure(options.lineWrapping ? EditorView.lineWrapping : []),
      });
      return;
    }
    if (name === "extraKeys") {
      options.extraKeys = value || {};
      return;
    }
    if (name === "readOnly") {
      setEditorReadOnly(value);
    }
  },
  indentSelection(direction: string): void {
    indentSelection(direction);
  },
  undo(): void {
    undo(view);
  },
  redo(): void {
    redo(view);
  },
};

view.scrollDOM.addEventListener("scroll", () => {
  emitEvent("scroll", cm);
});

window.addEventListener("resize", () => requestAnimationFrame(updateScrollPastEndPadding));
syncLegacyDomClasses();
requestAnimationFrame(updateScrollPastEndPadding);

export function setEditorReadOnly(value: boolean): void {
  options.readOnly = !!value;
  view.dispatch({
    effects: [
      editableCompartment.reconfigure(EditorView.editable.of(!options.readOnly)),
      readOnlyCompartment.reconfigure(EditorState.readOnly.of(options.readOnly)),
    ],
  });
}

export function captureEditorSnapshot(): { content: string; selection: { anchor: { line: number; ch: number }; head: { line: number; ch: number } }; scroll: { left: number; top: number } } {
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

export function restoreEditorSnapshot(snapshot: { content?: string; selection?: any; scroll?: { left: number; top: number } } = {}): void {
  const content = typeof snapshot.content === "string" ? snapshot.content : "";
  view.setState(createState(content, snapshot.selection || null));
  syncLegacyDomClasses();
  requestAnimationFrame(() => {
    hideLoading();
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

export const status: HTMLElement | null = document.getElementById("status");
export const previewContainer: HTMLElement | null = document.getElementById("preview-container");

const loadingEl: HTMLElement | null = document.getElementById("editor-loading");
const loadingText: Element | null = loadingEl?.querySelector("span") ?? null;

export function showLoading(msg: string): void {
  if (!loadingEl) return;
  if (loadingText) loadingText.textContent = msg || "Loading...";
  loadingEl.style.display = "";
}

export function hideLoading(): void {
  if (loadingEl) loadingEl.style.display = "none";
}

export function toggleWrap(): void {
  const on = !cm.getOption("lineWrapping");
  cm.setOption("lineWrapping", on);
  // CM6 needs two rAF ticks to fully relayout wrapped lines before
  // scroll sync can measure correct line heights.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updateScrollPastEndPadding();
      emit("editor-layout-changed");
    });
  });
  document.getElementById("btnToggleWrap")?.classList.toggle("active", on);
  document.getElementById("btnWrap")?.classList.toggle("active", on);
}

const editorPane: HTMLElement | null = document.getElementById("editorPane");
const editorWrapper: HTMLElement | null = document.getElementById("editor-wrapper");
let editorModeOverlay: HTMLDivElement | null = null;

export function setEditorPaneMode(mode = "default", message = ""): void {
  const disabled = mode === "disabled";
  if (editorPane) editorPane.classList.toggle("editor-pane-disabled", disabled);
  setEditorReadOnly(disabled);

  if (!editorWrapper) return;

  if (!editorModeOverlay) {
    editorModeOverlay = document.createElement("div");
    editorModeOverlay.className = "editor-pane-overlay";
    editorModeOverlay.hidden = true;
    editorModeOverlay.style.display = "none";
    editorWrapper.appendChild(editorModeOverlay);
  }

  editorModeOverlay.textContent = message || "";
  editorModeOverlay.hidden = !disabled;
  editorModeOverlay.style.display = disabled ? "flex" : "none";
  editorModeOverlay.style.pointerEvents = disabled ? "auto" : "none";
}
