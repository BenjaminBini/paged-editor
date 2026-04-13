// scroll-sync.js — Bidirectional scroll mapping and smooth-follow animation between editor and preview.

const EDGE_SYNC_THRESHOLD: number = 0.015;
const MINIMUM_SCROLL_DELTA: number = 8;
const PROGRAMMATIC_SCROLL_IGNORE_MS: number = 140;
const VIEWPORT_ANCHOR_RATIO: number = 0.35;
const FOLLOW_SETTLE_THRESHOLD: number = 1;
const MINIMUM_FOLLOW_STEP: number = 10;
const BASE_FOLLOW_SPEED: number = 2400;
const DISTANCE_FOLLOW_GAIN: number = 6;
const MAX_FOLLOW_SPEED: number = 9600;

export class ScrollSyncController {
  editorApi: any;
  getLineMap: () => any[];
  previewFrame: Element;
  ignoredScrollUntil: Record<string, number>;
  lastScrollSource: string;
  relationPoints: Array<{ editorScrollTop: number; previewScrollTop: number }>;
  followTarget: Record<string, number>;
  followAnimationFrame: Record<string, number>;
  followLastTimestamp: Record<string, number>;

  constructor({ editorApi, getLineMap, previewFrame }: { editorApi: any; getLineMap: () => any[]; previewFrame: Element }) {
    this.editorApi = editorApi;
    this.getLineMap = getLineMap;
    this.previewFrame = previewFrame;
    this.ignoredScrollUntil = { editor: 0, preview: 0 };
    this.lastScrollSource = "editor";
    this.relationPoints = [{ editorScrollTop: 0, previewScrollTop: 0 }];
    this.followTarget = { editor: 0, preview: 0 };
    this.followAnimationFrame = { editor: 0, preview: 0 };
    this.followLastTimestamp = { editor: 0, preview: 0 };
  }

  handleDocumentChange(): void {
    this.lastScrollSource = "editor";
  }

  handleEditorScroll(): void {
    if (this.shouldIgnoreScroll("editor")) return;

    this.cancelFollowAnimation("editor");
    this.lastScrollSource = "editor";
    const progress = this.getScrollProgress("editor");

    if (this.isNearStart(progress)) {
      this.setScrollProgress("preview", 0);
      return;
    }

    if (this.isNearEnd(progress)) {
      this.setScrollProgress("preview", 1);
      return;
    }

    this.followScrollTop("preview", this.mapEditorToPreview(this.getEditorScroller().scrollTop));
  }

  handlePreviewScroll(): void {
    if (this.shouldIgnoreScroll("preview")) return;

    this.cancelFollowAnimation("preview");
    this.lastScrollSource = "preview";
    const progress = this.getScrollProgress("preview");

    if (this.isNearStart(progress)) {
      this.setScrollProgress("editor", 0);
      return;
    }

    if (this.isNearEnd(progress)) {
      this.setScrollProgress("editor", 1);
      return;
    }

    this.followScrollTop("editor", this.mapPreviewToEditor(this.previewFrame.scrollTop));
  }

  restoreAfterRender(): void {
    this.cancelAllFollowAnimations();
    this.refreshRelation();
    this.syncFromCurrentSource();
  }

  handleLayoutChange(): void {
    this.cancelAllFollowAnimations();
    this.refreshRelation();
    this.syncFromCurrentSource();
  }

  dispose(): void {
    this.cancelAllFollowAnimations();
  }

  getEditorScroller(): Element {
    return this.editorApi.getScrollerElement();
  }

  clampScrollProgress(progress: number): number {
    return Math.min(1, Math.max(0, progress));
  }

  clampScrollTop(scroller: Element, scrollTop: number): number {
    return Math.min(
      Math.max(0, scrollTop),
      Math.max(0, scroller.scrollHeight - scroller.clientHeight),
    );
  }

  getPaneScroller(source: string): Element {
    return source === "editor" ? this.getEditorScroller() : this.previewFrame;
  }

  getScrollProgress(source: string): number {
    const scroller = this.getPaneScroller(source);
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    if (maxScroll <= 0) return 0;
    return this.clampScrollProgress(scroller.scrollTop / maxScroll);
  }

