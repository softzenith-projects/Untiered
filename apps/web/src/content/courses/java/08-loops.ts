import type { Chapter } from "@/content/courses/types";

export const chapterLoops: Chapter = {
  slug: "loops",
  title: "Loops: for, while, do-while",
  summary:
    "Repeating code without repeating yourself — the three loop shapes, when to reach for each, and the " +
    "one guarantee do-while gives that the others don't.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "If you wanted to print the numbers 1 to 100, you would not write `System.out.println` one hundred " +
        "times. A loop is Java's way of saying \"repeat this block of code, either a fixed number of times, " +
        "or for as long as some condition stays true.\" Java has three loop shapes — `for`, `while`, " +
        "`do-while` — and they all do the same underlying job with different emphasis on *when* the " +
        "condition gets checked and how the counting is organised.",
    },
    { kind: "h", text: "The WhatsApp group broadcast analogy" },
    {
      kind: "analogy",
      title: "Sending a reminder to every member of a WhatsApp group",
      text:
        "Imagine sending the same exam reminder to every member of a class WhatsApp group, one by one. If " +
        "you already know exactly how many members there are — say, 40 — you'd naturally count: \"member 1, " +
        "send; member 2, send; ...; member 40, send, stop.\" That's a `for` loop: you know the count in " +
        "advance, so the loop itself tracks the counter. If instead you're scrolling through an unknown " +
        "number of messages looking for the last one before a certain date, you keep going *as long as* " +
        "some condition holds — you don't know in advance how many messages that'll take. That's a `while` " +
        "loop. And if you're checking whether there's still a queue at the school canteen counter, you " +
        "always look *first*, then decide whether to join — except right when it's your own turn to check " +
        "out, you're going to the counter regardless of the queue, because you're already there: that's the " +
        "one case where the action happens *before* the check, which is exactly what `do-while` guarantees. " +
        "Where the analogy stops: all three loop shapes in Java can be made to do the exact same job — " +
        "which one you pick is a matter of which naturally fits the problem, not a hard technical " +
        "limitation of any of them.",
    },
    { kind: "h", text: "for — when you know the count" },
    {
      kind: "code",
      caption: "All three loop shapes, run together.",
      code:
        "public class Loops {\n" +
        "    public static void main(String[] args) {\n" +
        "        for (int i = 1; i <= 5; i++) {\n" +
        '            System.out.print(i + " ");\n' +
        "        }\n" +
        "        System.out.println();\n" +
        "\n" +
        "        int total = 0;\n" +
        "        int n = 5;\n" +
        "        while (n > 0) {\n" +
        "            total += n;\n" +
        "            n--;\n" +
        "        }\n" +
        '        System.out.println("Sum 1..5 via while: " + total);\n' +
        "\n" +
        "        int count = 0;\n" +
        "        do {\n" +
        "            count++;\n" +
        "        } while (count < 3);\n" +
        '        System.out.println("do-while ran, count ended at: " + count);\n' +
        "\n" +
        "        int attempts = 0;\n" +
        "        do {\n" +
        "            attempts++;\n" +
        "        } while (false);\n" +
        '        System.out.println("do-while runs at least once: " + attempts);\n' +
        "    }\n" +
        "}\n",
      output:
        "1 2 3 4 5 \n" +
        "Sum 1..5 via while: 15\n" +
        "do-while ran, count ended at: 3\n" +
        "do-while runs at least once: 1",
    },
    {
      kind: "p",
      text:
        "A `for` loop's header has three parts, separated by semicolons: `for (initialisation; condition; " +
        "update)`. `int i = 1` runs once, before the loop starts. `i <= 5` is checked *before every* " +
        "iteration, including the first — if it's false immediately, the loop body never runs at all. " +
        "`i++` runs *after* every iteration's body finishes, right before the condition is checked again. " +
        "All three parts being visible together, right at the top, is exactly why `for` is the natural " +
        "choice whenever you already know how many times you're repeating something.",
    },
    { kind: "h", text: "while — when you don't know the count in advance" },
    {
      kind: "p",
      text:
        "A `while` loop has only the condition: `while (n > 0) { ... }`. It keeps running the block for as " +
        "long as the condition stays true, checked before every iteration, same as `for`. It suits " +
        "situations where the number of repetitions genuinely isn't known up front — reading input until " +
        "the user types \"quit\", or, as above, counting down an unknown-in-general starting value to zero.",
    },
    { kind: "h", text: "do-while — checks after, so it always runs once" },
    {
      kind: "p",
      text:
        "`do { ... } while (condition);` is the one genuinely different shape: the body runs *first*, and " +
        "only *then* is the condition checked to decide whether to repeat. The `attempts` example makes " +
        "this concrete — `while (false)` would mean an ordinary `while` loop's body never executes even " +
        "once, but the `do-while` version still runs its body exactly once before it ever looks at the " +
        "condition. This matters for anything that must happen at least once no matter what — showing a " +
        "menu before asking whether to show it again, for instance.",
    },
    {
      kind: "viz",
      title: "The while loop computing 1+2+3+4+5",
      caption: "Two boxes, `total` and `n`; each round the value of `n` is folded into `total` and then `n` counts down.",
      viz: {
        type: "array",
        frames: [
          { cells: [{ value: 0, pointers: ["total"] }, { value: 5, state: "active", pointers: ["n"] }], note: "total = 0, n = 5. Check n > 0: true (5 > 0)." },
          { cells: [{ value: 5, pointers: ["total"] }, { value: 4, state: "active", pointers: ["n"] }], note: "total += n → total = 0 + 5 = 5. n-- → n = 4." },
          { cells: [{ value: 9, pointers: ["total"] }, { value: 3, state: "active", pointers: ["n"] }], note: "Check n > 0: true (4 > 0). total += n → total = 5 + 4 = 9. n-- → n = 3." },
          { cells: [{ value: 12, pointers: ["total"] }, { value: 2, state: "active", pointers: ["n"] }], note: "Check n > 0: true. total = 9 + 3 = 12. n = 2." },
          { cells: [{ value: 14, pointers: ["total"] }, { value: 1, state: "active", pointers: ["n"] }], note: "Check n > 0: true. total = 12 + 2 = 14. n = 1." },
          { cells: [{ value: 15, pointers: ["total"] }, { value: 0, state: "active", pointers: ["n"] }], note: "Check n > 0: true. total = 14 + 1 = 15. n = 0." },
          { cells: [{ value: 15, state: "done", pointers: ["total"] }, { value: 0, pointers: ["n"] }], note: "Check n > 0: false (0 > 0 is false). Loop exits with total = 15." },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "Change the `for` loop so it counts down from 5 to 1. Then change `while (false)` to `while " +
        "(attempts < 4)` and predict the last line before you run.",
      starter:
        "public class Loops {\n" +
        "    public static void main(String[] args) {\n" +
        "        for (int i = 1; i <= 5; i++) {\n" +
        '            System.out.print(i + " ");\n' +
        "        }\n" +
        "        System.out.println();\n" +
        "\n" +
        "        int total = 0;\n" +
        "        int n = 5;\n" +
        "        while (n > 0) {\n" +
        "            total += n;\n" +
        "            n--;\n" +
        "        }\n" +
        '        System.out.println("Sum 1..5 via while: " + total);\n' +
        "\n" +
        "        int count = 0;\n" +
        "        do {\n" +
        "            count++;\n" +
        "        } while (count < 3);\n" +
        '        System.out.println("do-while ran, count ended at: " + count);\n' +
        "\n" +
        "        int attempts = 0;\n" +
        "        do {\n" +
        "            attempts++;\n" +
        "        } while (false);\n" +
        '        System.out.println("do-while runs at least once: " + attempts);\n' +
        "    }\n" +
        "}\n",
      expectedOutput:
        "1 2 3 4 5\n" +
        "Sum 1..5 via while: 15\n" +
        "do-while ran, count ended at: 3\n" +
        "do-while runs at least once: 1",
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting the update step (`i++`) in a `while` loop, since — unlike `for` — nothing forces it " +
          "to be visible near the condition. A `while` loop whose counter never changes runs forever: an " +
          "**infinite loop**.",
        "Writing `for (int i = 1; i <= 5; i++);` with an accidental semicolon right after the header. The " +
          "loop then repeats an *empty* statement five times, and the block that looks like the loop body " +
          "runs exactly once, unconditionally, after the loop finishes.",
        "Reaching for `do-while` out of habit when a plain `while` was meant — using `do-while` when the " +
          "body should *not* run if the condition starts false is a genuine, easy-to-miss bug.",
        "Off-by-one errors: `i < 5` runs 5 times (0 through 4) if i starts at 0, but `i <= 5` runs 6 times " +
          "(0 through 5) — check your boundary condition deliberately rather than guessing.",
      ],
    },
    {
      kind: "remember",
      items: [
        "for: know the count in advance — initialisation, condition, and update all sit together in " +
          "the header.",
        "while: repeat while a condition holds; the count isn't known ahead of time.",
        "do-while: same as while, but the body runs once *before* the first check — guaranteed at " +
          "least one execution.",
        "for and while check the condition *before* every iteration; do-while checks *after*.",
        "A loop whose condition never becomes false, and whose body never changes what the condition " +
          "checks, runs forever.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"When would you use do-while instead of while?\" is asked to check you understand the " +
          "check-after guarantee, not just that a third loop keyword exists.",
        "You will very likely be asked to hand-trace a loop's output for a given starting value — " +
          "practise this literally, on paper, the way the trace box above does it.",
        "\"How do you avoid an infinite loop?\" — a solid answer names the update step and the condition " +
          "explicitly, since that's exactly where the mistake usually hides.",
      ],
    },
    {
      kind: "quiz",
      question: "How many times does `for (int i = 0; i < 5; i++) { ... }` run its body?",
      options: ["4 times", "5 times", "6 times", "It depends on i's initial value at declaration."],
      answer: 1,
      why:
        "i takes the values 0, 1, 2, 3, 4 — each satisfies i < 5, and 5 itself does not. That's 5 " +
        "iterations, a classic 'count from 0, stop before the limit' pattern.",
    },
    {
      kind: "quiz",
      question: "What is the key behavioural difference between while and do-while?",
      options: [
        "while can use any condition; do-while can only use boolean variables, not expressions.",
        "do-while checks its condition after running the body once; while checks before running the body at all.",
        "while loops cannot contain other loops; do-while loops can.",
        "There is no real difference — they always produce identical results.",
      ],
      answer: 1,
      why:
        "do-while is defined by checking after: the body always runs at least once, even if the " +
        "condition is false from the very start — exactly what the `while (false)` example demonstrated.",
    },
    {
      kind: "quiz",
      question: "What is wrong with `while (x > 0) { System.out.println(x); }` if x starts at 5 and is never changed inside the loop?",
      options: [
        "Nothing — it prints 5 once and exits cleanly.",
        "It's an infinite loop: the condition x > 0 never becomes false, since x is never updated.",
        "It fails to compile because there's no update expression.",
        "It prints the numbers 5 down to 1 automatically, like a for loop would.",
      ],
      answer: 1,
      why:
        "Unlike for, while has no built-in update step — if nothing inside the body changes x, the " +
        "condition x > 0 stays true forever, and the loop never terminates.",
    },
  ],
};
