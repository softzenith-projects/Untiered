import type { Chapter } from "@/content/courses/types";

export const chapterStatic: Chapter = {
  slug: "static",
  title: "static: Belonging to the Class, Not the Object",
  summary:
    "Most fields and methods belong to one object. static ones belong to the class itself — shared by " +
    "every object, and reachable even before any object exists.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "Every field you've written so far — `name`, `marks`, `rollNumber` — gets its own separate copy in " +
        "every object; that's the whole point of a class. But some data genuinely belongs to the *kind of " +
        "thing*, not to any one instance of it — a running count of how many students exist, or a school " +
        "name shared by every student record. `static` is how you tell Java that.",
    },
    { kind: "h", text: "The school notice board analogy" },
    {
      kind: "analogy",
      title: "Each student's own notebook versus the school's single notice board",
      text:
        "Every student carries their own notebook — their own marks, their own name — and writing in one " +
        "student's notebook never touches anyone else's; that's an ordinary (**instance**) field. The school " +
        "also has exactly one notice board in the corridor, visible to and shared by every student at once — " +
        "there's only ever one board, no matter how many students the school has. A `static` field is that " +
        "notice board: `static int count` exists exactly once *per class*, not once per object, and every " +
        "object of that class sees the same shared value. Where the analogy stops: a notice board needs a " +
        "school building to exist first; a `static` field or method is reachable through the class name " +
        "directly (`Student.count`), even if not a single `Student` object has been created yet.",
    },
    {
      kind: "code",
      caption: "A static counter shared across every Student object, and a static method to read it.",
      code:
        "class Student {\n" +
        "    static int count = 0;\n" +
        '    static String schoolName = "DAV Public School";\n' +
        "\n" +
        "    String name;\n" +
        "\n" +
        "    Student(String name) {\n" +
        "        this.name = name;\n" +
        "        count++;\n" +
        "    }\n" +
        "\n" +
        "    static int getCount() {\n" +
        "        return count;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class StaticDemo {\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("Before any student: " + Student.count);\n' +
        "\n" +
        '        Student s1 = new Student("Priya");\n' +
        '        Student s2 = new Student("Arjun");\n' +
        '        Student s3 = new Student("Vikram");\n' +
        "\n" +
        '        System.out.println("After three students: " + Student.count);\n' +
        '        System.out.println("Via getCount(): " + Student.getCount());\n' +
        '        System.out.println("Via an instance, s1.count: " + s1.count);\n' +
        '        System.out.println("School (shared): " + s2.schoolName);\n' +
        "    }\n" +
        "}\n",
      output:
        "Before any student: 0\n" +
        "After three students: 3\n" +
        "Via getCount(): 3\n" +
        "Via an instance, s1.count: 3\n" +
        "School (shared): DAV Public School",
    },
    {
      kind: "p",
      text:
        "`count` is declared once, `static`, so there is exactly one `count` no matter how many `Student` " +
        "objects exist. Every constructor call runs `count++`, and because it's the *same* shared variable, " +
        "each new student's constructor sees and increments the running total — after three students it " +
        "reads `3`, not `1` reset per object. `s1.count` shows that a static field is technically reachable " +
        "through an object reference too, but this is misleading style; the field still isn't \"s1's own\" — " +
        "it's the class's, and the convention (and what a linter will flag) is to always write `Student." +
        "count`, never `s1.count`. `getCount()` is a **static method** — declared `static`, callable as " +
        "`Student.getCount()` with no object needed at all, which is exactly how `main` itself is always " +
        "declared.",
    },
    { kind: "h", text: "What static methods cannot do" },
    {
      kind: "p",
      text:
        "A static method has no particular object behind it when it runs, so it cannot use `this`, and it " +
        "cannot directly touch an instance field like `name` — there is no `name` to mean without an object " +
        "to own one. A static method *can* use static fields (`count`), call other static methods, and " +
        "accept an object as a parameter and use its instance fields through that reference. This is exactly " +
        "why `main` — always `public static void main(String[] args)` — can run before your program has " +
        "created a single object: the JVM calls it directly on the class, with nothing to `new` first.",
    },
    {
      kind: "viz",
      title: "Why Student.count reads 3, not 1, after three separate `new Student(...)` calls",
      caption: "One box, shared by every object of the class — there is no separate copy per Student to get out of sync.",
      viz: {
        type: "array",
        frames: [
          { cells: [{ value: 0, pointers: ["Student.count"] }], note: "count is declared static — one shared int, stored with the class, not duplicated per object." },
          { cells: [{ value: 1, state: "active", pointers: ["Student.count"] }], note: "new Student(\"Priya\") runs the constructor, which executes count++ — count goes from 0 to 1." },
          {
            cells: [{ value: 2, state: "active", pointers: ["Student.count"] }],
            note: "new Student(\"Arjun\") runs the same constructor on a different object, but count++ still touches the one shared count — it goes from 1 to 2.",
          },
          { cells: [{ value: 3, state: "active", pointers: ["Student.count"] }], note: "new Student(\"Vikram\") pushes it to 3." },
          {
            cells: [{ value: 3, state: "done", pointers: ["Student.count"] }],
            note: "Because every object's constructor incremented the same variable, Student.count correctly reads 3 afterward, regardless of which object you ask through.",
          },
        ],
      },
    },
    {
      kind: "playground",
      language: "java",
      prompt:
        "Create a fourth student and run: `count` reaches 4 however you read it, because the class holds " +
        "one shared copy. Then remove `static` from `count` and read the compile error.",
      starter:
        "public class StaticDemo {\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("Before any student: " + Student.count);\n' +
        "\n" +
        '        Student s1 = new Student("Priya");\n' +
        '        Student s2 = new Student("Arjun");\n' +
        '        Student s3 = new Student("Vikram");\n' +
        "\n" +
        '        System.out.println("After three students: " + Student.count);\n' +
        '        System.out.println("Via getCount(): " + Student.getCount());\n' +
        '        System.out.println("Via an instance, s1.count: " + s1.count);\n' +
        '        System.out.println("School (shared): " + s2.schoolName);\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Student {\n" +
        "    static int count = 0;\n" +
        '    static String schoolName = "DAV Public School";\n' +
        "\n" +
        "    String name;\n" +
        "\n" +
        "    Student(String name) {\n" +
        "        this.name = name;\n" +
        "        count++;\n" +
        "    }\n" +
        "\n" +
        "    static int getCount() {\n" +
        "        return count;\n" +
        "    }\n" +
        "}\n",
      expectedOutput:
        "Before any student: 0\n" +
        "After three students: 3\n" +
        "Via getCount(): 3\n" +
        "Via an instance, s1.count: 3\n" +
        "School (shared): DAV Public School",
    },
    {
      kind: "pitfall",
      items: [
        "Reading a static field through an object (`s1.count`) — it compiles and even works, but it hides " +
          "the fact that the field is shared and every linter/interviewer will consider it bad style; use " +
          "`Student.count`.",
        "Trying to reference an instance field or `this` inside a static method — this is a compile error, " +
          "not a run-time surprise, because a static method has no guaranteed object to belong to.",
        "Expecting each object to get its own copy of a static field, the way it does for instance fields " +
          "— it never does; there is exactly one, shared.",
        "Forgetting that static fields are initialised once, when the class is first loaded — not once " +
          "per object created.",
      ],
    },
    {
      kind: "remember",
      items: [
        "static means \"belongs to the class,\" not to any one object — exactly one copy, shared by all.",
        "Access a static member through the class name: Student.count, Student.getCount().",
        "A static method has no this and cannot touch instance fields directly.",
        "main is static so the JVM can call it with zero objects created yet.",
        "Static fields are perfect for counters, constants, and anything genuinely one-per-class.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Why is main() static?\" is asked constantly — because the JVM must be able to call it before any " +
          "object of your class exists.",
        "\"Can a static method be overridden?\" is a common trap — no, static methods are resolved at " +
          "compile time based on the reference type, which is a different mechanism from overriding " +
          "(covered in the polymorphism chapter).",
        "You may be asked to trace a shared counter across multiple object creations, exactly like count " +
          "above — the key insight to state out loud is \"one variable, shared, not reset per object\".",
      ],
    },
    {
      kind: "quiz",
      question: "After three `new Student(...)` calls, each running `count++` on a static int count, what does Student.count read?",
      options: ["0", "1", "3", "It depends on which object you check"],
      answer: 2,
      why:
        "count is static — one shared variable. All three constructor calls incremented the same field, " +
        "so it correctly holds 3 regardless of which object (or the class name directly) you read it from.",
    },
    {
      kind: "quiz",
      question: "Why can't a static method reference an instance field directly?",
      options: [
        "It is only a naming and style rule, and the compiler would accept the code with just a warning.",
        "A static method may run when no object exists yet, so there is no instance field for it to refer to.",
        "Instance fields are always private, and static methods can never see private members of their class.",
        "It actually can: this is a myth, and a static method may read any instance field it can see.",
      ],
      answer: 1,
      why:
        "A static method belongs to the class and can be called without any object existing. Instance " +
        "fields only exist inside a specific object, so there's nothing for the static method to reach " +
        "without one being explicitly passed in.",
    },
    {
      kind: "quiz",
      question: "Which of these is the conventionally correct way to access a static field named count on class Student?",
      options: ["s1.count where s1 is a Student object", "Student.count", "Student->count", "count.Student"],
      answer: 1,
      why:
        "Static members belong to the class, so the class name is the correct, idiomatic way to access " +
        "them — Student.count. Accessing it via an object reference compiles but is considered poor style.",
    },
  ],
};
