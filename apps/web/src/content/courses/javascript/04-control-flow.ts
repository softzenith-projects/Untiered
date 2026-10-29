import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterControlFlow: Chapter = {
  slug: "control-flow",
  title: "Control Flow: Decisions and Loops",
  summary: "if, switch, the loops, and the difference between for...of and for...in, with break, continue, labels and how to avoid an infinite loop.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text: "Code normally runs top to bottom. **Control flow** lets it choose a path (`if`, `switch`) or repeat (`for`, `while`). This chapter is short on theory and long on small programs, because loops are learned by tracing them.",
    },
    {
      kind: "h",
      text: "The railway-ticket queue analogy",
    },
    {
      kind: "analogy",
      title: "A booking window at a railway station",
      text: "At the booking window, the clerk asks the same questions of each person in the line: \"Which train? Which class? Is there a seat?\" The checks are `if`. Serving the line is a loop: take the next person, serve them, repeat until the line is empty. `break` is the clerk closing the window for the day. `continue` is skipping a person whose form is wrong and calling the next. Where the analogy stops: a real line can grow while you serve it, and so can an array you loop over, which is a classic source of bugs.",
    },
    {
      kind: "h",
      text: "Making decisions",
    },
    {
      kind: "code",
      code: `function grade(score) {
  if (score >= 90) return "A";
  else if (score >= 75) return "B";
  else if (score >= 50) return "C";
  return "F";
}
console.log(grade(95), grade(80), grade(50), grade(10));

function dayType(day) {
  switch (day) {
    case "Sat":
    case "Sun":
      return "weekend";
    case "Fri":
      console.log("almost there");
    default:
      return "weekday";
  }
}
console.log(dayType("Sun"));
console.log(dayType("Fri"));
console.log(dayType("Mon"));
console.log(5 > 3 ? "yes" : "no");`,
      caption: "if / else if / else, and switch. A switch compares with === and falls through to the next case unless you break.",
      output: `A B C F
weekend
almost there
weekday
weekday
yes`,
      tryIt: {
        language: "javascript",
        prompt: "Remove the `return` after the `Fri` case's log and predict what `dayType(\"Fri\")` returns now.",
      },
    },
    {
      kind: "p",
      text: "The `Fri` case has no `break` or `return`, so execution **falls through** into `default`. Fall-through is sometimes useful (the stacked `Sat` and `Sun` cases share one body), but forgetting `break` is a common bug, so always know which you meant.",
    },
    {
      kind: "h",
      text: "Repeating work",
    },
    {
      kind: "compare",
      title: "Choosing a loop",
      columns: [
        {
          label: "for",
          items: [
            "You know the count or need the index.",
            "`for (let i = 0; i < n; i++)`.",
            "Declaring `i` with `let` gives each pass its own copy.",
          ],
        },
        {
          label: "while / do...while",
          items: [
            "Repeat until a condition changes.",
            "`do...while` always runs at least once.",
            "Make sure something inside changes the condition.",
          ],
        },
        {
          label: "for...of",
          items: [
            "Loops over the **values** of an iterable: arrays, strings, Map, Set.",
            "Works with `break`, `continue` and `await`.",
            "The default for arrays.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `for (let i = 0; i < 3; i++) console.log("i =", i);

let n = 3;
while (n > 0) {
  console.log("countdown", n);
  n--;
}

const colours = ["red", "green", "blue"];
for (const c of colours) console.log("of:", c);
for (const k in colours) console.log("in:", k, typeof k);

for (const ch of "hi") console.log(ch);`,
      caption: "for, while, and the two loops over a collection. for...of gives values, for...in gives keys (as strings).",
      output: `i = 0
i = 1
i = 2
countdown 3
countdown 2
countdown 1
of: red
of: green
of: blue
in: 0 string
in: 1 string
in: 2 string
h
i`,
      tryIt: {
        language: "javascript",
        prompt: "Change the array to `[\"a\", \"b\"]` and add `colours.extra = 1` before the loops. Which loop sees `extra`?",
      },
    },
    {
      kind: "concept",
      title: "for...of vs for...in",
      text: "**`for...of`** walks the values an iterable produces. **`for...in`** walks the enumerable property names of an object, including ones inherited through the prototype chain, and gives them as strings. Use `for...of` for arrays. Use `for...in` only for plain objects when you need the keys, or better, use `Object.keys(obj)` or `Object.entries(obj)`.",
    },
    {
      kind: "h",
      text: "break, continue and labels",
    },
    {
      kind: "code",
      code: `for (let i = 1; i <= 6; i++) {
  if (i === 2) continue;
  if (i === 5) break;
  console.log("i", i);
}

outer: for (let r = 1; r <= 3; r++) {
  for (let c = 1; c <= 3; c++) {
    if (r * c === 4) break outer;
    console.log(r + "x" + c);
  }
}
console.log("done");`,
      caption: "break leaves a loop, continue skips to the next pass, and a label lets break leave an outer loop from inside an inner one.",
      output: `i 1
i 3
i 4
1x1
1x2
1x3
2x1
done`,
      tryIt: {
        language: "javascript",
        prompt: "Change `break outer` to a plain `break`. How many more lines does it print, and why?",
      },
    },
    {
      kind: "viz",
      title: "Tracing the loop",
      caption: "Watch the counter change on each pass; the loop stops the moment the test fails.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              {
                value: 0,
                pointers: ["i"],
                state: "active",
              },
              {
                value: 1,
              },
              {
                value: 2,
              },
              {
                value: 3,
              },
            ],
            note: "i = 0. The test 0 < 3 is true, so the body runs.",
          },
          {
            cells: [
              {
                value: 0,
                state: "done",
              },
              {
                value: 1,
                pointers: ["i"],
                state: "active",
              },
              {
                value: 2,
              },
              {
                value: 3,
              },
            ],
            note: "i++ makes i = 1. 1 < 3 is true, so the body runs again.",
          },
          {
            cells: [
              {
                value: 0,
                state: "done",
              },
              {
                value: 1,
                state: "done",
              },
              {
                value: 2,
                pointers: ["i"],
                state: "active",
              },
              {
                value: 3,
              },
            ],
            note: "i = 2. 2 < 3, so the body runs a third time.",
          },
          {
            cells: [
              {
                value: 0,
                state: "done",
              },
              {
                value: 1,
                state: "done",
              },
              {
                value: 2,
                state: "done",
              },
              {
                value: 3,
                pointers: ["i"],
                state: "compare",
              },
            ],
            note: "i = 3. The test 3 < 3 is false, so the loop ends without running the body.",
          },
        ],
      },
    },
    {
      kind: "interview",
      items: [
        "What is the difference between `for...in` and `for...of`? A strong answer: keys (including inherited, as strings) versus values of an iterable. Do not use for...in on arrays.",
        "How do you stop a `forEach` early? A strong answer: you cannot with `break`; use a `for...of` loop, or `some` / `every`.",
        "Why does `for (var i...)` with a `setTimeout` inside print the same number? A strong answer: var is function-scoped, so all callbacks share one `i`. `let` creates a fresh `i` per pass. (Chapter 10 covers this in detail.)",
        "What is fall-through in a switch? A strong answer: without `break`, execution continues into the next case; it is deliberate for stacked cases and a bug otherwise.",
        "How can you leave two nested loops at once? A strong answer: a label with `break label`, or refactor into a function and `return`.",
      ],
    },
    {
      kind: "pitfall",
      items: [
        "An infinite loop: `while (n > 0)` with no `n--`. Check that something inside the loop moves the condition toward false.",
        "Off-by-one errors: `i <= arr.length` reads one past the end. Use `i < arr.length`.",
        "Using `for...in` on an array and getting indexes as strings (`\"0\"`, `\"1\"`), and sometimes extra properties. Use `for...of`.",
        "Forgetting `break` in a `switch` and running several cases.",
        "Changing the array while looping over it with an index: elements are skipped. Loop over a copy, or build a new array.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

for (let i = 0; i < 5; i++) {
  if (i % 2 === 0) continue;
  console.log(i);
}`,
      options: ["0 2 4", "1 3", "1 2 3 4", "0 1 2 3 4"],
      answer: 1,
      why: "continue skips the rest of the body when i is even, so only the odd values 1 and 3 are logged.",
    },
    {
      kind: "quiz",
      question: "Which loop gives you the values of an array directly?",
      options: ["`for (const x in arr)`", "`for (const x of arr)`", "`for (const x = arr)`", "`while (x of arr)`"],
      answer: 1,
      why: "for...of yields each element. for...in yields the keys (as strings).",
    },
    {
      kind: "quiz",
      question: "A `do...while` loop's condition is false from the start. How many times does the body run?",
      options: ["0", "1", "Forever", "It is a SyntaxError"],
      answer: 1,
      why: "do...while checks the condition after the body, so the body always runs at least once.",
    },
    {
      kind: "remember",
      items: [
        "`for...of` gives values of an iterable; `for...in` gives enumerable keys as strings. Prefer `for...of` for arrays.",
        "A `switch` uses `===` and falls through without `break`. Stack cases on purpose or add `break`.",
        "`break` leaves the loop, `continue` skips to the next pass, and a label lets `break` leave an outer loop.",
        "Every loop needs something that changes its condition. If a page freezes, look for the loop first.",
      ],
    },
  ],
};
