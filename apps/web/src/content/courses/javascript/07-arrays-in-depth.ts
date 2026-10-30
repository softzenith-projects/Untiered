import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterArraysInDepth: Chapter = {
  slug: "arrays-in-depth",
  title: "Arrays in Depth: map, filter, reduce and sort",
  summary: "The array methods interviews use every day, the sort comparator trap, which methods mutate and which do not, and what each costs.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "An **array** is an ordered list of values. Most real code is arrays being filtered, reshaped and summed. This chapter teaches the core methods in the order you reach for them, then the three places interviews catch people: `sort` without a comparator, methods that mutate, and the cost of each operation.",
    },
    {
      kind: "h",
      text: "The railway-compartment analogy",
    },
    {
      kind: "analogy",
      title: "A train with numbered seats",
      text: "A train coach has numbered seats from 0. You can ask \"who is in seat 3?\" instantly, because seats are in a fixed row. That is why reading `arr[3]` is fast. But if a passenger boards at seat 0, everyone else must shift one seat along; that is why `unshift` is slow on a long array. Where the analogy stops: JavaScript arrays can hold different kinds of value in neighbouring seats, and the coach can grow or shrink, which a real train cannot.",
    },
    {
      kind: "h",
      text: "Transforming without a loop",
    },
    {
      kind: "compare",
      title: "The workhorses",
      columns: [
        {
          label: "map / filter",
          items: [
            "`map(fn)` returns a new array of the same length.",
            "`filter(fn)` returns the items where `fn` is truthy.",
            "Neither changes the original.",
          ],
        },
        {
          label: "reduce",
          items: [
            "Folds an array into one value.",
            "Takes `(accumulator, item)` and an initial value.",
            "Always pass the initial value.",
          ],
        },
        {
          label: "find / some / every",
          items: [
            "`find` returns the first match, or undefined.",
            "`some` asks: is at least one true?",
            "`every` asks: are all true? Both stop early.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `const cart = [
  { item: "pen", price: 10, qty: 3 },
  { item: "book", price: 120, qty: 1 },
  { item: "bag", price: 450, qty: 1 },
];

const names = cart.map((c) => c.item);
const costly = cart.filter((c) => c.price > 100);
const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
console.log(names);
console.log(costly.length, total);
console.log(cart.find((c) => c.price > 1000));
console.log(cart.some((c) => c.qty > 2), cart.every((c) => c.price > 50));
console.log(cart.flatMap((c) => Array(c.qty).fill(c.item)));

const counts = ["a", "b", "a", "c", "a"].reduce((acc, ch) => {
  acc[ch] = (acc[ch] || 0) + 1;
  return acc;
}, {});
console.log(counts);`,
      caption: "map, filter, reduce, find, some, every and flatMap on a small cart.",
      output: `[ 'pen', 'book', 'bag' ]
2 600
undefined
true false
[ 'pen', 'pen', 'pen', 'book', 'bag' ]
{ a: 3, b: 1, c: 1 }`,
      tryIt: {
        language: "javascript",
        prompt: "Use `reduce` to find the item with the highest price, without sorting.",
      },
    },
    {
      kind: "viz",
      title: "How reduce folds an array",
      caption: "Each step combines the running total with the next item.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              {
                value: 10,
                pointers: ["next"],
                state: "active",
              },
              {
                value: 20,
              },
              {
                value: 30,
              },
            ],
            note: "Start: accumulator = 0 (the initial value). Take 10: 0 + 10 = 10.",
          },
          {
            cells: [
              {
                value: 10,
                state: "done",
              },
              {
                value: 20,
                pointers: ["next"],
                state: "active",
              },
              {
                value: 30,
              },
            ],
            note: "Accumulator = 10. Take 20: 10 + 20 = 30.",
          },
          {
            cells: [
              {
                value: 10,
                state: "done",
              },
              {
                value: 20,
                state: "done",
              },
              {
                value: 30,
                pointers: ["next"],
                state: "active",
              },
            ],
            note: "Accumulator = 30. Take 30: 30 + 30 = 60.",
          },
          {
            cells: [
              {
                value: 10,
                state: "done",
              },
              {
                value: 20,
                state: "done",
              },
              {
                value: 30,
                state: "done",
              },
            ],
            note: "No items left. reduce returns the final accumulator: 60.",
          },
        ],
      },
    },
    {
      kind: "h",
      text: "sort, and the trap in it",
    },
    {
      kind: "p",
      text: "Without a comparator, `sort` converts every item to a **string** and compares them as text. So `10` sorts before `9`. A comparator is a function `(a, b) => number`: negative means `a` first, positive means `b` first, zero means keep order. `sort` also **changes the array in place** and returns the same array.",
    },
    {
      kind: "code",
      code: `const nums = [10, 9, 1, 100, 25];
console.log([...nums].sort());
console.log([...nums].sort((a, b) => a - b));
console.log([...nums].sort((a, b) => b - a));

const people = [
  { name: "Zoya", age: 30 },
  { name: "Aman", age: 25 },
  { name: "Bela", age: 30 },
];
console.log(people.toSorted((a, b) => a.age - b.age || a.name.localeCompare(b.name)).map((p) => p.name));
console.log(people.map((p) => p.name));

const arr = [3, 1, 2];
const same = arr.sort();
console.log(same === arr, arr);`,
      caption: "Default sort versus a comparator, sort mutating its input, and the non-mutating toSorted.",
      output: `[ 1, 10, 100, 25, 9 ]
[ 1, 9, 10, 25, 100 ]
[ 100, 25, 10, 9, 1 ]
[ 'Aman', 'Bela', 'Zoya' ]
[ 'Zoya', 'Aman', 'Bela' ]
true [ 1, 2, 3 ]`,
      tryIt: {
        language: "javascript",
        prompt: "Sort the people by name, descending. Then try sorting `[\"b\", \"B\", \"a\"]` with and without `localeCompare`.",
      },
    },
    {
      kind: "h",
      text: "Mutating or not",
    },
    {
      kind: "table",
      head: ["Changes the original", "Returns a new array"],
      rows: [
        [
          "`push`, `pop`, `shift`, `unshift`",
          "`map`, `filter`, `slice`, `concat`",
        ],
        [
          "`splice`, `sort`, `reverse`, `fill`",
          "`toSorted`, `toReversed`, `toSpliced`, `with`",
        ],
      ],
    },
    {
      kind: "p",
      text: "The right column matters in React, where you must not change state in place. `toSorted`, `toReversed`, `toSpliced` and `with` were added in ES2023; they are available in current Node LTS releases and all current evergreen browsers, but check your target before using them in a library.",
    },
    {
      kind: "h",
      text: "Holes and the cost of each method",
    },
    {
      kind: "code",
      code: `const holey = [1, , 3];
console.log(holey.length, 1 in holey);
holey.forEach((x, i) => console.log("forEach", i, x));
console.log(Array.from(holey));
console.log(Array(3).fill(0), Array.from({ length: 3 }, (_, i) => i * i));
console.log([1, [2, [3, [4]]]].flat(Infinity));
console.log([3, 1, 2].includes(2), [3, 1, 2].indexOf(5));`,
      caption: "A hole is an empty slot, different from undefined. forEach skips it; Array.from does not.",
      output: `3 false
forEach 0 1
forEach 2 3
[ 1, undefined, 3 ]
[ 0, 0, 0 ] [ 0, 1, 4 ]
[ 1, 2, 3, 4 ]
true -1`,
      tryIt: {
        language: "javascript",
        prompt: "Predict `Array(3).map((_, i) => i)` and then run it. Why is the result surprising?",
      },
    },
    {
      kind: "table",
      head: ["Operation", "Cost", "Why"],
      rows: [
        [
          "`arr[i]`, `push`, `pop`",
          "O(1)",
          "Direct slot, or the end.",
        ],
        [
          "`shift`, `unshift`, `splice`",
          "O(n)",
          "Everything after the slot must move.",
        ],
        [
          "`indexOf`, `includes`, `find`",
          "O(n)",
          "May scan every item.",
        ],
        [
          "`map`, `filter`, `reduce`",
          "O(n)",
          "One pass.",
        ],
        ["`sort`", "O(n log n)", "Comparison sort."],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Sorting numbers without a comparator.",
        "Calling `reduce` on an empty array with no initial value: it throws a TypeError.",
        "Using `map` only for side effects, then ignoring the result. Use `forEach` or a `for...of`.",
        "Sorting React state in place. Copy first or use `toSorted`.",
        "Writing a comparator that returns a boolean (`a > b`). It must return a number.",
      ],
    },
    {
      kind: "remember",
      items: [
        "`map`, `filter` and `reduce` return new values and leave the original alone; always give `reduce` an initial value.",
        "`sort` without a comparator sorts as text and mutates in place. Use `(a, b) => a - b`, or `toSorted` to keep the original.",
        "Reading by index and `push`/`pop` are O(1); `shift`, `unshift`, `splice` and `indexOf` are O(n).",
        "Holes are not the same as undefined: `forEach` and `map` skip them, `Array.from` fills them.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Why does `[10, 9, 1].sort()` give `[1, 10, 9]`? A strong answer: no comparator means string comparison; use `(a, b) => a - b`.",
        "Which array methods mutate the original? A strong answer: push, pop, shift, unshift, splice, sort, reverse, fill; the ES2023 `toSorted` family is the non-mutating version.",
        "Implement `reduce` or `map` yourself. A strong answer handles the initial value and passes `(item, index, array)` to the callback.",
        "What is the difference between `map` and `forEach`? A strong answer: map returns a new array; forEach returns undefined and is for side effects.",
        "How would you remove duplicates from an array? A strong answer: `[...new Set(arr)]`, noting it uses SameValueZero comparison, so objects are only duplicates if they are the same object.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

console.log([1, 2, 3].map((x) => x * 2).filter((x) => x > 2));`,
      options: ["[2, 4, 6]", "[4, 6]", "[3]", "[6]"],
      answer: 1,
      why: "map doubles to [2, 4, 6]; filter keeps those greater than 2, leaving [4, 6].",
    },
    {
      kind: "quiz",
      question: "What does `[5, 25, 100, 1].sort()` return?",
      options: ["[1, 5, 25, 100]", "[1, 100, 25, 5]", "[100, 25, 5, 1]", "[5, 25, 100, 1]"],
      answer: 1,
      why: "As text, \"1\" < \"100\" < \"25\" < \"5\", giving [1, 100, 25, 5].",
    },
    {
      kind: "quiz",
      question: "Which method does NOT change the array it is called on?",
      options: ["`splice`", "`reverse`", "`slice`", "`push`"],
      answer: 2,
      why: "slice returns a copy of part of the array. The other three change the original.",
    },
  ],
};
