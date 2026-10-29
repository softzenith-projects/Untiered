import type { ArrayFrame } from "@/content/courses/types";
import { fitWidth, rowOffsets, STATE_FILL, STATE_LABEL, STATE_STROKE } from "@/components/courses/viz/viz-tokens";

const CELL = 46;
const GAP = 10;
const TOP_PAD = 30;
const BOTTOM_PAD = 34;

/** A row of boxed values with named pointers underneath and an optional window bracket
 * over a contiguous range — the shape sliding-window, two-pointer and sort chapters need. */
export function ArrayViz({ frame }: { frame: ArrayFrame }) {
  const n = frame.cells.length;
  const widths = frame.cells.map((cell) => fitWidth(cell.value, 15, CELL));
  const offsets = rowOffsets(widths, GAP);
  const width = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, n - 1) * GAP;
  const height = TOP_PAD + CELL + BOTTOM_PAD;
  const summary = frame.cells
    .map((c, i) => `index ${i}: ${c.value}${c.pointers?.length ? ` (${c.pointers.join(", ")})` : ""}`)
    .join("; ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={`Array: ${summary}`}
      className="max-w-full"
    >
      {frame.range ? (
        <g>
          <rect
            x={offsets[frame.range[0]]! - 4}
            y={TOP_PAD - 4}
            width={offsets[frame.range[1]]! + widths[frame.range[1]]! - offsets[frame.range[0]]! + 8}
            height={CELL + 8}
            rx={10}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <text
            x={offsets[frame.range[0]]! - 4}
            y={TOP_PAD - 10}
            className="font-mono"
            fontSize={10}
            fill="var(--accent-strong)"
          >
            window
          </text>
        </g>
      ) : null}

      {frame.cells.map((cell, i) => {
        const x = offsets[i]!;
        const cellWidth = widths[i]!;
        const fill = cell.state ? STATE_FILL[cell.state] : "var(--surface-raised)";
        const stroke = cell.state ? STATE_STROKE[cell.state] : "var(--line-strong)";
        return (
          <g key={i}>
            <rect x={x} y={TOP_PAD} width={cellWidth} height={CELL} rx={8} fill={fill} stroke={stroke} strokeWidth={1.5} />
            <text
              x={x + cellWidth / 2}
              y={TOP_PAD + CELL / 2 + 5}
              textAnchor="middle"
              className="font-mono"
              fontSize={15}
              fill="var(--ink)"
            >
              {cell.value}
            </text>
            <text x={x + cellWidth / 2} y={TOP_PAD - 10} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--ink-subtle)">
              {i}
            </text>
            {cell.state ? (
              <text
                x={x + cellWidth / 2}
                y={TOP_PAD + CELL + 14}
                textAnchor="middle"
                fontSize={9}
                fill="var(--ink-subtle)"
              >
                {STATE_LABEL[cell.state]}
              </text>
            ) : null}
            {cell.pointers?.length ? (
              <text
                x={x + cellWidth / 2}
                y={TOP_PAD + CELL + (cell.state ? 26 : 16)}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="var(--accent-strong)"
              >
                {cell.pointers.join(" / ")}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
