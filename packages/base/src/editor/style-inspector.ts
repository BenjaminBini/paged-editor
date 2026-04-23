// style-inspector.ts — Inspector UI (box-model) that reflects the selected
// block's style values and edits the source via computeDirectiveChange.
// Read-only when the selected block has any directive error.

import {
  MAX_PX,
  MIN_PX,
  STEP_LARGE,
  STEP_SMALL,
  type SpacingKey,
  type StyleValues,
} from "../document/rendering/style-directive.js";
import {
  getBlockEntries,
  getStyleErrors,
} from "../document/rendering/block-entries-store.js";
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

  function commit(
    entry: {
      sourceLineStart: number;
      styleDirectiveRange: { from: number; to: number } | null;
      styleValues: StyleValues;
    },
    nextValues: StyleValues,
  ): void {
    const doc = cm.getValue();
    const change = computeDirectiveChange({
      doc,
      line: entry.sourceLineStart,
      existingRange: entry.styleDirectiveRange,
      newValues: nextValues,
    });
    const fromPos = cm.getDoc().posFromIndex(change.from);
    const toPos = cm.getDoc().posFromIndex(change.to);
    cm.replaceRange(change.insert, fromPos, toPos);
    // Optimistically update the entry closure so successive stepper clicks
    // (fired before the debounced re-render lands) replace the freshly-
    // written directive instead of appending another one.
    entry.styleValues = nextValues;
    entry.styleDirectiveRange = change.insert
      ? { from: change.from, to: change.from + change.insert.length }
      : null;
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

      const label = document.createElement("label");
      label.textContent = field.label;

      const decDouble = document.createElement("button");
      decDouble.className = "inspector-dec-dbl";
      decDouble.textContent = "−−";
      decDouble.title = `-${STEP_LARGE}px`;

      const dec = document.createElement("button");
      dec.className = "inspector-dec";
      dec.textContent = "−";
      dec.title = `-${STEP_SMALL}px`;

      const pxEl = document.createElement("span");
      pxEl.className = "inspector-px-value";

      const inc = document.createElement("button");
      inc.className = "inspector-inc";
      inc.textContent = "+";
      inc.title = `+${STEP_SMALL}px`;

      const incDouble = document.createElement("button");
      incDouble.className = "inspector-inc-dbl";
      incDouble.textContent = "++";
      incDouble.title = `+${STEP_LARGE}px`;

      // paint() reads the live value from the closure's entry (which commit()
      // mutates optimistically), so repeated clicks fired before the
      // debounced re-render land each use the latest value.
      const paint = (): void => {
        const current = (entry.styleValues[field.key] as number | undefined) ?? 0;
        const px = Math.max(MIN_PX, Math.min(MAX_PX, current));
        pxEl.textContent = `${px}px`;
        const atMin = px <= MIN_PX;
        const atMax = px >= MAX_PX;
        dec.disabled = hasErrors || atMin;
        decDouble.disabled = hasErrors || atMin;
        inc.disabled = hasErrors || atMax;
        incDouble.disabled = hasErrors || atMax;
      };

      const apply = (delta: number): void => {
        if (hasErrors) return;
        const current = (entry.styleValues[field.key] as number | undefined) ?? 0;
        const next = Math.max(MIN_PX, Math.min(MAX_PX, current + delta));
        if (next === current) return;
        const nextValues: StyleValues = { ...entry.styleValues, [field.key]: next };
        if (next === 0) delete nextValues[field.key];
        commit(entry, nextValues);
        paint();
      };

      incDouble.addEventListener("click", () => apply(+STEP_LARGE));
      inc.addEventListener("click", () => apply(+STEP_SMALL));
      dec.addEventListener("click", () => apply(-STEP_SMALL));
      decDouble.addEventListener("click", () => apply(-STEP_LARGE));

      paint();
      cell.append(label, decDouble, dec, pxEl, inc, incDouble);
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
