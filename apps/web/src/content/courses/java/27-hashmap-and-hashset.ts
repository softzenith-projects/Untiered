import type { Chapter } from "@/content/courses/types";

export const chapterHashMapHashSet: Chapter = {
  slug: "hashmap-and-hashset",
  title: "HashMap and HashSet: How Hashing Actually Works",
  summary:
    "Why a HashMap lookup is fast regardless of size, and the one rule that trips up almost everyone using " +
    "a custom class as a key or set element: overriding equals() without hashCode() breaks everything.",
  minutes: 16,
  blocks: [
    {
      kind: "p",
      text:
        "`HashMap.get(key)` and `HashSet.contains(element)` are famously fast — no matter how many entries " +
        "are stored, a lookup doesn't meaningfully slow down as the collection grows. That speed isn't " +
        "magic; it comes from **hashing**, and understanding it is the difference between using `HashMap` " +
        "correctly and hitting one of the most common, most confusing bugs in Java.",
    },
    { kind: "h", text: "The library shelf analogy" },
    {
      kind: "analogy",
      title: "A library that shelves books by a formula, not alphabetically",
      text:
        "Picture a library that doesn't search shelf by shelf for a book — instead, every book's title runs " +
        "through a fixed formula that spits out a shelf number, and the book always goes on exactly that " +
        "shelf. To find a book again, you run its title through the same formula, get the same shelf " +
        "number, and walk straight there — no searching required. That formula is a **hash function**, and " +
        "the shelf number is a **hash code**. A `HashMap` (or `HashSet`) works the same way: every key runs " +
        "through `.hashCode()`, which decides which internal \"shelf\" (bucket) it lands on, so `get()` can " +
        "jump almost straight to the right bucket instead of checking every entry one by one. The catch: if " +
        "two different-looking books are actually *the same edition* (two `Point` objects both meaning " +
        "`(1,2)`), the library needs them to land on the *same* shelf and be recognised as duplicates — " +
        "which only works if the formula (`hashCode()`) and the \"are these actually the same book?\" check " +
        "(`equals()`) **agree** with each other. Where the analogy stops: a real librarian would eyeball two " +
        "identical books and just know; Java has no such judgement — it relies entirely on whatever " +
        "`equals()`/`hashCode()` your class defines, or the default ones inherited from `Object`, which " +
        "compare by identity, not content.",
    },
    {
      kind: "code",
      caption:
        "A Point class with equals()/hashCode() overridden correctly, a word-count HashMap, and a broken " +
        "class with no equals()/hashCode() showing what goes wrong.",
      code:
        "import java.util.HashMap;\n" +
        "import java.util.HashSet;\n" +
        "import java.util.Objects;\n" +
        "import java.util.Set;\n" +
        "import java.util.Map;\n" +
        "\n" +
        "class Point {\n" +
        "    int x;\n" +
        "    int y;\n" +
        "\n" +
        "    Point(int x, int y) {\n" +
        "        this.x = x;\n" +
        "        this.y = y;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    public boolean equals(Object o) {\n" +
        "        if (this == o) return true;\n" +
        "        if (!(o instanceof Point)) return false;\n" +
        "        Point p = (Point) o;\n" +
        "        return x == p.x && y == p.y;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    public int hashCode() {\n" +
        "        return Objects.hash(x, y);\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class HashDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        Set<Point> points = new HashSet<>();\n" +
        "        points.add(new Point(1, 2));\n" +
        "        points.add(new Point(1, 2));\n" +
        "        points.add(new Point(3, 4));\n" +
        '        System.out.println("Set size (equal points deduped): " + points.size());\n' +
        "\n" +
        "        Map<String, Integer> wordCount = new HashMap<>();\n" +
        '        String[] words = { "the", "cat", "sat", "the", "mat", "the" };\n' +
        "        for (String w : words) {\n" +
        "            wordCount.put(w, wordCount.getOrDefault(w, 0) + 1);\n" +
        "        }\n" +
        '        System.out.println("\'the\' occurrences: " + wordCount.get("the"));\n' +
        '        System.out.println("\'cat\' occurrences: " + wordCount.get("cat"));\n' +
        '        System.out.println("Unknown key lookup: " + wordCount.get("dog"));\n' +
        "\n" +
        "        class NoEqualsPoint {\n" +
        "            int x, y;\n" +
        "            NoEqualsPoint(int x, int y) { this.x = x; this.y = y; }\n" +
        "        }\n" +
        "        Set<NoEqualsPoint> broken = new HashSet<>();\n" +
        "        broken.add(new NoEqualsPoint(1, 1));\n" +
        "        broken.add(new NoEqualsPoint(1, 1));\n" +
        '        System.out.println("Without equals/hashCode, size is: " + broken.size());\n' +
        "    }\n" +
        "}\n",
      output:
        "Set size (equal points deduped): 2\n" +
        "'the' occurrences: 3\n" +
        "'cat' occurrences: 1\n" +
        "Unknown key lookup: null\n" +
        "Without equals/hashCode, size is: 2",
    },
    {
      kind: "p",
      text:
        "`points` ends up with size `2`, not `3` — the two `Point(1, 2)` objects are considered duplicates " +
        "because `Point` overrides both `equals()` (says they're equal when `x` and `y` match) and " +
        "`hashCode()` (produces the same hash for equal points, via `Objects.hash(x, y)`, a standard " +
        "library helper for exactly this). `wordCount.getOrDefault(w, 0) + 1` is the standard idiom for " +
        "counting occurrences: look up the running count, defaulting to `0` if the word hasn't been seen, " +
        "and add one. `wordCount.get(\"dog\")` returns `null`, not `0` or an exception — a `Map` lookup for " +
        "a missing key simply returns `null`, which is exactly why `getOrDefault` exists for counting " +
        "patterns like this one.",
    },
    { kind: "h", text: "The equals()/hashCode() contract" },
    {
      kind: "p",
      text:
        "`NoEqualsPoint` — a local class with no overridden `equals()`/`hashCode()` — behaves completely " +
        "differently: `broken.size()` is `2`, even though both objects hold identical `x` and `y` values. " +
        "Without an override, both methods are inherited from `Object`, and `Object`'s versions compare by " +
        "**identity** — \"is this the literal same object?\" — never by content. Two separately created " +
        "`NoEqualsPoint(1, 1)` objects are, by that definition, unequal, so the set sees no duplicate to " +
        "reject. This is the single most common source of \"my HashSet/HashMap isn't deduplicating my " +
        "objects\" confusion, and the fix is always the same: override both `equals()` and `hashCode()` " +
        "together, consistently, whenever you want a class's objects compared by their content rather than " +
        "their identity.",
    },
    {
      kind: "viz",
      title: "wordCount's buckets, filling up as {the, cat, sat, the, mat, the} is inserted",
      caption:
        "Bucket numbers here are illustrative, not real Java hash codes — the point is that the same key " +
        "always lands in the same bucket, so get() can jump straight there.",
      viz: {
        type: "table",
        frames: [
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [[null], [null], ["the:1"], [null], [null]],
            highlight: [[2, 0]],
            note: "\"the\" hashes to bucket 2. wordCount is now {the:1}.",
          },
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [["cat:1"], [null], ["the:1"], [null], [null]],
            highlight: [[0, 0]],
            note: "\"cat\" hashes to bucket 0. wordCount is now {the:1, cat:1}.",
          },
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [["cat:1, sat:1"], [null], ["the:1"], [null], [null]],
            highlight: [[0, 0]],
            note: "\"sat\" also hashes to bucket 0 — a collision. Both keys are stored side by side in that bucket.",
          },
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [["cat:1, sat:1"], [null], ["the:2"], [null], [null]],
            highlight: [[2, 0]],
            note: "\"the\" is seen again: getOrDefault bumps its count to 2, in the same bucket — no new entry is created.",
          },
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [["cat:1, sat:1"], [null], ["the:2"], [null], ["mat:1"]],
            highlight: [[4, 0]],
            note: "\"mat\" hashes to bucket 4.",
          },
          {
            rowLabels: ["bucket 0", "bucket 1", "bucket 2", "bucket 3", "bucket 4"],
            colLabels: ["contents"],
            rows: [["cat:1, sat:1"], [null], ["the:3"], [null], ["mat:1"]],
            highlight: [[2, 0]],
            note:
              "Final: \"the\" seen a third time, count 3. get(\"the\") jumps straight to bucket 2 instead of " +
              "scanning every entry — that's why lookup stays fast regardless of size.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "Delete the `hashCode()` method from `Point` and run. The set's size goes from 2 to 3, even " +
        "though `equals()` is still there: the set never compares two points that land in different " +
        "buckets.",
      starter:
        "import java.util.HashMap;\n" +
        "import java.util.HashSet;\n" +
        "import java.util.Objects;\n" +
        "import java.util.Set;\n" +
        "import java.util.Map;\n" +
        "\n" +
        "public class HashDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        Set<Point> points = new HashSet<>();\n" +
        "        points.add(new Point(1, 2));\n" +
        "        points.add(new Point(1, 2));\n" +
        "        points.add(new Point(3, 4));\n" +
        '        System.out.println("Set size (equal points deduped): " + points.size());\n' +
        "\n" +
        "        Map<String, Integer> wordCount = new HashMap<>();\n" +
        '        String[] words = { "the", "cat", "sat", "the", "mat", "the" };\n' +
        "        for (String w : words) {\n" +
        "            wordCount.put(w, wordCount.getOrDefault(w, 0) + 1);\n" +
        "        }\n" +
        "        System.out.println(\"'the' occurrences: \" + wordCount.get(\"the\"));\n" +
        "        System.out.println(\"'cat' occurrences: \" + wordCount.get(\"cat\"));\n" +
        '        System.out.println("Unknown key lookup: " + wordCount.get("dog"));\n' +
        "\n" +
        "        class NoEqualsPoint {\n" +
        "            int x, y;\n" +
        "            NoEqualsPoint(int x, int y) { this.x = x; this.y = y; }\n" +
        "        }\n" +
        "        Set<NoEqualsPoint> broken = new HashSet<>();\n" +
        "        broken.add(new NoEqualsPoint(1, 1));\n" +
        "        broken.add(new NoEqualsPoint(1, 1));\n" +
        '        System.out.println("Without equals/hashCode, size is: " + broken.size());\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Point {\n" +
        "    int x;\n" +
        "    int y;\n" +
        "\n" +
        "    Point(int x, int y) {\n" +
        "        this.x = x;\n" +
        "        this.y = y;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    public boolean equals(Object o) {\n" +
        "        if (this == o) return true;\n" +
        "        if (!(o instanceof Point)) return false;\n" +
        "        Point p = (Point) o;\n" +
        "        return x == p.x && y == p.y;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    public int hashCode() {\n" +
        "        return Objects.hash(x, y);\n" +
        "    }\n" +
        "}\n",
      expectedOutput:
        "Set size (equal points deduped): 2\n" +
        "'the' occurrences: 3\n" +
        "'cat' occurrences: 1\n" +
        "Unknown key lookup: null\n" +
        "Without equals/hashCode, size is: 2",
    },
    {
      kind: "pitfall",
      items: [
        "Overriding `equals()` without also overriding `hashCode()` — this actively breaks HashMap/HashSet: " +
          "two objects can report `equals()` true yet land in different buckets (different, inconsistent " +
          "hash codes), so the set never even compares them and treats them as distinct.",
        "Using a mutable object as a HashMap key or HashSet element, then changing a field that " +
          "`hashCode()` depends on after inserting it — the object's hash code changes, but its position in " +
          "the internal buckets doesn't move, so a later lookup for it can fail to find it at all.",
        "Assuming `Map.get()` on a missing key throws an exception — it doesn't; it quietly returns `null`, " +
          "which is why unboxing the result directly (`int x = map.get(missingKey);`) can throw a " +
          "`NullPointerException`, per the wrapper-classes chapter.",
        "Writing `hashCode()` that ignores fields `equals()` actually compares (or vice versa) — the two " +
          "must be based on the same fields, or the contract breaks in exactly the way `NoEqualsPoint` shows.",
      ],
    },
    {
      kind: "remember",
      items: [
        "hashCode() decides which internal bucket an object lands in; equals() confirms true duplicates within a bucket.",
        "The contract: equal objects (by equals()) MUST return the same hashCode(); override both together, always.",
        "Object's default equals()/hashCode() compare by identity, not content — override them for content comparison.",
        "getOrDefault(key, fallback) avoids a null result when a key might be missing — standard for counting patterns.",
        "Map.get(missingKey) returns null; it never throws by itself.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Why must you override hashCode() whenever you override equals()?\" is asked constantly, and " +
          "precisely — answer with the bucket/shelf idea: mismatched hash codes mean equal objects can end " +
          "up in different buckets and never get compared at all.",
        "\"How does HashMap achieve near-constant-time get()?\" — the hash-code-to-bucket idea directly, " +
          "with the caveat that many collisions in one bucket degrade it.",
        "You may be given a class with only `equals()` overridden and asked why a HashSet isn't " +
          "deduplicating it — the NoEqualsPoint pattern above is exactly that scenario.",
      ],
    },
    {
      kind: "quiz",
      question: "A class overrides equals() to compare by value but never overrides hashCode(). What's the practical effect on a HashSet of that class?",
      options: [
        "It works fine, because HashSet compares every pair of elements using equals() alone.",
        "Equal objects may land in different buckets and never get compared, so they're treated as distinct.",
        "It fails to compile",
        "HashSet automatically generates a matching hashCode() from the fields that equals() compares.",
      ],
      answer: 1,
      why:
        "hashCode() decides which bucket an object goes in; equals() is only checked between objects that " +
        "land in the same bucket. Without a matching hashCode() override, equal objects can hash " +
        "differently and never be compared at all, breaking deduplication.",
    },
    {
      kind: "quiz",
      question: "What does `wordCount.get(\"dog\")` return if \"dog\" was never put into the map?",
      options: ["0", "null", "It throws NoSuchElementException", "-1"],
      answer: 1,
      why:
        "A HashMap lookup for a key that was never inserted returns null, not an exception and not a " +
        "default numeric value — this is exactly why getOrDefault exists, to supply a fallback in one call.",
    },
    {
      kind: "quiz",
      question: "What is `Objects.hash(x, y)` used for in the Point class?",
      options: [
        "To compare two Points for equality directly, field by field, without calling equals().",
        "To produce one combined hash code from several fields, consistent with equals().",
        "To sort a list of Points by their hash values, so equal points sit side by side.",
        "It's unrelated to hashing despite the name; it only builds a string from the fields.",
      ],
      answer: 1,
      why:
        "Objects.hash(...) is a standard library helper that combines several fields into one hash code — " +
        "using the same fields equals() compares is exactly what keeps the two methods consistent with each other.",
    },
  ],
};
