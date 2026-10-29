import type { Chapter } from "@/content/courses/types";

export const chapterPolymorphism: Chapter = {
  slug: "polymorphism",
  title: "Polymorphism: Overloading vs Overriding",
  summary:
    "The same method call behaving differently depending on the actual object behind it — and the two, " +
    "completely different mechanisms beginners mix up: compile-time overloading and run-time overriding.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "\"Polymorphism\" sounds intimidating; the word just means \"many forms\". You've already used it, " +
        "without the label — `square(5)` and `square(2.5)` from the methods chapter picked different code " +
        "depending on the argument type, and `s.printPaySlip()` on a `Manager` object automatically ran " +
        "`Manager`'s own `computePay()` in the inheritance chapter. This chapter names both mechanisms " +
        "precisely, because interviewers care about the difference a great deal.",
    },
    { kind: "h", text: "The same word, two different situations" },
    {
      kind: "analogy",
      title: "Ordering \"tea\" at the counter versus a substitute teacher taking a class",
      text:
        "At a tea stall, saying \"tea\" alone gets you the default; saying \"tea, no sugar\" gets a " +
        "different, specific preparation — the stall picks which recipe to follow based on exactly what you " +
        "said, decided the moment you speak. That's **overloading**: several methods sharing a name, " +
        "distinguished by their parameter list, and the compiler picks which one to run by looking at what " +
        "you wrote in the code — a decision made at compile time, before the program even runs. Compare " +
        "that to a substitute teacher: a class is announced simply as \"Period 3, Science\" — nobody in the " +
        "timetable says in advance *which* teacher's specific style of teaching Science will show up; it " +
        "depends on who actually walks in that day. That's **overriding**: a subclass supplies its own " +
        "version of an inherited method, and Java decides *at run time*, by looking at the actual object " +
        "(the teacher who actually walked in), which version to run — not by looking at the variable's " +
        "declared type. Where the analogy stops: the tea stall's decision and the classroom's decision use " +
        "genuinely different mechanisms in Java, not just different timing — overloading is resolved by " +
        "matching argument types at compile time; overriding is resolved by the object's actual class at " +
        "run time, regardless of what type the variable holding it was declared as.",
    },
    {
      kind: "code",
      caption:
        "Shape/Circle/Square shows overriding — the loop calls area() once, and gets different behaviour " +
        "per object. totalArea shows overloading — two methods, same name, different parameter lists.",
      code:
        "public class PolymorphismDemo {\n" +
        "    static double totalArea(int scale) {\n" +
        "        return 0;\n" +
        "    }\n" +
        "\n" +
        "    static double totalArea(int scale, int count) {\n" +
        "        return scale * count;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        Shape[] shapes = { new Circle(2.0), new Square(3.0) };\n" +
        "\n" +
        "        for (Shape s : shapes) {\n" +
        '            System.out.printf("%.2f%n", s.area());\n' +
        "        }\n" +
        "\n" +
        "        System.out.println(totalArea(5));\n" +
        "        System.out.println(totalArea(5, 2));\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Shape {\n" +
        "    double area() {\n" +
        "        return 0.0;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Circle extends Shape {\n" +
        "    double radius;\n" +
        "    Circle(double radius) { this.radius = radius; }\n" +
        "\n" +
        "    @Override\n" +
        "    double area() {\n" +
        "        return Math.PI * radius * radius;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Square extends Shape {\n" +
        "    double side;\n" +
        "    Square(double side) { this.side = side; }\n" +
        "\n" +
        "    @Override\n" +
        "    double area() {\n" +
        "        return side * side;\n" +
        "    }\n" +
        "}\n",
      output:
        "12.57\n" +
        "9.00\n" +
        "0.0\n" +
        "10.0",
      tryIt: {
        language: "java",
        prompt:
          "Add a `Rectangle` class with a width and a height that overrides `area()`, and put one in the " +
          "`shapes` array. The loop prints its area without any change.",
      },
    },
    {
      kind: "p",
      text:
        "`shapes` is declared as `Shape[]`, but each element is *actually* a `Circle` or a `Square`. Calling " +
        "`s.area()` inside the loop looks identical on every iteration — same variable `s`, same declared " +
        "type `Shape` — yet it runs `Circle`'s formula for the first element and `Square`'s formula for the " +
        "second, because Java looks at what the object *actually is* at run time, not what type the " +
        "variable was declared as. This is **runtime (dynamic) polymorphism** through overriding — and it's " +
        "the entire reason the loop can process an array of mixed shapes with one line of code, instead of " +
        "an if/else chain checking each type. `totalArea(5)` and `totalArea(5, 2)` are resolved differently " +
        "— the compiler looks at the *number and type of arguments at the call site* and picks the matching " +
        "overload before the program ever runs; there's no run-time decision involved at all.",
    },
    {
      kind: "table",
      head: ["", "Overloading", "Overriding"],
      rows: [
        ["Relationship", "Same class (or unrelated), same method name", "Subclass replacing a method it inherited"],
        ["Distinguished by", "Different parameter list (type/count)", "Identical signature to the parent's method"],
        ["Decided", "At compile time, from the call site", "At run time, from the actual object"],
        ["Return type", "Can differ", "Must be the same (or a covariant subtype)"],
        ["Also called", "Compile-time / static polymorphism", "Run-time / dynamic polymorphism"],
      ],
    },
    {
      kind: "viz",
      title: "Why s.area() runs a different formula on each loop iteration",
      caption: "Every cell is declared type Shape, but its actual object differs — and it's the actual object, checked fresh each call, that decides which area() runs.",
      viz: {
        type: "array",
        frames: [
          { cells: [{ value: "Circle(2.0)", state: "active", pointers: ["shapes[0]"] }, { value: "Square(3.0)" }], note: "shapes[0] actually is a Circle object (created with new Circle(2.0)), stored in a Shape[] array." },
          {
            cells: [{ value: "Circle(2.0)", state: "done", pointers: ["shapes[0] / s"] }, { value: "Square(3.0)" }],
            note: "s.area() on iteration 1: Java checks the actual object behind s — it's a Circle — and runs Circle's area(): Math.PI * 2.0 * 2.0 ≈ 12.57.",
          },
          {
            cells: [{ value: "Circle(2.0)", state: "done" }, { value: "Square(3.0)", state: "active", pointers: ["shapes[1]"] }],
            note: "shapes[1] actually is a Square object.",
          },
          {
            cells: [{ value: "Circle(2.0)", state: "done" }, { value: "Square(3.0)", state: "done", pointers: ["shapes[1] / s"] }],
            note: "s.area() on iteration 2: the actual object is now a Square, so Java runs Square's area(): 3.0 * 3.0 = 9.00.",
          },
          {
            cells: [{ value: "Circle(2.0)", state: "done" }, { value: "Square(3.0)", state: "done" }],
            note: "Same line of source code (s.area()), same declared variable type (Shape) — different method body ran each time, because the decision is based on the real object, made fresh each call.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Changing only the return type between two methods with the same name and same parameters — this " +
          "is neither valid overloading nor overriding; it's a compile error, because the signature " +
          "(name + parameters) is identical.",
        "Forgetting `@Override` — it's optional but strongly recommended, because it makes the compiler " +
          "check you actually matched the parent's signature; a typo without `@Override` silently creates " +
          "an unrelated overload instead of an override, with no warning.",
        "Assuming overload resolution happens at run time like overriding does — it doesn't; the compiler " +
          "picks the overload from the declared argument types at the call site, before the program runs.",
        "Narrowing an overridden method's access (e.g. parent is `public`, child tries `protected`) — this " +
          "is a compile error; an override can widen access but never narrow it.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Overloading: same name, different parameter list, resolved at compile time.",
        "Overriding: subclass replaces an inherited method with an identical signature, resolved at run time.",
        "Polymorphism through overriding is why a Shape[] of mixed subtypes can be processed with one loop.",
        "@Override on an overriding method lets the compiler catch signature mistakes for you.",
        "An override can't narrow access and (with rare exceptions) can't change the return type.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is polymorphism, and how does Java achieve it?\" — name both mechanisms and their timing: " +
          "compile-time overloading, run-time overriding.",
        "\"What's the difference between overloading and overriding?\" is asked almost as often as the " +
          "String == vs .equals() question — the table above is exactly the expected answer shape.",
        "You'll often be handed a short snippet with a parent-type array holding subclass objects and asked " +
          "to predict which overridden method runs on each call — reason it out the way the trace above does.",
      ],
    },
    {
      kind: "quiz",
      question: "A Shape variable holds a Circle object. Calling shapeVar.area() runs whose area() — Shape's or Circle's?",
      options: [
        "Shape's, because Java uses the variable's declared type to choose which area() runs.",
        "Circle's, because Java picks the overridden method from the actual object at run time.",
        "It fails to compile, because a Shape variable may not hold a Circle object.",
        "It depends on which class was compiled first, because Java picks the earlier-compiled version.",
      ],
      answer: 1,
      why:
        "Overriding is resolved dynamically — Java looks at what the object actually is at run time " +
        "(Circle), not the declared type of the variable holding it (Shape), and runs Circle's version.",
    },
    {
      kind: "quiz",
      question: "Two methods, `int calc(int a)` and `double calc(int a)`, differing only in return type — what happens?",
      options: [
        "Valid overloading — Java picks based on the assignment target",
        "Compile error — return type alone doesn't distinguish a signature",
        "Valid overriding",
        "It compiles, but calling calc(5) is ambiguous at run time",
      ],
      answer: 1,
      why:
        "A method's signature is its name plus parameter types — return type is not part of it. Two " +
        "methods with the same name and parameter list but different return types is a straight compile error.",
    },
    {
      kind: "quiz",
      question: "Which is decided at compile time rather than run time?",
      options: [
        "Which overridden method a subclass object runs",
        "Which overloaded method matches a given call",
        "Both are decided at run time",
        "Both are decided at compile time",
      ],
      answer: 1,
      why:
        "Overload resolution is static — the compiler matches the call site's argument types against " +
        "available overloads before the program runs. Overriding, by contrast, is resolved dynamically, " +
        "based on the actual object at run time.",
    },
  ],
};
