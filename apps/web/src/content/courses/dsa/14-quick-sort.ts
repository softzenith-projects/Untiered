import type { Chapter } from "@/content/courses/types";

export const chapterQuickSort: Chapter = {
  slug: "quick-sort",
  title: "Quick Sort",
  summary:
    "Pick a pivot, partition everything smaller to its left and larger to its right, then recurse on each " +
    "side — sorts in place, O(n log n) on average, but with a worst case worth understanding, not just " +
    "memorising away.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Merge sort guarantees O(n log n) but pays for it in O(n) extra memory. **Quick sort** takes a " +
        "different route to the same O(n log n) average-case time, sorting *in place* — no second array — " +
        "by choosing a **pivot** element and partitioning the array around it, so everything smaller ends up " +
        "to its left and everything larger to its right, in one pass.",
    },
    { kind: "h", text: "The classroom-height-line analogy" },
    {
      kind: "analogy",
      title: "Lining students up by height, one reference student at a time",
      text:
        "Imagine lining up a class by height without any prior sorting. Pick one student — the pivot — and " +
        "walk down the rest of the line once, sending each student shorter than the pivot to a growing " +
        "group on the left and leaving the rest on the right. After this single walk, the pivot's *final* " +
        "position is already correct: everyone to their left really is shorter, everyone to their right " +
        "really is taller (or equal), even though neither side is internally sorted yet. Now repeat the " +
        "exact same process independently on the left group and the right group, each with its own new " +
        "pivot, until every group has shrunk to zero or one student. This is quick sort's **partition** " +
        "step, and it's the key difference from merge sort: merge sort does its real sorting work *after* " +
        "the recursive calls return (the merge step); quick sort does its real sorting work *before* " +
        "recursing (the partition step) — by the time it recurses, the pivot is already exactly where it " +
        "belongs. Where the analogy stops: a well-run classroom exercise would pick a pivot near the middle " +
        "height on purpose; the code below picks the *last* element every time, which works correctly but, " +
        "as the pitfalls below explain, isn't always a good height to pick.",
    },
    { kind: "h", text: "Partition, then recurse on each side" },
    {
      kind: "code",
      caption: "Quick sort using Lomuto partitioning: the last element as the pivot.",
      code:
        "import java.util.Arrays;\n" +
        "\n" +
        "public class QuickSort {\n" +
        "    static void quickSort(int[] arr, int low, int high) {\n" +
        "        if (low >= high) {\n" +
        "            return;\n" +
        "        }\n" +
        "        int pivotIndex = partition(arr, low, high);\n" +
        "        quickSort(arr, low, pivotIndex - 1);\n" +
        "        quickSort(arr, pivotIndex + 1, high);\n" +
        "    }\n" +
        "\n" +
        "    static int partition(int[] arr, int low, int high) {\n" +
        "        int pivot = arr[high];\n" +
        "        int boundary = low - 1;\n" +
        "        for (int i = low; i < high; i++) {\n" +
        "            if (arr[i] < pivot) {\n" +
        "                boundary++;\n" +
        "                swap(arr, boundary, i);\n" +
        "            }\n" +
        "        }\n" +
        "        swap(arr, boundary + 1, high);\n" +
        "        return boundary + 1;\n" +
        "    }\n" +
        "\n" +
        "    static void swap(int[] arr, int i, int j) {\n" +
        "        int temp = arr[i];\n" +
        "        arr[i] = arr[j];\n" +
        "        arr[j] = temp;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] arr = {8, 3, 7, 4, 2, 9, 1};\n" +
        "        quickSort(arr, 0, arr.length - 1);\n" +
        '        System.out.println("sorted: " + Arrays.toString(arr));\n' +
        "    }\n" +
        "}\n",
      output: "sorted: [1, 2, 3, 4, 7, 8, 9]",
      python:
        "def quick_sort(arr, low, high):\n" +
        "    if low >= high:\n" +
        "        return\n" +
        "    pivot_index = partition(arr, low, high)\n" +
        "    quick_sort(arr, low, pivot_index - 1)\n" +
        "    quick_sort(arr, pivot_index + 1, high)\n" +
        "\n" +
        "\n" +
        "def partition(arr, low, high):\n" +
        "    pivot = arr[high]\n" +
        "    boundary = low - 1\n" +
        "    for i in range(low, high):\n" +
        "        if arr[i] < pivot:\n" +
        "            boundary += 1\n" +
        "            arr[boundary], arr[i] = arr[i], arr[boundary]\n" +
        "    arr[boundary + 1], arr[high] = arr[high], arr[boundary + 1]\n" +
        "    return boundary + 1\n" +
        "\n" +
        "\n" +
        "arr = [8, 3, 7, 4, 2, 9, 1]\n" +
        "quick_sort(arr, 0, len(arr) - 1)\n" +
        'print("sorted:", arr)\n',
      pythonOutput: "sorted: [1, 2, 3, 4, 7, 8, 9]",
    },
    {
      kind: "viz",
      title: "partition({8, 3, 7, 4, 2, 9, 1}, low=0, high=6) — pivot is arr[6]=1",
      caption: "Nothing in this array is smaller than the pivot, so boundary never advances — the swap at the end still puts the pivot exactly where it belongs.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 8 }, { value: 3 }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9 }, { value: 1, pointers: ["pivot"] }],
            note: "pivot = 1 (arr[6]). boundary = -1 (nothing confirmed smaller than pivot yet).",
          },
          {
            cells: [{ value: 8, state: "active", pointers: ["i"] }, { value: 3 }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9 }, { value: 1, pointers: ["pivot"] }],
            note: "i=0, arr[0]=8. 8 < 1 is false. boundary stays -1.",
          },
          {
            cells: [{ value: 8 }, { value: 3, state: "active", pointers: ["i"] }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9 }, { value: 1, pointers: ["pivot"] }],
            note: "i=1, arr[1]=3. 3 < 1 is false. boundary stays -1.",
          },
          {
            cells: [{ value: 8 }, { value: 3 }, { value: 7, state: "active" }, { value: 4, state: "active" }, { value: 2, state: "active", pointers: ["i"] }, { value: 9 }, { value: 1, pointers: ["pivot"] }],
            note: "i=2..4 (7, 4, 2): all false against pivot 1. boundary stays -1.",
          },
          {
            cells: [{ value: 8 }, { value: 3 }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9, state: "active", pointers: ["i"] }, { value: 1, pointers: ["pivot"] }],
            note: "i=5, arr[5]=9. 9 < 1 is false. boundary stays -1.",
          },
          {
            cells: [{ value: 8, state: "swap" }, { value: 3 }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9 }, { value: 1, state: "swap" }],
            note: "Loop ends (i reached high). Swap arr[boundary+1]=arr[0] with arr[high]=arr[6]: swaps 8 and 1.",
          },
          {
            cells: [{ value: 1, state: "done" }, { value: 3 }, { value: 7 }, { value: 4 }, { value: 2 }, { value: 9 }, { value: 8 }],
            note:
              "Array is now {1, 3, 7, 4, 2, 9, 8}. Return boundary+1 = 0 — the pivot (1) is now at index 0, " +
              "its final sorted position, with an empty left side (nothing smaller) and everything else to " +
              "its right, unsorted but correctly on the right side of 1.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "This particular pivot (1, the smallest value) produced a lopsided partition — the whole rest of " +
        "the array on one side, nothing on the other — which is exactly the case explored in the " +
        "complexity discussion below. `quickSort` then recurses on `[low, pivotIndex-1]` (empty here) and " +
        "`[pivotIndex+1, high]` (everything else), continuing the same partition-then-recurse pattern until " +
        "each side shrinks to a single element or less.",
    },
    {
      kind: "table",
      head: ["Case", "Time", "Why"],
      rows: [
        [
          "Average case",
          "O(n log n)",
          "A 'typical' pivot splits the remaining elements into two roughly balanced halves, giving " +
            "O(log n) levels of recursion with O(n) partitioning work per level.",
        ],
        [
          "Worst case (e.g. already-sorted input with last-element pivot)",
          "O(n²)",
          "Choosing the smallest or largest remaining element as pivot every time (exactly what happened " +
            "in the trace above) puts everything on one side — n levels of recursion instead of log n, " +
            "each doing O(n) partitioning work.",
        ],
        [
          "Space",
          "O(log n) average, O(n) worst case",
          "In-place partitioning needs no extra array (unlike merge sort), but the recursive call stack " +
            "itself uses space proportional to the recursion depth.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Always picking the last (or first) element as pivot on data that might already be sorted or " +
          "reverse-sorted — this is precisely the input that triggers quick sort's O(n²) worst case, " +
          "as the trace above demonstrates directly.",
        "Assuming quick sort is 'always faster' than merge sort because of the in-place, no-extra-array " +
          "reputation — that's about average-case constant factors and memory, not worst-case time " +
          "guarantees, which merge sort still wins on.",
        "Forgetting quick sort, implemented this way, is not stable — the swapping in `partition` can " +
          "reorder equal elements relative to each other, unlike merge sort's careful `<=` comparison.",
        "Confusing 'the pivot ends in its final position after one partition call' with 'the whole array is " +
          "sorted after one partition call' — only the pivot's own position is finalised; both sides still " +
          "need their own recursive sort.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Quick sort partitions around a pivot (everything smaller to its left, larger to its right) *before* " +
          "recursing — the opposite order from merge sort's split-then-merge-after.",
        "After one partition call, the pivot sits in its final sorted position; each side still needs its " +
          "own recursive sort.",
        "Average case O(n log n), in-place (no extra array); worst case O(n²), triggered by " +
          "consistently unbalanced pivot choices on already-ordered data.",
        "A random or median-ish pivot choice (rather than always the last element) is the standard defence " +
          "against the worst case in practice.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Implement quick sort\" and \"implement merge sort\" are both extremely common, and interviewers " +
          "often follow up by asking you to compare them — have the space/stability/worst-case differences " +
          "ready, not just two working implementations.",
        "\"What input causes quick sort's worst case, and how would you avoid it?\" tests real understanding " +
          "beyond memorised code — naming already-sorted input with a fixed pivot choice, and naming random " +
          "pivot selection as the fix, is the expected depth.",
        "Quick sort's partition step, on its own, is also the core of a separate, frequently asked problem: " +
          "finding the kth smallest/largest element in an array in better than O(n log n) average time " +
          "(quickselect) — worth knowing the connection exists even without covering it in full here.",
      ],
    },
    {
      kind: "quiz",
      question: "What is guaranteed to be true about the pivot immediately after one call to partition()?",
      options: [
        "The entire array is now fully sorted, because the pivot has been placed in the right position",
        "The pivot is in its final sorted position: smaller values on its left, larger or equal on its right",
        "The pivot has been removed from the array, leaving the two smaller halves to be sorted next",
        "Both halves of the array are now individually sorted, so only joining them together remains",
      ],
      answer: 1,
      why:
        "partition() only guarantees the pivot's own final position and the smaller/larger split around " +
        "it — neither side is internally sorted yet; that's what the subsequent recursive calls handle.",
    },
    {
      kind: "quiz",
      question: "Why does an already-sorted array trigger quick sort's O(n²) worst case when the pivot is always the last element?",
      options: [
        "Because sorting an array that is already sorted is undefined behaviour, so the partition step can misbehave badly.",
        "The pivot is always the largest remaining value, so each partition puts everything on one side: n levels.",
        "Because Java's recursion depth limit is reached immediately, which forces the algorithm into a slower fallback.",
        "It doesn't trigger it: already-sorted input is quick sort's best case, since no swaps are needed at all.",
      ],
      answer: 1,
      why:
        "On an ascending sorted array, arr[high] is always the largest value in the current range, so " +
        "partition places everything else on the left and nothing on the right — the recursion depth " +
        "becomes n instead of log n, and each level still does O(n) partitioning work, giving O(n²).",
    },
    {
      kind: "quiz",
      question: "Which statement correctly compares quick sort and merge sort?",
      options: [
        "Merge sort is in-place and quick sort needs extra memory, so quick sort uses more space than merge sort.",
        "Quick sort guarantees O(n log n) in every case, while merge sort does not, because its merging step can degrade.",
        "Merge sort is stable with O(n log n) worst case; quick sort is in-place and often faster, but O(n²) worst case.",
        "The two algorithms have identical time and space characteristics, so choosing between them is purely a matter of style.",
      ],
      answer: 2,
      why:
        "Merge sort trades O(n) extra space for a guaranteed O(n log n) worst case and stability. Quick " +
        "sort trades away that worst-case guarantee (and, in this implementation, stability) for in-place " +
        "sorting and generally lower constant factors in the average case.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Trace partition() by hand on {5, 1, 4, 2, 8} with the last element (8) as pivot, writing out " +
          "boundary and the array's state after each comparison, the same way the trace above does.",
        "Explain, in your own words, why an already-sorted array combined with always choosing the last " +
          "element as pivot produces quick sort's worst case.",
        "Describe, in your own words, how choosing the pivot randomly (instead of always the last element) " +
          "helps avoid consistently unbalanced partitions on already-ordered input.",
        "Compare merge sort and quick sort on three dimensions — extra memory used, whether the algorithm " +
          "is stable, and worst-case time — in your own words, as if explaining the trade-off to a " +
          "teammate choosing between them.",
      ],
    },
  ],
};
