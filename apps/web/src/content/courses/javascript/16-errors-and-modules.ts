import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterErrorsAndModules: Chapter = {
  slug: "errors-and-modules",
  title: "Errors, Modules and Strict Mode",
  summary: "try, catch and finally in detail, custom error classes and Error.cause, strict mode, and how ES modules differ from CommonJS, including dynamic import().",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "Real programs fail: the network drops, the input is wrong, the file is missing. This chapter covers how JavaScript reports failure (**errors** that you `throw` and `catch`), the switch that makes the language stricter about silent mistakes (**strict mode**), and how code is split across files (**modules**). They sit together because both decide what happens when something is not as expected.",
    },
    {
      kind: "h",
      text: "The railway announcement analogy",
    },
    {
      kind: "analogy",
      title: "A train delay at the station",
      text: "When a train is delayed, the station master does not keep quiet and hope. A delay is announced; the announcement travels up the line to whoever can act on it (the platform staff, then the control room). Each person either handles it or passes it on. An error works the same way: `throw` raises the announcement, and it travels up the call stack until a `catch` handles it. `finally` is the cleanup that runs whatever happened, such as closing the platform gate. Where the analogy stops: a train delay is information everybody hears. An uncaught error stops the program on that path.",
    },
    {
      kind: "h",
      text: "try, catch, finally and custom errors",
    },
    {
      kind: "code",
      code: `class ValidationError extends Error {
  constructor(message, field, options) {
    super(message, options);
    this.name = "ValidationError";
    this.field = field;
  }
}

function parseAge(text) {
  const n = Number(text);
  if (Number.isNaN(n)) throw new ValidationError("not a number", "age");
  return n;
}

try {
  parseAge("abc");
} catch (err) {
  console.log(err instanceof ValidationError, err instanceof Error);
  console.log(err.name, err.field, err.message);
}

function load() {
  try {
    JSON.parse("{bad");
  } catch (cause) {
    throw new Error("config unreadable", { cause });
  }
}
try {
  load();
} catch (err) {
  console.log(err.message, "<-", err.cause.name);
}

try {
  null.x;
} catch (err) {
  console.log(err.name);
}
try {
  throw "oops";
} catch (err) {
  console.log(typeof err, err);
}`,
      caption: "A custom error keeps the stack and adds fields. `cause` chains the original failure. You can throw any value, but throw `Error` objects.",
      output: `true true
ValidationError age not a number
config unreadable <- SyntaxError
TypeError
string oops`,
      tryIt: {
        language: "javascript",
        prompt: "Add `parseAge(\"-3\")` that throws a `ValidationError` when the age is negative. Catch it and print `err.field`.",
      },
    },
    {
      kind: "p",
      text: "Subclassing `Error` gives you a stack trace and lets you test `err instanceof ValidationError` to decide what to do. **`Error.cause`** (the `{ cause }` option) lets a high-level message wrap the low-level failure without losing it: a caller sees \"config unreadable\" and a debugger can still reach the original `SyntaxError`. Catch only what you can handle, and rethrow the rest.",
    },
    {
      kind: "code",
      code: `function order() {
  try {
    console.log("try");
    return "from try";
  } catch (err) {
    return "from catch";
  } finally {
    console.log("finally");
  }
}
console.log(order());

function override() {
  try {
    return 1;
  } finally {
    return 2;
  }
}
console.log(override());`,
      caption: "`finally` runs even after a `return`. A `return` inside `finally` replaces the earlier one, which is why you should not write it.",
      output: `try
finally
from try
2`,
      tryIt: {
        language: "javascript",
        prompt: "Make the `try` in `order` throw. Which strings print, in which order?",
      },
    },
    {
      kind: "h",
      text: "Strict mode",
    },
    {
      kind: "p",
      text: "**Strict mode** turns some silent mistakes into errors and removes a few confusing features. It is switched on by the line `\"use strict\";` at the top of a script or a function. ES modules and class bodies are strict automatically, so most modern code already is. In strict mode, assigning to an undeclared name throws, a plain function call has `this` of `undefined` (chapter 11), duplicate parameter names are an error, and assignment to a read-only property throws instead of failing quietly.",
    },
    {
      kind: "code",
      code: `function strictAssign() {
  "use strict";
  try {
    leaked = 5;
  } catch (err) {
    return err.name;
  }
  return "no error";
}
function frozenWrite() {
  "use strict";
  const o = Object.freeze({ a: 1 });
  try {
    o.a = 2;
  } catch (err) {
    return err.name;
  }
  return "no error";
}
console.log(strictAssign(), frozenWrite());`,
      caption: "Both mistakes would pass silently without strict mode.",
      output: "ReferenceError TypeError",
      tryIt: {
        language: "javascript",
        prompt: "Add a function that assigns to `undefined` or to `NaN` under strict mode. What error do you get?",
      },
    },
    {
      kind: "h",
      text: "Modules: ESM and CommonJS",
    },
    {
      kind: "compare",
      title: "ES modules vs CommonJS",
      columns: [
        {
          label: "ES modules (ESM)",
          items: [
            "`import x from \"./x.js\"` and `export`.",
            "The standard, in browsers and Node.",
            "Always strict; supports top-level `await`.",
            "Imports are live, read-only views of the exporter's bindings.",
          ],
        },
        {
          label: "CommonJS (CJS)",
          items: [
            "`const x = require(\"./x\")` and `module.exports`.",
            "Node's original system, still very common.",
            "Loads synchronously; no top-level `await`.",
            "`require` returns whatever was exported at that moment.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `// math.js (an ES module)
export const PI = 3.14159;
export function area(r) {
  return PI * r * r;
}
export default function describe(r) {
  return "circle of radius " + r;
}

// app.js
import describe, { area, PI } from "./math.js";
import * as math from "./math.js";
console.log(describe(2), area(2), PI === math.PI);

// Loaded only when needed, returns a promise:
button.addEventListener("click", async () => {
  const { area } = await import("./math.js");
  console.log(area(5));
});`,
      caption: "Named exports are imported by exact name in braces; the default export takes any name you choose. These are files, so the block cannot run here.",
    },
    {
      kind: "p",
      text: "**Dynamic `import()`** is the form of import you can call anywhere, with a computed path. It returns a promise for the module, which is how bundlers and frameworks split a page into chunks loaded on demand (chapter 32 uses it for `lazy`). In Node, a file is treated as an ES module if it ends in `.mjs` or the nearest `package.json` has `\"type\": \"module\"`; otherwise it is CommonJS. Check the Node documentation for the current rules on mixing the two, since they have changed across recent versions.",
    },
    {
      kind: "concept",
      title: "Imports are bindings, not copies",
      text: "In an ES module, `import { count } from \"./counter.js\"` is a **live view** of the exporter's variable. If the exporting module later increments `count`, the importer sees the new value, and the importer cannot assign to it. In CommonJS, `const { count } = require(\"./counter\")` copies the value at that moment, so a later change is not seen. Modules are also **evaluated once** and cached; every importer shares one instance.",
    },
    {
      kind: "pitfall",
      items: [
        "Swallowing errors with an empty `catch {}`. At least log it, or rethrow what you cannot handle.",
        "Throwing strings or plain objects. They carry no stack. Throw `Error` or a subclass.",
        "Putting a `return` in `finally`, which silently cancels an earlier return or a thrown error.",
        "Forgetting that `catch` only sees errors from the awaited code inside its `try`. A promise created without `await` or `.catch` escapes it (chapter 19).",
        "Mixing `require` into an ES module, or `import` into a CommonJS file, and getting `ReferenceError` or `SyntaxError`. Match the file's module type.",
        "Writing a circular import and reading a binding before it is initialised. Move the shared code to a third module.",
      ],
    },
    {
      kind: "remember",
      items: [
        "`throw` raises, `catch` handles, `finally` always runs; subclass `Error`, set `name`, and chain the original with `{ cause }`.",
        "`finally` runs after a `return`, and a `return` inside `finally` overrides the earlier one.",
        "Strict mode makes silent mistakes loud (undeclared assignment, writes to frozen objects, undefined `this`); modules and classes are strict already.",
        "ESM uses `import`/`export` with live bindings and top-level `await`; CJS uses `require`/`module.exports` and copies; `import()` loads on demand and returns a promise.",
      ],
    },
    {
      kind: "interview",
      items: [
        "How do you create a custom error? A strong answer: extend `Error`, call `super(message)`, set `name`, add fields, and check with `instanceof`.",
        "What does `finally` do with a `return`? A strong answer: it still runs, and a return inside finally overrides the earlier return or throw.",
        "What does strict mode change? A strong answer: undeclared assignments throw, `this` is undefined in plain calls, writes to read-only properties throw, duplicates are errors; modules are strict by default.",
        "What is the difference between ESM and CommonJS? A strong answer: static import/export with live bindings and async loading versus require/module.exports with synchronous loading and copied values.",
        "What is dynamic `import()` for? A strong answer: loading a module on demand, returning a promise; used for code splitting and conditional loading.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

function f() {
  try {
    throw new Error("x");
  } catch (e) {
    return "catch";
  } finally {
    console.log("finally");
  }
}
console.log(f());`,
      options: ["finally, then catch", "catch, then finally", "catch only", "finally only"],
      answer: 0,
      why: "The return value is decided in catch, but finally runs before the function actually returns, so \"finally\" is logged first and then the caller logs \"catch\".",
    },
    {
      kind: "quiz",
      question: `What is true of the last line?

const e = new Error("outer", { cause: new TypeError("inner") });
console.log(e.cause instanceof TypeError);`,
      options: ["It prints true", "It prints false", "It prints undefined", "It throws a SyntaxError"],
      answer: 0,
      why: "The second argument to the Error constructor can carry a cause, which is stored on the cause property exactly as given, here a TypeError object.",
    },
    {
      kind: "quiz",
      question: `A module exports let count = 0 and a function inc() that does count++. After the importer calls inc(), what does an ES module importer reading count see?`,
      options: ["1, it is live", "0, a copy was taken", "undefined, not exported", "It throws a TypeError"],
      answer: 0,
      why: "ES module imports are live bindings to the exporter's variable, so the importer sees the incremented value. A CommonJS require would have given a copy of the value at the time.",
    },
  ],
};
