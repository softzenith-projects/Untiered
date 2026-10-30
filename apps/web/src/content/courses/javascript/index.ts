import { moduleFoundations } from "@/content/courses/javascript/m1-foundations";
import { moduleCoreMechanics } from "@/content/courses/javascript/m2-core-mechanics";
import { moduleAsync } from "@/content/courses/javascript/m3-async";
import { moduleBrowser } from "@/content/courses/javascript/m4-browser";
import { moduleReact } from "@/content/courses/javascript/m5-react";
import { moduleNode } from "@/content/courses/javascript/m6-node";
import { moduleNextjs } from "@/content/courses/javascript/m7-nextjs";
import { moduleTypescriptAndInterviews } from "@/content/courses/javascript/m8-typescript-and-interviews";
import type { Course } from "@/content/courses/types";

/**
 * JavaScript, from the language to React, Node.js and Next.js (task 066).
 *
 * Every chapter carries code that runs in the reader's browser and prints what `node`
 * prints (`lib/javascript-runtime.ts`); the content integrity test runs each runnable
 * sample through both and holds it to its pasted output. Sources and licences are in
 * `THIRD_PARTY_NOTICES.md` beside this file.
 */
export const javascriptCourse: Course = {
  slug: "javascript",
  title: "JavaScript, React and Node",
  tagline: "How JavaScript really runs, then React, Node.js and Next.js — to the depth interviews ask.",
  level: "Beginner to interview-ready — no prior JavaScript assumed",
  codeLanguage: "javascript",
  modules: [
    moduleFoundations,
    moduleCoreMechanics,
    moduleAsync,
    moduleBrowser,
    moduleReact,
    moduleNode,
    moduleNextjs,
    moduleTypescriptAndInterviews,
  ],
};
