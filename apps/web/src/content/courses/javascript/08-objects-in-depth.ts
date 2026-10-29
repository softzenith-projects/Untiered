import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterObjectsInDepth: Chapter = {
  slug: "objects-in-depth",
  title: "Objects in Depth: Copying, Destructuring, Map and JSON",
  summary: "Object literals and destructuring, shallow versus deep copy, references and pass-by-value, Map, Set and WeakMap, and what JSON can and cannot hold.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "An **object** is a bag of named values. Almost everything in JavaScript that is not a primitive is one. The central idea of this chapter is that a variable holding an object holds a **reference**, an address, not the object itself. Once you see that, shallow versus deep copy, and the \"pass by reference\" myth, stop being mysterious.",
    },
    {
      kind: "h",
      text: "The house-address analogy",
    },
    {
      kind: "analogy",
      title: "A house and the paper with its address",
      text: "Imagine a house, and a slip of paper with its address. Photocopy the slip, and you now have two slips pointing to the **same house**. If a friend repaints the house, both slip-holders see it. That is what `const b = a` does for objects: it copies the slip, not the house. A real copy needs a second house built. Where the analogy stops: a **shallow** copy builds a second house but gives it the same furniture addresses, so a cupboard inside is still shared. A **deep** copy duplicates the furniture too.",
    },
    {
      kind: "h",
      text: "Literals, shorthand and computed keys",
    },
    {
      kind: "code",
      code: `const id = 7;
const field = "email";
const user = {
  id,
  name: "Kavya",
  [field]: "kavya@example.com",
  greet() {
    return "Hi, " + this.name;
  },
};
console.log(user);
console.log(user.greet());
console.log(Object.keys(user), Object.values(user).length);
console.log(Object.entries({ a: 1, b: 2 }));
console.log(Object.fromEntries([["x", 1], ["y", 2]]));
console.log("name" in user, user.hasOwnProperty("zip"), user.zip);
delete user.email;
console.log(Object.keys(user));`,
      caption: "Object literal features: shorthand, computed keys, methods, and the Object.* helpers.",
      output: `{
  id: 7,
  name: 'Kavya',
  email: 'kavya@example.com',
  greet: [Function: greet]
}
Hi, Kavya
[ 'id', 'name', 'email', 'greet' ] 4
[ [ 'a', 1 ], [ 'b', 2 ] ]
{ x: 1, y: 2 }
true false undefined
[ 'id', 'name', 'greet' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Use `Object.entries` and `Object.fromEntries` to double every value of `{ a: 1, b: 2, c: 3 }`.",
      },
    },
    {
      kind: "h",
      text: "Destructuring and spread",
    },
    {
      kind: "code",
      code: `const order = { id: 91, customer: { name: "Dev", city: "Delhi" }, items: ["tea", "toast", "jam"] };

const { id, customer: { city }, tip = 10 } = order;
console.log(id, city, tip);
const { id: orderId, ...rest } = order;
console.log(orderId, Object.keys(rest));

const [first, , third = "none", ...others] = order.items;
console.log(first, third, others);

let a = 1, b = 2;
[a, b] = [b, a];
console.log(a, b);

const updated = { ...order, id: 92, extra: true };
console.log(updated.id, order.id, updated.extra);
function describe({ name, age = 18 } = {}) {
  return name + ":" + age;
}
console.log(describe({ name: "Ira" }), describe({ name: "Om", age: 5 }));`,
      caption: "Pull values out with destructuring (with defaults and renaming), and build new objects and arrays with spread.",
      output: `91 Delhi 10
91 [ 'customer', 'items' ]
tea jam []
2 1
92 91 true
Ira:18 Om:5`,
      tryIt: {
        language: "javascript",
        prompt: "Destructure `{ x: { y } }` from `{ x: null }` and read the error. How would `?.` help?",
      },
    },
    {
      kind: "h",
      text: "References: the part interviews probe",
    },
    {
      kind: "concept",
      title: "JavaScript is always pass-by-value",
      text: "Every argument is copied into the parameter. For an object, **the value that is copied is the reference**. So a function can change the object it was given (the caller sees that), but re-assigning the parameter to a new object does not affect the caller, because only the local copy of the reference moved.",
    },
    {
      kind: "code",
      code: `const a = { n: 1 };
const b = a;
b.n = 99;
console.log(a.n, a === b, { n: 1 } === { n: 1 });

function change(obj) {
  obj.n = 5;
}
function replace(obj) {
  obj = { n: 100 };
}
const c = { n: 0 };
change(c);
console.log(c.n);
replace(c);
console.log(c.n);`,
      caption: "The same object seen through two names, a function that changes it, and a function that merely re-points its own parameter.",
      output: `99 true false
5
5`,
      tryIt: {
        language: "javascript",
        prompt: "Add a function `reset(obj)` that sets `obj.n = 0` and one that does `obj = null`. Predict `c` after each.",
      },
    },
    {
      kind: "h",
      text: "Shallow versus deep copy",
    },
    {
      kind: "code",
      code: `const original = { name: "Lata", tags: ["a", "b"], address: { city: "Goa" } };

const shallow = { ...original };
shallow.name = "Changed";
shallow.address.city = "Mumbai";
console.log(original.name, original.address.city);

const viaJson = JSON.parse(JSON.stringify({ d: new Date(0), u: undefined, f() {}, n: NaN, big: 1 }));
console.log(viaJson);

const copy = JSON.parse(JSON.stringify(original));
copy.tags.push("c");
console.log(original.tags, copy.tags);`,
      caption: "Spread copies the top level only, so the nested object is still shared. The JSON round trip copies deeply, but changes the data.",
      output: `Lata Mumbai
{ d: '1970-01-01T00:00:00.000Z', n: null, big: 1 }
[ 'a', 'b' ] [ 'a', 'b', 'c' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Add a second nested level and check which copy method keeps the original safe. Add a Date and see what the JSON copy turns it into.",
      },
    },
    {
      kind: "code",
      code: `const original = { name: "Lata", tags: ["a", "b"], address: { city: "Goa" }, when: new Date(0) };
original.self = original;

const deep = structuredClone(original);
deep.address.city = "Chennai";
deep.tags.push("c");
console.log(original.address.city, original.tags);
console.log(deep.when instanceof Date, deep.self === deep);

try {
  structuredClone({ f() {} });
} catch (e) {
  console.log(e.name);
}`,
      caption: "structuredClone, the proper deep copy. It is real JavaScript, but this course's in-browser runner does not provide it, so the output shown comes from running the code under Node.",
      output: `Goa [ 'a', 'b' ]
true true
DataCloneError`,
    },
    {
      kind: "p",
      text: "`structuredClone` (available in all current browsers and in Node 17+) copies nested objects, arrays, Dates, Maps, Sets and even circular references, but it throws on functions. The `JSON.parse(JSON.stringify(x))` trick is shorter but changes data: the Date became a string, `undefined` and the function vanished, and `NaN` became `null`. It throws on a circular reference.",
    },
    {
      kind: "h",
      text: "Map, Set and WeakMap",
    },
    {
      kind: "code",
      code: `const m = new Map();
const keyObj = { k: 1 };
m.set("a", 1).set(keyObj, "object key").set(2, "number key");
console.log(m.get(keyObj), m.get({ k: 1 }), m.size);
for (const [k, v] of m) console.log(typeof k, v);

const s = new Set([3, 1, 3, 2, 1]);
console.log(s, s.has(2), [...s]);

const plain = { 1: "one", "1": "still one" };
console.log(plain, Object.keys(plain));

const cache = new WeakMap();
cache.set(keyObj, "metadata");
console.log(cache.has(keyObj), typeof cache.size);`,
      caption: "Map keeps insertion order and accepts any key; Set stores unique values; WeakMap holds its keys weakly so they can be garbage collected.",
      output: `object key undefined 3
string 1
object object key
number number key
Set(3) { 3, 1, 2 } true [ 3, 1, 2 ]
{ '1': 'still one' } [ '1' ]
true undefined`,
      tryIt: {
        language: "javascript",
        prompt: "Count how many times each word appears in `\"to be or not to be\"` using a Map.",
      },
    },
    {
      kind: "compare",
      title: "Object vs Map",
      columns: [
        {
          label: "Plain object",
          items: [
            "Keys are strings or symbols.",
            "Has inherited keys like `toString`.",
            "Easy to write as JSON.",
          ],
        },
        {
          label: "Map",
          items: [
            "Any value can be a key.",
            "Keeps insertion order and has `.size`.",
            "Better for frequent adds and removes, and for counting.",
          ],
        },
      ],
    },
    {
      kind: "h",
      text: "JSON in one minute",
    },
    {
      kind: "p",
      text: "JSON is text with a strict format: double-quoted keys and strings, no comments, no trailing commas, and only strings, numbers, booleans, null, arrays and objects. `JSON.stringify` skips `undefined`, functions and symbols inside objects, and turns a Date into an ISO string. `JSON.parse` of bad text throws a `SyntaxError`, so wrap it in `try/catch` when the text comes from outside.",
    },
    {
      kind: "interview",
      items: [
        "Is JavaScript pass-by-value or pass-by-reference? A strong answer: always by value; for objects, the value is a reference, so mutation is visible to the caller but re-assignment is not.",
        "How do you deep-copy an object? A strong answer: `structuredClone` first; mention that JSON round-tripping loses Dates, undefined, functions and fails on cycles; and that spread is shallow.",
        "What is the difference between `Map` and an object? A strong answer: key types, order, size, no inherited keys, and performance for frequent changes.",
        "What is a WeakMap used for? A strong answer: attaching data to an object without preventing its garbage collection, such as private data or caches.",
        "What does `const` do to an object? A strong answer: stops re-binding; contents can still change. Use `Object.freeze` (shallow) for read-only data.",
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Copying an object with `=` and expecting a new one. Both names point to the same object.",
        "Using spread for a nested object and mutating the inner part: the original changes too.",
        "Relying on `JSON.parse(JSON.stringify(x))` for data with Dates, undefined, Maps or cycles.",
        "Comparing two objects with `===` or `==`. They are equal only if they are the very same object; compare fields instead.",
        "Destructuring from `undefined` or `null`, which throws. Provide a default (`= {}`) or check first.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

const a = { x: { y: 1 } };
const b = { ...a };
b.x.y = 2;
console.log(a.x.y);`,
      options: ["1", "2", "undefined", "It throws"],
      answer: 1,
      why: "Spread is a shallow copy: b.x is the same inner object as a.x, so changing b.x.y changes a.x.y too.",
    },
    {
      kind: "quiz",
      question: `What is logged?

function f(o) { o = { v: 2 }; }
const obj = { v: 1 };
f(obj);
console.log(obj.v);`,
      options: ["1", "2", "undefined", "null"],
      answer: 0,
      why: "The parameter o is a copy of the reference. Re-assigning o points the local copy elsewhere and leaves obj alone.",
    },
    {
      kind: "quiz",
      question: "Which of these keeps a value that `JSON.parse(JSON.stringify(x))` would lose?",
      options: [
        "`structuredClone` on a Date",
        "Spread on a function",
        "`Object.keys`",
        "`typeof`",
      ],
      answer: 0,
      why: "structuredClone keeps a Date as a Date. The JSON round trip turns it into a string.",
    },
    {
      kind: "remember",
      items: [
        "A variable holding an object holds a reference. `b = a` shares one object; it does not copy.",
        "JavaScript is always pass-by-value. For objects the value is the reference, so you can mutate through it, but re-assigning the parameter does not reach the caller.",
        "Spread and `Object.assign` copy one level. `structuredClone` copies deeply but throws on functions; the JSON trick loses Dates and undefined.",
        "Use `Map` for arbitrary keys, counting and order; `Set` for uniqueness; `WeakMap` to attach data without blocking garbage collection.",
      ],
    },
  ],
};
