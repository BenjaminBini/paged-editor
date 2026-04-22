// style-directive-lint.ts — CM6 mark decorations for directive errors
// (malformed-directive, unknown-key, invalid-value, duplicate-key,
// orphan-directive). Uses plain decorations + CSS instead of pulling in
// @codemirror/lint so the CM6 bundle stays as-is.

import {
  Decoration,
  RangeSetBuilder,
  ViewPlugin,
} from "../../assets/codemirror6.bundle.js";
import {
  getBlockEntries,
  getStyleErrors,
} from "../document/render-scheduler.js";
import { on as busOn, off as busOff } from "../infrastructure/event-bus.js";

const errorMark = Decoration.mark({ class: "cm-style-directive-error" });

function allErrors(): Array<{ from: number; to: number; message: string }> {
  const errors: Array<{ from: number; to: number; message: string }> = [];
  for (const e of getStyleErrors()) {
    errors.push({ ...e.styleDirectiveRange, message: e.message });
  }
  for (const b of getBlockEntries()) {
    for (const e of b.errors) {
      errors.push({ ...e.styleDirectiveRange, message: e.message });
    }
  }
  return errors;
}

function buildDecorations(view: any): any {
  const builder = new RangeSetBuilder();
  const docLen = view.state.doc.length;
  for (const err of allErrors()) {
    if (err.from < 0 || err.to > docLen || err.from >= err.to) continue;
    builder.add(err.from, err.to, errorMark);
  }
  return builder.finish();
}

export const styleDirectiveLint = ViewPlugin.fromClass(
  class {
    decorations: any;
    private _unsubscribe: () => void = () => {};

    constructor(view: any) {
      this.decorations = buildDecorations(view);
      // Rebuild whenever a new section is rendered — blockEntries / styleErrors
      // refresh then. section-ready is published by render-scheduler.
      const handler = (): void => {
        this.decorations = buildDecorations(view);
        view.dispatch({});
      };
      busOn("section-ready", handler);
      this._unsubscribe = () => busOff("section-ready", handler);
    }

    update(update: any): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }

    destroy(): void {
      this._unsubscribe();
    }
  },
  { decorations: (v: any) => v.decorations },
);
