import type { Chapter } from "@/content/courses/types";

export const chapterStreams: Chapter = {
  slug: "streams-api",
  title: "The Streams API",
  summary:
    "Filtering, transforming, and summarising a collection without a single hand-written loop — chained " +
    "operations that read almost like a sentence describing what you want, not how to get it.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "\"Give me the names of every student scoring above 80, sorted alphabetically\" has, up to now, " +
        "meant a loop with an `if`, a temporary list, an `.add()`, and a separate sort afterward. The " +
        "Streams API lets you write that sentence almost directly in code — a pipeline of small, named " +
        "steps, each one doing exactly one thing.",
    },
    { kind: "h", text: "The assembly line analogy" },
    {
      kind: "analogy",
      title: "A factory conveyor belt with stations, versus doing every step yourself by hand",
      text:
        "Picture a factory conveyor belt: raw items go in one end, pass a filtering station that removes " +
        "defective ones, then a shaping station that transforms each surviving item, then a sorting " +
        "station, and finally a packing station that boxes up the result. Each station does exactly one " +
        "job and hands its output to the next; nobody at the shaping station needs to know or care how " +
        "filtering worked. A **Stream** is exactly this conveyor belt over a collection: `.filter(...)` is " +
        "the filtering station (keep only items matching a condition), `.map(...)` is the shaping station " +
        "(transform each item into something else), `.sorted()` is the sorting station, and `.collect(...)` " +
        "is the packing station that gathers the final result back into a real `List`. Where the analogy " +
        "stops: a factory belt physically moves items through every station one after another; a Java " +
        "stream is actually **lazy** — none of the intermediate stations (`filter`, `map`, `sorted`) do any " +
        "work at all until a final, **terminal** operation (`collect`, `count`, `sum`) is called, at which " +
        "point the whole pipeline runs once, item by item.",
    },
    {
      kind: "code",
      caption:
        "A student list filtered, transformed, sorted and collected; plus average, count, sum, and a stream " +
        "over plain integers.",
      code:
        "import java.util.List;\n" +
        "import java.util.stream.Collectors;\n" +
        "\n" +
        "class Student {\n" +
        "    String name;\n" +
        "    int marks;\n" +
        "\n" +
        "    Student(String name, int marks) {\n" +
        "        this.name = name;\n" +
        "        this.marks = marks;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class StreamsDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        List<Student> students = List.of(\n" +
        '            new Student("Priya", 87),\n' +
        '            new Student("Arjun", 91),\n' +
        '            new Student("Vikram", 78),\n' +
        '            new Student("Neha", 95),\n' +
        '            new Student("Rahul", 62)\n' +
        "        );\n" +
        "\n" +
        "        List<String> toppers = students.stream()\n" +
        "            .filter(s -> s.marks >= 80)\n" +
        "            .map(s -> s.name)\n" +
        "            .sorted()\n" +
        "            .collect(Collectors.toList());\n" +
        '        System.out.println("Toppers (>= 80), sorted by name: " + toppers);\n' +
        "\n" +
        "        double average = students.stream()\n" +
        "            .mapToInt(s -> s.marks)\n" +
        "            .average()\n" +
        "            .orElse(0.0);\n" +
        '        System.out.printf("Average marks: %.2f%n", average);\n' +
        "\n" +
        "        long countAbove85 = students.stream()\n" +
        "            .filter(s -> s.marks > 85)\n" +
        "            .count();\n" +
        '        System.out.println("Count above 85: " + countAbove85);\n' +
        "\n" +
        "        int totalMarks = students.stream()\n" +
        "            .mapToInt(s -> s.marks)\n" +
        "            .sum();\n" +
        '        System.out.println("Total marks: " + totalMarks);\n' +
        "\n" +
        "        List<Integer> squares = List.of(1, 2, 3, 4, 5).stream()\n" +
        "            .map(n -> n * n)\n" +
        "            .collect(Collectors.toList());\n" +
        '        System.out.println("Squares: " + squares);\n' +
        "    }\n" +
        "}\n",
      output:
        "Toppers (>= 80), sorted by name: [Arjun, Neha, Priya]\n" +
        "Average marks: 82.60\n" +
        "Count above 85: 3\n" +
        "Total marks: 413\n" +
        "Squares: [1, 4, 9, 16, 25]",
    },
    {
      kind: "p",
      text:
        "`students.stream()` opens the conveyor belt over the list, without changing `students` itself — " +
        "streams never modify their source. `.filter(s -> s.marks >= 80)` keeps only Priya, Arjun, and " +
        "Neha; `.map(s -> s.name)` transforms each surviving `Student` into just its `name` (a `String`); " +
        "`.sorted()` orders those names alphabetically; `.collect(Collectors.toList())` is the terminal " +
        "operation that finally runs the whole pipeline and gathers the result into a real `List<String>`. " +
        "`.mapToInt(...)` converts a stream of objects into a specialised `IntStream`, unlocking numeric " +
        "operations like `.average()` and `.sum()` that a generic `Stream<Student>` doesn't have directly. " +
        "`.average()` returns an `OptionalDouble` — a wrapper meaning \"there might be no average at all\" " +
        "(an empty stream has none) — and `.orElse(0.0)` supplies a fallback if that's the case.",
    },
    {
      kind: "table",
      head: ["Operation", "Kind", "Does"],
      rows: [
        ["filter(predicate)", "Intermediate", "Keeps only elements matching a condition"],
        ["map(function)", "Intermediate", "Transforms each element into something else"],
        ["sorted() / sorted(comparator)", "Intermediate", "Orders the elements"],
        ["collect(Collectors.toList())", "Terminal", "Gathers the stream's results into a real List"],
        ["count() / sum() / average()", "Terminal", "Reduces the stream to one summary value"],
        ["forEach(consumer)", "Terminal", "Runs an action on each element, for its side effect"],
      ],
    },
    {
      kind: "viz",
      title: "Why nothing runs until .collect(...) — laziness in the toppers pipeline",
      caption: "Nothing in the array actually moves until the terminal operation runs — filter, map and sorted are only a description until then.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "Priya(87)" }, { value: "Arjun(91)" }, { value: "Vikram(78)" }, { value: "Neha(95)" }, { value: "Rahul(62)" }],
            note: "students.stream().filter(...).map(...).sorted() alone builds a description of the pipeline — no student has been examined yet.",
          },
          {
            cells: [{ value: "Priya(87)", state: "active" }, { value: "Arjun(91)", state: "active" }, { value: "Vikram(78)", state: "active" }, { value: "Neha(95)", state: "active" }, { value: "Rahul(62)", state: "active" }],
            note: ".collect(Collectors.toList()) is the terminal operation — only now does the stream actually walk through students.",
          },
          {
            cells: [{ value: "Priya(87)", state: "done" }, { value: "Arjun(91)", state: "done" }, { value: "Vikram(78)", state: "compare" }, { value: "Neha(95)", state: "done" }, { value: "Rahul(62)", state: "compare" }],
            note: "Each student is pulled through filter first: Priya (87, passes), Arjun (91, passes), Vikram (78, rejected), Neha (95, passes), Rahul (62, rejected).",
          },
          {
            cells: [{ value: "Priya", state: "done" }, { value: "Arjun", state: "done" }, { value: "Neha", state: "done" }],
            note: "The three survivors are mapped to their names: Priya, Arjun, Neha.",
          },
          {
            cells: [{ value: "Arjun", state: "done" }, { value: "Neha", state: "done" }, { value: "Priya", state: "done" }],
            note: "sorted() orders them alphabetically: Arjun, Neha, Priya — collect() gathers this final list, matching the printed output.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Trying to reuse a stream after a terminal operation has run on it — a stream can only be consumed " +
          "once; call `.stream()` again on the source collection for a fresh one.",
        "Forgetting a stream is lazy — writing `.filter(...)` alone with no terminal operation does " +
          "genuinely nothing; the condition inside `filter` never even runs.",
        "Using `.map(...)` when `.filter(...)` was meant, or vice versa — map transforms every element and " +
          "keeps the same count; filter removes elements and keeps their original form. Confusing them is a " +
          "very common early mistake.",
        "Reaching for a stream pipeline for something a plain loop would express more clearly — streams " +
          "shine for filter/transform/summarise chains; a stream forced into complex, multi-branch logic can " +
          "become harder to read than the loop it replaced.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A stream is a lazy pipeline over a collection: intermediate operations (filter, map, sorted) describe steps; nothing runs until a terminal operation.",
        "filter keeps matching elements; map transforms every element into something else.",
        "collect(Collectors.toList()) is the standard way to turn a stream back into a real List.",
        "mapToInt/mapToDouble unlock numeric terminal operations like sum(), average(), max().",
        "A stream can only be consumed once — get a fresh one with .stream() each time you need to reprocess.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between map and filter?\" — map transforms every element (same count out " +
          "as in); filter removes elements that don't match (fewer, or equal, count out).",
        "\"Are streams lazy or eager?\" — lazy: intermediate operations build a pipeline description, and " +
          "nothing executes until a terminal operation is invoked.",
        "You may be asked to rewrite a for-loop with an if and an accumulator as a stream pipeline — the " +
          "toppers example above (filter, then map, then collect) is exactly that transformation.",
      ],
    },
    {
      kind: "quiz",
      question: "In a stream pipeline `.filter(...).map(...).sorted()` with no terminal operation, what happens?",
      options: [
        "It runs immediately, because filter, map and sorted each do their work as soon as they are called.",
        "Nothing runs yet; streams are lazy until a terminal operation like collect() or count() is called.",
        "It throws a compile error, because every stream pipeline must end with a terminal operation.",
        "It runs filter and map straight away, but sorted waits until a terminal operation arrives.",
      ],
      answer: 1,
      why:
        "Intermediate operations only describe the pipeline; none of them actually execute until a terminal " +
        "operation is invoked, at which point the whole chain runs once per element.",
    },
    {
      kind: "quiz",
      question: "What's the key difference between .map(...) and .filter(...) on a stream?",
      options: [
        "They're interchangeable, since both pass each element through a function and keep the result.",
        "map transforms every element into something else; filter removes the elements that fail a condition.",
        "filter transforms every element into a new value, while map removes elements that fail a condition.",
        "map only works on numbers, while filter can be used on any type of element.",
      ],
      answer: 1,
      why:
        "map applies a transformation to every element and passes all of them onward, possibly changed. " +
        "filter tests each element against a condition and only lets the matching ones through, unchanged.",
    },
    {
      kind: "quiz",
      question: "Given the toppers pipeline (filter marks >= 80, map to name, sorted), which student is excluded from the final result and why?",
      options: [
        "Neha, because her marks are too high to fit in a list of the toppers.",
        "Vikram (78) and Rahul (62), as both fail the marks >= 80 filter.",
        "Arjun, because the alphabetical sorting step drops the name that comes first.",
        "No one is excluded, because filter only reorders the students and never removes any.",
      ],
      answer: 1,
      why:
        "The filter step keeps only students with marks >= 80. Vikram (78) and Rahul (62) both fall below " +
        "that threshold and are removed before map or sorted ever sees them.",
    },
  ],
};
