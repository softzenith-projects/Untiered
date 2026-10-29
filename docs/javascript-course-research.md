# JavaScript course research (2026-10-29)

Method: licences read from each repo's own LICENSE / README / license.md (raw.githubusercontent.com) and the GitHub API; SHAs from `api.github.com/repos/<r>/commits/<branch>` on 2026-10-29. Version facts read from official docs or registries (URLs inline). Anything not opened is marked NOT VERIFIED.

Rule for the course: all prose and examples are ORIGINAL. Even permissive sources are used only to cross-check facts.

## 1. Source table

Legend: Commercial = commercial reuse allowed. Class: OK (permissive), SA (ShareAlike: do not copy prose; copying would force our course under the same licence), NC/ND (do NOT use for prose/examples; headings as a coverage checklist at most), UNLICENSED (no licence found = all rights reserved; do not copy, do not even rely on beyond reading).

| Source | Author | URL | Licence (as read) | Commercial | SA/ND | Pinned commit (date) | Class |
|---|---|---|---|---|---|---|---|
| MDN Web Docs content | Mozilla + contributors | https://github.com/mdn/content | LICENSE.md: prose CC-BY-SA 2.5; code examples on/after 2010-08-20 public domain CC0 | yes | prose is ShareAlike | `a0ec5a931fb40d9307d096de83c1d4d10f0d6ea6` (2026-10-29) | SA for prose; CC0 snippets reusable but we will write our own. Cross-check only |
| react.dev | Meta | https://github.com/reactjs/react.dev | CC-BY-4.0 (LICENSE-DOCS.md "Attribution 4.0 International"); code MIT | yes | no SA/ND | `0821e7d9428a6c58c922765b891bbffba9ed6249` (2026-10-27) | OK (attribution required if copied; we will not copy) |
| Node.js docs (`doc/api`) | Node.js contributors | https://github.com/nodejs/node | Repo LICENSE is MIT-style ("Permission is hereby granted, free of charge..."); GitHub reports NOASSERTION because the file bundles third-party licences. Docs-specific licence not separately stated in the part I read | yes (MIT) | no | `502c117e8ef08410d7ed6a4ac87d109be56b69f6` (2026-10-29) | OK for cross-check; Node trademark policy applies to logo/name use |
| nodejs.org site and Learn | Node.js Website WG | https://github.com/nodejs/nodejs.org | LICENSE: MIT. Learn content path in repo not located (api listing returned none under `/learn/`; the event-loop page URL I guessed 404'd). Learn at https://nodejs.org/en/learn is NOT VERIFIED for content licence | yes (MIT repo) | no | `b86c44800c6b983724b45bb660d04df264305baa` (2026-10-28) | OK for cross-check |
| Next.js docs (`docs/`) | Vercel | https://github.com/vercel/next.js | MIT (license.md, "Copyright (c) 2025 Vercel, Inc.") | yes | no | `79107ebd94e53c69865c1a49ac734ba8004491ba` (2026-10-29), branch `canary` | OK |
| TypeScript Handbook / website | Microsoft | https://github.com/microsoft/TypeScript-Website | LICENSE: Creative Commons Attribution 4.0 (GitHub: CC-BY-4.0); LICENSE-CODE: MIT | yes | no | `205122bb73dcbf6f3b373de5bdb0d9fa5434d015` (2026-10-28), branch `v2` | OK. Note: TypeScript is now 7.0.x on npm (see section 4) so check handbook pages are current |
| ECMAScript spec (ecma262) | Ecma TC39 | https://github.com/tc39/ecma262 | LICENSE.md: text under Ecma "alternative copyright notice" policy; code under Ecma MIT-style software policy | text terms NOT read in full (policy page not opened) | unknown | `40ce6f206b5669e69bf010a38267ae24a2843404` (2026-10-23) | Reference only; never paste spec text |
| javascript.info | Ilya Kantor | https://github.com/javascript-tutorial/en.javascript.info | LICENSE.md: "based on CC-BY-NC"; free to read; anything else needs permission from the author | NO | NC | `20208769e528337949e946f526534d61d38bac47` (2026-07-25) | **NC. Headings checklist only** |
| Eloquent JavaScript (3rd/4th ed) | Marijn Haverbeke | https://github.com/MarijnH/Eloquent-JavaScript | No LICENSE file. README says the licence "allows non-commercial derivations". Website licence line not extracted | NO (per README) | NC | `4a58fbd76ef38763f2f3d850621c80295ccb0361` (2026-07-28) | **NC. Do not use** |
| You Don't Know JS Yet (2nd ed) | Kyle Simpson | https://github.com/getify/You-Dont-Know-JS | LICENSE.txt + README: CC-BY-NC-ND 4.0. README states code snippets are CC-BY-4.0 | NO | NC and ND | `044120ef55564939cd35f5ddaf3f6c0a45d7b02c` (2026-01-18), branch `2nd-ed` | **NC+ND. Do not use for prose; headings as checklist at most** |
| freeCodeCamp curriculum | freeCodeCamp | https://github.com/freeCodeCamp/freeCodeCamp | LICENSE.md: BSD-3-Clause (Copyright 2014 freeCodeCamp). The curriculum content's own terms: NOT separately verified | code yes | no | `7f15986d36e0b0601964600005a5754b6803bb20` (2026-10-29) | Coverage cross-check only (block names are public) |
| The Odin Project curriculum | Erik Trautman + TOP | https://github.com/TheOdinProject/curriculum | license.md: CC-BY-NC-SA 4.0 | NO | NC and SA | `a03cb8924192b5d3476fd5d8bec7b64b1e33fcec` (2026-10-29) | **NC+SA. Headings checklist only** |
| 30 Seconds of Code | Angelos Chalarangelo | https://github.com/Chalarangelo/30-seconds-of-code | GitHub: CC-BY-4.0 (LICENSE "Attribution 4.0 International") | yes | no | `bd756f8b2283a38560efe83cb30af38324d4e9e9` (2026-09-09), branch `master` | OK; snippet style is short, we still write our own |
| lydiahallie/javascript-questions | Lydia Hallie | https://github.com/lydiahallie/javascript-questions | MIT (Copyright 2019 Lydia Hallie) | yes | no | `a8b427b9f7f94f1a2965144ba544b475c5f65829` (2024-03-10; stale, pre-dates recent spec additions) | OK for cross-check; questions are output-prediction style |
| sudheerj/javascript-interview-questions | Sudheer Jonna | https://github.com/sudheerj/javascript-interview-questions | **No LICENSE file** (repo contents listed; GitHub licence API 404) | n/a | n/a | `698de06ad5d9eb2eeb7dfff7f7c448d039a21998` (2026-08-20) | **UNLICENSED. Read for topic ideas only; copy nothing, including wording of questions** |
| sudheerj/reactjs-interview-questions | Sudheer Jonna | https://github.com/sudheerj/reactjs-interview-questions | MIT | yes | no | `55b7d491cd74c7b37f9352f3b2420d66e7187951` (2026-08-31) | OK for cross-check. I did not read its content, only the licence |
| goldbergyoni/nodebestpractices | Yoni Goldberg + contributors | https://github.com/goldbergyoni/nodebestpractices | CC-BY-SA 4.0 | yes | **SA** | `dc3d60c29d5483d9ea99cf261bbd6203516a2ba7` (2026-06-15) | SA: do not copy prose; use as topic checklist |
| ryanmcdermott/clean-code-javascript | Ryan McDermott | https://github.com/ryanmcdermott/clean-code-javascript | MIT | yes | no | `5311f64b03fc0c2450ab17a45ee9818669c8b9b5` (2023-02-11; stale) | OK, low priority |
| Jake Archibald, "Tasks, microtasks, queues and schedules" | Jake Archibald | https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/ | No licence statement found on the page; no LICENSE in the blog repo fetch (404) | no grant found | n/a | n/a (blog) | **Treat as all rights reserved.** Link to it as "further reading"; do not copy text or its animated demo |
| Node.js event loop guide | Node.js Learn | https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick | Page licence NOT VERIFIED (see nodejs.org row) | unknown | unknown | n/a | Link only; original explanation written from the official API docs |

