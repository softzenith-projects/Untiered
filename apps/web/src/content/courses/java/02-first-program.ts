import type { Chapter } from "@/content/courses/types";

export const chapterFirstProgram: Chapter = {
  slug: "your-first-program",
  title: "Your First Program: the Anatomy of `main`",
  summary:
    "Every word in `public class Hello { public static void main(String[] args) { ... } }` explained, " +
    "and why leaving any of them out breaks the program in a specific, predictable way.",
  minutes: 10,
  blocks: [
    {
      kind: "p",
      text:
        "You typed five lines in the last chapter and ran them without knowing what most of the words " +
        "meant. That's normal — you don't read the owner's manual before you drive a car out of the " +
        "showroom either. This chapter opens the bonnet. By the end, every word in the program is one you " +
        "chose on purpose, not one you copied.",
    },
    { kind: "h", text: "The school register analogy" },
    {
      kind: "analogy",
      title: "A school register with one designated page",
      text:
        "Think of a Java class as a register — a bound notebook with a name on the cover. A register can " +
        "hold many kinds of entries (attendance, marks, remarks), but every school register has one page " +
        "that's checked first when the day begins: the cover page, which says whose register this is and " +
        "confirms it's the right one. `main` is that designated first page. When the JVM 'opens the " +
        "register' (runs your class), it doesn't read every page in order — it flips straight to the page " +
        "marked `main` and starts there. If a register has no such page, the JVM has nowhere to begin, and " +
        "refuses to open it at all. Where the analogy stops: a register can have several useful pages read " +
        "in any order by a person; a Java program can have many methods, but the JVM will only ever *start* " +
        "at `main` — everything else runs because `main`, directly or indirectly, calls it.",
    },
    { kind: "h", text: "Word by word" },
    {
      kind: "code",
      caption: "The full skeleton, with the roll-number program from the trace below.",
      code:
        "public class Anatomy {\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("Roll number: 21");\n' +
        '        System.out.print("Name: ");\n' +
        '        System.out.println("Aditi");\n' +
        '        System.out.println("Class: XII-B");\n' +
        "    }\n" +
        "}\n",
      output: "Roll number: 21\nName: Aditi\nClass: XII-B",
    },
    {
      kind: "table",
      head: ["Word", "What it means here"],
      rows: [
        [
          "public class Anatomy",
          "Declares a class named Anatomy, visible from outside this file. A `public` class must live " +
            "in a file with the *exact same name*: `Anatomy.java`. This is a rule the compiler enforces, " +
            "not a convention.",
        ],
        [
          "public",
          "(on main) Visible to anyone, including the JVM launcher standing outside your program — it " +
            "has to be able to see `main` to call it. `private static void main` would compile, but the " +
            "JVM could not reach it, and the program would refuse to start.",
        ],
        [
          "static",
          "Belongs to the class itself, not to any particular object. The JVM calls `main` before a " +
            "single object of your class exists, so `main` cannot require one — it has to be reachable " +
            "'from the register's cover,' without opening to any specific student's page first.",
        ],
        [
          "void",
          "Returns nothing back to whoever called it. `main` reports success or failure to the operating " +
            "system through its *exit code*, not through a returned value — that's a separate mechanism " +
            "(`System.exit(code)`), not something you write after `return`.",
        ],
        [
          "main",
          "The exact name the JVM looks for. Not a convention — spell it `Main` with a capital M and the " +
            "JVM will report it cannot find a main method, even though the file compiles perfectly.",
        ],
        [
          "String[] args",
          "Command-line arguments, as an array of text. Run `java Anatomy hello world` and `args` holds " +
            "`[\"hello\", \"world\"]`. Empty, but present, if you pass nothing — this is why the parameter " +
            "must exist even when a program ignores it.",
        ],
      ],
    },
    { kind: "h", text: "`System.out.println` vs `System.out.print`" },
    {
      kind: "p",
      text:
        "`System` is a built-in class; `out` is its 'standard output' stream — your terminal window. " +
        "`println` writes text and then moves to a new line, the way pressing Enter after writing a line " +
        "in a register moves you to the next line for the next entry. `print` writes text and *stays* on " +
        "the same line, which is why `System.out.print(\"Name: \")` followed by `System.out.println(\"Aditi\")` " +
        "produced `Name: Aditi` on one line in the trace below, rather than on two.",
    },
    {
      kind: "viz",
      title: "Reading the four print statements in order",
      caption: "Each line in the box is a completed output line; a line still being built (no line break yet) shows as the newest, unfinished entry.",
      viz: {
        type: "queue",
        frames: [
          {
            items: ["Roll number: 21"],
            note: "`System.out.println(\"Roll number: 21\")` writes the text, then starts a new line.",
          },
          {
            items: ["Roll number: 21", "Name: "],
            note: "`System.out.print(\"Name: \")` writes the text but does *not* start a new line — the cursor stays right after the colon and space.",
          },
          {
            items: ["Roll number: 21", "Name: Aditi"],
            note: "`System.out.println(\"Aditi\")` writes `Aditi` right where the cursor was — continuing the same line — and *then* starts a new line. The line now reads `Name: Aditi`.",
          },
          {
            items: ["Roll number: 21", "Name: Aditi", "Class: XII-B"],
            note:
              "`System.out.println(\"Class: XII-B\")` writes the text on its own new line, then starts " +
              "another. Final output is three lines, even though four statements ran.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        'Change `System.out.print("Name: ")` to `println` and run. The name drops onto its own line, and ' +
        "that is the whole difference between the two.",
      starter:
        "public class Anatomy {\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("Roll number: 21");\n' +
        '        System.out.print("Name: ");\n' +
        '        System.out.println("Aditi");\n' +
        '        System.out.println("Class: XII-B");\n' +
        "    }\n" +
        "}\n",
      expectedOutput:
        "Roll number: 21\n" +
        "Name: Aditi\n" +
        "Class: XII-B",
    },
    {
      kind: "pitfall",
      items: [
        "Naming the file differently from the public class. `class Anatomy` must live in `Anatomy.java` " +
          "— `javac` will refuse to compile `MyFile.java` if it declares `public class Anatomy`.",
        "Misspelling or mis-capitalising `main`, or writing `void Main` or `static void main()` with no " +
          "`String[] args` for a program meant to be launched directly. The compiler is fine with a " +
          "missing or misspelled `main` — it simply won't compile if you call it that as a normal method " +
          "elsewhere — but the *launcher* will refuse to start the class, with an error naming exactly " +
          "what signature it expected.",
        "Expecting `print` to move to a new line. If two `print` calls run back to back with no " +
          "`println`, their text lands on the same line, jammed together with no space unless you added " +
          "one yourself.",
      ],
    },
    {
      kind: "remember",
      items: [
        "public class name must exactly match the file name — `Anatomy` lives in `Anatomy.java`.",
        "`main` is the JVM's one fixed entry point: `public static void main(String[] args)`, spelled " +
          "exactly that way.",
        "`static` on main = callable without creating an object first; the JVM has no object to call it on.",
        "`println` ends the line; `print` doesn't. \"println = print + new Line.\"",
        "`args` holds command-line words as text; it's empty, never absent, when you pass none.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Why is `main` static?\" is a near-guaranteed early question — answer with the 'no object " +
          "exists yet' reasoning, not just \"because it has to be.\"",
        "\"What happens if you remove `public` from `main`?\" tests whether you understand access " +
          "modifiers as visibility to the *caller* — here, the JVM launcher — not just a keyword to " +
          "memorise.",
        "\"Can a Java file have more than one public class?\" often follows — the answer is no, at most " +
          "one, and it must match the filename; other, non-public classes may share the file freely.",
      ],
    },
    {
      kind: "quiz",
      question: "A file named `Register.java` contains `public class Attendance { ... }`. What happens?",
      options: [
        "It compiles and runs fine — file names and class names are unrelated in Java.",
        "It fails to compile: a public class must be declared in a file with the same name.",
        "It compiles but the JVM cannot find `main` inside it.",
        "It compiles only if `Attendance` is declared `static`.",
      ],
      answer: 1,
      why:
        "`javac` enforces this rule at compile time, before the code is ever run: a `public` class named " +
        "`Attendance` must live in `Attendance.java`, not `Register.java`.",
    },
    {
      kind: "quiz",
      question: "Why must `main` be declared `static`?",
      options: [
        "Purely a style convention that most programmers follow, with no technical reason behind it.",
        "Because the JVM calls main before any object exists, and static members can be called without an object.",
        "Because static methods run faster than non-static ones, and main has to start the program quickly.",
        "Because every void method in a class is required by the compiler to also be static.",
      ],
      answer: 1,
      why:
        "The JVM's very first move is to call `main` — there is no object yet for it to call a non-static " +
        "method on. `static` is exactly the keyword that means 'reachable without an object.'",
    },
    {
      kind: "quiz",
      question:
        "Given `System.out.print(\"A\"); System.out.println(\"B\"); System.out.println(\"C\");` what is printed?",
      options: ["A\nB\nC", "AB\nC", "A B\nC", "ABC"],
      answer: 1,
      why:
        "`print(\"A\")` writes A with no line break. `println(\"B\")` continues on the same line — giving " +
        "`AB` — then breaks the line. `println(\"C\")` then writes C on its own new line.",
    },
  ],
};
