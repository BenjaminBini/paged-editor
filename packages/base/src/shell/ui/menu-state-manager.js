// menu-state.js — Menu bar initialization, button state management, welcome screen.

import { cm } from "../../editor/codemirror-editor.js";

// ── Welcome screen ─────────────────────────────────────────────────────────

const welcomeScreen = document.getElementById("welcomeScreen");

export function hideWelcome() {
  if (welcomeScreen) {
    welcomeScreen.classList.remove("loading");
    welcomeScreen.classList.add("hidden");
  }
}

export function showWelcome() {
  if (welcomeScreen) {
    welcomeScreen.classList.remove("loading");
    welcomeScreen.classList.remove("hidden");
  }
}

// ── Desktop-style menu bar ─────────────────────────────────────────────────

export function initMenubar() {
  const menubar = document.querySelector(".menubar");
  if (!menubar) return;

  const backdrop = document.createElement("div");
  backdrop.className = "menu-backdrop";
  document.body.appendChild(backdrop);

  let openMenu = null;

  function openItem(item) {
    if (openMenu === item) return;
    closeAll();
    item.classList.add("open");
    backdrop.classList.add("active");
    openMenu = item;
  }

  function closeAll() {
    if (openMenu) openMenu.classList.remove("open");
    backdrop.classList.remove("active");
    openMenu = null;
  }

  menubar.querySelectorAll(".menu-trigger").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = trigger.closest(".menu-item");
      if (openMenu === item) {
        closeAll();
      } else {
        openItem(item);
      }
    });
  });

  menubar.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      if (openMenu && openMenu !== item) openItem(item);
    });
  });

  menubar.querySelectorAll(".menu-dropdown button").forEach((btn) => {
    btn.addEventListener("click", () => closeAll());
  });

  backdrop.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openMenu) closeAll();
  });
}

// ── Menu state (enable/disable buttons based on app state) ─────────────────

export function updateMenuState(getActiveTab, hasOpenTabs, getFolderPath) {
  const activeTab = getActiveTab();
  const hasContent = !!cm.getValue();
  const hasRenderableContent = hasContent || activeTab?.kind === "cover" || activeTab?.kind === "toc";
  const hasFile = hasOpenTabs();
  const hasFolder = !!getFolderPath();
  const canSave = hasFile && !activeTab?.readOnly;
  const canSaveAs = hasContent && !activeTab?.readOnly && activeTab?.kind !== "cover";
  const canEdit = hasFile
    && !activeTab?.readOnly
    && !activeTab?.editorDisabled
    && (!activeTab?.kind || activeTab.kind === "file");

  const set = (id, enabled) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  };

  set("btnOpenLocal", true);
  set("btnOpenFolder", true);
  set("welcomeOpenLocal", true);
  set("welcomeOpenFolder", true);
  set("btnSave", canSave);
  set("btnSaveAs", canSaveAs);
  set("btnCloseFile", hasFile);
  set("btnCloseFolder", hasFolder);

  set("btnInsertTable", canEdit);
  set("btnUndo", canEdit);
  set("btnRedo", canEdit);
  set("btnFmtBold", canEdit);
  set("btnFmtItalic", canEdit);
  set("btnFmtUnderline", canEdit);
  set("btnFmtHeading", canEdit);
  set("btnFmtSymbol", canEdit);
  set("btnFmtTable", canEdit);
  set("btnFmtImage", canEdit);
  set("btnFmtMermaid", canEdit);
  set("btnRender", hasRenderableContent);
  set("btnPreviewTab", hasRenderableContent);
  set("btnDownloadPdf", hasRenderableContent);
  set("btnDownloadMemoire", hasFolder);
  set("btnDownloadMemoire2", hasFolder);
  set("btnToggleWrap", true);

  updatePdfButtonLabel(getActiveTab);
}

function updatePdfButtonLabel(getActiveTab) {
  const tab = getActiveTab();
  if (tab?.kind === "cover" || tab?.kind === "toc") {
    const label = tab.kind === "cover" ? "Export PDF Cover" : "Export PDF TOC";
    const toolbarBtn = document.querySelector('.pdf-download-btn:not(.memoire-btn)');
    if (toolbarBtn) {
      const textNode = Array.from(toolbarBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (textNode) textNode.textContent = `\n              ${label}\n            `;
    }
    const menuBtn = document.getElementById('btnDownloadPdf');
    if (menuBtn) {
      const span = menuBtn.querySelector('.menu-label');
      if (span) span.textContent = label;
    }
    return;
  }
  const fnMatch = tab?.name?.match(/^(\d+)/);
  const num = fnMatch ? fnMatch[1] : "N";
  const label = `Export PDF Partie ${num}`;
  const toolbarBtn = document.querySelector('.pdf-download-btn:not(.memoire-btn)');
  if (toolbarBtn) {
    const textNode = Array.from(toolbarBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (textNode) textNode.textContent = `\n              ${label}\n            `;
  }
  const menuBtn = document.getElementById('btnDownloadPdf');
  if (menuBtn) {
    const span = menuBtn.querySelector('.menu-label');
    if (span) span.textContent = label;
  }
}
