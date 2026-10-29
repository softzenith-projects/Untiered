import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterWhatIsJavascript: Chapter = {
  slug: "what-is-javascript",
  title: "What JavaScript Is, and Where It Runs",
  summary: "The language, the engine and the runtime are three different things. Learn which is which, how to run your first line in a browser or in Node, and what a script is as opposed to a module.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text: "Most people meet JavaScript as \"the thing that makes a web page do stuff\". That is true, and it is also why interviews catch them out: the question is rarely about the page. It is about what **JavaScript** itself is, who runs it, and what it gets for free. This chapter fixes those three words in your head before any syntax arrives.",
    },
    {
      kind: "h",
      text: "The kitchen analogy",
    },
    {
      kind: "analogy",
      title: "A recipe, a cook and a kitchen",
      text: "Think of a recipe card, a cook, and the kitchen the cook works in. The recipe card is the **language**: a written set of rules saying what \"fold\" or \"simmer\" means. The cook is the **engine**: the program that reads the card and does each step (Chrome and Node use one called V8, Firefox uses SpiderMonkey, Safari uses JavaScriptCore). The kitchen is the **runtime**: the stove, the fridge, the tap. A recipe can say \"boil water\" only because the kitchen has a tap. A browser kitchen has a page to change (the DOM) and a network (`fetch`). A Node kitchen has files and sockets instead. Where the picture stops being true: a real cook finishes one dish with their own hands, while an engine also compiles your code to machine code while running it.",
    },
    {
      kind: "h",
      text: "Three words, three jobs",
    },
    {
      kind: "concept",
      title: "ECMAScript vs JavaScript",
      text: "**ECMAScript** is the written standard for the language (the recipe rules), maintained by a committee called TC39 and published each year as ES2015, ES2016 and so on. **JavaScript** is what we call the language people write. Features such as `let`, arrow functions, Promises and `async/await` are all ECMAScript features. Things such as `document`, `window`, `setTimeout` in a browser, and `fs` in Node are NOT part of the language. They belong to the runtime.",
    },
    {
      kind: "compare",
      title: "Language, engine, runtime",
      columns: [
        {
          label: "Language (ECMAScript)",
          items: [
            "Defines syntax and built-ins: `let`, `class`, `Array`, `Promise`, `Map`.",
            "Same everywhere.",
            "Has no idea what a web page is.",
          ],
        },
        {
          label: "Engine (V8, SpiderMonkey, JavaScriptCore)",
          items: [
            "Parses and runs your code, and compiles hot code to machine code as it goes.",
            "Manages memory (garbage collection).",
            "Knows nothing about files or the DOM.",
          ],
        },
        {
          label: "Runtime (browser, Node)",
          items: [
            "Wraps an engine and adds APIs: `document`, `fetch`, `fs`.",
            "Provides the event loop that schedules callbacks.",
            "Different runtimes offer different extras.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "A common wrong claim is \"JavaScript is an interpreted language\". It is better to say that the language does not require either approach. Modern engines parse your code, run it quickly, and compile the parts that run often into machine code. How it is done is up to the engine.",
    },
    {
      kind: "h",
      text: "Your first program",
    },
    {
      kind: "p",
      text: "`console.log` prints a value so you can see it. In a browser, open the developer tools (F12) and use the Console tab. In Node, save a file and run `node file.js`. Here, you can just press the button: the code below runs in your own browser, and the output is what real Node prints.",
    },
    {
      kind: "code",
      code: `const name = "Asha";
console.log("Hello, " + name);
console.log(2 + 3);
console.log("2" + "3");
console.log(typeof name);`,
      caption: "A first program. It runs here in your browser; the output shown is what Node prints for the same file.",
      output: `Hello, Asha
5
23
string`,
      tryIt: {
        language: "javascript",
        prompt: "Change the name, then predict what `console.log(\"2\" + 3)` prints before you add it as a new line.",
      },
    },
    {
      kind: "p",
      text: "Notice the second and third lines: `2 + 3` is `5`, but `\"2\" + \"3\"` is the text `23`. The same `+` does two jobs depending on its inputs. Chapter 3 explains that rule in full. For now, remember that JavaScript is **dynamically typed**: a variable does not have a type, the value it holds does.",
    },
    {
      kind: "h",
      text: "Where code can live",
    },
    {
      kind: "steps",
      title: "Running JavaScript, three ways",
      steps: [
        {
          label: "Browser console",
          text: "Open developer tools, type a line, press Enter. Best for quick experiments.",
        },
        {
          label: "A script in a page",
          text: "A `<script src=\"app.js\"></script>` tag loads a file. The page can then use `document` and `window`.",
        },
        {
          label: "Node.js",
          text: "Run `node file.js` in a terminal. No page exists, so `document` is undefined, but you get files, networking and `process`.",
        },
      ],
    },
    {
      kind: "h",
      text: "Script vs module",
    },
    {
      kind: "p",
      text: "A classic script shares one global scope with every other script on the page. A **module** (loaded with `<script type=\"module\">`, or a `.mjs` file in Node, or `\"type\": \"module\"` in `package.json`) has its own scope, uses `import` and `export`, and is always in strict mode. Everything we run in this course's playgrounds is a plain script, because that is the simplest to read.",
    },
    {
      kind: "code",
      code: `// math.js
export function add(a, b) {
  return a + b;
}

// app.js
import { add } from "./math.js";
console.log(add(2, 3)); // 5`,
      caption: "Where the same idea looks different: a module file with import/export. Real code, not run here, because the playground runs scripts only.",
    },
    {
      kind: "pitfall",
      items: [
        "Believing `document` or `window` exists everywhere. In Node, using `document` throws a `ReferenceError`. Check what runtime you are in, or keep that code out of shared files.",
        "Mixing up Java and JavaScript. They are different languages with unrelated designs; the name was a marketing choice from the 1990s.",
        "Putting `import` statements in a plain script and wondering why it throws a SyntaxError. Imports work only in modules.",
        "Typing code into the console and thinking it is saved. The console is for experiments; keep real code in files.",
      ],
    },
    {
      kind: "remember",
      items: [
        "The language (ECMAScript) is the rules, the engine runs them, the runtime (browser or Node) adds the extras like `document` and `fetch`.",
        "The language does not demand interpretation or compilation: modern engines do both, using JIT compilation.",
        "A module has its own scope and uses import and export. A classic script shares the global scope.",
        "`console.log` is your eyes. Print a value before you reason about it.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is the difference between JavaScript and ECMAScript? A strong answer: ECMAScript is the standard (TC39 writes it); JavaScript is an implementation of it plus the runtime's extras.",
        "Is `setTimeout` part of JavaScript? A strong answer: no. It is supplied by the runtime (browser or Node), not by the language specification, which is why its behaviour differs slightly between them.",
        "Is JavaScript interpreted or compiled? A strong answer: neither is required by the language. Modern engines parse, interpret, then just-in-time compile hot code. Say \"implementation-defined\".",
        "What is the difference between Node.js and a browser? A strong answer: same engine family (V8), different runtime APIs: DOM and `window` in a browser; files, processes and sockets in Node.",
      ],
    },
    {
      kind: "quiz",
      question: "Which of these is provided by the runtime, not by the JavaScript language itself?",
      options: ["`Array.prototype.map`", "`Promise`", "`setTimeout`", "`let`"],
      answer: 2,
      why: "`map`, `Promise` and `let` are all defined in the ECMAScript standard. `setTimeout` is supplied by the browser or by Node.",
    },
    {
      kind: "quiz",
      question: "What does `console.log(\"4\" + 1)` print?",
      options: ["5", "41", "NaN", "It throws an error"],
      answer: 1,
      why: "When one side of `+` is a string, the other side is converted to text and the two are joined, so you get the text 41. Chapter 3 covers the rule.",
    },
    {
      kind: "quiz",
      question: "A teammate says \"V8 is JavaScript\". What is the most accurate correction?",
      options: [
        "V8 is the language specification.",
        "V8 is an engine that runs JavaScript; Node and Chrome both embed it.",
        "V8 is a browser.",
        "V8 is a library for the DOM.",
      ],
      answer: 1,
      why: "V8 is an engine: it reads and runs JavaScript. Chrome and Node.js wrap it in different runtimes.",
    },
  ],
};
