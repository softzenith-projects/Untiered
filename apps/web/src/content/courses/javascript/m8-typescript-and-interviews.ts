import type { Module } from "@/content/courses/types";
import { chapterTypescriptEssentials } from "./43-typescript-essentials";
import { chapterInterviewPlaybook } from "./44-interview-playbook";

export const moduleTypescriptAndInterviews: Module = {
  title: "TypeScript and the interview itself",
  chapters: [chapterTypescriptEssentials, chapterInterviewPlaybook],
};
