import { chapterEventLoop } from "@/content/courses/javascript/17-event-loop";
import { chapterPromises } from "@/content/courses/javascript/18-promises";
import { chapterAsyncAwait } from "@/content/courses/javascript/19-async-await";
import { chapterFetchAndAbort } from "@/content/courses/javascript/20-fetch-and-abort";
import { chapterMachineCodingUtilities } from "@/content/courses/javascript/21-machine-coding-utilities";
import type { Module } from "@/content/courses/types";

export const moduleAsync: Module = {
  title: "Asynchronous JavaScript",
  chapters: [
    chapterEventLoop,
    chapterPromises,
    chapterAsyncAwait,
    chapterFetchAndAbort,
    chapterMachineCodingUtilities,
  ],
};
