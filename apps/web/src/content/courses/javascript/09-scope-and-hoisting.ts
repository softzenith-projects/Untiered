import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterScopeAndHoisting: Chapter = {
  slug: "scope-and-hoisting",
  title: "Scope and Hoisting",
  summary: "Where a name is visible, why `var` leaks out of blocks, what hoisting really does to every declaration, and why `let` and `const` throw before their line.",
  minutes: 17,
  blocks: [
    {
      kind: "p",
      text: "**Scope** is the answer to one question: from this line of code, which names can I see? Hoisting is the answer to a second one: what does the engine do with a name before the line that declares it runs? Both come from the same fact. JavaScript reads your code twice. First it sets up every name in each scope. Then it runs the lines.",
    },
    {
      kind: "h",
      text: "The apartment building analogy",
    },
    {
      kind: "analogy",
      title: "Rooms inside a building",
      text: "Think of a building with a flat inside it and a bedroom inside the flat. Standing in the bedroom you can use the bedroom's things, then the flat's, then the building's lift and stairs, but never a neighbour's flat. That outward search is the **scope chain**. Before anyone moves in, the society office has already written every flat's nameplate on its door: the name exists from the start, even if the furniture arrives later. That is hoisting. Where the analogy stops: a nameplate on a `let` door has a \"do not enter yet\" sign until the owner actually moves in, and `var` nameplates come with an empty room already open.",
    },
    {
      kind: "h",
      text: "Three kinds of scope",
    },
    {
      kind: "concept",
      title: "Global, function, block",
      text: "**Global scope** is the outermost one. **Function scope** is created by every function call, and `var` belongs to it. **Block scope** is created by any pair of braces (`if`, `for`, a bare `{}`), and `let`, `const` and `class` belong to it. A name is looked up in the current scope, then each enclosing scope outward, and the first match wins. Inside a module (ESM) or a Node file, top-level names are local to that file, not truly global.",
    },
    {
      kind: "code",
      code: `function outer() {
  var fnScoped = "function";
  if (true) {
    let blockLet = "block";
    var blockVar = "leaks out";
    console.log(blockLet);
  }
  console.log(typeof blockLet, blockVar);
  console.log(fnScoped);
}
outer();
console.log(typeof fnScoped);`,
      caption: "`var` ignores the braces of an `if`; `let` respects them. Neither can be seen from outside the function.",
      output: `block
undefined leaks out
function
undefined`,
      tryIt: {
        language: "javascript",
        prompt: "Change `var blockVar` to `let blockVar` and run. Which line now fails, and what error does it give?",
      },
    },
    {
      kind: "h",
      text: "Hoisting: every declaration, not just var",
    },
    {
      kind: "p",
      text: "Before a scope runs, the engine registers every declaration in it. What differs is the state each name starts in. A **function declaration** is registered with its whole body, so you can call it above its line. A **`var`** is registered and set to `undefined`. A **`let`, `const` or `class`** is registered but left **uninitialised**: touching it before its line throws a `ReferenceError`. The stretch from the start of the scope to that line is the **temporal dead zone** (TDZ).",
    },
    {
      kind: "compare",
      title: "What each declaration holds before its line runs",
      columns: [
        {
          label: "function declaration",
          items: ["Hoisted with its full body.", "Callable from the top of its scope."],
        },
        {
          label: "var",
          items: ["Hoisted, value is `undefined`.", "Reading early gives `undefined`, no error."],
        },
        {
          label: "let / const / class",
          items: ["Hoisted, but uninitialised (TDZ).", "Reading early throws a ReferenceError."],
        },
      ],
    },
    {
      kind: "code",
      code: `console.log(typeof hoisted, typeof early);
console.log(hoisted());
function hoisted() {
  return "works before its line";
}
var early = 1;

try {
  console.log(late);
} catch (err) {
  console.log(err.name);
}
let late = 2;
console.log(late);`,
      caption: "The function works above its line, the `var` is undefined, and the `let` throws. In Node and Chrome the message reads \"Cannot access 'late' before initialization\"; Firefox and Safari word it differently, so the sample prints only the error's name.",
      output: `function undefined
works before its line
ReferenceError
2`,
      tryIt: {
        language: "javascript",
        prompt: "Move `let late = 2;` above the `try` block. What does the program print now?",
      },
    },
    {
      kind: "concept",
      title: "Only the declaration is hoisted, not the assignment",
      text: "`var early = 1;` is two jobs: declare `early` (hoisted, so it exists from the start) and assign `1` (done when the line runs). Hoisting moves the first job only. A function expression such as `var f = function () {}` is therefore a `var` that holds `undefined` until its line, and calling `f()` early gives `TypeError: f is not a function`, not a ReferenceError.",
    },
    {
      kind: "h",
      text: "Shadowing, and who wins a name clash",
    },
    {
      kind: "p",
      text: "An inner scope can reuse an outer name. The inner one **shadows** the outer one, which stays untouched. The classic trap is a `var` inside a function that shares a name with an outer variable: the inner declaration is hoisted to the top of the function, so the outer one is hidden even on lines before the assignment.",
    },
    {
      kind: "code",
      code: `var label = "outer";
function show() {
  console.log(label);
  var label = "inner";
  console.log(label);
}
show();

var thing = 1;
function thing() {}
console.log(typeof thing);

let city = "outer";
{
  let city = "inner";
  console.log(city);
}
console.log(city);`,
      caption: "The inner `var label` hides the outer one from the first line. When a `var` and a function share a name, the function is set up first and the assignment overwrites it.",
      output: `undefined
inner
number
inner
outer`,
      tryIt: {
        language: "javascript",
        prompt: "Delete `var label = \"inner\";` inside `show`. Predict what the first `console.log` prints, then run.",
      },
    },
    {
      kind: "steps",
      title: "How the engine handles one scope",
      steps: [
        { label: "Create", text: "A new scope is made when a function is called or a block is entered." },
        { label: "Register", text: "Every declaration in it is recorded: functions with bodies, `var` as undefined, `let`/`const`/`class` as uninitialised." },
        { label: "Run", text: "Lines execute top to bottom. A `let` line initialises its name and ends its dead zone." },
        { label: "Look up", text: "A name not found here is searched in the enclosing scope, outward to global, or a ReferenceError is thrown." },
      ],
    },
    {
      kind: "h",
      text: "The loop that explains why let was added",
    },
    {
      kind: "code",
      code: `const withVar = [];
for (var i = 0; i < 3; i++) {
  withVar.push(() => i);
}
console.log(withVar.map((f) => f()));

const withLet = [];
for (let j = 0; j < 3; j++) {
  withLet.push(() => j);
}
console.log(withLet.map((f) => f()));`,
      caption: "One `var i` is shared by all three arrow functions. `let j` gets a fresh copy for each pass of the loop.",
      output: `[ 3, 3, 3 ]
[ 0, 1, 2 ]`,
      tryIt: {
        language: "javascript",
        prompt: "Change the loop bound to 5 and predict both arrays before you run.",
      },
    },
    {
      kind: "p",
      text: "Why the closures remember a variable, not a value, is the subject of chapter 10. The scope rule is enough to explain this one: a `var` has a single home for the whole function, while a `let` in a `for` header is created fresh for every iteration.",
    },
    {
      kind: "pitfall",
      items: [
        "Saying \"`let` and `const` are not hoisted\". They are hoisted but uninitialised; the ReferenceError is the proof. Say \"temporal dead zone\".",
        "Expecting `var` inside an `if` or `for` to stay in the block. It belongs to the whole function. Use `let` or `const` by default.",
        "Calling a function expression or arrow function above its line. Only declarations are hoisted with their body.",
        "Using `typeof x` as a safe check for a `let` in its dead zone. It throws there too; `typeof` is only safe for names never declared at all.",
        "Reusing a name in an inner scope by accident and then wondering why the outer value did not change. That is shadowing; rename one of them.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Scope decides which names a line can see; lookup goes from the current scope outward and the first match wins.",
        "`var` is function-scoped and starts as `undefined`; `let`, `const` and `class` are block-scoped and sit in the temporal dead zone until their line runs.",
        "Everything is hoisted. Only function declarations arrive with their value; for `var` just the name does.",
        "An inner declaration shadows an outer one for the whole inner scope, even on lines before it.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is hoisting? A strong answer: declarations are registered when a scope is created, before any line runs; the initial state differs by kind (function with body, var undefined, let/const uninitialised).",
        "Are `let` and `const` hoisted? A strong answer: yes, but they are uninitialised until the declaration runs, so early access throws a ReferenceError (the temporal dead zone).",
        "What is the output of a loop that pushes `() => i` into an array, with `var` and with `let`? A strong answer: `var` gives all the final value because there is one binding; `let` creates a new binding per iteration.",
        "What is the scope chain? A strong answer: the list of enclosing scopes searched outward at lookup time; it is fixed by where the code is written, not where it is called.",
        "What is the difference between a ReferenceError and `undefined` for an early read? A strong answer: `var` is initialised to undefined at hoisting; `let`/`const` have no value yet, so reading throws.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

var a = 1;
function f() {
  console.log(a);
  var a = 2;
}
f();`,
      options: ["1", "2", "undefined", "It throws a ReferenceError"],
      answer: 2,
      why: "The var a inside f is hoisted to the top of f and starts as undefined, hiding the outer a. The assignment a = 2 runs later, after the log.",
    },
    {
      kind: "quiz",
      question: `What happens?

console.log(typeof sayHi);
var sayHi = function () {};
console.log(sayHi());`,
      options: [
        "\"undefined\", then undefined.",
        "\"function\", then undefined.",
        "\"undefined\", then a TypeError.",
        "A ReferenceError on line 1.",
      ],
      answer: 0,
      why: "The var is hoisted as undefined, and the assignment happens on line 2, after line 1 has already run, so typeof gives \"undefined\". By line 3 sayHi is a function that returns nothing, so the call gives undefined.",
    },
    {
      kind: "quiz",
      question: `Which line throws?

const total = 10;           // line 1
{
  console.log(total);       // line 3
  const total = 20;         // line 4
}`,
      options: ["Line 1, because total is declared twice here.", "Line 3, the inner total is in its dead zone.", "Line 4, because const cannot be redeclared.", "Nothing throws, and it prints 10 to the console."],
      answer: 1,
      why: "The inner const total shadows the outer one for the whole block. At line 3 that inner binding exists but is uninitialised, so reading it throws a ReferenceError.",
    },
  ],
};
