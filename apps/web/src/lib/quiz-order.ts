import type { Block } from "@/content/courses/types";
import { cyrb53, mulberry32, shuffle } from "@/lib/arena/hash";

type Quiz = Extract<Block, { kind: "quiz" }>;

/**
 * The order a quiz's options are shown in, seeded from its question.
 *
 * Authors wrote the correct answer second in about four quizzes out of five, and the
 * system design template always wrote it first — so "pick B" (or "pick A") passed most of
 * a course. Rather than hand-reordering 400 option lists and policing every new one, the
 * reader sees them in a fixed shuffled order: the same on the server and in the browser
 * (so no hydration mismatch), the same every visit, and the same in the course and the
 * Arena. The content keeps the order its author found natural to write.
 *
 * Because of this, a quiz's `why` must never refer to an option by position.
 */
export function orderedQuiz(quiz: Pick<Quiz, "question" | "options" | "answer">): { options: string[]; answer: number } {
  const rng = mulberry32(cyrb53(`quiz|${quiz.question}`) >>> 0);
  const order = shuffle(
    quiz.options.map((_, index) => index),
    rng,
  );
  return {
    options: order.map((index) => quiz.options[index]!),
    answer: order.indexOf(quiz.answer),
  };
}
