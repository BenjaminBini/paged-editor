// editor.js — CodeMirror editor module
// CodeMirror and marked are globals loaded via <script> tags.

// ── CodeMirror instance ───────────────────────────────────────────────────────

export const cm = CodeMirror.fromTextArea(document.getElementById("editor-textarea"), {
  mode: "markdown",
  lineNumbers: true,
  lineWrapping: true,
  tabSize: 2,
  indentWithTabs: false,
  theme: "default",
  gutters: ["CodeMirror-linenumbers"],
});

// ── Content-loaded event ─────────────────────────────────────────────────────
// Emitted after setValue or swapDoc so interested modules can react.

import { emit } from "./event-bus.js";

const _cmSetValue = cm.setValue.bind(cm);
cm.setValue = function (v) {
  _cmSetValue(v);
  setTimeout(() => emit("content-loaded"), 0);
};

// ── Compatibility shim ────────────────────────────────────────────────────────

export const editor = {
  get value()        { return cm.getValue(); },
  set value(v)       { cm.setValue(v); },
  get scrollTop()    { return cm.getScrollInfo().top; },
  set scrollTop(v)   { cm.scrollTo(null, v); },
  get scrollHeight() { return cm.getScrollInfo().height; },
  get clientHeight() { return cm.getScrollInfo().clientHeight; },
};

// ── DOM references ────────────────────────────────────────────────────────────

export const status           = document.getElementById("status");
export const previewContainer = document.getElementById("preview-container");

// ── Loading spinner ───────────────────────────────────────────────────────────

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

// ── Wrap toggle ───────────────────────────────────────────────────────────────

export function toggleWrap() {
  const on = !cm.getOption("lineWrapping");
  cm.setOption("lineWrapping", on);
  document.getElementById("btnWrap").classList.toggle("active", on);
}
