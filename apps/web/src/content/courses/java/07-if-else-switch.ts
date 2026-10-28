import type { Chapter } from "@/content/courses/types";

export const chapterIfElseSwitch: Chapter = {
  slug: "if-else-and-switch",
  title: "if/else and switch",
  summary:
    "Branching on a condition, the else-if ladder, classic switch with fall-through, and the modern " +
    "switch expression.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Every program until now has run the exact same lines, in the exact same order, no matter what. " +
        "Real programs constantly need to do *different* things depending on a value — a marks calculator " +
        "assigns a different grade to 45 than to 95. `if`, `else` and `switch` are how Java decides which " +
        "block of code actually runs.",
    },
    { kind: "h", text: "The report-card grade ladder" },
    {
      kind: "analogy",
      title: "Checking a mark against a grading table, top to bottom",
      text:
        "A teacher checking which grade to write on a report card reads the grading table from the top: " +
        "\"is it 90 or above? No. Is it 75 or above? No. Is it 60 or above? Yes — write B1, and stop " +
        "checking the rest of the table.\" That's exactly how an if/else-if ladder works: Java checks each " +
        "condition top to bottom and runs the *first* block whose condition is true, then skips every " +
        "condition after it, even if they'd also be true. Where the analogy stops: a teacher glancing at " +
        "the table can jump to the right row by eye; Java genuinely checks every earlier condition in " +
        "order until one succeeds, which is why the order you write conditions in actually matters — " +
        "putting `marks >= 60` before `marks >= 90` would wrongly catch every high scorer at the first, " +
        "loosest condition.",
    },
    {
      kind: "code",
      caption:
        "A grade ladder, a classic switch, and a modern switch expression — all covered in this chapter.",
      code:
        "public class IfElseSwitch {\n" +
        "    public static void main(String[] args) {\n" +
        "        int marks = 82;\n" +
        "\n" +
        "        if (marks >= 90) {\n" +
        '            System.out.println("Grade: A1");\n' +
        "        } else if (marks >= 75) {\n" +
        '            System.out.println("Grade: A2");\n' +
        "        } else if (marks >= 60) {\n" +
        '            System.out.println("Grade: B1");\n' +
        "        } else {\n" +
        '            System.out.println("Grade: needs improvement");\n' +
        "        }\n" +
        "\n" +
        "        int day = 3;\n" +
        "        String dayName;\n" +
        "        switch (day) {\n" +
        "            case 1:\n" +
        '                dayName = "Monday";\n' +
        "                break;\n" +
        "            case 2:\n" +
        '                dayName = "Tuesday";\n' +
        "                break;\n" +
        "            case 3:\n" +
        '                dayName = "Wednesday";\n' +
        "                break;\n" +
        "            default:\n" +
        '                dayName = "Unknown";\n' +
        "        }\n" +
        '        System.out.println("Day: " + dayName);\n' +
        "\n" +
        "        int month = 4;\n" +
        "        String season = switch (month) {\n" +
        '            case 12, 1, 2 -> "Winter";\n' +
        '            case 3, 4, 5 -> "Spring";\n' +
        '            case 6, 7, 8 -> "Summer";\n' +
        '            default -> "Autumn";\n' +
        "        };\n" +
        '        System.out.println("Season: " + season);\n' +
        "    }\n" +
        "}\n",
      output: "Grade: A2\nDay: Wednesday\nSeason: Spring",
    },
    {
      kind: "viz",
      title: "Why marks = 82 prints \"Grade: A2\", not A1 or B1",
      caption: "A done rung is where the ladder stopped and ran; the rungs below it are never even evaluated, whether or not they'd also be true.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "marks>=90", state: "active", pointers: ["checking"] }, { value: "marks>=75" }, { value: "marks>=60" }, { value: "else" }],
            note: "Java checks `marks >= 90` first. 82 >= 90 is false — skip this block, move to the next `else if`.",
          },
          {
            cells: [{ value: "marks>=90", state: "compare" }, { value: "marks>=75", state: "done", pointers: ["checking"] }, { value: "marks>=60" }, { value: "else" }],
            note: "Java checks `marks >= 75`. 82 >= 75 is true. This block runs: prints \"Grade: A2\".",
          },
          {
            cells: [{ value: "marks>=90", state: "compare" }, { value: "marks>=75", state: "done" }, { value: "marks>=60" }, { value: "else" }],
            note:
              "Because a condition already succeeded, Java does not check `marks >= 60` at all, even " +
              "though it's also true for 82 — the ladder stops at the first match. The final `else` never " +
              "runs either, for the same reason.",
          },
        ],
      },
    },
    { kind: "h", text: "The classic switch, and why `break` matters" },
    {
      kind: "p",
      text:
        "A `switch` compares one value against several possible cases — cleaner than a long else-if ladder " +
        "when you're checking a single variable against many exact values, as with `day` above. Each " +
        "`case` needs a `break;` at the end, or execution **falls through** into the next case's code " +
        "regardless of whether its label matches — a genuinely common source of bugs, and the reason " +
        "modern Java added the arrow form.",
    },
    {
      kind: "p",
      text:
        "Compare `case 1: dayName = \"Monday\"; break;` with the same case missing its `break`. If `day` " +
        "were 1 and the `break` after \"Monday\" were deleted, execution would run the Monday line *and* " +
        "keep going straight into the Tuesday line below it, setting `dayName` to \"Tuesday\" — silently " +
        "wrong, and with no error to warn you, because fall-through is a deliberate, if dangerous, feature.",
    },
    { kind: "h", text: "The switch expression — Java's newer, safer form" },
    {
      kind: "p",
      text:
        "The `season` block uses a **switch expression**: `case 12, 1, 2 -> \"Winter\";` groups several " +
        "values for one outcome with a comma, uses `->` instead of `:`, and — critically — does *not* " +
        "fall through. Each arm is self-contained; there's no `break` to forget. It also directly produces " +
        "a value you can assign (`String season = switch (month) { ... };`), rather than requiring a " +
        "separate variable set inside each branch the way the classic form does. For any switch where each " +
        "case simply produces one value, the arrow form is both shorter and safer, and is the form you " +
        "should reach for first in new code.",
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting `break` in a classic switch and getting silent fall-through into the next case — " +
          "one of the most common early Java bugs, and one that compiles cleanly with no warning by " +
          "default.",
        "Writing an else-if ladder with conditions in the wrong order — the first condition that matches " +
          "wins, so a loose check placed before a tight one will hide the tight one entirely.",
        "Using `=` instead of `==` inside a condition out of habit from ordinary writing — Java requires " +
          "an `if` condition to be a boolean expression, which catches this specific slip at compile time.",
        "Assuming a classic switch's `default` case must come last — it's conventional, and reads most " +
          "clearly there, but Java does not actually require it to be the final label.",
      ],
    },
    {
      kind: "remember",
      items: [
        "An else-if ladder runs the *first* true condition and skips the rest — order matters.",
        "A classic switch case falls through to the next one without an explicit `break`.",
        "The switch expression (`->`) never falls through, and can directly produce a value.",
        "`case 12, 1, 2 -> \"Winter\";` groups multiple matching values for one outcome.",
        "Prefer the switch expression over the classic switch for new code when each case just returns " +
          "one value.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What happens if you forget `break` in a switch statement?\" is asked constantly, and " +
          "specifically to check whether you've genuinely hit this bug — describe fall-through, not just " +
          "name it.",
        "\"What's the difference between the classic switch statement and the switch expression?\" tests " +
          "whether you're current on the language — no fall-through, arrow syntax, and direct value " +
          "production are the three answers worth naming.",
        "You may be given a short else-if ladder and asked to trace its output for a specific input by " +
          "hand — this is exactly the skill the trace box above practises.",
      ],
    },
    {
      kind: "quiz",
      question:
        "Given `int x = 70;` and the ladder `if (x >= 90) ... else if (x >= 60) ... else if (x >= 50) ... else ...`, which branch runs?",
      options: [
        "The x >= 90 branch, because it is the first one written and so is checked first.",
        "The x >= 60 branch, the first condition (top to bottom) that x satisfies.",
        "The x >= 50 branch, since 70 satisfies that condition as well.",
        "All three matching branches run, one after another, from the top down to the last match.",
      ],
      answer: 1,
      why:
        "The ladder stops at the first true condition. 70 fails >= 90, then satisfies >= 60 — that branch " +
        "runs, and >= 50 (also technically true for 70) is never even checked.",
    },
    {
      kind: "quiz",
      question: "In a classic switch, what happens if a matching case has no `break` and isn't the last case?",
      options: [
        "Nothing else runs, because Java stops automatically after the first matching case.",
        "It's a compile error, because every case in a classic switch must end with break.",
        "Execution falls through into the next case's code, whether or not that case matches.",
        "The switch silently jumps ahead to the default case, skipping every case in between.",
      ],
      answer: 2,
      why:
        "A classic switch, without an explicit break, continues executing the statements of the cases " +
        "that follow, regardless of their labels, until it hits a break or the end of the switch.",
    },
    {
      kind: "quiz",
      question: "What is one real advantage of the switch expression (`->` form) over the classic switch?",
      options: [
        "It runs faster at execution time.",
        "It supports more data types than the classic switch.",
        "It does not fall through between cases, and can directly produce a value for assignment.",
        "It removes the need for a default case entirely, in every situation.",
      ],
      answer: 2,
      why:
        "Each arm of a switch expression is self-contained — no break needed, no accidental fall-through " +
        "— and the whole switch can be used directly as an expression, e.g. assigned straight into a " +
        "variable, as `season` is above.",
    },
  ],
};
