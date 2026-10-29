import { chapterNextjsAppRouter } from "@/content/courses/javascript/40-nextjs-app-router";
import { chapterNextjsRenderingAndCaching } from "@/content/courses/javascript/41-nextjs-rendering-and-caching";
import { chapterNextjsProduction } from "@/content/courses/javascript/42-nextjs-production";
import type { Module } from "@/content/courses/types";

export const moduleNextjs: Module = {
  title: "Next.js",
  chapters: [chapterNextjsAppRouter, chapterNextjsRenderingAndCaching, chapterNextjsProduction],
};
