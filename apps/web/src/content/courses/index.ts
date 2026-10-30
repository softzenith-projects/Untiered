import { aiAgentsCourse } from "@/content/courses/ai-agents";
import { dsaCourse } from "@/content/courses/dsa";
import { javaCourse } from "@/content/courses/java";
import { javascriptCourse } from "@/content/courses/javascript";
import { systemDesignCourse } from "@/content/courses/system-design";
import type { Chapter, Course, Module } from "@/content/courses/types";

/** Every course the site serves. Add a new course here, not by scattering imports. */
export const courses: Course[] = [
  javaCourse,
  javascriptCourse,
  dsaCourse,
  aiAgentsCourse,
  systemDesignCourse,
];

export function getCourse(slug: string): Course | undefined {
  return courses.find((course) => course.slug === slug);
}

export function totalMinutes(course: Course): number {
  return course.modules.reduce(
    (sum, module) => sum + module.chapters.reduce((s, chapter) => s + chapter.minutes, 0),
    0,
  );
}

export function totalChapters(course: Course): number {
  return course.modules.reduce((sum, module) => sum + module.chapters.length, 0);
}

/** Chapters in reading order, module boundaries flattened — what "prev/next" walks. */
export function flattenChapters(course: Course): Chapter[] {
  return course.modules.flatMap((module) => module.chapters);
}

export function getChapter(courseSlug: string, chapterSlug: string): Chapter | undefined {
  const course = getCourse(courseSlug);
  if (!course) return undefined;
  return flattenChapters(course).find((chapter) => chapter.slug === chapterSlug);
}

export function getModuleForChapter(course: Course, chapterSlug: string): Module | undefined {
  return course.modules.find((module) => module.chapters.some((c) => c.slug === chapterSlug));
}

export interface AdjacentChapters {
  prev: Chapter | undefined;
  next: Chapter | undefined;
}

/** Prev/next across module boundaries — the last chapter of module 1 leads into module 2. */
export function getAdjacentChapters(course: Course, chapterSlug: string): AdjacentChapters {
  const flat = flattenChapters(course);
  const index = flat.findIndex((chapter) => chapter.slug === chapterSlug);
  if (index === -1) return { prev: undefined, next: undefined };
  return { prev: flat[index - 1], next: flat[index + 1] };
}
