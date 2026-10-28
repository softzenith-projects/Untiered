import type { Chapter } from "@/content/courses/types";

export const chapterBinarySearchTrees: Chapter = {
  slug: "binary-search-trees",
  title: "Binary Search Trees",
  summary:
    "A tree with one extra rule at every node — smaller goes left, bigger goes right — turns search, " +
    "insert, and delete into O(log n) operations, as long as the tree doesn't lean over.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "A **binary search tree** (BST) is a binary tree with exactly one added rule, applied at *every* " +
        "node: everything in a node's left subtree is smaller than that node, and everything in its right " +
        "subtree is bigger. That's the entire definition — but it's an unusually powerful one, because it " +
        "means each node acts like a signpost: comparing the value you're looking for against the current " +
        "node tells you, with certainty, which entire half of the remaining subtree you can ignore. That's " +
        "binary search (from module 4), except walking a tree of pointers instead of narrowing indices into " +
        "an array.",
    },
    { kind: "h", text: "The library shelf analogy" },
    {
      kind: "analogy",
      title: "A library's alphabetised shelf sections, nested",
      text:
        "Think of a library where the topmost sign says 'M–N here, A–L to the left, O–Z to the right.' Walk " +
        "left, and the next sign inside that section narrows further — say 'F–G here, A–E left, H–L right' " +
        "— and so on, each sign splitting what remains roughly in half. Looking for a book starting with " +
        "'C' means reading a handful of signs, each one eliminating half of what's left, rather than " +
        "scanning every shelf in the building. That's exactly what BST search does with numbers instead of " +
        "letters. Where the analogy stops: a well-run library keeps its sections evenly sized on purpose; a " +
        "BST built by inserting values in an already-sorted order gets no such guarantee — it can end up " +
        "leaning entirely to one side, as the pitfalls below make concrete.",
    },
    { kind: "h", text: "Insert, search, and delete — all one comparison at a time" },
    {
      kind: "code",
      caption:
        "A BST of ints: insert (recursively finding the right null spot), search, and the trickiest of the " +
        "three, delete — which has to handle a node with zero, one, or two children.",
      code:
        "public class BstOps {\n" +
        "    static class Node {\n" +
        "        int val;\n" +
        "        Node left, right;\n" +
        "        Node(int val) { this.val = val; }\n" +
        "    }\n" +
        "\n" +
        "    static Node insert(Node node, int val) {\n" +
        "        if (node == null) return new Node(val);\n" +
        "        if (val < node.val) {\n" +
        "            node.left = insert(node.left, val);\n" +
        "        } else if (val > node.val) {\n" +
        "            node.right = insert(node.right, val);\n" +
        "        }\n" +
        "        return node;\n" +
        "    }\n" +
        "\n" +
        "    static boolean search(Node node, int target) {\n" +
        "        if (node == null) return false;\n" +
        "        if (node.val == target) return true;\n" +
        "        return target < node.val ? search(node.left, target) : search(node.right, target);\n" +
        "    }\n" +
        "\n" +
        "    static Node delete(Node node, int val) {\n" +
        "        if (node == null) return null;\n" +
        "        if (val < node.val) {\n" +
        "            node.left = delete(node.left, val);\n" +
        "        } else if (val > node.val) {\n" +
        "            node.right = delete(node.right, val);\n" +
        "        } else {\n" +
        "            if (node.left == null) return node.right;\n" +
        "            if (node.right == null) return node.left;\n" +
        "            Node successor = node.right;\n" +
        "            while (successor.left != null) successor = successor.left;\n" +
        "            node.val = successor.val;\n" +
        "            node.right = delete(node.right, successor.val);\n" +
        "        }\n" +
        "        return node;\n" +
        "    }\n" +
        "\n" +
        "    static void inorder(Node node, StringBuilder sb) {\n" +
        "        if (node == null) return;\n" +
        "        inorder(node.left, sb);\n" +
        '        sb.append(node.val).append(" ");\n' +
        "        inorder(node.right, sb);\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        Node root = null;\n" +
        "        int[] values = {8, 3, 10, 1, 6, 14, 4, 7, 13};\n" +
        "        for (int v : values) {\n" +
        "            root = insert(root, v);\n" +
        "        }\n" +
        "        StringBuilder sb = new StringBuilder();\n" +
        "        inorder(root, sb);\n" +
        '        System.out.println("inorder after inserts: " + sb.toString().trim());\n' +
        "\n" +
        '        System.out.println("search(6): " + search(root, 6));\n' +
        '        System.out.println("search(11): " + search(root, 11));\n' +
        "\n" +
        "        root = delete(root, 3); // node with two children\n" +
        "        StringBuilder sb2 = new StringBuilder();\n" +
        "        inorder(root, sb2);\n" +
        '        System.out.println("inorder after delete(3): " + sb2.toString().trim());\n' +
        "    }\n" +
        "}\n",
      output:
        "inorder after inserts: 1 3 4 6 7 8 10 13 14\nsearch(6): true\nsearch(11): false\n" +
        "inorder after delete(3): 1 4 6 7 8 10 13 14",
      python:
        "class Node:\n" +
        "    def __init__(self, val):\n" +
        "        self.val = val\n" +
        "        self.left = None\n" +
        "        self.right = None\n" +
        "\n" +
        "\n" +
        "def insert(node, val):\n" +
        "    if node is None:\n" +
        "        return Node(val)\n" +
        "    if val < node.val:\n" +
        "        node.left = insert(node.left, val)\n" +
        "    elif val > node.val:\n" +
        "        node.right = insert(node.right, val)\n" +
        "    return node\n" +
        "\n" +
        "\n" +
        "def search(node, target):\n" +
        "    if node is None:\n" +
        "        return False\n" +
        "    if node.val == target:\n" +
        "        return True\n" +
        "    return search(node.left, target) if target < node.val else search(node.right, target)\n" +
        "\n" +
        "\n" +
        "def delete(node, val):\n" +
        "    if node is None:\n" +
        "        return None\n" +
        "    if val < node.val:\n" +
        "        node.left = delete(node.left, val)\n" +
        "    elif val > node.val:\n" +
        "        node.right = delete(node.right, val)\n" +
        "    else:\n" +
        "        if node.left is None:\n" +
        "            return node.right\n" +
        "        if node.right is None:\n" +
        "            return node.left\n" +
        "        successor = node.right\n" +
        "        while successor.left is not None:\n" +
        "            successor = successor.left\n" +
        "        node.val = successor.val\n" +
        "        node.right = delete(node.right, successor.val)\n" +
        "    return node\n" +
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
        "root = None\n" +
        "values = [8, 3, 10, 1, 6, 14, 4, 7, 13]\n" +
        "for v in values:\n" +
        "    root = insert(root, v)\n" +
        "\n" +
        "out = []\n" +
        "inorder(root, out)\n" +
        'print("inorder after inserts:", " ".join(str(v) for v in out))\n' +
        "\n" +
        'print("search(6):", search(root, 6))\n' +
        'print("search(11):", search(root, 11))\n' +
        "\n" +
        "root = delete(root, 3)  # node with two children\n" +
        "out2 = []\n" +
        "inorder(root, out2)\n" +
        'print("inorder after delete(3):", " ".join(str(v) for v in out2))\n',
      pythonOutput:
        "inorder after inserts: 1 3 4 6 7 8 10 13 14\nsearch(6): True\nsearch(11): False\n" +
        "inorder after delete(3): 1 4 6 7 8 10 13 14",
    },
    {
      kind: "viz",
      title: "delete(3) on the tree built from {8, 3, 10, 1, 6, 14, 4, 7, 13} — node 3 has two children",
      caption: "The two-children case never just removes a node — it copies a safe replacement value up, then deletes that value's original, easier, spot further down.",
      viz: {
        type: "tree",
        frames: [
          {
            rootId: "n8",
            nodes: [
              { id: "n8", value: 8, left: "n3", right: "n10" },
              { id: "n3", value: 3, left: "n1", right: "n6" },
              { id: "n1", value: 1, left: null, right: null },
              { id: "n6", value: 6, left: "n4", right: "n7" },
              { id: "n4", value: 4, left: null, right: null },
              { id: "n7", value: 7, left: null, right: null },
              { id: "n10", value: 10, left: null, right: "n14" },
              { id: "n14", value: 14, left: "n13", right: null },
              { id: "n13", value: 13, left: null, right: null },
            ],
            note:
              "The tree built by the inserts: 8 is root; 8.left=3, 8.right=10; 3.left=1, 3.right=6; " +
              "6.left=4, 6.right=7; 10.right=14; 14.left=13.",
          },
          {
            rootId: "n8",
            nodes: [
              { id: "n8", value: 8, left: "n3", right: "n10" },
              { id: "n3", value: 3, left: "n1", right: "n6", state: "active" },
              { id: "n1", value: 1, left: null, right: null },
              { id: "n6", value: 6, left: "n4", right: "n7" },
              { id: "n4", value: 4, left: null, right: null },
              { id: "n7", value: 7, left: null, right: null },
              { id: "n10", value: 10, left: null, right: "n14" },
              { id: "n14", value: 14, left: "n13", right: null },
              { id: "n13", value: 13, left: null, right: null },
            ],
            note:
              "delete(8, 3): 3 < 8, recurse into delete(node=3, 3). At node 3, val==3 matches. Both left " +
              "(1) and right (6) children exist, so this is the two-children case: find the successor, " +
              "the smallest value in the right subtree.",
          },
          {
            rootId: "n8",
            nodes: [
              { id: "n8", value: 8, left: "n3", right: "n10" },
              { id: "n3", value: 3, left: "n1", right: "n6", state: "active" },
              { id: "n1", value: 1, left: null, right: null },
              { id: "n6", value: 6, left: "n4", right: "n7", state: "visiting" },
              { id: "n4", value: 4, left: null, right: null, state: "compare" },
              { id: "n7", value: 7, left: null, right: null },
              { id: "n10", value: 10, left: null, right: "n14" },
              { id: "n14", value: 14, left: "n13", right: null },
              { id: "n13", value: 13, left: null, right: null },
            ],
            note: "successor starts at node 6, walks left while possible: 6.left=4, and 4.left is null, so successor=4.",
          },
          {
            rootId: "n8",
            nodes: [
              { id: "n8", value: 8, left: "n3", right: "n10" },
              { id: "n3", value: 4, left: "n1", right: "n6", state: "compare" },
              { id: "n1", value: 1, left: null, right: null },
              { id: "n6", value: 6, left: "n4", right: "n7" },
              { id: "n4", value: 4, left: null, right: null, state: "compare" },
              { id: "n7", value: 7, left: null, right: null },
              { id: "n10", value: 10, left: null, right: "n14" },
              { id: "n14", value: 14, left: "n13", right: null },
              { id: "n13", value: 13, left: null, right: null },
            ],
            note: "Copy successor's value into this node: node.val = 4 (the node originally holding 3 now holds 4).",
          },
          {
            rootId: "n8",
            nodes: [
              { id: "n8", value: 8, left: "n3", right: "n10" },
              { id: "n3", value: 4, left: "n1", right: "n6" },
              { id: "n1", value: 1, left: null, right: null },
              { id: "n6", value: 6, left: null, right: "n7", state: "active" },
              { id: "n7", value: 7, left: null, right: null },
              { id: "n10", value: 10, left: null, right: "n14" },
              { id: "n14", value: 14, left: "n13", right: null },
              { id: "n13", value: 13, left: null, right: null },
            ],
            note:
              "Delete 4 from the right subtree: delete(node=6, 4). 4 < 6, recurse into delete(node=4, 4). " +
              "Node 4 has no children, so node.left == null returns node.right (null). 6.left is set to null.",
          },
          {
            rootId: "n8",
            nodes: [
              { id: "n8", value: 8, left: "n3", right: "n10" },
              { id: "n3", value: 4, left: "n1", right: "n6", state: "done" },
              { id: "n1", value: 1, left: null, right: null },
              { id: "n6", value: 6, left: null, right: "n7" },
              { id: "n7", value: 7, left: null, right: null },
              { id: "n10", value: 10, left: null, right: "n14" },
              { id: "n14", value: 14, left: "n13", right: null },
              { id: "n13", value: 13, left: null, right: null },
            ],
            note:
              "Final tree: 8.left is the node now valued 4, with left=1, right=6 (6.left=null, 6.right=7). " +
              "Inorder confirms: 1 4 6 7 8 10 13 14 — still fully sorted, the BST property preserved.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Delete's two-children case is the one part of BST logic that isn't a direct rerun of search: you " +
        "can't just remove the node, because that would disconnect its two subtrees. The fix is to find a " +
        "replacement value that's guaranteed to keep the ordering valid — either the largest value in the " +
        "left subtree, or (as coded above) the smallest value in the right subtree, called the **inorder " +
        "successor** — copy that value up, then delete the (now-duplicated) original from further down, " +
        "where it's guaranteed to have at most one child.",
    },
    {
      kind: "h", text: "Where the O(log n) promise comes from, and where it breaks" },
    {
      kind: "p",
      text:
        "Every one of search, insert, and delete does at most one comparison per level of the tree, then " +
        "descends one level. So the true cost is the tree's **height** — the number of levels — not the " +
        "number of nodes directly. For a **balanced** tree (roughly equal numbers of nodes on each side, at " +
        "every node), height is O(log n): each level roughly doubles the nodes covered, mirroring the " +
        "halving-shrinks-recursion-to-O(log n) idea from the recursion chapter. But nothing in the plain BST " +
        "code above *enforces* balance. Insert values already in sorted order — 1, 2, 3, 4, 5 — and every " +
        "new node becomes the previous node's right child: the tree degenerates into what is structurally a " +
        "linked list, height n, and every operation becomes O(n). Self-balancing variants (AVL trees, " +
        "red-black trees) exist specifically to guarantee O(log n) height regardless of insertion order — " +
        "worth knowing by name, not usually required to implement from scratch in an interview.",
    },
    {
      kind: "table",
      head: ["Operation", "Balanced tree", "Skewed (worst-case) tree", "Why"],
      rows: [
        [
          "search(val)",
          "O(log n)",
          "O(n)",
          "Cost is the tree's height: O(log n) when roughly balanced, but O(n) if the tree has degenerated " +
            "into a single chain.",
        ],
        [
          "insert(val)",
          "O(log n)",
          "O(n)",
          "Same descent as search, plus one node creation at a null spot — the walk down dominates the " +
            "cost.",
        ],
        [
          "delete(val)",
          "O(log n)",
          "O(n)",
          "Same descent to find the node, plus (for the two-children case) a second descent to find the " +
            "inorder successor — both bounded by height.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Assuming a BST is always O(log n) — that guarantee needs the tree to be balanced; a BST built by " +
          "inserting already-sorted data degrades to O(n), the same as a linked list.",
        "In delete's two-children case, forgetting to actually remove the successor from its original " +
          "position after copying its value up — this leaves a duplicate value in the tree.",
        "Confusing the *inorder successor* (smallest in the right subtree) with the *inorder predecessor* " +
          "(largest in the left subtree) — either works for delete, but the code must consistently descend " +
          "into the matching subtree.",
        "Checking `val == node.val` for search or delete on a tree that allows duplicate values without " +
          "having decided a rule for where duplicates go (left or right) — an inconsistent rule breaks the " +
          "BST property silently.",
      ],
    },
    {
      kind: "remember",
      items: [
        "BST rule, applied at every node: left subtree smaller, right subtree bigger.",
        "Search/insert/delete cost is the tree's height, not its node count — O(log n) balanced, O(n) skewed.",
        "Inorder traversal of a BST always yields sorted order — a direct consequence of the ordering rule, " +
          "not a separate fact to memorise.",
        "Deleting a two-children node: copy up the inorder successor's (or predecessor's) value, then delete " +
          "that value from its original, guaranteed-simpler position.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Validate whether a binary tree is a valid BST\" is a very common question, and the common bug is " +
          "checking only immediate children instead of the full valid-range constraint inherited from every " +
          "ancestor.",
        "\"Find the kth smallest element in a BST\" is a direct application of inorder traversal producing " +
          "sorted order — recognising that connection turns a seemingly hard problem into a short one.",
        "Interviewers often follow up a BST question by asking what happens on already-sorted input — being " +
          "able to name the O(n) degenerate case, and that self-balancing trees exist to prevent it, signals " +
          "real understanding rather than memorised code.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how to validate whether a given binary tree satisfies the BST property, " +
          "explaining why checking only each node against its immediate children is not sufficient.",
        "Explain how you'd find the kth smallest value in a BST using inorder traversal, and how you'd stop " +
          "early once you've found it rather than always visiting the whole tree.",
        "Describe how you would find the lowest common ancestor of two values in a BST, using the ordering " +
          "property to avoid searching the whole tree.",
        "Given a sorted array, describe how you would build a height-balanced BST from it directly, rather " +
          "than inserting the values one at a time in order.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does inserting already-sorted values (1, 2, 3, 4, 5) into a BST produce a worst-case O(n) tree?",
      options: [
        "Java's BST implementation rejects sorted input, so the values after the first have to be placed by hand.",
        "Each new value is larger than everything before it, so it always goes right: one chain of height n.",
        "Sorted input makes the insert loop run forever, because the comparison never finds a null child to attach to.",
        "It doesn't: sorted input always produces the most balanced tree possible, since the median is inserted first.",
      ],
      answer: 1,
      why:
        "Every insert rule sends a strictly larger value right; with strictly increasing input, that's " +
        "always the same direction, so the tree never branches — it becomes a linked list in disguise, and " +
        "every operation degrades to O(n).",
    },
    {
      kind: "quiz",
      question: "In delete(), why is the two-children case handled by copying up a successor's value instead of directly removing the node?",
      options: [
        "Directly removing the node would disconnect its left and right subtrees from the rest of the tree, " +
          "with no way to reattach both",
        "Java doesn't allow removing a node with two children",
        "It's purely a style preference with no correctness reason",
        "Copying values is required to keep the tree's height balanced",
      ],
      answer: 0,
      why:
        "A node with two children is a bridge between two subtrees; removing it outright would need to " +
        "reattach both children somewhere valid. Copying up a value that's already guaranteed to preserve " +
        "BST order, then deleting it from its simpler original spot, sidesteps that problem entirely.",
    },
    {
      kind: "quiz",
      question: "What is the time complexity of search() on a balanced BST with n nodes, and why?",
      options: [
        "O(n), because every node might need to be checked",
        "O(log n), because each comparison eliminates roughly half of the remaining nodes, and a balanced " +
          "tree's height is O(log n)",
        "O(1), because BSTs support constant-time lookup like a HashMap",
        "O(n²), because insert and search interact quadratically",
      ],
      answer: 1,
      why:
        "Each step of search descends exactly one level, and a balanced tree has O(log n) levels for n " +
        "nodes — mirroring why halving-based recursion costs O(log n) calls in the recursion chapter.",
    },
  ],
};
