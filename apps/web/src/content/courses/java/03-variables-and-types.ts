import type { Chapter } from "@/content/courses/types";

export const chapterVariablesAndTypes: Chapter = {
  slug: "variables-and-data-types",
  title: "Variables and Data Types",
  summary:
    "Naming a box of memory, the eight primitive types and their sizes, and why `String` is not one of them.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "In the last chapter every word we printed was fixed at the moment you wrote the program — " +
        "`\"Aditi\"` never changes while the program runs. Almost no real program is that static: a " +
        "calculator needs to hold whatever numbers you type, a game needs to remember your score as it " +
        "goes up. Java needs a way to set aside a labelled spot in memory, put a value in it, and read or " +
        "change that value later. That labelled spot is a **variable**.",
    },
    { kind: "h", text: "The steel-trunk analogy" },
    {
      kind: "analogy",
      title: "A labelled steel trunk, sized for what goes in it",
      text:
        "Imagine the steel trunk every hostel student keeps under their bed. Before you buy one, you " +
        "decide what it's *for* — a small trunk for stationery, a large one for clothes and blankets — " +
        "because the size determines the cost and the space it takes. You also write your name on it, so " +
        "nobody confuses your trunk with your roommate's. A Java variable works the same way: `int age = " +
        "17;` buys a specific-sized 'trunk' (4 bytes, because `int` is always 4 bytes, everywhere, on every " +
        "machine — unlike a C `int`, whose size can vary), labels it `age`, and puts `17` inside. Later, " +
        "`age = 18;` opens the same trunk and replaces what's inside — the label and the size don't change, " +
        "only the contents. Where the analogy stops working: you can't shove a blanket into a stationery " +
        "trunk, but Java is stricter still — you cannot put a decimal number into an `int` trunk at all " +
        "without explicitly saying you accept the loss (that's the next-but-one chapter, type casting).",
    },
    { kind: "h", text: "The eight primitive types" },
    {
      kind: "p",
      text:
        "Java has exactly eight **primitive types** — the smallest, most basic kinds of value, built into " +
        "the language rather than defined as classes. Their sizes are fixed by the Java language " +
        "specification and identical on every machine that runs Java, which is part of what makes " +
        "write-once-run-anywhere possible: a program that computes with an `int` gets the same range of " +
        "values whether it runs on a laptop or a phone.",
    },
    {
      kind: "table",
      head: ["Type", "Holds", "Size", "Example", "Default value"],
      rows: [
        ["byte", "Whole number, small range", "1 byte (8 bits)", "-128 to 127", "0"],
        ["short", "Whole number", "2 bytes", "-32,768 to 32,767", "0"],
        ["int", "Whole number — the default choice", "4 bytes", "about ±2.1 billion", "0"],
        ["long", "Whole number, large range (needs an `L` suffix)", "8 bytes", "10000000000L", "0L"],
        ["float", "Decimal number, less precise (needs an `f` suffix)", "4 bytes", "3.14f", "0.0f"],
        ["double", "Decimal number — the default choice", "8 bytes", "3.14159", "0.0"],
        ["char", "One single character, in single quotes", "2 bytes", "'A'", "'\\u0000'"],
        ["boolean", "true or false only", "1 bit (in practice, JVM-dependent)", "true", "false"],
      ],
    },
    {
      kind: "p",
      text:
        "Two practical rules follow directly from this table. First: for whole numbers, reach for `int` " +
        "unless you specifically need a bigger range (`long`, for something like a population count or a " +
        "timestamp in milliseconds) or are deliberately saving memory across a huge array (`byte`/`short`). " +
        "Second: for decimals, reach for `double` unless you have a specific reason for `float` — `double` " +
        "is what every method in Java's own Math class expects and returns.",
    },
    { kind: "h", text: "`String` is not a primitive" },
    {
      kind: "p",
      text:
        "You'll notice `String` isn't in that table of eight. A `String` (text, like `\"Rohan\"`) is a " +
        "**reference type** — technically a class, `java.lang.String`, that Java gives special convenience " +
        "for (like writing `\"hello\"` directly instead of constructing it the long way). A variable of a " +
        "primitive type holds the actual value in its trunk; a variable of a reference type holds " +
        "*directions to where the real object lives* elsewhere in memory. This distinction becomes " +
        "important later, once you start passing variables into methods — a primitive's copy is " +
        "independent, a reference's copy still points at the same object. For now, it's enough to know: " +
        "`String` behaves like text everywhere you'll use it in this module, but under the hood it is not " +
        "one of the eight primitives.",
    },
    {
      kind: "code",
      caption: "Declaring, printing and reassigning variables of several types — a complete program.",
      code:
        "public class Variables {\n" +
        "    public static void main(String[] args) {\n" +
        "        int age = 17;\n" +
        "        double height = 165.5;\n" +
        "        char grade = 'A';\n" +
        "        boolean passed = true;\n" +
        '        String name = "Rohan";\n' +
        "\n" +
        '        System.out.println(name + " is " + age + " years old.");\n' +
        '        System.out.println("Height: " + height + " cm, Grade: " + grade);\n' +
        '        System.out.println("Passed: " + passed);\n' +
        "\n" +
        "        int rollNumber = 21;\n" +
        "        rollNumber = rollNumber + 1;\n" +
        '        System.out.println("New roll number: " + rollNumber);\n' +
        "\n" +
        "        final double PI = 3.14159;\n" +
        '        System.out.println("Pi is approximately " + PI);\n' +
        "    }\n" +
        "}\n",
      output:
        "Rohan is 17 years old.\n" +
        "Height: 165.5 cm, Grade: A\n" +
        "Passed: true\n" +
        "New roll number: 22\n" +
        "Pi is approximately 3.14159",
    },
    {
      kind: "viz",
      title: "What happens to `rollNumber`",
      caption: "One box, one variable — its contents change; the box itself, and its name, never do.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 21, pointers: ["rollNumber"] }],
            note: "`int rollNumber = 21;` — a 4-byte trunk labelled `rollNumber` is created and filled with 21.",
          },
          {
            cells: [{ value: 21, state: "active", pointers: ["rollNumber"] }],
            note: "`rollNumber = rollNumber + 1;` — the *right-hand side* is computed first: read the current value (21), add 1, getting 22.",
          },
          {
            cells: [{ value: 22, state: "done", pointers: ["rollNumber"] }],
            note: "The result, 22, is then stored back into the same trunk, replacing 21. The trunk is still called `rollNumber`; only its contents changed.",
          },
          {
            cells: [{ value: 22, pointers: ["rollNumber"] }],
            note: "`System.out.println(\"New roll number: \" + rollNumber)` reads the current contents — 22 — and prints it.",
          },
        ],
      },
    },
    { kind: "h", text: "`final` — a trunk you lock after filling" },
    {
      kind: "p",
      text:
        "`final double PI = 3.14159;` declares a variable that can be assigned *once*. Attempting " +
        "`PI = 3.2;` afterwards is a compile-time error, not a runtime surprise — the compiler catches it " +
        "before the program ever runs. Constants like this are conventionally written in ALL_CAPS so " +
        "anyone reading the code can tell at a glance that it never changes.",
    },
    {
      kind: "pitfall",
      items: [
        "Using a variable before giving it a value. Unlike a class field, a *local* variable (one " +
          "declared inside a method) has no automatic default — `int x; System.out.println(x);` is a " +
          "compile error, \"variable x might not have been initialized\", not a silent zero.",
        "Overflowing a small type. `byte b = 130;` fails to compile — 130 is outside `byte`'s -128..127 " +
          "range. This is Java catching a mistake at compile time that some languages would let slide " +
          "into a wrapped-around wrong answer at run time.",
        "Forgetting the `f` on a `float` literal. `float f = 3.14;` fails to compile, because `3.14` by " +
          "itself is a `double` literal, and a `double` cannot be narrowed into a `float` without an " +
          "explicit cast — write `3.14f` or cast it.",
        "Mixing up `=` (assignment — \"put this value in\") with `==` (comparison — \"are these equal?\"), " +
          "which is a habit from ordinary English, not from any other language you've used, since this " +
          "is usually the first one.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Eight primitives: byte, short, int, long, float, double, char, boolean — \"Big Sharks In " +
          "Little Fish Don't Care, Basically\" if you want a memory hook, though most people just learn " +
          "the table.",
        "`int` for whole numbers, `double` for decimals — the two defaults, unless you have a specific " +
          "reason otherwise.",
        "`String` is a class (a reference type), not one of the eight primitives, even though it behaves " +
          "like a basic type in everyday code.",
        "A local variable has no default value — you must initialise it before reading it.",
        "`final` = assign once, then locked; the compiler enforces it, not a runtime check.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between primitive and reference types?\" — answer with what the " +
          "variable actually holds: the value itself, versus directions to an object elsewhere.",
        "\"Why isn't String a primitive?\" comes up often precisely because it's used like one — the " +
          "honest answer is that it's a class with language-level convenience, not that it behaves " +
          "identically to `int`.",
        "You may be asked to name all eight primitives and their sizes from memory — this is genuinely " +
          "worth memorising cold, not looking up mid-interview.",
      ],
    },
    {
      kind: "quiz",
      question: "What happens when `int score;` is declared inside `main` and then printed without being assigned a value?",
      options: [
        "It prints 0, because Java gives every int variable the default value of zero.",
        "It compiles and prints an unpredictable garbage value left over in memory.",
        "It fails to compile: a local variable must be initialised before it is read.",
        "It prints null, since an uninitialised variable holds no value at all.",
      ],
      answer: 2,
      why:
        "Default values (0, false, null, ...) apply to fields of a class, not to local variables inside " +
        "a method. A local variable read before assignment is a compile-time error in Java, by design.",
    },
    {
      kind: "quiz",
      question: "Which declaration fails to compile?",
      options: ["long big = 10000000000L;", "double d = 3.14;", "float f = 3.14;", "byte b = 100;"],
      answer: 2,
      why:
        "`3.14` on its own is a `double` literal. Assigning a `double` to a `float` variable would lose " +
        "precision, so Java requires an explicit `f` suffix (`3.14f`) or a cast — without it, this line " +
        "does not compile.",
    },
    {
      kind: "quiz",
      question: "What best describes a `String` variable in Java?",
      options: [
        "A ninth primitive type, which Java adds to the other eight for working with text.",
        "A reference type: the variable holds directions to a String object, not the characters themselves.",
        "Exactly identical in behaviour to char, except that it can hold more than one character.",
        "A primitive type that Java sometimes treats specially, so that it is stored directly in the variable.",
      ],
      answer: 1,
      why:
        "`String` is `java.lang.String`, a class. A `String` variable is a reference — it points to where " +
        "the actual character data lives — which is why it's grouped with reference types, not the eight " +
        "primitives.",
    },
  ],
};
