import type { Chapter } from "@/content/courses/types";

export const chapterAbstractInterfaces: Chapter = {
  slug: "abstract-classes-and-interfaces",
  title: "Abstract Classes and Interfaces",
  summary:
    "Two ways to declare \"every subtype must provide this\" without saying how — a half-built base class " +
    "that shares real code, and a pure contract a class can promise to fulfil from any number of directions.",
  minutes: 16,
  blocks: [
    {
      kind: "p",
      text:
        "`Shape.area()` in the last chapter had a body — `return 0.0;` — that no real shape actually wants; " +
        "it exists only so `Circle` and `Square` have something to override. That's a design smell: it lets " +
        "someone write `new Shape()` directly and get a meaningless, area-less shape. Java gives you two " +
        "tools to close that gap and be explicit that a type is incomplete on its own.",
    },
    { kind: "h", text: "A half-built form versus a job description" },
    {
      kind: "analogy",
      title: "A partly filled organisation chart versus a job's list of duties",
      text:
        "An **abstract class** is like a company's org chart with one box left blank on purpose — " +
        "\"Regional Manager\" — with the box's reporting lines and shared duties already drawn in ink, but " +
        "no person can occupy that exact box; only a specific, filled-in role like \"Regional Manager – " +
        "North\" can. `Vehicle` below is exactly this: it has a real, usable field and a real, working " +
        "method (`printInfo()`), but it deliberately leaves `fuelEfficiency()` unfilled — abstract — because " +
        "there is no sensible one-size-fits-all answer, only `Car`-shaped and `ElectricCar`-shaped answers. " +
        "An **interface**, by contrast, is closer to a job posting's list of duties with no org chart at " +
        "all attached — \"must be able to chargeBattery()\" — that *any* class can promise to fulfil, no " +
        "matter what family it otherwise belongs to. Where the analogy stops: a real employee can only sit " +
        "in one box of one org chart, but a Java class can `extends` at most one abstract (or any) class " +
        "*while also* `implements`-ing several unrelated interfaces at once — `ElectricCar` below is both a " +
        "`Vehicle` and separately promises to be `Chargeable`.",
    },
    {
      kind: "code",
      caption:
        "An abstract Vehicle with one real method and one unimplemented one, plus a Chargeable interface " +
        "implemented alongside it.",
      code:
        "abstract class Vehicle {\n" +
        "    protected String name;\n" +
        "\n" +
        "    Vehicle(String name) {\n" +
        "        this.name = name;\n" +
        "    }\n" +
        "\n" +
        "    abstract double fuelEfficiency();\n" +
        "\n" +
        "    void printInfo() {\n" +
        '        System.out.println(name + " gives " + fuelEfficiency() + " km/l");\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class Car extends Vehicle {\n" +
        "    Car(String name) { super(name); }\n" +
        "\n" +
        "    @Override\n" +
        "    double fuelEfficiency() {\n" +
        "        return 18.5;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "interface Chargeable {\n" +
        "    void chargeBattery();\n" +
        "\n" +
        "    default void printChargeStatus() {\n" +
        '        System.out.println("Charging status: OK");\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class ElectricCar extends Vehicle implements Chargeable {\n" +
        "    ElectricCar(String name) { super(name); }\n" +
        "\n" +
        "    @Override\n" +
        "    double fuelEfficiency() {\n" +
        "        return 0.0;\n" +
        "    }\n" +
        "\n" +
        "    @Override\n" +
        "    public void chargeBattery() {\n" +
        '        System.out.println(name + " is charging.");\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class AbstractInterfaceDemo {\n" +
        "    public static void main(String[] args) {\n" +
        '        Vehicle car = new Car("Swift");\n' +
        "        car.printInfo();\n" +
        "\n" +
        '        ElectricCar ec = new ElectricCar("Nexon EV");\n' +
        "        ec.printInfo();\n" +
        "        ec.chargeBattery();\n" +
        "        ec.printChargeStatus();\n" +
        "\n" +
        '        System.out.println("ec instanceof Chargeable: " + (ec instanceof Chargeable));\n' +
        "    }\n" +
        "}\n",
      output:
        "Swift gives 18.5 km/l\n" +
        "Nexon EV gives 0.0 km/l\n" +
        "Nexon EV is charging.\n" +
        "Charging status: OK\n" +
        "ec instanceof Chargeable: true",
    },
    {
      kind: "p",
      text:
        "`Vehicle` is declared `abstract class`, and `fuelEfficiency()` is declared `abstract` with no body " +
        "and a semicolon instead. This has one immediate, enforced consequence: `new Vehicle(\"anything\")` " +
        "is a compile error — you may never instantiate an abstract class directly, only a concrete " +
        "(non-abstract) subclass that has supplied bodies for every abstract method. `printInfo()` isn't " +
        "abstract — it has a real body, calls `fuelEfficiency()`, and every subclass inherits it fully " +
        "working, for free. `Chargeable` is an `interface`: every method inside it is implicitly `public`, " +
        "and `chargeBattery()` has no body at all — any class that `implements Chargeable` *must* supply " +
        "one, exactly like an abstract method. `printChargeStatus()` is a `default` method — an interface " +
        "method that *does* have a body, which implementing classes inherit for free unless they choose to " +
        "override it; `ElectricCar` never touches it, and calling `ec.printChargeStatus()` runs the " +
        "interface's own default implementation.",
    },
    {
      kind: "table",
      head: ["", "Abstract class", "Interface"],
      rows: [
        ["Declared with", "abstract class", "interface"],
        ["Can hold real fields and constructors", "Yes", "No instance fields (constants only); no constructors"],
        ["Can mix finished and unfinished methods", "Yes", "Yes, via default methods (finished) and plain method declarations (unfinished)"],
        ["A class may have", "At most one superclass, abstract or not", "Any number of interfaces"],
        ["Use when", "Subtypes share real code and a common identity (\"is-a\")", "Unrelated classes need to promise the same capability (\"can-do\")"],
      ],
    },
    {
      kind: "viz",
      title: "Why ec.printInfo() prints \"0.0 km/l\" for the ElectricCar",
      caption: "printInfo() itself never changed — it's the abstract method it calls partway through that resolves to ElectricCar's own version.",
      viz: {
        type: "callstack",
        frames: [
          {
            stack: [{ label: "ec.printInfo() (inherited from Vehicle)", state: "active" }],
            note: "ec is an ElectricCar, constructed via super(name), inheriting printInfo() unchanged from Vehicle.",
          },
          {
            stack: [{ label: "ec.printInfo()" }, { label: "ElectricCar.fuelEfficiency()", state: "active" }],
            note:
              "ec.printInfo() calls fuelEfficiency() — because ec's actual class is ElectricCar, the " +
              "overridden version there runs (this is overriding, from the last chapter, working exactly " +
              "the same way for an abstract parent as for a concrete one).",
          },
          {
            stack: [{ label: "ec.printInfo()" }, { label: "ElectricCar.fuelEfficiency()", state: "returning" }],
            note: "ElectricCar's fuelEfficiency() returns 0.0.",
          },
          {
            stack: [{ label: "ec.printInfo()", state: "returning" }],
            note: "printInfo()'s println assembles: name (\"Nexon EV\") + \" gives \" + 0.0 + \" km/l\".",
          },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Trying `new Vehicle(\"x\")` directly — abstract classes can never be instantiated, only extended " +
          "by a class that fills in every abstract method.",
        "Forgetting to implement every abstract/interface method in a concrete subclass — the subclass " +
          "itself then has to be declared abstract too, or it's a compile error.",
        "Assuming an interface can hold instance state like a class can — it can only declare constants " +
          "(implicitly `public static final`) and method signatures, plus default/static methods with " +
          "bodies; it never has per-object fields of its own.",
        "Reaching for an abstract class when the real need is \"can several unrelated classes share one " +
          "capability?\" — that's what interfaces exist for, since a class can implement many of them but " +
          "extend only one class.",
      ],
    },
    {
      kind: "remember",
      items: [
        "abstract class: can mix real code and unfinished (abstract) methods; never instantiable directly.",
        "interface: a pure contract of method signatures, plus default methods with bodies; implicitly public.",
        "A class extends at most one class (abstract or not) but implements any number of interfaces.",
        "A concrete subclass must implement every abstract method and every non-default interface method.",
        "Reach for abstract classes for a shared \"is-a\" family with common code; interfaces for a \"can-do\" capability across unrelated classes.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"When would you use an abstract class versus an interface?\" is asked almost every OOP interview " +
          "— the is-a/shared-code versus can-do/unrelated-classes framing above is the expected shape of a " +
          "good answer.",
        "\"Can an interface have method bodies?\" — yes, since Java 8, via default (and static) methods; " +
          "know this precisely, as older material sometimes states interfaces can never have bodies.",
        "\"Why can't you instantiate an abstract class?\" — because it may have unimplemented methods with " +
          "no defined behaviour; allowing an instance would mean calling a method with nothing to run.",
      ],
    },
    {
      kind: "quiz",
      question: "What happens if you write `new Vehicle(\"Test\")` where Vehicle is declared abstract?",
      options: [
        "It compiles and creates a Vehicle with fuelEfficiency() returning 0",
        "Compile error — abstract classes cannot be instantiated directly",
        "It compiles but throws an exception at run time",
        "It works only if Vehicle has no constructor",
      ],
      answer: 1,
      why:
        "An abstract class may have unfinished (abstract) methods with no body, so Java disallows creating " +
        "an instance of it directly — only a concrete subclass that fills in every abstract method can be instantiated.",
    },
    {
      kind: "quiz",
      question: "A class needs to extend Vehicle and also promise Chargeable and, separately, Sellable behaviour. Is this possible?",
      options: [
        "No — a class can only extend or implement one type total",
        "Yes — extends one class, but implements any number of interfaces",
        "Only if Vehicle is also an interface",
        "Only in Java 17 and later",
      ],
      answer: 1,
      why:
        "Java allows single class inheritance (one extends) but multiple interface implementation (any " +
        "number of implements) — exactly the combination ElectricCar uses with Vehicle and Chargeable.",
    },
    {
      kind: "quiz",
      question: "What is a default method on an interface?",
      options: [
        "A method every implementing class must override, because interfaces cannot contain method bodies.",
        "A method with a body that implementing classes inherit unless they override it.",
        "The interface's constructor, which runs when a class that implements it is created.",
        "A method that works only on primitive types, because defaults cannot take object parameters.",
      ],
      answer: 1,
      why:
        "default methods (since Java 8) let an interface provide a working implementation. Implementing " +
        "classes get it for free — printChargeStatus() runs unmodified for ElectricCar — but may override " +
        "it if they need different behaviour.",
    },
  ],
};
