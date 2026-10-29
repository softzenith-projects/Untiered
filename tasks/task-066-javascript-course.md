# Task 066 — a JavaScript course: the language, then React, Node.js and Next.js

The owner's words: "research all available courses and open source things and add
JavaScript as a course too... JavaScript basics, and interview type details and coursework,
and not w3schools kind... covering React.js, Node.js, Next.js etc."

"Not w3schools" is the brief. A w3schools page lists syntax and moves on. A chapter here
explains **why** the language behaves the way it does, at the depth an interviewer probes:
what is on the call stack, which queue a callback waits in, what `this` is bound to, and why
React rendered twice. Every chapter then makes the reader run it and predict it.

## Already built (on `feat/javascript-course`) — use it, do not rebuild it

- **Runnable JavaScript in the browser.** `playground` blocks and `code` blocks with
  `tryIt: { language: "javascript", prompt }` run in a Web Worker
  (`lib/browser-javascript.ts`). The worker prints values **exactly as `node` prints them**
  (`lib/javascript-runtime.ts`, a port of Node's `util.inspect`), so output pasted from a
  real `node` run matches what the reader sees.
- **The course shell.** `content/courses/javascript/index.ts` assembles eight module files,
  `m1-foundations.ts` … `m8-typescript-and-interviews.ts`. Each starts with
  `chapters: []`, and a module is shown once it has a chapter. **You own only the module files
  in your brief.** Do not edit `index.ts`, another agent's module file, or the shared
  infrastructure; if you need a change there, say so in your report.
- **The bar, enforced.** `content/courses/content-integrity.test.ts` runs every chapter
  against the general chapter rules, plus `course: javascript, as a whole`. That block
  **runs every runnable sample under the real `node` and under the browser worker, and
  fails if either output differs from the pasted one.** You cannot paste a guessed output
  and pass.
- Research, licences and the syllabus: `docs/javascript-course-research.md`. Read §4
  (verified version facts), §5 (facts tutorials get wrong) and §6 (your chapters) before
  writing. Sources: `content/courses/javascript/THIRD_PARTY_NOTICES.md`.

## Read first

- `apps/web/src/content/courses/types.ts` — every block kind and what it is for.
- `apps/web/src/content/courses/dsa/05-two-pointers.ts` and
  `apps/web/src/content/courses/java/13-methods.ts` — what a good chapter looks like here.
- `apps/web/src/content/courses/content-integrity.test.ts` — the rules, all of them.
- CLAUDE.md: design direction (class-12 reader), and "never fabricate employer-specific
  detail".

## What every chapter carries

The integrity test checks most of this, and the rest is checked in review:

- One vivid **everyday analogy**, from Indian daily life where it fits naturally: a tiffin
  counter, a railway ticket queue, a chai stall, a cricket scorer. Say where the analogy
  stops being true.
- **Small steps.** `concept` boxes for rules, `compare` for this-vs-that, `steps` for
  pipelines, and `viz` (a callstack, a queue, an array) for anything with changing state. The
  event loop chapters should use `viz` with `callstack` / `queue` frames.
- **At least one runnable sample**, as `tryIt` on the chapter's main example, or a separate
  `playground` when the main example cannot run (see below). Never show the same program
  twice. Each has a task prompt ("Change the delay to 0 and predict the order first") and
  its real output.
- An **`interview`** box with the questions this topic is actually asked as, phrased the way
  an interviewer says them, plus what a strong answer contains. Never attribute a question to
  a named company.
- A **`pitfall`** box (the mistakes people make, each with the fix), exactly **one**
  `remember` box (3–5 substantive lines, ≥120 characters in total), and **2–3 `quiz`**
  blocks. Prefer output-prediction quizzes ("What does this print?") that test
  understanding, not recall.
- A `minutes` estimate that is honest for reading plus running.

Tone: plain, warm, exact. No "seamless", no emoji, no filler. Short sentences. Bold the one
term the paragraph is about.

## Runnable samples — the rules the runtime imposes

Write each runnable program as a CommonJS script, and run it with `node file.js` on the
machine's Node (24.x) **before** pasting its output.

- Print with `console.log` only. `console.error` goes to stderr, which the test rejects.
- Do not print a Promise object (no runtime can read its state, so the browser prints
  `Promise { <unknown> }`), an Error object (Node prints a stack naming a file), or top-level
  `this`. Print `err.message`, `err.name`, or `typeof`.
- No `require`, `import`, `process`, `fs`, `http`, DOM, `fetch`, or JSX. Those cannot run in a
  browser worker. Node, React, Next and DOM chapters still need one runnable sample each, so
  write an **honest plain-JavaScript model** of the mechanism. These are real interview
  exercises:
  - "a tiny `useState` with a closure"
  - "diff two virtual-DOM trees by key"
  - "an Express-style middleware chain with `next()`"
  - "an `EventEmitter` in 20 lines"
  - "event bubbling over a plain object tree"
  - "an LRU cache for `revalidate`"

  Label each one as a model, never as the real library.
- Keep it deterministic: no `Math.random`, no `Date.now()` in output, and timers of 100 ms
  or less (the runtime stops a run at 6 seconds).
- Code that **cannot** run here (real Express, `fs`, React components, Next route files)
  goes in a plain `code` block with no `tryIt`. Give it real output only if you actually ran
  it; otherwise give no output, and say in the caption where it runs.

## Facts

The research note's §4 and §5 list version-sensitive and commonly-wrong facts, and each
chapter must match them:

- `let`/`const` are hoisted, and the TDZ is why accessing them early throws.
- Next 15 stopped caching `fetch` by default; Next 16 has Cache Components and renamed
  `middleware` to `proxy`.
- React 19's `use`, and React Compiler 1.0.
- Node 24 and 26 are the supported LTS lines, with native type stripping.

Where something moves fast, name the version it is true for ("as of Next.js 16"). A claim
about how a library behaves is sourced from its official docs or not made.

## Constraints

- Branch from `origin/feat/javascript-course` (not `develop`) as instructed in your brief.
  Commit and push after **each chapter or two**.
- One chapter per file: `content/courses/javascript/<NN>-<slug>.ts`, numbered as in §6,
  exporting `chapter<PascalSlug>`. Add it to your module file in syllabus order.
- No new dependencies. No changes outside your files.
- Before your final push, run `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest
  run src/content/courses` and get it green. Push your branch and stop. Do not merge, and
  never push to `main` or `develop`.
- Report: chapters written, anything in the syllabus you changed and why, every fact you
  could not verify, and the test result.
