import type { Chapter } from "@/content/courses/types";

export const chapterDpIntuition: Chapter = {
  slug: "dp-intuition",
  title: "Dynamic Programming: Memoization vs Tabulation",
  summary:
    "Naive recursion redoes the same work exponentially many times. Dynamic programming's entire idea is " +
    "one sentence: remember an answer once computed, and never compute it again.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "**Dynamic programming** (DP) applies to problems with two properties: an **optimal substructure** " +
        "(the answer to the whole problem can be built from answers to smaller versions of the same " +
        "problem), and **overlapping subproblems** (naive recursion ends up solving the *exact same* smaller " +
        "problem many times over). When both hold, DP's entire idea is to compute each distinct subproblem " +
        "**once**, store its answer, and reuse it every time it's needed again — turning what would be " +
        "exponential repeated work into work proportional to the number of genuinely distinct subproblems.",
    },
    { kind: "h", text: "The photocopy-versus-filing-cabinet analogy" },
    {
      kind: "analogy",
      title: "Answering the same question for ten different people",
      text:
        "Imagine ten classmates separately ask you the same tricky homework question over the course of an " +
        "afternoon. Working it out from scratch every single time is naive recursion — correct, but wasteful. " +
        "The obvious fix: solve it once, write the answer on a sticky note stuck to your desk, and the next " +
        "nine times just read the note. That sticky note is exactly what a **memo** (memoization) is. " +
        "**Tabulation** is the same idea from the opposite direction: instead of waiting to be asked and " +
        "caching answers reactively, you sit down beforehand and fill out an answer sheet for every question " +
        "from the easiest to the hardest, in order, so that by the time a hard question is reached, every " +
        "smaller thing it depends on is already filled in. Where the analogy stops: real sticky notes can be " +
        "lost or the desk can run out of room; a program's memo (a HashMap or array) is exact and bounded by " +
        "how many distinct subproblems actually exist.",
    },
    { kind: "h", text: "Fibonacci: the clearest possible case of wasted work" },
    {
      kind: "code",
      caption:
        "The same Fibonacci function three ways: naive recursion (exponential, from the recursion chapter's " +
        "branching-call warning), top-down memoization (recursion plus a cache), and bottom-up tabulation " +
        "(an iterative table, no recursion at all).",
      code:
        "import java.util.HashMap;\n" +
        "import java.util.Map;\n" +
        "\n" +
        "public class DpIntuition {\n" +
        "    static long fibNaive(int n) {\n" +
        "        if (n <= 1) return n;\n" +
        "        return fibNaive(n - 1) + fibNaive(n - 2);\n" +
        "    }\n" +
        "\n" +
        "    static Map<Integer, Long> memo = new HashMap<>();\n" +
        "    static long fibMemo(int n) {\n" +
        "        if (n <= 1) return n;\n" +
        "        if (memo.containsKey(n)) return memo.get(n);\n" +
        "        long result = fibMemo(n - 1) + fibMemo(n - 2);\n" +
        "        memo.put(n, result);\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    static long fibTabulation(int n) {\n" +
        "        if (n <= 1) return n;\n" +
        "        long[] dp = new long[n + 1];\n" +
        "        dp[0] = 0;\n" +
        "        dp[1] = 1;\n" +
        "        for (int i = 2; i <= n; i++) {\n" +
        "            dp[i] = dp[i - 1] + dp[i - 2];\n" +
        "        }\n" +
        "        return dp[n];\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("fibNaive(10) = " + fibNaive(10));\n' +
        '        System.out.println("fibMemo(40) = " + fibMemo(40));\n' +
        '        System.out.println("fibTabulation(40) = " + fibTabulation(40));\n' +
        "\n" +
        "        long start = System.nanoTime();\n" +
        "        fibNaive(35);\n" +
        "        long naiveMs = (System.nanoTime() - start) / 1_000_000;\n" +
        "\n" +
        "        memo.clear();\n" +
        "        start = System.nanoTime();\n" +
        "        fibMemo(35);\n" +
        "        long memoMs = (System.nanoTime() - start) / 1_000_000;\n" +
        "\n" +
        '        System.out.println("naive(35) took roughly " + naiveMs + "ms; memo(35) took roughly " + memoMs + "ms");\n' +
        "    }\n" +
        "}\n",
      output:
        "fibNaive(10) = 55\nfibMemo(40) = 102334155\nfibTabulation(40) = 102334155\n" +
        "naive(35) took roughly 37ms; memo(35) took roughly 0ms",
      python:
        "import time\n" +
        "\n" +
        "\n" +
        "def fib_naive(n):\n" +
        "    if n <= 1:\n" +
        "        return n\n" +
        "    return fib_naive(n - 1) + fib_naive(n - 2)\n" +
        "\n" +
        "\n" +
        "memo = {}\n" +
        "\n" +
        "\n" +
        "def fib_memo(n):\n" +
        "    if n <= 1:\n" +
        "        return n\n" +
        "    if n in memo:\n" +
        "        return memo[n]\n" +
        "    result = fib_memo(n - 1) + fib_memo(n - 2)\n" +
        "    memo[n] = result\n" +
        "    return result\n" +
        "\n" +
        "\n" +
        "def fib_tabulation(n):\n" +
        "    if n <= 1:\n" +
        "        return n\n" +
        "    dp = [0] * (n + 1)\n" +
        "    dp[1] = 1\n" +
        "    for i in range(2, n + 1):\n" +
        "        dp[i] = dp[i - 1] + dp[i - 2]\n" +
        "    return dp[n]\n" +
        "\n" +
        "\n" +
        'print("fibNaive(10) =", fib_naive(10))\n' +
        'print("fibMemo(40) =", fib_memo(40))\n' +
        'print("fibTabulation(40) =", fib_tabulation(40))\n' +
        "\n" +
        "# Timing note: this number is machine- and interpreter-dependent, same as the Java\n" +
        "# figure above -- what matters is the shape (roughly instant vs. clearly not), not the\n" +
        "# exact millisecond count. A pure-Python interpreter has much higher per-call overhead\n" +
        "# than JIT-compiled Java, so naive(35) here is considerably slower in absolute terms.\n" +
        "start = time.perf_counter()\n" +
        "fib_naive(35)\n" +
        "naive_ms = int((time.perf_counter() - start) * 1000)\n" +
        "\n" +
        "memo.clear()\n" +
        "start = time.perf_counter()\n" +
        "fib_memo(35)\n" +
        "memo_ms = int((time.perf_counter() - start) * 1000)\n" +
        "\n" +
        'print(f"naive(35) took roughly {naive_ms}ms; memo(35) took roughly {memo_ms}ms")\n',
      pythonOutput:
        "fibNaive(10) = 55\nfibMemo(40) = 102334155\nfibTabulation(40) = 102334155\n" +
        "naive(35) took roughly 1057ms; memo(35) took roughly 0ms",
    },
    {
      kind: "viz",
      title: "fibNaive(5) — the call tree, showing exactly which work repeats",
      caption: "A 'compare' node is a value already computed elsewhere in this same tree; the final frame shows fibMemo cutting those repeats off before they re-expand.",
      viz: {
        type: "tree",
        frames: [
          {
            rootId: "n5",
            nodes: [
              { id: "n5", value: 5, left: "n4", right: "n3b", state: "active" },
              { id: "n4", value: 4, left: null, right: null, state: "active" },
              { id: "n3b", value: 3, left: null, right: null, state: "active" },
            ],
            note: "fibNaive(5) calls fibNaive(4) and fibNaive(3).",
          },
          {
            rootId: "n5",
            nodes: [
              { id: "n5", value: 5, left: "n4", right: "n3b" },
              { id: "n4", value: 4, left: "n3a", right: "n2b", state: "active" },
              { id: "n3a", value: 3, left: null, right: null, state: "compare" },
              { id: "n2b", value: 2, left: null, right: null, state: "active" },
              { id: "n3b", value: 3, left: null, right: null },
            ],
            note:
              "fibNaive(4) calls fibNaive(3) and fibNaive(2) — notice fibNaive(3) is now being computed a " +
              "second time, completely from scratch.",
          },
          {
            rootId: "n5",
            nodes: [
              { id: "n5", value: 5, left: "n4", right: "n3b" },
              { id: "n4", value: 4, left: "n3a", right: "n2b" },
              { id: "n3a", value: 3, left: "n2a", right: "n1a", state: "active" },
              { id: "n2a", value: 2, left: null, right: null, state: "compare" },
              { id: "n1a", value: 1, left: null, right: null },
              { id: "n2b", value: 2, left: null, right: null },
              { id: "n3b", value: 3, left: null, right: null },
            ],
            note:
              "fibNaive(3) (the first call, from step 1) calls fibNaive(2) and fibNaive(1) — fibNaive(2) " +
              "is also about to be recomputed multiple times across the tree.",
          },
          {
            rootId: "n5",
            nodes: [
              { id: "n5", value: 5, left: "n4", right: "n3b" },
              { id: "n4", value: 4, left: "n3a", right: "n2b" },
              { id: "n3a", value: 3, left: "n2a", right: "n1a", state: "compare" },
              { id: "n2a", value: 2, left: "n1b", right: "n0a", state: "compare" },
              { id: "n1a", value: 1, left: null, right: null },
              { id: "n1b", value: 1, left: null, right: null },
              { id: "n0a", value: 0, left: null, right: null },
              { id: "n2b", value: 2, left: "n1c", right: "n0b", state: "compare" },
              { id: "n1c", value: 1, left: null, right: null },
              { id: "n0b", value: 0, left: null, right: null },
              { id: "n3b", value: 3, left: "n2c", right: "n1d", state: "compare" },
              { id: "n2c", value: 2, left: "n1e", right: "n0c", state: "compare" },
              { id: "n1e", value: 1, left: null, right: null },
              { id: "n0c", value: 0, left: null, right: null },
              { id: "n1d", value: 1, left: null, right: null },
            ],
            note:
              "By the time the whole call tree for fibNaive(5) finishes, fibNaive(3) has been computed 2 " +
              "separate times (n3a, n3b — both marked here), fibNaive(2) has been computed 3 separate " +
              "times (n2a, n2b, n2c), and fibNaive(1)/fibNaive(0) even more — every one of those repeats " +
              "does the exact same work and returns the exact same answer.",
          },
          {
            rootId: "n5",
            nodes: [
              { id: "n5", value: 5, left: "n4", right: "n3b", state: "active" },
              { id: "n4", value: 4, left: "n3a", right: "n2b", state: "active" },
              { id: "n3a", value: 3, left: "n2a", right: "n1a", state: "active" },
              { id: "n2a", value: 2, left: "n1b", right: "n0a", state: "active" },
              { id: "n1a", value: 1, left: null, right: null, state: "done" },
              { id: "n1b", value: 1, left: null, right: null, state: "done" },
              { id: "n0a", value: 0, left: null, right: null, state: "done" },
              { id: "n2b", value: 2, left: null, right: null, state: "done" },
              { id: "n3b", value: 3, left: null, right: null, state: "done" },
            ],
            note:
              "fibMemo(5) makes the identical shape of recursive calls the first time each value is " +
              "needed, but the moment fibNaive(3) or fibNaive(2) would be re-entered (n3b, n2b here), " +
              "fibMemo finds it already in the map and returns instantly instead of expanding it again — " +
              "cutting an exponentially branching tree down to one real computation per distinct value of " +
              "n, 0 through 5.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The measured timing makes the point concretely: `fibNaive(35)` alone takes tens of milliseconds " +
        "of real, wasted recomputation, while `fibMemo(35)` — doing the exact same logical calculation — " +
        "finishes in a small enough fraction of a millisecond that it isn't distinguishable from zero. The " +
        "reason connects directly back to the recursion chapter: naive Fibonacci branches into *two* calls " +
        "per step, giving exponential growth in the number of calls; memoization collapses that back down to " +
        "one call per distinct `n`, since every repeat after the first is a map lookup, not a recomputation.",
    },
    { kind: "h", text: "Top-down (memoization) versus bottom-up (tabulation)" },
    {
      kind: "p",
      text:
        "Both `fibMemo` and `fibTabulation` compute the same thing in the same O(n) time, but the direction " +
        "is reversed. **Memoization** is top-down: you ask for `fib(n)`, and the recursion naturally " +
        "discovers which smaller subproblems it needs, computing (and caching) each one the first time it's " +
        "actually asked for — this is often the more natural translation from a recursive brute-force " +
        "solution, since you mostly just add a cache. **Tabulation** is bottom-up: you decide in advance the " +
        "order subproblems must be solved in (smallest first), fill an array iteratively, and read off the " +
        "final answer — no recursion, no call stack, and often a constant-factor faster runtime because " +
        "there's no function-call overhead. Tabulation's tradeoff is that you must work out the correct fill " +
        "order yourself, which is sometimes the harder part of designing a DP solution.",
    },
    {
      kind: "compare",
      title: "Memoization vs tabulation",
      columns: [
        {
          label: "Memoization (top-down)",
          items: [
            "You ask for `fib(n)`; recursion discovers which smaller subproblems it needs",
            "Often the more natural translation from a recursive brute-force solution",
            "Costs a call stack — recursion depth is real space, and function calls have overhead",
          ],
        },
        {
          label: "Tabulation (bottom-up)",
          items: [
            "You decide the fill order in advance (smallest first) and iterate",
            "No recursion, no call stack — usually the faster of the two in practice",
            "You must work out the correct fill order yourself, which is sometimes the hard part",
          ],
        },
      ],
    },
    {
      kind: "table",
      head: ["Approach", "Time", "Space", "Why"],
      rows: [
        [
          "fibNaive(n)",
          "{{O(2ⁿ)}}",
          "{{O(n)}}",
          "Each call branches into two more calls (mirroring the recursion chapter's branching-call " +
            "warning), and the recursion depth (space) is O(n) while the total call count grows " +
            "exponentially.",
        ],
        [
          "fibMemo(n) — top-down",
          "{{O(n)}}",
          "{{O(n)}}",
          "Each distinct value of n is computed exactly once; every repeat call is an O(1) map lookup " +
            "instead of new recursive work.",
        ],
        [
          "fibTabulation(n) — bottom-up",
          "{{O(n)}}",
          "{{O(n)}} (or {{O(1)}} if only the last two values are kept)",
          "One pass filling the table in dependency order, no recursion overhead; Fibonacci specifically " +
            "only ever needs the previous two values, so the array can be shrunk to two variables.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Adding memoization to a recursive function without first checking that it genuinely has " +
          "*overlapping* subproblems — if every recursive call has different arguments (no repeats), a cache " +
          "adds memory overhead for zero benefit.",
        "Using a plain array as a memo for parameters that aren't small, non-negative integers — a HashMap " +
          "keyed on the actual parameter tuple is the safer default when the subproblem space isn't a tidy " +
          "contiguous range.",
        "Forgetting the base case check *before* the memo lookup — checking memo first on a base case value " +
          "that was never explicitly stored can cause a wrong 'not found, recompute' path or worse depending " +
          "on the cache's default.",
        "In tabulation, filling the table in the wrong order — a cell's dependencies (dp[i-1], dp[i-2], ...) " +
          "must already be filled before that cell is computed, or the table reads stale (usually zero) " +
          "values.",
      ],
    },
    {
      kind: "remember",
      items: [
        "DP applies when a problem has optimal substructure (built from smaller versions of itself) and " +
          "overlapping subproblems (naive recursion repeats the same work).",
        "Memoization = top-down: recursion plus a cache, computing each subproblem the first time it's " +
          "actually needed.",
        "Tabulation = bottom-up: an iterative table filled smallest-to-largest, no recursion.",
        "Both turn exponential naive recursion into work proportional to the number of distinct subproblems " +
          "— usually O(n) or O(n²), not O(2ⁿ).",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Can this be optimised?\" after a naive recursive solution is very often fishing specifically for " +
          "memoization — spotting repeated arguments across recursive calls is the signal to add a cache.",
        "Interviewers frequently ask for both a top-down and a bottom-up version of the same DP solution, " +
          "to check that the tradeoffs (recursion overhead vs needing to work out fill order) are actually " +
          "understood, not just one memorised template.",
        "Being asked to further reduce space (like Fibonacci's O(n) table down to O(1) using two rolling " +
          "variables) is a common DP follow-up, testing whether you notice a subproblem only ever depends on " +
          "a fixed, small number of previous entries.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd add memoization to a naive recursive function that counts " +
          "the number of ways to climb n stairs taking 1 or 2 steps at a time — what's the repeated " +
          "subproblem?",
        "Explain how you would convert a top-down memoized solution into a bottom-up tabulated one for the " +
          "same problem, describing what determines the correct fill order for the table.",
        "Describe, in words, how Fibonacci's tabulation could be reduced from an O(n) array to two plain " +
          "variables, and why that reduction works here but wouldn't for every DP problem.",
        "Given a recursive function with overlapping subproblems but multiple changing parameters (not just " +
          "one integer n), describe how you'd choose a suitable memo key.",
      ],
    },
    {
      kind: "quiz",
      question: "What two properties must a problem have for dynamic programming to apply?",
      options: [
        "It must be solvable with a single for loop, and the inputs and outputs must involve only integers.",
        "Optimal substructure (answers build from smaller versions) and overlapping subproblems (repeated work).",
        "It must have exactly one base case and exactly one recursive case, so each call makes a single further call.",
        "It must be a sorting or searching problem, since dynamic programming only works on ordered data.",
      ],
      answer: 1,
      why:
        "Optimal substructure is what makes building up from smaller answers valid at all; overlapping " +
        "subproblems is what makes caching actually save work rather than just adding overhead.",
    },
    {
      kind: "quiz",
      question: "What is the key structural difference between memoization and tabulation?",
      options: [
        "They solve different kinds of problems entirely, so a problem that suits one cannot be solved with the other.",
        "Memoization is top-down (recursion plus a cache); tabulation is bottom-up (an iterative table).",
        "Tabulation is always slower than memoization, because filling a whole table does extra work for every single entry.",
        "Memoization works only for Fibonacci-style problems, since other recurrences cannot be cached by a map.",
      ],
      answer: 1,
      why:
        "Both eliminate redundant recomputation, but memoization discovers subproblems via recursion and " +
        "caches on the way, while tabulation requires deciding the fill order in advance and builds the " +
        "table iteratively.",
    },
    {
      kind: "quiz",
      question: "Why does fibNaive(n) run in O(2ⁿ) time while fibMemo(n) runs in O(n)?",
      options: [
        "fibMemo uses a closed-form mathematical formula instead of recursion, so it finishes in a fixed number of steps.",
        "fibNaive recomputes the same values over and over, so calls grow exponentially; fibMemo computes each n once.",
        "fibMemo skips most of the work by returning an approximate answer, which is why it can finish in just O(n) steps.",
        "The two functions have the same time complexity, since memoization only changes how much memory the program uses.",
      ],
      answer: 1,
      why:
        "Branching recursion without caching revisits the same subproblems exponentially many times; " +
        "caching collapses each distinct subproblem down to a single computation, bounding total work by " +
        "the number of distinct subproblems (n+1 values here).",
    },
  ],
};
