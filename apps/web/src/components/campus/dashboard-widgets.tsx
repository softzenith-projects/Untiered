import type { CampusTopic, DashboardView, HeatmapCell } from "@untiered/shared";

import { BAND_FILL, BAND_LABEL, BAND_ORDER, TOPIC_LABEL } from "./readiness-model";

export const MIN_HEATMAP_STUDENTS = 3;

interface Tile {
  label: string;
  value: string;
}

/** Tiles for the figures that are known. A figure that is null is left out, never shown as 0. */
export function statTiles(view: DashboardView): Tile[] {
  const tiles: Tile[] = [
    { label: "Enrolled", value: String(view.enrolled) },
    { label: "Joined", value: String(view.joined) },
    { label: "Active in the last 14 days", value: String(view.active) },
  ];
  if (view.completionRate !== null && view.completionRate !== undefined) {
    tiles.push({ label: "Assignment completion", value: `${Math.round(view.completionRate * 100)}%` });
  }
  return tiles;
}

export function StatTiles({ view }: { view: DashboardView }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statTiles(view).map((tile) => (
        <div key={tile.label} className="card p-5">
          <dt className="text-caption text-ink-muted">{tile.label}</dt>
          <dd className="mt-1 text-display text-ink">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Students per readiness band. The bars are decoration for the table that follows them. */
export function BandChart({ bands }: { bands: DashboardView["bands"] }) {
  const max = Math.max(1, ...BAND_ORDER.map((band) => bands[band] ?? 0));
  const total = BAND_ORDER.reduce((sum, band) => sum + (bands[band] ?? 0), 0);
  return (
    <figure className="card flex flex-col gap-3 p-5">
      <figcaption className="text-heading text-ink">Readiness bands</figcaption>
      {total === 0 ? (
        <p className="text-caption text-ink-muted">No students in this view yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-hidden="true">
          {BAND_ORDER.map((band) => {
            const count = bands[band] ?? 0;
            return (
              <li key={band} className="grid grid-cols-[minmax(7rem,11rem)_1fr_2.5rem] items-center gap-3 text-caption">
                <span className="text-ink">{BAND_LABEL[band]}</span>
                <span className="h-4 rounded-full bg-surface-sunken">
                  <span
                    className="block h-4 rounded-full"
                    style={{ width: `${(count / max) * 100}%`, background: BAND_FILL[band], minWidth: count > 0 ? "0.5rem" : 0 }}
                  />
                </span>
                <span className="text-right font-semibold text-ink">{count}</span>
              </li>
            );
          })}
        </ul>
      )}
      <table className="sr-only">
        <caption>Students by readiness band</caption>
        <thead>
          <tr>
            <th scope="col">Band</th>
            <th scope="col">Students</th>
          </tr>
        </thead>
        <tbody>
          {BAND_ORDER.map((band) => (
            <tr key={band}>
              <th scope="row">{BAND_LABEL[band]}</th>
              <td>{bands[band] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const NO_DATA_PATTERN =
  "repeating-linear-gradient(45deg, transparent 0 5px, var(--line-strong) 5px 6px)";

/** Darker means higher. Capped so the number on top stays readable in light and dark themes. */
function cellBackground(average: number): string {
  const share = Math.round((Math.max(0, Math.min(100, average)) / 100) * 40);
  return `color-mix(in srgb, var(--accent) ${share}%, var(--surface-raised))`;
}

function Cell({ cell }: { cell: HeatmapCell | undefined }) {
  if (!cell || cell.average === null) {
    return (
      <td className="border border-line p-2 text-center text-caption text-ink-subtle" style={{ backgroundImage: NO_DATA_PATTERN }}>
        Not enough data
      </td>
    );
  }
  return (
    <td className="border border-line p-2 text-center" style={{ background: cellBackground(cell.average) }}>
      <span className="text-body font-semibold text-ink">{Math.round(cell.average)}</span>
      <span className="block text-caption text-ink-muted">{cell.students} students</span>
    </td>
  );
}

/** Departments by topic. A cell with too few students says so instead of implying a score. */
export function SkillHeatmap({ heatmap }: { heatmap: DashboardView["heatmap"] }) {
  const { columns, rows } = heatmap;
  return (
    <figure className="card flex flex-col gap-3 p-5">
      <figcaption className="text-heading text-ink">Skill gaps by department</figcaption>
      {columns.length === 0 || rows.length === 0 ? (
        <p className="text-caption text-ink-muted">No topic has completed work yet, so there is nothing to compare.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-caption">
              <caption className="sr-only">Average score by department and topic</caption>
              <thead>
                <tr>
                  <th scope="col" className="p-2 text-ink-muted">
                    Department
                  </th>
                  {columns.map((topic: CampusTopic) => (
                    <th key={topic} scope="col" className="p-2 text-center font-semibold text-ink">
                      {TOPIC_LABEL[topic]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.departmentId}>
                    <th scope="row" className="p-2 font-semibold text-ink">
                      {row.departmentCode}
                    </th>
                    {columns.map((topic) => (
                      <Cell key={topic} cell={row.cells.find((cell) => cell.topic === topic)} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-ink-muted" aria-label="Legend">
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-4 w-16 rounded border border-line" style={{ background: `linear-gradient(90deg, ${cellBackground(0)}, ${cellBackground(100)})` }} />
              Average score, 0 to 100 (darker is higher)
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-4 w-8 rounded border border-line" style={{ backgroundImage: NO_DATA_PATTERN }} />
              Not enough data: fewer than {MIN_HEATMAP_STUDENTS} students have completed work
            </li>
          </ul>
        </>
      )}
    </figure>
  );
}
