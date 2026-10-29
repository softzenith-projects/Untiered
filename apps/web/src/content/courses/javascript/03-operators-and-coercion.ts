import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterOperatorsAndCoercion: Chapter = {
  slug: "operators-and-coercion",
  title: "Operators, Equality and Type Coercion",
  summary: "How == and === differ, which values are falsy, when ?? and || give different answers, and the coercion puzzles interviewers love.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "JavaScript quietly converts values from one type to another when an operator needs it. That conversion is **type coercion**. It follows fixed rules, so the strange-looking puzzles on the internet are all explainable, and by the end of this chapter you will explain them instead of memorising them.",
    },
    {
      kind: "h",
      text: "The customs-counter analogy",
    },
    {
      kind: "analogy",
      title: "An airport currency counter",
      text: "At an airport exchange counter, you hand over dollars and ask for rupees. The clerk converts at a fixed rate before the deal goes through, whether you asked for it or not. `==` is that clerk: it converts both sides to a common currency first, then compares. `===` is a clerk who refuses to convert at all: dollars never equal rupees, whatever the amount. Where the analogy stops: a real counter has one rate card, but `==` has a fairly long rule list and applies different rules to different type pairs, which is exactly why it surprises people.",
    },
    {
      kind: "h",
      text: "== versus ===",
    },
    {
      kind: "compare",
      title: "Equality",
      columns: [
        {
          label: "=== (strict)",
          items: [
            "Different types are never equal.",
            "No conversion.",
            "`NaN === NaN` is false.",
            "The default in everyday code.",
          ],
        },
        {
          label: "== (loose)",
          items: [
            "Converts types by fixed rules before comparing.",
            "`null == undefined` is true and nothing else equals null.",
            "Mostly avoided, except `x == null`.",
          ],
        },
        {
          label: "Object.is",
          items: [
            "Like `===`, but `NaN` is the same as `NaN`.",
            "And `+0` is different from `-0`.",
            "Used by React to compare values.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `console.log(1 === "1");
console.log(1 == "1");
console.log(0 == false);
console.log("" == false);
console.log(null == undefined);
console.log(null === undefined);
console.log(null == 0);
console.log(NaN === NaN);
console.log(Object.is(NaN, NaN));
console.log(Object.is(0, -0));
console.log([] == false);`,
      caption: "Strict and loose equality on the same pairs. Read each result and then check the rule below.",
      output: `false
true
true
true
true
false
false
false
true
false
true`,
      tryIt: {
        language: "javascript",
        prompt: "Before running, predict `null == 0` and `[] == false`. Which of your predictions was wrong?",
      },
    },
    {
      kind: "p",
      text: "The rule behind `==`: if both sides are the same type, it behaves like `===`. `null` and `undefined` equal each other and nothing else, which is why `null == 0` is false even though `null >= 0` is true. If one side is a number and the other a string, the string becomes a number. A boolean becomes a number first (`true` is 1, `false` is 0). An object is converted to a primitive, and `[]` becomes `\"\"`, then `0`, which equals `false` after its own conversion to `0`.",
    },
    {
      kind: "h",
      text: "Truthy and falsy",
    },
    {
      kind: "concept",
      title: "The eight falsy values",
      text: "In a condition, every value is treated as true or false. Exactly these are **falsy**: `false`, `0`, `-0`, `0n`, `\"\"` (empty string), `null`, `undefined`, and `NaN`. Everything else is **truthy**, including `\"0\"`, `\"false\"`, `[]` and `{}`.",
    },
    {
      kind: "code",
      code: `const values = [0, "", "0", [], {}, null, undefined, NaN, -1, "false"];
for (const v of values) {
  console.log(String(typeof v === "object" ? JSON.stringify(v) : v).padEnd(10), Boolean(v));
}`,
      caption: "A quick sweep of what counts as false. Notice the empty array and the string \"0\".",
      output: `0          false
           false
0          true
[]         true
{}         true
null       false
undefined  false
NaN        false
-1         true
false      true`,
      tryIt: {
        language: "javascript",
        prompt: "Add `0n` and `new Boolean(false)` to the list. One of them surprises people.",
      },
    },
    {
      kind: "h",
      text: "|| versus ??",
    },
    {
      kind: "p",
      text: "`a || b` gives `b` whenever `a` is falsy. That is a bug when `0` or an empty string is a valid value. The **nullish coalescing** operator `a ?? b` gives `b` only when `a` is `null` or `undefined`. Optional chaining `a?.b` stops and gives `undefined` instead of throwing if `a` is null or undefined.",
    },
    {
      kind: "code",
      code: `const settings = { pageSize: 0, title: "", theme: null };

console.log(settings.pageSize || 10);
console.log(settings.pageSize ?? 10);
console.log(settings.title || "Untitled");
console.log(settings.title ?? "Untitled");
console.log(settings.theme ?? "light");

const user = { profile: null };
console.log(user.profile?.email);
console.log(user.profile?.email ?? "no email");
console.log(user.history?.[0]);`,
      caption: "A page-size setting where 0 is a legitimate value. || overrides it. ?? does not. Optional chaining guards a missing nested value.",
      output: `10
0
Untitled

light
undefined
no email
undefined`,
      tryIt: {
        language: "javascript",
        prompt: "Change `pageSize` to 25 and run. Then replace `?.` with `.` on line 10 and see the error message.",
      },
    },
    {
      kind: "h",
      text: "The puzzles",
    },
    {
      kind: "code",
      code: `console.log(1 + "2");
console.log("5" - 2);
console.log("5" * "2");
console.log(true + 1);
console.log([] + []);
console.log([] + {});
console.log(+"");
console.log(+"abc");
console.log(0.1 + 0.2 === 0.3);
console.log(typeof NaN);
console.log(NaN == NaN);
console.log("b" + "a" + +"a" + "a");`,
      caption: "The classic coercion puzzles. Each result follows from one rule: + prefers strings; every other arithmetic operator wants numbers.",
      output: `12
3
10
2

[object Object]
0
NaN
false
number
false
baNaNa`,
      tryIt: {
        language: "javascript",
        prompt: "Work out `[1] + [2]` and `\"3\" > \"12\"` on paper, then run them. The second compares text, not numbers.",
      },
    },
    {
      kind: "p",
      text: "Read the rules once. **`+`**: if either side is a string after converting objects to primitives, it joins text; otherwise it adds numbers. **`-`, `*`, `/`**: always numbers, so `\"5\" - 2` is 3. Unary `+` turns its operand into a number: `+\"\"` is 0 and `+\"abc\"` is `NaN`. `NaN` means \"not a number\" but its type is number, and it is not equal to anything, even itself. Test it with `Number.isNaN(x)`.",
    },
    {
      kind: "interview",
      items: [
        "What is the difference between `==` and `===`? A strong answer: `===` compares without conversion; `==` converts by defined rules. Mention that `x == null` is the one common intentional use because it catches both null and undefined.",
        "What does `[] + {}` give, and why? A strong answer walks through the conversion: both become strings (`\"\"` and `\"[object Object]\"`) and are joined.",
        "Why is `0.1 + 0.2 !== 0.3`? A strong answer: numbers are 64-bit binary floating point; 0.1 and 0.2 cannot be stored exactly. Compare with a tolerance.",
        "When would you use `??` instead of `||`? A strong answer: when 0, \"\" or false are valid values that must not be replaced by a default.",
        "How do you check for NaN? A strong answer: `Number.isNaN(x)` or `Object.is(x, NaN)`, because `NaN === NaN` is false.",
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Using `||` for defaults when `0` or `\"\"` is valid. Use `??`.",
        "Writing `if (x == NaN)`. It is always false. Use `Number.isNaN(x)`.",
        "Sorting or comparing numbers read from a form as strings: `\"10\" < \"9\"` is true. Convert with `Number(...)` first.",
        "Using the global `isNaN(\"abc\")`, which converts to a number first and returns true for text. Prefer `Number.isNaN`.",
        "Trusting truthiness of arrays and objects. `[]` is truthy; test `arr.length` instead.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

console.log("3" + 4 + 5);
console.log(3 + 4 + "5");`,
      options: ["\"345\" then \"75\"", "\"12\" then \"75\"", "\"345\" then \"345\"", "\"75\" then \"345\""],
      answer: 0,
      why: "Evaluation is left to right. In the first line, \"3\" + 4 is already text (\"34\"), then \"34\" + 5 is \"345\". In the second, 3 + 4 is the number 7, then 7 + \"5\" is \"75\".",
    },
    {
      kind: "quiz",
      question: "What does `null ?? \"x\" || \"y\"` evaluate to... or does it fail?",
      options: ["\"x\"", "\"y\"", "A SyntaxError", "null"],
      answer: 2,
      why: "Mixing `??` with `||` or `&&` without parentheses is a SyntaxError by design, so you must say which one groups first.",
    },
    {
      kind: "quiz",
      question: "Which expression is true?",
      options: ["`NaN == NaN`", "`null == undefined`", "`null == 0`", "`[] === []`"],
      answer: 1,
      why: "null and undefined equal each other under ==. NaN is never equal to itself. null does not equal 0 under ==. Two separate arrays are two different objects, so === is false.",
    },
    {
      kind: "remember",
      items: [
        "Prefer `===`. Use `== null` only on purpose, to catch both null and undefined.",
        "Exactly eight falsy values: false, 0, -0, 0n, \"\", null, undefined, NaN. `[]` and `{}` are truthy.",
        "`+` joins text if either side is a string; `-`, `*`, `/` always convert to numbers.",
        "`??` replaces only null or undefined; `||` replaces every falsy value. NaN is not equal to itself; test with `Number.isNaN`.",
      ],
    },
  ],
};
