import type { Chapter } from "@/content/courses/types";

// The runnable sample is a plain-JavaScript model of graceful shutdown; its output was produced by running it under node.
// The worker_threads sample and the node:test file were run on Node 24.13; the worker output is pasted, the test output has timings so it is not.
export const chapterScalingAndTestingNode: Chapter = {
  slug: "scaling-and-testing-node",
  title: "Node.js: Scaling, Graceful Shutdown and Testing",
  summary:
    "How to use more than one CPU core (cluster, worker_threads, child processes), how a server shuts down without dropping requests, structured logging, tests with the built-in node:test runner, and a short deployment checklist.",
  minutes: 24,
  blocks: [
    {
      kind: "p",
      text: "One Node process runs your JavaScript on one thread, so on a machine with eight cores it uses about one of them. Production work is mostly about three things around that fact: **using the other cores**, **stopping politely** so a deploy does not drop requests, and **testing** so a change does not silently break what worked. This closes the Node module with the practical answers to \"how would you scale this?\" and \"how would you test it?\".",
    },
    {
      kind: "h",
      text: "The bank-branch analogy",
    },
    {
      kind: "analogy",
      title: "More counters, and a proper closing time",
      text: "A bank branch with one teller serves one person at a time, however many staff sit idle behind. You can open **more counters** (more processes, each with its own teller) or give the teller a **back-office helper** for a slow job like reconciling a ledger (a worker thread). At closing time a good branch does not lock the door on a customer mid-transaction: the guard stops letting new people in, finishes the people inside, and only then locks up. That is **graceful shutdown**. Where the analogy stops: bank counters share one cash drawer, while separate Node processes share nothing, so any shared state (sessions, counters) has to live in a database or Redis.",
    },
    {
      kind: "h",
      text: "Using more than one core",
    },
    {
      kind: "compare",
      title: "Three ways to get more done",
      columns: [
        {
          label: "cluster / several processes",
          items: [
            "Many copies of your server, one per core, sharing one port.",
            "Best for: handling more requests at once.",
            "Memory is not shared; use Redis or a database for shared state.",
            "In production this is often done outside Node: a process manager or several containers behind a load balancer.",
          ],
        },
        {
          label: "worker_threads",
          items: [
            "Extra JavaScript threads inside one process.",
            "Best for: CPU-heavy work such as image resizing or parsing a huge file.",
            "Talk by messages; shared memory only if you opt in.",
            "Does not help with waiting for the network, which is already non-blocking.",
          ],
        },
        {
          label: "child_process",
          items: [
            "Starts another program, such as a command-line tool.",
            "Best for: running ffmpeg, git or a script in another language.",
            "Separate memory, communication through pipes.",
            "Treat its input as untrusted; never build a command line from user text.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "The rule of thumb: **I/O-bound work scales with more processes; CPU-bound work scales with worker threads or more processes.** Moving a slow `for` loop to a worker keeps the main thread free to answer other requests. The program below is real Node: the main thread starts a worker that computes the 30th Fibonacci number, and the main thread's own `console.log` prints first because it is not waiting. It uses `worker_threads`, so it runs from a terminal, not in the course editor.",
    },
    {
      kind: "code",
      caption:
        "Real Node (node:worker_threads): the same file is both the main program and the worker. Output was produced on Node 24.13. It does not run in the course editor, which has no worker_threads.",
      code: `const { Worker, isMainThread, parentPort, workerData } = require("node:worker_threads");

if (isMainThread) {
  const worker = new Worker(__filename, { workerData: 30 });
  worker.on("message", (result) => console.log("fib(30) =", result));
  worker.on("error", (err) => console.log("worker failed:", err.message));
  console.log("main thread is free while the worker computes");
} else {
  const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));
  parentPort.postMessage(fib(workerData));
}
`,
      output: `main thread is free while the worker computes
fib(30) = 832040`,
    },
    {
      kind: "h",
      text: "Graceful shutdown",
    },
    {
      kind: "p",
      text: "When you deploy, the platform tells your process to stop by sending the signal **SIGTERM** (and, after a grace period, kills it). If you simply exit, every request in progress is cut off. The graceful way is a short sequence: on SIGTERM, stop accepting new connections (`server.close()`), let in-flight requests finish, close the database pool, then exit. Add a **timeout** so a stuck request cannot block the exit forever. The sample is a **model** with timers standing in for requests and a plain function call standing in for the signal, so it runs in the editor; the real wiring is shown after it.",
    },
    {
      kind: "code",
      caption:
        "A MODEL of graceful shutdown: two requests are in flight when the signal arrives, a third is refused, and the process exits only after the last one finishes. Timers stand in for requests and a function call for SIGTERM. Runs in the course editor and under node.",
      code: `// A MODEL of graceful shutdown. Not a real server: requests are timers, and the
// "signal" is a function call at 25 ms. A real process would listen for SIGTERM.
let accepting = true;
let inFlight = 0;
let shutdownStarted = false;

function handleRequest(name, workMs) {
  if (!accepting) {
    console.log(name, "refused: server is shutting down");
    return;
  }
  inFlight += 1;
  console.log(name, "started, in flight:", inFlight);
  setTimeout(() => {
    inFlight -= 1;
    console.log(name, "finished, in flight:", inFlight);
    if (shutdownStarted && inFlight === 0) finishShutdown();
  }, workMs);
}

function startShutdown() {
  console.log("signal received: stop accepting new work");
  shutdownStarted = true;
  accepting = false;
  if (inFlight === 0) finishShutdown();
}

function finishShutdown() {
  console.log("all requests drained: closing database, exiting 0");
}

handleRequest("req-A", 10);
handleRequest("req-B", 40);
setTimeout(startShutdown, 25);
setTimeout(() => handleRequest("req-C", 5), 30);
`,
      output: `req-A started, in flight: 1
req-B started, in flight: 2
req-A finished, in flight: 1
signal received: stop accepting new work
req-C refused: server is shutting down
req-B finished, in flight: 0
all requests drained: closing database, exiting 0`,
      tryIt: {
        language: "javascript",
        prompt:
          "Predict the output, then run it. Move `startShutdown` to 50 ms. Which requests finish before the signal, and what does req-C do now? Then change req-B's work to 100 and think about why a real server needs a shutdown timeout.",
      },
    },
    {
      kind: "code",
      caption:
        "Real Node (node:http): the same idea with a real server and a real signal. It listens on a port and waits for SIGTERM, so it does not run in the course editor and no output is shown.",
      code: `const http = require("node:http");

const server = http.createServer((req, res) => {
  setTimeout(() => res.end("done"), 2000); // a slow request
});
server.listen(3000);

function shutdown(signal) {
  console.log(signal + " received, closing");
  server.close(() => {
    // called once every connection has ended: now close the database pool, flush logs
    console.log("closed cleanly");
    process.exit(0);
  });
  // safety net: if something hangs, leave anyway, with a failure code
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT")); // Ctrl+C in a terminal
`,
    },
    {
      kind: "h",
      text: "Logging and errors in production",
    },
    {
      kind: "p",
      text: "Write logs as **one JSON object per line** with a level, a message and the request id, because machines search them. Never log passwords, tokens or full card numbers. Log to standard output and let the platform collect it. For errors that escape every handler, Node emits `unhandledRejection` for a promise nobody caught and `uncaughtException` for a throw nobody caught. Treat both as \"the process may be in an unknown state\": log the error, shut down gracefully, and let a supervisor restart a clean process, rather than carrying on.",
    },
    {
      kind: "h",
      text: "Testing with node:test",
    },
    {
      kind: "p",
      text: "Current LTS lines include a test runner: `node:test` (marked stable in the Node docs) with `node:assert` for checks. No install is needed, run it with `node --test`, add `--watch` to rerun on save. For web endpoints, test the **behaviour** (the status and body you get for a request), start the app on a random port in the test, and replace the database and any outside service with a fake. A test that depends on a live third-party service is slow and flaky.",
    },
    {
      kind: "code",
      caption:
        "Real Node (node:test and node:assert): run with `node --test`. On Node 24.13 the three tests pass, but the report includes millisecond timings that change on every run, so it is not pasted. It does not run in the course editor.",
      code: `const test = require("node:test");
const assert = require("node:assert/strict");

function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

test("sum adds numbers", () => {
  assert.equal(sum([1, 2, 3]), 6);
});

test("sum of nothing is zero", () => {
  assert.equal(sum([]), 0);
});

test("async work can be awaited", async () => {
  const value = await Promise.resolve(42);
  assert.equal(value, 42);
});
`,
    },
    {
      kind: "h",
      text: "A deployment checklist",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Run on a supported LTS line, and pin it (`engines` in package.json, or the runtime image tag).",
        "Install with the lockfile (`npm ci`) so production gets exactly the versions you tested.",
        "Set `NODE_ENV=production`, and read every secret from the environment, never from the repo.",
        "Expose a health endpoint the platform can probe, and handle SIGTERM gracefully.",
        "Log JSON to standard output; add error tracking and a metric for latency and error rate.",
        "Put a rate limit and request-size limit in front of every public endpoint.",
        "Run as a non-root user and keep dependencies updated; audit them with `npm audit`.",
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Doing a CPU-heavy task on the main thread and calling Node \"slow\". Fix: move it to a worker thread, or another service, and keep request handlers short.",
        "Keeping session or cache data in a variable when running several processes. Each process has its own copy. Fix: store shared state in Redis or a database.",
        "Calling `process.exit()` straight away on SIGTERM, which drops in-flight requests. Fix: `server.close()`, wait for it, then exit, with a timeout as a safety net.",
        "Ignoring `unhandledRejection` so the process limps on in an unknown state. Fix: log it and exit for a supervisor to restart, after a graceful shutdown.",
        "Writing tests that call the real database or a paid API. Fix: fake the boundary, so tests are fast, free and repeatable.",
      ],
    },
    {
      kind: "remember",
      items: [
        "One Node process uses one core for JavaScript. More processes (cluster, containers) scale I/O; worker_threads take CPU-heavy work off the main thread.",
        "Graceful shutdown: on SIGTERM stop accepting, drain in-flight requests, close the pool, then exit, with a timeout as a backstop.",
        "After an uncaught exception or unhandled rejection the state is unknown: log, shut down and restart rather than carry on.",
        "node:test and node:assert are built in; test behaviour, and fake the database and outside services.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How do you scale a Node.js application?\" Strong answer: run several processes (cluster or containers behind a load balancer), keep state in shared stores, use worker_threads for CPU-bound work, and cache and rate-limit.",
        "\"When would you use worker_threads instead of cluster?\" Strong answer: worker_threads for CPU-heavy tasks inside one process that should not block the main thread; cluster or multiple processes to serve more concurrent requests.",
        "\"How do you shut down a Node server gracefully?\" Strong answer: handle SIGTERM, call server.close() so new connections stop and existing ones finish, close the database, exit, and set a timeout.",
        "\"What happens on an unhandled promise rejection?\" Strong answer: Node raises an unhandledRejection event, and by default current versions treat it as a crash; handle it by logging and restarting cleanly, not by ignoring it.",
        "\"How would you test an Express endpoint?\" Strong answer: start the app on a random port, send a real HTTP request, assert on status and body, and replace the database and external calls with fakes.",
      ],
    },
    {
      kind: "quiz",
      question: "An image-resizing endpoint makes every other request slow while it runs. What is the most direct fix?",
      options: [
        "Use async/await in the handler so it does not block",
        "Run the resize in a worker thread, so the main thread keeps serving requests",
        "Add a second await before the resize",
        "Convert the handler to a callback",
      ],
      answer: 1,
      why: "Resizing is CPU work on the JavaScript thread. async/await does not move CPU work anywhere; a worker thread (or another process) does.",
    },
    {
      kind: "quiz",
      question: "Your process receives SIGTERM with three requests in progress. Which sequence is the graceful one?",
      options: [
        "Exit immediately so the platform can start a new copy",
        "Stop accepting new connections, let the three finish, close the database, then exit",
        "Ignore the signal and wait to be killed",
        "Finish the three, then keep accepting new connections",
      ],
      answer: 1,
      why: "Graceful shutdown stops new work first, drains what is in progress, releases resources and then exits. A timeout guards against a request that never finishes.",
    },
    {
      kind: "quiz",
      question: `Two copies of a server run behind a load balancer. Each keeps a counter in a variable: let hits = 0. A client calls 4 times and the calls alternate between the copies. What does each copy's counter show?`,
      options: ["4 in both copies", "2 in each copy", "4 in one and 0 in the other", "0 in both until they synchronise"],
      answer: 1,
      why: "Processes do not share memory. Each copy counted only the calls it received, so each shows 2 and neither knows the total. Shared state belongs in Redis or a database.",
    },
  ],
};
