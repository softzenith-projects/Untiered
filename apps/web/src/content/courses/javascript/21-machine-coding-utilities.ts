import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterMachineCodingUtilities: Chapter = {
  slug: "machine-coding-utilities",
  title: "Machine-Coding Utilities: debounce, throttle, memoize, Promise.all and More",
  summary: "Build the small utilities interviews ask you to write from scratch: debounce, throttle, once, memoize, Promise.all, a concurrency limiter, deep clone, flatten and bind.",
  minutes: 28,
  blocks: [
    {
      kind: "p",
      text: "A machine-coding round gives you thirty to sixty minutes and a blank editor. The question is often a **utility function** you have used a hundred times but never written. Each one below is short, tests a specific idea from the earlier chapters (closures, `this`, promises, recursion), and has the same shape: a small core, a few edge cases an interviewer will probe. Every demo here uses timers with fixed delays, so the printed order is the same on every run.",
    },
    {
      kind: "h",
      text: "The lift-operator analogy",
    },
    {
      kind: "analogy",
      title: "The lift that waits for the last person",
      text: "A lift in an office block waits a few seconds after a button press, in case someone else is running toward it. Each new person who arrives **resets the countdown**. Only when nobody has arrived for the full wait does the door close and the lift go. That is **debounce**: do the work only once things go quiet. A **throttle** is a different building rule: the lift leaves at most once every 30 seconds, no matter how many people press the button; everyone else waits for the next trip. Where the analogy stops: a real lift carries the people who pressed; a debounced function only receives the arguments of the last call.",
    },
    {
      kind: "h",
      text: "debounce and throttle",
    },
    {
      kind: "compare",
      title: "Same goal, different rule",
      columns: [
        {
          label: "Debounce",
          items: [
            "Waits for a quiet gap of `wait` ms after the last call.",
            "Every new call restarts the timer.",
            "Good for: search-as-you-type, saving after typing stops, window resize end.",
          ],
        },
        {
          label: "Throttle",
          items: [
            "Allows at most one run per `wait` ms.",
            "Extra calls inside the window are dropped (or run once at the end).",
            "Good for: scroll handlers, mouse move, rate-limiting a button.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, wait) {
  let waiting = false;
  return function (...args) {
    if (waiting) return;
    waiting = true;
    fn.apply(this, args);
    setTimeout(() => {
      waiting = false;
    }, wait);
  };
}

const onScroll = throttle((y) => console.log("throttled ran with:", y), 40);
const onSearch = debounce((q) => console.log("debounced ran with:", q), 30);

// Five scroll events at 0, 10, 20, 70 and 80 ms.
[0, 10, 20, 70, 80].forEach((t, i) => {
  setTimeout(() => onScroll("scroll " + i), t);
});

// Later, at 100 ms, three keystrokes 10 ms apart.
setTimeout(() => {
  [0, 10, 20].forEach((t, i) => {
    setTimeout(() => onSearch("query " + i), t);
  });
}, 100);`,
      caption: "debounce and throttle, both built from closures and timers. The calls are scheduled with timers at fixed times, with wide gaps, so the result is the same every run.",
      output: `throttled ran with: scroll 0
throttled ran with: scroll 3
debounced ran with: query 2`,
      tryIt: {
        language: "javascript",
        prompt: "Make throttle also run once more at the END of its window (a 'trailing' call) with the last arguments it dropped, and predict the new output first.",
      },
    },
    {
      kind: "p",
      text: "The throttled function ran on the first scroll (`scroll 0`), dropped the next two, and ran again on `scroll 3`, the first call after its window had passed. The debounced function ran once, with the **last** arguments (`query 2`), and only after the keystrokes stopped. Both use `fn.apply(this, args)` so the original `this` and arguments are kept. In a real project a library such as lodash gives you `leading`, `trailing` and `cancel` options; an interviewer often asks you to add `cancel`.",
    },
    {
      kind: "h",
      text: "once and memoize",
    },
    {
      kind: "code",
      code: `function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

const init = once(() => {
  console.log("connecting once");
  return "connection";
});
console.log(init(), init(), init());

const slowSquare = memoize((n) => {
  console.log("computing", n);
  return n * n;
});
console.log(slowSquare(4), slowSquare(4), slowSquare(5));

let calls = 0;
const fib = memoize((n) => {
  calls++;
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
});
console.log(fib(30), "with", calls, "calls");`,
      caption: "once runs a function a single time and then replays its result. memoize caches results by argument. A memoized recursive fib turns an exponential tree of calls into a linear one.",
      output: `connecting once
connection connection connection
computing 4
computing 5
16 16 25
832040 with 31 calls`,
      tryIt: {
        language: "javascript",
        prompt: "Count the calls without memoize (use a plain recursive fib(20)). How many calls is that, compared with the memoized 31?",
      },
    },
    {
      kind: "p",
      text: "Two limits to name aloud in an interview. Using `JSON.stringify(args)` as the cache key is simple but treats `undefined` and `null` alike, ignores function arguments and is slow for big arguments; a `Map` keyed on the first argument, or a nested Map, is the stricter choice. And a cache that never evicts grows forever, so production caches use a size limit (an LRU).",
    },
    {
      kind: "h",
      text: "Promise.all and a concurrency limiter",
    },
    {
      kind: "code",
      code: `function myAll(promises) {
  return new Promise((resolve, reject) => {
    const items = [...promises];
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve(results);
    items.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;
        if (--remaining === 0) resolve(results);
      }, reject);
    });
  });
}

const delay = (ms, v) => new Promise((resolve) => setTimeout(() => resolve(v), ms));

myAll([delay(30, "slow"), delay(10, "fast"), 7]).then((v) => console.log("all:", v));
myAll([delay(10, "ok"), Promise.reject(new Error("bad"))]).catch((e) => console.log("rejected:", e.message));
myAll([]).then((v) => console.log("empty:", v));

async function pool(tasks, limit) {
  const results = [];
  let next = 0;
  let running = 0;
  let peak = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      running++;
      peak = Math.max(peak, running);
      results[i] = await tasks[i]();
      running--;
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return { results, peak };
}

const task = (name, ms) => async () => {
  console.log("start", name);
  await delay(ms, null);
  console.log("end", name);
  return name.toUpperCase();
};

setTimeout(() => {
  pool([task("a", 60), task("b", 10), task("c", 15), task("d", 10)], 2).then(({ results, peak }) => {
    console.log(results, "peak running:", peak);
  });
}, 100);`,
      caption: "A Promise.all polyfill that keeps input order and rejects on the first failure, then a pool that runs at most two tasks at once.",
      output: `empty: []
rejected: bad
all: [ 'slow', 'fast', 7 ]
start a
start b
end b
start c
end c
start d
end d
end a
[ 'A', 'B', 'C', 'D' ] peak running: 2`,
      tryIt: {
        language: "javascript",
        prompt: "Change the limit to 1 and then to 4. How does the order of 'start' and 'end' lines change, and what is peak?",
      },
    },
    {
      kind: "viz",
      title: "The pool with a limit of 2",
      caption: "Two workers pull the next task as soon as they are free; at most two run at once.",
      viz: {
        type: "queue",
        frames: [
          {
            items: ["a (running)", "b (running)", "c", "d"],
            note: "Two workers start tasks a and b. c and d wait.",
          },
          {
            items: ["a (running)", "c (running)", "d"],
            highlight: 1,
            note: "b ends after 10 ms. Its worker takes c.",
          },
          {
            items: ["a (running)", "d (running)"],
            highlight: 1,
            note: "c ends after 15 ms. Its worker takes d.",
          },
          {
            items: ["a (running)"],
            note: "d ends. Only a is left; it ends at 60 ms and the pool resolves with the results in the original order.",
          },
        ],
      },
    },
    {
      kind: "h",
      text: "deep clone, flatten and bind",
    },
    {
      kind: "code",
      code: `function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const key of Object.keys(value)) {
    copy[key] = deepClone(value[key], seen);
  }
  return copy;
}