  setScrollProgress(source: string, progress: number): void {
    this.cancelFollowAnimation(source);
    const scroller = this.getPaneScroller(source);
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    this.setScrollTop(source, maxScroll <= 0 ? 0 : maxScroll * this.clampScrollProgress(progress));
  }

  setScrollTop(source: string, scrollTop: number): void {
    this.writeScrollTop(source, scrollTop);
  }

  writeScrollTop(source: string, scrollTop: number, force = false, updateTarget = true): void {
    const scroller = this.getPaneScroller(source);
    const nextScrollTop = this.clampScrollTop(scroller, scrollTop);

    if (!force && Math.abs(scroller.scrollTop - nextScrollTop) < MINIMUM_SCROLL_DELTA) return;

    if (updateTarget) this.followTarget[source] = nextScrollTop;
    this.ignoredScrollUntil[source] = performance.now() + PROGRAMMATIC_SCROLL_IGNORE_MS;
    scroller.scrollTop = nextScrollTop;
  }

  followScrollTop(source: string, scrollTop: number): void {
    const scroller = this.getPaneScroller(source);
    const nextScrollTop = this.clampScrollTop(scroller, scrollTop);
    this.followTarget[source] = nextScrollTop;

    if (Math.abs(scroller.scrollTop - nextScrollTop) < MINIMUM_SCROLL_DELTA) {
      this.cancelFollowAnimation(source);
      this.writeScrollTop(source, nextScrollTop, true, false);
      return;
    }

    if (this.followAnimationFrame[source] !== 0) return;

    this.followLastTimestamp[source] = performance.now();
    this.followAnimationFrame[source] = window.requestAnimationFrame((timestamp) => {
      this.stepFollowAnimation(source, timestamp);
    });
  }

  shouldIgnoreScroll(source: string): boolean {
    return performance.now() < this.ignoredScrollUntil[source];
  }

  isNearStart(progress: number): boolean {
    return progress <= EDGE_SYNC_THRESHOLD;
  }

  isNearEnd(progress: number): boolean {
    return progress >= 1 - EDGE_SYNC_THRESHOLD;
  }

  getMaxScroll(source: string): number {
    const scroller = this.getPaneScroller(source);
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  cancelFollowAnimation(source: string): void {
    const frame = this.followAnimationFrame[source];
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
      this.followAnimationFrame[source] = 0;
    }
  }

  cancelAllFollowAnimations(): void {
    this.cancelFollowAnimation("editor");
    this.cancelFollowAnimation("preview");
  }

  stepFollowAnimation(source: string, timestamp: number): void {
    this.followAnimationFrame[source] = 0;

    const scroller = this.getPaneScroller(source);
    const target = this.followTarget[source];
    const distance = target - scroller.scrollTop;

    if (Math.abs(distance) <= FOLLOW_SETTLE_THRESHOLD) {
      this.writeScrollTop(source, target, true, false);
      return;
    }

    const previousTimestamp = this.followLastTimestamp[source] || timestamp;
    const deltaMs = Math.min(40, Math.max(8, timestamp - previousTimestamp));
    const speed = Math.min(
      MAX_FOLLOW_SPEED,
      BASE_FOLLOW_SPEED + Math.abs(distance) * DISTANCE_FOLLOW_GAIN,
    );
    const step = Math.min(
      Math.abs(distance),
      Math.max(MINIMUM_FOLLOW_STEP, (speed * deltaMs) / 1000),
    );

    this.followLastTimestamp[source] = timestamp;

    if (step >= Math.abs(distance) - FOLLOW_SETTLE_THRESHOLD) {
      this.writeScrollTop(source, target, true, false);
      return;
    }

    this.writeScrollTop(
      source,
      scroller.scrollTop + Math.sign(distance) * step,
      false,
      false,
    );

    if (
      Math.abs(this.followTarget[source] - this.getPaneScroller(source).scrollTop) >
      FOLLOW_SETTLE_THRESHOLD
    ) {
      this.followAnimationFrame[source] = window.requestAnimationFrame((nextTimestamp) => {
        this.stepFollowAnimation(source, nextTimestamp);
      });
    }
  }

