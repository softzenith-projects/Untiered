import type { Chapter } from "@/content/courses/types";

export const chapterRecursionDsa: Chapter = {
  slug: "recursion",
  title: "Recursion as a DSA Tool: Counting the Calls",
  summary:
    "The Java course covered recursion's mechanics; this chapter treats it as a DSA technique — counting " +
    "how many calls a recursive shape actually makes, since that count *is* its time complexity.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "You've already met the base case, the recursive case, and the call stack in the Java course. What " +
        "that chapter didn't dwell on is the question DSA cares about most: for a given recursive shape, " +
        "*how many calls does it actually make*, as a function of the input size? That count is the " +
        "algorithm's time complexity — not a separate thing to work out afterwards, but a direct read-off " +
        "of the recursion's structure, once you know how to look.",
    },
    { kind: "h", text: "The photocopy-of-a-photocopy analogy" },
    {
      kind: "analogy",
      title: "Halving a stack of papers versus removing one sheet at a time",
      text:
        "Say you need to reduce a stack of 1,024 sheets down to a single sheet. One way: remove one sheet, " +
        "check what's left, remove another, and so on — 1,023 removals. A different way: split the stack " +
        "exactly in half, set one half aside, and repeat on the remaining half — 1,024 becomes 512 becomes " +
        "256... down to 1, in just 10 splits. Both procedures reach the same end state; the number of " +
        "*steps* to get there is wildly different, and that difference is entirely down to whether each " +
        "step shrinks the problem by a fixed *amount* (one sheet) or by a fixed *fraction* (half). This is " +
        "exactly the difference between `powerLinear`, which peels off one multiplication per call, and " +
        "`powerFast`, which halves the exponent per call. Where the analogy stops: halving a real stack of " +
        "paper still needs a moment to physically separate it; halving a number in code costs the same, " +
        "negligible, one step regardless of how large the number is.",
    },
    { kind: "h", text: "Two recursive shapes for the same problem" },
    {
      kind: "code",
      caption:
        "Two ways to compute base^exp recursively: one call per unit of exponent, versus one call per " +
        "halving — plus a straightforward recursive array sum for comparison.",
      code:
        "public class PowerRecursion {\n" +
        "    static long powerLinear(int base, int exp) {\n" +
        "        if (exp == 0) {\n" +
        "            return 1;\n" +
        "        }\n" +
        "        return base * powerLinear(base, exp - 1);\n" +
        "    }\n" +
        "\n" +
        "    static long powerFast(int base, int exp) {\n" +
        "        if (exp == 0) {\n" +
        "            return 1;\n" +
        "        }\n" +
        "        long half = powerFast(base, exp / 2);\n" +
        "        if (exp % 2 == 0) {\n" +
        "            return half * half;\n" +
        "        } else {\n" +
        "            return half * half * base;\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    static int arraySumRecursive(int[] nums, int index) {\n" +
        "        if (index == nums.length) {\n" +
        "            return 0;\n" +
        "        }\n" +
        "        return nums[index] + arraySumRecursive(nums, index + 1);\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("powerLinear(2, 10) = " + powerLinear(2, 10));\n' +
        '        System.out.println("powerFast(2, 10) = " + powerFast(2, 10));\n' +
        '        System.out.println("powerFast(3, 13) = " + powerFast(3, 13));\n' +
        "\n" +
        "        int[] nums = {4, 2, 7, 1, 5};\n" +
        '        System.out.println("arraySumRecursive = " + arraySumRecursive(nums, 0));\n' +
        "    }\n" +
        "}\n",
      output:
        "powerLinear(2, 10) = 1024\npowerFast(2, 10) = 1024\npowerFast(3, 13) = 1594323\narraySumRecursive = 19",
      python:
        "def power_linear(base, exp):\n" +
        "    if exp == 0:\n" +
        "        return 1\n" +
        "    return base * power_linear(base, exp - 1)\n" +
        "\n" +
        "\n" +
        "def power_fast(base, exp):\n" +
        "    if exp == 0:\n" +
        "        return 1\n" +
        "    half = power_fast(base, exp // 2)\n" +
        "    if exp % 2 == 0:\n" +
        "        return half * half\n" +
        "    return half * half * base\n" +
        "\n" +
        "\n" +
        "def array_sum_recursive(nums, index):\n" +
        "    if index == len(nums):\n" +
        "        return 0\n" +
        "    return nums[index] + array_sum_recursive(nums, index + 1)\n" +
        "\n" +
        "\n" +
        'print("powerLinear(2, 10) =", power_linear(2, 10))\n' +
        'print("powerFast(2, 10) =", power_fast(2, 10))\n' +
        'print("powerFast(3, 13) =", power_fast(3, 13))\n' +
        "\n" +
        "nums = [4, 2, 7, 1, 5]\n" +
        'print("arraySumRecursive =", array_sum_recursive(nums, 0))\n',
      pythonOutput:
        "powerLinear(2, 10) = 1024\npowerFast(2, 10) = 1024\npowerFast(3, 13) = 1594323\narraySumRecursive = 19",
    },
    {
      kind: "viz",
      title: "powerFast(2, 10) — the exponent halving each call",
      caption: "The call stack grows on the way down, then resumes and computes on the way back up.",
      viz: {
        type: "callstack",
        frames: [
          {
            stack: [{ label: "powerFast(2, 10)", state: "active" }],
            note: "powerFast(2, 10) needs powerFast(2, 5) first (10/2=5). Call, and wait.",
          },
          {
            stack: [{ label: "powerFast(2, 10)" }, { label: "powerFast(2, 5)", state: "active" }],
            note: "powerFast(2, 5) needs powerFast(2, 2) first (5/2=2, integer division). Call, and wait.",
          },
          {
            stack: [
              { label: "powerFast(2, 10)" },
              { label: "powerFast(2, 5)" },
              { label: "powerFast(2, 2)", state: "active" },
            ],
            note: "powerFast(2, 2) needs powerFast(2, 1) first (2/2=1). Call, and wait.",
          },
          {
            stack: [
              { label: "powerFast(2, 10)" },
              { label: "powerFast(2, 5)" },
              { label: "powerFast(2, 2)" },
              { label: "powerFast(2, 1)", state: "active" },
            ],
            note: "powerFast(2, 1) needs powerFast(2, 0) first (1/2=0). Call, and wait.",
          },
          {
            stack: [
              { label: "powerFast(2, 10)" },
              { label: "powerFast(2, 5)" },
              { label: "powerFast(2, 2)" },
              { label: "powerFast(2, 1)" },
              { label: "powerFast(2, 0) -> returns 1", state: "returning" },
            ],
            note: "powerFast(2, 0) hits the base case directly: returns 1.",
          },
          {
            stack: [
              { label: "powerFast(2, 10)" },
              { label: "powerFast(2, 5)" },
              { label: "powerFast(2, 2)" },
              { label: "powerFast(2, 1) -> returns 2", state: "returning" },
            ],
            note: "powerFast(2, 1) resumes: half=1, exp is odd, returns half*half*base = 1*1*2 = 2.",
          },
          {
            stack: [
              { label: "powerFast(2, 10)" },
              { label: "powerFast(2, 5)" },
              { label: "powerFast(2, 2) -> returns 4", state: "returning" },
            ],
            note: "powerFast(2, 2) resumes: half=2, exp is even, returns half*half = 2*2 = 4.",
          },
          {
            stack: [
              { label: "powerFast(2, 10)" },
              { label: "powerFast(2, 5) -> returns 32", state: "returning" },
            ],
            note: "powerFast(2, 5) resumes: half=4, exp is odd, returns half*half*base = 4*4*2 = 32.",
          },
          {
            stack: [{ label: "powerFast(2, 10) -> returns 1024", state: "returning" }],
            note: "powerFast(2, 10) resumes: half=32, exp is even, returns half*half = 32*32 = 1024. Final answer.",
          },
          {
            stack: [],
            note:
              "Total calls: 5 (for exp values 10, 5, 2, 1, 0) — matching log₂(10) ≈ 3.3 rounded up, versus " +
              "powerLinear's 11 calls (one per unit from 10 down to 0).",
          },
        ],
      },
    },
    {
      kind: "table",
      head: ["Function", "Number of calls", "Time", "Why"],
      rows: [
        [
          "powerLinear(base, n)",
          "n + 1",
          "O(n)",
          "Each call reduces the exponent by exactly 1 — a fixed amount — so it takes n calls to reach 0.",
        ],
        [
          "powerFast(base, n)",
          "roughly log₂(n) + 1",
          "O(log n)",
          "Each call reduces the exponent by roughly half — a fixed fraction — so it takes only about " +
            "log₂(n) calls to reach 0.",
        ],
        [
          "arraySumRecursive(nums, 0)",
          "nums.length + 1",
          "O(n)",
          "Each call advances the index by exactly 1 through the array, one call per element plus the " +
            "base case.",
        ],
      ],
    },
    {
      kind: "p",
      text:
        "The general rule this reveals: **shrinking by a fixed amount gives O(n) calls; shrinking by a " +
        "fixed fraction gives O(log n) calls.** This single observation is why binary search (a later " +
        "chapter) is O(log n) and linear search is O(n), why merge sort's split step is O(log n) levels " +
        "deep, and why recognising *how* a recursive call shrinks its input is often enough to state the " +
        "complexity without writing out a single line of code.",
    },
    { kind: "h", text: "Recursion depth is a real cost, even when the count is small" },
    {
      kind: "p",
      text:
        "One more thing worth carrying forward from the Java course's call-stack picture: every paused call " +
        "occupies real memory on the call stack until it returns, so recursion depth is itself a **space** " +
        "cost, separate from the number of calls. `powerFast` makes far fewer calls than `powerLinear`, but " +
        "it's worth noticing that both are still O(log n) and O(n) in *space* respectively too — because " +
        "the deepest point of the recursion (how many calls are paused, waiting, at once) matches the call " +
        "count in both of these particular examples. That's not true of every recursive shape — some " +
        "algorithms make many calls but only a few are ever paused at once — which is exactly why time and " +
        "space are analysed separately, not assumed to match.",
    },
    {
      kind: "pitfall",
      items: [
        "Assuming all recursion is O(log n) because it 'divides' the problem — only recursion that shrinks " +
          "by a *fraction* each call is O(log n); recursion shrinking by a fixed amount is O(n), regardless " +
          "of how the code is phrased.",
        "Forgetting that a recursive call that branches into *multiple* smaller calls (like naive Fibonacci " +
          "in the Java course, or subsets in the next chapter) multiplies rather than simply adds — the " +
          "call count there grows exponentially, not logarithmically or linearly.",
        "Conflating 'number of calls' with 'time complexity per call' — arraySumRecursive makes O(n) calls " +
          "each doing O(1) work, for O(n) total; a recursive shape whose calls each do more work multiplies " +
          "accordingly.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A recursive function's time complexity is, directly, however many calls it makes as a function of " +
          "input size.",
        "Shrinking the input by a fixed amount each call gives O(n) calls; shrinking by a fixed fraction " +
          "gives O(log n) calls.",
        "A call that branches into multiple smaller recursive calls multiplies the call count, often giving " +
          "exponential growth — covered further in the next chapter, backtracking.",
        "Recursion depth is a real space cost (the call stack) — analyse time and space separately, since " +
          "they don't always match.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the time complexity of this recursive function?\" is frequently answerable by asking " +
          "yourself just one question: does each call shrink the input by a fixed amount, a fixed fraction, " +
          "or branch into multiple calls?",
        "Implementing fast exponentiation (`powerFast`) from scratch is a common way to test whether you " +
          "can recognise and apply the halving pattern, beyond memorising binary search alone.",
        "Being asked to convert a linear recursive solution into a faster one is a recurring interview arc " +
          "— the first question to ask yourself is exactly the one this chapter poses: can this be shrunk " +
          "by a fraction instead of an amount?",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Write out, in your own words, why a recursive function that computes the nth Fibonacci number by " +
          "calling itself twice per step (as in the Java course) makes exponentially many calls, not " +
          "linearly many.",
        "Describe a recursive approach to find the maximum value in an array by splitting it in half each " +
          "call, and state its call count in your own words.",
        "For a recursive function that removes the last two elements of a list each call (instead of one), " +
          "describe in words how its number of calls compares to one that removes only the last element " +
          "each call.",
        "Explain, in your own words, why a recursive function's call count and its space cost (call stack " +
          "depth) can differ — describe a shape where they wouldn't match.",
      ],
    },
    {
      kind: "quiz",
      question: "What determines whether a recursive function's call count is O(n) or O(log n)?",
      options: [
        "Whether the function returns a value or is void, since void functions always make fewer calls",
        "Whether each call shrinks the input by a fixed amount (O(n)) or a fixed fraction (O(log n))",
        "How many parameters the function takes, because every extra parameter doubles the number of calls",
        "Whether the base case tests for zero or for one, as that decides how many calls are made",
      ],
      answer: 1,
      why:
        "Shrinking by a fixed amount each call (like exp - 1) needs roughly n calls to reach the base case. " +
        "Shrinking by a fixed fraction each call (like exp / 2) needs only roughly log₂(n) calls, since " +
        "halving repeatedly reaches the base case far faster.",
    },
    {
      kind: "quiz",
      question: "How many recursive calls does powerFast(base, 16) make, approximately?",
      options: ["16 calls, one for each unit of the exponent", "8 calls, because the exponent is only halved once", "About 5: log₂(16) = 4 halvings, plus the base case", "256 calls, because each call makes two more calls"],
      answer: 2,
      why:
        "powerFast halves the exponent each call: 16 -> 8 -> 4 -> 2 -> 1 -> 0, which is 5 halving steps " +
        "plus the base case call — matching log₂(16) = 4 halvings needed to reach 1, plus one more " +
        "call to hit the base case at 0.",
    },
    {
      kind: "quiz",
      question: "Why is recursion depth described as a separate cost from the total number of calls?",
      options: [
        "They're always exactly equal, so the distinction is only theoretical and never matters in practice.",
        "Depth is how many calls are paused on the stack at once (space), unlike total calls made (time).",
        "Depth applies only to non-recursive functions, because recursive ones are measured by their call count.",
        "Java tracks depth and call count identically, so there's no real difference between the two measures.",
      ],
      answer: 1,
      why:
        "Total call count drives time complexity; how many of those calls are simultaneously paused, " +
        "waiting on the stack, drives space complexity. Some recursive shapes make many calls but keep the " +
        "stack shallow, so the two measurements genuinely need separate reasoning.",
    },
  ],
};
