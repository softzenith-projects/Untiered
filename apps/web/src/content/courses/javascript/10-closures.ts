import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterClosures: Chapter = {
  slug: "closures",
  title: "Closures",
  summary: "How a function keeps the variables around it alive, how that gives you private state, why the old loop with setTimeout prints the same number, and where closures cause stale values and leaks.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "A **closure** is a function together with the scope it was created in. Every function in JavaScript is one. You only notice when a function outlives the call that made it and still reads the variables from there. This is the idea behind private state, callbacks, event handlers and React hooks, so interviewers probe it from every angle.",
    },
    {
      kind: "h",
      text: "The tiffin box analogy",
    },
    {
      kind: "analogy",
      title: "A tiffin that remembers your home",
      text: "A tiffin service packs your lunch at home and sends it to the office. When you open the box at your desk, the food is still the food from your kitchen, even though your kitchen is far away. A closure is the same: a function is packed with the variables from where it was written and carries them wherever it is sent. Where the analogy stops: the tiffin holds a copy of the food, but a closure holds the **variables themselves**, not copies. If the kitchen changes the variable later, the function sees the new value.",
    },
    {
      kind: "h",
      text: "Private state with a counter",
    },
    {
      kind: "code",
      code: `function makeCounter() {
  let count = 0;
  return {
    inc() {
      count += 1;
      return count;
    },
    get() {
      return count;
    },
  };
}

const a = makeCounter();
const b = makeCounter();
a.inc();
a.inc();
b.inc();
console.log(a.get(), b.get(), typeof a.count);`,
      caption: "Each call to makeCounter creates a fresh `count`. Only the two methods can reach it.",
      output: "2 1 undefined",
      tryIt: {
        language: "javascript",
        prompt: "Add a `reset()` method that sets `count` back to 0. Call it on `a` and print `a.get()`.",
      },
    },
    {
      kind: "concept",
      title: "Lexical environment",
      text: "When a function is created, it records the **lexical environment** it was written in: the scope chain from chapter 9. When it is called later, name lookup starts in its own scope and then follows that recorded chain, not the chain of whoever called it. \"Lexical\" means decided by where the code is written. `makeCounter` has returned, but its `count` is still reachable from `inc` and `get`, so the engine keeps it alive.",
    },
    {
      kind: "p",
      text: "This is how JavaScript gets private data without a keyword. Nothing outside can read `count`, because there is no property to read; there is only a variable inside a scope that nobody else holds a reference to.",
    },
    {
      kind: "h",
      text: "A closure holds the variable, not the value",
    },
    {
      kind: "code",
      code: `let x = 1;
const read = () => x;
x = 2;
console.log(read());

function render(count) {
  return () => "count was " + count;
}
let count = 0;
const first = render(count);
count = 5;
const second = render(count);
console.log(first(), "|", second());`,
      caption: "The first function sees the later assignment. The second pair shows a stale closure: `first` froze the count it was given.",
      output: `2
count was 0 | count was 5`,
      tryIt: {
        language: "javascript",
        prompt: "Call `first()` again after `count = 9` and predict whether it changes.",
      },
    },
    {
      kind: "p",
      text: "Both lines follow one rule. `read` captured the variable `x`, so it sees `2`. `first` captured the parameter `count` of one particular call of `render`, which was `0` and is never reassigned. Each call to `render` makes a new variable. A **stale closure** is a function that captured an old variable when you wanted a new one. It is the most common closure bug in React: an event handler created during one render keeps the state from that render.",
    },
    {
      kind: "h",
      text: "The classic loop with a timer",
    },
    {
      kind: "code",
      code: `for (var i = 1; i <= 3; i++) {
  setTimeout(() => console.log("var", i), i * 10);
}
for (let j = 1; j <= 3; j++) {
  setTimeout(() => console.log("let", j), 40 + j * 10);
}
for (var k = 1; k <= 3; k++) {
  ((n) => {
    setTimeout(() => console.log("iife", n), 70 + n * 10);
  })(k);
}`,
      caption: "Three loops, three fixes. Only the first is the bug.",
      output: `var 4
var 4
var 4
let 1
let 2
let 3
iife 1
iife 2
iife 3`,
      tryIt: {
        language: "javascript",
        prompt: "Fix the first loop without changing `var` to `let`, by passing `i` into a function the way the third loop does.",
      },
    },
    {
      kind: "steps",
      title: "Why the var loop prints 4 three times",
      steps: [
        { label: "One variable", text: "`var i` lives in the enclosing function (or module), so the whole loop shares one `i`." },
        { label: "Schedule", text: "Each pass creates an arrow function that reads `i` and hands it to `setTimeout`. Nothing is printed yet." },
        { label: "Loop ends", text: "`i` reaches 4, the condition fails, and the loop stops. The one shared `i` now holds 4." },
        { label: "Timers fire", text: "Each callback reads `i` at that moment and finds 4. The fix is a fresh variable per pass: `let`, or an immediately invoked function whose parameter `n` is new each time." },
      ],
    },
    {
      kind: "h",
      text: "Closures keep things alive",
    },
    {
      kind: "p",
      text: "A captured variable cannot be freed while any function that can reach it is reachable. That is usually what you want. It becomes a **memory leak** when a long-lived function (an event listener, a timer, a cache) accidentally holds a large object it no longer needs. Engines are allowed to free variables that no inner function uses, but you should not rely on exactly which ones.",
    },
    {
      kind: "code",
      code: `function attach(button) {
  const bigData = loadMillionRows();
  button.addEventListener("click", () => {
    console.log("clicked", bigData.length);
  });
}
// The listener keeps bigData alive for as long as the button and the listener exist.
// Fix: keep only what the handler needs, and remove the listener when done.
function attachSafely(button) {
  const rowCount = loadMillionRows().length;
  const onClick = () => console.log("clicked", rowCount);
  button.addEventListener("click", onClick);
  return () => button.removeEventListener("click", onClick);
}`,
      caption: "Browser code, shown for reading. It needs a real button, so it does not run here.",
    },
    {
      kind: "pitfall",
      items: [
        "Creating closures in a `var` loop and expecting each to remember its own `i`. Use `let`, or pass the value into a function.",
        "Assuming a closure copies the value. It shares the variable, so a later assignment changes what the function sees.",
        "Stale closures: a timer or handler created earlier still reads old values. Read the latest value through the variable, or re-create the function when the value changes.",
        "Keeping a large object alive from a long-lived listener. Capture only the small piece you need and remove listeners you add.",
        "Thinking you need a class for private data. A closure over a local variable is genuinely private; there is nothing to access.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A closure is a function plus the scope it was written in; every function is one, and it keeps the variables it uses alive.",
        "It holds the variable itself, not a copy of the value, so later assignments are visible to it.",
        "Each call of the outer function creates a fresh set of variables, which is why two counters never share state.",
        "Loop + timer: `var` shares one variable (prints the final value); `let` or an extra function gives one variable per iteration.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is a closure? A strong answer: a function bundled with the lexical environment where it was defined, so it can read and write those variables after the outer function has returned.",
        "What does `for (var i...) setTimeout(() => console.log(i))` print, and how do you fix it? A strong answer: the final value repeated, because one shared binding; fix with `let`, an IIFE, or `setTimeout`'s extra argument.",
        "How do you make private variables in JavaScript? A strong answer: a closure over a local variable (module pattern or factory), or a `#private` field in a class (chapter 13).",
        "What is a stale closure? A strong answer: a function that captured an earlier variable and keeps using it after the data moved on; common with timers and React effects.",
        "Can closures cause memory leaks? A strong answer: yes, if a long-lived function holds a reference to a large structure; release it by removing listeners and clearing timers.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

function outer() {
  let n = 0;
  return () => ++n;
}
const f = outer();
const g = outer();
f(); f();
console.log(f(), g());`,
      options: ["3 1", "3 3", "1 1", "3 4"],
      answer: 0,
      why: "Each call to outer creates its own n. f increments its n three times, so the third call gives 3. g has its own n, so its first call gives 1.",
    },
    {
      kind: "quiz",
      question: `What does this print?

let v = "a";
const show = () => v;
v = "b";
console.log(show());`,
      options: ["a", "b", "undefined", "It throws"],
      answer: 1,
      why: "show closes over the variable v, not the string \"a\". When show runs, v currently holds \"b\".",
    },
    {
      kind: "quiz",
      question: `Which change makes the loop log 0, 1, 2 using var?

for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}`,
      options: [
        "Increase the delay from 0 to 1000 milliseconds, giving the loop time.",
        "Wrap setTimeout in a function taking i as a parameter.",
        "Move the var declaration inside the callback function body.",
        "Replace the arrow function with a regular function call.",
      ],
      answer: 1,
      why: "A function parameter is a new variable on every call, so each callback gets its own copy of that pass's i. A longer delay only makes all callbacks read the final i later, and a regular function captures the same shared variable.",
    },
  ],
};
