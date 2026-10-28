import type { Chapter } from "@/content/courses/types";

export const chapterSimpleSorts: Chapter = {
  slug: "simple-sorts",
  title: "Simple Sorts: Bubble, Selection, Insertion",
  summary:
    "Three O(n²) sorting algorithms, each with a distinct idea worth knowing even though faster " +
    "sorts exist — bubbling the largest to the end, selecting the minimum, and inserting into a growing " +
    "sorted prefix.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "This module opened by choosing organisation over brute force. Sorting is where that choice gets " +
        "literal: a sorted array unlocked binary search, and the converging two-pointer technique needed " +
        "sorted input to be correct. Before reaching for the faster sorts (merge sort, quick sort, next in " +
        "this module), it's worth understanding three simpler ones properly — not because they're the " +
        "right choice for large inputs, but because each teaches a distinct idea about *how* sorting can " +
        "work, and interviews do still ask for them by name.",
    },
    { kind: "h", text: "The card-sorting-by-hand analogy" },
    {
      kind: "analogy",
      title: "Three different ways to sort a hand of playing cards",
      text:
        "Picture sorting a hand of playing cards three different ways. **Bubble sort**: repeatedly scan the " +
        "hand left to right, swapping any two adjacent cards that are out of order — after one full scan, " +
        "the largest card has 'bubbled' all the way to the end, so each pass needs to check one card fewer. " +
        "**Selection sort**: for the current leftmost unsorted position, scan the *entire* remaining hand to " +
        "find the smallest card, and swap it into place — one decisive placement per pass, rather than many " +
        "small swaps. **Insertion sort**: pick up cards one at a time from the unsorted pile and slide each " +
        "one into its correct position among the cards already sorted in your hand — the way most people " +
        "actually sort a hand of cards dealt to them. All three reach the same sorted hand; they scan and " +
        "move cards in genuinely different patterns to get there. Where the analogy stops: a person sorting " +
        "real cards can glance at the whole hand at once; each of these algorithms is restricted to " +
        "comparing only two elements at a time, one comparison at a time.",
    },
    {
      kind: "code",
      caption: "Bubble, selection, and insertion sort, each sorting a clone of the same starting array.",
      code:
        "import java.util.Arrays;\n" +
        "\n" +
        "public class SimpleSorts {\n" +
        "    static void bubbleSort(int[] arr) {\n" +
        "        int n = arr.length;\n" +
        "        for (int pass = 0; pass < n - 1; pass++) {\n" +
        "            boolean swapped = false;\n" +
        "            for (int i = 0; i < n - 1 - pass; i++) {\n" +
        "                if (arr[i] > arr[i + 1]) {\n" +
        "                    int temp = arr[i];\n" +
        "                    arr[i] = arr[i + 1];\n" +
        "                    arr[i + 1] = temp;\n" +
        "                    swapped = true;\n" +
        "                }\n" +
        "            }\n" +
        "            if (!swapped) {\n" +
        "                break;\n" +
        "            }\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    static void selectionSort(int[] arr) {\n" +
        "        int n = arr.length;\n" +
        "        for (int i = 0; i < n - 1; i++) {\n" +
        "            int minIndex = i;\n" +
        "            for (int j = i + 1; j < n; j++) {\n" +
        "                if (arr[j] < arr[minIndex]) {\n" +
        "                    minIndex = j;\n" +
        "                }\n" +
        "            }\n" +
        "            int temp = arr[i];\n" +
        "            arr[i] = arr[minIndex];\n" +
        "            arr[minIndex] = temp;\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    static void insertionSort(int[] arr) {\n" +
        "        for (int i = 1; i < arr.length; i++) {\n" +
        "            int key = arr[i];\n" +
        "            int j = i - 1;\n" +
        "            while (j >= 0 && arr[j] > key) {\n" +
        "                arr[j + 1] = arr[j];\n" +
        "                j--;\n" +
        "            }\n" +
        "            arr[j + 1] = key;\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] a = {5, 2, 9, 1, 5, 6};\n" +
        "        int[] b = a.clone();\n" +
        "        int[] c = a.clone();\n" +
        "\n" +
        "        bubbleSort(a);\n" +
        "        selectionSort(b);\n" +
        "        insertionSort(c);\n" +
        "\n" +
        '        System.out.println("bubbleSort:    " + Arrays.toString(a));\n' +
        '        System.out.println("selectionSort: " + Arrays.toString(b));\n' +
        '        System.out.println("insertionSort: " + Arrays.toString(c));\n' +
        "    }\n" +
        "}\n",
      output:
        "bubbleSort:    [1, 2, 5, 5, 6, 9]\n" +
        "selectionSort: [1, 2, 5, 5, 6, 9]\n" +
        "insertionSort: [1, 2, 5, 5, 6, 9]",
      python:
        "def bubble_sort(arr):\n" +
        "    n = len(arr)\n" +
        "    for pass_num in range(n - 1):\n" +
        "        swapped = False\n" +
        "        for i in range(n - 1 - pass_num):\n" +
        "            if arr[i] > arr[i + 1]:\n" +
        "                arr[i], arr[i + 1] = arr[i + 1], arr[i]\n" +
        "                swapped = True\n" +
        "        if not swapped:\n" +
        "            break\n" +
        "\n" +
        "\n" +
        "def selection_sort(arr):\n" +
        "    n = len(arr)\n" +
        "    for i in range(n - 1):\n" +
        "        min_index = i\n" +
        "        for j in range(i + 1, n):\n" +
        "            if arr[j] < arr[min_index]:\n" +
        "                min_index = j\n" +
        "        arr[i], arr[min_index] = arr[min_index], arr[i]\n" +
        "\n" +
        "\n" +
        "def insertion_sort(arr):\n" +
        "    for i in range(1, len(arr)):\n" +
        "        key = arr[i]\n" +
        "        j = i - 1\n" +
        "        while j >= 0 and arr[j] > key:\n" +
        "            arr[j + 1] = arr[j]\n" +
        "            j -= 1\n" +
        "        arr[j + 1] = key\n" +
        "\n" +
        "\n" +
        "a = [5, 2, 9, 1, 5, 6]\n" +
        "b = list(a)\n" +
        "c = list(a)\n" +
        "\n" +
        "bubble_sort(a)\n" +
        "selection_sort(b)\n" +
        "insertion_sort(c)\n" +
        "\n" +
        'print("bubbleSort:   ", a)\n' +
        'print("selectionSort:", b)\n' +
        'print("insertionSort:", c)\n',
      pythonOutput:
        "bubbleSort:    [1, 2, 5, 5, 6, 9]\n" +
        "selectionSort: [1, 2, 5, 5, 6, 9]\n" +
        "insertionSort: [1, 2, 5, 5, 6, 9]",
    },
    {
      kind: "viz",
      title: "insertionSort({5, 2, 9, 1, 5, 6}) — sliding each card into the sorted prefix",
      caption: "The highlighted range is the sorted prefix built so far; the marked cell is where key just landed.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 5 }, { value: 2 }, { value: 9 }, { value: 1 }, { value: 5 }, { value: 6 }],
            note: "i=1, key=2. Sorted prefix so far: [5]. 5 > 2, so shift 5 right, then place key.",
          },
          {
            cells: [
              { value: 2, state: "done" }, { value: 5, state: "done" },
              { value: 9 }, { value: 1 }, { value: 5 }, { value: 6 },
            ],
            range: [0, 1],
            note: "Placed: [2,5,9,1,5,6]. Sorted prefix is now [2,5].",
          },
          {
            cells: [
              { value: 2, state: "done" }, { value: 5, state: "done" }, { value: 9, state: "compare" },
              { value: 1 }, { value: 5 }, { value: 6 },
            ],
            range: [0, 2],
            note: "i=2, key=9. Sorted prefix: [2,5]. 5 is not > 9, no shift needed — 9 stays right where it was.",
          },
          {
            cells: [
              { value: 1, state: "done" }, { value: 2, state: "done" }, { value: 5, state: "done" }, { value: 9, state: "done" },
              { value: 5 }, { value: 6 },
            ],
            range: [0, 3],
            note: "i=3, key=1. 9>1, 5>1, 2>1 all shift — 1 moves all the way to the front: [1,2,5,9,5,6].",
          },
          {
            cells: [
              { value: 1, state: "done" }, { value: 2, state: "done" }, { value: 5, state: "done" }, { value: 5, state: "done" },
              { value: 9 }, { value: 6 },
            ],
            range: [0, 4],
            note: "i=4, key=5. 9>5 shifts; the first 5 is not > 5, so it stops there: [1,2,5,5,9,6].",
          },
          {
            cells: [
              { value: 1, state: "done" }, { value: 2, state: "done" }, { value: 5, state: "done" },
              { value: 5, state: "done" }, { value: 6, state: "done" }, { value: 9, state: "done" },
            ],
            range: [0, 5],
            note: "i=5, key=6. 9>6 shifts; the second 5 is not > 6, so it stops there: [1,2,5,5,6,9] — fully sorted.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Notice the `swapped` flag in `bubbleSort`: if a full pass makes zero swaps, the array is already " +
        "sorted and the loop exits early — this is why bubble sort's *best* case (an already-sorted array) " +
        "is O(n), even though its worst case is O(n²). Insertion sort has the same best-case behaviour, " +
        "for the same underlying reason: on a sorted array, the `while` loop's condition is never true, so " +
        "every element gets placed in one O(1) step.",
    },
    {
      kind: "table",
      head: ["Algorithm", "Best case", "Worst case", "Space", "Why"],
      rows: [
        [
          "Bubble sort",
          "O(n)",
          "O(n²)",
          "O(1)",
          "Best case: one pass with no swaps confirms sorted, exits early. Worst case: n passes, each " +
            "comparing roughly n elements.",
        ],
        [
          "Selection sort",
          "O(n²)",
          "O(n²)",
          "O(1)",
          "Always scans the entire remaining unsorted portion to find the minimum, regardless of existing " +
            "order — no early exit is possible.",
        ],
        [
          "Insertion sort",
          "O(n)",
          "O(n²)",
          "O(1)",
          "Best case: each element's while loop stops immediately on an already-sorted array. Worst case " +
            "(reverse-sorted): each new element shifts all the way to the front.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Assuming all three are interchangeable because they share the same worst-case complexity — " +
          "insertion sort is the practical choice of the three for nearly-sorted data or small arrays " +
          "(some real sort implementations switch to it below a size threshold); selection sort never " +
          "benefits from partial order at all.",
        "Forgetting selection sort's one advantage: it makes at most n swaps total, versus bubble and " +
          "insertion sort's potentially O(n²) swaps — relevant when a swap (not a comparison) is the " +
          "expensive operation, such as moving large records rather than plain integers.",
        "Writing insertion sort's inner loop with `arr[j] >= key` instead of `arr[j] > key` — using `>=` " +
          "needlessly shifts past equal elements, which is harmless for correctness here but breaks " +
          "**stability** (preserving the relative order of equal elements), which some use cases rely on.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Bubble sort: repeatedly swap adjacent out-of-order pairs; the largest unsorted element bubbles to " +
          "the end each pass.",
        "Selection sort: repeatedly find the minimum of the remaining unsorted portion and place it; always " +
          "O(n²), no best-case shortcut.",
        "Insertion sort: build a sorted prefix one element at a time, sliding each new element into place.",
        "All three are O(n²) worst case and O(1) extra space; bubble and insertion sort both have an " +
          "O(n) best case on already-sorted input, selection sort does not.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Implement bubble/selection/insertion sort from scratch\" remains a common warm-up specifically " +
          "because it's a fast way to check comfort with nested loops and swapping — not because it's the " +
          "efficient answer.",
        "\"Which of these would you actually use, and when?\" tests judgement beyond memorised code — " +
          "insertion sort for small or nearly-sorted input is the strongest honest answer among the three.",
        "\"What makes a sort stable, and does this one qualify?\" is a reasonable follow-up — insertion and " +
          "bubble sort, implemented with strict `>` comparisons, are stable; selection sort, as written " +
          "above, generally is not.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does bubble sort's best-case complexity become O(n) rather than O(n²)?",
      options: [
        "Because bubble sort is always O(n) regardless of input, since each pass only compares neighbours",
        "The swapped flag lets it detect a fully sorted array after one pass and stop early",
        "Because Java optimises the loop automatically once it notices the array is already sorted",
        "Bubble sort has no best-case difference from its worst case, since it always makes all the passes",
      ],
      answer: 1,
      why:
        "When a full pass makes zero swaps, the array is already sorted, and the early exit skips all " +
        "remaining passes — giving O(n) for an already-sorted input, versus O(n²) when many out-of-" +
        "order elements force full passes.",
    },
    {
      kind: "quiz",
      question: "What is the main practical advantage of selection sort over the other two, according to this chapter?",
      options: [
        "It's faster in the worst case, because it needs fewer comparisons than the other two sorts",
        "It uses less memory than the others, since it needs no extra variables at all while sorting",
        "It makes at most n swaps, which matters when swapping is expensive (e.g. large records)",
        "It's the only one of the three sorts that is stable, because it never reorders equal elements",
      ],
      answer: 2,
      why:
        "Selection sort performs exactly one swap per outer-loop iteration (at most n-1 total), whereas " +
        "bubble and insertion sort can perform many more swaps — relevant specifically when moving each " +
        "element is costly, even though selection sort has no best-case time advantage.",
    },
    {
      kind: "quiz",
      question: "In insertionSort, what does the inner while loop (`while (j >= 0 && arr[j] > key)`) do?",
      options: [
        "It searches the whole sorted prefix for the key using binary search, then inserts it directly",
        "It shifts elements of the sorted prefix right to make room, stopping where key belongs",
        "It swaps arr[j] and key on every iteration without moving anything else in the array",
        "It sorts the entire array in a single call to the Arrays.sort method in the standard library",
      ],
      answer: 1,
      why:
        "The loop shifts each element in the sorted prefix that's greater than key one position to the " +
        "right, opening a gap; it stops as soon as it finds an element not greater than key (or reaches " +
        "the start), which is exactly where key should be inserted.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Trace bubble sort by hand on {3, 1, 4, 1, 5}, writing out the array's state after each full pass, " +
          "and note the pass on which no swaps happen.",
        "Explain, in your own words, why selection sort always performs exactly n-1 swaps for an n-element " +
          "array, regardless of the input's initial order.",
        "Describe, in your own words, why insertion sort is a reasonable choice for an array that is " +
          "'almost' sorted (only a few elements out of place), even though its worst-case complexity is " +
          "the same as bubble and selection sort.",
        "Given an array of card objects that must keep cards of equal rank in their original relative " +
          "order (stability), explain which of the three sorts, as described in this chapter, would be " +
          "safe to use and why.",
      ],
    },
  ],
};
