import type { Chapter } from "@/content/courses/types";

export const chapterSlidingWindow: Chapter = {
  slug: "sliding-window",
  title: "Sliding Window",
  summary:
    "A contiguous chunk of the array that slides forward, reusing work from the last position instead of " +
    "recomputing from scratch — fixed-size and variable-size, both O(n).",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Many problems ask something about every contiguous chunk of an array or string: the maximum sum of " +
        "any 3 consecutive numbers, the longest run of characters with no repeats. The brute-force instinct " +
        "is to recompute each chunk from scratch — sum these 3 numbers, then sum the next 3 numbers, and so " +
        "on — which is O(n × k) for chunks of size k. The **sliding window** technique notices that " +
        "consecutive chunks overlap almost entirely, so instead of recomputing, you *update*: drop what " +
        "left the window, add what entered it.",
    },
    { kind: "h", text: "The train-window analogy" },
    {
      kind: "analogy",
      title: "Watching the view through a moving train window",
      text:
        "Looking out of a moving train's window, you don't see the whole route at once — you see a fixed " +
        "stretch of track, and as the train moves forward, one end of that view disappears while a new one " +
        "appears at the other. You never have to re-look at the entire journey to describe what's currently " +
        "visible; you just track what left the frame and what entered it. A sliding window over an array " +
        "works the same way: a **window** is a contiguous range `[left, right]`, and moving it forward " +
        "means adjusting for exactly one element leaving and one entering, not recomputing everything " +
        "inside. Where the analogy stops: a train window has a fixed size chosen by the carriage; a coding " +
        "window sometimes needs to *grow or shrink itself* based on a condition, which the fixed-view train " +
        "window can't do.",
    },
    { kind: "h", text: "Fixed-size window: maximum sum of k consecutive elements" },
    {
      kind: "code",
      caption:
        "A fixed-size window (maximum sum of any k consecutive elements) and a variable-size window " +
        "(longest substring with no repeated characters), in one class.",
      code:
        "import java.util.HashSet;\n" +
        "import java.util.Set;\n" +
        "\n" +
        "public class SlidingWindow {\n" +
        "    static int maxSumWindow(int[] nums, int k) {\n" +
        "        int windowSum = 0;\n" +
        "        for (int i = 0; i < k; i++) {\n" +
        "            windowSum += nums[i];\n" +
        "        }\n" +
        "        int best = windowSum;\n" +
        "        for (int end = k; end < nums.length; end++) {\n" +
        "            windowSum += nums[end] - nums[end - k];\n" +
        "            best = Math.max(best, windowSum);\n" +
        "        }\n" +
        "        return best;\n" +
        "    }\n" +
        "\n" +
        "    static int longestNoRepeat(String s) {\n" +
        "        Set<Character> inWindow = new HashSet<>();\n" +
        "        int left = 0;\n" +
        "        int best = 0;\n" +
        "        for (int right = 0; right < s.length(); right++) {\n" +
        "            char c = s.charAt(right);\n" +
        "            while (inWindow.contains(c)) {\n" +
        "                inWindow.remove(s.charAt(left));\n" +
        "                left++;\n" +
        "            }\n" +
        "            inWindow.add(c);\n" +
        "            best = Math.max(best, right - left + 1);\n" +
        "        }\n" +
        "        return best;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] nums = {2, 1, 5, 1, 3, 2};\n" +
        '        System.out.println("maxSumWindow(k=3): " + maxSumWindow(nums, 3));\n' +
        '        System.out.println("longestNoRepeat(\\"abcabcbb\\"): " + longestNoRepeat("abcabcbb"));\n' +
        '        System.out.println("longestNoRepeat(\\"bbbbb\\"): " + longestNoRepeat("bbbbb"));\n' +
        "    }\n" +
        "}\n",
      output:
        'maxSumWindow(k=3): 9\nlongestNoRepeat("abcabcbb"): 3\nlongestNoRepeat("bbbbb"): 1',
      python:
        "def max_sum_window(nums, k):\n" +
        "    window_sum = sum(nums[:k])\n" +
        "    best = window_sum\n" +
        "    for end in range(k, len(nums)):\n" +
        "        window_sum += nums[end] - nums[end - k]\n" +
        "        best = max(best, window_sum)\n" +
        "    return best\n" +
        "\n" +
        "\n" +
        "def longest_no_repeat(s):\n" +
        "    in_window = set()\n" +
        "    left = 0\n" +
        "    best = 0\n" +
        "    for right, c in enumerate(s):\n" +
        "        while c in in_window:\n" +
        "            in_window.remove(s[left])\n" +
        "            left += 1\n" +
        "        in_window.add(c)\n" +
        "        best = max(best, right - left + 1)\n" +
        "    return best\n" +
        "\n" +
        "\n" +
        "nums = [2, 1, 5, 1, 3, 2]\n" +
        'print("maxSumWindow(k=3):", max_sum_window(nums, 3))\n' +
        "print('longestNoRepeat(\"abcabcbb\"):', longest_no_repeat(\"abcabcbb\"))\n" +
        "print('longestNoRepeat(\"bbbbb\"):', longest_no_repeat(\"bbbbb\"))\n",
      pythonOutput:
        'maxSumWindow(k=3): 9\nlongestNoRepeat("abcabcbb"): 3\nlongestNoRepeat("bbbbb"): 1',
    },
    {
      kind: "viz",
      title: "maxSumWindow({2, 1, 5, 1, 3, 2}, k=3)",
      caption: "The window slides one step at a time: one value leaves, one enters.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 2 }, { value: 1 }, { value: 5 }, { value: 1 }, { value: 3 }, { value: 2 }],
            range: [0, 2],
            note: "Build the first window directly: nums[0]+nums[1]+nums[2] = 2+1+5 = 8. windowSum = 8, best = 8.",
          },
          {
            cells: [{ value: 2 }, { value: 1 }, { value: 5 }, { value: 1 }, { value: 3 }, { value: 2 }],
            range: [1, 3],
            note: "end=3: windowSum += nums[3] - nums[0] = 1 - 2 = -1. windowSum = 7. best stays 8.",
          },
          {
            cells: [{ value: 2 }, { value: 1 }, { value: 5 }, { value: 1 }, { value: 3 }, { value: 2 }],
            range: [2, 4],
            note: "end=4: windowSum += nums[4] - nums[1] = 3 - 1 = 2. windowSum = 9. best becomes 9.",
          },
          {
            cells: [{ value: 2 }, { value: 1 }, { value: 5 }, { value: 1 }, { value: 3 }, { value: 2 }],
            range: [3, 5],
            note: "end=5: windowSum += nums[5] - nums[2] = 2 - 5 = -3. windowSum = 6. best stays 9.",
          },
          {
            cells: [
              { value: 2 },
              { value: 1 },
              { value: 5, state: "done" },
              { value: 1, state: "done" },
              { value: 3, state: "done" },
              { value: 2 },
            ],
            range: [2, 4],
            note: "Result: 9, from the window {5, 1, 3} — found without ever re-summing 3 elements from scratch.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Notice what `windowSum += nums[end] - nums[end - k]` is doing: adding the one new element that " +
        "just entered the window, and subtracting the one old element that just left it — exactly the train " +
        "window's \"one thing appears, one thing disappears\", never re-adding the middle. The variable-size " +
        "version, `longestNoRepeat`, works differently: `right` always advances, but `left` only advances " +
        "*when needed*, shrinking the window from the front until the repeat is gone, then the window grows " +
        "again. Both share the same shape — one window, tracked incrementally — but the fixed-size version " +
        "always keeps the same width, while the variable-size version's width is the very thing being " +
        "measured.",
    },
    {
      kind: "viz",
      title: 'longestNoRepeat("abcabcbb") — where the window shrinks',
      caption: "right always advances; left only moves when a repeat forces it to.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: "a", pointers: ["left", "right"] },
              { value: "b" },
              { value: "c" },
              { value: "a" },
              { value: "b" },
              { value: "c" },
              { value: "b" },
              { value: "b" },
            ],
            range: [0, 0],
            note: "right=0 ('a'): not in window. Add 'a'. Window = {a}, size 1. best = 1.",
          },
          {
            cells: [
              { value: "a", pointers: ["left"] },
              { value: "b", pointers: ["right"] },
              { value: "c" },
              { value: "a" },
              { value: "b" },
              { value: "c" },
              { value: "b" },
              { value: "b" },
            ],
            range: [0, 1],
            note: "right=1 ('b'): not in window. Add 'b'. Window = {a,b}, size 2. best = 2.",
          },
          {
            cells: [
              { value: "a", pointers: ["left"] },
              { value: "b" },
              { value: "c", pointers: ["right"] },
              { value: "a" },
              { value: "b" },
              { value: "c" },
              { value: "b" },
              { value: "b" },
            ],
            range: [0, 2],
            note: "right=2 ('c'): not in window. Add 'c'. Window = {a,b,c}, size 3. best = 3.",
          },
          {
            cells: [
              { value: "a", state: "swap" },
              { value: "b", pointers: ["left"] },
              { value: "c" },
              { value: "a", pointers: ["right"] },
              { value: "b" },
              { value: "c" },
              { value: "b" },
              { value: "b" },
            ],
            range: [1, 3],
            note:
              "right=3 ('a'): 'a' IS in the window. Shrink: remove s[left]='a', left becomes 1 — now 'a' is " +
              "gone from {b,c}, so the while loop stops. Add 'a'. Window = {b,c,a}, size 3.",
          },
          {
            cells: [
              { value: "a" },
              { value: "b", state: "swap" },
              { value: "c" },
              { value: "a" },
              { value: "b", pointers: ["left"] },
              { value: "c", pointers: ["right"] },
              { value: "b" },
              { value: "b" },
            ],
            range: [4, 5],
            note:
              "right continues similarly for 'b', 'c' — each time the repeat is found, left shrinks past " +
              "exactly the old occurrence and stops.",
          },
          {
            cells: [
              { value: "a", state: "done" },
              { value: "b", state: "done" },
              { value: "c", state: "done" },
              { value: "a" },
              { value: "b" },
              { value: "c" },
              { value: "b" },
              { value: "b" },
            ],
            range: [0, 2],
            note: 'The longest window ever reached has size 3 ("abc", or any of its later repeats) — the final answer.',
          },
        ],
      },
    },
    {
      kind: "table",
      head: ["Approach", "Time", "Space", "Why"],
      rows: [
        [
          "Recompute every window's sum from scratch",
          "O(n × k)",
          "O(1)",
          "Each of the roughly n windows re-sums all k of its elements.",
        ],
        [
          "Sliding window, fixed size",
          "O(n)",
          "O(1)",
          "Each step does one addition and one subtraction; every element is added once and removed once.",
        ],
        [
          "Sliding window, variable size (longestNoRepeat)",
          "O(n)",
          "O(min(n, alphabet size))",
          "right advances n times total; left never moves backward, so it also advances at most n times " +
            "total across the whole run — the set holds at most one window's worth of characters.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Recomputing the window sum from scratch on every step instead of adjusting incrementally — this " +
          "silently turns an O(n) solution back into O(n × k), defeating the whole point.",
        "In a variable-size window, using `if` instead of `while` to shrink the left edge — a single repeat " +
          "can require shrinking past more than one character, and `while` is what guarantees the window is " +
          "actually valid again before continuing.",
        "Forgetting to update auxiliary state (like the HashSet in longestNoRepeat) when the window shrinks " +
          "— the window's boundaries and its tracked contents must move together, not just the indices.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Sliding window updates a running result as the window moves, instead of recomputing it from " +
          "scratch for every position.",
        "Fixed-size window: add the entering element, subtract the leaving element, each step.",
        "Variable-size window: right always advances; left advances only as needed to restore a condition, " +
          "using a while loop, not an if.",
        "Both variants are O(n) overall because every element is added to the window and removed from it at " +
          "most once across the whole run.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Contiguous subarray/substring\" in a problem statement is close to a direct signal for sliding " +
          "window — train yourself to notice that phrase.",
        "\"Can you avoid recomputing the sum each time?\" after a brute-force windowed solution is a near-" +
          "certain nudge toward the incremental update this chapter describes.",
        "Longest substring without repeating characters specifically is one of the most frequently asked " +
          "variable-size window problems across interviews.",
      ],
    },
    {
      kind: "quiz",
      question: "In the fixed-size maxSumWindow, what does `windowSum += nums[end] - nums[end - k]` accomplish?",
      options: [
        "It resets windowSum to zero and then recomputes the whole sum from scratch for the new window",
        "It adds the newly entered element and subtracts the one that just left, in a single step",
        "It sorts the current window first, so the largest element can be added to the running sum",
        "It computes the average of the window instead of its sum, by dividing after each update",
      ],
      answer: 1,
      why:
        "nums[end] is the element that just entered the window as it slides forward; nums[end - k] is the " +
        "element that just left it. Adjusting by their difference avoids re-summing the whole window.",
    },
    {
      kind: "quiz",
      question: "In longestNoRepeat, why does the inner loop use `while (inWindow.contains(c))` instead of `if`?",
      options: [
        "while and if behave identically here, so the choice makes no difference to the result",
        "One repeated character can force the left edge to move past more than one character",
        "while is required by Java syntax whenever a Set is used inside the loop condition",
        "It's a stylistic choice with no effect on correctness, as an if would work as well",
      ],
      answer: 1,
      why:
        "Shrinking must continue exactly until the offending character is removed from the window, which " +
        "can take more than one step — an if would only shrink once, potentially leaving the window still " +
        "containing a repeat.",
    },
    {
      kind: "quiz",
      question: "What is the overall time complexity of longestNoRepeat on a string of length n?",
      options: ["O(n²)", "O(n log n)", "O(n)", "O(1)"],
      answer: 2,
      why:
        "right advances n times total across the whole run, and left only ever moves forward, so it also " +
        "advances at most n times total — the combined work across the entire run is O(n), not O(n) per " +
        "step of an outer O(n) loop.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd find the minimum (not maximum) sum among all windows of " +
          "size k, adapting the fixed-size window approach.",
        "For a string, describe a variable-size window approach to find the length of the longest substring " +
          "that contains at most two distinct characters.",
        "Given an array of positive numbers and a target sum, describe a variable-size window approach to " +
          "find the length of the shortest contiguous subarray whose sum is at least the target.",
        "Explain, in your own words, why a variable-size window's left pointer never needs to move " +
          "backward once it has advanced — what would break if it did?",
      ],
    },
  ],
};
