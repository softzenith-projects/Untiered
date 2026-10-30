import { chapterWhatIsJavascript } from "@/content/courses/javascript/01-what-is-javascript";
import { chapterValuesAndVariables } from "@/content/courses/javascript/02-values-and-variables";
import { chapterOperatorsAndCoercion } from "@/content/courses/javascript/03-operators-and-coercion";
import { chapterControlFlow } from "@/content/courses/javascript/04-control-flow";
import { chapterFunctionsBasics } from "@/content/courses/javascript/05-functions-basics";
import { chapterStringsNumbersDates } from "@/content/courses/javascript/06-strings-numbers-dates";
import { chapterArraysInDepth } from "@/content/courses/javascript/07-arrays-in-depth";
import { chapterObjectsInDepth } from "@/content/courses/javascript/08-objects-in-depth";
import type { Module } from "@/content/courses/types";

export const moduleFoundations: Module = {
  title: "JavaScript foundations",
  chapters: [
    chapterWhatIsJavascript,
    chapterValuesAndVariables,
    chapterOperatorsAndCoercion,
    chapterControlFlow,
    chapterFunctionsBasics,
    chapterStringsNumbersDates,
    chapterArraysInDepth,
    chapterObjectsInDepth,
  ],
};
