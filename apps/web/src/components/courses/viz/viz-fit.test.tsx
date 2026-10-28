import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArrayViz } from "@/components/courses/viz/array-viz";
import { GraphViz } from "@/components/courses/viz/graph-viz";
import { SeqViz } from "@/components/courses/viz/seq-viz";
import { fitWidth } from "@/components/courses/viz/viz-tokens";

// SVG text neither wraps nor clips, so a box narrower than its label lets the label spill
// across its neighbours ("Roll number: 21" over "Name: Aditi" in the println lesson).
const boxes = (container: HTMLElement) =>
  [...container.querySelectorAll("rect")].map((rect) => ({ x: Number(rect.getAttribute("x")), width: Number(rect.getAttribute("width")) }));

describe("visualiser boxes fit their labels", () => {
  it("widens a queue box for a long item and keeps the boxes apart", () => {
    const { container } = render(<SeqViz type="queue" frame={{ note: "", items: ["Roll number: 21", "Name: Aditi"] }} />);
    const [first, second] = boxes(container);
    expect(first!.width).toBeGreaterThanOrEqual(fitWidth("Roll number: 21", 14, 0));
    expect(second!.x).toBeGreaterThan(first!.x + first!.width);
  });

  it("keeps short items at the usual square size", () => {
    const { container } = render(<SeqViz type="stack" frame={{ note: "", items: ["1", "2"] }} />);
    expect(boxes(container).every((box) => box.width === 44)).toBe(true);
  });

  it("widens array cells for long values", () => {
    const value = "action: check_refund_status(RFD-9182)";
    const { container } = render(<ArrayViz frame={{ note: "", cells: [{ value }, { value: "3" }] }} />);
    const [first, second] = boxes(container);
    expect(first!.width).toBeGreaterThanOrEqual(fitWidth(value, 15, 0));
    expect(second!.x).toBeGreaterThan(first!.x + first!.width);
  });

  it("draws a graph node's annotation under the circle, not inside it", () => {
    const { container } = render(<GraphViz frame={{ note: "", nodes: [{ id: "0", label: "0 · dist 4" }], edges: [] }} />);
    const texts = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts).toContain("0");
    expect(texts).toContain("dist 4");
  });
});
