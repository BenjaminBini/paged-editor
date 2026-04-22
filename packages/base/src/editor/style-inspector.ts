// style-inspector.ts — Inspector UI (box-model) that reflects the selected
// block's style values and edits the source via computeDirectiveChange.
// Read-only when the selected block has any directive error.

import {
  MAX_STEP,
  MIN_STEP,
  SPACING_SCALE,
  type SpacingKey,
  type StyleValues,
} from "../document/rendering/style-directive.js";
import {
  getBlockEntries,
  getStyleErrors,
} from "../document/render-scheduler.js";
import {
  onSelectionChange,
  rememberSelectedSourceLine,
  selectedBlockId,
} from "../shell/ui/preview-interaction.js";
import { cm } from "./codemirror-editor.js";
import { computeDirectiveChange } from "./style-inspector-source.js";
import { on as busOn } from "../infrastructure/event-bus.js";

const FIELDS: Array<{ key: SpacingKey; label: string; pos: string }> = [
  { key: "mt", label: "M↑", pos: "mt" },
  { key: "mr", label: "M→", pos: "mr" },
  { key: "mb", label: "M↓", pos: "mb" },
  { key: "ml", label: "M←", pos: "ml" },
  { key: "pt", label: "P↑", pos: "pt" },
  { key: "pr", label: "P→", pos: "pr" },
  { key: "pb", label: "P↓", pos: "pb" },
  { key: "pl", label: "P←", pos: "pl" },
];

function shortPreview(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 40 ? cleaned.slice(0, 40) + "…" : cleaned;
}

function jumpToOffset(offset: number): void {
  const pos = cm.getDoc().posFromIndex(offset);
  cm.setCursor(pos);
  cm.focus();
}

export function mountInspector(root: HTMLElement): void {
  const headerEl = root.querySelector<HTMLElement>("#inspectorHeader")!;
  const emptyEl = root.querySelector<HTMLElement>("#inspectorEmpty")!;
  const bodyEl = root.querySelector<HTMLElement>("#inspectorBody")!;
  const errorsEl = root.querySelector<HTMLElement>("#inspectorErrors")!;

  function commit(entry: { sourceLineStart: number; styleDirectiveRange: { from: number; to: number } | null }, nextValues: StyleValues): void {
    const doc = cm.getValue();
    const change = computeDirectiveChange({
      doc,
      line: entry.sourceLineStart,
      existingRange: entry.styleDirectiveRange,
      newValues: nextValues,
    });
    // cm.replaceRange takes {line, ch} positions — translate via posFromIndex.
    const fromPos = cm.getDoc().posFromIndex(change.from);
    const toPos = cm.getDoc().posFromIndex(change.to);
    cm.replaceRange(change.insert, fromPos, toPos);
  }

  function renderDocErrors(): void {
    const entries = getBlockEntries();
    const allErrors = [
      ...getStyleErrors(),
      ...entries.flatMap((e) => e.errors),
    ];
    if (allErrors.length === 0) {
      errorsEl.style.display = "none";
      errorsEl.replaceChildren();
      return;
    }
    errorsEl.style.display = "";
    errorsEl.replaceChildren();
    const title = document.createElement("div");
    title.className = "inspector-errors-title";
    title.textContent = `Errors (${allErrors.length})`;
    errorsEl.appendChild(title);
    for (const err of allErrors) {
      const row = document.createElement("button");
      row.className = "inspector-error-row";
      row.textContent = `Line ${err.line + 1}: ${err.message}`;
      row.addEventListener("click", () => {
        jumpToOffset(err.styleDirectiveRange.from);
      });
      errorsEl.appendChild(row);
    }
  }

  function render(): void {
    const id = selectedBlockId();
    const entries = getBlockEntries();
    const entry = entries.find((e) => e.blockId === id) || null;

    renderDocErrors();

    if (!entry) {
      headerEl.textContent = "Style Inspector";
      emptyEl.style.display = "";
      bodyEl.style.display = "none";
      bodyEl.replaceChildren();
      rememberSelectedSourceLine(null);
      return;
    }
    rememberSelectedSourceLine(entry.sourceLineStart);

    emptyEl.style.display = "none";
    bodyEl.style.display = "";

    const preview = shortPreview(
      cm.getLine(entry.sourceLineStart) || entry.blockType,
    );
    headerEl.textContent = `${entry.blockType} — "${preview}"`;

    bodyEl.replaceChildren();

    const hasErrors = entry.errors.length > 0;
    if (hasErrors) {
      const banner = document.createElement("div");
      banner.className = "inspector-error-banner";
      const jump = document.createElement("button");
      jump.className = "inspector-error-row";
      jump.textContent = "Jump to error";
      jump.addEventListener("click", () => {
        if (entry.styleDirectiveRange) jumpToOffset(entry.styleDirectiveRange.from);
      });
      banner.append(
        document.createTextNode("Directive has errors — fix in source first."),
        jump,
      );
      bodyEl.appendChild(banner);
    }

    const grid = document.createElement("div");
    grid.className = "inspector-box";
    for (const field of FIELDS) {
      const cell = document.createElement("div");
      cell.className = `inspector-cell inspector-cell-${field.pos}`;
      const current = (entry.styleValues[field.key] as number | undefined) ?? 0;
      const step = Math.max(MIN_STEP, Math.min(MAX_STEP, current));

      const label = document.createElement("label");
      label.textContent = field.label;

      const dec = document.createElement("button");
      dec.className = "inspector-dec";
      dec.textContent = "−";
      dec.disabled = hasErrors || step <= MIN_STEP;

      const stepEl = document.createElement("span");
      stepEl.className = "inspector-step";
      stepEl.textContent = String(step);

      const inc = document.createElement("button");
      inc.className = "inspector-inc";
      inc.textContent = "+";
      inc.disabled = hasErrors || step >= MAX_STEP;

      const px = document.createElement("span");
      px.className = "inspector-px";
      px.textContent = `${SPACING_SCALE[step]}px`;

      const apply = (delta: number): void => {
        if (hasErrors) return;
        const nextStep = Math.max(MIN_STEP, Math.min(MAX_STEP, step + delta));
        if (nextStep === step) return;
        const nextValues: StyleValues = { ...entry.styleValues, [field.key]: nextStep };
        if (nextStep === 0) delete nextValues[field.key];
        commit(entry, nextValues);
      };

      inc.addEventListener("click", () => apply(+1));
      dec.addEventListener("click", () => apply(-1));

      cell.append(label, dec, stepEl, inc, px);
      grid.appendChild(cell);
    }
    bodyEl.appendChild(grid);

    // Clear-all button — only when at least one value > 0 and no errors.
    const anyValue = Object.values(entry.styleValues).some(
      (v) => typeof v === "number" && v > 0,
    );
    if (anyValue && !hasErrors) {
      const clear = document.createElement("button");
      clear.className = "inspector-clear";
      clear.textContent = "Clear all spacing";
      clear.addEventListener("click", () => commit(entry, {}));
      bodyEl.appendChild(clear);
    }
  }

  onSelectionChange(() => render());
  busOn("section-ready", () => render());
  render();
}
