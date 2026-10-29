import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterEventLoop: Chapter = {
  slug: "event-loop",
  title: "The Event Loop: Call Stack, Tasks and Microtasks",
  summary: "Why JavaScript can do many things with one thread: the call stack, the task queue, the microtask queue, and the exact order they are served in.",
  minutes: 22,
  blocks: [
    {
      kind: "p",
      text: "JavaScript runs your code on **one thread**: it can do exactly one thing at a time. Yet a page can fetch data, run timers and answer clicks without freezing. The trick is the **event loop**, and it is the single most asked topic in JavaScript interviews. Once you can draw it, every ordering puzzle becomes mechanical.",
    },
    {
      kind: "h",
      text: "The railway-ticket counter analogy",
    },
    {
      kind: "analogy",
      title: "One clerk, two lines",
      text: "Picture a ticket counter with one clerk (the call stack). The clerk handles one customer at a time and never stops mid-customer. Customers waiting are in two lines. The **VIP line** (microtasks) holds quick follow-up jobs: \"one more stamp on the ticket you just got\". The **regular line** (the task queue) holds new customers: timers that have rung, clicks, network replies. The rule: when the clerk finishes a customer, they empty the **whole VIP line first**, even new VIPs who join while they work, and only then take one person from the regular line. Where the analogy stops: a browser also gets a turn to repaint the screen between regular tasks, which a ticket counter has no equivalent for.",
    },
    {
      kind: "h",
      text: "The pieces",
    },
    {
      kind: "concept",
      title: "Call stack",
      text: "The **call stack** records which function is running and which functions are waiting for it to return. Calling a function pushes a frame; returning pops it. Only the top frame runs. While the stack is busy, nothing else can run, not a timer, not a click. That is how a long loop freezes a page.",
    },
    {
      kind: "concept",
      title: "Task queue (macrotask queue)",
      text: "The **task queue** holds callbacks that are ready to run but must wait for an empty stack: expired `setTimeout` and `setInterval` callbacks, user events, and message events. The event loop takes **one** task, runs it to completion, then does the microtask checkpoint.",
    },
    {
      kind: "concept",
      title: "Microtask queue",
      text: "The **microtask queue** holds `.then` / `.catch` / `.finally` callbacks, the continuation after an `await`, and `queueMicrotask` callbacks. After every task, and whenever the stack empties, the engine runs microtasks until the queue is **completely empty**, including ones added while it drains. Only then does it move on.",
    },
    {
      kind: "steps",
      title: "One turn of the loop",
      steps: [
        {
          label: "1. Run a task",
          text: "Take the oldest task from the task queue (or the script itself, the first task) and run it until the stack is empty.",
        },
        {
          label: "2. Drain microtasks",
          text: "Run every microtask, including new ones queued meanwhile, until none are left.",
        },
        {
          label: "3. Render (browsers)",
          text: "If the page needs repainting, the browser may update the screen now.",
        },
        {
          label: "4. Repeat",
          text: "Go back to step 1 and take the next task.",
        },
      ],
    },
    {
      kind: "h",
      text: "Your first ordering puzzle",
    },
    {
      kind: "code",
      code: `console.log("1 sync start");
setTimeout(() => console.log("5 timeout"), 0);
Promise.resolve().then(() => console.log("3 promise"));
queueMicrotask(() => console.log("4 microtask"));
console.log("2 sync end");`,
      caption: "Synchronous code first, then microtasks, then the timer, even though the timer has a delay of 0.",
      output: `1 sync start
2 sync end
3 promise
4 microtask
5 timeout`,
      tryIt: {
        language: "javascript",
        prompt: "Predict the order, then run it. Now change the timeout delay to 1000 and run again. Does the order change?",
      },
    },
    {
      kind: "viz",
      title: "Stepping through the puzzle: the call stack",
      caption: "Watch the stack as the script runs. The callbacks are not on the stack; they are waiting in a queue.",
      viz: {
        type: "callstack",
        frames: [
          {
            stack: [
              {
                label: "script",
                state: "active",
              },
            ],
            note: "The script starts as the first task. The stack holds one frame.",
          },
          {
            stack: [
              {
                label: "script",
              },
              {
                label: "console.log('1 sync start')",
                state: "active",
              },
            ],
            note: "Prints `1 sync start`. The call returns and its frame pops.",
          },
          {
            stack: [
              {
                label: "script",
              },
              {
                label: "setTimeout(...)",
                state: "active",
              },
            ],
            note: "setTimeout hands the callback and the delay to the runtime's timer. The call returns at once. The callback is NOT run now.",
          },
          {
            stack: [
              {
                label: "script",
              },
              {
                label: "Promise.resolve().then(...)",
                state: "active",
              },
            ],
            note: "The promise is already resolved, so the `.then` callback goes straight into the microtask queue.",
          },
          {
            stack: [
              {
                label: "script",
              },
              {
                label: "queueMicrotask(...)",
                state: "active",
              },
            ],
            note: "A second microtask is added behind the first.",
          },
          {
            stack: [
              {
                label: "script",
              },
              {
                label: "console.log('2 sync end')",
                state: "active",
              },
            ],
            note: "Prints `2 sync end`. The script has no more lines.",
          },
          {
            stack: [
              {
                label: "microtask: promise",
                state: "active",
              },
            ],
            note: "The script's frame is gone and the stack is empty. The engine runs microtasks first: prints `3 promise`.",
          },
          {
            stack: [
              {
                label: "microtask: queueMicrotask",
                state: "active",
              },
            ],
            note: "Next microtask: prints `4 microtask`. The microtask queue is now empty.",
          },
          {
            stack: [
              {
                label: "task: timeout",
                state: "active",
              },
            ],
            note: "Only now does the loop take the timer's callback from the task queue: prints `5 timeout`.",
          },
        ],
      },
    },
    {
      kind: "viz",
      title: "The same puzzle: the queues",
      caption: "What waits where, after the script finishes but before anything has run.",
      viz: {
        type: "queue",
        frames: [
          {
            items: ["setTimeout cb"],
            note: "Task queue after the timer fires: one task waiting.",
          },
          {
            items: ["promise then", "queueMicrotask cb"],
            note: "Microtask queue: two jobs, in the order they were added. These run first.",
          },
          {
            items: ["queueMicrotask cb"],
            highlight: 0,
            note: "After `3 promise` runs, one microtask is left.",
          },
          {
            items: [],
            note: "Microtask queue empty. The timer's task is now taken from the task queue.",
          },
        ],
      },
    },
    {
      kind: "h",
      text: "Why setTimeout(fn, 0) is not zero",
    },
    {
      kind: "p",
      text: "`setTimeout(fn, 0)` does not run `fn` \"now\". It asks the runtime to put `fn` in the task queue after the delay, and that task still has to wait for the current script and every microtask to finish. The delay is a **minimum**, not a promise. Browsers also clamp deeply nested timers (about 4 ms once nesting passes five levels). So timer callbacks can only be late, never early.",
    },
    {
      kind: "code",
      code: `setTimeout(() => console.log("20ms"), 20);
setTimeout(() => console.log("0ms"), 0);
setTimeout(() => console.log("10ms"), 10);
Promise.resolve().then(() => console.log("microtask"));
console.log("sync");`,
      caption: "Timers run in order of their delay, not the order they were written. All of them wait for the microtask.",
      output: `sync
microtask
0ms
10ms
20ms`,
      tryIt: {
        language: "javascript",
        prompt: "Add a fourth timer with a delay of 10 written before the 20ms one. Which of the two 10ms-style timers fires first, and why?",
      },
    },
    {
      kind: "h",
      text: "A harder one: promises, async and await together",
    },
    {
      kind: "p",
      text: "An `async` function runs **synchronously until its first `await`**. At the `await`, the rest of the function becomes a microtask and the function returns a promise to its caller. The `new Promise(executor)` executor also runs synchronously; only the `.then` callback is a microtask.",
    },
    {
      kind: "code",
      code: `async function a() {
  console.log("a1");
  await b();
  console.log("a2");
}
async function b() {
  console.log("b");
}

console.log("start");
setTimeout(() => console.log("timeout"), 0);
a();
new Promise((resolve) => {
  console.log("executor");
  resolve();
}).then(() => console.log("then"));
console.log("end");`,
      caption: "Sync parts of an async function and a Promise executor run in line. The code after an await resumes as a microtask.",
      output: `start
a1
b
executor
end
a2
then
timeout`,
      tryIt: {
        language: "javascript",
        prompt: "Trace it on paper first: list the sync lines, then the microtask queue in order, then the timer. Check your list against the output.",
      },
    },
    {
      kind: "p",
      text: "Reading it: `start`, then `a1` and `b` (both are sync), then `executor`, then `end`. The microtask queue now holds `a2` (queued first, when `await b()` resumed) and `then`. They run in that order. The timer is last. If any step surprises you, find where the code is synchronous and where it is waiting.",
    },
    {
      kind: "h",
      text: "A long task freezes everything",
    },
    {
      kind: "compare",
      title: "Same work, two ways",
      columns: [
        {
          label: "One long task",
          items: [
            "A loop of 100 million steps holds the stack.",
            "No click, timer or repaint can happen until it ends.",
            "The page looks frozen.",
          ],
        },
        {
          label: "Chunked work",
          items: [
            "Do a slice, then `setTimeout(next, 0)` or use a worker.",
            "Between slices the loop can handle clicks and repaint.",
            "Total work is the same, the page stays alive.",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Thinking `setTimeout(fn, 0)` runs immediately. It always waits for the current script and all microtasks.",
        "Assuming `await` pauses the whole program. It pauses only that function; the caller continues.",
        "Running a heavy loop in a click handler and blaming the network for the freeze. The stack was busy.",
        "Expecting `setTimeout(fn, 100)` to fire at exactly 100 ms. It fires no earlier, and later if the stack is busy.",
        "Creating an endless microtask loop (`function f() { Promise.resolve().then(f); }`). It starves timers and rendering.",
      ],
    },
    {
      kind: "remember",
      items: [
        "One thread, one call stack. A running function is never interrupted; everything else waits.",
        "After each task the engine drains ALL microtasks (promise callbacks, await continuations, queueMicrotask), then takes the next task (timers, events), then the browser may render.",
        "The Promise executor and the start of an async function are synchronous. Only .then callbacks and code after await are microtasks.",
        "A timer delay is a minimum. `setTimeout(fn, 0)` means 'after the current script and all microtasks', not 'now'.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Explain the event loop. A strong answer names the call stack, task queue and microtask queue, says one task runs to completion and then all microtasks drain, and mentions rendering in browsers.",
        "What is the output of a script mixing `setTimeout`, `Promise.then` and `console.log`? A strong answer lists sync first, then microtasks in queue order, then timers by delay, and explains each step.",
        "Why does `setTimeout(fn, 0)` run after a resolved promise's `.then`? A strong answer: timers are tasks; `.then` is a microtask; microtasks drain before the next task.",
        "Can JavaScript run two things at once? A strong answer: not on the same thread; async work like I/O is done by the runtime while JS keeps running, and its callbacks are queued. Web Workers give separate threads.",
        "What happens if a microtask keeps queuing another microtask? A strong answer: the queue never empties, so tasks and rendering are starved and the page freezes.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");`,
      options: ["A B C D", "A D B C", "A D C B", "D A C B"],
      answer: 2,
      why: "Sync code first (A, D). The resolved promise's .then is a microtask (C), and the timer is a task (B), so the output is A D C B.",
    },
    {
      kind: "quiz",
      question: `What order do the numbers print?
Promise.resolve().then(() => {
  console.log(1);
  Promise.resolve().then(() => console.log(2));
});
setTimeout(() => console.log(3), 0);
queueMicrotask(() => console.log(4));`,
      options: ["1 2 3 4", "1 4 2 3", "3 1 4 2", "1 4 3 2"],
      answer: 1,
      why: "Microtasks drain fully before the timer. 1 runs first. 4 was queued before the nested 2 was created, so 4 comes next, then the new microtask 2, then the timer's 3: 1 4 2 3.",
    },
    {
      kind: "quiz",
      question: `What does this print?
async function f() {
  console.log(1);
  await null;
  console.log(2);
}
f();
console.log(3);`,
      options: ["1 2 3", "1 3 2", "3 1 2", "2 1 3"],
      answer: 1,
      why: "The async function runs synchronously to its first await and prints 1. The caller continues and prints 3. The code after the await resumes as a microtask and prints 2: 1 3 2.",
    },
  ],
};
