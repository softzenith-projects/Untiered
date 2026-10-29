"use client";

import { useId, useState } from "react";

import { LessonPanel } from "@/components/courses/lesson-box";
import type { Block } from "@/content/courses/types";
import { orderedQuiz } from "@/lib/quiz-order";

type Quiz = Extract<Block, { kind: "quiz" }>;

/**
 * One quiz question. Picking an option reveals whether it was right, and always reveals
 * `why` — the point is to test understanding, not to score the reader (PRD design brief,
 * 15 Sep 2026: "quiz reveals the answer on interaction").
 *
 * Options are shown in `orderedQuiz` order, not authoring order, so the right answer is
 * not always in the same place.
 */
export function QuizBlock({ block }: { block: Quiz }) {
  const [selected, setSelected] = useState<number | null>(null);
  const groupId = useId();
  const revealed = selected !== null;
  const { options, answer } = orderedQuiz(block);

  return (
    <LessonPanel label="Check yourself" title={<h3 id={groupId} className="max-w-[60ch] leading-snug">{block.question}</h3>} as="div">
      <fieldset>
        <legend className="sr-only">Answer options</legend>
        <div className="grid gap-2.5" role="radiogroup" aria-labelledby={groupId}>
          {options.map((option, i) => {
            const isCorrect = i === answer;
            const isChosen = i === selected;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={isChosen}
                disabled={revealed}
                onClick={() => setSelected(i)}
                className={[
                  "group flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-body leading-relaxed text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  !revealed
                    ? "border-line bg-surface-raised hover:border-accent/45 hover:bg-accent-wash"
                    : isCorrect
                      ? "border-positive/50 bg-positive-wash"
                      : isChosen
                        ? "border-danger/50 bg-danger-wash"
                        : "border-line bg-surface-sunken text-ink-subtle",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-7 shrink-0 place-items-center rounded-md text-caption font-bold ${
                    isChosen && revealed
                      ? isCorrect
                        ? "bg-positive text-positive-contrast"
                        : "bg-danger text-danger-contrast"
                      : "bg-surface-sunken text-ink-muted group-hover:bg-surface-raised"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
                {revealed && isCorrect ? <span aria-hidden="true" className="text-positive">✓</span> : null}
              </button>
            );
          })}
        </div>
        {revealed ? (
          <p role="status" className="mt-4 rounded-lg border border-line bg-surface-sunken px-4 py-3 text-body leading-relaxed text-ink">
            <span className={selected === answer ? "font-medium text-positive" : "font-medium text-danger"}>
              {selected === answer ? "Correct. " : "Not quite. "}
            </span>
            {block.why}
          </p>
        ) : null}
      </fieldset>
    </LessonPanel>
  );
}