Summary of what is safe: the ONLY sources whose licence both permits commercial reuse and is not SA are react.dev (CC-BY), TypeScript Handbook (CC-BY), Next.js docs (MIT), nodejs/node docs (MIT-style), nodejs.org repo (MIT), 30-seconds (CC-BY), javascript-questions (MIT), reactjs-interview-questions (MIT), clean-code-javascript (MIT). Everything else is SA, NC, ND, unlicensed or unverified. We are not copying any of them anyway; this just records that attribution would be needed for the CC-BY set if anything is ever quoted.

Excluded-by-rule sources were not consulted (LeetCode, Blind, Reddit, Glassdoor, AmbitionBox, GeeksforGeeks, Quora, LinkedIn, Medium, paywalled).

## 2. What interviews test (editorial ranking)

Honest caveat: there is no public frequency dataset I could use under the exclusion rules. The ranking below is my synthesis from (a) the headings of the openly readable question repos (sudheerj JS list has about 518 numbered questions; read for topics only), (b) the shape of the lydiahallie output-prediction questions, and (c) the official docs' own emphasis. Treat "frequency" as a judgment, tiered, not a measured number. Not attributed to any company.

### JavaScript (core)
Tier 1, asked in almost every JS round:
1. Closures and lexical scope (counters, private state, loop-with-var-and-setTimeout classic)
2. `this` binding rules (default, implicit, explicit call/apply/bind, `new`, arrow functions inheriting `this`)
3. Event loop: call stack, task queue, microtask queue; ordering output questions mixing `setTimeout`, Promise `.then`, `await`, `queueMicrotask`
4. Promises and async/await: chaining, error propagation, `Promise.all/allSettled/race/any`, sequential vs parallel awaits, unhandled rejections
5. Hoisting, `var`/`let`/`const`, TDZ, function vs block scope
6. Prototypes and prototype chain; `class` as sugar over prototypes; `new`; `instanceof`; inheritance
7. Type coercion and equality (`==` vs `===`, `typeof null`, `NaN`, `[] + {}`, `Object.is`), truthy/falsy
8. Array methods (`map/filter/reduce/flatMap`, `sort` comparator, mutation vs copy), `forEach` vs `map`, `for...in` vs `for...of`

