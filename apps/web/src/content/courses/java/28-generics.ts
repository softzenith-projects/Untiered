import type { Chapter } from "@/content/courses/types";

export const chapterGenerics: Chapter = {
  slug: "generics",
  title: "Generics: One Class, Any Type, Still Type-Safe",
  summary:
    "How `ArrayList<String>` and `ArrayList<Integer>` are the same class written once — and how to write " +
    "your own type-parameterised classes and methods instead of duplicating code per type.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "You've written `<String>` and `<Integer>` after `List`, `Set`, `Map` for two chapters now without " +
        "asking how one class (`ArrayList`) can hold completely different types safely. The answer is " +
        "**generics** — and once you understand them, you can write your own reusable, type-safe container " +
        "classes instead of writing a near-identical `StringBox`, `IntBox`, `StudentBox` by hand.",
    },
    { kind: "h", text: "The labelled storage box analogy" },
    {
      kind: "analogy",
      title: "One box design, with a label that says what's allowed inside",
      text:
        "Imagine one standard storage box design used all over a warehouse — same size, same lid, same " +
        "handles — but each individual box gets a label: \"Books only\", \"Electronics only\", \"Documents " +
        "only\". The box's design is written once; the label decides, for that particular box, what's " +
        "allowed to go in and what you can trust to come back out. A **generic class** is exactly this: " +
        "`class Box<T> { T content; ... }` is the one box design, written once, with `T` standing in for " +
        "\"whatever type this particular box is labelled for\" — a **type parameter**. `Box<String>` is the " +
        "box labelled \"String only\"; `Box<Integer>` is a completely separate label on the exact same " +
        "design. Where the analogy stops: mixing up real boxes is a physical mistake someone might not " +
        "notice; mixing up generic types is caught by the compiler *before your program ever runs* — " +
        "`stringBox.put(42)` on a `Box<String>` is a compile error, not a runtime surprise, which is the " +
        "entire point of generics over the untyped, \"anything goes\" containers older languages use.",
    },
    {
      kind: "code",
      caption: "A generic Box<T>, a two-parameter Pair<K, V>, and a generic method that works for any List<T>.",
      code:
        "import java.util.ArrayList;\n" +
        "import java.util.List;\n" +
        "\n" +
        "class Box<T> {\n" +
        "    private T content;\n" +
        "\n" +
        "    void put(T item) {\n" +
        "        content = item;\n" +
        "    }\n" +
        "\n" +
        "    T get() {\n" +
        "        return content;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Pair<K, V> {\n" +
        "    private K key;\n" +
        "    private V value;\n" +
        "\n" +
        "    Pair(K key, V value) {\n" +
        "        this.key = key;\n" +
        "        this.value = value;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        '    public String toString() {\n' +
        '        return key + " -> " + value;\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class GenericsDemo {\n" +
        "    static <T> T firstElement(List<T> list) {\n" +
        "        return list.get(0);\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        Box<String> stringBox = new Box<>();\n" +
        '        stringBox.put("Priya");\n' +
        "        String name = stringBox.get();\n" +
        '        System.out.println("Box<String>: " + name);\n' +
        "\n" +
        "        Box<Integer> intBox = new Box<>();\n" +
        "        intBox.put(42);\n" +
        "        int number = intBox.get();\n" +
        '        System.out.println("Box<Integer>: " + number);\n' +
        "\n" +
        '        Pair<String, Integer> marks = new Pair<>("Priya", 87);\n' +
        '        System.out.println("Pair: " + marks);\n' +
        "\n" +
        "        List<String> names = new ArrayList<>();\n" +
        '        names.add("Arjun");\n' +
        '        names.add("Vikram");\n' +
        '        System.out.println("First element via generic method: " + firstElement(names));\n' +
        "    }\n" +
        "}\n",
      output:
        "Box<String>: Priya\n" +
        "Box<Integer>: 42\n" +
        "Pair: Priya -> 87\n" +
        "First element via generic method: Arjun",
    },
    {
      kind: "p",
      text:
        "`Box<T>` is defined exactly once, with `T` as a placeholder used consistently for the field, the " +
        "`put` parameter, and the `get` return type. `new Box<String>()` tells the compiler: for *this* box, " +
        "wherever `T` appears, treat it as `String` — so `stringBox.get()` returns a `String` directly, with " +
        "no manual casting needed, unlike older, generic-free Java where you'd store an `Object` and have to " +
        "cast it back yourself. `Pair<K, V>` shows two independent type parameters — `K` and `V` can be " +
        "different types entirely, as they are here (`String` and `Integer`). `firstElement` is a **generic " +
        "method**: the `<T>` before the return type declares a type parameter scoped to just this method, " +
        "letting it work for a `List<String>`, a `List<Integer>`, or any other `List<T>`, all with one " +
        "method body.",
    },
    { kind: "h", text: "Why not just use Object?" },
    {
      kind: "p",
      text:
        "Before generics existed (pre-Java 5), a reusable box would have stored `Object content;` — `Object` " +
        "being the ancestor of every reference type — and gotten anything back out as an `Object`, requiring " +
        "an explicit, unsafe cast: `String name = (String) box.get();`. That cast compiles even if the box " +
        "actually holds an `Integer`, and only fails at run time with a `ClassCastException`, potentially far " +
        "from where the mistake was made. Generics move that exact same check to compile time, at the " +
        "location of the mistake, which is strictly better: a bug you can't ship instead of one you " +
        "discover in production.",
    },
    {
      kind: "steps",
      title: "Why `stringBox.put(42);` would fail to compile, if it were written",
      steps: [
        { label: "Substitute", text: "stringBox's declared type is Box<String> — the compiler substitutes T with String throughout Box for this variable." },
        { label: "Specialise", text: "put(T item) becomes, for this specific box, put(String item)." },
        { label: "Infer", text: "42 is an int literal (autoboxes to Integer, not String)." },
        { label: "Reject", text: "Passing an Integer where a String is required is a type mismatch — the compiler rejects the line before the program can even be built, let alone run." },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Using raw types (`Box box = new Box();`, no `<...>`) — this compiles for backward compatibility " +
          "but throws away all the type-safety generics provide, and modern code should always specify the " +
          "type argument.",
        "Trying `new T()` inside a generic class — Java erases generic type information at run time " +
          "(**type erasure**), so `T` isn't a real, instantiable type at that point; you can't directly " +
          "create a `new T()` without extra machinery (like passing a `Class<T>` or a factory).",
        "Forgetting a generic class can take multiple type parameters (`Pair<K, V>`, or more) — it's not " +
          "limited to exactly one, like `Box<T>`.",
        "Assuming `Box<Object>` and a raw `Box` behave the same — `Box<Object>` still enforces that you're " +
          "explicitly choosing `Object`; a raw `Box` disables checking altogether and generates a compiler warning.",
      ],
    },
    {
      kind: "remember",
      items: [
        "T (or any placeholder name) in Box<T> is a type parameter — substituted with a real type per instance.",
        "Generics move type-mismatch bugs from a runtime ClassCastException to a compile-time error.",
        "A generic class can have multiple type parameters: class Pair<K, V>.",
        "A generic method declares its own <T> before the return type, independent of any class-level type parameter.",
        "Prefer ArrayList<String> over a raw ArrayList — raw types disable the safety generics exist to provide.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Why does Java have generics?\" — type safety at compile time instead of a runtime " +
          "ClassCastException, illustrated with the pre-generics Object-casting pain.",
        "\"What is type erasure?\" is a common follow-up for stronger candidates — generic type information " +
          "exists at compile time for checking, but is erased (replaced with Object, or the bound) in the " +
          "compiled bytecode, which is why new T() doesn't work directly.",
        "You may be asked to write a small generic class or method (a generic Stack, a generic swap method) " +
          "— the Box<T> pattern above is the template for that kind of answer.",
      ],
    },
    {
      kind: "quiz",
      question: "What is the main advantage of `Box<T>` over an older design storing `Object content`?",
      options: [
        "Box<T> uses less memory, because the compiler removes the object header from every stored value.",
        "Type mismatches are caught at compile time instead of failing later with a ClassCastException.",
        "Box<T> runs faster, because the compiler generates a separate optimised copy for each type.",
        "There is no real difference, because both designs report type errors at the same stage.",
      ],
      answer: 1,
      why:
        "With Object, retrieving a value requires an unchecked cast that can fail at run time if the wrong " +
        "type was stored. Generics let the compiler enforce the correct type at every call site, catching " +
        "the mistake before the program runs.",
    },
    {
      kind: "quiz",
      question: "Can a generic class have more than one type parameter, like Pair<K, V>?",
      options: [
        "No, Java generics allow exactly one type parameter per class",
        "Yes — a class can declare as many type parameters as needed",
        "Only if both parameters are the same type",
        "Only for interfaces, never classes",
      ],
      answer: 1,
      why:
        "Generic classes can declare any number of type parameters, separated by commas — Pair<K, V> uses " +
        "two independent ones, which don't need to be related types at all.",
    },
    {
      kind: "quiz",
      question: "Why can't you write `new T()` directly inside a generic class like Box<T>?",
      options: [
        "It's just a style convention, and the compiler would accept it with only a warning.",
        "Java erases generic type information at run time, so T isn't a type it can instantiate.",
        "T can be used only for method parameters, never for creating objects of any kind.",
        "You actually can write it, and the claim that you can't is a common myth.",
      ],
      answer: 1,
      why:
        "Java uses type erasure: generic type parameters exist for compile-time checking but are erased " +
        "from the actual bytecode. At run time there's no real T to call new on directly without extra help " +
        "(like passing a Class<T> reference).",
    },
  ],
};
