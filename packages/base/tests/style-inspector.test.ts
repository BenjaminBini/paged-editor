import { describe, expect, test } from "vitest";
import { computeDirectiveChange } from "../src/editor/style-inspector-source.js";

describe("computeDirectiveChange", () => {
  test("insert new directive at end of line", () => {
    const doc = "## Heading\nOther line\n";
    const change = computeDirectiveChange({
      doc,
      line: 0,
      existingRange: null,
      newValues: { mt: 3, pb: 2 },
    });
    expect(change).toEqual({
      from: 10, // end of "## Heading"
      to: 10,
      insert: " {:style mt=3 pb=2}",
    });
  });

  test("replace existing directive", () => {
    const doc = "## Heading {:style mt=3}\n";
    const change = computeDirectiveChange({
      doc,
      line: 0,
      existingRange: { from: 10, to: 24 },
      newValues: { mt: 5, pb: 2 },
    });
    expect(change).toEqual({
      from: 10,
      to: 24,
      insert: " {:style mt=5 pb=2}",
    });
  });

  test("remove directive (all zero)", () => {
    const doc = "## Heading {:style mt=3}\n";
    const change = computeDirectiveChange({
      doc,
      line: 0,
      existingRange: { from: 10, to: 24 },
      newValues: {},
    });
    expect(change).toEqual({ from: 10, to: 24, insert: "" });
  });

  test("keys serialize in fixed order", () => {
    const change = computeDirectiveChange({
      doc: "p\n",
      line: 0,
      existingRange: null,
      newValues: { pb: 1, mt: 2, ml: 3 },
    });
    expect(change.insert).toBe(" {:style mt=2 ml=3 pb=1}");
  });

  test("zero values are omitted", () => {
    const change = computeDirectiveChange({
      doc: "p\n",
      line: 0,
      existingRange: null,
      newValues: { mt: 3, pb: 0, ml: 2 },
    });
    expect(change.insert).toBe(" {:style mt=3 ml=2}");
  });
});
