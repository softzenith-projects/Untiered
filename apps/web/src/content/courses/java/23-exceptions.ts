import type { Chapter } from "@/content/courses/types";

export const chapterExceptions: Chapter = {
  slug: "exceptions",
  title: "Exceptions: try, catch, finally, and Your Own",
  summary:
    "What actually happens when something goes wrong at run time, how to catch it instead of crashing, and " +
    "checked versus unchecked exceptions — plus writing your own exception type.",
  minutes: 16,
  blocks: [
    {
      kind: "p",
      text:
        "`\"Priya\".substring(1, 3)` works fine; `\"Priya\".substring(1, 30)` doesn't — there's no character " +
        "at index 30. So far, a mistake like this has simply crashed your program, printing a wall of red " +
        "text and stopping dead. That wall of text is Java telling you, in a structured way, exactly what " +
        "went wrong — and you can catch it, react to it, and keep running.",
    },
    { kind: "h", text: "The fire alarm analogy" },
    {
      kind: "analogy",
      title: "A fire alarm and the evacuation plan, versus pretending nothing happened",
      text:
        "A building doesn't try to prevent every possible fire — it accepts that one might happen, and has " +
        "a plan: an alarm goes off (something has gone wrong), a designated response kicks in (put it out, " +
        "evacuate), and afterward, regardless of how the fire was handled, some final steps always happen " +
        "(the all-clear announcement). `try { risky code }` is the building operating normally; `throw` is " +
        "the alarm going off the instant something breaks; `catch (SpecificException e) { ... }` is the " +
        "planned response for *that particular kind* of emergency — a chemical spill and an electrical fire " +
        "get different response teams, and Java catch blocks work the same way, matching the *type* of the " +
        "thing thrown; `finally { ... }` is the all-clear announcement, guaranteed to run whether the " +
        "emergency was handled cleanly or not. Where the analogy stops: an uncaught exception in Java " +
        "doesn't just damage one part of the building — by default it stops the entire program right there, " +
        "which is exactly why catching the ones you can sensibly recover from matters.",
    },
    {
      kind: "code",
      caption:
        "A built-in exception (array bounds), a custom checked exception, and multi-catch, all handled — " +
        "the program never crashes.",
      code:
        "public class ExceptionsDemo {\n" +
        "    static void withdraw(double balance, double amount) throws InsufficientBalanceException {\n" +
        "        if (amount > balance) {\n" +
        "            throw new InsufficientBalanceException(\n" +
        '                "Cannot withdraw " + amount + " from balance " + balance);\n' +
        "        }\n" +
        '        System.out.println("Withdrawal of " + amount + " approved");\n' +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] marks = { 90, 85, 78 };\n" +
        "\n" +
        "        try {\n" +
        '            System.out.println("Marks[5] = " + marks[5]);\n' +
        "        } catch (ArrayIndexOutOfBoundsException e) {\n" +
        '            System.out.println("Caught: " + e.getMessage());\n' +
        "        } finally {\n" +
        '            System.out.println("Finished checking the array, regardless of outcome");\n' +
        "        }\n" +
        "\n" +
        "        try {\n" +
        "            withdraw(1000.0, 1500.0);\n" +
        "        } catch (InsufficientBalanceException e) {\n" +
        '            System.out.println("Caught custom exception: " + e.getMessage());\n' +
        "        }\n" +
        "\n" +
        "        try {\n" +
        "            String s = null;\n" +
        "            System.out.println(s.length());\n" +
        "        } catch (NullPointerException | ArithmeticException e) {\n" +
        '            System.out.println("Caught: " + e.getClass().getSimpleName());\n' +
        "        }\n" +
        "\n" +
        '        System.out.println("Program continues after all handled exceptions");\n' +
        "    }\n" +
        "}\n" +
        "\n" +
        "class InsufficientBalanceException extends Exception {\n" +
        "    InsufficientBalanceException(String message) {\n" +
        "        super(message);\n" +
        "    }\n" +
        "}\n",
      output:
        "Caught: Index 5 out of bounds for length 3\n" +
        "Finished checking the array, regardless of outcome\n" +
        "Caught custom exception: Cannot withdraw 1500.0 from balance 1000.0\n" +
        "Caught: NullPointerException\n" +
        "Program continues after all handled exceptions",
      tryIt: {
        language: "java",
        prompt:
          "Change the withdrawal to `withdraw(1000.0, 500.0)` and run. Then delete `throws " +
          "InsufficientBalanceException` from `withdraw` and read why the compiler insists on it.",
      },
    },
    {
      kind: "p",
      text:
        "`marks[5]` throws `ArrayIndexOutOfBoundsException` the instant Java evaluates it — the `println` " +
        "call never completes, control jumps straight to the matching `catch`, and `finally` runs " +
        "afterward *no matter what*, even though the `catch` block already handled the problem. " +
        "`InsufficientBalanceException` is a class you wrote yourself, extending `Exception` — `throw new " +
        "InsufficientBalanceException(\"...\")` creates and raises one exactly like a built-in exception, " +
        "and `withdraw` is declared `throws InsufficientBalanceException` to warn any caller it might do " +
        "this. The final block shows **multi-catch**: `catch (NullPointerException | ArithmeticException e)` " +
        "handles either type with one block, useful when the response is identical either way.",
    },
    { kind: "h", text: "Checked versus unchecked" },
    {
      kind: "p",
      text:
        "`InsufficientBalanceException extends Exception` makes it a **checked** exception: the compiler " +
        "*forces* any calling code to either catch it or declare `throws` itself — leave it unhandled and " +
        "`ExceptionsDemo` simply fails to compile. `ArrayIndexOutOfBoundsException` and " +
        "`NullPointerException` both extend `RuntimeException`, which makes them **unchecked**: the compiler " +
        "never forces you to catch them, because they usually represent programming bugs (a wrong index, a " +
        "missed null check) rather than expected, recoverable situations. The rule of thumb: make your own " +
        "exception checked (`extends Exception`) when a caller genuinely has a reasonable, expected way to " +
        "recover — insufficient balance, a file that doesn't exist; leave it unchecked (`extends " +
        "RuntimeException`) when it signals a bug the caller should fix in their code, not handle at run " +
        "time.",
    },
    {
      kind: "table",
      head: ["", "Checked", "Unchecked (RuntimeException)"],
      rows: [
        ["Compiler forces handling?", "Yes — catch or declare throws", "No"],
        ["Typical examples", "IOException, your own InsufficientBalanceException", "NullPointerException, ArithmeticException, ArrayIndexOutOfBoundsException"],
        ["Represents", "An expected, recoverable situation", "Usually a programming mistake"],
        ["Extends", "Exception (directly)", "RuntimeException (itself a subclass of Exception)"],
      ],
    },
    {
      kind: "steps",
      title: "Why 'Finished checking the array...' prints even though the try block threw",
      steps: [
        { label: "Throw", text: "marks[5] is evaluated — index 5 is out of bounds for a length-3 array. Java immediately throws ArrayIndexOutOfBoundsException; the rest of the try block is abandoned." },
        { label: "Catch", text: "The exception's type is matched against the catch clause — it matches, so that block runs and prints the caught message." },
        { label: "Finally", text: "Before control leaves the try/catch entirely, the finally block always runs — whether the try succeeded, an exception was caught, or even if the exception had gone uncaught." },
        { label: "Resume", text: "Only after finally completes does execution continue to the next statement after the whole try/catch/finally." },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Catching `Exception` (or worse, `Throwable`) generically everywhere \"to be safe\" — this hides " +
          "genuine bugs and makes debugging much harder; catch the specific type you can actually handle.",
        "Forgetting that a checked exception must be declared with `throws` on any method that doesn't " +
          "catch it — a compile error, not a run-time one, which is exactly the point of \"checked\".",
        "Assuming `finally` doesn't run if the `try` block returns early — it still runs, right before the " +
          "method actually returns.",
        "Writing an empty `catch` block that swallows the exception silently — the program looks fine and " +
          "fails invisibly somewhere else entirely; at minimum log or print what was caught.",
      ],
    },
    {
      kind: "remember",
      items: [
        "try/catch/finally: risky code, the response for a specific exception type, cleanup that always runs.",
        "throw raises an exception; throws on a method signature declares it might propagate one.",
        "Checked exceptions (extends Exception) are compiler-enforced; unchecked (extends RuntimeException) are not.",
        "A custom exception is just a class extending Exception or RuntimeException, usually with a String-message constructor.",
        "Never catch broadly and swallow silently — catch the specific type and do something with it.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What's the difference between checked and unchecked exceptions?\" is one of the most reliably " +
          "asked Java questions — the table above is the expected answer shape, with a concrete example of each.",
        "\"Does finally always run?\" — yes, with the one genuine exception being if the JVM itself exits " +
          "(System.exit()) or crashes inside the try block; otherwise, always, even across a return.",
        "\"When would you create a custom exception?\" — when a specific, expected failure in your domain " +
          "(insufficient balance, an invalid input format) deserves a more meaningful type and message than " +
          "a generic built-in one.",
      ],
    },
    {
      kind: "quiz",
      question: "A method that can throw a checked exception without catching it — what must it do?",
      options: [
        "Nothing extra is required, because the compiler tracks checked exceptions on its own.",
        "Declare throws ExceptionType in its signature, or the code fails to compile.",
        "Wrap the whole method body in try/catch, since a throws clause alone is never enough.",
        "Rename the method so that it starts with the word throws, which marks it as risky.",
      ],
      answer: 1,
      why:
        "Checked exceptions are compiler-enforced: any method that doesn't catch one must declare it with " +
        "throws, or the code simply won't compile — this is exactly what distinguishes checked from unchecked.",
    },
    {
      kind: "quiz",
      question: "Does the finally block run if the try block's exception is never caught by any matching catch?",
      options: [
        "No, finally runs only when the exception was caught by a catch block in the same method.",
        "Yes: finally runs before the exception propagates further, whether or not it was caught.",
        "Only when there's no catch block at all, because otherwise the catch handles everything.",
        "Only for checked exceptions, since unchecked ones skip the finally block entirely.",
      ],
      answer: 1,
      why:
        "finally is guaranteed to run on the way out of a try block in virtually all cases, including when " +
        "no catch clause matches and the exception is about to propagate up to the caller.",
    },
    {
      kind: "quiz",
      question: "Which pair correctly matches checked vs unchecked?",
      options: [
        "NullPointerException is checked; a custom InsufficientBalanceException extends Exception is unchecked",
        "NullPointerException is unchecked (extends RuntimeException); a custom exception extending Exception directly is checked",
        "Both are always unchecked",
        "Both are always checked",
      ],
      answer: 1,
      why:
        "NullPointerException extends RuntimeException, making it unchecked. A custom exception that " +
        "extends Exception directly (not RuntimeException) is checked, and the compiler will enforce " +
        "handling it.",
    },
  ],
};
