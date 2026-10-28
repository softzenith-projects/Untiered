import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";
import { LessonPanel } from "@/components/courses/lesson-box";

type CompareBlockData = Extract<Block, { kind: "compare" }>;

/** One accent per column position, never the only signal — the column's own label is
 * always shown too, so colour here is a scan aid, not the meaning (CLAUDE.md). */
const COLUMN_ACCENTS = ["var(--accent)", "var(--highlight)", "var(--accent-2)"];

// Tailwind needs literal class names in source to keep them in the build — a
// runtime-constructed `sm:grid-cols-${n}` string would be purged.
const GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

/**
 * A side-by-side comparison — `ArrayList` vs `LinkedList`, BFS vs DFS — as tinted columns
 * (task 052) rather than a plain table. Stacks to one column on mobile so nothing forces
 * horizontal scroll on a phone; full width from `sm` up, since this is one of the blocks
 * allowed to break out of the prose column.
 */
export function CompareBlock({ block }: { block: CompareBlockData }) {
  const columnClass = GRID_COLS[block.columns.length] ?? "sm:grid-cols-2";

  return (
    <LessonPanel label="Side by side" title={block.title ? <InlineText text={block.title} /> : undefined}>
      <div className={`grid grid-cols-1 gap-3 ${columnClass}`}>
        {block.columns.map((column, i) => (
          <div
            key={column.label}
            className="rounded-lg border border-line border-t-4 bg-surface px-4 py-3"
            style={{ borderTopColor: COLUMN_ACCENTS[i % COLUMN_ACCENTS.length] }}
          >
            <p className="text-heading font-semibold text-ink">
              <InlineText text={column.label} />
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-body leading-relaxed text-ink marker:text-ink-subtle">
              {column.items.map((item, j) => (
                <li key={j}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </LessonPanel>
  );
}
