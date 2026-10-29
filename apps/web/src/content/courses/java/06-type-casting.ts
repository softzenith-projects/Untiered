import type { Chapter } from "@/content/courses/types";

export const chapterTypeCasting: Chapter = {
  slug: "type-casting",
  title: "Type Casting",
  summary:
    "Widening vs narrowing, why narrowing needs your explicit permission, byte overflow, char-to-int, " +
    "and converting between String and numbers.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "You already saw a rule in the variables chapter that `float f = 3.14;` fails to compile without " +
        "an `f` suffix. That's not an arbitrary restriction — it's a very deliberate consequence of one " +
        "idea: Java will never quietly lose information without your explicit say-so. This chapter makes " +
        "that idea precise, and shows the two directions you can move between types on purpose.",
    },
    { kind: "h", text: "The tiffin box, again" },
    {
      kind: "analogy",
      title: "Pouring dal from a small bowl into a large one, and back",
      text:
        "Pouring dal from a small katori into a large steel bowl is always safe — the large bowl has " +
        "plenty of room, nothing spills. Pouring from a large bowl back into a small katori is only safe " +
        "if you know there's little enough dal to fit; otherwise it overflows the rim and you lose some. " +
        "**Widening** a value — `int` to `double`, `byte` to `int` — is Java's version of pouring into a " +
        "bigger container: always safe, so Java does it automatically, with no cast needed. **Narrowing** — " +
        "`double` to `int`, `int` to `byte` — is pouring into a smaller container: it *might* overflow, so " +
        "Java refuses to do it silently and makes you write an explicit cast, `(int) someDouble`, as your " +
        "signature confirming you understand the risk. Where the analogy stops: dal that overflows a bowl " +
        "is visibly gone; a narrowed value that overflows doesn't disappear so obviously — it wraps around " +
        "to a value that looks perfectly valid but is silently wrong, which is exactly why this chapter " +
        "matters.",
    },
    { kind: "h", text: "Widening — automatic, always safe" },
    {
      kind: "code",
      caption: "Every conversion in this chapter, run as one program.",
      code:
        "public class Casting {\n" +
        "    public static void main(String[] args) {\n" +
        "        int marks = 78;\n" +
        "        double marksAsDouble = marks;\n" +
        '        System.out.println("Widened: " + marksAsDouble);\n' +
        "\n" +
        "        double average = 87.9;\n" +
        "        int truncated = (int) average;\n" +
        '        System.out.println("Narrowed: " + truncated);\n' +
        "\n" +
        "        int bigValue = 130;\n" +
        "        byte overflowed = (byte) bigValue;\n" +
        '        System.out.println("Overflowed byte: " + overflowed);\n' +
        "\n" +
        "        char letter = 'A';\n" +
        "        int asciiValue = letter;\n" +
        '        System.out.println("\'A\' as a number: " + asciiValue);\n' +
        "\n" +
        "        int nextCode = asciiValue + 1;\n" +
        "        char nextLetter = (char) nextCode;\n" +
        '        System.out.println("Next letter: " + nextLetter);\n' +
        "\n" +
        '        String marksText = "78";\n' +
        "        int parsedMarks = Integer.parseInt(marksText);\n" +
        '        System.out.println("Parsed marks + 2: " + (parsedMarks + 2));\n' +
        "\n" +
        "        int number = 42;\n" +
        "        String numberAsText = String.valueOf(number);\n" +
        '        System.out.println("Concatenated as text: " + (numberAsText + "!"));\n' +
        "    }\n" +
        "}\n",
      output:
        "Widened: 78.0\n" +
        "Narrowed: 87\n" +
        "Overflowed byte: -126\n" +
        "'A' as a number: 65\n" +
        "Next letter: B\n" +
        "Parsed marks + 2: 80\n" +
        "Concatenated as text: 42!",
    },
    {
      kind: "p",
      text:
        "`double marksAsDouble = marks;` needed no cast: `int` (4 bytes) always fits inside `double` " +
        "(8 bytes), so this is **implicit widening**. The general widening order, smallest to largest, is " +
        "`byte → short → int → long → float → double` (with `char` widening into `int` alongside `short`). " +
        "Moving rightward along that chain never needs a cast; moving leftward always does.",
    },
    { kind: "h", text: "Narrowing — explicit, and sometimes lossy" },
    {
      kind: "p",
      text:
        "`(int) average` truncates 87.9 down to 87 — narrowing a decimal to an integer type *discards the " +
        "fractional part*, it does not round. If you want rounding, use `Math.round(average)` instead of a " +
        "plain cast; `Math.round` returns a `long` for a `double` input, so you may still need `(int) " +
        "Math.round(average)` to get an `int` back.",
    },
    {
      kind: "p",
      text:
        "`(byte) bigValue` is the more dangerous case: `byte` only holds -128 to 127, and 130 doesn't fit. " +
        "Java doesn't clamp it to the nearest valid value (127) — it *wraps around*, the same way an " +
        "odometer rolls from 999999 back to 000000 rather than stopping. 130 wraps to -126. This is a real " +
        "source of bugs precisely because it produces a plausible-looking wrong number instead of an error " +
        "— always double-check that a value genuinely fits before narrowing it into a small type.",
    },
    { kind: "h", text: "`char` is secretly a number" },
    {
      kind: "p",
      text:
        "`int asciiValue = letter;` widens a `char` into an `int` with no cast, because under the hood " +
        "every `char` *is* a 16-bit number — its Unicode code point. `'A'` is 65. This is why `(char) " +
        "nextCode` (66) prints `B` — adding 1 to the numeric code of a letter and casting the result back " +
        "to `char` steps to the next character. This trick — treat a letter as a number, do arithmetic, " +
        "cast back — is genuinely used, for example to check if a character is a digit by comparing its " +
        "code against `'0'` and `'9'`.",
    },
    { kind: "h", text: "String, and the other kind of \"casting\"" },
    {
      kind: "p",
      text:
        "Converting between `String` and a number is *not* a cast — you can't write `(int) \"78\"` — " +
        "because `String` and `int` aren't related by widening or narrowing at all; one is text, one is a " +
        "number, and Java needs a method to actually parse the digits. `Integer.parseInt(text)` reads a " +
        "String of digits and produces an `int` (throwing `NumberFormatException` if the text isn't a " +
        "valid number — try `Integer.parseInt(\"abc\")` and see). The reverse, number to String, is " +
        "`String.valueOf(number)` — or, in practice, just `\"\" + number`, since string concatenation with " +
        "`+` calls this conversion for you automatically.",
    },
    {
      kind: "viz",
      title: "Following `nextCode` and `nextLetter`",
      caption: "Each variable is added left to right as it's declared; the value never leaves its own box, only new boxes appear.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "'A'", pointers: ["letter"] }],
            note: "`char letter = 'A';` — letter holds the character 'A', whose underlying numeric code is 65.",
          },
          {
            cells: [{ value: "'A'" }, { value: 65, state: "active", pointers: ["asciiValue"] }],
            note: "`int asciiValue = letter;` — widens automatically. asciiValue is 65 (an int, no longer tagged as a character).",
          },
          {
            cells: [{ value: "'A'" }, { value: 65 }, { value: 66, state: "active", pointers: ["nextCode"] }],
            note: "`int nextCode = asciiValue + 1;` — ordinary int arithmetic. nextCode is 66.",
          },
          {
            cells: [{ value: "'A'" }, { value: 65 }, { value: 66 }, { value: "'B'", state: "done", pointers: ["nextLetter"] }],
            note: "`char nextLetter = (char) nextCode;` — narrows 66 back into a char. Code point 66 is 'B', so nextLetter holds 'B'.",
          },
          {
            cells: [{ value: "'A'" }, { value: 65 }, { value: 66 }, { value: "'B'", pointers: ["nextLetter"] }],
            note: "Printing nextLetter shows the character, not the number — println knows nextLetter's declared type is char.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "Change `bigValue` to 300 and predict the byte before you run. A byte wraps around every 256 " +
        "values, so subtract 256 until the number fits between -128 and 127.",
      starter:
        "public class Casting {\n" +
        "    public static void main(String[] args) {\n" +
        "        int marks = 78;\n" +
        "        double marksAsDouble = marks;\n" +
        '        System.out.println("Widened: " + marksAsDouble);\n' +
        "\n" +
        "        double average = 87.9;\n" +
        "        int truncated = (int) average;\n" +
        '        System.out.println("Narrowed: " + truncated);\n' +
        "\n" +
        "        int bigValue = 130;\n" +
        "        byte overflowed = (byte) bigValue;\n" +
        '        System.out.println("Overflowed byte: " + overflowed);\n' +
        "\n" +
        "        char letter = 'A';\n" +
        "        int asciiValue = letter;\n" +
        "        System.out.println(\"'A' as a number: \" + asciiValue);\n" +
        "\n" +
        "        int nextCode = asciiValue + 1;\n" +
        "        char nextLetter = (char) nextCode;\n" +
        '        System.out.println("Next letter: " + nextLetter);\n' +
        "\n" +
        '        String marksText = "78";\n' +
        "        int parsedMarks = Integer.parseInt(marksText);\n" +
        '        System.out.println("Parsed marks + 2: " + (parsedMarks + 2));\n' +
        "\n" +
        "        int number = 42;\n" +
        "        String numberAsText = String.valueOf(number);\n" +
        '        System.out.println("Concatenated as text: " + (numberAsText + "!"));\n' +
        "    }\n" +
        "}\n",
      expectedOutput:
        "Widened: 78.0\n" +
        "Narrowed: 87\n" +
        "Overflowed byte: -126\n" +
        "'A' as a number: 65\n" +
        "Next letter: B\n" +
        "Parsed marks + 2: 80\n" +
        "Concatenated as text: 42!",
    },
    {
      kind: "pitfall",
      items: [
        "Believing `(int) 87.9` rounds to 88. It truncates to 87 — always toward zero, never up. Use " +
          "`Math.round` if you actually want rounding.",
        "Narrowing a value that doesn't fit and getting a plausible-looking wrong answer instead of an " +
          "error — `(byte) 130` is `-126`, not a crash, not 127. Always sanity-check the range first.",
        "Writing `(int) \"78\"` expecting it to parse the string. Casting only works between related " +
          "numeric/char types; text-to-number conversion needs `Integer.parseInt` (or `Double.parseDouble`, " +
          "and so on).",
        "Calling `Integer.parseInt` on text that isn't purely digits (including stray spaces) and being " +
          "surprised by a `NumberFormatException` at run time rather than a compile error — this is a " +
          "run-time failure because the text isn't known until the program actually runs.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Widening (small type → big type) is automatic and always safe.",
        "Narrowing (big type → small type) needs an explicit cast, and can lose data.",
        "Casting a decimal to an integer type truncates — it does not round.",
        "A value too big for its target type wraps around silently; it does not clamp or error.",
        "String ↔ number is not a cast — it's `Integer.parseInt` / `String.valueOf`, because they're " +
          "unrelated types.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between implicit and explicit type conversion?\" — answer with widening " +
          "vs narrowing and the safety reasoning, not just \"one needs a cast and one doesn't\".",
        "\"What does `(int) 9.99` evaluate to?\" — a quick, common check that you know casting truncates " +
          "rather than rounds.",
        "\"What happens when you cast an int that's out of range to a byte?\" tests whether you know " +
          "about silent wraparound — a strong answer names the actual mechanism, not just \"it breaks\".",
      ],
    },
    {
      kind: "quiz",
      question: "What does `System.out.println((int) 9.99);` print?",
      options: ["10", "9", "9.99", "It fails to compile."],
      answer: 1,
      why: "Casting a double to int truncates the fractional part rather than rounding. 9.99 becomes 9.",
    },
    {
      kind: "quiz",
      question: "Why does `double d = 42;` compile with no cast, while `int i = 42.0;` does not?",
      options: [
        "Because Java only allows casting from int to double, and never lets a double be converted to an int.",
        "Widening int to double is safe and automatic; narrowing double to int can lose the fraction.",
        "Because 42.0 is stored as a float, and a float can never be assigned to an int variable.",
        "There is no real difference: Java inserts the needed conversion automatically in both statements.",
      ],
      answer: 1,
      why:
        "Every whole number an int can hold fits exactly inside a double, so that direction is automatic. " +
        "The reverse could silently drop a fractional part, so Java requires you to write `(int) 42.0` " +
        "to acknowledge that.",
    },
    {
      kind: "quiz",
      question: "`byte b = (byte) 200;` — what does `b` hold, and why?",
      options: [
        "200, because byte can actually hold values up to 255 when the number is cast explicitly.",
        "127, because Java clamps any out-of-range value to the maximum of the target type.",
        "-56: 200 doesn't fit in byte's -128..127 range, so it wraps around; Java does not clamp.",
        "It fails to compile.",
      ],
      answer: 2,
      why:
        "byte's range is -128 to 127. Casting 200 into it does not clamp to the nearest valid value — it " +
        "wraps around using the same binary-overflow rule that turned 130 into -126 in this chapter's " +
        "example, landing on a different, still-valid-looking but wrong byte value.",
    },
  ],
};
