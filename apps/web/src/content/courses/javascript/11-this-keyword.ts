import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterThisKeyword: Chapter = {
  slug: "this-keyword",
  title: "The this Keyword",
  summary: "The five rules that decide what `this` is, why a method loses it when you pass it as a callback, how call, apply and bind fix it, and how arrow functions and new change the picture.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "`this` is the most misunderstood word in JavaScript, and the reason is simple: its value is not decided where a function is written. It is decided **where and how the function is called**. The same function can have a different `this` on every call. Once you know the five rules, and the order they apply in, any `this` puzzle becomes a lookup.",
    },
    {
      kind: "h",
      text: "The hostel mess analogy",
    },
    {
      kind: "analogy",
      title: "\"Mine\" depends on who is speaking",
      text: "If a hostel warden says \"my room\", it means the warden's room. If a student says the same words, it means the student's room. The words did not change; the speaker did. `this` is \"my\": it points at whoever is making the call. A method called as `user.hello()` has the speaker `user`. The same method copied into a variable and called alone has no speaker at all. Where the analogy stops: an arrow function is like a printed notice that always says \"the warden's room\", whoever reads it out. It never changes its meaning.",
    },
    {
      kind: "h",
      text: "The five rules",
    },
    {
      kind: "concept",
      title: "How the engine picks this, in order of strength",
      text: "1. **`new`**: `new F()` makes a fresh object and `this` is that object. 2. **Explicit**: `f.call(obj)`, `f.apply(obj)` or `f.bind(obj)` sets `this` to `obj`. 3. **Implicit**: `obj.f()` sets `this` to `obj`, the object left of the dot at the call. 4. **Default**: a plain call `f()` gives `undefined` in strict mode (the global object in sloppy mode). 5. **Arrow functions** have no `this` of their own; they use the `this` of the code around where they were written, and none of rules 1 to 4 can change it.",
    },
    {
      kind: "code",
      code: `const user = {
  name: "Asha",
  hello() {
    "use strict";
    return "Hi, " + this.name;
  },
};
console.log(user.hello());

const detached = user.hello;
try {
  console.log(detached());
} catch (err) {
  console.log(err.name);
}

try {
  console.log([1].map(user.hello));
} catch (err) {
  console.log(err.name);
}`,
      caption: "Called with a dot, `this` is `user`. Copied into a variable and called alone, there is no object left of the dot.",
      output: `Hi, Asha
TypeError
TypeError`,
      tryIt: {
        language: "javascript",
        prompt: "Add a line that calls `detached.call(user)` and prints the result. What prints?",
      },
    },
    {
      kind: "p",
      text: "The last `try` also fails, because `map` calls your function as a plain call, with no object at all. Passing a method as a callback (`button.onclick = user.hello`, `setTimeout(user.hello, 0)`, `arr.map(user.hello)`) is the number one way `this` gets lost.",
    },
    {
      kind: "h",
      text: "Setting this yourself: call, apply, bind",
    },
    {
      kind: "code",
      code: `function intro(greeting, punct) {
  "use strict";
  return greeting + ", " + this.name + punct;
}
const ravi = { name: "Ravi" };

console.log(intro.call(ravi, "Hello", "!"));
console.log(intro.apply(ravi, ["Namaste", "."]));

const bound = intro.bind(ravi, "Hey");
console.log(bound("?"));
console.log(bound.call({ name: "Other" }, "?"));
console.log(bound.name);`,
      caption: "`call` takes arguments one by one, `apply` takes an array, `bind` returns a new function and runs nothing yet.",
      output: `Hello, Ravi!
Namaste, Ravi.
Hey, Ravi?
Hey, Ravi?
bound intro`,
      tryIt: {
        language: "javascript",
        prompt: "Make `intro.call(null, \"Hi\", \"!\")` run. What happens, and why?",
      },
    },
    {
      kind: "compare",
      title: "call vs apply vs bind",
      columns: [
        { label: "call", items: ["`f.call(obj, a, b)`", "Runs now.", "Arguments listed out."] },
        { label: "apply", items: ["`f.apply(obj, [a, b])`", "Runs now.", "Arguments in one array."] },
        { label: "bind", items: ["`f.bind(obj, a)`", "Returns a new function; runs later.", "Fixed for good: a later `call` cannot change `this`."] },
      ],
    },
    {
      kind: "h",
      text: "Arrow functions and callbacks",
    },
    {
      kind: "code",
      code: `const team = {
  label: "dev",
  members: ["a", "b"],
  tagWithArrow() {
    return this.members.map((m) => this.label + "-" + m);
  },
  tagWithFunction() {
    "use strict";
    try {
      return this.members.map(function (m) {
        return this.label + "-" + m;
      });
    } catch (err) {
      return err.name;
    }
  },
};
console.log(team.tagWithArrow());
console.log(team.tagWithFunction());

const holder = {
  id: "holder",
  make() {
    return () => this.id;
  },
};
const arrowFn = holder.make();
console.log(arrowFn.call({ id: "other" }));`,
      caption: "The arrow reuses the `this` of the method around it. The inner function gets its own, which is undefined.",
      output: `[ 'dev-a', 'dev-b' ]
TypeError
holder`,
      tryIt: {
        language: "javascript",
        prompt: "Change the inner `function (m)` in `tagWithFunction` to an arrow function. What does it return now?",
      },
    },
    {
      kind: "p",
      text: "The last line shows rule 5. `arrowFn.call(other)` ignores the object, because an arrow never takes `this` from a call. It uses the `this` of `make`, which was `holder` when `holder.make()` ran.",
    },
    {
      kind: "h",
      text: "new, and the order of the rules",
    },
    {
      kind: "code",
      code: `function Cup(size) {
  this.size = size;
}
const c = new Cup("large");
console.log(c.size, c instanceof Cup);

function Strict() {
  "use strict";
  this.ok = true;
}
try {
  Strict();
} catch (err) {
  console.log(err.name);
}

function Boxed() {
  this.a = 1;
  return { a: 2 };
}
console.log(new Boxed().a);

const pinned = Cup.bind({ size: "fixed" });
console.log(new pinned("new wins").size);`,
      caption: "`new` makes a fresh object. Forgetting `new` in strict mode throws. Returning an object from a constructor replaces the result. `new` beats `bind`.",
      output: `large true
TypeError
2
new wins`,
      tryIt: {
        language: "javascript",
        prompt: "Make `Boxed` return a number instead of an object. Does the result change?",
      },
    },
    {
      kind: "steps",
      title: "Reading any this puzzle",
      steps: [
        { label: "Is it an arrow?", text: "Then `this` is whatever it was in the surrounding code. Stop." },
        { label: "Called with new?", text: "Then `this` is the newly created object." },
        { label: "call, apply or bind?", text: "Then `this` is the object given." },
        { label: "Called as obj.f()?", text: "Then `this` is `obj`." },
        { label: "Otherwise", text: "A plain call: `undefined` in strict code (modules and classes are always strict), the global object in sloppy code." },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Passing `obj.method` as a callback (event handler, `setTimeout`, `map`) and losing `this`. Wrap it in an arrow, or use `obj.method.bind(obj)`.",
        "Using an arrow function as an object method and expecting `this` to be the object. It takes `this` from outside the object literal. Use method shorthand.",
        "Assuming `this` is where the function was written. For normal functions it is where the call happened.",
        "Writing `var self = this` in new code. An arrow function or `bind` does the same job more clearly.",
        "Trying to rebind an arrow function with `call`, `apply` or `bind`. The `this` argument is ignored.",
      ],
    },
    {
      kind: "remember",
      items: [
        "`this` is set by the call, not by the definition: `new`, then call/apply/bind, then `obj.f()`, then a plain call.",
        "A plain call gives `undefined` in strict mode and the global object in sloppy mode; classes and ES modules are always strict.",
        "An arrow function has no `this`; it uses the one from where it was written, and nothing can change it.",
        "`bind` returns a new function with `this` fixed; `call` and `apply` run immediately.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What decides the value of `this`? A strong answer: how the function is called, in priority order new, explicit binding, implicit (object before the dot), default; arrows use the enclosing `this`.",
        "Why does `const f = obj.method; f()` lose `this`? A strong answer: the dot was what supplied it; a plain call has no receiver, so it is undefined in strict mode.",
        "Difference between `call`, `apply` and `bind`? A strong answer: call and apply invoke now (arguments listed versus array); bind returns a new function with `this` and optional leading arguments fixed.",
        "How do arrow functions treat `this`? A strong answer: lexically, from the surrounding scope; they cannot be rebound and cannot be used with `new`.",
        "Implement `Function.prototype.bind`. A strong answer: return a function that calls the original with the stored `this` and the stored plus new arguments, and handle `new` on the result.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

const o = { n: 1, get() { return this.n; } };
const p = { n: 2, get: o.get };
console.log(o.get(), p.get());`,
      options: ["1 2", "1 1", "2 2", "1 undefined"],
      answer: 0,
      why: "The same function is shared, but each call has a different object left of the dot: o for the first call, p for the second.",
    },
    {
      kind: "quiz",
      question: `What is logged?

const obj = {
  v: "obj",
  arrow: () => typeof this,
  method() { return typeof this; },
};
console.log(obj.method());`,
      options: ["\"object\"", "\"undefined\"", "\"function\"", "\"string\""],
      answer: 0,
      why: "method is called as obj.method(), so this is obj and typeof gives \"object\". The arrow property would use the this of the surrounding code instead, not obj.",
    },
    {
      kind: "quiz",
      question: `A function is bound, then called with call:

function who() { "use strict"; return this.id; }
const b = who.bind({ id: 1 });
console.log(b.call({ id: 2 }));`,
      options: ["1, since bind fixed this", "2, because call runs last", "undefined, they cancel out", "A TypeError is thrown"],
      answer: 0,
      why: "A bound function ignores a later this from call or apply. Only new can override a bound this, and that case is about constructors.",
    },
  ],
};
