// scroll-sync.js — Bidirectional scroll mapping and smooth-follow animation between editor and preview.

const EDGE_SYNC_THRESHOLD = 0.015;
const MINIMUM_SCROLL_DELTA = 8;
const PROGRAMMATIC_SCROLL_IGNORE_MS = 140;
const VIEWPORT_ANCHOR_RATIO = 0.35;
const FOLLOW_SETTLE_THRESHOLD = 1;
const MINIMUM_FOLLOW_STEP = 10;
const BASE_FOLLOW_SPEED = 2400;
const DISTANCE_FOLLOW_GAIN = 6;
const MAX_FOLLOW_SPEED = 9600;

export class ScrollSyncController {
  constructor({ editorApi, getLineMap, previewFrame }) {
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

  handleDocumentChange() {
    this.lastScrollSource = "editor";
  }

  handleEditorScroll() {
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

  handlePreviewScroll() {
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

  restoreAfterRender() {
    this.cancelAllFollowAnimations();
    this.refreshRelation();
    this.syncFromCurrentSource();
  }

  handleLayoutChange() {
    this.cancelAllFollowAnimations();
    this.refreshRelation();
    this.syncFromCurrentSource();
  }

  dispose() {
    this.cancelAllFollowAnimations();
  }

  getEditorScroller() {
    return this.editorApi.getScrollerElement();
  }

  clampScrollProgress(progress) {
    return Math.min(1, Math.max(0, progress));
  }

  clampScrollTop(scroller, scrollTop) {
    return Math.min(
      Math.max(0, scrollTop),
      Math.max(0, scroller.scrollHeight - scroller.clientHeight),
    );
  }

  getPaneScroller(source) {
    return source === "editor" ? this.getEditorScroller() : this.previewFrame;
  }

  getScrollProgress(source) {
    const scroller = this.getPaneScroller(source);
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    if (maxScroll <= 0) return 0;
    return this.clampScrollProgress(scroller.scrollTop / maxScroll);
  }

  setScrollProgress(source, progress) {
    this.cancelFollowAnimation(source);
    const scroller = this.getPaneScroller(source);
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    this.setScrollTop(source, maxScroll <= 0 ? 0 : maxScroll * this.clampScrollProgress(progress));
  }

  setScrollTop(source, scrollTop) {
    this.writeScrollTop(source, scrollTop);
  }

  writeScrollTop(source, scrollTop, force = false, updateTarget = true) {
    const scroller = this.getPaneScroller(source);
    const nextScrollTop = this.clampScrollTop(scroller, scrollTop);

    if (!force && Math.abs(scroller.scrollTop - nextScrollTop) < MINIMUM_SCROLL_DELTA) return;

    if (updateTarget) this.followTarget[source] = nextScrollTop;
    this.ignoredScrollUntil[source] = performance.now() + PROGRAMMATIC_SCROLL_IGNORE_MS;
    scroller.scrollTop = nextScrollTop;
  }

  followScrollTop(source, scrollTop) {
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

  shouldIgnoreScroll(source) {
    return performance.now() < this.ignoredScrollUntil[source];
  }

  isNearStart(progress) {
    return progress <= EDGE_SYNC_THRESHOLD;
  }

  isNearEnd(progress) {
    return progress >= 1 - EDGE_SYNC_THRESHOLD;
  }

  getMaxScroll(source) {
    const scroller = this.getPaneScroller(source);
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  cancelFollowAnimation(source) {
    const frame = this.followAnimationFrame[source];
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
      this.followAnimationFrame[source] = 0;
    }
  }

  cancelAllFollowAnimations() {
    this.cancelFollowAnimation("editor");
    this.cancelFollowAnimation("preview");
  }

  stepFollowAnimation(source, timestamp) {
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

  refreshRelation() {
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

  findSegment(value, sourceKey) {
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

  interpolate(value, sourceKey, targetKey) {
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

  mapEditorToPreview(editorScrollTop) {
    return this.interpolate(editorScrollTop, "editorScrollTop", "previewScrollTop");
  }

  mapPreviewToEditor(previewScrollTop) {
    return this.interpolate(previewScrollTop, "previewScrollTop", "editorScrollTop");
  }

  syncFromCurrentSource() {
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
