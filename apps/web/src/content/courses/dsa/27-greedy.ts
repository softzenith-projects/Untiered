import type { Chapter } from "@/content/courses/types";

export const chapterGreedy: Chapter = {
  slug: "greedy",
  title: "Greedy Algorithms",
  summary:
    "Take the best-looking option right now, never reconsider it, and hope the local best choices add up " +
    "to the global best answer — sometimes that hope is a guarantee, and sometimes it's a trap.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "A **greedy algorithm** builds a solution step by step, at each step making whichever choice looks " +
        "best *right now*, and never revisiting that choice later. It's the simplest possible strategy — no " +
        "backtracking, no exploring alternatives — and when it works, it's usually fast and easy to reason " +
        "about. The catch is that it doesn't always work: 'best right now' and 'best overall' are the same " +
        "thing only for problems with a specific mathematical property, and greedy applied to a problem " +
        "without that property produces a wrong answer with total confidence. This chapter is as much about " +
        "recognising *when* greedy is safe as about writing greedy code.",
    },
    { kind: "h", text: "The exam-strategy analogy" },
    {
      kind: "analogy",
      title: "Answering an exam's easiest questions first",
      text:
        "A common exam strategy: scan the paper, answer the questions you find easiest first, banking those " +
        "marks immediately, then move to harder ones with whatever time remains. This works well *because " +
        "of a property of exams*: marks from an early question don't get taken away or changed by which " +
        "later question you answer — each question's marks are locked in independently the moment you " +
        "answer it. Now imagine a stranger version of an exam where answering question 3 correctly somehow " +
        "invalidates your earlier answer to question 1 unless you'd chosen it a specific way — greedily " +
        "grabbing question 1's easy marks first could now actively hurt your final score. That second, " +
        "invented exam is what a problem *without* the greedy-safe property looks like: local choices " +
        "interact with each other in a way that local, in-the-moment decisions can't see. Where the analogy " +
        "stops: figuring out whether a real exam has this property is obvious to a student; figuring out " +
        "whether a DSA problem has it is exactly the skill this chapter is building.",
    },
    { kind: "h", text: "A problem where greedy is provably correct: activity selection" },
    {
      kind: "code",
      caption:
        "Activity selection (pick the maximum number of non-overlapping time intervals) — provably solved by " +
        "greedy, sorted by end time — plus a greedy coin-change routine that only works for certain coin " +
        "systems, illustrated as a cautionary contrast.",
      code:
        "import java.util.Arrays;\n" +
        "import java.util.Comparator;\n" +
        "\n" +
        "public class GreedyOps {\n" +
        "    // Activity selection: given start/end times, choose the max number of non-overlapping activities.\n" +
        "    static int maxActivities(int[][] activities) {\n" +
        "        Arrays.sort(activities, Comparator.comparingInt(a -> a[1])); // sort by end time\n" +
        "        int count = 0;\n" +
        "        int lastEnd = Integer.MIN_VALUE;\n" +
        "        for (int[] a : activities) {\n" +
        "            if (a[0] >= lastEnd) {\n" +
        "                count++;\n" +
        "                lastEnd = a[1];\n" +
        "            }\n" +
        "        }\n" +
        "        return count;\n" +
        "    }\n" +
        "\n" +
        "    // Minimum coins for a value, using a canonical coin system (greedy works here, not for all systems)\n" +
        "    static int minCoinsGreedy(int[] coins, int amount) {\n" +
        "        Arrays.sort(coins);\n" +
        "        int count = 0;\n" +
        "        for (int i = coins.length - 1; i >= 0 && amount > 0; i--) {\n" +
        "            count += amount / coins[i];\n" +
        "            amount %= coins[i];\n" +
        "        }\n" +
        "        return amount == 0 ? count : -1;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[][] activities = {{1, 4}, {3, 5}, {0, 6}, {5, 7}, {3, 8}, {5, 9}, {6, 10}, {8, 11}, " +
        "{8, 12}, {2, 13}, {12, 14}};\n" +
        '        System.out.println("max non-overlapping activities: " + maxActivities(activities));\n' +
        "\n" +
        "        int[] coins = {1, 5, 10, 25};\n" +
        '        System.out.println("minCoinsGreedy(41): " + minCoinsGreedy(coins, 41));\n' +
        "    }\n" +
        "}\n",
      output: "max non-overlapping activities: 4\nminCoinsGreedy(41): 4",
      python:
        "def max_activities(activities):\n" +
        "    activities = sorted(activities, key=lambda a: a[1])  # sort by end time\n" +
        "    count = 0\n" +
        "    last_end = float(\"-inf\")\n" +
        "    for start, end in activities:\n" +
        "        if start >= last_end:\n" +
        "            count += 1\n" +
        "            last_end = end\n" +
        "    return count\n" +
        "\n" +
        "\n" +
        "def min_coins_greedy(coins, amount):\n" +
        "    count = 0\n" +
        "    for coin in sorted(coins, reverse=True):\n" +
        "        if amount <= 0:\n" +
        "            break\n" +
        "        coins_used, amount = divmod(amount, coin)\n" +
        "        count += coins_used\n" +
        "    return count if amount == 0 else -1\n" +
        "\n" +
        "\n" +
        "activities = [(1, 4), (3, 5), (0, 6), (5, 7), (3, 8), (5, 9), (6, 10), (8, 11), (8, 12), (2, 13), (12, 14)]\n" +
        'print("max non-overlapping activities:", max_activities(activities))\n' +
        "\n" +
        "coins = [1, 5, 10, 25]\n" +
        'print("minCoinsGreedy(41):", min_coins_greedy(coins, 41))\n',
      pythonOutput: "max non-overlapping activities: 4\nminCoinsGreedy(41): 4",
    },
    {
      kind: "viz",
      title: "maxActivities — after sorting by end time, walking left to right",
      caption: "A done cell is taken (it extends lastEnd); the compare cell is rejected for starting before the last activity taken ends.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "(1,4)" }, { value: "(3,5)" }, { value: "(0,6)" }, { value: "(5,7)" }, { value: "(8,11)" }, { value: "(12,14)" }],
            note: "Sorted by end time, the relevant early activities are: (1,4), (3,5), (0,6), (5,7), ... lastEnd starts at -infinity.",
          },
          {
            cells: [{ value: "(1,4)", state: "done", pointers: ["i"] }, { value: "(3,5)" }, { value: "(0,6)" }, { value: "(5,7)" }, { value: "(8,11)" }, { value: "(12,14)" }],
            note: "(1,4): start 1 >= lastEnd (-inf)? Yes — take it. count=1, lastEnd=4.",
          },
          {
            cells: [{ value: "(1,4)", state: "done" }, { value: "(3,5)", state: "compare", pointers: ["i"] }, { value: "(0,6)" }, { value: "(5,7)" }, { value: "(8,11)" }, { value: "(12,14)" }],
            note: "(3,5): start 3 >= lastEnd (4)? No — 3 < 4, it would overlap the activity we just took. Skip.",
          },
          {
            cells: [{ value: "(1,4)", state: "done" }, { value: "(3,5)", state: "compare" }, { value: "(0,6)", state: "compare", pointers: ["i"] }, { value: "(5,7)" }, { value: "(8,11)" }, { value: "(12,14)" }],
            note: "(0,6): start 0 >= 4? No. Skip.",
          },
          {
            cells: [{ value: "(1,4)", state: "done" }, { value: "(3,5)", state: "compare" }, { value: "(0,6)", state: "compare" }, { value: "(5,7)", state: "done", pointers: ["i"] }, { value: "(8,11)" }, { value: "(12,14)" }],
            note: "(5,7): start 5 >= 4? Yes — take it. count=2, lastEnd=7.",
          },
          {
            cells: [{ value: "(1,4)", state: "done" }, { value: "(3,5)", state: "compare" }, { value: "(0,6)", state: "compare" }, { value: "(5,7)", state: "done" }, { value: "(8,11)", state: "done" }, { value: "(12,14)", state: "done" }],
            note:
              "Continuing this rule for the rest of the sorted list eventually takes (8,11) and (12,14) as " +
              "well, for a final count of 4 — the maximum possible, confirmed by the program's output.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Why is sorting by **end time**, specifically, the safe greedy move here? Because whichever activity " +
        "ends earliest leaves the most room for everything after it — choosing it can never be worse than " +
        "choosing any activity that ends later, since any schedule that includes a later-ending activity " +
        "could always swap it for the earliest-ending one without losing any future options. That argument " +
        "— 'this greedy choice is never worse than any alternative' — is what a proof of greedy correctness " +
        "actually looks like, and it's specific to *this* problem's structure, not a general license to sort " +
        "by whatever seems relevant and grab greedily.",
    },
    { kind: "h", text: "When greedy quietly fails: coin change" },
    {
      kind: "p",
      text:
        "`minCoinsGreedy` (repeatedly take the largest coin that fits) gives the right answer for India's or " +
        "the US's coin denominations, because those systems happen to be **canonical** — every amount's " +
        "greedy choice is provably optimal for that specific set of coin values. But hand the same greedy " +
        "function coins `{1, 3, 4}` and ask for change for 6: greedy takes one 4, then two 1s, for 3 coins " +
        "total — while the actual optimal answer is two 3s, for 2 coins. Greedy doesn't reconsider the 4 " +
        "once it's taken it, even though taking it turned out to be a mistake. This is precisely the failure " +
        "mode dynamic programming (next chapter) is built to fix: it explores the choices greedy commits to " +
        "blindly, keeping track of which combination is actually best.",
    },
    {
      kind: "table",
      head: ["Problem", "Greedy correct?", "Time", "Why"],
      rows: [
        [
          "Activity selection (max non-overlapping intervals)",
          "Yes, provably",
          "O(n log n)",
          "Dominated by the sort; the earliest-end-time choice is never worse than any alternative, which " +
            "can be proven by an exchange argument.",
        ],
        [
          "Coin change, canonical coin system (e.g. 1, 5, 10, 25)",
          "Yes, for this specific coin set",
          "O(amount / smallest coin)",
          "Each denomination is more than the sum of all smaller ones combined in a way that guarantees " +
            "greedy optimality — a property of these particular coin values, not coin change generally.",
        ],
        [
          "Coin change, arbitrary coin system (e.g. 1, 3, 4)",
          "No — can give a wrong, suboptimal answer",
          "N/A (wrong answer, any speed)",
          "A greedily-taken large coin can leave a remainder that needs more coins than a different, smaller " +
            "first choice would have — needs dynamic programming to solve correctly in general.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Applying greedy to a problem without first checking (or being able to argue) that local optimal " +
          "choices compose into a global optimum — greedy code often *runs* fine and produces *a* number, " +
          "giving false confidence that it's the right one.",
        "Assuming coin change is always greedy-safe because it worked for familiar currency denominations — " +
          "the correctness depends entirely on the specific coin values, not on the problem 'feeling' like " +
          "coin change.",
        "Sorting by the wrong key — activity selection's correctness specifically depends on sorting by *end* " +
          "time; sorting by start time or duration does not give the same guarantee and can produce a " +
          "suboptimal count.",
        "Confusing 'greedy produces a valid answer' with 'greedy produces the best answer' — an invalid input " +
          "or edge case can make a greedy algorithm still run to completion while quietly returning a " +
          "suboptimal result, which is much harder to notice than a crash.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Greedy commits to the locally best choice at each step and never reconsiders it.",
        "Greedy is only correct for problems where it can be shown that a locally best choice is never worse " +
          "than any alternative (an exchange argument) — that has to be proven, not assumed.",
        "Activity selection: sort by end time, take whatever doesn't overlap the last taken activity — " +
          "provably optimal.",
        "Coin change is only greedy-safe for specific ('canonical') coin systems; the general version needs " +
          "dynamic programming.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Interval-scheduling-flavoured problems ('maximum meetings in one room', 'non-overlapping intervals " +
          "to remove') are the most common greedy family — sorting by end time is the reusable trick behind " +
          "most of them.",
        "An interviewer who asks 'can you solve this greedily?' is often testing whether you'll *justify* the " +
          "greedy choice, not just produce code — being able to say why the earliest-ending choice can't " +
          "lose is the actual signal they're listening for.",
        "\"Why doesn't greedy work for coin change with denominations 1, 3, 4?\" is a common follow-up " +
          "specifically designed to check whether a candidate understands greedy's limits, not just its " +
          "mechanics.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is sorting by end time, not start time, the key to activity selection's greedy correctness?",
      options: [
        "It doesn't matter which one you sort by, because both orders give the same selected set of activities.",
        "The activity that ends earliest leaves the most room for later ones, so picking it is never worse.",
        "Sorting by start time is actually faster to compute, and it always selects the same number of activities.",
        "End-time sorting is required by Java's Comparator API, which refuses to compare activities by start time.",
      ],
      answer: 1,
      why:
        "An exchange argument shows that any optimal schedule can be modified to include the " +
        "earliest-ending compatible activity without reducing the total count — that's what makes the " +
        "greedy choice provably safe.",
    },
    {
      kind: "quiz",
      question: "Why does the greedy coin-change approach fail for the coin set {1, 3, 4} when making change for 6?",
      options: [
        "It doesn't fail: 3 coins is optimal here, because no two coins from the set add up to 6.",
        "Greedy takes the 4-coin first and then needs two 1-coins, 3 coins in all; two 3-coins need only 2.",
        "Greedy fails only because the coins array wasn't sorted; sorted from largest to smallest, it finds 2 coins.",
        "Amount 6 cannot be made from these coins at all, so greedy has no valid answer to find.",
      ],
      answer: 1,
      why:
        "Greedy's core weakness is exactly this: committing early to a locally attractive choice (the " +
        "largest coin) can block a better combination that a full search (dynamic programming) would find.",
    },
    {
      kind: "quiz",
      question: "What must be true for a greedy algorithm to be guaranteed correct on a given problem?",
      options: [
        "The algorithm must run in O(n log n) time or faster, since slower greedy methods can pick wrong choices.",
        "It must be provable (e.g. by an exchange argument) that the best local choice is never worse",
        "The input must already be sorted, because a greedy algorithm cannot choose well from unordered data.",
        "Nothing: greedy is always correct as long as the code compiles and runs without any errors.",
      ],
      answer: 1,
      why:
        "Greedy's correctness is a property of the problem's structure, not of the code — it requires an " +
        "argument (formal or informal) that no alternative first choice could ever lead to a better overall " +
        "outcome than the greedy one.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, why sorting activities by end time (rather than start time or " +
          "duration) is the specific choice that makes the greedy activity-selection algorithm correct.",
        "Given a list of meetings with start and end times, describe how you'd find the minimum number of " +
          "meeting rooms needed to hold all of them (a related but different greedy problem — think about " +
          "what to sort and track).",
        "Explain, in your own words, why the greedy coin-change approach fails for coins {1, 3, 4} and " +
          "amount 6, tracing through what greedy picks versus the true optimal answer.",
        "Describe a real scheduling or resource-allocation situation (outside interviews) where taking the " +
          "'best right now' option repeatedly could lead to a worse outcome than a more careful approach.",
      ],
    },
  ],
};
