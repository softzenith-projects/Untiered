// @vitest-environment node

import { describe, expect, it } from "vitest";

import { highlightChapterBlocks, highlightCode } from "@/lib/highlight-code";
import type { Block } from "@/content/courses/types";

/**
 * Shiki's grammars and themes ship inside the package itself — calling `codeToHtml` here
 * touches no network and no third-party API, so this exercises the real thing rather than
 * a mock (task 049 only bars live AI/model calls and Pyodide downloads).
 */
describe("highlightCode", () => {
  it("returns Shiki HTML carrying both light and dark token colours", async () => {
    const html = await highlightCode('System.out.println("hi");', "java");
    expect(html).not.toBeNull();
    expect(html).toContain("shiki");
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
  });

  it("degrades to null, rather than throwing, for an unrecognised language", async () => {
    const html = await highlightCode("does not matter", "not-a-real-language");
    expect(html).toBeNull();
  });
});

describe("highlightChapterBlocks", () => {
  it("highlights code and playground blocks and leaves everything else null, aligned by index", async () => {
    const blocks: Block[] = [
      { kind: "p", text: "intro" },
      { kind: "code", code: "int x = 1;" },
      { kind: "playground", language: "python", starter: "print(1)" },
      { kind: "h", text: "heading" },
    ];

    const result = await highlightChapterBlocks(blocks);

    expect(result).toHaveLength(4);
    expect(result[0]).toBeNull();
    // A `code` block yields a { base, python } pair (task 050/057) -- base only here, since
    // this block carries no python field.
    expect(result[1]).toEqual({ base: expect.stringContaining("shiki"), python: null });
    // A `playground` block still yields a single highlighted string -- it has exactly one
    // language, unlike a switchable `code` block.
    expect(result[2]).toContain("shiki");
    expect(result[3]).toBeNull();
  });

  it("also highlights a code block's python field when present", async () => {
    const blocks: Block[] = [{ kind: "code", code: "int x = 1;", python: "x = 1" }];

    const result = await highlightChapterBlocks(blocks);

    const highlight = result[0] as { base: string | null; python: string | null };
    expect(highlight.base).toContain("shiki");
    expect(highlight.python).toContain("shiki");
  });

  // Task 057: the AI course's `code` blocks are Python, so the base language is a
  // parameter rather than a hard-coded "java". Python keywords must come back marked up.
  it("highlights a code block in the course's own base language", async () => {
    const blocks: Block[] = [{ kind: "code", code: "def total(items):\n    return sum(items)\n" }];

    const asPython = (await highlightChapterBlocks(blocks, "python"))[0] as {
      base: string | null;
      python: string | null;
    };

    expect(asPython.base).toContain("shiki");
    expect(asPython.base).toContain("def");
    expect(asPython.python).toBeNull();
  });
});
