import { describe, expect, test } from "vitest";
import { rootsEqual } from "../src/document/rendering/element-equal.js";

function el(html: string): Element {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.firstElementChild!;
}

describe("rootsEqual", () => {
  test("identical elements → true", () => {
    expect(rootsEqual(el(`<p>hi</p>`), el(`<p>hi</p>`))).toBe(true);
  });

  test("different innerHTML → false", () => {
    expect(rootsEqual(el(`<p>hi</p>`), el(`<p>bye</p>`))).toBe(false);
  });

  test("different style attribute → false", () => {
    expect(
      rootsEqual(el(`<p>hi</p>`), el(`<p style="margin-top:16px">hi</p>`)),
    ).toBe(false);
  });

  test("different tag → false", () => {
    expect(rootsEqual(el(`<p>hi</p>`), el(`<div>hi</div>`))).toBe(false);
  });

  test("different attribute count → false", () => {
    expect(rootsEqual(el(`<p class="a">hi</p>`), el(`<p>hi</p>`))).toBe(false);
  });
});
