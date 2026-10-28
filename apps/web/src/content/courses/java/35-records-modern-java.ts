import type { Chapter } from "@/content/courses/types";

export const chapterRecordsModernJava: Chapter = {
  slug: "records-modern-java",
  title: "Records and Modern Java Features",
  summary:
    "A closing tour of the syntax that makes recent Java feel like a different language from the one this " +
    "course started with: records for data-holder classes, sealed types, switch expressions, and var.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Back in the classes chapter, `Student` needed a constructor, fields, and (if you wanted equality or " +
        "printing to work sensibly) `equals()`, `hashCode()`, and `toString()` written out by hand — a lot " +
        "of boilerplate for a class whose entire job is holding a few values together. Modern Java " +
        "(officially since Java 16) has a purpose-built shorthand for exactly this shape of class.",
    },
    { kind: "h", text: "A printed form versus a class with every field spelled out" },
    {
      kind: "analogy",
      title: "A pre-printed form versus writing out every field's boilerplate by hand",
      text:
        "Writing a `Point` class the old way is like designing a form from scratch every time you need one — " +
        "drawing the boxes, labelling each field, writing instructions for how to compare two filled forms. " +
        "A **record** — `record Point(int x, int y) {}` — is like using a standard, pre-printed form: state " +
        "the fields once, in the header, and the constructor, the getters (`x()`, `y()`, not `getX()`), a " +
        "correct `equals()`/`hashCode()` (comparing by value, exactly what the hashing chapter said you must " +
        "get right), and a readable `toString()` are all generated for you, consistently, every time. Where " +
        "the analogy stops: a printed form is genuinely fixed once printed; a record can still have real " +
        "methods added to it (`distanceSquaredFromOrigin()` below), it just can't add extra mutable fields " +
        "beyond what's declared in its header, and every field it does have is `final` — a record is always " +
        "immutable by design.",
    },
    {
      kind: "code",
      caption:
        "A record for a value class, a sealed interface with a pattern-matching switch expression, and " +
        "var/switch-with-arrows as everyday syntax.",
      code:
        "import java.util.List;\n" +
        "\n" +
        "record Point(int x, int y) {\n" +
        "    int distanceSquaredFromOrigin() {\n" +
        "        return x * x + y * y;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "sealed interface Shape permits Circle, Rectangle {}\n" +
        "record Circle(double radius) implements Shape {}\n" +
        "record Rectangle(double width, double height) implements Shape {}\n" +
        "\n" +
        "public class RecordsDemo {\n" +
        "    static double area(Shape shape) {\n" +
        "        return switch (shape) {\n" +
        "            case Circle c -> Math.PI * c.radius() * c.radius();\n" +
        "            case Rectangle r -> r.width() * r.height();\n" +
        "        };\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        Point p1 = new Point(3, 4);\n" +
        "        Point p2 = new Point(3, 4);\n" +
        "\n" +
        '        System.out.println("p1 = " + p1);\n' +
        '        System.out.println("p1.equals(p2): " + p1.equals(p2));\n' +
        '        System.out.println("p1.x() = " + p1.x() + ", p1.y() = " + p1.y());\n' +
        '        System.out.println("Distance squared: " + p1.distanceSquaredFromOrigin());\n' +
        "\n" +
        "        List<Shape> shapes = List.of(new Circle(2.0), new Rectangle(3.0, 4.0));\n" +
        "        for (Shape s : shapes) {\n" +
        '            System.out.printf("Area: %.2f%n", area(s));\n' +
        "        }\n" +
        "\n" +
        "        int score = 87;\n" +
        "        String grade = switch (score / 10) {\n" +
        '            case 10, 9 -> "A";\n' +
        '            case 8 -> "B";\n' +
        '            case 7 -> "C";\n' +
        '            default -> "F";\n' +
        "        };\n" +
        '        System.out.println("Grade for " + score + ": " + grade);\n' +
        "\n" +
        '        var message = "Modern Java, inferred type";\n' +
        "        System.out.println(message);\n" +
        "    }\n" +
        "}\n",
      output:
        "p1 = Point[x=3, y=4]\n" +
        "p1.equals(p2): true\n" +
        "p1.x() = 3, p1.y() = 4\n" +
        "Distance squared: 25\n" +
        "Area: 12.57\n" +
        "Area: 12.00\n" +
        "Grade for 87: B\n" +
        "Modern Java, inferred type",
    },
    {
      kind: "p",
      text:
        "`p1.equals(p2)` is `true` even though `p1` and `p2` are two separate objects — the record's " +
        "*generated* `equals()` compares by value (`x` and `y` match), exactly the correctly-implemented " +
        "behaviour the hashing chapter said you must write by hand for an ordinary class. `p1.x()` — not " +
        "`getX()` — is the generated accessor; records deliberately don't follow the older JavaBean " +
        "`getX()`/`getY()` naming. `sealed interface Shape permits Circle, Rectangle` restricts which " +
        "classes are allowed to implement `Shape` at all — only `Circle` and `Rectangle`, listed explicitly " +
        "— and this is exactly what lets the `switch` expression in `area()` be **exhaustive**: the compiler " +
        "knows those are the only two possibilities, so no `default` branch is needed, and it will refuse to " +
        "compile if a new `Shape` implementation is added later without updating this `switch`.",
    },
    { kind: "h", text: "Switch expressions and var" },
    {
      kind: "p",
      text:
        "The `switch (score / 10)` used here is a **switch expression** — it produces a value directly " +
        "(assigned straight to `grade`), using `->` instead of the older `case X: ... break;` form, and " +
        "with no fall-through risk: each arrow case handles exactly its own listed values (`case 10, 9 -> " +
        "\"A\";` matches either) and nothing leaks into the next case by accident, unlike the old-style " +
        "`switch` from the control-flow chapter. `var message = \"...\";` lets the compiler infer the " +
        "variable's type from the right-hand side — `message` is still genuinely, fixedly a `String`, " +
        "checked at compile time exactly as if you'd written `String message = ...` — `var` only saves " +
        "typing the type name; it does **not** make Java dynamically typed.",
    },
    {
      kind: "table",
      head: ["Feature", "Since", "Saves you from"],
      rows: [
        ["record", "Java 16", "Hand-written constructor, accessors, equals/hashCode/toString for a data holder"],
        ["sealed interface/class", "Java 17", "An open-ended set of subtypes when you actually want a known, closed list"],
        ["switch expression (->)", "Java 14", "case fall-through bugs; also lets switch directly produce a value"],
        ["var", "Java 10", "Repeating an obvious type name on both sides of a local variable declaration"],
        ["Pattern matching in switch (case Circle c ->)", "Java 21", "A manual instanceof-and-cast chain for handling each subtype"],
      ],
    },
    {
      kind: "viz",
      title: "Why area(new Rectangle(3.0, 4.0)) matches the Rectangle branch, not Circle",
      caption: "Java checks each case pattern in order against shape's actual runtime type — a done rung is where the match happened.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "case Circle c", state: "active" }, { value: "case Rectangle r" }],
            note: "shape's actual runtime type is Rectangle (created via new Rectangle(3.0, 4.0)). The switch expression checks shape's type against each case pattern in order: case Circle c — does not match, shape isn't a Circle.",
          },
          {
            cells: [{ value: "case Circle c", state: "compare" }, { value: "case Rectangle r", state: "done" }],
            note: "case Rectangle r — matches; r is bound to the same Rectangle object, with r.width() and r.height() directly accessible.",
          },
          {
            cells: [{ value: "case Circle c", state: "compare" }, { value: "case Rectangle r", state: "done" }],
            note: "The matching arm evaluates: r.width() * r.height() = 3.0 * 4.0 = 12.0, formatted to 12.00 by printf.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Trying to add a mutable field to a record beyond its header — records are deliberately restricted " +
          "to the components declared in `record Name(...)`, and every one of those is `final`; use a " +
          "regular class if you need genuinely mutable state.",
        "Assuming `var` makes Java loosely typed like some scripting languages — it doesn't; the type is " +
          "still fixed and checked at compile time, `var` only omits writing it explicitly where it's " +
          "already obvious.",
        "Forgetting a `sealed` type's permitted subtypes must be listed explicitly (`permits ...`) — or, if " +
          "they're all defined in the very same file, the `permits` clause can be omitted and Java infers it.",
        "Using old-style `switch` with `case X:` and manual `break;` out of habit where a switch expression " +
          "would be safer and shorter — the newer arrow form is generally preferred for new code, though " +
          "both remain valid Java.",
      ],
    },
    {
      kind: "remember",
      items: [
        "record Name(fields...) {} auto-generates a constructor, accessors (x(), not getX()), equals/hashCode/toString by value.",
        "A record is always immutable — its declared components are final and can't be reassigned.",
        "sealed restricts which types may implement/extend a type, enabling exhaustive switch with no default needed.",
        "Switch expressions (case X -> value) return a value directly and avoid fall-through bugs.",
        "var infers a local variable's type at compile time — it stays statically typed, just written shorter.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is a record, and when would you use one?\" is an increasingly common modern-Java question " +
          "— a concise, immutable data holder is the expected core answer, with equals/hashCode/toString " +
          "generated correctly by value as the specific win over a hand-written class.",
        "\"What does sealed do, and why combine it with switch?\" — it closes the set of permitted " +
          "subtypes, which is exactly what lets a switch over them be checked exhaustively by the compiler.",
        "\"Does var make Java dynamically typed?\" is a common misconception worth being able to correct " +
          "precisely — no, the type is still fixed and inferred at compile time, only the source text is shorter.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is p1.equals(p2) true for two separately created `new Point(3, 4)` records?",
      options: [
        "It isn't true: records always compare by identity, like ordinary objects created with new.",
        "Records automatically generate equals() and hashCode() that compare their components by value.",
        "Only because == was actually used in that comparison, rather than the equals() method.",
        "Because Java caches Point objects like small Integers, so both variables share one object.",
      ],
      answer: 1,
      why:
        "A record's compiler-generated equals() compares all of its declared components by value, unlike " +
        "the identity-based default Object.equals() an ordinary class would have without an explicit override.",
    },
    {
      kind: "quiz",
      question: "What does declaring `sealed interface Shape permits Circle, Rectangle {}` enable?",
      options: [
        "Nothing beyond documentation: the compiler ignores permits, and any other class may still implement Shape.",
        "The compiler knows Circle and Rectangle are the only Shape subtypes, so a switch can be exhaustive with no default.",
        "It makes every method of Shape automatically final, so Circle and Rectangle cannot override them.",
        "It stops Circle and Rectangle from being records, because sealed types may only be ordinary classes.",
      ],
      answer: 1,
      why:
        "sealed restricts which types may implement Shape to the explicitly permitted list. This lets the " +
        "compiler verify a switch over Shape covers every possible case, without needing a fallback default arm.",
    },
    {
      kind: "quiz",
      question: "Is `var message = \"hello\";` dynamically typed — can message later be reassigned to hold an int?",
      options: [
        "Yes, var lets the variable's type change whenever a value of another type is assigned.",
        "No, var infers the type once at compile time; message stays a String, and assigning an int is a compile error.",
        "Yes, but only for local variables inside a method; fields declared with var keep a fixed type.",
        "It depends on the JVM version, since older runtimes treated var as a dynamic type.",
      ],
      answer: 1,
      why:
        "var is purely a compile-time convenience for omitting an explicit type when it's inferable. The " +
        "variable's type is fixed at that point, exactly as if the type had been written out, so " +
        "message = 5; afterward would be a compile error.",
    },
  ],
};
