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

describe("buildBlockEntries — directive stripping (pass 2)", () => {
  test("fenced code block retains clean token.lang", () => {
    const body = "```js {:style mt=3}\nconst x = 1;\n```\n";
    const { blockEntries, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(blockEntries[0].styleValues).toEqual({ mt: 3 });
    expect(cleanedBody).toBe("```js\nconst x = 1;\n```\n");
    const tokens = marked.lexer(cleanedBody) as Array<Record<string, unknown>>;
    expect(tokens[0].type).toBe("code");
    expect(tokens[0].lang).toBe("js");
  });

  test("paragraph continuation line is not scanned", () => {
    // {:style} on line 2 is mid-paragraph prose, not a directive.
    const body =
      "First line. {:style mt=2}\nSecond {:style looks} weird.\n";
    const { blockEntries, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(blockEntries[0].styleValues).toEqual({ mt: 2 });
    expect(cleanedBody).toContain("Second {:style looks} weird.");
  });

  test("hr directive stripped, produces clean ---", () => {
    const body = "--- {:style mt=5}\n";
    const { blockEntries, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(blockEntries[0].blockType).toBe("hr");
    expect(blockEntries[0].styleValues).toEqual({ mt: 5 });
    expect(cleanedBody).toBe("---\n");
  });
});

describe("buildBlockEntries — malformed directives", () => {
  test("missing closing brace → malformed-directive, not stripped", () => {
    const body = "## Heading {:style mt=3\n";
    const { blockEntries, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(cleanedBody).toBe(body); // NOT stripped
    expect(blockEntries[0].styleValues).toEqual({});
    expect(blockEntries[0].errors).toHaveLength(1);
    expect(blockEntries[0].errors[0].code).toBe("malformed-directive");
    expect(blockEntries[0].errors[0].blockId).toBe("b0");
    expect(blockEntries[0].styleDirectiveRange).toEqual({ from: 10, to: 23 });
  });
});

describe("buildBlockEntries — orphan directives", () => {
  test("directive on a line that's not a block-start → orphan error", () => {
    // Blank-line content with a valid-looking directive — no stylable block starts here.
    const body = "## Heading\n\n   {:style mt=3}\n";
    const { styleErrors, cleanedBody } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(cleanedBody).toBe(body);
    expect(styleErrors).toHaveLength(1);
    expect(styleErrors[0].code).toBe("orphan-directive");
    expect(styleErrors[0].blockId).toBeNull();
  });

  test("well-formed directive inside a fenced code block content is NOT orphan", () => {
    const body = "```\nsome code {:style mt=3}\nmore\n```\n";
    const { styleErrors } = buildBlockEntries(body, {
      frontmatterCharOffset: 0,
      frontmatterLineOffset: 0,
      lex,
    });
    expect(styleErrors).toEqual([]);
  });
});
