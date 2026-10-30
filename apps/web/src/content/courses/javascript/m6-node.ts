import type { Module } from "@/content/courses/types";
import { chapterNodeRuntimeAndModules } from "./35-node-runtime-and-modules";
import { chapterNodeEventLoopAndStreams } from "./36-node-event-loop-and-streams";
import { chapterHttpAndExpress } from "./37-http-and-express";
import { chapterAuthAndData } from "./38-auth-and-data";
import { chapterScalingAndTestingNode } from "./39-scaling-and-testing-node";

export const moduleNode: Module = {
  title: "Node.js",
  chapters: [
    chapterNodeRuntimeAndModules,
    chapterNodeEventLoopAndStreams,
    chapterHttpAndExpress,
    chapterAuthAndData,
    chapterScalingAndTestingNode,
  ],
};
