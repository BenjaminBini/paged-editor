// block-model.test.ts — tests grow across Tasks 4-9.

import { describe, expect, test } from "vitest";
import { marked } from "marked";
import {
  buildBlockEntries,
  isStylableToken,
} from "../src/document/rendering/block-model.js";

const lex = (src: string) => marked.lexer(src) as Array<Record<string, unknown>>;

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

describe("buildBlockEntries — well-formed directives", () => {
  test("heading with directive", () => {
    const body = "## Heading {:style mt=3 pb=2}\n";
    const { blockEntries, styleErrors } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(styleErrors).toEqual([]);
    expect(blockEntries).toHaveLength(1);
    const e = blockEntries[0];
    expect(e.blockId).toBe("b0");
    expect(e.blockType).toBe("heading");
    expect(e.sourceLineStart).toBe(0);
    expect(e.sourceLineEnd).toBe(0);
    expect(e.styleValues).toEqual({ mt: 3, pb: 2 });
    expect(e.styleDirectiveRange).toEqual({ from: 10, to: 29 });
    expect(e.errors).toEqual([]);
    expect(e.parentBlockId).toBeNull();
  });

  test("plain heading no directive", () => {
    const { blockEntries } = buildBlockEntries("## Plain\n", {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(blockEntries).toHaveLength(1);
    expect(blockEntries[0].styleDirectiveRange).toBeNull();
    expect(blockEntries[0].styleValues).toEqual({});
  });

  test("paragraph with directive on first source line", () => {
    const body =
      "First line of paragraph. {:style mt=4}\nSecond line continues.\n";
    const { blockEntries } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(blockEntries).toHaveLength(1);
    expect(blockEntries[0].blockType).toBe("paragraph");
    expect(blockEntries[0].styleValues).toEqual({ mt: 4 });
  });
});
