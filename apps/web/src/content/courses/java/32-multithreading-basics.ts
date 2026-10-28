import type { Chapter } from "@/content/courses/types";

export const chapterMultithreading: Chapter = {
  slug: "multithreading-basics",
  title: "Multithreading Basics",
  summary:
    "Every program so far has done exactly one thing at a time. Threads let a program run several pieces " +
    "of work concurrently — and the moment they touch shared data, a new category of bug appears that " +
    "normal single-threaded testing never catches.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Every program in this course has run one instruction at a time, start to finish, in exactly the " +
        "order written. That's a **thread** — a single sequence of execution — and every program you've " +
        "written so far has had exactly one, the one running `main`. A **thread** is Java's unit for running " +
        "more than one sequence of instructions concurrently, within the same program.",
    },
    { kind: "h", text: "Two cashiers, one till" },
    {
      kind: "analogy",
      title: "Two cashiers serving separate queues versus two cashiers sharing one cash drawer",
      text:
        "A shop with two cashiers and two separate queues, each cashier handling their own customers " +
        "independently, gets through customers roughly twice as fast — the two cashiers barely need to " +
        "interact. That's the easy, safe case for threads: independent work, no shared data. Now imagine " +
        "both cashiers sharing one single cash drawer, each reading the current total, adding a sale, and " +
        "writing the new total back — if both read the same starting total *at the same instant*, then both " +
        "write back their own updated total, one cashier's sale can silently vanish from the total, even " +
        "though both genuinely rang up a sale. That's a **race condition**: two threads reading and writing " +
        "shared state without coordination, producing a result that depends on unlucky timing rather than " +
        "the actual logic. `synchronized` is the fix — it's the rule \"only one cashier may touch the " +
        "drawer at a time; the other must wait their turn\" — and it's exactly what the `Counter` class below " +
        "enforces on its `count` field. Where the analogy stops: a race condition in code doesn't announce " +
        "itself with an obvious complaint the way a confused cashier might — it can pass every test that " +
        "happens to run the threads in a lucky order, and only fail unpredictably later, which is precisely " +
        "why it's one of the hardest classes of bug to catch.",
    },
    {
      kind: "code",
      caption:
        "Two threads printing (ordered deterministically with join, so output never varies by run), then two " +
        "threads safely sharing a synchronized counter.",
      code:
        "class Counter {\n" +
        "    private int count = 0;\n" +
        "\n" +
        "    synchronized void increment() {\n" +
        "        count++;\n" +
        "    }\n" +
        "\n" +
        "    int getCount() {\n" +
        "        return count;\n" +
        "    }\n" +
        "}\n" +
        "\n" +
        "public class ThreadsDemo {\n" +
        "    public static void main(String[] args) throws InterruptedException {\n" +
        "        Runnable printTask = () -> {\n" +
        "            String threadName = Thread.currentThread().getName();\n" +
        '            System.out.println(threadName + " starting");\n' +
        "        };\n" +
        "\n" +
        '        Thread t1 = new Thread(printTask, "Worker-1");\n' +
        '        Thread t2 = new Thread(printTask, "Worker-2");\n' +
        "\n" +
        "        t1.start();\n" +
        "        t1.join();\n" +
        "        t2.start();\n" +
        "        t2.join();\n" +
        '        System.out.println(\n' +
        '            "Both workers finished (run one after another, in order, thanks to join)");\n' +
        "\n" +
        "        Counter counter = new Counter();\n" +
        "        Runnable incrementTask = () -> {\n" +
        "            for (int i = 0; i < 1000; i++) {\n" +
        "                counter.increment();\n" +
        "            }\n" +
        "        };\n" +
        "\n" +
        "        Thread a = new Thread(incrementTask);\n" +
        "        Thread b = new Thread(incrementTask);\n" +
        "        a.start();\n" +
        "        b.start();\n" +
        "        a.join();\n" +
        "        b.join();\n" +
        "\n" +
        '        System.out.println(\n' +
        '            "Final count after two threads, each incrementing 1000 times: " + counter.getCount());\n' +
        "    }\n" +
        "}\n",
      output:
        "Worker-1 starting\n" +
        "Worker-2 starting\n" +
        "Both workers finished (run one after another, in order, thanks to join)\n" +
        "Final count after two threads, each incrementing 1000 times: 2000",
    },
    {
      kind: "p",
      text:
        "`new Thread(printTask, \"Worker-1\")` creates a thread that will run `printTask`'s code, but " +
        "nothing runs until `.start()` is called — calling `printTask.run()` directly, by contrast, would " +
        "just run it on the current thread, with no concurrency at all. `t1.join()` makes `main` *wait* " +
        "until `t1` finishes before continuing — without it, `t1` and `t2` could genuinely print in either " +
        "order, or even interleave, because there'd be no guarantee about which thread the JVM schedules " +
        "first; `join()` is exactly what makes this example's output deterministic and repeatable rather " +
        "than a matter of luck. `counter.increment()` is declared `synchronized` — only one thread may be " +
        "executing it on a given `Counter` object at any moment; the other must wait. Without " +
        "`synchronized`, two threads could both read `count` as, say, `500` at nearly the same instant, both " +
        "compute `501`, and both write `501` back — one increment lost, and the final total ending up below " +
        "`2000` unpredictably from run to run.",
    },
    { kind: "h", text: "Why count++ isn't actually one operation" },
    {
      kind: "p",
      text:
        "`count++` looks like a single step, but it's really three: read the current value, add one, write " +
        "the new value back. If two threads interleave those three steps — thread A reads, thread B reads " +
        "(before A has written back), both add one to the same starting value, both write — one thread's " +
        "increment is silently overwritten by the other's. `synchronized` forces the whole read-add-write " +
        "sequence to complete for one thread before another thread can start it, which is exactly why the " +
        "count above is reliably `2000` (1000 + 1000), not some unpredictable smaller number.",
    },
    {
      kind: "pitfall",
      items: [
        "Calling `thread.run()` instead of `thread.start()` — `run()` executes the code on the *current* " +
          "thread, with no new thread created at all; only `start()` actually launches concurrent execution.",
        "Assuming two threads print or execute in a predictable order without `join()` or some other " +
          "coordination — the JVM's thread scheduler makes no ordering promises by default.",
        "Incrementing shared mutable state (a plain, non-synchronized `int count`) from multiple threads and " +
          "trusting the result — this is a textbook race condition, and it can pass casual testing while " +
          "still being wrong.",
        "Over-synchronizing everything \"to be safe\" — `synchronized` has a real performance cost (threads " +
          "wait for each other) and, used carelessly on multiple locks, can cause a **deadlock**, where two " +
          "threads each wait forever for a lock the other is holding.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A Thread runs concurrently once .start() is called — never call .run() directly expecting concurrency.",
        "join() makes the calling thread wait for another to finish — the tool for deterministic ordering.",
        "A race condition: unsynchronized threads reading/writing shared state, producing timing-dependent, unreliable results.",
        "synchronized on a method or block lets only one thread execute it on that object at a time.",
        "count++ is three steps (read, add, write), not one — exactly why it needs protection under concurrent access.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is a race condition, and how do you prevent one?\" is asked constantly once concurrency " +
          "comes up — define it precisely (unsynchronized shared mutable state) and name synchronized as " +
          "the basic fix.",
        "\"What's the difference between start() and run() on a Thread?\" is a very common, sharp gotcha " +
          "question — start() launches a new thread; run() just executes the code on the current one.",
        "\"What is a deadlock?\" is a natural follow-up once synchronization comes up — two or more threads " +
          "each waiting on a lock the other holds, with neither able to proceed.",
      ],
    },
    {
      kind: "quiz",
      question: "What's the difference between calling thread.start() and thread.run() directly?",
      options: [
        "No difference: both create a new thread, and run() is simply the older name for start().",
        "start() launches the code on a new thread; run() just executes it on the current thread, with no concurrency.",
        "run() is the method that creates the new thread, and start() just runs the code on the current one.",
        "start() can be called only once per program, so a second thread must be launched with run() instead.",
      ],
      answer: 1,
      why:
        "start() is what actually creates and launches a new thread of execution. Calling run() directly " +
        "just invokes that method like any other, on whichever thread called it — no new thread involved at all.",
    },
    {
      kind: "quiz",
      question: "Two threads both run `count++` on the same unsynchronized int field, 1000 times each. What's the safest expectation for the final count?",
      options: [
        "Always exactly 2000, because each count++ is a single step that can never be interrupted.",
        "Possibly less than 2000, because count++ isn't atomic and some increments can be lost.",
        "Always exactly 1000, because the second thread's updates simply overwrite those of the first.",
        "It throws a ConcurrentModificationException, because two threads touch the same field at once.",
      ],
      answer: 1,
      why:
        "count++ is really read-add-write. Without synchronization, two threads can interleave those steps " +
        "and lose an increment, so the final total can unpredictably come out below 2000 — this is the " +
        "textbook race condition.",
    },
    {
      kind: "quiz",
      question: "What does calling t1.join() in the main thread do?",
      options: [
        "Starts t1 running, so that it begins work alongside the main thread.",
        "Makes main wait until t1 has finished before it continues.",
        "Merges t1's memory with main's, so both threads then share the same variables.",
        "Stops t1 immediately, so that main can carry on without waiting for it.",
      ],
      answer: 1,
      why:
        "join() blocks the calling thread (here, main) until the thread it's called on (t1) completes. " +
        "It's the standard way to guarantee ordering between threads instead of leaving it to the scheduler.",
    },
  ],
};
