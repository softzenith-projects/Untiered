import type { Chapter } from "@/content/courses/types";

export const chapterPackages: Chapter = {
  slug: "packages",
  title: "Packages: Organising Classes Into Namespaces",
  summary:
    "Why real Java projects group classes into folders that match dotted names, how import brings a class " +
    "from one package into another, and what package-private access is actually for.",
  minutes: 11,
  blocks: [
    {
      kind: "p",
      text:
        "Every program in this course so far has lived in a single file with no `package` statement at all " +
        "— fine for a chapter-sized example, unworkable the moment a real project has hundreds of classes " +
        "and two different teams both want to name something `Utils`. Packages are Java's answer: a folder " +
        "structure and naming scheme that keeps classes organised and prevents name clashes.",
    },
    { kind: "h", text: "The school's filing cabinet analogy" },
    {
      kind: "analogy",
      title: "A school office's labelled filing cabinets versus one giant pile of papers",
      text:
        "A school office doesn't keep every document in one enormous pile — it has a cabinet for " +
        "\"Admissions\", another for \"Accounts\", another for \"Sports\", each with its own drawers. Two " +
        "different cabinets can each contain a form called \"Application\" without any confusion, because " +
        "you always refer to one by its full location — \"Admissions > Application\" is clearly not " +
        "\"Accounts > Application\". A **package** is exactly this cabinet: `package com.school.util;` at " +
        "the top of a file says \"this class lives in the util cabinet, inside the school cabinet, inside " +
        "the com cabinet\", and its full, unambiguous name becomes `com.school.util.MathUtils`. Two " +
        "different packages can each have their own `MathUtils` class with no clash, exactly as two cabinets " +
        "can each have their own \"Application\" form. Where the analogy stops: a physical filing cabinet's " +
        "location is just a convenience; in Java, the package name and the folder structure on disk *must* " +
        "match exactly — `com.school.util.MathUtils` is required to live at `com/school/util/MathUtils.java` " +
        "— it isn't optional bookkeeping.",
    },
    {
      kind: "code",
      caption:
        "Two files, two packages: com.school.util.MathUtils, imported and used from com.school.app.Main. " +
        "Compiled from the parent directory with javac com/school/util/MathUtils.java com/school/app/Main.java, " +
        "and run with java com.school.app.Main.",
      code:
        "// File: com/school/util/MathUtils.java\n" +
        "package com.school.util;\n" +
        "\n" +
        "public class MathUtils {\n" +
        "    public static int square(int n) {\n" +
        "        return n * n;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "// File: com/school/app/Main.java\n" +
        "package com.school.app;\n" +
        "\n" +
        "import com.school.util.MathUtils;\n" +
        "\n" +
        "public class Main {\n" +
        "    public static void main(String[] args) {\n" +
        "        int result = MathUtils.square(6);\n" +
        '        System.out.println("6 squared is " + result);\n' +
        "    }\n" +
        "}\n",
      output: "6 squared is 36",
    },
    {
      kind: "p",
      text:
        "`package com.school.util;` must be the very first non-comment line of `MathUtils.java`, and the " +
        "file must physically sit inside a folder path `com/school/util/` for the compiler to accept it. " +
        "`Main`, in a different package (`com.school.app`), cannot see `MathUtils` just by name — it needs " +
        "`import com.school.util.MathUtils;` to bring that specific class into scope, after which " +
        "`MathUtils.square(6)` reads exactly like calling a class in the same file. Without the import, " +
        "`Main` would have to spell out the full name every time: `com.school.util.MathUtils.square(6)` — " +
        "legal, just unnecessarily verbose, which is the entire reason `import` exists.",
    },
    { kind: "h", text: "Package-private access, properly explained" },
    {
      kind: "p",
      text:
        "The encapsulation chapter mentioned that omitting an access modifier gives package-private access. " +
        "Now that packages have a real meaning, that rule reads precisely: a package-private member " +
        "(`static int helperOnlyInThisPackage() { ... }`, no modifier, inside `MathUtils`) is visible to any " +
        "other class *in `com.school.util`* — but `Main`, sitting in the different package `com.school.app`, " +
        "cannot call it at all, even with a full import. This is genuinely useful: it lets a package expose " +
        "a small, deliberate `public` surface while keeping internal helper classes and methods invisible to " +
        "every other package in the project — a coarser, package-wide version of `private`.",
    },
    {
      kind: "table",
      head: ["Convention", "Example", "Why"],
      rows: [
        ["Reverse domain name as the root", "com.school.*, com.aiinterviewer.*", "Avoids clashes between different organisations' packages"],
        ["All lowercase", "com.school.util, not com.School.Util", "Java naming convention; uppercase is reserved for class names"],
        ["Folder path mirrors the package name exactly", "com.school.util → com/school/util/", "Required by the compiler and the JVM's class loader, not just a style choice"],
        ["import java.util.*;", "Brings in every top-level class in java.util", "A wildcard import — fine for scripts, often avoided in real projects for clarity about exactly what's used"],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Putting a `package` statement anywhere but the very first line (comments aside) of the file — " +
          "this is a compile error.",
        "Letting the folder structure drift from the package name — `com.school.util.MathUtils` must live " +
          "at `com/school/util/MathUtils.java`; a mismatch fails to compile.",
        "Assuming `import` is needed for classes in `java.lang` (like `String`, `Math`, `System`) — that " +
          "package is imported automatically into every file; you never write `import java.lang.String;`.",
        "Expecting a package-private member to be reachable from another package just because you wrote an " +
          "`import` for the class that contains it — `import` only brings in what's already accessible; it " +
          "never widens access.",
      ],
    },
    {
      kind: "remember",
      items: [
        "package NAME; must be the first line, and the folder path must match NAME exactly.",
        "import brings another package's public class into scope so you can use its short name.",
        "java.lang (String, Math, System, ...) is imported into every file automatically.",
        "Package-private (no modifier) access means \"visible to other classes in the same package only.\"",
        "Convention: lowercase, reverse-domain package names — com.company.module.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is a package, and why use one?\" — name-collision avoidance and organisation are the core " +
          "answer, ideally with the filing-cabinet framing or your own equivalent.",
        "\"What does it mean for a member to have default (package-private) access?\" is a natural " +
          "follow-up to the access-modifiers question from the encapsulation chapter — now answerable with " +
          "an actual package example.",
        "You may be asked why `java.lang` classes need no import while `java.util.ArrayList` does — the " +
          "answer is that only `java.lang` gets automatic, implicit importing.",
      ],
    },
    {
      kind: "quiz",
      question: "Where must MathUtils.java physically live if it declares `package com.school.util;`?",
      options: [
        "Anywhere — package names are just labels with no folder requirement",
        "In a folder named exactly com/school/util/",
        "In a folder named util/",
        "In the same folder as the class that imports it",
      ],
      answer: 1,
      why:
        "Java's compiler and class loader require the folder path to mirror the package name exactly — " +
        "com.school.util maps to the folder path com/school/util/, dots becoming path separators.",
    },
    {
      kind: "quiz",
      question: "Why does Main.java never need `import java.lang.System;` to use System.out.println?",
      options: [
        "System isn't really in a package",
        "java.lang is imported automatically into every Java file",
        "println is a keyword, not a method",
        "It's a compiler bug that happens to be convenient",
      ],
      answer: 1,
      why:
        "java.lang — which includes String, Math, System, and other fundamentals — is the one package Java " +
        "imports into every file implicitly, so no explicit import line is ever needed for it.",
    },
    {
      kind: "quiz",
      question: "A package-private method in com.school.util.MathUtils — can com.school.app.Main call it, even after importing MathUtils?",
      options: [
        "Yes, because the import gives Main full access to every method in MathUtils.",
        "No: package-private access doesn't extend to another package, whatever is imported.",
        "Only if Main also declares package com.school.util at the top of its own file.",
        "Only if the method is static, since imports expose the static methods of other packages.",
      ],
      answer: 1,
      why:
        "import only brings a class's already-accessible members into scope by short name; it never " +
        "widens access. A package-private member stays invisible outside its own package no matter what is imported.",
    },
  ],
};
