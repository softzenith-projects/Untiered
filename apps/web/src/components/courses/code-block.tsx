"use client";

import type { Block } from "@/content/courses/types";
import type { CodeBlockHighlight } from "@/lib/highlight-code";
import { CopyCodeButton } from "@/components/courses/copy-code-button";
import { LessonLabel, LessonPanel } from "@/components/courses/lesson-box";
import { useCodeLanguage, type CodeLanguage } from "@/components/courses/code-language-context";

type CodeBlockData = Extract<Block, { kind: "code" }>;

function StaticCode({ code, html }: { code: string; html: string | null }) {
  return html ? (
    <div className="shiki-wrap overflow-x-auto px-5 py-4 sm:px-6" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <pre className="overflow-x-auto bg-surface-raised px-5 py-4 font-mono sm:px-6 text-caption text-ink">
      <code>{code}</code>
    </pre>
  );
}

/**
 * A `code` block with a Python equivalent (task 050): a Java/Python toggle above the
 * source, sharing one choice across the whole page via `CodeLanguageProvider`. A block with
 * no `python` field (every Java-course chapter, and the handful of DSA blocks whose point
 * is Java-specific) renders as a single static sample with no tabs at all — unchanged from
 * before this task.
 *
 * The toggle is a two-button group (`aria-pressed`, not a full ARIA tablist with roving
 * tabindex) — plain, natively focusable `<button>`s that reach every requirement task 050
 * actually asks for (keyboard reachable, labelled) without hand-rolling arrow-key
 * navigation for two options.
 */
export function CodeBlock({ block, highlighted }: { block: CodeBlockData; highlighted: CodeBlockHighlight | null }) {
  const { language, setLanguage } = useCodeLanguage();
  const hasPython = Boolean(block.python);
  // A block with no Python *variant* always shows its own source, regardless of the page's
  // shared choice — there is nothing to switch to. `"java"` here means "the base source",
  // which is Java in the Java and DSA courses and Python in the AI course (task 057); the
  // highlighted HTML for it comes from `highlighted.base`, which the course's
  // `codeLanguage` already decided.
  const shown: CodeLanguage = hasPython ? language : "java";

  const code = shown === "python" && block.python ? block.python : block.code;
  const output = shown === "python" ? block.pythonOutput : block.output;
  const html = shown === "python" ? (highlighted?.python ?? null) : (highlighted?.base ?? null);

  const toggle = hasPython ? (
    <div role="group" aria-label="Code language" className="flex gap-1">
      {(["java", "python"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={shown === option}
          onClick={() => setLanguage(option)}
          className={`rounded-md px-2.5 py-1 text-micro font-medium tracking-wide uppercase transition-colors ${
            shown === option ? "bg-accent text-accent-contrast" : "text-ink-muted hover:bg-surface-raised"
          }`}
        >
          {option === "java" ? "Java" : "Python"}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <LessonPanel label="Code" title={block.caption} aside={toggle} flush>
      <div className="relative">
        <StaticCode code={code} html={html} />
        <CopyCodeButton code={code} />
      </div>
      {output ? (
        <div className="border-t border-line bg-surface-sunken px-5 py-3 sm:px-6">
          <LessonLabel>Output</LessonLabel>
          <pre className="mt-1 overflow-x-auto font-mono text-caption text-ink-muted">{output}</pre>
        </div>
      ) : null}
      {shown === "java" && block.pythonNote ? (
        <div className="border-t border-line px-5 py-3 sm:px-6">
          <LessonLabel>Python has no direct equivalent</LessonLabel>
          <p className="mt-1 text-caption leading-relaxed text-ink-muted">{block.pythonNote}</p>
        </div>
      ) : null}
    </LessonPanel>
  );
}
