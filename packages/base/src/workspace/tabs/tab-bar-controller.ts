// tab-bar.js — Multi-tab state and tab bar UI

import { captureEditorSnapshot, cm, restoreEditorSnapshot, setEditorReadOnly } from "../../editor/codemirror-editor.js";
import { showContextMenu } from "../../shell/ui/context-menu.js";
import { canShowInFinder, showInFinder } from "../../infrastructure/platform-adapter.js";

type Tab = { path: string; name: string; dirty?: boolean; kind?: string; readOnly?: boolean; editorDisabled?: boolean; savedContent?: string; editorState?: any; localFileModTime?: number; [key: string]: any };

const tabs: Tab[] = []; // [{ path, name, editorState, savedContent, localFileModTime, dirty, kind, readOnly, editorDisabled }]
let activeTabIdx: number = -1;

const tabBarTabs: HTMLElement | null = document.getElementById("tabBarTabs");

let _onSwitch: ((tab: Tab) => void) | null = null;
let _onAllClosed: (() => void) | null = null;
let _onSave: (() => void) | null = null;
let _onRefresh: ((tab: Tab) => void) | null = null;
let _onBeforeSwap: (() => void) | null = null;
let _onCloseRequest: ((idx: number) => void) | null = null;
let _onCloseTabsToLeftRequest: ((idx: number) => void) | null = null;
let _onCloseTabsToRightRequest: ((idx: number) => void) | null = null;
let _onCloseAllTabsRequest: (() => void) | null = null;

export function onTabSwitch(fn: (tab: Tab) => void): void { _onSwitch = fn; }
export function onAllTabsClosed(fn: () => void): void { _onAllClosed = fn; }
export function onTabSaveRequest(fn: () => void): void { _onSave = fn; }
export function onTabRefreshRequest(fn: (tab: Tab) => void): void { _onRefresh = fn; }
export function onBeforeDocSwap(fn: () => void): void { _onBeforeSwap = fn; }
export function onTabCloseRequest(fn: (idx: number) => void): void { _onCloseRequest = fn; }
export function onTabsToLeftCloseRequest(fn: (idx: number) => void): void { _onCloseTabsToLeftRequest = fn; }
export function onTabsToRightCloseRequest(fn: (idx: number) => void): void { _onCloseTabsToRightRequest = fn; }
export function onAllTabsCloseRequest(fn: () => void): void { _onCloseAllTabsRequest = fn; }

function blankEditorState(): { content: string; selection: { anchor: { line: number; ch: number }; head: { line: number; ch: number } }; scroll: { left: number; top: number } } {
  return {
    content: "",
    selection: { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } },
    scroll: { left: 0, top: 0 },
  };
}

function storeActiveEditorState(): void {
  if (activeTabIdx < 0 || activeTabIdx >= tabs.length) return;
  tabs[activeTabIdx].editorState = captureEditorSnapshot();
}

export function openTab(path: string, name: string, content: string | undefined, modTime: number | undefined, options: { kind?: string; readOnly?: boolean; editorDisabled?: boolean } = {}): number {
  const existing = tabs.findIndex((t) => t.path && t.path === path);
  if (existing >= 0) {
    switchToTab(existing);
    return existing;
  }

  const tab = {
    path,
    name,
    editorState: {
      content: content || "",
      selection: { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } },
      scroll: { left: 0, top: 0 },
    },
    savedContent: content || "",
    localFileModTime: modTime || 0,
    dirty: false,
    kind: options.kind || "file",
    readOnly: !!options.readOnly,
    editorDisabled: !!options.editorDisabled,
  };

  tabs.push(tab);
  const idx = tabs.length - 1;
  switchToTab(idx);
  return idx;
}

export function closeTab(idx: number): void {
  if (idx < 0 || idx >= tabs.length) return;
  if (idx === activeTabIdx) storeActiveEditorState();

  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    activeTabIdx = -1;
    if (_onBeforeSwap) _onBeforeSwap();
    setEditorReadOnly(false);
    restoreEditorSnapshot(blankEditorState());
    renderTabBar();
    if (_onAllClosed) _onAllClosed();
    return;
  }

  if (idx <= activeTabIdx) activeTabIdx = Math.max(0, activeTabIdx - 1);
  switchToTab(activeTabIdx);
}

export function closeActiveTab(): void {
  if (activeTabIdx >= 0) closeTab(activeTabIdx);
}

export function closeTabsToRight(idx: number): void {
  if (idx < 0 || idx >= tabs.length - 1) return;
  if (activeTabIdx > idx) storeActiveEditorState();
  tabs.splice(idx + 1);
  if (activeTabIdx > idx) activeTabIdx = idx;
  switchToTab(Math.min(activeTabIdx, tabs.length - 1));
}

