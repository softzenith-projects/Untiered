import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterPromises: Chapter = {
  slug: "promises",
  title: "Promises: States, Chaining and the Combinators",
  summary: "What a promise is, why its executor runs at once, how chaining passes values and errors along, and when to use all, allSettled, race and any.",
  minutes: 22,
  blocks: [
    {
      kind: "p",
      text: "A **promise** is an object that stands for a value you do not have yet. Before promises, async code meant callbacks inside callbacks. A promise gives you something to hold, attach steps to, and combine. It is the base that `async/await` (next chapter) is built on, so understand this chapter first.",
    },
    {
      kind: "h",
      text: "The order-token analogy",
    },
    {
      kind: "analogy",
      title: "A token at a dosa counter",
      text: "At a busy dosa counter you pay and get a **token number**. The dosa is not ready, but the token is a promise of one. You can step aside and do other things. Later, your number is called and you get either your dosa (the promise is **fulfilled**) or an apology that the batter ran out (it is **rejected**). Once called, a token is never called again with a different result. Where the analogy stops: you can hand the same promise to several people, and each of them gets the same result when it settles.",
    },
    {
      kind: "h",
      text: "Three states, settled once",
    },
    {
      kind: "concept",
      title: "Pending, fulfilled, rejected",
      text: "A promise is **pending** until it settles. It then becomes **fulfilled** with a value, or **rejected** with a reason, and stays that way forever. Calling `resolve` or `reject` a second time does nothing. A promise that is fulfilled or rejected is called **settled**.",
    },
    {
      kind: "code",
      code: `console.log("before");
const p = new Promise((resolve, reject) => {
  console.log("executor runs now");
  resolve(42);
  resolve(99);
  reject(new Error("ignored"));
});
p.then((value) => console.log("then got", value));
console.log("after");`,
      caption: "The executor runs immediately and synchronously. Only the .then callbacks are delayed, as microtasks. A second resolve or a reject after the first is ignored.",
      output: `before
executor runs now
after
then got 42`,
      tryIt: {
        language: "javascript",
        prompt: "Replace `resolve(42)` with `reject(new Error(\"no\"))` and add a `.catch((e) => console.log(e.message))`. In what order do the lines print?",
      },
    },
    {
      kind: "h",
      text: "Chaining: each then returns a new promise",
    },
    {
      kind: "p",
      text: "`.then(onFulfilled)` returns a **new promise**. Whatever the callback returns becomes the next link's value. If it returns a promise, the chain waits for that promise. If it throws, the chain turns into a rejection and skips forward to the nearest `.catch`. A `.catch` that returns normally **recovers** the chain. `.finally` runs either way and passes the value or error through unchanged.",
    },
    {
      kind: "code",
      code: `const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

wait(10, 1)
  .then((v) => {
    console.log("got", v);
    return v + 1;
  })
  .then((v) => {
    console.log("got", v);
    return wait(10, v * 10);
  })
  .then((v) => {
    console.log("got", v);
    throw new Error("boom");
  })
  .then(() => console.log("skipped"))
  .catch((e) => {
    console.log("caught", e.message);
    return "recovered";
  })
  .finally(() => console.log("finally"))
  .then((v) => console.log("end with", v));`,
      caption: "Values flow down the chain, a returned promise is awaited, a throw skips to catch, and finally runs without changing the result.",
      output: `got 1
got 2
got 20
caught boom
finally
end with recovered`,
      tryIt: {
        language: "javascript",
        prompt: "Remove the `return` from the first `.then`. What does the second one receive?",
      },
    },
    {
      kind: "viz",
      title: "Two chains interleave, one step at a time",
      caption: "Each .then runs as its own microtask. Two chains started together take turns.",
      viz: {
        type: "queue",
        frames: [
          {
            items: ["chain 1: log 1", "chain 2: log a"],
            note: "Both resolved promises queue their first .then callback, in the order written.",
          },
          {
            items: ["chain 2: log a", "chain 1: log 2"],
            highlight: 1,
            note: "`1` printed. Its callback finished, so the next link of chain 1 is queued behind `a`.",
          },
          {
            items: ["chain 1: log 2", "chain 2: log b"],
            highlight: 1,
            note: "`a` printed. Chain 2's next link queues behind chain 1's.",
          },
          {
            items: ["chain 2: log b"],
            note: "`2` printed. Then `b`. Output order: 1 a 2 b.",
          },
        ],
      },
    },
    {
      kind: "h",
      text: "Combining promises",
    },
    {
      kind: "compare",
      title: "The four combinators",
      columns: [
        {
          label: "all / allSettled",
          items: [
            "`all`: fulfils with an array when EVERY promise fulfils; rejects at the first rejection.",
            "`allSettled`: always fulfils, with `{ status, value | reason }` for each.",
          ],
        },
        {
          label: "race / any",
          items: [
            "`race`: settles like the first promise to settle, success or failure.",
            "`any`: fulfils with the first FULFILMENT; rejects with an AggregateError only if all reject.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `const ok = (ms, v) => new Promise((resolve) => setTimeout(() => resolve(v), ms));
const bad = (ms, m) => new Promise((_, reject) => setTimeout(() => reject(new Error(m)), ms));

Promise.race([ok(5, "fast"), ok(15, "slow")]).then((v) => console.log("race", v));
Promise.any([bad(10, "first fails"), ok(25, "later wins")]).then((v) => console.log("any", v));
Promise.all([ok(40, "a"), bad(20, "x failed")]).catch((e) => console.log("all rejected:", e.message));
Promise.allSettled([ok(30, 1), bad(35, "no")]).then((results) => {
  console.log("allSettled", results.map((r) => r.status + ":" + (r.value ?? r.reason.message)));
});
Promise.all([ok(60, "a"), ok(50, "b")]).then((values) => console.log("all", values));`,
      caption: "Each combinator on promises with different delays, using timers so the printing order is the finishing order.",
      output: `race fast
all rejected: x failed
any later wins
allSettled [ 'fulfilled:1', 'rejected:no' ]
all [ 'a', 'b' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Change the delay of \"later wins\" to 5. Which log line moves, and does `any` still wait for the first failure?",
      },
    },
    {
      kind: "p",
      text: "`Promise.all` returns results in the order of the input, not the order they finished: `[\"a\", \"b\"]` even though `b` finished first. Note the common trap: `Promise.all` rejecting does **not** cancel the others. They keep running, you simply stop waiting.",
    },
    {
      kind: "h",
      text: "Unhandled rejections",
    },
    {
      kind: "p",
      text: "A promise that rejects with no `.catch` anywhere in its chain is an **unhandled rejection**. Browsers log it to the console. Node (since version 15) treats it as a fatal error by default and ends the process. Always end a chain with `.catch`, or handle the error with `try/catch` when using `await`.",
    },
    {
      kind: "code",
      code: `// No .catch anywhere: in Node this ends the process with an error.
Promise.reject(new Error("nobody handled me"));

// Fixed: the chain ends in a handler.
Promise.reject(new Error("handled")).catch((e) => console.log(e.message));`,
      caption: "An unhandled rejection. Not run here because the failure it produces is an uncaught error, which is the point.",
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting to `return` inside `.then`. The next link receives `undefined`.",
        "Nesting `.then` inside `.then` like callbacks. Return the inner promise and keep the chain flat.",
        "Putting `.catch` before the step that fails; it only catches errors from earlier links.",
        "Assuming `Promise.all` cancels the rest when one rejects. It does not.",
        "Leaving a rejection unhandled. In Node it can end the process.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A promise is pending, then fulfilled or rejected, once. Extra resolve or reject calls are ignored.",
        "The executor runs synchronously. Only `.then`, `.catch` and `.finally` callbacks are microtasks.",
        "Every `.then` returns a new promise: a returned value flows on, a returned promise is awaited, a throw jumps to the next `.catch`, and a `.catch` that returns recovers the chain.",
        "`all` fails fast, `allSettled` never rejects, `race` takes the first to settle, `any` takes the first to fulfil. Always end chains with a handler.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What are the states of a promise? A strong answer: pending, fulfilled, rejected; settles once; the result is immutable.",
        "Does the Promise executor run synchronously? A strong answer: yes, immediately and in line; only `.then` callbacks are queued as microtasks.",
        "What is the difference between `Promise.all`, `allSettled`, `race` and `any`? A strong answer gives all four precisely, including `any` rejecting with an AggregateError and `all` failing fast.",
        "What does `.then` return? A strong answer: always a new promise, resolved with the callback's return value, following it if it is a promise, and rejected if it throws.",
        "Implement `Promise.all` or a delay function. A strong answer handles non-promise inputs, keeps input order, and rejects on the first failure. (Chapter 21 builds it.)",
      ],
    },
    {
      kind: "quiz",
      question: `What order does this print?
Promise.resolve().then(() => console.log(1)).then(() => console.log(2));
Promise.resolve().then(() => console.log("a")).then(() => console.log("b"));`,
      options: ["1 2 a b", "1 a 2 b", "a 1 b 2", "1 a b 2"],
      answer: 1,
      why: "Each chain advances one link per microtask turn, so the two chains alternate: 1 a 2 b.",
    },
    {
      kind: "quiz",
      question: `What does this print?
Promise.reject(new Error("x"))
  .then(() => console.log("A"))
  .catch(() => console.log("B"))
  .then(() => console.log("C"));`,
      options: [
        "A B C",
        "B C",
        "B",
        "Nothing; it is an unhandled rejection",
      ],
      answer: 1,
      why: "The rejection skips the first .then, is caught by .catch (B), and that catch returns normally, so the chain recovers and the last .then runs (C): B C.",
    },
    {
      kind: "quiz",
      question: `What does this print?
console.log(1);
new Promise((resolve) => {
  console.log(2);
  resolve();
}).then(() => console.log(3));
console.log(4);`,
      options: ["1 2 3 4", "1 4 2 3", "1 2 4 3", "2 1 4 3"],
      answer: 2,
      why: "The executor runs synchronously (2) before the next line (4). Only the .then callback (3) waits for a microtask: 1 2 4 3.",
    },
  ],
};
