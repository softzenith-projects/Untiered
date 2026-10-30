import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterFunctionalPatterns: Chapter = {
  slug: "functional-patterns",
  title: "Functional Patterns",
  summary: "Higher-order functions, currying versus partial application, compose and pipe, memoisation, immutable updates and recursion, each built from the closures you already know.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "Functional style means building programs out of small functions that take values and return values, and combining them. JavaScript suits it because functions are values (chapter 5) and closures (chapter 10) let a function carry data. This chapter is a set of patterns, each short enough to write on a whiteboard, and each a common interview exercise.",
    },
    {
      kind: "h",
      text: "The thali kitchen analogy",
    },
    {
      kind: "analogy",
      title: "A kitchen line making a thali",
      text: "In a busy kitchen one cook chops, the next fries, the next plates. Nobody does the whole dish; each station takes what the previous one handed over and passes it on. The order of the stations is the recipe. A pipeline of functions is the same: each takes the output of the one before. Where the analogy stops: a cook can reach into the shared pot and change it. In functional style a station never changes what it receives; it makes a new value and hands that on.",
    },
    {
      kind: "h",
      text: "Currying, partial application, compose and pipe",
    },
    {
      kind: "code",
      code: `const add = (a, b, c) => a + b + c;

const curry = (fn) =>
  function curried(...args) {
    return args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  };
const cAdd = curry(add);
console.log(cAdd(1)(2)(3), cAdd(1, 2)(3), cAdd(1)(2, 3));

const partial = (fn, ...preset) => (...rest) => fn(...preset, ...rest);
const addTo10 = partial(add, 4, 6);
console.log(addTo10(5));

const compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x);
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);
const inc = (n) => n + 1;
const dbl = (n) => n * 2;
console.log(compose(inc, dbl)(5), pipe(inc, dbl)(5));`,
      caption: "`curry` waits until it has all of `fn.length` arguments. `compose` runs right to left; `pipe` runs left to right.",
      output: `6 6 6
15
11 12`,
      tryIt: {
        language: "javascript",
        prompt: "Build `pipe(inc, dbl, inc)` and predict the result for 5 before running.",
      },
    },
    {
      kind: "compare",
      title: "Currying vs partial application",
      columns: [
        {
          label: "Currying",
          items: ["Turns f(a, b, c) into f(a)(b)(c).", "Each step takes one argument (or more, in a loose version).", "A transformation of the function's shape."],
        },
        {
          label: "Partial application",
          items: ["Fixes some arguments now, takes the rest later.", "`partial(add, 4, 6)` leaves one to give.", "A way to make a specialised copy."],
        },
      ],
    },
    {
      kind: "p",
      text: "The two are related and often confused. Currying changes the function so it can be called one argument at a time. Partial application takes a function and some arguments and returns a function waiting for the rest. `Function.prototype.bind` is partial application with a `this` as well. Note that `fn.length` counts parameters before the first default or rest parameter, so it can mislead `curry`.",
    },
    {
      kind: "h",
      text: "Memoisation and recursion",
    },
    {
      kind: "code",
      code: `function memoize(fn) {
  const cache = new Map();
  return (n) => {
    if (cache.has(n)) return cache.get(n);
    const value = fn(n);
    cache.set(n, value);
    return value;
  };
}

let calls = 0;
const fib = memoize((n) => {
  calls += 1;
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
});
console.log(fib(30), calls);

function sum(n) {
  return n === 0 ? 0 : n + sum(n - 1);
}
console.log(sum(100));
try {
  sum(1e6);
} catch (err) {
  console.log(err.name);
}`,
      caption: "Memoised Fibonacci makes 31 calls instead of over a million. Recursion needs a base case, and a very deep one overflows the call stack.",
      output: `832040 31
5050
RangeError`,
      tryIt: {
        language: "javascript",
        prompt: "Remove the `memoize(...)` wrapper (call the plain function) and try `fib(25)`. Count the calls.",
      },
    },
    {
      kind: "concept",
      title: "Memoise only pure functions",
      text: "A memoised function stores results keyed by its arguments. That is safe only when the function is **pure**: the same arguments always give the same result and nothing outside changes. This version keys on one primitive argument. For several arguments or objects you need a key such as `JSON.stringify(args)`, or a `WeakMap` for object keys so the cache does not keep them alive forever.",
    },
    {
      kind: "p",
      text: "Recursion is a function calling itself on a smaller problem. Every recursive function needs a **base case** that stops, and each call adds a frame to the call stack. The stack is finite, so a recursion a million deep throws a `RangeError`. The standard answer is to turn the recursion into a loop. Do not count on tail-call optimisation: it is in the language specification but most engines, V8 included, do not implement it.",
    },
    {
      kind: "h",
      text: "Immutability: new values, not edits",
    },
    {
      kind: "code",
      code: `const state = Object.freeze({ count: 1, tags: ["a"] });

function tryChange() {
  "use strict";
  try {
    state.count = 2;
  } catch (err) {
    return err.name;
  }
  return "changed";
}
console.log(tryChange());

state.tags.push("b");
console.log(state.tags, Object.isFrozen(state.tags));

const next = { ...state, count: 2, tags: [...state.tags, "c"] };
console.log(state.count, next.count, state.tags === next.tags, next.tags);`,
      caption: "`Object.freeze` is shallow: the array inside stays editable. Spread builds a new object and a new array.",
      output: `TypeError
[ 'a', 'b' ] false
1 2 false [ 'a', 'b', 'c' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Write a `deepFreeze(obj)` function that freezes nested objects too, and use it on `state`.",
      },
    },
    {
      kind: "p",
      text: "Immutability means you never edit a value in place; you build a new one. It makes change easy to detect (a new reference means something changed), which is exactly what React relies on in chapter 28. The cost is copying, which spread keeps shallow: only the path you changed is new, and the rest is shared with the old value.",
    },
    {
      kind: "pitfall",
      items: [
        "Calling `compose` and `pipe` the wrong way round. Compose reads right to left, like `f(g(x))`; pipe reads in the order things happen.",
        "Assuming `Object.freeze` is deep. It freezes the top level only; nested objects can still change.",
        "Memoising a function that depends on time, randomness or outside state. It will return stale answers.",
        "Using `array.sort()` or `reverse()` in a pipeline and mutating the input. Copy first, or use `toSorted()` and `toReversed()`.",
        "Recursing without a base case, or on input that can be huge. Add the base case first; switch to a loop for deep input.",
        "Relying on `fn.length` for currying a function with default parameters.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A higher-order function takes or returns a function; `map`, `filter`, `reduce` and every callback API are examples.",
        "Currying changes a function to take arguments one at a time; partial application fixes some arguments now. `pipe` runs left to right, `compose` right to left.",
        "Memoisation caches results by arguments and is only safe for pure functions.",
        "Prefer new values to edits: spread, `toSorted`, `map`. `Object.freeze` is shallow. Recursion needs a base case and has a stack limit.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is a higher-order function? A strong answer: one that takes a function as an argument or returns one; give `map` and a function factory as examples.",
        "What is the difference between currying and partial application? A strong answer: currying turns an n-argument function into a chain of single-argument ones; partial application fixes some arguments and returns a function for the rest.",
        "Write `compose` or `pipe`. A strong answer: use `reduce` (or `reduceRight` for compose) over the list of functions, passing the result along, and say which direction each runs.",
        "Write a `memoize`. A strong answer: a Map keyed by arguments inside a closure; note the key problem for multiple or object arguments and that only pure functions are safe.",
        "What is a pure function, and why does immutability matter? A strong answer: no side effects and same output for same input; immutability makes change detection cheap and avoids shared-state bugs.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

const f = (a) => (b) => (c) => a + b * c;
console.log(f(1)(2)(3));`,
      options: ["7", "9", "6", "123"],
      answer: 0,
      why: "Each call returns the next function, and the last one computes a + b * c with a = 1, b = 2, c = 3. Multiplication goes first: 1 + 6 = 7.",
    },
    {
      kind: "quiz",
      question: `What does this print?

const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);
const run = pipe((n) => n - 1, (n) => n * 10);
console.log(run(5));`,
      options: ["40", "49", "45", "-5"],
      answer: 0,
      why: "pipe applies the functions left to right: 5 - 1 = 4, then 4 * 10 = 40. The other order would give 49.",
    },
    {
      kind: "quiz",
      question: `What is logged?

const o = Object.freeze({ list: [1] });
o.list.push(2);
console.log(o.list.length);`,
      options: ["2, because freeze is shallow", "1, because the object is frozen", "It throws a TypeError", "undefined"],
      answer: 0,
      why: "Object.freeze stops adding, removing and reassigning properties on o itself. The array stored in o.list is a separate object that is not frozen, so push still works.",
    },
  ],
};
