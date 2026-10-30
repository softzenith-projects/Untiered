import { chapterScopeAndHoisting } from "@/content/courses/javascript/09-scope-and-hoisting";
import { chapterClosures } from "@/content/courses/javascript/10-closures";
import type { Module } from "@/content/courses/types";

export const moduleCoreMechanics: Module = {
  title: "Core mechanics, at interview depth",
  chapters: [chapterScopeAndHoisting, chapterClosures],
};
