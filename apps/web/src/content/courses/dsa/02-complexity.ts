import type { Chapter } from "@/content/courses/types";

export const chapterComplexity: Chapter = {
  slug: "complexity",
  title: "Time and Space Complexity: Big-O",
  summary:
    "Counting steps instead of seconds, the common growth classes, and a growth table showing why O(n log " +
    "n) and O(n²) look identical at n=10 and utterly different at n=10,000.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "The last chapter showed two solutions to the same problem costing very different amounts of work, " +
        "but \"costs more work\" was still vague. ~~Big-O notation~~ is how that vagueness is fixed: a " +
        "precise, language-independent way to describe how the *amount of work* a piece of code does grows " +
        "as the input grows — not how many milliseconds it takes on one particular laptop, which depends on " +
        "the processor, the language, even what else is running.",
    },
    { kind: "h", text: "The exam-hall analogy" },
    {
      kind: "analogy",
      title: "Checking attendance in an exam hall",
      text:
        "Imagine two ways to check whether a student named in a file is present in an exam hall of n " +
        "students. Method one: walk down every row and check every single seat, one at a time, until you " +
        "find the name or run out of seats — in the worst case (the student is in the last seat, or " +
        "absent), that's n checks. Method two: the hall is pre-sorted by roll number and pinned on a " +
        "seating chart at the door, so you jump to the middle, decide \"higher or lower\", and repeat — " +
        "each check eliminates half the remaining seats, needing only around log₂(n) checks. Double the " +
        "hall's size and method one takes roughly twice as long; method two barely slows down at all, " +
        "because halving a bigger number still only takes one extra check to reach 1. Big-O is exactly this " +
        "comparison, made precise: not \"how long did it take today\", but \"how does the work grow as n " +
        "grows\". Where the analogy stops: a real exam hall's seating chart has to already be sorted for " +
        "method two to work at all — that sorting has its own cost, covered later in this course.",
    },
    { kind: "h", text: "Counting steps, not seconds" },
    {
      kind: "p",
      text:
        "Big-O describes the **shape** of growth, ignoring constant multipliers and lower-order terms: an " +
        "algorithm that does exactly 3n + 7 steps and one that does exactly n steps are both written O(n), " +
        "because what matters for large n is that doubling the input roughly doubles the work in both " +
        "cases — the flat +7, and the factor of 3, stop mattering once n is large enough. What Big-O throws " +
        "away on purpose: constant factors (3n and n are \"the same shape\"), and lower-order terms (n² " +
        "+ n is written O(n²), since the n² term swamps the n term as n grows). What it does not " +
        "throw away: the shape itself — O(n) and O(n²) describe genuinely, unignorably different growth.",
    },
    {
      kind: "concept",
      title: "Big-O describes shape, not a stopwatch reading",
      text:
        "Two algorithms with the same Big-O can still run at very different speeds in practice — Big-O only " +
        "promises that, as the input gets large, their *running time grows the same way*. It answers " +
        "\"if I double n, does the work double, stay the same, or explode?\" — never \"how many " +
        "milliseconds will this take on my machine?\"",
    },
    {
      kind: "table",
      head: ["Name", "Big-O", "Meaning in plain words", "Typical example"],
      rows: [
        ["Constant", "{{O(1)}}", "Same work regardless of input size.", "Reading array[0]"],
        ["Logarithmic", "{{O(log n)}}", "Work grows very slowly; each step roughly halves what's left.", "Binary search"],
        ["Linear", "{{O(n)}}", "Work grows in direct proportion to input size.", "One loop over an array"],
        ["Linearithmic", "{{O(n log n)}}", "A linear pass repeated roughly log n times.", "Merge sort, quick sort"],
        ["Quadratic", "{{O(n²)}}", "Work grows with the square of input size.", "Comparing every pair"],
        ["Exponential", "{{O(2ⁿ)}}", "Work doubles with every single extra input item.", "Trying every subset"],
      ],
    },
    {
      kind: "code",
      caption:
        "The same operation counts as the growth table above, computed directly rather than guessed, for " +
        "n = 1, 10, 100, 1000, 10000.",
      code:
        "public class GrowthDemo {\n" +
        "    static long constantOps(int n) {\n" +
        "        return 1;\n" +
        "    }\n" +
        "\n" +
        "    static long logOps(int n) {\n" +
        "        long count = 0;\n" +
        "        int i = n;\n" +
        "        while (i > 1) {\n" +
        "            i = i / 2;\n" +
        "            count++;\n" +
        "        }\n" +
        "        return count;\n" +
        "    }\n" +
        "\n" +
        "    static long linearOps(int n) {\n" +
        "        return n;\n" +
        "    }\n" +
        "\n" +
        "    static long nLogNOps(int n) {\n" +
        "        return (long) (n * logOps(n));\n" +
        "    }\n" +
        "\n" +
        "    static long quadraticOps(int n) {\n" +
        "        return (long) n * n;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.printf("%-6s %-10s %-8s %-8s %-10s %-12s%n", "n", "O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n^2)");\n' +
        "        int[] sizes = {1, 10, 100, 1000, 10000};\n" +
        "        for (int n : sizes) {\n" +
        '            System.out.printf("%-6d %-10d %-8d %-8d %-10d %-12d%n",\n' +
        "                n, constantOps(n), logOps(n), linearOps(n), nLogNOps(n), quadraticOps(n));\n" +
        "        }\n" +
        "    }\n" +
        "}\n",
      output:
        "n      O(1)       O(log n) O(n)     O(n log n) O(n^2)      \n" +
        "1      1          0        1        0          1           \n" +
        "10     1          3        10       30         100         \n" +
        "100    1          6        100      600        10000       \n" +
        "1000   1          9        1000     9000       1000000     \n" +
        "10000  1          13       10000    130000     100000000",
      python:
        "def constant_ops(n):\n" +
        "    return 1\n" +
        "\n" +
        "\n" +
        "def log_ops(n):\n" +
        "    count = 0\n" +
        "    i = n\n" +
        "    while i > 1:\n" +
        "        i //= 2\n" +
        "        count += 1\n" +
        "    return count\n" +
        "\n" +
        "\n" +
        "def linear_ops(n):\n" +
        "    return n\n" +
        "\n" +
        "\n" +
        "def n_log_n_ops(n):\n" +
        "    return n * log_ops(n)\n" +
        "\n" +
        "\n" +
        "def quadratic_ops(n):\n" +
        "    return n * n\n" +
        "\n" +
        "\n" +
        "print(f\"{'n':<6} {'O(1)':<10} {'O(log n)':<8} {'O(n)':<8} {'O(n log n)':<10} {'O(n^2)':<12}\")\n" +
        "for n in [1, 10, 100, 1000, 10000]:\n" +
        "    print(\n" +
        "        f\"{n:<6} {constant_ops(n):<10} {log_ops(n):<8} {linear_ops(n):<8} \"\n" +
        "        f\"{n_log_n_ops(n):<10} {quadratic_ops(n):<12}\"\n" +
        "    )\n",
      pythonOutput:
        "n      O(1)       O(log n) O(n)     O(n log n) O(n^2)      \n" +
        "1      1          0        1        0          1           \n" +
        "10     1          3        10       30         100         \n" +
        "100    1          6        100      600        10000       \n" +
        "1000   1          9        1000     9000       1000000     \n" +
        "10000  1          13       10000    130000     100000000",
    },
    {
      kind: "viz",
      title: "logOps(100) — each step halves what's left",
      caption: "One cell per value `i` takes on; the count of active cells at the end is the function's answer.",
      viz: {
        type: "array",
        frames: [
          { cells: [{ value: 100, state: "active", pointers: ["i"] }], note: "i=100, count=0. 100 > 1, continue." },
          {
            cells: [{ value: 100, state: "done" }, { value: 50, state: "active", pointers: ["i"] }],
            note: "i = 100/2 = 50, count=1. 50 > 1, continue.",
          },
          {
            cells: [{ value: 100, state: "done" }, { value: 50, state: "done" }, { value: 25, state: "active", pointers: ["i"] }],
            note: "i = 50/2 = 25, count=2. 25 > 1, continue.",
          },
          {
            cells: [
              { value: 100, state: "done" },
              { value: 50, state: "done" },
              { value: 25, state: "done" },
              { value: 12, state: "active", pointers: ["i"] },
            ],
            note: "i = 25/2 = 12 (integer division), count=3. 12 > 1, continue.",
          },
          {
            cells: [
              { value: 100, state: "done" },
              { value: 50, state: "done" },
              { value: 25, state: "done" },
              { value: 12, state: "done" },
              { value: 6, state: "active", pointers: ["i"] },
            ],
            note: "i = 12/2 = 6, count=4. 6 > 1, continue.",
          },
          {
            cells: [
              { value: 100, state: "done" },
              { value: 50, state: "done" },
              { value: 25, state: "done" },
              { value: 12, state: "done" },
              { value: 6, state: "done" },
              { value: 3, state: "active", pointers: ["i"] },
            ],
            note: "i = 6/2 = 3, count=5. 3 > 1, continue.",
          },
          {
            cells: [
              { value: 100, state: "done" },
              { value: 50, state: "done" },
              { value: 25, state: "done" },
              { value: 12, state: "done" },
              { value: 6, state: "done" },
              { value: 3, state: "done" },
              { value: 1, state: "active", pointers: ["i"] },
            ],
            note:
              "i = 3/2 = 1, count=6. 1 is not > 1 — stop. Result: 6 halvings to shrink 100 down to 1, " +
              "matching log₂(100) ≈ 6.6, rounded down by integer division.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Look at the O(n) and O(n²) columns at n = 10 (10 versus 100) and again at n = 10000 (10,000 " +
        "versus 100,000,000): at small n the difference looks almost academic; at large n one is instant " +
        "and the other is not. This is precisely why a solution that \"worked fine\" in testing can become " +
        "unusable in production — the input size crossed a threshold where the shape of growth, not the " +
        "code's constant factors, started to dominate.",
    },
    { kind: "h", text: "Best, worst, and average case — and space, not just time" },
    {
      kind: "p",
      text:
        "The same code can have different Big-O depending on *which* input you consider: linear search " +
        "finds a match in one step if it's the first element (**best case**, O(1)) but must check every " +
        "element if the value is absent or last (**worst case**, O(n)). Interviews almost always mean " +
        "worst case unless they say otherwise, because a guarantee that only holds on lucky input isn't " +
        "much of a guarantee. **Space complexity** is the same idea applied to memory instead of steps: " +
        "hasDuplicateFast from the last chapter is O(n) in *space* because its HashSet can grow to hold all " +
        "n numbers, even though it's faster in *time* than the O(1)-space alternative. The two are " +
        "independent, and a technique that improves one often costs the other — that trade-off is a " +
        "recurring theme in the chapters ahead.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Run this as-is, then change the list `[10, 20, 40]` to `[10, 20, 40, 80]` and watch the quadratic " +
        "count grow far faster than the linear one — that gap is what Big-O is naming.",
      starter:
        "def linear_work(n):\n" +
        "    count = 0\n" +
        "    for _ in range(n):\n" +
        "        count += 1\n" +
        "    return count\n" +
        "\n" +
        "\n" +
        "def quadratic_work(n):\n" +
        "    count = 0\n" +
        "    for _ in range(n):\n" +
        "        for _ in range(n):\n" +
        "            count += 1\n" +
        "    return count\n" +
        "\n" +
        "\n" +
        "for n in [10, 20, 40]:\n" +
        '    print(f"n={n}: linear={linear_work(n)}, quadratic={quadratic_work(n)}")\n',
      expectedOutput: "n=10: linear=10, quadratic=100\nn=20: linear=20, quadratic=400\nn=40: linear=40, quadratic=1600",
    },
    {
      kind: "pitfall",
      items: [
        "Confusing Big-O with actual runtime — an O(n) algorithm with a huge constant factor can be slower " +
          "than an O(n²) one for small n; Big-O describes growth as n gets large, not a stopwatch " +
          "reading.",
        "Forgetting that nested loops don't automatically mean O(n²) — two separate, non-nested loops " +
          "over the same array is O(n) + O(n) = O(n), not O(n²); only loops nested *inside* one another " +
          "multiply.",
        "Stating only time complexity when a question asks for both time and space — interviewers " +
          "generally want both, and \"trades space for time\" is often exactly the point of a technique.",
        "Assuming best case when reasoning about correctness — a solution that's O(1) only when it gets " +
          "lucky is, for interview purposes, an O(n) (or worse) solution.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Big-O describes how work grows with input size, ignoring constant factors and lower-order terms.",
        "Common classes, fastest to slowest growth: O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ).",
        "Interviews default to worst-case complexity unless told otherwise.",
        "Time and space complexity are separate measurements — a faster algorithm often uses more memory.",
        "Two separate loops over the same input add (O(n) + O(n) = O(n)); nested loops multiply (O(n) " +
          "× O(n) = O(n²)).",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the time and space complexity of your solution?\" is asked after nearly every problem — " +
          "have both ready, not just time.",
        "Interviewers listen for *why*, not just the label — \"O(n) because it's one pass over the array, " +
          "doing a constant amount of work per element\" is a far stronger answer than the label alone.",
        "Being asked to improve a correct O(n²) solution to O(n log n) or O(n) is one of the most common " +
          "interview arcs there is — it's exactly what the rest of this course trains for.",
      ],
    },
    {
      kind: "quiz",
      question: "What does Big-O notation primarily describe?",
      options: [
        "The exact number of seconds a program takes to run on a given machine",
        "How the amount of work grows as the input size grows, ignoring constant factors",
        "How much disk space the source code file takes up once it has been compiled",
        "The programming language's raw execution speed compared to other languages",
      ],
      answer: 1,
      why:
        "Big-O captures the shape of growth — how work scales as n grows — deliberately ignoring constant " +
        "multipliers and machine-specific runtime, which is why it works as a language-independent measure.",
    },
    {
      kind: "quiz",
      question: "A function has one loop over n elements, followed by a separate, second loop over the same n elements. What is its time complexity?",
      options: ["O(n²), because there are two loops, so the work is multiplied", "O(2n), which must be kept separate from O(n) in the final answer", "O(n), since the two loops add rather than nest", "O(log n)"],
      answer: 2,
      why:
        "Two loops that run one after another (not nested) add their costs: O(n) + O(n) simplifies to O(n) " +
        "under Big-O's rule of dropping constant factors. Nesting one loop inside another is what produces " +
        "O(n²), not simply having two loops in the same function.",
    },
    {
      kind: "quiz",
      question: "Why do interviews generally expect worst-case complexity rather than best-case?",
      options: [
        "Because best-case complexity is mathematically undefined, so it cannot be written in Big-O notation",
        "A guarantee that holds only on lucky input isn't a reliable guarantee for real use",
        "Because worst-case is always the same as average-case, so only one of them needs stating",
        "Because best-case analysis applies only to sorting algorithms and not to other kinds of code",
      ],
      answer: 1,
      why:
        "Worst-case complexity describes what you can rely on no matter what input arrives — a solution " +
        "that's fast only when the input happens to be favourable doesn't give you a dependable guarantee, " +
        "which is what interviewers, and production systems, actually need.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "State the time complexity, in your own words with a one-line reason, for: printing every element " +
          "of an array once; printing every pair of elements from an array; and printing only the first " +
          "element regardless of array size.",
        "A colleague says their function is \"O(2n)\", treating it as meaningfully different from another " +
          "function that is \"O(n)\". Explain, in your own words, why Big-O notation treats these as the " +
          "same growth class.",
        "You have a function with two loops, one after another (not nested), each running n times. What is " +
          "the overall time complexity, and why doesn't it become O(n²)?",
        "For a search that jumps to the middle and eliminates half the remaining data each time, explain " +
          "why doubling the input size adds only one extra step rather than doubling the total work.",
        "Describe a real situation (not necessarily code) where you'd accept using more memory in exchange " +
          "for a faster result, and one where you'd refuse that trade — explain what makes the difference.",
      ],
    },
  ],
};
