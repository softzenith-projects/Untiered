import type { GraphFrame } from "@/content/courses/types";
import { boundingBox, layoutGraphRadial } from "@/lib/courses/viz-layout";
import { STATE_FILL, STATE_LABEL, STATE_STROKE } from "@/components/courses/viz/viz-tokens";

const RADIUS = 20;
const PAD = 30;

/** A small graph (< 20 nodes, the size course examples use) on a fixed radial layout —
 * see `layoutGraphRadial`. Edge direction is drawn with an arrowhead, never colour alone. */
export function GraphViz({ frame }: { frame: GraphFrame }) {
  const positions = layoutGraphRadial(frame.nodes);
  const posById = new Map(positions.map((p) => [p.id, p]));
  const byId = new Map(frame.nodes.map((n) => [n.id, n]));
  const box = boundingBox(positions, PAD + RADIUS);
  const summary = frame.nodes.map((n) => `${n.label}${n.state ? ` (${STATE_LABEL[n.state]})` : ""}`).join(", ");

  return (
    <svg
      viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`}
      width="100%"
      height={box.height}
      role="img"
      aria-label={`Graph: nodes ${summary}`}
      className="max-w-full"
    >
      <defs>
        <marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--ink-subtle)" />
        </marker>
      </defs>
      {frame.edges.map((edge, i) => {
        const from = posById.get(edge.from);
        const to = posById.get(edge.to);
        if (!from || !to) return null;
        const active = edge.state === "active";
        // Pull the endpoint back to the circle's edge so an arrowhead doesn't sit under the node.
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const tx = to.x - (dx / len) * RADIUS;
        const ty = to.y - (dy / len) * RADIUS;
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={tx}
            y2={ty}
            stroke={active ? "var(--accent)" : "var(--line-strong)"}
            strokeWidth={active ? 2.5 : 1.5}
            markerEnd={edge.directed ? "url(#graph-arrow)" : undefined}
          />
        );
      })}
      {positions.map((p) => {
        const node = byId.get(p.id);
        if (!node) return null;
        const fill = node.state ? STATE_FILL[node.state] : "var(--surface-raised)";
        const stroke = node.state ? STATE_STROKE[node.state] : "var(--line-strong)";
        // A circle holds a short name. Anything after " · " ("0 · dist 4") is an annotation
        // and goes underneath, where it has room, instead of spilling over the circle's edge.
        const [name, ...rest] = node.label.split(" · ");
        const annotation = rest.join(" · ");
        return (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={RADIUS} fill={fill} stroke={stroke} strokeWidth={1.5} />
            <text x={p.x} y={p.y + 5} textAnchor="middle" className="font-mono" fontSize={12} fill="var(--ink)">
              {name}
            </text>
            {annotation ? (
              <text x={p.x} y={p.y + RADIUS + 14} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={600} fill="var(--accent-strong)">
                {annotation}
              </text>
            ) : null}
            {node.state ? (
              <text x={p.x} y={p.y + RADIUS + (annotation ? 26 : 14)} textAnchor="middle" fontSize={9} fill="var(--ink-subtle)">
                {STATE_LABEL[node.state]}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
