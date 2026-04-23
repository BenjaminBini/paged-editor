// context-menu.js — Shared context menu renderer for tab bar and file sidebar.

let _menu: HTMLDivElement | null = null;

function getOrCreateMenu(): HTMLDivElement {
  if (_menu) return _menu;
  _menu = document.createElement("div");
  _menu.className = "tab-context-menu";
  _menu.style.display = "none";
  document.body.appendChild(_menu);

  const menu = _menu;
  document.addEventListener("mousedown", (e) => {
    if (!menu.contains(e.target as Node)) menu.style.display = "none";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") menu.style.display = "none";
  });
  return _menu;
}

// Floating tooltip that shows a preview next to the hovered menu item.
let _preview: HTMLDivElement | null = null;
function getOrCreatePreview(): HTMLDivElement {
  if (_preview) return _preview;
  _preview = document.createElement("div");
  _preview.className = "tab-ctx-preview";
  _preview.style.display = "none";
  document.body.appendChild(_preview);
  return _preview;
}

function showPreview(anchor: HTMLElement, html: string): void {
  const pv = getOrCreatePreview();
  pv.innerHTML = html;
  pv.style.display = "block";
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = pv.offsetWidth;
  const ph = pv.offsetHeight;
  // Prefer right-of-anchor; fall back to left if it overflows.
  let left = rect.right + 8;
  if (left + pw > vw) left = Math.max(4, rect.left - pw - 8);
  let top = rect.top;
  if (top + ph > vh) top = Math.max(4, vh - ph - 4);
  pv.style.left = `${left}px`;
  pv.style.top = `${top}px`;
}

function hidePreview(): void {
  if (_preview) _preview.style.display = "none";
}

/**
 * Show a context menu at (x, y) with the given items.
 * Each item is { label, action, disabled?, separator?, preview? }.
 * `preview` is raw HTML shown in a floating tooltip on hover.
 */
export function showContextMenu(
  x: number,
  y: number,
  items: Array<{
    label?: string;
    action?: () => void;
    disabled?: boolean;
    separator?: boolean;
    preview?: string;
  }>,
): void {
  const menu = getOrCreateMenu();
  menu.innerHTML = "";
  hidePreview();

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement("div");
      sep.className = "tab-ctx-separator";
      menu.appendChild(sep);
      continue;
    }
    const el = document.createElement("div");
    el.className = "tab-ctx-item" + (item.disabled ? " disabled" : "");
    el.textContent = item.label ?? "";
    if (!item.disabled && item.action) {
      const action = item.action;
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        menu.style.display = "none";
        hidePreview();
        action();
      });
    }
    if (item.preview) {
      const preview = item.preview;
      el.addEventListener("mouseenter", () => showPreview(el, preview));
      el.addEventListener("mouseleave", hidePreview);
    } else {
      el.addEventListener("mouseenter", hidePreview);
    }
    menu.appendChild(el);
  }

  menu.style.display = "block";
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  menu.style.left = (x + mw > vw ? vw - mw - 4 : x) + "px";
  menu.style.top  = (y + mh > vh ? vh - mh - 4 : y) + "px";
}

// Hide the preview when the menu closes (clicked outside).
document.addEventListener("mousedown", (e) => {
  const preview = _preview;
  const menu = _menu;
  if (!preview || preview.style.display === "none") return;
  if (menu?.contains(e.target as Node)) return;
  if (preview.contains(e.target as Node)) return;
  hidePreview();
});
