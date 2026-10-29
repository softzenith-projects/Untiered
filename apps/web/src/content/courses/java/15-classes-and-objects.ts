import type { Chapter } from "@/content/courses/types";

export const chapterClassesAndObjects: Chapter = {
  slug: "classes-and-objects",
  title: "Classes and Objects",
  summary:
    "The idea everything from here on is built on: a class is a blueprint you design once, and an object " +
    "is one real thing built from it — with its own data, separate from every other object of the same kind.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Every program you've written so far has had exactly one class holding `main`. That was never the " +
        "whole picture — it's what Java demands as an entry point, not the limit of what a class is for. " +
        "From here, most of your code is about modelling *things* — a student, a bank account, a bus ticket " +
        "— and Java's tool for modelling a thing is the class.",
    },
    { kind: "h", text: "The admission form analogy" },
    {
      kind: "analogy",
      title: "A blank admission form versus a filled-in one",
      text:
        "A school's admission form is printed once: blank boxes for name, roll number, marks — the same " +
        "layout for every student who will ever apply. The blank form itself teaches you nothing about any " +
        "particular student; it only defines *what kind of information* a student record holds and *what " +
        "you can do with one* (add it to the register, print it, look up the roll number). The moment a " +
        "real student fills one in — Priya, roll 12, 87 marks — you have a specific, filled-in record, " +
        "separate from every other student's form even though they used identically shaped paper. A " +
        "**class** is the blank form: it declares what data a thing of this kind has (**fields**) and what " +
        "it can do (**methods**), but holds no data of its own. An **object** is one filled-in form — " +
        "created from the class with `new`, holding its own actual values. Where the analogy stops: two " +
        "students can accidentally write identical details on their forms and still be different people " +
        "with different forms sitting in different files; two Java objects work the same way — even if " +
        "every field matches, they remain distinct objects unless a variable is deliberately pointed at the " +
        "same one.",
    },
    {
      kind: "code",
      caption: "A Student class and two independent Student objects, in one file.",
      code:
        "public class ClassesDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        Student s1 = new Student();\n" +
        '        s1.name = "Priya";\n' +
        "        s1.rollNumber = 12;\n" +
        "        s1.marks = 87;\n" +
        "\n" +
        "        Student s2 = new Student();\n" +
        '        s2.name = "Arjun";\n' +
        "        s2.rollNumber = 15;\n" +
        "        s2.marks = 91;\n" +
        "\n" +
        "        s1.printDetails();\n" +
        "        s2.printDetails();\n" +
        "\n" +
        '        System.out.println("s1 == s2: " + (s1 == s2));\n' +
        '        System.out.println("s1.marks after editing only s1: " + s1.marks);\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Student {\n" +
        "    String name;\n" +
        "    int rollNumber;\n" +
        "    int marks;\n" +
        "\n" +
        "    void printDetails() {\n" +
        '        System.out.println(name + " (Roll " + rollNumber + "): " + marks + " marks");\n' +
        "    }\n" +
        "}\n",
      output:
        "Priya (Roll 12): 87 marks\n" +
        "Arjun (Roll 15): 91 marks\n" +
        "s1 == s2: false\n" +
        "s1.marks after editing only s1: 87",
      tryIt: {
        language: "java",
        prompt:
          "The class with `main` comes first in this file, because the runner starts from the top. Make a " +
          "third student, `s3`, with your own name and marks, and print their details.",
      },
    },
    {
      kind: "p",
      text:
        "`Student` declares three fields — `name`, `rollNumber`, `marks` — and one method, `printDetails()`. " +
        "By itself the class creates nothing; `new Student()` is the step that actually builds an object in " +
        "memory, with its own copy of every field. `s1` and `s2` are two separate objects: changing " +
        "`s1.marks` never touches `s2.marks`, exactly as editing one student's admission form never touches " +
        "another's. The variable `s1` doesn't *hold* the object directly — it holds a reference (directions) " +
        "to where the object lives, which is why `s1 == s2` compares those directions and correctly reports " +
        "`false`: two different objects, even though both are `Student`s.",
    },
    { kind: "h", text: "Fields get sensible defaults" },
    {
      kind: "p",
      text:
        "If you create a `Student` and never set `marks`, it isn't garbage or undefined — Java initialises " +
        "every field to a default the moment the object is built: `0` for numeric types, `false` for " +
        "`boolean`, and `null` for any reference type (including `String`) — `null` meaning \"this variable " +
        "points at no object at all\". This is different from a local variable inside a method, which Java " +
        "refuses to let you read before you assign it. Fields are safer by default; the trade-off is that a " +
        "forgotten field silently reads as `0`/`false`/`null` instead of failing to compile.",
    },
    {
      kind: "viz",
      title: "What happens, step by step, when new Student() runs",
      caption: "Each row is one field of the object; a highlighted cell just received a new value.",
      viz: {
        type: "table",
        frames: [
          {
            rowLabels: ["name", "rollNumber", "marks"],
            colLabels: ["value"],
            rows: [["?"], ["?"], ["?"]],
            note: "Java reserves a block of memory big enough for one Student's fields: name, rollNumber, marks.",
          },
          {
            rowLabels: ["name", "rollNumber", "marks"],
            colLabels: ["value"],
            rows: [["null"], [0], [0]],
            highlight: [[0, 0], [1, 0], [2, 0]],
            note: "Every field gets its default value first: name = null, rollNumber = 0, marks = 0. The object now exists, unnamed, sitting in memory, and the reference to it is handed back and stored in the variable s1.",
          },
          {
            rowLabels: ["name", "rollNumber", "marks"],
            colLabels: ["value"],
            rows: [["Priya"], [0], [0]],
            highlight: [[0, 0]],
            note:
              "s1.name = \"Priya\"; reaches through the reference and overwrites the default null with " +
              "\"Priya\" — the object itself changes; s1 still points at the same object.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Confusing the class with an object — writing `Student.marks` and expecting it to mean something " +
          "without ever creating a `Student` with `new`. The class alone has no marks; only an object does.",
        "Assuming two objects with identical field values are `==`. They aren't, unless a variable was " +
          "explicitly assigned from another (`Student s3 = s1;`) — then `s3` and `s1` point at the same " +
          "object and `s3 == s1` is `true`.",
        "Forgetting that an uninitialised reference field is `null`, then calling a method on it — " +
          "`s1.name.length()` before `name` is ever set throws a `NullPointerException` at run time, not a " +
          "compile error.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A class is the blueprint (fields + methods); an object is one thing built from it with new.",
        "Every object gets its own independent copy of the class's fields.",
        "A variable holding an object actually holds a reference to it, not the object itself.",
        "Unset fields get defaults automatically: 0, false, or null — never left undefined.",
        "== on objects compares whether two references point at the same object, not whether their fields match.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between a class and an object?\" is a warm-up question almost everyone is " +
          "asked at some point — answer with blueprint versus instance, in your own words, not a memorised " +
          "one-liner.",
        "You'll often be asked to predict output involving two references to the same versus different " +
          "objects — the s1/s2 trace above is exactly that kind of reasoning.",
        "\"What is the default value of an uninitialised String/int/boolean field?\" comes up as a quick " +
          "check that you understand field defaults versus local-variable rules.",
      ],
    },
    {
      kind: "quiz",
      question: "What is printed by `Student s = new Student(); System.out.println(s.marks);` with no assignment to marks?",
      options: ["0", "null", "It fails to compile.", "Garbage/unpredictable value"],
      answer: 0,
      why:
        "int fields default to 0 automatically when an object is created — Java never leaves a field " +
        "undefined the way it leaves an unassigned local variable.",
    },
    {
      kind: "quiz",
      question: "`Student a = new Student(); Student b = a; b.marks = 50;` — what is a.marks afterward?",
      options: ["0", "50", "It fails to compile.", "null"],
      answer: 1,
      why:
        "b = a copies the reference, not the object — a and b now point at the exact same Student. " +
        "Changing marks through b changes the one shared object, so a.marks is also 50.",
    },
    {
      kind: "quiz",
      question: "What does `new Student()` actually do?",
      options: [
        "Declares the Student class to the compiler for the first time, so it must come before other code.",
        "Creates a new object in memory with default field values and returns a reference to it.",
        "Copies an existing Student object into a new place in memory, field by field.",
        "Nothing visible, until a field is assigned a value; only then is memory set aside.",
      ],
      answer: 1,
      why:
        "new allocates memory for a fresh object, initialises its fields to their defaults, and gives back " +
        "a reference you can store in a variable — the class itself was already defined separately.",
    },
  ],
};
