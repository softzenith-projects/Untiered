import type { Chapter } from "@/content/courses/types";

export const chapterUnionFind: Chapter = {
  slug: "union-find",
  title: "Union-Find (Disjoint Set Union)",
  summary:
    "A structure built for one question asked over and over — 'are these two things in the same group?' " +
    "— answered near-instantly by two small optimisations that flatten the groups as you go.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "**Union-Find** (also called Disjoint Set Union, DSU) tracks a collection of elements partitioned " +
        "into disjoint (non-overlapping) groups, and answers two operations fast, repeatedly: `find(x)` — " +
        "which group is x in? — and `union(a, b)` — merge a's group and b's group into one. It's the right " +
        "tool whenever a problem is really asking 'are these connected?' many times over a graph that's " +
        "being built up edge by edge, without needing a full BFS/DFS traversal every single time a new edge " +
        "is added.",
    },
    { kind: "h", text: "The WhatsApp-groups analogy" },
    {
      kind: "analogy",
      title: "Merging WhatsApp friend groups",
      text:
        "Imagine tracking which of your contacts are in the same friend circle, where circles merge whenever " +
        "you learn two people know each other. Each circle has one person acting as its 'representative' — " +
        "ask 'is Rohan in Priya's circle?' and the answer is really 'do Rohan and Priya share the same " +
        "representative?' When you learn a new pair knows each other, you don't need to redraw the whole " +
        "social map from scratch — you just point one circle's representative at the other's, merging the " +
        "two circles in one step. Where the analogy stops: in this structure, once two circles merge, they " +
        "never split apart again — union-find supports merging groups, not un-merging them, which is exactly " +
        "the shape needed for 'process edges one at a time, track connectivity' problems, and not a general " +
        "substitute for graph traversal.",
    },
    { kind: "h", text: "Two optimisations that make it near-constant time" },
    {
      kind: "code",
      caption:
        "Union-Find with both key optimisations: path compression (in find) and union by rank — merging " +
        "edges one at a time and tracking how many connected components remain.",
      code:
        "public class UnionFind {\n" +
        "    static int[] parent;\n" +
        "    static int[] rank_;\n" +
        "\n" +
        "    static void init(int n) {\n" +
        "        parent = new int[n];\n" +
        "        rank_ = new int[n];\n" +
        "        for (int i = 0; i < n; i++) parent[i] = i;\n" +
        "    }\n" +
        "\n" +
        "    static int find(int x) {\n" +
        "        if (parent[x] != x) {\n" +
        "            parent[x] = find(parent[x]); // path compression\n" +
        "        }\n" +
        "        return parent[x];\n" +
        "    }\n" +
        "\n" +
        "    static boolean union(int a, int b) {\n" +
        "        int rootA = find(a);\n" +
        "        int rootB = find(b);\n" +
        "        if (rootA == rootB) return false; // already connected -- would form a cycle\n" +
        "        if (rank_[rootA] < rank_[rootB]) {\n" +
        "            parent[rootA] = rootB;\n" +
        "        } else if (rank_[rootA] > rank_[rootB]) {\n" +
        "            parent[rootB] = rootA;\n" +
        "        } else {\n" +
        "            parent[rootB] = rootA;\n" +
        "            rank_[rootA]++;\n" +
        "        }\n" +
        "        return true;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        init(6);\n" +
        "        int[][] edges = {{0, 1}, {1, 2}, {3, 4}, {4, 5}};\n" +
        "        int components = 6;\n" +
        "        for (int[] e : edges) {\n" +
        "            if (union(e[0], e[1])) components--;\n" +
        "        }\n" +
        '        System.out.println("components after unions: " + components);\n' +
        '        System.out.println("find(0) == find(2): " + (find(0) == find(2)));\n' +
        '        System.out.println("find(0) == find(3): " + (find(0) == find(3)));\n' +
        "\n" +
        "        // detecting a cycle: adding an edge between two already-connected nodes\n" +
        "        boolean added = union(0, 2);\n" +
        '        System.out.println("union(0, 2) formed a new connection: " + added);\n' +
        "    }\n" +
        "}\n",
      output:
        "components after unions: 2\nfind(0) == find(2): true\nfind(0) == find(3): false\n" +
        "union(0, 2) formed a new connection: false",
      python:
        "class UnionFind:\n" +
        "    def __init__(self, n):\n" +
        "        self.parent = list(range(n))\n" +
        "        self.rank = [0] * n\n" +
        "\n" +
        "    def find(self, x):\n" +
        "        if self.parent[x] != x:\n" +
        "            self.parent[x] = self.find(self.parent[x])  # path compression\n" +
        "        return self.parent[x]\n" +
        "\n" +
        "    def union(self, a, b):\n" +
        "        root_a, root_b = self.find(a), self.find(b)\n" +
        "        if root_a == root_b:\n" +
        "            return False  # already connected -- would form a cycle\n" +
        "        if self.rank[root_a] < self.rank[root_b]:\n" +
        "            self.parent[root_a] = root_b\n" +
        "        elif self.rank[root_a] > self.rank[root_b]:\n" +
        "            self.parent[root_b] = root_a\n" +
        "        else:\n" +
        "            self.parent[root_b] = root_a\n" +
        "            self.rank[root_a] += 1\n" +
        "        return True\n" +
        "\n" +
        "\n" +
        "uf = UnionFind(6)\n" +
        "edges = [(0, 1), (1, 2), (3, 4), (4, 5)]\n" +
        "components = 6\n" +
        "for a, b in edges:\n" +
        "    if uf.union(a, b):\n" +
        "        components -= 1\n" +
        "\n" +
        'print("components after unions:", components)\n' +
        'print("find(0) == find(2):", uf.find(0) == uf.find(2))\n' +
        'print("find(0) == find(3):", uf.find(0) == uf.find(3))\n' +
        "\n" +
        "# detecting a cycle: adding an edge between two already-connected nodes\n" +
        "added = uf.union(0, 2)\n" +
        'print("union(0, 2) formed a new connection:", added)\n',
      pythonOutput:
        "components after unions: 2\nfind(0) == find(2): True\nfind(0) == find(3): False\n" +
        "union(0, 2) formed a new connection: False",
    },
    {
      kind: "viz",
      title: "union(0,1), union(1,2) — watch path compression flatten the chain",
      caption: "Each cell holds parent[i] — an index that is its own value is a root; a done cell has just been re-pointed straight at a root.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 0 }, { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
            note: "init(6): parent = [0,1,2,3,4,5] — everyone starts as their own representative (their own group of one). rank = [0,0,0,0,0,0].",
          },
          {
            cells: [{ value: 0, state: "compare", pointers: ["root"] }, { value: 0, state: "done" }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }],
            note:
              "union(0, 1): find(0)=0, find(1)=1 (both already roots). Roots differ, ranks equal (0==0), " +
              "so parent[1]=0 and rank[0] becomes 1. parent = [0,0,2,3,4,5].",
          },
          {
            cells: [{ value: 0, state: "compare", pointers: ["root"] }, { value: 0, state: "done" }, { value: 0, state: "done" }, { value: 3 }, { value: 4 }, { value: 5 }],
            note:
              "union(1, 2): find(1) — parent[1]=0, and parent[0]=0 (0 is its own parent), so find(1) " +
              "returns 0, no compression needed yet (path was already length 1). find(2)=2. Roots differ " +
              "(0 vs 2); rank[0]=1 > rank[2]=0, so the smaller-rank tree attaches under the bigger: " +
              "parent[2]=0. parent = [0,0,0,3,4,5].",
          },
          {
            cells: [{ value: 0, pointers: ["root"] }, { value: 0 }, { value: 0, state: "active", pointers: ["find(2)"] }, { value: 3 }, { value: 4 }, { value: 5 }],
            note:
              "find(2) now, later: parent[2]=0, and parent[0]=0, so it returns 0 directly — 2 was attached " +
              "straight to the root during union, so there's nothing further to compress here, but for a " +
              "longer chain (imagine 5 unions in a row without rank balancing), path compression would " +
              "rewrite every node on the path directly to the root the first time find() walks it, keeping " +
              "future lookups from that subtree O(1).",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "**Union by rank** keeps the merged structure shallow on purpose: when merging two groups, the " +
        "smaller (lower-rank) tree is always attached *under* the larger one's root, not the other way " +
        "round — attaching the bigger tree under the smaller one would needlessly deepen it. **Path " +
        "compression** (inside `find`) goes further: every time `find` walks a chain of parent pointers up " +
        "to the root, it rewires every node it passed through to point *directly* at the root, so the next " +
        "`find` on any of those nodes is instant. Together, these two tricks keep the amortised cost of both " +
        "operations extremely close to O(1) — formally O(α(n)), where α is the inverse Ackermann function, " +
        "a quantity that grows so slowly it's under 5 for any input size that could exist in practice. In " +
        "everyday terms: for interview purposes, treat both operations as O(1).",
    },
    {
      kind: "table",
      head: ["Operation", "Time (amortised)", "Space", "Why"],
      rows: [
        [
          "find(x), with path compression",
          "O(α(n)) — effectively O(1)",
          "O(n)",
          "Path compression flattens the tree every time a chain is walked, so repeated finds on related " +
            "elements become direct lookups almost immediately.",
        ],
        [
          "union(a, b), with union by rank",
          "O(α(n)) — effectively O(1)",
          "O(1) extra",
          "Cost is dominated by the two find() calls; attaching by rank keeps tree height bounded " +
            "logarithmically even before compression kicks in.",
        ],
        [
          "n unions/finds processed as a batch (e.g. Kruskal's MST, cycle detection over m edges)",
          "O(m · α(n)) ≈ O(m)",
          "O(n)",
          "Each of the m operations costs almost-constant time, so processing every edge once is close to " +
            "linear overall — far better than re-running BFS/DFS connectivity checks after every edge.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Implementing `find` without path compression — it still gives correct answers, but repeated calls " +
          "on a long, unflattened chain can degrade toward O(n) per call in the worst case, defeating the " +
          "whole point of the structure.",
        "Implementing `union` without rank (or size) balancing — always attaching, say, b's root under a's " +
          "root regardless of which is bigger can build a long, unbalanced chain, again losing the near-O(1) " +
          "guarantee.",
        "Forgetting that `union(a, b)` returning false (roots already equal) is exactly how a cycle is " +
          "detected while building a graph edge by edge — this is the standard union-find pattern for " +
          "'does adding this edge create a cycle?', used directly in Kruskal's minimum spanning tree " +
          "algorithm.",
        "Confusing union-find with general graph traversal — it answers 'are these two connected right now?' " +
          "efficiently as edges are added, but it does not store or let you reconstruct the actual path " +
          "between two elements the way BFS/DFS can.",
      ],
    },
    {
      kind: "remember",
      items: [
        "find(x) returns x's group representative; union(a, b) merges a's and b's groups — union returning " +
          "false means they were already in the same group.",
        "Path compression (in find) flattens chains directly to the root as you walk them.",
        "Union by rank attaches the smaller tree under the bigger one's root, keeping height bounded.",
        "Together, both operations run in effectively O(1) amortised time — the structure's whole reason to " +
          "exist is answering 'connected?' fast, repeatedly, as edges accumulate.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Number of connected components\" (revisited from the graphs chapter) can be solved with union-find " +
          "instead of BFS/DFS when edges arrive one at a time and you need the running count after each — a " +
          "full traversal after every edge would be far more expensive.",
        "\"Redundant connection\" (find the one edge that turns a tree into a graph with exactly one cycle) " +
          "is a textbook union-find question: process edges in order, and the first `union` call that " +
          "returns false is the answer.",
        "Kruskal's algorithm for a minimum spanning tree is worth knowing by name as the canonical real use " +
          "of union-find: sort edges by weight, add each one unless union() reports it would form a cycle.",
      ],
    },
    {
      kind: "quiz",
      question: "What does it mean when union(a, b) returns false in this chapter's implementation?",
      options: [
        "An error occurred during the union operation, and the groups were left unchanged",
        "a and b are already in the same group, so merging them again would create a cycle",
        "a or b doesn't exist in the structure, so there was nothing to merge",
        "The rank arrays are corrupted, so the structure can no longer be trusted",
      ],
      answer: 1,
      why:
        "The check `if (rootA == rootB) return false;` fires exactly when a and b already share a " +
        "representative — no merge is needed, and in a graph-building context, adding this edge would " +
        "close a cycle.",
    },
    {
      kind: "quiz",
      question: "What is the combined effect of path compression and union by rank on the amortised time complexity of find/union?",
      options: [
        "O(n) per operation, because each find must still walk a chain whose length can reach the number of elements.",
        "O(log n) per operation, because the trees stay balanced but each find still climbs a logarithmic number of parents.",
        "Effectively O(1): formally O(α(n)), the inverse Ackermann function, which is under 5 for any practical input size.",
        "O(n log n) per operation, because every union has to merge two sorted lists of members before it can finish.",
      ],
      answer: 2,
      why:
        "Both optimisations independently bound the tree's height; combined, the amortised cost per " +
        "operation grows so slowly with n that it's treated as constant for essentially all practical " +
        "purposes.",
    },
    {
      kind: "quiz",
      question: "Why does path compression rewrite every node on a find() path to point directly at the root?",
      options: [
        "To save memory by using fewer parent pointers",
        "So that any future find() call on those same nodes becomes an O(1) direct lookup instead of " +
          "re-walking the same chain",
        "It's required for union by rank to work at all",
        "To randomize which node becomes the new root",
      ],
      answer: 1,
      why:
        "Once a node points directly at its group's root, any later find() on it (or on anything that was " +
        "compressed along the same path) short-circuits immediately — the flattening pays for itself on " +
        "every subsequent call.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you would use union-find to find the single edge that, if removed " +
          "from a connected graph with exactly one cycle, would make it a tree.",
        "Given a list of accounts where some share an email address (implying the same person), describe how " +
          "union-find would group all accounts belonging to the same person.",
        "Explain why union by rank alone (without path compression), or path compression alone (without " +
          "union by rank), still gives correct results but loses some of the near-O(1) performance guarantee.",
        "Describe, in words, how you'd track the *size* of each group (not just its representative) as " +
          "unions happen, and how that could answer 'how many elements are in the same group as x?' " +
          "efficiently.",
      ],
    },
  ],
};