export function closeTabsToLeft(idx: number): void {
  if (idx <= 0 || idx >= tabs.length) return;
  if (activeTabIdx < idx) storeActiveEditorState();
  tabs.splice(0, idx);
  const newActive = activeTabIdx < idx ? 0 : activeTabIdx - idx;
  activeTabIdx = 0;
  switchToTab(Math.max(0, newActive));
}

export function closeAllTabs(): void {
  tabs.splice(0);
  activeTabIdx = -1;
  if (_onBeforeSwap) _onBeforeSwap();
  setEditorReadOnly(false);
  restoreEditorSnapshot(blankEditorState());
  renderTabBar();
  if (_onAllClosed) _onAllClosed();
}

export function switchToTab(idx: number): void {
  if (idx < 0 || idx >= tabs.length) return;

  if (activeTabIdx >= 0 && activeTabIdx < tabs.length) {
    storeActiveEditorState();
  }

  activeTabIdx = idx;
  const tab = tabs[idx];
  if (_onBeforeSwap) _onBeforeSwap();
  setEditorReadOnly(!!tab.readOnly);
  restoreEditorSnapshot(tab.editorState || blankEditorState());
  cm.refresh();

  renderTabBar();
  if (_onSwitch) _onSwitch(tab);
}

export function getActiveTab(): Tab | null {
  if (activeTabIdx < 0 || activeTabIdx >= tabs.length) return null;
  return tabs[activeTabIdx];
}

export function getActiveTabIdx(): number { return activeTabIdx; }
export function getTabs(): Tab[] { return [...tabs]; }
export function getTabCount(): number { return tabs.length; }

export function markActiveTabDirty(): void {
  const tab = getActiveTab();
  if (!tab || tab.dirty) return;
  tab.dirty = true;
  renderTabBar();
}

export function markActiveTabClean(newSavedContent: string, modTime: number | undefined): void {
  const tab = getActiveTab();
  if (!tab) return;
  tab.dirty = false;
  tab.savedContent = newSavedContent;
  tab.editorState = captureEditorSnapshot();
  if (modTime !== undefined) tab.localFileModTime = modTime;
  renderTabBar();
}

export function updateActiveTabPath(path: string, name: string): void {
  const tab = getActiveTab();
  if (!tab) return;
  tab.path = path;
  tab.name = name;
  renderTabBar();
}

export function isActiveTabDirty(): boolean {
  const tab = getActiveTab();
  return tab ? !!tab.dirty : false;
}

export function hasOpenTabs(): boolean {
  return tabs.length > 0;
}

export function findTabByPath(path: string): number {
  return tabs.findIndex((t) => t.path === path);
}

function requestCloseTab(idx: number): void {
  if (_onCloseRequest) return _onCloseRequest(idx);
  return closeTab(idx);
}

function requestCloseTabsToLeft(idx: number): void {
  if (_onCloseTabsToLeftRequest) return _onCloseTabsToLeftRequest(idx);
  return closeTabsToLeft(idx);
}

function requestCloseTabsToRight(idx: number): void {
  if (_onCloseTabsToRightRequest) return _onCloseTabsToRightRequest(idx);
  return closeTabsToRight(idx);
}

function requestCloseAllTabs(): void {
  if (_onCloseAllTabsRequest) return _onCloseAllTabsRequest();
  return closeAllTabs();
}

export function renderTabBar(): void {
  if (!tabBarTabs) return;
  tabBarTabs.innerHTML = "";

  tabs.forEach((tab, i) => {
    const el = document.createElement("div");
    el.className = "tab" + (i === activeTabIdx ? " active" : "");
    el.onclick = (e) => {
      if ((e.target as HTMLElement).classList.contains("tab-close")) return;
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

    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) { e.preventDefault(); requestCloseTab(i); }
    });

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTabContextMenu(e.clientX, e.clientY, i);
    });

    tabBarTabs.appendChild(el);
  });
}

function showTabContextMenu(x: number, y: number, tabIdx: number): void {
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

export function getSessionState(): { openTabs: Array<{ path: string; name: string; kind: string | undefined; readOnly: boolean | undefined; editorDisabled: boolean | undefined }>; activeTab: { path: string | null; name: string | null; kind: string | null } | null } {
  return {
    openTabs: tabs.map((t) => ({
      path: t.path,
      name: t.name,
      kind: t.kind,
      readOnly: t.readOnly,
      editorDisabled: t.editorDisabled,
    })),
    activeTab: activeTabIdx >= 0
      ? {
        path: tabs[activeTabIdx]?.path || null,
        name: tabs[activeTabIdx]?.name || null,
        kind: tabs[activeTabIdx]?.kind || null,
      }
      : null,
  };
}
