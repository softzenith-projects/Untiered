import type { Chapter } from "@/content/courses/types";

export const chapterStringBuilder: Chapter = {
  slug: "stringbuilder",
  title: "StringBuilder",
  summary:
    "Why building a string in a loop with `+` is wasteful, and the mutable alternative built for exactly " +
    "that job.",
  minutes: 10,
  blocks: [
    {
      kind: "p",
      text:
        "The last chapter's central fact — a `String` never changes once created — has a real cost you " +
        "haven't paid yet, because every example so far only concatenated a handful of pieces. Build a " +
        "string across a genuine loop of hundreds or thousands of steps with plain `+`, though, and that " +
        "cost becomes very real. `StringBuilder` exists specifically to avoid it.",
    },
    { kind: "h", text: "The exercise notebook analogy" },
    {
      kind: "analogy",
      title: "A fair-copy notebook versus rewriting a fresh page every time",
      text:
        "Imagine you're told to build up a sentence one word at a time, but with an unusual rule: every " +
        "time you add a word, you must copy the *entire sentence so far* onto a brand-new page, then add " +
        "the new word at the end, then throw the old page away. Add ten words, and you've copied out ten " +
        "increasingly long sentences, most of whose content you'd already written before — enormously " +
        "wasteful. That's exactly what `result = result + i;` does inside a loop: because `String` is " +
        "immutable, each `+` creates an entirely new String containing everything before it, plus the new " +
        "piece, and discards the old one. A `StringBuilder` is the sensible alternative — one open " +
        "notebook page that you keep *writing onto*, adding each new word directly at the end without ever " +
        "recopying what's already there. Where the analogy stops: you only ever see the final sentence " +
        "either way — the difference is entirely in how much unnecessary copying happened to get there, " +
        "which is invisible until you measure it or the loop gets large enough to feel.",
    },
    {
      kind: "code",
      caption: "Building the same text two ways, and StringBuilder's core methods.",
      code:
        "public class Builder1 {\n" +
        "    public static void main(String[] args) {\n" +
        '        String result = "";\n' +
        "        for (int i = 0; i < 5; i++) {\n" +
        "            result = result + i;\n" +
        "        }\n" +
        '        System.out.println("Plain concatenation result: " + result);\n' +
        "\n" +
        "        StringBuilder sb = new StringBuilder();\n" +
        "        for (int i = 0; i < 5; i++) {\n" +
        "            sb.append(i);\n" +
        "        }\n" +
        '        System.out.println("StringBuilder result: " + sb.toString());\n' +
        "\n" +
        '        StringBuilder sb2 = new StringBuilder("Hello");\n' +
        '        sb2.append(", World");\n' +
        '        sb2.insert(0, ">> ");\n' +
        "        sb2.reverse();\n" +
        '        System.out.println("After append/insert/reverse: " + sb2);\n' +
        "\n" +
        '        StringBuilder sb3 = new StringBuilder("Hello, World");\n' +
        "        sb3.deleteCharAt(0);\n" +
        "        sb3.setCharAt(0, 'E');\n" +
        '        System.out.println("After delete/setChar: " + sb3);\n' +
        "    }\n" +
        "}\n",
      output:
        "Plain concatenation result: 01234\n" +
        "StringBuilder result: 01234\n" +
        "After append/insert/reverse: dlroW ,olleH >>\n" +
        "After delete/setChar: Ello, World",
    },
    {
      kind: "p",
      text:
        "Both loops produce the identical text \"01234\" — this chapter isn't about a different result, " +
        "it's about *how* that result gets built. `result = result + i;`, run five times, quietly creates " +
        "five separate, growing String objects in memory, discarding four of them along the way. " +
        "`sb.append(i)`, run five times, keeps modifying the *same* `StringBuilder` object in place — " +
        "nothing is discarded. For five characters the difference is unmeasurable; build a report line by " +
        "line across thousands of rows with plain `+`, and it becomes a genuine performance problem.",
    },
    {
      kind: "table",
      head: ["Method", "Does"],
      rows: [
        [".append(x)", "Adds x (of almost any type) to the end, in place"],
        [".insert(index, x)", "Inserts x at the given position, shifting the rest right"],
        [".reverse()", "Reverses the characters currently held, in place"],
        [".deleteCharAt(index)", "Removes the character at that position, in place"],
        [".setCharAt(index, ch)", "Replaces the character at that position with ch"],
        [".toString()", "Produces a genuine, immutable String snapshot of the current contents"],
      ],
    },
    {
      kind: "viz",
      title: "Following sb2 through append, insert, reverse",
      caption: "Same underlying buffer, modified in place at every step — nothing here is ever a new object.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [..."Hello"].map((c) => ({ value: c })),
            note: "sb2 starts as \"Hello\" (a StringBuilder, not a String).",
          },
          {
            cells: [
              ...[..."Hello"].map((c) => ({ value: c })),
              ...[...", World"].map((c) => ({ value: c, state: "active" as const })),
            ],
            note: "sb2.append(\", World\") adds to the end, in place: sb2 is now \"Hello, World\".",
          },
          {
            cells: [
              ...[...">> "].map((c) => ({ value: c, state: "active" as const })),
              ...[..."Hello, World"].map((c) => ({ value: c })),
            ],
            note: "sb2.insert(0, \">> \") inserts at position 0, pushing everything else right: sb2 is now \">> Hello, World\".",
          },
          {
            cells: [..."dlroW ,olleH >>"].map((c) => ({ value: c, state: "done" as const })),
            note:
              "sb2.reverse() reverses every character currently held: \">> Hello, World\" backwards is " +
              "\"dlroW ,olleH >>\". All three calls modified the same sb2 object — no new object was ever created.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Using plain `+`/`+=` to build a string across a genuine loop with many iterations — it works " +
          "correctly, but wastefully; prefer `StringBuilder.append()` once the loop is doing real work, " +
          "not a five-step toy example.",
        "Forgetting that StringBuilder's methods return the *builder itself* (for chaining, e.g. " +
          "`sb.append(\"a\").append(\"b\")`), not a new String — printing `sb` directly, or calling " +
          "`.toString()` on it, both work, because `println` calls `toString()` for you automatically.",
        "Assuming StringBuilder is immutable like String. It's the opposite: every append/insert/delete " +
          "modifies the same object in place, which is the entire reason it exists.",
        "Reaching for StringBuilder for a one-off, two-piece concatenation like `first + \" \" + last` — " +
          "plain `+` is clearer there, and the compiler quietly optimises simple concatenations like this " +
          "one anyway. The cost that matters is specifically the repeated, in-a-loop case.",
      ],
    },
    {
      kind: "remember",
      items: [
        "String is immutable: every + in a loop creates a new object and discards the old one.",
        "StringBuilder is mutable: append/insert/delete/reverse all modify the same object in place.",
        "Use StringBuilder when building text across many loop iterations; plain + is fine for a few " +
          "fixed pieces.",
        ".toString() turns the builder's current contents into a genuine, immutable String.",
        "\"String never changes, StringBuilder always does\" — the one-line summary of the whole chapter.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Why use StringBuilder instead of String concatenation?\" is asked specifically to check you " +
          "understand the repeated-object-creation cost, not just that a faster class exists.",
        "\"Is StringBuilder thread-safe?\" is a fair follow-up once you're past basics — the honest answer " +
          "is no; `StringVBuffer` is the older, synchronized, slower alternative kept mainly for backward " +
          "compatibility.",
        "Reversing a string, or building one character at a time from user input, is a common small " +
          "exercise that's meant to be solved with StringBuilder, not repeated String concatenation.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is `result = result + i;` inside a loop considered wasteful compared to `sb.append(i);`?",
      options: [
        "It isn't wasteful, because the compiler turns every + in a loop into the same code as append.",
        "Because String is immutable, each + creates a whole new String object; StringBuilder changes one object in place.",
        "Because + works only on numbers, so each pass has to convert the strings to numbers and back.",
        "Because StringBuilder is a primitive type, so it avoids creating any objects at all.",
      ],
      answer: 1,
      why:
        "Every + on an immutable String builds a brand-new object containing the old content plus the " +
        "addition, then discards the old one. StringBuilder's append() instead grows the same underlying " +
        "object, with no repeated copying.",
    },
    {
      kind: "quiz",
      question: "What does `new StringBuilder(\"cat\").reverse().toString()` produce?",
      options: ["\"cat\"", "\"tac\"", "A StringBuilder object, not a String", "It fails to compile."],
      answer: 1,
      why:
        "reverse() reverses \"cat\" in place to \"tac\", still inside the StringBuilder. toString() then " +
        "converts that current content into a genuine String, \"tac\".",
    },
    {
      kind: "quiz",
      question: "Which best describes StringBuilder compared to String?",
      options: [
        "Both are immutable; StringBuilder is simply faster at printing text to the console.",
        "StringBuilder is mutable, so its methods change the same object; String's methods always return a new one.",
        "String and StringBuilder are one class under two names, kept apart only for old code.",
        "StringBuilder can hold only numbers, which is why text still has to be stored in a String.",
      ],
      answer: 1,
      why:
        "That mutability is the entire distinction and the entire reason StringBuilder exists: append, " +
        "insert, delete, reverse and setCharAt all change the existing object directly, with no new " +
        "object created per call.",
    },
  ],
};
