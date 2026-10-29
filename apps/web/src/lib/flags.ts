export type ProductFeature = "mockInterviews" | "courses" | "arena" | "reports" | "questions";

export type GatedCourseSlug = "java" | "javascript" | "dsa" | "ai-agents" | "system-design";

/**
 * Product switches are public deployment configuration, not secrets. They are read
 * through literal `NEXT_PUBLIC_…` references because Next.js only inlines those at
 * build time. An unset switch preserves the currently shipped product; an explicit
 * value must be exactly `true` to enable it.
 */
function configured(value: string | undefined, defaultValue: boolean): boolean {
  return value === undefined ? defaultValue : value === "true";
}

export function featureEnabled(feature: ProductFeature): boolean {
  switch (feature) {
    case "mockInterviews":
      return configured(process.env.NEXT_PUBLIC_FEATURE_MOCK_INTERVIEWS, true);
    case "courses":
      return configured(process.env.NEXT_PUBLIC_FEATURE_COURSES, true);
    case "arena":
      return configured(process.env.NEXT_PUBLIC_FEATURE_ARENA, true);
    case "reports":
      return configured(process.env.NEXT_PUBLIC_FEATURE_REPORTS, true);
    case "questions":
      // Keep the original question-bank switch as a fallback so existing deployments
      // do not expose a bank that was intentionally left private.
      return configured(
        process.env.NEXT_PUBLIC_FEATURE_QUESTIONS,
        process.env.NEXT_PUBLIC_QUESTION_BANK_BROWSABLE === "true",
      );
  }
}

/** Individual course gates are independent from the parent Courses surface so Arena
 * can continue using an enabled course corpus even when the catalogue itself is hidden. */
export function courseEnabled(courseSlug: string): boolean {
  switch (courseSlug as GatedCourseSlug) {
    case "java":
      return configured(process.env.NEXT_PUBLIC_COURSE_JAVA_ENABLED, true);
    case "javascript":
      return configured(process.env.NEXT_PUBLIC_COURSE_JAVASCRIPT_ENABLED, true);
    case "dsa":
      return configured(process.env.NEXT_PUBLIC_COURSE_DSA_ENABLED, true);
    case "ai-agents":
      return configured(process.env.NEXT_PUBLIC_COURSE_AI_AGENTS_ENABLED, true);
    case "system-design":
      return configured(process.env.NEXT_PUBLIC_COURSE_SYSTEM_DESIGN_ENABLED, true);
    default:
      // A newly added course must receive an explicit gate before it can appear.
      return false;
  }
}

/** Backwards-compatible name used by the sourced-question components. */
export function questionBankBrowsable(): boolean {
  return featureEnabled("questions");
}
