import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterFunctionsBasics: Chapter = {
  slug: "functions-basics",
  title: "Functions: Declarations, Expressions and Arrows",
  summary: "Three ways to write a function, default and rest parameters, return values, pure functions, and why functions are values you can pass around.",
  minutes: 16,
  blocks: [
    {
      kind: "p",
      text: "A **function** packages steps behind a name so you can run them many times with different inputs. In JavaScript a function is also a value, like a number or a string. You can store it in a variable, pass it to another function, and return it from one. That one fact powers callbacks, promises, React hooks and most interview questions to come.",
    },
    {
      kind: "h",
      text: "The chai stall analogy",
    },
    {
      kind: "analogy",
      title: "A chai stall with a fixed recipe",
      text: "A chai stall has a fixed method: boil water, add leaves, milk and sugar, strain. You tell the vendor \"two cups, less sugar\" (the **arguments**) and get cups of chai back (the **return value**). The vendor never needs to know who you are. Give the same order, get the same chai: that is a **pure function**. Where the analogy stops: a real vendor might also change the stall (use up the sugar). A function that changes something outside itself has a **side effect**, and those are where bugs hide.",
    },
    {
      kind: "h",
      text: "Three ways to write one",
    },
    {
      kind: "code",
      code: `function square(n) {
  return n * n;
}

const cube = function (n) {
  return n * n * n;
};

const double = (n) => n * 2;
const greet = (name) => {
  const message = "Hello, " + name;
  return message;
};

console.log(square(4), cube(2), double(8));
console.log(greet("Asha"));
console.log(typeof square, square.name, double.length);`,
      caption: "A declaration, an expression, and an arrow function. All three compute the same thing.",
      output: `16 8 16
Hello, Asha
function square 1`,
      tryIt: {
        language: "javascript",
        prompt: "Call `double()` with no argument. What does it return, and why?",
      },
    },
    {
      kind: "compare",
      title: "Declaration, expression, arrow",
      columns: [
        {
          label: "Declaration",
          items: [
            "`function f() {}`",
            "Hoisted with its body, so you can call it above its line.",
            "Has its own `this` and `arguments`.",
          ],
        },
        {
          label: "Expression",
          items: [
            "`const f = function () {}`",
            "Only exists once that line runs.",
            "Has its own `this`.",
          ],
        },
        {
          label: "Arrow",
          items: [
            "`const f = () => {}`",
            "No own `this`, `arguments` or `prototype`.",
            "Cannot be used with `new`.",
            "Short syntax: a single expression returns automatically.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "An arrow function is not just a shorter function. It has no `this` of its own and takes `this` from the place it was written. Chapter 11 covers that. For now: use arrows for small callbacks, and declarations for named top-level functions.",
    },
    {
      kind: "h",
      text: "Parameters, defaults and rest",
    },
    {
      kind: "code",
      code: `function order(item = "chai", cups = 1) {
  return cups + " x " + item;
}
console.log(order());
console.log(order("coffee"));
console.log(order(undefined, 3));
console.log(order(null, 2));

function total(first, ...others) {
  let sum = first;
  for (const n of others) sum += n;
  return sum + " from " + (others.length + 1) + " numbers";
}
console.log(total(10, 20, 30));

const nums = [4, 9, 2];
console.log(Math.max(...nums));`,
      caption: "Default values fill in missing arguments. Rest gathers the extras into an array. Spread does the reverse at the call site.",
      output: `1 x chai
1 x coffee
3 x chai
2 x null
60 from 3 numbers
9`,
      tryIt: {
        language: "javascript",
        prompt: "Call `total()` with no arguments. What is `first`, and what does the function print?",
      },
    },
    {
      kind: "concept",
      title: "Defaults apply to undefined only",
      text: "A default value is used when the argument is **`undefined`**, whether you left it out or passed `undefined` on purpose. Passing `null`, `0` or `\"\"` does **not** trigger it. That is why `order(null, 2)` printed `2 x null`.",
    },
    {
      kind: "h",
      text: "Return, and what a function without one gives",
    },
    {
      kind: "p",
      text: "`return` sends a value back and stops the function immediately. A function that finishes without a `return` gives back `undefined`. One quirk catches people: `return` followed by a newline returns nothing, because the language inserts a semicolon.",
    },
    {
      kind: "code",
      code: `function check(n) {
  if (n < 0) return "negative";
  return "ok";
  console.log("never runs");
}
console.log(check(-1), check(1));

function noReturn() {
  const x = 1;
}
console.log(noReturn());

function lost() {
  return
    42;
}
console.log(lost());`,
      caption: "Return stops the function. A missing return gives undefined. A return value on a new line is lost.",
      output: `negative ok
undefined
undefined`,
      tryIt: {
        language: "javascript",
        prompt: "Fix `lost` so it returns 42, then run again.",
      },
    },
    {
      kind: "h",
      text: "Functions are values",
    },
    {
      kind: "code",
      code: `function applyTwice(fn, value) {
  return fn(fn(value));
}
console.log(applyTwice((x) => x + 3, 10));

function multiplier(factor) {
  return (n) => n * factor;
}
const triple = multiplier(3);
console.log(triple(7));

const ops = [Math.abs, Math.sqrt, (x) => x * 10];
console.log(ops.map((op) => op(16)));`,
      caption: "A function stored in an array, passed in as an argument, and returned from another function.",
      output: `16
21
[ 16, 4, 160 ]`,
      tryIt: {
        language: "javascript",
        prompt: "Write `makeAdder(a)` that returns a function adding `a` to its input, and test it.",
      },
    },
    {
      kind: "p",
      text: "A function that takes or returns another function is called a **higher-order function**. `triple` remembers `factor = 3` even after `multiplier` has finished; that memory is a closure, the subject of chapter 10. A **pure function** gives the same output for the same input and changes nothing outside itself. They are easy to test and are the foundation of React.",
    },
    {
      kind: "pitfall",
      items: [
        "Writing `return` and the value on separate lines, so the function returns undefined. Keep the value on the same line.",
        "Expecting a default to cover `null`. Defaults only replace `undefined`; use `??` inside for null.",
        "Using an arrow function where you need `this`, such as an object method. Chapter 11 explains why it breaks.",
        "Calling a function expression before its line: `const f = ...` is not usable above it (a ReferenceError).",
        "Mutating an argument (an object or array) and surprising the caller. Copy first, or document it.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A function is a value. You can store it, pass it and return it; that is what makes callbacks and higher-order functions possible.",
        "Declarations are hoisted with their body; expressions and arrows are not usable before their line runs.",
        "Defaults apply only to `undefined`. Rest (`...args`) collects extras into an array; spread (`...arr`) expands one.",
        "No `return` means `undefined`. Prefer pure functions: same input, same output, no side effects.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is the difference between a function declaration and a function expression? A strong answer: declarations are hoisted with their body; expressions exist only after their line executes.",
        "How do arrow functions differ from regular functions? A strong answer: no own `this`, `arguments` or `prototype`, not constructible, implicit return for one expression.",
        "What is a pure function and why do we want them? A strong answer: same input gives same output, no side effects; they are predictable, testable and cache-safe.",
        "What are first-class functions? A strong answer: functions are values, so they can be assigned, passed and returned, which makes callbacks and higher-order functions possible.",
        "When does a default parameter apply? A strong answer: only when the argument is undefined, not for null.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

const f = (a, b = a * 2) => a + b;
console.log(f(3), f(3, 1));`,
      options: ["6 4", "9 4", "9 3", "NaN 4"],
      answer: 1,
      why: "f(3) uses the default b = 6, so 3 + 6 = 9. f(3, 1) uses b = 1, so 3 + 1 = 4.",
    },
    {
      kind: "quiz",
      question: `What is logged?

function f() {}
console.log(f());`,
      options: ["null", "undefined", "f", "It throws"],
      answer: 1,
      why: "A function with no return statement gives back undefined.",
    },
    {
      kind: "quiz",
      question: `Why does this throw?

console.log(add(1, 2));
const add = (a, b) => a + b;`,
      options: [
        "Arrow functions cannot take two parameters.",
        "const add exists but is not ready until its line runs (temporal dead zone), so add is not usable yet.",
        "console.log cannot call functions.",
        "Functions must be declared with the function keyword.",
      ],
      answer: 1,
      why: "The const binding is in the temporal dead zone until its declaration runs. A function declaration, by contrast, would have been hoisted and worked.",
    },
  ],
};
