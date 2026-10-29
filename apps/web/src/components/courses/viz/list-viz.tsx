import type { ListFrame } from "@/content/courses/types";
import { fitWidth, rowOffsets, STATE_FILL, STATE_LABEL, STATE_STROKE } from "@/components/courses/viz/viz-tokens";

const BOX_W = 64;
const BOX_H = 40;
const GAP = 36;
const TOP_PAD = 30;

/** Linked-list nodes drawn left to right in list order, with arrows following `next`. A
 * `next: null` node gets a drawn "null" terminator instead of an arrow, so the end of the
 * list is a shape, not an absence. */
export function ListViz({ frame }: { frame: ListFrame }) {
  const widths = frame.nodes.map((node) => fitWidth(node.value, 14, BOX_W));
  const offsets = rowOffsets(widths, GAP);
  const width = widths.reduce((sum, w) => sum + w + GAP, 0) + 50;
  const height = TOP_PAD + BOX_H + 40;
  const indexOf = new Map(frame.nodes.map((node, i) => [node.id, i]));
  const summary = frame.nodes.map((n2) => `${n2.value}${n2.pointers?.length ? ` (${n2.pointers.join(", ")})` : ""}`).join(" -> ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`Linked list: ${summary}`} className="max-w-full">
      <defs>
        <marker id="list-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--ink-subtle)" />
        </marker>
      </defs>
      {frame.nodes.map((node, i) => {
        const x = offsets[i]!;
        const boxWidth = widths[i]!;
        const y = TOP_PAD;
        const targetIndex = node.next ? indexOf.get(node.next) : undefined;
        const fill = node.state ? STATE_FILL[node.state] : "var(--surface-raised)";
        const stroke = node.state ? STATE_STROKE[node.state] : "var(--line-strong)";
        return (
          <g key={node.id}>
            <rect x={x} y={y} width={boxWidth} height={BOX_H} rx={7} fill={fill} stroke={stroke} strokeWidth={1.5} />
            <text x={x + boxWidth / 2} y={y + BOX_H / 2 + 5} textAnchor="middle" className="font-mono" fontSize={14} fill="var(--ink)">
              {node.value}
            </text>
            {node.pointers?.length ? (
              <text x={x + boxWidth / 2} y={y - 8} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--accent-strong)">
                {node.pointers.join(" / ")}
              </text>
            ) : null}
            {node.state ? (
              <text x={x + boxWidth / 2} y={y + BOX_H + 14} textAnchor="middle" fontSize={9} fill="var(--ink-subtle)">
                {STATE_LABEL[node.state]}
              </text>
            ) : null}
            {targetIndex !== undefined ? (
              <line
                x1={x + boxWidth}
                y1={y + BOX_H / 2}
                x2={offsets[targetIndex]!}
                y2={y + BOX_H / 2}
                stroke="var(--ink-subtle)"
                strokeWidth={1.5}
                markerEnd="url(#list-arrow)"
              />
            ) : (
              <text x={x + boxWidth + 8} y={y + BOX_H / 2 + 4} fontSize={11} fill="var(--ink-subtle)">
                null
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
