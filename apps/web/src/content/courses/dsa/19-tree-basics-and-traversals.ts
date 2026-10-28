import type { Chapter } from "@/content/courses/types";

export const chapterTreeBasicsAndTraversals: Chapter = {
  slug: "tree-basics-and-traversals",
  title: "Tree Basics and Traversals",
  summary:
    "A tree is a linked list that's allowed to branch — and the order you visit its nodes in (preorder, " +
    "inorder, postorder, level order) isn't a style choice, it changes what the visit order tells you.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "A **tree** is a linked structure like the one from two chapters ago, except a node may point to " +
        "*more than one* next node. Start from a single **root** node; every node below it is a **child**; " +
        "a node with no children is a **leaf**. This course focuses on the **binary tree**, where every node " +
        "has at most two children, conventionally called `left` and `right`. Trees show up constantly in real " +
        "systems — a file system's folders, an HTML document's element nesting, a company's org chart — and " +
        "in interviews, because a huge fraction of tree problems reduce to 'visit every node exactly once, in " +
        "the right order for the question being asked.'",
    },
    { kind: "h", text: "The family tree / org chart analogy" },
    {
      kind: "analogy",
      title: "A company org chart",
      text:
        "Picture a company org chart: the CEO at the top (the root), each manager with direct reports below " +
        "them (children), and individual contributors with nobody reporting to them (leaves). Reading the " +
        "chart top-down, left-to-right — CEO, then their reports, then those reports' reports — is level " +
        "order. Announcing a reorg starting with each manager *before* announcing their team's changes is " +
        "preorder. Finishing every team's changes *before* announcing anything about their manager (so a " +
        "department's work wraps up before its head reports upward) is postorder. Where the analogy stops: an " +
        "org chart's shape is fixed by the business; a binary tree's shape, and specifically whether left " +
        "always means 'smaller' — the binary search tree, next chapter — is a property some trees have and " +
        "others don't.",
    },
    { kind: "h", text: "Three ways to walk a tree depth-first" },
    {
      kind: "code",
      caption:
        "A binary tree of ints, and the four standard traversal orders: preorder, inorder, postorder (all " +
        "depth-first, via recursion) and level order (breadth-first, via a queue).",
      code:
        "import java.util.ArrayDeque;\n" +
        "import java.util.ArrayList;\n" +
        "import java.util.List;\n" +
        "import java.util.Queue;\n" +
        "\n" +
        "public class TreeTraversals {\n" +
        "    static class Node {\n" +
        "        int val;\n" +
        "        Node left, right;\n" +
        "        Node(int val) { this.val = val; }\n" +
        "    }\n" +
        "\n" +
        "    static void preorder(Node node, List<Integer> out) {\n" +
        "        if (node == null) return;\n" +
        "        out.add(node.val);\n" +
        "        preorder(node.left, out);\n" +
        "        preorder(node.right, out);\n" +
        "    }\n" +
        "\n" +
        "    static void inorder(Node node, List<Integer> out) {\n" +
        "        if (node == null) return;\n" +
        "        inorder(node.left, out);\n" +
        "        out.add(node.val);\n" +
        "        inorder(node.right, out);\n" +
        "    }\n" +
        "\n" +
        "    static void postorder(Node node, List<Integer> out) {\n" +
        "        if (node == null) return;\n" +
        "        postorder(node.left, out);\n" +
        "        postorder(node.right, out);\n" +
        "        out.add(node.val);\n" +
        "    }\n" +
        "\n" +
        "    static List<Integer> levelOrder(Node root) {\n" +
        "        List<Integer> out = new ArrayList<>();\n" +
        "        if (root == null) return out;\n" +
        "        Queue<Node> queue = new ArrayDeque<>();\n" +
        "        queue.offer(root);\n" +
        "        while (!queue.isEmpty()) {\n" +
        "            Node curr = queue.poll();\n" +
        "            out.add(curr.val);\n" +
        "            if (curr.left != null) queue.offer(curr.left);\n" +
        "            if (curr.right != null) queue.offer(curr.right);\n" +
        "        }\n" +
        "        return out;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        //         4\n" +
        "        //       /   \\\n" +
        "        //      2     6\n" +
        "        //     / \\   / \\\n" +
        "        //    1   3 5   7\n" +
        "        Node root = new Node(4);\n" +
        "        root.left = new Node(2);\n" +
        "        root.right = new Node(6);\n" +
        "        root.left.left = new Node(1);\n" +
        "        root.left.right = new Node(3);\n" +
        "        root.right.left = new Node(5);\n" +
        "        root.right.right = new Node(7);\n" +
        "\n" +
        "        List<Integer> pre = new ArrayList<>();\n" +
        "        preorder(root, pre);\n" +
        '        System.out.println("preorder: " + pre);\n' +
        "\n" +
        "        List<Integer> in = new ArrayList<>();\n" +
        "        inorder(root, in);\n" +
        '        System.out.println("inorder: " + in);\n' +
        "\n" +
        "        List<Integer> post = new ArrayList<>();\n" +
        "        postorder(root, post);\n" +
        '        System.out.println("postorder: " + post);\n' +
        "\n" +
        '        System.out.println("levelOrder: " + levelOrder(root));\n' +
        "    }\n" +
        "}\n",
      output:
        "preorder: [4, 2, 1, 3, 6, 5, 7]\ninorder: [1, 2, 3, 4, 5, 6, 7]\npostorder: [1, 3, 2, 5, 7, 6, 4]\n" +
        "levelOrder: [4, 2, 6, 1, 3, 5, 7]",
      python:
        "from collections import deque\n" +
        "\n" +
        "\n" +
        "class Node:\n" +
        "    def __init__(self, val):\n" +
        "        self.val = val\n" +
        "        self.left = None\n" +
        "        self.right = None\n" +
        "\n" +
        "\n" +
        "def preorder(node, out):\n" +
        "    if node is None:\n" +
        "        return\n" +
        "    out.append(node.val)\n" +
        "    preorder(node.left, out)\n" +
        "    preorder(node.right, out)\n" +
        "\n" +
        "\n" +
        "def inorder(node, out):\n" +
        "    if node is None:\n" +
        "        return\n" +
        "    inorder(node.left, out)\n" +
        "    out.append(node.val)\n" +
        "    inorder(node.right, out)\n" +
        "\n" +
        "\n" +
        "def postorder(node, out):\n" +
        "    if node is None:\n" +
        "        return\n" +
        "    postorder(node.left, out)\n" +
        "    postorder(node.right, out)\n" +
        "    out.append(node.val)\n" +
        "\n" +
        "\n" +
        "def level_order(root):\n" +
        "    out = []\n" +
        "    if root is None:\n" +
        "        return out\n" +
        "    queue = deque([root])\n" +
        "    while queue:\n" +
        "        curr = queue.popleft()\n" +
        "        out.append(curr.val)\n" +
        "        if curr.left is not None:\n" +
        "            queue.append(curr.left)\n" +
        "        if curr.right is not None:\n" +
        "            queue.append(curr.right)\n" +
        "    return out\n" +
        "\n" +
        "\n" +
        "#         4\n" +
        "#       /   \\\n" +
        "#      2     6\n" +
        "#     / \\   / \\\n" +
        "#    1   3 5   7\n" +
        "root = Node(4)\n" +
        "root.left = Node(2)\n" +
        "root.right = Node(6)\n" +
        "root.left.left = Node(1)\n" +
        "root.left.right = Node(3)\n" +
        "root.right.left = Node(5)\n" +
        "root.right.right = Node(7)\n" +
        "\n" +
        "pre = []\n" +
        "preorder(root, pre)\n" +
        'print("preorder:", pre)\n' +
        "\n" +
        "in_order = []\n" +
        "inorder(root, in_order)\n" +
        'print("inorder:", in_order)\n' +
        "\n" +
        "post = []\n" +
        "postorder(root, post)\n" +
        'print("postorder:", post)\n' +
        "\n" +
        'print("levelOrder:", level_order(root))\n',
      pythonOutput:
        "preorder: [4, 2, 1, 3, 6, 5, 7]\ninorder: [1, 2, 3, 4, 5, 6, 7]\npostorder: [1, 3, 2, 5, 7, 6, 4]\n" +
        "levelOrder: [4, 2, 6, 1, 3, 5, 7]",
    },
    {
      kind: "viz",
      title: "inorder() on the tree above — left, self, right at every node",
      caption: "'Visiting' means the call is entered; 'done' means the value has already been added to the output.",
      viz: {
        type: "tree",
        frames: [
          {
            rootId: "n4",
            nodes: [
              { id: "n4", value: 4, left: "n2", right: "n6", state: "visiting" },
              { id: "n2", value: 2, left: "n1", right: "n3" },
              { id: "n6", value: 6, left: "n5", right: "n7" },
              { id: "n1", value: 1, left: null, right: null },
              { id: "n3", value: 3, left: null, right: null },
              { id: "n5", value: 5, left: null, right: null },
              { id: "n7", value: 7, left: null, right: null },
            ],
            note: "inorder(4): first recurse left into inorder(2).",
          },
          {
            rootId: "n4",
            nodes: [
              { id: "n4", value: 4, left: "n2", right: "n6" },
              { id: "n2", value: 2, left: "n1", right: "n3", state: "visiting" },
              { id: "n6", value: 6, left: "n5", right: "n7" },
              { id: "n1", value: 1, left: null, right: null },
              { id: "n3", value: 3, left: null, right: null },
              { id: "n5", value: 5, left: null, right: null },
              { id: "n7", value: 7, left: null, right: null },
            ],
            note: "inorder(2): first recurse left into inorder(1).",
          },
          {
            rootId: "n4",
            nodes: [
              { id: "n4", value: 4, left: "n2", right: "n6" },
              { id: "n2", value: 2, left: "n1", right: "n3" },
              { id: "n6", value: 6, left: "n5", right: "n7" },
              { id: "n1", value: 1, left: null, right: null, state: "done" },
              { id: "n3", value: 3, left: null, right: null },
              { id: "n5", value: 5, left: null, right: null },
              { id: "n7", value: 7, left: null, right: null },
            ],
            note: "inorder(1): both children null, visit 1 -> add 1. Output so far: [1]. Return.",
          },
          {
            rootId: "n4",
            nodes: [
              { id: "n4", value: 4, left: "n2", right: "n6" },
              { id: "n2", value: 2, left: "n1", right: "n3", state: "done" },
              { id: "n6", value: 6, left: "n5", right: "n7" },
              { id: "n1", value: 1, left: null, right: null, state: "done" },
              { id: "n3", value: 3, left: null, right: null, state: "visiting" },
              { id: "n5", value: 5, left: null, right: null },
              { id: "n7", value: 7, left: null, right: null },
            ],
            note: "Back in inorder(2): visit 2 -> add 2 ([1, 2]), then recurse right into inorder(3).",
          },
          {
            rootId: "n4",
            nodes: [
              { id: "n4", value: 4, left: "n2", right: "n6" },
              { id: "n2", value: 2, left: "n1", right: "n3", state: "done" },
              { id: "n6", value: 6, left: "n5", right: "n7" },
              { id: "n1", value: 1, left: null, right: null, state: "done" },
              { id: "n3", value: 3, left: null, right: null, state: "done" },
              { id: "n5", value: 5, left: null, right: null },
              { id: "n7", value: 7, left: null, right: null },
            ],
            note: "inorder(3): both children null, visit 3 -> add 3. Output so far: [1, 2, 3]. Return.",
          },
          {
            rootId: "n4",
            nodes: [
              { id: "n4", value: 4, left: "n2", right: "n6", state: "done" },
              { id: "n2", value: 2, left: "n1", right: "n3", state: "done" },
              { id: "n6", value: 6, left: "n5", right: "n7", state: "visiting" },
              { id: "n1", value: 1, left: null, right: null, state: "done" },
              { id: "n3", value: 3, left: null, right: null, state: "done" },
              { id: "n5", value: 5, left: null, right: null },
              { id: "n7", value: 7, left: null, right: null },
            ],
            note: "Back in inorder(4): visit 4 -> add 4 ([1, 2, 3, 4]), then recurse right into inorder(6).",
          },
          {
            rootId: "n4",
            nodes: [
              { id: "n4", value: 4, left: "n2", right: "n6", state: "done" },
              { id: "n2", value: 2, left: "n1", right: "n3", state: "done" },
              { id: "n6", value: 6, left: "n5", right: "n7", state: "done" },
              { id: "n1", value: 1, left: null, right: null, state: "done" },
              { id: "n3", value: 3, left: null, right: null, state: "done" },
              { id: "n5", value: 5, left: null, right: null, state: "done" },
              { id: "n7", value: 7, left: null, right: null, state: "done" },
            ],
            note:
              "inorder(6) mirrors the left side: visits 5, then 6, then 7. Final output: [1, 2, 3, 4, 5, 6, 7] " +
              "— sorted order, because this tree happens to be a binary search tree.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The three depth-first orders differ only in *when* the current node is added relative to its " +
        "children, and that single difference changes what each is useful for. **Preorder** (self, left, " +
        "right) visits a node before its subtree, so it's the natural order for *copying* a tree or " +
        "serialising it — you need to write down a node before you can write down what's below it. " +
        "**Postorder** (left, right, self) visits a node after both subtrees are done, which is exactly right " +
        "for *deleting* a tree, or for any computation that needs a node's children's answers before it can " +
        "compute its own (like tree height, or evaluating an expression tree). **Inorder** (left, self, " +
        "right) is special specifically for binary search trees, covered next chapter: it visits every node " +
        "in ascending sorted order, which is not a coincidence but a direct consequence of what a BST's shape " +
        "guarantees.",
    },
    { kind: "h", text: "Level order: breadth instead of depth" },
    {
      kind: "p",
      text:
        "The three orders above all go as deep as possible before backtracking — that's what recursion, " +
        "riding the call stack, naturally does. **Level order** visits the tree row by row instead, which " +
        "needs a **queue**, not recursion: a node is only added to the queue after every node at a shallower " +
        "level has already been dequeued, so FIFO order on the queue exactly matches level order on the tree. " +
        "This is the tree-shaped instance of breadth-first search, generalised to graphs in the next module.",
    },
    {
      kind: "table",
      head: ["Traversal", "Order", "Time", "Space", "Why used for"],
      rows: [
        [
          "Preorder",
          "self, left, right",
          "O(n)",
          "O(h)",
          "Visits a node before its subtree — natural for copying or serialising a tree. Space is the " +
            "recursion depth, h (tree height).",
        ],
        [
          "Inorder",
          "left, self, right",
          "O(n)",
          "O(h)",
          "Visits a binary search tree's nodes in ascending sorted order, a direct consequence of BST " +
            "structure (next chapter).",
        ],
        [
          "Postorder",
          "left, right, self",
          "O(n)",
          "O(h)",
          "Visits a node after both children are done — needed when a node's computation depends on its " +
            "children's results first, or for safe deletion.",
        ],
        [
          "Level order",
          "row by row",
          "O(n)",
          "O(w)",
          "Uses a queue instead of recursion; space is the widest single level, w, which can be up to n/2 " +
            "for a full tree's bottom row.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting the null check at the top of a recursive traversal — every recursive tree function needs " +
          "a base case for 'this node doesn't exist', or it throws a NullPointerException the first time it " +
          "walks off a leaf.",
        "Mixing up which traversal to reach for — reaching for preorder when the problem needs children's " +
          "results computed first (that's postorder), or expecting inorder to give sorted order on a tree " +
          "that isn't actually a binary search tree (inorder just gives left-self-right; it's only sorted " +
          "*because* of the BST ordering property).",
        "Using recursion (implicitly, the call stack) when the tree might be very deep and unbalanced — a " +
          "genuinely skewed tree (effectively a linked list) can overflow the call stack; level order's " +
          "explicit queue doesn't have that risk since it never recurses.",
        "Confusing tree height with node count in complexity — traversal time is always O(n) (every node " +
          "visited once), but the *extra space* for recursion is O(h), the height, which is O(log n) for a " +
          "balanced tree but O(n) for a skewed one.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A tree is a linked structure allowed to branch; a binary tree branches into at most left and right.",
        "Preorder = self first (copy/serialise); inorder = sorted order on a BST; postorder = children before " +
          "self (safe deletion, bottom-up computation).",
        "Level order needs a queue, not recursion — FIFO order on the queue matches level order on the tree.",
        "All four traversals are O(n) time; recursive ones cost O(h) extra space for the call stack, where h " +
          "is the tree's height.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Traverse this tree and print X\" is rarely the whole question — the real test is picking the " +
          "*right* traversal for what X needs, and being able to justify why in one sentence.",
        "\"Serialize and deserialize a binary tree\" is a very common question built directly on preorder " +
          "traversal, using null markers to record where each subtree ends.",
        "Computing a tree's height, checking if it's balanced, or checking if two trees are identical are all " +
          "classic postorder-shaped problems — a node's answer depends on its children's answers first.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does inorder traversal visit a binary search tree's nodes in ascending sorted order?",
      options: [
        "Java automatically sorts the nodes into ascending order as the traversal reads them out of the tree, whatever shape the tree has.",
        "Inorder visits the left subtree (smaller values), then the node, then the right subtree (larger values), at every node.",
        "It's a coincidence specific to the example tree in this chapter, and trees with other shapes would not come out sorted.",
        "Inorder works only on trees whose values were already sorted before they were inserted, which is why the output looks ordered.",
      ],
      answer: 1,
      why:
        "A BST's defining rule is that every left subtree holds smaller values and every right subtree " +
        "holds larger ones; inorder's left-self-right order directly mirrors that rule at every node, " +
        "recursively, producing sorted output.",
    },
    {
      kind: "quiz",
      question: "Which traversal visits a node only after both of its children have already been visited?",
      options: ["Preorder", "Inorder", "Postorder", "Level order"],
      answer: 2,
      why:
        "Postorder is left, right, self — the node itself is added to the output only after its entire " +
        "left and right subtrees are already done, which is why it's used for bottom-up computations like " +
        "tree height.",
    },
    {
      kind: "quiz",
      question: "Why does level order traversal require a queue rather than recursion?",
      options: [
        "It's just a stylistic preference: recursion would visit the nodes in exactly the same row-by-row order.",
        "A queue gives the first-discovered-first-processed order that level order needs; recursion goes deep first.",
        "Queues are always faster than recursive calls in Java, so the queue is chosen purely for speed.",
        "Recursion cannot visit tree nodes at all, since method calls cannot follow the left and right links of a node.",
      ],
      answer: 1,
      why:
        "Recursion follows the call stack (LIFO), naturally diving deep before backtracking. Level order " +
        "needs strict row-by-row, left-to-right order, which is exactly what enqueueing children and " +
        "dequeueing in arrival order (FIFO) guarantees.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd compute the height of a binary tree using postorder logic — " +
          "what does each node need from its children before it can answer for itself?",
        "Explain how level order traversal could be adapted to print the tree level by level, on separate " +
          "lines, rather than as one flat list — what extra bookkeeping does the queue need?",
        "Given two binary trees, describe how you'd check whether they're structurally identical with the " +
          "same values, using any traversal you choose, and explain your choice.",
        "Describe, in words, how you would find the diameter of a binary tree (the longest path between any " +
          "two nodes, not necessarily through the root) using a postorder-style computation.",
      ],
    },
  ],
};
