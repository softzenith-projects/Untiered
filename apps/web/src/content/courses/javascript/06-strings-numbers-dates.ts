import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterStringsNumbersDates: Chapter = {
  slug: "strings-numbers-dates",
  title: "Strings, Numbers and Dates",
  summary: "Template literals and string methods, why 0.1 + 0.2 is not 0.3, converting to numbers safely, BigInt, and the Date traps that cause real bugs.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "Text, numbers and time are in nearly every program, and each has a trap. Strings are immutable. Numbers are binary floating point. Dates count months from zero. Knowing the three traps is what separates a careful answer from a lucky one.",
    },
    {
      kind: "h",
      text: "The weighing-scale analogy",
    },
    {
      kind: "analogy",
      title: "A kirana shop's digital scale",
      text: "A kirana shop's scale shows grams to one decimal place. It can never show exactly one third of a kilo: it rounds. A computer's number works the same way, with a twist. It stores values in **binary**, and `0.1` has no exact binary form, just as one third has no exact decimal form. So `0.1 + 0.2` gives `0.30000000000000004`, a tiny rounding error that the language is not hiding from you. Where the analogy stops: the shop scale rounds in decimal, while a computer rounds in binary, so the numbers that look \"nice\" to us (like 0.1) are exactly the ones that are not nice to it.",
    },
    {
      kind: "h",
      text: "Strings",
    },
    {
      kind: "code",
      code: `const name = "Ananya";
const city = 'Pune';
console.log(\`\${name} lives in \${city}. 2 + 3 = \${2 + 3}\`);

console.log(name.length, name[0], name.at(-1));
console.log(name.toUpperCase(), name.slice(1, 4), name.indexOf("n"));
console.log(name.includes("any"), name.startsWith("An"));
console.log("  padded ".trim() + "|");
console.log("a-b-c".split("-"), ["x", "y"].join("+"));
console.log("ha".repeat(3), "7".padStart(3, "0"));
console.log("one two one".replaceAll("one", "1"));

name[0] = "Z";
console.log(name);`,
      caption: "Template literals, indexing, and the common methods. A string never changes in place: every method returns a new string.",
      output: `Ananya lives in Pune. 2 + 3 = 5
6 A a
ANANYA nan 1
true true
padded|
[ 'a', 'b', 'c' ] x+y
hahaha 007
1 two 1
Ananya`,
      tryIt: {
        language: "javascript",
        prompt: "Reverse a string using `split(\"\")`, `reverse()` and `join(\"\")`. Does it work for \"hello\"?",
      },
    },
    {
      kind: "p",
      text: "The line `name[0] = \"Z\"` does nothing and does not throw, because strings are immutable. Also remember `slice(start, end)` stops **before** `end`, and `at(-1)` counts from the back.",
    },
    {
      kind: "h",
      text: "Numbers",
    },
    {
      kind: "concept",
      title: "One number type",
      text: "JavaScript has one ordinary number type, a 64-bit binary floating-point value (IEEE 754). Integers are exact up to `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991). Beyond that, neighbouring integers collapse into the same value. `NaN`, `Infinity` and `-Infinity` are numbers too.",
    },
    {
      kind: "code",
      code: `console.log(0.1 + 0.2);
console.log(0.1 + 0.2 === 0.3);
console.log(Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON);
console.log((0.1 + 0.2).toFixed(2), typeof (0.1 + 0.2).toFixed(2));
console.log(Math.round(1.005 * 100) / 100);

console.log(Number.MAX_SAFE_INTEGER);
console.log(Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2);
console.log(9007199254740993n + 1n);

console.log(1 / 0, -1 / 0, 0 / 0);
console.log(5 % 3, -5 % 3, 2 ** 10);`,
      caption: "The famous rounding error, how to compare safely, and the edge of exact integers.",
      output: `0.30000000000000004
false
true
0.30 string
1
9007199254740991
true
9007199254740994n
Infinity -Infinity NaN
2 -2 1024`,
      tryIt: {
        language: "javascript",
        prompt: "Work in paise: compute 10 + 20 paise as integers and divide by 100 only when printing. Why is that safer?",
      },
    },
    {
      kind: "p",
      text: "For money, store the smallest unit (paise or cents) as an integer, or use a decimal library. For comparisons, check that the difference is smaller than a tolerance. `BigInt` (the `n` suffix) holds whole numbers of any size, but it cannot be mixed with ordinary numbers in one expression: `1n + 1` throws a TypeError.",
    },
    {
      kind: "h",
      text: "Turning text into numbers",
    },
    {
      kind: "code",
      code: `console.log(Number("42"), Number("  42  "), Number("4x2"), Number(""));
console.log(parseInt("42px", 10), parseInt("px42", 10), parseFloat("3.14abc"));
console.log(Number(null), Number(undefined), Number(true));
console.log(parseInt("0.0000005"), parseInt(0.0000005));
console.log(["1", "2", "3"].map(parseInt));
console.log(["1", "2", "3"].map(Number));
console.log((255).toString(16), (255).toString(2));
console.log(Number.isInteger(5.0), Number.isFinite("5"));`,
      caption: "Number() is strict; parseInt() reads as much as it can. Always pass the radix to parseInt.",
      output: `42 42 NaN 0
42 NaN 3.14
0 NaN 1
0 5
[ 1, NaN, NaN ]
[ 1, 2, 3 ]
ff 11111111
true false`,
      tryIt: {
        language: "javascript",
        prompt: "Why does `[\"1\", \"2\", \"3\"].map(parseInt)` give `[1, NaN, NaN]`? Hint: what is map's second argument?",
      },
    },
    {
      kind: "p",
      text: "`map` passes `(value, index, array)`, and `parseInt` reads the second argument as the radix. So the calls are `parseInt(\"1\", 0)`, `parseInt(\"2\", 1)` and `parseInt(\"3\", 2)`; the last two are invalid bases. This is one of the most repeated interview puzzles.",
    },
    {
      kind: "h",
      text: "Dates",
    },
    {
      kind: "code",
      code: `const d = new Date(Date.UTC(2026, 0, 15, 10, 30));
console.log(d.toISOString());
console.log(d.getTime());
console.log(d.getUTCMonth(), d.getUTCDate(), d.getUTCDay());

const next = new Date(d);
next.setUTCDate(next.getUTCDate() + 20);
console.log(next.toISOString());

console.log(new Date("not a date").getTime());
console.log(new Date(0).toISOString());
console.log(new Intl.NumberFormat("en-IN").format(1234567.891));
console.log(new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "long" }).format(d));`,
      caption: "A Date counts milliseconds since 1 January 1970 UTC. Months start at 0. We use fixed values and UTC methods so the output does not depend on the machine's clock or time zone.",
      output: `2026-01-15T10:30:00.000Z
1768473000000
0 15 4
2026-02-04T10:30:00.000Z
NaN
1970-01-01T00:00:00.000Z
12,34,567.891
15 January 2026`,
      tryIt: {
        language: "javascript",
        prompt: "Add `d.getUTCFullYear()` and a line that works out how many days remain until 31 December 2026.",
      },
    },
    {
      kind: "p",
      text: "Three Date traps. Months run from **0 to 11**, so `new Date(2026, 0, 15)` is January. Dates are **mutable**, so `setUTCDate` changes the object, and you should copy before changing. And `new Date(\"2026-01-15\")` (date only) is read as UTC, while `new Date(\"2026-01-15T10:00\")` is read in the local time zone, so the same day can shift by a day in some zones. Use `Intl` for formatting, and a library such as date-fns for heavy date work until the Temporal API is available in all your target environments (check current support before depending on it).",
    },
    {
      kind: "pitfall",
      items: [
        "Comparing floats with `===`. Use a tolerance, or integers.",
        "Using `toFixed` and then doing arithmetic: it returns a string.",
        "Calling `parseInt` without a radix, or passing it directly to `map`.",
        "Using `new Date(2026, 1, 15)` and expecting January. Months are zero-based.",
        "Treating `\"5\" + 1` as 6. The string wins, giving \"51\". Convert first with `Number`.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Numbers are 64-bit binary floats: `0.1 + 0.2` is `0.30000000000000004`. Compare with a tolerance and keep money as integers.",
        "Strings are immutable: methods return new strings. `slice(a, b)` excludes `b`.",
        "`Number()` is strict, `parseInt(text, 10)` reads a prefix, and `map(parseInt)` is a trap because of the radix.",
        "Dates have zero-based months, are mutable, and parse date-only strings as UTC. Format with `Intl`.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Why does `0.1 + 0.2` not equal `0.3`? A strong answer: IEEE 754 binary floating point cannot represent 0.1 or 0.2 exactly; compare with a tolerance or use integers for money.",
        "What is the largest safe integer, and what is BigInt for? A strong answer: 2^53 - 1; BigInt holds arbitrary-size integers and cannot be mixed with numbers.",
        "Why does `[\"1\", \"2\", \"3\"].map(parseInt)` return `[1, NaN, NaN]`? A strong answer: map passes the index as the second argument, which parseInt treats as the radix.",
        "How do you handle money in JavaScript? A strong answer: integers in the smallest unit, or a decimal library, and `Intl.NumberFormat` for display.",
        "What are common Date pitfalls? A strong answer: zero-based months, mutability, ambiguous parsing of date-only strings, and time zones.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

console.log("abc".slice(1, 2), "abc".at(-1));`,
      options: ["\"bc\" \"c\"", "\"b\" \"c\"", "\"b\" \"b\"", "\"ab\" \"a\""],
      answer: 1,
      why: "slice(1, 2) starts at index 1 and stops before index 2, giving \"b\". at(-1) is the last character, \"c\".",
    },
    {
      kind: "quiz",
      question: "Which line throws a TypeError?",
      options: ["`10n + 5n`", "`10n * 2n`", "`10n + 5`", "`BigInt(10) + 5n`"],
      answer: 2,
      why: "BigInt and Number cannot be mixed in arithmetic. Convert one side explicitly.",
    },
    {
      kind: "quiz",
      question: "`new Date(2026, 11, 25)` is which month?",
      options: ["November", "December", "January", "It is invalid"],
      answer: 1,
      why: "Months are zero-based, so 11 is December.",
    },
  ],
};
