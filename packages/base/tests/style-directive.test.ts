import { describe, expect, test } from "vitest";
import {
  MAX_PX,
  MIN_PX,
  renderStyleAttr,
  parseDirectiveFragment,
  extractDirective,
} from "../src/document/rendering/style-directive.js";

describe("px bounds", () => {
  test("sane defaults", () => {
    expect(MIN_PX).toBe(0);
    expect(MAX_PX).toBeGreaterThan(100);
  });
});

describe("renderStyleAttr", () => {
  test("empty values → empty string", () => {
    expect(renderStyleAttr({})).toBe("");
    expect(renderStyleAttr(undefined)).toBe("");
  });

  test("single value → one px declaration", () => {
    expect(renderStyleAttr({ mt: 16 })).toBe("margin-top:16px;");
  });

  test("multiple values → declarations in fixed order", () => {
    expect(renderStyleAttr({ pb: 8, mt: 16, ml: 4 })).toBe(
      "margin-top:16px;margin-left:4px;padding-bottom:8px;",
    );
  });

  test("zero is treated as absent", () => {
    expect(renderStyleAttr({ mt: 0, pb: 16 })).toBe("padding-bottom:16px;");
  });

  test("value clamps to MAX_PX", () => {
    expect(renderStyleAttr({ mt: 9999 })).toBe(`margin-top:${MAX_PX}px;`);
  });
});

describe("parseDirectiveFragment", () => {
  test("parses simple px pairs", () => {
    const { values, errors } = parseDirectiveFragment("mt=16 pb=8");
    expect(values).toEqual({ mt: 16, pb: 8 });
    expect(errors).toEqual([]);
  });

  test("unknown key → error, key omitted", () => {
    const { values, errors } = parseDirectiveFragment("mt=16 xy=4");
    expect(values).toEqual({ mt: 16 });
    expect(errors).toEqual([{ code: "unknown-key", token: "xy=4" }]);
  });

  test("invalid value (out of 0..MAX_PX) → error, key omitted", () => {
    const { values, errors } = parseDirectiveFragment(`mt=${MAX_PX + 1}`);
    expect(values).toEqual({});
    expect(errors[0].code).toBe("invalid-value");
  });

  test("negative value → error", () => {
    const { values, errors } = parseDirectiveFragment("mt=-5");
    expect(values).toEqual({});
    expect(errors).toEqual([{ code: "invalid-value", token: "mt=-5" }]);
  });

  test("duplicate key → first wins + error", () => {
    const { values, errors } = parseDirectiveFragment("mt=16 mt=24");
    expect(values).toEqual({ mt: 16 });
    expect(errors).toEqual([{ code: "duplicate-key", token: "mt=24" }]);
  });

  test("non key=value token → unknown-key", () => {
    const { values, errors } = parseDirectiveFragment("mt=16 garbage");
    expect(values).toEqual({ mt: 16 });
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
