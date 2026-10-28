import type { CellState } from "@/content/courses/types";

/**
 * Shared visual vocabulary for every viz shape (task 047). One state maps to one fill
 * *and* one short label, so nothing here is colour-only — a reader with no colour vision,
 * or reading the printed/no-JS fallback, still gets the label.
 */
export const STATE_FILL: Record<CellState, string> = {
  active: "var(--accent-wash)",
  window: "var(--accent-wash)",
  compare: "color-mix(in srgb, var(--highlight) 35%, var(--surface-raised))",
  swap: "color-mix(in srgb, var(--danger) 22%, var(--surface-raised))",
  done: "color-mix(in srgb, var(--accent-2) 22%, var(--surface-raised))",
  visiting: "color-mix(in srgb, var(--highlight) 35%, var(--surface-raised))",
};

export const STATE_LABEL: Record<CellState, string> = {
  active: "active",
  window: "window",
  compare: "compare",
  swap: "swap",
  done: "done",
  visiting: "visiting",
};

export const STATE_STROKE: Record<CellState, string> = {
  active: "var(--accent)",
  window: "var(--accent)",
  compare: "var(--highlight)",
  swap: "var(--danger)",
  done: "var(--accent-2)",
  visiting: "var(--highlight)",
};

/**
 * How wide a box must be to hold `text` in the monospace face at `fontSize`. SVG text never
 * wraps or clips, so a fixed-width box overflows the moment a lesson puts a word in it
 * ("Roll number: 21" spilled across its neighbours). Boxes size to their label instead,
 * never narrower than `min`.
 */
export function fitWidth(text: string | number, fontSize: number, min: number): number {
  return Math.max(min, Math.ceil(String(text).length * fontSize * 0.62) + 16);
}

/** Left edge of each box in a row of boxes of the given widths, `gap` apart. */
export function rowOffsets(widths: number[], gap: number): number[] {
  let x = 0;
  return widths.map((w) => {
    const left = x;
    x += w + gap;
    return left;
  });
}
