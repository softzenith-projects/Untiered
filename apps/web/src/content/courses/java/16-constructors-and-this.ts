import type { Chapter } from "@/content/courses/types";

export const chapterConstructorsAndThis: Chapter = {
  slug: "constructors-and-this",
  title: "Constructors and this",
  summary:
    "A constructor is the special method that sets an object up the instant it's born; this is how a class " +
    "refers to \"the object currently running this code\" when a parameter's name shadows a field.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "In the last chapter, `new Student()` followed by three lines of `s1.name = ...` worked, but it's " +
        "clunky and easy to forget a field. Java gives every class a way to hand it complete, valid starting " +
        "data at the exact moment it's created — a constructor.",
    },
    { kind: "h", text: "The move-in checklist analogy" },
    {
      kind: "analogy",
      title: "Moving into a new flat versus filling it in room by room",
      text:
        "Imagine getting the keys to an empty flat and, over the next week, slowly buying a bed, then a " +
        "fridge, then curtains — for a while the flat is only half set up. A **constructor** is the " +
        "alternative: a moving company that sets up everything — bed, fridge, curtains — in one visit, the " +
        "moment you get the keys, so the flat is fully livable from minute one. In code, this means " +
        "`Student(String name, int rollNumber) { this.name = name; this.rollNumber = rollNumber; }` runs " +
        "automatically the instant `new Student(\"Priya\", 12)` executes, so there is never a moment where " +
        "the object exists with only some of its fields set correctly. Where the analogy stops: a flat can " +
        "have several moving companies on call (**overloaded constructors** — different parameter lists for " +
        "different situations, like a default flat-pack setup versus a custom one), and one moving job can " +
        "call in a second one to do part of the work first (`this(...)`, seen below) — a single physical " +
        "move-in can't really do that.",
    },
    {
      kind: "code",
      caption: "Two constructors — one delegating to the other with this(...) — and using this.field to disambiguate.",
      code:
        "class Student {\n" +
        "    String name;\n" +
        "    int rollNumber;\n" +
        "\n" +
        "    Student() {\n" +
        '        this("Unnamed", 0);\n' +
        '        System.out.println("No-arg constructor ran, delegated to the two-arg one");\n' +
        "    }\n" +
        "\n" +
        "    Student(String name, int rollNumber) {\n" +
        "        this.name = name;\n" +
        "        this.rollNumber = rollNumber;\n" +
        '        System.out.println("Two-arg constructor ran for " + this.name);\n' +
        "    }\n" +
        "\n" +
        "    void print() {\n" +
        '        System.out.println(name + " (Roll " + rollNumber + ")");\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class ConstructorsDemo {\n" +
        "    public static void main(String[] args) {\n" +
        '        Student s1 = new Student("Priya", 12);\n' +
        "        Student s2 = new Student();\n" +
        "\n" +
        "        s1.print();\n" +
        "        s2.print();\n" +
        "    }\n" +
        "}\n",
      output:
        "Two-arg constructor ran for Priya\n" +
        "Two-arg constructor ran for Unnamed\n" +
        "No-arg constructor ran, delegated to the two-arg one\n" +
        "Priya (Roll 12)\n" +
        "Unnamed (Roll 0)",
    },
    {
      kind: "p",
      text:
        "A constructor has no return type — not even `void` — and its name is always exactly the class " +
        "name. `this.name = name;` inside the two-arg constructor solves a naming clash: the parameter is " +
        "also called `name`, so plain `name = name;` would just assign the parameter to itself and leave the " +
        "field untouched. `this` means \"the object this constructor is currently building\", so `this.name` " +
        "unambiguously means the field. `this(\"Unnamed\", 0);` as the very first line of the no-arg " +
        "constructor calls the other constructor on the same object being built — this is **constructor " +
        "chaining**, and Java requires the `this(...)` call to be the first statement if used at all. Notice " +
        "the output order: the two-arg constructor's print line appears for `s2` *before* the no-arg " +
        "constructor's own print line — the delegated call fully finishes first.",
    },
    { kind: "h", text: "The default constructor" },
    {
      kind: "p",
      text:
        "Every class you've written without an explicit constructor — including `Student` in the last " +
        "chapter — still had one: if you write *no* constructor at all, Java silently supplies a no-argument " +
        "**default constructor** that does nothing beyond the automatic field defaults. The moment you write " +
        "even one constructor yourself, that free default disappears — `new Student()` with no matching " +
        "constructor becomes a compile error, unless you also write a no-arg constructor explicitly, exactly " +
        "as `Student()` does above.",
    },
    {
      kind: "viz",
      title: "Why s2's constructor prints appear in this exact order",
      caption: "The no-arg constructor's own frame stays on the stack, paused, for as long as the two-arg constructor it delegated to is running.",
      viz: {
        type: "callstack",
        frames: [
          { stack: [{ label: "no-arg Student()", state: "active" }], note: "new Student() calls the no-arg constructor." },
          {
            stack: [{ label: "no-arg Student()" }, { label: "this(\"Unnamed\", 0)", state: "active" }],
            note: "Its first line, this(\"Unnamed\", 0), immediately hands control to the two-arg constructor — the no-arg constructor's own code pauses right there.",
          },
          {
            stack: [{ label: "no-arg Student()" }, { label: "this(\"Unnamed\", 0)", state: "returning" }],
            note: "The two-arg constructor runs fully: sets fields, then prints 'Two-arg constructor ran for Unnamed'.",
          },
          {
            stack: [{ label: "no-arg Student()", state: "active" }],
            note: "Control returns to the no-arg constructor, which resumes on its next line and prints its own message.",
          },
          {
            stack: [{ label: "no-arg Student()", state: "returning" }],
            note: "Only now is the Student object considered fully constructed and returned to s2.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        'Delete `this("Unnamed", 0);` from the no-argument constructor and run. `s2` now prints `null ' +
        "(Roll 0)`: those are the values a field holds when nobody sets it.",
      starter:
        "public class ConstructorsDemo {\n" +
        "    public static void main(String[] args) {\n" +
        '        Student s1 = new Student("Priya", 12);\n' +
        "        Student s2 = new Student();\n" +
        "\n" +
        "        s1.print();\n" +
        "        s2.print();\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Student {\n" +
        "    String name;\n" +
        "    int rollNumber;\n" +
        "\n" +
        "    Student() {\n" +
        '        this("Unnamed", 0);\n' +
        '        System.out.println("No-arg constructor ran, delegated to the two-arg one");\n' +
        "    }\n" +
        "\n" +
        "    Student(String name, int rollNumber) {\n" +
        "        this.name = name;\n" +
        "        this.rollNumber = rollNumber;\n" +
        '        System.out.println("Two-arg constructor ran for " + this.name);\n' +
        "    }\n" +
        "\n" +
        "    void print() {\n" +
        '        System.out.println(name + " (Roll " + rollNumber + ")");\n' +
        "    }\n" +
        "}\n",
      expectedOutput:
        "Two-arg constructor ran for Priya\n" +
        "Two-arg constructor ran for Unnamed\n" +
        "No-arg constructor ran, delegated to the two-arg one\n" +
        "Priya (Roll 12)\n" +
        "Unnamed (Roll 0)",
    },
    {
      kind: "pitfall",
      items: [
        "Writing `name = name;` instead of `this.name = name;` when a parameter shares a field's name — " +
          "this compiles, but silently does nothing to the field, leaving it at its default.",
        "Giving a constructor a return type by mistake (`void Student(...)`) — this makes it a regular " +
          "method named `Student`, not a constructor, and it will not run automatically on `new`.",
        "Assuming a default no-arg constructor still exists after adding a custom constructor — it doesn't, " +
          "unless written explicitly.",
        "Putting statements before `this(...)` in a chained constructor — it must be the very first line.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A constructor shares the class's exact name and has no return type, not even void.",
        "It runs automatically and exactly once, the moment new creates an object.",
        "this.field disambiguates a field from a same-named parameter or local variable.",
        "this(...) chains to another constructor of the same class and must be the first statement.",
        "Writing any constructor removes the free default no-arg one — add your own if you still need it.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Can a constructor be private?\" comes up — yes, and it's exactly how the Singleton pattern " +
          "stops outside code from calling new directly.",
        "\"What's the difference between a constructor and a method?\" — name/class match, no return type, " +
          "and it runs only via new, never called directly like `obj.Student()`.",
        "Tracing constructor-chaining output, as in the trace above, is a common \"predict the output\" " +
          "question — the delegated constructor always finishes before the caller resumes.",
      ],
    },
    {
      kind: "quiz",
      question: "Inside a constructor, what does `this.rollNumber = rollNumber;` do if the parameter is also named rollNumber?",
      options: [
        "Nothing — it's a no-op",
        "Assigns the parameter's value to the object's field",
        "Fails to compile — duplicate names",
        "Assigns the field's old value back to the parameter",
      ],
      answer: 1,
      why:
        "this.rollNumber refers to the field on the object being built; plain rollNumber (on the right) " +
        "refers to the parameter. This line correctly copies the incoming argument into the field.",
    },
    {
      kind: "quiz",
      question: "If a class defines only `Student(String name, int rollNumber)`, what happens with `new Student()`?",
      options: [
        "It compiles and uses default values",
        "It compiles because Java always keeps a no-arg constructor available",
        "Compile error — no matching constructor",
        "It runs but prints null for name",
      ],
      answer: 2,
      why:
        "Defining any constructor removes the automatically supplied no-arg default. Without a matching " +
        "Student() defined explicitly, new Student() has nothing to call and fails to compile.",
    },
    {
      kind: "quiz",
      question: "In a chained constructor, where must this(...) appear?",
      options: [
        "Anywhere in the constructor body",
        "As the very first statement",
        "As the very last statement",
        "It can't be used inside a constructor",
      ],
      answer: 1,
      why:
        "Java requires an explicit constructor call via this(...) (or super(...)) to be the first " +
        "statement, so the object's other constructor logic runs before anything else in this one.",
    },
  ],
};
