import type { Chapter } from "@/content/courses/types";

export const chapterStrings: Chapter = {
  slug: "strings",
  title: "Strings: Immutability, the Pool, equals vs ==",
  summary:
    "Why strings never change once created, the string pool that makes `==` sometimes lie about equality, " +
    "and the common methods you'll use in almost every program from here on.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "You've printed strings since chapter one, but never asked what happens when two strings are " +
        "\"the same\" — and that question has a genuinely surprising answer in Java, one that catches " +
        "nearly every beginner exactly once. Getting it straight now saves a very specific, very " +
        "confusing bug later.",
    },
    { kind: "h", text: "The photocopy analogy" },
    {
      kind: "analogy",
      title: "An original notice versus a fresh photocopy of it",
      text:
        "Picture a notice pinned to the school board, and imagine two students both quote it from memory, " +
        "reading it off the same pinned original — they're both, in a real sense, referring to the exact " +
        "same physical sheet of paper. Now imagine a third student takes the notice to the photocopier and " +
        "makes a fresh copy: it says exactly the same words, but it is a *different physical sheet of " +
        "paper*, sitting in a different spot. If you ask \"are these the same sheet of paper?\", the " +
        "answer is no for the photocopy, even though the *words on it* are identical. Java's `==` on " +
        "strings asks exactly this \"same sheet of paper\" question — it compares whether two variables " +
        "point at the very same object in memory, not whether the text reads the same. `.equals()` asks " +
        "the other, usually more useful question: \"do the words match?\" Where the analogy stops: two " +
        "students who happen to write the exact same literal text `\"hello\"` in their code are, by a " +
        "quirk of how Java stores string literals, actually pointing at the *same* pinned original — a " +
        "shared **string pool** — while any string built at run time (read from input, concatenated, or " +
        "explicitly copied with `new String(...)`) always gets its own separate sheet of paper.",
    },
    {
      kind: "code",
      caption: "The == versus .equals() trap, and the everyday methods you'll use constantly.",
      code:
        "public class Strings1 {\n" +
        "    public static void main(String[] args) {\n" +
        '        String a = "hello";\n' +
        '        String b = "hello";\n' +
        '        String c = new String("hello");\n' +
        "\n" +
        '        System.out.println("a == b: " + (a == b));\n' +
        '        System.out.println("a == c: " + (a == c));\n' +
        '        System.out.println("a.equals(c): " + a.equals(c));\n' +
        "\n" +
        '        String name = "Priya";\n' +
        '        System.out.println("Upper: " + name.toUpperCase());\n' +
        '        System.out.println("Length: " + name.length());\n' +
        '        System.out.println("Char at 0: " + name.charAt(0));\n' +
        '        System.out.println("Substring(1,3): " + name.substring(1, 3));\n' +
        "        System.out.println(\"Contains 'iy': \" + name.contains(\"iy\"));\n" +
        "        System.out.println(\"Index of 'y': \" + name.indexOf('y'));\n" +
        "\n" +
        '        String greeting = "Hello";\n' +
        '        String modified = greeting.concat(", World");\n' +
        '        System.out.println("Original: " + greeting);\n' +
        '        System.out.println("Modified copy: " + modified);\n' +
        "\n" +
        '        String csv = "roll,name,marks";\n' +
        '        String[] parts = csv.split(",");\n' +
        "        for (String part : parts) {\n" +
        '            System.out.print(part + " | ");\n' +
        "        }\n" +
        "        System.out.println();\n" +
        "    }\n" +
        "}\n",
      output:
        "a == b: true\n" +
        "a == c: false\n" +
        "a.equals(c): true\n" +
        "Upper: PRIYA\n" +
        "Length: 5\n" +
        "Char at 0: P\n" +
        "Substring(1,3): ri\n" +
        "Contains 'iy': true\n" +
        "Index of 'y': 3\n" +
        "Original: Hello\n" +
        "Modified copy: Hello, World\n" +
        "roll | name | marks |",
      tryIt: {
        language: "java",
        prompt:
          'Change `c` to `String c = "hello";` and run. `a == c` turns true, because both now point at ' +
          "the same pooled string. `.equals()` gives true either way, which is why you should use it.",
      },
    },
    {
      kind: "p",
      text:
        "`a` and `b` are both written as the literal `\"hello\"` directly in the source code — Java notices " +
        "this and gives them the *same* pooled object, so `a == b` is `true`. `c` is built with `new " +
        "String(\"hello\")`, which explicitly forces a brand-new object — the photocopy — even though its " +
        "text is identical; `a == c` is `false`. `a.equals(c)` compares the actual characters and correctly " +
        "reports `true`. The rule to actually live by: **always use `.equals()` to compare what strings " +
        "say, and reserve `==` for checking whether two variables refer to the literal same object** " +
        "(which you'll rarely need for strings specifically, and use constantly for other reference types).",
    },
    {
      kind: "compare",
      title: "`==` vs `.equals()`",
      columns: [
        {
          label: "==",
          items: [
            "Compares object identity — \"is this the same sheet of paper?\"",
            "For two literals, often `true` (the string pool hands out the same object)",
            "For `new String(...)`, always `false`, even with identical text",
          ],
        },
        {
          label: ".equals()",
          items: [
            "Compares actual content — \"do these say the same thing?\"",
            "`true` whenever the characters match, regardless of which object holds them",
            "The one to reach for whenever you're comparing what a string *says*",
          ],
        },
      ],
    },
    { kind: "h", text: "Strings are immutable" },
    {
      kind: "p",
      text:
        "`greeting.concat(\", World\")` does *not* change `greeting` — it builds and returns a brand-new " +
        "string, leaving the original untouched, which is exactly why `greeting` still prints as " +
        "\"Hello\" afterwards while `modified` holds the joined result. Every String method that looks like " +
        "it \"changes\" a string — `.toUpperCase()`, `.trim()`, `.substring()`, `.concat()` — actually " +
        "returns a *new* String and leaves the original exactly as it was. This property is called " +
        "**immutability**: once created, a `String` object's characters can never be altered. This is why " +
        "`String name = \"priya\"; name.toUpperCase();` on its own line, with the result thrown away and " +
        "not reassigned, does *nothing useful* — a genuinely common beginner mistake. You must capture the " +
        "returned value: `name = name.toUpperCase();`.",
    },
    {
      kind: "table",
      head: ["Method", "Does", "Example on \"Priya\""],
      rows: [
        [".length()", "Number of characters — a method, unlike array's .length field", "5"],
        [".charAt(i)", "The single character at index i (0-based)", ".charAt(0) → 'P'"],
        [".substring(start, end)", "Characters from start up to, but not including, end", ".substring(1,3) → \"ri\""],
        [".toUpperCase() / .toLowerCase()", "A new string, case-changed", "\"PRIYA\""],
        [".trim()", "A new string with leading/trailing whitespace removed", "-"],
        [".contains(text)", "Whether text appears anywhere inside", "true / false"],
        [".indexOf(ch)", "Position of the first match, or -1 if absent", "3"],
        [".split(delimiter)", "Breaks the string into an array wherever the delimiter appears", "-"],
        [".equals(other)", "True if the characters match exactly", "-"],
      ],
    },
    {
      kind: "viz",
      title: "Why substring(1, 3) on \"Priya\" gives \"ri\", not \"Pr\" or \"riy\"",
      caption: "The window covers exactly the indices substring(1, 3) includes — start is inside it, end is not.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "P" }, { value: "r" }, { value: "i" }, { value: "y" }, { value: "a" }],
            note: "\"Priya\" indexed: P=0, r=1, i=2, y=3, a=4.",
          },
          {
            cells: [{ value: "P" }, { value: "r", pointers: ["start"] }, { value: "i" }, { value: "y", pointers: ["end"] }, { value: "a" }],
            note: "substring(start, end) means: start at index `start`, stop right *before* index `end` — end itself is excluded.",
          },
          {
            cells: [{ value: "P" }, { value: "r", state: "active", pointers: ["start"] }, { value: "i", state: "active" }, { value: "y", pointers: ["end"] }, { value: "a" }],
            range: [1, 2],
            note: "substring(1, 3): begin at index 1 ('r'), take characters up to but not including index 3. That gives indices 1 and 2: 'r' and 'i' — the result is \"ri\".",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Comparing strings with `==` instead of `.equals()`. It can accidentally 'work' for two literal " +
          "strings (thanks to the pool) and then mysteriously fail the moment one of them comes from user " +
          "input or concatenation — always use `.equals()` for content comparison.",
        "Calling a method that returns a new string and throwing the result away, expecting the original " +
          "variable to have changed. `name.trim();` alone does nothing; you need `name = name.trim();`.",
        "Off-by-one confusion with `substring(start, end)` — `end` is exclusive, not inclusive. " +
          "`\"Priya\".substring(1, 3)` is 2 characters (\"ri\"), not 3.",
        "Calling `.length()` with parentheses out of array habit reversed — String's length genuinely " +
          "*is* a method (`.length()`), the opposite trap from the array chapter, where `.length` is a " +
          "field with no parentheses.",
      ],
    },
    {
      kind: "remember",
      items: [
        "== compares object identity (\"same sheet of paper\"); .equals() compares actual content.",
        "String literals share a pool; a == b is often true for two identical literals, but never rely " +
          "on it — use .equals().",
        "Every String is immutable: methods like toUpperCase()/trim()/concat() return a new String, " +
          "never modify the original.",
        "substring(start, end): start is included, end is excluded.",
        "String's length is a method — .length() — the opposite of an array's .length field.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between == and .equals() for Strings?\" is one of the single most " +
          "frequently asked Java questions there is — give the identity-vs-content answer, with the " +
          "string pool as the reason it can look deceptively fine with literals.",
        "\"Why are Strings immutable in Java?\" is a common follow-up — a solid short answer mentions " +
          "safety (strings are used as things like file paths and network addresses, which shouldn't " +
          "silently change underneath other code holding a reference to them) and the string pool being " +
          "possible *because* strings can't change.",
        "Reversing a string, checking if it's a palindrome, or counting vowels by hand (without a " +
          "library shortcut) are extremely common written exercises built entirely on the methods in the " +
          "table above.",
      ],
    },
    {
      kind: "quiz",
      question: "`String x = \"cat\"; String y = \"cat\"; String z = new String(\"cat\");` — which comparison is false?",
      options: ["x.equals(y)", "x.equals(z)", "x == y", "x == z"],
      answer: 3,
      why:
        "x and y are both literals, so the string pool gives them the same object — x == y is true. z is " +
        "explicitly a new object via `new String(...)`, so x == z is false, even though the text is " +
        "identical (which is exactly why x.equals(z) is true).",
    },
    {
      kind: "quiz",
      question: "After `String s = \"  hi  \"; s.trim();` with no reassignment, what does s hold?",
      options: [
        "\"hi\", because trim() removes the whitespace from s itself, even without reassignment.",
        "\"  hi  \", unchanged: trim() returned a new string that was never captured.",
        "null, because trim() with no reassignment leaves the variable without a value.",
        "It fails to compile, because the result of trim() is ignored and Java requires it to be used.",
      ],
      answer: 1,
      why:
        "String is immutable — trim() cannot modify s in place, it can only return a new trimmed string. " +
        "Since the result of s.trim() was discarded and not assigned back to s, s is exactly as it was.",
    },
    {
      kind: "quiz",
      question: "What does `\"programming\".substring(3, 7)` evaluate to?",
      options: ["\"gram\"", "\"gramm\"", "\"ram\"", "\"rammi\""],
      answer: 0,
      why:
        "Indices: p=0,r=1,o=2,g=3,r=4,a=5,m=6,m=7,i=8... substring(3,7) starts at index 3 ('g') and stops " +
        "before index 7, covering indices 3,4,5,6 — g,r,a,m — giving \"gram\".",
    },
  ],
};
