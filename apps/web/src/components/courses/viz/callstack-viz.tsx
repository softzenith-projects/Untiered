import type { CallFrame } from "@/content/courses/types";
import { fitWidth } from "@/components/courses/viz/viz-tokens";

const BOX_H = 34;
const GAP = 6;
const MIN_WIDTH = 260;

/** The call stack, drawn bottom to top — the frame that's `active` is the one currently
 * executing; `returning` marks a frame about to pop, distinct from active by label, not
 * just colour. */
export function CallStackViz({ frame }: { frame: CallFrame }) {
  const n = frame.stack.length;
  // Room for the label, plus the state tag ("returning") on the right.
  const WIDTH = Math.max(MIN_WIDTH, ...frame.stack.map((call) => fitWidth(call.label, 13, 0) + 140));
  const height = Math.max(1, n) * (BOX_H + GAP) + 24;
  const summary = `Call stack, top first: ${[...frame.stack].reverse().map((f) => f.label).join(", ") || "empty"}`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" height={height} role="img" aria-label={summary} className="max-w-full">
      {n === 0 ? (
        <text x={WIDTH / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="var(--ink-subtle)">
          empty
        </text>
      ) : (
        frame.stack.map((call, i) => {
          const y = height - 16 - (i + 1) * (BOX_H + GAP) + GAP;
          const isTop = i === n - 1;
          const fill = call.state === "returning" ? "color-mix(in srgb, var(--highlight) 30%, var(--surface-raised))" : isTop ? "var(--accent-wash)" : "var(--surface-raised)";
          const stroke = call.state === "returning" ? "var(--highlight)" : isTop ? "var(--accent)" : "var(--line-strong)";
          return (
            <g key={i}>
              <rect x={20} y={y} width={WIDTH - 40} height={BOX_H} rx={6} fill={fill} stroke={stroke} strokeWidth={1.5} />
              <text x={WIDTH / 2} y={y + BOX_H / 2 + 5} textAnchor="middle" className="font-mono" fontSize={13} fill="var(--ink)">
                {call.label}
              </text>
              {call.state ? (
                <text x={WIDTH - 22} y={y + BOX_H / 2 + 4} textAnchor="end" fontSize={9} fontWeight={600} fill="var(--ink-subtle)">
                  {call.state}
                </text>
              ) : null}
            </g>
          );
        })
      )}
    </svg>
  );
}
