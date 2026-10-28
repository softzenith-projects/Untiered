import type { Chapter } from "@/content/courses/types";

export const chapterPrefixSums: Chapter = {
  slug: "prefix-sums",
  title: "Prefix Sums",
  summary:
    "Precompute running totals once, and every range-sum question afterwards becomes one subtraction — " +
    "O(n) to build, O(1) per query.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "Suppose you're asked the sum of elements from index 1 to index 3 in an array — easy, add three " +
        "numbers. Now suppose you're asked that same kind of question a thousand times, for a thousand " +
        "different ranges, on the same unchanging array. Re-adding the relevant slice every single time " +
        "works, but it repeats work across queries that overlap — and most ranges do overlap. A **prefix " +
        "sum** array precomputes, once, the running total up to every index, so any range sum afterwards is " +
        "a single subtraction.",
    },
    { kind: "h", text: "The odometer analogy" },
    {
      kind: "analogy",
      title: "A car's odometer readings at every milestone",
      text:
        "Imagine noting your car's total odometer reading every time you pass a milestone on a long " +
        "highway trip — not the distance *between* milestones, the cumulative total *since the trip " +
        "started*. To find the distance travelled between milestone 3 and milestone 7, you don't re-drive " +
        "that stretch or re-add every segment in between — you subtract the odometer reading at milestone 3 " +
        "from the reading at milestone 7. All the effort of accumulating went in once, at the start; every " +
        "\"distance between two milestones\" question afterwards is one subtraction. A prefix sum array is " +
        "exactly this: `prefix[i]` is the running total from the start up to (but not including) index i, " +
        "and the sum of any range `[left, right]` is `prefix[right + 1] - prefix[left]`. Where the analogy " +
        "stops: an odometer only ever increases; a prefix sum array works identically even when the " +
        "underlying numbers are negative, since it's tracking a running total, not a physical distance.",
    },
    { kind: "h", text: "Building and querying" },
    {
      kind: "code",
      caption:
        "Build a prefix sum array once, then answer any range sum with one subtraction.",
      code:
        "public class PrefixSums {\n" +
        "    static int[] buildPrefix(int[] nums) {\n" +
        "        int[] prefix = new int[nums.length + 1];\n" +
        "        for (int i = 0; i < nums.length; i++) {\n" +
        "            prefix[i + 1] = prefix[i] + nums[i];\n" +
        "        }\n" +
        "        return prefix;\n" +
        "    }\n" +
        "\n" +
        "    static int rangeSum(int[] prefix, int left, int right) {\n" +
        "        return prefix[right + 1] - prefix[left];\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] nums = {4, 2, 7, 1, 5, 3};\n" +
        "        int[] prefix = buildPrefix(nums);\n" +
        "        StringBuilder sb = new StringBuilder();\n" +
        "        for (int p : prefix) {\n" +
        '            sb.append(p).append(" ");\n' +
        "        }\n" +
        '        System.out.println("prefix: " + sb.toString().trim());\n' +
        '        System.out.println("sum[1..3]: " + rangeSum(prefix, 1, 3));\n' +
        '        System.out.println("sum[0..5]: " + rangeSum(prefix, 0, 5));\n' +
        '        System.out.println("sum[2..2]: " + rangeSum(prefix, 2, 2));\n' +
        "    }\n" +
        "}\n",
      output: "prefix: 0 4 6 13 14 19 22\nsum[1..3]: 10\nsum[0..5]: 22\nsum[2..2]: 7",
      python:
        "def build_prefix(nums):\n" +
        "    prefix = [0] * (len(nums) + 1)\n" +
        "    for i, num in enumerate(nums):\n" +
        "        prefix[i + 1] = prefix[i] + num\n" +
        "    return prefix\n" +
        "\n" +
        "\n" +
        "def range_sum(prefix, left, right):\n" +
        "    return prefix[right + 1] - prefix[left]\n" +
        "\n" +
        "\n" +
        "nums = [4, 2, 7, 1, 5, 3]\n" +
        "prefix = build_prefix(nums)\n" +
        'print("prefix:", " ".join(str(p) for p in prefix))\n' +
        'print("sum[1..3]:", range_sum(prefix, 1, 3))\n' +
        'print("sum[0..5]:", range_sum(prefix, 0, 5))\n' +
        'print("sum[2..2]:", range_sum(prefix, 2, 2))\n',
      pythonOutput: "prefix: 0 4 6 13 14 19 22\nsum[1..3]: 10\nsum[0..5]: 22\nsum[2..2]: 7",
    },
    {
      kind: "viz",
      title: "buildPrefix({4, 2, 7, 1, 5, 3}) — accumulating once",
      caption: "Each cell is the running total up to (not including) its index. '?' means not built yet.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: 0, state: "done" },
              { value: "?" }, { value: "?" }, { value: "?" }, { value: "?" }, { value: "?" }, { value: "?" },
            ],
            note: "prefix[0] = 0 by definition — the sum of zero elements.",
          },
          {
            cells: [
              { value: 0, state: "done" },
              { value: 4, state: "active" },
              { value: "?" }, { value: "?" }, { value: "?" }, { value: "?" }, { value: "?" },
            ],
            note: "prefix[1] = prefix[0] + nums[0] = 0 + 4 = 4.",
          },
          {
            cells: [
              { value: 0, state: "done" }, { value: 4, state: "done" },
              { value: 6, state: "active" },
              { value: "?" }, { value: "?" }, { value: "?" }, { value: "?" },
            ],
            note: "prefix[2] = prefix[1] + nums[1] = 4 + 2 = 6.",
          },
          {
            cells: [
              { value: 0, state: "done" }, { value: 4, state: "done" }, { value: 6, state: "done" },
              { value: 13, state: "active" },
              { value: "?" }, { value: "?" }, { value: "?" },
            ],
            note: "prefix[3] = prefix[2] + nums[2] = 6 + 7 = 13.",
          },
          {
            cells: [
              { value: 0, state: "done" }, { value: 4, state: "done" }, { value: 6, state: "done" }, { value: 13, state: "done" },
              { value: 14, state: "active" },
              { value: "?" }, { value: "?" },
            ],
            note: "prefix[4] = prefix[3] + nums[3] = 13 + 1 = 14.",
          },
          {
            cells: [
              { value: 0, state: "done" }, { value: 4, state: "done" }, { value: 6, state: "done" }, { value: 13, state: "done" }, { value: 14, state: "done" },
              { value: 19, state: "active" },
              { value: "?" },
            ],
            note: "prefix[5] = prefix[4] + nums[4] = 14 + 5 = 19.",
          },
          {
            cells: [
              { value: 0, state: "done" }, { value: 4, state: "done" }, { value: 6, state: "done" }, { value: 13, state: "done" }, { value: 14, state: "done" }, { value: 19, state: "done" },
              { value: 22, state: "active" },
            ],
            note: "prefix[6] = prefix[5] + nums[5] = 19 + 3 = 22.",
          },
          {
            cells: [
              { value: 0 },
              { value: 4, pointers: ["left"] },
              { value: 6 }, { value: 13 },
              { value: 14, pointers: ["right+1"] },
              { value: 19 }, { value: 22 },
            ],
            range: [1, 4],
            note:
              "rangeSum(1, 3) asks for nums[1]+nums[2]+nums[3] = 2+7+1 = 10, and prefix[4]-prefix[1] = 14-4 = " +
              "10 — matches, without re-adding those three numbers directly.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The one deliberately awkward-looking detail — `prefix` has length `nums.length + 1`, and " +
        "`prefix[0] = 0` — exists precisely so that `rangeSum(0, right)` (a range starting at the very " +
        "first element) works without a special case: `prefix[right + 1] - prefix[0]` is just " +
        "`prefix[right + 1] - 0`. Skipping that leading zero would force an `if (left == 0)` branch " +
        "everywhere the range sum is used — a small design choice that removes an entire category of edge " +
        "case.",
    },
    {
      kind: "table",
      head: ["Approach", "Build cost", "Per-query cost", "Why"],
      rows: [
        [
          "Re-sum the range directly, every query",
          "—",
          "O(n) worst case",
          "A single query can touch up to the whole array; q queries cost up to O(n × q) total.",
        ],
        [
          "Prefix sums",
          "O(n)",
          "O(1)",
          "One pass builds the running totals; every query afterwards is one subtraction, regardless of " +
            "the range's width.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Off-by-one errors on the prefix array's indices — `prefix[i]` is the sum *before* index i, not " +
          "including it; `rangeSum(left, right)` must use `prefix[right + 1]`, not `prefix[right]`, to " +
          "actually include `nums[right]`.",
        "Rebuilding the prefix array from scratch after the underlying array changes — prefix sums answer " +
          "range queries fast on a *fixed* array; if updates are frequent, a different structure (beyond " +
          "this chapter) is usually needed instead.",
        "Reaching for prefix sums when only one or two range queries are ever needed — the O(n) build cost " +
          "isn't worth it unless there are enough queries to amortise it; for a single query, direct " +
          "summing is simpler and no slower overall.",
      ],
    },
    {
      kind: "remember",
      items: [
        "prefix[i] holds the running total of everything *before* index i; prefix[0] = 0 by definition.",
        "Range sum [left, right] = prefix[right + 1] - prefix[left] — one subtraction, no re-adding.",
        "Build once in O(n); every query afterwards is O(1) — the trade-off pays off once there are enough " +
          "queries.",
        "Prefix sums fit a *fixed* array with *many* range queries; frequent updates need a different tool.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"We'll be asking many range-sum queries on this array\" is close to a direct signal for prefix " +
          "sums — listen for the word 'many' and for the array being described as unchanging.",
        "Prefix sums extend naturally to 2D grids (sum of any sub-rectangle) and to counting problems " +
          "(subarrays summing to exactly k, using a running-total HashMap) — recognising the core idea " +
          "transfers directly to both.",
        "\"What if the array can be updated between queries?\" is a common follow-up meant to test whether " +
          "you recognise prefix sums' limits, not just their use case.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Given an array and a list of (left, right) ranges to sum, describe in words why building one " +
          "prefix array up front beats summing each range directly, once there are many ranges.",
        "Describe, in your own words, how you'd extend the prefix sum idea to a 2D grid, to answer the sum " +
          "of any rectangular sub-region quickly.",
        "Given an array of positive and negative numbers, describe how a running total stored in a HashMap " +
          "(not a plain prefix array) could help count how many subarrays sum to exactly zero.",
        "Explain, in your own words, why prefix sums stop being a good fit if the underlying array is " +
          "updated frequently between queries.",
      ],
    },
    {
      kind: "quiz",
      question: "What does prefix[i] represent in the buildPrefix code above?",
      options: [
        "The value of nums[i], copied across so that it can be looked up quickly later",
        "The sum of all elements from index 0 up to, but not including, index i",
        "The maximum element seen so far, updated each time a larger value is found",
        "The index of the largest element that appears before position i in the array",
      ],
      answer: 1,
      why:
        "prefix[i] is the running total of everything before index i — prefix[0] is 0 (sum of nothing), " +
        "and each step adds exactly one more element of nums.",
    },
    {
      kind: "quiz",
      question: "Why is rangeSum(prefix, left, right) computed as prefix[right + 1] - prefix[left], and not prefix[right] - prefix[left]?",
      options: [
        "Both formulas give the same answer for every range, so the choice of index doesn't matter",
        "prefix[right] excludes nums[right]; prefix[right + 1] is needed to include it in the sum",
        "It's a Java syntax requirement for array indexing, since indexes must always start at one",
        "prefix[right + 1] is always the array's last element, so the subtraction removes the correct tail",
      ],
      answer: 1,
      why:
        "Since prefix[i] sums everything before index i, prefix[right] would stop just short of including " +
        "nums[right]. prefix[right + 1] includes it, which is required for a range that's meant to be " +
        "inclusive of right.",
    },
    {
      kind: "quiz",
      question: "When is the prefix sum technique NOT a good fit?",
      options: [
        "When there will be many range-sum queries on a fixed array that is never changed",
        "When the array is updated frequently between queries that need the latest values",
        "When the array contains negative numbers, since subtraction then gives a wrong total",
        "When the array has fewer than 10 elements, because prefix sums need at least ten values",
      ],
      answer: 1,
      why:
        "A prefix sum array reflects the array's state at the moment it was built. If the array changes " +
        "often and queries must reflect those changes, either the whole prefix array must be rebuilt " +
        "(costly) or a different, update-friendly structure is needed instead.",
    },
  ],
};
