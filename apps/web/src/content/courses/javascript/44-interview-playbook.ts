import type { Chapter } from "@/content/courses/types";

// Generic interview patterns only: no company is named and no question is attributed to one.
// Both runnable samples' output was produced by running them under node.
export const chapterInterviewPlaybook: Chapter = {
  slug: "interview-playbook",
  title: "The JavaScript Interview Playbook",
  summary:
    "How a JavaScript, React and Node interview round usually runs in general terms: output-prediction questions, machine-coding tasks, a React component round, a short system-design talk, how to think aloud, and a revision checklist that points back to every chapter.",
  minutes: 26,
  blocks: [
    {
      kind: "p",
      text: "You now know the language, the browser, React, Node and Next.js. An interview tests something extra: whether you can **use that knowledge out loud, under time pressure, in front of a stranger**. Formats differ from one interviewer to the next, so this chapter describes patterns, not any particular company's process. Treat it as a routine to practise: four kinds of round, one habit that helps in all of them (thinking aloud), and a checklist to revise from. You can rehearse the spoken part on this platform with a mock interview.",
    },
    {
      kind: "h",
      text: "The step-marking analogy",
    },
    {
      kind: "analogy",
      title: "In the board exam, steps earn marks",
      text: "In a class-12 maths paper a wrong final answer with correct steps still earns most of the marks, and a right answer with no working can earn few. An interviewer marks the same way. They are not only waiting for the final answer; they are reading your working: how you split the problem, what you check, what you do when you are stuck. Where the analogy stops: in an exam you write for a marker who is not in the room. In an interview the examiner is listening live, so you can ask them a question and use their answer, which is a skill the exam never rewards.",
    },
    {
      kind: "h",
      text: "The four kinds of round",
    },
    {
      kind: "compare",
      title: "What each round looks like",
      columns: [
        {
          label: "Output prediction",
          items: [
            "A short snippet; \"what does this print, and why?\"",
            "Tests: event loop, closures, `this`, hoisting, coercion.",
            "Win by explaining the rule, not guessing.",
          ],
        },
        {
          label: "Machine coding",
          items: [
            "Write a small utility or component: debounce, event emitter, Promise.all, a retry.",
            "Tests: clean code, edge cases, testing it yourself.",
            "Win by clarifying first and running examples.",
          ],
        },
        {
          label: "React component",
          items: [
            "Build a small UI: a list with search, a form, a counter with undo.",
            "Tests: state design, effects, keys, accessibility.",
            "Win by choosing state carefully and talking about trade-offs.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "A fourth kind, a short **system-design discussion**, appears for more experienced roles, and is covered later in this chapter. Whatever the kind, the interviewer is listening for the same things: do you understand the mechanism, do you notice edge cases, can you communicate, and how do you respond to a hint.",
    },
    {
      kind: "h",
      text: "Output-prediction questions: a routine",
    },
    {
      kind: "steps",
      title: "Answering \"what does this print?\"",
      steps: [
        { label: "1. Mark what is synchronous", text: "Read top to bottom and write the synchronous output. Callbacks of setTimeout, then and await are not run yet." },
        { label: "2. List the queues", text: "Write down the microtask queue (promise callbacks, code after await) and the timer queue in the order they were added." },
        { label: "3. Drain in order", text: "After the sync code: all microtasks, in order, including new ones they add. Then timers by delay, ties by order written." },
        { label: "4. Check scope and this", text: "For loops with var, closures and callbacks, ask which variable each function sees, and what this is at the call site." },
        { label: "5. Say the rule", text: "Give the answer and the reason in one sentence each. The reason is what scores." },
      ],
    },
    {
      kind: "code",
      caption:
        "A practice puzzle mixing a var-in-loop closure, bind, array coercion, microtasks and two timers. Try the routine on paper before you run it. Runs in the course editor and under node.",
      code: `// An output-prediction puzzle. Answer it with the routine: sync first, then microtasks, then timers by delay.
var fns = [];
for (var i = 0; i < 3; i++) {
  fns.push(() => i);
}
console.log("A", fns.map((f) => f()).join(","));

const counter = {
  count: 0,
  inc() {
    this.count += 1;
    return this.count;
  },
};
const inc = counter.inc.bind(counter);
console.log("B", inc(), inc(), [1] + [2], typeof null);

setTimeout(() => console.log("F timeout 5"), 5);
setTimeout(() => console.log("E timeout 0"), 0);
Promise.resolve()
  .then(() => console.log("D then 1"))
  .then(() => console.log("D then 2"));
console.log("C sync end");
`,
      output: `A 3,3,3
B 1 2 12 object
C sync end
D then 1
D then 2
E timeout 0
F timeout 5`,
      tryIt: {
        language: "javascript",
        prompt:
          "Write your predicted output first, with one reason per line. Run it and mark any line you got wrong. Then change `var i` to `let i` and predict line A again. The rule behind the change is the one to say aloud.",
      },
    },
    {
      kind: "p",
      text: "Why the answers come out that way, in the words you would use: **A** prints `3,3,3` because `var` is function-scoped, so all three arrows share one `i`, which is `3` when they finally run (chapter 10 on closures, chapter 9 on scope). **B**: `bind` fixes `this`, so the counter is correct; `[1] + [2]` turns both arrays into strings and joins them, giving `\"12\"`; `typeof null` is `\"object\"`, a historical quirk (chapter 3 on coercion). **C** is synchronous, so it comes before everything else. Both `D` lines are microtasks and run before any timer; the second `then` is queued only when the first finishes. Then the timers: `0` before `5` (chapter 17 on the event loop).",
    },
    {
      kind: "h",
      text: "Machine-coding rounds: a routine",
    },
    {
      kind: "p",
      text: "A **machine-coding round** asks you to write a small, working piece of code, often a utility such as `debounce`, `throttle`, an `EventEmitter`, `Promise.all` or a retry helper (chapter 21 builds most of these). The code matters, but the **order you work in** matters just as much, and it is the part candidates skip.",
    },
    {
      kind: "steps",
      title: "A routine for any small coding task",
      steps: [
        { label: "1. Repeat and clarify", text: "Say the task back in your own words. Ask about inputs, what to do on bad input, and whether the function must be sync or async." },
        { label: "2. Name the edge cases", text: "Empty input, one item, a function that throws, a call during a call. Say them before writing; add the ones you forget later." },
        { label: "3. Pick the shape", text: "Say your plan in two sentences and the complexity. Choose the simplest version that is correct." },
        { label: "4. Write it in small pieces", text: "Make the happy path work first. Name variables for what they mean. Avoid cleverness." },
        { label: "5. Test with examples, out loud", text: "Trace a normal case and two edge cases by hand, or run them. Fix what you find without panic." },
        { label: "6. Offer the next step", text: "Say what you would add with more time: cancel support, tests, a timeout, TypeScript types." },
      ],
    },
    {
      kind: "code",
      caption:
        "A retry helper written the way you would narrate it: the comments are the spoken plan. The two fake tasks stand in for a network call. Timers are short and the clock is virtual in the course editor. Runs in the course editor and under node.",
      code: `// A machine-coding round, solved the way you would say it aloud.
// Task: retry(fn, attempts, delayMs): call fn; if it rejects, wait and try again; give up after \`attempts\`.
//
// 1. Clarify: does the delay grow? (Say: I will double it each time. Easy to change.)
// 2. Edge cases: attempts of 1 means no retry. fn may throw synchronously, so wrap the call.
// 3. Shape: an async loop reads best. No recursion, no nested promises.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(fn, attempts, delayMs) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt); // await here so a rejection is caught by this try/catch
    } catch (err) {
      lastError = err;
      console.log("attempt " + attempt + " failed: " + err.message);
      if (attempt < attempts) await wait(delayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

// 4. Test it with a fake that fails twice, then succeeds, and one that never succeeds.
const flaky = async (attempt) => {
  if (attempt < 3) throw new Error("network down");
  return "ok on attempt " + attempt;
};
const broken = async () => {
  throw new Error("always fails");
};

retry(flaky, 5, 10)
  .then((value) => {
    console.log("flaky ->", value);
    return retry(broken, 2, 10);
  })
  .catch((err) => console.log("gave up:", err.message));
`,
      output: `attempt 1 failed: network down
attempt 2 failed: network down
flaky -> ok on attempt 3
attempt 1 failed: always fails
attempt 2 failed: always fails
gave up: always fails`,
      tryIt: {
        language: "javascript",
        prompt:
          "Remove the `await` from `return await fn(attempt)` and run it. The failures are no longer caught inside the loop. Predict why before you look, then restore it. This is exactly the kind of detail an interviewer asks about.",
      },
    },
    {
      kind: "h",
      text: "The React component round",
    },
    {
      kind: "p",
      text: "You may be given a small UI to build in a browser sandbox: a searchable list, a to-do app, a star rating, an accordion. Interviewers watch for a few decisions. **What is state, and what is derived?** Keep the minimum in state and compute the rest while rendering (chapter 28, chapter 31). **Where do effects belong?** Not for something you can compute (chapter 29). **Are lists keyed correctly, are inputs controlled, are buttons real buttons with labels?** Say your state shape before you type it. The example below is plain React code, which needs a React project and does not run in the course editor, so no output is shown.",
    },
    {
      kind: "code",
      caption:
        "A React component for a searchable list, written to show decisions worth narrating. Needs a React project, so it does not run in the course editor and no output is shown.",
      code: `import { useState } from "react";

export function SearchableList({ items }: { items: string[] }) {
  // State: only what the user types. The filtered list is DERIVED, not stored.
  const [query, setQuery] = useState("");

  const visible = items.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <label htmlFor="q">Search</label>   {/* a real label: accessible and clickable */}
      <input id="q" value={query} onChange={(e) => setQuery(e.target.value)} /> {/* controlled */}
      {visible.length === 0 ? (
        <p>No matches</p>               // the empty state is part of the spec
      ) : (
        <ul>
          {visible.map((item) => (
            <li key={item}>{item}</li>   // a stable key; index only if the list never reorders
          ))}
        </ul>
      )}
    </div>
  );
}
`,
    },
    {
      kind: "h",
      text: "A short system-design discussion",
    },
    {
      kind: "p",
      text: "For more senior roles an interviewer may ask you to design something small on a whiteboard: an autocomplete box, a notification feed, a URL shortener, a rate limiter. They want a **structure**, not a perfect system. A frame that works in general terms:",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "**Clarify the requirements**: who uses it, how many, read-heavy or write-heavy, what must never go wrong.",
        "**Define the API**: the few endpoints or functions and their inputs and outputs (chapter 37 on REST and status codes).",
        "**Sketch the data**: what you store, the key you look it up by, and where it lives (a database, a cache).",
        "**Name the bottleneck**: the part that fails first at 100 times the load, and one fix for it (a cache, a queue, an index, rate limiting from chapter 38, more processes from chapter 39).",
        "**State the trade-offs**: what you gave up (freshness for speed, simplicity for scale) and what you would do next.",
      ],
    },
    {
      kind: "h",
      text: "Thinking aloud",
    },
    {
      kind: "compare",
      title: "Silent vs narrated",
      columns: [
        {
          label: "Silent",
          items: [
            "Types for three minutes, then announces an answer.",
            "The interviewer cannot tell a plan from a guess.",
            "A wrong turn is invisible until it is too late to help.",
          ],
        },
        {
          label: "Narrated",
          items: [
            "\"I'll assume numbers only; tell me if not.\"",
            "\"This is O(n squared); I'll accept it first, then improve it.\"",
            "\"I'm stuck on the reset case; let me trace a small input.\"",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "Narrating does not mean talking constantly. Speak at the **decisions**: the assumption you are making, the option you are rejecting and why, the check you are about to run. If you are stuck, say what you do know and what you are trying; interviewers give hints to candidates who show their reasoning, and a hint taken well is a good sign, not a failure. If you do not know something, say so and reason from what you do know: \"I haven't used that API; from the name I'd expect X, and I'd confirm in the docs.\" Never invent a fact to fill the silence.",
    },
    {
      kind: "h",
      text: "Revision checklist: topics and where to find them",
    },
    {
      kind: "table",
      head: ["If you are weak on", "Revise", "Check that you can"],
      rows: [
        ["var, let, const, hoisting, TDZ", "Ch 2 values and variables; ch 9 scope and hoisting", "Explain why accessing a let before its line throws, and what var does instead"],
        ["== vs ===, coercion, NaN", "Ch 3 operators and coercion", "Predict [] + {}, null == 0, and when to use ??"],
        ["Closures and loops", "Ch 10 closures", "Fix the var-in-loop timer bug two ways"],
        ["this, call, apply, bind", "Ch 11 the this keyword", "Name the binding rules and why an extracted method loses this"],
        ["Prototypes, classes", "Ch 12 prototypes; ch 13 classes", "Explain the prototype chain and what class compiles down to"],
        ["Event loop, promises, async/await", "Ch 17, 18, 19", "Order a mixed sync/timer/promise snippet and explain each step"],
        ["fetch, abort, retries", "Ch 20", "Cancel a request, handle a 404, retry with backoff"],
        ["Utilities and polyfills", "Ch 21 machine-coding utilities", "Write debounce, throttle, once, memoize, Promise.all from memory"],
        ["DOM, events, security", "Ch 22 to 25", "Use event delegation; name XSS, CSRF and CORS defences"],
        ["React state and effects", "Ch 27 to 29", "Explain state as a snapshot, the effect lifecycle, and keys"],
        ["React performance and patterns", "Ch 30 to 34", "When memoisation helps, what the Compiler changes, custom hooks"],
        ["Node runtime and streams", "Ch 35, 36", "Order nextTick, promise and setImmediate; explain backpressure"],
        ["Express, auth, scaling", "Ch 37 to 39", "Explain middleware, 401 vs 403, password hashing, graceful shutdown"],
        ["Next.js", "Ch 40 to 42", "Server vs Client Components, caching model for the version in use"],
        ["TypeScript", "Ch 43", "any vs unknown, narrowing, why types do not exist at runtime"],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Starting to code before the question is clear. Fix: repeat the task, ask about inputs and errors, and name two edge cases first.",
        "Guessing an output instead of tracing it. Fix: write the synchronous output, the microtask queue and the timer queue on paper, then drain them in order.",
        "Going silent when stuck. Fix: say what you know, what you tried, and trace a tiny input aloud.",
        "Claiming a fact you are not sure about, such as how a library version behaves. Fix: say \"I believe X, and I would check the docs\"; honest uncertainty scores better than a confident error.",
        "Finishing the code and stopping. Fix: run your own examples, include an edge case, and mention what you would test or improve with more time.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Interviewers read your working, not only your answer. Clarify, name edge cases, build the simple version, test it aloud.",
        "Output prediction is mechanical: synchronous output, then microtasks, then timers by delay. Say the rule behind each line.",
        "In React, keep state minimal, derive the rest, key lists properly and use real labelled elements. In design talks, give requirements, API, data, bottleneck, trade-offs.",
        "If you do not know, say so and reason from what you do know. Never invent a fact.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Walk me through how you would approach this problem before you write any code.\" Strong answer: restate it, clarify inputs and failure cases, list edge cases, state the plan and its cost, then code.",
        "\"What does this snippet print, and why?\" Strong answer: sync output first, then microtasks, then timers; each line comes with the rule that placed it there.",
        "\"What would you do with more time on this solution?\" Strong answer: concrete next steps such as cancellation, input validation, tests, types, or a faster algorithm, each with the reason.",
        "\"You are stuck. What do you do?\" Strong answer: say what is known, trace a smaller input, test an assumption, and ask a focused question; staying silent is the weak answer.",
        "\"How would you design a typeahead search?\" Strong answer: requirements first, then the API, the data and any caching or debouncing, the bottleneck, and the trade-offs, within a few minutes.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?
async function f() {
  console.log("a");
  await null;
  console.log("b");
}
f();
console.log("c");
setTimeout(() => console.log("d"), 0);`,
      options: ["a b c d", "a c b d", "a c d b", "c a b d"],
      answer: 1,
      why: "f runs synchronously until its await and prints a. The caller prints c. The code after await is a microtask, so b prints before the timer's d: a c b d.",
    },
    {
      kind: "quiz",
      question: "You are asked to write a debounce function. What is the best first move?",
      options: [
        "Start typing the closure and the timer straight away",
        "Restate the task, ask whether the first call should fire immediately or only after the pause, and name edge cases",
        "Say that you have memorised the library version",
        "Ask to skip it and move to a different question",
      ],
      answer: 1,
      why: "Clarifying shows you understand the requirement is ambiguous (leading or trailing call, arguments, this). It prevents a wrong build and gives the interviewer a view of your thinking.",
    },
    {
      kind: "quiz",
      question: `What does this print?
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}`,
      options: ["3 3 3", "0 1 2", "0 0 0", "undefined undefined undefined"],
      answer: 1,
      why: "let creates a fresh i for each loop iteration, so each callback keeps its own value. With var they would share one i and print 3 3 3.",
    },
  ],
};
