import type { Chapter } from "@/content/courses/types";

export const chapterShortestPaths: Chapter = {
  slug: "shortest-paths",
  title: "Shortest Paths: BFS and Dijkstra",
  summary:
    "On an unweighted graph, BFS's ring-by-ring order already gives the shortest path for free. Add " +
    "weights, and that stops being true — Dijkstra is what a priority queue buys back.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "The previous chapter noted that BFS explores in expanding rings — everything one edge away, then " +
        "two edges away, and so on. That ordering has a direct consequence worth stating precisely: **on an " +
        "unweighted graph, the first time BFS reaches a vertex, it has done so by the fewest possible number " +
        "of edges.** No extra bookkeeping needed — the shortest path (in edge count) falls straight out of " +
        "the traversal order. The moment edges carry different **weights** (a road's actual distance, a " +
        "flight's cost), that stops being true: a path with more edges can still be shorter in total weight " +
        "than a path with fewer. That's exactly the gap **Dijkstra's algorithm** closes.",
    },
    { kind: "h", text: "The ripples-in-a-pond analogy" },
    {
      kind: "analogy",
      title: "Ripples on a pond versus a search party with unequal stride lengths",
      text:
        "BFS on an unweighted graph is like ripples spreading from a dropped stone: they reach every point at " +
        "distance 1 before any point at distance 2, because every 'step' costs the same. Weighted shortest " +
        "paths are more like a search party where each person's stride costs a different amount of effort — " +
        "you can't just count steps taken; you have to track cumulative effort spent, and always send the " +
        "next searcher from whoever has spent the *least* effort so far, because someone who's spent more " +
        "might still find a cheaper way through their own path. That's Dijkstra's core discipline: always " +
        "expand from the cheapest known but not-yet-finalised vertex. Where the analogy stops: ripples never " +
        "backtrack or reconsider; Dijkstra's priority queue can and does revisit a vertex's neighbours " +
        "multiple times if a cheaper route to it is found later, which the code below has to account for.",
    },
    { kind: "h", text: "BFS distance: free once you have the traversal" },
    {
      kind: "code",
      caption:
        "Shortest path in edge count via BFS (unweighted), and shortest path in total weight via Dijkstra " +
        "(non-negative weights), both returning a distance array from a single source.",
      code:
        "import java.util.ArrayDeque;\n" +
        "import java.util.ArrayList;\n" +
        "import java.util.Arrays;\n" +
        "import java.util.List;\n" +
        "import java.util.PriorityQueue;\n" +
        "import java.util.Queue;\n" +
        "\n" +
        "public class ShortestPaths {\n" +
        "    static int[] bfsShortest(List<List<Integer>> adj, int start) {\n" +
        "        int n = adj.size();\n" +
        "        int[] dist = new int[n];\n" +
        "        Arrays.fill(dist, -1);\n" +
        "        dist[start] = 0;\n" +
        "        Queue<Integer> queue = new ArrayDeque<>();\n" +
        "        queue.offer(start);\n" +
        "        while (!queue.isEmpty()) {\n" +
        "            int curr = queue.poll();\n" +
        "            for (int next : adj.get(curr)) {\n" +
        "                if (dist[next] == -1) {\n" +
        "                    dist[next] = dist[curr] + 1;\n" +
        "                    queue.offer(next);\n" +
        "                }\n" +
        "            }\n" +
        "        }\n" +
        "        return dist;\n" +
        "    }\n" +
        "\n" +
        "    static class Edge {\n" +
        "        int to, weight;\n" +
        "        Edge(int to, int weight) { this.to = to; this.weight = weight; }\n" +
        "    }\n" +
        "\n" +
        "    static int[] dijkstra(List<List<Edge>> adj, int start) {\n" +
        "        int n = adj.size();\n" +
        "        int[] dist = new int[n];\n" +
        "        Arrays.fill(dist, Integer.MAX_VALUE);\n" +
        "        dist[start] = 0;\n" +
        "        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[1] - b[1]); // [vertex, distSoFar]\n" +
        "        pq.offer(new int[]{start, 0});\n" +
        "        while (!pq.isEmpty()) {\n" +
        "            int[] top = pq.poll();\n" +
        "            int curr = top[0];\n" +
        "            int d = top[1];\n" +
        "            if (d > dist[curr]) continue; // stale entry, already beaten\n" +
        "            for (Edge e : adj.get(curr)) {\n" +
        "                int newDist = d + e.weight;\n" +
        "                if (newDist < dist[e.to]) {\n" +
        "                    dist[e.to] = newDist;\n" +
        "                    pq.offer(new int[]{e.to, newDist});\n" +
        "                }\n" +
        "            }\n" +
        "        }\n" +
        "        return dist;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        // Unweighted: 0-1, 0-2, 1-3, 2-3, 3-4\n" +
        "        List<List<Integer>> adj = new ArrayList<>();\n" +
        "        for (int i = 0; i < 5; i++) adj.add(new ArrayList<>());\n" +
        "        int[][] edges = {{0, 1}, {0, 2}, {1, 3}, {2, 3}, {3, 4}};\n" +
        "        for (int[] e : edges) { adj.get(e[0]).add(e[1]); adj.get(e[1]).add(e[0]); }\n" +
        '        System.out.println("BFS distances from 0: " + Arrays.toString(bfsShortest(adj, 0)));\n' +
        "\n" +
        "        // Weighted: 0->1 (4), 0->2 (1), 2->1 (2), 1->3 (1), 2->3 (5)\n" +
        "        List<List<Edge>> wadj = new ArrayList<>();\n" +
        "        for (int i = 0; i < 4; i++) wadj.add(new ArrayList<>());\n" +
        "        wadj.get(0).add(new Edge(1, 4));\n" +
        "        wadj.get(0).add(new Edge(2, 1));\n" +
        "        wadj.get(2).add(new Edge(1, 2));\n" +
        "        wadj.get(1).add(new Edge(3, 1));\n" +
        "        wadj.get(2).add(new Edge(3, 5));\n" +
        '        System.out.println("Dijkstra distances from 0: " + Arrays.toString(dijkstra(wadj, 0)));\n' +
        "    }\n" +
        "}\n",
      output: "BFS distances from 0: [0, 1, 1, 2, 3]\nDijkstra distances from 0: [0, 3, 1, 4]",
      python:
        "import heapq\n" +
        "from collections import deque\n" +
        "\n" +
        "\n" +
        "def bfs_shortest(adj, start):\n" +
        "    n = len(adj)\n" +
        "    dist = [-1] * n\n" +
        "    dist[start] = 0\n" +
        "    queue = deque([start])\n" +
        "    while queue:\n" +
        "        curr = queue.popleft()\n" +
        "        for next_v in adj[curr]:\n" +
        "            if dist[next_v] == -1:\n" +
        "                dist[next_v] = dist[curr] + 1\n" +
        "                queue.append(next_v)\n" +
        "    return dist\n" +
        "\n" +
        "\n" +
        "def dijkstra(adj, start):\n" +
        "    n = len(adj)\n" +
        '    dist = [float("inf")] * n\n' +
        "    dist[start] = 0\n" +
        "    pq = [(0, start)]  # (distSoFar, vertex) -- tuples compare by distance first, no\n" +
        "    # comparator needed the way Java's PriorityQueue does\n" +
        "    while pq:\n" +
        "        d, curr = heapq.heappop(pq)\n" +
        "        if d > dist[curr]:\n" +
        "            continue  # stale entry, already beaten\n" +
        "        for next_v, weight in adj[curr]:\n" +
        "            new_dist = d + weight\n" +
        "            if new_dist < dist[next_v]:\n" +
        "                dist[next_v] = new_dist\n" +
        "                heapq.heappush(pq, (new_dist, next_v))\n" +
        "    return dist\n" +
        "\n" +
        "\n" +
        "# Unweighted: 0-1, 0-2, 1-3, 2-3, 3-4\n" +
        "adj = [[] for _ in range(5)]\n" +
        "edges = [(0, 1), (0, 2), (1, 3), (2, 3), (3, 4)]\n" +
        "for a, b in edges:\n" +
        "    adj[a].append(b)\n" +
        "    adj[b].append(a)\n" +
        'print("BFS distances from 0:", bfs_shortest(adj, 0))\n' +
        "\n" +
        "# Weighted: 0->1 (4), 0->2 (1), 2->1 (2), 1->3 (1), 2->3 (5)\n" +
        "wadj = [[] for _ in range(4)]\n" +
        "wadj[0].append((1, 4))\n" +
        "wadj[0].append((2, 1))\n" +
        "wadj[2].append((1, 2))\n" +
        "wadj[1].append((3, 1))\n" +
        "wadj[2].append((3, 5))\n" +
        'print("Dijkstra distances from 0:", dijkstra(wadj, 0))\n',
      pythonOutput: "BFS distances from 0: [0, 1, 1, 2, 3]\nDijkstra distances from 0: [0, 3, 1, 4]",
    },
    {
      kind: "viz",
      title: "dijkstra() from vertex 0 — edges 0->1(4), 0->2(1), 2->1(2), 1->3(1), 2->3(5)",
      caption: "Each node's label carries its current best-known distance; an edge lights up the moment it's relaxed, whether or not the relaxation actually improves anything.",
      viz: {
        type: "graph",
        frames: [
          {
            nodes: [
              { id: "0", label: "0 · dist 0", state: "active" },
              { id: "1", label: "1 · dist ∞" },
              { id: "2", label: "2 · dist ∞" },
              { id: "3", label: "3 · dist ∞" },
            ],
            edges: [
              { from: "0", to: "1", directed: true },
              { from: "0", to: "2", directed: true },
              { from: "2", to: "1", directed: true },
              { from: "1", to: "3", directed: true },
              { from: "2", to: "3", directed: true },
            ],
            note: "dist = [0, INF, INF, INF]. pq = [(0, dist 0)].",
          },
          {
            nodes: [
              { id: "0", label: "0 · dist 0", state: "done" },
              { id: "1", label: "1 · dist 4" },
              { id: "2", label: "2 · dist 1" },
              { id: "3", label: "3 · dist ∞" },
            ],
            edges: [
              { from: "0", to: "1", directed: true, state: "visiting" },
              { from: "0", to: "2", directed: true, state: "visiting" },
              { from: "2", to: "1", directed: true },
              { from: "1", to: "3", directed: true },
              { from: "2", to: "3", directed: true },
            ],
            note:
              "Pop (0, 0) — the cheapest known entry. d=0 matches dist[0], not stale. Relax neighbours: " +
              "0->1 costs 0+4=4 < INF, update dist[1]=4, push (1,4). 0->2 costs 0+1=1 < INF, update " +
              "dist[2]=1, push (2,1). pq = [(2,1), (1,4)].",
          },
          {
            nodes: [
              { id: "0", label: "0 · dist 0", state: "done" },
              { id: "1", label: "1 · dist 3" },
              { id: "2", label: "2 · dist 1", state: "done" },
              { id: "3", label: "3 · dist 6" },
            ],
            edges: [
              { from: "0", to: "1", directed: true },
              { from: "0", to: "2", directed: true },
              { from: "2", to: "1", directed: true, state: "visiting" },
              { from: "1", to: "3", directed: true },
              { from: "2", to: "3", directed: true, state: "visiting" },
            ],
            note:
              "Pop (2, 1) — cheapest remaining. d=1 matches dist[2], not stale. Relax: 2->1 costs 1+2=3 < " +
              "dist[1]=4, update dist[1]=3, push (1,3). 2->3 costs 1+5=6 < INF, update dist[3]=6, push " +
              "(3,6). pq = [(1,3), (1,4), (3,6)].",
          },
          {
            nodes: [
              { id: "0", label: "0 · dist 0", state: "done" },
              { id: "1", label: "1 · dist 3", state: "done" },
              { id: "2", label: "2 · dist 1", state: "done" },
              { id: "3", label: "3 · dist 4" },
            ],
            edges: [
              { from: "0", to: "1", directed: true },
              { from: "0", to: "2", directed: true },
              { from: "2", to: "1", directed: true },
              { from: "1", to: "3", directed: true, state: "visiting" },
              { from: "2", to: "3", directed: true },
            ],
            note:
              "Pop (1, 3) — cheapest remaining. d=3 matches dist[1]=3, not stale. Relax: 1->3 costs 3+1=4 " +
              "< dist[3]=6, update dist[3]=4, push (3,4). pq = [(1,4), (3,4), (3,6)].",
          },
          {
            nodes: [
              { id: "0", label: "0 · dist 0", state: "done" },
              { id: "1", label: "1 · dist 3", state: "compare" },
              { id: "2", label: "2 · dist 1", state: "done" },
              { id: "3", label: "3 · dist 4" },
            ],
            edges: [
              { from: "0", to: "1", directed: true },
              { from: "0", to: "2", directed: true },
              { from: "2", to: "1", directed: true },
              { from: "1", to: "3", directed: true },
              { from: "2", to: "3", directed: true },
            ],
            note:
              "Pop (1, 4). But dist[1] is now 3, and d=4 > 3 — this is a stale entry left over from the " +
              "first relaxation, before the cheaper 0->2->1 route was found. Skip it entirely.",
          },
          {
            nodes: [
              { id: "0", label: "0 · dist 0", state: "done" },
              { id: "1", label: "1 · dist 3", state: "done" },
              { id: "2", label: "2 · dist 1", state: "done" },
              { id: "3", label: "3 · dist 4", state: "done" },
            ],
            edges: [
              { from: "0", to: "1", directed: true },
              { from: "0", to: "2", directed: true },
              { from: "2", to: "1", directed: true },
              { from: "1", to: "3", directed: true },
              { from: "2", to: "3", directed: true },
            ],
            note:
              "Pop (3, 4). d=4 matches dist[3]=4, not stale. 3 has no outgoing edges here. pq = [(3,6)]. " +
              "Pop (3, 6) next: d=6 > dist[3]=4 — stale, skip. pq empty, done. Final: dist = [0, 3, 1, 4] " +
              "— note dist[1]=3 via 0->2->1, cheaper than the direct edge 0->1 costing 4.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "That stale-entry check (`if (d > dist[curr]) continue;`) is Dijkstra's least obvious but most " +
        "essential line. Because the same vertex can be pushed onto the priority queue more than once — once " +
        "per relaxation that improves its distance — the queue can hold outdated entries for a vertex whose " +
        "distance has since been improved further. Skipping any popped entry that's worse than the vertex's " +
        "*current* best-known distance is what keeps the algorithm correct without needing to search the " +
        "queue for a stale entry and remove it directly (which Java's `PriorityQueue` can't do efficiently " +
        "anyway).",
    },
    {
      kind: "h", text: "Why Dijkstra needs non-negative weights" },
    {
      kind: "p",
      text:
        "Dijkstra's correctness rests on one assumption: once a vertex is popped with its true shortest " +
        "distance, no *later* relaxation can ever improve it, because every other path to it would have to " +
        "go through some vertex with an equal-or-*greater* distance already processed, and adding a " +
        "non-negative edge weight from there can't produce something smaller. A negative edge weight breaks " +
        "that assumption directly — a long-looking path could suddenly become cheap. Graphs with negative " +
        "weights need a different algorithm (Bellman-Ford), outside this course's scope, but it's worth " +
        "knowing by name and knowing *why* Dijkstra can't be patched to handle it.",
    },
    {
      kind: "table",
      head: ["Algorithm", "Handles", "Time", "Why"],
      rows: [
        [
          "BFS shortest path",
          "Unweighted graphs (or all edges equal weight)",
          "O(V + E)",
          "Every vertex and edge is visited once; the ring-by-ring queue order guarantees the first visit " +
            "to any vertex is via the fewest edges.",
        ],
        [
          "Dijkstra (heap-based)",
          "Non-negative weighted graphs",
          "O((V + E) log V)",
          "Each edge can trigger one push to the priority queue (O(log V) each), and each vertex is popped " +
            "and finalised once its true shortest distance is known.",
        ],
        [
          "Naive shortest path (no priority queue)",
          "Non-negative weighted graphs",
          "O(V²)",
          "Without a heap, finding 'the cheapest unfinalised vertex' each round means scanning all " +
            "remaining vertices linearly, V times.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Using plain BFS on a *weighted* graph expecting correct shortest paths — BFS's guarantee only " +
          "holds when every edge costs the same; on unequal weights it can report a path with more edges but " +
          "lower total weight as farther than a cheaper long one, incorrectly.",
        "Forgetting the stale-entry check in Dijkstra — without `if (d > dist[curr]) continue;`, an outdated " +
          "queue entry can re-relax neighbours using a distance that's already been improved, doing wasted " +
          "(though not incorrect, just inefficient) work, or in a buggy variant, actually corrupting results.",
        "Running Dijkstra on a graph with negative edge weights — the algorithm can silently produce a " +
          "wrong (too large) shortest distance instead of erroring, because its core assumption about " +
          "already-finalised vertices no longer holds.",
        "Using a plain array scan instead of a priority queue to find the next cheapest vertex — it still " +
          "produces correct results, but at O(V²) instead of O((V+E) log V), which matters a great deal on " +
          "sparse graphs with many vertices.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Unweighted shortest path is BFS's traversal order for free — first visit is always via fewest " +
          "edges.",
        "Weighted shortest path (non-negative weights) needs Dijkstra: always expand the cheapest " +
          "not-yet-finalised vertex next, tracked with a min-heap priority queue.",
        "Dijkstra must skip stale priority-queue entries — check the popped distance against the vertex's " +
          "current best-known distance before relaxing its neighbours.",
        "Negative edge weights break Dijkstra's core assumption; that needs Bellman-Ford instead (name to " +
          "know, not required to implement here).",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Shortest path in a maze/grid\" with all steps costing the same is a BFS question in disguise — " +
          "reaching for Dijkstra here is unnecessary complexity, and interviewers notice when a candidate " +
          "over-engineers an unweighted problem.",
        "\"Network delay time\" and similar 'cheapest way to reach every node from a source, given costs' " +
          "phrasing is the standard signal for Dijkstra — the moment weights are unequal, BFS alone stops " +
          "being correct.",
        "Being asked why Dijkstra fails on negative weights is a common follow-up that tests understanding, " +
          "not memorisation — the key idea is that a finalised vertex's distance is assumed never to improve, " +
          "and negative edges can violate that.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does BFS give the correct shortest path on an unweighted graph without any extra bookkeeping?",
      options: [
        "It doesn't give the shortest path: BFS never guarantees it, because it can reach a vertex by a longer route first.",
        "BFS visits vertices in rings by edge count, so a vertex is first reached by the fewest edges.",
        "Because BFS secretly runs Dijkstra's algorithm internally, using a priority queue in place of its ordinary queue.",
        "Only because the example graph happened to be small; on a larger graph BFS would give longer paths.",
      ],
      answer: 1,
      why:
        "Every vertex at ring distance k is only enqueued after all vertices at distance k-1 have been " +
        "processed, so the first visit to any vertex is guaranteed to be via the minimum number of edges.",
    },
    {
      kind: "quiz",
      question: "In dijkstra(), what does the check `if (d > dist[curr]) continue;` protect against?",
      options: [
        "Negative cycles in the graph, which would otherwise keep lowering the distances without ever stopping.",
        "Skipping a stale queue entry whose vertex already has a shorter distance",
        "Running out of memory when the priority queue grows past the number of edges in the graph.",
        "Disconnected graphs, where vertices that cannot be reached would otherwise be given a made-up distance.",
      ],
      answer: 1,
      why:
        "Because relaxation can push the same vertex onto the queue more than once, older (worse) entries " +
        "for an already-improved vertex must be skipped rather than re-processed as if they were current.",
    },
    {
      kind: "quiz",
      question: "Why does Dijkstra's algorithm produce incorrect results on graphs with negative edge weights?",
      options: [
        "Java's PriorityQueue cannot hold negative numbers, so a negative edge weight is rejected before Dijkstra can use it.",
        "Dijkstra assumes a finalised vertex can't be improved later, but a negative edge can make a path cheaper after that.",
        "Negative weights make the algorithm loop forever rather than return a wrong answer, so it never produces any output.",
        "It doesn't fail: Dijkstra handles negative weights correctly as long as no negative cycle exists in the graph.",
      ],
      answer: 1,
      why:
        "Dijkstra's greedy correctness relies on distances only ever growing as you extend a path with " +
        "non-negative edges. A negative edge can make an already-finalised vertex's true shortest distance " +
        "smaller than what was recorded, which the algorithm has no mechanism to revisit.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd adapt the BFS shortest-path code to also reconstruct the " +
          "actual path (not just the distance) from the source to a given vertex.",
        "Given a grid where some cells are walls, describe how BFS finds the shortest path from a start cell " +
          "to a target cell, treating the grid as an implicit unweighted graph.",
        "Explain, in your own words, why Dijkstra's algorithm always finalises the vertex with the smallest " +
          "tentative distance next, rather than any other unfinalised vertex.",
        "Describe how you would find the shortest path between two specific vertices (not from a source to " +
          "all vertices) — does anything in Dijkstra's approach change, or can it stop early?",
      ],
    },
  ],
};
