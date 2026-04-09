// tab-bar.js — Multi-tab state and tab bar UI

import { cm, markdownMode } from './editor.js';
import { showContextMenu } from './context-menu.js';
import { canShowInFinder, showInFinder } from './platform.js';

// ── Tab state ───────────────────────────────────────────────────────────────

const tabs = [];      // [{ path, name, doc, savedContent, localFileModTime, dirty }]
let activeTabIdx = -1;

// ── DOM refs ────────────────────────────────────────────────────────────────

const tabBarTabs = document.getElementById("tabBarTabs");

// ── Callbacks ───────────────────────────────────────────────────────────────

let _onSwitch = null;   // called after tab switch (for render, outline, etc.)
let _onAllClosed = null; // called when last tab is closed
let _onSave = null;     // called to save a tab by index
let _onRefresh = null;  // called to reload a tab from disk
let _onBeforeSwap = null; // called before cm.swapDoc() so listeners can be cleaned up
let _onCloseRequest = null;
let _onCloseTabsToLeftRequest = null;
let _onCloseTabsToRightRequest = null;
let _onCloseAllTabsRequest = null;

export function onTabSwitch(fn) { _onSwitch = fn; }
export function onAllTabsClosed(fn) { _onAllClosed = fn; }
export function onTabSaveRequest(fn) { _onSave = fn; }
export function onTabRefreshRequest(fn) { _onRefresh = fn; }
export function onBeforeDocSwap(fn) { _onBeforeSwap = fn; }
export function onTabCloseRequest(fn) { _onCloseRequest = fn; }
export function onTabsToLeftCloseRequest(fn) { _onCloseTabsToLeftRequest = fn; }
export function onTabsToRightCloseRequest(fn) { _onCloseTabsToRightRequest = fn; }
export function onAllTabsCloseRequest(fn) { _onCloseAllTabsRequest = fn; }

// ── Public API ──────────────────────────────────────────────────────────────

export function openTab(path, name, content, modTime) {
  // If already open, switch to it
  const existing = tabs.findIndex(t => t.path && t.path === path);
  if (existing >= 0) {
    switchToTab(existing);
    return existing;
  }

  // Create new CodeMirror Doc
  const doc = CodeMirror.Doc(content || "", markdownMode);

  const tab = {
    path,          // null for unsaved new docs
    name,
    doc,
    savedContent: content || "",
    localFileModTime: modTime || 0,
    dirty: false,
  };

  tabs.push(tab);
  const idx = tabs.length - 1;
  switchToTab(idx);
  return idx;
}

export function closeTab(idx) {
  if (idx < 0 || idx >= tabs.length) return;

  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    activeTabIdx = -1;
    if (_onBeforeSwap) _onBeforeSwap();
    cm.swapDoc(CodeMirror.Doc("", markdownMode));
    renderTabBar();
    if (_onAllClosed) _onAllClosed();
    return;
  }

  // Adjust active index
  if (idx <= activeTabIdx) {
    activeTabIdx = Math.max(0, activeTabIdx - 1);
  }
  switchToTab(activeTabIdx);
}

export function closeActiveTab() {
  if (activeTabIdx >= 0) closeTab(activeTabIdx);
}

export function closeTabsToRight(idx) {
  if (idx < 0 || idx >= tabs.length - 1) return;
  tabs.splice(idx + 1);
  if (activeTabIdx > idx) activeTabIdx = idx;
  switchToTab(Math.min(activeTabIdx, tabs.length - 1));
}

export function closeTabsToLeft(idx) {
  if (idx <= 0 || idx >= tabs.length) return;
  tabs.splice(0, idx);
  const newActive = activeTabIdx < idx ? 0 : activeTabIdx - idx;
  activeTabIdx = 0; // will be set by switchToTab
  switchToTab(Math.max(0, newActive));
}

export function closeAllTabs() {
  tabs.splice(0);
  activeTabIdx = -1;
  if (_onBeforeSwap) _onBeforeSwap();
  cm.swapDoc(CodeMirror.Doc("", markdownMode));
  renderTabBar();
  if (_onAllClosed) _onAllClosed();
}

export function switchToTab(idx) {
  if (idx < 0 || idx >= tabs.length) return;

  // Save scroll position of current tab before switching
  if (activeTabIdx >= 0 && activeTabIdx < tabs.length) {
    tabs[activeTabIdx].scrollPos = cm.getScrollInfo();
  }

  activeTabIdx = idx;
  const tab = tabs[idx];
  if (_onBeforeSwap) _onBeforeSwap();
  cm.swapDoc(tab.doc);
  cm.refresh();

  // Restore scroll position
  if (tab.scrollPos) {
    setTimeout(() => cm.scrollTo(tab.scrollPos.left, tab.scrollPos.top), 0);
  }

  renderTabBar();
  if (_onSwitch) _onSwitch(tab);
}