  refreshRelation(): void {
    const lineMap = this.getLineMap();
    const editorMaxScroll = this.getMaxScroll("editor");
    const previewMaxScroll = this.getMaxScroll("preview");
    const points = [{ editorScrollTop: 0, previewScrollTop: 0 }];

    for (const entry of lineMap) {
      const point = {
        editorScrollTop: this.clampScrollTop(
          this.getEditorScroller(),
          this.editorApi.heightAtLine(entry.lineNumber - 1, "local") -
            this.getEditorScroller().clientHeight * VIEWPORT_ANCHOR_RATIO,
        ),
        previewScrollTop: this.clampScrollTop(
          this.previewFrame,
          entry.previewOffsetTop - this.previewFrame.clientHeight * VIEWPORT_ANCHOR_RATIO,
        ),
      };

      const lastPoint = points[points.length - 1];
      point.editorScrollTop = Math.max(lastPoint.editorScrollTop, point.editorScrollTop);
      point.previewScrollTop = Math.max(lastPoint.previewScrollTop, point.previewScrollTop);

      if (
        point.editorScrollTop === lastPoint.editorScrollTop &&
        point.previewScrollTop === lastPoint.previewScrollTop
      ) {
        continue;
      }

      points.push(point);
    }

    const lastPoint = points[points.length - 1];
    points.push({
      editorScrollTop: Math.max(lastPoint.editorScrollTop, editorMaxScroll),
      previewScrollTop: Math.max(lastPoint.previewScrollTop, previewMaxScroll),
    });

    this.relationPoints = points;
  }

  findSegment(value: number, sourceKey: keyof { editorScrollTop: number; previewScrollTop: number }): { lower: { editorScrollTop: number; previewScrollTop: number }; upper: { editorScrollTop: number; previewScrollTop: number } } {
    const points = this.relationPoints;
    let low = 0;
    let high = points.length - 1;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (points[middle][sourceKey] < value) low = middle + 1;
      else high = middle;
    }

    const upperIndex = Math.min(points.length - 1, low);
    const lowerIndex = Math.max(0, upperIndex - 1);

    return {
      lower: points[lowerIndex],
      upper: points[upperIndex],
    };
  }

  interpolate(value: number, sourceKey: keyof { editorScrollTop: number; previewScrollTop: number }, targetKey: keyof { editorScrollTop: number; previewScrollTop: number }): number {
    if (this.relationPoints.length === 0) return 0;

    const clampedValue = this.clampScrollTop(
      this.getPaneScroller(sourceKey === "editorScrollTop" ? "editor" : "preview"),
      value,
    );
    const { lower, upper } = this.findSegment(clampedValue, sourceKey);
    const sourceSpan = upper[sourceKey] - lower[sourceKey];
    if (sourceSpan <= 0) return lower[targetKey];

    const progress = (clampedValue - lower[sourceKey]) / sourceSpan;
    return lower[targetKey] + (upper[targetKey] - lower[targetKey]) * progress;
  }

  mapEditorToPreview(editorScrollTop: number): number {
    return this.interpolate(editorScrollTop, "editorScrollTop", "previewScrollTop");
  }

  mapPreviewToEditor(previewScrollTop: number): number {
    return this.interpolate(previewScrollTop, "previewScrollTop", "editorScrollTop");
  }

  syncFromCurrentSource(): void {
    const progress = this.getScrollProgress(this.lastScrollSource);

    if (this.isNearStart(progress)) {
      if (this.lastScrollSource === "editor") this.setScrollProgress("preview", 0);
      else this.setScrollProgress("editor", 0);
      return;
    }

    if (this.isNearEnd(progress)) {
      if (this.lastScrollSource === "editor") this.setScrollProgress("preview", 1);
      else this.setScrollProgress("editor", 1);
      return;
    }

    if (this.lastScrollSource === "editor") {
      this.setScrollTop("preview", this.mapEditorToPreview(this.getEditorScroller().scrollTop));
      return;
    }

    this.setScrollTop("editor", this.mapPreviewToEditor(this.previewFrame.scrollTop));
  }
}
