import { chapterScopeAndHoisting } from "@/content/courses/javascript/09-scope-and-hoisting";
import { chapterClosures } from "@/content/courses/javascript/10-closures";
import { chapterThisKeyword } from "@/content/courses/javascript/11-this-keyword";
import { chapterPrototypesAndInheritance } from "@/content/courses/javascript/12-prototypes-and-inheritance";
import { chapterClasses } from "@/content/courses/javascript/13-classes";
import type { Module } from "@/content/courses/types";

export const moduleCoreMechanics: Module = {
  title: "Core mechanics, at interview depth",
  chapters: [chapterScopeAndHoisting, chapterClosures, chapterThisKeyword, chapterPrototypesAndInheritance, chapterClasses],
};
