import type { Chapter } from "@/content/courses/types";

export const chapterMethods: Chapter = {
  slug: "methods",
  title: "Methods: Parameters, Return, Overloading, Pass-by-Value",
  summary:
    "Packaging code into reusable, named blocks; overloading the same name for different inputs; and the " +
    "single most misunderstood rule in the language — Java is always pass-by-value.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "You've been calling methods since chapter one — `System.out.println`, `name.length()`, " +
        "`sb.append()` are all methods someone else wrote. This chapter is about writing your own: naming " +
        "a reusable block of code, handing it inputs, and getting an answer back — instead of copy-" +
        "pasting the same five lines of `square` calculation every time you need it.",
    },
    { kind: "h", text: "The tiffin-order counter analogy" },
    {
      kind: "analogy",
      title: "Placing an order at a tiffin counter",
      text:
        "At a tiffin counter, you don't cook your own food — you place an order (\"two rotis, one dal\"), " +
        "hand over the order slip, and the cook, who has a fixed procedure, returns a packed tiffin box. " +
        "You never see the cooking itself; you only give inputs and receive an output. A **method** is " +
        "exactly this arrangement: `square(5)` is an order slip with one value on it (5); `static int " +
        "square(int n) { return n * n; }` is the fixed procedure — take whatever comes in as `n`, compute, " +
        "hand back a result. The caller doesn't need to know *how* the method computes its answer, only " +
        "what to send it and what it sends back. Where the analogy stops: a tiffin counter can only make " +
        "one dish per name on the menu; Java lets you have several *different* procedures sharing the same " +
        "name, as long as their order slips look different — which is exactly what overloading is.",
    },
    { kind: "h", text: "Parameters, return values, overloading" },
    {
      kind: "code",
      caption:
        "Overloaded square() and add() — a snippet, not a full program; the four static methods and the " +
        "commented calls below are inside one runnable class with a normal main().",
      code:
        "static int square(int n) {\n" +
        "    return n * n;\n" +
        "}\n" +
        "\n" +
        "static double square(double n) {\n" +
        "    return n * n;\n" +
        "}\n" +
        "\n" +
        "static int add(int a, int b) {\n" +
        "    return a + b;\n" +
        "}\n" +
        "\n" +
        "static int add(int a, int b, int c) {\n" +
        "    return a + b + c;\n" +
        "}\n" +
        "\n" +
        '// System.out.println("square(5) = " + square(5));        // 25\n' +
        '// System.out.println("square(2.5) = " + square(2.5));    // 6.25\n' +
        '// System.out.println("add(2,3) = " + add(2, 3));         // 5\n' +
        '// System.out.println("add(2,3,4) = " + add(2, 3, 4));    // 9\n',
      output: "square(5) = 25\nsquare(2.5) = 6.25\nadd(2,3) = 5\nadd(2,3,4) = 9",
    },
    {
      kind: "p",
      text:
        "Two methods can share the exact name `square` because Java tells them apart by their " +
        "**signature** — the name plus the type and number of parameters. `square(int)` and " +
        "`square(double)` are different signatures, so both can coexist; the compiler picks whichever one " +
        "matches the argument you actually pass. This is **method overloading**. It's not the same as " +
        "return type alone — two methods with the same name and same parameter types but *different* " +
        "return types is a compile error; the return type by itself doesn't distinguish a signature.",
    },
    {
      kind: "p",
      text:
        "`return n * n;` sends a value back to the caller and immediately ends the method — any code after " +
        "a `return` in the same branch never runs. A method declared `void` (like `main` itself) returns " +
        "nothing and may use a bare `return;` only to exit early, never `return someValue;`.",
    },
    { kind: "h", text: "Pass-by-value: Java's one universal rule" },
    {
      kind: "p",
      text:
        "This is the part that trips up almost everyone once, usually badly. **Java is always pass-by-" +
        "value.** When you call a method, Java copies the value of each argument into the method's " +
        "parameter — the method works with its own copy, never the caller's original variable. For a " +
        "primitive like `int`, this is intuitive: changing the copy obviously can't change the original " +
        "number sitting in the caller. The confusion starts with arrays and objects, because what gets " +
        "copied for those is a *reference* — directions to the object — and copying the directions still " +
        "leaves both copies pointing at the *same actual object*.",
    },
    {
      kind: "code",
      caption:
        "The same test performed on an int, and on an array — with opposite-looking results. A snippet " +
        "from a full runnable program; the two methods and the main() calls below both compiled and ran.",
      code:
        "static void doubleValue(int x) {\n" +
        "    x = x * 2;\n" +
        '    System.out.println("Inside doubleValue, x = " + x);\n' +
        "}\n" +
        "\n" +
        "static void doubleFirstElement(int[] arr) {\n" +
        "    arr[0] = arr[0] * 2;\n" +
        '    System.out.println("Inside doubleFirstElement, arr[0] = " + arr[0]);\n' +
        "}\n" +
        "\n" +
        "int number = 10;\n" +
        "doubleValue(number);\n" +
        'System.out.println("After doubleValue, number = " + number);\n' +
        "\n" +
        "int[] data = {10, 20, 30};\n" +
        "doubleFirstElement(data);\n" +
        'System.out.println("After doubleFirstElement, data[0] = " + data[0]);\n',
      output:
        "Inside doubleValue, x = 20\n" +
        "After doubleValue, number = 10\n" +
        "Inside doubleFirstElement, arr[0] = 20\n" +
        "After doubleFirstElement, data[0] = 20",
    },
    {
      kind: "viz",
      title: "doubleValue(number) — a copied int never affects the caller's variable",
      caption: "number and x are two independent boxes that merely started out equal.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 10, pointers: ["number (main)"] }],
            note: "Before the call: number, in main, holds 10.",
          },
          {
            cells: [{ value: 10, pointers: ["number (main)"] }, { value: 10, state: "active", pointers: ["x (method)"] }],
            note: "`doubleValue(number)`: Java copies the *value* 10 into the parameter x. x and number are now two completely independent int variables that happen to start equal.",
          },
          {
            cells: [{ value: 10, state: "done", pointers: ["number (main)"] }, { value: 20, state: "active", pointers: ["x (method)"] }],
            note: "Inside the method, `x = x * 2;` changes x to 20 — but this only touches the local copy. number, back in main, was never touched.",
          },
        ],
      },
    },
    {
      kind: "viz",
      title: "doubleFirstElement(data) — a copied reference still points at the same object",
      caption: "data and arr are two independent boxes too, but this time both boxes hold directions to the same array — so a change through arr is visible through data.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 10, pointers: ["data[0] / arr[0]"] }],
            note: "`doubleFirstElement(data)`: Java copies the *reference* — the directions to the array object — into the parameter arr. arr and data are two separate variables, but they both point at the exact same array object in memory.",
          },
          {
            cells: [{ value: 20, state: "active", pointers: ["data[0] / arr[0]"] }],
            note: "Inside the method, `arr[0] = arr[0] * 2;` doesn't reassign the variable arr — it reaches through the reference and modifies the *object itself*, the shared array.",
          },
          {
            cells: [{ value: 20, state: "done", pointers: ["data[0] / arr[0]"] }],
            note: "Because data still points at that same object, `data[0]` in main reflects the change: 20, not 10.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The precise statement, which is worth memorising exactly: **the reference itself is passed by " +
        "value — a copy of the reference, not a copy of the object.** Reassigning the parameter (`arr = " +
        "new int[]{1,2,3};`) inside the method would *not* affect the caller's variable, because that only " +
        "changes what the local copy of the reference points to. But *modifying the object through the " +
        "reference* (`arr[0] = ...`, or calling a method on it that changes its state) is visible to the " +
        "caller, because both references point at the one shared object.",
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "Add a fourth `add` overload that takes four numbers, and call it from `main`. Then try `add(2.5, " +
        "3)` and read why Java can't find a method that matches.",
      starter:
        "public class Methods {\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("square(5) = " + square(5));\n' +
        '        System.out.println("square(2.5) = " + square(2.5));\n' +
        '        System.out.println("add(2,3) = " + add(2, 3));\n' +
        '        System.out.println("add(2,3,4) = " + add(2, 3, 4));\n' +
        "\n" +
        "        int number = 10;\n" +
        "        doubleValue(number);\n" +
        '        System.out.println("After doubleValue, number = " + number);\n' +
        "\n" +
        "        int[] data = {10, 20, 30};\n" +
        "        doubleFirstElement(data);\n" +
        '        System.out.println("After doubleFirstElement, data[0] = " + data[0]);\n' +
        "    }\n" +
        "\n" +
        "    static int square(int n) {\n" +
        "        return n * n;\n" +
        "    }\n" +
        "\n" +
        "    static double square(double n) {\n" +
        "        return n * n;\n" +
        "    }\n" +
        "\n" +
        "    static int add(int a, int b) {\n" +
        "        return a + b;\n" +
        "    }\n" +
        "\n" +
        "    static int add(int a, int b, int c) {\n" +
        "        return a + b + c;\n" +
        "    }\n" +
        "\n" +
        "    static void doubleValue(int x) {\n" +
        "        x = x * 2;\n" +
        '        System.out.println("Inside doubleValue, x = " + x);\n' +
        "    }\n" +
        "\n" +
        "    static void doubleFirstElement(int[] arr) {\n" +
        "        arr[0] = arr[0] * 2;\n" +
        '        System.out.println("Inside doubleFirstElement, arr[0] = " + arr[0]);\n' +
        "    }\n" +
        "}\n",
      expectedOutput:
        "square(5) = 25\n" +
        "square(2.5) = 6.25\n" +
        "add(2,3) = 5\n" +
        "add(2,3,4) = 9\n" +
        "Inside doubleValue, x = 20\n" +
        "After doubleValue, number = 10\n" +
        "Inside doubleFirstElement, arr[0] = 20\n" +
        "After doubleFirstElement, data[0] = 20",
    },
    {
      kind: "pitfall",
      items: [
        "Saying \"objects are passed by reference in Java\" — imprecise, and the imprecision causes real " +
          "bugs. It's more accurate to say a *copy of the reference* is passed; whether a change is " +
          "visible outside the method depends on whether you mutated the shared object or just reassigned " +
          "the local variable.",
        "Expecting a primitive parameter's change to affect the caller's variable, as `doubleValue` " +
          "demonstrated it does not — primitives are always fully independent copies.",
        "Overloading two methods that differ *only* in return type, with identical parameter lists — this " +
          "is a compile error; the compiler cannot tell which one you meant from the call site alone.",
        "Forgetting a `return` on some path through a non-void method — Java requires every possible " +
          "path through the method body to return a value, and reports a compile error (\"missing return " +
          "statement\") if one doesn't.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A method's signature is its name plus parameter types (and count) — overloading needs a " +
          "different signature, not just a different body.",
        "Java is always pass-by-value — never pass-by-reference, for anything.",
        "For a primitive parameter, the value itself is copied — changes inside the method never escape it.",
        "For an object/array parameter, the reference is copied — both copies point at the same object, " +
          "so mutating it (not reassigning the parameter) is visible to the caller.",
        "Reassigning a reference parameter to a *new* object never affects the caller's original reference.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Is Java pass-by-value or pass-by-reference?\" is asked extremely often, and \"pass-by-value, " +
          "always — including for objects, where what's copied is the reference itself\" is the precise " +
          "answer interviewers are listening for.",
        "You may be handed a short snippet passing an array or object into a method and asked to predict " +
          "whether a change is visible after the call returns — practise the reasoning in the trace box, " +
          "not just the memorised rule.",
        "\"What is method overloading, and how does the compiler pick which overload to call?\" — answer " +
          "with the signature-matching idea, and that return type alone never disambiguates.",
      ],
    },
    {
      kind: "quiz",
      question: "After `void increment(int n) { n = n + 1; } int x = 5; increment(x);`, what is x?",
      options: ["5", "6", "It depends on the JVM.", "It fails to compile."],
      answer: 0,
      why:
        "int is a primitive — its value is copied into the parameter n. Changing n inside the method " +
        "changes only that local copy; the caller's x is completely untouched, and remains 5.",
    },
    {
      kind: "quiz",
      question:
        "`void addOne(int[] arr) { arr[0] = arr[0] + 1; } int[] data = {5}; addOne(data);` — what is data[0] afterward?",
      options: ["5", "6", "It fails to compile.", "It depends on the JVM."],
      answer: 1,
      why:
        "The reference to the array is copied, but both the copy (arr) and the original (data) point at " +
        "the same array object. arr[0] = arr[0] + 1 mutates that shared object directly, so the change is " +
        "visible through data too — data[0] becomes 6.",
    },
    {
      kind: "quiz",
      question: "Which pair of method declarations is a valid overload of each other?",
      options: [
        "int calc(int a) and double calc(int a)",
        "int calc(int a, int b) and int calc(double a, double b)",
        "int calc(int a) and int calc(int b)",
        "void calc(int a) and void calc(int a, int b) — invalid, because they must share a return type",
      ],
      answer: 1,
      why:
        "Overloading requires different parameter types or counts — the return type alone never " +
        "distinguishes an overload (ruling out the pair that differ only in return type), and a parameter's *name* is irrelevant " +
        "to its signature (ruling out the pair that differ only in parameter names). calc(int,int) and calc(double,double) genuinely differ " +
        "in parameter type, so they're a valid overload pair.",
    },
  ],
};
