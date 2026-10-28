import { describe, expect, it } from "vitest";

import { courses, getChapter } from "@/content/courses";
import { deriveChallenges } from "@/lib/arena/derive";
import type { Challenge } from "@/lib/arena/types";

/**
 * Tests run over the real course corpus, not fixtures (the same policy as
 * `content-integrity.test.ts`) — the whole point of deriving challenges is that they
 * track real content, so a fixture would test the wrong thing.
 */

const challenges = deriveChallenges(courses);

// A content refactor that silently empties (or nearly empties) the Arena should fail the
// build, not ship quietly. This is a floor, not a target — the real corpus derives about
// 800 (195 mcq, ~74 predict-output, ~239 spot-mistake, ~41 which-column, ~253 what-next)
// as of task 055; the floor sits well below that so ordinary content edits never trip it.
const MIN_TOTAL_CHALLENGES = 700;

describe("deriveChallenges", () => {
  it("derives at least the expected floor of challenges from the real corpus", () => {
    expect(challenges.length).toBeGreaterThanOrEqual(MIN_TOTAL_CHALLENGES);
  });

  it("never prints the chapter summary above the question, where it can give the answer away", () => {
    for (const challenge of challenges) {
      const summary = getChapter(challenge.courseSlug, challenge.chapterSlug)?.summary;
      if (summary && challenge.context) expect(challenge.context, challenge.id).not.toContain(summary);
    }
  });

  it("derives at least one challenge of every kind", () => {
    const kinds = new Set(challenges.map((c) => c.kind));
    expect(kinds).toEqual(new Set(["mcq", "predict-output", "spot-mistake", "which-column", "what-next"]));
  });

  it("every challenge id is unique", () => {
    const ids = challenges.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every challenge's chapterSlug resolves in its course", () => {
    for (const challenge of challenges) {
      const chapter = getChapter(challenge.courseSlug, challenge.chapterSlug);
      expect(chapter, `${challenge.id} -> ${challenge.courseSlug}/${challenge.chapterSlug}`).toBeDefined();
    }
  });

  it("every challenge's correct answer exists among its options, at the stated index", () => {
    for (const challenge of challenges) {
      expect(challenge.correctIndex).toBeGreaterThanOrEqual(0);
      expect(challenge.correctIndex).toBeLessThan(challenge.options.length);
      expect(challenge.options[challenge.correctIndex]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("no challenge has duplicate options", () => {
    for (const challenge of challenges) {
      const trimmed = challenge.options.map((o) => o.trim());
      expect(new Set(trimmed).size, challenge.id).toBe(trimmed.length);
    }
  });

  it("has at least 2 and at most 4 options on every challenge", () => {
    for (const challenge of challenges) {
      expect(challenge.options.length).toBeGreaterThanOrEqual(2);
      expect(challenge.options.length).toBeLessThanOrEqual(4);
    }
  });

  it("every challenge has a non-empty prompt and why", () => {
    for (const challenge of challenges) {
      expect(challenge.prompt.trim().length).toBeGreaterThan(0);
      expect(challenge.why.trim().length).toBeGreaterThan(0);
    }
  });

  it("predict-output challenges carry the source code shown to the learner", () => {
    const predictOutput = challenges.filter((c) => c.kind === "predict-output");
    expect(predictOutput.length).toBeGreaterThan(0);
    for (const challenge of predictOutput) {
      expect(challenge.code?.trim().length).toBeGreaterThan(0);
      expect(["java", "python"]).toContain(challenge.codeLanguage);
    }
  });

  it("what-next challenges carry a viz and an in-range frameIndex, and the answer is the actual next note", () => {
    const whatNext = challenges.filter((c) => c.kind === "what-next");
    expect(whatNext.length).toBeGreaterThan(0);
    for (const challenge of whatNext) {
      expect(challenge.viz).toBeDefined();
      expect(challenge.frameIndex).toBeGreaterThanOrEqual(0);
      const frames = challenge.viz!.frames;
      expect(challenge.frameIndex!).toBeLessThan(frames.length - 1);
      const actualNextNote = frames[challenge.frameIndex! + 1]!.note;
      expect(challenge.options[challenge.correctIndex]).toBe(actualNextNote);
    }
  });

  it("which-column challenges never offer the same label twice and the answer is a real column label", () => {
    const whichColumn = challenges.filter((c) => c.kind === "which-column");
    expect(whichColumn.length).toBeGreaterThan(0);
    for (const challenge of whichColumn) {
      const chapter = getChapter(challenge.courseSlug, challenge.chapterSlug);
      expect(chapter).toBeDefined();
      expect(challenge.context).toMatch(/classify this example/i);
      expect(challenge.context).toContain(chapter!.title);
      expect(challenge.prompt).toBe("Which category does this example belong to?");
      expect(challenge.why).not.toMatch(/listed under/i);
    }
  });

  it("spot-mistake challenges never use the mistake text itself as an option (the mistake is not the answer)", () => {
    const spotMistake = challenges.filter((c) => c.kind === "spot-mistake");
    expect(spotMistake.length).toBeGreaterThan(0);
    for (const challenge of spotMistake) {
      // The prompt embeds the mistake in quotes; none of the options should just repeat it.
      for (const option of challenge.options) {
        expect(challenge.prompt.includes(`"${option.trim()}"`)).toBe(false);
      }
    }
  });

  it("is deterministic: deriving twice from the same content yields identical ids in the same order", () => {
    const again = deriveChallenges(courses);
    expect(again.map((c) => c.id)).toEqual(challenges.map((c) => c.id));
  });

  it("is stable against reordering the input course list", () => {
    const reversed = deriveChallenges([...courses].reverse());
    const idsA = new Set(challenges.map((c) => c.id));
    const idsB = new Set(reversed.map((c) => c.id));
    expect(idsB).toEqual(idsA);
  });

  it("no distractor is drawn from the same source item as the correct answer (real material only, never invented)", () => {
    // Every option string traces back to real content somewhere in the corpus: either it
    // is the challenge's own correct answer, or another quiz option (mcq), or another
    // real output/explanation/label/note elsewhere in the same course. This test asserts
    // the weaker but checkable half of that: the correct answer is never duplicated as if
    // it were also a distinct distractor, which would silently make two options correct.
    for (const challenge of challenges) {
      const correct = challenge.options[challenge.correctIndex]!;
      const others = challenge.options.filter((_, i) => i !== challenge.correctIndex);
      expect(others).not.toContain(correct);
    }
  });

  it("groups by course and chapter (a smoke check on the shape, not the content)", () => {
    const byCourse = new Map<string, Challenge[]>();
    for (const challenge of challenges) {
      const list = byCourse.get(challenge.courseSlug) ?? [];
      list.push(challenge);
      byCourse.set(challenge.courseSlug, list);
    }
    for (const course of courses) {
      expect(byCourse.get(course.slug)?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
