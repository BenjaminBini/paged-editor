interface SourceBlock { start: number; end: number; kind: string; text: string }
interface PreviewFragment { height: number; kind: string; pageNumber: number; pageOffsetTop: number; previewOffsetTop: number; textLength: number }
interface RangeGroup { start: number; end: number; fragments: PreviewFragment[] }

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeText(text = ""): string {
  return String(text).replace(/\s+/g, " ").trim();
}

function getPageNumber(page: Element): number {
  const value = Number.parseInt((page as HTMLElement)?.dataset?.pageNumber ?? "", 10);
  return Number.isNaN(value) ? 1 : value;
}

function getPreviewFragmentKind(element: Element | null): string | null {
  if (!element) return null;

  if (element.classList.contains("page-break")) return "pageBreak";

  const tagName = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) return "heading";
  if (tagName === "p") return "paragraph";
  if (tagName === "pre") return "code";
  if (tagName === "blockquote") return "blockquote";
  if (tagName === "ul" || tagName === "ol") return "list";
  if (tagName === "table") return "table";
  if (tagName === "hr") return "hr";

  return null;
}

const TOP_LEVEL_BLOCK_SELECTOR: string = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "table",
  "hr",
  ".page-break",
].join(", ");

const NESTED_CONTAINER_SELECTOR: string = "blockquote, ul, ol, li, table";

function isTopLevelPreviewBlock(element: Element): boolean {
  const parentBlock = element.parentElement?.closest(TOP_LEVEL_BLOCK_SELECTOR);
  if (!parentBlock) return true;
  return !parentBlock.matches(NESTED_CONTAINER_SELECTOR);
}

function buildPreviewFragments(previewFrame: Element, previewPages: Element): PreviewFragment[] {
  const frameRect = previewFrame.getBoundingClientRect();
  const fragments = [];
  const blocks = previewPages.querySelectorAll(TOP_LEVEL_BLOCK_SELECTOR);

  for (const block of blocks) {
    if (!isTopLevelPreviewBlock(block)) continue;

    const kind = getPreviewFragmentKind(block);
    const page = block.closest(".pagedjs_page");
    if (!kind || !page) continue;

    const blockRect = block.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();

    fragments.push({
      height: blockRect.height,
      kind,
      pageNumber: getPageNumber(page),
      pageOffsetTop: blockRect.top - pageRect.top,
      previewOffsetTop: previewFrame.scrollTop + blockRect.top - frameRect.top,
      textLength: Math.max(1, normalizeText(block.textContent || "").length),
    });
  }

  return fragments;
}

function buildPreviewRangeGroups(sourceBlocks: SourceBlock[], previewFrame: Element, previewPages: Element): RangeGroup[] {
  const fragments = buildPreviewFragments(previewFrame, previewPages);
  const groups = [];
  let sourceIndex = 0;
  let consumedTextLength = 0;

  for (const fragment of fragments) {
    while (sourceIndex < sourceBlocks.length) {
      const sourceBlock = sourceBlocks[sourceIndex];
      const sourceTextLength = Math.max(1, normalizeText(sourceBlock.text).length);
      const tolerance = Math.max(12, Math.round(sourceTextLength * 0.08));
      const remainingTextLength = Math.max(0, sourceTextLength - consumedTextLength);

      if (sourceBlock.kind !== fragment.kind) {
        sourceIndex += 1;
        consumedTextLength = 0;
        continue;
      }

      if (
        consumedTextLength > 0 &&
        remainingTextLength > 0 &&
        fragment.textLength > remainingTextLength + tolerance
      ) {
        sourceIndex += 1;
        consumedTextLength = 0;
        continue;
      }

      const group = groups[groups.length - 1];
      if (group && group.start === sourceBlock.start && group.end === sourceBlock.end) {
        group.fragments.push(fragment);
      } else {
        groups.push({
          start: sourceBlock.start,
          end: sourceBlock.end,
          fragments: [fragment],
        });
      }

      consumedTextLength = Math.min(
        sourceTextLength,
        consumedTextLength + Math.min(fragment.textLength, remainingTextLength || fragment.textLength),
      );

      if (consumedTextLength + tolerance >= sourceTextLength) {
        sourceIndex += 1;
        consumedTextLength = 0;
      }

      break;
    }
  }

  return groups;
}

function getRangeGroupForPosition(groups: RangeGroup[], position: number): RangeGroup | null {
  let closestGroup = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  let closestSpan = Number.POSITIVE_INFINITY;

  for (const group of groups) {
    const distance =
      position < group.start ? group.start - position : position > group.end ? position - group.end : 0;
    const span = group.end - group.start;

    if (distance < closestDistance || (distance === closestDistance && span < closestSpan)) {
      closestGroup = group;
      closestDistance = distance;
      closestSpan = span;
    }
  }

  return closestGroup;
}

function getFragmentPointForPosition(group: RangeGroup, position: number): { pageNumber: number; pageOffsetTop: number; previewOffsetTop: number } {
  const span = Math.max(1, group.end - group.start);
  const rangeFraction = clampProgress((position - group.start) / span);
  const totalWeight = group.fragments.reduce((sum: number, fragment: PreviewFragment) => sum + fragment.textLength, 0);
  const targetWeight = totalWeight * rangeFraction;
  let traversedWeight = 0;

  for (const fragment of group.fragments) {
    if (targetWeight <= traversedWeight + fragment.textLength) {
      const localFraction =
        fragment.textLength > 0 ? (targetWeight - traversedWeight) / fragment.textLength : 0;

      return {
        pageNumber: fragment.pageNumber,
        pageOffsetTop: fragment.pageOffsetTop + fragment.height * clampProgress(localFraction),
        previewOffsetTop: fragment.previewOffsetTop + fragment.height * clampProgress(localFraction),
      };
    }

    traversedWeight += fragment.textLength;
  }

  const lastFragment = group.fragments[group.fragments.length - 1];
  return {
    pageNumber: lastFragment.pageNumber,
    pageOffsetTop: lastFragment.pageOffsetTop + lastFragment.height,
    previewOffsetTop: lastFragment.previewOffsetTop + lastFragment.height,
  };
}

export function buildLineMap(sourceBlocks: SourceBlock[], lineStarts: number[], lineNumberOffset: number, previewFrame: Element, previewPages: Element): Array<{ lineNumber: number; lineStart: number; pageNumber: number; pageOffsetTop: number; previewOffsetTop: number }> {
  const groups = buildPreviewRangeGroups(sourceBlocks, previewFrame, previewPages);

  return lineStarts.map((lineStart: number, index: number) => {
    const group = getRangeGroupForPosition(groups, lineStart);
    if (!group) {
      return {
        lineNumber: lineNumberOffset + index + 1,
        lineStart,
        pageNumber: 1,
        pageOffsetTop: 0,
        previewOffsetTop: 0,
      };
    }

    const point = getFragmentPointForPosition(group, lineStart);
    return {
      lineNumber: lineNumberOffset + index + 1,
      lineStart,
      pageNumber: point.pageNumber,
      pageOffsetTop: point.pageOffsetTop,
      previewOffsetTop: point.previewOffsetTop,
    };
  });
}
