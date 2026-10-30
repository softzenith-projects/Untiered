import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterClasses: Chapter = {
  slug: "classes",
  title: "Classes",
  summary: "Class syntax as a clean way to write constructors and prototypes, with extends and super, static members, truly private fields, getters and setters, mixins, and the this trap in methods.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "A `class` is a tidier way to write what chapter 12 did by hand: a constructor function, methods placed on its `prototype`, and a prototype chain for `extends`. Nothing about the object model changed. What the syntax adds are real guards: classes must be called with `new`, class bodies are always in strict mode, and `#private` fields are enforced by the language, not by habit.",
    },
    {
      kind: "h",
      text: "The visiting card analogy",
    },
    {
      kind: "analogy",
      title: "A printing press for visiting cards",
      text: "A class is the printing press: it holds the layout, and each `new` call prints one card with that person's name filled in. A card for a manager is printed on a press made from the staff press with an extra line for \"team\" (that is `extends`). Where the analogy stops: the press is not a template that is copied onto every card. All cards point back at one shared press for their methods, which is why changing a method on the class changes it for cards already printed.",
    },
    {
      kind: "h",
      text: "A class with everything in it",
    },
    {
      kind: "code",
      code: `class Account {
  #balance = 0;
  static count = 0;

  constructor(owner) {
    this.owner = owner;
    Account.count += 1;
  }

  deposit(amount) {
    if (amount <= 0) throw new RangeError("amount must be positive");
    this.#balance += amount;
    return this;
  }

  get balance() {
    return this.#balance;
  }

  static richer(a, b) {
    return a.#balance >= b.#balance ? a : b;
  }

  toString() {
    return this.owner + ": " + this.#balance;
  }
}

class Savings extends Account {
  constructor(owner, rate) {
    super(owner);
    this.rate = rate;
  }

  addInterest() {
    return this.deposit(this.balance * this.rate);
  }

  toString() {
    return "Savings " + super.toString();
  }
}

const s = new Savings("Asha", 0.5);
s.deposit(100).addInterest();
const t = new Account("Ravi").deposit(40);
console.log(String(s), s.balance, Account.count);
console.log(Account.richer(s, t).owner, Object.keys(s));

try {
  s.deposit(-5);
} catch (err) {
  console.log(err.name + ": " + err.message);
}`,
      caption: "Private field, static field and method, getter, inheritance with `super`, and a chainable method that returns `this`.",
      output: `Savings Asha: 150 150 2
Asha [ 'owner', 'rate' ]
RangeError: amount must be positive`,
      tryIt: {
        language: "javascript",
        prompt: "Add a `withdraw(amount)` method that refuses to go below zero. Try it on `t`.",
      },
    },
    {
      kind: "compare",
      title: "Where each class member lives",
      columns: [
        { label: "Instance", items: ["Fields and `this.x = ...` in the constructor.", "One copy per object.", "`#name` fields are here, visible only inside the class body."] },
        { label: "Prototype", items: ["Methods, getters and setters.", "One shared copy.", "Reached through the chain."] },
        { label: "Static", items: ["`static` fields and methods.", "Live on the class itself.", "Called as `Account.richer(...)`, not on instances."] },
      ],
    },
    {
      kind: "concept",
      title: "Private fields are real",
      text: "A name starting with `#` can only be read or written from code written inside the class body. Outside, `s.#balance` is a **syntax error**, and `Object.keys` and `JSON.stringify` do not see it. This is different from the old habit of naming something `_balance`, which is only a request to be polite. Because `#balance` is checked by the engine, `Account.richer` can read `a.#balance` for any `Account`, but a plain object that merely looks similar would throw a `TypeError`.",
    },
    {
      kind: "h",
      text: "Class is sugar, with guards",
    },
    {
      kind: "code",
      code: `class Point {
  constructor(x) {
    this.x = x;
  }
  norm() {
    return Math.abs(this.x);
  }
}
console.log(typeof Point, Object.getOwnPropertyNames(Point.prototype));

try {
  Point(1);
} catch (err) {
  console.log(err.name);
}
try {
  new Later();
} catch (err) {
  console.log(err.name);
}
class Later {}`,
      caption: "A class is a function underneath. Calling it without `new` throws, and the name is in its temporal dead zone before the declaration.",
      output: `function [ 'constructor', 'norm' ]
TypeError
ReferenceError`,
      tryIt: {
        language: "javascript",
        prompt: "Log `Object.getPrototypeOf(Point) === Function.prototype` and `Point.prototype.constructor === Point`.",
      },
    },
    {
      kind: "p",
      text: "Unlike a function declaration, a class is **not** hoisted with its body; it behaves like `let`. In a subclass constructor you must call `super(...)` before you touch `this`, because the parent is what creates the object. Methods are not enumerable, so `for...in` skips them.",
    },
    {
      kind: "h",
      text: "The this trap, and mixins",
    },
    {
      kind: "code",
      code: `class Button {
  label = "OK";
  click() {
    return this.label;
  }
  clickBound = () => this.label;
}
const b = new Button();
const { click, clickBound } = b;

try {
  click();
} catch (err) {
  console.log(err.name);
}
console.log(clickBound());

const Serializable = (Base) =>
  class extends Base {
    serialize() {
      return JSON.stringify(this);
    }
  };
class Item {
  constructor(n) {
    this.n = n;
  }
}
class SItem extends Serializable(Item) {}
console.log(new SItem(5).serialize(), new SItem(5) instanceof Item);`,
      caption: "A detached method has no `this` (class code is strict). An arrow in a class field captures the instance. A mixin is a function that takes a class and returns a subclass.",
      output: `TypeError
OK
{"n":5} true`,
      tryIt: {
        language: "javascript",
        prompt: "Make `click` safe to detach without changing it to an arrow: bind it in a `constructor`.",
      },
    },
    {
      kind: "p",
      text: "JavaScript allows only one parent per class. When you need behaviour from several sources, a **mixin** wraps a base class and returns an extended one, as above. Prefer composition when you can: give the object a helper to use rather than a new ancestor. Deep `extends` chains are hard to follow, and a base-class change ripples into every subclass.",
    },
    {
      kind: "pitfall",
      items: [
        "Passing `obj.method` as a callback and losing `this`. Bind it, wrap it in an arrow, or define it as an arrow field.",
        "Touching `this` before `super()` in a subclass constructor. It throws a ReferenceError.",
        "Calling a class without `new`. Unlike a plain function, it throws.",
        "Treating `_name` as private. Use `#name` when the data must really be hidden.",
        "Using an arrow function field for every method. Each instance gets its own copy, which costs memory and breaks `super.method()` lookups.",
        "Building tall inheritance trees. Prefer small classes that use each other.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A class is a constructor function plus prototype methods; `extends` links the prototypes, and `typeof` a class is `\"function\"`.",
        "`#field` privacy is enforced by the engine. Outside access is a syntax error, and the field never shows in `Object.keys` or JSON.",
        "`static` members belong to the class itself. In a subclass, call `super(...)` before using `this`.",
        "Methods lose `this` when detached; fix with `bind`, an arrow wrapper, or an arrow class field.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Are JavaScript classes real classes? A strong answer: they are syntax over constructor functions and prototypes, with extra rules (must use new, strict mode, no hoisting of the body, real private fields).",
        "How do `#private` fields differ from underscore names? A strong answer: the engine enforces them; outside access is a syntax error and they never appear in keys or JSON.",
        "What does `super` do? A strong answer: `super(...)` in a constructor runs the parent constructor and creates `this`; `super.method()` calls the parent's version of a method.",
        "How do you share behaviour across unrelated classes? A strong answer: composition first; otherwise a mixin function that takes a base class and returns a subclass.",
        "Why does a method passed as a callback throw? A strong answer: detaching it removes the receiver, `this` is undefined in strict class code; bind it or use an arrow.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

class A {
  static n = 0;
  constructor() { A.n += 1; }
}
new A(); new A();
const a = new A();
console.log(A.n, a.n);`,
      options: ["3 undefined", "3 3", "1 1", "0 undefined"],
      answer: 0,
      why: "A static field belongs to the class, so each new A() increments the one shared A.n, reaching 3. An instance does not inherit static members, so a.n is undefined.",
    },
    {
      kind: "quiz",
      question: `What happens?

class P { constructor() { this.a = 1; } }
class C extends P {
  constructor() {
    this.b = 2;
    super();
  }
}
new C();`,
      options: [
        "A ReferenceError, since this is used first.",
        "It sets b first and then a, and it works fine.",
        "A TypeError, because P is not a valid function.",
        "Nothing is printed, and an empty object is made.",
      ],
      answer: 0,
      why: "In a derived constructor, this does not exist until super() returns, because the parent constructor is what creates the object. Using it earlier is a ReferenceError.",
    },
    {
      kind: "quiz",
      question: `Which line is a syntax error?

class Box {
  #v = 1;
  read() { return this.#v; }
}
const x = new Box();`,
      options: ["x.read()", "x.#v", "new Box()", "Object.keys(x)"],
      answer: 1,
      why: "A private name can only be written inside the class body. Outside it, x.#v is rejected when the file is parsed, not at run time.",
    },
  ],
};
