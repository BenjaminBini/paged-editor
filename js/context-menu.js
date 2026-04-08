// context-menu.js — Shared context menu renderer for tab bar and file sidebar.

let _menu = null;

function getOrCreateMenu() {
  if (_menu) return _menu;
  _menu = document.createElement("div");
  _menu.className = "tab-context-menu";
  _menu.style.display = "none";
  document.body.appendChild(_menu);

  document.addEventListener("mousedown", (e) => {
    if (!_menu.contains(e.target)) _menu.style.display = "none";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") _menu.style.display = "none";
  });
  return _menu;
}

/**
 * Show a context menu at (x, y) with the given items.
 * Each item is { label, action, disabled?, separator? }.
 */
export function showContextMenu(x, y, items) {
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
    el.textContent = item.label;
    if (!item.disabled) {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        menu.style.display = "none";
        item.action();
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
