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

/**
 * Show a context menu at (x, y) with the given items.
 * Each item is { label, action, disabled?, separator? }.
 */
export function showContextMenu(x: number, y: number, items: Array<{ label?: string; action?: () => void; disabled?: boolean; separator?: boolean }>): void {
  const menu = getOrCreateMenu();
  menu.innerHTML = "";

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
        action();
      });
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
