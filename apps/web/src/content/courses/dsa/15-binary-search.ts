import type { Chapter } from "@/content/courses/types";

export const chapterBinarySearch: Chapter = {
  slug: "binary-search",
  title: "Binary Search, and Binary Search on the Answer",
  summary:
    "Halving the search space on a sorted array is the textbook version — the deeper skill is recognising " +
    "the same halving idea when the 'array' is really a range of possible answers.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Binary search has already been the running example for O(log n) since the complexity chapter's " +
        "exam-hall analogy: jump to the middle, eliminate half. This chapter writes the actual code, then " +
        "extends the idea somewhere most beginners never get shown — **binary search on the answer**, where " +
        "there's no array at all, only a range of possible numeric answers to search through the same way.",
    },
    { kind: "h", text: "The dictionary-thumbing analogy, revisited precisely" },
    {
      kind: "analogy",
      title: "Flipping open a dictionary, not turning one page at a time",
      text:
        "Looking up a word in a printed dictionary, nobody starts at page 1 and turns forward one page at a " +
        "time — you flip open somewhere near the middle, check whether your word comes before or after that " +
        "page alphabetically, and flip to the middle of whichever half remains. Each flip discards half of " +
        "what's left, regardless of how thick the remaining stack is. This is binary search exactly: `low` " +
        "and `high` bound the current remaining range, `mid` is where you 'flip open' to, and every " +
        "comparison discards one whole half. Where the analogy stops: a dictionary is already alphabetised " +
        "for you; binary search on an array requires the array to be sorted *first*, and — as the second " +
        "half of this chapter shows — the 'dictionary' doesn't even need to be a real, physical sequence of " +
        "values at all, only something you can ask 'is the true answer before or after this candidate?'",
    },
    { kind: "h", text: "Binary search on a sorted array" },
    {
      kind: "code",
      caption:
        "Classic binary search on a sorted array, and binary search on the answer: finding the smallest " +
        "integer x such that x² ≥ n, without ever computing a real square root.",
      code:
        "public class BinarySearchDemo {\n" +
        "    static int binarySearch(int[] sorted, int target) {\n" +
        "        int low = 0;\n" +
        "        int high = sorted.length - 1;\n" +
        "        while (low <= high) {\n" +
        "            int mid = low + (high - low) / 2;\n" +
        "            if (sorted[mid] == target) {\n" +
        "                return mid;\n" +
        "            } else if (sorted[mid] < target) {\n" +
        "                low = mid + 1;\n" +
        "            } else {\n" +
        "                high = mid - 1;\n" +
        "            }\n" +
        "        }\n" +
        "        return -1;\n" +
        "    }\n" +
        "\n" +
        "    static int smallestSquareRootAtLeast(int n) {\n" +
        "        int low = 0;\n" +
        "        int high = n;\n" +
        "        while (low < high) {\n" +
        "            int mid = low + (high - low) / 2;\n" +
        "            if ((long) mid * mid >= n) {\n" +
        "                high = mid;\n" +
        "            } else {\n" +
        "                low = mid + 1;\n" +
        "            }\n" +
        "        }\n" +
        "        return low;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] sorted = {2, 5, 8, 12, 16, 23, 38, 45, 56, 72};\n" +
        '        System.out.println("binarySearch(23): " + binarySearch(sorted, 23));\n' +
        '        System.out.println("binarySearch(24): " + binarySearch(sorted, 24));\n' +
        "\n" +
        '        System.out.println("smallestSquareRootAtLeast(30): " + smallestSquareRootAtLeast(30));\n' +
        '        System.out.println("smallestSquareRootAtLeast(36): " + smallestSquareRootAtLeast(36));\n' +
        "    }\n" +
        "}\n",
      output:
        "binarySearch(23): 5\n" +
        "binarySearch(24): -1\n" +
        "smallestSquareRootAtLeast(30): 6\n" +
        "smallestSquareRootAtLeast(36): 6",
      python:
        "def binary_search(sorted_nums, target):\n" +
        "    low, high = 0, len(sorted_nums) - 1\n" +
        "    while low <= high:\n" +
        "        mid = low + (high - low) // 2\n" +
        "        if sorted_nums[mid] == target:\n" +
        "            return mid\n" +
        "        elif sorted_nums[mid] < target:\n" +
        "            low = mid + 1\n" +
        "        else:\n" +
        "            high = mid - 1\n" +
        "    return -1\n" +
        "\n" +
        "\n" +
        "def smallest_square_root_at_least(n):\n" +
        "    low, high = 0, n\n" +
        "    while low < high:\n" +
        "        mid = low + (high - low) // 2\n" +
        "        if mid * mid >= n:\n" +
        "            high = mid\n" +
        "        else:\n" +
        "            low = mid + 1\n" +
        "    return low\n" +
        "\n" +
        "\n" +
        "sorted_nums = [2, 5, 8, 12, 16, 23, 38, 45, 56, 72]\n" +
        'print("binarySearch(23):", binary_search(sorted_nums, 23))\n' +
        'print("binarySearch(24):", binary_search(sorted_nums, 24))\n' +
        "\n" +
        'print("smallestSquareRootAtLeast(30):", smallest_square_root_at_least(30))\n' +
        'print("smallestSquareRootAtLeast(36):", smallest_square_root_at_least(36))\n',
      pythonOutput:
        "binarySearch(23): 5\n" +
        "binarySearch(24): -1\n" +
        "smallestSquareRootAtLeast(30): 6\n" +
        "smallestSquareRootAtLeast(36): 6",
    },
    {
      kind: "viz",
      title: "binarySearch({2,5,8,12,16,23,38,45,56,72}, target=23)",
      caption: "Each comparison discards one whole half of the remaining range.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: 2, pointers: ["low"] }, { value: 5 }, { value: 8 }, { value: 12 },
              { value: 16, pointers: ["mid"] }, { value: 23 }, { value: 38 }, { value: 45 }, { value: 56 },
              { value: 72, pointers: ["high"] },
            ],
            note: "low=0, high=9. mid=4, sorted[4]=16. 16 < 23, so low = mid+1 = 5.",
          },
          {
            cells: [
              { value: 2 }, { value: 5 }, { value: 8 }, { value: 12 }, { value: 16 },
              { value: 23, pointers: ["low"] }, { value: 38 }, { value: 45, pointers: ["mid"] }, { value: 56 },
              { value: 72, pointers: ["high"] },
            ],
            range: [5, 9],
            note: "low=5, high=9. mid=7, sorted[7]=45. 45 > 23, so high = mid-1 = 6.",
          },
          {
            cells: [
              { value: 2 }, { value: 5 }, { value: 8 }, { value: 12 }, { value: 16 },
              { value: 23, state: "done", pointers: ["low", "mid", "high"] }, { value: 38 }, { value: 45 }, { value: 56 },
              { value: 72 },
            ],
            range: [5, 6],
            note: "low=5, high=6. mid=5, sorted[5]=23. Match! Return 5 — only 3 comparisons for 10 elements.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "`binarySearch(24)` returns -1 because 24 isn't present — worth tracing mentally: `low` and `high` " +
        "eventually cross (`low > high`), and the loop exits without ever finding a match, which is exactly " +
        "the termination condition that guarantees the search doesn't run forever.",
    },
    { kind: "h", text: "Binary search on the answer: no array required" },
    {
      kind: "p",
      text:
        "`smallestSquareRootAtLeast` never touches an array. Instead, `low` and `high` bound a *range of " +
        "candidate answers* (0 to n), and each `mid` is tested against a yes/no question — \"is mid² " +
        "≥ n?\" — that behaves exactly like a sorted array's comparison: as `mid` increases, the answer " +
        "to that question flips from \"no\" to \"yes\" exactly once and never flips back (this property is " +
        "sometimes called **monotonicity**, and it's the one thing that must be checked before applying this " +
        "technique at all). That single flip point is precisely what binary search locates — `high = mid` " +
        "narrows toward the flip from above, `low = mid + 1` narrows from below, converging on the smallest " +
        "`x` where the answer is \"yes\".",
    },
    {
      kind: "trace",
      title: "smallestSquareRootAtLeast(30) — searching a range of answers, not an array",
      steps: [
        "low=0, high=30. mid=15. 15²=225 ≥ 30? Yes. Narrow from above: high=15.",
        "low=0, high=15. mid=7. 7²=49 ≥ 30? Yes. high=7.",
        "low=0, high=7. mid=3. 3²=9 ≥ 30? No. Narrow from below: low=4.",
        "low=4, high=7. mid=5. 5²=25 ≥ 30? No. low=6.",
        "low=6, high=7. mid=6. 6²=36 ≥ 30? Yes. high=6.",
        "low=6, high=6. Loop condition low < high is false — stop. Return 6.",
        "Check: 5²=25 is below 30 (fails), 6²=36 is at least 30 (passes) — 6 genuinely is the " +
          "smallest qualifying integer, found in 5 comparisons rather than testing 0,1,2,3,4,5,6 one by one.",
      ],
    },
    {
      kind: "table",
      head: ["Approach", "Time", "Why"],
      rows: [
        [
          "Linear search / try every candidate from 0 upward",
          "O(n)",
          "Tests each candidate one at a time until the condition first becomes true.",
        ],
        [
          "Binary search (on an array, or on a range of answers)",
          "O(log n)",
          "Each comparison halves the remaining range — the same shrink-by-a-fraction pattern from the " +
            "recursion chapter, applied here iteratively instead of recursively.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Applying binary search to unsorted data, or to a condition that isn't monotonic (doesn't flip " +
          "exactly once as the candidate increases) — without that guarantee, discarding half the range can " +
          "discard the actual answer.",
        "Mixing up `high = mid` and `high = mid - 1` (or `low = mid + 1` vs `low = mid`) — the choice must " +
          "match whether `mid` itself might still be the answer; using the wrong one causes an infinite " +
          "loop or skips the correct value entirely.",
        "Writing `mid = (low + high) / 2` instead of `mid = low + (high - low) / 2` — the first can " +
          "overflow `int` on very large indices before the division happens; the second cannot.",
        "Missing that a problem is 'binary search on the answer' because it doesn't look like a search at " +
          "all — the signal is a yes/no question about a candidate number that flips exactly once as the " +
          "candidate grows, not the presence of a sorted array.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Binary search halves the remaining range every comparison — O(log n), and it requires sorted (or " +
          "otherwise monotonic) structure to be correct.",
        "mid = low + (high - low) / 2 avoids overflow that (low + high) / 2 risks.",
        "Binary search on the answer: search a range of possible numeric answers, not an array, using a " +
          "yes/no test that flips exactly once (monotonicity) as the candidate increases.",
        "Recognise the pattern by the question's shape: 'find the smallest/largest value such that ' " +
          "condition ' holds' is close to a direct signal for binary search on the answer.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Plain binary search on a sorted array is a near-universal warm-up — get the loop condition and " +
          "mid-update logic automatic, since small mistakes there (off-by-one, wrong branch) are easy to " +
          "make under pressure.",
        "\"Can this be done faster than checking every value one by one?\" on a problem that secretly has a " +
          "monotonic yes/no structure is exactly the cue for binary search on the answer — recognising it " +
          "is the whole skill, since the code itself barely changes from plain binary search.",
        "Being asked to find the minimum capacity, minimum time, or maximum count satisfying some " +
          "constraint is a common way binary search on the answer is tested, even though the problem never " +
          "mentions 'binary search' by name.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is mid = low + (high - low) / 2 preferred over mid = (low + high) / 2?",
      options: [
        "They behave differently for sorted arrays only, and give identical midpoints for arrays that are not sorted.",
        "The first form avoids a possible integer overflow when low and high are both very large.",
        "The second form is slower to compute, because adding low and high takes more steps than subtracting them.",
        "There is no real difference; it's purely a style preference, and both forms give the same result for every int.",
      ],
      answer: 1,
      why:
        "low + high can exceed int's maximum value before the division reduces it, wrapping around to a " +
        "negative number and corrupting mid. low + (high - low) / 2 reaches the same mathematical result " +
        "without that intermediate overflow risk.",
    },
    {
      kind: "quiz",
      question: "What property must a condition have for 'binary search on the answer' to correctly apply?",
      options: [
        "The array involved must contain only positive numbers",
        "The condition must be monotonic: as the candidate value increases, the yes/no answer flips at " +
          "most once and never flips back",
        "The condition must always return true for the smallest candidate",
        "There is no special requirement — it works for any condition",
      ],
      answer: 1,
      why:
        "Binary search relies on being able to safely discard half the remaining range based on one " +
        "comparison. That's only safe if the answer flips exactly once as the candidate increases — " +
        "otherwise, discarding a half could discard the actual answer.",
    },
    {
      kind: "quiz",
      question: "In smallestSquareRootAtLeast, what does the branch `high = mid;` (rather than `high = mid - 1;`) signal about how mid is being treated?",
      options: [
        "It's a bug — it should always be mid - 1, matching the plain binarySearch example",
        "mid passed the condition (mid² ≥ n), so it might still BE the answer, and must stay " +
          "included in the remaining search range rather than being excluded",
        "It means the search has already finished",
        "It only affects performance, not correctness",
      ],
      answer: 1,
      why:
        "Because the goal is the smallest qualifying value, a mid that already satisfies the condition is " +
        "a candidate answer itself and must remain in play — excluding it with mid - 1 could skip past the " +
        "true answer, unlike plain binarySearch where an exact non-match is safely excludable.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Trace binarySearch by hand on {1,3,5,7,9,11,13} for target=7, writing out low, high, and mid at " +
          "each step, the same way the trace above does.",
        "Describe, in your own words, why searching for the first position where a sorted array of 0s " +
          "followed by 1s switches from 0 to 1 is really the same problem as smallestSquareRootAtLeast, " +
          "just phrased differently.",
        "Given a function that tells you whether a given speed is 'fast enough' to finish a task within a " +
          "deadline (true for speeds at or above some threshold, false below it), describe how you'd binary " +
          "search on the answer to find the minimum sufficient speed.",
        "Explain, in your own words, what could go wrong if the yes/no condition used in binary search on " +
          "the answer weren't monotonic (for example, if it were true, false, true, false as the candidate " +
          "increased) — would the algorithm still give a reliably correct answer?",
      ],
    },
  ],
};
