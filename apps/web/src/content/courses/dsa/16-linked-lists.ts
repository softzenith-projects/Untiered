import type { Chapter } from "@/content/courses/types";

export const chapterLinkedLists: Chapter = {
  slug: "linked-lists",
  title: "Linked Lists",
  summary:
    "Nodes scattered in memory, connected only by an address each one holds — reversing one is about " +
    "redirecting arrows, and finding a cycle is about a fast walker lapping a slow one.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Every array you've used so far lives in one unbroken block of memory — element 5 is always right " +
        "after element 4. A **linked list** gives that up entirely. Each piece of data (a **node**) sits " +
        "wherever the JVM happens to put it, and the only thing connecting node to node is a **reference** " +
        "— literally, the address of the next node, stored inside the current one. Follow that reference and " +
        "you're at the next node; follow its reference and you're at the one after. There is no numbered " +
        "seat 5 you can jump to directly. To reach the fifth node, you must have already visited the first " +
        "four.",
    },
    { kind: "h", text: "The treasure-hunt analogy" },
    {
      kind: "analogy",
      title: "A treasure hunt where each clue names the next hiding spot",
      text:
        "A linked list is a treasure hunt: clue 1 is in your hand, and reading it tells you where clue 2 is " +
        "hidden — not clue 2's contents, just its location. You cannot skip to clue 4 without having read " +
        "clues 1 through 3 first, because nothing tells you where clue 4 is until clue 3 does. The hunt ends " +
        "when a clue says 'nothing follows' — that's the `null` at the tail. Reversing the hunt means " +
        "rewriting every clue so it now points *backward* to the one before it, so that what used to be the " +
        "finish becomes the new start. Where the analogy stops: a real treasure hunt has one hider planning " +
        "everything in advance; a linked list's nodes can be created and re-linked freely, one pointer " +
        "change at a time, which is exactly what makes insertion and deletion in the middle of a linked list " +
        "O(1) once you're standing at the right node — no shifting every later element the way an array " +
        "insert would need.",
    },
    { kind: "h", text: "Reversing a list: redirecting every arrow" },
    {
      kind: "code",
      caption:
        "A singly linked list of int nodes: build one from an array, reverse it in place, and detect " +
        "whether a list has a cycle (a node whose next eventually loops back to an earlier node).",
      code:
        "public class LinkedListOps {\n" +
        "    static class Node {\n" +
        "        int val;\n" +
        "        Node next;\n" +
        "        Node(int val) { this.val = val; }\n" +
        "    }\n" +
        "\n" +
        "    static Node fromArray(int[] values) {\n" +
        "        Node dummy = new Node(0);\n" +
        "        Node tail = dummy;\n" +
        "        for (int v : values) {\n" +
        "            tail.next = new Node(v);\n" +
        "            tail = tail.next;\n" +
        "        }\n" +
        "        return dummy.next;\n" +
        "    }\n" +
        "\n" +
        "    static String toStringList(Node head) {\n" +
        "        StringBuilder sb = new StringBuilder();\n" +
        "        while (head != null) {\n" +
        '            sb.append(head.val);\n' +
        '            if (head.next != null) sb.append(" -> ");\n' +
        "            head = head.next;\n" +
        "        }\n" +
        "        return sb.toString();\n" +
        "    }\n" +
        "\n" +
        "    static Node reverse(Node head) {\n" +
        "        Node prev = null;\n" +
        "        Node curr = head;\n" +
        "        while (curr != null) {\n" +
        "            Node next = curr.next;\n" +
        "            curr.next = prev;\n" +
        "            prev = curr;\n" +
        "            curr = next;\n" +
        "        }\n" +
        "        return prev;\n" +
        "    }\n" +
        "\n" +
        "    static boolean hasCycle(Node head) {\n" +
        "        Node slow = head;\n" +
        "        Node fast = head;\n" +
        "        while (fast != null && fast.next != null) {\n" +
        "            slow = slow.next;\n" +
        "            fast = fast.next.next;\n" +
        "            if (slow == fast) {\n" +
        "                return true;\n" +
        "            }\n" +
        "        }\n" +
        "        return false;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        Node list = fromArray(new int[]{1, 2, 3, 4, 5});\n" +
        '        System.out.println("original: " + toStringList(list));\n' +
        "        Node reversed = reverse(list);\n" +
        '        System.out.println("reversed: " + toStringList(reversed));\n' +
        "\n" +
        "        Node a = new Node(10);\n" +
        "        Node b = new Node(20);\n" +
        "        Node c = new Node(30);\n" +
        "        a.next = b;\n" +
        "        b.next = c;\n" +
        "        c.next = a; // cycle back to a\n" +
        '        System.out.println("has cycle: " + hasCycle(a));\n' +
        "\n" +
        "        Node noCycle = fromArray(new int[]{1, 2, 3});\n" +
        '        System.out.println("has cycle: " + hasCycle(noCycle));\n' +
        "    }\n" +
        "}\n",
      output: "original: 1 -> 2 -> 3 -> 4 -> 5\nreversed: 5 -> 4 -> 3 -> 2 -> 1\nhas cycle: true\nhas cycle: false",
      python:
        "class Node:\n" +
        "    def __init__(self, val):\n" +
        "        self.val = val\n" +
        "        self.next = None\n" +
        "\n" +
        "\n" +
        "def from_array(values):\n" +
        "    dummy = Node(0)\n" +
        "    tail = dummy\n" +
        "    for v in values:\n" +
        "        tail.next = Node(v)\n" +
        "        tail = tail.next\n" +
        "    return dummy.next\n" +
        "\n" +
        "\n" +
        "def to_string_list(head):\n" +
        "    parts = []\n" +
        "    while head is not None:\n" +
        "        parts.append(str(head.val))\n" +
        "        head = head.next\n" +
        '    return " -> ".join(parts)\n' +
        "\n" +
        "\n" +
        "def reverse(head):\n" +
        "    prev = None\n" +
        "    curr = head\n" +
        "    while curr is not None:\n" +
        "        next_node = curr.next\n" +
        "        curr.next = prev\n" +
        "        prev = curr\n" +
        "        curr = next_node\n" +
        "    return prev\n" +
        "\n" +
        "\n" +
        "def has_cycle(head):\n" +
        "    slow = fast = head\n" +
        "    while fast is not None and fast.next is not None:\n" +
        "        slow = slow.next\n" +
        "        fast = fast.next.next\n" +
        "        if slow is fast:\n" +
        "            return True\n" +
        "    return False\n" +
        "\n" +
        "\n" +
        "lst = from_array([1, 2, 3, 4, 5])\n" +
        'print("original:", to_string_list(lst))\n' +
        "reversed_list = reverse(lst)\n" +
        'print("reversed:", to_string_list(reversed_list))\n' +
        "\n" +
        "a = Node(10)\n" +
        "b = Node(20)\n" +
        "c = Node(30)\n" +
        "a.next = b\n" +
        "b.next = c\n" +
        "c.next = a  # cycle back to a\n" +
        'print("has cycle:", has_cycle(a))\n' +
        "\n" +
        "no_cycle = from_array([1, 2, 3])\n" +
        'print("has cycle:", has_cycle(no_cycle))\n',
      pythonOutput: "original: 1 -> 2 -> 3 -> 4 -> 5\nreversed: 5 -> 4 -> 3 -> 2 -> 1\nhas cycle: True\nhas cycle: False",
    },
    {
      kind: "viz",
      title: "reverse() on 1 -> 2 -> 3 -> null",
      caption: "Each node's single arrow flips exactly once, from pointing forward to pointing back.",
      viz: {
        type: "list",
        frames: [
          {
            nodes: [
              { id: "n1", value: 1, next: "n2", pointers: ["curr"] },
              { id: "n2", value: 2, next: "n3" },
              { id: "n3", value: 3, next: null },
            ],
            note: "prev=null, curr=1. next=2. About to flip node 1's arrow to point at prev (null).",
          },
          {
            nodes: [
              { id: "n1", value: 1, next: null, pointers: ["prev"] },
              { id: "n2", value: 2, next: "n3", pointers: ["curr"] },
              { id: "n3", value: 3, next: null },
            ],
            note: "curr(1).next = prev(null), so node 1 now points to null. prev=1, curr=2.",
          },
          {
            nodes: [
              { id: "n1", value: 1, next: null },
              { id: "n2", value: 2, next: "n1", pointers: ["prev"] },
              { id: "n3", value: 3, next: null, pointers: ["curr"] },
            ],
            note: "curr(2).next = prev(1), so node 2 now points to 1. prev=2, curr=3.",
          },
          {
            nodes: [
              { id: "n1", value: 1, next: null },
              { id: "n2", value: 2, next: "n1" },
              { id: "n3", value: 3, next: "n2", pointers: ["prev"] },
            ],
            note:
              "curr(3).next = prev(2), so node 3 now points to 2. curr becomes null, the loop ends — prev " +
              "(node 3) is the new head. List is now 3 -> 2 -> 1 -> null.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The three-variable pattern (`prev`, `curr`, `next`) is the whole trick: before you overwrite " +
        "`curr.next`, you must save where it currently points (`next`), or you lose the rest of the list " +
        "forever — that's the single most common bug beginners write into a reversal. Each node's arrow " +
        "flips exactly once, so the loop runs n times for an n-node list: O(n) time, and O(1) extra space, " +
        "since only three references are ever held, regardless of how long the list is.",
    },
    { kind: "h", text: "Cycle detection: the fast and slow walker" },
    {
      kind: "p",
      text:
        "`hasCycle` uses the same-direction two-pointer variant mentioned earlier in this course: a " +
        "**slow** pointer moving one node at a time, and a **fast** pointer moving two. If the list ends in " +
        "`null`, `fast` gets there first and the loop stops cleanly. But if the list loops back on itself, " +
        "there is no `null` to reach — `fast` keeps circling and, because it gains one extra step on `slow` " +
        "every iteration, it is guaranteed to eventually land on the exact same node as `slow` at the same " +
        "moment. Think of two runners on a circular track, one twice as fast as the other: the faster one " +
        "necessarily laps the slower one and they meet again, no matter where either started. That meeting " +
        "is the proof of a cycle.",
    },
    {
      kind: "table",
      head: ["Operation", "Time", "Space", "Why"],
      rows: [
        [
          "reverse(head)",
          "O(n)",
          "O(1)",
          "Visits each node exactly once, redirecting its single pointer; only three references are held " +
            "at a time.",
        ],
        [
          "hasCycle(head)",
          "O(n)",
          "O(1)",
          "Fast gains one node on slow per step, so on a cycle of length k they meet within k steps; on a " +
            "null-terminated list, fast reaches null within n/2 steps.",
        ],
        [
          "Access by index (for contrast with an array)",
          "O(n)",
          "O(1)",
          "There's no numbered seat to jump to — reaching node i means following i references from the " +
            "head, one at a time.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Overwriting `curr.next` before saving it — without `next = curr.next` first, the rest of the " +
          "original list becomes unreachable the instant you reassign `curr.next = prev`.",
        "Returning `head` instead of `prev` after the reverse loop — by the time the loop ends, `head` " +
          "still refers to the *old* first node, which is now the new *last* node; `prev` holds the new head.",
        "Checking only `fast != null` in the cycle loop, not `fast.next != null` too — `fast.next.next` " +
          "throws a `NullPointerException` the moment `fast.next` is null, on any list of even length that " +
          "actually terminates.",
        "Assuming a linked list has random access like an array — asking for 'the 10th element' still costs " +
          "O(n), not O(1); the only thing O(1) about a linked list is *inserting or removing next to a node " +
          "you're already holding*.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A linked list trades an array's O(1) index access for O(1) insert/delete next to a node you already " +
          "hold — the two are structurally opposite trade-offs.",
        "Reversing: save `next` before you overwrite `curr.next`, walk `prev`/`curr`/`next` forward, return " +
          "`prev` as the new head.",
        "Cycle detection: a fast pointer moving 2x a slow pointer must eventually meet it if — and only if " +
          "— there's a cycle, like a faster runner lapping a slower one on a loop.",
        "Both classic techniques run in O(1) extra space by holding only a handful of references, never a " +
          "second copy of the list.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Reversing a linked list (iteratively, in O(1) space) is asked often enough that it's worth being " +
          "able to write it without hesitation — interviewers also ask for the recursive version as a " +
          "follow-up, to check you understand what each stack frame does.",
        "\"Detect if a linked list has a cycle\" — and its follow-up, \"find where the cycle begins\" — is a " +
          "standard test of the fast/slow pointer pattern (Floyd's algorithm); knowing *why* the meeting is " +
          "guaranteed is what separates a memorised answer from an understood one.",
        "A common trap question: 'find the middle of a linked list in one pass.' The same fast/slow pair " +
          "solves it — when fast reaches the end, slow is at the middle — without first counting the length.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how to find the middle node of a linked list in a single pass using " +
          "fast and slow pointers, without first counting how many nodes there are.",
        "Given two singly linked lists that eventually merge into the same tail (like a Y shape), describe an " +
          "approach to find the node where they merge, using O(1) extra space.",
        "Explain how you would remove the nth node from the end of a linked list in one pass, without " +
          "knowing the list's length in advance.",
        "Describe how merging two already-sorted linked lists into one sorted list works, and why it needs " +
          "no extra array to hold the result.",
      ],
    },
    {
      kind: "quiz",
      question: "In the iterative reverse(), why must `next` be saved before `curr.next` is reassigned?",
      options: [
        "It isn't necessary, because Java preserves the old value of curr.next automatically somewhere",
        "Once curr.next is overwritten to point at prev, the rest of the list is unreachable unless its address was saved",
        "To make the loop run faster, since reading next once avoids repeated pointer lookups",
        "Because next is used only for printing the list afterwards, not for the correctness of the loop",
      ],
      answer: 1,
      why:
        "curr.next is the only reference to the remainder of the original list. Overwriting it before " +
        "saving that address permanently loses access to every node after curr.",
    },
    {
      kind: "quiz",
      question: "Why does a fast pointer moving two steps per iteration always meet a slow pointer (one step) if a cycle exists?",
      options: [
        "It doesn't always meet: whether the pointers meet depends on which node of the cycle they each start from.",
        "Fast pointers in Java automatically detect cycles, and report one by stopping as soon as they pass the head.",
        "Fast gains one node on slow each iteration, so once both are in the cycle the gap shrinks to zero.",
        "The JVM throws an exception when a cycle is present, and the code catches it to report that a cycle exists.",
      ],
      answer: 2,
      why:
        "Once both pointers are on the cycle, the distance between them (mod cycle length) decreases by one " +
        "each iteration, so it is guaranteed to hit zero — a meeting — within at most one full lap.",
    },
    {
      kind: "quiz",
      question: "What is the time and space complexity of reversing an n-node singly linked list iteratively?",
      options: [
        "O(n) time, O(n) space, since a whole new list has to be built from copies of the nodes",
        "O(n) time, O(1) space, since each node's pointer is redirected in place",
        "O(1) time, O(1) space, since only the head pointer needs to be changed",
        "O(n log n) time, O(1) space, since the nodes must be compared as they are redirected",
      ],
      answer: 1,
      why:
        "Each of the n nodes is visited exactly once to flip its pointer, and only three reference " +
        "variables (prev, curr, next) are held at any time — no second list is ever allocated.",
    },
  ],
};
