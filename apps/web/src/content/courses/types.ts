/**
 * Types for static course content (task 045, PRD design brief 15 Sep 2026 — courses).
 *
 * Content is structured blocks rather than markdown/MDX: no new parser dependency, and a
 * fixed set of block kinds means the reader can style each one deliberately (an analogy
 * reads differently from a pitfall) instead of falling back to generic prose styling.
 */

export type Block =
  /** A paragraph. Inline `` `code` `` and `**bold**` are supported by the renderer. */
  | { kind: "p"; text: string }
  /** A sub-heading inside a chapter. Gets an anchor id for the "on this page" rail. */
  | { kind: "h"; text: string }
  /** The everyday picture the concept is mapped onto. */
  | { kind: "analogy"; title: string; text: string }
  /**
   * A Java snippet or complete program. `output` is real `java` output, pasted, not guessed.
   *
   * `python`/`pythonOutput` (task 050, DSA course only) is an idiomatic Python equivalent —
   * not Java transliterated into Python syntax — shown as a second tab the reader switches
   * to, sharing one language choice across every code block on the page
   * (`CodeLanguageProvider`). `pythonOutput` is held to the same bar as `output`: real,
   * pasted, not guessed. The Java course leaves both undefined and stays Java-only.
   *
   * `pythonNote` is set instead of `python` on the rare block whose teaching point is
   * Java-specific (`StringBuilder`, `==` vs `.equals`, primitive vs wrapper, array
   * covariance, ...) where forcing a Python parallel would mislead — it explains what
   * Python does instead, in place of a Python tab.
   */
  | {
      kind: "code";
      code: string;
      caption?: string;
      output?: string;
      python?: string;
      pythonOutput?: string;
      pythonNote?: string;
    }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "table"; head: string[]; rows: string[][] }
  /** A dry run, step by step — for anything with changing state (loops, recursion, references). */
  | { kind: "trace"; title: string; steps: string[] }
  /** Mistakes beginners actually make, with the fix. */
  | { kind: "pitfall"; items: string[] }
  /** The "never forget" box: 3-5 one-line memory hooks. */
  | { kind: "remember"; items: string[] }
  /** How the topic is commonly tested in interviews. Never a named company's specific question. */
  | { kind: "interview"; items: string[] }
  /** Tests understanding, not recall. Reveals `why` on interaction. */
  | { kind: "quiz"; question: string; options: string[]; answer: number; why: string }
  /**
   * A step-through visual: the same "dry run, step by step" job as `trace`, but the steps
   * carry structured state (cells, pointers, nodes, edges) instead of sentences, so a
   * renderer can draw each frame instead of the reader imagining it (task 047).
   */
  | { kind: "viz"; title: string; caption?: string; viz: Viz }
  /**
   * An editable, runnable "try it yourself" block (task 049) — separate from `code`
   * rather than a flag on it, because the two are rendered by entirely different paths:
   * `code` is highlighted once at build time and shipped as static HTML, while a
   * `playground` seeds a client-side editor and (for Python) an in-browser interpreter.
   * Keeping them apart means a static `code` sample never accidentally pulls in the
   * editor bundle, and a chapter can mix "read this" snippets with "try this" ones freely.
   *
   * Python runs in the browser; Java runs on our self-hosted Piston (Java 15) through
   * `POST /api/v1/code/run` — see `getRunner` in `lib/course-code-runner.ts`. Piston
   * launches one source file and starts from its first class, so a Java starter puts the
   * class with `main` first. Where no runner is configured, Run explains that instead.
   */
  | {
      kind: "playground";
      language: "python" | "java";
      /** Seed source. "Reset to original" restores exactly this string. */
      starter: string;
      /** A short task line shown above the editor, e.g. "Change `nums` and run again." */
      prompt?: string;
      /** What a correct, unmodified run should print — compared loosely (trailing whitespace only). */
      expectedOutput?: string;
    }
  /**
   * A titled, tinted rule/definition box (task 052) — distinct from `analogy` (the
   * everyday picture mapped onto the concept) and `remember` (the end-of-chapter recap):
   * this states the formal rule or term as soon as it's introduced, so a reader can point
   * back to it without re-reading the surrounding paragraph. One of the "coloured boxes"
   * the owner asked for.
   */
  | { kind: "concept"; title: string; text: string }
  /**
   * A side-by-side comparison — `ArrayList` vs `LinkedList`, BFS vs DFS, `==` vs `.equals`
   * — as 2-3 tinted columns instead of a plain table (task 052), so the reader tracks
   * "if it's this, then..." straight down a column.
   */
  | { kind: "compare"; title?: string; columns: { label: string; items: string[] }[] }
  /**
   * A numbered, coloured pipeline of stages for anything sequential — compile → bytecode →
   * JVM, or backtracking's choose/explore/undo (task 052) — instead of a numbered prose
   * list the reader has to hold in their head.
   */
  | { kind: "steps"; title?: string; steps: { label: string; text: string }[] }
  /**
   * The agent lab (task 057): the learner assembles an agent — tools, system-prompt
   * clauses, a step limit, whether observations are fed back — presses Run, and steps
   * through the resulting thought / action / observation / answer trace one frame at a
   * time.
   *
   * **It runs a scripted simulation, never a model.** CLAUDE.md rule 7 forbids live AI
   * spend, and a lab that let a reader believe a scripted trace came from a real model
   * would be the same class of failure as a report describing eye contact nobody watched.
   * The runtime is a pure function over authored data (`lib/agent-lab/run.ts`) and the
   * component says so on its face, in as many words. Wiring a real model in later is a
   * change of runtime — `runAgentLab` in, an async call out — not a rewrite of the
   * content, the controls, or the trace viewer.
   *
   * The scenario itself lives in `lib/agent-lab/scenarios.ts` rather than inline here, so
   * a chapter file stays readable and the engine's tests can import a scenario directly
   * without dragging a whole chapter in with it.
   */
  | { kind: "agentlab"; scenarioId: string }
  /**
   * A system-design composition challenge. The authored scenario lives in
   * `lib/architecture-lab/scenarios.ts`; chapter content only names it so the same
   * deterministic, accessible interaction can be reused in lessons and practice.
   */
  | { kind: "architecturelab"; scenarioId: string };

