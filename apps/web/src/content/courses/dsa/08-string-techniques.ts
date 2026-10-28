import type { Chapter } from "@/content/courses/types";

export const chapterStringTechniques: Chapter = {
  slug: "string-techniques",
  title: "String Techniques: Frequency Counts, Palindromes, Anagrams",
  summary:
    "Strings are just arrays of characters, so array techniques apply directly — this chapter closes " +
    "module 2 by applying two pointers and frequency counting to three classic string questions.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "A string in Java is, under the hood, a sequence of characters — close enough to an array that " +
        "nearly every technique from this module applies directly, with one adjustment: strings are " +
        "**immutable** (covered in the Java course), so anything that 'modifies' a string actually builds a " +
        "new one. This chapter is deliberately light on new ideas and heavy on applying two pointers and " +
        "counting — the two tools already built up — to three problems that show up constantly: is this a " +
        "palindrome, and are these two words anagrams of each other?",
    },
    { kind: "h", text: "The seating-chart-of-letters analogy" },
    {
      kind: "analogy",
      title: "Two attendance registers, compared column by column",
      text:
        "To check whether two classrooms have exactly the same students, just in a different seating order, " +
        "you don't compare seat 1 to seat 1, seat 2 to seat 2 — that only works if the seating order " +
        "matches, which it doesn't here. Instead, you build a tally: for each classroom, count how many " +
        "students share each surname. If both tallies match exactly, the classrooms have the same students, " +
        "regardless of where each one sat. This is precisely what checking whether two words are " +
        "**anagrams** does — a **frequency count** (a tally, indexed by character instead of surname) " +
        "replaces position-by-position comparison, because anagram-ness is about *what's present and how " +
        "often*, not *where*. Where the analogy stops: a real attendance register only needs one tally per " +
        "classroom to compare; the code below builds one tally and *undoes* it with the second string, " +
        "which is a slightly different, and slightly neater, way to reach the same check.",
    },
    { kind: "h", text: "Palindrome check: two pointers, again" },
    {
      kind: "p",
      text:
        "A **palindrome** reads the same forwards and backwards (\"malayalam\", \"madam\"). This is a two-" +
        "pointer problem, precisely the converging kind from earlier in this module: start one pointer at " +
        "each end, compare, and move inward — any mismatch means it isn't a palindrome; the pointers meeting " +
        "in the middle without a mismatch means it is.",
    },
    {
      kind: "code",
      caption:
        "A palindrome check using converging two pointers, and an anagram check using a frequency count " +
        "that's built up by one string and torn down by the other.",
      code:
        "import java.util.HashMap;\n" +
        "import java.util.Map;\n" +
        "\n" +
        "public class StringTechniques {\n" +
        "    static boolean isPalindrome(String s) {\n" +
        "        int left = 0;\n" +
        "        int right = s.length() - 1;\n" +
        "        while (left < right) {\n" +
        "            if (s.charAt(left) != s.charAt(right)) {\n" +
        "                return false;\n" +
        "            }\n" +
        "            left++;\n" +
        "            right--;\n" +
        "        }\n" +
        "        return true;\n" +
        "    }\n" +
        "\n" +
        "    static boolean isAnagram(String a, String b) {\n" +
        "        if (a.length() != b.length()) {\n" +
        "            return false;\n" +
        "        }\n" +
        "        Map<Character, Integer> counts = new HashMap<>();\n" +
        "        for (char c : a.toCharArray()) {\n" +
        "            counts.merge(c, 1, Integer::sum);\n" +
        "        }\n" +
        "        for (char c : b.toCharArray()) {\n" +
        "            counts.merge(c, -1, Integer::sum);\n" +
        "        }\n" +
        "        for (int count : counts.values()) {\n" +
        "            if (count != 0) {\n" +
        "                return false;\n" +
        "            }\n" +
        "        }\n" +
        "        return true;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("isPalindrome(\\"malayalam\\"): " + isPalindrome("malayalam"));\n' +
        '        System.out.println("isPalindrome(\\"hello\\"): " + isPalindrome("hello"));\n' +
        '        System.out.println("isAnagram(\\"listen\\", \\"silent\\"): " + isAnagram("listen", "silent"));\n' +
        '        System.out.println("isAnagram(\\"rat\\", \\"car\\"): " + isAnagram("rat", "car"));\n' +
        "    }\n" +
        "}\n",
      output:
        'isPalindrome("malayalam"): true\nisPalindrome("hello"): false\nisAnagram("listen", "silent"): true\nisAnagram("rat", "car"): false',
      python:
        "from collections import Counter\n" +
        "\n" +
        "\n" +
        "def is_palindrome(s):\n" +
        "    left, right = 0, len(s) - 1\n" +
        "    while left < right:\n" +
        "        if s[left] != s[right]:\n" +
        "            return False\n" +
        "        left += 1\n" +
        "        right -= 1\n" +
        "    return True\n" +
        "\n" +
        "\n" +
        "def is_anagram(a, b):\n" +
        "    if len(a) != len(b):\n" +
        "        return False\n" +
        "    counts = Counter(a)\n" +
        "    counts.subtract(b)\n" +
        "    return all(count == 0 for count in counts.values())\n" +
        "\n" +
        "\n" +
        "print('isPalindrome(\"malayalam\"):', is_palindrome(\"malayalam\"))\n" +
        "print('isPalindrome(\"hello\"):', is_palindrome(\"hello\"))\n" +
        "print('isAnagram(\"listen\", \"silent\"):', is_anagram(\"listen\", \"silent\"))\n" +
        "print('isAnagram(\"rat\", \"car\"):', is_anagram(\"rat\", \"car\"))\n",
      pythonOutput:
        'isPalindrome("malayalam"): True\nisPalindrome("hello"): False\nisAnagram("listen", "silent"): True\nisAnagram("rat", "car"): False',
    },
    {
      kind: "viz",
      title: 'isPalindrome("malayalam") — converging inward',
      caption: "left and right move toward each other one step at a time; a match keeps them moving, a mismatch would return false immediately.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: "m", state: "compare", pointers: ["left"] },
              { value: "a" }, { value: "l" }, { value: "a" }, { value: "y" }, { value: "a" }, { value: "l" }, { value: "a" },
              { value: "m", state: "compare", pointers: ["right"] },
            ],
            note: "left=0 ('m'), right=8 ('m'). Match. left++, right--.",
          },
          {
            cells: [
              { value: "m", state: "done" },
              { value: "a", state: "compare", pointers: ["left"] },
              { value: "l" }, { value: "a" }, { value: "y" }, { value: "a" }, { value: "l" },
              { value: "a", state: "compare", pointers: ["right"] },
              { value: "m", state: "done" },
            ],
            note: "left=1 ('a'), right=7 ('a'). Match. left++, right--.",
          },
          {
            cells: [
              { value: "m", state: "done" }, { value: "a", state: "done" },
              { value: "l", state: "compare", pointers: ["left"] },
              { value: "a" }, { value: "y" }, { value: "a" },
              { value: "l", state: "compare", pointers: ["right"] },
              { value: "a", state: "done" }, { value: "m", state: "done" },
            ],
            note: "left=2 ('l'), right=6 ('l'). Match. left++, right--.",
          },
          {
            cells: [
              { value: "m", state: "done" }, { value: "a", state: "done" }, { value: "l", state: "done" },
              { value: "a", state: "compare", pointers: ["left"] },
              { value: "y" },
              { value: "a", state: "compare", pointers: ["right"] },
              { value: "l", state: "done" }, { value: "a", state: "done" }, { value: "m", state: "done" },
            ],
            note: "left=3 ('a'), right=5 ('a'). Match. left++, right--.",
          },
          {
            cells: [
              { value: "m", state: "done" }, { value: "a", state: "done" }, { value: "l", state: "done" }, { value: "a", state: "done" },
              { value: "y", state: "active", pointers: ["left", "right"] },
              { value: "a", state: "done" }, { value: "l", state: "done" }, { value: "a", state: "done" }, { value: "m", state: "done" },
            ],
            note:
              "left=4, right=4. left is no longer < right — loop stops (the middle 'y' never needed " +
              "comparing against itself). No mismatch found anywhere — return true.",
          },
        ],
      },
    },
    {
      kind: "viz",
      title: 'isAnagram("listen", "silent") — build, then tear down',
      caption: "One shared counts table: the first string builds it up, the second tears it back down; every count landing on 0 means the letters matched exactly.",
      viz: {
        type: "table",
        frames: [
          {
            rowLabels: ["l", "i", "s", "t", "e", "n"],
            colLabels: ["count"],
            rows: [[0], [0], [0], [0], [0], [0]],
            note: "counts starts empty (every count 0, no entries yet).",
          },
          {
            rowLabels: ["l", "i", "s", "t", "e", "n"],
            colLabels: ["count"],
            rows: [[1], [1], [1], [1], [1], [1]],
            note: "Build phase, reading \"listen\" one character at a time: counts becomes {l:1, i:1, s:1, t:1, e:1, n:1}.",
          },
          {
            rowLabels: ["l", "i", "s", "t", "e", "n"],
            colLabels: ["count"],
            rows: [[0], [0], [0], [0], [0], [0]],
            note:
              "Tear-down phase, reading \"silent\": counts.merge(c, -1, sum) for each character brings " +
              "'s', 'i', 'l', 'e', 'n', 't' back to 0, one at a time. Every value in counts is now exactly " +
              "0 — the two strings used precisely the same letters, the same number of times each. Return true.",
          },
        ],
      },
    },
    {
      kind: "table",
      head: ["Check", "Time", "Space", "Why"],
      rows: [
        [
          "isPalindrome",
          "O(n)",
          "O(1)",
          "Two pointers meet in the middle after roughly n/2 comparisons; no extra structure needed.",
        ],
        [
          "isAnagram",
          "O(n)",
          "O(k)",
          "One pass to build the count, one to tear it down; k is the number of distinct characters, " +
            "bounded and usually small (26 for lowercase English letters).",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Sorting both strings and comparing the sorted results to check anagrams — correct, but O(n log n) " +
          "instead of the O(n) frequency-count approach; know both, but name the faster one when asked to " +
          "optimise.",
        "Forgetting the length check before comparing frequency counts — two strings of different lengths " +
          "can never be anagrams, and skipping this check just means doing more work to reach the same " +
          "'false' answer.",
        "Building a *new* cleaned string (stripping spaces/punctuation, lowercasing) before a palindrome " +
          "check, when the problem allows checking in place with adjusted pointer movement — not wrong, but " +
          "costs extra space a careful two-pointer walk doesn't need.",
        "Assuming `==` compares string *content* in Java — as covered in the Java course, use `.equals()` " +
          "for content comparison; this trips up the same beginners here as it does everywhere else.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A string is a sequence of characters — array techniques (two pointers, frequency counts) apply " +
          "directly.",
        "Palindrome check: converging two pointers, compare and move inward, mismatch means false.",
        "Anagram check: a frequency count built by one string and torn down by the other; all zero at the " +
          "end means true.",
        "Frequency counting turns 'do these have the same characters, in some order' into an O(n) check, " +
          "avoiding an O(n log n) sort.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Palindrome and anagram checks are two of the most common string warm-ups there are — precisely " +
          "because they cleanly test two pointers and frequency counting, the same two ideas this whole " +
          "module has built toward.",
        "\"Can you do this in O(n), without sorting?\" after a sort-based anagram check is a near-certain " +
          "follow-up — the frequency-count approach is the expected answer.",
        "Being asked to ignore case, spaces, or punctuation in a palindrome check is a common added " +
          "constraint — practise adapting the two-pointer loop's comparison, not just the happy-path " +
          "version.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does isPalindrome use `left < right` rather than `left <= right` as its loop condition?",
      options: [
        "It's a typo that happens to still work, because the extra comparison is always harmless",
        "When left equals right it's the single middle character of an odd-length string, which needs no comparison",
        "Because Java forbids using <= with string indices, so the loop would not compile",
        "Because it makes the check run in O(1) instead of O(n), by stopping the loop early",
      ],
      answer: 1,
      why:
        "The pointers only need to compare distinct pairs of characters moving inward. Once left meets or " +
        "passes right, every pair has already been checked — a middle character in an odd-length string " +
        "has nothing left to compare against.",
    },
    {
      kind: "quiz",
      question: "In isAnagram, what does it mean if every value in the counts map is exactly 0 after both loops run?",
      options: [
        "Both strings were empty",
        "Both strings contained exactly the same characters, the same number of times each — they're " +
          "anagrams",
        "The two strings have different lengths",
        "An error occurred during counting",
      ],
      answer: 1,
      why:
        "The first loop adds one for each character in a; the second subtracts one for each character in " +
        "b. Every count returning to exactly 0 means a and b contributed identically to every character's " +
        "tally — the same multiset of letters.",
    },
    {
      kind: "quiz",
      question: "Why is the frequency-count approach to checking anagrams generally preferred over sorting both strings and comparing them?",
      options: [
        "Sorting doesn't work correctly for this check, since sorted strings can differ for anagrams",
        "Frequency counting is O(n), while sorting both strings is O(n log n)",
        "Frequency counting uses less code, and that is its only advantage over sorting",
        "Sorting can't be used on strings in Java, because String has no sort method of any kind",
      ],
      answer: 1,
      why:
        "Sorting both strings costs O(n log n) and then a linear comparison; frequency counting reaches " +
        "the same true/false answer in O(n) total, which is the better complexity when asked to optimise.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd check whether a string is a palindrome while ignoring " +
          "spaces, punctuation, and letter case, adapting the two-pointer approach without building a fully " +
          "cleaned copy first.",
        "Given a string, describe a frequency-count approach to find the first character that appears " +
          "exactly once.",
        "Describe, in your own words, how the frequency-count idea from isAnagram could be adapted to check " +
          "whether one string's characters (with counts) could be rearranged to form a second, possibly " +
          "shorter, string.",
        "Given a list of words, describe how you'd group all anagrams of each other together, reusing the " +
          "frequency-count idea as a way to identify which words belong in the same group.",
      ],
    },
  ],
};
