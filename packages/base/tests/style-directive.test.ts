import { describe, expect, test } from "vitest";
import {
  SPACING_SCALE,
  renderStyleAttr,
  parseDirectiveFragment,
  extractDirective,
} from "../src/document/rendering/style-directive.js";

describe("SPACING_SCALE", () => {
  test("has 8 entries, 0 → 64", () => {
    expect(SPACING_SCALE).toEqual([0, 4, 8, 16, 24, 32, 48, 64]);
  });
});

describe("renderStyleAttr", () => {
  test("empty values → empty string", () => {
    expect(renderStyleAttr({})).toBe("");
    expect(renderStyleAttr(undefined)).toBe("");
  });

  test("single value → one declaration", () => {
    expect(renderStyleAttr({ mt: 3 })).toBe("margin-top:16px;");
  });

  test("multiple values → declarations in fixed order", () => {
    expect(renderStyleAttr({ pb: 2, mt: 3, ml: 1 })).toBe(
      "margin-top:16px;margin-left:4px;padding-bottom:8px;",
    );
  });

  test("zero is treated as absent", () => {
    expect(renderStyleAttr({ mt: 0, pb: 3 })).toBe("padding-bottom:16px;");
  });
});

describe("parseDirectiveFragment", () => {
  test("parses simple pairs", () => {
    const { values, errors } = parseDirectiveFragment("mt=3 pb=2");
    expect(values).toEqual({ mt: 3, pb: 2 });
    expect(errors).toEqual([]);
  });

  test("unknown key → error, key omitted", () => {
    const { values, errors } = parseDirectiveFragment("mt=3 xy=1");
    expect(values).toEqual({ mt: 3 });
    expect(errors).toEqual([{ code: "unknown-key", token: "xy=1" }]);
  });

  test("invalid value (out of 0..7) → error, key omitted", () => {
    const { values, errors } = parseDirectiveFragment("mt=99");
    expect(values).toEqual({});
    expect(errors).toEqual([{ code: "invalid-value", token: "mt=99" }]);
  });

  test("duplicate key → first wins + error", () => {
    const { values, errors } = parseDirectiveFragment("mt=3 mt=5");
    expect(values).toEqual({ mt: 3 });
    expect(errors).toEqual([{ code: "duplicate-key", token: "mt=5" }]);
  });

  test("non key=value token → unknown-key", () => {
    const { values, errors } = parseDirectiveFragment("mt=3 garbage");
    expect(values).toEqual({ mt: 3 });
    expect(errors).toEqual([{ code: "unknown-key", token: "garbage" }]);
  });

  test("empty string → no values, no errors", () => {
    expect(parseDirectiveFragment("")).toEqual({ values: {}, errors: [] });
  });
});

describe("extractDirective", () => {
  test("strict match returns well-formed result", () => {
    const r = extractDirective("## Heading {:style mt=3 pb=2}");
    expect(r).toEqual({
      kind: "wellFormed",
      spanStart: 10,
      spanEnd: 29,
      fragment: "mt=3 pb=2",
    });
  });

  test("no directive → none", () => {
    expect(extractDirective("## Heading").kind).toBe("none");
  });

  test("inline mid-line {:style} is not a directive", () => {
    // The directive must be at end-of-line. Text continues after `}`, so no match.
    expect(extractDirective("Text with {:style mt=3} inside").kind).toBe(
      "none",
    );
  });

  test("malformed (missing closing brace) → candidate", () => {
    const r = extractDirective("## Heading {:style mt=3");
    expect(r.kind).toBe("malformed");
    if (r.kind === "malformed") {
      expect(r.spanStart).toBe(10);
      expect(r.spanEnd).toBe(23);
    }
  });

  test("trailing whitespace after } still strict", () => {
    const r = extractDirective("## Heading {:style mt=3}   ");
    expect(r.kind).toBe("wellFormed");
  });
});
