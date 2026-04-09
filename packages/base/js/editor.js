// editor.js — CodeMirror editor module
// CodeMirror and marked are globals loaded via <script> tags.

// ── CodeMirror instance ───────────────────────────────────────────────────────

export const markdownMode = {
  name: "markdown",
  fencedCodeBlockHighlighting: true,
  tokenTypeOverrides: { code: "code" },
};

export const cm = CodeMirror.fromTextArea(document.getElementById("editor-textarea"), {
  mode: markdownMode,
  lineNumbers: true,
  lineWrapping: true,
  tabSize: 2,
  indentWithTabs: false,
  theme: "default",
  gutters: ["CodeMirror-linenumbers"],
});

function updateScrollPastEndPadding() {
  const wrapper = cm.getWrapperElement();
  const scroller = wrapper.querySelector(".CodeMirror-scroll");
  const sizer = wrapper.querySelector(".CodeMirror-sizer");
  if (!scroller || !sizer) return;

  const lineHeight = cm.defaultTextHeight
    ? cm.defaultTextHeight()
    : parseFloat(getComputedStyle(wrapper).lineHeight) || 0;
  const extraBottom = Math.max(0, Math.round(scroller.clientHeight / 2 - lineHeight));
  sizer.style.paddingBottom = extraBottom + "px";
}

// ── Content-loaded event ─────────────────────────────────────────────────────
// Emitted after setValue or swapDoc so interested modules can react.

import { emit } from "./event-bus.js";

const _cmSetValue = cm.setValue.bind(cm);
cm.setValue = function (v) {
  _cmSetValue(v);
  requestAnimationFrame(() => {
    updateScrollPastEndPadding();
    emit("content-loaded");
  });
};

const _cmRefresh = cm.refresh.bind(cm);
cm.refresh = function () {
  const result = _cmRefresh();
  requestAnimationFrame(updateScrollPastEndPadding);
  return result;
};

cm.on("update", updateScrollPastEndPadding);
window.addEventListener("resize", () => requestAnimationFrame(updateScrollPastEndPadding));
requestAnimationFrame(updateScrollPastEndPadding);

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
  requestAnimationFrame(updateScrollPastEndPadding);
  document.getElementById("btnWrap").classList.toggle("active", on);
}
