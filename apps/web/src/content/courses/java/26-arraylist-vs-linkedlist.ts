import type { Chapter } from "@/content/courses/types";

export const chapterArrayListVsLinkedList: Chapter = {
  slug: "arraylist-vs-linkedlist",
  title: "ArrayList vs LinkedList",
  summary:
    "Both implement List and both grow, unlike an array — but they store elements completely differently " +
    "underneath, which decides which operations are fast and which are slow on each.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "The last chapter used `ArrayList` for every `List` example without explaining why. `List` is just " +
        "an interface — a promise of ordered, indexed, duplicate-allowing behaviour — and Java offers more " +
        "than one class that keeps that promise. `ArrayList` and `LinkedList` are the two you'll meet most " +
        "often, and picking the right one is a genuine performance decision, not a stylistic one.",
    },
    { kind: "h", text: "The railway reservation chart versus a treasure hunt" },
    {
      kind: "analogy",
      title: "A printed reservation chart versus a paper-chain treasure hunt",
      text:
        "A train's printed reservation chart lists every seat, numbered, on one continuous sheet: to find " +
        "seat 47, you go directly to position 47 — instant, because it's all one contiguous layout. But " +
        "inserting a new passenger at position 10 means physically reprinting the chart with everyone " +
        "after seat 10 shifted down by one seat. That's `ArrayList`: elements sit in one contiguous block of " +
        "memory, so `get(index)` jumps straight there instantly, but inserting or removing in the middle " +
        "means shifting every element after it. Now picture a treasure hunt instead: clue 1 tells you where " +
        "to physically walk to find clue 2, clue 2 points to clue 3, and so on — there's no way to jump " +
        "straight to \"clue 47\" without walking the whole chain from the start. But inserting a brand-new " +
        "clue between two existing ones is trivial: just repoint two arrows, no walking anything shifted at " +
        "all. That's `LinkedList`: each element (**node**) stores a link to the next one; reaching `get(47)` " +
        "means walking 47 links one at a time, but inserting/removing at a *known* position — especially the " +
        "front or back — touches only a couple of links, nothing shifts. Where the analogy stops: a real " +
        "treasure hunt is one-directional; Java's `LinkedList` is actually **doubly** linked — each node " +
        "also points *backward* — so it can walk efficiently from either end.",
    },
    {
      kind: "code",
      caption: "Both implement List identically from the outside; add(index, ...) behaves the same way on both.",
      code:
        "import java.util.ArrayList;\n" +
        "import java.util.LinkedList;\n" +
        "import java.util.List;\n" +
        "\n" +
        "public class ArrayListLinkedListDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        List<String> arrayList = new ArrayList<>();\n" +
        '        arrayList.add("Priya");\n' +
        '        arrayList.add("Arjun");\n' +
        '        arrayList.add("Vikram");\n' +
        '        System.out.println("ArrayList get(1): " + arrayList.get(1));\n' +
        "\n" +
        '        arrayList.add(1, "Neha");\n' +
        '        System.out.println("After insert at index 1: " + arrayList);\n' +
        "\n" +
        "        List<String> linkedList = new LinkedList<>();\n" +
        '        linkedList.add("Priya");\n' +
        '        linkedList.add("Arjun");\n' +
        '        linkedList.add("Vikram");\n' +
        '        linkedList.add(0, "Neha");\n' +
        '        System.out.println("LinkedList after insert at front: " + linkedList);\n' +
        "\n" +
        "        LinkedList<String> queue = new LinkedList<>();\n" +
        '        queue.addLast("first");\n' +
        '        queue.addLast("second");\n' +
        '        queue.addLast("third");\n' +
        '        System.out.println("Removed from front: " + queue.removeFirst());\n' +
        '        System.out.println("Remaining queue: " + queue);\n' +
        "    }\n" +
        "}\n",
      output:
        "ArrayList get(1): Arjun\n" +
        "After insert at index 1: [Priya, Neha, Arjun, Vikram]\n" +
        "LinkedList after insert at front: [Neha, Priya, Arjun, Vikram]\n" +
        "Removed from front: first\n" +
        "Remaining queue: [second, third]",
    },
    {
      kind: "p",
      text:
        "Both blocks read identically at the call-site level — `.add()`, `.add(index, value)`, printing the " +
        "list — because both classes implement the same `List` interface. What differs is *how expensive* " +
        "each operation is underneath, invisible to this small example but very real at scale. The last part " +
        "uses `LinkedList` specifically as a `LinkedList` (not through the `List` interface), calling " +
        "`addLast()` and `removeFirst()` — methods `List` doesn't declare, but `LinkedList` adds because " +
        "efficient work at either end is exactly what its structure is good at, which is why `LinkedList` is " +
        "commonly used to implement a queue or a deque.",
    },
    {
      kind: "compare",
      title: "ArrayList vs LinkedList",
      columns: [
        {
          label: "ArrayList",
          items: [
            "`get(index)` is fast — jumps straight to the memory slot",
            "Add/remove at the front or middle is slow — shifts every following element",
            "Low memory overhead — just the elements, contiguous",
            "The default choice for most lists, especially when you read a lot",
          ],
        },
        {
          label: "LinkedList",
          items: [
            "`get(index)` is slow — walks node by node from the nearest end",
            "Add/remove at the ends is fast; in the middle, fast once you're there, but reaching it by index still walks",
            "Higher memory overhead — each node also stores two link references",
            "Best as a queue/deque, or when you insert/remove heavily at the ends and rarely read by index",
          ],
        },
      ],
    },
    {
      kind: "viz",
      title: "Why arrayList.add(1, \"Neha\") produces [Priya, Neha, Arjun, Vikram]",
      caption: "Every element from the insertion point onward physically shifts one slot right before the new value is written in.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "Priya" }, { value: "Arjun" }, { value: "Vikram" }],
            note: "Before the insert: [Priya, Arjun, Vikram] at indices 0, 1, 2.",
          },
          {
            cells: [{ value: "Priya" }, { value: "?", state: "active", pointers: ["index 1"] }, { value: "Arjun" }, { value: "Vikram" }],
            note: "add(1, \"Neha\") means: insert \"Neha\" so it becomes the new element at index 1.",
          },
          {
            cells: [{ value: "Priya" }, { value: "?" }, { value: "Arjun", state: "swap" }, { value: "Vikram", state: "swap" }],
            note:
              "Internally, ArrayList shifts every element from index 1 onward one slot to the right, " +
              "making room: Arjun moves from index 1 to 2, Vikram moves from index 2 to 3.",
          },
          {
            cells: [{ value: "Priya" }, { value: "Neha", state: "done" }, { value: "Arjun" }, { value: "Vikram" }],
            note: "\"Neha\" is written into the now-empty index 1.",
          },
          {
            cells: [{ value: "Priya" }, { value: "Neha" }, { value: "Arjun" }, { value: "Vikram" }],
            note:
              "Result: [Priya, Neha, Arjun, Vikram] — this shifting is exactly the cost that makes a " +
              "middle insertion on an ArrayList relatively expensive for a large list.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "Call `queue.removeFirst()` three more times. The third call finds the queue empty and throws a " +
        "NoSuchElementException, which is why real code checks `isEmpty()` first.",
      starter:
        "import java.util.ArrayList;\n" +
        "import java.util.LinkedList;\n" +
        "import java.util.List;\n" +
        "\n" +
        "public class ArrayListLinkedListDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        List<String> arrayList = new ArrayList<>();\n" +
        '        arrayList.add("Priya");\n' +
        '        arrayList.add("Arjun");\n' +
        '        arrayList.add("Vikram");\n' +
        '        System.out.println("ArrayList get(1): " + arrayList.get(1));\n' +
        "\n" +
        '        arrayList.add(1, "Neha");\n' +
        '        System.out.println("After insert at index 1: " + arrayList);\n' +
        "\n" +
        "        List<String> linkedList = new LinkedList<>();\n" +
        '        linkedList.add("Priya");\n' +
        '        linkedList.add("Arjun");\n' +
        '        linkedList.add("Vikram");\n' +
        '        linkedList.add(0, "Neha");\n' +
        '        System.out.println("LinkedList after insert at front: " + linkedList);\n' +
        "\n" +
        "        LinkedList<String> queue = new LinkedList<>();\n" +
        '        queue.addLast("first");\n' +
        '        queue.addLast("second");\n' +
        '        queue.addLast("third");\n' +
        '        System.out.println("Removed from front: " + queue.removeFirst());\n' +
        '        System.out.println("Remaining queue: " + queue);\n' +
        "    }\n" +
        "}\n",
      expectedOutput:
        "ArrayList get(1): Arjun\n" +
        "After insert at index 1: [Priya, Neha, Arjun, Vikram]\n" +
        "LinkedList after insert at front: [Neha, Priya, Arjun, Vikram]\n" +
        "Removed from front: first\n" +
        "Remaining queue: [second, third]",
    },
    {
      kind: "pitfall",
      items: [
        "Defaulting to `LinkedList` because it \"sounds efficient\" — for most real programs, which read " +
          "far more often than they insert in the middle, `ArrayList` is the better default; measure before " +
          "assuming otherwise.",
        "Calling `.get(i)` in a loop over a `LinkedList` to walk through it — this is quadratic overall (each " +
          "get walks from an end), when a simple for-each loop or an iterator would walk it once, linearly.",
        "Forgetting that `List<String> linkedList = new LinkedList<>();` (declared as the interface type) " +
          "hides `addFirst`/`addLast`/`removeFirst` — those aren't part of `List`; you need the variable " +
          "declared as `LinkedList<String>` (or `Deque<String>`) to call them directly.",
        "Assuming ArrayList never has to \"shift\" — adding at the very end is fast (amortised), but adding " +
          "or removing anywhere before the end always shifts the remaining elements.",
      ],
    },
    {
      kind: "remember",
      items: [
        "ArrayList: contiguous backing array — fast random access (get), slower middle insert/remove.",
        "LinkedList: chain of nodes with next/prev links — fast insert/remove at known positions, slow get by index.",
        "Both implement List; the interface hides the difference, the performance doesn't.",
        "LinkedList is doubly linked, so it can also serve efficiently as a Deque (queue from both ends).",
        "Default to ArrayList unless you specifically need frequent insert/remove at the ends.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"ArrayList vs LinkedList — when would you use each?\" is asked almost every time collections come " +
          "up — lead with the underlying structure (contiguous array vs linked nodes), then the operations " +
          "that follow from it, using the table above.",
        "\"What is the time complexity of get() on each?\" — O(1) for ArrayList, O(n) for LinkedList — this " +
          "is a very common quick follow-up.",
        "\"How would you implement a queue in Java?\" — LinkedList implementing Deque is a standard, " +
          "correct answer, with addLast/removeFirst as the two operations that matter.",
      ],
    },
    {
      kind: "quiz",
      question: "Which operation is fastest on an ArrayList compared to a LinkedList of the same size?",
      options: [
        "Inserting at the front",
        "get(index) — random access by position",
        "Removing from the front",
        "They're always equally fast",
      ],
      answer: 1,
      why:
        "ArrayList stores elements contiguously, so get(index) jumps straight to that memory slot in " +
        "constant time. LinkedList must walk node by node from the nearest end to reach that position.",
    },
    {
      kind: "quiz",
      question: "Why does `arrayList.add(1, \"Neha\")` cost more as the list grows larger?",
      options: [
        "It doesn't cost more: inserting into an ArrayList always takes constant time.",
        "Every element from index 1 onward has to shift one position to make room.",
        "ArrayList has to sort itself again after every insert, and sorting grows with the size.",
        "It only costs more if the list contains duplicate values that must be compared first.",
      ],
      answer: 1,
      why:
        "Inserting anywhere but the end of an ArrayList requires shifting every subsequent element one slot " +
        "over, an amount of work proportional to how many elements come after the insertion point.",
    },
    {
      kind: "quiz",
      question: "You need a structure that frequently adds and removes elements from both the front and back, and rarely looks up by index. Which fits better?",
      options: ["ArrayList", "LinkedList", "A plain array", "Neither — use a String"],
      answer: 1,
      why:
        "LinkedList's doubly linked structure makes adding/removing at either end cheap (constant time), " +
        "which is exactly the access pattern described — random access by index is explicitly not the priority here.",
    },
  ],
};
