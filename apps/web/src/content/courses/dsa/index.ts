import { chapterComplexity } from "@/content/courses/dsa/02-complexity";
import { chapterInterviewApproach } from "@/content/courses/dsa/03-interview-approach";
import { chapterWhatIsDsa } from "@/content/courses/dsa/01-what-is-dsa";
import { chapterArraysInMemory } from "@/content/courses/dsa/04-arrays-in-memory";
import { chapterTwoPointers } from "@/content/courses/dsa/05-two-pointers";
import { chapterSlidingWindow } from "@/content/courses/dsa/06-sliding-window";
import { chapterPrefixSums } from "@/content/courses/dsa/07-prefix-sums";
import { chapterStringTechniques } from "@/content/courses/dsa/08-string-techniques";
import { chapterHashing } from "@/content/courses/dsa/09-hashing";
import { chapterRecursionDsa } from "@/content/courses/dsa/10-recursion";
import { chapterBacktracking } from "@/content/courses/dsa/11-backtracking";
import { chapterSimpleSorts } from "@/content/courses/dsa/12-simple-sorts";
import { chapterMergeSort } from "@/content/courses/dsa/13-merge-sort";
import { chapterQuickSort } from "@/content/courses/dsa/14-quick-sort";
import { chapterBinarySearch } from "@/content/courses/dsa/15-binary-search";
import { chapterLinkedLists } from "@/content/courses/dsa/16-linked-lists";
import { chapterStacks } from "@/content/courses/dsa/17-stacks";
import { chapterQueuesAndDeques } from "@/content/courses/dsa/18-queues-and-deques";
import { chapterTreeBasicsAndTraversals } from "@/content/courses/dsa/19-tree-basics-and-traversals";
import { chapterBinarySearchTrees } from "@/content/courses/dsa/20-binary-search-trees";
import { chapterHeapsAndPriorityQueues } from "@/content/courses/dsa/21-heaps-and-priority-queues";
import { chapterTries } from "@/content/courses/dsa/22-tries";
import { chapterGraphRepresentationBfsDfs } from "@/content/courses/dsa/23-graph-representation-bfs-dfs";
import { chapterShortestPaths } from "@/content/courses/dsa/24-shortest-paths";
import { chapterTopologicalSort } from "@/content/courses/dsa/25-topological-sort";
import { chapterUnionFind } from "@/content/courses/dsa/26-union-find";
import { chapterGreedy } from "@/content/courses/dsa/27-greedy";
import { chapterDpIntuition } from "@/content/courses/dsa/28-dp-intuition";
import { chapterDpPatterns } from "@/content/courses/dsa/29-dp-patterns";
import { chapterBitManipulation } from "@/content/courses/dsa/30-bit-manipulation";
import type { Course } from "@/content/courses/types";

/**
 * Data Structures & Algorithms (task 046). Modules 1-4 — foundations; arrays and strings; hashing and
 * recursion; sorting and searching — were written in feat/courses-dsa-1. Modules 5-8 — linear structures;
 * trees; graphs; paradigms — complete the course (feat/courses-dsa-2).
 */
export const dsaCourse: Course = {
  slug: "dsa",
  title: "Data Structures & Algorithms",
  seoTitle: "Data Structures and Algorithms for Coding Interviews",
  seoDescription: "The patterns behind every coding round, explained once so you keep them: arrays, hashing, recursion, trees, graphs and more.",
  tagline: "The patterns behind every coding round, explained once so you actually keep them.",
  level: "Beginner — assumes the Java Programming course, or equivalent basics",
  modules: [
    {
      title: "Foundations",
      chapters: [chapterWhatIsDsa, chapterComplexity, chapterInterviewApproach],
    },
    {
      title: "Arrays and strings",
      chapters: [
        chapterArraysInMemory,
        chapterTwoPointers,
        chapterSlidingWindow,
        chapterPrefixSums,
        chapterStringTechniques,
      ],
    },
    {
      title: "Hashing and recursion",
      chapters: [chapterHashing, chapterRecursionDsa, chapterBacktracking],
    },
    {
      title: "Sorting and searching",
      chapters: [chapterSimpleSorts, chapterMergeSort, chapterQuickSort, chapterBinarySearch],
    },
    {
      title: "Linear structures",
      chapters: [chapterLinkedLists, chapterStacks, chapterQueuesAndDeques],
    },
    {
      title: "Trees",
      chapters: [
        chapterTreeBasicsAndTraversals,
        chapterBinarySearchTrees,
        chapterHeapsAndPriorityQueues,
        chapterTries,
      ],
    },
    {
      title: "Graphs",
      chapters: [
        chapterGraphRepresentationBfsDfs,
        chapterShortestPaths,
        chapterTopologicalSort,
        chapterUnionFind,
      ],
    },
    {
      title: "Paradigms",
      chapters: [chapterGreedy, chapterDpIntuition, chapterDpPatterns, chapterBitManipulation],
    },
  ],
};
