import type { Chapter } from "@/content/courses/types";

export const chapterGraphRepresentationBfsDfs: Chapter = {
  slug: "graph-representation-bfs-dfs",
  title: "Graph Representation, BFS and DFS",
  summary:
    "A tree is a graph with no cycles and one parent per node — drop both restrictions and you get the " +
    "structure behind maps, social networks, and dependency chains, walked with the same two traversals.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "A **graph** is a set of **vertices** (nodes) connected by **edges**. That's it — no rule that edges " +
        "must form a hierarchy, no rule against a cycle, no rule that a node has only one 'parent'. A tree, " +
        "from two chapters ago, is actually a special case of a graph: connected, with no cycles, and a " +
        "single root. Drop those restrictions and you get graphs in general — a city road network, a " +
        "friendship network, a web of course prerequisites, a build system's dependency chain. An edge can " +
        "be **undirected** (friendship: if A knows B, B knows A) or **directed** (a one-way street, or " +
        "'course X requires course Y'), and it can carry a **weight** (a distance, a cost) or not.",
    },
    { kind: "h", text: "The city road-map analogy" },
    {
      kind: "analogy",
      title: "A city's road map, not a family tree",
      text:
        "A family tree has a strict shape: everyone has exactly one path back to the root, and there are no " +
        "loops. A city's road map has neither restriction — you can drive from your house back to itself by " +
        "looping around the block (a cycle), and there are usually *several* different routes between any " +
        "two points, not one canonical path. Roads can be one-way (directed edges) or two-way (undirected), " +
        "and some routes are longer or more congested than others (weighted edges). Every technique in this " +
        "chapter and the next is really a way of answering road-map questions in code: can I get from A to " +
        "B at all? What's the shortest route? Where the analogy stops: a real map is embedded in physical " +
        "space, so nearby-looking points are usually connected; a graph in code has no such guarantee — two " +
        "vertices can be 'close' in a diagram yet have no edge between them at all.",
    },
    { kind: "h", text: "Representing a graph: the adjacency list" },
    {
      kind: "p",
      text:
        "The standard way to store a graph in code is an **adjacency list**: for every vertex, keep a list of " +
        "the vertices it connects to directly. (The alternative, an **adjacency matrix** — an n×n grid of " +
        "true/false — is simpler for very dense graphs or O(1) edge-existence checks, but wastes O(n²) space " +
        "on a graph where most vertices *aren't* directly connected, which is the common case.) This chapter " +
        "represents vertices as plain integers 0..n-1 and edges as an adjacency list, `List<List<Integer>>`.",
    },
    {
      kind: "code",
      caption:
        "Build an undirected graph as an adjacency list, then visit every reachable vertex two ways: " +
        "breadth-first (level by level, via a queue) and depth-first (as far as possible, then backtrack, " +
        "via recursion).",
      code:
        "import java.util.ArrayDeque;\n" +
        "import java.util.ArrayList;\n" +
        "import java.util.List;\n" +
        "import java.util.Queue;\n" +
        "\n" +
        "public class GraphBasics {\n" +
        "    static List<List<Integer>> buildAdjList(int n, int[][] edges) {\n" +
        "        List<List<Integer>> adj = new ArrayList<>();\n" +
        "        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());\n" +
        "        for (int[] e : edges) {\n" +
        "            adj.get(e[0]).add(e[1]);\n" +
        "            adj.get(e[1]).add(e[0]); // undirected\n" +
        "        }\n" +
        "        return adj;\n" +
        "    }\n" +
        "\n" +
        "    static List<Integer> bfs(List<List<Integer>> adj, int start) {\n" +
        "        List<Integer> order = new ArrayList<>();\n" +
        "        boolean[] visited = new boolean[adj.size()];\n" +
        "        Queue<Integer> queue = new ArrayDeque<>();\n" +
        "        queue.offer(start);\n" +
        "        visited[start] = true;\n" +
        "        while (!queue.isEmpty()) {\n" +
        "            int curr = queue.poll();\n" +
        "            order.add(curr);\n" +
        "            for (int next : adj.get(curr)) {\n" +
        "                if (!visited[next]) {\n" +
        "                    visited[next] = true;\n" +
        "                    queue.offer(next);\n" +
        "                }\n" +
        "            }\n" +
        "        }\n" +
        "        return order;\n" +
        "    }\n" +
        "\n" +
        "    static List<Integer> dfs(List<List<Integer>> adj, int start) {\n" +
        "        List<Integer> order = new ArrayList<>();\n" +
        "        boolean[] visited = new boolean[adj.size()];\n" +
        "        dfsHelper(adj, start, visited, order);\n" +
        "        return order;\n" +
        "    }\n" +
        "\n" +
        "    static void dfsHelper(List<List<Integer>> adj, int curr, boolean[] visited, List<Integer> order) {\n" +
        "        visited[curr] = true;\n" +
        "        order.add(curr);\n" +
        "        for (int next : adj.get(curr)) {\n" +
        "            if (!visited[next]) {\n" +
        "                dfsHelper(adj, next, visited, order);\n" +
        "            }\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        //   0 - 1 - 3\n" +
        "        //   |   |\n" +
        "        //   2 - 4\n" +
        "        int[][] edges = {{0, 1}, {0, 2}, {1, 3}, {1, 4}, {2, 4}};\n" +
        "        List<List<Integer>> adj = buildAdjList(5, edges);\n" +
        "\n" +
        '        System.out.println("BFS from 0: " + bfs(adj, 0));\n' +
        '        System.out.println("DFS from 0: " + dfs(adj, 0));\n' +
        "    }\n" +
        "}\n",
      output: "BFS from 0: [0, 1, 2, 3, 4]\nDFS from 0: [0, 1, 3, 4, 2]",
      python:
        "from collections import deque\n" +
        "\n" +
        "\n" +
        "def build_adj_list(n, edges):\n" +
        "    adj = [[] for _ in range(n)]\n" +
        "    for a, b in edges:\n" +
        "        adj[a].append(b)\n" +
        "        adj[b].append(a)  # undirected\n" +
        "    return adj\n" +
        "\n" +
        "\n" +
        "def bfs(adj, start):\n" +
        "    order = []\n" +
        "    visited = [False] * len(adj)\n" +
        "    queue = deque([start])\n" +
        "    visited[start] = True\n" +
        "    while queue:\n" +
        "        curr = queue.popleft()\n" +
        "        order.append(curr)\n" +
        "        for next_v in adj[curr]:\n" +
        "            if not visited[next_v]:\n" +
        "                visited[next_v] = True\n" +
        "                queue.append(next_v)\n" +
        "    return order\n" +
        "\n" +
        "\n" +
        "def dfs(adj, start):\n" +
        "    order = []\n" +
        "    visited = [False] * len(adj)\n" +
        "\n" +
        "    def dfs_helper(curr):\n" +
        "        visited[curr] = True\n" +
        "        order.append(curr)\n" +
        "        for next_v in adj[curr]:\n" +
        "            if not visited[next_v]:\n" +
        "                dfs_helper(next_v)\n" +
        "\n" +
        "    dfs_helper(start)\n" +
        "    return order\n" +
        "\n" +
        "\n" +
        "#   0 - 1 - 3\n" +
        "#   |   |\n" +
        "#   2 - 4\n" +
        "edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 4)]\n" +
        "adj = build_adj_list(5, edges)\n" +
        "\n" +
        'print("BFS from 0:", bfs(adj, 0))\n' +
        'print("DFS from 0:", dfs(adj, 0))\n',
      pythonOutput: "BFS from 0: [0, 1, 2, 3, 4]\nDFS from 0: [0, 1, 3, 4, 2]",
    },
    {
      kind: "viz",
      title: "BFS from vertex 0 on the graph 0-1, 0-2, 1-3, 1-4, 2-4",
      caption: "'Visiting' means enqueued but not yet polled; 'done' means already polled and added to order.",
      viz: {
        type: "graph",
        frames: [
          {
            nodes: [
              { id: "0", label: "0", state: "visiting" },
              { id: "1", label: "1" },
              { id: "2", label: "2" },
              { id: "3", label: "3" },
              { id: "4", label: "4" },
            ],
            edges: [
              { from: "0", to: "1" }, { from: "0", to: "2" }, { from: "1", to: "3" },
              { from: "1", to: "4" }, { from: "2", to: "4" },
            ],
            note: "Start: visited={0}, queue=[0].",
          },
          {
            nodes: [
              { id: "0", label: "0", state: "done" },
              { id: "1", label: "1", state: "visiting" },
              { id: "2", label: "2", state: "visiting" },
              { id: "3", label: "3" },
              { id: "4", label: "4" },
            ],
            edges: [
              { from: "0", to: "1" }, { from: "0", to: "2" }, { from: "1", to: "3" },
              { from: "1", to: "4" }, { from: "2", to: "4" },
            ],
            note: "Poll 0, add to order. Neighbours 1 and 2 are unvisited — mark visited, enqueue both. order=[0].",
          },
          {
            nodes: [
              { id: "0", label: "0", state: "done" },
              { id: "1", label: "1", state: "done" },
              { id: "2", label: "2", state: "visiting" },
              { id: "3", label: "3", state: "visiting" },
              { id: "4", label: "4", state: "visiting" },
            ],
            edges: [
              { from: "0", to: "1" }, { from: "0", to: "2" }, { from: "1", to: "3" },
              { from: "1", to: "4" }, { from: "2", to: "4" },
            ],
            note: "Poll 1, add to order. 0 is already visited (skip); 3 and 4 are new — mark and enqueue. order=[0,1].",
          },
          {
            nodes: [
              { id: "0", label: "0", state: "done" },
              { id: "1", label: "1", state: "done" },
              { id: "2", label: "2", state: "done" },
              { id: "3", label: "3", state: "visiting" },
              { id: "4", label: "4", state: "visiting" },
            ],
            edges: [
              { from: "0", to: "1" }, { from: "0", to: "2" }, { from: "1", to: "3" },
              { from: "1", to: "4" }, { from: "2", to: "4" },
            ],
            note: "Poll 2, add to order. Both neighbours (0 and 4) already visited — nothing new to enqueue. order=[0,1,2].",
          },
          {
            nodes: [
              { id: "0", label: "0", state: "done" },
              { id: "1", label: "1", state: "done" },
              { id: "2", label: "2", state: "done" },
              { id: "3", label: "3", state: "done" },
              { id: "4", label: "4", state: "visiting" },
            ],
            edges: [
              { from: "0", to: "1" }, { from: "0", to: "2" }, { from: "1", to: "3" },
              { from: "1", to: "4" }, { from: "2", to: "4" },
            ],
            note: "Poll 3, add to order. Its only neighbour, 1, is already visited. order=[0,1,2,3].",
          },
          {
            nodes: [
              { id: "0", label: "0", state: "done" },
              { id: "1", label: "1", state: "done" },
              { id: "2", label: "2", state: "done" },
              { id: "3", label: "3", state: "done" },
              { id: "4", label: "4", state: "done" },
            ],
            edges: [
              { from: "0", to: "1" }, { from: "0", to: "2" }, { from: "1", to: "3" },
              { from: "1", to: "4" }, { from: "2", to: "4" },
            ],
            note:
              "Poll 4, add to order. Queue empty, done — every vertex reached exactly once, level by level: " +
              "{0}, then {1,2}, then {3,4}. order=[0,1,2,3,4].",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "BFS and DFS both visit every reachable vertex exactly once — the difference is purely the *order*, " +
        "and that difference has real consequences. BFS, using a queue, explores in expanding rings: " +
        "everything one edge away, then everything two edges away, and so on. That makes BFS the natural " +
        "choice whenever 'fewest edges to get there' matters — the next chapter builds shortest-path search " +
        "directly on top of it. DFS, using recursion (implicitly the call stack) or an explicit stack, " +
        "commits to one path as deep as it goes before backtracking — better suited to questions like " +
        "'does *any* path exist', 'find all paths', or detecting cycles, where depth rather than distance is " +
        "what matters.",
    },
    {
      kind: "compare",
      title: "BFS vs DFS",
      columns: [
        {
          label: "BFS",
          items: [
            "Queue (FIFO) — explores in expanding rings, one edge away, then two, then three",
            "{{O(V + E)}} time, {{O(V)}} space (the queue's contents)",
            "Use it when you need the *fewest edges* to reach something",
          ],
        },
        {
          label: "DFS",
          items: [
            "Recursion or an explicit stack (LIFO) — commits to one path as deep as it goes",
            "{{O(V + E)}} time, {{O(V)}} space (the recursion depth)",
            "Use it for 'does any path exist', 'find all paths', or cycle detection",
          ],
        },
      ],
    },
    {
      kind: "table",
      head: ["Traversal", "Data structure", "Time", "Space", "Why"],
      rows: [
        [
          "BFS",
          "Queue",
          "{{O(V + E)}}",
          "{{O(V)}}",
          "Every vertex is enqueued once and every edge is examined once when scanning that vertex's " +
            "neighbours — V vertices plus E edge-checks total.",
        ],
        [
          "DFS",
          "Recursion / explicit stack",
          "{{O(V + E)}}",
          "{{O(V)}}",
          "Same reasoning as BFS — every vertex visited once, every edge examined once — but the O(V) space " +
            "here is the recursion depth (or stack), not a queue's contents.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting the `visited` array — without it, a cycle (or even a simple undirected edge, traversed " +
          "back and forth) sends the traversal into an infinite loop, since a graph, unlike a tree, has no " +
          "guarantee against revisiting a vertex.",
        "Marking a vertex visited *when it's dequeued* in BFS instead of *when it's enqueued* — dequeue-time " +
          "marking can enqueue the same vertex multiple times from different neighbours before it's ever " +
          "processed, wasting work and, in weighted variants, causing real bugs.",
        "Assuming DFS and BFS visit vertices in the same order — they don't, and problems that care about " +
          "'shortest' specifically need BFS (on unweighted graphs); DFS's order has no such guarantee.",
        "Forgetting that a disconnected graph needs BFS/DFS restarted from every unvisited vertex to reach " +
          "the whole graph — a single call from one start vertex only reaches that vertex's connected " +
          "component.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A graph is vertices plus edges — no hierarchy, no cycle restriction; a tree is a special case of a " +
          "connected, cycle-free graph.",
        "Adjacency list: O(V+E) space, efficient for sparse graphs — the default choice unless the graph is " +
          "very dense or needs O(1) edge lookups.",
        "BFS (queue) explores in expanding rings — use it for 'fewest edges' questions. DFS (recursion/stack) " +
          "commits deep before backtracking — use it for 'does any path exist' or cycle detection.",
        "Always track visited vertices — graphs, unlike trees, can have cycles, and an unguarded traversal " +
          "can loop forever.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Number of connected components\" or \"number of islands\" (a grid treated as an implicit graph) " +
          "are extremely common — both are just 'run BFS or DFS from every unvisited vertex, count how many " +
          "times you start.'",
        "Interviewers often ask you to justify BFS versus DFS for a given problem — being able to say 'BFS, " +
          "because we need the fewest edges' or 'DFS, because we just need any path and want less memory " +
          "overhead for a wide graph' signals real understanding.",
        "A 2D grid (matrix) is one of the most common disguised graphs in interviews — each cell is a vertex, " +
          "and its up/down/left/right neighbours are its edges, with BFS/DFS applied exactly as on an " +
          "explicit adjacency list.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is a queue used for BFS but recursion (or an explicit stack) used for DFS?",
      options: [
        "It's just a textbook convention: swapping the queue for a stack in BFS would still visit the vertices in the same order, ring by ring.",
        "A queue's FIFO order finishes one distance level before the next; a stack's LIFO order goes deep first.",
        "A queue is always faster than a stack in Java, which is why BFS uses one and DFS has to accept the slower structure.",
        "DFS cannot be implemented with a queue under any circumstances, since a queue can hold only one vertex at a time.",
      ],
      answer: 1,
      why:
        "The data structure's ordering directly produces the traversal's shape: FIFO gives expanding rings " +
        "(BFS), LIFO gives deep commitment before backtrack (DFS) — this is the same FIFO/LIFO distinction " +
        "from the stacks and queues chapter, just applied to a more general structure.",
    },
    {
      kind: "quiz",
      question: "What is the time complexity of BFS or DFS on a graph with V vertices and E edges, using an adjacency list?",
      options: [
        "O(V)", "O(E)", "O(V + E)", "O(V * E)",
      ],
      answer: 2,
      why:
        "Each vertex is visited (and added to the queue/stack) exactly once, and each edge is examined " +
        "exactly once when scanning its vertex's neighbour list — giving O(V + E) total, not a product of " +
        "the two.",
    },
    {
      kind: "quiz",
      question: "Why is a `visited` array required for graph traversal, when tree traversals in earlier chapters didn't need one?",
      options: [
        "It's only an optimisation that saves time on large graphs; the traversal would still finish with the right result without it.",
        "A tree never revisits a node; a graph has cycles and multiple paths, so without visited it can loop forever.",
        "visited arrays are required only for directed graphs, because undirected edges can always be walked back along safely.",
        "Trees are always smaller than graphs, so their traversals finish quickly and visited tracking is not worth the extra memory.",
      ],
      answer: 1,
      why:
        "A tree's structure guarantees no cycles and a unique path from the root to any node, so " +
        "traversal naturally terminates. A graph offers no such guarantee — an unguarded traversal can " +
        "cycle indefinitely without explicit visited tracking.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd count the number of connected components in an undirected " +
          "graph, using BFS or DFS as a building block.",
        "Given a 2D grid of land ('1') and water ('0') cells, describe how BFS or DFS from each unvisited " +
          "land cell counts the number of separate islands.",
        "Explain how you would detect a cycle in an undirected graph using DFS, and what information beyond " +
          "a simple visited array you'd need to track.",
        "Describe, in words, how you'd find all vertices reachable from a given start vertex, and how that " +
          "differs from finding the *shortest* path to each of them.",
      ],
    },
  ],
};
