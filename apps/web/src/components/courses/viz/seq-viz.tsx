import type { SeqFrame } from "@/content/courses/types";
import { fitWidth, rowOffsets } from "@/components/courses/viz/viz-tokens";

const BOX = 44;
const GAP = 8;

/**
 * A stack (vertical, newest on top) or a queue (horizontal, newest on the right, oldest —
 * the front — on the left). Same frame shape; only the arrangement and end labels differ,
 * which is exactly the conceptual difference between the two structures.
 */
export function SeqViz({ frame, type }: { frame: SeqFrame; type: "stack" | "queue" }) {
  const n = frame.items.length;
  const vertical = type === "stack";
  // A stack's boxes share one width, so the pile stays a straight column.
  const widths = frame.items.map((item) => fitWidth(item, 14, BOX));
  const stackWidth = Math.max(BOX, ...widths);
  const boxWidths = vertical ? widths.map(() => stackWidth) : widths;
  const offsets = rowOffsets(boxWidths, GAP);
  const width = vertical ? stackWidth + 70 : boxWidths.reduce((sum, w) => sum + w + GAP, 0) + 40;
  const height = vertical ? Math.max(1, n) * (BOX + GAP) + 30 : BOX + 50;
  const summary = `${type}, ${type === "stack" ? "top" : "front"} first: ${
    (type === "stack" ? [...frame.items].reverse() : frame.items).join(", ") || "empty"
  }`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={summary} className="max-w-full">
      {n === 0 ? (
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="var(--ink-subtle)">
          empty
        </text>
      ) : (
        frame.items.map((item, i) => {
          const isHighlighted = frame.highlight === i;
          const boxWidth = boxWidths[i]!;
          const x = vertical ? 20 : offsets[i]! + 20;
          // Stack draws bottom-to-top: index 0 (bottom of stack) sits at the bottom of the SVG.
          const y = vertical ? height - 20 - (i + 1) * (BOX + GAP) + GAP : 20;
          const isEnd = vertical ? i === n - 1 : i === 0 || i === n - 1;
          const endLabel = vertical ? "top" : i === 0 ? "front" : "back";
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={boxWidth}
                height={BOX}
                rx={7}
                fill={isHighlighted ? "var(--accent-wash)" : "var(--surface-raised)"}
                stroke={isHighlighted ? "var(--accent)" : "var(--line-strong)"}
                strokeWidth={1.5}
              />
              <text x={x + boxWidth / 2} y={y + BOX / 2 + 5} textAnchor="middle" className="font-mono" fontSize={14} fill="var(--ink)">
                {item}
              </text>
              {isEnd ? (
                <text
                  x={vertical ? x + boxWidth + 8 : x + boxWidth / 2}
                  y={vertical ? y + BOX / 2 + 4 : y - 8}
                  textAnchor={vertical ? "start" : "middle"}
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--ink-subtle)"
                >
                  {endLabel}
                </text>
              ) : null}
              {isHighlighted ? (
                <text
                  x={x + boxWidth / 2}
                  y={vertical ? y - 6 : y + BOX + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fill="var(--accent-strong)"
                >
                  just moved
                </text>
              ) : null}
            </g>
          );
        })
      )}
    </svg>
  );
}
