import type { Chapter } from "@/content/courses/types";

export const chapterTwoPointers: Chapter = {
  slug: "two-pointers",
  title: "Two Pointers",
  summary:
    "Two indices moving through an array with purpose — from both ends inward, or both forward — turn " +
    "many O(n²) pair problems into a single O(n) pass.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "A lot of array problems ask something about a *pair* of elements: two numbers that sum to a " +
        "target, a palindrome check comparing ends inward, reversing in place. The instinctive approach — " +
        "a loop inside a loop, checking every pair — works, and is usually O(n²). The **two-pointer** " +
        "technique is a way of noticing that, for a specific but common family of these problems, you don't " +
        "need every pair; you need to walk two positions through the array *with a rule*, and the rule " +
        "itself rules out most pairs without ever looking at them.",
    },
    { kind: "h", text: "The two-usher analogy" },
    {
      kind: "analogy",
      title: "Two ushers seating a hall from both ends",
      text:
        "Imagine a wedding hall with numbered seats, sorted by row from the stage backward, and two ushers " +
        "— one starting at the front row, one at the back row — walking toward each other to check that " +
        "paired name-cards match. If the usher at the front and the usher at the back compare cards and the " +
        "combination is wrong, exactly one usher needs to move: if the pair needs to grow, the back usher " +
        "steps forward (the seat there is 'too small' a match); if it needs to shrink, the front usher " +
        "steps back. Neither usher ever revisits a row already ruled out — between them, they check the " +
        "whole hall in one coordinated walk instead of every usher checking every row against every other " +
        "row. That coordinated walk, converging from both ends, is the two-pointer pattern. Where the " +
        "analogy stops: this only works when the hall's seats are sorted in a way that tells the ushers " +
        "*which direction* to move — an unsorted hall gives no such signal, which is why this technique " +
        "leans so heavily on sorted (or otherwise ordered) input.",
    },
    { kind: "h", text: "Converging pointers: pair sum on a sorted array" },
    {
      kind: "code",
      caption:
        "Given a sorted array, find a pair that sums to a target — and reverse an array in place — both " +
        "using two pointers that converge from opposite ends.",
      code:
        "public class TwoPointers {\n" +
        "    static int[] pairWithSum(int[] sorted, int target) {\n" +
        "        int left = 0;\n" +
        "        int right = sorted.length - 1;\n" +
        "        while (left < right) {\n" +
        "            int sum = sorted[left] + sorted[right];\n" +
        "            if (sum == target) {\n" +
        "                return new int[]{left, right};\n" +
        "            } else if (sum < target) {\n" +
        "                left++;\n" +
        "            } else {\n" +
        "                right--;\n" +
        "            }\n" +
        "        }\n" +
        "        return new int[]{-1, -1};\n" +
        "    }\n" +
        "\n" +
        "    static void reverseInPlace(int[] arr) {\n" +
        "        int left = 0;\n" +
        "        int right = arr.length - 1;\n" +
        "        while (left < right) {\n" +
        "            int temp = arr[left];\n" +
        "            arr[left] = arr[right];\n" +
        "            arr[right] = temp;\n" +
        "            left++;\n" +
        "            right--;\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] sorted = {2, 4, 7, 11, 15, 20};\n" +
        "        int[] pair = pairWithSum(sorted, 18);\n" +
        '        System.out.println("pair indices: [" + pair[0] + ", " + pair[1] + "] -> "\n' +
        '            + sorted[pair[0]] + " + " + sorted[pair[1]] + " = 18");\n' +
        "\n" +
        "        int[] arr = {1, 2, 3, 4, 5};\n" +
        "        reverseInPlace(arr);\n" +
        "        StringBuilder sb = new StringBuilder();\n" +
        "        for (int v : arr) {\n" +
        '            sb.append(v).append(" ");\n' +
        "        }\n" +
        '        System.out.println("reversed: " + sb.toString().trim());\n' +
        "    }\n" +
        "}\n",
      output: "pair indices: [2, 3] -> 7 + 11 = 18\nreversed: 5 4 3 2 1",
      python:
        "def pair_with_sum(sorted_nums, target):\n" +
        "    left, right = 0, len(sorted_nums) - 1\n" +
        "    while left < right:\n" +
        "        total = sorted_nums[left] + sorted_nums[right]\n" +
        "        if total == target:\n" +
        "            return left, right\n" +
        "        elif total < target:\n" +
        "            left += 1\n" +
        "        else:\n" +
        "            right -= 1\n" +
        "    return -1, -1\n" +
        "\n" +
        "\n" +
        "def reverse_in_place(arr):\n" +
        "    left, right = 0, len(arr) - 1\n" +
        "    while left < right:\n" +
        "        arr[left], arr[right] = arr[right], arr[left]\n" +
        "        left += 1\n" +
        "        right -= 1\n" +
        "\n" +
        "\n" +
        "sorted_nums = [2, 4, 7, 11, 15, 20]\n" +
        "left, right = pair_with_sum(sorted_nums, 18)\n" +
        'print(f"pair indices: [{left}, {right}] -> {sorted_nums[left]} + {sorted_nums[right]} = 18")\n' +
        "\n" +
        "arr = [1, 2, 3, 4, 5]\n" +
        "reverse_in_place(arr)\n" +
        'print("reversed:", " ".join(str(v) for v in arr))\n',
      pythonOutput: "pair indices: [2, 3] -> 7 + 11 = 18\nreversed: 5 4 3 2 1",
    },
    {
      kind: "viz",
      title: "pairWithSum({2, 4, 7, 11, 15, 20}, target=18)",
      caption: "Converging pointers rule out a whole set of pairs with every step.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: 2, pointers: ["left"] },
              { value: 4 },
              { value: 7 },
              { value: 11 },
              { value: 15 },
              { value: 20, pointers: ["right"] },
            ],
            note: "left=0 (2), right=5 (20). sum = 22. 22 > 18, so right-- to shrink the sum.",
          },
          {
            cells: [
              { value: 2, pointers: ["left"] },
              { value: 4 },
              { value: 7 },
              { value: 11 },
              { value: 15, pointers: ["right"] },
              { value: 20 },
            ],
            note: "left=0 (2), right=4 (15). sum = 17. 17 < 18, so left++ to grow the sum.",
          },
          {
            cells: [
              { value: 2 },
              { value: 4, pointers: ["left"] },
              { value: 7 },
              { value: 11 },
              { value: 15, pointers: ["right"] },
              { value: 20 },
            ],
            note: "left=1 (4), right=4 (15). sum = 19. 19 > 18, so right--.",
          },
          {
            cells: [
              { value: 2 },
              { value: 4, pointers: ["left"] },
              { value: 7 },
              { value: 11, pointers: ["right"] },
              { value: 15 },
              { value: 20 },
            ],
            note: "left=1 (4), right=3 (11). sum = 15. 15 < 18, so left++.",
          },
          {
            cells: [
              { value: 2 },
              { value: 4 },
              { value: 7, state: "done", pointers: ["left"] },
              { value: 11, state: "done", pointers: ["right"] },
              { value: 15 },
              { value: 20 },
            ],
            note: "left=2 (7), right=3 (11). sum = 18. Match — return {2, 3}.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The reason this is correct, not just fast, is worth stating precisely: because the array is " +
        "sorted, if `sorted[left] + sorted[right]` is too small, increasing `left` is the *only* way to " +
        "grow the sum without abandoning `right` — every pair involving the old `left` and anything smaller " +
        "than the current `right` has already been ruled out as too small. Symmetrically for a sum that's " +
        "too large. Each step eliminates a whole set of pairs at once, which is exactly why this reaches an " +
        "answer in O(n) instead of checking all O(n²) pairs.",
    },
    { kind: "h", text: "Same-direction pointers: not just converging ends" },
    {
      kind: "p",
      text:
        "Two pointers don't always start at opposite ends and walk toward each other — a common variant " +
        "uses a **fast** and a **slow** pointer moving in the *same* direction at different speeds (used " +
        "later in this course for cycle detection in linked lists), or a **write** pointer trailing a " +
        "**read** pointer while compacting an array in place (for instance, moving all non-zero values to " +
        "the front). What all these variants share is the core idea: two positions, each advanced by a " +
        "rule grounded in what's already been seen, doing in one pass what a naive approach would need " +
        "nested passes for.",
    },
    {
      kind: "table",
      head: ["Pattern", "Time", "Space", "Why"],
      rows: [
        ["Nested loop, every pair", "O(n²)", "O(1)", "Compares every one of the roughly n²/2 pairs directly."],
        [
          "Two pointers, converging",
          "O(n)",
          "O(1)",
          "Each step moves one pointer and permanently rules out a whole set of pairs, sorted order " +
            "guaranteeing no valid pair is skipped.",
        ],
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add `print(left, right, total)` inside the loop and re-run to watch the two pointers converge on " +
        "each target.",
      starter:
        "def has_pair_with_sum(nums, target):\n" +
        "    left, right = 0, len(nums) - 1\n" +
        "    while left < right:\n" +
        "        total = nums[left] + nums[right]\n" +
        "        if total == target:\n" +
        "            return True\n" +
        "        if total < target:\n" +
        "            left += 1\n" +
        "        else:\n" +
        "            right -= 1\n" +
        "    return False\n" +
        "\n" +
        "\n" +
        "nums = [1, 3, 5, 7, 9, 11]\n" +
        "print(has_pair_with_sum(nums, 12))\n" +
        "print(has_pair_with_sum(nums, 2))\n",
      expectedOutput: "True\nFalse",
    },
    {
      kind: "pitfall",
      items: [
        "Applying converging two pointers to an unsorted array — without sorted order, moving `left` or " +
          "`right` gives no guarantee about which pairs are safely ruled out; sort first, or the technique " +
          "doesn't apply.",
        "Off-by-one errors in the loop condition — `left < right` (strict) versus `left <= right` changes " +
          "whether a single middle element is revisited; pick deliberately and test the smallest cases.",
        "Forgetting that moving a pointer *past* a value discards it permanently — if the problem needs " +
          "every pair examined (not just one satisfying pair), converging two pointers is the wrong tool.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Two pointers turns many O(n²) pair problems into O(n) by moving two positions with a rule, " +
          "instead of checking every combination.",
        "Converging pointers (from both ends inward) generally need sorted, or otherwise ordered, input to " +
          "be correct.",
        "Each pointer move should permanently rule out a whole set of possibilities — that's what makes the " +
          "single pass sufficient.",
        "Same-direction (fast/slow, read/write) pointers are a separate but related variant, reused later " +
          "for linked lists and in-place array compaction.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Can you do this without the nested loop?\" on a sorted-array pair problem is almost always " +
          "pointing at two pointers — recognising the sorted-input signal is half the battle.",
        "Reversing an array or checking a palindrome in place, with O(1) extra space, is a very common " +
          "warm-up that directly tests this pattern.",
        "Interviewers will often ask you to justify *why* moving a pointer is safe — being able to explain " +
          "what set of pairs just got ruled out, not just that the code works, is what separates a strong " +
          "answer.",
      ],
    },
    {
      kind: "quiz",
      question: "In pairWithSum, why does the array need to be sorted for the technique to be correct?",
      options: [
        "It doesn't need to be: sorting is only there for speed, not for the correctness of the answer",
        "Sorted order means moving left forward increases the sum and moving right backward decreases it, so no pair is skipped",
        "Java's two-pointer functions require sorted input as a language rule, otherwise the code won't compile",
        "Sorting removes duplicate values, which the algorithm cannot handle correctly if they are left in",
      ],
      answer: 1,
      why:
        "The algorithm's correctness depends on knowing that a given pointer move changes the sum in a " +
        "predictable direction — that guarantee comes entirely from the array being sorted.",
    },
    {
      kind: "quiz",
      question: "What is the time complexity of the converging two-pointer pair-sum search on an n-element sorted array?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
      answer: 2,
      why:
        "Each iteration moves at least one of the two pointers, and the pointers can move at most n times " +
        "total before meeting — one pass, O(n), compared to checking every pair at O(n²).",
    },
    {
      kind: "quiz",
      question: "Which of these is a same-direction (not converging) two-pointer pattern?",
      options: [
        "Checking a palindrome by comparing the first and last characters and working inward to the middle",
        "Finding a pair sum in a sorted array by moving left forward and right backward",
        "A fast and slow pointer both starting at the head of a list and moving forward",
        "Reversing an array by swapping the outermost elements and moving both pointers inward",
      ],
      answer: 2,
      why:
        "Fast/slow pointers both move in the same direction (forward), just at different speeds — unlike " +
        "the converging pattern, where one pointer starts at each end and they move toward each other.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Given a sorted array, describe (in words) how you'd find a pair whose sum is closest to a target, " +
          "not necessarily exactly equal, adapting the converging two-pointer approach.",
        "For a string, describe how two pointers from both ends can check whether it's a palindrome " +
          "ignoring spaces and punctuation, without building a cleaned copy of the string first.",
        "Given an array of 0s and 1s, describe a same-direction (read/write) two-pointer approach to move " +
          "all the 0s to the end while keeping the relative order of the 1s.",
        "Explain, in your own words, why the converging two-pointer approach for pair-sum would give a " +
          "wrong answer on an unsorted array, with a small example.",
      ],
    },
  ],
};
