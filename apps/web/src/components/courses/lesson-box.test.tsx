import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockRenderer } from "@/components/courses/block-renderer";
import type { Block } from "@/content/courses/types";

/** One of every box-shaped block kind a chapter can contain. */
const BOXED: Block[] = [
  { kind: "analogy", title: "A picture", text: "Text" },
  { kind: "trace", title: "Trace", steps: ["one"] },
  { kind: "pitfall", items: ["mistake"] },
  { kind: "remember", items: ["point"] },
  { kind: "interview", items: ["angle"] },
  { kind: "quiz", question: "Q?", options: ["a", "b"], answer: 0, why: "because" },
  { kind: "concept", title: "Concept", text: "Text" },
  { kind: "compare", title: "Compare", columns: [{ label: "A", items: ["x"] }] },
  { kind: "steps", title: "Steps", steps: [{ label: "one", text: "do" }] },
  { kind: "code", code: "int x = 1;" },
  { kind: "viz", title: "Viz", viz: { type: "array", frames: [{ cells: [{ value: 1 }, { value: 2 }], note: "start" }] } },
];

describe("lesson boxes", () => {
  it("draws every block kind in the same frame: one radius, one border", () => {
    const { container } = render(<BlockRenderer blocks={BOXED} />);
    const frames = Array.from(container.querySelectorAll(":scope > div > div")).map((wrapper) => wrapper.firstElementChild);

    expect(frames).toHaveLength(BOXED.length);
    for (const frame of frames) {
      expect(frame).toHaveClass("rounded-xl", "border");
    }
  });
});
