import type { Chapter } from "@/content/courses/types";

export const chapterStacks: Chapter = {
  slug: "stacks",
  title: "Stacks and the Monotonic Stack",
  summary:
    "Last in, first out — the same discipline that makes a stack of plates work turns out to be exactly " +
    "what's needed to match brackets, and, with one twist, to find the next bigger element in one pass.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "A **stack** allows exactly two operations at one end, called the **top**: `push` (add on top) and " +
        "`pop` (remove from the top). Nothing else is accessible — not the middle, not the bottom, until " +
        "everything above it is popped away. That single restriction, Last In First Out (**LIFO**), sounds " +
        "limiting, but it exactly matches a surprisingly large family of problems: anything with a notion of " +
        "'the most recent thing I haven't finished dealing with yet' needs a stack, because that is precisely " +
        "what a stack tracks.",
    },
    { kind: "h", text: "The cafeteria plates analogy" },
    {
      kind: "analogy",
      title: "A spring-loaded stack of cafeteria plates",
      text:
        "Picture the spring-loaded plate dispenser in a cafeteria. You can only ever take the plate currently " +
        "on top, and you can only ever add a new plate on top of the current stack — never slide one in from " +
        "the middle or the bottom. If someone loads plates A, then B, then C, the only plate anyone can take " +
        "next is C; only once C is gone does B become reachable. That's LIFO exactly. It's also, not " +
        "coincidentally, how your Java program's own **call stack** works from the Java course's recursion " +
        "chapter — each method call is a plate placed on top, and it can only be removed (returned from) once " +
        "everything it called on top of it has finished. Where the analogy stops: real plates are identical, " +
        "so it never matters *which* plate you get; a stack in code holds distinct values, and which one is " +
        "on top is exactly the information most stack-based algorithms are built around.",
    },
    { kind: "h", text: "Matching brackets: the canonical stack problem" },
    {
      kind: "code",
      caption:
        "Two classic stack uses: checking balanced brackets, and a monotonic stack that finds, for every " +
        "element, the next element to its right that's strictly greater.",
      code:
        "import java.util.ArrayDeque;\n" +
        "import java.util.Deque;\n" +
        "\n" +
        "public class StackOps {\n" +
        "    static boolean isBalanced(String s) {\n" +
        "        Deque<Character> stack = new ArrayDeque<>();\n" +
        "        for (char ch : s.toCharArray()) {\n" +
        "            if (ch == '(' || ch == '[' || ch == '{') {\n" +
        "                stack.push(ch);\n" +
        "            } else if (ch == ')' || ch == ']' || ch == '}') {\n" +
        "                if (stack.isEmpty()) return false;\n" +
        "                char open = stack.pop();\n" +
        "                if (ch == ')' && open != '(') return false;\n" +
        "                if (ch == ']' && open != '[') return false;\n" +
        "                if (ch == '}' && open != '{') return false;\n" +
        "            }\n" +
        "        }\n" +
        "        return stack.isEmpty();\n" +
        "    }\n" +
        "\n" +
        "    static int[] nextGreater(int[] nums) {\n" +
        "        int[] result = new int[nums.length];\n" +
        "        Deque<Integer> indices = new ArrayDeque<>(); // monotonic decreasing stack of indices\n" +
        "        for (int i = 0; i < nums.length; i++) {\n" +
        "            while (!indices.isEmpty() && nums[indices.peek()] < nums[i]) {\n" +
        "                result[indices.pop()] = nums[i];\n" +
        "            }\n" +
        "            indices.push(i);\n" +
        "        }\n" +
        "        while (!indices.isEmpty()) {\n" +
        "            result[indices.pop()] = -1;\n" +
        "        }\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("isBalanced(\\"{[()]}\\") = " + isBalanced("{[()]}"));\n' +
        '        System.out.println("isBalanced(\\"{[(])}\\") = " + isBalanced("{[(])}"));\n' +
        "\n" +
        "        int[] nums = {2, 1, 2, 4, 3};\n" +
        "        int[] result = nextGreater(nums);\n" +
        "        StringBuilder sb = new StringBuilder();\n" +
        '        for (int v : result) sb.append(v).append(" ");\n' +
        '        System.out.println("nextGreater: " + sb.toString().trim());\n' +
        "    }\n" +
        "}\n",
      output:
        'isBalanced("{[()]}") = true\nisBalanced("{[(])}") = false\nnextGreater: 4 2 4 -1 -1',
      python:
        "def is_balanced(s):\n" +
        '    pairs = {")": "(", "]": "[", "}": "{"}\n' +
        "    stack = []\n" +
        "    for ch in s:\n" +
        '        if ch in "([{":\n' +
        "            stack.append(ch)\n" +
        '        elif ch in ")]}":\n' +
        "            if not stack or stack.pop() != pairs[ch]:\n" +
        "                return False\n" +
        "    return not stack\n" +
        "\n" +
        "\n" +
        "def next_greater(nums):\n" +
        "    result = [-1] * len(nums)\n" +
        "    indices = []  # monotonic decreasing stack of indices\n" +
        "    for i, num in enumerate(nums):\n" +
        "        while indices and nums[indices[-1]] < num:\n" +
        "            result[indices.pop()] = num\n" +
        "        indices.append(i)\n" +
        "    return result\n" +
        "\n" +
        "\n" +
        "print('isBalanced(\"{[()]}\") =', is_balanced(\"{[()]}\"))\n" +
        "print('isBalanced(\"{[(])}\") =', is_balanced(\"{[(])}\"))\n" +
        "\n" +
        "nums = [2, 1, 2, 4, 3]\n" +
        "result = next_greater(nums)\n" +
        'print("nextGreater:", " ".join(str(v) for v in result))\n',
      pythonOutput:
        'isBalanced("{[()]}") = True\nisBalanced("{[(])}") = False\nnextGreater: 4 2 4 -1 -1',
    },
    {
      kind: "viz",
      title: "isBalanced(\"{[(])}\") — a bracket sequence that looks close but isn't",
      caption: "The most recently opened bracket must be the next one closed — that's LIFO by definition.",
      viz: {
        type: "stack",
        frames: [
          { items: ["{"], highlight: 0, note: "'{' -> push. Stack (top last): {" },
          { items: ["{", "["], highlight: 1, note: "'[' -> push. Stack: { [" },
          { items: ["{", "[", "("], highlight: 2, note: "'(' -> push. Stack: { [ (" },
          {
            items: ["{", "["],
            highlight: 1,
            note:
              "']' -> pop, get '('. Closing ']' needs an open '[', but popped '(' — mismatch. Return false " +
              "immediately.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The stack is exactly the right tool here because bracket matching is inherently a most-recent-first " +
        "problem: whichever bracket opened *last* must be the one that closes *next*, for the sequence to be " +
        "well-formed. That's LIFO by definition, which is why trying to solve this with, say, just a counter " +
        "of open brackets fails the moment there's more than one *kind* of bracket to track.",
    },
    { kind: "h", text: "The monotonic stack: keeping only what might still matter" },
    {
      kind: "p",
      text:
        "`nextGreater` solves a different-looking problem — for every number, find the next number to its " +
        "right that's bigger — with the same tool, used more cleverly. The stack holds *indices*, kept in an " +
        "order where the values they point to are always decreasing from bottom to top (a **monotonic " +
        "stack**). When a new number arrives that's bigger than the value on top, that top index has just " +
        "found its answer — pop it, record the answer, and check the new top. Keep popping until the top " +
        "index points to something bigger than the new number (or the stack is empty), then push the new " +
        "index. Every index is pushed once and popped at most once, so the total work across the whole array " +
        "is O(n) — not the O(n²) a naive 'for each element, scan right until you find something bigger' " +
        "would cost.",
    },
    {
      kind: "viz",
      title: "nextGreater({2, 1, 2, 4, 3}) — the index stack, values shown for clarity",
      caption: "Each stack entry is 'index=value'. The stack only ever holds values still waiting for a bigger neighbour.",
      viz: {
        type: "stack",
        frames: [
          {
            items: ["i0=2"],
            highlight: 0,
            note: "i=0 (val 2). Stack empty, nothing to pop. Push 0.",
          },
          {
            items: ["i0=2", "i1=1"],
            highlight: 1,
            note: "i=1 (val 1). Top is index 0 (val 2); 2 is not < 1, so don't pop. Push 1.",
          },
          {
            items: ["i0=2", "i2=2"],
            highlight: 1,
            note:
              "i=2 (val 2). Top is index 1 (val 1); 1 < 2, pop it, result[1] = 2. New top is index 0 (val 2); " +
              "2 is not < 2, stop popping. Push 2.",
          },
          {
            items: ["i3=4"],
            highlight: 0,
            note:
              "i=3 (val 4). Pop index 2 (val 2 < 4), result[2] = 4. Pop index 0 (val 2 < 4), result[0] = 4. " +
              "Stack now empty. Push 3.",
          },
          {
            items: ["i3=4", "i4=3"],
            highlight: 1,
            note: "i=4 (val 3). Top is index 3 (val 4); 4 is not < 3, don't pop. Push 4.",
          },
          {
            items: ["i3=4", "i4=3"],
            note:
              "Array exhausted. Remaining indices (3, 4) have no next greater element — result[3] = -1, " +
              "result[4] = -1. Final: {4, 2, 4, -1, -1}.",
          },
        ],
      },
    },
    {
      kind: "table",
      head: ["Operation", "Time", "Space", "Why"],
      rows: [
        [
          "isBalanced(s), length n",
          "O(n)",
          "O(n)",
          "Each character is pushed or popped at most once; the stack can hold up to n unmatched opens in " +
            "the worst case (e.g. all opening brackets).",
        ],
        [
          "nextGreater(nums), length n",
          "O(n)",
          "O(n)",
          "Every index is pushed exactly once and popped at most once across the whole run, giving O(1) " +
            "amortised work per element despite the inner while loop.",
        ],
        [
          "Naive next-greater (nested loop)",
          "O(n²)",
          "O(1)",
          "For each element, scans forward until a bigger value or the end — up to n comparisons per " +
            "element, n elements.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Trying to check balanced brackets with just a counter — a single 'depth' counter can't tell `([)]` " +
          "from `([])`, because it never records *which kind* of bracket is waiting to close; only a stack " +
          "does.",
        "Forgetting to check the stack is empty before popping — both a closing bracket with nothing open, " +
          "and an empty `nextGreater` stack, must be checked before `peek()`/`pop()` or the code throws.",
        "Assuming the monotonic stack's inner `while` loop makes the algorithm O(n²) — it looks nested, but " +
          "since every index is popped at most once *total* across the entire outer loop, the amortised cost " +
          "per element is O(1), giving O(n) overall.",
        "Not checking that the stack is fully empty at the end of `isBalanced` — a string like `\"(()\"` has " +
          "no invalid pop, but leaves an unmatched `(` on the stack, so the final emptiness check is what " +
          "catches it.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A stack is Last In, First Out: push and pop only ever touch the top.",
        "Reach for a stack whenever a problem needs 'undo the most recent unfinished thing' — brackets, " +
          "function calls, undo history.",
        "A monotonic stack keeps only the elements that could still be somebody's answer, discarding — and " +
          "resolving — anything a bigger (or smaller) later value makes irrelevant.",
        "The inner while loop in a monotonic stack looks expensive but is O(n) total, not O(n²), because " +
          "each element is pushed once and popped at most once across the whole array.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Valid parentheses\" is one of the most-asked warm-up questions specifically because it's the " +
          "cleanest test of recognising a LIFO structure — solving it without a stack is usually a sign to " +
          "reconsider the approach.",
        "\"Next greater element\", \"daily temperatures\" (days until a warmer day), and \"largest rectangle " +
          "in a histogram\" are all monotonic-stack problems wearing different costumes — the tell is " +
          "'find the next/previous element satisfying some comparison, for every position'.",
        "Being asked to evaluate a postfix or infix expression is another common stack problem, directly " +
          "using the LIFO property to hold operands or operators awaiting their turn.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how a monotonic stack would find, for every day's temperature in a " +
          "list, how many days until a strictly warmer day — and why it's the same shape as nextGreater.",
        "Given a string of only parentheses, describe how you'd find the length of the longest valid " +
          "(well-formed) substring, extending the balanced-brackets idea with a stack of indices instead of " +
          "characters.",
        "Explain how you would implement a 'min stack' — a stack that supports push, pop, and getMinimum, " +
          "all in O(1) — without scanning the whole stack for getMinimum.",
        "Describe, in words, how to evaluate a postfix expression like '3 4 + 2 *' using a single stack of " +
          "numbers.",
      ],
    },
    {
      kind: "quiz",
      question: "Why can't a single counter (incrementing on '(' and decrementing on ')') correctly validate a string with multiple bracket types like ([{}])?",
      options: [
        "It can: counters and stacks are equivalent for this problem, so the counter is just simpler",
        "A counter tracks only how many brackets are open, not which kind is waiting, so it misses a mismatch like ([)]",
        "Counters are slower than stacks in Java, so the counter version would time out",
        "Counters can only count upwards and never down, so a closing bracket cannot be recorded",
      ],
      answer: 1,
      why:
        "Validity depends on the most recently opened bracket matching the next one closed — that requires " +
        "remembering an ordered sequence of *which* brackets are open, which only a stack captures.",
    },
    {
      kind: "quiz",
      question: "In nextGreater, why is the total time complexity O(n) despite the while loop nested inside the for loop?",
      options: [
        "Because the while loop never actually runs more than once in total, so the code is a single pass",
        "Each index is pushed once and popped at most once overall, so pushes plus pops are bounded by 2n, not n times n",
        "Because Java's ArrayDeque makes pop() take O(1) regardless of context, which alone guarantees O(n)",
        "It isn't O(n): the nested loops mean it's actually O(n log n), because pops happen in sorted order",
      ],
      answer: 1,
      why:
        "Amortised analysis: summing the while loop's iterations across every outer-loop step never exceeds " +
        "the total number of pops possible (n), since each index leaves the stack at most once.",
    },
    {
      kind: "quiz",
      question: "What does it mean for the index stack in nextGreater to be 'monotonic decreasing'?",
      options: [
        "The indices themselves are stored in decreasing numeric order from the bottom of the stack to the top",
        "The values nums[index] that the stacked indices point to decrease from bottom to top, at all times",
        "The stack shrinks by exactly one element every iteration, so its size falls steadily as the loop runs",
        "Push operations happen less and less often as the loop moves along, so the stack ends up empty",
      ],
      answer: 1,
      why:
        "The invariant maintained is on the *values* pointed to, not the indices: whenever a new value " +
        "would break that decreasing order, the stack pops until the order is restored, which is exactly " +
        "what resolves each popped index's next-greater answer.",
    },
  ],
};
