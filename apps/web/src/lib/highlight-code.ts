import { codeToHtml } from "shiki";

import type { Block } from "@/content/courses/types";

/**
 * Server/build-time syntax highlighting for static course code (task 049).
 *
 * Deliberately **not** a client component: `codeToHtml` runs once, on the server, while a
 * chapter page is being generated, and its output is plain HTML with inline `--shiki-*`
 * colour variables — no highlighter, grammar, or theme ships to the browser. The one thing
 * every call must survive is an unfamiliar language string; a bad chapter or a Shiki
 * version bump should degrade to plain, unhighlighted code, never break the build or the
 * page (`BlockRenderer` falls back to a plain `<pre>` when this returns `null`).
 *
 * Both themes are baked into every call — light and dark — because the product has no
 * class-based theme switch: `globals.css` reacts to `prefers-color-scheme` alone, and the
 * generated HTML needs to do the same (see the `.shiki` rules there).
 */
export async function highlightCode(code: string, lang: string): Promise<string | null> {
  try {
    return await codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });
  } catch {
    return null;
  }
}

/**
 * Highlighted HTML for one `code` block.
 *
 * `base` is the block's own language — the course's `codeLanguage`, which is Java for the
 * Java and DSA courses and Python for the AI course (task 057). The field was called
 * `java` until a course arrived whose code is not Java, at which point the name was a
 * quiet lie about what it held.
 *
 * `python` is the *alternate* Python tab a DSA block carries (task 050), and is `null` in
 * both the "no python field" and the "highlighting failed" cases — which `CodeBlock`
 * treats the same way (fall back to a plain `<pre>`).
 */
export interface CodeBlockHighlight {
  base: string | null;
  python: string | null;
}

/**
 * Highlights every `code` and `playground` block in a chapter, aligned with `blocks` by
 * index (other kinds get `null`). `baseLanguage` is the course's own code language
 * (task 057). `code` blocks get a `CodeBlockHighlight` (task 050);
 * `playground` blocks keep the single-string shape from task 049, since a playground has
 * exactly one language. Called once per chapter render — `codeToHtml` caches its own
 * highlighter internally, so this stays cheap across the handful of calls a chapter makes.
 */
export function highlightChapterBlocks(
  blocks: Block[],
  baseLanguage: "java" | "python" | "javascript" = "java",
): Promise<Array<string | CodeBlockHighlight | null>> {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.kind === "code") {
        const [base, python] = await Promise.all([
          highlightCode(block.code, shikiLanguage(baseLanguage)),
          block.python ? highlightCode(block.python, "python") : Promise.resolve(null),
        ]);
        return { base, python };
      }
      if (block.kind === "playground") return highlightCode(block.starter, shikiLanguage(block.language));
      return null;
    }),
  );
}

/**
 * The JavaScript course's React and Next chapters carry JSX, and one chapter carries
 * TypeScript; the `tsx` grammar is a superset of all three, so plain JavaScript highlights
 * exactly as it would under `javascript`.
 */
function shikiLanguage(language: "java" | "python" | "javascript"): string {
  return language === "javascript" ? "tsx" : language;
}
