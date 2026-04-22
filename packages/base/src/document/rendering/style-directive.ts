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
