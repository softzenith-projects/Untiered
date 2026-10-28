import type { Chapter } from "@/content/courses/types";

export const chapterQueuesAndDeques: Chapter = {
  slug: "queues-and-deques",
  title: "Queues and Deques",
  summary:
    "First in, first out — the discipline of a ticket counter line — and its double-ended cousin the " +
    "deque, which combines with the sliding window to track a moving maximum in one pass.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "A **queue** is a stack's mirror image: additions happen at the **back** (`offer` or `enqueue`), " +
        "removals happen from the **front** (`poll` or `dequeue`). Whoever joined first is removed first — " +
        "First In, First Out (**FIFO**). A **deque** (double-ended queue, pronounced 'deck') generalises " +
        "both: it allows adding or removing from *either* end, so a deque used only at one end behaves like " +
        "a stack, and used strictly back-in-front-out behaves like a queue. In Java, `ArrayDeque` is the " +
        "standard implementation for both roles — it's commonly preferred over the older `LinkedList` class " +
        "for stack/queue use because it avoids per-node object overhead.",
    },
    { kind: "h", text: "The ticket counter analogy" },
    {
      kind: "analogy",
      title: "A single-file ticket counter line",
      text:
        "A queue is the line at a railway ticket counter: people join at the back, and the counter serves " +
        "whoever has been waiting longest, from the front. Nobody can cut to the front, and nobody at the " +
        "front can be skipped over. This is FIFO, and it's the natural structure whenever fairness or arrival " +
        "order matters — printing jobs, customer support tickets, messages waiting to be processed. A deque " +
        "is that same line, except now people are also allowed to join or leave from *either* end — like a " +
        "queue for a shuttle where a family can decide at the last second to step out of either end without " +
        "disturbing the middle. Where the analogy stops: a real queue physically enforces its own order — you " +
        "can't be in the middle and also next in line; a coded deque's flexibility (either end, either " +
        "operation) is exactly why it's more powerful than a plain queue for problems like the one below.",
    },
    { kind: "h", text: "BFS needs a queue — a preview" },
    {
      kind: "p",
      text:
        "The most common place you'll reach for a plain queue in this course is breadth-first search (BFS), " +
        "covered in the graphs module: visiting nodes level by level means processing them in exactly the " +
        "order they were discovered, which is precisely FIFO. This chapter's code focuses on a deque instead, " +
        "because a deque earns its place with a technique that a plain queue or stack alone can't do: " +
        "tracking a sliding window's maximum in a single pass.",
    },
    {
      kind: "code",
      caption:
        "For every window of size k sliding across an array, find the maximum in that window — using a " +
        "deque that stays monotonic decreasing, so its front is always the current window's maximum.",
      code:
        "import java.util.ArrayDeque;\n" +
        "import java.util.Deque;\n" +
        "\n" +
        "public class QueueOps {\n" +
        "    static int[] slidingWindowMax(int[] nums, int k) {\n" +
        "        int[] result = new int[nums.length - k + 1];\n" +
        "        Deque<Integer> indices = new ArrayDeque<>(); // monotonic decreasing deque of indices\n" +
        "        for (int i = 0; i < nums.length; i++) {\n" +
        "            // remove indices that fell out of the window\n" +
        "            while (!indices.isEmpty() && indices.peekFirst() <= i - k) {\n" +
        "                indices.pollFirst();\n" +
        "            }\n" +
        "            // remove indices whose values are smaller than the incoming value\n" +
        "            while (!indices.isEmpty() && nums[indices.peekLast()] < nums[i]) {\n" +
        "                indices.pollLast();\n" +
        "            }\n" +
        "            indices.offerLast(i);\n" +
        "            if (i >= k - 1) {\n" +
        "                result[i - k + 1] = nums[indices.peekFirst()];\n" +
        "            }\n" +
        "        }\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] nums = {1, 3, -1, -3, 5, 3, 6, 7};\n" +
        "        int[] result = slidingWindowMax(nums, 3);\n" +
        "        StringBuilder sb = new StringBuilder();\n" +
        '        for (int v : result) sb.append(v).append(" ");\n' +
        '        System.out.println("slidingWindowMax: " + sb.toString().trim());\n' +
        "\n" +
        "        Deque<Integer> queue = new ArrayDeque<>();\n" +
        "        queue.offerLast(1);\n" +
        "        queue.offerLast(2);\n" +
        "        queue.offerLast(3);\n" +
        '        System.out.println("queue poll order: " + queue.pollFirst() + " " + queue.pollFirst() + " " ' +
        "+ queue.pollFirst());\n" +
        "    }\n" +
        "}\n",
      output: "slidingWindowMax: 3 3 5 5 6 7\nqueue poll order: 1 2 3",
      python:
        "from collections import deque\n" +
        "\n" +
        "\n" +
        "def sliding_window_max(nums, k):\n" +
        "    result = [0] * (len(nums) - k + 1)\n" +
        "    indices = deque()  # monotonic decreasing deque of indices\n" +
        "    for i, num in enumerate(nums):\n" +
        "        while indices and indices[0] <= i - k:\n" +
        "            indices.popleft()\n" +
        "        while indices and nums[indices[-1]] < num:\n" +
        "            indices.pop()\n" +
        "        indices.append(i)\n" +
        "        if i >= k - 1:\n" +
        "            result[i - k + 1] = nums[indices[0]]\n" +
        "    return result\n" +
        "\n" +
        "\n" +
        "nums = [1, 3, -1, -3, 5, 3, 6, 7]\n" +
        "result = sliding_window_max(nums, 3)\n" +
        'print("slidingWindowMax:", " ".join(str(v) for v in result))\n' +
        "\n" +
        "queue = deque()\n" +
        "queue.append(1)\n" +
        "queue.append(2)\n" +
        "queue.append(3)\n" +
        'print("queue poll order:", queue.popleft(), queue.popleft(), queue.popleft())\n',
      pythonOutput: "slidingWindowMax: 3 3 5 5 6 7\nqueue poll order: 1 2 3",
    },
    {
      kind: "viz",
      title: "slidingWindowMax({1, 3, -1, -3, 5, 3, 6, 7}, k=3) — first few steps",
      caption: "Each entry is 'index=value'. Front (left) is always the current window's maximum index.",
      viz: {
        type: "queue",
        frames: [
          { items: ["i0=1"], highlight: 0, note: "i=0 (val 1). Deque empty. Push 0. i < k-1, no output yet." },
          {
            items: ["i1=3"],
            highlight: 0,
            note: "i=1 (val 3). Back value nums[0]=1 < 3, pop it. Deque empty, push 1. Still i < k-1.",
          },
          {
            items: ["i1=3", "i2=-1"],
            highlight: 1,
            note:
              "i=2 (val -1). Front (1) in window; back value nums[1]=3 is not < -1, don't pop. Push 2. " +
              "i=k-1=2, so output result[0] = nums[front=1] = 3.",
          },
          {
            items: ["i1=3", "i2=-1", "i3=-3"],
            highlight: 2,
            note: "i=3 (val -3). Front index 1 not yet out of window. Back value -1 is not < -3. Push 3. result[1] = nums[1] = 3.",
          },
          {
            items: ["i4=5"],
            highlight: 0,
            note:
              "i=4 (val 5). Front index 1 has fallen out of the window, pop it. Back values -3 and -1 are " +
              "both < 5, pop both. Deque empty, push 4. result[2] = nums[4] = 5.",
          },
          {
            items: ["i4=5"],
            note:
              "The pattern continues: each index enters the deque once and leaves at most once, front always " +
              "holding the current window's maximum index. Final result: {3, 3, 5, 5, 6, 7}.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The deque stays monotonic decreasing in *value*, just like the monotonic stack from the previous " +
        "chapter — the difference is that here elements can also expire from the *front* once they fall " +
        "outside the current window, which a plain stack (one open end) can't express but a deque (two open " +
        "ends) can. Because every index is pushed once and popped at most once across the whole run — from " +
        "either end — the total work is still O(n), not O(n·k) the way re-scanning each window from scratch " +
        "would cost.",
    },
    {
      kind: "table",
      head: ["Operation", "Time", "Space", "Why"],
      rows: [
        [
          "Queue offer / poll",
          "O(1)",
          "O(1) per op",
          "ArrayDeque adds or removes at an end using array indices, no shifting of other elements.",
        ],
        [
          "slidingWindowMax(nums, k), length n",
          "O(n)",
          "O(k)",
          "Each index is pushed once and popped at most once (from either end) across the whole array; the " +
            "deque holds at most k indices at a time.",
        ],
        [
          "Naive sliding max (recompute per window)",
          "O(n·k)",
          "O(1)",
          "Scans all k elements of every one of the roughly n windows from scratch, discarding the previous " +
            "window's work each time.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Using a plain array or `LinkedList.remove(0)` as a queue — removing from the front of an array-based " +
          "list is O(n) (everything shifts left); `ArrayDeque`'s `poll()` is O(1) because it tracks head and " +
          "tail indices instead of shifting.",
        "In the sliding-window-max deque, checking the front for expiry with `==` instead of `<=` against " +
          "`i - k` — an index that's more than one step too old still needs removing, not just an index " +
          "exactly at the boundary.",
        "Popping from the back of the sliding-window deque based on *index* order instead of *value* order — " +
          "the back is popped while its value is smaller than the incoming value, regardless of how close " +
          "its index is.",
        "Assuming FIFO order is automatically preserved by any collection — a `HashSet` or plain array with " +
          "arbitrary removal does not guarantee it; only a structure that explicitly restricts operations to " +
          "the ends (queue, deque) does.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A queue is FIFO: add at the back, remove from the front — the ticket-counter line.",
        "A deque allows both ends to add and remove, generalising both stack and queue.",
        "BFS (graphs module) is the queue's most common use in this course — visiting level by level means " +
          "processing in discovery order.",
        "A monotonic deque solves the sliding-window-maximum family: pop expired indices from the front, pop " +
          "smaller values from the back, and the front always holds the current window's answer.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Design a queue using two stacks\" (or vice versa) is a recurring structural question that tests " +
          "whether you understand FIFO and LIFO deeply enough to build one out of the other.",
        "\"Sliding window maximum\" is a frequently asked hard-rated question precisely because the naive " +
          "answer is easy but O(n·k), and the monotonic-deque trick to reach O(n) is not obvious without " +
          "having seen the pattern before.",
        "Whenever an interviewer's problem needs 'the largest/smallest value currently in a moving window', " +
          "that phrase alone is usually enough to signal a monotonic deque, the same way a sorted-array pair " +
          "problem signals two pointers.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you would implement a FIFO queue using two LIFO stacks, and how " +
          "many stack operations a single dequeue costs in the worst case versus amortised over many calls.",
        "Adapt this chapter's sliding-window-maximum approach in words to instead track the sliding-window " +
          "*minimum* — what changes about the monotonic deque's ordering rule?",
        "Explain how a deque can be used to check whether a string reads the same forwards and backwards " +
          "(a palindrome), comparing characters from both ends inward.",
        "Describe, in your own words, a scenario (outside interviews) where FIFO order is the wrong choice " +
          "and a priority-based structure (covered in the next module) would be more appropriate.",
      ],
    },
    {
      kind: "quiz",
      question: "What does FIFO mean for a queue, and how does it differ from a stack's LIFO?",
      options: [
        "FIFO and LIFO are the same thing with different names",
        "FIFO removes from the front (whoever arrived first leaves first); LIFO removes from the top (whoever " +
          "arrived last leaves first)",
        "FIFO is only used for integers, LIFO for objects",
        "FIFO allows removal from either end; LIFO only from one",
      ],
      answer: 1,
      why:
        "A queue serves arrival order (first in, first out); a stack reverses it (last in, first out) — " +
        "the queue's line-at-a-counter versus the stack's spring-loaded plate dispenser.",
    },
    {
      kind: "quiz",
      question: "In slidingWindowMax, why is the deque kept monotonic decreasing by value?",
      options: [
        "It's an arbitrary implementation choice with no effect on correctness",
        "So that the front of the deque always holds the index of the current window's maximum value, " +
          "without needing to rescan the window",
        "To make the deque sort itself automatically",
        "Because ArrayDeque requires sorted input",
      ],
      answer: 1,
      why:
        "Any index whose value is smaller than a later value in the same or a future window can never be " +
        "the maximum again, so it's safely discarded from the back — leaving the front always correct.",
    },
    {
      kind: "quiz",
      question: "Why does removing from the front of an ArrayList-backed structure cost O(n), while ArrayDeque's poll() is O(1)?",
      options: [
        "ArrayList and ArrayDeque are actually implemented identically, so the cost is the same",
        "ArrayList shifts every remaining element left to close the gap; ArrayDeque just advances a head index",
        "ArrayDeque doesn't support removal from the front, so it needs a different structure",
        "ArrayList removal is always O(1), whichever position the removed element is at",
      ],
      answer: 1,
      why:
        "ArrayDeque is a circular buffer with head/tail pointers, so removing from either end is just an " +
        "index update; ArrayList must physically shift every subsequent element to keep indices contiguous.",
    },
  ],
};
