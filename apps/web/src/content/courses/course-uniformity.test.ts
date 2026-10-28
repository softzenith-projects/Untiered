import { describe, expect, it } from "vitest";

import { courses } from "@/content/courses";

/**
 * The four courses are one product, so every chapter in every course has the same shape:
 * it opens with prose and a heading that introduces the picture (analogy), and it closes
 * with the same boxes in the same order, then any hands-on practice. A reader who learns where "Common mistakes" and
 * "Check yourself" sit in one chapter finds them in the same place in every other.
 */
const CLOSING = ["pitfall", "remember", "interview", "quiz", "quiz", "quiz"];
/** The optional hands-on section a chapter may end with, after its questions. */
const PRACTICE_HEADINGS = ["Practice problems", "Try this yourself"];

describe.each(courses.map((course) => [course.slug, course] as const))("course %s", (_slug, course) => {
  const chapters = course.modules.flatMap((module) => module.chapters);

  it("opens every chapter with prose, then a heading that introduces the picture", () => {
    for (const chapter of chapters) {
      const kinds = chapter.blocks.map((block) => block.kind);
      const firstHeading = kinds.indexOf("h");
      expect(kinds[0], chapter.slug).toBe("p");
      expect(kinds[firstHeading + 1], chapter.slug).toBe("analogy");
    }
  });

  it("closes every chapter with mistakes, remember this, the interview angle, three questions, then any practice", () => {
    for (const chapter of chapters) {
      const kinds: string[] = chapter.blocks.map((block) => block.kind);
      const last = chapter.blocks.at(-2);
      const hasPractice = last?.kind === "h" && PRACTICE_HEADINGS.includes(last.text);
      const ending = hasPractice ? kinds.slice(-CLOSING.length - 2, -2) : kinds.slice(-CLOSING.length);
      expect(ending, chapter.slug).toEqual(CLOSING);
      if (hasPractice) expect(kinds.at(-1), chapter.slug).toBe("list");
      for (const single of ["analogy", "pitfall", "remember", "interview"] as const) {
        expect(kinds.filter((kind) => kind === single), `${chapter.slug}: ${single}`).toHaveLength(1);
      }
    }
  });

  /*
   * Wrong options used to be short and vague and the right one long and qualified, so
   * "pick the longest" passed most quizzes. With four options, chance is 25%; anything
   * near it means length no longer gives the answer away.
   */
  it("does not let the longest option give the answer away", () => {
    const quizzes = chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.kind === "quiz"));
    const longest = quizzes.filter((quiz) => {
      const correct = quiz.options[quiz.answer]!.length;
      return quiz.options.every((option, index) => index === quiz.answer || option.length < correct);
    });
    expect(longest.length / quizzes.length).toBeLessThanOrEqual(0.4);
  });
});
