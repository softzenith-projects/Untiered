import type { Chapter } from "@/content/courses/types";

export const chapterFileIO: Chapter = {
  slug: "file-io",
  title: "File I/O: Reading and Writing Files",
  summary:
    "Everything in your programs so far has vanished the moment they finished running. Files are how a " +
    "program remembers something after it exits — and modern Java's java.nio.file API makes reading and " +
    "writing one almost boringly simple.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Every array, list, and map you've built in this course lived only in memory — the instant `main` " +
        "finished, it was gone. A file is storage that survives the program ending, the computer " +
        "restarting, even the program running again tomorrow. Reading a resume, saving a report, loading a " +
        "config — all of it starts with file I/O (input/output).",
    },
    { kind: "h", text: "The school register, on paper" },
    {
      kind: "analogy",
      title: "A paper register you can put away and take back out",
      text:
        "A class's marks, kept only in a teacher's head, are gone the moment the teacher forgets or leaves " +
        "the school. Writing them into the paper register means anyone — the same teacher next year, a " +
        "different teacher entirely — can open that register and read the exact same marks back, long " +
        "after the moment they were written. `Files.write(path, lines)` is putting the register away, fully " +
        "written; `Files.readAllLines(path)` is taking it back out and reading every line. Where the analogy " +
        "stops: a paper register can only be appended to by physically writing on the next blank line; a " +
        "computer file has to be told explicitly whether you mean to overwrite what's there or append after " +
        "it — `Files.write` defaults to overwriting, and appending needs a specific option, shown below.",
    },
    {
      kind: "code",
      caption: "Write lines to a file, read them back, append, and delete — java.nio.file.Files end to end.",
      code:
        "import java.io.IOException;\n" +
        "import java.nio.file.Files;\n" +
        "import java.nio.file.Path;\n" +
        "import java.nio.file.StandardOpenOption;\n" +
        "import java.util.List;\n" +
        "\n" +
        "public class FileIODemo {\n" +
        "    public static void main(String[] args) throws IOException {\n" +
        '        Path file = Path.of("students.txt");\n' +
        "\n" +
        '        List<String> lines = List.of("Priya,87", "Arjun,91", "Vikram,78");\n' +
        "        Files.write(file, lines);\n" +
        '        System.out.println("Wrote " + lines.size() + " lines to " + file);\n' +
        "\n" +
        "        List<String> readBack = Files.readAllLines(file);\n" +
        '        System.out.println("Read back: " + readBack);\n' +
        "\n" +
        "        int total = 0;\n" +
        "        for (String line : readBack) {\n" +
        '            String[] parts = line.split(",");\n' +
        "            total += Integer.parseInt(parts[1]);\n" +
        "        }\n" +
        '        System.out.println("Total marks: " + total);\n' +
        "\n" +
        '        Files.writeString(file, "Neha,95" + System.lineSeparator(), StandardOpenOption.APPEND);\n' +
        '        System.out.println("After append: " + Files.readAllLines(file));\n' +
        "\n" +
        "        Files.deleteIfExists(file);\n" +
        '        System.out.println("File exists after delete: " + Files.exists(file));\n' +
        "    }\n" +
        "}\n",
      output:
        "Wrote 3 lines to students.txt\n" +
        "Read back: [Priya,87, Arjun,91, Vikram,78]\n" +
        "Total marks: 256\n" +
        "After append: [Priya,87, Arjun,91, Vikram,78, Neha,95]\n" +
        "File exists after delete: false",
    },
    {
      kind: "p",
      text:
        "`Path.of(\"students.txt\")` names a file location without touching the disk yet — a `Path` is just " +
        "a description of where a file is or would be. `Files.write(file, lines)` writes each element of " +
        "`lines` as its own line, creating the file if it doesn't exist and overwriting it if it does. " +
        "`Files.readAllLines(file)` reads the whole file back as a `List<String>`, one entry per line — " +
        "notice it's used exactly like any other `List` you've worked with since the collections chapters. " +
        "`main` is declared `throws IOException` — reading or writing a file is a **checked** exception " +
        "scenario (the disk might be full, the file might be locked, permissions might be missing), so every " +
        "method touching `Files` either handles `IOException` or declares it, per the exceptions chapter.",
    },
    { kind: "h", text: "Overwrite versus append" },
    {
      kind: "p",
      text:
        "`Files.write(file, lines)` with no extra option always starts from an empty file — call it twice " +
        "and the second call replaces the first content entirely, it doesn't add to it. To add to the end " +
        "instead, pass `StandardOpenOption.APPEND` explicitly, as the example does for Neha's line — without " +
        "it, that call would have erased Priya, Arjun, and Vikram's lines and left only Neha's.",
    },
    {
      kind: "viz",
      title: "Why total marks reads 256 after parsing the file back",
      caption: "Each line's marks column is parsed and folded into the running total; the note-line describes exactly the split/parse step underneath the highlighted cell.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "Priya,87" }, { value: "Arjun,91" }, { value: "Vikram,78" }],
            note: "readBack holds [\"Priya,87\", \"Arjun,91\", \"Vikram,78\"] — three lines, exactly as written.",
          },
          {
            cells: [{ value: "Priya,87", state: "done", pointers: ["total=87"] }, { value: "Arjun,91" }, { value: "Vikram,78" }],
            note: "For \"Priya,87\": split(\",\") gives [\"Priya\", \"87\"]; parts[1] is \"87\", parsed to int 87. total becomes 87.",
          },
          {
            cells: [{ value: "Priya,87", state: "done" }, { value: "Arjun,91", state: "done", pointers: ["total=178"] }, { value: "Vikram,78" }],
            note: "For \"Arjun,91\": parts[1] is \"91\". total becomes 87 + 91 = 178.",
          },
          {
            cells: [{ value: "Priya,87", state: "done" }, { value: "Arjun,91", state: "done" }, { value: "Vikram,78", state: "done", pointers: ["total=256"] }],
            note: "For \"Vikram,78\": parts[1] is \"78\". total becomes 178 + 78 = 256.",
          },
          {
            cells: [{ value: "Priya,87", state: "done" }, { value: "Arjun,91", state: "done" }, { value: "Vikram,78", state: "done" }],
            note: "Final total, printed after the loop: 256.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting `Files.write` overwrites by default — a second plain call erases the first one's " +
          "content entirely; use `StandardOpenOption.APPEND` deliberately when that's not what you want.",
        "Not declaring or catching `IOException` around file operations — it's a checked exception, so " +
          "skipping this is a compile error, not a runtime surprise.",
        "Assuming a relative path like `\"students.txt\"` always points where you expect — it resolves " +
          "relative to the program's current working directory, which can differ depending on how the " +
          "program is launched.",
        "Reading a huge file entirely into memory with `readAllLines` when it doesn't need to fit in memory " +
          "at once — for very large files, a streaming approach (`Files.lines(path)`, closed properly) is " +
          "more appropriate, though out of scope for this chapter.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Path.of(...) describes a file location; Files holds the actual read/write operations.",
        "Files.write(path, lines) overwrites by default; pass StandardOpenOption.APPEND to add instead.",
        "Files.readAllLines(path) returns a List<String>, one element per line.",
        "File operations throw the checked IOException — declare throws or catch it.",
        "Files.exists(path) and Files.deleteIfExists(path) check and remove a file safely.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How would you read a text file in Java?\" — java.nio.file.Files with readAllLines (or a " +
          "streaming approach for large files) is the modern, expected answer over older java.io " +
          "boilerplate.",
        "\"Why is IOException checked?\" — file operations depend on external state (disk, permissions) " +
          "that can fail in ways the program can't prevent, which is exactly the case checked exceptions " +
          "are meant for.",
        "You may be asked to parse a simple CSV-like file, exactly as the marks-total example does — " +
          "split() plus a loop is the standard, expected approach.",
      ],
    },
    {
      kind: "quiz",
      question: "What happens when Files.write(file, lines) is called a second time on the same file, with no APPEND option?",
      options: [
        "The new content is added after the existing content",
        "The file's previous content is overwritten entirely by the new content",
        "It throws an exception because the file already exists",
        "Both writes are merged line by line",
      ],
      answer: 1,
      why:
        "Files.write defaults to overwriting the file's contents. Without explicitly passing " +
        "StandardOpenOption.APPEND, a second write replaces everything the first write put there.",
    },
    {
      kind: "quiz",
      question: "Why must a method calling Files.readAllLines either catch IOException or declare `throws IOException`?",
      options: [
        "It's an optional style choice, and the code compiles whether or not the exception is handled.",
        "IOException is a checked exception, so the compiler forces you to handle or declare it.",
        "readAllLines never actually throws anything, so the try/catch would always be unnecessary.",
        "This is true only on Windows, where file access can fail; other systems never throw it.",
      ],
      answer: 1,
      why:
        "File operations can fail for reasons outside the program's control (missing file, permissions, " +
        "disk issues), so Java models them with the checked IOException, which the compiler requires you to " +
        "handle or propagate.",
    },
    {
      kind: "quiz",
      question: "Parsing \"Vikram,78\" with `line.split(\",\")`, what is `parts[1]`?",
      options: ["\"Vikram\"", "\"78\"", "\"Vikram,78\"", "78 as an int, directly"],
      answer: 1,
      why:
        "split(\",\") breaks the string at each comma into an array: [\"Vikram\", \"78\"]. parts[1] is the " +
        "second element, the string \"78\" — still text, which is why Integer.parseInt is needed to use it " +
        "as a number.",
    },
  ],
};
