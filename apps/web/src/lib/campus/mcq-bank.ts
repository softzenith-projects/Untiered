import type { CampusTopic } from "@untiered/shared";

import type { Course } from "@/content/courses/types";
import { deriveChallenges } from "@/lib/arena/derive";
import { cyrb53 } from "@/lib/arena/hash";

/**
 * The campus MCQ bank (contract "Module 4b"), exported from the multiple-choice questions the
 * courses already contain — never written fresh. Every entry is a course-derived Arena
 * challenge of kind `mcq` (a chapter's `quiz` block, in the order the course shows its
 * options), so a question a college sets is word for word one a student can read in a chapter.
 *
 * This module is for the exporter and its drift test only. It imports the whole course
 * content, so no page or component may import it (`client-boundary.test.ts` would not catch a
 * server component doing so, but nothing needs to: the bank is served by the API).
 *
 * Regenerate with `node scripts/export-mcq-bank.mjs` after a course changes; the drift test
 * (`mcq-bank.test.ts`) fails until you do.
 */

export interface McqBankQuestion {
  /** The Arena challenge id: stable, derived from course, chapter and question text. */
  id: string;
  courseSlug: string;
  courseTitle: string;
  chapterSlug: string;
  topic: CampusTopic | null;
  prompt: string;
  code: string | null;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}

/**
 * A course's campus topic, only where it is true: the DSA course is DSA, the Java course is
 * object-oriented programming, the system design course is system design. Every other course
 * (JavaScript, AI agents) has no campus topic, and its questions carry none.
 */
export const MCQ_COURSE_TOPIC: Readonly<Record<string, CampusTopic>> = {
  dsa: "dsa",
  java: "oops",
  "system-design": "system_design",
};

const OPTION_IDS = ["a", "b", "c", "d", "e", "f"];

export const MCQ_BANK_MIGRATION = "supabase/migrations/20261114130000_campus_mcq_bank.sql";

export function mcqBank(courses: Course[]): McqBankQuestion[] {
  const titles = new Map(courses.map((course) => [course.slug, course.title]));
  return deriveChallenges(courses)
    .filter((challenge) => challenge.kind === "mcq")
    .map((challenge) => {
      if (challenge.options.length > OPTION_IDS.length) {
        throw new Error(`${challenge.id} has ${challenge.options.length} options; the bank allows ${OPTION_IDS.length}.`);
      }
      const options = challenge.options.map((text, index) => ({ id: OPTION_IDS[index]!, text }));
      const correct = options[challenge.correctIndex];
      if (!correct) throw new Error(`${challenge.id} has no correct option.`);
      return {
        id: challenge.id,
        courseSlug: challenge.courseSlug,
        courseTitle: titles.get(challenge.courseSlug) ?? challenge.courseSlug,
        chapterSlug: challenge.chapterSlug,
        topic: MCQ_COURSE_TOPIC[challenge.courseSlug] ?? null,
        prompt: challenge.prompt,
        code: challenge.code ?? null,
        options,
        correctOptionId: correct.id,
        explanation: challenge.why,
      };
    });
}

/** A short fingerprint of the whole bank, written into the migration's header. */
export function bankDigest(bank: McqBankQuestion[]): string {
  return cyrb53(JSON.stringify(bank)).toString(36);
}

function literal(value: string | null): string {
  if (value === null) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The seed migration for [bank]: an upsert per question keyed by its id, then every question
 * no longer in the content is retired (never deleted, so a submitted attempt can still be
 * reviewed against the exact question it drew). Running it twice changes nothing.
 */
export function renderBankMigration(bank: McqBankQuestion[]): string {
  const perCourse = new Map<string, number>();
  for (const question of bank) perCourse.set(question.courseSlug, (perCourse.get(question.courseSlug) ?? 0) + 1);
  const counts = [...perCourse.entries()].map(([slug, n]) => `--   ${slug}: ${n}`).join("\n");
  const rows = bank
    .map((q) =>
      [
        literal(q.id),
        literal(q.courseSlug),
        literal(q.courseTitle),
        literal(q.chapterSlug),
        literal(q.topic),
        literal(q.prompt),
        literal(q.code),
        `${literal(JSON.stringify(q.options))}::jsonb`,
        literal(q.correctOptionId),
        literal(q.explanation),
      ].join(", "),
    )
    .map((row) => `  (${row})`)
    .join(",\n");
  return `-- Untiered Campus: the MCQ bank (contract "Module 4b"). GENERATED — do not edit by hand.
--
-- Every row is a multiple-choice question that already exists in the course content (a
-- chapter's quiz block, as the Arena derives it); nothing here was written for the bank.
-- Regenerate after a course changes with:
--
--   node scripts/export-mcq-bank.mjs
--
-- which rewrites this file from apps/web/src/lib/campus/mcq-bank.ts. A later regeneration
-- belongs in a new migration (copy this file under a new timestamp), since an applied
-- migration does not run again.
--
-- Idempotent: an upsert per question keyed by its stable id, then any live question no longer
-- in the content is retired. Questions are never deleted, so a submitted attempt can always be
-- reviewed against the exact question it drew.
--
-- Questions: ${bank.length} (digest ${bankDigest(bank)})
${counts}

insert into public.mcq_questions
  (id, course_slug, course_title, chapter_slug, topic, prompt, code, options, correct_option_id, explanation)
values
${rows}
on conflict (id) do update set
  course_slug = excluded.course_slug,
  course_title = excluded.course_title,
  chapter_slug = excluded.chapter_slug,
  topic = excluded.topic,
  prompt = excluded.prompt,
  code = excluded.code,
  options = excluded.options,
  correct_option_id = excluded.correct_option_id,
  explanation = excluded.explanation,
  status = 'live'
where (mcq_questions.course_slug, mcq_questions.course_title, mcq_questions.chapter_slug, mcq_questions.topic,
       mcq_questions.prompt, mcq_questions.code, mcq_questions.options, mcq_questions.correct_option_id,
       mcq_questions.explanation, mcq_questions.status)
      is distinct from
      (excluded.course_slug, excluded.course_title, excluded.chapter_slug, excluded.topic,
       excluded.prompt, excluded.code, excluded.options, excluded.correct_option_id,
       excluded.explanation, 'live');

update public.mcq_questions
   set status = 'retired'
 where status = 'live'
   and id not in (
${bank.map((q) => `     ${literal(q.id)}`).join(",\n")}
   );
`;
}
