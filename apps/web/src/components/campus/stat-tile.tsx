import type { ReactNode } from "react";

/** One headline figure: a number, what it counts, and one line of context. */
export function StatTile({ label, value, detail }: { label: string; value: ReactNode; detail: ReactNode }) {
  return (
    <li className="card flex flex-col gap-1 p-5">
      <p className="text-display text-ink">{value}</p>
      <h3 className="text-caption font-semibold text-ink">{label}</h3>
      <p className="text-caption text-ink-muted">{detail}</p>
    </li>
  );
}

export function StatTiles({ label, columns, children }: { label: string; columns: 3 | 4; children: ReactNode }) {
  return (
    <ul aria-label={label} className={`grid gap-4 sm:grid-cols-2 ${columns === 4 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
      {children}
    </ul>
  );
}
