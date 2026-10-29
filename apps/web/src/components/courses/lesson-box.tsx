import { InlineText } from "@/components/courses/inline-text";

/**
 * The one box shape every lesson block is drawn in.
 *
 * Each block kind used to draw its own frame: the quiz a large gradient card with a shadow,
 * the architecture lab a different radius, the notes a small one, the labels three
 * different type treatments. Chapters from different courses — and blocks inside one
 * chapter — therefore looked like they came from different products. Every block now
 * shares one radius, one border weight, one padding and one label style, and colour carries
 * only meaning:
 *
 * - `accent` — ideas to hold on to (the picture, remember this, interview angle)
 * - `positive` — a worked concept or example
 * - `danger` — common mistakes
 * - `neutral` — things you do (quizzes, code, labs, diagrams)
 */
export type LessonTone = "neutral" | "accent" | "positive" | "danger";

const FRAME: Record<LessonTone, string> = {
  neutral: "border-line bg-surface-raised",
  accent: "border-accent/25 bg-accent-wash",
  positive: "border-positive/25 bg-positive-wash",
  danger: "border-danger/25 bg-danger-wash",
};

const LABEL: Record<LessonTone, string> = {
  neutral: "text-accent-strong",
  accent: "text-accent-strong",
  positive: "text-positive",
  danger: "text-danger",
};

export function LessonLabel({ tone = "neutral", children }: { tone?: LessonTone; children: React.ReactNode }) {
  return <p className={`font-mono text-micro font-semibold tracking-widest uppercase ${LABEL[tone]}`}>{children}</p>;
}

/** A short aside: label, optional title, then text or a list. */
export function LessonNote({
  tone,
  label,
  title,
  as: Tag = "aside",
  children,
}: {
  tone: LessonTone;
  label: string;
  title?: string;
  as?: "aside" | "div";
  children: React.ReactNode;
}) {
  return (
    <Tag className={`rounded-xl border px-5 py-4 sm:px-6 sm:py-5 ${FRAME[tone]}`}>
      <LessonLabel tone={tone}>{label}</LessonLabel>
      {title ? (
        <p className="mt-2 text-heading font-semibold text-ink">
          <InlineText text={title} />
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
    </Tag>
  );
}

/**
 * Something to read through or work with: a header bar (label, optional title, optional
 * controls on the right) above a body. `flush` drops the body padding for content that
 * brings its own, such as a code listing or an editor.
 */
export function LessonPanel({
  label,
  title,
  aside,
  flush = false,
  as: Tag = "figure",
  className = "",
  children,
}: {
  label: string;
  title?: React.ReactNode;
  aside?: React.ReactNode;
  flush?: boolean;
  as?: "figure" | "section" | "div";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={`overflow-hidden rounded-xl border border-line bg-surface-raised ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-line bg-surface-sunken px-5 py-3 sm:px-6">
        <div className="min-w-0">
          <LessonLabel>{label}</LessonLabel>
          {title ? <div className="mt-1 text-heading font-semibold text-ink">{title}</div> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className={flush ? "" : "px-5 py-4 sm:px-6 sm:py-5"}>{children}</div>
    </Tag>
  );
}

/** The bullet list every note uses, so lists look the same in every box. */
export function LessonList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-body leading-relaxed text-ink marker:text-ink-subtle">
      {items.map((item, i) => (
        <li key={i}>
          <InlineText text={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The two control weights used inside lesson boxes — every Run, Next, Reset and Check
 * button in every course is one of these, so controls look the same wherever they appear.
 */
export const LESSON_BUTTON =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-raised px-3 py-1.5 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";
export const LESSON_BUTTON_PRIMARY =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-caption font-semibold text-accent-contrast transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
