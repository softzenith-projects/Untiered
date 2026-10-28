import type { Chapter } from "@/content/courses/types";

export const chapterOperators: Chapter = {
  slug: "operators",
  title: "Operators",
  summary:
    "Arithmetic, the integer-division trap, comparison and logical operators, increment/decrement, and " +
    "the ternary operator.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "You've already used `+` to join text and add numbers in the same breath — `name + \" is \" + " +
        "age`. That's actually two different `+` operators wearing the same symbol: one glues text " +
        "together, the other adds numbers. Java has a small, fixed set of symbols like this that do work " +
        "on values, and knowing exactly what each one does — especially the ones that surprise beginners " +
        "— saves hours of confused debugging later.",
    },
    { kind: "h", text: "The cricket scorecard analogy" },
    {
      kind: "analogy",
      title: "A scorer's shorthand on a cricket scorecard",
      text:
        "A cricket scorer doesn't write \"the batsman has scored four runs, which should be added to the " +
        "existing total\" in full sentences every ball — they use shorthand: a small mark for a single, a " +
        "circled 4 for a boundary, W for a wicket. Each symbol is a compact instruction that means " +
        "something very specific in that context. Java's operators are exactly this kind of shorthand: " +
        "`+=` means \"add this to what's already there and store it back\", `>=` means \"is the left side " +
        "at least the right side\", `&&` means \"both of these have to be true\". Where the analogy stops: " +
        "a scorer's shorthand is somewhat forgiving of context, but Java's operators behave with total, " +
        "occasionally counter-intuitive consistency — `17 / 5` and `17.0 / 5.0` use the *same* division " +
        "symbol but genuinely different rules underneath, and knowing which rule applies is the entire " +
        "point of this chapter.",
    },
    { kind: "h", text: "Arithmetic operators, and the trap inside `/`" },
    {
      kind: "code",
      caption: "Every arithmetic and logical operator covered in this chapter, run in one program.",
      code:
        "public class Operators {\n" +
        "    public static void main(String[] args) {\n" +
        "        int a = 17, b = 5;\n" +
        '        System.out.println("a + b = " + (a + b));\n' +
        '        System.out.println("a - b = " + (a - b));\n' +
        '        System.out.println("a * b = " + (a * b));\n' +
        '        System.out.println("a / b = " + (a / b));\n' +
        '        System.out.println("a % b = " + (a % b));\n' +
        "\n" +
        "        double x = 17.0, y = 5.0;\n" +
        '        System.out.println("x / y = " + (x / y));\n' +
        "\n" +
        "        int count = 0;\n" +
        "        count++;\n" +
        "        count++;\n" +
        '        System.out.println("count after two increments: " + count);\n' +
        "\n" +
        "        int marks = 78;\n" +
        "        boolean passed = marks >= 40;\n" +
        "        boolean distinction = marks >= 75 && marks <= 100;\n" +
        '        System.out.println("passed = " + passed + ", distinction = " + distinction);\n' +
        "\n" +
        "        boolean isHoliday = false;\n" +
        "        boolean isWeekend = true;\n" +
        '        System.out.println("No school = " + (isHoliday || isWeekend));\n' +
        "\n" +
        "        int p = 5;\n" +
        "        int result = (p > 3) ? 100 : 200;\n" +
        '        System.out.println("Ternary result: " + result);\n' +
        "    }\n" +
        "}\n",
      output:
        "a + b = 22\n" +
        "a - b = 12\n" +
        "a * b = 85\n" +
        "a / b = 3\n" +
        "a % b = 2\n" +
        "x / y = 3.4\n" +
        "count after two increments: 2\n" +
        "passed = true, distinction = true\n" +
        "No school = true\n" +
        "Ternary result: 100",
    },
    {
      kind: "p",
      text:
        "Look closely at `a / b` versus `x / y`. `a` and `b` are `int`, so `17 / 5` performs **integer " +
        "division**: it computes how many whole times 5 goes into 17 (three times) and *throws away the " +
        "remainder entirely* — the answer is `3`, not `3.4`. This is not rounding; 17/5 is nowhere near 3 " +
        "if you round it. `x` and `y` are `double`, so `17.0 / 5.0` performs ordinary decimal division and " +
        "gives `3.4`. The rule: if *both* operands of `/` are whole-number types, you get integer division " +
        "and the fractional part vanishes; if *either* operand is a `double` or `float`, you get real " +
        "division. `%`, the **modulo** or remainder operator, gives you back exactly the part integer " +
        "division threw away: `17 % 5` is `2`, because 5 goes into 17 three times with 2 left over.",
    },
    { kind: "h", text: "Comparison and logical operators" },
    {
      kind: "table",
      head: ["Operator", "Meaning", "Example (marks = 78)"],
      rows: [
        ["==", "Equal to", "marks == 78 → true"],
        ["!=", "Not equal to", "marks != 78 → false"],
        [">, <, >=, <=", "Greater/less than (or equal)", "marks >= 40 → true"],
        ["&&", "Logical AND — both sides must be true", "marks >= 75 && marks <= 100 → true"],
        ["||", "Logical OR — at least one side must be true", "isHoliday || isWeekend → true"],
        ["!", "Logical NOT — flips true to false and back", "!passed → false"],
      ],
    },
    {
      kind: "p",
      text:
        "`&&` and `||` have a property called **short-circuiting**, which matters more than it sounds. In " +
        "`a && b`, if `a` is `false`, Java never even evaluates `b` — the whole expression is already " +
        "`false`, no matter what `b` is, so there's no point checking. Same for `a || b` when `a` is " +
        "`true`. This isn't just an optimisation — it's routinely used on purpose, as in `list != null && " +
        "list.size() > 0`, where checking `list.size()` on a `null` list would crash the program. The " +
        "`&&` guarantees the null check runs first and stops the rest from running if it fails.",
    },
    { kind: "h", text: "Increment, decrement, and compound assignment" },
    {
      kind: "p",
      text:
        "`count++` is shorthand for `count = count + 1`; `count--` for `count = count - 1`. Written before " +
        "the variable (`++count`), it's the *pre*-increment; written after (`count++`), it's the *post*-" +
        "increment — both end up adding 1 to `count`, but they differ in what value the *expression itself* " +
        "produces when used inline (`System.out.println(count++)` prints the old value, then increments; " +
        "`System.out.println(++count)` increments first, then prints the new value). Compound assignment " +
        "operators — `+=`, `-=`, `*=`, `/=`, `%=` — are shorthand for \"do this operation to me and store " +
        "the result back\": `total += 5` means `total = total + 5`.",
    },
    { kind: "h", text: "The ternary operator" },
    {
      kind: "p",
      text:
        "`(p > 3) ? 100 : 200` is a compact if/else that produces a *value*: read it as \"if `p > 3`, the " +
        "whole expression is `100`; otherwise it's `200`\". It's the only operator in Java that takes " +
        "three operands (a condition, a value for true, a value for false), which is why it's called " +
        "ternary. It's useful for short, single-value decisions; for anything longer, a proper if/else " +
        "(next chapter) reads more clearly.",
    },
    {
      kind: "pitfall",
      items: [
        "Expecting `17 / 5` to give `3.4`. If both sides are integer types, the result is truncated " +
          "integer division — cast at least one side to `double` (`(double) a / b`) if you want the real " +
          "quotient.",
        "Using `=` where `==` was meant inside a condition. `if (passed = true)` compiles in some " +
          "languages but not Java when the variable isn't a boolean — Java requires an `if` condition to " +
          "actually be a `boolean`, which catches this particular mistake at compile time, unlike C.",
        "Assuming `&&`/`||` always evaluate both sides. Code that relies on a side effect in the second " +
          "operand (like a method call that must run) can silently not run it, because of short-" +
          "circuiting.",
      ],
    },
    {
      kind: "remember",
      items: [
        "int / int = int, truncated (17/5 = 3); make one side a double for real division.",
        "% gives the remainder integer division threw away (17 % 5 = 2).",
        "&& and || short-circuit: the second side is skipped once the answer is already decided.",
        "`x++` (post) returns the old value then increments; `++x` (pre) increments then returns.",
        "The ternary `cond ? a : b` is an if/else that produces a value, not a statement.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What does `7 / 2` evaluate to in Java, and why?\" is a very common trap question — the honest " +
          "answer is 3, because both operands are int, and knowing to explain *why* (truncation, not " +
          "rounding) is what separates a memorised answer from an understood one.",
        "\"What's the difference between `x++` and `++x`?\" is asked constantly, often with a short code " +
          "snippet you have to trace by hand.",
        "\"Why use && instead of &?\" tests whether you know about short-circuiting — `&` and `|` also " +
          "exist as *bitwise* operators, and on booleans they evaluate both sides always, no short-" +
          "circuit.",
      ],
    },
    {
      kind: "quiz",
      question: "What does `System.out.println(9 / 4);` print?",
      options: ["2.25", "2", "3", "2.0"],
      answer: 1,
      why:
        "Both `9` and `4` are int literals, so `/` performs integer division: 4 goes into 9 twice, with a " +
        "remainder discarded entirely. The result is `2`, not a rounded or decimal value.",
    },
    {
      kind: "quiz",
      question: "In `boolean ok = (x != null) && (x.length() > 0);`, why does the order of the two checks matter?",
      options: [
        "It doesn't matter, because Java always evaluates both sides of && before it decides the result.",
        "Because of short-circuiting: if x is null the left side is false, so x.length() is never evaluated.",
        "Because && accepts method calls only on its right side, so the null check has to come first.",
        "Because Java evaluates the right side of && before the left, so the null check must come last.",
      ],
      answer: 1,
      why:
        "&& short-circuits left to right. If `x != null` is false, Java already knows the whole " +
        "expression is false and skips `x.length() > 0` — which would otherwise throw a " +
        "NullPointerException on a null x.",
    },
    {
      kind: "quiz",
      question: "What is the value of `result` after `int count = 4; int result = count++ + count;`?",
      options: ["8", "9", "10", "4"],
      answer: 1,
      why:
        "`count++` is post-increment: it evaluates to the *current* value of count (4) for use in the " +
        "expression, and only afterwards increments count to 5. So the expression becomes `4 + 5 = 9`, " +
        "and count ends at 5.",
    },
  ],
};
