import type { Course } from "@/content/courses/types";
import { aiSystems } from "@/content/courses/system-design/ai-systems";
import { buildingBlocks } from "@/content/courses/system-design/building-blocks";
import { cases } from "@/content/courses/system-design/cases";
import { dataInternals } from "@/content/courses/system-design/data-internals";
import { foundations } from "@/content/courses/system-design/foundations";
import { makeLesson } from "@/content/courses/system-design/lesson";

export const systemDesignCourse: Course = {
  slug: "system-design",
  title: "System Design",
  seoTitle: "System Design Interview Course",
  seoDescription: "From one request to resilient distributed and AI systems. Practise the trade-offs, then assemble the architecture yourself.",
  tagline: "From one request to resilient distributed and AI systems — practise the trade-offs, then assemble the architecture yourself.",
  level: "Beginner to interview-ready — no distributed-systems background assumed",
  codeLanguage: "python",
  requiresCodeExamples: false,
  modules: [
    { title: "Foundations: frame the problem", chapters: foundations.map((spec) => makeLesson(spec, 12)) },
    { title: "Building blocks: scale safely", chapters: buildingBlocks.map((spec) => makeLesson(spec, 14)) },
    { title: "Inside the data layer", chapters: dataInternals.map((spec) => makeLesson(spec, 14)) },
    { title: "AI and agent system design", chapters: aiSystems.map((spec) => makeLesson(spec, 15)) },
    { title: "Case studies: compose the system", chapters: cases.map((spec) => makeLesson(spec, 17)) },
  ],
};
