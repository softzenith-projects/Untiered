import type { Chapter } from "@/content/courses/types";

export const chapterEncapsulation: Chapter = {
  slug: "encapsulation-access-modifiers",
  title: "Encapsulation and Access Modifiers",
  summary:
    "Hiding a class's data behind methods that guard it, instead of leaving fields wide open — and the " +
    "public/private/protected keywords Java gives you to enforce exactly who can touch what.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Every `Student` object so far has let outside code do `s1.marks = -40;` — a negative mark, or " +
        "`s1.name = null;`, with nothing stopping it. For a school register that's a minor annoyance; for a " +
        "bank account, letting any code directly set `balance = 999999;` is a disaster. Encapsulation is the " +
        "fix: stop letting outside code touch a field directly, and force it through methods that can check " +
        "the request first.",
    },
    { kind: "h", text: "The bank counter analogy" },
    {
      kind: "analogy",
      title: "The cash vault versus the teller counter",
      text:
        "You never walk behind the counter and take cash out of a bank's vault yourself — you interact only " +
        "through a teller, who checks your ID, verifies you have sufficient balance, and only then updates " +
        "the vault. The vault (the actual money — the data) is hidden; the teller (a set of specific, " +
        "controlled actions — the methods) is the only path to it, and the teller enforces the bank's rules " +
        "every single time, no exceptions. **Encapsulation** is exactly this: mark a field `private` so " +
        "outside code can't reach it directly, and expose only the methods (`deposit`, `withdraw`, " +
        "`getBalance`) that are allowed to touch it — each one free to check the request before acting. " +
        "Where the analogy stops: a class can choose to leave a teller window fully open by making a method " +
        "`public` with no checks at all — encapsulation doesn't force validation, it only makes validation " +
        "*possible* and centralises it in one place instead of leaving every caller to remember the rule " +
        "themselves.",
    },
    {
      kind: "code",
      caption: "A BankAccount with a private balance, reachable only through validated methods.",
      code:
        "public class EncapsulationDemo {\n" +
        "    public static void main(String[] args) {\n" +
        '        BankAccount acc = new BankAccount("Priya", 1000.0);\n' +
        "\n" +
        "        acc.deposit(500.0);\n" +
        '        System.out.println("Balance after deposit: " + acc.getBalance());\n' +
        "\n" +
        "        acc.withdraw(2000.0);\n" +
        '        System.out.println("Balance after rejected withdrawal: " + acc.getBalance());\n' +
        "\n" +
        "        acc.deposit(-50.0);\n" +
        '        System.out.println("Balance after rejected deposit: " + acc.getBalance());\n' +
        "\n" +
        "        acc.withdraw(300.0);\n" +
        '        System.out.println("Balance after valid withdrawal: " + acc.getBalance());\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class BankAccount {\n" +
        "    private String owner;\n" +
        "    private double balance;\n" +
        "\n" +
        "    BankAccount(String owner, double balance) {\n" +
        "        this.owner = owner;\n" +
        "        this.balance = balance;\n" +
        "    }\n" +
        "\n" +
        "    public double getBalance() {\n" +
        "        return balance;\n" +
        "    }\n" +
        "\n" +
        "    public void deposit(double amount) {\n" +
        "        if (amount <= 0) {\n" +
        '            System.out.println("Deposit rejected: amount must be positive");\n' +
        "            return;\n" +
        "        }\n" +
        "        balance += amount;\n" +
        "    }\n" +
        "\n" +
        "    public void withdraw(double amount) {\n" +
        "        if (amount > balance) {\n" +
        '            System.out.println("Withdrawal rejected: insufficient balance");\n' +
        "            return;\n" +
        "        }\n" +
        "        balance -= amount;\n" +
        "    }\n" +
        "}\n",
      output:
        "Balance after deposit: 1500.0\n" +
        "Withdrawal rejected: insufficient balance\n" +
        "Balance after rejected withdrawal: 1500.0\n" +
        "Deposit rejected: amount must be positive\n" +
        "Balance after rejected deposit: 1500.0\n" +
        "Balance after valid withdrawal: 1200.0",
      tryIt: {
        language: "java",
        prompt:
          "Add `acc.balance = 1000000;` to `main` and run. The compiler stops you, because `balance` is " +
          "private. The only way to change it is through `deposit` and `withdraw`, which check the " +
          "amount.",
      },
    },
    {
      kind: "p",
      text:
        "`balance` is `private` — code in `EncapsulationDemo` (a different class) cannot write `acc.balance " +
        "= 999999;` at all; that line simply fails to compile. The only way in or out is `deposit`, " +
        "`withdraw`, and `getBalance` — each `public`, and each one enforces a rule before touching the " +
        "field. Every attempt to break the rules (`withdraw(2000.0)` with insufficient funds, `deposit" +
        "(-50.0)`) is caught and rejected inside the class itself, so `balance` can never end up in an " +
        "invalid state no matter what any calling code tries.",
    },
    { kind: "h", text: "The four access levels" },
    {
      kind: "table",
      head: ["Modifier", "Visible from", "Typical use"],
      rows: [
        ["private", "Only inside the same class", "Fields, and helper methods no one else should call"],
        ["(none) — package-private", "Same class or same package, nowhere else", "Rarely used deliberately; the default if you omit a modifier"],
        ["protected", "Same package, plus subclasses in any package", "Members a subclass needs (see the inheritance chapter)"],
        ["public", "Anywhere the class itself is visible", "The intended external interface — getters, setters, public actions"],
      ],
    },
    {
      kind: "p",
      text:
        "A common and useful convention: make fields `private`, and expose a **getter** (`getBalance()`, " +
        "returning the value) and, only if outside code genuinely needs to change it, a **setter** " +
        "(`setOwner(String newOwner)`), which can validate before assigning. Not every field needs a setter " +
        "— `BankAccount` above deliberately has no `setBalance`, because the only valid ways to change a " +
        "balance are a deposit or a withdrawal, never a direct overwrite.",
    },
    {
      kind: "viz",
      title: "Why the rejected withdraw(2000.0) leaves balance completely unchanged",
      caption: "The guard rejects the withdrawal before the line that would have changed balance ever runs.",
      viz: {
        type: "array",
        frames: [
          { cells: [{ value: 1500.0, pointers: ["balance"] }], note: "withdraw(2000.0) is called; balance is currently 1500.0." },
          { cells: [{ value: 1500.0, state: "compare", pointers: ["balance"] }], note: "The condition amount > balance checks 2000.0 > 1500.0, which is true." },
          { cells: [{ value: 1500.0, pointers: ["balance"] }], note: "The rejection message prints, and return; exits the method immediately." },
          { cells: [{ value: 1500.0, pointers: ["balance"] }], note: "The line balance -= amount; is never reached — it sits after the return." },
          { cells: [{ value: 1500.0, state: "done", pointers: ["balance"] }], note: "balance is exactly what it was before the call: 1500.0, confirmed by the next println." },
        ],
      },
    },
    {
      kind: "pitfall",
      items: [
        "Making every field `public` \"to keep it simple\" — this removes every chance to validate, and " +
          "any code anywhere can put the object into an invalid state.",
        "Writing a getter and setter for every field automatically without thinking — a setter that lets " +
          "outside code set anything to anything defeats the entire point of encapsulation. Only add one if " +
          "there's a legitimate reason to change that field from outside, and validate inside it.",
        "Forgetting that omitting a modifier entirely doesn't mean \"private\" — it means package-private, " +
          "which is still visible to every other class in the same package.",
        "Assuming `private` fields are invisible to *other objects of the same class* — they aren't; any " +
          "method inside `BankAccount` can read or write `private` fields of any `BankAccount` object, not " +
          "just `this` one.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Encapsulation: hide fields as private, expose only the methods meant to touch them.",
        "Four access levels, narrowest to widest: private, package-private (default), protected, public.",
        "A getter reads a private field; a setter writes one, ideally with validation.",
        "Not every field needs a setter — only add one where outside code has a legitimate reason to change it.",
        "private means \"same class,\" not \"same object\" — sibling objects of the same class can still see each other's private fields.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is encapsulation and why does it matter?\" is a standard OOP-fundamentals question — lead " +
          "with hiding data and controlling access through validated methods, with a concrete example like " +
          "the bank account.",
        "\"What's the difference between the four access modifiers?\" — know the table above cold, " +
          "especially that omitting a modifier is package-private, not private.",
        "You may be asked to spot a design flaw in a class with all-public fields and no validation — the " +
          "expected fix is exactly what this chapter did to BankAccount.",
      ],
    },
    {
      kind: "quiz",
      question: "What happens if code outside the BankAccount class writes `acc.balance = 5000;` where balance is private?",
      options: [
        "It works, and silently overwrites balance, because Java only warns about private access.",
        "It compiles but throws an exception at run time, when the private field is accessed.",
        "It fails to compile: private fields aren't visible outside the class.",
        "It works only if acc was itself declared public, which makes every field of it open.",
      ],
      answer: 2,
      why:
        "private restricts visibility to code inside the same class. Any attempt to access the field " +
        "directly from another class is a compile-time error, not a run-time one.",
    },
    {
      kind: "quiz",
      question: "Which access modifier is applied when you write a field with no modifier keyword at all?",
      options: ["public", "private", "protected", "package-private (default)"],
      answer: 3,
      why:
        "Omitting a modifier doesn't mean private — it gives package-private access: visible to any class " +
        "in the same package, but not outside it.",
    },
    {
      kind: "quiz",
      question: "Why does BankAccount provide deposit()/withdraw() methods instead of a plain setBalance(double) method?",
      options: [
        "setBalance would be slower than a method, because every setter call goes through extra JVM checks.",
        "Methods can validate the change, rejecting negative deposits and overdrafts; a plain setter lets any value in.",
        "Java doesn't allow setter methods on double fields, so a differently named method is required.",
        "There's no real difference, because a plain setter checks its argument automatically as well.",
      ],
      answer: 1,
      why:
        "The whole benefit of encapsulation is the chance to validate before a field changes. A generic " +
        "setBalance would let any caller set any value, including invalid ones, bypassing the bank's rules " +
        "entirely.",
    },
  ],
};
