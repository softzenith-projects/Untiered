import type { Viz } from "@/content/courses/types";

/**
 * Every kind of challenge the Arena can pose, and exactly what existing course content
 * each one is derived from (task 055). There is no seventh kind that hand-authors new
 * material — see `derive.ts`.
 *
 * - `mcq` — a `quiz` block, unchanged.
 * - `predict-output` — a `code` block with a real, pasted `output`, or a `playground`
 *   block with an `expectedOutput`. The learner is shown the source and asked what it
 *   prints, rather than being handed a live interpreter mid-run (that stays on the
 *   chapter page, where a wrong run costs nothing and there is no timer).
 * - `spot-mistake` — one item of a `pitfall` block, split on its own " — " into the
 *   mistake and the explanation of why it matters; the explanation is the answer.
 * - `which-column` — one item of a `compare` block; the answer is which column it
 *   actually belongs to.
 * - `what-next` — one frame of a `viz`; the learner is shown frame N and asked what the
 *   next frame's note says.
 */
export type ChallengeKind = "mcq" | "predict-output" | "spot-mistake" | "which-column" | "what-next";

/**
 * Provenance for a locally reviewed challenge adapted from an open educational source.
 * The revision is deliberately carried with the challenge so the attribution shown to a
 * learner describes the exact material we reviewed, not whatever later lands on `main`.
 */
export interface ChallengeSource {
  title: string;
  publisher: string;
  url: string;
  license: "MIT";
  revision: string;
  revisionDate: string;
  reviewedOn: string;
}

export interface Challenge {
  /**
   * Deterministic and derived from content, never an array index — inserting a chapter
   * elsewhere must never renumber a learner's saved progress on this one.
   */
  id: string;
  kind: ChallengeKind;
  courseSlug: string;
  chapterSlug: string;
  moduleTitle: string;
  /**
   * The chapter's display title, attached by `corpus.ts` so the result screen can name what
   * to revise without shipping the course content to the browser. Optional because the
   * derivation and the open-source supplement are built without it.
   */
  chapterTitle?: string;
  /** The minimum lesson/scenario context needed to answer without guessing. */
  context?: string;
  /** The question or scenario shown above the options. */
  prompt: string;
  options: string[];
  correctIndex: number;
  /** Shown as feedback immediately after answering — every derived kind has one. */
  why: string;
  /** Source shown above the prompt, for kind `predict-output` only. */
  code?: string;
  codeLanguage?: "java" | "python" | "javascript";
  /** The diagram to render at `frameIndex`, for kind `what-next` only. */
  viz?: Viz;
  frameIndex?: number;
  /** Present only for the small, locally vendored open-source supplement. */
  source?: ChallengeSource;
}