/**
 * One visualisation and its frames. Every shape's frame is *state*, never coordinates —
 * layout is the renderer's job, not the content author's, which is what keeps this
 * declarative and keeps a frame reviewable as data.
 */
export type Viz =
  | { type: "array"; frames: ArrayFrame[] }
  | { type: "list"; frames: ListFrame[] }
  | { type: "stack" | "queue"; frames: SeqFrame[] }
  | { type: "tree"; frames: TreeFrame[] }
  | { type: "graph"; frames: GraphFrame[] }
  | { type: "table"; frames: GridFrame[] }
  | { type: "callstack"; frames: CallFrame[] };

/** Visual state of one element within a frame. Never the only signal — always paired
 * with a label, a pointer name, or position, per CLAUDE.md (never colour alone). */
export type CellState = "active" | "window" | "done" | "compare" | "swap" | "visiting";

export interface ArrayCell {
  value: string | number;
  /** Named pointers landing on this index, e.g. `["left"]`, `["i", "j"]`. */
  pointers?: string[];
  state?: CellState;
}
export interface ArrayFrame {
  cells: ArrayCell[];
  note: string;
  /** Optional highlighted contiguous range (a window), inclusive indices into `cells`. */
  range?: [number, number];
}

export interface ListNode {
  id: string;
  value: string | number;
  /** id of the next node, or `null` for the end of the list. */
  next: string | null;
  pointers?: string[];
  state?: CellState;
}
export interface ListFrame {
  /** Nodes in list order, starting from the head. */
  nodes: ListNode[];
  note: string;
}

export interface SeqFrame {
  items: (string | number)[];
  note: string;
  /** Index of the item just pushed/popped/enqueued/dequeued this frame. */
  highlight?: number;
}

export interface TreeNode {
  id: string;
  value: string | number;
  left: string | null;
  right: string | null;
  state?: CellState;
}
export interface TreeFrame {
  nodes: TreeNode[];
  rootId: string;
  note: string;
}

export interface GraphNode {
  id: string;
  label: string;
  state?: CellState;
}
export interface GraphEdge {
  from: string;
  to: string;
  directed?: boolean;
  state?: CellState;
}
export interface GraphFrame {
  nodes: GraphNode[];
  edges: GraphEdge[];
  note: string;
}

export interface GridFrame {
  /** `null` marks an empty cell (e.g. an unfilled DP table entry). */
  rows: (string | number | null)[][];
  rowLabels?: string[];
  colLabels?: string[];
  /** `[row, col]` pairs to highlight this frame. */
  highlight?: [number, number][];
  note: string;
}

export interface CallFrame {
  /** The call stack, bottom to top. */
  stack: { label: string; state?: "active" | "returning" }[];
  note: string;
}

export interface Chapter {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: Block[];
}

export interface Module {
  title: string;
  chapters: Chapter[];
}

export interface Course {
  slug: string;
  title: string;
  tagline: string;
  level: string;
  /**
   * The language every `code` block in this course is written in — what the syntax
   * highlighter is told, and what the Arena labels a `predict-output` challenge with
   * (task 057). Defaults to `"java"`, which is what both of the first two courses are.
   *
   * This is deliberately a course-level property rather than a per-block one: mixing
   * languages inside one course is not a thing any course here does, and a per-block flag
   * would be one more field for a chapter author to forget and mislabel.
   */
  codeLanguage?: "java" | "python";
  /** Set to false for conceptual courses where forcing a code sample would be misleading. */
  requiresCodeExamples?: boolean;
  modules: Module[];
}