Tier 2, very common:
9. Machine-coding utilities: debounce, throttle, once, memoize, curry, compose/pipe, flatten, deep clone, deep equal, group-by
10. Polyfills: `bind`, `call/apply`, `map/filter/reduce`, `Promise.all`, a tiny `Promise`, `Array.prototype.flat`, `setInterval` via `setTimeout`
11. Shallow vs deep copy, `structuredClone`, spread, immutability, `Object.freeze` (shallow)
12. Event delegation, bubbling vs capturing, `stopPropagation` vs `preventDefault`, `addEventListener` options (`once`, `passive`)
13. ES6+ features: destructuring, spread/rest, template literals, optional chaining, nullish coalescing, modules (ESM vs CommonJS), iterators/generators
14. `Map/Set/WeakMap/WeakSet`, Symbols, getters/setters, `Object.entries/fromEntries`
15. Currying vs partial application, higher-order functions, pure functions
16. Error handling: `try/catch/finally` with async, custom errors, `Error.cause`

Tier 3, differentiators:
17. Memory: leaks (listeners, closures, detached DOM), garbage collection basics
18. Web APIs: `fetch` + `AbortController`, storage options, cookies vs localStorage, CORS, `requestAnimationFrame`, `IntersectionObserver`, web workers
19. Performance: reflow/repaint, layout thrash, lazy loading, bundle splitting
20. Security: XSS, CSRF, CSP, prototype pollution
21. Newer: `Array.prototype.at`, `toSorted/toReversed`, `Object.groupBy`, `Promise.withResolvers`, iterator helpers (check support per MDN before teaching)

