import type { Chapter } from "@/content/courses/types";

export const chapterTopologicalSort: Chapter = {
  slug: "topological-sort",
  title: "Topological Sort",
  summary:
    "For a directed graph with no cycles, there's always at least one order that respects every " +
    "'must come before' edge — Kahn's algorithm finds it by repeatedly peeling off vertices with nothing " +
    "left pointing into them.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Some graphs encode a **dependency**: 'course X requires course Y first', 'task A must finish before " +
        "task B starts', 'this build target needs that library compiled first'. These are **directed** " +
        "graphs (edges have a direction — Y -> X means Y before X) that must also be **acyclic** (no " +
        "cycles), because a cycle would mean 'A depends on B, and B depends on A', which has no valid order " +
        "at all. Such a graph is called a **DAG** (Directed Acyclic Graph). A **topological sort** is a " +
        "linear ordering of its vertices where every edge Y -> X places Y somewhere before X. For any DAG, " +
        "at least one such ordering always exists — often more than one.",
    },
    { kind: "h", text: "The college-course-prerequisites analogy" },
    {
      kind: "analogy",
      title: "Planning a degree, semester by semester",
      text:
        "You're planning which order to take college courses in, given prerequisites: 'Data Structures " +
        "before Algorithms', 'Algorithms before Advanced Algorithms', 'Discrete Math before Algorithms'. A " +
        "valid four-year plan is exactly a topological sort — every course scheduled only after everything " +
        "it depends on. Crucially, you don't *need* one single unique plan: as long as each prerequisite " +
        "comes before what needs it, several valid semester plans can exist side by side (Discrete Math could " +
        "come in year 1 or year 2, as long as it's before Algorithms). If the course catalogue somehow " +
        "required 'X before Y' *and* 'Y before X', no schedule could ever satisfy both — that's exactly a " +
        "cycle, and exactly why a topological sort only exists for acyclic graphs. Where the analogy stops: " +
        "a real course catalogue is checked by a human advisor; the algorithm below is how a computer detects " +
        "an impossible prerequisite cycle automatically, without a human spotting it.",
    },
    { kind: "h", text: "Kahn's algorithm: peel off what nothing depends on" },
    {
      kind: "p",
      text:
        "The **in-degree** of a vertex is how many edges point *into* it — how many prerequisites it still " +
        "has. A vertex with in-degree 0 has nothing left blocking it, so it's safe to place next in the " +
        "order. **Kahn's algorithm** repeats a simple loop: take any current in-degree-0 vertex, add it to " +
        "the result, then 'remove' it by decrementing the in-degree of everything it points to (since one of " +
        "their prerequisites is now satisfied) — which may free up new in-degree-0 vertices to process next.",
    },
    {
      kind: "code",
      caption:
        "Topological sort via Kahn's algorithm (BFS with in-degree counting), on a small course-prerequisite " +
        "DAG — then again after adding an edge that creates a cycle, to show detection.",
      code:
        "import java.util.ArrayDeque;\n" +
        "import java.util.ArrayList;\n" +
        "import java.util.List;\n" +
        "import java.util.Queue;\n" +
        "\n" +
        "public class TopoSort {\n" +
        "    static List<Integer> topoSort(int n, List<List<Integer>> adj) {\n" +
        "        int[] indegree = new int[n];\n" +
        "        for (List<Integer> neighbours : adj) {\n" +
        "            for (int v : neighbours) indegree[v]++;\n" +
        "        }\n" +
        "        Queue<Integer> queue = new ArrayDeque<>();\n" +
        "        for (int i = 0; i < n; i++) {\n" +
        "            if (indegree[i] == 0) queue.offer(i);\n" +
        "        }\n" +
        "        List<Integer> order = new ArrayList<>();\n" +
        "        while (!queue.isEmpty()) {\n" +
        "            int curr = queue.poll();\n" +
        "            order.add(curr);\n" +
        "            for (int next : adj.get(curr)) {\n" +
        "                indegree[next]--;\n" +
        "                if (indegree[next] == 0) queue.offer(next);\n" +
        "            }\n" +
        "        }\n" +
        "        if (order.size() != n) {\n" +
        '            throw new IllegalStateException("cycle detected, no valid topological order");\n' +
        "        }\n" +
        "        return order;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        // Course prerequisites: 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3, 3 -> 4\n" +
        "        int n = 5;\n" +
        "        List<List<Integer>> adj = new ArrayList<>();\n" +
        "        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());\n" +
        "        int[][] edges = {{0, 1}, {0, 2}, {1, 3}, {2, 3}, {3, 4}};\n" +
        "        for (int[] e : edges) adj.get(e[0]).add(e[1]);\n" +
        "\n" +
        '        System.out.println("Topological order: " + topoSort(n, adj));\n' +
        "\n" +
        "        // Now add a cycle: 4 -> 0\n" +
        "        adj.get(4).add(0);\n" +
        "        try {\n" +
        "            topoSort(n, adj);\n" +
        "        } catch (IllegalStateException ex) {\n" +
        '            System.out.println("Caught: " + ex.getMessage());\n' +
        "        }\n" +
        "    }\n" +
        "}\n",
      output: "Topological order: [0, 1, 2, 3, 4]\nCaught: cycle detected, no valid topological order",
      python:
        "from collections import deque\n" +
        "\n" +
        "\n" +
        "def topo_sort(n, adj):\n" +
        "    indegree = [0] * n\n" +
        "    for neighbours in adj:\n" +
        "        for v in neighbours:\n" +
        "            indegree[v] += 1\n" +
        "\n" +
        "    queue = deque(i for i in range(n) if indegree[i] == 0)\n" +
        "    order = []\n" +
        "    while queue:\n" +
        "        curr = queue.popleft()\n" +
        "        order.append(curr)\n" +
        "        for next_v in adj[curr]:\n" +
        "            indegree[next_v] -= 1\n" +
        "            if indegree[next_v] == 0:\n" +
        "                queue.append(next_v)\n" +
        "\n" +
        "    if len(order) != n:\n" +
        '        raise ValueError("cycle detected, no valid topological order")\n' +
        "    return order\n" +
        "\n" +
        "\n" +
        "# Course prerequisites: 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3, 3 -> 4\n" +
        "n = 5\n" +
        "adj = [[] for _ in range(n)]\n" +
        "edges = [(0, 1), (0, 2), (1, 3), (2, 3), (3, 4)]\n" +
        "for a, b in edges:\n" +
        "    adj[a].append(b)\n" +
        "\n" +
        'print("Topological order:", topo_sort(n, adj))\n' +
        "\n" +
        "# Now add a cycle: 4 -> 0\n" +
        "adj[4].append(0)\n" +
        "try:\n" +
        "    topo_sort(n, adj)\n" +
        "except ValueError as ex:\n" +
        '    print(f"Caught: {ex}")\n',
      pythonOutput: "Topological order: [0, 1, 2, 3, 4]\nCaught: cycle detected, no valid topological order",
    },
    {
      kind: "viz",
      title: "topoSort on 0->1, 0->2, 1->3, 2->3, 3->4",
      caption: "A node's label carries its live in-degree; it's only safe to poll once that count reaches 0.",
      viz: {
        type: "graph",
        frames: [
          {
            nodes: [
              { id: "0", label: "0 · in 0" }, { id: "1", label: "1 · in 1" }, { id: "2", label: "2 · in 1" },
              { id: "3", label: "3 · in 2" }, { id: "4", label: "4 · in 1" },
            ],
            edges: [
              { from: "0", to: "1", directed: true }, { from: "0", to: "2", directed: true },
              { from: "1", to: "3", directed: true }, { from: "2", to: "3", directed: true },
              { from: "3", to: "4", directed: true },
            ],
            note:
              "Compute in-degrees by counting incoming edges: 0 has 0 (nothing points to it), 1 has 1 " +
              "(from 0), 2 has 1 (from 0), 3 has 2 (from 1 and 2), 4 has 1 (from 3). indegree = [0,1,1,2,1].",
          },
          {
            nodes: [
              { id: "0", label: "0 · in 0", state: "active" }, { id: "1", label: "1 · in 1" }, { id: "2", label: "2 · in 1" },
              { id: "3", label: "3 · in 2" }, { id: "4", label: "4 · in 1" },
            ],
            edges: [
              { from: "0", to: "1", directed: true }, { from: "0", to: "2", directed: true },
              { from: "1", to: "3", directed: true }, { from: "2", to: "3", directed: true },
              { from: "3", to: "4", directed: true },
            ],
            note: "Only vertex 0 has in-degree 0 — enqueue it. queue=[0].",
          },
          {
            nodes: [
              { id: "0", label: "0 · in 0", state: "done" }, { id: "1", label: "1 · in 0", state: "active" },
              { id: "2", label: "2 · in 0", state: "active" }, { id: "3", label: "3 · in 2" }, { id: "4", label: "4 · in 1" },
            ],
            edges: [
              { from: "0", to: "1", directed: true, state: "visiting" }, { from: "0", to: "2", directed: true, state: "visiting" },
              { from: "1", to: "3", directed: true }, { from: "2", to: "3", directed: true },
              { from: "3", to: "4", directed: true },
            ],
            note:
              "Poll 0. order=[0]. Decrement in-degree of 0's targets: 1 becomes 0 (enqueue it), 2 becomes " +
              "0 (enqueue it). indegree=[0,0,0,2,1]. queue=[1,2].",
          },
          {
            nodes: [
              { id: "0", label: "0 · in 0", state: "done" }, { id: "1", label: "1 · in 0", state: "done" },
              { id: "2", label: "2 · in 0", state: "active" }, { id: "3", label: "3 · in 1" }, { id: "4", label: "4 · in 1" },
            ],
            edges: [
              { from: "0", to: "1", directed: true }, { from: "0", to: "2", directed: true },
              { from: "1", to: "3", directed: true, state: "visiting" }, { from: "2", to: "3", directed: true },
              { from: "3", to: "4", directed: true },
            ],
            note: "Poll 1. order=[0,1]. Decrement target 3: indegree[3] becomes 1 (not 0 yet, don't enqueue). queue=[2].",
          },
          {
            nodes: [
              { id: "0", label: "0 · in 0", state: "done" }, { id: "1", label: "1 · in 0", state: "done" },
              { id: "2", label: "2 · in 0", state: "done" }, { id: "3", label: "3 · in 0", state: "active" }, { id: "4", label: "4 · in 1" },
            ],
            edges: [
              { from: "0", to: "1", directed: true }, { from: "0", to: "2", directed: true },
              { from: "1", to: "3", directed: true }, { from: "2", to: "3", directed: true, state: "visiting" },
              { from: "3", to: "4", directed: true },
            ],
            note: "Poll 2. order=[0,1,2]. Decrement target 3: indegree[3] becomes 0 — enqueue it. queue=[3].",
          },
          {
            nodes: [
              { id: "0", label: "0 · in 0", state: "done" }, { id: "1", label: "1 · in 0", state: "done" },
              { id: "2", label: "2 · in 0", state: "done" }, { id: "3", label: "3 · in 0", state: "done" },
              { id: "4", label: "4 · in 0", state: "active" },
            ],
            edges: [
              { from: "0", to: "1", directed: true }, { from: "0", to: "2", directed: true },
              { from: "1", to: "3", directed: true }, { from: "2", to: "3", directed: true },
              { from: "3", to: "4", directed: true, state: "visiting" },
            ],
            note: "Poll 3. order=[0,1,2,3]. Decrement target 4: indegree[4] becomes 0 — enqueue it. queue=[4].",
          },
          {
            nodes: [
              { id: "0", label: "0 · in 0", state: "done" }, { id: "1", label: "1 · in 0", state: "done" },
              { id: "2", label: "2 · in 0", state: "done" }, { id: "3", label: "3 · in 0", state: "done" },
              { id: "4", label: "4 · in 0", state: "done" },
            ],
            edges: [
              { from: "0", to: "1", directed: true }, { from: "0", to: "2", directed: true },
              { from: "1", to: "3", directed: true }, { from: "2", to: "3", directed: true },
              { from: "3", to: "4", directed: true },
            ],
            note:
              "Poll 4. order=[0,1,2,3,4]. No outgoing edges to process. queue empty. order.size()==5==n, " +
              "so this is a valid, complete topological order.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The cycle check falls out of the same loop for free: if a cycle exists, every vertex in that cycle " +
        "keeps a positive in-degree forever (something in the cycle always still points into it), so it " +
        "never gets enqueued, and `order` ends up shorter than the total vertex count `n`. That single " +
        "length check — no separate cycle-detection pass needed — is what the second `main` call " +
        "demonstrates: adding the edge 4 -> 0 means vertex 0 now also has in-degree 1 (from 4), but 0 is " +
        "still processed first as before since the algorithm doesn't recompute in-degrees mid-run — the real " +
        "effect is that the cycle 0->1->3->4->0 (or 0->2->3->4->0) keeps at least one vertex from ever " +
        "reaching in-degree 0 as the queue drains, so `order.size()` comes up short of `n`.",
    },
    {
      kind: "table",
      head: ["Step", "Time", "Space", "Why"],
      rows: [
        [
          "Computing in-degrees",
          "O(V + E)",
          "O(V)",
          "One pass over every vertex's adjacency list counts each edge exactly once.",
        ],
        [
          "Main queue loop",
          "O(V + E)",
          "O(V)",
          "Each vertex is enqueued and dequeued exactly once; each edge triggers exactly one in-degree " +
            "decrement.",
        ],
        [
          "Overall topoSort",
          "O(V + E)",
          "O(V)",
          "Same shape as BFS — this algorithm is literally BFS driven by in-degree instead of a visited " +
            "array.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting that a topological sort is generally *not unique* — multiple valid orders can exist " +
          "whenever more than one vertex has in-degree 0 at the same time; a test or problem statement that " +
          "expects one specific answer usually has additional tie-breaking rules (like always picking the " +
          "smallest available vertex number).",
        "Skipping the final `order.size() != n` check — without it, a cyclic graph silently returns a " +
          "partial, incorrect ordering instead of signalling that no valid order exists.",
        "Attempting a topological sort on an undirected graph — the notion of 'before' requires direction; " +
          "an undirected edge has none, so in-degree isn't even well-defined.",
        "Confusing topological sort with a numerically sorted order — the vertices are typically just labels " +
          "(course IDs, task names), and the output order is about dependency, not about vertex numbers " +
          "being ascending.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Topological sort orders a DAG's vertices so every directed edge points from earlier to later in " +
          "the order.",
        "Kahn's algorithm: repeatedly process any in-degree-0 vertex, decrementing its neighbours' " +
          "in-degrees, exactly like BFS but driven by in-degree instead of a visited array.",
        "If the resulting order has fewer vertices than the graph, a cycle exists — no valid topological " +
          "order is possible.",
        "A topological order is usually not unique; several valid orderings can exist whenever more than one " +
          "vertex is available to schedule next.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Course schedule\" (can all courses be finished, given prerequisites?) is one of the most directly " +
          "asked topological-sort questions — it's exactly the cycle-detection side effect of Kahn's " +
          "algorithm.",
        "\"Course schedule II\" (return a valid order, or an empty result if impossible) extends it to " +
          "returning the actual order this chapter's code produces.",
        "Build systems, spreadsheet formula evaluation, and package manager dependency resolution are all " +
          "real systems built on topological sort — worth mentioning as motivation when asked why this " +
          "matters outside interviews.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does Kahn's algorithm only work on directed acyclic graphs, not graphs with cycles?",
      options: [
        "It works fine on cyclic graphs too, because a vertex on a cycle has its in-degree reduced to 0 once the cycle is walked.",
        "Every vertex on a cycle has an incoming edge from another one on it, so its in-degree never reaches 0.",
        "Cyclic graphs make the queue grow without end, so the algorithm runs out of memory before it can finish.",
        "In-degree is undefined for graphs that contain cycles, so the counting step cannot even be carried out.",
      ],
      answer: 1,
      why:
        "Every vertex in a cycle depends (directly or indirectly) on another vertex in the same cycle, so " +
        "none of them can ever reach in-degree 0 through the algorithm's normal process — that's precisely " +
        "how the size check detects the cycle.",
    },
    {
      kind: "quiz",
      question: "What does it mean if topoSort's resulting order has fewer elements than the total number of vertices?",
      options: [
        "The graph has isolated vertices with no edges at all, which the algorithm skips",
        "The graph contains at least one cycle, so no valid topological order exists",
        "The algorithm has a bug and needs to be rerun on the same graph",
        "The graph is undirected, so a topological order cannot be defined for it",
      ],
      answer: 1,
      why:
        "Vertices stuck in a cycle never reach in-degree 0, so they're never added to the order — a " +
        "shortfall in the final count is the algorithm's direct signal that the graph isn't acyclic.",
    },
    {
      kind: "quiz",
      question: "Is a topological sort of a given DAG always unique?",
      options: [
        "Yes, every DAG has exactly one valid topological order, because each edge fixes the relative order of its two vertices.",
        "No: when more than one vertex has in-degree 0 at once, different choices give different valid orderings.",
        "Only DAGs with an even number of vertices can have several valid orders, since the vertices must pair up.",
        "Uniqueness depends on whether the graph is weighted, because edge weights decide which vertex is processed first.",
      ],
      answer: 1,
      why:
        "Any time the queue holds more than one in-degree-0 vertex simultaneously, picking a different one " +
        "first yields an equally valid but different overall ordering — DAGs generally have several correct " +
        "topological sorts, not one.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you would modify Kahn's algorithm to detect not just whether a " +
          "cycle exists, but to report the specific vertices involved in it.",
        "Given a list of course prerequisite pairs, describe how you would determine whether it's possible " +
          "to finish all courses, without necessarily producing the full order.",
        "Explain how a DFS-based approach (using a 'currently visiting' marker in addition to 'visited') " +
          "could also produce a valid topological order, as an alternative to Kahn's BFS-based approach.",
        "Describe, in words, how you would find *all* valid topological orderings of a small DAG, not just " +
          "one — and why this could be expensive for a larger graph.",
      ],
    },
  ],
};
