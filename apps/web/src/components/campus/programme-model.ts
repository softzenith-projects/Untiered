import type { ProgrammeModule } from "@untiered/shared";

import { ROUND_LABEL } from "./assignment-model";

/** India has no daylight saving: 09:00 IST is always 03:30 UTC. */
const OPENS_AT_UTC = { hours: 3, minutes: 30 };
const DAY_MS = 86_400_000;

export interface ScheduledModule {
  week: number;
  title: string;
  what: string;
  opensAt: string;
  dueAt: string;
}

/**
 * The weekly schedule the server will create, for the preview before staff confirm: week n
 * opens at 09:00 IST on `startsOn + 7(n − 1)` days and is due 7 days later. The server
 * computes the same dates; this is only so nobody confirms a schedule they have not seen.
 */
export function weeklySchedule(startsOn: string, modules: ProgrammeModule[]): ScheduledModule[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startsOn);
  if (!match) return [];
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  return [...modules]
    .sort((a, b) => a.week - b.week)
    .map((module) => {
      const opens = Date.UTC(y, m - 1, d + 7 * (module.week - 1), OPENS_AT_UTC.hours, OPENS_AT_UTC.minutes);
      return {
        week: module.week,
        title: module.assignment.title,
        what: moduleWhat(module),
        opensAt: new Date(opens).toISOString(),
        dueAt: new Date(opens + 7 * DAY_MS).toISOString(),
      };
    });
}

export function moduleWhat(module: ProgrammeModule): string {
  const spec = module.assignment;
  if (spec.kind === "arena_scenarios") {
    const count = spec.scenarioIds?.length ?? 0;
    return `${count} Arena ${count === 1 ? "scenario" : "scenarios"}`;
  }
  const round = spec.roundType ? ROUND_LABEL[spec.roundType] : "Interview";
  return spec.durationMinutes ? `${round}, ${spec.durationMinutes} minutes` : round;
}

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Mon, 7 Dec 2026, 9:00 am IST", always in India time whatever the browser's timezone. */
export function formatIst(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : `${IST.format(date)} IST`;
}

const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in India as YYYY-MM-DD: the earliest a programme may start. */
export function todayInIndia(now: Date = new Date()): string {
  return IST_DATE.format(now);
}

const LONG_DATE = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });

export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : LONG_DATE.format(date);
}

/** "7 Dec 2026" for a YYYY-MM-DD date, without moving it across a timezone. */
export function formatPlainDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}
