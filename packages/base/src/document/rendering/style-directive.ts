// style-directive.ts — Core primitives for the {:style mt=N …} directive.
// Scale, key set, inline-style serializer. Used by both the renderer
// (section-pipeline) and the inspector UI.

export const SPACING_SCALE: readonly number[] = [
  0, 4, 8, 16, 24, 32, 48, 64,
] as const;

export const MIN_STEP = 0;
export const MAX_STEP = SPACING_SCALE.length - 1;

export type SpacingKey =
  | "mt"
  | "mr"
  | "mb"
  | "ml"
  | "pt"
  | "pr"
  | "pb"
  | "pl";

// Fixed canonical order — drives both the serializer and the CSS output.
export const SPACING_KEYS: readonly SpacingKey[] = [
  "mt",
  "mr",
  "mb",
  "ml",
  "pt",
  "pr",
  "pb",
  "pl",
] as const;

const CSS_PROPERTY: Record<SpacingKey, string> = {
  mt: "margin-top",
  mr: "margin-right",
  mb: "margin-bottom",
  ml: "margin-left",
  pt: "padding-top",
  pr: "padding-right",
  pb: "padding-bottom",
  pl: "padding-left",
};

export type StyleValues = Partial<Record<SpacingKey, number>>;

export function renderStyleAttr(values: StyleValues | undefined): string {
  if (!values) return "";
  let out = "";
  for (const key of SPACING_KEYS) {
    const step = values[key];
    if (typeof step !== "number" || step <= 0) continue;
    const clamped = Math.max(MIN_STEP, Math.min(MAX_STEP, Math.floor(step)));
    out += `${CSS_PROPERTY[key]}:${SPACING_SCALE[clamped]}px;`;
  }
  return out;
}

// ── Directive fragment parser ──────────────────────────────────────────────
// The "fragment" is the text between `{:style ` and `}`, e.g. "mt=3 pb=2".
// Used once per well-formed directive extraction.

export type FragmentErrorCode =
  | "unknown-key"
  | "invalid-value"
  | "duplicate-key";

export interface FragmentError {
  code: FragmentErrorCode;
  token: string;
}

export interface ParsedFragment {
  values: StyleValues;
  errors: FragmentError[];
}

const KEY_RE = /^(mt|mr|mb|ml|pt|pr|pb|pl)$/;

export function parseDirectiveFragment(fragment: string): ParsedFragment {
  const values: StyleValues = {};
  const errors: FragmentError[] = [];
  const tokens = fragment.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq < 0) {
      errors.push({ code: "unknown-key", token });
      continue;
    }
    const key = token.slice(0, eq);
    const raw = token.slice(eq + 1);
    if (!KEY_RE.test(key)) {
      errors.push({ code: "unknown-key", token });
      continue;
    }
    const num = Number(raw);
    if (!Number.isInteger(num) || num < MIN_STEP || num > MAX_STEP) {
      errors.push({ code: "invalid-value", token });
      continue;
    }
    if (key in values) {
      errors.push({ code: "duplicate-key", token });
      continue;
    }
    values[key as SpacingKey] = num;
  }
  return { values, errors };
}
