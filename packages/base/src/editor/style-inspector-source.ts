// style-inspector-source.ts — pure transaction planning for the inspector.
// Kept separate from the UI so it can be unit-tested without pulling in the
// editor or DOM. Called by style-inspector.ts to build a CodeMirror change.

import {
  SPACING_KEYS,
  type StyleValues,
} from "../document/rendering/style-directive.js";

export interface DirectiveChange {
  from: number;
  to: number;
  insert: string;
}

export interface ComputeArgs {
  doc: string;
  line: number; // 0-based
  existingRange: { from: number; to: number } | null;
  newValues: StyleValues;
}

function serializeValues(values: StyleValues): string {
  const parts: string[] = [];
  for (const key of SPACING_KEYS) {
    const v = values[key];
    if (typeof v === "number" && v > 0) parts.push(`${key}=${v}`);
  }
  return parts.length ? `{:style ${parts.join(" ")}}` : "";
}

function lineEndOffset(doc: string, line: number): number {
  let offset = 0;
  for (let l = 0; l < line; l++) {
    const nl = doc.indexOf("\n", offset);
    if (nl < 0) return doc.length;
    offset = nl + 1;
  }
  const nl = doc.indexOf("\n", offset);
  return nl < 0 ? doc.length : nl;
}

export function computeDirectiveChange(args: ComputeArgs): DirectiveChange {
  const serialized = serializeValues(args.newValues);
  if (args.existingRange) {
    return {
      from: args.existingRange.from,
      to: args.existingRange.to,
      insert: serialized ? ` ${serialized}` : "",
    };
  }
  if (!serialized) {
    return { from: 0, to: 0, insert: "" };
  }
  const eol = lineEndOffset(args.doc, args.line);
  return { from: eol, to: eol, insert: ` ${serialized}` };
}
