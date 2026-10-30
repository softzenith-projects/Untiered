import type { Chapter } from "@/content/courses/types";

// The runnable sample is a plain-JavaScript model; its output was produced by running it under node.
// Facts about Node versions are from docs/javascript-course-research.md section 4.
export const chapterNodeRuntimeAndModules: Chapter = {
  slug: "node-runtime-and-modules",
  title: "Node.js: The Runtime, Modules and Native TypeScript",
  summary:
    "What Node.js actually is (V8 plus libuv), what the current LTS lines already include so you can skip old packages, how CommonJS and ES modules differ, and what native type stripping can and cannot do (as of Node 24 and 26).",
  minutes: 20,
  blocks: [
    {
      kind: "p",
      text: "**Node.js** is a program that runs JavaScript outside the browser. It is how the same language writes servers, command-line tools and build scripts. It is not a language and not a framework: it is a **runtime**, which means it supplies the engine that runs your code and the tools your code uses to talk to the computer. The two big questions an interview asks about it are \"what is inside Node?\" and \"how do modules work?\", and this chapter answers both.",
    },
    {
      kind: "h",
      text: "The tiffin-service analogy",
    },
    {
      kind: "analogy",
      title: "A kitchen that cooks and a delivery network that carries",
      text: "Think of a tiffin service. One cook (the **V8 engine**) reads each recipe and cooks it, one dish at a time. But the cook never leaves the kitchen to collect vegetables or deliver boxes; a team of runners (**libuv**) handles the roads, the shops and the waiting, and tells the cook when something is back. Node.js is the whole service: the cook, the runners, and the shelf of ready-made tools (files, network, timers) that your recipe can ask for. Where the analogy stops: the cook really is one person for your JavaScript, but the runners are real threads and operating-system helpers, so Node as a whole is not \"single-threaded\" the way people often say.",
    },
    {
      kind: "h",
      text: "What is inside Node",
    },
    {
      kind: "concept",
      title: "Node = V8 + libuv + built-in modules",
      text: "**V8** is the engine, also used by Chrome, that compiles and runs your JavaScript. **libuv** is a C library that gives Node its event loop and asynchronous file, network and timer work, using the operating system and a thread pool. The **built-in modules** (`node:fs`, `node:http`, `node:path`, `node:test` and more) are the tools your code imports. The browser's `window` and `document` are not here; Node has its own globals such as `process`, `Buffer` and `fetch`.",
    },
    {
      kind: "p",
      text: "A claim worth fixing early: \"Node is single-threaded.\" Your JavaScript runs on one thread, but libuv keeps a thread pool for file-system, DNS, crypto and compression work, and Node has `worker_threads` when you want more JavaScript threads. The next chapter goes deeper. What matters now: a long loop in your code blocks every request, because there is only one cook.",
    },
    {
      kind: "h",
      text: "Which Node to learn against",
    },
    {
      kind: "p",
      text: "Node has a release line every year, and only some lines are **LTS** (long-term support), meant for production. As of late October 2026, **Node 24** and **Node 26** are the supported LTS lines (24 moved into maintenance on 20 October 2026; 26 entered LTS on 28 October 2026). Node 22 is in maintenance until April 2027, and Node 20 has reached end of life. Dates move, so check `nodejs.org/en/about/previous-releases` before you pick a version for a real project.",
    },
    {
      kind: "table",
      head: ["You used to install", "Current LTS gives you", "Use it like this"],
      rows: [
        ["node-fetch or axios for simple calls", "global `fetch`", "`const res = await fetch(url)`"],
        ["nodemon to restart on save", "`--watch` flag", "`node --watch server.js`"],
        ["jest or mocha for basic tests", "built-in `node:test`", "`node --test`"],
        ["ts-node to run TypeScript", "native type stripping", "`node app.ts` (with limits, below)"],
      ],
    },
    {
      kind: "p",
      text: "Those packages are not wrong: axios and jest have features the built-ins lack. The point is that a new project does not need them by default, and an interviewer who asks \"why did you add this dependency?\" wants to hear that you checked.",
    },
    {
      kind: "h",
      text: "Modules: every file is its own room",
    },
    {
      kind: "p",
      text: "A **module** is a file with its own private scope: a variable you declare in it is not visible to other files unless you export it. Node has two module systems. **CommonJS (CJS)** is the original: `require()` to import, `module.exports` to export. **ES modules (ESM)** are the language's standard: `import` and `export`. A file is ESM when its name ends in `.mjs`, or when it ends in `.js` and the nearest `package.json` says `\"type\": \"module\"`; otherwise `.js` is CommonJS. Both are in daily use, so you need to read both.",
    },
    {
      kind: "compare",
      title: "CommonJS vs ES modules",
      columns: [
        {
          label: "CommonJS",
          items: [
            "`const fs = require(\"node:fs\")` runs when that line is reached.",
            "`module.exports = ...` or `exports.name = ...`.",
            "`require` is a plain function, so it can be called inside an `if`.",
            "`__dirname` and `__filename` exist.",
            "No top-level `await`.",
          ],
        },
        {
          label: "ES modules",
          items: [
            "`import fs from \"node:fs\"` is static: analysed before the code runs.",
            "`export const x`, `export default ...`.",
            "`import()` is the dynamic form and returns a promise.",
            "`import.meta.dirname` and `import.meta.filename` instead of `__dirname`.",
            "Top-level `await` is allowed.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "Two details matter in practice. First, import **built-ins with the `node:` prefix** (`node:fs`, `node:path`): it makes clear that the module is Node's own and not a package of the same name from npm. Second, ESM imports of your own files need the **file extension** (`./util.js`), unlike many bundler setups. Mixing the two systems has rules: ESM can `import` a CommonJS file easily, while a CommonJS file loading an ES module is more restricted, and recent LTS lines relaxed it for synchronous modules, so check the `esm` page of the Node docs for the exact rule on your version.",
    },
    {
      kind: "p",
      text: "Why does `require` give every caller the same object? Because Node **caches** a module by its resolved path the first time it loads, and returns the cached `module.exports` afterwards. The file runs once. The sample below is a **model**, not Node's real loader, but it shows the three ideas that explain the behaviour: a file is a function, it receives its own `module` object, and results are cached by path.",
    },
    {
      kind: "code",
      caption:
        "A MODEL of a CommonJS-style loader: each file is a function that gets its own module object, and results are cached by path. It is not Node's real loader and skips path resolution. Runs in the course editor and under node.",
      code: `// A MODEL of a CommonJS-style loader. It is not Node's real loader: it shows the idea
// that every file is a function, and that results are cached by path.
const sources = {
  "/counter.js": function (module, exports, require) {
    console.log("  counter.js is running");
    let count = 0;
    module.exports = {
      next: function () {
        count += 1;
        return count;
      },
    };
  },
  "/app.js": function (module, exports, require) {
    const a = require("/counter.js");
    const b = require("/counter.js");
    console.log("  same object?", a === b);
    console.log("  next:", a.next(), b.next(), a.next());
  },
};

const cache = {};
function load(path) {
  if (cache[path]) {
    console.log("cache hit for", path);
    return cache[path].exports;
  }
  console.log("loading", path);
  const module = { exports: {} };
  cache[path] = module; // stored BEFORE the file runs, so a circular import cannot loop forever
  sources[path](module, module.exports, load);
  return module.exports;
}

load("/app.js");
console.log("cached modules:", Object.keys(cache).join(", "));
`,
      output: `loading /app.js
loading /counter.js
  counter.js is running
cache hit for /counter.js
  same object? true
  next: 1 2 3
cached modules: /app.js, /counter.js`,
      tryIt: {
        language: "javascript",
        prompt:
          "Predict the output, then run it. Now add a second file that also requires \"/counter.js\" and call it from app.js. Does counter.js print its message again? What does that tell you about module-level state?",
      },
    },
    {
      kind: "steps",
      title: "What require does, in order (the idea, simplified)",
      steps: [
        { label: "Resolve", text: "Turn the name into a file path: a relative path, a built-in, or a package found in node_modules." },
        { label: "Check the cache", text: "If that path has been loaded, return its stored exports and stop." },
        { label: "Wrap and run", text: "Run the file as a function with its own module, exports and require, so its variables stay private." },
        { label: "Cache and return", text: "Store the result under the path, and hand back module.exports." },
      ],
    },
    {
      kind: "h",
      text: "Running TypeScript without a build step",
    },
    {
      kind: "p",
      text: "Node can run `.ts` files directly. This is **type stripping**: Node deletes the type annotations and runs what is left, which is plain JavaScript. It was switched on by default in Node 23.6 and 22.18, and the docs mark it stable from Node 24.12 and 25.2, so it is available on both current LTS lines. The limits are the part interviews and real projects hit.",
    },
    {
      kind: "list",
      items: [
        "It **erases types only**. It does no type checking, so a type error still runs. Run `tsc --noEmit` separately to check.",
        "It ignores `tsconfig.json`.",
        "Syntax that needs generated code is not supported: `enum`, class parameter properties and runtime `namespace`. The TypeScript option `erasableSyntaxOnly` makes the compiler flag these for you.",
        "Imports need the real file extension (`./util.ts`), and type-only imports must say `import type`.",
        "`.tsx` files are not supported, and Node refuses to strip types from files inside `node_modules`.",
      ],
    },
    {
      kind: "code",
      caption:
        "Real Node usage, shown as commands and a TypeScript file. It runs on Node 24 or 26 from a terminal, not in the course editor, so no output is shown.",
      code: `// ---- greet.ts ----  (run with:  node greet.ts)
import type { User } from "./types.ts"; // "import type" is erased; the extension is required

export function greet(user: User): string {
  return "Hello, " + user.name;
}

// ---- terminal ----
// node --watch server.js     restart on every save, no nodemon
// node --test                run files that use node:test
// node greet.ts              strips the types, then runs
// npx tsc --noEmit           the type check Node does NOT do
`,
    },
    {
      kind: "pitfall",
      items: [
        "Importing a built-in as `fs` and a same-named npm package getting loaded by accident. Fix: write `node:fs`, which always means the built-in.",
        "Using `__dirname` in an ES module, where it does not exist. Fix: use `import.meta.dirname`, or build a path from `import.meta.url`.",
        "Forgetting the `.js` extension on a relative ESM import. Fix: write `./util.js`; Node does not guess extensions for ES modules.",
        "Believing that `node app.ts` checks your types. It only strips them. Fix: keep `tsc --noEmit` in your scripts and CI.",
        "Using `enum` or constructor parameter properties, then finding that type stripping rejects them. Fix: use a union of string literals or a plain object, and turn on `erasableSyntaxOnly`.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Node is V8 (runs your JavaScript) plus libuv (event loop, thread pool, I/O) plus built-in modules. Your JavaScript is one thread; Node is not.",
        "Learn against a supported LTS line (24 or 26 as of late 2026) and check the release page, because versions and dates move.",
        "A module is cached by path after its first load, so module-level variables are shared by every importer.",
        "Type stripping erases types and does nothing else: no type checking, no tsconfig, no enums or namespaces.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is Node.js, and is it single-threaded?\" Strong answer: a runtime built on V8 and libuv. Your JavaScript runs on one thread, while libuv's thread pool and OS facilities do I/O, and worker_threads give extra JavaScript threads.",
        "\"What is the difference between require and import?\" Strong answer: CommonJS loads synchronously at the line reached and can be conditional; ES modules are static, analysed first, support top-level await, and need file extensions.",
        "\"If two files require the same module, how many times does it run?\" Strong answer: once; Node caches by resolved path and returns the same module.exports, which is why module-level state is shared.",
        "\"Can Node run TypeScript directly?\" Strong answer: yes on current LTS lines through type stripping, but it only erases types, ignores tsconfig and does not support enums or namespaces, so you still run tsc for checking.",
      ],
    },
    {
      kind: "quiz",
      question: `A module does this:
let hits = 0;
module.exports = { hit: () => ++hits };
Two other files each require it and call hit() once. What does the second call return?`,
      options: [
        "1, because each importer gets its own copy of the module",
        "2, because the module runs once and both importers share it",
        "0, because hits is private and cannot change",
        "It throws, because a module cannot hold state",
      ],
      answer: 1,
      why: "Node caches a module by path after the first load, so both files receive the same exports object and the same hits variable. The second call returns 2.",
    },
    {
      kind: "quiz",
      question: "You run `node app.ts` and the file contains `const n: number = \"five\";`. What happens?",
      options: [
        "Node reports a type error and refuses to start",
        "Node strips the annotation and runs the code; no type error is reported",
        "Node converts the string to a number automatically",
        "Node reads tsconfig.json and applies strict mode",
      ],
      answer: 1,
      why: "Type stripping only erases the annotations. It performs no type checking and ignores tsconfig.json, so the mistake is only caught by running tsc.",
    },
    {
      kind: "quiz",
      question: "Which line is the safest way to import Node's built-in file-system module?",
      options: [
        "import fs from \"fs-extra\"",
        "const fs = require(\"./fs\")",
        "import fs from \"node:fs\"",
        "import fs from \"file-system\"",
      ],
      answer: 2,
      why: "The node: prefix always means the built-in module, so an npm package with a similar name can never be loaded by mistake.",
    },
  ],
};
