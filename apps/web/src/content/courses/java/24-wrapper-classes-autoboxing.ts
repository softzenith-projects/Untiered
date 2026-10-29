import type { Chapter } from "@/content/courses/types";

export const chapterWrapperClasses: Chapter = {
  slug: "wrapper-classes-autoboxing",
  title: "Wrapper Classes and Autoboxing",
  summary:
    "Every primitive has an object twin — Integer for int, Double for double, and so on — because some " +
    "parts of Java (like collections) only work with objects. Autoboxing converts between them for you, " +
    "almost invisibly, with one sharp edge.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Recall that a primitive `int` is just a raw number sitting in memory — no methods, no object " +
        "identity, nothing you can pass where an object is expected. Yet an `ArrayList<Integer>` is going " +
        "to be one of your most-used tools starting next chapter, and it flatly refuses to hold a raw `int` " +
        "— it needs an object. Java's bridge between the two is the **wrapper class**.",
    },
    { kind: "h", text: "The boarding pass analogy" },
    {
      kind: "analogy",
      title: "Cash in your pocket versus cash inside a sealed, labelled envelope",
      text:
        "Loose cash in your pocket is fast and simple, but you can't hand it to a system that only accepts " +
        "sealed, labelled envelopes — a locker that only takes envelopes, say. So you put the cash in an " +
        "envelope, write the amount and your name on it, and now it can go in the locker, even though it's " +
        "the exact same money, just wrapped. `int` is the loose cash — fast, minimal, no overhead. " +
        "`Integer` is the envelope — an actual object, wrapping that same int value plus real methods " +
        "(`.toString()`, `.compareTo()`, `.equals()`) and an identity of its own, so it can go anywhere " +
        "Java demands an object, like inside an `ArrayList<Integer>`. **Autoboxing** is Java automatically " +
        "sealing the envelope for you (`Integer boxed = 10;` — no explicit wrapping code needed) and " +
        "**unboxing** is automatically tearing it back open (`int unwrapped = boxed;`). Where the analogy " +
        "stops: opening a real envelope always works; unboxing a *missing* envelope — a `null` `Integer` — " +
        "doesn't quietly give you zero, it throws an exception, as the last part of the example below shows.",
    },
    {
      kind: "code",
      caption: "Autoboxing into a collection, integer caching, parsing, and the null-unboxing trap.",
      code:
        "import java.util.ArrayList;\n" +
        "\n" +
        "public class WrapperDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        int primitive = 10;\n" +
        "        Integer boxed = primitive;\n" +
        "        int unboxed = boxed;\n" +
        '        System.out.println("boxed = " + boxed + ", unboxed = " + unboxed);\n' +
        "\n" +
        "        ArrayList<Integer> numbers = new ArrayList<>();\n" +
        "        numbers.add(5);\n" +
        "        numbers.add(10);\n" +
        "        int sum = numbers.get(0) + numbers.get(1);\n" +
        '        System.out.println("sum = " + sum);\n' +
        "\n" +
        "        Integer a = 100;\n" +
        "        Integer b = 100;\n" +
        "        Integer c = 200;\n" +
        "        Integer d = 200;\n" +
        '        System.out.println("a == b (small, cached): " + (a == b));\n' +
        '        System.out.println("c == d (large, not cached): " + (c == d));\n' +
        '        System.out.println("c.equals(d): " + c.equals(d));\n' +
        "\n" +
        '        String text = "42";\n' +
        "        int parsed = Integer.parseInt(text);\n" +
        '        System.out.println("parsed + 8 = " + (parsed + 8));\n' +
        "\n" +
        "        Integer nullable = null;\n" +
        "        try {\n" +
        "            int broken = nullable;\n" +
        "            System.out.println(broken);\n" +
        "        } catch (NullPointerException e) {\n" +
        '            System.out.println("Caught NPE while unboxing null");\n' +
        "        }\n" +
        "    }\n" +
        "}\n",
      output:
        "boxed = 10, unboxed = 10\n" +
        "sum = 15\n" +
        "a == b (small, cached): true\n" +
        "c == d (large, not cached): false\n" +
        "c.equals(d): true\n" +
        "parsed + 8 = 50\n" +
        "Caught NPE while unboxing null",
    },
    {
      kind: "p",
      text:
        "`Integer boxed = primitive;` and `int unboxed = boxed;` both compile with zero explicit conversion " +
        "code — the compiler inserts `Integer.valueOf(primitive)` and `boxed.intValue()` for you behind the " +
        "scenes; this is autoboxing/unboxing in action. `numbers.add(5)` boxes the literal `5` into an " +
        "`Integer` automatically so it can be stored in the list, and `numbers.get(0) + numbers.get(1)` " +
        "unboxes both back to `int` so ordinary arithmetic works. `Integer.parseInt(\"42\")` is the standard " +
        "way to turn user or file input (always text) into a usable number.",
    },
    { kind: "h", text: "The integer cache trap" },
    {
      kind: "p",
      text:
        "`a == b` is `true` and `c == d` is `false`, even though both pairs hold `100` and `200` " +
        "respectively — this looks inconsistent but has a precise explanation. Java caches (reuses) boxed " +
        "`Integer` objects for the small range **-128 to 127** as a memory optimisation, so `Integer a = " +
        "100;` and `Integer b = 100;` both point at the *same* cached object, making `a == b` true purely by " +
        "accident of implementation. `200` falls outside that cached range, so `c` and `d` are genuinely two " +
        "separate objects, and `c == d` correctly reflects that they're different objects — `false` — while " +
        "`c.equals(d)` correctly compares the actual numeric value and returns `true`. This is exactly the " +
        "same identity-vs-content trap as `String ==` versus `.equals()`, and the rule is identical: **always " +
        "use `.equals()` to compare wrapper values, never `==`.**",
    },
    {
      kind: "table",
      head: ["Primitive", "Wrapper class", "Parsing helper"],
      rows: [
        ["int", "Integer", "Integer.parseInt(String)"],
        ["double", "Double", "Double.parseDouble(String)"],
        ["boolean", "Boolean", "Boolean.parseBoolean(String)"],
        ["char", "Character", "-"],
        ["long", "Long", "Long.parseLong(String)"],
      ],
    },
    {
      kind: "viz",
      title: "Why unboxing a null Integer throws, instead of silently giving 0",
      caption: "nullable never holds a real object, so the method call autoboxing inserts has nothing to run on.",
      viz: {
        type: "array",
        frames: [
          { cells: [{ value: "null", pointers: ["nullable"] }], note: "Integer nullable = null; — nullable is a reference pointing at no object at all." },
          {
            cells: [{ value: "null", state: "active", pointers: ["nullable"] }],
            note: "int broken = nullable; requires unboxing: the compiler inserts nullable.intValue() behind the scenes.",
          },
          {
            cells: [{ value: "null", state: "compare", pointers: ["nullable.intValue()"] }],
            note: ".intValue() is an instance method call — it needs an actual object to call it on.",
          },
          {
            cells: [{ value: "NullPointerException", state: "swap", pointers: ["nullable.intValue()"] }],
            note: "Calling a method on a null reference is exactly what NullPointerException means, so it's thrown right there, before broken is ever assigned.",
          },
          {
            cells: [{ value: "NullPointerException", state: "done" }],
            note: "The catch block handles it and the program continues normally.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "Set `c` and `d` to 127 and run, then to 128. The `==` answer flips at the edge of Java's Integer " +
        "cache, which only holds -128 to 127. `.equals()` is right both times.",
      starter:
        "import java.util.ArrayList;\n" +
        "\n" +
        "public class WrapperDemo {\n" +
        "    public static void main(String[] args) {\n" +
        "        int primitive = 10;\n" +
        "        Integer boxed = primitive;\n" +
        "        int unboxed = boxed;\n" +
        '        System.out.println("boxed = " + boxed + ", unboxed = " + unboxed);\n' +
        "\n" +
        "        ArrayList<Integer> numbers = new ArrayList<>();\n" +
        "        numbers.add(5);\n" +
        "        numbers.add(10);\n" +
        "        int sum = numbers.get(0) + numbers.get(1);\n" +
        '        System.out.println("sum = " + sum);\n' +
        "\n" +
        "        Integer a = 100;\n" +
        "        Integer b = 100;\n" +
        "        Integer c = 200;\n" +
        "        Integer d = 200;\n" +
        '        System.out.println("a == b (small, cached): " + (a == b));\n' +
        '        System.out.println("c == d (large, not cached): " + (c == d));\n' +
        '        System.out.println("c.equals(d): " + c.equals(d));\n' +
        "\n" +
        '        String text = "42";\n' +
        "        int parsed = Integer.parseInt(text);\n" +
        '        System.out.println("parsed + 8 = " + (parsed + 8));\n' +
        "\n" +
        "        Integer nullable = null;\n" +
        "        try {\n" +
        "            int broken = nullable;\n" +
        "            System.out.println(broken);\n" +
        "        } catch (NullPointerException e) {\n" +
        '            System.out.println("Caught NPE while unboxing null");\n' +
        "        }\n" +
        "    }\n" +
        "}\n",
      expectedOutput:
        "boxed = 10, unboxed = 10\n" +
        "sum = 15\n" +
        "a == b (small, cached): true\n" +
        "c == d (large, not cached): false\n" +
        "c.equals(d): true\n" +
        "parsed + 8 = 50\n" +
        "Caught NPE while unboxing null",
    },
    {
      kind: "pitfall",
      items: [
        "Comparing wrapper objects with `==` and getting lucky on small numbers because of the -128..127 " +
          "cache, then having it silently break for larger numbers — always use `.equals()`.",
        "Unboxing a wrapper that might be `null` without a null check — a very common source of unexpected " +
          "`NullPointerException`s, especially with values pulled from a Map or an optional field.",
        "Forgetting `ArrayList<int>` isn't valid Java at all — generics (next-but-one chapter) only work " +
          "with object types, which is exactly why `ArrayList<Integer>` exists and `ArrayList<int>` doesn't compile.",
        "Assuming autoboxing is free performance-wise — creating many wrapper objects in a tight loop (e.g. " +
          "summing a huge list of boxed Integers) does real allocation work a raw int loop wouldn't.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Every primitive has a wrapper object twin: int/Integer, double/Double, boolean/Boolean, char/Character.",
        "Autoboxing/unboxing convert between them automatically wherever the compiler can tell it's needed.",
        "Collections like ArrayList can only hold objects — this is the main reason wrapper classes exist.",
        "Integer caches -128..127; == can look right by accident there and wrong outside it — use .equals().",
        "Unboxing a null wrapper throws NullPointerException — check for null before you rely on the primitive.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is autoboxing?\" and \"why does Integer a=100,b=100 give a==b true but Integer c=200,d=200 " +
          "give c==d false?\" is a genuinely common, sharp interview question — know the -128..127 caching " +
          "answer precisely, not just \"it depends\".",
        "\"Why can't you have an ArrayList<int>?\" — generics operate on reference types only; wrapper " +
          "classes are exactly the bridge that makes ArrayList<Integer> possible instead.",
        "You may be shown a snippet unboxing a possibly-null wrapper and asked what happens — the answer is " +
          "a NullPointerException, not a silent 0.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does `ArrayList<Integer>` work but `ArrayList<int>` fails to compile?",
      options: [
        "Primitive types can be stored only in arrays, never in any collection class, even through boxing.",
        "Generics need an object type; Integer is int's wrapper, and autoboxing converts between them automatically.",
        "ArrayList can hold only Strings, so both versions fail unless the element type is String.",
        "int is deprecated in recent Java versions, so the compiler rejects it wherever generics appear.",
      ],
      answer: 1,
      why:
        "Java generics work only with reference (object) types, never primitives directly. Integer is the " +
        "object wrapper for int, and autoboxing lets you write numbers where an Integer is expected without " +
        "manual conversion.",
    },
    {
      kind: "quiz",
      question: "`Integer x = 50; Integer y = 50;` — what does `x == y` evaluate to, and why?",
      options: [
        "false, because == never works on objects",
        "true, because 50 falls in Java's cached Integer range (-128 to 127)",
        "It fails to compile",
        "true, but only coincidentally with no defined reason",
      ],
      answer: 1,
      why:
        "Java caches boxed Integer objects for values -128 to 127 as an optimisation, so both x and y point " +
        "at the same cached object, making == true. This is implementation detail, not a guarantee to rely on.",
    },
    {
      kind: "quiz",
      question: "What happens when a null Integer is unboxed to a primitive int?",
      options: [
        "It becomes 0 silently",
        "It throws NullPointerException",
        "It fails to compile",
        "It becomes -1",
      ],
      answer: 1,
      why:
        "Unboxing calls .intValue() on the wrapper object behind the scenes. Calling any method on a null " +
        "reference throws NullPointerException — there's no silent fallback to 0.",
    },
  ],
};
