// style-block-highlight.ts — CM6 ViewPlugin that emits line decorations for
// the hovered and selected blocks (driven by preview-interaction signals).
// Re-runs whenever signals change via a signal-driven effect that dispatches
// a no-op transaction to force the plugin to rebuild its decorations.

import {
  Decoration,
  RangeSetBuilder,
  ViewPlugin,
} from "../../assets/codemirror6.bundle.js";
import { effect } from "../infrastructure/signal.js";
import { getBlockEntries } from "../document/rendering/block-entries-store.js";
import {
  hoveredBlockId,
  selectedBlockId,
  onHoverChange,
  onSelectionChange,
} from "../shell/ui/preview-interaction.js";

const hoverLine = Decoration.line({ class: "cm-style-hovered" });
const selectedLine = Decoration.line({ class: "cm-style-selected" });

function buildDecorations(view: any): any {
  const entries = getBlockEntries();
  const hoveredId = hoveredBlockId();
  const selectedId = selectedBlockId();
  const hovered = entries.find((e) => e.blockId === hoveredId);
  const selected = entries.find((e) => e.blockId === selectedId);
  const docLines = view.state.doc.lines;

  // RangeSetBuilder requires adds in ascending (from, startSide) order.
  // The selected block can be at any source line relative to the hovered
  // block, and a line can be both selected and hovered — we must sort
  // and de-duplicate before feeding the builder.
  const pending: Array<{ from: number; deco: any }> = [];
  const collect = (startLine: number, endLine: number, deco: any): void => {
    for (let l = startLine; l <= endLine; l++) {
      if (l < 0 || l >= docLines) continue;
      const from = view.state.doc.line(l + 1).from; // CM6 is 1-based
      pending.push({ from, deco });
    }
  };
  // Selected first so it wins on same-line de-dup (stable sort keeps order).
  if (selected) collect(selected.sourceLineStart, selected.sourceLineEnd, selectedLine);
  if (hovered) collect(hovered.sourceLineStart, hovered.sourceLineEnd, hoverLine);

  pending.sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder();
  let lastFrom = -1;
  for (const p of pending) {
    if (p.from === lastFrom) continue; // drop same-line duplicates
    builder.add(p.from, p.from, p.deco);
    lastFrom = p.from;
  }
  return builder.finish();
}

export const styleBlockHighlight = ViewPlugin.fromClass(
  class {
    decorations: any;
    private _unsubscribers: Array<() => void> = [];

    constructor(view: any) {
      this.decorations = buildDecorations(view);
      // Refresh decorations whenever the hover or selection signal changes.
      // effect() fires once immediately; we guard the first run so it doesn't
      // dispatch before CM has mounted.
      let firstHover = true;
      let firstSelect = true;
      this._unsubscribers.push(
        onHoverChange(() => {
          if (firstHover) {
            firstHover = false;
            return;
          }
          this.decorations = buildDecorations(view);
          view.dispatch({});
        }),
      );
      this._unsubscribers.push(
        onSelectionChange(() => {
          if (firstSelect) {
            firstSelect = false;
            return;
          }
          this.decorations = buildDecorations(view);
          view.dispatch({});
        }),
      );
    }

    update(update: any): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }

    destroy(): void {
      for (const u of this._unsubscribers) u();
      this._unsubscribers = [];
    }
  },
  { decorations: (v: any) => v.decorations },
);

// effect import kept so this module registers its signal graph at load time
// even if the plugin is never instantiated (tests / headless builds).
void effect;
