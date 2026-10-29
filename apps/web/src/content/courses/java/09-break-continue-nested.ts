import type { Chapter } from "@/content/courses/types";

export const chapterBreakContinueNested: Chapter = {
  slug: "break-continue-and-nested-loops",
  title: "break, continue, and Nested Loops",
  summary:
    "Exiting a loop early, skipping just one iteration, loops inside loops, and the labelled break that " +
    "escapes more than one level at once.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "A loop's condition decides when it stops *on its own*. `break` and `continue` are how you " +
        "override that from inside the body — leave the loop early, or skip just this one lap and move on " +
        "to the next. Combined with loops written inside other loops, these give you enough control to " +
        "build tables, patterns, and searches — the actual bread-and-butter of early Java exercises.",
    },
    { kind: "h", text: "The library shelf analogy" },
    {
      kind: "analogy",
      title: "Scanning a library shelf for one book",
      text:
        "Imagine scanning a shelf of 50 numbered books, left to right, looking for one specific title. The " +
        "moment you find it, you stop scanning entirely — there's no reason to check books 30 through 50 " +
        "once book 29 was the one you wanted. That's `break`: it exits the loop immediately, skipping every " +
        "remaining iteration. Now imagine instead you're dusting every book on the shelf, but skipping any " +
        "book that's a reference volume (not meant to be borrowed) — you don't stop the whole task, you " +
        "just skip *that one* book and continue with the next. That's `continue`: it skips the rest of the " +
        "current iteration's body and moves straight to the next one, without leaving the loop. Where the " +
        "analogy stops: a person scanning a shelf naturally knows when to give up; Java's `break` and " +
        "`continue` only ever act on the exact condition you write — get the condition wrong, and the loop " +
        "will quite happily skip or stop at the wrong book.",
    },
    {
      kind: "code",
      caption: "break stopping a loop early, and continue skipping even numbers.",
      code:
        "public class BreakContinue {\n" +
        "    public static void main(String[] args) {\n" +
        "        for (int i = 1; i <= 10; i++) {\n" +
        "            if (i == 6) {\n" +
        "                break;\n" +
        "            }\n" +
        '            System.out.print(i + " ");\n' +
        "        }\n" +
        "        System.out.println();\n" +
        "\n" +
        "        for (int i = 1; i <= 10; i++) {\n" +
        "            if (i % 2 == 0) {\n" +
        "                continue;\n" +
        "            }\n" +
        '            System.out.print(i + " ");\n' +
        "        }\n" +
        "        System.out.println();\n" +
        "    }\n" +
        "}\n",
      output:
        "1 2 3 4 5 \n" +
        "1 3 5 7 9",
      tryIt: {
        language: "java",
        prompt:
          "Swap the two keywords: put `continue` in the first loop and `break` in the second. Predict " +
          "both lines before you run.",
      },
    },
    {
      kind: "p",
      text:
        "In the first loop, `break` fires the instant `i` reaches 6 — the loop stops completely, so 6 " +
        "through 10 are never printed at all, not even skipped-and-continued. In the second loop, " +
        "`continue` fires on every even number: it skips *only* the `System.out.print` for that one " +
        "iteration and moves on — the loop itself keeps running all the way to 10, which is why odd " +
        "numbers up to 9 all still appear.",
    },
    { kind: "h", text: "Nested loops: patterns and tables" },
    {
      kind: "p",
      text:
        "A loop written inside another loop's body is a **nested loop**. The outer loop controls the big " +
        "steps (say, rows); the inner loop runs to completion, from start to finish, for *every single* " +
        "step of the outer loop (say, columns in that row). This is the standard way to build a " +
        "multiplication table or a printed shape, one row at a time.",
    },
    {
      kind: "code",
      caption: "A 3x3 multiplication table and a right-angled triangle of stars, both via nested loops.",
      code:
        "// Nested loop: a multiplication table, 3x3\n" +
        "for (int i = 1; i <= 3; i++) {\n" +
        "    for (int j = 1; j <= 3; j++) {\n" +
        '        System.out.print(i * j + "\\t");\n' +
        "    }\n" +
        "    System.out.println();\n" +
        "}\n" +
        "\n" +
        "// Right-angled triangle of stars\n" +
        "for (int i = 1; i <= 4; i++) {\n" +
        "    for (int j = 1; j <= i; j++) {\n" +
        '        System.out.print("*");\n' +
        "    }\n" +
        "    System.out.println();\n" +
        "}\n",
      output: "1\t2\t3\t\n2\t4\t6\t\n3\t6\t9\t\n*\n**\n***\n****",
    },
    {
      kind: "viz",
      title: "How the triangle's inner loop bound changes with i",
      caption: "Each printed row is one outer-loop iteration; its length is exactly the inner loop's upper bound, `j <= i`.",
      viz: {
        type: "queue",
        frames: [
          { items: ["*"], note: "i = 1: inner loop runs `for (j = 1; j <= 1; j++)` — one iteration. Prints one \"*\", then a new line." },
          { items: ["*", "**"], note: "i = 2: inner loop runs `for (j = 1; j <= 2; j++)` — two iterations. Prints \"**\", then a new line." },
          { items: ["*", "**", "***"], note: "i = 3: inner loop condition is now j <= 3 — three iterations. Prints \"***\"." },
          {
            items: ["*", "**", "***", "****"],
            note:
              "i = 4: inner loop condition is j <= 4 — four iterations. Prints \"****\". The key idea: the " +
              "inner loop's *own* upper bound (`j <= i`) depends on the outer loop's current value — that " +
              "dependency is what turns a rectangle of stars into a growing triangle.",
          },
        ],
      },
    },
    { kind: "h", text: "Labelled break — escaping more than one loop at once" },
    {
      kind: "p",
      text:
        "A plain `break` inside a nested loop only exits the *innermost* loop it's written in — the outer " +
        "loop keeps going. Sometimes you genuinely want to abandon both loops at once, the moment a " +
        "specific combination is found. A **labelled break** does exactly that: name the outer loop with a " +
        "label (`outer:`), and `break outer;` from anywhere inside it, at any nesting depth, jumps straight " +
        "out past both loops.",
    },
    {
      kind: "code",
      caption: "break outer exits both loops the moment i=2, j=2 is reached.",
      code:
        "outer:\n" +
        "for (int i = 1; i <= 3; i++) {\n" +
        "    for (int j = 1; j <= 3; j++) {\n" +
        "        if (i == 2 && j == 2) {\n" +
        "            break outer;\n" +
        "        }\n" +
        '        System.out.println("i=" + i + " j=" + j);\n' +
        "    }\n" +
        "}\n",
      output: "i=1 j=1\ni=1 j=2\ni=1 j=3\ni=2 j=1",
    },
    {
      kind: "p",
      text:
        "Without the label, a plain `break` at `i == 2 && j == 2` would only stop the inner loop — the " +
        "outer loop would then move on to `i = 3` and print three more lines. With `break outer`, the " +
        "whole nested structure ends the moment that one combination is hit, which is exactly the pattern " +
        "you want when searching a 2D grid for one match and stopping immediately once you find it.",
    },
    {
      kind: "pitfall",
      items: [
        "Confusing `break` and `continue` — `break` leaves the loop entirely; `continue` only skips to " +
          "the next iteration. Mixing them up produces a loop that runs far too few, or far too many, " +
          "times.",
        "Forgetting that a plain `break` inside a nested loop only escapes the innermost one — reaching " +
          "for a labelled break (or a boolean 'found' flag checked by the outer loop) when you actually " +
          "need to stop both.",
        "Getting the inner loop's bound wrong in a pattern — writing `j <= 3` instead of `j <= i` turns a " +
          "triangle into a rectangle, a very easy typo to make and to miss.",
        "Overusing labelled breaks where a single loop with a combined condition, or a small helper " +
          "method with a plain `return`, would read more clearly — reach for it when genuinely escaping " +
          "nested loops, not as a general-purpose jump.",
      ],
    },
    {
      kind: "remember",
      items: [
        "break exits the loop entirely; continue skips only the rest of the current iteration.",
        "A nested loop's inner loop runs to completion for every single iteration of the outer loop.",
        "A shape/pattern's changing width usually comes from the inner loop's bound depending on the " +
          "outer loop's current variable (`j <= i`).",
        "A plain break only escapes its own, innermost loop — use a labelled break (`break outer;`) to " +
          "escape more than one level at once.",
        "\"break leaves, continue skips\" — the four-word version, if you need a hook.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between break and continue?\" is asked almost as often as loop basics " +
          "themselves — answer precisely: exits entirely, versus skips one iteration.",
        "Printing patterns (triangles, pyramids, number patterns) with nested loops is a very common " +
          "written or whiteboard exercise, specifically because it tests whether you can reason about the " +
          "inner loop's bound changing with the outer loop's variable.",
        "\"How would you break out of two nested loops at once?\" — the labelled-break answer, or a " +
          "flag variable checked by the outer loop as an alternative, are both reasonable things to " +
          "mention.",
      ],
    },
    {
      kind: "quiz",
      question: "What does `for (int i = 1; i <= 5; i++) { if (i == 3) continue; System.out.print(i); }` print?",
      options: ["12", "1245", "124", "12345"],
      answer: 1,
      why:
        "continue skips only the print for i == 3 — it does not stop the loop. i still takes every value " +
        "1 through 5, so the output is 1, 2, 4, 5 printed together as \"1245\".",
    },
    {
      kind: "quiz",
      question: "In a nested loop building a pattern, what typically makes each row a different width?",
      options: [
        "The outer loop's condition changes on every row automatically.",
        "The inner loop's upper bound depends on the outer loop's current variable, e.g. `j <= i`.",
        "Java automatically shrinks loops that are nested inside another loop.",
        "Nested loops always produce the same width on every row; varying width needs an if statement.",
      ],
      answer: 1,
      why:
        "The inner loop runs to its own bound every time — making that bound depend on the outer " +
        "variable (as in `for (int j = 1; j <= i; j++)`) is exactly what makes the row's length change " +
        "as the outer loop advances.",
    },
    {
      kind: "quiz",
      question: "Why doesn't a plain (unlabelled) `break` inside the inner loop of a nested pair stop the outer loop too?",
      options: [
        "break always stops every loop it's nested inside, without exception.",
        "break only affects the innermost loop around it, unless a label names an outer loop.",
        "break only works on while loops, not for loops, once they are nested inside another loop.",
        "It's a compile error to use break inside a nested loop at all, so a flag variable is required.",
      ],
      answer: 1,
      why:
        "By default, break (and continue) act on the nearest enclosing loop only. Reaching an outer loop " +
        "requires a label on that outer loop and `break <label>;` — exactly the pattern shown with " +
        "`break outer;` above.",
    },
  ],
};
