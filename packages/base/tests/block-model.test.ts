// block-model.test.ts — tests grow across Tasks 4-9.

import { describe, expect, test } from "vitest";
import { isStylableToken } from "../src/document/rendering/block-model.js";

describe("isStylableToken", () => {
  test("accepts the documented stylable kinds", () => {
    for (const type of [
      "heading",
      "paragraph",
      "blockquote",
      "list",
      "table",
      "hr",
      "code",
      "mdContainer",
    ]) {
      expect(isStylableToken({ type })).toBe(true);
    }
  });

  test("rejects unknown kinds", () => {
    expect(isStylableToken({ type: "html" })).toBe(false);
    expect(isStylableToken({ type: "text" })).toBe(false);
    expect(isStylableToken(null)).toBe(false);
  });
});