const original = { name: "Asha", tags: ["a", "b"], address: { city: "Pune" }, when: new Date(0) };
original.self = original;
const clone = deepClone(original);
clone.address.city = "Goa";
clone.tags.push("c");
console.log(original.address.city, original.tags.length, clone.tags.length);
console.log(clone.self === clone, clone.when instanceof Date, clone.when === original.when);

function flatten(arr, depth = Infinity) {
  return arr.reduce(
    (out, item) =>
      Array.isArray(item) && depth > 0 ? out.concat(flatten(item, depth - 1)) : out.concat([item]),
    [],
  );
}
console.log(flatten([1, [2, [3, [4]]]]), flatten([1, [2, [3, [4]]]], 1));

Function.prototype.myBind = function (context, ...preset) {
  const fn = this;
  return function bound(...args) {
    if (new.target) return new fn(...preset, ...args);
    return fn.apply(context, [...preset, ...args]);
  };
};

function greet(greeting, punctuation) {
  return greeting + ", " + this.name + punctuation;
}
const hello = greet.myBind({ name: "Ravi" }, "Hello");
console.log(hello("!"));`,
      caption: "A recursive deepClone that survives circular references, a flatten with a depth, and a bind polyfill that supports presetting arguments and new.",
      output: `Pune 2 3
