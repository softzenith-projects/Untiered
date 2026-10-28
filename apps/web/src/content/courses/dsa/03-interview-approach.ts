import type { Chapter } from "@/content/courses/types";

export const chapterInterviewApproach: Chapter = {
  slug: "interview-approach",
  title: "How to Approach a DSA Problem in an Interview",
  summary:
    "A repeatable four-step routine — clarify, brute force, optimise, test — worked through end to end on " +
    "one problem, Two Sum, so the routine isn't just a list of words.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Knowing what a HashMap does and knowing what to *do* in the first ninety seconds after an " +
        "interviewer reads out a problem are two different skills — and the second one is what actually " +
        "determines how the interview goes, because a candidate who starts coding immediately, on a " +
        "half-understood problem, usually has to backtrack halfway through. This chapter is one routine, " +
        "practised on one problem, in full.",
    },
    {
      kind: "steps",
      title: "The four-step routine, in order, every time",
      steps: [
        { label: "Clarify", text: "Restate the problem and ask about the edges the statement left vague, before writing any code." },
        { label: "Brute force", text: "Write the most obvious correct solution, even knowing it isn't the best one." },
        { label: "Optimise", text: "Name the brute force's cost out loud, then find what work it re-derives that could be remembered instead." },
        { label: "Test", text: "Trace at least one normal case and the edge cases raised in clarification, by hand." },
      ],
    },
    { kind: "h", text: "The building-a-house-extension analogy" },
    {
      kind: "analogy",
      title: "An architect before the mason",
      text:
        "Before a mason lays a single brick for a house extension, an architect asks the owner exactly what " +
        "they need (clarify), sketches the simplest workable structure to confirm the idea holds together " +
        "(brute force), then reworks that sketch for cost and space before construction starts (optimise), " +
        "and afterwards walks the finished structure checking doors, windows, and drainage against the " +
        "original brief (test). Skipping straight to laying bricks on a guessed floor plan is how you end " +
        "up demolishing a wall halfway through. The four DSA steps are the same discipline, compressed into " +
        "an interview's twenty-five minutes. Where the analogy stops: a real architect's brief rarely " +
        "changes mid-project; an interviewer will sometimes deliberately add a new constraint after your " +
        "first solution, precisely to see whether you can adapt the existing structure rather than start " +
        "over.",
    },
    { kind: "h", text: "Step 1: Clarify" },
    {
      kind: "p",
      text:
        "Restate the problem in your own words and ask about the edges the statement left vague, before " +
        "writing a line of code. For \"given an array of numbers and a target, return the indices of two " +
        "numbers that add up to the target\": Can the same element be used twice? Is there always exactly " +
        "one valid answer, or could there be none, or several? Can the array contain negative numbers or " +
        "duplicates? These aren't stalling — a wrong assumption here silently produces a wrong solution " +
        "later, and asking signals exactly the habit interviewers are checking for.",
    },
    { kind: "h", text: "Step 2: Brute force" },
    {
      kind: "p",
      text:
        "Write the most obvious correct solution first, even knowing it isn't the best one — it proves you " +
        "understand the problem, gives you something to test against, and gives the interviewer a concrete " +
        "starting point to discuss. For Two Sum, the obvious approach is: check every pair of numbers, and " +
        "return the first pair that sums to the target.",
    },
    {
      kind: "code",
      caption:
        "Two Sum, brute force: check every pair. Not a full program — a snippet, the starting point of " +
        "the class built up over the next two code blocks.",
      code:
        "static int[] twoSumBrute(int[] nums, int target) {\n" +
        "    for (int i = 0; i < nums.length; i++) {\n" +
        "        for (int j = i + 1; j < nums.length; j++) {\n" +
        "            if (nums[i] + nums[j] == target) {\n" +
        "                return new int[]{i, j};\n" +
        "            }\n" +
        "        }\n" +
        "    }\n" +
        "    return new int[]{-1, -1};\n" +
        "}\n",
      python:
        "def two_sum_brute(nums, target):\n" +
        "    for i in range(len(nums)):\n" +
        "        for j in range(i + 1, len(nums)):\n" +
        "            if nums[i] + nums[j] == target:\n" +
        "                return i, j\n" +
        "    return -1, -1\n",
    },
    { kind: "h", text: "Step 3: Optimise" },
    {
      kind: "p",
      text:
        "Say the cost of the brute force out loud (\"this is O(n²) — for every number, I'm rescanning " +
        "the rest of the array\") and ask yourself what information you're re-deriving that you could " +
        "remember instead. Here, for each number `nums[i]`, the inner loop is really searching for one " +
        "specific value: `target - nums[i]`. A HashMap that remembers every number seen so far, alongside " +
        "its index, turns that search from \"rescan the rest of the array\" into \"one map lookup\" — the " +
        "same trade this course's first chapter made for duplicate-checking.",
    },
    {
      kind: "code",
      caption:
        "Two Sum, optimised: one pass, remembering every number seen so far in a HashMap, keyed by value.",
      code:
        "import java.util.HashMap;\n" +
        "import java.util.Map;\n" +
        "\n" +
        "public class TwoSum {\n" +
        "    static int[] twoSumBrute(int[] nums, int target) {\n" +
        "        for (int i = 0; i < nums.length; i++) {\n" +
        "            for (int j = i + 1; j < nums.length; j++) {\n" +
        "                if (nums[i] + nums[j] == target) {\n" +
        "                    return new int[]{i, j};\n" +
        "                }\n" +
        "            }\n" +
        "        }\n" +
        "        return new int[]{-1, -1};\n" +
        "    }\n" +
        "\n" +
        "    static int[] twoSumFast(int[] nums, int target) {\n" +
        "        Map<Integer, Integer> seenIndexOf = new HashMap<>();\n" +
        "        for (int i = 0; i < nums.length; i++) {\n" +
        "            int need = target - nums[i];\n" +
        "            if (seenIndexOf.containsKey(need)) {\n" +
        "                return new int[]{seenIndexOf.get(need), i};\n" +
        "            }\n" +
        "            seenIndexOf.put(nums[i], i);\n" +
        "        }\n" +
        "        return new int[]{-1, -1};\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] nums = {2, 7, 11, 15, 3};\n" +
        "        int target = 9;\n" +
        "        int[] r1 = twoSumBrute(nums, target);\n" +
        "        int[] r2 = twoSumFast(nums, target);\n" +
        '        System.out.println("brute: [" + r1[0] + ", " + r1[1] + "]");\n' +
        '        System.out.println("fast:  [" + r2[0] + ", " + r2[1] + "]");\n' +
        "    }\n" +
        "}\n",
      output: "brute: [0, 1]\nfast:  [0, 1]",
      python:
        "def two_sum_brute(nums, target):\n" +
        "    for i in range(len(nums)):\n" +
        "        for j in range(i + 1, len(nums)):\n" +
        "            if nums[i] + nums[j] == target:\n" +
        "                return i, j\n" +
        "    return -1, -1\n" +
        "\n" +
        "\n" +
        "def two_sum_fast(nums, target):\n" +
        "    seen_index_of = {}\n" +
        "    for i, num in enumerate(nums):\n" +
        "        need = target - num\n" +
        "        if need in seen_index_of:\n" +
        "            return seen_index_of[need], i\n" +
        "        seen_index_of[num] = i\n" +
        "    return -1, -1\n" +
        "\n" +
        "\n" +
        "nums = [2, 7, 11, 15, 3]\n" +
        "target = 9\n" +
        "r1 = two_sum_brute(nums, target)\n" +
        "r2 = two_sum_fast(nums, target)\n" +
        'print(f"brute: {list(r1)}")\n' +
        'print(f"fast:  {list(r2)}")\n',
      pythonOutput: "brute: [0, 1]\nfast:  [0, 1]",
    },
    {
      kind: "viz",
      title: "twoSumFast([2, 7, 11, 15, 3], target = 9)",
      caption: "A done cell has been stored in seenIndexOf; the compare pair is the match that ends the scan.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: 2, state: "active", pointers: ["i"] },
              { value: 7 },
              { value: 11 },
              { value: 15 },
              { value: 3 },
            ],
            note: "i=0, nums[0]=2. need = 9-2 = 7. seenIndexOf is empty, 7 not in it. Store 2 -> 0. seenIndexOf = {2: 0}.",
          },
          {
            cells: [
              { value: 2, state: "compare" },
              { value: 7, state: "compare", pointers: ["i"] },
              { value: 11 },
              { value: 15 },
              { value: 3 },
            ],
            note:
              "i=1, nums[1]=7. need = 9-7 = 2. 2 IS in seenIndexOf, at index 0. Return {0, 1} immediately — " +
              "nums[0] + nums[1] = 2 + 7 = 9. Indices 2, 3, 4 are never looked at.",
          },
        ],
      },
    },
    {
      kind: "table",
      head: ["Approach", "Time", "Space", "Why"],
      rows: [
        ["twoSumBrute", "O(n²)", "O(1)", "Checks every pair of the n numbers; no extra structure kept."],
        [
          "twoSumFast",
          "O(n)",
          "O(n)",
          "One pass; the map can hold up to n entries, trading memory for a constant-time lookup per step.",
        ],
      ],
    },
    { kind: "h", text: "Step 4: Test" },
    {
      kind: "p",
      text:
        "Before declaring done, walk through at least one normal case and the edge cases raised during " +
        "clarification: an array with no valid pair, an array with duplicate values, the smallest possible " +
        "input. Do this out loud, on paper or the whiteboard, tracing the code exactly the way the frames " +
        "above do — it's the single most effective way to catch an off-by-one error before the " +
        "interviewer does.",
    },
    {
      kind: "pitfall",
      items: [
        "Jumping straight to the optimised solution from memory, without narrating the brute force first — " +
          "it looks like you memorised the answer rather than derived it, and it removes the discussion " +
          "the interviewer wanted to have.",
        "Optimising time complexity while quietly introducing a bug — a faster wrong answer is worse than a " +
          "slower correct one; always re-test after optimising, not just after the first draft.",
        "Staying silent while thinking — interviewers are evaluating your reasoning, not just your final " +
          "code, so narrate the clarify and optimise steps rather than doing them silently.",
        "Skipping the test step because the code \"looks right\" — tracing a concrete example is often " +
          "where the actual bug is found, not where it's confirmed absent.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Clarify, brute force, optimise, test — in that order, every time, even under time pressure.",
        "The brute force isn't wasted work — it proves understanding and gives you something to optimise " +
          "against and test with.",
        "Say the current solution's complexity out loud before trying to improve it; you can't target an " +
          "improvement you haven't named.",
        "A trade of memory for time (an extra HashMap) is one of the single most common optimisation moves " +
          "in DSA — recognise it as a pattern, not a one-off trick.",
        "Testing means tracing a concrete example by hand, including at least one edge case, not just " +
          "reading the code over.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Interviewers routinely rate communication alongside correctness — narrating this four-step routine " +
          "out loud is itself part of what's being assessed, not a distraction from the \"real\" work.",
        "\"Can you do this in one pass instead of two?\" or \"...without extra space?\" are near-universal " +
          "follow-up prompts, and they map directly onto the optimise step.",
        "Two Sum specifically is one of the most frequently asked warm-up questions across companies — " +
          "not because the answer matters, but because it cleanly exercises this exact routine.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "For \"find the maximum sum of any two numbers in an array\", write out (in words) the clarifying " +
          "questions you'd ask before writing any code.",
        "Given an array, describe a brute-force approach (in words) to check if any two elements are equal " +
          "to *double* a third element, then describe how you'd start looking for a faster approach.",
        "Practise narrating, out loud, the complexity of a brute-force nested-loop solution to a problem of " +
          "your choice, before looking at any optimisation.",
        "For a problem that asks for the two closest numbers in an unsorted array, list what you'd test " +
          "for at the end: at least one normal case and two edge cases, in your own words.",
      ],
    },
    {
      kind: "quiz",
      question: "Why write a brute-force solution first, even when you suspect a better one exists?",
      options: [
        "It's required by convention, and has no practical benefit beyond making the interviewer comfortable",
        "It confirms you understand the problem and gives you a baseline to optimise and test against",
        "It's always the fastest solution to type, so it saves time compared to planning a better one",
        "Interviewers only grade the brute-force attempt, so the optimised version earns no extra credit",
      ],
      answer: 1,
      why:
        "The brute force proves the problem is understood correctly and gives a concrete, correct reference " +
        "point — both for reasoning about what to optimise and for checking the optimised version's answers " +
        "against.",
    },
    {
      kind: "quiz",
      question: "In twoSumFast, what does the HashMap seenIndexOf let the algorithm avoid doing?",
      options: [
        "Avoid reading the target value from the input, since the map already stores it for each index",
        "Avoid rescanning the rest of the array for a matching value on every iteration",
        "Avoid using indices altogether, because the map returns the values themselves in their place",
        "Avoid having to handle negative numbers separately, which would otherwise need a second pass",
      ],
      answer: 1,
      why:
        "The brute force's inner loop rescans the remaining array looking for a complement value on every " +
        "outer iteration. Storing every number seen so far in a HashMap turns that rescan into a single " +
        "map lookup per step.",
    },
    {
      kind: "quiz",
      question: "Which of these is the LEAST useful thing to do during the \"test\" step?",
      options: [
        "Trace a normal-case example by hand, step by step",
        "Check an edge case identified during clarification, such as an empty or duplicate-filled input",
        "Assume the code is correct because it compiles and reads clearly",
        "Compare the optimised solution's output against the brute force on the same input",
      ],
      answer: 2,
      why:
        "Compiling and reading clearly says nothing about logical correctness. Tracing concrete examples — " +
        "normal and edge cases — by hand is what actually surfaces bugs, which is the whole point of the " +
        "test step.",
    },
  ],
};
