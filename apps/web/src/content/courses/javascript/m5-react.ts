import { chapterReactMentalModel } from "@/content/courses/javascript/27-react-mental-model";
import { chapterPropsStateEvents } from "@/content/courses/javascript/28-props-state-events";
import { chapterUseeffectAndSync } from "@/content/courses/javascript/29-useeffect-and-sync";
import { chapterRefsAndDom } from "@/content/courses/javascript/30-refs-and-dom";
import { chapterStateArchitecture } from "@/content/courses/javascript/31-state-architecture";
import type { Module } from "@/content/courses/types";

export const moduleReact: Module = {
  title: "React",
  chapters: [
    chapterReactMentalModel,
    chapterPropsStateEvents,
    chapterUseeffectAndSync,
    chapterRefsAndDom,
    chapterStateArchitecture,
  ],
};