true true false
[ 1, 2, 3, 4 ] [ 1, 2, [ 3, [ 4 ] ] ]
Hello, Ravi!`,
      tryIt: {
        language: "javascript",
        prompt: "Add a Map or a Set to deepClone. Which `typeof` check and constructor would you handle first, and what happens today if you pass one in?",
      },
    },
    {
      kind: "p",
      text: "Edge cases an interviewer will ask about: `deepClone` here skips functions (copies them by reference), Maps, Sets and class prototypes. The honest answer in a real project is `structuredClone`. For `flatten`, mention the built-in `arr.flat(depth)`. For `bind`, mention that a bound function created with `new` ignores the bound `this`, and that the real `bind` also sets the bound function's `name` and `length`.",
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting `clearTimeout` in debounce, so every call still fires.",
        "Using an arrow function for the returned wrapper and losing the caller's `this`. Use `function (...args)` and `fn.apply(this, args)`.",
        "Building the Promise.all results with `push`, which gives completion order. Assign by index.",
        "Memoizing an impure function, such as one that reads the clock or random numbers.",
        "Deep cloning with `JSON.parse(JSON.stringify(x))` and quietly losing Dates, undefined and cycles.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Debounce resets a timer on every call and runs once after quiet; throttle runs at most once per window. Both need a closure and `fn.apply(this, args)`.",
        "memoize caches by arguments in a Map: only for pure functions, mind the key design, and bound the cache size.",
        "Promise.all: store by index, wrap inputs in Promise.resolve, count down, reject on first failure. A pool is K workers pulling from one shared index.",
        "Deep clone needs a WeakMap for cycles and special cases for Date, Map and Set; in real code use structuredClone. A bind polyfill must preset arguments and handle new.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Implement debounce. A strong answer: closure over a timer, `clearTimeout` on each call, `apply(this, args)`; then add `leading` and `cancel` when asked.",
        "What is the difference between debounce and throttle, and where would you use each? A strong answer gives search box and window-resize end for debounce, scroll and mouse move for throttle.",
        "Write memoize. A strong answer: a Map keyed on arguments, mention the key problem with objects, unbounded growth, and that it only suits pure functions.",
        "Implement Promise.all. A strong answer: keep results by index (not by completion order), wrap each input in `Promise.resolve`, count down, reject on the first failure, handle an empty array.",
        "Run N async tasks with at most K at a time. A strong answer: K workers pulling from a shared index, or a queue; results kept in input order.",
        "Implement deep clone. A strong answer: recursion over arrays and objects, a WeakMap for cycles, special handling for Date/Map/Set, and the remark that `structuredClone` exists.",
      ],
    },
    {
      kind: "quiz",
      question: `A user types 5 letters, one every 100 ms, and each keystroke calls the 300 ms debounced search below. How many times does the search function run?
let calls = 0;
const search = debounce(() => { calls++; }, 300);
// a user types 5 letters, one every 100 ms
// (each keystroke calls search())`,
      options: ["5", "1", "3", "0"],
      answer: 1,
      why: "Every keystroke arrives less than 300 ms after the previous one, so the timer keeps resetting. It fires once, 300 ms after the last keystroke.",
    },
    {
      kind: "quiz",
      question: `What does this print?
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const m = memoize((x) => {
  console.log("run");
  return x;
});
m(undefined);
m(null);
m(null);`,
      options: ["run (three times)", "run (twice)", "run (once)", "Nothing"],
      answer: 2,
      why: "JSON.stringify([undefined]) and JSON.stringify([null]) are both \"[null]\", so the second call is a cache hit and the third call is too. The function runs once. This is the weakness of stringified keys.",
    },
    {
      kind: "quiz",
      question: `What does this print?
function myAll(promises) {
  return new Promise((resolve, reject) => {
    const items = [...promises];
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve(results);
    items.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;
        if (--remaining === 0) resolve(results);
      }, reject);
    });
  });
}

const delay = (ms, v) => new Promise((resolve) => setTimeout(() => resolve(v), ms));
myAll([delay(20, "a"), delay(10, "b"), "c"]).then((v) => console.log(v));`,
      options: ["[ 'b', 'c', 'a' ]", "[ 'a', 'b', 'c' ]", "[ 'c', 'b', 'a' ]", "It never settles"],
      answer: 1,
      why: "Results are stored by index, not by completion order. 'b' finishes first and 'c' is not a promise at all, but the array is still ['a', 'b', 'c'].",
    },
  ],
};
