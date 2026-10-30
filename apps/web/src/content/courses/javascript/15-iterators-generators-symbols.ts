import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterIteratorsGeneratorsSymbols: Chapter = {
  slug: "iterators-generators-symbols",
  title: "Iterators, Generators and Symbols",
  summary: "The protocol behind for...of and spread, how to write your own iterable, generators that pause and resume, lazy sequences, and the Symbol type that makes the protocol possible.",
  minutes: 19,
  blocks: [
    {
      kind: "p",
      text: "`for...of`, spread (`[...x]`), destructuring, `Array.from`, `Map`, `Set` and `Promise.all` all work on anything that follows one small agreement, the **iteration protocol**. Learn the agreement and you can make your own objects work with all of them. Generators are a shortcut for writing such objects, and they also give you values that are computed only when asked for.",
    },
    {
      kind: "h",
      text: "The chaat stall analogy",
    },
    {
      kind: "analogy",
      title: "A chaat vendor handing out plates one at a time",
      text: "At a busy chaat stall you do not get the whole counter at once. You ask \"next please\", and the vendor hands over one plate, or says \"finished\" when the tray is empty. You do not need to know how the tray is arranged. An **iterator** is that vendor: it only answers \"next\". An **iterable** is the stall that can supply a new vendor on request. Where the analogy stops: a stall can open any number of fresh vendors, but each vendor, once finished, stays finished.",
    },
    {
      kind: "h",
      text: "The protocol",
    },
    {
      kind: "concept",
      title: "Iterable and iterator",
      text: "An **iterator** is an object with a `next()` method returning `{ value, done }`. When `done` is `true`, the sequence has ended. An **iterable** is an object with a method under the key `Symbol.iterator` that returns a fresh iterator. `for...of`, spread, `Array.from`, destructuring and `new Map(...)` all call that method, then call `next()` until `done`. Arrays, strings, `Map`, `Set` and `arguments` are iterable; plain objects are not.",
    },
    {
      kind: "code",
      code: `const countdown = {
  from: 3,
  [Symbol.iterator]() {
    let n = this.from;
    return {
      next: () => (n > 0 ? { value: n--, done: false } : { value: undefined, done: true }),
    };
  },
};

console.log([...countdown]);
for (const n of countdown) {
  console.log("t-" + n);
}
const [first, ...rest] = countdown;
console.log(first, rest, Math.max(...countdown));

const it = [10, 20][Symbol.iterator]();
console.log(it.next(), it.next(), it.next());
console.log(typeof {}[Symbol.iterator], typeof ""[Symbol.iterator], [..."hi"]);`,
      caption: "Our own iterable works with spread, `for...of`, destructuring and `Math.max`. A plain object has no `Symbol.iterator`.",
      output: `[ 3, 2, 1 ]
t-3
t-2
t-1
3 [ 2, 1 ] 3
{ value: 10, done: false } { value: 20, done: false } { value: undefined, done: true }
undefined function [ 'h', 'i' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Add a `to` field and make the countdown stop at `to` instead of 1. Test with spread.",
      },
    },
    {
      kind: "p",
      text: "Each time something iterates `countdown`, `[Symbol.iterator]()` runs again and builds a fresh `n`, so the object can be looped over any number of times. A single iterator, like `it` above, is used up once it says `done`. This is why `[...countdown]` works twice but spreading the same `it` a second time gives an empty array.",
    },
    {
      kind: "h",
      text: "Generators: pausing a function",
    },
    {
      kind: "p",
      text: "A **generator function** is declared with `function*`. Calling it does not run the body; it returns a generator object, which is both an iterator and an iterable. Each `next()` runs the body up to the next `yield`, hands out that value, and **pauses** with all local variables intact. The next `next()` resumes from the same spot. You write a loop, and the protocol is done for you.",
    },
    {
      kind: "code",
      code: `function* idGen() {
  let id = 1;
  while (true) {
    const reset = yield id++;
    if (reset) id = 1;
  }
}
const g = idGen();
console.log(g.next().value, g.next().value, g.next(true).value, g.next().value);

let pulled = 0;
function* naturals() {
  let n = 1;
  while (true) {
    pulled += 1;
    yield n++;
  }
}
function* map(source, fn) {
  for (const x of source) yield fn(x);
}
function* filter(source, test) {
  for (const x of source) if (test(x)) yield x;
}
function* take(source, count) {
  if (count <= 0) return;
  for (const x of source) {
    yield x;
    if (--count <= 0) return;
  }
}
const squaresOfEvens = take(map(filter(naturals(), (x) => x % 2 === 0), (x) => x * x), 4);
console.log([...squaresOfEvens], pulled);`,
      caption: "A value sent into `next(true)` becomes the result of `yield`. The pipeline over an endless source asks for only the numbers it needs.",
      output: `1 2 1 2
[ 4, 16, 36, 64 ] 8`,
      tryIt: {
        language: "javascript",
        prompt: "Change `take(..., 4)` to `take(..., 2)`. Predict `pulled` before you run it.",
      },
    },
    {
      kind: "steps",
      title: "Following the lazy pipeline",
      steps: [
        { label: "Nothing runs", text: "Building `take(map(filter(naturals())))` only creates generator objects. No number exists yet." },
        { label: "Spread asks", text: "`[...squaresOfEvens]` calls `next()` on `take`, which asks `map`, which asks `filter`, which asks `naturals`." },
        { label: "One at a time", text: "`naturals` yields 1, which `filter` rejects and asks again; it yields 2, which passes down, is squared to 4, and arrives at the array." },
        { label: "Stop early", text: "After four values, `take` returns. Eight numbers were pulled from the endless source, and no more. That is **lazy evaluation**." },
      ],
    },
    {
      kind: "h",
      text: "Symbols",
    },
    {
      kind: "p",
      text: "`Symbol.iterator` is a **symbol**, a primitive type created by `Symbol()` and guaranteed unique. Two symbols are never equal, even with the same description. That makes them ideal as property keys that cannot clash with any string key. Symbols used as keys are skipped by `Object.keys`, `for...in` and `JSON.stringify`. The language also defines well-known symbols that let your objects hook into built-in behaviour, such as `Symbol.iterator` for loops and `Symbol.toPrimitive` for conversion.",
    },
    {
      kind: "code",
      code: `const id = Symbol("id");
const user = { name: "Asha", [id]: 7 };
console.log(user[id], Object.keys(user), JSON.stringify(user));
console.log(id.toString(), id.description, Object.getOwnPropertySymbols(user).length);
console.log(Symbol("x") === Symbol("x"), Symbol.for("x") === Symbol.for("x"));

class Temp {
  constructor(c) {
    this.c = c;
  }
  [Symbol.toPrimitive](hint) {
    return hint === "string" ? this.c + "C" : this.c;
  }
}
const t = new Temp(20);
console.log(\`\${t}\`, t + 5, t * 2);`,
      caption: "A symbol key is hidden from the usual listings. `Symbol.for` looks up a shared symbol in a global registry. `Symbol.toPrimitive` controls conversion.",
      output: `7 [ 'name' ] {"name":"Asha"}
Symbol(id) id 1
false true
20C 25 40`,
      tryIt: {
        language: "javascript",
        prompt: "Give `Temp` a `[Symbol.iterator]` generator that yields `this.c` three times. Spread a `Temp`.",
      },
    },
    {
      kind: "pitfall",
      items: [
        "Spreading or looping a plain object and getting `TypeError: object is not iterable`. Use `Object.entries(obj)` or give it a `Symbol.iterator`.",
        "Reusing a generator object that has finished. It stays done; call the generator function again for a new one.",
        "Writing `for (const x of generatorFn)` without calling it. A generator function is not itself iterable; its result is.",
        "Looping over an endless generator with spread or `Array.from`. It never ends; limit it with `take` or a `break`.",
        "Expecting `yield` to work inside a normal callback such as `forEach`. `yield` belongs to the generator function itself; use `for...of`.",
        "Using `for...in` on an array. It walks keys, not values; use `for...of`.",
      ],
    },
    {
      kind: "remember",
      items: [
        "An iterator has `next()` returning `{ value, done }`; an iterable has `[Symbol.iterator]()` returning a fresh iterator. `for...of`, spread and destructuring rely on it.",
        "A generator (`function*`) returns an iterator whose body pauses at each `yield` and resumes on the next `next()`, keeping its local state.",
        "Generators are lazy: values are computed only when asked for, so endless sequences are fine if you stop early.",
        "A symbol is a unique primitive, used as a collision-proof key and to hook into language behaviour such as `Symbol.iterator`.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What makes an object iterable? A strong answer: a `[Symbol.iterator]()` method returning an iterator, an object with `next()` that returns `{ value, done }`.",
        "What is a generator and how does it differ from a normal function? A strong answer: a `function*` that can pause at `yield` and resume, returning an iterator; calling it runs nothing until `next()`.",
        "Why can you spread an array or a string but not an object? A strong answer: arrays and strings define `Symbol.iterator`; plain objects do not (object spread in literals is a separate feature that copies own properties).",
        "What are symbols used for? A strong answer: unique property keys and well-known hooks like `Symbol.iterator` and `Symbol.toPrimitive`; they are skipped by `Object.keys` and JSON.",
        "Implement a `range(start, end)` that does not build an array. A strong answer: a generator that yields in a loop, so values are produced on demand.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

function* g() {
  yield 1;
  yield 2;
}
const it = g();
console.log([...it], [...it]);`,
      options: ["[ 1, 2 ] [ 1, 2 ]", "[ 1, 2 ] []", "[] []", "It throws"],
      answer: 1,
      why: "The first spread drains the generator to the end. A generator object is a single iterator, so after it is done a second spread finds nothing and gives an empty array.",
    },
    {
      kind: "quiz",
      question: `What is logged?

const s = Symbol("k");
const o = { [s]: 1, a: 2 };
console.log(Object.keys(o).length, JSON.stringify(o));`,
      options: ["1 {\"a\":2}", "2 {\"a\":2}", "2 {\"a\":2,\"k\":1}", "1 {}"],
      answer: 0,
      why: "Symbol keys are not returned by Object.keys and are skipped by JSON.stringify, so only the string key a is counted and written.",
    },
    {
      kind: "quiz",
      question: `What does this print?

function* f() {
  const x = yield 1;
  console.log("got", x);
}
const it = f();
it.next("ignored");
it.next("hello");`,
      options: ["got hello", "got ignored", "got undefined", "Nothing is printed"],
      answer: 0,
      why: "The first next() only runs to the first yield, so its argument has nowhere to go. The second next(\"hello\") becomes the value of the paused yield expression, so x is \"hello\".",
    },
  ],
};
