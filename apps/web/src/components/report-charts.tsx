import type { ReportCompetency } from "@untiered/shared";

import { cn } from "@/lib/cn";

/**
 * The marking scale, drawn.
 *
 * These two graphics exist because of one number. The report's scoring was recalibrated
 * to be genuinely demanding — 2 out of 5 is the *default* for a competent, ordinary
 * answer, which means an ordinary round now comes out at 40%. A candidate who has only
 * ever seen a percentage on a school paper reads 40% as a fail, and a report that opens
 * with a fail is one they close. The recalibration was worth doing precisely because it
 * leaves room above the middle for improvement to be visible; showing it as a bare
 * percentage, or as a gauge that is 60% empty, throws that away in the first second of
 * reading.
 *
 * So neither of these draws a "how full" bar for the overall score. The scale is drawn as
 * an instrument with its zones named, and the candidate is a mark on it. Nothing is empty,
 * because nothing was ever supposed to be full.
 */

/** Where a band starts, what it is called, and what the marker was told it means. */
export interface ScoreBand {
  /** Inclusive lower bound, as a percentage of the maximum. */
  from: number;
  /** Exclusive upper bound — the next band's `from`, or 100 at the top. */
  to: number;
  name: string;
  meaning: string;
}

/**
 * The bands, in the words the model is marked against.
 *
 * This is a deliberate copy of the anchored scale in `apps/api/src/main/resources/ai/
 * prompts/report.md`, and it is the only copy in the browser. The two have to move
 * together: if the prompt is re-anchored and this is not, the report will be labelling a
 * score with a band it was never marked against, which is worse than showing no band at
 * all. Sending the bands from the API would remove the duplication, but it would also put
 * a schema change and a stored-report migration in front of a change to one prose table,
 * and the scale is the sort of thing that gets tuned twice in a week.
 */
export const SCORE_BANDS = [
  {
    from: 0,
    to: 40,
    name: "Under par",
    meaning: "the answers did not engage with what the questions were testing",
  },
  {
    from: 40,
    to: 50,
    name: "Ordinary",
    meaning: "competent answers with nothing beneath them, which is this scale's default",
  },
  {
    from: 50,
    to: 60,
    name: "Good",
    meaning: "handled properly, with real depth when pushed",
  },
  {
    from: 60,
    to: 70,
    name: "Strong",
    meaning: "you anticipated the follow-up before it came",
  },
  {
    from: 70,
    to: 80,
    name: "Exceptional",
    meaning: "the answer a hiring manager repeats to someone else afterwards",
  },
  {
    from: 80,
    to: 100,
    name: "The ceiling",
    meaning: "as well as these questions can be answered",
  },
] as const satisfies readonly ScoreBand[];

/**
 * The score an ordinary answer earns, as a percentage.
 *
 * 2 out of 5 is the prompt's anchor for "correct as far as it goes, nothing beneath it".
 * It is drawn on every competency bar as a datum, so a bar that looks short can be seen
 * to have reached the mark rather than only to have failed to fill the track.
 */
export const ORDINARY_MARK = 40;

export type ScoreTone = "positive" | "warning" | "danger";

/**
 * A familiar traffic-light read for report scores. Text and anchored band names remain
 * beside every colour, so colour reinforces meaning without becoming the only signal.
 */
export function scoreToneForPercent(percent: number): ScoreTone {
  if (percent > 70) return "positive";
  if (percent >= 50) return "warning";
  return "danger";
}

/**
 * What each tone looks like, everywhere the report uses one. Fills use the vivid amber
 * (`highlight`) so the middle reads as yellow-orange at a glance; text on a wash uses the
 * darker `warning` so it stays readable. Every use pairs the colour with its `label` or a
 * band name, so colour is never the only signal.
 */
export const TONE_STYLES: Record<
  ScoreTone,
  { label: string; fill: string; svgFill: string; stroke: string; wash: string; border: string; text: string }
> = {
  positive: {
    label: "Strong",
    fill: "bg-positive",
    svgFill: "fill-positive",
    stroke: "stroke-positive",
    wash: "bg-positive-wash",
    border: "border-positive",
    text: "text-positive",
  },
  warning: {
    label: "Getting there",
    fill: "bg-highlight",
    svgFill: "fill-highlight",
    stroke: "stroke-highlight",
    wash: "bg-warning-wash",
    border: "border-highlight",
    text: "text-warning",
  },
  danger: {
    label: "Needs work",
    fill: "bg-danger",
    svgFill: "fill-danger",
    stroke: "stroke-danger",
    wash: "bg-danger-wash",
    border: "border-danger",
    text: "text-danger",
  },
};

