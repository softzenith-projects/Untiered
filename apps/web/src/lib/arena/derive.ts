import type { Block, Chapter, Course } from "@/content/courses/types";
import { cyrb53, mulberry32, shuffle } from "@/lib/arena/hash";
import { orderedQuiz } from "@/lib/quiz-order";
import type { Challenge, ChallengeKind } from "@/lib/arena/types";

/**
 * Pure derivation of Arena challenges from course content (task 055). No I/O, no
 * randomness from the environment (`Math.random`, `Date.now`), and no hand-authored
 * question bank — see the module doc in the task file for the full rationale.
 *
 * Everything here is deterministic in two senses that matter:
 * 1. Calling `deriveChallenges(courses)` twice on the same content returns the same
 *    challenges with the same ids, in the same order.
 * 2. A challenge's id depends on its content and its location, never on where it sits
 *    in the output array — inserting a chapter elsewhere never renumbers anyone's saved
 *    progress on an unrelated challenge.
 */

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

/**
 * Builds a shuffled option list for one challenge, deterministically, from a correct
 * answer and a pool of real (never invented) candidate distractors.
 *
 * Returns `null` when the pool cannot honestly supply even one distractor — the caller
 * drops the challenge rather than inventing a wrong answer that might secretly be right.
 */
function buildOptions(
  seedKey: string,
  correct: string,
  distractorPool: string[],
): { options: string[]; correctIndex: number } | null {
  const distinct = Array.from(new Set(distractorPool.map((v) => v.trim()).filter((v) => v.length > 0)))
    .filter((v) => v !== correct.trim());
  if (distinct.length < MIN_OPTIONS - 1) return null;

  const rng = mulberry32(cyrb53(seedKey) >>> 0);
  const shuffledPool = shuffle(distinct, rng);
  const distractors = shuffledPool.slice(0, Math.min(shuffledPool.length, MAX_OPTIONS - 1));
  const options = shuffle([correct, ...distractors], rng);
  const correctIndex = options.indexOf(correct);
  return { options, correctIndex };
}

/** Appends a numeric suffix on the rare case of a genuine content collision (two blocks
 * with identical discriminating text in the same chapter), so ids stay unique without
 * ever depending on array position. */
