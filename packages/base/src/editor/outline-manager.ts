// outline-manager.js — Document outline panel (extracted from app.js)

import { cm } from "./codemirror-editor.js";
import { detectPartieNum } from "../document/rendering/markdown-helpers.js";
import { computeSectionNumbers } from "./section-numbers.js";

// ── DOM refs ────────────────────────────────────────────────────────────────

const outlineList: HTMLElement | null = document.getElementById("outlineList");
const outlineSection: HTMLElement | null = document.getElementById("outlineSection");

// ── State ───────────────────────────────────────────────────────────────────

let outlineHeadings: { line: number; level: number; text: string }[] = [];
let stuckObserver: IntersectionObserver | null = null;
let lastVisibleRange = "";

export function clearOutline(): void {
  outlineHeadings = [];
  lastVisibleRange = "";
  if (stuckObserver) {
    stuckObserver.disconnect();
    stuckObserver = null;
  }
  if (outlineList) outlineList.innerHTML = "";
  if (outlineSection) outlineSection.style.display = "none";
}

// ── Build outline ───────────────────────────────────────────────────────────

export function buildOutline(getActiveTab: () => any): void {
  clearOutline();
  for (let i = 0; i < cm.lineCount(); i++) {
    const m = cm.getLine(i)?.match(/^(#{1,4}) (.+)/);
    if (m)
      outlineHeadings.push({ line: i, level: m[1].length, text: m[2].trim() });
  }

  if (!outlineList) return;
  const stickyItems: HTMLElement[] = [];

  const tab = getActiveTab();
  const partieNum = detectPartieNum(cm.getValue(), tab?.name || "");
  const sectionEntries = computeSectionNumbers(
    (i) => cm.getLine(i) || "",
    cm.lineCount(),
    partieNum,
  );
  // Build a line-number → label map for fast lookup.
  const labelByLine = new Map(sectionEntries.map((e) => [e.lineNo, e.label]));
  const numbers = outlineHeadings.map((h) =>
    h.level === 1
      ? (partieNum ? `Partie ${partieNum}` : "")
      : (labelByLine.get(h.line) ?? ""),
  );

  outlineHeadings.forEach((h, idx) => {
    const el = document.createElement("div");
    el.className = "outline-item";
    el.dataset.level = String(h.level);
    el.dataset.idx = String(idx);
    const cleanText = h.text.replace(/^(?:Partie\s+\d+\s*[—●\-]\s*|[\d.]+\s*)/i, "");
    const num = numbers[idx];
    el.textContent = num ? num + " " + cleanText : cleanText;
    el.onclick = () => {
      cm.setCursor({ line: h.line, ch: 0 });
      cm.scrollIntoView(
        { line: h.line, ch: 0 },
        cm.getScrollInfo().clientHeight / 3,
      );
      cm.focus();
    };
    outlineList.appendChild(el);
    if (h.level <= 3) stickyItems.push(el);
  });

  if (stickyItems.length > 0) {
    stuckObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("stuck", entry.intersectionRatio < 1);
        });
      },
      { root: outlineList, threshold: 1.0 },
    );
    stickyItems.forEach((el) => stuckObserver!.observe(el));
  }

  if (outlineSection && outlineHeadings.length > 0) {
    outlineSection.style.display = "";
  }
  updateOutlineHighlight();
}

// ── Highlight tracking ──────────────────────────────────────────────────────

export function updateOutlineHighlight(): void {
  if (!outlineList || outlineHeadings.length === 0) return;

  const cursorLine = cm.getCursor().line;
  const info = cm.getScrollInfo();
  const topLine = cm.lineAtHeight(info.top, "local");
  const bottomLine = cm.lineAtHeight(info.top + info.clientHeight, "local");

  let firstVisible = -1,
    lastVisible = -1;
  for (let i = 0; i < outlineHeadings.length; i++) {
    const sectionStart = outlineHeadings[i].line;
    const sectionEnd =
      i + 1 < outlineHeadings.length
        ? outlineHeadings[i + 1].line - 1
        : cm.lineCount() - 1;
    if (sectionEnd >= topLine && sectionStart <= bottomLine) {
      if (firstVisible < 0) firstVisible = i;
      lastVisible = i;
    }
  }

  let activeIdx = -1;
  for (let i = outlineHeadings.length - 1; i >= 0; i--) {
    if (outlineHeadings[i].line <= cursorLine) {
      activeIdx = i;
      break;
    }
  }

  const centerLine = cm.lineAtHeight(info.top + info.clientHeight / 2, "local");
  const proximity = new Array(outlineHeadings.length).fill(0);
  if (firstVisible >= 0 && lastVisible >= firstVisible) {
    for (let i = firstVisible; i <= lastVisible; i++) {
      const headLine = outlineHeadings[i].line;
      const nextLine =
        i + 1 < outlineHeadings.length
          ? outlineHeadings[i + 1].line
          : cm.lineCount();
      const sectionMid = (headLine + nextLine) / 2;
      const halfSpan = Math.max(1, (bottomLine - topLine) / 2);
      const dist = Math.abs(sectionMid - centerLine) / halfSpan;
      proximity[i] = Math.max(0, 1 - dist);
    }
  }

  const visKey =
    firstVisible + ":" + lastVisible + ":" + activeIdx + ":" + centerLine;
  if (visKey === lastVisibleRange) return;
  lastVisibleRange = visKey;

  const items = outlineList.querySelectorAll<HTMLElement>(".outline-item");
  items.forEach((el, i) => {
    el.classList.toggle("active", i === activeIdx);
    const isVisible = i >= firstVisible && i <= lastVisible;
    el.classList.toggle("visible", isVisible);
    el.style.setProperty("--prox", isVisible ? proximity[i].toFixed(2) : "0");
  });

  if (firstVisible >= 0 && items[firstVisible] && items[lastVisible]) {
    const firstEl = items[firstVisible];
    const lastEl = items[lastVisible];
    const rangeTop = firstEl.offsetTop - outlineList.offsetTop;
    const rangeBottom =
      lastEl.offsetTop - outlineList.offsetTop + lastEl.offsetHeight;
    const rangeCenter = (rangeTop + rangeBottom) / 2;
    outlineList.scrollTop = rangeCenter - outlineList.clientHeight / 2;
  }
}
