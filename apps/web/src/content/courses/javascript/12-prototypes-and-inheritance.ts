import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterPrototypesAndInheritance: Chapter = {
  slug: "prototypes-and-inheritance",
  title: "Prototypes and Inheritance",
  summary: "How every object points at another object, how property lookup walks that chain, what Object.create and constructor functions really do, and how instanceof checks the chain.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text: "Most languages share behaviour with classes. JavaScript shares it with **prototypes**: every object has a hidden link, written `[[Prototype]]`, to another object (or to `null`). When you read a property that the object does not have, the engine follows the link and tries again. That is all inheritance is here. Classes (chapter 13) are a friendlier way to write the same thing.",
    },
    {
      kind: "h",
      text: "The family recipe book analogy",
    },
    {
      kind: "analogy",
      title: "Ask your mother, then your grandmother",
      text: "You want to cook rajma and you do not have the recipe written down. You ask your mother. If she does not know it, she says \"ask your grandmother\", and if she does not know either, the chain ends and you give up. Property lookup works the same way: look on the object, then on its prototype, then on that prototype's prototype, up to `null`. Where the analogy stops: your mother's recipe is only read by you. If you write a note of your own, it goes in your book and hides hers; it never changes hers.",
    },
    {
      kind: "h",
      text: "Lookup walks the chain",
    },
    {
      kind: "code",
      code: `const animal = {
  eats: true,
  describe() {
    return "eats: " + this.eats;
  },
};
const dog = Object.create(animal);
dog.barks = true;

console.log(dog.barks, dog.eats, dog.describe());
console.log(Object.keys(dog), "eats" in dog, Object.hasOwn(dog, "eats"));
console.log(Object.getPrototypeOf(dog) === animal);

dog.eats = false;
console.log(dog.eats, animal.eats);
delete dog.eats;
console.log(dog.eats);`,
      caption: "`dog` has its own `barks` and borrows `eats` from `animal`. Writing `dog.eats` creates an own property that hides the inherited one; deleting it brings the inherited one back.",
      output: `true true eats: true
[ 'barks' ] true false
true
false true
true`,
      tryIt: {
        language: "javascript",
        prompt: "Add `Object.setPrototypeOf(animal, { alive: true })` before the end and log `dog.alive`. Which links did the lookup follow?",
      },
    },
    {
      kind: "concept",
      title: "Reading walks up, writing stays here",
      text: "A **read** such as `dog.eats` searches the object, then its prototype, then that object's prototype, until it finds the name or reaches `null` (giving `undefined`). A **write** such as `dog.eats = false` normally creates or updates a property on `dog` itself and never touches the prototype. `this` inside an inherited method is still the object the method was called on, which is why `dog.describe()` reads `dog`'s own values first.",
    },
    {
      kind: "p",
      text: "Use `Object.getPrototypeOf(obj)` to read the link and `Object.create(proto)` to make an object with a chosen link. You may see `obj.__proto__` in old code. It works, but it is a legacy accessor; prefer the two functions. `Object.hasOwn(obj, key)` tells an own property from an inherited one, and `in` checks both.",
    },
    {
      kind: "h",
      text: "Constructor functions and the prototype property",
    },
    {
      kind: "p",
      text: "A **constructor function** is an ordinary function you call with `new`. Every function (except arrows and methods) has a `prototype` property: a plain object that becomes the `[[Prototype]]` of everything built with `new`. The name is confusing. `Person.prototype` is not Person's own prototype; it is the prototype **of the instances** `Person` creates.",
    },
    {
      kind: "code",
      code: `function Person(name) {
  this.name = name;
}
Person.prototype.greet = function () {
  return "Hi, " + this.name;
};

const p1 = new Person("Asha");
const p2 = new Person("Ravi");
console.log(p1.greet(), p1.greet === p2.greet);
console.log(p1.constructor === Person, Object.getPrototypeOf(p1) === Person.prototype);
console.log(p1 instanceof Person, p1 instanceof Object);
console.log(Object.getPrototypeOf(Person.prototype) === Object.prototype);

for (const key in p1) {
  console.log("key", key);
}`,
      caption: "The two people share one `greet` function. `for...in` lists own and inherited enumerable keys.",
      output: `Hi, Asha true
true true
true true
true
key name
key greet`,
      tryIt: {
        language: "javascript",
        prompt: "Add `Person.prototype.legs = 2`, then log `p1.legs` and `Object.keys(p1)`. Which one shows it?",
      },
    },
    {
      kind: "steps",
      title: "What new Person(\"Asha\") does",
      steps: [
        { label: "Create", text: "A new empty object is made." },
        { label: "Link", text: "Its `[[Prototype]]` is set to `Person.prototype`." },
        { label: "Run", text: "`Person` runs with `this` set to the new object, so `this.name = name` makes an own property." },
        { label: "Return", text: "The new object is the result, unless the function returned a different object." },
      ],
    },
    {
      kind: "h",
      text: "Building a chain by hand",
    },
    {
      kind: "code",
      code: `function Person(name) {
  this.name = name;
}
Person.prototype.greet = function () {
  return "Hi, " + this.name;
};

function Student(name, course) {
  Person.call(this, name);
  this.course = course;
}
Student.prototype = Object.create(Person.prototype);
Student.prototype.constructor = Student;
Student.prototype.study = function () {
  return this.name + " studies " + this.course;
};

const s = new Student("Meera", "Maths");
console.log(s.greet());
console.log(s.study());
console.log(s instanceof Student, s instanceof Person, s.constructor.name);

function Bag() {}
Bag.prototype.items = [];
const x = new Bag();
const y = new Bag();
x.items.push("pen");
console.log(y.items);`,
      caption: "This is what `class Student extends Person` does for you. The last lines show why mutable data does not belong on a prototype.",
      output: `Hi, Meera
Meera studies Maths
true true Student
[ 'pen' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Comment out the `Student.prototype.constructor = Student;` line. What does `s.constructor.name` print now, and why?",
      },
    },
    {
      kind: "p",
      text: "`instanceof` asks one question: is `Student.prototype` anywhere on the prototype chain of `s`? It does not look at who built the object. That also means it can be fooled by changing prototypes, and it fails across iframes, where each page has its own `Array` and `Object`. For arrays use `Array.isArray`.",
    },
    {
      kind: "pitfall",
      items: [
        "Putting an array or object on a prototype. Every instance shares it, so one instance's change is seen by all. Create it in the constructor.",
        "Calling `Student.prototype = Person.prototype`. Both now share one object, so adding to Student adds to Person. Use `Object.create(Person.prototype)`.",
        "Forgetting `Person.call(this, name)` in a child constructor, so the parent's own properties are never set.",
        "Reading the `prototype` property of an instance. Instances do not have one; use `Object.getPrototypeOf(instance)`.",
        "Using `for...in` and being surprised by inherited keys. Use `Object.keys` or `Object.entries`, which list own enumerable properties only.",
        "Replacing the prototype of live objects with `Object.setPrototypeOf` in hot code. It is slow in engines; set it once at creation.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Every object has a hidden `[[Prototype]]` link; reads follow it until `null`, writes go to the object itself.",
        "`Fn.prototype` is the object that becomes the `[[Prototype]]` of instances made by `new Fn()`; it is not Fn's own prototype.",
        "`Object.create(p)` makes an object whose prototype is `p`; `Object.getPrototypeOf` reads it; `Object.hasOwn` tells own from inherited.",
        "`instanceof` walks the chain looking for the constructor's `prototype`. Classes are the same machinery with nicer syntax.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is the prototype chain? A strong answer: each object links to another; a missing property is looked up along the links until null, which is how methods are shared.",
        "What is the difference between `__proto__` and `prototype`? A strong answer: `__proto__` (or `getPrototypeOf`) is an object's actual link; `prototype` is a property of constructor functions, used as the link for instances made by `new`.",
        "How does `new` work? A strong answer: creates an object, links it to the constructor's prototype, runs the constructor with `this` as that object, returns it unless an object is returned.",
        "How do you make one object inherit from another without a class? A strong answer: `Object.create(parent)`, then add own properties.",
        "What does `instanceof` check, and what are its limits? A strong answer: whether the constructor's `prototype` appears in the object's chain; it is fooled by changed prototypes and fails across realms like iframes.",
      ],
    },
    {
      kind: "quiz",
      question: `What does this print?

const base = { x: 1 };
const child = Object.create(base);
child.x = 2;
delete child.x;
console.log(child.x);`,
      options: ["1", "2", "undefined", "It throws"],
      answer: 0,
      why: "Assigning child.x created an own property that hid base.x. Deleting it removes only the own one, so the lookup falls back to base and finds 1.",
    },
    {
      kind: "quiz",
      question: `What is logged?

function F() {}
const f = new F();
console.log(Object.getPrototypeOf(f) === F.prototype,
            Object.getPrototypeOf(F) === F.prototype);`,
      options: ["true false", "true true", "false false", "false true"],
      answer: 0,
      why: "new F() links f to F.prototype. F itself is a function, so its own prototype is Function.prototype, a different object.",
    },
    {
      kind: "quiz",
      question: `Why is this a bug?

function Cart() {}
Cart.prototype.items = [];
const a = new Cart();
const b = new Cart();
a.items.push("book");
console.log(b.items.length);`,
      options: [
        "It prints 1, because both carts share one array.",
        "It prints 0, because b has its own items array.",
        "It throws, because prototypes cannot hold arrays.",
        "It prints undefined, because items is not inherited.",
      ],
      answer: 0,
      why: "a.items finds the array on Cart.prototype, and push changes that shared array in place. b.items finds the same array. Creating this.items = [] in the constructor gives each cart its own.",
    },
  ],
};
