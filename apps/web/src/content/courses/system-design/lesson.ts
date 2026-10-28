import type { Block, Chapter } from "@/content/courses/types";
import { labIntroductions, type LabId } from "@/content/courses/system-design/labs";
import { type ChapterSpec, makeChapter } from "@/content/courses/system-design/legacy-template";

/** A quiz with exactly four options. Write them in any order — they are shuffled on screen. */
export type QuizSpec = {
  question: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  /** Why the right answer is right, naming options by content, never by position. */
  why: string;
};

/**
 * One system design chapter, written out in full.
 *
 * It yields the same shape as every Java, DSA and AI Agents chapter — two opening
 * paragraphs, the picture, the teaching sections, then common mistakes, remember this,
 * the interview angle and three questions — so the four courses read as one product.
 * Every field is real prose for this chapter; nothing is stitched together from fragments
 * of other fields (that is what `legacy-template.ts` did, and why its chapters read alike).
 */
export type LessonSpec = {
  slug: string;
  title: string;
  summary: string;
  /** What the idea is in plain words, then why it matters — one short paragraph each. */
  intro: [string, string];
  analogy: [title: string, text: string];
  /** Three to five terms. Each meaning is a full sentence starting with a capital. */
  glossary: [term: string, meaning: string][];
  /** One request or event followed through the design, three or four steps, each with its own text. */
  walkthrough: { title: string; steps: { label: string; text: string }[] };
  example: { title: string; text: string };
  tradeoff: {
    title: string;
    gain: { label: string; items: string[] };
    cost: { label: string; items: string[] };
  };
  artifact?: Extract<Block, { kind: "compare" | "table" | "code" }>;
  lab?: LabId;
  /** Two or three mistakes specific to this topic. */
  pitfalls: string[];
  /** Three to five short lines worth keeping after everything else is forgotten. */
  remember: string[];
  /** Two or three ways this comes up in an interview, and what a strong answer does. */
  interview: string[];
  quizzes: [QuizSpec, QuizSpec, QuizSpec];
};

/** A module may mix written lessons and not-yet-rewritten template chapters during the move. */
export type ChapterSource = LessonSpec | ChapterSpec;

function isLesson(source: ChapterSource): source is LessonSpec {
  return "quizzes" in source;
}

export function buildChapter(source: ChapterSource, minutes: number): Chapter {
  return isLesson(source) ? makeLesson(source, minutes) : makeChapter(source, minutes);
}

export function makeLesson(spec: LessonSpec, minutes: number): Chapter {
  const blocks: Block[] = [
    { kind: "p", text: spec.intro[0] },
    { kind: "p", text: spec.intro[1] },
    { kind: "analogy", title: spec.analogy[0], text: spec.analogy[1] },
    { kind: "h", text: "The words you need" },
    { kind: "table", head: ["Term", "What it means"], rows: spec.glossary },
    { kind: "h", text: spec.walkthrough.title },
    { kind: "steps", steps: spec.walkthrough.steps },
    { kind: "concept", title: spec.example.title, text: spec.example.text },
    {
      kind: "compare",
      title: spec.tradeoff.title,
      columns: [spec.tradeoff.gain, spec.tradeoff.cost],
    },
  ];

  if (spec.artifact) blocks.push(spec.artifact);

  if (spec.lab) {
    blocks.push(
      { kind: "h", text: "Try it: build the path yourself" },
      { kind: "p", text: labIntroductions[spec.lab] },
      { kind: "architecturelab", scenarioId: spec.lab },
    );
  }

  blocks.push(
    { kind: "pitfall", items: spec.pitfalls },
    { kind: "remember", items: spec.remember },
    { kind: "interview", items: spec.interview },
    ...spec.quizzes.map((quiz): Block => ({ kind: "quiz", ...quiz })),
  );

  return { slug: spec.slug, title: spec.title, summary: spec.summary, minutes, blocks };
}
