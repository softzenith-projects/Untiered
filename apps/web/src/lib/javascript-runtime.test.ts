import { describe, expect, it } from "vitest";

import { runInNode, runInWorkerSource } from "@/lib/javascript-runtime-harness";

/**
 * The browser runtime prints what `node` prints. Each case is a program a lesson could
 * plausibly contain; both outputs are produced fresh on every run, so the comparison is
 * against Node itself rather than against a string somebody once believed Node printed.
 */
const programs: Record<string, string> = {
  primitives: `console.log(1, -0, 1.5, NaN, Infinity, 10n, true, null, undefined, "text", Symbol("s"));`,
  "strings nested in values": `console.log(["it's", 'say "hi"', "both ' and \\"", "tab\\there", "line\\nbreak", "back\\\\slash"]);`,
  "short and empty arrays": `console.log([1, 2, 3], [], [[]], [[1, [2, [3, [4]]]]]);`,
  "long number arrays group into columns": `console.log([1, 2, 3, 4, 5, 6, 7]);
console.log(Array.from({ length: 30 }, (_, i) => i * i));
console.log([10, 200, 3000, 4, 50, 600, 7000, 8]);`,
  "long string arrays group left-aligned": `console.log(["apple", "banana", "cherry", "date", "elderberry", "fig", "grape", "kiwi"]);`,
  "holes and long arrays": `console.log([1, , 3], new Array(3), Array.from({ length: 120 }, (_, i) => i).length);
console.log(Array.from({ length: 105 }, () => 0));`,
  "plain and nested objects": `console.log({}, { a: 1, b: "two", c: [3], d: { e: { f: { g: 1 } } } });
console.log({ "not-an-identifier": 1, 2: "two", [Symbol("k")]: true });`,
  "objects that break across lines": `const user = { id: 101, name: "Asha Verma", email: "asha@example.com", roles: ["admin", "editor"], active: true };
console.log(user);
console.log({ list: [user, user] });`,
  "class instances and functions": `class Animal { constructor(name) { this.name = name; } speak() {} }
class Dog extends Animal {}
function named() {}
const arrow = () => {};
async function later() {}
function* gen() {}
console.log(new Dog("Rex"), new Animal("Cat"), Dog, Animal, named, arrow, later, gen, () => {});
console.log({ fn: named, cls: Dog, method: { speak() {} }.speak });`,
  "maps, sets and dates": `console.log(new Map([["a", 1], ["b", { c: 2 }]]), new Set([1, "two", [3]]), new Map(), new Set());
console.log(new Date(0), new Date("x"), /ab+c/gi);
console.log(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));`,
  "null prototype, getters, boxed": `const o = Object.create(null); o.x = 1;
console.log(o, Object.create(null));
console.log({ get a() { return 1; }, set b(v) {}, get c() { return 1; }, set c(v) {} });
console.log(new Number(3), new String("s"), new Boolean(false));`,
  circular: `const a = { name: "a" }; a.self = a; console.log(a);
const list = [1]; list.push(list); console.log(list);`,
  "format specifiers": `console.log("%s is %d years and %i days", "Asha", 30.5, 4.9);
console.log("%o and %j and %%", { a: 1 }, { b: 2 });
console.log("no specifiers", { a: 1 }, [1]);`,
  "event loop ordering": `console.log("sync 1");
setTimeout(() => console.log("timeout"), 0);
Promise.resolve().then(() => console.log("microtask"));
queueMicrotask(() => console.log("queued microtask"));
(async () => { await null; console.log("after await"); })();
console.log("sync 2");`,
  "timers that finish later": `let n = 0;
const id = setInterval(() => { n++; console.log("tick", n); if (n === 3) clearInterval(id); }, 5);
setTimeout(() => console.log("late"), 40);`,
  "async and await chains": `const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
async function main() {
  const [a, b] = await Promise.all([wait(10, "a"), wait(5, "b")]);
  console.log(a, b);
  const first = await Promise.race([wait(10, "slow"), wait(1, "fast")]);
  console.log(first);
  const settled = await Promise.allSettled([Promise.reject(new Error("no")), wait(1, 1)]);
  console.log(settled.map((s) => s.status));
}
main();`,
  "caught errors print name and message": `try { null.x; } catch (e) { console.log(e.name, "-", e instanceof TypeError); }
try { JSON.parse("{bad"); } catch (e) { console.log(e.name); }`,
};

describe("the JavaScript worker runtime prints what node prints", () => {
  for (const [name, source] of Object.entries(programs)) {
    it(name, async () => {
      const node = runInNode(source);
      const worker = await runInWorkerSource(source);
      expect(node.stderr).toBe("");
      expect(worker.stderr).toBe("");
      expect(worker.stdout).toBe(node.stdout);
    });
  }
});

describe("the JavaScript worker runtime, where it cannot match node", () => {
  it("reports an uncaught error on stderr, by name and message", async () => {
    const result = await runInWorkerSource(`console.log("before"); undefinedFunction();`);
    expect(result.stdout).toBe("before");
    expect(result.stderr).toBe("Uncaught ReferenceError: undefinedFunction is not defined");
  });

  it("reports an error thrown later, from a timer", async () => {
    const result = await runInWorkerSource(`setTimeout(() => { throw new RangeError("late"); }, 1);`);
    expect(result.stderr).toBe("Uncaught RangeError: late");
  });

  it("does not pretend to know a promise's state", async () => {
    const result = await runInWorkerSource(`console.log(Promise.resolve(1));`);
    expect(result.stdout).toBe("Promise { <unknown> }");
  });

  it("keeps one run's top-level declarations out of the next", async () => {
    await runInWorkerSource(`const shared = 1;`);
    const second = await runInWorkerSource(`const shared = 2; console.log(shared);`);
    expect(second.stdout).toBe("2");
  });
});
