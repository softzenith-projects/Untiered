import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterToolingAndTesting: Chapter = {
  slug: "tooling-and-testing",
  title: "Tooling, Testing and Big-O",
  summary: "What npm and package.json do, why lockfiles exist, what a bundler is for, how ESLint and Prettier differ, how a unit test works, and a short Big-O and recursion refresher for interview rounds.",
  minutes: 20,
  blocks: [
    {
      kind: "p",
      text: "Writing JavaScript is only half the job. Real projects also install other people's code, check style, run tests and package files for the browser. These tools look like a pile of config files until you see the one job each does. This chapter names the job of every file you will meet, shows how a test works from first principles, and closes with the Big-O and recursion ideas that interviews keep returning to.",
    },
    {
      kind: "h",
      text: "The kitchen shelf analogy",
    },
    {
      kind: "analogy",
      title: "A shopping list, a receipt and a quality check",
      text: "Cooking from a recipe needs three things: a shopping list (what to buy), a receipt (exactly which brand and pack you bought, so you can buy the same next time), and someone tasting the dish before it is served. `package.json` is the shopping list, the lockfile is the receipt, and linters and tests are the tasting. Where the analogy stops: the shopping list may say \"any flour, roughly this kind\" (a version range), and without the receipt two cooks can end up with different flour. That difference is what lockfiles remove.",
    },
    {
      kind: "h",
      text: "npm, package.json and lockfiles",
    },
    {
      kind: "code",
      code: `{
  "name": "tea-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "test": "node --test"
  },
  "dependencies": { "react": "^19.0.0" },
  "devDependencies": { "eslint": "^9.0.0", "vite": "^7.0.0" }
}`,
      caption: "A `package.json`. The `^` means \"this major version, any newer minor or patch\". Version numbers here are illustrative.",
    },
    {
      kind: "list",
      items: [
        "**`dependencies`** are needed when the app runs; **`devDependencies`** only while building and testing.",
        "**`scripts`** are named commands. `npm run build` runs the `build` entry; `npm test` is a shortcut for `test`.",
        "**`package-lock.json`** records the exact version of every package, including those you did not ask for directly. Commit it.",
        "`npm install` may update the lockfile within the ranges allowed; **`npm ci`** installs exactly what the lockfile says and fails if it disagrees, which is what CI should use.",
        "Versions are `major.minor.patch` (semver). A major bump may break you; `^1.4.2` accepts `1.x.y` at least `1.4.2`, and `~1.4.2` accepts only `1.4.x`.",
      ],
    },
    {
      kind: "h",
      text: "Bundlers, linters, formatters",
    },
    {
      kind: "compare",
      title: "Which tool does which job",
      columns: [
        {
          label: "Bundler",
          items: ["Reads your imports, joins and minifies the files for the browser.", "Splits code into chunks and handles TypeScript, JSX and CSS.", "Examples: Vite, webpack, esbuild, Turbopack."],
        },
        {
          label: "Linter",
          items: ["Finds likely bugs and rule breaks: unused variables, `==`, missing dependencies.", "Does not change meaning unless you ask it to fix.", "ESLint is the standard."],
        },
        {
          label: "Formatter",
          items: ["Rewrites layout only: spaces, quotes, line breaks.", "Ends arguments about style.", "Prettier is the common one."],
        },
      ],
    },
    {
      kind: "p",
      text: "A bundler exists because browsers once loaded one file per request and could not read `node_modules`. Modern browsers understand ES modules, but bundling still reduces requests, removes unused code and compiles syntax the browser cannot run, such as JSX or TypeScript. In frameworks like Next.js it is built in, so you rarely configure one directly.",
    },
    {
      kind: "h",
      text: "How a unit test works",
    },
    {
      kind: "p",
      text: "A **unit test** calls one small piece of code with chosen inputs and compares the result to what you expect. If they differ, it fails with a message. The sample is a **model**: about fifteen lines that behave like a tiny `test` and `expect`, so there is no magic in frameworks. It is not the real Jest, Vitest or `node:test`.",
    },
    {
      kind: "code",
      code: `const results = [];

function test(name, fn) {
  try {
    fn();
    results.push("pass  " + name);
  } catch (err) {
    results.push("FAIL  " + name + ": " + err.message);
  }
}
function expect(actual) {
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        throw new Error("expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
      }
    },
  };
}

const add = (a, b) => a + b;
const buggyAdd = (a, b) => a - b;

test("adds two numbers", () => expect(add(2, 3)).toBe(5));
test("adds a negative", () => expect(add(-1, 1)).toBe(0));
test("buggy add is caught", () => expect(buggyAdd(2, 3)).toBe(5));

console.log(results.join("\\n"));
console.log(results.filter((line) => line.startsWith("pass")).length + " of " + results.length + " passed");`,
      caption: "A test runner is a loop with `try` and `catch`. A failing assertion is just a thrown error.",
      output: `pass  adds two numbers
pass  adds a negative
FAIL  buggy add is caught: expected 5, got -1
2 of 3 passed`,
      tryIt: {
        language: "javascript",
        prompt: "Add a `toEqual` check that compares two arrays using `JSON.stringify`. Write one passing and one failing test for it.",
      },
    },
    {
      kind: "code",
      code: `// add.test.js, run with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { add } from "./add.js";

test("adds two numbers", () => {
  assert.equal(add(2, 3), 5);
});

test("rejects text", () => {
  assert.throws(() => add("a", 1), TypeError);
});`,
      caption: "The same idea with Node's built-in test runner (`node:test`), which needs no install. Jest and Vitest follow the same shape with `expect(...).toBe(...)`.",
    },
    {
      kind: "p",
      text: "Good tests check **behaviour**, not implementation: what goes in and what comes out, including the boundaries (empty array, zero, a negative number, `null`). Keep each test small and independent, and name it for the case it covers. When code calls the network or a clock, replace that dependency with a fake you control so the test stays fast and repeatable.",
    },
    {
      kind: "h",
      text: "Big-O and recursion refresher",
    },
    {
      kind: "concept",
      title: "Big-O describes growth, not seconds",
      text: "**Big-O** says how the number of steps grows as the input size `n` grows, ignoring constants. Looking up an array index is O(1). Scanning a list is O(n). Binary search on sorted data is O(log n). Two nested loops over the same list is O(n squared). Sorting is O(n log n). For large `n`, the class matters far more than machine speed. Memoisation (chapter 14) trades memory for time; recursion costs stack space proportional to its depth.",
    },
    {
      kind: "code",
      code: `const data = Array.from({ length: 1000 }, (_, i) => i * 2);

function linear(list, target) {
  let steps = 0;
  for (const x of list) {
    steps += 1;
    if (x === target) return steps;
  }
  return steps;
}
function binary(list, target) {
  let low = 0;
  let high = list.length - 1;
  let steps = 0;
  while (low <= high) {
    steps += 1;
    const mid = (low + high) >> 1;
    if (list[mid] === target) return steps;
    if (list[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return steps;
}
console.log("linear:", linear(data, 1998), "binary:", binary(data, 1998));
console.log("missing value, binary:", binary(data, 7));`,
      caption: "Counting steps for the last element of 1,000 sorted numbers: up to 1,000 for a scan, about 10 for halving the range each time.",
      output: `linear: 1000 binary: 10
missing value, binary: 10`,
      tryIt: {
        language: "javascript",
        prompt: "Make the list 1,000,000 long and search for the last element. How many steps does each take?",
      },
    },
    {
      kind: "pitfall",
      items: [
        "Deleting the lockfile or leaving it out of git. Teammates and CI then get different versions. Commit it, and use `npm ci` in CI.",
        "Putting build tools in `dependencies`, or runtime libraries in `devDependencies`. A production install may omit the second.",
        "Treating a passing linter as proof the code is correct. It finds patterns, not logic errors; tests check behaviour.",
        "Writing tests that copy the implementation. They pass even when the logic is wrong; test known inputs and outputs.",
        "Using Big-O for tiny inputs and optimising the wrong thing. Measure first; apply Big-O when `n` can grow.",
        "Forgetting the base case in recursion, or recursing deep on large input and overflowing the call stack.",
      ],
    },
    {
      kind: "remember",
      items: [
        "`package.json` lists what you need; the lockfile pins exactly what you got; `npm ci` reproduces it. Commit both.",
        "Bundlers package code for the browser, linters find likely bugs, formatters fix layout only.",
        "A test calls code with chosen input and throws if the output differs; cover normal cases and boundaries.",
        "Big-O is growth rate: O(1), O(log n), O(n), O(n log n), O(n squared). Pick the class before micro-tuning.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is the difference between `dependencies` and `devDependencies`? A strong answer: runtime versus build and test time; production installs can skip dev dependencies.",
        "Why commit `package-lock.json`, and how does `npm ci` differ from `npm install`? A strong answer: it pins every transitive version for reproducible installs; `npm ci` installs exactly the lockfile and fails on mismatch.",
        "What does a bundler do? A strong answer: resolves imports, combines and minifies code, tree-shakes unused exports, and compiles non-browser syntax into chunks the browser loads.",
        "What is the time complexity of binary search, and what does it require? A strong answer: O(log n), on sorted random-access data, halving the range each step.",
        "How would you test a function that calls an API? A strong answer: inject or mock the fetch dependency, assert on outputs and error paths, and keep the test free of network and clock.",
      ],
    },
    {
      kind: "quiz",
      question: `What is the Big-O of this function?

function hasDuplicate(list) {
  for (const a of list) {
    for (const b of list) {
      if (a === b) return true;
    }
  }
  return false;
}`,
      options: ["O(n squared)", "O(n) in a single pass", "O(log n) by halving", "O(1) in constant time"],
      answer: 0,
      why: "The inner loop runs through the whole list for each element of the outer loop, so the work grows with n times n. (It also has a bug: every element equals itself.)",
    },
    {
      kind: "quiz",
      question: `Your CI installs dependencies with npm ci and fails with a message that package.json and package-lock.json are out of sync. What is the likely cause?`,
      options: [
        "package.json changed but the lockfile did not.",
        "The Node version on the machine is too new for it.",
        "A test inside the project is failing right now.",
        "ESLint found formatting errors in the project code.",
      ],
      answer: 0,
      why: "npm ci installs exactly what the lockfile records and refuses to proceed if package.json asks for something different. Run npm install locally, commit the updated lockfile, and push.",
    },
    {
      kind: "quiz",
      question: `Which tool should decide whether a line uses single or double quotes?`,
      options: ["A formatter like Prettier", "The bundler that builds your files", "The unit test that covers the code", "The lockfile that pins package versions"],
      answer: 0,
      why: "Quote style is layout, which is the formatter's job. Linters can also check it, but having one automatic formatter ends the debate and leaves the linter for real problems.",
    },
  ],
};
