import type { Chapter } from "@/content/courses/types";

export const chapterInheritance: Chapter = {
  slug: "inheritance-and-super",
  title: "Inheritance and super",
  summary:
    "How one class can reuse and extend another instead of repeating its fields and methods — plus super, " +
    "the keyword that reaches back up to the parent's version of something.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Imagine a payroll system with `Employee` and `Manager` — both need a name and a base salary and " +
        "the ability to print a payslip; a `Manager` additionally earns a team bonus. Copy-pasting " +
        "`Employee`'s fields and methods into `Manager` works, but now a bug fix in one has to be repeated " +
        "in the other by hand, forever. Inheritance lets `Manager` reuse `Employee` completely and add only " +
        "what's different.",
    },
    { kind: "h", text: "The family resemblance analogy" },
    {
      kind: "analogy",
      title: "A general job role versus a specialised one built on top of it",
      text:
        "Think of \"Employee\" as the general job role at a company — everyone gets a name, a base salary, " +
        "and a payslip. \"Manager\" is a specialised role: still fundamentally an employee (gets a name, a " +
        "base salary, a payslip), but with an extra responsibility — a team bonus — layered on top. Every " +
        "manager genuinely *is* an employee; the reverse isn't true. In Java, `class Manager extends " +
        "Employee` declares exactly this relationship: `Manager` automatically gets every non-private field " +
        "and method `Employee` has, and adds or changes only what makes it different. `Employee` here is the " +
        "**superclass** (or parent/base class); `Manager` is the **subclass** (or child/derived class). " +
        "Where the analogy stops: a real job role can't retroactively change how the general role behaves — " +
        "but a subclass genuinely can *override* a parent's method with its own version, which is exactly " +
        "what `computePay()` does below.",
    },
    {
      kind: "code",
      caption: "Manager extends Employee, calls the parent's constructor with super(...), and extends computePay().",
      code:
        "class Employee {\n" +
        "    protected String name;\n" +
        "    protected double baseSalary;\n" +
        "\n" +
        "    Employee(String name, double baseSalary) {\n" +
        "        this.name = name;\n" +
        "        this.baseSalary = baseSalary;\n" +
        "    }\n" +
        "\n" +
        "    double computePay() {\n" +
        "        return baseSalary;\n" +
        "    }\n" +
        "\n" +
        "    void printPaySlip() {\n" +
        '        System.out.println(name + "\'s pay: " + computePay());\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Manager extends Employee {\n" +
        "    private double teamBonus;\n" +
        "\n" +
        "    Manager(String name, double baseSalary, double teamBonus) {\n" +
        "        super(name, baseSalary);\n" +
        "        this.teamBonus = teamBonus;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    double computePay() {\n" +
        "        double base = super.computePay();\n" +
        "        return base + teamBonus;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class InheritanceDemo {\n" +
        "    public static void main(String[] args) {\n" +
        '        Employee e = new Employee("Arjun", 40000);\n' +
        '        Manager m = new Manager("Priya", 60000, 15000);\n' +
        "\n" +
        "        e.printPaySlip();\n" +
        "        m.printPaySlip();\n" +
        "\n" +
        '        System.out.println("m instanceof Employee: " + (m instanceof Employee));\n' +
        "    }\n" +
        "}\n",
      output: "Arjun's pay: 40000.0\nPriya's pay: 75000.0\nm instanceof Employee: true",
    },
    {
      kind: "p",
      text:
        "`Manager`'s constructor calls `super(name, baseSalary);` as its first line — this runs `Employee`'s " +
        "constructor to set up the fields `Manager` inherited, before `Manager` sets up `teamBonus` itself. " +
        "Just like `this(...)`, a `super(...)` call must be the first statement. `computePay()` is marked " +
        "`@Override` and replaces `Employee`'s version for `Manager` objects specifically; inside it, " +
        "`super.computePay()` deliberately calls the *parent's* version to get the base salary, then adds " +
        "the bonus on top, instead of duplicating `return baseSalary;`. `printPaySlip()` was never rewritten " +
        "in `Manager` at all — it's inherited as-is, and it still works correctly for `Manager` because it " +
        "calls `computePay()`, which resolves to `Manager`'s own overridden version when called on a " +
        "`Manager` object (this is polymorphism, the next chapter's topic).",
    },
    { kind: "h", text: "protected, and single inheritance" },
    {
      kind: "p",
      text:
        "`name` and `baseSalary` are `protected`, not `private` — this is what lets `Manager`'s code use " +
        "them (through the inherited constructor). A `private` field in `Employee` would be completely " +
        "invisible to `Manager`, even though `Manager` inherits it in a technical sense. Also worth knowing " +
        "precisely: Java allows a class to `extends` only **one** superclass — there's no multiple " +
        "inheritance of classes, unlike some languages. (Interfaces, in a later chapter, are how Java gets " +
        "some of the benefit of multiple inheritance without its problems.)",
    },
    {
      kind: "viz",
      title: "What runs, in order, when new Manager(\"Priya\", 60000, 15000) executes",
      caption: "The superclass constructor always finishes first, exactly like any other call on the stack — Manager's own fields aren't set until Employee's are.",
      viz: {
        type: "callstack",
        frames: [
          { stack: [{ label: "Manager(...)", state: "active" }], note: "Manager's constructor starts, sees super(name, baseSalary) as its first line, and pauses to run it." },
          {
            stack: [{ label: "Manager(...)" }, { label: "super: Employee(...)", state: "active" }],
            note: "Employee's constructor runs: this.name = \"Priya\"; this.baseSalary = 60000; — these fields now exist and are set, inherited into the Manager object being built.",
          },
          {
            stack: [{ label: "Manager(...)", state: "active" }],
            note: "Control returns to Manager's constructor, which resumes and sets this.teamBonus = 15000.",
          },
          {
            stack: [{ label: "Manager(...)", state: "returning" }],
            note: "The object is now fully constructed: a Manager with name, baseSalary, and teamBonus all set.",
          },
          {
            stack: [{ label: "m.printPaySlip()" }, { label: "Manager.computePay()", state: "returning" }],
            note: "m.printPaySlip() (inherited, unchanged) calls computePay() — which, on a Manager object, resolves to Manager's overridden version: 60000 + 15000 = 75000.",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Declaring fields `private` in the superclass when a subclass genuinely needs direct access — use " +
          "`protected`, or keep fields `private` and expose a `protected`/`public` method instead.",
        "Forgetting `super(...)` when the superclass has no no-argument constructor — Java inserts an " +
          "implicit `super();` call automatically only if the parent has a no-arg constructor available; " +
          "otherwise this is a compile error and `super(...)` with matching arguments must be written.",
        "Assuming `extends` supports multiple superclasses, like `class X extends A, B` — Java classes " +
          "support only single inheritance.",
        "Calling `super.method()` when the intent was actually to call `this`'s own overridden version — " +
          "`super.computePay()` specifically means \"skip my own override, use the parent's\".",
      ],
    },
    {
      kind: "remember",
      items: [
        "extends creates an is-a relationship: a Manager is an Employee, with more.",
        "A subclass inherits every non-private member and can add fields/methods or override existing ones.",
        "super(...) calls the parent's constructor; it must be the first statement, like this(...).",
        "super.method() explicitly calls the parent's version, even from inside an override.",
        "Java supports single inheritance of classes only — one extends per class.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is inheritance, and why use it?\" — lead with code reuse and the is-a relationship, with a " +
          "concrete example like Employee/Manager rather than an abstract definition.",
        "\"Does Java support multiple inheritance?\" — not for classes; interfaces are the mechanism it " +
          "offers instead, covered in the abstract classes and interfaces chapter.",
        "\"What's the difference between super() and this() inside a constructor?\" — both must be first " +
          "and only one may appear; super() calls the parent's constructor, this() calls another " +
          "constructor of the same class.",
      ],
    },
    {
      kind: "quiz",
      question: "What must be true for `super(name, baseSalary);` to be valid as the first line of Manager's constructor?",
      options: [
        "Employee must have a matching constructor accepting (String, double)",
        "Manager must also declare a field called baseSalary",
        "Employee must be declared final",
        "Nothing — super() always works regardless of the parent's constructors",
      ],
      answer: 0,
      why:
        "super(...) calls a specific constructor of the immediate superclass, matched by argument types, " +
        "exactly like a normal constructor call — Employee must actually declare one with that signature.",
    },
    {
      kind: "quiz",
      question: "Inside Manager's overridden computePay(), what does `super.computePay()` return?",
      options: [
        "Manager's own computePay() result, causing infinite recursion",
        "Employee's original computePay(), i.e. just baseSalary",
        "0, because super methods can't be called from an override",
        "It fails to compile, since the compiler insists that equals() and hashCode() are overridden together.",
      ],
      answer: 1,
      why:
        "super.computePay() explicitly bypasses Manager's own override and calls Employee's version, " +
        "returning baseSalary — that's exactly why Manager can add teamBonus on top without duplicating the " +
        "base salary logic.",
    },
    {
      kind: "quiz",
      question: "Can a Java class extend more than one superclass directly, e.g. `class X extends A, B`?",
      options: [
        "Yes, Java fully supports this",
        "No — Java classes support only single inheritance",
        "Only if A and B share no methods",
        "Only for abstract classes",
      ],
      answer: 1,
      why:
        "Java deliberately disallows multiple class inheritance to avoid the ambiguity it can cause " +
        "(e.g. two parents with conflicting methods). A class may extend only one superclass.",
    },
  ],
};
