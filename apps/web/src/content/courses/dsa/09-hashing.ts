import type { Chapter } from "@/content/courses/types";

export const chapterHashing: Chapter = {
  slug: "hashing",
  title: "Hashing: How HashMap and HashSet Actually Work",
  summary:
    "A hash function turns a key into a bucket number so lookup skips straight to the right shelf — what " +
    "a collision is, why it happens, and the grouping and counting patterns built on top.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "You've used `HashMap` and `HashSet` throughout this course already, trusting that `.get()` and " +
        "`.contains()` are fast without asking why. This chapter opens that box: what actually happens when " +
        "you call `map.put(\"cat\", 1)`, why it's close to O(1), and what a **collision** is — because " +
        "understanding the mechanism is what lets you use hashing as a *pattern*, not just a library call.",
    },
    { kind: "h", text: "The numbered-locker-room analogy" },
    {
      kind: "analogy",
      title: "A gym with numbered lockers assigned by a formula",
      text:
        "Imagine a gym that assigns each member a locker not by queue order, but by a fixed formula applied " +
        "to their membership number — say, membership number mod 100 gives the locker number. Finding your " +
        "locker never means checking every locker in the room: you compute the formula once and walk " +
        "straight there. That formula is a **hash function**: it turns a key (the membership number, or a " +
        "string like \"cat\") into a fixed 'bucket' index. The catch: two different membership numbers can " +
        "land on the *same* locker number by the formula (137 mod 100 and 237 mod 100 both give 37) — " +
        "that's a **collision**, and the gym has to have a plan for it (a small shelf inside locker 37 that " +
        "holds more than one bag). A `HashMap` does exactly this: it hashes the key to a bucket index, and " +
        "when two keys land in the same bucket, it keeps a short list there instead of overwriting. Where " +
        "the analogy stops: a gym's locker count is fixed; a `HashMap` grows its bucket count automatically " +
        "as it fills up, specifically to keep those per-bucket lists short.",
    },
    { kind: "h", text: "A hash function and a real collision, by hand" },
    {
      kind: "code",
      caption:
        "A deliberately simple hash function (sum of character codes, mod bucket count) showing a real " +
        "collision, and a HashMap-based grouping pattern.",
      code:
        "import java.util.ArrayList;\n" +
        "import java.util.HashMap;\n" +
        "import java.util.List;\n" +
        "import java.util.Map;\n" +
        "\n" +
        "public class HashingDemo {\n" +
        "    static int simpleHash(String s, int bucketCount) {\n" +
        "        int sum = 0;\n" +
        "        for (char c : s.toCharArray()) {\n" +
        "            sum += c;\n" +
        "        }\n" +
        "        return sum % bucketCount;\n" +
        "    }\n" +
        "\n" +
        "    static Map<String, List<String>> groupAnagrams(String[] words) {\n" +
        "        Map<String, List<String>> groups = new HashMap<>();\n" +
        "        for (String word : words) {\n" +
        "            char[] letters = word.toCharArray();\n" +
        "            java.util.Arrays.sort(letters);\n" +
        "            String key = new String(letters);\n" +
        "            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(word);\n" +
        "        }\n" +
        "        return groups;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int buckets = 5;\n" +
        "        String[] names = {\"cat\", \"act\", \"dog\", \"god\", \"rat\"};\n" +
        "        for (String name : names) {\n" +
        '            System.out.println(name + " -> bucket " + simpleHash(name, buckets));\n' +
        "        }\n" +
        "\n" +
        "        Map<String, List<String>> groups = groupAnagrams(names);\n" +
        '        System.out.println("groups: " + groups);\n' +
        "    }\n" +
        "}\n",
      output:
        "cat -> bucket 2\n" +
        "act -> bucket 2\n" +
        "dog -> bucket 4\n" +
        "god -> bucket 4\n" +
        "rat -> bucket 2\n" +
        "groups: {art=[rat], act=[cat, act], dgo=[dog, god]}",
      python:
        "from collections import defaultdict\n" +
        "\n" +
        "\n" +
        "def simple_hash(s, bucket_count):\n" +
        "    return sum(ord(c) for c in s) % bucket_count\n" +
        "\n" +
        "\n" +
        "def group_anagrams(words):\n" +
        "    groups = defaultdict(list)\n" +
        "    for word in words:\n" +
        '        key = "".join(sorted(word))\n' +
        "        groups[key].append(word)\n" +
        "    return dict(groups)\n" +
        "\n" +
        "\n" +
        "buckets = 5\n" +
        'names = ["cat", "act", "dog", "god", "rat"]\n' +
        "for name in names:\n" +
        '    print(f"{name} -> bucket {simple_hash(name, buckets)}")\n' +
        "\n" +
        "groups = group_anagrams(names)\n" +
        'print("groups:", groups)\n',
      pythonOutput:
        "cat -> bucket 2\n" +
        "act -> bucket 2\n" +
        "dog -> bucket 4\n" +
        "god -> bucket 4\n" +
        "rat -> bucket 2\n" +
        "groups: {'act': ['cat', 'act'], 'dgo': ['dog', 'god'], 'art': ['rat']}",
    },
    {
      kind: "viz",
      title: 'simpleHash("cat", 5) and simpleHash("rat", 5) landing in the same bucket',
      caption: "Bucket 2 fills up with three unrelated-looking words — each one really did hash there, for its own reason.",
      viz: {
        type: "table",
        frames: [
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [[null], [null], ["cat"], [null], [null]],
            highlight: [[2, 0]],
            note: "\"cat\": 'c'(99) + 'a'(97) + 't'(116) = 312. 312 % 5 = 2 — placed in bucket 2.",
          },
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [[null], [null], ["cat, rat"], [null], [null]],
            highlight: [[2, 0]],
            note:
              "\"rat\": 'r'(114) + 'a'(97) + 't'(116) = 327. 327 % 5 = 2 — also bucket 2. Both land there " +
              "despite \"cat\" and \"rat\" being unrelated words — a genuine collision, not because they're " +
              "anagrams.",
          },
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [[null], [null], ["cat, rat, act"], [null], [null]],
            highlight: [[2, 0]],
            note:
              "\"act\" sums to the same 312 as \"cat\" (same letters, same character codes) and also lands " +
              "in bucket 2, but for a reason that does make sense. A real HashMap stores all three in " +
              "bucket 2's internal list, and checking whether \"cat\" is present means checking that short " +
              "list, not the whole table.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "This is exactly why `HashMap` lookup is described as O(1) *on average*, not always: as long as the " +
        "hash function spreads keys out fairly evenly, and the table grows to keep each bucket's list " +
        "short, a lookup is 'compute the hash, check a short list' — close to constant time. If many keys " +
        "collide into the same bucket (a poor hash function, or a deliberately crafted adversarial input), " +
        "that bucket's list can grow long, and lookups inside it degrade toward O(n) in the worst case. " +
        "Java's real `String.hashCode()` and `Object.hashCode()` are designed to spread typical keys well, " +
        "which is why this worst case is rare in practice — but it isn't impossible, which is worth knowing " +
        "exists even without needing to defend against it day to day.",
    },
    {
      kind: "table",
      head: ["Operation", "Average time", "Worst case", "Why"],
      rows: [
        [
          "HashMap get/put/contains",
          "O(1)",
          "O(n)",
          "Average case: hash spreads keys evenly, each bucket's list stays short. Worst case: many keys " +
            "collide into one bucket, degrading to a linear scan of that bucket's list.",
        ],
        [
          "groupAnagrams over n words, average length k",
          "O(n × k log k)",
          "—",
          "Each of the n words is sorted (O(k log k)) to build its key, then inserted into the map in " +
            "roughly O(1) average.",
        ],
      ],
    },
    { kind: "h", text: "The recurring pattern: HashMap as memory" },
    {
      kind: "p",
      text:
        "Every hashing-based technique in this course — the duplicate check from chapter 1, Two Sum's " +
        "optimisation, `groupAnagrams` above — shares one shape: use a `HashMap` or `HashSet` to *remember* " +
        "something about what's already been processed, so a later step can check it in O(1) instead of " +
        "rescanning. \"Have I seen this value?\" (`HashSet`), \"what index did I last see this value at?\" " +
        "(`HashMap<value, index>`), \"which group does this belong to?\" (`HashMap<key, List>`) are all the " +
        "same underlying move: trade O(n) memory for turning an O(n) rescan into an O(1) lookup.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add a repeated word of your own to the sentence and run again — the dictionary catches it without " +
        "a second pass over the whole list.",
      starter:
        'words = "the quick brown fox jumps over the lazy dog the fox runs".split()\n' +
        "counts = {}\n" +
        "for word in words:\n" +
        "    counts[word] = counts.get(word, 0) + 1\n" +
        "\n" +
        "for word, count in sorted(counts.items()):\n" +
        "    print(word, count)\n",
      expectedOutput: "brown 1\ndog 1\nfox 2\njumps 1\nlazy 1\nover 1\nquick 1\nruns 1\nthe 3",
    },
    {
      kind: "pitfall",
      items: [
        "Using a mutable object as a HashMap key, or one whose `hashCode()`/`equals()` aren't consistent " +
          "with each other — if an object's hash changes after it's inserted, the map can no longer find " +
          "it, since it now hashes to a different bucket than the one it was actually stored in.",
        "Assuming HashMap preserves insertion order — it doesn't; use `LinkedHashMap` if order matters, or " +
          "sort the keys explicitly when order is needed for output.",
        "Treating O(1) as a hard guarantee rather than an average — for interview purposes this is almost " +
          "always fine to assume, but knowing the worst case exists (and why) is the deeper answer when " +
          "asked directly.",
        "Reaching for a HashMap when the keys are small, dense integers (say, 0 to 25) — a plain array " +
          "indexed directly is simpler and has zero collision risk; hashing is the right tool when keys " +
          "aren't naturally small contiguous integers.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A hash function turns a key into a bucket index; a collision is two different keys landing in the " +
          "same bucket.",
        "HashMap/HashSet operations are O(1) on average (keys spread evenly across buckets) but O(n) in the " +
          "worst case (many keys colliding into one bucket).",
        "The recurring pattern: use a HashMap/HashSet to remember what's already been seen, turning a " +
          "rescan into a lookup.",
        "HashMap does not preserve insertion order — use LinkedHashMap, or sort explicitly, when order " +
          "matters.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Can you avoid the nested loop / repeated scan?\" is very often answerable with \"remember what " +
          "we've seen in a HashMap/HashSet\" — recognising this as a named, reusable pattern speeds up " +
          "recognising it under pressure.",
        "\"What's the worst-case complexity of a HashMap lookup, and why isn't it always O(1)?\" tests " +
          "whether the average-case claim is understood, not just recited.",
        "Grouping problems (anagrams, items sharing a computed property) are a very common way this pattern " +
          "is tested, using a HashMap<computed key, List<items>>.",
      ],
    },
    {
      kind: "quiz",
      question: "What is a hash collision?",
      options: [
        "When a HashMap runs out of memory and cannot accept any more keys",
        "When two different keys map to the same bucket index",
        "When a key is inserted twice with the same value, so the second put is repeated",
        "An error that only happens with String keys, because other types hash differently",
      ],
      answer: 1,
      why:
        "A collision is exactly two distinct keys landing in the same bucket after hashing — it's expected " +
        "and handled (typically by keeping a short list per bucket), not an error condition.",
    },
    {
      kind: "quiz",
      question: "Why is HashMap lookup described as O(1) on average rather than always?",
      options: [
        "Because Java's HashMap is poorly implemented",
        "Because when many keys collide into the same bucket, checking that bucket's contents can " +
          "degrade toward a linear scan",
        "Because HashMap only works correctly for small inputs",
        "Because get() and put() always have different costs",
      ],
      answer: 1,
      why:
        "The O(1) claim relies on keys spreading evenly across buckets so each bucket's internal list " +
        "stays short. Heavy collisions make that list long, and searching a long list degrades toward " +
        "O(n) — the worst case the average-case claim excludes.",
    },
    {
      kind: "quiz",
      question: "In groupAnagrams, why does sorting each word's letters before using it as a map key work?",
      options: [
        "Sorting is unrelated to correctness; it's only there so the groups are printed in a tidy order.",
        "Anagrams have identical sorted letters, so the sorted form is a key shared by the whole group.",
        "HashMap requires all of its keys to be sorted internally, so the letters must be sorted before use.",
        "Sorting makes the hash function run faster, because shorter ordered strings need fewer steps to hash.",
      ],
      answer: 1,
      why:
        "Anagrams contain exactly the same letters in some order — sorting removes the 'order' part, so " +
        "every anagram of the same word produces an identical sorted string, which is exactly what makes " +
        "it a valid shared grouping key.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Given a list of exam scores, describe, in your own words, a HashMap-based approach to find the " +
          "single score that appears most often.",
        "Given two arrays, describe a HashSet-based approach to find all values present in both — and " +
          "explain why this beats checking every element of one array against every element of the other.",
        "Describe how you'd adapt Two Sum's HashMap approach (from an earlier chapter) to instead count how " +
          "many pairs of numbers sum to exactly a target, allowing duplicate values in the input.",
        "Explain, in your own words, why a HashMap keyed on a student's roll number (a small, dense integer " +
          "range like 1-60) could reasonably be replaced by a plain array instead — what's gained and what, " +
          "if anything, is lost?",
      ],
    },
  ],
};
