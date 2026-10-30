import { chapterDomAndEvents } from "@/content/courses/javascript/22-dom-and-events";
import { chapterFormsAndStorage } from "@/content/courses/javascript/23-forms-and-storage";
import { chapterBrowserPerformance } from "@/content/courses/javascript/24-browser-performance";
import { chapterWebSecurityBasics } from "@/content/courses/javascript/25-web-security-basics";
import { chapterToolingAndTesting } from "@/content/courses/javascript/26-tooling-and-testing";
import type { Module } from "@/content/courses/types";

export const moduleBrowser: Module = {
  title: "JavaScript in the browser",
  chapters: [
    chapterDomAndEvents,
    chapterFormsAndStorage,
    chapterBrowserPerformance,
    chapterWebSecurityBasics,
    chapterToolingAndTesting,
  ],
};
