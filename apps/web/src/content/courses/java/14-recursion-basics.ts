import type { Chapter } from "@/content/courses/types";

export const chapterRecursion: Chapter = {
  slug: "recursion-basics",
  title: "Recursion Basics",
  summary:
    "A method that calls itself: the base case that must exist, the call stack that actually runs it, " +
    "and why naive recursion can be surprisingly slow.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Every loop you've written repeats by going back to the top of the same block. **Recursion** is a " +
        "different way to repeat: a method that calls *itself*, with a smaller version of the same " +
        "problem, until the problem becomes small enough to answer directly. It looks close to magic the " +
        "first time you see it work, and it is genuinely one of the most commonly misunderstood topics " +
        "for beginners — worth slowing down for.",
    },
    { kind: "h", text: "The nesting-dolls analogy" },
    {
      kind: "analogy",
      title: "Russian nesting dolls, opened one at a time",
      text:
        "To find out how many dolls are inside a set of Russian nesting dolls, you don't need a special " +
        "counting procedure for \"a set of dolls\" — you only need one rule, applied repeatedly: \"open the " +
        "current doll; if there's a smaller doll inside, the count is 1 plus the count of *that* smaller " +
        "set; if there's nothing inside, the count is 1 and you stop.\" You apply the exact same rule to " +
        "the smaller doll, and the smaller one after that, until you reach a doll with nothing inside — " +
        "the point where the rule stops asking you to open another doll and simply gives you an answer. " +
        "That final, no-further-opening case is the **base case**; every step before it is the " +
        "**recursive case**, which solves the current problem in terms of a *smaller* version of the exact " +
        "same problem. `factorial(5)` works identically: \"5 factorial is 5 times 4-factorial; " +
        "0-factorial is just 1, no further multiplying needed.\" Where the analogy stops: opening a real " +
        "doll physically produces a smaller doll whether you like it or not; a recursive method only " +
        "shrinks the problem if *you* write it to shrink — get the smaller version wrong, or forget the " +
        "base case, and the method keeps calling itself on a problem that never gets smaller, forever, " +
        "until Java runs out of room to track it.",
    },
    {
      kind: "code",
      caption: "Three recursive methods: factorial, Fibonacci, and summing a number's digits.",
      code:
        "public class Recursion1 {\n" +
        "    static int factorial(int n) {\n" +
        "        if (n == 0) {\n" +
        "            return 1;\n" +
        "        }\n" +
        "        return n * factorial(n - 1);\n" +
        "    }\n" +
        "\n" +
        "    static int fibonacci(int n) {\n" +
        "        if (n == 0) return 0;\n" +
        "        if (n == 1) return 1;\n" +
        "        return fibonacci(n - 1) + fibonacci(n - 2);\n" +
        "    }\n" +
        "\n" +
        "    static int sumDigits(int n) {\n" +
        "        if (n == 0) {\n" +
        "            return 0;\n" +
        "        }\n" +
        "        return (n % 10) + sumDigits(n / 10);\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("factorial(5) = " + factorial(5));\n' +
        "\n" +
        "        for (int i = 0; i <= 8; i++) {\n" +
        '            System.out.print(fibonacci(i) + " ");\n' +
        "        }\n" +
        "        System.out.println();\n" +
        "\n" +
        '        System.out.println("sumDigits(4321) = " + sumDigits(4321));\n' +
        "    }\n" +
        "}\n",
      output:
        "factorial(5) = 120\n" +
        "0 1 1 2 3 5 8 13 21 \n" +
        "sumDigits(4321) = 10",
      tryIt: {
        language: "java",
        prompt:
          "Print `factorial(10)` and `sumDigits(98765)`. Then delete the `if (n == 0)` base case from " +
          "`factorial` and run: the calls never stop, and Java ends them with a StackOverflowError.",
      },
    },
    {
      kind: "p",
      text:
        "Every one of these three methods has the same two-part shape: a **base case** that returns a " +
        "direct answer with no further recursive call (`n == 0` for both `factorial` and `sumDigits`; " +
        "`n == 0` and `n == 1` for `fibonacci`, which needs two base cases since it looks two steps back), " +
        "and a **recursive case** that expresses the answer in terms of the same method called on a " +
        "*strictly smaller* input (`n - 1`, or `n / 10`, which is always smaller than `n` for positive " +
        "`n`). Miss the base case, or write a recursive call that doesn't actually shrink the input, and " +
        "the method calls itself without end.",
    },
    { kind: "h", text: "What actually happens: the call stack" },
    {
      kind: "p",
      text:
        "Java doesn't run all the recursive calls to `factorial(5)` at once — it runs them nested inside " +
        "one another, each waiting on the next, using a structure called the **call stack**. Every call " +
        "that hasn't yet returned sits on the stack, in order, like a stack of trays: `factorial(5)` calls " +
        "`factorial(4)` and *pauses*, waiting; `factorial(4)` calls `factorial(3)` and pauses; and so on, " +
        "down to `factorial(0)`, which finally returns `1` with no further call. Then the pausing unwinds " +
        "in reverse: `factorial(1)` resumes and computes `1 * 1 = 1`; `factorial(2)` resumes and computes " +
        "`2 * 1 = 2`; and so on back up, until `factorial(5)` finally computes `5 * 24 = 120`.",
    },
    {
      kind: "viz",
      title: "factorial(5), calls going down then answers coming back up",
      caption: "The stack grows one frame per call until the base case, then shrinks one frame per return — each returning frame carries its answer back to the one below it.",
      viz: {
        type: "callstack",
        frames: [
          { stack: [{ label: "factorial(5)", state: "active" }], note: "factorial(5) needs factorial(4) before it can multiply by 5. Call, and wait." },
          { stack: [{ label: "factorial(5)" }, { label: "factorial(4)", state: "active" }], note: "factorial(4) needs factorial(3). Call, and wait." },
          { stack: [{ label: "factorial(5)" }, { label: "factorial(4)" }, { label: "factorial(3)", state: "active" }], note: "factorial(3) needs factorial(2). Call, and wait." },
          { stack: [{ label: "factorial(5)" }, { label: "factorial(4)" }, { label: "factorial(3)" }, { label: "factorial(2)", state: "active" }], note: "factorial(2) needs factorial(1). Call, and wait." },
          { stack: [{ label: "factorial(5)" }, { label: "factorial(4)" }, { label: "factorial(3)" }, { label: "factorial(2)" }, { label: "factorial(1)", state: "active" }], note: "factorial(1) needs factorial(0). Call, and wait." },
          {
            stack: [
              { label: "factorial(5)" }, { label: "factorial(4)" }, { label: "factorial(3)" }, { label: "factorial(2)" }, { label: "factorial(1)" },
              { label: "factorial(0)", state: "returning" },
            ],
            note: "factorial(0) hits the base case directly: returns 1. No further call.",
          },
          {
            stack: [{ label: "factorial(5)" }, { label: "factorial(4)" }, { label: "factorial(3)" }, { label: "factorial(2)" }, { label: "factorial(1)", state: "returning" }],
            note: "factorial(1) resumes: 1 * factorial(0) = 1 * 1 = 1. Returns 1.",
          },
          {
            stack: [{ label: "factorial(5)" }, { label: "factorial(4)" }, { label: "factorial(3)" }, { label: "factorial(2)", state: "returning" }],
            note: "factorial(2) resumes: 2 * factorial(1) = 2 * 1 = 2. Returns 2.",
          },
          {
            stack: [{ label: "factorial(5)" }, { label: "factorial(4)" }, { label: "factorial(3)", state: "returning" }],
            note: "factorial(3) resumes: 3 * factorial(2) = 3 * 2 = 6. Returns 6.",
          },
          {
            stack: [{ label: "factorial(5)" }, { label: "factorial(4)", state: "returning" }],
            note: "factorial(4) resumes: 4 * factorial(3) = 4 * 6 = 24. Returns 24.",
          },
          {
            stack: [{ label: "factorial(5)", state: "returning" }],
            note: "factorial(5) resumes: 5 * factorial(4) = 5 * 24 = 120. Returns 120 — the final answer.",
          },
        ],
      },
    },
    { kind: "h", text: "Recursion isn't free: Fibonacci's hidden cost" },
    {
      kind: "p",
      text:
        "`fibonacci`, as written above, works correctly but hides a real problem: `fibonacci(n - 1) + " +
        "fibonacci(n - 2)` means computing `fibonacci(5)` recomputes `fibonacci(3)` *inside both* of its " +
        "two recursive branches — entirely from scratch, twice, with no memory of having already done it. " +
        "The number of calls roughly doubles with each step up in `n`, so `fibonacci(30)` alone makes " +
        "well over a million redundant calls. This isn't a flaw in recursion generally — it's a flaw in " +
        "*this specific* recursive solution, which forgets answers it's already worked out. Fixing it " +
        "(storing already-computed answers, an approach called memoisation) is beyond this chapter, but " +
        "knowing the cost exists — and that it's specific to overlapping recursive calls like this, not a " +
        "property of recursion in general — is exactly the kind of thing worth being able to say out loud.",
    },
    {
      kind: "pitfall",
      items: [
        "Writing a recursive method with no base case, or a base case the recursive calls never actually " +
          "reach — this produces a `StackOverflowError` at run time, once the call stack fills up with " +
          "paused, never-returning calls.",
        "Writing a recursive call that doesn't shrink the problem — `factorial(n)` calling " +
          "`factorial(n)` again (instead of `n - 1`) never approaches the base case and also overflows " +
          "the stack.",
        "Assuming recursion is always the efficient choice. Naive Fibonacci is a textbook example of " +
          "recursion that's clean to *read* but expensive to *run*, because of repeated, overlapping " +
          "subproblems.",
        "Forgetting that each paused call genuinely holds on to memory (its own copy of parameters and " +
          "local variables) until it returns — very deep recursion (tens of thousands of levels) can " +
          "exhaust the stack even with a perfectly correct base case, simply because the problem itself " +
          "is too large for straightforward recursion.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Every correct recursive method needs a base case (stops, no further call) and a recursive case " +
          "(calls itself on a strictly smaller problem).",
        "Recursive calls pause on the call stack and resume in reverse order as answers come back up.",
        "No base case, or a recursive call that never shrinks the input, causes a StackOverflowError.",
        "Recursion that recomputes the same subproblem many times (like naive Fibonacci) can be far " +
          "slower than it looks, despite being correct.",
        "\"Trust the recursion\": once the base case is right and the recursive case genuinely reduces to " +
          "a smaller version of the same problem, you don't need to mentally unroll every level by hand " +
          "to believe it works — though it's an excellent way to check it, as the trace above does.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is a base case, and why does every recursive function need one?\" is a fundamental, " +
          "near-certain question — answer with the stopping condition and what happens without one " +
          "(infinite calls, then a stack overflow).",
        "Writing `factorial` or Fibonacci recursively, from scratch, on a whiteboard, is one of the most " +
          "common warm-up exercises there is — practising the two-part shape (base case, recursive case) " +
          "until it's automatic pays off directly here.",
        "\"What's the time complexity of naive recursive Fibonacci, and how would you improve it?\" tests " +
          "whether you understand the overlapping-subproblems cost, even if memoisation itself is a later " +
          "topic.",
      ],
    },
    {
      kind: "quiz",
      question: "What is the purpose of a base case in a recursive method?",
      options: [
        "It makes the method run faster by skipping the recursive calls whenever the input is large.",
        "It's the condition where the method returns a direct answer without calling itself, which stops the recursion.",
        "It is needed only in methods that return void, since other methods stop once they return a value.",
        "It converts the recursive method into a loop automatically, which removes the need for the call stack.",
      ],
      answer: 1,
      why:
        "Without a base case (or with one the recursive calls never actually reach), the method keeps " +
        "calling itself indefinitely, eventually exhausting the call stack — a StackOverflowError.",
    },
    {
      kind: "quiz",
      question: "For `int sumDigits(int n) { if (n == 0) return 0; return (n % 10) + sumDigits(n / 10); }`, what does sumDigits(123) return?",
      options: ["123", "1", "6", "It never terminates."],
      answer: 2,
      why:
        "sumDigits(123) = 3 + sumDigits(12) = 3 + (2 + sumDigits(1)) = 3 + 2 + (1 + sumDigits(0)) = " +
        "3 + 2 + 1 + 0 = 6. Each call peels off the last digit (n % 10) and recurses on the rest (n / 10), " +
        "which shrinks toward the base case n == 0.",
    },
    {
      kind: "quiz",
      question: "Why is the naive recursive Fibonacci shown in this chapter considered inefficient for larger n?",
      options: [
        "Because it has no base case, so the calls never stop until memory runs out.",
        "Because it recomputes the same smaller Fibonacci values over and over, with no memory of earlier results.",
        "Because Java cannot recurse more than twice in a row, so deeper calls get silently skipped.",
        "Because fibonacci(n - 1) and fibonacci(n - 2) run at the same time and interfere with each other's variables.",
      ],
      answer: 1,
      why:
        "fibonacci(5)'s two branches both eventually call fibonacci(3), fibonacci(2), and so on, each " +
        "recomputed independently from scratch rather than reused — the number of redundant calls grows " +
        "quickly as n grows, which is a cost specific to this particular recursive formulation.",
    },
  ],
};
