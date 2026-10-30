import type { Chapter } from "@/content/courses/types";

// The TypeScript blocks were checked with tsc 7.0.2 (--strict --module nodenext --erasableSyntaxOnly) and run with node 24.13 type stripping.
// The runnable sample is the JavaScript those examples erase to; its output was produced by running it under node.
export const chapterTypescriptEssentials: Chapter = {
  slug: "typescript-essentials",
  title: "TypeScript Essentials: Types That Disappear",
  summary:
    "What TypeScript adds to JavaScript and what it cannot do: structural typing, unions and narrowing, generics, unknown versus any, utility types, and the erasable subset that Node can run directly (checked with TypeScript 7.0).",
  minutes: 24,
  blocks: [
    {
      kind: "p",
      text: "**TypeScript** is JavaScript plus a layer of **types**: notes about what shape a value has, checked by a tool before the program runs. The tool finds the bug where you pass a number to a function that wants an object, in your editor, instead of in front of a user. The most important sentence about it is also the one most often forgotten: **types exist only while you write. They are erased before the code runs.** Everything in this chapter follows from that. Versions used here: the code was checked with TypeScript 7.0.2 (the version on npm on 29 October 2026) and the syntax is the stable core that has not changed across recent major versions.",
    },
    {
      kind: "h",
      text: "The exam-hall seating chart analogy",
    },
    {
      kind: "analogy",
      title: "A seating chart checks names, not people",
      text: "Before an exam the invigilator pins up a seating chart: Roll 14 sits at Desk 3. The chart helps the school catch mistakes in advance, before anyone sits down. But once the exam starts the chart is not in the room; students are. If a student shows up with the wrong admit card, the chart cannot stop them, only a person at the door checking can. TypeScript types are the chart, and a runtime check such as `typeof` is the person at the door. Where the analogy stops: unlike a paper chart, TypeScript checks the whole plan at once, thoroughly, and it reasons about what the chart implies (if the door check passed, the type is now known).",
    },
    {
      kind: "h",
      text: "Structural typing: the shape is what counts",
    },
    {
      kind: "p",
      text: "TypeScript is **structurally typed**. A value fits a type if it has the required properties, whatever it was created as. A function that wants a `Point` accepts any object with a numeric `x` and `y`. This is unlike Java or C#, where a type is a named declaration, and it is a favourite interview question. One wrinkle: an object *literal* written directly as an argument gets an extra **excess property check**, so a typo like `{ x: 1, yy: 2 }` is caught, while the same object passed through a variable is accepted.",
    },
    {
      kind: "code",
      caption:
        "TypeScript, checked with tsc 7.0.2 in strict mode and run with Node 24 type stripping. Shown as TypeScript, so it does not run in the course editor; the output of the full file was `1,2`, `13 9`, `42 7`, `10 a`, `[ 'id', 1 ]` (each line from its own console.log).",
      code: `interface Point {
  x: number;
  y: number;
}
function show(p: Point): string {
  return p.x + "," + p.y;
}
const fromApi = { x: 1, y: 2, label: "extra fields are fine for a variable" };
console.log(show(fromApi)); // 1,2 : the shape fits, so the extra field is ignored

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.round(Math.PI * shape.radius ** 2); // here TypeScript knows shape is the circle
    case "square":
      return shape.side ** 2; // and here, the square
    default: {
      const unreachable: never = shape; // compile error if a new Shape is added and not handled
      throw new Error("unhandled shape: " + JSON.stringify(unreachable));
    }
  }
}
`,
    },
    {
      kind: "h",
      text: "Unions and narrowing",
    },
    {
      kind: "concept",
      title: "Narrowing",
      text: "A **union type** such as `string | string[]` says a value is one of several types. TypeScript lets you use only what all of them share until you **narrow** it: a check that proves which one you have. `typeof x === \"string\"`, `Array.isArray(x)`, `x !== null`, `\"radius\" in shape` and a **discriminant** field (`shape.kind === \"circle\"`) all narrow. The `never` trick above makes the compiler fail if you forget a case. Narrowing is runtime code, which is why it survives type erasure.",
    },
    {
      kind: "compare",
      title: "any vs unknown",
      columns: [
        {
          label: "any",
          items: [
            "Turns the checker off for that value.",
            "You can call it, index it, assign it anywhere.",
            "Bugs hide: it spreads through the program.",
            "Use only as a last resort, and say why in a comment.",
          ],
        },
        {
          label: "unknown",
          items: [
            "\"Could be anything, so prove it first.\"",
            "You cannot use it until you narrow it (typeof, instanceof, a validator).",
            "The right type for JSON, caught errors and user input.",
            "Safe by default.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "The sample below is the **JavaScript the examples above erase to**. Look at what remains: the `switch` and the `typeof` checks, which do the real work, and none of the annotations. The second half feeds it data parsed from a JSON string. TypeScript could not have known that value's shape, so only the runtime check protects you. That is the reason libraries such as Zod exist: they build the runtime check and the type from one description.",
    },
    {
      kind: "code",
      caption:
        "The JavaScript that the TypeScript above erases to, with a runtime check on untrusted data. Runs in the course editor and under node. The types are gone; only checks like these exist at runtime.",
      code: `// This is the JavaScript that the TypeScript examples above erase to.
// Every type is gone. What is left is what actually runs, and what checks real data.
function area(shape) {
  switch (shape.kind) {
    case "circle":
      return Math.round(Math.PI * shape.radius ** 2);
    case "square":
      return shape.side ** 2;
    default:
      throw new Error("unhandled shape: " + JSON.stringify(shape));
  }
}

function parseAge(input) {
  if (typeof input === "number") return input;
  if (typeof input === "string" && input.trim() !== "" && !Number.isNaN(Number(input))) {
    return Number(input);
  }
  throw new Error("not an age");
}

console.log(area({ kind: "circle", radius: 2 }), area({ kind: "square", side: 3 }));

// A type says what SHOULD arrive. Real data from the network is only checked by code like this.
const fromServer = JSON.parse('{"kind":"triangle","base":4}');
try {
  area(fromServer);
} catch (err) {
  console.log(err.message);
}

for (const raw of ["42", 7, "", "abc", null]) {
  try {
    console.log(JSON.stringify(raw), "->", parseAge(raw));
  } catch (err) {
    console.log(JSON.stringify(raw), "->", err.message);
  }
}
`,
      output: `13 9
unhandled shape: {"kind":"triangle","base":4}
"42" -> 42
7 -> 7
"" -> not an age
"abc" -> not an age
null -> not an age`,
      tryIt: {
        language: "javascript",
        prompt:
          "Predict the output first. Then add a third shape, `{ kind: \"rectangle\", width: 2, height: 5 }`, to the `area` calls and watch the default branch fire. In TypeScript the `never` line would have stopped you at compile time. Add a `case` to fix it.",
      },
    },
    {
      kind: "h",
      text: "Generics and utility types",
    },
    {
      kind: "p",
      text: "A **generic** is a function or type with a type placeholder, written `<T>`, so one definition works for many types and keeps the relationship between them: `first<T>(items: T[]): T | undefined` returns a number for a list of numbers and a string for a list of strings. `<T extends { length: number }>` limits the placeholder to types that have a `length`. **Utility types** build new types from old ones without retyping: `Partial<User>` makes every field optional, `Pick<User, \"id\" | \"name\">` keeps two fields, and `Record<K, V>` is an object with keys `K` and values `V`. `as const` freezes a literal to its exact values, so an array of strings becomes a union of those strings.",
    },
    {
      kind: "code",
      caption:
        "TypeScript, checked with tsc 7.0.2 in strict mode. Interfaces, utility types, as const, a constrained generic and narrowing. Shown as TypeScript, so it does not run in the course editor and no output is claimed.",
      code: `interface User {
  id: number;
  name: string;
  email?: string; // optional
}
type UserPreview = Pick<User, "id" | "name">;
type UserPatch = Partial<User>;
type RoleMap = Record<"admin" | "member", string[]>;

const STATUS = ["idle", "loading", "done"] as const;
type Status = (typeof STATUS)[number]; // "idle" | "loading" | "done"

function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b; // works for strings and arrays alike
}

function getName(user: User | null): string {
  return user?.name ?? "guest"; // optional chaining and ?? narrow away null for you
}
`,
    },
    {
      kind: "compare",
      title: "interface or type?",
      columns: [
        {
          label: "interface",
          items: [
            "Describes the shape of an object.",
            "Can be extended with `extends`, and reopened to add fields.",
            "Good for public object shapes and class contracts.",
          ],
        },
        {
          label: "type alias",
          items: [
            "Names any type: unions, tuples, mapped and conditional types.",
            "Combines with `&` and `|`; cannot be reopened.",
            "Required for unions such as `Shape` above.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "For plain object shapes the two are almost interchangeable, and teams pick one by convention. Say that in an interview, then name the one real difference: only `interface` can be declared twice and merged, and only `type` can be a union.",
    },
    {
      kind: "h",
      text: "TypeScript that Node can run directly",
    },
    {
      kind: "p",
      text: "Chapter 35 explained Node's type stripping. The practical rule is to write the **erasable subset**: syntax that vanishes when the types are removed. Turn on the compiler option `erasableSyntaxOnly` and `tsc` rejects the rest. We checked it: an `enum` and a constructor `private size: number` parameter property both fail with error TS1294, and `node file.ts` refuses the enum with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. Use `import type` for type-only imports, and write the real `.ts` extension in relative imports.",
    },
    {
      kind: "code",
      caption:
        "A tsconfig.json for code that Node 24 or 26 will run by stripping types, and the commands (checked with tsc 7.0.2 and run on Node 24.13). Types are checked by tsc, never by Node. This is configuration, not a program, so it does not run in the course editor.",
      code: `// ---- tsconfig.json ----
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "strict": true,
    "noEmit": true,                  // tsc only checks; Node runs the .ts files
    "erasableSyntaxOnly": true,      // reject enum, namespace values, parameter properties
    "verbatimModuleSyntax": true,    // keep "import type" honest
    "allowImportingTsExtensions": true
  }
}

// ---- package.json ----  (needed with verbatimModuleSyntax and import/export)
{ "type": "module" }

// ---- terminal ----
// npx tsc            type check (Node does not do this)
// node app.ts        strip types and run
`,
    },
    {
      kind: "pitfall",
      items: [
        "Believing types protect you at runtime. JSON from an API can be any shape. Fix: validate untrusted data with a runtime check, and type it `unknown` until you do.",
        "Reaching for `any` to silence an error. It switches the checker off and the problem spreads. Fix: use `unknown` and narrow, or write the correct type.",
        "Using a type assertion (`value as User`) as if it converted the value. It only tells the compiler to trust you. Fix: narrow with a check, or validate.",
        "Using `enum` or parameter properties in code meant to run under Node's type stripping. Fix: a union of string literals (or `as const` object), and `erasableSyntaxOnly`.",
        "Thinking the editor's red squiggles stop a build, or that `node app.ts` reports type errors. Fix: run `tsc --noEmit` in your scripts and CI.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Types are erased before the code runs, so they cannot check data that arrives at runtime; only your own checks (typeof, in, a validator) can.",
        "Structural typing: a value fits a type if it has the needed shape. A discriminated union plus a switch narrows safely, and `never` catches forgotten cases.",
        "Prefer unknown over any for untrusted values, and narrow before use. An `as` assertion changes nothing at runtime.",
        "For Node's type stripping, keep to erasable syntax (erasableSyntaxOnly), use import type and real extensions, and keep tsc for the checking.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is the difference between interface and type?\" Strong answer: both describe object shapes; interfaces can extend and merge declarations, type aliases can name unions, tuples and computed types; choose by convention, and know the one difference.",
        "\"What is the difference between any and unknown?\" Strong answer: any disables checking; unknown forces you to narrow before use, so it is the safe choice for external data.",
        "\"What is structural typing?\" Strong answer: compatibility depends on shape, not on declared names; with the excess property check as a special case for fresh object literals.",
        "\"What is a discriminated union and how do you handle all its cases?\" Strong answer: a union with a shared literal field (kind); switch on it so TypeScript narrows each branch, and use a never assignment in default to get an error when a case is missed.",
        "\"Do TypeScript types exist at runtime?\" Strong answer: no, they are erased, so API data needs runtime validation, and a type assertion does not check anything.",
      ],
    },
    {
      kind: "quiz",
      question: `A function is typed as taking an object with a numeric id. At runtime the server sends {"id": "7"}, and the code does id + 1. What happens?`,
      options: [
        "TypeScript throws an error at runtime, because the types do not match",
        "It produces the string 71, because the types were erased and nothing checked the data",
        "It produces 8, because JavaScript converts the string",
        "The program refuses to start",
      ],
      answer: 1,
      why: "Types are erased before running, so nothing verifies the server's data. The string \"7\" plus 1 concatenates to \"71\". A runtime check or validation library is what catches this.",
    },
    {
      kind: "quiz",
      question: "Which line is NOT erasable, so it fails with erasableSyntaxOnly and under Node's type stripping?",
      options: [
        "type Id = number;",
        "import type { User } from \"./user.ts\";",
        "enum Role { Admin, Member }",
        "const id: number = 4;",
      ],
      answer: 2,
      why: "An enum produces real runtime code (an object), so it cannot be removed by simply deleting types. Type aliases, type imports and annotations can all be erased.",
    },
    {
      kind: "quiz",
      question: `Given type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number }, what does TypeScript know inside the case "square": branch of switch (shape.kind)?`,
      options: [
        "shape is still the full union, so shape.side is an error",
        "shape is the square variant, so shape.side is allowed",
        "shape is any",
        "shape is never",
      ],
      answer: 1,
      why: "The kind field is a discriminant. Checking it narrows the union to the matching member, so in that branch shape.side is known to exist.",
    },
  ],
};