function uniqueId(base: string, used: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function challengeIdBase(kind: ChallengeKind, courseSlug: string, chapterSlug: string, discriminator: string): string {
  const hash = cyrb53(`${kind}|${courseSlug}|${chapterSlug}|${discriminator}`).toString(36);
  return `${kind}-${courseSlug}-${chapterSlug}-${hash}`;
}

interface ChapterLoc {
  course: Course;
  courseModule: { title: string };
  chapter: Chapter;
}

/**
 * Where the question comes from, and nothing more. This used to append the chapter's
 * summary, and a summary states the chapter's key idea, so it often answered the question
 * printed under it ("cost grows with the square of its length", above "why does a 12-turn
 * run cost more than 12 calls?").
 */
function lessonContext(loc: ChapterLoc): string {
  return `From “${loc.chapter.title}”.`;
}

function locations(courses: Course[]): ChapterLoc[] {
  const out: ChapterLoc[] = [];
  for (const course of courses) {
    for (const courseModule of course.modules) {
      for (const chapter of courseModule.chapters) {
        out.push({ course, courseModule, chapter });
      }
    }
  }
  return out;
}

type CodeBlock = Extract<Block, { kind: "code" }>;
type PlaygroundBlock = Extract<Block, { kind: "playground" }>;
type PitfallBlock = Extract<Block, { kind: "pitfall" }>;
type CompareBlock = Extract<Block, { kind: "compare" }>;
type VizBlockData = Extract<Block, { kind: "viz" }>;
type QuizBlock = Extract<Block, { kind: "quiz" }>;

const PITFALL_SPLIT = " — ";

function splitPitfallItem(item: string): { mistake: string; explanation: string } | null {
  const idx = item.indexOf(PITFALL_SPLIT);
  if (idx <= 0) return null;
  const mistake = item.slice(0, idx).trim();
  const explanation = item.slice(idx + PITFALL_SPLIT.length).trim();
  if (mistake.length === 0 || explanation.length === 0) return null;
  return { mistake, explanation };
}

/** Real output strings available in a course, for `predict-output` distractor pools —
 * pooled per course so a small chapter still has enough honest wrong answers to draw on. */
function courseOutputPool(loc: ChapterLoc[], courseSlug: string): string[] {
  const outputs: string[] = [];
  for (const entry of loc) {
    if (entry.course.slug !== courseSlug) continue;
    for (const block of entry.chapter.blocks) {
      if (block.kind === "code" && block.output) outputs.push(block.output);
      if (block.kind === "playground" && block.expectedOutput) outputs.push(block.expectedOutput);
    }
  }
  return outputs;
}

function deriveMcq(loc: ChapterLoc, used: Set<string>): Challenge[] {
  const quizzes = loc.chapter.blocks.filter((b): b is QuizBlock => b.kind === "quiz");
  return quizzes.map((quiz) => {
    const base = challengeIdBase("mcq", loc.course.slug, loc.chapter.slug, quiz.question);
    const shown = orderedQuiz(quiz);
    return {
      id: uniqueId(base, used),
      kind: "mcq" as const,
      courseSlug: loc.course.slug,
      chapterSlug: loc.chapter.slug,
      moduleTitle: loc.courseModule.title,
      context: lessonContext(loc),
      prompt: quiz.question,
      options: shown.options,
      correctIndex: shown.answer,
      why: quiz.why,
    };
  });
}

function derivePredictOutput(loc: ChapterLoc, pool: string[], used: Set<string>): Challenge[] {
  const out: Challenge[] = [];

  const codeBlocks = loc.chapter.blocks.filter(
    (b): b is CodeBlock => b.kind === "code" && Boolean(b.output && b.output.trim().length > 0),
  );
  for (const block of codeBlocks) {
    const correct = block.output!;
    const built = buildOptions(
      challengeIdBase("predict-output", loc.course.slug, loc.chapter.slug, block.code),
      correct,
      pool,
    );
    if (!built) continue;
    const base = challengeIdBase("predict-output", loc.course.slug, loc.chapter.slug, block.code);
    out.push({
      id: uniqueId(base, used),
      kind: "predict-output",
      courseSlug: loc.course.slug,
      chapterSlug: loc.chapter.slug,
      moduleTitle: loc.courseModule.title,
      context: lessonContext(loc),
      prompt: "What does this program print?",
      options: built.options,
      correctIndex: built.correctIndex,
      why: `This is the real, verified output of the program above${block.caption ? ` (${block.caption})` : ""}.`,
      code: block.code,
      // The course says what its `code` blocks are written in (task 057) — the Arena must
      // not label a Python sample "java" just because the first two courses were Java.
      codeLanguage: loc.course.codeLanguage ?? "java",
    });
  }

  const playgroundBlocks = loc.chapter.blocks.filter(
    (b): b is PlaygroundBlock =>
      b.kind === "playground" && b.language !== "java" && Boolean(b.expectedOutput && b.expectedOutput.trim().length > 0),
  );
  for (const block of playgroundBlocks) {
    const correct = block.expectedOutput!;
    const built = buildOptions(
      challengeIdBase("predict-output", loc.course.slug, loc.chapter.slug, block.starter),
      correct,
      pool,
    );
    if (!built) continue;
    const base = challengeIdBase("predict-output", loc.course.slug, loc.chapter.slug, block.starter);
    out.push({
      id: uniqueId(base, used),
      kind: "predict-output",
      courseSlug: loc.course.slug,
      chapterSlug: loc.chapter.slug,
      moduleTitle: loc.courseModule.title,
      context: lessonContext(loc),
      prompt: "What should running this code print?",
      options: built.options,
      correctIndex: built.correctIndex,
      why: "This is the real, run-and-checked output of the code above.",
      code: block.starter,
      codeLanguage: block.language,
    });
  }

  return out;
}

function deriveSpotMistake(loc: ChapterLoc, used: Set<string>): Challenge[] {
  const pitfallBlocks = loc.chapter.blocks.filter((b): b is PitfallBlock => b.kind === "pitfall");
  const allSplit = pitfallBlocks
    .flatMap((block) => block.items)
    .map(splitPitfallItem)
    .filter((v): v is { mistake: string; explanation: string } => v !== null);

  const out: Challenge[] = [];
  for (const item of allSplit) {
    const pool = allSplit.filter((other) => other !== item).map((other) => other.explanation);
    const built = buildOptions(
      challengeIdBase("spot-mistake", loc.course.slug, loc.chapter.slug, item.mistake),
      item.explanation,
      pool,
    );
    if (!built) continue;
    const base = challengeIdBase("spot-mistake", loc.course.slug, loc.chapter.slug, item.mistake);
    out.push({
      id: uniqueId(base, used),
      kind: "spot-mistake",
      courseSlug: loc.course.slug,
      chapterSlug: loc.chapter.slug,
      moduleTitle: loc.courseModule.title,
      context: lessonContext(loc),
      prompt: `A common mistake here: "${item.mistake}". What actually goes wrong?`,
      options: built.options,
      correctIndex: built.correctIndex,
      why: item.explanation,
    });
  }
  return out;
}

function deriveWhichColumn(loc: ChapterLoc, used: Set<string>): Challenge[] {
  const compareBlocks = loc.chapter.blocks.filter((b): b is CompareBlock => b.kind === "compare");
  const out: Challenge[] = [];
  for (const block of compareBlocks) {
    if (block.columns.length < 2) continue;
    const labels = block.columns.map((c) => c.label);
    for (const column of block.columns) {
      const otherLabels = labels.filter((l) => l !== column.label);
      for (const item of column.items) {
        const built = buildOptions(
          challengeIdBase("which-column", loc.course.slug, loc.chapter.slug, `${column.label}::${item}`),
          column.label,
          otherLabels,
        );
        if (!built) continue;
        const base = challengeIdBase("which-column", loc.course.slug, loc.chapter.slug, `${column.label}::${item}`);
        out.push({
          id: uniqueId(base, used),
          kind: "which-column",
          courseSlug: loc.course.slug,
          chapterSlug: loc.chapter.slug,
          moduleTitle: loc.courseModule.title,
          context:
            `${lessonContext(loc)} ` +
            `Use the ${block.title ? `“${block.title}”` : "lesson"} comparison to classify this example: “${item}”`,
          prompt: "Which category does this example belong to?",
          options: built.options,
          correctIndex: built.correctIndex,
          why:
            `“${item}” belongs to “${column.label}”` +
            `${block.title ? ` in the lesson's “${block.title}” comparison` : " in this lesson"}.`,
        });
      }
    }
  }
  return out;
}

function deriveWhatNext(loc: ChapterLoc, used: Set<string>): Challenge[] {
  const vizBlocks = loc.chapter.blocks.filter((b): b is VizBlockData => b.kind === "viz");
  const out: Challenge[] = [];
  for (const block of vizBlocks) {
    const frames = block.viz.frames;
    if (frames.length < 2) continue;
    for (let i = 0; i < frames.length - 1; i++) {
      const correct = frames[i + 1]!.note;
      const otherNotes = frames.filter((_, idx) => idx !== i && idx !== i + 1).map((f) => f.note);
      const built = buildOptions(
        challengeIdBase("what-next", loc.course.slug, loc.chapter.slug, `${block.title}::${i}`),
        correct,
        otherNotes,
      );
      if (!built) continue;
      const base = challengeIdBase("what-next", loc.course.slug, loc.chapter.slug, `${block.title}::${i}`);
      out.push({
        id: uniqueId(base, used),
        kind: "what-next",
        courseSlug: loc.course.slug,
        chapterSlug: loc.chapter.slug,
        moduleTitle: loc.courseModule.title,
        context: `${lessonContext(loc)} Read the current diagram state, then choose the next change in the sequence.`,
        prompt: "What does the next step say?",
        options: built.options,
        correctIndex: built.correctIndex,
        why: correct,
        viz: block.viz,
        frameIndex: i,
      });
    }
  }
  return out;
}

/**
 * Derives every Arena challenge from the given courses. Pure and synchronous: no I/O, no
 * `Math.random`, no clock. Calling this twice on the same `courses` returns identical
 * output, including ids — that is what makes a learner's saved progress (keyed by
 * challenge id) safe across a rebuild.
 */
export function deriveChallenges(courses: Course[]): Challenge[] {
  const loc = locations(courses);
  const used = new Set<string>();
  const out: Challenge[] = [];

  for (const entry of loc) {
    out.push(...deriveMcq(entry, used));
  }
  for (const entry of loc) {
    const pool = courseOutputPool(loc, entry.course.slug);
    out.push(...derivePredictOutput(entry, pool, used));
  }
  for (const entry of loc) {
    out.push(...deriveSpotMistake(entry, used));
  }
  for (const entry of loc) {
    out.push(...deriveWhichColumn(entry, used));
  }
  for (const entry of loc) {
    out.push(...deriveWhatNext(entry, used));
  }

  return out;
}
