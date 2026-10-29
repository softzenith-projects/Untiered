import type { Chapter } from "@/content/courses/types";

export const chapterStackHeapGC: Chapter = {
  slug: "stack-heap-gc",
  title: "Stack, Heap, and Garbage Collection",
  summary:
    "Where do a method's local variables actually live while it runs, and where do objects created with " +
    "new actually live? Two different regions of memory, with very different lifetimes — and Java's " +
    "automatic cleanup for the one that doesn't clean up after itself.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "You've written `int x = 5;` inside a method and `new Student()` inside the same method hundreds of " +
        "times in this course without asking where either one actually lives in memory, or what happens to " +
        "them when the method finishes. They live in two genuinely different places, and understanding both " +
        "explains a lot of behaviour you've already seen — including why objects survive past the method " +
        "that created them, and locals don't.",
    },
    { kind: "h", text: "A desk that clears itself versus a shared warehouse" },
    {
      kind: "analogy",
      title: "A worker's desk, cleared automatically, versus a shared warehouse that needs tidying",
      text:
        "Picture a call centre where each worker gets a small desk for the duration of one call — notes, a " +
        "scratch pad — and the instant the call ends, the desk is wiped clean automatically, ready for the " +
        "next call. That's the **stack**: every method call gets its own small block (a **stack frame**) " +
        "for its local variables and parameters, and the moment the method returns, that frame is popped " +
        "and gone — instantly, deterministically, no cleanup crew needed. Now picture a shared warehouse " +
        "behind the call centre, where anyone can request a crate be built and left there indefinitely, " +
        "usable by whoever knows where it is — crates don't vanish just because the worker who requested " +
        "one finishes their call. That's the **heap**: every object created with `new` lives here, " +
        "reachable through references (directions to it) for as long as *something* still holds a " +
        "reference, regardless of which method created it. Where the analogy stops: a real warehouse needs " +
        "a human to notice and clear out abandoned crates; Java's **garbage collector** does this " +
        "automatically, in the background, freeing any object the program can no longer possibly reach " +
        "through any reference — you never call `free()` or `delete` yourself.",
    },
    {
      kind: "code",
      caption:
        "Local variables and an object built with new, tracked across two references, with the object " +
        "outliving one of them.",
      code:
        "class Node {\n" +
        "    int value;\n" +
        "    Node next;\n" +
        "\n" +
        "    Node(int value) {\n" +
        "        this.value = value;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class StackHeapDemo {\n" +
        "    static int square(int n) {\n" +
        "        int result = n * n;\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int a = 5;\n" +
        "        int b = square(a);\n" +
        '        System.out.println("a = " + a + ", b = " + b);\n' +
        "\n" +
        "        Node first = new Node(1);\n" +
        "        first.next = new Node(2);\n" +
        "        first.next.next = new Node(3);\n" +
        "\n" +
        "        Node current = first;\n" +
        "        while (current != null) {\n" +
        '            System.out.print(current.value + " -> ");\n' +
        "            current = current.next;\n" +
        "        }\n" +
        '        System.out.println("null");\n' +
        "\n" +
        "        Node reference1 = first;\n" +
        "        Node reference2 = first;\n" +
        "        reference1.value = 100;\n" +
        '        System.out.println("Same object seen through reference2: " + reference2.value);\n' +
        "\n" +
        "        first = null;\n" +
        "        reference1 = null;\n" +
        '        System.out.println(\n' +
        '            "Original references cleared; reference2 still holds: " + reference2.value);\n' +
        "    }\n" +
        "}\n",
      output:
        "a = 5, b = 25\n" +
        "1 -> 2 -> 3 -> null\n" +
        "Same object seen through reference2: 100\n" +
        "Original references cleared; reference2 still holds: 100",
    },
    {
      kind: "p",
      text:
        "`n` and `result` inside `square` live in `square`'s stack frame — they exist only while `square` is " +
        "running, and vanish the instant it returns `25` to `b`; `a` and `b` similarly live in `main`'s own " +
        "frame. The three `Node` objects, by contrast, live on the heap — created with `new`, they persist " +
        "for as long as something can still reach them, regardless of which method created them or whether " +
        "that method has already returned. `reference1`, `reference2`, and `first` are three separate " +
        "variables (each in `main`'s stack frame) that all point at the *same* heap object — `reference1." +
        "value = 100;` changes the shared object, and `reference2.value` immediately reflects it. Setting " +
        "`first = null;` and `reference1 = null;` doesn't touch the object itself at all — it only clears " +
        "two of the three references pointing at it; `reference2` still points at it, so it's still fully " +
        "reachable, and its value is still `100`.",
    },
    {
      kind: "viz",
      title: "When would the first Node actually become eligible for garbage collection?",
      caption: "An object is only reclaimed once NOTHING — no variable, no field, no chain of references — can reach it.",
      viz: {
        type: "list",
        frames: [
          {
            nodes: [
              { id: "n1", value: 100, next: "n2", pointers: ["first", "reference1", "reference2"] },
              { id: "n2", value: 2, next: "n3" },
              { id: "n3", value: 3, next: null },
            ],
            note: "Before clearing anything: first, reference1, and reference2 all point at the same Node.",
          },
          {
            nodes: [
              { id: "n1", value: 100, next: "n2", pointers: ["reference2"] },
              { id: "n2", value: 2, next: "n3" },
              { id: "n3", value: 3, next: null },
            ],
            note:
              "first = null; reference1 = null; — but reference2 still points at the Node holding value 100. " +
              "As long as any variable reaches it, it remains reachable and is never collected.",
          },
          {
            nodes: [
              { id: "n1", value: 100, next: "n2", state: "done" },
              { id: "n2", value: 2, next: "n3", state: "done" },
              { id: "n3", value: 3, next: null, state: "done" },
            ],
            note:
              "Only after reference2 = null; (no other variable pointing at it) does the whole chain become " +
              "unreachable — and only then is it a candidate for the garbage collector, at a time of its own " +
              "choosing, not necessarily immediately.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "At the end of `main`, set `reference2 = null;` and then print `reference2.value`. Nothing points " +
        "at that Node any more, so it is garbage, and the print throws a NullPointerException.",
      starter:
        "public class StackHeapDemo {\n" +
        "    static int square(int n) {\n" +
        "        int result = n * n;\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int a = 5;\n" +
        "        int b = square(a);\n" +
        '        System.out.println("a = " + a + ", b = " + b);\n' +
        "\n" +
        "        Node first = new Node(1);\n" +
        "        first.next = new Node(2);\n" +
        "        first.next.next = new Node(3);\n" +
        "\n" +
        "        Node current = first;\n" +
        "        while (current != null) {\n" +
        '            System.out.print(current.value + " -> ");\n' +
        "            current = current.next;\n" +
        "        }\n" +
        '        System.out.println("null");\n' +
        "\n" +
        "        Node reference1 = first;\n" +
        "        Node reference2 = first;\n" +
        "        reference1.value = 100;\n" +
        '        System.out.println("Same object seen through reference2: " + reference2.value);\n' +
        "\n" +
        "        first = null;\n" +
        "        reference1 = null;\n" +
        "        System.out.println(\n" +
        '            "Original references cleared; reference2 still holds: " + reference2.value);\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Node {\n" +
        "    int value;\n" +
        "    Node next;\n" +
        "\n" +
        "    Node(int value) {\n" +
        "        this.value = value;\n" +
        "    }\n" +
        "}\n",
      expectedOutput:
        "a = 5, b = 25\n" +
        "1 -> 2 -> 3 -> null\n" +
        "Same object seen through reference2: 100\n" +
        "Original references cleared; reference2 still holds: 100",
    },
    {
      kind: "pitfall",
      items: [
        "Assuming `System.gc()` forces immediate garbage collection — it's only a *request/hint* to the " +
          "JVM; the collector runs on its own schedule and Java gives no guarantee about exactly when, or " +
          "even whether, it runs sooner as a result.",
        "Believing setting one reference to `null` frees the object it pointed at — it only removes *that* " +
          "path to it; the object survives as long as any other reference still exists, as `reference2` " +
          "demonstrates above.",
        "Confusing 'local variable goes out of scope' with 'the object it referenced is destroyed' — a " +
          "local reference variable disappearing from the stack does not delete the heap object it pointed " +
          "at, if something else still references it.",
        "Worrying about manual memory management the way C/C++ requires — Java deliberately has no " +
          "`free()`/`delete`; this is a genuine, deliberate design trade-off (automatic safety, at the cost " +
          "of some unpredictability in exactly when memory is reclaimed).",
      ],
    },
    {
      kind: "remember",
      items: [
        "Stack: local variables and parameters, one frame per active method call, cleared automatically on return.",
        "Heap: every object created with new, living as long as something can still reach it.",
        "Reachability, not scope, decides an object's lifetime — a heap object outlives the method that created it if referenced elsewhere.",
        "Garbage collection is automatic; System.gc() is only a request, never a guarantee of when it runs.",
        "Setting one reference to null doesn't free the object if other references to it still exist.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between stack and heap memory in Java?\" is a very standard fundamentals " +
          "question — lead with what lives where (locals/parameters vs objects) and the lifetime difference.",
        "\"How does Java's garbage collector decide what to collect?\" — reachability from any active " +
          "reference (a \"GC root\") is the core idea; an unreachable object is eligible, a reachable one " +
          "never is, regardless of how long ago it was created.",
        "\"Can you force garbage collection?\" — no, not reliably; System.gc() is a hint the JVM is free to " +
          "ignore, which is worth stating precisely rather than implying it always works.",
      ],
    },
    {
      kind: "quiz",
      question: "Where do a method's local int variables live while the method is executing?",
      options: ["The heap", "The stack, in that method's own frame", "Neither — they don't exist in memory", "Wherever the JVM's garbage collector puts them"],
      answer: 1,
      why:
        "Local variables and parameters live in the stack frame created for that specific method call, and " +
        "that frame is popped and cleared automatically the instant the method returns.",
    },
    {
      kind: "quiz",
      question: "After `first = null; reference1 = null;` while reference2 still points at the same Node, is that Node eligible for garbage collection?",
      options: [
        "Yes, because two of the three references to it are now null, leaving it mostly unused.",
        "No: reference2 still reaches it, so it stays reachable and ineligible for collection.",
        "It depends on when System.gc() is called, since eligibility is decided only at that moment.",
        "Yes, immediately, because assigning null to a reference frees the object it pointed to.",
      ],
      answer: 1,
      why:
        "An object becomes eligible for garbage collection only once nothing in the program can reach it " +
        "anymore. reference2 is still a live path to that Node, so it's still reachable and safe from collection.",
    },
    {
      kind: "quiz",
      question: "What does calling `System.gc()` actually guarantee?",
      options: [
        "That garbage collection runs immediately and every unreachable object is freed before the call returns.",
        "Nothing specific; it is only a hint to the JVM, which may or may not act on it soon.",
        "That the program will crash with an OutOfMemoryError if any objects are still reachable.",
        "That every local variable in the current method is cleared back to its default value.",
      ],
      answer: 1,
      why:
        "System.gc() only requests that the JVM consider running garbage collection — it is not a command, " +
        "and the JVM is free to delay or effectively ignore it depending on its own memory management strategy.",
    },
  ],
};
