import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterAsyncAwait: Chapter = {
  slug: "async-await",
  title: "async and await: Promises Without the Pyramid",
  summary: "How async functions turn promise chains into straight-line code, how to handle errors, run steps in sequence or in parallel, and why forEach does not wait.",
  minutes: 20,
  blocks: [
    {
      kind: "p",
      text: "`async` and `await` do not add a new kind of asynchrony. They are a way of **writing promise code so it reads like ordinary top-to-bottom code**. Everything from the last two chapters still holds underneath: the single thread, the microtask queue, the rule that a `.then` callback runs later.",
    },
    {
      kind: "h",
      text: "The two-step recipe analogy",
    },
    {
      kind: "analogy",
      title: "Waiting for the tandoor",
      text: "You order naan. The cook slaps the dough on the tandoor wall and, instead of staring at it, goes on taking other orders. When the naan is done a bell rings, and the cook comes back to **exactly the step they were on** and serves it. `await` is the cook stepping away: the function pauses at that line and the rest of the program carries on. The bell is the promise settling, and the function resumes after the `await`. Where the analogy stops: the cook is still the same one person (one thread), so if another order is taking a long time, the naan waits even after the bell.",
    },
    {
      kind: "h",
      text: "What async and await do",
    },
    {
      kind: "concept",
      title: "async function",
      text: "A function marked **`async`** always returns a promise. A returned value becomes the fulfilled value; a thrown error becomes a rejection. It runs like a normal function **until its first `await`**.",
    },
    {
      kind: "concept",
      title: "await",
      text: "**`await promise`** pauses only the async function it is in, and gives you the fulfilled value (or throws the rejection). The rest of that function becomes a microtask that runs when the promise settles. The caller of the async function is not paused. You can `await` any value; a non-promise is wrapped, and the code after it still resumes in a later microtask.",
    },
    {
      kind: "code",
      code: `const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const fail = (ms, msg) => new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));

async function load() {
  console.log("start");
  const a = await wait(10, "first");
  console.log("got", a);
  try {
    await fail(10, "network down");
  } catch (e) {
    console.log("caught:", e.message);
  } finally {
    console.log("cleanup");
  }
  return "done";
}

const result = load();
console.log("load() returned a promise:", typeof result.then);
result.then((v) => console.log("result:", v));`,
      caption: "The same job as a chain and as an async function, with errors handled by ordinary try/catch/finally.",
      output: `start
load() returned a promise: function
got first
caught: network down
cleanup
result: done`,
      tryIt: {
        language: "javascript",
        prompt: "Remove the `try/catch` around the failing await and add `.catch((e) => console.log(e.message))` to `load()`. What changes in the output?",
      },
    },
    {
      kind: "p",
      text: "Notice the order: `start` prints, then the line after `load()` prints before `got first`. The caller was not paused. That is also why `load()` has to return a promise.",
    },
    {
      kind: "h",
      text: "Sequential versus parallel",
    },
    {
      kind: "p",
      text: "Two `await`s in a row run **one after the other**. If the second does not need the first's result, you waste time. Start both first, then await them together.",
    },
    {
      kind: "code",
      code: `const job = (name, ms) =>
  new Promise((resolve) => {
    console.log(name, "starts");
    setTimeout(() => {
      console.log(name, "ends");
      resolve(name);
    }, ms);
  });

async function sequential() {
  console.log("-- sequential");
  const a = await job("A", 20);
  const b = await job("B", 10);
  return [a, b];
}

async function parallel() {
  console.log("-- parallel");
  const [a, b] = await Promise.all([job("A", 20), job("B", 10)]);
  return [a, b];
}

sequential().then((r) => {
  console.log(r);
  return parallel();
}).then((r) => console.log(r));`,
      caption: "Same two jobs. One version waits for the first to end before starting the second; the other starts both at once. The log shows start and end events in order.",
      output: `-- sequential
A starts
A ends
B starts
B ends
[ 'A', 'B' ]
-- parallel
A starts
B starts
B ends
A ends
[ 'A', 'B' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Change `parallel` so that it creates both promises first (`const pa = job(...)`, `const pb = job(...)`) and then awaits each. Does it still overlap?",
      },
    },
    {
      kind: "h",
      text: "The forEach trap",
    },
    {
      kind: "compare",
      title: "Looping with await",
      columns: [
        {
          label: "forEach(async ...)",
          items: [
            "`forEach` ignores the promises its callback returns.",
            "Nothing waits; the next line runs at once.",
            "Never use it when order or completion matters.",
          ],
        },
        {
          label: "for...of with await",
          items: [
            "Runs one item at a time, in order.",
            "The loop itself pauses at each await.",
            "Use when steps depend on each other.",
          ],
        },
        {
          label: "Promise.all(map(...))",
          items: [
            "Starts every item at once.",
            "Resolves when all are done, in input order.",
            "Use for independent work. Limit concurrency for big lists.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const items = [3, 1, 2];

async function main() {
  items.forEach(async (n) => {
    await wait(n * 10);
    console.log("forEach item", n);
  });
  console.log("forEach returned");
  await wait(50);

  for (const n of items) {
    await wait(n * 10);
    console.log("for...of item", n);
  }

  const doubled = await Promise.all(
    items.map(async (n) => {
      await wait(n * 10);
      return n * 2;
    }),
  );
  console.log("Promise.all", doubled);
}
main();`,
      caption: "The three ways to loop. forEach finishes immediately and logs its work later.",
      output: `forEach returned
forEach item 1
forEach item 2
forEach item 3
for...of item 3
for...of item 1
for...of item 2
Promise.all [ 6, 2, 4 ]`,
      tryIt: {
        language: "javascript",
        prompt: "Why does the forEach version print 1, 2, 3 while for...of prints 3, 1, 2? Write the answer as a comment in the code.",
      },
    },
    {
      kind: "h",
      text: "for await...of and async generators",
    },
    {
      kind: "p",
      text: "`for await (const x of source)` loops over something that produces values over time, such as an async generator or a stream. Each step awaits the next value.",
    },
    {
      kind: "code",
      code: `const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function* countdown(from) {
  for (let n = from; n > 0; n--) {
    await wait(10);
    yield n;
  }
}

async function main() {
  for await (const n of countdown(3)) {
    console.log("tick", n);
  }
  console.log("liftoff");
}
main();`,
      caption: "An async generator yields values with pauses between them. for await consumes them one by one.",
      output: `tick 3
tick 2
tick 1
liftoff`,
      tryIt: {
        language: "javascript",
        prompt: "Add `if (n === 2) break;` inside the loop. Does the generator keep running afterwards?",
      },
    },
    {
      kind: "code",
      code: `// app.mjs
const response = await fetch("https://example.com/data.json");
const data = await response.json();
console.log(data);`,
      caption: "Top-level await: allowed only in an ES module (a .mjs file, or a file in a package with \"type\": \"module\", or a module script). Not run here, because the playground runs classic scripts.",
    },
    {
      kind: "pitfall",
      items: [
        "Awaiting independent calls one after another, making a page three times slower than needed.",
        "Using `forEach` with `async` and expecting it to finish before the next line.",
        "Forgetting `await`, so you work with a promise object instead of its value (for example `if (checkAccess())` is always true).",
        "No error handling: an `await` that rejects without `try/catch` or `.catch` becomes an unhandled rejection.",
        "Using `await` in a non-async function: a SyntaxError (outside modules).",
      ],
    },
    {
      kind: "remember",
      items: [
        "`async` functions always return a promise. `await` pauses only its own function, resuming as a microtask; the thread is never blocked.",
        "An async function runs synchronously up to its first `await`.",
        "Two awaits in a row are sequential. For independent work, start everything first and `await Promise.all(...)`.",
        "`forEach` ignores promises. Use `for...of` for in-order work and `Promise.all(arr.map(async ...))` for parallel work. Use try/catch around awaits.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What does an async function return? A strong answer: always a promise; a return value fulfils it, a throw rejects it.",
        "Does `await` block the thread? A strong answer: no. It pauses only that function; the rest of the code and the event loop continue.",
        "How do you run async operations in parallel? A strong answer: start them all first and `await Promise.all([...])`, not `await` them one by one.",
        "Why does `await` inside `forEach` not work as expected? A strong answer: forEach ignores the returned promises, so nothing waits; use `for...of` or `Promise.all(array.map(...))`.",
        "What is the difference between `return promise` and `return await promise` inside a try block? A strong answer: only the latter lets the surrounding `catch` handle a rejection.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?
async function one() {
  return 1;
}
one().then((v) => console.log("then", v));
console.log(2);`,
      options: ["then 1, then 2", "2, then then 1", "then 1 only", "2 only"],
      answer: 1,
      why: "The async function returns a promise; its .then callback is a microtask, so the synchronous log goes first: 2 | then 1.",
    },
    {
      kind: "quiz",
      question: `What happens?
async function f() {
  try {
    return Promise.reject(new Error("x"));
  } catch (e) {
    return "caught";
  }
}
f().then(
  (v) => console.log(v),
  (e) => console.log("rejected", e.message),
);`,
      options: [
        "It prints caught",
        "It prints rejected x",
        "It prints undefined",
        "It throws before logging anything",
      ],
      answer: 1,
      why: "Without await, the rejected promise is returned straight out of the try block, so the catch never sees it. The caller gets the rejection: rejected x. With `return await`, the catch would handle it.",
    },
    {
      kind: "quiz",
      question: `What order does this print?
async function a() {
  console.log("a1");
  await Promise.resolve();
  console.log("a2");
}
a();
Promise.resolve().then(() => console.log("p"));
console.log("end");`,
      options: ["a1, a2, p, end", "a1, end, a2, p", "a1, end, p, a2", "end, a1, a2, p"],
      answer: 1,
      why: "a1 and end are synchronous. The await's continuation was queued before the promise's .then callback, so a2 comes before p: a1, end, a2, p.",
    },
  ],
};
