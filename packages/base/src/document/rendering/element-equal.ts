// element-equal.ts — root-signature DOM comparison used by the render-scheduler
// diff and the preview-renderer apply path. Matches when tagName, full
// attribute set, AND innerHTML are all equal. This is stricter than the
// previous innerHTML-only check, so style-only edits on a block's root element
// now enter changedLines and reach patchVisiblePages.

export function rootsEqual(a: Element, b: Element): boolean {
  if (a.innerHTML !== b.innerHTML) return false;
  if (a.tagName !== b.tagName) return false;
  const aAttrs = a.attributes;
  const bAttrs = b.attributes;
  if (aAttrs.length !== bAttrs.length) return false;
  for (let i = 0; i < aAttrs.length; i++) {
    if (b.getAttribute(aAttrs[i].name) !== aAttrs[i].value) return false;
  }
  return true;
}