export function toneFor(score: number, maxScore: number): ScoreTone {
  return scoreToneForPercent(maxScore > 0 ? (score / maxScore) * 100 : 0);
}

function scoreFillClass(percent: number): string {
  return TONE_STYLES[scoreToneForPercent(percent)].fill;
}

/** The key to the report's colours, stated once where the colours start. */
export function ToneLegend() {
  const entries: Array<{ tone: ScoreTone; range: string }> = [
    { tone: "danger", range: "below 50%" },
    { tone: "warning", range: "50–70%" },
    { tone: "positive", range: "above 70%" },
  ];
  return (
    <ul aria-label="What the colours mean" className="flex flex-wrap gap-x-5 gap-y-2">
      {entries.map(({ tone, range }) => (
        <li key={tone} className="flex items-center gap-2 text-caption text-ink-muted">
          <span aria-hidden="true" className={`size-3 rounded-full ${TONE_STYLES[tone].fill}`} />
          <span>
            <span className="font-semibold text-ink">{TONE_STYLES[tone].label}</span> · {range}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The mean of the competency ratios, as a percentage to one decimal place.
 *
 * Deliberately the same arithmetic and the same rounding as `ReadinessService.averageScore`
 * on the server, because the dashboard shows that number for the same round. Two figures
 * differing in the first decimal place for the same interview would read as a bug in the
 * one place a candidate is least willing to be confused.
 *
 * Null when nothing can be averaged — a report whose competencies were all dropped for
 * want of evidence has no overall score, and inventing 0% for it would be a claim about
 * the candidate rather than about the report.
 */
export function overallScore(competencies: ReportCompetency[] | undefined): number | null {
  const ratios = (competencies ?? [])
    .filter((item) => item.maxScore > 0)
    .map((item) => (item.score / item.maxScore) * 100);
  if (ratios.length === 0) return null;
  const mean = ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length;
  return Math.round(mean * 10) / 10;
}

/** The band a percentage falls in. Values outside 0–100 clamp to the end bands. */
export function bandFor(percent: number): ScoreBand {
  return SCORE_BANDS.findLast((band) => percent >= band.from) ?? SCORE_BANDS[0];
}

/**
 * The overall score, as a position on the scale rather than as a quantity.
 *
 * The band the candidate landed in is washed in, the marker points at where they are, and
 * every other band is drawn identically — so the graphic says "here, on this scale", never
 * "this much of something you did not get". The named bands are what make that legible:
 * without them the mark is just a percentage again.
 *
 * The whole thing is one `meter`, and its `aria-valuetext` carries the band name and what
 * the band means. A screen reader announcing "44 percent" alone would land the candidate
 * back in exactly the misreading this is here to prevent, so the number is never announced
 * without the word for it.
 */
export function OverallScore({ competencies }: { competencies: ReportCompetency[] | undefined }) {
  const scored = (competencies ?? []).filter((item) => item.maxScore > 0);
  const percent = overallScore(scored);
  if (percent === null) return null;

  const band = bandFor(percent);
  const marker = Math.min(100, Math.max(0, percent));
  const tone = scoreToneForPercent(percent);
  const toneClasses =
    tone === "positive"
      ? { band: "border-positive bg-positive-wash", marker: "bg-positive", arrow: "fill-positive" }
      : tone === "warning"
        ? { band: "border-warning bg-warning-wash", marker: "bg-warning", arrow: "fill-warning" }
        : { band: "border-danger bg-danger-wash", marker: "bg-danger", arrow: "fill-danger" };

  return (
    <figure className="flex flex-col gap-7 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-7">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Overall
        </p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="font-mono text-hero leading-none tabular-nums text-ink">
            {percent}
            <span className="pl-1 text-title text-ink-subtle">%</span>
          </span>
          <span className="text-title text-ink">{band.name}</span>
        </div>
        <p className="max-w-prose text-caption text-ink-subtle">
          The mean of {scored.length} competency {scored.length === 1 ? "score" : "scores"} —{" "}
          {band.meaning}.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <div
          role="meter"
          aria-label="Overall score on the marking scale"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}% — ${band.name.toLowerCase()}: ${band.meaning}. On this scale 40% is an ordinary answer, 50% good, 60% strong and 70% exceptional.`}
          className="relative h-9 w-full border border-line-strong bg-surface-sunken"
        >
          {/* Where they landed. The only band drawn differently, and the only accent here. */}
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 border-x ${toneClasses.band}`}
            style={{ left: `${band.from}%`, width: `${band.to - band.from}%` }}
          />
          {/*
            * Gradations, running a little past the ruler so the labels below read as
            * belonging to a position rather than floating under it.
            */}
          {SCORE_BANDS.slice(1).map((edge) => (
            <span
              key={edge.from}
              aria-hidden="true"
              className="absolute top-0 -bottom-1.5 w-px bg-line-strong"
              style={{ left: `${edge.from}%` }}
            />
          ))}
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 w-0.5 -translate-x-1/2 ${toneClasses.marker}`}
            style={{ left: `${marker}%` }}
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 10 8"
            className={`absolute -top-2.5 h-2 w-2.5 -translate-x-1/2 ${toneClasses.arrow}`}
            style={{ left: `${marker}%` }}
          >
            <polygon points="0,0 10,0 5,8" />
          </svg>
        </div>

        {/*
          * Staggered so adjacent labels have twenty points of scale to sit in rather than
          * ten. Below `sm` there is no width for six of them at any size worth reading, so
          * they come off entirely and the sentence underneath — which every reader gets,
          * on every screen — carries the vocabulary instead.
          */}
        <div aria-hidden="true" className="relative hidden h-8 sm:block">
          {SCORE_BANDS.map((entry, index) => (
            <span
              key={entry.from}
              className={cn(
                "absolute font-mono text-micro whitespace-nowrap",
                entry.from === band.from ? "text-ink" : "text-ink-subtle",
              )}
              style={{ left: `${entry.from}%`, top: index % 2 === 0 ? 0 : "1.2rem" }}
            >
              {entry.from} {entry.name}
            </span>
          ))}
        </div>
      </div>

      {/*
        * Task 053: this used to be a `figcaption` in the primary flow — a full paragraph of
        * calibration theory between the candidate and their own result. It is genuinely good
        * writing and genuinely not what somebody wants in the first five seconds, so it moves
        * behind a disclosure. Native `<details>` rather than a hand-rolled toggle: it is
        * keyboard-operable and announces its own expanded state with no ARIA to get wrong,
        * and every word survives underneath it, unchanged.
        */}
      <details className="group max-w-prose">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-caption font-medium text-ink-subtle marker:content-none hover:text-ink [&::-webkit-details-marker]:hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 8 8"
            className="h-2 w-2 shrink-0 fill-current transition-transform group-open:rotate-90"
          >
            <polygon points="0,0 8,4 0,8" />
          </svg>
          How this is scored
        </summary>
        <p className="max-w-prose pt-3 text-body text-ink-muted">
          The scale is set deliberately hard. 40% is a competent, ordinary answer and where most
          rounds land — including rounds that pass. 50% is good, 60% genuinely strong, 70% the
          answer an interviewer repeats to somebody else afterwards. A number in the forties is
          the middle of this scale rather than a failure, and the room above it is left open so
          that getting better has somewhere to show.
        </p>
      </details>
    </figure>
  );
}

/**
 * The two- or three-line read that has to work with nothing else on the page: which
 * competencies carried this round, and which cost it most.
 *
 * This is the direct answer to the owner's brief — "how did I do" in about five seconds,
 * as a visual rather than the prose the rest of the page still carries. It ranks by score
 * ratio so rubrics of different maxima compare fairly, the same arithmetic as
 * `overallScore`. With four or more competencies it splits into two columns; with three or
 * fewer, splitting top/bottom from the same short list would say nothing a full list does
 * not, so everything renders together instead.
 *
 * Deliberately no quotes here — this is the visual, not the evidence. The evidence is the
 * point of the section immediately below, where every one of these same competencies is
 * shown again with the words that earned its score.
 */
export function CompetencyHighlights({ competencies }: { competencies: ReportCompetency[] | undefined }) {
  const items = (competencies ?? []).filter((item) => item.maxScore > 0);
  if (items.length === 0) return null;

  const ranked = items
    .map((item) => ({ item, percent: (item.score / item.maxScore) * 100 }))
    .sort((a, b) => b.percent - a.percent);

  const n = ranked.length;
  // "Two or three" per the brief, scaling gently with how many there are to split.
  const take = n <= 3 ? n : Math.min(3, Math.max(2, Math.floor(n / 2)));
  const strongest = ranked.slice(0, take);
  const weakest = n <= 3 ? [] : ranked.slice(n - take).reverse();

  if (weakest.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-7">
        <h2 className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          At a glance
        </h2>
        <HighlightGroup heading="Your competencies" tone="neutral" items={strongest} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-7">
      <h2 className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
        At a glance
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <HighlightGroup heading="Strongest" tone="positive" items={strongest} />
        <HighlightGroup heading="Weakest" tone="critical" items={weakest} />
      </div>
    </div>
  );
}

function HighlightGroup({
  heading,
  tone,
  items,
}: {
  heading: string;
  tone: "positive" | "critical" | "neutral";
  items: Array<{ item: ReportCompetency; percent: number }>;
}) {
  const rule = tone === "positive" ? "border-positive" : tone === "critical" ? "border-danger" : "border-line-strong";

  return (
    <div className="flex flex-col gap-3">
      {/*
        * The colour on this rule is decoration, not the message — the heading text says
        * "Strongest" or "Weakest" either way, so a reader who cannot see the colour loses
        * nothing (per CLAUDE.md: never encode meaning in colour alone).
        */}
      <h3 className={cn("border-t-2 pt-2 text-caption font-medium tracking-wide text-ink-subtle uppercase", rule)}>
        {heading}
      </h3>
      <ul className="flex flex-col gap-3">
        {items.map(({ item, percent }) => (
          <li key={item.competency} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body text-ink">{item.competency}</span>
              <span className="shrink-0 font-mono text-caption tabular-nums text-ink-muted">
                {item.score}/{item.maxScore}
              </span>
            </div>
            <div aria-hidden="true" className="relative h-1.5 w-full bg-surface-sunken">
              <span
                className="absolute inset-y-0 left-0 bg-accent"
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Every competency on one axis, so which held up and which did not is a glance rather
 * than a scroll.
 *
 * The tracks are full width and share a left edge on purpose: the ordinary mark then lines
 * up down the whole chart into a single reference line, and a bar can be seen to have
 * reached it. Scored out of five, an ordinary answer fills two fifths of its track, and
 * without the datum a whole chart of perfectly respectable answers looks like a chart of
 * near-empty bars.
 *
 * The fill follows the report's shared traffic-light thresholds, while the numeric score,
 * named band and ordinary-answer datum keep colour from carrying meaning by itself.
 */
export function CompetencyBars({ competencies }: { competencies: ReportCompetency[] | undefined }) {
  const items = (competencies ?? []).filter((item) => item.maxScore > 0);
  if (items.length === 0) return null;

  return (
    <figure className="flex flex-col gap-5">
      <ul className="flex flex-col gap-4">
        {items.map((item) => {
          const percent = Math.min(100, Math.max(0, (item.score / item.maxScore) * 100));
          return (
            <li key={item.competency} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-body text-ink">{item.competency}</span>
                <span className="shrink-0 font-mono text-caption tabular-nums text-ink-muted">
                  {item.score}/{item.maxScore}
                </span>
              </div>
              <div
                role="meter"
                aria-valuemin={0}
                aria-valuemax={item.maxScore}
                aria-valuenow={item.score}
                aria-valuetext={`${item.score} out of ${item.maxScore}, against ${
                  Math.round(item.maxScore * ORDINARY_MARK) / 100
                } for an ordinary answer`}
                aria-label={item.competency}
                className="relative h-2.5 w-full bg-surface-sunken"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 ${scoreFillClass(percent)}`}
                  style={{ width: `${percent}%` }}
                />
                {/* The datum. Drawn over the fill so a bar that passes it still shows it. */}
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -bottom-1 w-px -translate-x-1/2 bg-ink-subtle"
                  style={{ left: `${ORDINARY_MARK}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <figcaption className="max-w-prose text-caption text-ink-muted">
        Each competency against its own maximum. The mark at {ORDINARY_MARK}% is an ordinary
        answer — a bar that reaches it did what the question asked.
      </figcaption>
    </figure>
  );
}
