import type { Chapter } from "@/content/courses/types";

export const chapterLambdas: Chapter = {
  slug: "lambdas-functional-interfaces",
  title: "Lambdas and Functional Interfaces",
  summary:
    "A shorter way to write a class whose entire job is one method — passing behaviour itself around like " +
    "a value, instead of a name and a number. This is the single biggest syntax shift from \"old\" Java to " +
    "modern Java, and everything after Streams builds on it.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "`Comparator.comparing(s -> s.name)`, back in the Comparable/Comparator chapter, used syntax you " +
        "were told to read as \"a small, inline function\" without it being explained. It's time to explain " +
        "it properly — it's one of the most-used features in modern Java, and every Streams-API example in " +
        "the next chapter depends on understanding it first.",
    },
    { kind: "h", text: "A written instruction versus a standing order" },
    {
      kind: "analogy",
      title: "Writing a full memo versus just stating the instruction on the spot",
      text:
        "Suppose a school wants a rule applied — \"only admit students who scored above 80\" — checked in " +
        "several different places. The formal way is to write a proper memo: give it a title, a heading, a " +
        "signature block, file it in the office, and refer to it by name everywhere it's needed. That's a " +
        "regular class implementing an interface — real ceremony, for a rule that's genuinely just one " +
        "line: \"is this student's score above 80?\". A **lambda expression** is the informal alternative: " +
        "just state the rule on the spot, right where it's used — `n -> n > 80` — with no class name, no " +
        "file, no ceremony, because the *only* thing anyone needs is the rule itself. A lambda can be used " +
        "wherever Java expects an object of a **functional interface** — an interface with exactly one " +
        "abstract method, like `Greeter` below — because the lambda's parameter list and body *are* an " +
        "implementation of that one method, with everything else inferred. Where the analogy stops: a memo " +
        "in a filing cabinet can be referred to by many different people from many different places; a " +
        "lambda, written inline, typically belongs to and is understood at exactly the one place it's " +
        "written — for genuinely reusable logic, a named method reference or a real class is still the " +
        "better choice.",
    },
    {
      kind: "code",
      caption:
        "A custom functional interface implemented with a lambda, plus java.util.function's ready-made ones: " +
        "Predicate, Function, BiFunction, Runnable.",
      code:
        "import java.util.function.BiFunction;\n" +
        "import java.util.function.Function;\n" +
        "import java.util.function.Predicate;\n" +
        "\n" +
        "interface Greeter {\n" +
        "    String greet(String name);\n" +
        "}\n" +
        "\n" +
        "public class LambdasDemo {\n" +
        "    static int applyTwice(Function<Integer, Integer> f, int start) {\n" +
        "        return f.apply(f.apply(start));\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        '        Greeter formal = name -> "Good morning, " + name + ".";\n' +
        '        Greeter casual = name -> "Hey " + name + "!";\n' +
        '        System.out.println(formal.greet("Priya"));\n' +
        '        System.out.println(casual.greet("Arjun"));\n' +
        "\n" +
        "        Predicate<Integer> isEven = n -> n % 2 == 0;\n" +
        '        System.out.println("6 is even: " + isEven.test(6));\n' +
        '        System.out.println("7 is even: " + isEven.test(7));\n' +
        "\n" +
        "        Function<Integer, Integer> square = n -> n * n;\n" +
        '        System.out.println("square(5) = " + square.apply(5));\n' +
        '        System.out.println("applyTwice(square, 3) = " + applyTwice(square, 3));\n' +
        "\n" +
        "        BiFunction<Integer, Integer, Integer> add = (x, y) -> x + y;\n" +
        '        System.out.println("add(4, 5) = " + add.apply(4, 5));\n' +
        "\n" +
        '        Runnable task = () -> System.out.println("Task running via lambda");\n' +
        "        task.run();\n" +
        "    }\n" +
        "}\n",
      output:
        "Good morning, Priya.\n" +
        "Hey Arjun!\n" +
        "6 is even: true\n" +
        "7 is even: false\n" +
        "square(5) = 25\n" +
        "applyTwice(square, 3) = 81\n" +
        "add(4, 5) = 9\n" +
        "Task running via lambda",
    },
    {
      kind: "p",
      text:
        "`Greeter` is a custom functional interface — exactly one abstract method, `greet(String)`. " +
        "`name -> \"Good morning, \" + name + \".\"` is a lambda: `name` is the parameter (its type, " +
        "`String`, is inferred from `Greeter.greet`'s signature — no need to write it), and the expression " +
        "after `->` is what the method returns. `Predicate<Integer>`, `Function<Integer, Integer>`, " +
        "`BiFunction<Integer, Integer, Integer>`, and `Runnable` are all functional interfaces Java already " +
        "provides in `java.util.function` (`Runnable` predates it, in `java.lang`) — for the extremely " +
        "common shapes \"test one value and return true/false\", \"transform one value into another\", " +
        "\"combine two values into one\", and \"run some code with no input or output\", so you rarely need " +
        "to define your own the way `Greeter` does here.",
    },
    {
      kind: "table",
      head: ["Interface", "Method", "Shape", "Example use"],
      rows: [
        ["Predicate<T>", "boolean test(T t)", "One input, boolean out", "Filtering: isEven, isValid"],
        ["Function<T, R>", "R apply(T t)", "One input, one output (can differ in type)", "Transforming: square, parseInt"],
        ["BiFunction<T, U, R>", "R apply(T t, U u)", "Two inputs, one output", "Combining: add, compare"],
        ["Runnable", "void run()", "No input, no output", "A task to execute, e.g. on a Thread"],
        ["Consumer<T>", "void accept(T t)", "One input, no output", "Doing something with a value: printing, saving"],
      ],
    },
    {
      kind: "viz",
      title: "Why applyTwice(square, 3) evaluates to 81, not 9",
      caption: "The outer f.apply can't run until the inner one returns — square is chained onto its own previous result, not multiplied by itself.",
      viz: {
        type: "callstack",
        frames: [
          {
            stack: [{ label: "applyTwice(square, 3)", state: "active" }],
            note: "applyTwice(f, start) computes f.apply(f.apply(start)) — f is called on start, then f is called again on that result. square is the lambda n -> n * n.",
          },
          {
            stack: [{ label: "applyTwice(square, 3)" }, { label: "f.apply(3)", state: "returning" }],
            note: "Inner call: f.apply(3) computes 3 * 3 = 9.",
          },
          {
            stack: [{ label: "applyTwice(square, 3)" }, { label: "f.apply(9)", state: "returning" }],
            note: "Outer call: f.apply(9) — applying square again, to the previous result — computes 9 * 9 = 81.",
          },
          {
            stack: [{ label: "applyTwice(square, 3)", state: "returning" }],
            note: "applyTwice returns 81, not 3 * 3 * 2 = 18 and not a single squaring's 9 — square is genuinely applied twice, chained.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Trying to use a lambda where the target type has more than one abstract method — a lambda can " +
          "only implement a true *functional* interface (exactly one abstract method); this is a compile " +
          "error otherwise.",
        "Assuming a lambda needs explicit parameter types written out — usually they're inferred from " +
          "context (`n -> n * n`, not `(Integer n) -> n * n`); explicit types are legal but rarely needed.",
        "Forgetting parentheses are required around a lambda's parameter list when there's more than one " +
          "parameter — `(x, y) -> x + y`, never `x, y -> x + y`.",
        "Overusing lambdas for logic that's genuinely reused in many places or is non-trivial — a named " +
          "method (referenced with `ClassName::methodName`, a related shorthand) or a proper class is often " +
          "clearer once a lambda's body grows past a line or two.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A lambda is a shorthand implementation of a functional interface: an interface with exactly one abstract method.",
        "Syntax: (parameters) -> expression, or (parameters) -> { statements; return value; }.",
        "java.util.function provides ready-made functional interfaces: Predicate, Function, BiFunction, Consumer, Runnable and more.",
        "Parameter types are usually inferred from the target functional interface's method signature.",
        "Reach for a lambda for small, local, throwaway logic; prefer a named method or class for anything reused or complex.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is a lambda expression, and what can it be assigned to?\" — a shorthand for implementing a " +
          "functional interface's single method; name the constraint (exactly one abstract method) precisely.",
        "\"What's a functional interface?\" — an interface with exactly one abstract method (it may have " +
          "any number of default/static methods too, per the earlier interfaces chapter) — often marked " +
          "with `@FunctionalInterface` for clarity, though that annotation isn't required.",
        "You may be asked to rewrite a small anonymous-class implementation as a lambda, or vice versa — " +
          "practise reading `name -> expression` as \"a method body, with parameters and return inferred\".",
      ],
    },
    {
      kind: "quiz",
      question: "Which of these can a lambda expression be assigned to?",
      options: [
        "Any interface at all, as long as the lambda's parameters match one of its methods.",
        "Only an interface with exactly one abstract method (a functional interface).",
        "Any class, as long as the lambda is placed inside one of that class's methods.",
        "Only interfaces from the java.util.function package, and no interface that you write yourself.",
      ],
      answer: 1,
      why:
        "A lambda's body provides the implementation for exactly one method, so it can only stand in for a " +
        "functional interface — one with a single abstract method — not an arbitrary interface or class.",
    },
    {
      kind: "quiz",
      question: "Given `Function<Integer, Integer> square = n -> n * n;`, what does `applyTwice(square, 3)` (calling f.apply(f.apply(start))) return?",
      options: ["9", "18", "81", "6"],
      answer: 2,
      why:
        "square is applied twice, chained: first 3*3=9, then that result squared again, 9*9=81 — not 3 " +
        "squared once, and not doubled.",
    },
    {
      kind: "quiz",
      question: "Which java.util.function interface fits \"take one Integer, return true or false\"?",
      options: ["Function<Integer, Integer>", "Predicate<Integer>", "BiFunction<Integer, Integer, Boolean>", "Runnable"],
      answer: 1,
      why:
        "Predicate<T> is specifically shaped for exactly this: one input of type T, a boolean result via " +
        "test(T) — the standard interface for filtering/testing conditions.",
    },
  ],
};
