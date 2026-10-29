import type { Chapter } from "@/content/courses/types";

export const chapterComparableComparator: Chapter = {
  slug: "comparable-and-comparator",
  title: "Comparable and Comparator",
  summary:
    "Sorting a list of your own objects needs Java to be told how to order them. Comparable bakes in one " +
    "\"natural\" order; Comparator lets you define as many other orderings as you like, without touching " +
    "the class at all.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "`Collections.sort()` works instantly on a `List<Integer>` or `List<String>` — numbers sort " +
        "numerically, strings sort alphabetically, because Java already knows how to compare them. A " +
        "`List<Student>` is different: Java has no idea whether you mean to sort students by marks, by " +
        "name, or by roll number — you have to tell it.",
    },
    { kind: "h", text: "A default sorting rule versus a one-off instruction" },
    {
      kind: "analogy",
      title: "A cricket scorecard's default order versus asking the scorer to sort it differently, just this once",
      text:
        "A cricket scorecard has a natural, built-in order — batting order, the sequence players actually " +
        "walked out to bat — printed on the card itself, baked in, the same every time you look at that " +
        "card. That's **`Comparable`**: a class implements it once, decides its own single \"natural\" " +
        "order (`compareTo`), and every sort of that type uses it by default unless told otherwise. Now " +
        "imagine asking the scorer, just for today's discussion, to instead list the same players sorted by " +
        "runs scored, or by strike rate — a completely different, one-off ordering that doesn't touch the " +
        "official scorecard at all. That's **`Comparator`**: an entirely separate object describing *a* " +
        "ordering, handed to the sort method as an instruction, as many different ones as you like, without " +
        "changing the `Student` class itself. Where the analogy stops: a scorecard genuinely only has one " +
        "official order; a Java class can be given any number of `Comparator`s from completely outside the " +
        "class, even ones written by code that has never seen the class's own source.",
    },
    {
      kind: "code",
      caption: "Student implements Comparable for its natural order (marks); two Comparators sort it differently.",
      code:
        "import java.util.ArrayList;\n" +
        "import java.util.Collections;\n" +
        "import java.util.Comparator;\n" +
        "import java.util.List;\n" +
        "\n" +
        "class Student implements Comparable<Student> {\n" +
        "    String name;\n" +
        "    int marks;\n" +
        "\n" +
        "    Student(String name, int marks) {\n" +
        "        this.name = name;\n" +
        "        this.marks = marks;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    public int compareTo(Student other) {\n" +
        "        return Integer.compare(this.marks, other.marks);\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        '    public String toString() {\n' +
        '        return name + "(" + marks + ")";\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class ComparableComparatorDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        List<Student> students = new ArrayList<>();\n" +
        '        students.add(new Student("Priya", 87));\n' +
        '        students.add(new Student("Arjun", 91));\n' +
        '        students.add(new Student("Vikram", 78));\n' +
        "\n" +
        "        Collections.sort(students);\n" +
        '        System.out.println("Sorted by marks (Comparable): " + students);\n' +
        "\n" +
        "        students.sort(Comparator.comparing(s -> s.name));\n" +
        '        System.out.println("Sorted by name (Comparator): " + students);\n' +
        "\n" +
        "        students.sort(Comparator.comparingInt((Student s) -> s.marks).reversed());\n" +
        '        System.out.println("Sorted by marks descending (Comparator): " + students);\n' +
        "    }\n" +
        "}\n",
      output:
        "Sorted by marks (Comparable): [Vikram(78), Priya(87), Arjun(91)]\n" +
        "Sorted by name (Comparator): [Arjun(91), Priya(87), Vikram(78)]\n" +
        "Sorted by marks descending (Comparator): [Arjun(91), Priya(87), Vikram(78)]",
    },
    {
      kind: "p",
      text:
        "`Student implements Comparable<Student>` requires exactly one method, `compareTo(Student other)`: " +
        "negative if `this` should come before `other`, positive if after, `0` if they're considered equal " +
        "for ordering purposes. `Integer.compare(this.marks, other.marks)` handles all three cases " +
        "correctly in one call, which is why it's preferred over manual subtraction (`this.marks - " +
        "other.marks`, which can silently overflow for extreme values). `Collections.sort(students)` needs " +
        "no extra argument at all — it uses `Student`'s natural order automatically, because `Student` " +
        "declared it knows how to compare itself. `Comparator.comparing(s -> s.name)` builds a comparator " +
        "from a lambda (covered properly in a later chapter — read it here as \"a small, inline function\") " +
        "that extracts the field to sort by, without touching `Student` at all; `.reversed()` flips any " +
        "comparator's order.",
    },
    {
      kind: "table",
      head: ["", "Comparable", "Comparator"],
      rows: [
        ["Method to implement", "compareTo(T other) — one method, inside the class itself", "compare(T a, T b) — a separate object, outside the class"],
        ["How many orderings", "Exactly one — the class's \"natural\" order", "As many as you like, defined anywhere"],
        ["Requires changing the class?", "Yes — the class implements Comparable", "No — works for any class, even ones you can't modify"],
        ["Typical use", "Collections.sort(list) with no arguments", "list.sort(comparator), or Collections.sort(list, comparator)"],
      ],
    },
    {
      kind: "viz",
      title: "Why Collections.sort(students) orders Vikram, Priya, Arjun (ascending marks)",
      caption: "compareTo decides relative order one pair at a time; the sort just keeps applying it until every pair agrees.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "Priya(87)" }, { value: "Arjun(91)" }, { value: "Vikram(78)" }],
            note: "Collections.sort calls compareTo repeatedly to determine relative order between pairs of Students.",
          },
          {
            cells: [{ value: "Vikram(78)", state: "swap" }, { value: "Priya(87)" }, { value: "Arjun(91)", state: "swap" }],
            note: "Comparing Vikram(78) and Priya(87): Integer.compare(78, 87) is negative, so Vikram sorts before Priya.",
          },
          {
            cells: [{ value: "Vikram(78)" }, { value: "Priya(87)", state: "swap" }, { value: "Arjun(91)", state: "swap" }],
            note: "Comparing Priya(87) and Arjun(91): Integer.compare(87, 91) is negative, so Priya sorts before Arjun.",
          },
          {
            cells: [{ value: "Vikram(78)", state: "done" }, { value: "Priya(87)", state: "done" }, { value: "Arjun(91)", state: "done" }],
            note:
              "The sort settles into ascending order of marks: Vikram(78), Priya(87), Arjun(91) — exactly " +
              "what compareTo defines as \"natural\" for this class.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "Swap `this.marks` and `other.marks` inside `compareTo` and run. The natural order now puts the " +
        "highest marks first, and the two Comparator lines don't change at all.",
      starter:
        "import java.util.ArrayList;\n" +
        "import java.util.Collections;\n" +
        "import java.util.Comparator;\n" +
        "import java.util.List;\n" +
        "\n" +
        "public class ComparableComparatorDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        List<Student> students = new ArrayList<>();\n" +
        '        students.add(new Student("Priya", 87));\n' +
        '        students.add(new Student("Arjun", 91));\n' +
        '        students.add(new Student("Vikram", 78));\n' +
        "\n" +
        "        Collections.sort(students);\n" +
        '        System.out.println("Sorted by marks (Comparable): " + students);\n' +
        "\n" +
        "        students.sort(Comparator.comparing(s -> s.name));\n" +
        '        System.out.println("Sorted by name (Comparator): " + students);\n' +
        "\n" +
        "        students.sort(Comparator.comparingInt((Student s) -> s.marks).reversed());\n" +
        '        System.out.println("Sorted by marks descending (Comparator): " + students);\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Student implements Comparable<Student> {\n" +
        "    String name;\n" +
        "    int marks;\n" +
        "\n" +
        "    Student(String name, int marks) {\n" +
        "        this.name = name;\n" +
        "        this.marks = marks;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    public int compareTo(Student other) {\n" +
        "        return Integer.compare(this.marks, other.marks);\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    public String toString() {\n" +
        '        return name + "(" + marks + ")";\n' +
        "    }\n" +
        "}\n",
      expectedOutput:
        "Sorted by marks (Comparable): [Vikram(78), Priya(87), Arjun(91)]\n" +
        "Sorted by name (Comparator): [Arjun(91), Priya(87), Vikram(78)]\n" +
        "Sorted by marks descending (Comparator): [Arjun(91), Priya(87), Vikram(78)]",
    },
    {
      kind: "pitfall",
      items: [
        "Writing `this.marks - other.marks` inside `compareTo` instead of `Integer.compare(...)` — this can " +
          "silently overflow and return the wrong sign for extreme int values; `Integer.compare` (or the " +
          "wrapper's static compare method) always avoids this.",
        "Forgetting that `Comparable`'s type parameter should match the class itself — `Student implements " +
          "Comparable<Student>`, not some other type — or the compareTo signature won't line up correctly.",
        "Implementing `Comparable` when the real need is several *different* orderings — that's exactly " +
          "what `Comparator` is for; don't force one \"natural\" order onto a class that doesn't really have one.",
        "Calling `Collections.sort(list)` on a class with no `Comparable` implementation and no `Comparator` " +
          "supplied — this is a compile error (or, for a raw `List<Object>`, a runtime `ClassCastException`), " +
          "not a silent no-op.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Comparable: implemented inside the class, defines one natural order, via compareTo().",
        "Comparator: a separate object defining one ordering, via compare(); write as many as needed.",
        "Collections.sort(list) uses Comparable; list.sort(comparator) or Collections.sort(list, comparator) uses a Comparator.",
        "Prefer Integer.compare(a, b) style helpers over manual subtraction to avoid overflow bugs.",
        "Comparator.comparing(...)/.reversed()/.thenComparing(...) build orderings without touching the class.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between Comparable and Comparator?\" is asked in almost every Java " +
          "interview that touches collections — the table above is precisely the expected shape of the answer.",
        "\"Why use Integer.compare() instead of subtraction inside compareTo()?\" is a sharp follow-up — the " +
          "overflow risk is the exact right answer.",
        "You may be asked to sort a list of custom objects by two criteria (e.g. marks, then name as a " +
          "tiebreaker) — Comparator.comparingInt(...).thenComparing(...) is the idiomatic real-world answer, " +
          "worth knowing exists even if not memorising the exact syntax.",
      ],
    },
    {
      kind: "quiz",
      question: "Calling `Collections.sort(students)` with no second argument requires what of the Student class?",
      options: [
        "Nothing special — it always works",
        "Student must implement Comparable and define compareTo()",
        "Student must override equals() only",
        "Student must be declared final",
      ],
      answer: 1,
      why:
        "The no-argument overload of Collections.sort relies on the elements' natural ordering, which " +
        "requires the class to implement Comparable and provide a compareTo() method — without it, this " +
        "call doesn't compile for a typed List<Student>.",
    },
    {
      kind: "quiz",
      question: "You need to sort the same List<Student> by marks in one place and by name in another, without changing the Student class. What's the right tool?",
      options: [
        "Implement Comparable twice, differently, in each place",
        "Use two different Comparators, one per ordering, passed to list.sort()",
        "This isn't possible in Java",
        "Rewrite compareTo() each time you need a different order",
      ],
      answer: 1,
      why:
        "Comparator is exactly the tool for multiple, situational orderings defined outside the class — " +
        "you can write as many as you need without ever touching Student or its single Comparable ordering.",
    },
    {
      kind: "quiz",
      question: "Why is `Integer.compare(this.marks, other.marks)` generally preferred over `this.marks - other.marks` inside compareTo()?",
      options: [
        "Subtraction is not allowed inside compareTo, so Integer.compare is the only version that compiles.",
        "Subtraction can overflow for extreme int values and give the wrong sign; Integer.compare avoids that.",
        "Subtraction doesn't work on int values at all, so it has to be replaced with a method call.",
        "There's no real difference; both versions return the same sign for every possible pair of ints.",
      ],
      answer: 1,
      why:
        "If marks were near Integer.MIN_VALUE/MAX_VALUE (unrealistic for exam marks, but a real risk in " +
        "general), subtraction can overflow and flip the sign, giving a wrong ordering. Integer.compare is " +
        "always correct regardless of the values involved.",
    },
  ],
};
