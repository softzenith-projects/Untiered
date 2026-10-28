import type { Chapter } from "@/content/courses/types";

export const chapterTries: Chapter = {
  slug: "tries",
  title: "Tries",
  summary:
    "A tree built out of letters, not values — every path from the root spells a prefix, so looking up a " +
    "whole word costs only as much as the word's own length, not how many other words exist.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "A **trie** (pronounced 'try', from re*trie*val) is a tree specialised for storing strings, where " +
        "each edge is labelled with one character, and every path from the root spells out a prefix of some " +
        "stored word. A node marked as `isWord` means the path from the root down to it is a complete word, " +
        "not just a prefix someone happened to pass through. The payoff: checking whether a word (or a " +
        "prefix) exists costs time proportional only to the *length of that word*, completely independent " +
        "of how many thousands of other words share the trie — a HashSet of strings can check exact " +
        "membership just as fast, but it cannot answer 'does anything start with this prefix?' without " +
        "scanning every entry.",
    },
    { kind: "h", text: "The dictionary phone-keypad analogy" },
    {
      kind: "analogy",
      title: "An old T9 phone dictionary, branching one letter at a time",
      text:
        "Picture an old-style phone's predictive text: press 'C', and it narrows to every word starting with " +
        "C; press 'A' next, and it narrows further to words starting 'CA'; press 'T', and now it's down to " +
        "'CAT', 'CATCH', 'CATALOG'. Each keypress walks one level deeper into a branching structure that's " +
        "organised entirely by shared prefixes — 'CAT' and 'CATCH' and 'CATALOG' all share the same first " +
        "three steps of the walk, splitting apart only once their letters differ. That's a trie exactly: " +
        "words that share a prefix literally share the same nodes for that prefix, and only fork where they " +
        "first differ. Where the analogy stops: a T9 keypad maps several letters to one key; a trie's " +
        "branching is one distinct child per actual character, with no such merging.",
    },
    { kind: "h", text: "Building the branching structure" },
    {
      kind: "code",
      caption:
        "A trie built from a small word list: insert, exact-word search, and prefix search (startsWith), " +
        "each node holding a map from character to child node.",
      code:
        "import java.util.HashMap;\n" +
        "import java.util.Map;\n" +
        "\n" +
        "public class TrieOps {\n" +
        "    static class TrieNode {\n" +
        "        Map<Character, TrieNode> children = new HashMap<>();\n" +
        "        boolean isWord = false;\n" +
        "    }\n" +
        "\n" +
        "    static class Trie {\n" +
        "        TrieNode root = new TrieNode();\n" +
        "\n" +
        "        void insert(String word) {\n" +
        "            TrieNode node = root;\n" +
        "            for (char ch : word.toCharArray()) {\n" +
        "                node = node.children.computeIfAbsent(ch, c -> new TrieNode());\n" +
        "            }\n" +
        "            node.isWord = true;\n" +
        "        }\n" +
        "\n" +
        "        boolean search(String word) {\n" +
        "            TrieNode node = findNode(word);\n" +
        "            return node != null && node.isWord;\n" +
        "        }\n" +
        "\n" +
        "        boolean startsWith(String prefix) {\n" +
        "            return findNode(prefix) != null;\n" +
        "        }\n" +
        "\n" +
        "        TrieNode findNode(String s) {\n" +
        "            TrieNode node = root;\n" +
        "            for (char ch : s.toCharArray()) {\n" +
        "                node = node.children.get(ch);\n" +
        "                if (node == null) return null;\n" +
        "            }\n" +
        "            return node;\n" +
        "        }\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        Trie trie = new Trie();\n" +
        '        String[] words = {"cat", "car", "card", "care", "dog"};\n' +
        "        for (String w : words) trie.insert(w);\n" +
        "\n" +
        '        System.out.println("search(cat): " + trie.search("cat"));\n' +
        '        System.out.println("search(ca): " + trie.search("ca"));\n' +
        '        System.out.println("startsWith(ca): " + trie.startsWith("ca"));\n' +
        '        System.out.println("startsWith(do): " + trie.startsWith("do"));\n' +
        '        System.out.println("startsWith(dot): " + trie.startsWith("dot"));\n' +
        '        System.out.println("search(card): " + trie.search("card"));\n' +
        "    }\n" +
        "}\n",
      output:
        "search(cat): true\nsearch(ca): false\nstartsWith(ca): true\nstartsWith(do): true\n" +
        "startsWith(dot): false\nsearch(card): true",
      python:
        "class TrieNode:\n" +
        "    def __init__(self):\n" +
        "        self.children = {}\n" +
        "        self.is_word = False\n" +
        "\n" +
        "\n" +
        "class Trie:\n" +
        "    def __init__(self):\n" +
        "        self.root = TrieNode()\n" +
        "\n" +
        "    def insert(self, word):\n" +
        "        node = self.root\n" +
        "        for ch in word:\n" +
        "            node = node.children.setdefault(ch, TrieNode())\n" +
        "        node.is_word = True\n" +
        "\n" +
        "    def search(self, word):\n" +
        "        node = self._find_node(word)\n" +
        "        return node is not None and node.is_word\n" +
        "\n" +
        "    def starts_with(self, prefix):\n" +
        "        return self._find_node(prefix) is not None\n" +
        "\n" +
        "    def _find_node(self, s):\n" +
        "        node = self.root\n" +
        "        for ch in s:\n" +
        "            node = node.children.get(ch)\n" +
        "            if node is None:\n" +
        "                return None\n" +
        "        return node\n" +
        "\n" +
        "\n" +
        "trie = Trie()\n" +
        'words = ["cat", "car", "card", "care", "dog"]\n' +
        "for w in words:\n" +
        "    trie.insert(w)\n" +
        "\n" +
        'print("search(cat):", trie.search("cat"))\n' +
        'print("search(ca):", trie.search("ca"))\n' +
        'print("startsWith(ca):", trie.starts_with("ca"))\n' +
        'print("startsWith(do):", trie.starts_with("do"))\n' +
        'print("startsWith(dot):", trie.starts_with("dot"))\n' +
        'print("search(card):", trie.search("card"))\n',
      pythonOutput:
        "search(cat): True\nsearch(ca): False\nstartsWith(ca): True\nstartsWith(do): True\n" +
        "startsWith(dot): False\nsearch(card): True",
    },
    {
      kind: "viz",
      title: "insert(\"car\") then insert(\"card\") — sharing the prefix, then forking",
      caption: "A 'done' node marks isWord=true — a complete word ends there, not just a valid path through it. Only the single child a node actually has is drawn.",
      viz: {
        type: "tree",
        frames: [
          {
            rootId: "root",
            nodes: [
              { id: "root", value: "•", left: "c", right: null },
              { id: "c", value: "c", left: "a", right: null },
              { id: "a", value: "a", left: "r", right: null },
              { id: "r", value: "r", left: null, right: null, state: "done" },
            ],
            note:
              "insert(\"car\"): node=root. 'c' not a child of root, create it, descend. 'a' not a child, " +
              "create, descend. 'r' not a child, create, descend. End of word: mark this node isWord=true. " +
              "Path root->c->a->r now exists, with r's node marked as a complete word.",
          },
          {
            rootId: "root",
            nodes: [
              { id: "root", value: "•", left: "c", right: null },
              { id: "c", value: "c", left: "a", right: null, state: "visiting" },
              { id: "a", value: "a", left: "r", right: null, state: "visiting" },
              { id: "r", value: "r", left: null, right: null, state: "done" },
            ],
            note:
              "insert(\"card\"): node=root. 'c' *is* already a child (from 'car') — reuse it, descend, no " +
              "new node. 'a' already exists — reuse, descend. 'r' already exists — reuse, descend. Now at " +
              "the same 'r' node insert(\"car\") ended on, which is already isWord=true.",
          },
          {
            rootId: "root",
            nodes: [
              { id: "root", value: "•", left: "c", right: null },
              { id: "c", value: "c", left: "a", right: null },
              { id: "a", value: "a", left: "r", right: null },
              { id: "r", value: "r", left: "d", right: null, state: "done" },
              { id: "d", value: "d", left: null, right: null, state: "active" },
            ],
            note:
              "'d' is not yet a child of that 'r' node — create it, descend. End of word: mark this new " +
              "'d' node isWord=true. Result: 'car' and 'card' share all three nodes for c-a-r, forking only " +
              "at the extra 'd'.",
          },
          {
            rootId: "root",
            nodes: [
              { id: "root", value: "•", left: "c", right: null },
              { id: "c", value: "c", left: "a", right: null, state: "visiting" },
              { id: "a", value: "a", left: "r", right: null, state: "compare" },
              { id: "r", value: "r", left: "d", right: null, state: "done" },
              { id: "d", value: "d", left: null, right: null, state: "done" },
            ],
            note:
              "search(\"ca\"): walks c, a successfully (both exist), reaching the 'a' node — but that " +
              "node's isWord is false (only 'car' and 'card' were marked, not 'ca'), so search returns " +
              "false even though the path exists.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "That last step is the detail beginners most often miss: `startsWith` only checks that the *path* " +
        "exists, but `search` additionally requires the node at the end of that path to be flagged `isWord`. " +
        "'ca' is a valid path through this trie (because 'car' and 'card' pass through it), but 'ca' itself " +
        "was never inserted as a complete word, so it correctly fails `search` while still passing " +
        "`startsWith`.",
    },
    {
      kind: "table",
      head: ["Operation", "Time", "Space", "Why"],
      rows: [
        [
          "insert(word), length L",
          "O(L)",
          "O(L) worst case",
          "Walks or creates exactly one node per character of the word; shared prefixes with existing " +
            "words reuse nodes instead of creating new ones.",
        ],
        [
          "search(word) / startsWith(prefix), length L",
          "O(L)",
          "O(1) extra",
          "Follows exactly L child-map lookups down from the root — independent of how many other words " +
            "are stored in the trie.",
        ],
        [
          "Same lookup using a HashSet<String> of n words",
          "O(L) average",
          "O(total characters)",
          "Hashing the whole string still costs O(L), matching a trie for exact search — but a HashSet " +
            "cannot answer prefix queries without scanning all n entries.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Confusing `startsWith` with `search` — a path existing in the trie only means some stored word " +
          "passes through it, not that the path itself was inserted as a complete word; only the `isWord` " +
          "flag distinguishes the two.",
        "Forgetting to mark `isWord = true` at the end of `insert` — without it, every search silently fails, " +
          "even though the characters were all correctly inserted.",
        "Using a fixed-size array of 26 children (for lowercase English letters) without considering the " +
          "actual character set needed — a HashMap of children, as used here, handles any characters " +
          "(digits, punctuation, Unicode) without wasted space, at a small constant-factor cost.",
        "Assuming a trie is always more space-efficient than a HashSet — for a small or barely-overlapping " +
          "word list, a trie's per-character node overhead can cost *more* memory than simply storing the " +
          "strings directly; its advantage is prefix queries and shared-prefix compression, not guaranteed " +
          "smaller size.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A trie's paths spell prefixes; a node's `isWord` flag is what marks a complete stored word, " +
          "separate from the path merely existing.",
        "Words sharing a prefix share the same trie nodes for that prefix, forking only where they first " +
          "differ.",
        "search/startsWith/insert are all O(L) — the length of the word — independent of how many other " +
          "words are stored.",
        "A trie answers 'what starts with this prefix?' efficiently; a HashSet cannot, without scanning " +
          "every entry.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Implement a trie with insert/search/startsWith\" is asked directly often enough that this " +
          "chapter's code is close to the expected answer verbatim — know the isWord-versus-path distinction " +
          "cold.",
        "Autocomplete and typeahead search (suggesting completions as a user types a prefix) is the trie's " +
          "signature real-world use, and a very common follow-up: 'given a prefix, list all stored words " +
          "starting with it', solved with a DFS from the prefix's node.",
        "\"Word search\" style problems on a grid, checking many candidate words against a shared dictionary, " +
          "often use a trie to prune the search early — the moment a partial path isn't a prefix of any word, " +
          "the whole branch can be abandoned.",
      ],
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd extend this trie to list every stored word starting with a " +
          "given prefix, using a traversal from the prefix's node.",
        "Explain how you would delete a word from a trie without breaking other words that share part of " +
          "its path — which nodes are safe to remove, and which aren't?",
        "Describe how a trie could be used to check whether any prefix of a given string is itself a " +
          "complete stored word (useful for word-break style problems).",
        "Explain, in your own words, a case where a plain HashSet of strings would be a better choice than a " +
          "trie, and why.",
      ],
    },
    {
      kind: "quiz",
      question: "What does search(\"ca\") returning false mean, given that \"car\" and \"card\" are both in the trie?",
      options: [
        "The trie is broken: it should return true, because 'ca' is a valid prefix of two stored words.",
        "The path c, a exists because 'car' and 'card' pass through it, but its last node was never marked isWord.",
        "search() only works for words of length 3 or more, so any shorter word is reported as missing.",
        "The HashMap lookups for 'c' and then 'a' both failed, so the walk ended before it reached the end of the word.",
      ],
      answer: 1,
      why:
        "startsWith checks path existence; search additionally requires isWord to be true at the final " +
        "node. 'ca' is a valid path (shared with 'car'/'card') but was never itself inserted as a complete " +
        "word.",
    },
    {
      kind: "quiz",
      question: "Why is a trie lookup's time complexity O(L) — the word's length — rather than depending on how many words are stored?",
      options: [
        "Because a trie only ever stores a single word at a time, so there is nothing else for a lookup to search through or compare against.",
        "Each character costs one child-map access, so the walk is bounded by the word's own length, however many other words share the path.",
        "Because Java caches every trie lookup automatically, so repeated searches for a word cost only a single step each time.",
        "It isn't O(L): it is actually O(n), where n is the number of stored words, because every stored word is compared in turn.",
      ],
      answer: 1,
      why:
        "The walk descends exactly one level per character of the query string; the total number of other " +
        "words in the trie affects how much the structure branches, not how many steps a single lookup " +
        "takes.",
    },
    {
      kind: "quiz",
      question: "What is the main capability a trie has that a HashSet<String> does not?",
      options: [
        "Faster exact-word lookup than a HashSet",
        "The ability to efficiently answer 'does any stored word start with this prefix?' without scanning " +
          "every stored word",
        "The ability to store duplicate words",
        "Automatic alphabetical sorting of all operations",
      ],
      answer: 1,
      why:
        "A HashSet can check exact membership about as fast as a trie, but has no structural notion of " +
        "shared prefixes — answering a prefix query would need to check every stored string individually.",
    },
  ],
};
