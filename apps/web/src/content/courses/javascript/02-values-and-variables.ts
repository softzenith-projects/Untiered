import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterValuesAndVariables: Chapter = {
  slug: "values-and-variables",
  title: "Values, Types and Variables: let, const, var",
  summary: "The seven primitive types and objects, why typeof null is \"object\", what const really locks, and how let, const and var differ.",
  minutes: 16,
  blocks: [
    {
      kind: "p",
      text: "Every program is values moving through names. This chapter covers the kinds of value JavaScript has, the three ways to give a value a name, and the two facts that appear in nearly every first interview round: `typeof null` and what `const` actually protects.",
    },
    {
      kind: "h",
      text: "The labelled-box analogy",
    },
    {
      kind: "analogy",
      title: "Steel tiffin boxes and their labels",
      text: "A variable is not the food. It is a **label stuck on a tiffin box** that tells you which box to open. `let rice = 1` puts a sticker called `rice` on a box that holds the number 1. Writing `rice = 2` moves the sticker to a new box holding 2. `const` is a sticker glued on so firmly it cannot be peeled off and moved to another box. But if the box itself is a big container (an object), a `const` sticker does not stop you from changing what is inside it. Where the picture stops being true: real stickers can be on two boxes at once, while a JavaScript label always points at exactly one value at a time.",
    },
    {
      kind: "h",
      text: "The types",
    },
    {
      kind: "p",
      text: "There are **seven primitive types** and then objects. A primitive is a single, unchangeable value. An object is a collection you can change.",
    },
    {
      kind: "table",
      head: ["Type", "Example", "Note"],
      rows: [
        [
          "number",
          "`42`, `3.14`, `NaN`",
          "One type for integers and decimals; stored as a 64-bit float.",
        ],
        [
          "bigint",
          "`123n`",
          "Whole numbers of any size.",
        ],
        [
          "string",
          "`\"hi\"`, `'hi'`, `` `hi` ``",
          "Text. Strings are immutable.",
        ],
        ["boolean", "`true`, `false`", ""],
        [
          "undefined",
          "`undefined`",
          "A variable declared but not given a value.",
        ],
        [
          "null",
          "`null`",
          "A value that means \"nothing here, on purpose\".",
        ],
        [
          "symbol",
          "`Symbol(\"id\")`",
          "A unique key; used in advanced code.",
        ],
        [
          "object",
          "`{}`, `[]`, `function(){}`",
          "Arrays and functions are objects too.",
        ],
      ],
    },
    {
      kind: "code",
      code: `console.log(typeof 42);
console.log(typeof "hello");
console.log(typeof true);
console.log(typeof undefined);
console.log(typeof null);
console.log(typeof 10n);
console.log(typeof Symbol("id"));
console.log(typeof {});
console.log(typeof []);
console.log(typeof function () {});
console.log(Array.isArray([]));`,
      caption: "typeof on one of each. Every line here is a real answer from the language, including the odd one.",
      output: `number
string
boolean
undefined
object
bigint
symbol
object
object
function
true`,
      tryIt: {
        language: "javascript",
        prompt: "Predict each line first. Then add `typeof NaN` and `typeof new Date()` and check whether you were right.",
      },
    },
    {
      kind: "p",
      text: "Two answers stand out. `typeof null` gives `\"object\"`. That is a historical bug from the first version of the language, kept because fixing it would break old pages. It does **not** mean null is an object. And `typeof []` is `\"object\"` too, because arrays are objects, so use `Array.isArray` to tell an array from a plain object.",
    },
    {
      kind: "concept",
      title: "undefined vs null",
      text: "**`undefined`** is what the language gives you when a value is missing: a variable never set, a function that returns nothing, an object property that does not exist. **`null`** is what you write yourself to say \"nothing, deliberately\". Both are falsy, and `null == undefined` is true while `null === undefined` is false.",
    },
    {
      kind: "h",
      text: "let, const and var",
    },
    {
      kind: "compare",
      title: "Three ways to declare",
      columns: [
        {
          label: "const",
          items: [
            "Cannot be re-assigned.",
            "Must be given a value when declared.",
            "Block-scoped.",
            "Default choice.",
          ],
        },
        {
          label: "let",
          items: [
            "Can be re-assigned.",
            "Block-scoped: lives inside the nearest { }.",
            "Use when the value must change, like a loop counter.",
          ],
        },
        {
          label: "var",
          items: [
            "Function-scoped, ignores blocks.",
            "Declared names are set to undefined early.",
            "Can be redeclared. Avoid in new code.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `const user = { name: "Ravi", age: 20 };
user.age = 21;
console.log(user);

try {
  user = { name: "Meera", age: 22 };
} catch (e) {
  console.log(e.name);
}

const frozen = Object.freeze({ city: "Pune" });
frozen.city = "Delhi";
console.log(frozen.city);`,
      caption: "const protects the binding (the label), not the value inside. Changing the object's contents is allowed; moving the label is not. Node and Chrome word the error \"Assignment to constant variable.\"; Firefox and Safari phrase it differently, so the sample prints only its name.",
      output: `{ name: 'Ravi', age: 21 }
TypeError
Pune`,
      tryIt: {
        language: "javascript",
        prompt: "Add an array: `const list = [1, 2]; list.push(3);`. Does `const` stop that? Print `list` to check.",
      },
    },
    {
      kind: "p",
      text: "That is the answer to \"is const immutable?\": no. `const` makes the **binding** fixed, so the name cannot point somewhere else. `Object.freeze` stops changes to the object's own properties (shallowly), and in sloppy mode it silently ignores the write, as the last line shows.",
    },
    {
      kind: "h",
      text: "var is different",
    },
    {
      kind: "code",
      code: `if (true) {
  var a = "I leak out";
  let b = "I stay in";
}
console.log(a);
console.log(typeof b);

console.log(early);
var early = "now set";
console.log(early);`,
      caption: "var ignores blocks, so the variable declared inside an if is still visible outside. let does not.",
      output: `I leak out
undefined
undefined
now set`,
      tryIt: {
        language: "javascript",
        prompt: "Change `var a` to `let a` and run again. What happens, and why does it stop the program?",
      },
    },
    {
      kind: "p",
      text: "`typeof b` is `\"undefined\"` here because `b` does not exist outside the block, and `typeof` on a name that does not exist gives that safe answer instead of throwing. The `early` line shows `var` being **hoisted**: the name exists from the start of the scope, holding `undefined` until the assignment line runs. `let` and `const` are hoisted too, but untouchable until their line runs (the temporal dead zone). Chapter 9 explains this fully.",
    },
    {
      kind: "h",
      text: "Naming",
    },
    {
      kind: "list",
      items: [
        "Use `camelCase` for variables and functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for true constants.",
        "A name may contain letters, digits, `_` and `$`, and cannot start with a digit.",
        "Names are case-sensitive: `total` and `Total` are different.",
        "Reserved words such as `class`, `new` and `return` cannot be names.",
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Using `typeof x === \"object\"` to detect an object. It is also true for `null` and arrays. Check `x !== null` first, or use `Array.isArray` for arrays.",
        "Thinking `const arr = []` means arr can never change. It can still `push`. Use `const` for the label, not for the contents.",
        "Declaring with `var` inside a loop and being surprised the variable survives after the loop. Prefer `let`.",
        "Forgetting `const` or `let` entirely: `count = 5` can create an accidental global in sloppy mode. Always declare.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Seven primitives (number, bigint, string, boolean, undefined, null, symbol) plus objects. Arrays and functions are objects.",
        "`typeof null` is \"object\" by accident of history. Use `x === null` to test for null and `Array.isArray` for arrays.",
        "`const` fixes the binding, not the contents. Default to `const`, use `let` when you must re-assign, avoid `var`.",
        "`var` is function-scoped and starts as `undefined`; `let` and `const` are block-scoped and throw if used before their line.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Why does `typeof null` return \"object\"? A strong answer: it is a historical bug from the original implementation, kept for backwards compatibility. null is a primitive.",
        "Does `const` make a value immutable? A strong answer: no, it fixes the binding. The object it points to can still change; use `Object.freeze` (shallow) or copying for that.",
        "What is the difference between `var`, `let` and `const`? A strong answer covers scope (function vs block), re-assignment, hoisting with the temporal dead zone, and redeclaration.",
        "How do you check whether something is an array? A strong answer: `Array.isArray(x)`, because `typeof` returns \"object\" for arrays and for null.",
        "What is the difference between `null` and `undefined`? A strong answer: undefined is the language's \"no value yet\"; null is an intentional empty value.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

const nums = [1, 2];
nums.push(3);
console.log(nums.length);`,
      options: [
        "It throws a TypeError because nums is const",
        "2",
        "3",
        "undefined",
      ],
      answer: 2,
      why: "const only stops `nums = something else`. push changes the array's contents, which is allowed, so the length is 3.",
    },
    {
      kind: "quiz",
      question: "What does `console.log(typeof typeof 1)` print?",
      options: ["\"number\"", "\"string\"", "\"undefined\"", "\"object\""],
      answer: 1,
      why: "`typeof 1` is the string \"number\", and `typeof` of any string is \"string\". `typeof` always returns a string.",
    },
    {
      kind: "quiz",
      question: "Which statement about `typeof null` is correct?",
      options: [
        "It is \"null\", because null is its own type.",
        "It is \"object\", a long-standing quirk kept for compatibility.",
        "It is \"undefined\".",
        "It throws a TypeError.",
      ],
      answer: 1,
      why: "The answer \"object\" comes from an early implementation mistake. Fixing it would have broken existing websites.",
    },
  ],
};
