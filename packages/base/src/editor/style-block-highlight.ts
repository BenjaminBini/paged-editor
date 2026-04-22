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
import { getBlockEntries } from "../document/render-scheduler.js";
import {
  hoveredBlockId,
  selectedBlockId,
  onHoverChange,
  onSelectionChange,
} from "../shell/ui/preview-interaction.js";

const hoverLine = Decoration.line({ class: "cm-style-hovered" });
const selectedLine = Decoration.line({ class: "cm-style-selected" });

function buildDecorations(view: any): any {
  const builder = new RangeSetBuilder();
  const entries = getBlockEntries();
  const hoveredId = hoveredBlockId();
  const selectedId = selectedBlockId();
  const hovered = entries.find((e) => e.blockId === hoveredId);
  const selected = entries.find((e) => e.blockId === selectedId);
  const docLines = view.state.doc.lines;
  const addRange = (startLine: number, endLine: number, deco: any): void => {
    for (let l = startLine; l <= endLine; l++) {
      if (l < 0 || l >= docLines) continue;
      const line = view.state.doc.line(l + 1); // CM6 is 1-based
      builder.add(line.from, line.from, deco);
    }
  };
  if (hovered) addRange(hovered.sourceLineStart, hovered.sourceLineEnd, hoverLine);
  if (selected) addRange(selected.sourceLineStart, selected.sourceLineEnd, selectedLine);
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
