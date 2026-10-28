import type { Chapter } from "@/content/courses/types";

export const chapterInputOutput: Chapter = {
  slug: "input-and-output",
  title: "Input and Output",
  summary: "Reading typed input with Scanner, and formatting output precisely with printf.",
  minutes: 11,
  blocks: [
    {
      kind: "p",
      text:
        "Every program so far has printed fixed text you already knew when you wrote it. A real program — " +
        "a marks calculator, a billing system, a quiz — has to ask the *user* for numbers and react to " +
        "whatever they type. Java gives you two tools for the two halves of that: `Scanner` to read what " +
        "someone types, and `printf` to control exactly how you print the answer back.",
    },
    { kind: "h", text: "The railway reservation counter analogy" },
    {
      kind: "analogy",
      title: "A clerk at a railway reservation counter",
      text:
        "A reservation counter clerk doesn't guess your travel details — they ask you, one field at a " +
        "time: \"Name?\", writes down what you say, \"Age?\", writes that down too, \"Destination?\", and " +
        "so on, each answer going into a specific box on the form. `Scanner` is that clerk. You create one " +
        "attached to the keyboard (`new Scanner(System.in)`), and each call — `sc.nextLine()`, " +
        "`sc.nextInt()`, `sc.nextDouble()` — is the clerk asking for one field and writing your typed " +
        "answer into the matching variable. Where the analogy stops: a human clerk adapts if you answer " +
        "out of order; `Scanner` does not — if your program calls `sc.nextInt()` expecting a number and " +
        "the user types a word, the program crashes with an exception right there, rather than politely " +
        "asking again.",
    },
    { kind: "h", text: "Reading input" },
    {
      kind: "code",
      caption:
        "A complete program reading a name, an age and a set of marks, then printing them back " +
        "formatted. Run with the input `Meera`, `16`, `87.5` typed at the three prompts.",
      code:
        "import java.util.Scanner;\n" +
        "\n" +
        "public class InputOutput {\n" +
        "    public static void main(String[] args) {\n" +
        "        Scanner sc = new Scanner(System.in);\n" +
        "\n" +
        '        System.out.print("Enter your name: ");\n' +
        "        String name = sc.nextLine();\n" +
        "\n" +
        '        System.out.print("Enter your age: ");\n' +
        "        int age = sc.nextInt();\n" +
        "\n" +
        '        System.out.print("Enter your marks: ");\n' +
        "        double marks = sc.nextDouble();\n" +
        "\n" +
        '        System.out.printf("%nName: %s%n", name);\n' +
        '        System.out.printf("Age: %d%n", age);\n' +
        '        System.out.printf("Marks: %.1f%n", marks);\n' +
        '        System.out.printf("%-10s|%5d%n", "Padded", 42);\n' +
        "\n" +
        "        sc.close();\n" +
        "    }\n" +
        "}\n",
      output:
        "Enter your name: Enter your age: Enter your marks: \n" +
        "Name: Meera\n" +
        "Age: 16\n" +
        "Marks: 87.5\n" +
        "Padded    |   42",
    },
    {
      kind: "p",
      text:
        "That output looks odd if you haven't seen it before: the three prompts appear bunched together " +
        "before any of the typed answers. That's an artifact of how this output was captured — feeding " +
        "the three answers to the program all at once, non-interactively, to record real output for this " +
        "page. In an actual terminal, you'd see each prompt, then type your answer right after it on the " +
        "same line, before the next prompt appears — `Enter your name: Meera`, then `Enter your age: 16`, " +
        "and so on. The values that end up in `name`, `age` and `marks`, and everything printed afterwards, " +
        "are identical either way.",
    },
    {
      kind: "table",
      head: ["Scanner method", "Reads", "Common trap"],
      rows: [
        ["nextLine()", "A whole line of text, including spaces", "-"],
        ["nextInt()", "One whole number", "Leaves the line's trailing newline unread"],
        ["nextDouble()", "One decimal number", "Same trailing-newline issue as nextInt()"],
        ["next()", "One 'word' — text up to the next space", "Won't read a name with a space in it"],
      ],
    },
    {
      kind: "p",
      text:
        "The trailing-newline trap deserves a name because it catches almost everyone once: after " +
        "`sc.nextInt()` reads a number, it does *not* consume the Enter key press that followed it. If the " +
        "very next call is `sc.nextLine()`, that call immediately reads the leftover, now-empty rest of the " +
        "line and returns an empty string — not the line you meant to ask for next. The fix is to add an " +
        "extra `sc.nextLine();` right after a `nextInt()`/`nextDouble()` whenever a `nextLine()` follows, " +
        "purely to consume that leftover newline.",
    },
    { kind: "h", text: "Formatting output with printf" },
    {
      kind: "p",
      text:
        "`System.out.println` prints a value using Java's own default formatting — fine for quick output, " +
        "but you have no control over decimal places or column widths. `System.out.printf` (\"formatted " +
        "print\") takes a **format string** with placeholders, then the values to fill them in, in order.",
    },
    {
      kind: "table",
      head: ["Placeholder", "Means"],
      rows: [
        ["%s", "A String"],
        ["%d", "An integer"],
        ["%f", "A decimal number (default: 6 places)"],
        ["%.1f", "A decimal number, rounded to exactly 1 place after the point"],
        ["%5d", "An integer, right-aligned in a field at least 5 characters wide"],
        ["%-10s", "A String, left-aligned in a field at least 10 characters wide"],
        ["%n", "A platform-correct new line (prefer this over \\n inside printf)"],
      ],
    },
    {
      kind: "p",
      text:
        "`%.1f` on `marks` (87.5) printed `87.5` — one decimal place, as asked. `%-10s|%5d` on " +
        "(\"Padded\", 42) padded \"Padded\" to at least 10 characters, left-aligned, then padded 42 to at " +
        "least 5 characters, right-aligned — which is exactly why the two columns line up cleanly in the " +
        "output above, the way a printed bill lines up item names on the left and prices on the right.",
    },
    {
      kind: "pitfall",
      items: [
        "Calling `sc.nextLine()` right after `sc.nextInt()`/`sc.nextDouble()` and getting an unexpected " +
          "empty string — consume the leftover newline with an extra `sc.nextLine()` first.",
        "Using `sc.next()` for a full name and getting only the first word, because `next()` stops at " +
          "whitespace — use `nextLine()` for anything that might contain a space.",
        "Forgetting `%n` or `\\n` inside a `printf` format string and having every subsequent printf " +
          "output land on the same line.",
        "Not closing the Scanner (`sc.close()`) in a longer program. It rarely matters for a short " +
          "console exercise, but it's the habit that avoids resource leaks once you're reading from files.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Scanner reads; printf formats — they're the two halves of a request/response with the user.",
        "nextInt()/nextDouble() leave the newline behind; a following nextLine() reads it as empty text.",
        "%s text, %d whole number, %f decimal, %.1f decimal to 1 place — the four placeholders you'll " +
          "use constantly.",
        "%-10s left-aligns, %5d right-aligns, both padding to a minimum column width.",
        "%n ends a line inside printf; println already ends its own line without needing one.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Why did my nextLine() return an empty string after nextInt()?\" is a genuinely common bug " +
          "report, and explaining the leftover-newline cause cleanly is a good signal that you've " +
          "actually hit and understood it, not just read about it.",
        "\"How would you print a number to two decimal places?\" — `%.2f` is the expected, fast answer.",
        "You may be asked to format a small report or table using printf's width and alignment specifiers " +
          "— practise reading `%-10s` and `%5d` fluently rather than guessing at them.",
      ],
    },
    {
      kind: "quiz",
      question: "A program calls `int n = sc.nextInt();` then immediately `String s = sc.nextLine();`. What does `s` usually contain?",
      options: [
        "The next full line the user types after entering the number.",
        "An empty string — nextLine() reads the leftover newline left behind by nextInt().",
        "The same number that nextInt() just read, converted to text.",
        "It throws an exception.",
      ],
      answer: 1,
      why:
        "nextInt() consumes only the digits, not the Enter key press after them. The very next nextLine() " +
        "immediately hits that leftover newline and returns everything up to it — which is nothing.",
    },
    {
      kind: "quiz",
      question: "What does `System.out.printf(\"%.2f%n\", 3.14159);` print?",
      options: ["3.14159", "3.1", "3.14", "3.142"],
      answer: 2,
      why:
        "`%.2f` rounds the decimal to exactly 2 places after the point. 3.14159 rounds to 3.14 at two " +
        "decimal places.",
    },
    {
      kind: "quiz",
      question: "Why might sc.next() be the wrong choice for reading someone's full name?",
      options: [
        "next() can read only numbers, so any text such as a name makes it fail at run time.",
        "next() reads only one word: it stops at the first space, so a name with a space is cut short.",
        "next() requires the name to be typed inside quotes, otherwise it returns nothing at all.",
        "next() and nextLine() behave identically, so using either one for a full name works the same.",
      ],
      answer: 1,
      why:
        "next() reads up to the next whitespace character. \"Meera Sharma\" typed after a next() call " +
        "would give back only \"Meera\" — nextLine() is needed to capture the whole line.",
    },
  ],
};
