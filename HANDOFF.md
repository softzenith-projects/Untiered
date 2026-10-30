# Handoff — 30 October 2026

## Task
A JavaScript course on `/courses`: the language from basics to interview depth, then React,
Node.js and Next.js, built on researched, properly licensed sources. Owner's ask, in their
words: "javascript basics, and interview type details and coursework and not w3schools kind".
Task file: `tasks/task-066-javascript-course.md` (PRD §10).

## What I built
- **The course, 44 chapters in 8 modules**, in `apps/web/src/content/courses/javascript/`:
  foundations (1–8), core mechanics at interview depth (9–16: scope, closures, `this`,
  prototypes, classes, functional patterns, iterators/generators, errors and modules), async
  (17–21: event loop, promises, async/await, fetch and abort, machine-coding utilities such as
  debounce and promise-all), browser (22–26), React (27–34), Node.js (35–39), Next.js (40–42),
  TypeScript and an interview playbook (43–44). Every chapter has an analogy, runnable code
  with real output, pitfalls, one "remember" box, interview questions with what a strong answer
  contains, and 2–3 quizzes, most of them "what does this print?".
- **Runnable JavaScript in the browser.** `lib/javascript-runtime.ts` is a Web Worker (started
  from a Blob URL, fresh per run) whose `console` is a port of Node 24's `util.inspect`, so the
  reader sees exactly what `node` prints: array column grouping, `<ref *1>` circular markers,
  Map/Set, null-prototype objects, getters, format specifiers. `lib/browser-javascript.ts`
  runs it with a 6-second stop.
- **Timers on a virtual clock**: they fire in deadline order, one per macrotask with microtasks
  drained between, without real waiting. Event-loop lessons print the same order on every run,
  which a real clock on a busy machine does not guarantee.
- **The bar is enforced by a test.** `content-integrity.test.ts` has a `course: javascript, as a
  whole` block that runs every runnable sample under the real `node` *and* under the worker
  source, and fails if either differs from the output pasted in the chapter. Nobody can paste a
  guessed output. `lib/javascript-runtime.test.ts` holds the runtime's printing to Node's on 17
  programs.
- Wiring: editor highlighting (CodeMirror JS with JSX), Shiki `tsx` highlighting, Arena
  predict-the-output challenges derived from the JS playgrounds (`/arena/javascript`), catalogue
  card artwork (`--course-js-*` tokens), feature flag `NEXT_PUBLIC_COURSE_JAVASCRIPT_ENABLED`
  (default on, added to `.env.example`).
- Research and licences: `docs/javascript-course-research.md` (sources, licences, verified
  version facts, 25 commonly wrong facts, the syllabus) and `javascript/THIRD_PARTY_NOTICES.md`.
  All prose and examples are original; non-commercial and ShareAlike sources (javascript.info,
  YDKJS, Odin, Eloquent JS, MDN prose) were used only as heading checklists or references,
  never copied. Nothing was scraped. No question is attributed to a company.

## Assumptions I made
- "Not w3schools" read as: explain *why* the engine behaves as it does, at the depth an
  interviewer probes, and make the reader predict and run it, rather than list syntax.
- Code that cannot run in a browser worker (real Express, `fs`, React components, Next route
  files, DOM) is shown in plain code blocks, and the runnable sample beside it is a plain-JS
  **model** of the mechanism (a `useState` with a closure, a keyed diff, a middleware chain, an
  EventEmitter, event bubbling over an object tree), each labelled as a model.
- Output is "what Node prints". In Chrome/Edge (V8) error messages match too; Firefox and
  Safari phrase some error *messages* differently (e.g. the TDZ message). Error *names* are the
  same everywhere, with one exception I fixed: chapter 14's stack overflow now prints a fixed
  line, because Firefox calls that error `InternalError`.
- The course is listed second, after Java, in the catalogue.

## What I could NOT verify
- **Visual check: none.** I have not looked at the chapters, the `viz` frames (call stack,
  queue), the catalogue artwork, or the light/dark colours in a browser.
- **The Run button in a real browser.** The worker source is tested in a Node `vm` context,
  not in Chrome, Firefox or Safari. Worth one click per browser.
- Facts the writers could not check against a source (each is worded cautiously in its
  chapter):
  - Node: the version where global `fetch` became stable, `--watch` and `--env-file`
    stability, the CommonJS-loads-sync-ESM rule (ch 35 points to the Node docs rather than
    naming a version), `AbortSignal.timeout`, the Node 15 change to throw on unhandled
    rejections, the 4 ms nested-timer clamp, `structuredClone` availability.
  - Browser: `toSorted` support, which events do not bubble, rAF timing, the "about 4 KB"
    cookie limit, the CSP/CORS/CSRF header examples (marked illustrative).
  - React: `renderHook` and `loading.tsx` as a Suspense fallback; the simplifications in the
    ch 41 caching model; `next/font` and layout persistence.
  - The note that V8 does not implement tail calls (ch 14).
  - Checked and confirmed: Next 16.4.3's `error.tsx` `retry` prop (against the docs bundled
    in `node_modules/next`); TypeScript blocks compile under tsc 7.0.2 with
    `erasableSyntaxOnly`; Node 24.13's `nextTick`/promise order in CJS vs ESM.
- Chapter 14's deep-recursion sample depends on stack size; it passes in Node and the
  worker here.

## Verification status
- typecheck / lint / tests / build: **pass** locally. 102 test files, 3977 tests; `next build`
  compiles and pre-renders `/courses/javascript` and `/arena/javascript`.
- CI: **green** on `026302f`, all four jobs (run 41006166351).

## Merge status
- Merged into `develop` at `026302f` (fast-forward from `feat/javascript-course`) after green
  CI. No migrations. Nothing pushed to `main`.

## Notes for review
- **New dependency: `@codemirror/lang-javascript`** (MIT, from the CodeMirror project the
  editor already uses). The playground has no other way to highlight and indent JavaScript;
  the Java and Python language packs are from the same family.
- **CI's web job now runs on Node 24** (`.github/workflows/ci.yml`). The integrity test runs
  every sample under the machine's `node` and compares with output pasted from Node 24, which
  prints symbol keys differently from Node 22.
- **Size: about 13,000 lines over 79 files**, far beyond the 800-line guideline. Almost all of
  it is chapter content (44 files); the code change (runtime, harness, tests, wiring) is about 950
  lines over 22 files. It could have been split per module; I kept one branch because the runtime and the
  integrity test had to land with the first chapters.
- Two existing tests changed legitimately when a second "java…" course appeared: the Arena
  link matcher is now `/java(?!script)/i`, and the derive test's language list includes
  `javascript`. No assertion was weakened.

## Suggested next task
- A browser pass over the course: open a chapter from each module in Chrome and Firefox, press
  Run, and check the `viz` frames and the catalogue card in light and dark mode.

## Open questions for you
- None blocking.
