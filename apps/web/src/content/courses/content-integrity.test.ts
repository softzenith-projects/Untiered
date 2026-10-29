import { describe, expect, it } from "vitest";

import { courses, flattenChapters, getAdjacentChapters } from "@/content/courses";
import { javascriptCourse } from "@/content/courses/javascript";
import { runInNode, runInWorkerSource } from "@/lib/javascript-runtime-harness";
import { agentLabScenarios, getScenario } from "@/lib/agent-lab/scenarios";
import { architectureScenarios, getArchitectureScenario } from "@/lib/architecture-lab/scenarios";
import type {
  ArrayFrame,
  Block,
  Chapter,
  Course,
  GraphFrame,
  GridFrame,
  ListFrame,
  TreeFrame,
} from "@/content/courses/types";

/**
 * Every registered chapter, of every course, is held to the same bar (task 045): the
 * writing standard says what a chapter must contain, and this test is what actually
 * enforces it, rather than trusting each chapter file to remember on its own.
 */

function blocksOf(kind: Block["kind"], chapter: Chapter): Block[] {
  return chapter.blocks.filter((b) => b.kind === kind);
}

describe("course registry", () => {
  it("has at least one course, and every course has at least one chapter", () => {
    expect(courses.length).toBeGreaterThan(0);
    for (const course of courses) {
      expect(flattenChapters(course).length).toBeGreaterThan(0);
    }
  });

  it("has unique course slugs", () => {
    const slugs = courses.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // Task 054: nearly every `trace` block became a `viz` across dsa/ and java/. One survivor
  // remains (dsa/binary-search's "search on the answer", a conceptual integer range with no
  // concrete elements to draw) — this guards against the count silently creeping back up as
  // new chapters are added or edited.
  it("keeps trace blocks rare — almost every dry run is a viz, not a sentence list", () => {
    const traceCount = courses
      .flatMap((course) => flattenChapters(course))
      .flatMap((chapter) => chapter.blocks)
      .filter((b) => b.kind === "trace").length;
    expect(traceCount).toBeLessThanOrEqual(1);
  });
});

// The Java course's playgrounds run on our Piston runner, which launches a single source
// file and starts from its first class. A helper class above `main`'s class is legal Java
// that fails there, so a starter that reads fine can still break on its first Run.
describe("course: java, as a whole", () => {
  const javaCourse = courses.find((c) => c.slug === "java");
  const javaChapters = javaCourse ? flattenChapters(javaCourse) : [];

  // Every program a reader can run here, from either kind of block: a code example made
  // runnable with `tryIt`, or a separate playground.
  function runnables(chapter: Chapter): { source: string; language: string; prompt: string; output: string }[] {
    const fromCode = (blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[]).flatMap((block) =>
      block.tryIt
        ? [{ source: block.code, language: block.tryIt.language, prompt: block.tryIt.prompt, output: block.output ?? "" }]
        : [],
    );
    const fromPlaygrounds = (blocksOf("playground", chapter) as Extract<Block, { kind: "playground" }>[]).map((block) => ({
      source: block.starter,
      language: block.language,
      prompt: block.prompt ?? "",
      output: block.expectedOutput ?? "",
    }));
    return [...fromCode, ...fromPlaygrounds];
  }

  it("gives every chapter Java to run, with a task and the output it should print", () => {
    expect(javaChapters.length).toBeGreaterThan(0);
    for (const chapter of javaChapters) {
      const runnable = runnables(chapter);
      expect(runnable.length, chapter.slug).toBeGreaterThanOrEqual(1);
      for (const block of runnable) {
        expect(block.language, chapter.slug).toBe("java");
        expect(block.prompt.trim().length, chapter.slug).toBeGreaterThan(0);
        expect(block.output.trim().length, chapter.slug).toBeGreaterThan(0);
      }
    }
  });

  // The owner's complaint (29 October 2026): the same program shown as a code example and
  // again as a playground. A program that is already a code example gets `tryIt` instead.
  it("never repeats a code example's program as a playground", () => {
    for (const chapter of javaChapters) {
      const examples = new Set((blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[]).map((b) => b.code.trim()));
      for (const block of blocksOf("playground", chapter) as Extract<Block, { kind: "playground" }>[]) {
        expect(examples.has(block.starter.trim()), chapter.slug).toBe(false);
      }
    }
  });

  it("puts the class with main first in every runnable program, where the runner starts", () => {
    const topLevelType = /^(?:public |abstract |final )*(?:class|interface|enum) /;
    for (const chapter of javaChapters) {
      for (const { source } of runnables(chapter)) {
        const topLevelTypes = source
          .split(/^(?=(?:public |abstract |final )*(?:class|interface|enum) )/m)
          .filter((part) => topLevelType.test(part));
        expect(topLevelTypes[0] ?? "", chapter.slug).toContain("public static void main(");
      }
    }
  });
});

// The JavaScript course (task 066). Every chapter has something to run, and every pasted
// output is checked twice on every test run: against the real `node`, which is what the
// author claims to have run, and against the worker source the browser runs, which is
// what the reader will see. A sample that only one of them agrees with fails here.
describe("course: javascript, as a whole", () => {
  const jsChapters = flattenChapters(javascriptCourse);

  function runnables(chapter: Chapter): { source: string; language: string; prompt: string; output: string }[] {
    const fromCode = (blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[]).flatMap((block) =>
      block.tryIt
        ? [{ source: block.code, language: block.tryIt.language, prompt: block.tryIt.prompt, output: block.output ?? "" }]
        : [],
    );
    const fromPlaygrounds = (blocksOf("playground", chapter) as Extract<Block, { kind: "playground" }>[]).map((block) => ({
      source: block.starter,
      language: block.language,
      prompt: block.prompt ?? "",
      output: block.expectedOutput ?? "",
    }));
    return [...fromCode, ...fromPlaygrounds];
  }

  const normalise = (text: string) =>
    text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();

  it("writes its code in JavaScript", () => {
    expect(javascriptCourse.codeLanguage).toBe("javascript");
  });

  it("has unique chapter slugs across its modules", () => {
    const slugs = jsChapters.map((chapter) => chapter.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("never repeats a code example's program as a playground", () => {
    for (const chapter of jsChapters) {
      const examples = new Set((blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[]).map((b) => b.code.trim()));
      for (const block of blocksOf("playground", chapter) as Extract<Block, { kind: "playground" }>[]) {
        expect(examples.has(block.starter.trim()), chapter.slug).toBe(false);
      }
    }
  });

  for (const chapter of jsChapters) {
    it(`${chapter.slug}: has JavaScript to run, and prints exactly what node and the browser print`, async () => {
      const runnable = runnables(chapter);
      expect(runnable.length, chapter.slug).toBeGreaterThanOrEqual(1);
      for (const block of runnable) {
        expect(block.language, chapter.slug).toBe("javascript");
        expect(block.prompt.trim().length, chapter.slug).toBeGreaterThan(0);
        expect(block.output.trim().length, chapter.slug).toBeGreaterThan(0);

        const node = runInNode(block.source);
        expect(node.stderr, `${chapter.slug}: node wrote to stderr`).toBe("");
        expect(normalise(node.stdout), `${chapter.slug}: pasted output is not what node prints`).toBe(normalise(block.output));

        const worker = await runInWorkerSource(block.source);
        expect(worker.stderr, `${chapter.slug}: the browser runtime wrote to stderr`).toBe("");
        expect(normalise(worker.stdout), `${chapter.slug}: the browser runtime prints differently`).toBe(normalise(block.output));
      }
    }, 30_000);
  }
});

// Course-level rules for the AI course (task 057), asserted once rather than per chapter:
// the owner asked for many quizzes, hands-on practice throughout, and the agent lab as the
// thing that makes this course different. These guard all three against erosion.
describe("course: ai-agents, as a whole", () => {
  const aiCourse = courses.find((c) => c.slug === "ai-agents");
  const aiChapters = aiCourse ? flattenChapters(aiCourse) : [];
  const aiBlocks = aiChapters.flatMap((chapter) => chapter.blocks);

  it("is registered", () => {
    expect(aiCourse).toBeDefined();
    expect(aiChapters.length).toBeGreaterThanOrEqual(30);
  });

  it("gives every chapter something to run: a python playground each", () => {
    for (const chapter of aiChapters) {
      const playgrounds = chapter.blocks.filter((b) => b.kind === "playground");
      expect(playgrounds.length, chapter.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it("carries the maximum quizzes the writing standard allows, in every chapter", () => {
    for (const chapter of aiChapters) {
      expect(chapter.blocks.filter((b) => b.kind === "quiz").length, chapter.slug).toBe(3);
    }
  });

  it("uses every agent lab scenario at least once", () => {
    const used = new Set(
      aiBlocks.filter((b) => b.kind === "agentlab").map((b) => (b.kind === "agentlab" ? b.scenarioId : "")),
    );
    expect(used.size).toBeGreaterThanOrEqual(4);
    for (const scenario of agentLabScenarios) {
      expect(used.has(scenario.id), scenario.id).toBe(true);
    }
  });
});

describe("course: system-design, as a whole", () => {
  const systemDesignCourse = courses.find((course) => course.slug === "system-design");
  const systemDesignChapters = systemDesignCourse ? flattenChapters(systemDesignCourse) : [];
  const systemDesignBlocks = systemDesignChapters.flatMap((chapter) => chapter.blocks);

  it("covers foundations, building blocks, data-layer internals, AI systems, and compositional cases", () => {
    expect(systemDesignCourse).toBeDefined();
    expect(systemDesignCourse?.modules).toHaveLength(5);
    expect(systemDesignChapters).toHaveLength(59);
    expect(systemDesignCourse?.requiresCodeExamples).toBe(false);
  });

  it("teaches each topic in beginner-first layers instead of a terse repeated outline", () => {
    for (const chapter of systemDesignChapters) {
      const tables = chapter.blocks.filter((block) => block.kind === "table");
      const concepts = chapter.blocks.filter((block) => block.kind === "concept");
      const comparisons = chapter.blocks.filter((block) => block.kind === "compare");
      const steps = chapter.blocks.filter((block) => block.kind === "steps");
      const glossaries = tables.filter((block) => block.head[0] === "Term");
      const workedExamples = concepts.filter((block) => block.title.startsWith("Worked example"));

      // The plain-language glossary comes before the walkthrough that uses its words.
      expect(glossaries, chapter.slug).toHaveLength(1);
      expect(glossaries[0]?.rows.length, chapter.slug).toBeGreaterThanOrEqual(3);
      expect(glossaries[0]?.rows.every((row) => row.length === 2 && row.every((cell) => cell.trim().length > 0)), chapter.slug).toBe(true);
      expect(chapter.blocks.indexOf(glossaries[0]!), chapter.slug).toBeLessThan(chapter.blocks.indexOf(steps[0]!));
      expect(workedExamples, chapter.slug).toHaveLength(1);
      expect(workedExamples[0]?.text.trim().length, chapter.slug).toBeGreaterThanOrEqual(80);
      // A trade-off is two sides: what the choice buys and what it costs.
      expect(comparisons.some((block) => block.columns.length === 2), chapter.slug).toBe(true);
      expect(steps, chapter.slug).toHaveLength(1);
      expect(steps[0]?.steps.every((step) => !/^(Start|Add|Finish)\b/.test(step.text)), chapter.slug).toBe(true);
    }
  });

  it("uses a substantive, chapter-specific worked example instead of fallback prose", () => {
    const examples = systemDesignChapters.map((chapter) => {
      const block = chapter.blocks.find((candidate) => candidate.kind === "concept" && candidate.title.startsWith("Worked example"));
      expect(block, chapter.slug).toBeDefined();
      return block?.kind === "concept" ? block.text.trim() : "";
    });

    expect(new Set(examples).size).toBe(systemDesignChapters.length);
    expect(examples.every((example) => example.length >= 80)).toBe(true);
  });

  it("covers missing distributed-system fundamentals and generic interview cases", () => {
    const slugs = new Set(systemDesignChapters.map((chapter) => chapter.slug));
    const required = [
      "network-protocols",
      "unique-ids-at-scale",
      "storage-engines",
      "bloom-filters-and-sketches",
      "proxies-and-service-discovery",
      "consistent-hashing",
      "leader-election-and-leases",
      "polling-websockets-and-sse",
      "safe-configuration-and-deployment",
      "batch-processing-and-mapreduce",
      "peer-to-peer-systems",
      "case-code-deployment",
      "case-retail-brokerage",
      "case-community-discussion-api",
      "case-video-streaming",
      "case-ride-dispatch",
      "case-accommodation-booking",
      "case-web-crawler",
      "case-paste-and-text-sharing",
      "case-photo-media-pipeline",
      "case-online-learning-platform",
    ];
    for (const slug of required) expect(slugs.has(slug), slug).toBe(true);
  });

  it("gives every chapter enough material for Arena practice", () => {
    for (const chapter of systemDesignChapters) {
      expect(chapter.blocks.filter((block) => block.kind === "quiz").length, chapter.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses every architecture lab scenario and resolves every scenario reference", () => {
    const labs = systemDesignBlocks.filter((block) => block.kind === "architecturelab");
    const used = new Set(labs.map((block) => block.scenarioId));

    expect(used.size).toBe(architectureScenarios.length);
    for (const scenario of architectureScenarios) expect(used.has(scenario.id), scenario.id).toBe(true);
    for (const block of labs) expect(getArchitectureScenario(block.scenarioId), block.scenarioId).toBeDefined();
  });
});

describe.each(courses)("course: $slug", (course: Course) => {
  const chapters = flattenChapters(course);

  it("has unique chapter slugs", () => {
    const slugs = chapters.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("orders prev/next across module boundaries correctly", () => {
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      if (!chapter) continue;
      const { prev, next } = getAdjacentChapters(course, chapter.slug);
      expect(prev?.slug).toBe(i === 0 ? undefined : chapters[i - 1]?.slug);
      expect(next?.slug).toBe(i === chapters.length - 1 ? undefined : chapters[i + 1]?.slug);
    }
  });

  describe.each(chapters)("chapter: $slug", (chapter: Chapter) => {
    it("has a non-empty summary, title and a positive reading time", () => {
      expect(chapter.summary.trim().length).toBeGreaterThan(0);
      expect(chapter.title.trim().length).toBeGreaterThan(0);
      expect(chapter.minutes).toBeGreaterThan(0);
    });

    it("has at least one analogy block", () => {
      expect(blocksOf("analogy", chapter).length).toBeGreaterThanOrEqual(1);
    });

    it("has a real code example when the course teaches through code", () => {
      const codeBlocks = blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[];
      if (course.requiresCodeExamples !== false) {
        expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
      }
      for (const block of codeBlocks) {
        expect(block.code.trim().length).toBeGreaterThan(0);
      }
    });

    it("has exactly one remember box", () => {
      expect(blocksOf("remember", chapter).length).toBe(1);
    });

    it("has a detailed remember box, not a one-line slogan", () => {
      const remember = blocksOf("remember", chapter)[0] as Extract<Block, { kind: "remember" }>;
      expect(remember.items.length, chapter.slug).toBeGreaterThanOrEqual(3);
      expect(remember.items.join(" ").trim().length, chapter.slug).toBeGreaterThanOrEqual(120);
    });

    it("has at least one interview-angle box", () => {
      expect(blocksOf("interview", chapter).length).toBeGreaterThanOrEqual(1);
    });

    it("has at least one pitfall box", () => {
      expect(blocksOf("pitfall", chapter).length).toBeGreaterThanOrEqual(1);
    });

    it("has 2-3 quiz questions, each with an answer index in range and a non-empty why", () => {
      const quizzes = blocksOf("quiz", chapter) as Extract<Block, { kind: "quiz" }>[];
      expect(quizzes.length).toBeGreaterThanOrEqual(2);
      expect(quizzes.length).toBeLessThanOrEqual(3);
      for (const quiz of quizzes) {
        expect(quiz.answer).toBeGreaterThanOrEqual(0);
        expect(quiz.answer).toBeLessThan(quiz.options.length);
        expect(quiz.why.trim().length).toBeGreaterThan(0);
        expect(quiz.options.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("every remember/pitfall/interview box has at least one non-empty item", () => {
      const boxes = [...blocksOf("remember", chapter), ...blocksOf("pitfall", chapter), ...blocksOf("interview", chapter)] as Extract<
        Block,
        { kind: "remember" | "pitfall" | "interview" }
      >[];
      for (const box of boxes) {
        expect(box.items.length).toBeGreaterThan(0);
        for (const item of box.items) {
          expect(item.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it("every viz block has non-empty frames, each with a note, and in-range references", () => {
      const vizBlocks = blocksOf("viz", chapter) as Extract<Block, { kind: "viz" }>[];
      for (const block of vizBlocks) {
        expect(block.title.trim().length).toBeGreaterThan(0);
        const frames = block.viz.frames;
        expect(frames.length).toBeGreaterThan(0);
        for (const frame of frames) {
          expect(frame.note.trim().length).toBeGreaterThan(0);

          if (block.viz.type === "array") {
            const arrayFrame = frame as ArrayFrame;
            expect(arrayFrame.cells.length).toBeGreaterThan(0);
            if (arrayFrame.range) {
              const [start, end] = arrayFrame.range;
              expect(start).toBeGreaterThanOrEqual(0);
              expect(end).toBeLessThan(arrayFrame.cells.length);
              expect(start).toBeLessThanOrEqual(end);
            }
          }

          if (block.viz.type === "list") {
            const listFrame = frame as ListFrame;
            expect(listFrame.nodes.length).toBeGreaterThan(0);
            const ids = new Set(listFrame.nodes.map((n) => n.id));
            for (const node of listFrame.nodes) {
              if (node.next !== null) {
                expect(ids.has(node.next)).toBe(true);
              }
            }
          }

          if (block.viz.type === "tree") {
            const treeFrame = frame as TreeFrame;
            const ids = new Set(treeFrame.nodes.map((n) => n.id));
            expect(ids.has(treeFrame.rootId)).toBe(true);
            for (const node of treeFrame.nodes) {
              if (node.left !== null) expect(ids.has(node.left)).toBe(true);
              if (node.right !== null) expect(ids.has(node.right)).toBe(true);
            }
          }

          if (block.viz.type === "graph") {
            const graphFrame = frame as GraphFrame;
            const ids = new Set(graphFrame.nodes.map((n) => n.id));
            for (const edge of graphFrame.edges) {
              expect(ids.has(edge.from)).toBe(true);
              expect(ids.has(edge.to)).toBe(true);
            }
          }

          if (block.viz.type === "table") {
            const gridFrame = frame as GridFrame;
            expect(gridFrame.rows.length).toBeGreaterThan(0);
            if (gridFrame.highlight) {
              for (const [r, c] of gridFrame.highlight) {
                expect(r).toBeGreaterThanOrEqual(0);
                expect(r).toBeLessThan(gridFrame.rows.length);
                const row = gridFrame.rows[r];
                expect(row).toBeDefined();
                expect(c).toBeGreaterThanOrEqual(0);
                expect(c).toBeLessThan((row ?? []).length);
              }
            }
          }
        }
      }
    });

    it("every concept card has a non-empty title and text", () => {
      const concepts = blocksOf("concept", chapter) as Extract<Block, { kind: "concept" }>[];
      for (const block of concepts) {
        expect(block.title.trim().length).toBeGreaterThan(0);
        expect(block.text.trim().length).toBeGreaterThan(0);
      }
    });

    it("every compare block has 2-3 labelled columns, each with at least one item", () => {
      const compares = blocksOf("compare", chapter) as Extract<Block, { kind: "compare" }>[];
      for (const block of compares) {
        expect(block.columns.length).toBeGreaterThanOrEqual(2);
        expect(block.columns.length).toBeLessThanOrEqual(3);
        for (const column of block.columns) {
          expect(column.label.trim().length).toBeGreaterThan(0);
          expect(column.items.length).toBeGreaterThan(0);
          for (const item of column.items) {
            expect(item.trim().length).toBeGreaterThan(0);
          }
        }
      }
    });

    it("every steps block has at least 2 stages, each with a non-empty label and text", () => {
      const stepsBlocks = blocksOf("steps", chapter) as Extract<Block, { kind: "steps" }>[];
      for (const block of stepsBlocks) {
        expect(block.steps.length).toBeGreaterThanOrEqual(2);
        for (const step of block.steps) {
          expect(step.label.trim().length).toBeGreaterThan(0);
          expect(step.text.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it("every playground block has non-empty starter source, and Python ones a runnable-looking expected output", () => {
      const playgrounds = blocksOf("playground", chapter) as Extract<Block, { kind: "playground" }>[];
      for (const block of playgrounds) {
        expect(block.starter.trim().length).toBeGreaterThan(0);
        expect(["python", "java"]).toContain(block.language);
        if (block.expectedOutput !== undefined) {
          expect(block.expectedOutput.length).toBeGreaterThan(0);
        }
      }
    });

    // DSA-specific rules (task 046): every algorithm gets a dry-run trace and a complexity table, and
    // ends with 3-5 practice problems in our own words, flagged by a "Practice problems" heading.
    if (course.slug === "dsa") {
      // A `viz` block is the picture the same dry run would otherwise be told in prose
      // (task 047) — either satisfies "walks through a small input step by step".
      it("has at least one trace or viz block (a dry run on a small input)", () => {
        expect(blocksOf("trace", chapter).length + blocksOf("viz", chapter).length).toBeGreaterThanOrEqual(1);
      });

      it("has at least one complexity table with a reason in every row", () => {
        const tables = blocksOf("table", chapter) as Extract<Block, { kind: "table" }>[];
        expect(tables.length).toBeGreaterThanOrEqual(1);
        for (const table of tables) {
          for (const row of table.rows) {
            const reason = row[row.length - 1] ?? "";
            expect(reason.trim().length).toBeGreaterThan(0);
          }
        }
      });

      // Task 050: every DSA code block gets a Python equivalent, switchable in the reader,
      // unless the block's teaching point is genuinely Java-specific — in which case
      // `pythonNote` says so instead of forcing a misleading parallel. Exactly one of the
      // two must be set, never neither and never both.
      it("has a python field or an honest pythonNote on every code block, and real, non-guessed output for both", () => {
        const codeBlocks = blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[];
        for (const block of codeBlocks) {
          const hasPython = Boolean(block.python && block.python.trim().length > 0);
          const hasNote = Boolean(block.pythonNote && block.pythonNote.trim().length > 0);
          expect(hasPython || hasNote).toBe(true);
          expect(hasPython && hasNote).toBe(false);
          if (hasPython && block.output) {
            expect((block.pythonOutput ?? "").trim().length).toBeGreaterThan(0);
          }
        }
      });

      it("ends with a 'Practice problems' heading followed by 3-5 problems in our own words", () => {
        const headingIndex = chapter.blocks.findIndex((b) => b.kind === "h" && b.text === "Practice problems");
        expect(headingIndex).toBeGreaterThanOrEqual(0);
        const next = chapter.blocks[headingIndex + 1];
        expect(next?.kind).toBe("list");
        const practice = next as Extract<Block, { kind: "list" }>;
        expect(practice.items.length).toBeGreaterThanOrEqual(3);
        expect(practice.items.length).toBeLessThanOrEqual(5);
        for (const item of practice.items) {
          expect(item.trim().length).toBeGreaterThan(0);
        }
      });
    }

    // AI-course-specific rules (task 057). This course teaches a field full of terms people
    // half-know, and makes claims about named papers, specs and frameworks — so it carries
    // obligations the other courses do not: define the term where it is introduced, say on
    // every code block where that code would actually run, and never name an agent lab
    // scenario that does not exist.
    if (course.slug === "ai-agents") {
      it("defines its terms: at least one concept card per chapter", () => {
        expect(blocksOf("concept", chapter).length).toBeGreaterThanOrEqual(1);
      });

      it("says what every code block is, and where it runs, in a caption", () => {
        const codeBlocks = blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[];
        for (const block of codeBlocks) {
          expect((block.caption ?? "").trim().length, block.code.slice(0, 60)).toBeGreaterThan(0);
        }
      });

      it("is Python throughout — no Java tab, no Java playground", () => {
        const codeBlocks = blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[];
        for (const block of codeBlocks) {
          expect(block.python).toBeUndefined();
          expect(block.pythonNote).toBeUndefined();
        }
        const playgrounds = blocksOf("playground", chapter) as Extract<Block, { kind: "playground" }>[];
        for (const block of playgrounds) {
          expect(block.language).toBe("python");
        }
      });

      it("names an agent lab scenario that actually exists", () => {
        const labs = blocksOf("agentlab", chapter) as Extract<Block, { kind: "agentlab" }>[];
        for (const lab of labs) {
          expect(getScenario(lab.scenarioId), lab.scenarioId).toBeDefined();
        }
      });

      it("ends with a 'Try this yourself' heading followed by 3-5 exercises", () => {
        const headingIndex = chapter.blocks.findIndex((b) => b.kind === "h" && b.text === "Try this yourself");
        expect(headingIndex).toBeGreaterThanOrEqual(0);
        const next = chapter.blocks[headingIndex + 1];
        expect(next?.kind).toBe("list");
        const exercises = next as Extract<Block, { kind: "list" }>;
        expect(exercises.items.length).toBeGreaterThanOrEqual(3);
        expect(exercises.items.length).toBeLessThanOrEqual(5);
        for (const item of exercises.items) {
          expect(item.trim().length).toBeGreaterThan(0);
        }
      });
    }
  });
});
