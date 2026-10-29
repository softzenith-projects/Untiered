import type { Chapter } from "@/content/courses/types";

export const chapterWhatIsJava: Chapter = {
  slug: "what-is-java-and-how-it-runs",
  title: "What Java Is, and How It Runs",
  summary:
    "JDK, JRE and JVM, what bytecode is, and why the same .class file runs unchanged on Windows, " +
    "Linux and an Android phone.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "Every WhatsApp forward, every banking app, every Android phone in your pocket is running Java " +
        "somewhere underneath. So is most of the backend of the site you're reading this on. Before you " +
        "write a single line of it, it's worth thirty minutes to understand *why* a language written in " +
        "1995 still runs a large share of the world's serious software — because the answer is also the " +
        "answer to the first interview question anyone will ever ask you about Java.",
    },
    { kind: "h", text: "The tiffin box analogy" },
    {
      kind: "analogy",
      title: "A tiffin box that opens on any table",
      text:
        "Picture your mother packing your lunch into a steel tiffin box before you leave for school. She " +
        "doesn't know whether you'll eat it at your desk, on the school bus, or on a bench under a tree — " +
        "but it doesn't matter, because the tiffin box has a standard shape. Any surface that can hold a " +
        "box can hold *that* box. Java code works the same way. When you compile a Java program, you don't " +
        "get a Windows program or a Linux program — you get a `.class` file, a standard 'box' called " +
        "**bytecode**. Any machine that has a **JVM** (Java Virtual Machine) installed — Windows, Linux, " +
        "macOS, an Android phone — can 'open the box' and run what's inside, without you recompiling " +
        "anything. That's the famous line: **Write Once, Run Anywhere (WORA)**. Where the analogy stops " +
        "working: a tiffin box is opened the same way everywhere, but a JVM actually does some work to " +
        "translate bytecode into instructions the specific machine's processor understands, every single " +
        "time it runs. The box doesn't just get opened — it gets re-read and re-interpreted (and, for code " +
        "that runs a lot, further compiled on the spot for speed) by the machine you're standing on.",
    },
    { kind: "h", text: "Three letters that get asked about constantly: JDK, JRE, JVM" },
    {
      kind: "p",
      text:
        "These three abbreviations look interchangeable to a beginner and are almost never used correctly " +
        "by one. They form a chain, from smallest to biggest:",
    },
    {
      kind: "table",
      head: ["Term", "Full form", "What it actually is", "Who needs it"],
      rows: [
        [
          "JVM",
          "Java Virtual Machine",
          "The program that reads bytecode and executes it on your specific machine.",
          "Everyone, at run time.",
        ],
        [
          "JRE",
          "Java Runtime Environment",
          "A JVM plus the standard library classes (String, ArrayList, and thousands more) that " +
            "compiled programs expect to find.",
          "Anyone who wants to *run* a Java program, but not write one.",
        ],
        [
          "JDK",
          "Java Development Kit",
          "A JRE plus the tools to *write and compile* Java: `javac` (the compiler), `java` (the " +
            "launcher), a debugger, and more.",
          "Anyone writing Java code — that's you, from this chapter on.",
        ],
      ],
    },
    {
      kind: "p",
      text:
        "One line to fix in memory: **JDK contains JRE, and JRE contains JVM.** It's a set of nesting dolls, " +
        "not three unrelated tools. You install the JDK to develop; the JVM inside it is what actually " +
        "runs your program when you type `java`.",
    },
    { kind: "h", text: "From source code to a running program" },
    {
      kind: "p",
      text:
        "Java separates writing the program from running it. `javac Hello.java` compiles the source " +
        "you wrote into `Hello.class` — portable bytecode, not instructions for one processor. " +
        "Then `java Hello` hands that file to the JVM on the current machine.",
    },
    {
      kind: "p",
      text:
        "That is why a `.class` file can move from Windows to Linux unchanged: each machine has " +
        "its own JVM to run the same bytecode. Python typically runs from source without this separate " +
        "bytecode file; C compiles to processor-specific machine code. Java sits between those paths.",
    },
    {
      kind: "steps",
      title: "Source code to a running program",
      steps: [
        { label: "Source", text: "`Hello.java` — plain text you wrote, in Java syntax." },
        { label: "Compile", text: "`javac` checks it for errors and produces `Hello.class`." },
        { label: "Bytecode", text: "`Hello.class` — instructions for a JVM, not for any one processor." },
        { label: "JVM", text: "`java Hello` loads the bytecode, verifies it, and runs it on this machine." },
      ],
    },
    {
      kind: "steps",
      title: "What happens when you run `java Hello`",
      steps: [
        {
          label: "Compile",
          text:
            "`javac Hello.java` checks your code for errors and, finding none, writes `Hello.class` next " +
            "to it — bytecode, not English and not machine code for any particular processor.",
        },
        { label: "Start", text: "You type `java Hello`. The JVM starts up on your machine." },
        {
          label: "Load & verify",
          text:
            "The JVM locates `Hello.class`, loads it into memory, and verifies the bytecode is well-formed " +
            "— malformed or tampered bytecode is rejected before it runs.",
        },
        {
          label: "Execute",
          text:
            "The JVM finds `public static void main(String[] args)` — every runnable program's starting " +
            "point — and executes the instructions inside it, translating each into something your " +
            "specific processor can do.",
        },
        { label: "Exit", text: "The program prints its output and finishes; the JVM exits." },
      ],
    },
    {
      kind: "code",
      caption:
        "A complete program — the same one traced above. Compiled with `javac Hello.java`, run with `java " +
        "Hello`.",
      code:
        "public class Hello {\n" +
        "    public static void main(String[] args) {\n" +
        '        System.out.println("Namaste, Java!");\n' +
        '        System.out.println("This program was compiled once and can now run anywhere a JVM exists.");\n' +
        "    }\n" +
        "}\n",
      output:
        "Namaste, Java!\n" +
        "This program was compiled once and can now run anywhere a JVM exists.",
      tryIt: {
        language: "java",
        prompt:
          "Change the text in the first `println` to your own greeting and press Run. Then delete one " +
          "semicolon and run again: that red message is a compile error, caught before the program ever " +
          "starts.",
      },
    },
    { kind: "h", text: "Compiled, but not compiled all the way" },
    {
      kind: "p",
      text:
        "It helps to place Java precisely between two more familiar extremes. **Interpreted languages** " +
        "(Python, JavaScript in a browser) read your source text directly, every run, and never produce a " +
        "separate file you could hand someone without the source. **Fully compiled languages** (C, C++, Go) " +
        "translate your code, once, into instructions for one specific processor and operating system — " +
        "fast, but a program built for Windows will not run on a Mac without rebuilding. Java's bytecode " +
        "sits in the middle: it *is* a compiled artifact — smaller, faster to start, and already checked " +
        "for syntax errors — but the thing it's compiled to is a made-up instruction set for an imaginary " +
        "processor (the JVM), not a real one. That imaginary processor is implemented in software for every " +
        "real machine, which is what makes the same `.class` file portable.",
    },
    {
      kind: "pitfall",
      items: [
        "Saying \"Java is an interpreted language.\" It compiles to bytecode first; only that bytecode is " +
          "then interpreted (and further optimised) by the JVM. It's neither purely compiled nor purely " +
          "interpreted — it's both, in sequence.",
        "Thinking you can run a `.java` file directly. You compile it to a `.class` file with `javac` " +
          "first; `java` runs the compiled class, not the source text. (Recent Java versions do let you " +
          "run a single-file program with `java Hello.java` directly for quick scripts — but it still " +
          "compiles to bytecode in memory first; nothing about the two-step model has actually changed.)",
        "Confusing JRE and JDK when asked which one to install. If you intend to write code, you need the " +
          "JDK — the JRE alone has no compiler.",
      ],
    },
    {
      kind: "remember",
      items: [
        "JDK ⊃ JRE ⊃ JVM — development kit contains the runtime, which contains the virtual machine.",
        "`javac` compiles source (`.java`) to bytecode (`.class`); `java` runs the bytecode.",
        "Bytecode is not machine code for any real processor — it's instructions for the imaginary " +
          "'Java machine,' which is why it's portable.",
        "WORA: compile once, run on any machine with a matching JVM — Windows, Linux, macOS, Android.",
        "Every runnable Java program needs a `public static void main(String[] args)` — the JVM's " +
          "entry point.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Explain JVM, JRE and JDK\" is one of the most commonly asked Java basics questions — answer " +
          "with the nesting-doll relationship, not just the full forms.",
        "\"Is Java compiled or interpreted?\" tests whether you understand the two-step model — say both, " +
          "in sequence, and name bytecode as the artifact in between.",
        "\"What does WORA mean and how is it achieved?\" — the JVM is the answer; bytecode is portable, " +
          "the JVM implementation is what's platform-specific.",
      ],
    },
    {
      kind: "quiz",
      question: "A `.class` file compiled on a Windows laptop is copied to a Linux server. What happens?",
      options: [
        "It fails to run — Java programs must be recompiled for each operating system.",
        "It runs unchanged, as long as the Linux machine has a JVM installed.",
        "It runs, but only after being converted back to source code.",
        "It runs only if both machines use the same processor brand.",
      ],
      answer: 1,
      why:
        "The `.class` file holds bytecode, not instructions for a specific OS or processor. Any machine " +
        "with a JVM can load and run it — that's the entire point of compiling to bytecode instead of " +
        "compiling straight to native machine code the way C does.",
    },
    {
      kind: "quiz",
      question: "Which statement about JDK, JRE and JVM is correct?",
      options: [
        "The JVM contains the JRE, which contains the JDK.",
        "JDK, JRE and JVM are three independent, unrelated tools you install separately.",
        "The JDK contains the JRE, which contains the JVM.",
        "The JRE is only needed for writing code, not running it.",
      ],
      answer: 2,
      why:
        "It nests from largest to smallest: JDK (develop) ⊃ JRE (run + standard library) ⊃ JVM (execute " +
        "bytecode). Installing the JDK gives you all three.",
    },
    {
      kind: "quiz",
      question: "Why is Java described as neither purely compiled nor purely interpreted?",
      options: [
        "Because Java has no compiler at all: the JVM reads the source text and interprets it directly.",
        "Because javac compiles source to bytecode, and the JVM then interprets (and further optimises) that bytecode at run time.",
        "Because different companies build Java differently, so whether it is compiled or interpreted depends on the vendor.",
        "Because Java code runs straight on the processor with no intermediate step, like a C program.",
      ],
      answer: 1,
      why:
        "Compilation happens once, ahead of time, producing bytecode. Interpretation (plus further " +
        "just-in-time compilation for speed) happens every time that bytecode runs, inside the JVM. It's " +
        "a two-stage pipeline, which is exactly what makes it portable *and* reasonably fast.",
    },
  ],
};
