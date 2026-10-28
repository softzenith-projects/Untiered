import type { Chapter } from "@/content/courses/types";

export const chapterHeapsAndPriorityQueues: Chapter = {
  slug: "heaps-and-priority-queues",
  title: "Heaps and Priority Queues",
  summary:
    "A heap doesn't keep everything sorted — it only ever guarantees the top is the smallest (or biggest), " +
    "and that weaker promise is exactly what makes push and pop O(log n) instead of O(n).",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "A **priority queue** serves whoever has the highest (or lowest) priority next, regardless of when " +
        "they arrived — unlike a plain queue's FIFO order. A **heap** is the data structure that makes this " +
        "efficient. A **min-heap** guarantees only one thing: every node's value is less than or equal to " +
        "both its children's values. That's weaker than a full sort — a heap doesn't know whether its left " +
        "child is smaller than its right child, only that both are ≥ the parent — but that weaker guarantee " +
        "is exactly what makes both `push` and `pop` cost O(log n), rather than the O(n log n) a full sort " +
        "would need every time the smallest element is wanted.",
    },
    {
      kind: "concept",
      title: "The heap property is weaker than \"sorted\", on purpose",
      text:
        "A heap only promises parent ≤ both children (min-heap) or parent ≥ both children (max-heap) — it " +
        "makes no promise at all about which child is smaller, or about any two nodes that aren't in a " +
        "direct parent/child relationship. Giving up full order is exactly what buys O(log n) push/pop " +
        "instead of the O(n log n) a fully sorted structure would cost to maintain.",
    },
    {
      kind: "compare",
      title: "Min-heap vs max-heap",
      columns: [
        {
          label: "Min-heap",
          items: [
            "Every parent ≤ both children — the smallest value sits at the root",
            "Java's `PriorityQueue<>()` is a min-heap by default",
            "The tool for \"k largest\": cap it at size k, evict the smallest candidate",
          ],
        },
        {
          label: "Max-heap",
          items: [
            "Every parent ≥ both children — the largest value sits at the root",
            "In Java: `new PriorityQueue<>(Collections.reverseOrder())`",
            "The tool for \"k smallest\": cap it at size k, evict the largest candidate",
          ],
        },
      ],
    },
    { kind: "h", text: "The hospital triage analogy" },
    {
      kind: "analogy",
      title: "A hospital emergency room's triage queue",
      text:
        "An ER doesn't treat patients in arrival order — it treats whoever's condition is most urgent right " +
        "now, and re-checks that ranking every time someone new arrives or the most urgent patient is taken " +
        "in. Crucially, the triage nurse doesn't keep the *entire* waiting room sorted top to bottom at all " +
        "times — that would mean re-sorting everyone whenever anyone's status changes. They just need to " +
        "always know who's most urgent *right now*, quickly. A heap makes exactly that promise: instant " +
        "access to the most extreme element, without paying to keep everything else in order. Where the " +
        "analogy stops: a heap's shape is a strict binary tree kept as compact as possible (a **complete " +
        "binary tree** — every level full except possibly the last, filled left to right), which has no " +
        "real-world triage-room equivalent; it's purely what keeps the tree's height at O(log n) for n " +
        "patients.",
    },
    { kind: "h", text: "A heap stored in an array" },
    {
      kind: "p",
      text:
        "Because a heap is always a *complete* binary tree, it doesn't need actual `left`/`right` pointer " +
        "objects — it can be packed into a plain array, where for a node at index `i`, its children sit at " +
        "`2i+1` and `2i+2`, and its parent sits at `(i-1)/2` (integer division). This is both simpler and " +
        "faster than a pointer-based tree, and it's how Java's own `java.util.PriorityQueue` (a min-heap by " +
        "default) is implemented internally.",
    },
    {
      kind: "code",
      caption:
        "A hand-rolled array-backed min-heap (push = sift up, pop = sift down), plus Java's built-in " +
        "PriorityQueue used to find the k largest elements in a stream.",
      code:
        "import java.util.PriorityQueue;\n" +
        "\n" +
        "public class HeapOps {\n" +
        "    static class MinHeap {\n" +
        "        int[] data = new int[16];\n" +
        "        int size = 0;\n" +
        "\n" +
        "        void push(int val) {\n" +
        "            if (size == data.length) grow();\n" +
        "            data[size] = val;\n" +
        "            int i = size;\n" +
        "            size++;\n" +
        "            while (i > 0) {\n" +
        "                int parent = (i - 1) / 2;\n" +
        "                if (data[parent] <= data[i]) break;\n" +
        "                swap(parent, i);\n" +
        "                i = parent;\n" +
        "            }\n" +
        "        }\n" +
        "\n" +
        "        int pop() {\n" +
        "            int top = data[0];\n" +
        "            size--;\n" +
        "            data[0] = data[size];\n" +
        "            int i = 0;\n" +
        "            while (true) {\n" +
        "                int left = 2 * i + 1;\n" +
        "                int right = 2 * i + 2;\n" +
        "                int smallest = i;\n" +
        "                if (left < size && data[left] < data[smallest]) smallest = left;\n" +
        "                if (right < size && data[right] < data[smallest]) smallest = right;\n" +
        "                if (smallest == i) break;\n" +
        "                swap(i, smallest);\n" +
        "                i = smallest;\n" +
        "            }\n" +
        "            return top;\n" +
        "        }\n" +
        "\n" +
        "        void swap(int a, int b) {\n" +
        "            int t = data[a];\n" +
        "            data[a] = data[b];\n" +
        "            data[b] = t;\n" +
        "        }\n" +
        "\n" +
        "        void grow() {\n" +
        "            int[] bigger = new int[data.length * 2];\n" +
        "            System.arraycopy(data, 0, bigger, 0, data.length);\n" +
        "            data = bigger;\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    static int[] kLargest(int[] nums, int k) {\n" +
        "        PriorityQueue<Integer> minHeap = new PriorityQueue<>(); // min-heap by default\n" +
        "        for (int n : nums) {\n" +
        "            minHeap.offer(n);\n" +
        "            if (minHeap.size() > k) {\n" +
        "                minHeap.poll();\n" +
        "            }\n" +
        "        }\n" +
        "        int[] result = new int[k];\n" +
        "        for (int i = 0; i < k; i++) {\n" +
        "            result[i] = minHeap.poll();\n" +
        "        }\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        MinHeap heap = new MinHeap();\n" +
        "        int[] values = {5, 3, 8, 1, 9, 2};\n" +
        "        for (int v : values) heap.push(v);\n" +
        "        StringBuilder sb = new StringBuilder();\n" +
        '        while (heap.size > 0) sb.append(heap.pop()).append(" ");\n' +
        '        System.out.println("MinHeap pop order: " + sb.toString().trim());\n' +
        "\n" +
        "        int[] nums = {3, 1, 5, 12, 2, 11};\n" +
        "        int[] largest3 = kLargest(nums, 3);\n" +
        "        StringBuilder sb2 = new StringBuilder();\n" +
        '        for (int v : largest3) sb2.append(v).append(" ");\n' +
        '        System.out.println("3 largest, ascending: " + sb2.toString().trim());\n' +
        "    }\n" +
        "}\n",
      output: "MinHeap pop order: 1 2 3 5 8 9\n3 largest, ascending: 5 11 12",
      python:
        "import heapq\n" +
        "\n" +
        "\n" +
        "class MinHeap:\n" +
        "    def __init__(self):\n" +
        "        # No manual grow() needed here -- a Python list already grows on its own, unlike\n" +
        "        # the fixed-size array Java's version starts from.\n" +
        "        self.data = []\n" +
        "\n" +
        "    def push(self, val):\n" +
        "        self.data.append(val)\n" +
        "        i = len(self.data) - 1\n" +
        "        while i > 0:\n" +
        "            parent = (i - 1) // 2\n" +
        "            if self.data[parent] <= self.data[i]:\n" +
        "                break\n" +
        "            self.data[parent], self.data[i] = self.data[i], self.data[parent]\n" +
        "            i = parent\n" +
        "\n" +
        "    def pop(self):\n" +
        "        top = self.data[0]\n" +
        "        last = self.data.pop()\n" +
        "        if self.data:\n" +
        "            self.data[0] = last\n" +
        "            i = 0\n" +
        "            n = len(self.data)\n" +
        "            while True:\n" +
        "                left, right = 2 * i + 1, 2 * i + 2\n" +
        "                smallest = i\n" +
        "                if left < n and self.data[left] < self.data[smallest]:\n" +
        "                    smallest = left\n" +
        "                if right < n and self.data[right] < self.data[smallest]:\n" +
        "                    smallest = right\n" +
        "                if smallest == i:\n" +
        "                    break\n" +
        "                self.data[i], self.data[smallest] = self.data[smallest], self.data[i]\n" +
        "                i = smallest\n" +
        "        return top\n" +
        "\n" +
        "    def size(self):\n" +
        "        return len(self.data)\n" +
        "\n" +
        "\n" +
        "def k_largest(nums, k):\n" +
        "    # Python's own binary heap, heapq, works directly on a plain list of values -- no\n" +
        "    # wrapper object like Java's PriorityQueue -- and is a min-heap by default, same as\n" +
        "    # PriorityQueue's natural ordering.\n" +
        "    min_heap = []\n" +
        "    for n in nums:\n" +
        "        heapq.heappush(min_heap, n)\n" +
        "        if len(min_heap) > k:\n" +
        "            heapq.heappop(min_heap)\n" +
        "    return [heapq.heappop(min_heap) for _ in range(k)]\n" +
        "\n" +
        "\n" +
        "heap = MinHeap()\n" +
        "values = [5, 3, 8, 1, 9, 2]\n" +
        "for v in values:\n" +
        "    heap.push(v)\n" +
        "order = []\n" +
        "while heap.size() > 0:\n" +
        "    order.append(heap.pop())\n" +
        'print("MinHeap pop order:", " ".join(str(v) for v in order))\n' +
        "\n" +
        "nums = [3, 1, 5, 12, 2, 11]\n" +
        "largest3 = k_largest(nums, 3)\n" +
        'print("3 largest, ascending:", " ".join(str(v) for v in largest3))\n',
      pythonOutput: "MinHeap pop order: 1 2 3 5 8 9\n3 largest, ascending: 5 11 12",
    },
    {
      kind: "viz",
      title: "push(1) onto a heap already holding [3, 5, 8] (indices 0, 1, 2) — sift up",
      caption: "The new value starts at the next free leaf and swaps upward with its parent one level at a time, stopping the moment its parent is no longer bigger.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 3 }, { value: 5 }, { value: 8 }, { value: 1, state: "active", pointers: ["i"] }],
            note: "data = [3, 5, 8, ...], size=3. Place 1 at index 3 (the next free slot): data = [3, 5, 8, 1]. size becomes 4.",
          },
          {
            cells: [{ value: 3 }, { value: 1, state: "swap" }, { value: 8 }, { value: 5, state: "swap" }],
            note:
              "i=3. parent = (3-1)/2 = 1, which holds 5. Is data[1]=5 <= data[3]=1? No — violates the heap " +
              "rule, so swap. data = [3, 1, 8, 5]. i becomes 1.",
          },
          {
            cells: [{ value: 1, state: "swap" }, { value: 3, state: "swap" }, { value: 8 }, { value: 5 }],
            note:
              "i=1. parent = (1-1)/2 = 0, which holds 3. Is data[0]=3 <= data[1]=1? No — swap again. " +
              "data = [1, 3, 8, 5]. i becomes 0.",
          },
          {
            cells: [{ value: 1, state: "done", pointers: ["i"] }, { value: 3 }, { value: 8 }, { value: 5 }],
            note:
              "i=0 has no parent (i > 0 is false), loop ends. The new smallest value, 1, has 'floated' all " +
              "the way to the root in exactly 2 swaps — one per level it needed to rise.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "That's the whole trick, in both directions. `push` (sift up) places the new value at the next open " +
        "leaf slot, then repeatedly swaps it with its parent while it's smaller than that parent — at most " +
        "once per level. `pop` (sift down) removes the root (always the minimum), moves the *last* element " +
        "into the root's spot to keep the tree complete, then repeatedly swaps it down into whichever child " +
        "is smaller, again at most once per level. Since the tree is always complete, its height is always " +
        "O(log n) for n elements — so both operations, bounded by one swap per level, are O(log n).",
    },
    {
      kind: "h", text: "Finding the k largest: keep the heap small, not the input" },
    {
      kind: "p",
      text:
        "`kLargest` shows the pattern's most common interview use: to track the k *largest* values seen so " +
        "far in a stream, keep a **min-heap of size k**. Every new value is offered in; if that pushes the " +
        "heap over size k, the *smallest* of the k current candidates — exactly what a min-heap exposes at " +
        "its root — is evicted. At the end, the heap holds precisely the k largest values seen, having never " +
        "needed to hold, or sort, the full input at once. This is why the heap type feels 'backwards' at " +
        "first: finding the *largest* values uses a *min*-heap, because the root is what you're willing to " +
        "throw away, not what you're looking for.",
    },
    {
      kind: "table",
      head: ["Operation", "Time", "Space", "Why"],
      rows: [
        [
          "push(val)",
          "{{O(log n)}}",
          "{{O(1)}} extra",
          "Sift up swaps the new value with its parent at most once per level; height is O(log n) for a " +
            "complete tree of n nodes.",
        ],
        [
          "pop() / peek min",
          "{{O(log n)}} / {{O(1)}}",
          "{{O(1)}} extra",
          "peek just reads the root directly; pop must sift the replacement root down, again at most once " +
            "per level.",
        ],
        [
          "Build a heap from n elements",
          "{{O(n)}}",
          "{{O(n)}}",
          "Bottom-up heapify does more work per node near the root but less near the leaves (where most " +
            "nodes are), which nets out to O(n) total, not O(n log n) as naive repeated inserts would.",
        ],
        [
          "kLargest(nums, k), n elements",
          "{{O(n log k)}}",
          "{{O(k)}}",
          "The heap never holds more than k elements, so every offer/evict pair costs O(log k), done up to " +
            "n times.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Assuming a heap is fully sorted — it isn't; only the path from root to any node is guaranteed " +
          "ordered. `data[1]` and `data[2]` (a node's two children) have no guaranteed order relative to " +
          "each other.",
        "Using a max-heap when the problem needs the k largest values tracked efficiently — a max-heap of " +
          "all n elements would need to hold everything; a *min*-heap capped at size k is the one that stays " +
          "small, because it's the smallest of the k candidates that gets evicted.",
        "Forgetting Java's `PriorityQueue` is a min-heap by default — `new PriorityQueue<>()` gives smallest- " +
          "first; for largest-first, pass `Collections.reverseOrder()` or a custom `Comparator`.",
        "Iterating a `PriorityQueue` directly (with a for-each loop) expecting sorted order — the internal " +
          "array is heap-ordered, not sorted; only repeated `poll()` calls return elements in sorted order.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A heap guarantees only parent ≤ both children (min-heap) — weaker than fully sorted, and that's " +
          "what makes push/pop O(log n) instead of O(n).",
        "Stored as an array: children of index i are at 2i+1 and 2i+2; parent is at (i-1)/2.",
        "push = sift up (bubble the new value toward the root); pop = sift down (bubble the replacement root " +
          "toward the leaves).",
        "'k largest' -> min-heap capped at size k; 'k smallest' -> max-heap capped at size k. The heap type " +
          "is what you evict, which is the opposite of what you're hunting for.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Find the kth largest element\" (in an array or a stream) is one of the most common heap questions " +
          "— and the min-heap-of-size-k trick above is the expected O(n log k) answer, not sorting the whole " +
          "array.",
        "\"Merge k sorted lists\" is a classic heap application: a heap of size k, holding the current front " +
          "of each list, always exposes the next smallest value across all lists in O(log k) per step.",
        "Dijkstra's shortest path (next module) uses a priority queue directly — always processing the " +
          "currently-closest unvisited node next is exactly what a min-heap is built to answer fast.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd find the median of a running stream of numbers using two " +
          "heaps (one max-heap for the smaller half, one min-heap for the larger half).",
        "Given k sorted arrays, describe how a min-heap of size k finds the overall smallest remaining " +
          "element across all arrays at each step, without merging them all into one array first.",
        "Explain, in words, why building a heap from n elements all at once (heapify) is O(n), while " +
          "inserting the same n elements one at a time is O(n log n) — what's different about the work done " +
          "near the leaves versus near the root?",
        "Describe how a max-heap could be used to repeatedly serve tasks by priority, where a higher number " +
          "means more urgent, and explain what changes compared to the min-heap code in this chapter.",
      ],
    },
    {
      kind: "quiz",
      question: "What does a min-heap actually guarantee about its structure?",
      options: [
        "Every element is fully sorted, left to right",
        "Every node's value is less than or equal to both of its children's values, with no guarantee " +
          "between siblings",
        "The heap is always a binary search tree",
        "Only the last element inserted can be removed",
      ],
      answer: 1,
      why:
        "The heap property is local to each parent-child relationship, not a global ordering — which is " +
        "exactly why push/pop only need to fix a single path of the tree, giving O(log n) instead of the " +
        "cost of a full sort.",
    },
    {
      kind: "quiz",
      question: "To efficiently track the k largest values seen in a stream, which structure should be used, and why?",
      options: [
        "A max-heap holding all elements seen so far",
        "A min-heap capped at size k, evicting the smallest of the k candidates whenever a new value pushes " +
          "the heap over size k",
        "A sorted array, re-sorted after every new value",
        "A plain queue in arrival order",
      ],
      answer: 1,
      why:
        "The heap only ever needs to hold the k best candidates; a min-heap's root is always the weakest of " +
        "those k, which is exactly the one that should be evicted when a stronger candidate arrives.",
    },
    {
      kind: "quiz",
      question: "In an array-backed heap with the root at index 0, where are the two children of the node at index i?",
      options: ["i-1 and i+1 (the neighbours)", "2i and 2i+1", "2i+1 and 2i+2", "i/2 and i*2 (halved and doubled)"],
      answer: 2,
      why:
        "With the root at index 0, the complete-binary-tree packing places a node's children at 2i+1 and " +
        "2i+2, and its parent at " +
        "(i-1)/2 (integer division) — the formulas push() and pop() both rely on directly.",
    },
  ],
};
