import type { Chapter } from "@/content/courses/types";

export const chapterCollectionsOverview: Chapter = {
  slug: "collections-overview",
  title: "Collections Overview: List, Set, Map",
  summary:
    "Arrays have a fixed size and only one shape. The Collections Framework gives you growable, purpose-" +
    "built containers — an ordered list, a no-duplicates set, a key-to-value map — chosen by what you " +
    "actually need, not by habit.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "You've used arrays since chapter 10 — fixed size, decided at creation, no built-in way to add or " +
        "remove an element without manually shifting everything. Most real problems don't know their size " +
        "in advance, and many need behaviour arrays don't offer at all: no duplicates, or looking something " +
        "up by a name instead of a numeric index. The **Collections Framework** is Java's standard toolbox " +
        "of containers built for exactly these needs.",
    },
    { kind: "h", text: "The register, the guest list, the dictionary" },
    {
      kind: "analogy",
      title: "A class register, a guest list at the gate, and a dictionary",
      text:
        "A class **register** lists students in the order they're enrolled, and the same name genuinely can " +
        "appear twice if a student is entered by mistake twice — order matters, duplicates are allowed. A " +
        "**guest list** at an event's entrance works differently: the gatekeeper only cares whether a name " +
        "*is on the list or not* — writing the same name down twice tells the gatekeeper nothing new, and a " +
        "well-run gate keeps each name exactly once. A **dictionary** is different again: you don't look up " +
        "a word by its position on the page — you look it up by the word itself, and it hands you back one " +
        "specific meaning for it. These are precisely `List` (register — ordered, duplicates allowed), " +
        "`Set` (guest list — no duplicates, membership is what matters), and `Map` (dictionary — look up a " +
        "value by a key, never by position). Where the analogy stops: Java's `List`, `Set`, and `Map` are " +
        "*interfaces* — the register/guest-list/dictionary behaviour is a promise, with several different " +
        "concrete implementations (`ArrayList`, `HashSet`, `HashMap`, and others) each honouring that " +
        "promise with different internal trade-offs, covered in the next two chapters.",
    },
    {
      kind: "code",
      caption: "The same three names, stored three different ways, showing exactly what each guarantees.",
      code:
        "import java.util.ArrayList;\n" +
        "import java.util.HashSet;\n" +
        "import java.util.HashMap;\n" +
        "import java.util.List;\n" +
        "import java.util.Set;\n" +
        "import java.util.Map;\n" +
        "\n" +
        "public class CollectionsOverviewDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        List<String> names = new ArrayList<>();\n" +
        '        names.add("Priya");\n' +
        '        names.add("Arjun");\n' +
        '        names.add("Priya");\n' +
        '        System.out.println("List (ordered, duplicates allowed): " + names);\n' +
        "\n" +
        "        Set<String> uniqueNames = new HashSet<>(names);\n" +
        '        System.out.println("Set size after dedup: " + uniqueNames.size());\n' +
        "\n" +
        "        Map<String, Integer> marksByName = new HashMap<>();\n" +
        '        marksByName.put("Priya", 87);\n' +
        '        marksByName.put("Arjun", 91);\n' +
        '        marksByName.put("Priya", 90);\n' +
        "        System.out.println(\"Map (Priya's latest marks): \" + marksByName.get(\"Priya\"));\n" +
        '        System.out.println("Map size (no duplicate keys): " + marksByName.size());\n' +
        "\n" +
        "        for (String name : names) {\n" +
        '            System.out.print(name + " ");\n' +
        "        }\n" +
        "        System.out.println();\n" +
        "    }\n" +
        "}\n",
      output:
        "List (ordered, duplicates allowed): [Priya, Arjun, Priya]\n" +
        "Set size after dedup: 2\n" +
        "Map (Priya's latest marks): 90\n" +
        "Map size (no duplicate keys): 2\n" +
        "Priya Arjun Priya",
      tryIt: {
        language: "java",
        prompt:
          "Add \"Neha\" to `names` twice. Before you run, predict the list, the set's size, and what the " +
          "loop prints.",
      },
    },
    {
      kind: "p",
      text:
        "`names` (a `List<String>`) keeps \"Priya\" twice, in insertion order — printing it shows " +
        "`[Priya, Arjun, Priya]` exactly as added. `new HashSet<>(names)` builds a `Set` from that same " +
        "list, and duplicates collapse automatically: `.size()` is `2`, not `3`, because adding \"Priya\" a " +
        "second time to a set is a no-op — it's already a member. `marksByName.put(\"Priya\", 90)` after an " +
        "earlier `put(\"Priya\", 87)` doesn't create a second entry — a `Map` allows only one value per key, " +
        "so the second `put` *replaces* the first, and `.get(\"Priya\")` correctly returns the latest, `90`.",
    },
    {
      kind: "table",
      head: ["Interface", "Ordered?", "Duplicates?", "Look up by", "Common implementation"],
      rows: [
        ["List", "Yes — insertion order preserved", "Yes", "Numeric index (0, 1, 2, ...)", "ArrayList, LinkedList"],
        ["Set", "Not guaranteed (HashSet); insertion order (LinkedHashSet)", "No — duplicates silently ignored", "Membership only (contains)", "HashSet, TreeSet"],
        ["Map", "Not guaranteed (HashMap) for keys; insertion order (LinkedHashMap)", "No duplicate keys; values may repeat", "A key, of your choosing", "HashMap, TreeMap"],
      ],
    },
    {
      kind: "p",
      text:
        "All three interfaces live in `java.util` and share a family resemblance in their generic style: " +
        "`List<String>`, `Set<String>`, `Map<String, Integer>` — the `<...>` part (generics, covered two " +
        "chapters from now) is what tells the compiler exactly what type of element (or key/value pair) the " +
        "collection holds, so `names.add(42)` on a `List<String>` is a compile error, not a run-time " +
        "surprise.",
    },
    {
      kind: "viz",
      title: "Why marksByName.size() is 2, not 3, after three put() calls",
      caption: "A key already present gets its value replaced, in place — it never adds a second row.",
      viz: {
        type: "table",
        frames: [
          {
            rowLabels: ["Priya"], colLabels: ["marks"], rows: [[87]], highlight: [[0, 0]],
            note: "put(\"Priya\", 87): no existing entry for key \"Priya\", so a new entry is created. Map now has 1 entry.",
          },
          {
            rowLabels: ["Priya", "Arjun"], colLabels: ["marks"], rows: [[87], [91]], highlight: [[1, 0]],
            note: "put(\"Arjun\", 91): no existing entry for \"Arjun\", another new entry created. Map now has 2 entries.",
          },
          {
            rowLabels: ["Priya", "Arjun"], colLabels: ["marks"], rows: [[90], [91]], highlight: [[0, 0]],
            note:
              "put(\"Priya\", 90): an entry for \"Priya\" already exists — this call replaces its value " +
              "(87 → 90), it does not add a second entry.",
          },
          {
            rowLabels: ["Priya", "Arjun"], colLabels: ["marks"], rows: [[90], [91]],
            note: "Final state: 2 entries total — \"Priya\" → 90, \"Arjun\" → 91.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Reaching for `List` out of habit when the real requirement is \"no duplicates\" or \"look up by " +
          "name\" — a `Set` or `Map` states the intent directly and enforces it, instead of you writing " +
          "manual duplicate-checking code.",
        "Assuming a `HashSet` or `HashMap` preserves insertion order — it doesn't, by design (the next " +
          "chapter explains why); use `LinkedHashSet`/`LinkedHashMap` if order must be preserved, or " +
          "`TreeSet`/`TreeMap` if it must be sorted.",
        "Calling `.add(existingElement)` on a `Set` and expecting an error or a warning if it's already " +
          "present — it's a silent no-op; check `.contains()` first if you need to know whether it was new.",
        "Forgetting that a `Map`'s keys behave like a `Set` (no duplicates) while its values behave like a " +
          "`List` (duplicates allowed) — two different keys can map to the same value with no conflict at all.",
      ],
    },
    {
      kind: "remember",
      items: [
        "List: ordered, indexed, duplicates allowed — like a register.",
        "Set: no duplicates, membership-focused — like a guest list at the gate.",
        "Map: key-to-value lookup, unique keys, values may repeat — like a dictionary.",
        "All three are interfaces in java.util with multiple concrete implementations to choose between.",
        "A second put() with an existing key replaces the value; it never creates a duplicate entry.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"When would you use a List versus a Set versus a Map?\" is a foundational question — answer with " +
          "the actual requirement (order+duplicates, uniqueness, or lookup-by-key), not just definitions.",
        "\"Are Java collections ordered?\" — it depends entirely on which implementation; know that HashSet " +
          "and HashMap make no ordering guarantee, which trips up people who assume all collections behave " +
          "like a List.",
        "Expect follow-up questions on ArrayList vs LinkedList and HashMap vs HashSet internals — covered " +
          "in the next two chapters.",
      ],
    },
    {
      kind: "quiz",
      question: "Adding \"Priya\" twice to a List versus a Set — what's the difference in the resulting size?",
      options: [
        "No difference: both grow by 2, because each add call always inserts a new element.",
        "The List grows by 2, as duplicates are allowed; the Set grows by only 1, since the second add is ignored.",
        "The Set grows by 2, while the List rejects the duplicate and grows by only 1.",
        "Both throw an exception on the second add, because duplicate values are never legal in Java collections.",
      ],
      answer: 1,
      why:
        "List explicitly permits duplicate elements, so both additions succeed. Set enforces uniqueness — " +
        "adding an element already present does nothing, so the size only reflects one \"Priya\".",
    },
    {
      kind: "quiz",
      question: "`map.put(\"x\", 1); map.put(\"x\", 2);` — what is map.get(\"x\") afterward, and how many entries does the map have?",
      options: [
        "1, with 2 entries, because put keeps the older value and stores the new one separately.",
        "2, with 1 entry: the second put replaced the first value for the same key.",
        "It throws an exception on the second put, because that key already exists.",
        "It depends on the Map: HashMap keeps both values, while TreeMap keeps only one.",
      ],
      answer: 1,
      why:
        "A Map allows only one value per key. The second put(\"x\", 2) overwrites the first value rather " +
        "than adding a new entry, so the map still has exactly one entry for key \"x\", now holding 2.",
    },
    {
      kind: "quiz",
      question: "Which container would you choose to check quickly \"has this roll number already been used?\" with no need to keep insertion order?",
      options: ["List<Integer>", "Set<Integer>", "A 2D array", "String"],
      answer: 1,
      why:
        "This is purely a membership question — exactly what Set is designed for, with fast contains() " +
        "checks and automatic duplicate rejection, without needing order or a value attached to each entry.",
    },
  ],
};
