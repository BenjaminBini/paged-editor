import { cm } from '../../editor/codemirror-editor.js';
import { scalePreview, getPreviewFrame } from '../../document/render-scheduler.js';

// ── Resize handle ────────────────────────────────────────────────────
const handle = document.getElementById("resizeHandle");
const editorPane = document.getElementById("editorPane");
const previewPane = document.getElementById("previewPane");
const fileSidebar = document.getElementById("fileSidebar");
let isResizing = false;

handle.addEventListener("mousedown", e => {
  isResizing = true;
  handle.classList.add("active");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  const frame = getPreviewFrame();
  if (frame) frame.style.pointerEvents = "none";
  e.preventDefault();
});
document.addEventListener("mousemove", e => {
  if (!isResizing) return;
  const sidebarW = fileSidebar.classList.contains("open") ? fileSidebar.offsetWidth : 0;
  const availW = editorPane.parentElement.offsetWidth - sidebarW;
  const editorX = e.clientX - sidebarW;
  const pct = (editorX / availW) * 100;
  const clamped = Math.max(20, Math.min(80, pct));
  editorPane.style.flex = "none";
  previewPane.style.flex = "none";
  editorPane.style.width = (clamped / 100 * availW) + "px";
  previewPane.style.width = ((100 - clamped) / 100 * availW) + "px";
});
document.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    handle.classList.remove("active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    const frame = getPreviewFrame();
    if (frame) frame.style.pointerEvents = "";
    cm.refresh();
    scalePreview();
  }
});
