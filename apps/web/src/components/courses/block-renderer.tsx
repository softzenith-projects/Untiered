import { anchorId } from "@/content/courses/anchor";
import type { Block } from "@/content/courses/types";
import type { CodeBlockHighlight } from "@/lib/highlight-code";
import { QuizBlock } from "@/components/courses/quiz-block";
import { VizBlock } from "@/components/courses/viz-block";
import { PlaygroundLazy } from "@/components/courses/playground-lazy";
import { CodeBlock } from "@/components/courses/code-block";
import { CopyCodeButton } from "@/components/courses/copy-code-button";
import { InlineText } from "@/components/courses/inline-text";
import { ConceptCard } from "@/components/courses/concept-card";
import { CompareBlock } from "@/components/courses/compare-block";
import { StepsBlock } from "@/components/courses/steps-block";
import { AgentLab } from "@/components/courses/agent-lab";
import { getScenario } from "@/lib/agent-lab/scenarios";
import { ArchitectureLab } from "@/components/courses/architecture-lab";
import { getArchitectureScenario } from "@/lib/architecture-lab/scenarios";
import { LessonLabel, LessonList, LessonNote, LessonPanel } from "@/components/courses/lesson-box";
import { Table, TableScroll } from "@/components/ui/table";

/**
 * Block kinds allowed to break out of the ~70ch prose column (task 052) — the diagrams,
 * code, tables and comparisons that want the reclaimed screen width. Everything else
 * (paragraphs, asides, lists) stays capped at prose width: a wide paragraph is genuinely
 * harder to read, so widening the page should not widen the sentence. Headings are the
 * exception: a short line gains nothing from the measure, and at heading size 62ch broke
 * "System.out.println vs System.out.print" in two.
 */
const FULL_BLEED_KINDS: ReadonlySet<Block["kind"]> = new Set([
  "h",
  "viz",
  "code",
  "playground",
  "table",
  "compare",
  "steps",
  "agentlab",
  "architecturelab",
]);

/**
 * Renders one chapter's blocks in order, each block kind styled deliberately (task 045).
 *
 * A chapter is not free-form prose — it's a fixed set of block kinds (paragraph, analogy,
 * code, trace, pitfall, remember, interview, quiz, ...) — so each one gets its own visual
 * treatment rather than falling back to generic article styling. An analogy reads as a
 * tinted aside; a pitfall reads as a warning; a remember box is the one thing on the page
 * that's meant to be skimmable on its own, after everything else is forgotten.
 *
 * `highlightedCode`, when given, is server/build-time Shiki HTML for the `code` and
 * `playground` blocks, aligned by index with `blocks` (task 049) — computed once by the
 * page before this renders, so this component itself stays a plain, synchronous function
 * that a test can render directly. A missing entry (or no `highlightedCode` at all, as in
 * every existing test) falls back to a plain `<pre>` — the same degrade-gracefully path an
 * unrecognised language takes.
 */
export function BlockRenderer({
  blocks,
  highlightedCode,
  layout = "default",
}: {
  blocks: Block[];
  highlightedCode?: Array<string | CodeBlockHighlight | null>;
  layout?: "default" | "expanded";
}) {
  return (
    <div
      data-layout={layout}
      className={layout === "expanded" ? "grid gap-6 lg:grid-cols-2" : "flex flex-col gap-8 sm:gap-10"}
    >
      {blocks.map((block, index) => (
        <div
          key={index}
          className={
            layout === "expanded"
              ? block.kind === "pitfall" || block.kind === "interview"
                ? "w-full max-w-full"
                : "w-full max-w-full lg:col-span-2"
              : FULL_BLEED_KINDS.has(block.kind)
                ? "w-full max-w-full"
                : "max-w-[62ch]"
          }
        >
          <BlockView block={block} highlighted={highlightedCode?.[index] ?? null} />
        </div>
      ))}
    </div>
  );
}

function StaticCode({ code, html }: { code: string; html: string | null }) {
  return html ? (
    // Shiki's own HTML — trusted, generated at build time from our own content files,
    // never from anything a reader submits.
    <div className="shiki-wrap overflow-x-auto px-4 py-4" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <pre className="overflow-x-auto bg-surface-raised px-4 py-4 font-mono text-caption text-ink">
      <code>{code}</code>
    </pre>
  );
}

