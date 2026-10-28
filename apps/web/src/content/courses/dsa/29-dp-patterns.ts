import type { Chapter } from "@/content/courses/types";

export const chapterDpPatterns: Chapter = {
  slug: "dp-patterns",
  title: "DP Patterns: Knapsack, LCS, LIS, Grid Paths",
  summary:
    "Four classic dynamic programming shapes, each solving a different-looking problem with the same core " +
    "move: define what a table cell means, then say how it's built from smaller cells.",
  minutes: 17,
  blocks: [
    {
      kind: "p",
      text:
        "The hardest part of dynamic programming is rarely the code — it's deciding *what the table means*. " +
        "Once a cell's meaning is pinned down precisely ('the best value achievable using only the first i " +
        "items, within weight w', say), the rule for filling it (the **recurrence**) and the code that " +
        "implements that rule tend to follow directly. This chapter works through four of the most common DP " +
        "shapes in interviews, side by side, specifically so the pattern of defining a table and a recurrence " +
        "becomes recognisable across genuinely different problems.",
    },
    { kind: "h", text: "The packing-for-a-trip analogy" },
    {
      kind: "analogy",
      title: "Packing a bag with a strict weight limit",
      text:
        "You're packing one bag with a hard weight limit, choosing from items each with its own weight and " +
        "usefulness, and each item can go in at most once (you own only one of each). For every item, in " +
        "turn, you face one decision: leave it out, or take it (if it still fits) and give up its weight " +
        "for the rest of your choices. The **0/1 knapsack** problem is exactly this, formalised: dp[i][w] " +
        "means 'the best total value achievable, deciding only among the first i items, with w weight " +
        "capacity remaining.' Every other pattern in this chapter is a variation on the same idea — a table " +
        "indexed by 'how much of the input have I considered' and some other dimension, filled by a rule " +
        "that reuses smaller answers already computed. Where the analogy stops: a real bag-packing decision " +
        "is made once, by feel; the DP table explores every combination systematically, which is exactly " +
        "what guarantees it finds the true optimum, not just a good-looking one.",
    },
    { kind: "h", text: "Four patterns, one shared structure" },
    {
      kind: "code",
      caption:
        "0/1 knapsack (max value within weight capacity), longest common subsequence (LCS), longest " +
        "increasing subsequence (LIS), and grid paths (count routes moving only right/down) — four classic " +
        "2D and 1D tabulated DP solutions.",
      code:
        "import java.util.Arrays;\n" +
        "\n" +
        "public class DpPatterns {\n" +
        "    // 0/1 Knapsack: maximize value within weight capacity, each item used at most once.\n" +
        "    static int knapsack(int[] weights, int[] values, int capacity) {\n" +
        "        int n = weights.length;\n" +
        "        int[][] dp = new int[n + 1][capacity + 1];\n" +
        "        for (int i = 1; i <= n; i++) {\n" +
        "            for (int w = 0; w <= capacity; w++) {\n" +
        "                dp[i][w] = dp[i - 1][w]; // don't take item i-1\n" +
        "                if (weights[i - 1] <= w) {\n" +
        "                    dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weights[i - 1]] + values[i - 1]);\n" +
        "                }\n" +
        "            }\n" +
        "        }\n" +
        "        return dp[n][capacity];\n" +
        "    }\n" +
        "\n" +
        "    // Longest Common Subsequence\n" +
        "    static int lcs(String a, String b) {\n" +
        "        int n = a.length(), m = b.length();\n" +
        "        int[][] dp = new int[n + 1][m + 1];\n" +
        "        for (int i = 1; i <= n; i++) {\n" +
        "            for (int j = 1; j <= m; j++) {\n" +
        "                if (a.charAt(i - 1) == b.charAt(j - 1)) {\n" +
        "                    dp[i][j] = dp[i - 1][j - 1] + 1;\n" +
        "                } else {\n" +
        "                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);\n" +
        "                }\n" +
        "            }\n" +
        "        }\n" +
        "        return dp[n][m];\n" +
        "    }\n" +
        "\n" +
        "    // Longest Increasing Subsequence\n" +
        "    static int lis(int[] nums) {\n" +
        "        int n = nums.length;\n" +
        "        int[] dp = new int[n];\n" +
        "        Arrays.fill(dp, 1);\n" +
        "        int best = 1;\n" +
        "        for (int i = 1; i < n; i++) {\n" +
        "            for (int j = 0; j < i; j++) {\n" +
        "                if (nums[j] < nums[i]) {\n" +
        "                    dp[i] = Math.max(dp[i], dp[j] + 1);\n" +
        "                }\n" +
        "            }\n" +
        "            best = Math.max(best, dp[i]);\n" +
        "        }\n" +
        "        return best;\n" +
        "    }\n" +
        "\n" +
        "    // Grid paths: number of unique paths from top-left to bottom-right, moving only right or down\n" +
        "    static int uniquePaths(int rows, int cols) {\n" +
        "        int[][] dp = new int[rows][cols];\n" +
        "        for (int i = 0; i < rows; i++) dp[i][0] = 1;\n" +
        "        for (int j = 0; j < cols; j++) dp[0][j] = 1;\n" +
        "        for (int i = 1; i < rows; i++) {\n" +
        "            for (int j = 1; j < cols; j++) {\n" +
        "                dp[i][j] = dp[i - 1][j] + dp[i][j - 1];\n" +
        "            }\n" +
        "        }\n" +
        "        return dp[rows - 1][cols - 1];\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] weights = {2, 3, 4, 5};\n" +
        "        int[] values = {3, 4, 5, 6};\n" +
        '        System.out.println("knapsack capacity=5: " + knapsack(weights, values, 5));\n' +
        "\n" +
        '        System.out.println("lcs(\\"abcde\\", \\"ace\\"): " + lcs("abcde", "ace"));\n' +
        "\n" +
        "        int[] nums = {10, 9, 2, 5, 3, 7, 101, 18};\n" +
        '        System.out.println("lis: " + lis(nums));\n' +
        "\n" +
        '        System.out.println("uniquePaths(3, 7): " + uniquePaths(3, 7));\n' +
        "    }\n" +
        "}\n",
      output:
        'knapsack capacity=5: 7\nlcs("abcde", "ace"): 3\nlis: 4\nuniquePaths(3, 7): 28',
      python:
        "def knapsack(weights, values, capacity):\n" +
        "    n = len(weights)\n" +
        "    dp = [[0] * (capacity + 1) for _ in range(n + 1)]\n" +
        "    for i in range(1, n + 1):\n" +
        "        for w in range(capacity + 1):\n" +
        "            dp[i][w] = dp[i - 1][w]  # don't take item i-1\n" +
        "            if weights[i - 1] <= w:\n" +
        "                dp[i][w] = max(dp[i][w], dp[i - 1][w - weights[i - 1]] + values[i - 1])\n" +
        "    return dp[n][capacity]\n" +
        "\n" +
        "\n" +
        "def lcs(a, b):\n" +
        "    n, m = len(a), len(b)\n" +
        "    dp = [[0] * (m + 1) for _ in range(n + 1)]\n" +
        "    for i in range(1, n + 1):\n" +
        "        for j in range(1, m + 1):\n" +
        "            if a[i - 1] == b[j - 1]:\n" +
        "                dp[i][j] = dp[i - 1][j - 1] + 1\n" +
        "            else:\n" +
        "                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])\n" +
        "    return dp[n][m]\n" +
        "\n" +
        "\n" +
        "def lis(nums):\n" +
        "    n = len(nums)\n" +
        "    dp = [1] * n\n" +
        "    best = 1\n" +
        "    for i in range(1, n):\n" +
        "        for j in range(i):\n" +
        "            if nums[j] < nums[i]:\n" +
        "                dp[i] = max(dp[i], dp[j] + 1)\n" +
        "        best = max(best, dp[i])\n" +
        "    return best\n" +
        "\n" +
        "\n" +
        "def unique_paths(rows, cols):\n" +
        "    dp = [[0] * cols for _ in range(rows)]\n" +
        "    for i in range(rows):\n" +
        "        dp[i][0] = 1\n" +
        "    for j in range(cols):\n" +
        "        dp[0][j] = 1\n" +
        "    for i in range(1, rows):\n" +
        "        for j in range(1, cols):\n" +
        "            dp[i][j] = dp[i - 1][j] + dp[i][j - 1]\n" +
        "    return dp[rows - 1][cols - 1]\n" +
        "\n" +
        "\n" +
        "weights = [2, 3, 4, 5]\n" +
        "values = [3, 4, 5, 6]\n" +
        'print("knapsack capacity=5:", knapsack(weights, values, 5))\n' +
        "\n" +
        "print('lcs(\"abcde\", \"ace\"):', lcs(\"abcde\", \"ace\"))\n" +
        "\n" +
        "nums = [10, 9, 2, 5, 3, 7, 101, 18]\n" +
        'print("lis:", lis(nums))\n' +
        "\n" +
        'print("uniquePaths(3, 7):", unique_paths(3, 7))\n',
      pythonOutput:
        'knapsack capacity=5: 7\nlcs("abcde", "ace"): 3\nlis: 4\nuniquePaths(3, 7): 28',
    },
    {
      kind: "viz",
      title: "lcs(\"abcde\", \"ace\") — filling the table where dp[i][j] means 'LCS of the first i and first j characters'",
      caption: "Filled row by row; a highlighted cell is where this frame's step just wrote a new value.",
      viz: {
        type: "table",
        frames: [
          {
            rowLabels: ["i=0 (\"\")", "i=1 (a)", "i=2 (b)", "i=3 (c)", "i=4 (d)", "i=5 (e)"],
            colLabels: ["j=0 (\"\")", "j=1 (a)", "j=2 (c)", "j=3 (e)"],
            rows: [
              [0, 0, 0, 0],
              [0, null, null, null],
              [0, null, null, null],
              [0, null, null, null],
              [0, null, null, null],
              [0, null, null, null],
            ],
            note: "dp[0][*] and dp[*][0] are all 0 (an empty string has an LCS of length 0 with anything).",
          },
          {
            rowLabels: ["i=0 (\"\")", "i=1 (a)", "i=2 (b)", "i=3 (c)", "i=4 (d)", "i=5 (e)"],
            colLabels: ["j=0 (\"\")", "j=1 (a)", "j=2 (c)", "j=3 (e)"],
            rows: [
              [0, 0, 0, 0],
              [0, 1, 1, 1],
              [0, null, null, null],
              [0, null, null, null],
              [0, null, null, null],
              [0, null, null, null],
            ],
            highlight: [[1, 1]],
            note:
              "dp[1][1]: compare a[0]='a' vs b[0]='a' — match! dp[1][1] = dp[0][0] + 1 = 1. The rest of " +
              "row 1 ('a' against 'c', then 'e') finds no further matches, so it carries 1 forward: " +
              "row 1 = [0,1,1,1].",
          },
          {
            rowLabels: ["i=0 (\"\")", "i=1 (a)", "i=2 (b)", "i=3 (c)", "i=4 (d)", "i=5 (e)"],
            colLabels: ["j=0 (\"\")", "j=1 (a)", "j=2 (c)", "j=3 (e)"],
            rows: [
              [0, 0, 0, 0],
              [0, 1, 1, 1],
              [0, 1, 1, 1],
              [0, null, null, null],
              [0, null, null, null],
              [0, null, null, null],
            ],
            highlight: [[2, 1], [2, 2], [2, 3]],
            note:
              "Row 2 (a[1]='b'): 'b' matches neither 'a', 'c', nor 'e', so every cell just carries forward " +
              "the best of the cell above or to the left — row 2 = [0,1,1,1], unchanged from row 1.",
          },
          {
            rowLabels: ["i=0 (\"\")", "i=1 (a)", "i=2 (b)", "i=3 (c)", "i=4 (d)", "i=5 (e)"],
            colLabels: ["j=0 (\"\")", "j=1 (a)", "j=2 (c)", "j=3 (e)"],
            rows: [
              [0, 0, 0, 0],
              [0, 1, 1, 1],
              [0, 1, 1, 1],
              [0, 1, 2, 2],
              [0, null, null, null],
              [0, null, null, null],
            ],
            highlight: [[3, 2], [3, 3]],
            note:
              "dp[3][2]: a[2]='c' vs b[1]='c' — match! dp[3][2] = dp[2][1] + 1 = 1 + 1 = 2. dp[3][3]: " +
              "a[2]='c' vs b[2]='e' — no match, so dp[3][3] = max(dp[2][3], dp[3][2]) = max(1, 2) = 2. " +
              "Row 3 = [0,1,2,2].",
          },
          {
            rowLabels: ["i=0 (\"\")", "i=1 (a)", "i=2 (b)", "i=3 (c)", "i=4 (d)", "i=5 (e)"],
            colLabels: ["j=0 (\"\")", "j=1 (a)", "j=2 (c)", "j=3 (e)"],
            rows: [
              [0, 0, 0, 0],
              [0, 1, 1, 1],
              [0, 1, 1, 1],
              [0, 1, 2, 2],
              [0, 1, 2, 2],
              [0, null, null, null],
            ],
            highlight: [[4, 1], [4, 2], [4, 3]],
            note: "Row 4 (a[3]='d'): 'd' matches nothing in \"ace\", so the row carries forward unchanged: row 4 = [0,1,2,2].",
          },
          {
            rowLabels: ["i=0 (\"\")", "i=1 (a)", "i=2 (b)", "i=3 (c)", "i=4 (d)", "i=5 (e)"],
            colLabels: ["j=0 (\"\")", "j=1 (a)", "j=2 (c)", "j=3 (e)"],
            rows: [
              [0, 0, 0, 0],
              [0, 1, 1, 1],
              [0, 1, 1, 1],
              [0, 1, 2, 2],
              [0, 1, 2, 2],
              [0, 1, 2, 3],
            ],
            highlight: [[5, 3]],
            note:
              "dp[5][3]: a[4]='e' vs b[2]='e' — match! dp[5][3] = dp[4][2] + 1 = 2 + 1 = 3 — the final " +
              "answer: the LCS is exactly \"ace\", length 3, built by matching 'a', then 'c', then 'e' in " +
              "order.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Every one of these four solutions follows the same three-part recipe: (1) decide precisely what " +
        "`dp[i]` or `dp[i][j]` *means* in plain English before writing any code; (2) work out the " +
        "**recurrence** — how a cell's value is built from cells that are already filled (always smaller " +
        "indices, so nothing depends on itself); (3) pick a fill order that respects those dependencies " +
        "(usually just nested loops, smallest indices first). LCS and knapsack both grow a 2D table because " +
        "they each track two independent 'how much have I considered' dimensions (position in string A, " +
        "position in string B; item index, remaining capacity). LIS is 1D because it tracks only one " +
        "dimension, but its inner loop looks back at *every* earlier index, not just the immediately previous " +
        "one — dp[i] means 'the longest increasing subsequence ending exactly at index i', and it has to " +
        "check every earlier smaller value as a possible predecessor. Grid paths is 2D and the simplest " +
        "recurrence of the four: the number of ways to reach a cell is just the sum of the ways to reach the " +
        "cell above it and the cell to its left, because every path must arrive from exactly one of those " +
        "two directions.",
    },
    {
      kind: "table",
      head: ["Problem", "Table meaning", "Time", "Space", "Why"],
      rows: [
        [
          "0/1 Knapsack (n items, capacity C)",
          "dp[i][w] = best value using only the first i items, within weight w",
          "O(n·C)",
          "O(n·C)",
          "Every cell is filled once from at most two already-computed cells (skip item, or take item and " +
            "look up the remaining capacity).",
        ],
        [
          "LCS (lengths n, m)",
          "dp[i][j] = length of the LCS of the first i and first j characters",
          "O(n·m)",
          "O(n·m)",
          "Every cell compares one character pair and looks up at most three neighbouring cells (diagonal, " +
            "above, left).",
        ],
        [
          "LIS (length n)",
          "dp[i] = length of the longest increasing subsequence ending exactly at index i",
          "O(n²)",
          "O(n)",
          "Each dp[i] scans all earlier indices j < i to find valid predecessors — n cells, each doing up " +
            "to n comparisons.",
        ],
        [
          "Grid paths (rows r, cols c)",
          "dp[i][j] = number of ways to reach cell (i, j) from the top-left",
          "O(r·c)",
          "O(r·c)",
          "Every interior cell is the sum of exactly two already-computed cells (above, left) — the " +
            "simplest recurrence of the four.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Writing DP code before stating, in words, what a table cell means — without that sentence, it's " +
          "nearly impossible to work out (or debug) the recurrence correctly.",
        "In 0/1 knapsack, iterating the weight dimension in the wrong direction when attempting a " +
          "space-optimised 1D version — the 2D-to-1D optimisation for 0/1 knapsack requires iterating weight " +
          "*backward*, or an item can accidentally be counted more than once (a bug that silently turns 0/1 " +
          "knapsack into the different 'unbounded' knapsack problem).",
        "Confusing LCS (a *subsequence*, characters don't need to be contiguous) with the longest common " +
          "*substring* (characters must be contiguous) — the two have similar-looking recurrences but " +
          "genuinely different rules and different correct answers.",
        "Forgetting that LIS's inner loop must check *all* earlier indices, not just the immediately " +
          "preceding one — an increasing subsequence's previous element could be several positions back, " +
          "which is exactly why the straightforward LIS solution is O(n²), not O(n).",
      ],
    },
    {
      kind: "remember",
      items: [
        "Always state a DP table's meaning in plain English before coding the recurrence.",
        "0/1 Knapsack: dp[i][w] = best value from the first i items within weight w; each item is skip-or- " +
          "take, never both.",
        "LCS: dp[i][j] = LCS length of the first i and j characters; match extends the diagonal, mismatch " +
          "takes the better of above/left.",
        "LIS: dp[i] = longest increasing run ending at i; check every earlier smaller value as a possible " +
          "predecessor.",
        "Grid paths: dp[i][j] = ways to reach (i,j) = ways from above + ways from the left.",
      ],
    },
    {
      kind: "interview",
      items: [
        "0/1 knapsack is one of the most-referenced DP archetypes precisely because many other problems " +
          "(subset sum, partition equal subset sum, target sum) are knapsack with a small twist — recognising " +
          "the shape is often the whole battle.",
        "\"Longest common subsequence\" and its cousin \"edit distance\" (minimum insert/delete/replace " +
          "operations to transform one string into another) share almost the same 2D recurrence structure, " +
          "and are both extremely common string-DP interview questions.",
        "\"Longest increasing subsequence\" is frequently followed up with 'can you do better than O(n²)?' — " +
          "an O(n log n) approach exists using binary search, worth knowing exists even if the O(n²) version " +
          "is what you write first.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd adapt the 0/1 knapsack recurrence to solve 'subset sum' — " +
          "does a subset of the given numbers add up to exactly a target value?",
        "Explain, in words, how you'd extend the LCS table to also reconstruct the actual longest common " +
          "subsequence string, not just its length.",
        "Given the grid-paths problem, describe how you'd handle some cells being blocked (impassable), and " +
          "what changes in the recurrence.",
        "Describe how edit distance (minimum insertions, deletions, and substitutions to turn one string " +
          "into another) could be solved with a 2D table similar in shape to this chapter's LCS solution.",
      ],
    },
    {
      kind: "quiz",
      question: "In the 0/1 knapsack recurrence, what does dp[i][w] represent?",
      options: [
        "The weight of the ith item",
        "The best total value achievable choosing only among the first i items, with w weight capacity " +
          "available",
        "The number of items that fit in weight w",
        "Whether item i fits in the knapsack",
      ],
      answer: 1,
      why:
        "Precisely defining the table's meaning is what makes the recurrence (skip item i-1, or take it if " +
        "it fits and add its value) provably correct — it's answering exactly this question at every cell.",
    },
    {
      kind: "quiz",
      question: "Why is the standard LIS solution's time complexity O(n²) rather than O(n)?",
      options: [
        "Because it sorts the array first, which costs O(n log n) and is then rounded up to O(n²) in the analysis.",
        "For each index i, the inner loop checks every earlier index j < i as a possible predecessor.",
        "Because Java arrays are inherently O(n) to access, so every single read inside the loop costs a full pass.",
        "It's actually O(n), and the problem statement is wrong, because each element only needs one comparison.",
      ],
      answer: 1,
      why:
        "An increasing subsequence's predecessor could be any earlier smaller value, not necessarily the " +
        "adjacent one — dp[i] must consider all n possible predecessors, for n total indices, giving O(n²).",
    },
    {
      kind: "quiz",
      question: "In the grid-paths recurrence, why is dp[i][j] = dp[i-1][j] + dp[i][j-1]?",
      options: [
        "It's an arbitrary formula that happens to work, because grid problems always add the cells next to the one being filled.",
        "Every path to cell (i, j) arrives from above or from the left, so the two counts add.",
        "Because rows and columns must always be equal in size, so the two neighbouring cells contribute the same amount each time.",
        "Because dp[i-1][j] and dp[i][j-1] are always equal to each other, so adding them is the same as doubling one of them.",
      ],
      answer: 1,
      why:
        "With only rightward and downward moves allowed, every route to (i, j) took its very last step from " +
        "exactly one of two cells, so counting all routes is exactly summing the routes to each of those " +
        "two predecessors.",
    },
  ],
};
