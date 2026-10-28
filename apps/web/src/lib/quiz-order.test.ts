import { describe, expect, it } from "vitest";

import { courses } from "@/content/courses";
import { orderedQuiz } from "@/lib/quiz-order";

const allQuizzes = courses.flatMap((course) =>
  course.modules.flatMap((module) =>
    module.chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.kind === "quiz")),
  ),
);

describe("orderedQuiz", () => {
  it("keeps the correct answer pointing at the same option text", () => {
    for (const quiz of allQuizzes) {
      const shown = orderedQuiz(quiz);
      expect(shown.options[shown.answer]).toBe(quiz.options[quiz.answer]);
      expect([...shown.options].sort()).toEqual([...quiz.options].sort());
    }
  });

  it("gives the same order every time, so server and browser agree", () => {
    for (const quiz of allQuizzes.slice(0, 50)) {
      expect(orderedQuiz(quiz)).toEqual(orderedQuiz(quiz));
    }
  });

  /*
   * Authors put the right answer second in about four quizzes out of five; the old system
   * design template always put it first. Whatever order content is written in, what the
   * reader sees must not make one letter a safe guess.
   */
  it("does not let any one position carry the answer in most quizzes", () => {
    const positions = [0, 0, 0, 0];
    for (const quiz of allQuizzes) positions[orderedQuiz(quiz).answer]! += 1;
    for (const count of positions) {
      expect(count / allQuizzes.length).toBeLessThan(0.4);
    }
  });
});