export function getActiveTab() {
  if (activeTabIdx < 0 || activeTabIdx >= tabs.length) return null;
  return tabs[activeTabIdx];
}

export function getActiveTabIdx() { return activeTabIdx; }
export function getTabs() { return [...tabs]; }
export function getTabCount() { return tabs.length; }

export function markActiveTabDirty() {
  const tab = getActiveTab();
  if (!tab || tab.dirty) return;
  tab.dirty = true;
  renderTabBar();
}

export function markActiveTabClean(newSavedContent, modTime) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.dirty = false;
  tab.savedContent = newSavedContent;
  if (modTime !== undefined) tab.localFileModTime = modTime;
  renderTabBar();
}

export function updateActiveTabPath(path, name) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.path = path;
  tab.name = name;
  renderTabBar();
}

export function isActiveTabDirty() {
  const tab = getActiveTab();
  return tab ? tab.dirty : false;
}

export function hasOpenTabs() {
  return tabs.length > 0;
}

// Find tab by path (for sidebar highlight)
export function findTabByPath(path) {
  return tabs.findIndex(t => t.path === path);
}

function requestCloseTab(idx) {
  if (_onCloseRequest) return _onCloseRequest(idx);
  return closeTab(idx);
}

function requestCloseTabsToLeft(idx) {
  if (_onCloseTabsToLeftRequest) return _onCloseTabsToLeftRequest(idx);
  return closeTabsToLeft(idx);
}

function requestCloseTabsToRight(idx) {
  if (_onCloseTabsToRightRequest) return _onCloseTabsToRightRequest(idx);
  return closeTabsToRight(idx);
}

function requestCloseAllTabs() {
  if (_onCloseAllTabsRequest) return _onCloseAllTabsRequest();
  return closeAllTabs();
}

// ── Tab bar rendering ───────────────────────────────────────────────────────

export function renderTabBar() {
  if (!tabBarTabs) return;
  tabBarTabs.innerHTML = "";

  tabs.forEach((tab, i) => {
    const el = document.createElement("div");
    el.className = "tab" + (i === activeTabIdx ? " active" : "");
    el.onclick = (e) => {
      if (e.target.classList.contains("tab-close")) return;
      switchToTab(i);
    };

    const nameSpan = document.createElement("span");
    nameSpan.className = "tab-name";
    nameSpan.textContent = tab.name || "Untitled";
    el.appendChild(nameSpan);

    const indicator = document.createElement("span");
    indicator.className = "tab-indicator";

    if (tab.dirty) {
      const dot = document.createElement("span");
      dot.className = "tab-dirty-dot";
      indicator.appendChild(dot);
    }

    const closeBtn = document.createElement("span");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      requestCloseTab(i);
    };
    indicator.appendChild(closeBtn);

    el.appendChild(indicator);

    // Middle-click to close
    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) { e.preventDefault(); requestCloseTab(i); }
    });

    // Right-click context menu
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTabContextMenu(e.clientX, e.clientY, i);
    });

    tabBarTabs.appendChild(el);
  });
}

// ── Tab context menu ────────────────────────────────────────────────────────

function showTabContextMenu(x, y, tabIdx) {
  const tab = tabs[tabIdx];
  showContextMenu(x, y, [
    { label: "Save", disabled: !tab.dirty, action: () => { if (_onSave) { switchToTab(tabIdx); _onSave(); } } },
    { label: "Refresh from Disk", disabled: !tab.path, action: () => { if (_onRefresh) { switchToTab(tabIdx); _onRefresh(tab); } } },
    { separator: true },
    { label: "Close", action: () => requestCloseTab(tabIdx) },
    { label: "Close Tabs to the Left", disabled: tabIdx === 0, action: () => requestCloseTabsToLeft(tabIdx) },
    { label: "Close Tabs to the Right", disabled: tabIdx >= tabs.length - 1, action: () => requestCloseTabsToRight(tabIdx) },
    { label: "Close All", action: () => requestCloseAllTabs() },
    { separator: true },
    { label: "Copy Path", disabled: !tab.path, action: () => tab.path && navigator.clipboard.writeText(tab.path) },
    { label: "Show in Finder", disabled: !tab.path || !canShowInFinder, action: () => tab.path && showInFinder(tab.path) },
  ]);
}

// ── Session persistence helpers ─────────────────────────────────────────────

export function getSessionState() {
  return {
    openTabs: tabs.map(t => ({ path: t.path, name: t.name })),
    activeTab: activeTabIdx >= 0 ? tabs[activeTabIdx]?.path || tabs[activeTabIdx]?.name : null,
  };
}
