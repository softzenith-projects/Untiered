import type {
  CampusTopic,
  ComponentScores,
  ReadinessBand,
  ReadinessComponent,
  ReadinessWeights,
} from "@untiered/shared";

import { getCourse } from "@/content/courses";
import { courseEnabled, featureEnabled } from "@/lib/flags";

export const BAND_LABEL: Record<ReadinessBand, string> = {
  strong: "Strong",
  interview_ready: "Interview ready",
  needs_improvement: "Needs improvement",
  needs_structured_prep: "Needs structured prep",
  not_enough_evidence: "Not enough evidence",
};

export const BAND_TONE: Record<ReadinessBand, "positive" | "accent" | "highlight" | "danger" | "navy"> = {
  strong: "positive",
  interview_ready: "accent",
  needs_improvement: "highlight",
  needs_structured_prep: "danger",
  not_enough_evidence: "navy",
};

/** Best to worst, the order bands are drawn and listed in. */
export const BAND_ORDER: ReadinessBand[] = [
  "strong",
  "interview_ready",
  "needs_improvement",
  "needs_structured_prep",
  "not_enough_evidence",
];

/** A fill per band for charts. Every bar also carries its label and count, so colour is never the only channel. */
export const BAND_FILL: Record<ReadinessBand, string> = {
  strong: "var(--positive)",
  interview_ready: "var(--accent)",
  needs_improvement: "var(--highlight)",
  needs_structured_prep: "var(--danger)",
  not_enough_evidence: "var(--neutral-400)",
};

export const COMPONENT_KEYS = ["coding", "coreCs", "technicalInterview", "communication", "aptitude"] as const;
export type ComponentKey = (typeof COMPONENT_KEYS)[number];

export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  coding: "Coding",
  coreCs: "Core CS",
  technicalInterview: "Technical interview",
  communication: "Communication",
  aptitude: "Aptitude",
};

/** The contract names a component `core_cs` in assignments and `coreCs` in score maps. */
export function componentKey(component: ReadinessComponent): ComponentKey {
  switch (component) {
    case "core_cs":
      return "coreCs";
    case "technical_interview":
      return "technicalInterview";
    default:
      return component;
  }
}

export const TOPIC_LABEL: Record<CampusTopic, string> = {
  dsa: "DSA",
  dbms: "DBMS",
  os: "Operating systems",
  oops: "OOPs",
  cn: "Computer networks",
  system_design: "System design",
  communication: "Communication",
  aptitude: "Aptitude",
};

export function componentLabel(component: ReadinessComponent): string {
  return COMPONENT_LABEL[componentKey(component)];
}

export function topicLabel(topic: CampusTopic | null): string {
  return topic ? TOPIC_LABEL[topic] : "General";
}

export function scoreText(score: number | null): string {
  return score === null ? "Not attempted" : `${Math.round(score)}`;
}

export function sumWeights(weights: ReadinessWeights): number {
  return COMPONENT_KEYS.reduce((sum, key) => sum + weights[key], 0);
}

export function hasAnyScore(components: ComponentScores): boolean {
  return COMPONENT_KEYS.some((key) => components[key] !== null);
}

export interface PracticeLink {
  label: string;
  href: string;
}

/**
 * Where a topic or component can be practised on Untiered. Only content that exists in
 * this repo: a course slug is looked up in the catalogue (and its flag checked) before a
 * link is made, so a topic with nothing to point at gets no link rather than a dead one.
 */
const TOPIC_COURSE: Partial<Record<CampusTopic, string>> = {
  dsa: "dsa",
  oops: "java",
  system_design: "system-design",
};

const COMPONENT_COURSE: Partial<Record<ReadinessComponent, string>> = {
  coding: "dsa",
};

function linksForCourse(slug: string | undefined): PracticeLink[] {
  if (!slug) return [];
  const course = getCourse(slug);
  if (!course || !courseEnabled(slug)) return [];
  const links: PracticeLink[] = [];
  if (featureEnabled("courses")) links.push({ label: `${course.title} course`, href: `/courses/${course.slug}` });
  if (featureEnabled("arena")) links.push({ label: `${course.title} Arena`, href: `/arena/${course.slug}` });
  return links;
}

export function practiceLinks(component: ReadinessComponent, topic: CampusTopic | null): PracticeLink[] {
  return linksForCourse(topic ? TOPIC_COURSE[topic] : COMPONENT_COURSE[component]);
}

export const NO_COURSE_TEXT = "No Untiered course for this topic yet";

export function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
