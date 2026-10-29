import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";
import { LessonNote } from "@/components/courses/lesson-box";

type ConceptBlockData = Extract<Block, { kind: "concept" }>;

/**
 * A worked concept or example (task 052), in the green "positive" tone so a reader can tell
 * it apart from the blue picture/remember boxes and the red mistakes box at a glance.
 */
export function ConceptCard({ block }: { block: ConceptBlockData }) {
  return (
    <LessonNote tone="positive" label="Concept" title={block.title}>
      <p className="text-body leading-relaxed text-ink">
        <InlineText text={block.text} />
      </p>
    </LessonNote>
  );
}