function BlockView({
  block,
  highlighted,
}: {
  block: Block;
  highlighted: string | CodeBlockHighlight | null;
}) {
  // `code` blocks get a `CodeBlockHighlight` object, `playground` blocks a plain string
  // (task 049/050 — see `highlightChapterBlocks`). Guard once, here, rather than in each case.
  const highlightedHtml = typeof highlighted === "string" ? highlighted : null;
  const highlightedCodeBlock = highlighted && typeof highlighted === "object" ? highlighted : null;
  switch (block.kind) {
    case "p":
      return (
        <p className="text-heading font-normal leading-[1.85] text-ink">
          <InlineText text={block.text} />
        </p>
      );

    case "h":
      return (
        <h2
          id={anchorId(block.text)}
          className="font-editorial scroll-mt-24 text-title text-ink"
        >
          <InlineText text={block.text} />
        </h2>
      );

    case "analogy":
      return (
        <LessonNote tone="accent" label="The picture" title={block.title}>
          <p className="text-body leading-relaxed text-ink">
            <InlineText text={block.text} />
          </p>
        </LessonNote>
      );

    case "code":
      return <CodeBlock block={block} highlighted={highlightedCodeBlock} />;

    case "list":
      return block.ordered ? (
        <ol className="list-decimal space-y-2 pl-5 text-heading font-normal leading-relaxed text-ink marker:text-accent-strong">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineText text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-2 pl-5 text-heading font-normal leading-relaxed text-ink marker:text-accent-strong">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );

    case "table":
      return (
        <TableScroll>
          <Table>
            <thead>
              <tr className="border-b border-line-strong bg-surface-sunken text-left">
                {block.head.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-medium text-ink">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-b-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top text-ink">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      );

    case "trace":
      return (
        <LessonPanel label="Trace it" title={<InlineText text={block.title} />} as="div">
          <ol className="flex flex-col gap-2.5">
            {block.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-body leading-relaxed text-ink">
                <span className="shrink-0 pt-0.5 font-mono text-micro text-ink-subtle">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <InlineText text={step} />
                </span>
              </li>
            ))}
          </ol>
        </LessonPanel>
      );

    case "pitfall":
      return (
        <LessonNote tone="danger" label="Common mistakes" as="div">
          <LessonList items={block.items} />
        </LessonNote>
      );

    case "remember":
      return (
        <LessonNote tone="accent" label="Remember this" as="div">
          <LessonList items={block.items} />
        </LessonNote>
      );

    case "interview":
      return (
        <LessonNote tone="accent" label="How this comes up in interviews">
          <LessonList items={block.items} />
        </LessonNote>
      );

    case "quiz":
      return <QuizBlock block={block} />;

    case "viz":
      return <VizBlock block={block} />;

    case "concept":
      return <ConceptCard block={block} />;

    case "compare":
      return <CompareBlock block={block} />;

    case "steps":
      return <StepsBlock block={block} />;

    case "agentlab": {
      // A chapter naming a scenario that does not exist is a content bug, caught by the
      // content-integrity test. If one ever slips through, say so plainly rather than
      // rendering an empty box the reader has to guess about.
      const scenario = getScenario(block.scenarioId);
      if (!scenario) {
        return (
          <p className="rounded-xl border border-danger/25 bg-danger-wash px-5 py-4 text-caption text-ink-muted">
            This chapter refers to an agent lab scenario ({block.scenarioId}) that is not installed.
          </p>
        );
      }
      return <AgentLab scenario={scenario} />;
    }

    case "architecturelab": {
      const scenario = getArchitectureScenario(block.scenarioId);
      if (!scenario) {
        return (
          <p className="rounded-xl border border-danger/25 bg-danger-wash px-5 py-4 text-caption text-ink-muted">
            This chapter refers to an architecture lab scenario ({block.scenarioId}) that is not installed.
          </p>
        );
      }
      return <ArchitectureLab scenario={scenario} />;
    }

    case "playground":
      return (
        <div className="flex flex-col gap-4">
          {/*
            The server-rendered copy: a reader with JS off, or a crawler, sees the real
            starter code and expected output here regardless of what the editor below
            does. The playground is layered on top of this, never a replacement for it
            (task 049).
          */}
          <LessonPanel label={`Starter code · ${block.language === "python" ? "Python" : "Java"}`} flush>
            <div className="relative">
              <StaticCode code={block.starter} html={highlightedHtml} />
              <CopyCodeButton code={block.starter} />
            </div>
            {block.expectedOutput ? (
              <div className="border-t border-line bg-surface-sunken px-5 py-3 sm:px-6">
                <LessonLabel>Expected output</LessonLabel>
                <pre className="mt-1 overflow-x-auto font-mono text-caption text-ink-muted">{block.expectedOutput}</pre>
              </div>
            ) : null}
          </LessonPanel>

          <PlaygroundLazy block={block} />
        </div>
      );
  }
}
