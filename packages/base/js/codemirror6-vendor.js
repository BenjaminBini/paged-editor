export { Compartment, EditorSelection, EditorState } from "@codemirror/state";
export {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
export {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
  undo,
} from "@codemirror/commands";
export {
  LanguageDescription,
  defaultHighlightStyle,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
export { css } from "@codemirror/lang-css";
export { html } from "@codemirror/lang-html";
export { javascript } from "@codemirror/lang-javascript";
export { markdown } from "@codemirror/lang-markdown";
export { searchKeymap } from "@codemirror/search";
export { tags } from "@lezer/highlight";
