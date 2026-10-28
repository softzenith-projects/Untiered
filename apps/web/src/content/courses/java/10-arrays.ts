import type { Chapter } from "@/content/courses/types";

export const chapterArrays: Chapter = {
  slug: "arrays",
  title: "Arrays: 1D and 2D",
  summary:
    "A fixed-size, indexed row of same-typed boxes; the for-each loop; default values; and a 2D array as " +
    "an array of arrays — a seating chart.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "So far every variable has held exactly one value — one name, one age, one score. The moment you " +
        "need to hold a whole class's worth of marks, one variable per student stops working: you can't " +
        "write `int marks1, marks2, marks3, ...` for forty students and process them sensibly. An " +
        "**array** is Java's answer: one variable that holds many values of the *same type*, laid out in a " +
        "fixed-size, numbered row.",
    },
    { kind: "h", text: "The railway reservation chart analogy" },
    {
      kind: "analogy",
      title: "A railway coach's numbered berth chart",
      text:
        "A train coach has a fixed number of berths, numbered in a strict sequence — berth 1, berth 2, and " +
        "so on, up to whatever the coach's capacity is. You cannot add a 73rd berth to a 72-berth coach " +
        "mid-journey, and every berth holds exactly one passenger, of the same kind of thing (a passenger, " +
        "not, say, a suitcase, which goes elsewhere). An array is exactly this: `int[] marks = new " +
        "int[5]` reserves a coach with exactly 5 numbered berths, each one able to hold an `int` and " +
        "nothing else. The berth numbers, though, start from 0, not 1 — `marks[0]` is the *first* berth, " +
        "`marks[4]` is the last of five. Where the analogy stops: a train coach's berth numbers are printed " +
        "on the berth itself; an array's indices exist only as a position, counted from the start, with " +
        "nothing physically marking them — which is exactly why an off-by-one mistake in the index is so " +
        "easy to make and so hard to spot by eye.",
    },
    { kind: "h", text: "Declaring, filling, and reading a 1D array" },
    {
      kind: "code",
      caption: "Declaring an array with values, its length, indexing, and the enhanced for-each loop.",
      code:
        "public class Arrays1 {\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] marks = {78, 92, 65, 88, 71};\n" +
        '        System.out.println("Length: " + marks.length);\n' +
        '        System.out.println("First: " + marks[0] + ", Last: " + marks[marks.length - 1]);\n' +
        "\n" +
        "        int total = 0;\n" +
        "        for (int i = 0; i < marks.length; i++) {\n" +
        "            total += marks[i];\n" +
        "        }\n" +
        '        System.out.println("Total: " + total);\n' +
        "\n" +
        "        int highest = marks[0];\n" +
        "        for (int m : marks) {\n" +
        "            if (m > highest) {\n" +
        "                highest = m;\n" +
        "            }\n" +
        "        }\n" +
        '        System.out.println("Highest: " + highest);\n' +
        "\n" +
        "        marks[2] = 70;\n" +
        '        System.out.println("After correction, marks[2] = " + marks[2]);\n' +
        "\n" +
        "        int[] scoresDefault = new int[3];\n" +
        '        System.out.println("Default int array: " + scoresDefault[0] + ", " + scoresDefault[1] + ", " + scoresDefault[2]);\n' +
        "    }\n" +
        "}\n",
      output:
        "Length: 5\n" +
        "First: 78, Last: 71\n" +
        "Total: 394\n" +
        "Highest: 92\n" +
        "After correction, marks[2] = 70\n" +
        "Default int array: 0, 0, 0",
    },
    {
      kind: "p",
      text:
        "`marks.length` is a *field*, not a method — no parentheses, unlike `String`'s `.length()`, which " +
        "you'll meet in the next chapter and which trips up almost every beginner at least once. It gives " +
        "the fixed size decided when the array was created; that size can never change afterwards — you " +
        "cannot 'add a berth' to an existing array, only create a new, bigger array and copy values across, " +
        "which is exactly what a resizable list (much later in this course) does for you automatically.",
    },
    {
      kind: "p",
      text:
        "The `for (int m : marks)` loop — a **for-each loop**, or **enhanced for loop** — reads " +
        "\"for each `int m` in `marks`\": it walks the array element by element without you managing an " +
        "index at all. It's the right tool whenever you only need to *read* every element in order and " +
        "don't need the index itself; reach for the ordinary indexed `for` loop when you need the position " +
        "(to compare neighbours, or to write into the array, since `m` in a for-each loop is a *copy*, and " +
        "changing `m` never changes the array).",
    },
    {
      kind: "p",
      text:
        "`new int[3]` creates an array of the *given type's default value*, repeated: `0` for numeric " +
        "types, `false` for boolean, `null` for any reference type like `String[]`. This is one of the few " +
        "places Java does give you a default without complaint — unlike a plain local variable, which, as " +
        "you saw in the variables chapter, must be assigned explicitly before use.",
    },
    { kind: "h", text: "2D arrays: an array of arrays" },
    {
      kind: "p",
      text:
        "A 2D array models a grid — rows and columns, like a seating chart or the cells of a table. In " +
        "Java, it's implemented, quite literally, as an array whose *elements are themselves arrays*: " +
        "`seating[1]` is not a single value, it's the entire second row, itself an `int[]`, and " +
        "`seating[1][2]` reaches into that row for its third element.",
    },
    {
      kind: "code",
      caption: "A 2x3 seating chart, declared, indexed, and printed row by row.",
      code:
        "int[][] seating = {\n" +
        "    {1, 2, 3},\n" +
        "    {4, 5, 6}\n" +
        "};\n" +
        'System.out.println("Row 1, Col 2: " + seating[1][2]);\n' +
        "for (int row = 0; row < seating.length; row++) {\n" +
        "    for (int col = 0; col < seating[row].length; col++) {\n" +
        '        System.out.print(seating[row][col] + " ");\n' +
        "    }\n" +
        "    System.out.println();\n" +
        "}\n",
      output: "Row 1, Col 2: 6\n1 2 3 \n4 5 6",
    },
    {
      kind: "viz",
      title: "Why seating[1][2] is 6, not 3",
      caption: "A 2D array is an array of arrays — the row index picks a row, the column index picks within it.",
      viz: {
        type: "table",
        frames: [
          {
            rows: [
              [1, 2, 3],
              [4, 5, 6],
            ],
            rowLabels: ["row 0", "row 1"],
            colLabels: ["col 0", "col 1", "col 2"],
            note: "seating[0] is {1, 2, 3}. seating[1] is {4, 5, 6}. Row indices start at 0, exactly like a 1D array.",
          },
          {
            rows: [
              [1, 2, 3],
              [4, 5, 6],
            ],
            rowLabels: ["row 0", "row 1"],
            colLabels: ["col 0", "col 1", "col 2"],
            highlight: [
              [1, 0],
              [1, 1],
              [1, 2],
            ],
            note: "seating[1][2] means: go to row index 1 (that's {4, 5, 6}), then take the element at index 2 within that row.",
          },
          {
            rows: [
              [1, 2, 3],
              [4, 5, 6],
            ],
            rowLabels: ["row 0", "row 1"],
            colLabels: ["col 0", "col 1", "col 2"],
            highlight: [[1, 2]],
            note:
              "Within {4, 5, 6}, index 0 is 4, index 1 is 5, index 2 is 6 — so seating[1][2] is 6, both " +
              "indices counted from zero.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "The double loop that prints the whole grid mirrors this exactly: the outer loop walks each row, " +
        "the inner loop walks each column *within* that row — and it deliberately uses " +
        "`seating[row].length` for the inner bound, not a fixed number, because Java's 2D arrays don't have " +
        "to be perfectly rectangular; each row can, in principle, be a different length (a **jagged " +
        "array**), though a seating chart, sensibly, keeps every row the same size.",
    },
    {
      kind: "pitfall",
      items: [
        "Using `marks.length()` with parentheses, copying `String`'s method syntax — array length is a " +
          "field, `marks.length`, with no parentheses at all.",
        "Reading or writing `marks[marks.length]` — the valid indices are 0 through length-1; index " +
          "`length` itself is one past the end and throws `ArrayIndexOutOfBoundsException` at run time.",
        "Trying to change an array's size after creating it — `marks = new int[10];` doesn't resize the " +
          "existing array, it replaces `marks` with an entirely new, empty one, losing the old values.",
        "Using a for-each loop when you need to *modify* the array's elements — `for (int m : marks) { m " +
          "= 0; }` sets the local copy `m` to 0 and leaves the actual array completely untouched.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Array size is fixed at creation; `array.length` (no parentheses) gives that fixed size.",
        "Indices run from 0 to length-1 — index length itself is always out of bounds.",
        "for-each (`for (int m : marks)`) reads elements in order but cannot write back into the array.",
        "`new int[n]` fills every slot with that type's default: 0, false, or null.",
        "A 2D array is an array of arrays — `grid[row][col]`, both indices from 0.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How do you find the length of an array?\" sounds trivial but genuinely catches people who " +
          "reflexively write `.length()` from String habit — `.length` with no parentheses is the correct, " +
          "expected answer here.",
        "Finding the max/min, reversing, or summing an array by hand-writing the loop (not calling a " +
          "library method) is an extremely common early exercise, precisely because it tests indexing and " +
          "loop bounds together.",
        "\"What exception do you get from an invalid array index?\" — `ArrayIndexOutOfBoundsException`, " +
          "thrown at run time, not caught at compile time, since the index is often only known once the " +
          "program runs.",
      ],
    },
    {
      kind: "quiz",
      question: "Given `int[] a = {10, 20, 30};`, what does `a[a.length - 1]` give?",
      options: ["10", "20", "30", "It throws an exception."],
      answer: 2,
      why:
        "a.length is 3. a.length - 1 is 2, the index of the last valid element in a 3-element array " +
        "(indices 0, 1, 2). a[2] is 30.",
    },
    {
      kind: "quiz",
      question: "What happens when you run `for (int m : marks) { m = m * 2; }` intending to double every element of marks in place?",
      options: [
        "It works exactly as intended, doubling every element of marks, because m refers to each slot in turn.",
        "It fails to compile, since a for-each loop variable cannot be reassigned inside the loop body.",
        "It compiles and runs, but marks is unchanged; m is a copy of each element, not the array slot itself.",
        "It throws an exception at runtime, because the loop is modifying the array while it iterates.",
      ],
      answer: 2,
      why:
        "The for-each loop hands you a fresh local copy of each element on every iteration. Reassigning " +
        "that copy has no effect on the array itself — an indexed for loop (`marks[i] = marks[i] * 2;`) " +
        "is required to actually modify the array.",
    },
    {
      kind: "quiz",
      question: "In `int[][] seating = {{1,2,3},{4,5,6}};`, what is `seating.length`?",
      options: ["6, the total number of elements", "3, the length of one row", "2, the number of rows", "It fails to compile."],
      answer: 2,
      why:
        "seating is an array of arrays. Its own .length is the number of rows (2) — the outer array's " +
        "size. Each row's own length (3, here) is a separate property, accessed as seating[row].length.",
    },
  ],
};
