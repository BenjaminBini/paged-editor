import { describe, expect, test } from "vitest";
import {
  SPACING_SCALE,
  renderStyleAttr,
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
