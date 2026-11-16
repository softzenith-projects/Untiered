import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { courses } from "@/content/courses";
import { deriveChallenges } from "@/lib/arena/derive";
import { MCQ_BANK_MIGRATION, MCQ_COURSE_TOPIC, mcqBank, renderBankMigration } from "@/lib/campus/mcq-bank";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const MIGRATION_PATH = path.join(REPO_ROOT, MCQ_BANK_MIGRATION);

const bank = mcqBank(courses);

// Importing the whole course content is slow on a cold start, hence the longer timeout.
describe("campus MCQ bank", { timeout: 60_000 }, () => {
  it("is exactly the course-derived mcq challenges, with nothing added", () => {
    const fromContent = deriveChallenges(courses).filter((c) => c.kind === "mcq");
    expect(bank.map((q) => q.id)).toEqual(fromContent.map((c) => c.id));
    for (const [index, question] of bank.entries()) {
      const source = fromContent[index]!;
      expect(question.prompt).toBe(source.prompt);
      expect(question.options.map((o) => o.text)).toEqual(source.options);
      expect(question.options.findIndex((o) => o.id === question.correctOptionId)).toBe(source.correctIndex);
      expect(question.explanation).toBe(source.why);
    }
  });

  it("has unique ids, two or more options and an explanation for every question", () => {
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length);
    for (const question of bank) {
      expect(question.id).toMatch(/^[a-z0-9-]+$/);
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.explanation.trim().length).toBeGreaterThan(0);
    }
  });

  it("maps a course to a campus topic only where it is true", () => {
    expect(MCQ_COURSE_TOPIC).toEqual({ dsa: "dsa", java: "oops", "system-design": "system_design" });
    for (const question of bank) {
      expect(question.topic).toBe(MCQ_COURSE_TOPIC[question.courseSlug] ?? null);
    }
    expect(bank.some((q) => q.courseSlug === "javascript" && q.topic === null)).toBe(true);
  });

  /**
   * The committed seed migration must be exactly what the content produces today. When a course
   * changes, this fails: run `node scripts/export-mcq-bank.mjs` (which re-runs this file with
   * MCQ_BANK_WRITE=1) and commit the result.
   */
  it("matches the committed seed migration", () => {
    const rendered = renderBankMigration(bank);
    if (process.env.MCQ_BANK_WRITE === "1") {
      writeFileSync(MIGRATION_PATH, rendered, "utf8");
    }
    const committed = readFileSync(MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");
    const committedIds = [...committed.matchAll(/^ {2}\('([a-z0-9-]+)', /gm)].map((m) => m[1]);
    expect(committedIds.length, "question count in the seed migration").toBe(bank.length);
    expect(committedIds, "question ids in the seed migration").toEqual(bank.map((q) => q.id));
    expect(committed, "regenerate with: node scripts/export-mcq-bank.mjs").toBe(rendered);
  });
});
