import type { Chapter } from "@/content/courses/types";

export const chapterMergeSort: Chapter = {
  slug: "merge-sort",
  title: "Merge Sort",
  summary:
    "Split the array in half, recursively sort each half, then merge two sorted halves in one pass — " +
    "O(n log n), guaranteed, because splitting is the O(log n) shrink-by-a-fraction pattern from the " +
    "recursion chapter.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "The simple sorts from the last chapter share a ceiling: O(n²) in the worst case, because each " +
        "of them, in different ways, compares roughly every element to roughly every other element. **Merge " +
        "sort** breaks that ceiling with an idea straight out of the recursion chapter: shrink the problem " +
        "by a *fraction* — half — rather than by a fixed amount, and the O(log n) levels that produces turn " +
        "into an O(n log n) sort overall.",
    },
    { kind: "h", text: "The two-stacks-of-sorted-exam-papers analogy" },
    {
      kind: "analogy",
      title: "Merging two already-sorted stacks of graded exam papers",
      text:
        "Suppose two teaching assistants have each separately sorted their own stack of exam papers by roll " +
        "number. Combining the two stacks into one sorted stack doesn't require re-sorting everything — you " +
        "just compare the top paper of each stack, take whichever has the lower roll number, and repeat; " +
        "once one stack runs out, the rest of the other stack is already in order and gets appended " +
        "directly. This **merge** step is a single pass, comparing at most once per paper across both " +
        "stacks. Merge sort's insight is to get *to* two sorted stacks by splitting one big unsorted stack " +
        "in half, recursively sorting each half the exact same way, down to stacks of one paper (already " +
        "sorted, trivially), then merging pairs of sorted stacks back together, over and over, until one " +
        "fully sorted stack remains. Where the analogy stops: merging two real paper stacks needs a second, " +
        "empty table to lay the merged stack on — merge sort has exactly this same requirement in code, " +
        "which is where its O(n) extra memory comes from.",
    },
    { kind: "h", text: "Split, recurse, merge" },
    {
      kind: "code",
      caption: "Merge sort: split at the midpoint, recursively sort each half, then merge the two sorted halves.",
      code:
        "import java.util.Arrays;\n" +
        "\n" +
        "public class MergeSort {\n" +
        "    static void mergeSort(int[] arr, int left, int right) {\n" +
        "        if (left >= right) {\n" +
        "            return;\n" +
        "        }\n" +
        "        int mid = left + (right - left) / 2;\n" +
        "        mergeSort(arr, left, mid);\n" +
        "        mergeSort(arr, mid + 1, right);\n" +
        "        merge(arr, left, mid, right);\n" +
        "    }\n" +
        "\n" +
        "    static void merge(int[] arr, int left, int mid, int right) {\n" +
        "        int[] leftPart = Arrays.copyOfRange(arr, left, mid + 1);\n" +
        "        int[] rightPart = Arrays.copyOfRange(arr, mid + 1, right + 1);\n" +
        "\n" +
        "        int i = 0;\n" +
        "        int j = 0;\n" +
        "        int k = left;\n" +
        "        while (i < leftPart.length && j < rightPart.length) {\n" +
        "            if (leftPart[i] <= rightPart[j]) {\n" +
        "                arr[k++] = leftPart[i++];\n" +
        "            } else {\n" +
        "                arr[k++] = rightPart[j++];\n" +
        "            }\n" +
        "        }\n" +
        "        while (i < leftPart.length) {\n" +
        "            arr[k++] = leftPart[i++];\n" +
        "        }\n" +
        "        while (j < rightPart.length) {\n" +
        "            arr[k++] = rightPart[j++];\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] arr = {8, 3, 7, 4, 2, 9, 1};\n" +
        "        mergeSort(arr, 0, arr.length - 1);\n" +
        '        System.out.println("sorted: " + Arrays.toString(arr));\n' +
        "    }\n" +
        "}\n",
      output: "sorted: [1, 2, 3, 4, 7, 8, 9]",
      python:
        "def merge_sort(arr, left, right):\n" +
        "    if left >= right:\n" +
        "        return\n" +
        "    mid = left + (right - left) // 2\n" +
        "    merge_sort(arr, left, mid)\n" +
        "    merge_sort(arr, mid + 1, right)\n" +
        "    merge(arr, left, mid, right)\n" +
        "\n" +
        "\n" +
        "def merge(arr, left, mid, right):\n" +
        "    left_part = arr[left:mid + 1]\n" +
        "    right_part = arr[mid + 1:right + 1]\n" +
        "\n" +
        "    i = j = 0\n" +
        "    k = left\n" +
        "    while i < len(left_part) and j < len(right_part):\n" +
        "        if left_part[i] <= right_part[j]:\n" +
        "            arr[k] = left_part[i]\n" +
        "            i += 1\n" +
        "        else:\n" +
        "            arr[k] = right_part[j]\n" +
        "            j += 1\n" +
        "        k += 1\n" +
        "    while i < len(left_part):\n" +
        "        arr[k] = left_part[i]\n" +
        "        i += 1\n" +
        "        k += 1\n" +
        "    while j < len(right_part):\n" +
        "        arr[k] = right_part[j]\n" +
        "        j += 1\n" +
        "        k += 1\n" +
        "\n" +
        "\n" +
        "arr = [8, 3, 7, 4, 2, 9, 1]\n" +
        "merge_sort(arr, 0, len(arr) - 1)\n" +
        'print("sorted:", arr)\n',
      pythonOutput: "sorted: [1, 2, 3, 4, 7, 8, 9]",
    },
    {
      kind: "viz",
      title: "mergeSort({8, 3, 7, 4, 2, 9, 1}) — splitting down, then merging back up",
      caption: "The highlighted window is the range just merged; values inside it are already sorted relative to each other before the next merge combines two such windows.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 8 }, { value: 3 }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9 }, { value: 1 }],
            range: [0, 3],
            note: "Split {8,3,7,4,2,9,1} at mid into left {8,3,7,4} (indices 0-3) and right {2,9,1} (indices 4-6).",
          },
          {
            cells: [{ value: 8 }, { value: 3 }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9 }, { value: 1 }],
            range: [0, 1],
            note: "{8,3,7,4} splits into {8,3} and {7,4}; {8,3} splits into {8} and {3} (both base cases, size 1).",
          },
          {
            cells: [{ value: 3, state: "done" }, { value: 8, state: "done" }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9 }, { value: 1 }],
            range: [0, 1],
            note: "Merge {8} and {3}: compare 8 vs 3, take 3, then take 8 (one ran out). Result {3,8}.",
          },
          {
            cells: [{ value: 3, state: "done" }, { value: 8, state: "done" }, { value: 4, state: "done" }, { value: 7, state: "done" }, { value: 2 }, { value: 9 }, { value: 1 }],
            range: [2, 3],
            note: "{7,4} similarly merges to {4,7}.",
          },
          {
            cells: [{ value: 3, state: "done" }, { value: 4, state: "done" }, { value: 7, state: "done" }, { value: 8, state: "done" }, { value: 2 }, { value: 9 }, { value: 1 }],
            range: [0, 3],
            note:
              "Merge {3,8} and {4,7}: 3<4 take 3; 8 vs 4 take 4; 8 vs 7 take 7; only 8 left, append it. " +
              "Result {3,4,7,8}.",
          },
          {
            cells: [{ value: 3, state: "done" }, { value: 4, state: "done" }, { value: 7, state: "done" }, { value: 8, state: "done" }, { value: 2 }, { value: 1, state: "done" }, { value: 9, state: "done" }],
            range: [5, 6],
            note: "{2,9,1} splits into {2} and {9,1}; {9,1} merges to {1,9} (9 vs 1, take 1, then 9).",
          },
          {
            cells: [{ value: 3, state: "done" }, { value: 4, state: "done" }, { value: 7, state: "done" }, { value: 8, state: "done" }, { value: 1, state: "done" }, { value: 2, state: "done" }, { value: 9, state: "done" }],
            range: [4, 6],
            note: "Merge {2} and {1,9}: 2 vs 1, take 1; 2 vs 9, take 2; only 9 left, append. Result {1,2,9}.",
          },
          {
            cells: [{ value: 1, state: "done" }, { value: 2, state: "done" }, { value: 3, state: "done" }, { value: 4, state: "done" }, { value: 7, state: "done" }, { value: 8, state: "done" }, { value: 9, state: "done" }],
            range: [0, 6],
            note:
              "Final merge: {3,4,7,8} and {1,2,9}. 3 vs 1 take 1; 3 vs 2 take 2; 3 vs 9 take 3; 4 vs 9 " +
              "take 4; 7 vs 9 take 7; 8 vs 9 take 8; only 9 left, append. Result {1,2,3,4,7,8,9} — fully " +
              "sorted.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The `merge` step never needs to look backward or re-compare something it already placed — because " +
        "both `leftPart` and `rightPart` arrive *already sorted*, whichever of their two front elements is " +
        "smaller is guaranteed to be the smallest remaining element overall. That guarantee is exactly why " +
        "one pass through both parts (a total of `right - left + 1` comparisons and placements) is enough " +
        "to merge them.",
    },
    {
      kind: "table",
      head: ["Aspect", "Value", "Why"],
      rows: [
        [
          "Time",
          "O(n log n), always",
          "Splitting in half is the O(log n) shrink-by-a-fraction pattern from the recursion chapter, " +
            "giving log n levels; merging all pieces at any one level costs O(n) total, so O(n) work " +
            "× O(log n) levels = O(n log n).",
        ],
        [
          "Space",
          "O(n)",
          "The merge step allocates new arrays (leftPart, rightPart) to hold a copy of each half being " +
            "merged — unlike the in-place simple sorts, merge sort needs this extra 'second table'.",
        ],
        [
          "Stability",
          "Stable",
          "leftPart[i] <= rightPart[j] (using <=, not <) means an equal element from the left half is " +
            "always placed first, preserving original relative order for equal elements.",
        ],
      ],
    },
    {
      kind: "p",
      text:
        "The \"always\" in the time row is the headline feature over the simple sorts: merge sort has no " +
        "input-dependent worst case — a reverse-sorted array and an already-sorted array cost the same, " +
        "O(n log n), because the split-and-merge structure doesn't depend on the data's existing order at " +
        "all. That guarantee is exactly what makes it the right default when worst-case performance " +
        "actually matters, and it's what Java's `Arrays.sort()` for object arrays is built on (a tuned " +
        "variant, Timsort).",
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting the O(n) extra space — merge sort is not in-place, unlike the simple sorts; this " +
          "matters when memory is constrained, which is exactly the case quick sort (next chapter) is often " +
          "chosen to address instead.",
        "Getting `mid` wrong in a way that causes infinite recursion — `left + (right - left) / 2` avoids " +
          "integer overflow that a naive `(left + right) / 2` can hit on very large indices, and the base " +
          "case `left >= right` (not `left == right`) is what actually stops the recursion correctly for " +
          "single-element and empty ranges.",
        "Using `<` instead of `<=` when comparing during merge, which silently breaks stability — a subtle " +
          "bug that produces a correctly *sorted* array but with equal elements reordered relative to each " +
          "other.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Merge sort: split in half recursively down to single elements, then merge sorted halves back " +
          "together in one pass each.",
        "O(n log n) time, always — no worst-case input degrades it, unlike the O(n²) simple sorts.",
        "O(n) extra space — the merge step needs a second array to hold each half being combined.",
        "Merge sort is stable, provided the merge step uses <= (not <) when the two front elements are " +
          "equal.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Implement merge sort\" is a genuinely common ask — practise the split/recurse/merge shape until " +
          "the merge step's two-pointer-style walk is automatic.",
        "\"Why is merge sort O(n log n) and not O(n²)?\" tests the same call-counting reasoning from " +
          "the recursion chapter — be ready to name the log n levels and the O(n) work per level " +
          "separately.",
        "\"When would you prefer merge sort over quick sort?\" (next chapter) is a very common follow-up — " +
          "guaranteed worst-case time and stability are merge sort's answer; quick sort's answer is usually " +
          "in-place, lower memory use.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is merge sort's time complexity O(n log n) rather than O(n²)?",
      options: [
        "Because it never compares every pair of elements, simply by luck, whatever order the input values happen to arrive in.",
        "Halving gives log n levels, and merging all pieces at one level costs O(n) in total, so n times log n.",
        "Because Java automatically runs the recursive calls in parallel, which divides the quadratic cost across processors.",
        "It is actually O(n²); the O(n log n) figure is a common misconception based on small inputs.",
      ],
      answer: 1,
      why:
        "The recursion halves the array each call (log n levels of splitting), and the merge step at each " +
        "level processes every element exactly once across all the merges at that level (O(n) per level) " +
        "— multiplying gives O(n log n).",
    },
    {
      kind: "quiz",
      question: "Why does merge sort need O(n) extra space, unlike bubble, selection, or insertion sort?",
      options: [
        "It doesn't need any: merge sort is also in-place, just like bubble, selection and insertion",
        "The merge step copies the two halves into temporary arrays before writing the merged result back",
        "Java requires every recursive sort to allocate extra memory, however it is implemented",
        "It's a bug in the specific implementation shown, not a property of merge sort in general",
      ],
      answer: 1,
      why:
        "merge() creates leftPart and rightPart as copies of the two halves before merging them back into " +
        "the original array — this temporary storage, needed at every merge step, is what gives merge " +
        "sort its O(n) space cost.",
    },
    {
      kind: "quiz",
      question: "What guarantees that merge sort's worst-case time complexity is the same as its average case?",
      options: [
        "The algorithm randomly shuffles the input first, so no particular order can ever be the worst case",
        "The split-and-merge structure depends only on the array's length, not on the order of its elements",
        "It doesn't guarantee that: merge sort has a much worse worst case than its average case",
        "Java's JIT compiler optimises merge sort specifically, removing the extra work on unlucky inputs",
      ],
      answer: 1,
      why:
        "Unlike the simple sorts, where an already-sorted or reverse-sorted input changes how much work is " +
        "done, merge sort always splits at the midpoint and always does a full merge pass — neither step's " +
        "cost depends on how the input happens to be arranged.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Trace mergeSort by hand on {6, 3, 8, 1}, writing out every split and every merge step, the same " +
          "way the trace above does.",
        "Describe, in your own words, why merge sort's time complexity doesn't change between a best-case " +
          "(already sorted) input and a worst-case (reverse sorted) input, unlike the simple sorts.",
        "Given two already-sorted arrays of different lengths (not halves of the same array), describe how " +
          "you'd merge them into one sorted array, reusing the merge step's logic directly.",
        "Explain, in your own words, why merge sort is a reasonable choice when sorting a linked list " +
          "(where random access is expensive) even though it needs 'extra space' for arrays.",
      ],
    },
  ],
};
