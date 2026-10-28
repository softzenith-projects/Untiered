import type { Block, Chapter } from "@/content/courses/types";
import { labIntroductions, type LabId } from "@/content/courses/system-design/labs";

/**
 * The original fill-in-the-blanks chapter template, kept only while chapters move to
 * `lesson.ts`. Every sentence it produces is stitched from a handful of short strings, which
 * is why those chapters read alike. Delete this file once no module imports it.
 */
export type ChapterSpec = {
  slug: string;
  title: string;
  summary: string;
  analogy: [title: string, text: string];
  idea: string;
  flow: [string, string, string];
  best: string;
  check: string;
  pitfall: string;
  interview: string;
  /** One concrete, chapter-specific example written in original beginner-first language. */
  example: string;
  /** Short, plain-language definitions for terms a beginner is likely to meet here. */
  glossary: [term: string, meaning: string][];
  lab?: LabId;
  artifact?: Extract<Block, { kind: "compare" | "table" }>;
};


export function makeChapter(spec: ChapterSpec, minutes = 13): Chapter {
  const blocks: Block[] = [
    {
      kind: "h",
      text: "First, learn the words in plain language",
    },
    {
      kind: "p",
      text: spec.idea,
    },
    {
      kind: "table",
      head: ["Term", "What it means here"],
      rows: spec.glossary,
    },
    {
      kind: "analogy",
      title: spec.analogy[0],
      text: spec.analogy[1],
    },
    {
      kind: "steps",
      title: "Walk one real request through the design",
      steps: [
        { label: spec.flow[0], text: `Name the user action or data arriving at **${spec.flow[0]}**. ${spec.idea}` },
        { label: spec.flow[1], text: `At **${spec.flow[1]}**, make one owner responsible for the decision. ${spec.best}` },
        { label: spec.flow[2], text: `Trace the result through **${spec.flow[2]}** and test it under trouble. ${spec.check}` },
      ],
    },
    {
      kind: "concept",
      title: "Worked example",
      text: spec.example,
    },
    {
      kind: "compare",
      title: "The useful trade-off — and the failure it buys",
      columns: [
        { label: "Choice", items: [spec.best, `This directly supports: ${spec.summary}`] },
        { label: "Cost or failure to test", items: [spec.pitfall, spec.check] },
      ],
    },
  ];

  if (spec.artifact) blocks.push(spec.artifact);

  if (spec.lab) {
    blocks.push(
      { kind: "h", text: "Architecture lab: make the trade-off visible" },
      { kind: "p", text: labIntroductions[spec.lab] },
      { kind: "architecturelab", scenarioId: spec.lab },
    );
  }

  blocks.push(
    {
      kind: "pitfall",
      items: [spec.pitfall, "Adding a fashionable component without explaining the failure or load it handles."],
    },
    {
      kind: "remember",
      items: [
        `In plain language: ${spec.idea}`,
        ...spec.glossary.slice(0, 3).map(([term, meaning]) => `${term} means ${meaning}`),
        `The decision to remember: ${spec.best}`,
        `Before you trust the design, check this: ${spec.check}`,
        `Picture ${spec.analogy[0].toLowerCase()}: ${spec.analogy[1]}`,
        "Every box needs a job; every arrow needs data and a direction.",
      ],
    },
    {
      kind: "interview",
      items: [spec.interview, "Say the trade-off aloud and describe what would make you change the design."],
    },
    {
      kind: "quiz",
      question: `Which move is strongest when designing ${spec.title.toLowerCase()}?`,
      options: [spec.best, spec.pitfall, "Copy a large-company diagram before gathering requirements", "Optimise every component for maximum scale"],
      answer: 0,
      why: `The useful move is: ${spec.best} It connects a component to a requirement instead of decorating the diagram.`,
    },
    {
      kind: "quiz",
      question: "What should you verify before adding another box to this design?",
      options: ["Whether the box has a clear responsibility and solves a stated constraint", "Whether its logo looks familiar", "Whether it makes the diagram symmetrical", "Whether another candidate used it"],
      answer: 0,
      why: spec.check,
    },
  );

  return { slug: spec.slug, title: spec.title, summary: spec.summary, minutes, blocks };
}
