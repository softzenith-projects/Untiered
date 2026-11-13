import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement layout observers. dnd-kit creates one at module load, while
// component tests exercise state and accessibility rather than pixel collision geometry.
class TestResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) { void callback; }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): ResizeObserverEntry[] { return []; }
}

globalThis.ResizeObserver ??= TestResizeObserver;

// CodeMirror measures text ranges after its lazy editor mounts. Browsers provide both
// methods; jsdom intentionally has no layout engine, so return empty geometry rather
// than letting an unrelated asynchronous measurement throw during full-suite runs.
// A test file that opts into the Node environment (`// @vitest-environment node`) has no
// DOM at all, so there is no Range to patch.
if (typeof Range !== "undefined") {
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
}

afterEach(cleanup);
