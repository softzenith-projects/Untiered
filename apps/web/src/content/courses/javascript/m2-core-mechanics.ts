import { chapterScopeAndHoisting } from "@/content/courses/javascript/09-scope-and-hoisting";
import { chapterClosures } from "@/content/courses/javascript/10-closures";
import { chapterThisKeyword } from "@/content/courses/javascript/11-this-keyword";
import { chapterPrototypesAndInheritance } from "@/content/courses/javascript/12-prototypes-and-inheritance";
import { chapterClasses } from "@/content/courses/javascript/13-classes";
import { chapterFunctionalPatterns } from "@/content/courses/javascript/14-functional-patterns";
import { chapterIteratorsGeneratorsSymbols } from "@/content/courses/javascript/15-iterators-generators-symbols";
import { chapterErrorsAndModules } from "@/content/courses/javascript/16-errors-and-modules";
import type { Module } from "@/content/courses/types";

export const moduleCoreMechanics: Module = {
  title: "Core mechanics, at interview depth",
  chapters: [
    chapterScopeAndHoisting,
    chapterClosures,
    chapterThisKeyword,
    chapterPrototypesAndInheritance,
    chapterClasses,
    chapterFunctionalPatterns,
    chapterIteratorsGeneratorsSymbols,
    chapterErrorsAndModules,
  ],
};
