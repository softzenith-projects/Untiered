import type { Chapter } from "@/content/courses/types";

// The two runnable samples are plain-JavaScript models; their output was produced by running them under node.
// The real-Node ordering sample (nextTick, promise, I/O callback) was run on Node 24.13 and its output pasted.
export const chapterNodeEventLoopAndStreams: Chapter = {
  slug: "node-event-loop-and-streams",
  title: "Node.js Event Loop, EventEmitter and Streams",
  summary:
    "How Node orders nextTick, promises, timers and setImmediate, where the thread pool fits, and how EventEmitter and streams with backpressure keep a server from drowning in data.",
  minutes: 26,
  blocks: [
    {
      kind: "p",
      text: "The browser's event loop (chapter 17) has a task queue and a microtask queue. Node has the same two ideas, plus **phases** and one extra queue, `process.nextTick`. Interviewers like this topic because the answer can be checked: either you know the order or you do not. After the order comes the other half of Node's design, **streams**, which is how Node moves a file bigger than its memory without ever holding all of it.",
    },
    {
      kind: "h",
      text: "The chai-stall analogy",
    },
    {
      kind: "analogy",
      title: "A chai stall with a fixed round of jobs",
      text: "A chai-stall owner does the same round again and again. First he serves anyone whose timer has rung (**timers**). Then he handles jobs that were postponed (**pending callbacks**). Then he stands at the counter and **polls**: takes new orders and picks up finished deliveries, waiting a little if nothing is ready (**poll**). Then he clears the \"do this next\" slips (**check**, where `setImmediate` lives), and last he shuts anything that is closing (**close callbacks**). Between every single job he does a quick \"before I forget\" note: that is the `nextTick` and promise queues. Where the analogy stops: the owner can wait at the counter for as long as he likes, but Node only waits in the poll phase when nothing else is scheduled, and the real list has a few internal steps this picture leaves out.",
    },
    {
      kind: "h",
      text: "The phases, in order",
    },
    {
      kind: "steps",
      title: "One turn of Node's event loop (libuv)",
      steps: [
        { label: "1. Timers", text: "Run callbacks of setTimeout and setInterval whose time has come." },
        { label: "2. Pending callbacks", text: "Run some deferred system callbacks, such as certain network errors." },
        { label: "3. Poll", text: "Collect finished I/O and run its callbacks. If nothing else is scheduled, wait here for new I/O." },
        { label: "4. Check", text: "Run setImmediate callbacks. They always come right after poll." },
        { label: "5. Close callbacks", text: "Run cleanup callbacks such as a socket's close event." },
      ],
    },
    {
      kind: "concept",
      title: "Where nextTick and promises fit",
      text: "After each callback finishes (and between the phases), Node empties the **`process.nextTick` queue first**, then the **promise microtask queue**, repeating until both are empty. So a `nextTick` callback runs before a `.then` callback queued in the same CommonJS script, and both run before the loop moves to the next callback. The consequence is the same as in the browser: a recursive `nextTick` or a never-ending microtask chain starves I/O, because the loop can never reach the next phase.",
    },
    {
      kind: "p",
      text: "Run the sample below as a file with `node`. It uses the real `fs`, so it cannot run in the course editor. We ran it on Node 24 and pasted the output. Notice what it does **not** include: a top-level `setTimeout(fn, 0)` against `setImmediate`. Called from the main script, their order depends on how busy the machine is, and Node's own docs say so. Inside an I/O callback the order is fixed, because the loop is in the poll phase and the check phase comes next.",
    },
    {
      kind: "code",
      caption:
        "Real Node (fs, process.nextTick): run it from a terminal with `node order.js`. Output was produced on Node 24.13. It cannot run in the course editor, which has no process or fs.",
      code: `const fs = require("node:fs");

console.log("1 script start");
Promise.resolve().then(() => console.log("4 promise then"));
process.nextTick(() => console.log("3 nextTick"));
console.log("2 script end");

// Inside an I/O callback, the check phase (setImmediate) comes right after the poll phase,
// so setImmediate always beats a 0 ms timer here. At the top level of a script the order is not fixed.
fs.readFile(__filename, () => {
  console.log("5 I/O callback");
  setTimeout(() => console.log("7 setTimeout 0"), 0);
  setImmediate(() => console.log("6 setImmediate"));
});
`,
      output: `1 script start
2 script end
3 nextTick
4 promise then
5 I/O callback
6 setImmediate
7 setTimeout 0`,
    },
    {
      kind: "p",
      text: "One more detail that trips people up: the nextTick-before-promise order holds in a CommonJS file. In an ES module the whole file is itself run as a promise job, and on Node 24 the same two lines print `promise` before `tick`. That is a good reason to prefer `queueMicrotask`, `setImmediate` or a plain promise over `nextTick` in new code, as the Node docs advise.",
    },
    {
      kind: "h",
      text: "One thread for your code, a pool for the heavy lifting",
    },
    {
      kind: "p",
      text: "When you call `fs.readFile`, `crypto.pbkdf2`, `zlib` or a DNS lookup, your JavaScript thread does not do the work. libuv hands it to a **thread pool** (four threads by default) or to the operating system, and your callback is queued when the work is done. Network sockets mostly use the operating system's own readiness notifications and need no pool thread. This is why one Node process can serve thousands of connections: it spends its single JavaScript thread on short callbacks, never on waiting. It is also why a 200 ms `for` loop in a handler delays every other request: it holds the one cook.",
    },
    {
      kind: "compare",
      title: "Where does the work run?",
      columns: [
        {
          label: "On your JS thread",
          items: [
            "Your callbacks and promise handlers.",
            "JSON.parse of a huge string.",
            "A tight loop or a regex that backtracks badly.",
            "Blocks every other request while it runs.",
          ],
        },
        {
          label: "Off it (pool, OS or workers)",
          items: [
            "File reads, DNS, crypto and compression, via the thread pool.",
            "Network I/O, via the operating system.",
            "CPU-heavy JavaScript you move into a worker thread.",
            "Your thread only runs the callback when it finishes.",
          ],
        },
      ],
    },
    {
      kind: "h",
      text: "EventEmitter: Node's observer pattern",
    },
    {
      kind: "p",
      text: "Much of Node is built on **`EventEmitter`** from `node:events`. An object calls `emit(name, ...args)`, and every function registered with `on(name, fn)` runs. Servers, streams and child processes all use it. Two behaviours are worth knowing cold. Listeners run **synchronously**, in the order they were registered, inside the `emit` call. And an `'error'` event with no listener **throws** and can crash the process. The model below rebuilds the idea in about 20 lines; it is a model, not the real `node:events`.",
    },
    {
      kind: "code",
      caption:
        "A MODEL of EventEmitter in plain JavaScript: on, once, off and emit, with the two rules above. The real node:events has more (error monitor, max listeners, async iteration). Runs in the course editor and under node.",
      code: `// A MODEL of EventEmitter in about 20 lines. Not the real node:events module.
class Emitter {
  constructor() {
    this.listeners = {};
  }
  on(name, fn) {
    (this.listeners[name] = this.listeners[name] || []).push(fn);
    return this;
  }
  once(name, fn) {
    const wrapper = (...args) => {
      this.off(name, wrapper);
      fn(...args);
    };
    return this.on(name, wrapper);
  }
  off(name, fn) {
    this.listeners[name] = (this.listeners[name] || []).filter((f) => f !== fn);
    return this;
  }
  emit(name, ...args) {
    const list = this.listeners[name] || [];
    if (list.length === 0 && name === "error") {
      throw args[0]; // the real one also throws when nobody listens for "error"
    }
    for (const fn of [...list]) fn(...args); // copy: listeners may remove themselves
    return list.length > 0;
  }
}

const orders = new Emitter();
orders.on("paid", (id) => console.log("send receipt for", id));
orders.on("paid", (id) => console.log("pack order", id));
orders.once("paid", (id) => console.log("first-order coupon for", id));

console.log("emit 1 ->", orders.emit("paid", "A1"));
console.log("emit 2 ->", orders.emit("paid", "A2"));
console.log("emit 3 ->", orders.emit("shipped", "A2"));

console.log("listeners run synchronously:");
orders.on("ping", () => console.log("  listener"));
console.log("  before emit");
orders.emit("ping");
console.log("  after emit");

try {
  orders.emit("error", new Error("disk full"));
} catch (err) {
  console.log("unhandled error event throws:", err.message);
}
`,
      output: `send receipt for A1
pack order A1
first-order coupon for A1
emit 1 -> true
send receipt for A2
pack order A2
emit 2 -> true
emit 3 -> false
listeners run synchronously:
  before emit
  listener
  after emit
unhandled error event throws: disk full`,
      tryIt: {
        language: "javascript",
        prompt:
          "Predict what `emit 2` prints, then run it. Next, make the second `paid` listener call `orders.off` on itself. Does the copy of the list in `emit` matter? Remove the `[...list]` copy and see.",
      },
    },
    {
      kind: "h",
      text: "Streams and backpressure",
    },
    {
      kind: "p",
      text: "Reading a 2 GB log file with `fs.readFile` puts all 2 GB in memory. A **stream** reads it in small **chunks** instead and passes each chunk along, so memory stays small and the first bytes can leave before the last are read. Node has four kinds: **Readable** (a source), **Writable** (a destination), **Duplex** (both, like a socket) and **Transform** (a duplex that changes data, like gzip). You connect them with `pipeline` from `node:stream/promises`, which also cleans up when anything fails.",
    },
    {
      kind: "concept",
      title: "Backpressure",
      text: "**Backpressure** is the destination telling the source to slow down. A Writable has an internal buffer with a limit, the **highWaterMark**. When the buffer is over the limit, `write()` returns `false`, and a well-behaved producer stops until the `'drain'` event says the buffer is empty. `pipe()` and `pipeline()` do this for you. Without it a fast reader and a slow network make the buffer grow until the process runs out of memory.",
    },
    {
      kind: "code",
      caption:
        "A MODEL of backpressure with a buffer limit of 3: write() returns false when full, the producer pauses, and drain resumes it. A teaching model, not Node's stream implementation. Runs in the course editor and under node.",
      code: `// A MODEL of backpressure. Not Node's streams: a fast producer, a slow consumer, and
// a buffer that holds 3 items before write() says "stop".
const HIGH_WATER_MARK = 3;
const buffer = [];
let produced = 0;
let consumed = 0;
let maxBuffered = 0;
let consuming = false;
let resumeProducer = null;

function write(item) {
  buffer.push(item);
  maxBuffered = Math.max(maxBuffered, buffer.length);
  if (!consuming) consumeNext();
  return buffer.length < HIGH_WATER_MARK; // false means: please stop writing
}

function consumeNext() {
  consuming = true;
  setTimeout(() => {
    // the slow side: one item every 10 ms
    const item = buffer.shift();
    consumed += 1;
    console.log("consumed", item, "buffer now", buffer.length);
    if (consumed === 7) {
      console.log("done: produced", produced, "consumed", consumed, "max buffered", maxBuffered);
    }
    if (buffer.length > 0) {
      consumeNext();
    } else {
      consuming = false;
    }
    if (resumeProducer && buffer.length === 0) {
      const resume = resumeProducer;
      resumeProducer = null;
      console.log("drain: buffer empty, producer may continue");
      resume();
    }
  }, 10);
}

function produce(total) {
  while (produced < total) {
    produced += 1;
    const ok = write("item" + produced);
    if (!ok) {
      console.log("write returned false after item" + produced + ", pausing producer");
      resumeProducer = () => produce(total);
      return;
    }
  }
  console.log("producer finished");
}

produce(7);
`,
      output: `write returned false after item3, pausing producer
consumed item1 buffer now 2
consumed item2 buffer now 1
consumed item3 buffer now 0
drain: buffer empty, producer may continue
write returned false after item6, pausing producer
consumed item4 buffer now 2
consumed item5 buffer now 1
consumed item6 buffer now 0
drain: buffer empty, producer may continue
producer finished
consumed item7 buffer now 0
done: produced 7 consumed 7 max buffered 3`,
      tryIt: {
        language: "javascript",
        prompt:
          "Predict the output with HIGH_WATER_MARK set to 2, then run it. Then delete the `if (!ok)` check so the producer ignores backpressure and look at `max buffered`. That number is the memory a real server would hold.",
      },
    },
    {
      kind: "code",
      caption:
        "Real Node (fs, zlib, node:stream/promises): compress a large file with constant memory. Needs a file called big.log and a terminal, so it does not run in the course editor and no output is shown.",
      code: `// Streams with pipeline: backpressure and cleanup are handled for you.
const { createReadStream, createWriteStream } = require("node:fs");
const { createGzip } = require("node:zlib");
const { pipeline } = require("node:stream/promises");

async function compress(from, to) {
  await pipeline(createReadStream(from), createGzip(), createWriteStream(to));
  console.log("done"); // reached only if every stage finished without error
}

compress("big.log", "big.log.gz").catch((err) => {
  console.error("failed:", err.message); // any stage's error lands here, streams are destroyed
  process.exitCode = 1;
});
`,
    },
    {
      kind: "p",
      text: "A last word on **Buffers**. A `Buffer` is Node's fixed-size block of raw bytes, and it is what a chunk from a file or socket usually is. It is a subclass of `Uint8Array`. Convert with `buf.toString(\"utf8\")` only after you have all the chunks of a text, because a multi-byte character can be split across two chunks.",
    },
    {
      kind: "pitfall",
      items: [
        "Saying \"Node is single-threaded\" and stopping there. Fix: your JavaScript runs on one thread, while libuv's pool and worker_threads add real threads.",
        "Writing a recursive `process.nextTick` (or endless promise chain) and wondering why timers and requests never run. Fix: use `setImmediate` to yield to the loop between chunks of work.",
        "Betting on `setTimeout(fn, 0)` against `setImmediate` at the top level of a script. Fix: the order is not guaranteed there; only inside an I/O callback is `setImmediate` first.",
        "Ignoring the return value of `write()`. Fix: when it is `false`, wait for `'drain'`, or use `pipeline`, which does this for you.",
        "Emitting `'error'` with no listener, or forgetting `.on('error')` on a stream. Fix: always attach an error handler, or use `pipeline` and catch its promise.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Node's loop runs in phases: timers, pending, poll, check (setImmediate), close. nextTick, then promise microtasks, are drained after every callback.",
        "A nextTick runs before a promise `.then` in CommonJS; an ES module can reverse that. Recursion in either queue starves I/O.",
        "Heavy work leaves your thread through libuv's pool or workers; a long loop on your thread blocks every request.",
        "Backpressure: when write() returns false, stop until 'drain'. pipeline() wires it and cleans up on error.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Explain the Node.js event loop phases.\" Strong answer: timers, pending callbacks, poll, check, close, with nextTick and microtasks drained between callbacks, and the poll phase being where Node waits for I/O.",
        "\"What is the difference between process.nextTick, a promise callback and setImmediate?\" Strong answer: nextTick runs first, then promise microtasks, both before the loop moves on; setImmediate runs in the check phase, after poll.",
        "\"setTimeout(fn, 0) or setImmediate: which runs first?\" Strong answer: from the main script it depends on timing and is not guaranteed; inside an I/O callback setImmediate always runs first.",
        "\"What is backpressure and how does Node handle it?\" Strong answer: the destination signals it is full by write() returning false and later emits 'drain'; pipe and pipeline respect it, so memory stays bounded.",
        "\"Why use streams instead of readFile for a large file?\" Strong answer: constant memory, and processing starts before the whole file is read.",
      ],
    },
    {
      kind: "quiz",
      question: `In a CommonJS file, what does this print?
setImmediate(() => console.log("immediate"));
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("tick"));
console.log("sync");`,
      options: [
        "sync, tick, promise, immediate",
        "sync, promise, tick, immediate",
        "sync, immediate, tick, promise",
        "tick, promise, sync, immediate",
      ],
      answer: 0,
      why: "Synchronous code first. Then the nextTick queue, then the promise microtasks, and only later does the loop reach the check phase where setImmediate runs.",
    },
    {
      kind: "quiz",
      question: "A readable stream feeds a slow writable. write() has returned false. What should the producer do?",
      options: [
        "Keep writing; the buffer will grow as needed",
        "Wait for the 'drain' event, then continue",
        "Call write() again immediately to flush the buffer",
        "Throw an error, because the stream is broken",
      ],
      answer: 1,
      why: "False means the internal buffer is above its highWaterMark. Waiting for 'drain' lets it empty, so memory stays bounded. Using pipeline does this automatically.",
    },
    {
      kind: "quiz",
      question: `What does this print?
const e = new Emitter(); // behaves like EventEmitter
e.on("x", () => console.log("A"));
console.log("B");
e.emit("x");
console.log("C");`,
      options: ["B A C", "A B C", "B C A", "A C B"],
      answer: 0,
      why: "emit calls the listeners synchronously, in line, before it returns. B prints, then emit runs listener A, then C prints.",
    },
  ],
};
