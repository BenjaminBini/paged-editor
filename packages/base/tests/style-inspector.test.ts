import { describe, expect, test } from "vitest";
import { computeDirectiveChange } from "../src/editor/style-inspector-source.js";

describe("computeDirectiveChange", () => {
  test("insert new directive at end of line", () => {
    const doc = "## Heading\nOther line\n";
    const change = computeDirectiveChange({
      doc,
      line: 0,
      existingRange: null,
      newValues: { mt: 16, pb: 8 },
    });
    expect(change).toEqual({
      from: 10, // end of "## Heading"
      to: 10,
      insert: " {:style mt=16 pb=8}",
    });
  });

  test("replace existing directive", () => {
    const doc = "## Heading {:style mt=16}\n";
    const change = computeDirectiveChange({
      doc,
      line: 0,
      existingRange: { from: 10, to: 25 },
      newValues: { mt: 24, pb: 8 },
    });
    expect(change).toEqual({
      from: 10,
      to: 25,
      insert: " {:style mt=24 pb=8}",
    });
  });

  test("remove directive (all zero)", () => {
    const doc = "## Heading {:style mt=16}\n";
    const change = computeDirectiveChange({
      doc,
      line: 0,
      existingRange: { from: 10, to: 25 },
      newValues: {},
    });
    expect(change).toEqual({ from: 10, to: 25, insert: "" });
  });

  test("keys serialize in fixed order", () => {
    const change = computeDirectiveChange({
      doc: "p\n",
      line: 0,
      existingRange: null,
      newValues: { pb: 4, mt: 8, ml: 12 },
    });
    expect(change.insert).toBe(" {:style mt=8 ml=12 pb=4}");
  });

  test("zero values are omitted", () => {
    const change = computeDirectiveChange({
      doc: "p\n",
      line: 0,
      existingRange: null,
      newValues: { mt: 16, pb: 0, ml: 8 },
    });
    expect(change.insert).toBe(" {:style mt=16 ml=8}");
  });
});