### React
Tier 1: virtual DOM and reconciliation (what "diffing" means, keys, why index keys can bug), hooks rules, `useState` batching and functional updates, `useEffect` dependencies and cleanup, stale closures in effects/handlers, controlled vs uncontrolled inputs, lifting state, props vs state.
Tier 2: `useRef`, `useMemo/useCallback/React.memo` and when they help (and the React Compiler's effect on them), `useReducer`, Context and its re-render cost, custom hooks, error boundaries, lists/conditional rendering, code splitting with `lazy/Suspense`, forms.
Tier 3: render phases (render vs commit), StrictMode double-invocation, concurrent features (`useTransition`, `useDeferredValue`), Server Components vs Client Components, Actions (`useActionState`, `useFormStatus`, `useOptimistic`), `use`, HOCs vs hooks vs render props, state-management trade-offs, testing with React Testing Library, hydration errors.

### Node.js
Tier 1: event loop phases (timers, pending, poll, check, close) and `process.nextTick` / microtask ordering, `setImmediate` vs `setTimeout(0)`, single-threaded model plus libuv thread pool, blocking vs non-blocking, callbacks vs promises, modules (CJS vs ESM), Express middleware order and error middleware.
Tier 2: streams and backpressure, Buffers, `EventEmitter`, `cluster` / `worker_threads` / child processes, REST design and status codes, authentication (JWT vs sessions, password hashing), environment config, error handling and `unhandledRejection`.
Tier 3: security basics (helmet, rate limiting, input validation), performance and profiling, graceful shutdown, caching (Redis), testing with the built-in runner, deployment.

### Next.js (App Router)
Tier 1: rendering modes (SSR, SSG, ISR, CSR, PPR), Server vs Client Components and what `'use client'` really marks, file-based routing and layouts, data fetching on the server, caching model (see section 4: it changed in 15 and again in 16), Server Actions.
Tier 2: route handlers, middleware (renamed `proxy`), dynamic routes and `generateStaticParams`, `loading.tsx`/`error.tsx`/Suspense streaming, metadata/SEO, image/font optimisation, environment variables (`NEXT_PUBLIC_`), auth patterns.
Tier 3: Cache Components (`use cache`, `cacheLife`, `cacheTag`), revalidation (`revalidatePath/Tag`), edge vs Node runtime, Pages Router vs App Router.

## 3. Coverage comparison (headings only)

javascript.info (top-level parts read from the repo tree): getting started; first steps; code quality; object basics; data types; advanced function working (closures, `new Function`, scheduling, decorators and forwarding, function binding, arrow functions); object properties (flags, getters/setters); prototypes and native prototypes; classes; error handling; promises/async; generators and async iteration; modules; Proxy/Reflect, eval, currying, Reference Type, BigInt, WeakRef (misc); then browser: DOM, events, UI events, forms, page lifecycle, Frames and windows, binary data and files, Network requests (fetch, FormData, abort, CORS, WebSocket, SSE), storing data (cookies, localStorage, IndexedDB), animations, Web Components, regular expressions (about 17 chapters).
Gap it shows for us: regex depth, Proxy/Reflect, binary data, Web Components. A "basics + interview" course should include a regex chapter, and Proxy/Reflect as an advanced note.

The Odin Project JavaScript path (lesson file names read): asynchronous JavaScript and APIs (asynchronous code, working with APIs, async/await); organising code (objects and constructors, factory functions and module pattern, classes, OOP principles, ES6 modules, JSON, npm, webpack); testing JavaScript (basics, more testing); JavaScript in the real world (ECMAScript, linting, form validation); computer science (big-O time/space, recursion, data structures, hash map). Gap it shows: testing, tooling (npm, bundler, linting), complexity and recursion for coding rounds. Include a tooling/testing chapter and a complexity-and-recursion chapter.

freeCodeCamp (block names from the repo): basic JavaScript, arrays, objects, strings, loops, functions, higher-order functions, functional programming, dates, maps and sets, regular expressions, classes, debugging, form validation, DOM manipulation and click events, audio/video, asynchronous JavaScript, JavaScript libraries and frameworks, React (basics, state and hooks, forms/data fetching/routing, effects and refs, memoisation), Node.js intro, core modules, event-driven architecture, Express (basic and advanced), TypeScript (intro, config files), Redux. Gap it shows: dates, maps/sets, debugging, Redux (we may leave Redux as a short note), TypeScript config.

react.dev Learn (sidebar read): Quick Start; Installation and tooling (TypeScript, DevTools, React Compiler); Describing the UI (components, JSX, props, conditional rendering, lists, purity, UI as a tree); Adding Interactivity (events, state as memory, render and commit, state as a snapshot, queueing updates, updating objects/arrays); Managing State (reacting to input, choosing structure, sharing, preserving/resetting, reducers, context, reducer+context); Escape Hatches (refs, DOM refs, Effects, "You Might Not Need an Effect", effect lifecycle, separating events from effects, removing dependencies, custom hooks). Gap it shows: "State as a snapshot", "render and commit", "keeping components pure" and "you might not need an effect" are the interview-relevant conceptual chapters; copy this ordering of ideas, not the text.

Next.js getting-started (file names read): installation; project structure; layouts and pages; linking and navigating; server and client components; fetching data; mutating data; caching; revalidating; error handling; CSS; images; fonts; metadata and OG images; route handlers; proxy; deploying; upgrading. Gap it shows: data mutation (Server Actions), error handling, metadata, deployment belong in the Next module.

Node.js Learn (nodejs.org/en/learn): the repo path could not be listed, so its headings are NOT VERIFIED here. From my own knowledge (not read this run) it covers getting started, the event loop and `nextTick`, file system, streams, testing with the built-in runner, TypeScript. Re-check before relying on this.

## 4. Verified version facts (use these in the course)

Registry versions on 2026-10-29 (registry.npmjs.org `/<pkg>/latest`): next 16.4.3, react 19.3.1, react-dom 19.3.1, typescript 7.0.2, babel-plugin-react-compiler 1.0.0.
- TypeScript is on 7.x. I did not open release notes for what changed in 7 (NOT VERIFIED beyond the version number). Verify before writing the TS chapter; keep the chapter to syntax and typing that is stable across 5.x to 7.x.

Node.js (https://raw.githubusercontent.com/nodejs/Release/main/schedule.json and https://nodejs.org/dist/index.json):
- Node 24 "Krypton": LTS since 2025-10-28, moved to maintenance 2026-10-20, end of life 2028-04-30.
- Node 26: released 2026-05-05, entered LTS 2026-10-28 (`index.json` lists v26.13.0 with lts "Lithium"; schedule.json had an empty codename), maintenance 2027-10-20, EOL 2029-04-30.
- Node 22 "Jod": maintenance, EOL 2027-04-30. Node 20 is EOL (2026-04-30). Node 25 is a non-LTS release already past end of life (2026-06-01).
- Teach against Node 24 or 26 (both supported LTS lines today). Say "check nodejs.org/en/about/previous-releases".
- Type stripping (https://nodejs.org/api/typescript.html): enabled by default since v23.6.0 and v22.18.0; stability "2 - Stable" as of v25.2.0 and v24.12.0. It erases types only, does no type checking, ignores `tsconfig.json`; enums, parameter properties and runtime namespaces are unsupported (use `erasableSyntaxOnly` in tsconfig); file extensions required in imports; type-only imports need `import type`; `.tsx` unsupported; refuses files under `node_modules`.
- Built-in test runner (`node:test`): `doc/api/test.md` header reads "Stability: 2 - Stable". `--watch`: documented in cli.md, added v18.11.0. Global `fetch` added v17.5.0 (docs `globals.md`). I did not re-verify the exact versions at which watch and fetch left experimental; say "stable in current LTS" only after a one-line check of those docs while writing.

React (https://react.dev/blog/2024/12/05/react-19, https://react.dev/blog/2025/10/07/react-compiler-1, https://react.dev/reference/react/use):
- React 19 stable since 5 Dec 2024. Sections in the announcement: Actions, new hooks, React DOM static APIs, Server Components, Server Actions. I read only the headings of that post, so detail on `useActionState`, `useOptimistic`, `useFormStatus` should be checked against their reference pages when writing.
- `use`: reads a Promise or a Context in render; can be called conditionally (unlike hooks); must not be called in try/catch; the promise should be cached/stable, not created in render; "Despite its name, `use` is not a Hook".
- React Compiler 1.0: stable, announced 2025-10-07 ("fully production-ready"; Expo, Vite, Next.js partnered so new apps can start with it). It memoises automatically, so manual `useMemo/useCallback/React.memo` are mostly unnecessary in compiled code. Teach them anyway: interviews still ask, and uncompiled codebases rely on them.

Next.js (https://nextjs.org/blog/next-15, https://nextjs.org/blog/next-16, https://nextjs.org/docs/app/getting-started/caching, last updated 2026-10-06):
- Next 15: breaking change, `fetch` requests, `GET` Route Handlers and client router cache for pages are no longer cached by default. Request APIs (`cookies`, `headers`, `params`, `searchParams`) became async. React 19 for App Router.
- Next 16: Cache Components, stable Turbopack, React Compiler support, `middleware` renamed `proxy.ts`, React 19.
- Current docs: caching is described with Cache Components (`cacheComponents: true` in next config). Rendering is Partial Prerendering by default under it: static shell plus Suspense-streamed dynamic parts. `'use cache'` directive plus `cacheLife` and `cacheTag`; variants `use cache: private` and `use cache: remote`. Runtime APIs (`cookies`, `headers`, `searchParams`, `params`) must be behind Suspense. New `create-next-app` projects have Cache Components and `partialPrefetching` enabled; the docs say both will be on everywhere in the next major version. The previous model is documented at /docs/app/guides/caching-without-cache-components.
- Cache Components is not the same as Next 15's rules; teach the model in this order: (1) what runs on server/client, (2) the old defaults and why 15 changed them, (3) Cache Components as the current model. Flag that this area moves fast.

## 5. Facts commonly wrong in tutorials

1. "`let` and `const` are not hoisted." Wrong: they are hoisted but uninitialised until the declaration runs (TDZ); access throws ReferenceError. MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let#temporal_dead_zone_tdz
2. "`const` makes the value immutable." It makes the binding non-reassignable; object contents can still change. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
3. "JavaScript is interpreted." Modern engines JIT-compile; the precise claim is "implementation-defined". https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction
4. "JavaScript passes objects by reference." It is always pass-by-value; for objects the value is a reference (reassigning a parameter does not affect the caller). Spec: https://tc39.es/ecma262/ (Function calls, argument binding)
5. "`typeof null` is 'object' because null is an object." It is a historical bug retained for compatibility. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof#typeof_null
6. "`==` does no type conversion rules / is always wrong." It follows defined coercion (abstract equality); `x == null` is a deliberate idiom for null/undefined. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness
7. "`setTimeout(fn, 0)` runs immediately." It queues a task after the current stack and all microtasks; browsers also clamp nested timers (about 4 ms after 5 levels). https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#reasons_for_delays_longer_than_specified
8. "Promises are async so `new Promise(cb)` runs cb later." The executor runs synchronously; only `.then` callbacks are microtasks. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise
9. "`async` functions run on another thread." They run on the same thread; `await` suspends the function and resumes via a microtask. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
10. "`forEach` waits for `await` inside it." It does not; use `for...of` or `Promise.all(map())`. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#using_foreach_on_sparse_arrays (see the section on promises/async callbacks)
11. "Arrow functions are just shorter functions." No own `this`, `arguments`, `prototype`; cannot be used with `new`. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
12. "Classes are a new object model." They are syntax over prototypes; private fields (`#x`) are real, not conventions. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
13. "Node.js is single-threaded." JS runs on one thread, but libuv uses a thread pool (fs, crypto, DNS, zlib) and Node has `worker_threads`. https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick and https://nodejs.org/api/worker_threads.html
14. "Always use `process.nextTick` for async." It runs before promise microtasks and can starve I/O if recursive; prefer `queueMicrotask` / `setImmediate` as appropriate. https://nodejs.org/api/process.html#processnexttickcallback-args
15. "You need `node-fetch`, `nodemon`, `jest`, `ts-node` in every Node project." Current LTS has global `fetch`, `--watch`, `node:test`, and (Node 24/26) stable native TypeScript type stripping, with limits in section 4. https://nodejs.org/api/cli.html https://nodejs.org/api/test.html https://nodejs.org/api/typescript.html
16. "Use `require`." ESM is the standard; CJS remains common; teach both and the interop limits. https://nodejs.org/api/esm.html
17. "`useEffect` is `componentDidMount`." Effects synchronise with reactive values; in development StrictMode runs setup and cleanup an extra time to catch missing cleanup. https://react.dev/learn/synchronizing-with-effects and https://react.dev/learn/you-might-not-need-an-effect
18. "`setState` updates immediately / is async." State is a snapshot for the render; updates are batched, and use the updater form when depending on previous state. https://react.dev/learn/state-as-a-snapshot
19. "Always wrap in `useMemo`/`useCallback`." Often unnecessary; React Compiler 1.0 does it automatically. https://react.dev/learn/react-compiler
20. "Use `index` as key is fine." Only for static lists never reordered. https://react.dev/learn/rendering-lists#rules-of-keys
21. "Hooks can't be conditional, so `use` can't either." `use` is the exception. https://react.dev/reference/react/use
22. "Next.js `fetch` is cached by default." True in 13/14, false from 15. https://nextjs.org/blog/next-15#caching-semantics. Under 16 Cache Components, opt in with `'use cache'`. https://nextjs.org/docs/app/getting-started/caching
23. "`middleware.ts`." Renamed `proxy` in 16. https://nextjs.org/blog/next-16
24. "`params` and `cookies()` are synchronous." Async since Next 15. https://nextjs.org/blog/next-15#async-request-apis-breaking-change
25. "`'use client'` makes everything below it client-only / Server Components can't render Client Components." The directive marks a boundary; Client Components still prerender on the server, and server components can render client components as children. https://react.dev/reference/rsc/use-client

Items 10, 14, 25: URLs are the right pages to cite but I did not re-read the exact sentence on each; verify wording when drafting.

## 6. Proposed syllabus (42 chapters, 8 modules)

Style per CLAUDE.md: class-12 reader, one analogy, runnable code with output, remember box, mistakes, self-check. "Interview angle" lists are the questions each chapter must prepare for.

### Module 1: JavaScript foundations (8)
1. `what-is-javascript` Where JS runs; engines; how to run code (browser console, Node). Key: JS vs ECMAScript, runtime vs language, `console.log`, script vs module.
2. `values-and-variables` Primitives, `let/const/var`. Key: 7 primitives plus object, `typeof` quirks, `const` binding not value, `var` vs `let`, naming.
3. `operators-and-coercion` Key: `==` vs `===`, truthy/falsy, `??` vs `||`, optional chaining, `Object.is`, `NaN`, classic coercion puzzles.
4. `control-flow` Key: `if/switch`, loops, `for...of` vs `for...in`, `break/continue`, labelled loops, avoiding infinite loops.
5. `functions-basics` Key: declarations vs expressions, arrows, default/rest params, return, pure functions, first-class functions.
6. `strings-numbers-dates` Key: template literals, string methods, floating-point (`0.1+0.2`), `BigInt`, `Number` conversion, `Date` pitfalls and `Intl`.
7. `arrays-in-depth` Key: `map/filter/reduce/find/some/every/flatMap`, `sort` comparator, mutating vs non-mutating (`toSorted`), holes, complexity.
8. `objects-in-depth` Key: literals, computed keys, `Object.entries/fromEntries`, destructuring, spread, shallow vs deep copy, `structuredClone`, `Map/Set/WeakMap`, JSON.

### Module 2: Core JS mechanics (interview depth) (8)
9. `scope-and-hoisting` Key: global/function/block scope, hoisting of all declarations, TDZ, function vs var hoisting order, shadowing.
10. `closures` Key: lexical environment, counter and private state, loop + `setTimeout` classic and fixes, memory implications, stale closure bugs.
11. `this-keyword` Key: five binding rules, arrows, lost `this` in callbacks, `call/apply/bind`, `new`.
12. `prototypes-and-inheritance` Key: `[[Prototype]]`, chain lookup, `Object.create`, constructor functions, `instanceof`, own vs inherited properties.
13. `classes` Key: class as prototype sugar, `extends/super`, static, private `#` fields, getters/setters, mixins, `this` in methods.
14. `functional-patterns` Key: higher-order functions, currying vs partial application, compose/pipe, memoise, immutability, recursion basics.
15. `iterators-generators-symbols` Key: iteration protocol, spreadable things, generators, `Symbol.iterator`, lazy sequences.
16. `errors-and-modules` Key: `try/catch/finally`, custom errors, `Error.cause`, ESM vs CJS, dynamic `import()`, strict mode.

### Module 3: Asynchronous JavaScript (5)
17. `event-loop` Key: call stack, task queue, microtask queue, rendering step, ordering puzzles, why `setTimeout(0)` is not 0.
18. `promises` Key: states, executor runs sync, chaining and return values, `catch/finally`, `all/allSettled/race/any`, unhandled rejection.
19. `async-await` Key: sugar over promises, error handling, sequential vs parallel, `for await`, `forEach` trap, top-level await.
20. `fetch-and-abort` Key: `fetch` doesn't reject on 404, JSON, `AbortController`, timeouts, retries with backoff, CORS in one page.
21. `machine-coding-utilities` Key: debounce, throttle, once, memoize, retry, `Promise.all` polyfill, concurrency limiter, deep clone, flatten, polyfills for `bind/map/reduce`.

### Module 4: JavaScript in the browser (5)
22. `dom-and-events` Key: selecting, creating, updating; capturing/bubbling; delegation; `preventDefault` vs `stopPropagation`; listener options.
23. `forms-and-storage` Key: form events, validation API, cookies vs `localStorage` vs `sessionStorage` vs IndexedDB, security of each.
24. `browser-performance` Key: reflow/repaint, `requestAnimationFrame`, `IntersectionObserver`, workers, lazy loading, memory leaks.
25. `web-security-basics` Key: XSS, CSRF, CORS, CSP, prototype pollution, safe handling of user input.
26. `tooling-and-testing` Key: npm and `package.json`, lockfiles, bundlers in one page, ESLint, Prettier, unit tests with the built-in runner or a framework, recursion and Big-O refresher.

### Module 5: React (8)
27. `react-mental-model` Key: components as functions of state, JSX, render vs commit, virtual DOM / reconciliation, why keys matter.
28. `props-state-events` Key: props flow down, state as a snapshot, batching, updater form, updating objects/arrays immutably, controlled inputs.
29. `useeffect-and-sync` Key: effect lifecycle and cleanup, dependency array, StrictMode double run, "you might not need an effect", data fetching race conditions.
30. `refs-and-dom` Key: `useRef` (mutable box vs DOM handle), `forwardRef` status in 19 (ref as prop), focus, avoiding overuse.
31. `state-architecture` Key: lifting state, `useReducer`, Context and its re-render cost, when to reach for a library.
32. `memoisation-and-performance` Key: `memo/useMemo/useCallback`, profiling first, React Compiler 1.0 and what it changes, code-splitting with `lazy/Suspense`.
33. `custom-hooks-and-patterns` Key: rules of hooks and why, extracting logic, composition vs HOCs vs render props, error boundaries, testing hooks.
34. `react-19-and-concurrency` Key: Actions, `useActionState`, `useOptimistic`, `useFormStatus`, `use`, `useTransition`, `useDeferredValue`, Server Components overview.

### Module 6: Node.js (5)
35. `node-runtime-and-modules` Key: what Node is (V8 + libuv), global `fetch`, `--watch`, ESM vs CJS, `node:` imports, LTS lines (24, 26), native TS type stripping and its limits.
36. `node-event-loop-and-streams` Key: event-loop phases, `nextTick` vs microtasks vs `setImmediate`, thread pool, streams and backpressure, Buffers, `EventEmitter`.
37. `http-and-express` Key: HTTP basics and status codes, Express routing, middleware order, error middleware, validation, REST design.
38. `auth-and-data` Key: sessions vs JWT, password hashing, cookies flags, connecting a database, env config, rate limiting.
39. `scaling-and-testing-node` Key: `cluster` vs `worker_threads`, graceful shutdown, logging, `node:test`, deployment checklist.

### Module 7: Next.js (3)
40. `nextjs-app-router` Key: file-based routing, layouts, server vs client components, the `'use client'` boundary, data fetching on the server, Server Actions.
41. `nextjs-rendering-and-caching` Key: SSR/SSG/ISR/PPR, Next 15 default changes, Next 16 Cache Components (`use cache`, `cacheLife`, `cacheTag`, Suspense for runtime data), `revalidatePath/Tag`; flag version-sensitive.
42. `nextjs-production` Key: route handlers, `proxy` (ex middleware), metadata/SEO, images/fonts, env vars, error/loading UI, deploying.

### Module 8: TypeScript and interview wrap-up (optional, 2 chapters to land at 44)
43. `typescript-essentials` Key: structural typing, interfaces vs types, unions/narrowing, generics, `unknown` vs `any`, `import type`, `erasableSyntaxOnly` for Node type stripping. Verify against TS 7 docs first.
44. `interview-playbook` Key: how to explain output-prediction answers, a topic-to-chapter map, 30 rapid-fire questions, machine-coding round routine. Ties into the platform's mock interview.

## 7. Open items for the owner

- Do not use javascript.info, Eloquent JS, YDKJS, The Odin Project as content sources (NC/ND/SA). Headings only.
- sudheerj JS questions repo has no licence: do not copy question wording even though it is public.
- TypeScript is at 7.0.2 on npm and Next at 16.4.3 with Cache Components: both have moved since most tutorials; re-verify both chapters at write time.
- Not verified this run: nodejs.org Learn content licence and headings, Ecma text-copyright terms, Jake Archibald blog licence, exact stable-since versions for Node `--watch`/`fetch`, TS 7 changes, details of React 19 form hooks.
