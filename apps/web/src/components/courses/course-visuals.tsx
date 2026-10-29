const artwork: Record<string, string> = {
  java: "from-course-java-start to-course-java-end",
  javascript: "from-course-js-start to-course-js-end",
  dsa: "from-course-dsa-start to-course-dsa-end",
  "ai-agents": "from-course-ai-start to-course-ai-end",
  "system-design": "from-course-design-start to-course-design-end",
};

export function CourseArtwork({ courseSlug }: { courseSlug: string }) {
  return (
    <div className={`relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br ${artwork[courseSlug] ?? artwork.dsa}`}>
      <span aria-hidden="true" className="absolute -left-5 -top-12 size-36 rotate-12 rounded-surface border-[18px] border-on-navy/35" />
      <span aria-hidden="true" className="absolute -bottom-20 -right-8 size-44 -rotate-12 rounded-[2.5rem] border-[20px] border-on-navy/40" />
      <div className="relative scale-90 transition-transform duration-200 group-hover:scale-100"><CourseMotif courseSlug={courseSlug} large /></div>
    </div>
  );
}

const coursePresentation = {
  java: {
    shortLabel: "Java",
    outcome: "Write clean, object-oriented Java from scratch",
    practice: "Runnable programs and coding drills",
    accent: "border-warning/25 bg-warning-wash text-warning",
    line: "bg-warning",
    motif: "code",
  },
  javascript: {
    shortLabel: "JavaScript",
    outcome: "Explain how JavaScript runs, then build with React, Node and Next",
    practice: "Code that runs in your browser, and output to predict",
    accent: "border-warning/30 bg-warning-wash text-ink",
    line: "bg-[linear-gradient(90deg,var(--warning),var(--positive))]",
    motif: "braces",
  },
  dsa: {
    shortLabel: "DSA",
    outcome: "Recognise patterns and reason through coding rounds",
    practice: "Pattern drills and interview problems",
    accent: "border-positive/25 bg-positive-wash text-positive",
    line: "bg-positive",
    motif: "nodes",
  },
  "ai-agents": {
    shortLabel: "AI",
    outcome: "Understand models and assemble reliable agents",
    practice: "Prompt, tool and agent experiments",
    accent: "border-accent/25 bg-accent-wash text-accent-strong",
    line: "bg-accent",
    motif: "spark",
  },
  "system-design": {
    shortLabel: "Architecture",
    outcome: "Turn requirements into resilient, explainable systems",
    practice: "Trade-off checks and drag-and-drop architecture labs",
    accent: "border-warning/30 bg-[linear-gradient(135deg,var(--warning-wash),var(--accent-wash))] text-accent-strong",
    line: "bg-[linear-gradient(90deg,var(--warning),var(--accent))]",
    motif: "architecture",
  },
} as const;

export function getCoursePresentation(courseSlug: string) {
  return coursePresentation[courseSlug as keyof typeof coursePresentation] ?? coursePresentation.java;
}

export function CourseMotif({ courseSlug, large = false }: { courseSlug: string; large?: boolean }) {
  const presentation = getCoursePresentation(courseSlug);
  const size = large ? "size-24" : "size-14";

  return (
    <div
      aria-hidden="true"
      className={`grid ${size} shrink-0 place-items-center rounded-2xl border ${presentation.accent}`}
    >
      {presentation.motif === "code" ? (
        <svg viewBox="0 0 48 48" className={large ? "size-14" : "size-8"} fill="none">
          <path d="m18 14-9 10 9 10M30 14l9 10-9 10M27 9l-6 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {presentation.motif === "braces" ? (
        <svg viewBox="0 0 48 48" className={large ? "size-14" : "size-8"} fill="none">
          <path d="M17 9c-4 0-5 2-5 5v5c0 2.5-1.5 4-4 5 2.5 1 4 2.5 4 5v5c0 3 1 5 5 5M31 9c4 0 5 2 5 5v5c0 2.5 1.5 4 4 5-2.5 1-4 2.5-4 5v5c0 3-1 5-5 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="24" r="2.2" fill="currentColor" /><circle cx="28" cy="24" r="2.2" fill="currentColor" />
        </svg>
      ) : null}
      {presentation.motif === "nodes" ? (
        <svg viewBox="0 0 48 48" className={large ? "size-14" : "size-8"} fill="none">
          <path d="M13 13h22M13 13l11 22m11-22L24 35" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="13" cy="13" r="5" fill="currentColor" /><circle cx="35" cy="13" r="5" fill="currentColor" /><circle cx="24" cy="35" r="5" fill="currentColor" />
        </svg>
      ) : null}
      {presentation.motif === "spark" ? (
        <svg viewBox="0 0 48 48" className={large ? "size-14" : "size-8"} fill="none">
          <path d="M24 6c1.8 10.3 7.7 16.2 18 18-10.3 1.8-16.2 7.7-18 18-1.8-10.3-7.7-16.2-18-18C16.3 22.2 22.2 16.3 24 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M38 5v8M34 9h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : null}
      {presentation.motif === "architecture" ? (
        <svg viewBox="0 0 48 48" className={large ? "size-14" : "size-8"} fill="none">
          <rect x="5" y="7" width="14" height="11" rx="3" stroke="currentColor" strokeWidth="2.5" />
          <rect x="29" y="7" width="14" height="11" rx="3" stroke="currentColor" strokeWidth="2.5" />
          <rect x="17" y="30" width="14" height="11" rx="3" stroke="currentColor" strokeWidth="2.5" />
          <path d="M19 12.5h10M12 18v6h12v6M36 18v6H24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24" cy="24" r="2.5" fill="currentColor" />
        </svg>
      ) : null}
    </div>
  );
}

export function CourseAccentLine({ courseSlug }: { courseSlug: string }) {
  return <span aria-hidden="true" className={`block h-1.5 w-12 rounded-full ${getCoursePresentation(courseSlug).line}`} />;
}
