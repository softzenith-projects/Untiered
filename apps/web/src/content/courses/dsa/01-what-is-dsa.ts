import type { Chapter } from "@/content/courses/types";

export const chapterWhatIsDsa: Chapter = {
  slug: "what-is-dsa",
  title: "What DSA Is, and Why Interviews Test It",
  summary:
    "Data structures are how you organise information; algorithms are the step-by-step procedures that " +
    "work on it. Interviews test both because the wrong choice quietly stops working at scale.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "You can solve almost any small coding problem with a plain array and a couple of loops — it'll " +
        "give the right answer on the five test cases in front of you. So why do interviews spend so much " +
        "time on **Data Structures and Algorithms (DSA)** instead of just asking you to build something? " +
        "Because the plain-array solution that works instantly on five items can take literal minutes on " +
        "five million, while a differently *organised* solution finishes in a blink — same problem, same " +
        "correctness, wildly different cost. DSA is the study of that gap, and of closing it on purpose.",
    },
    { kind: "h", text: "The kitchen-drawer analogy" },
    {
      kind: "analogy",
      title: "A kitchen where nothing has a fixed place",
      text:
        "Imagine a kitchen where every utensil, spice, and vessel gets dropped into one giant drawer, in no " +
        "particular order. Finding the cumin means digging through the whole drawer, every single time — " +
        "it works, but it gets slower as the drawer fills up. Now imagine the same kitchen with labelled " +
        "spice racks, a knife block, and shelves grouped by use: finding the cumin means going straight to " +
        "the spice rack and reading the label. Nothing about *what's in the kitchen* changed — only how it " +
        "is **organised** — and that organisation is the entire difference between a ten-second search and " +
        "a two-minute one. A **data structure** is a deliberate choice of organisation (the spice rack, the " +
        "knife block, the drawer); an **algorithm** is the step-by-step procedure you follow using that " +
        "organisation (scan the drawer front to back; or go straight to the labelled shelf). Where the " +
        "analogy stops: a kitchen's organisation is chosen once and barely changes; a program often builds " +
        "and rebuilds its structures as data arrives, so *which* structure to use, and when, is itself part " +
        "of the skill.",
    },
    {
      kind: "concept",
      title: "Data structure vs. algorithm",
      text:
        "A ~~data structure~~ is a deliberate way of organising data (an array, a hash set, a tree). An " +
        "~~algorithm~~ is the step-by-step procedure that operates on that organisation to produce an " +
        "answer. The same algorithmic idea (\"have I seen this before?\") costs a different amount of work " +
        "depending entirely on which structure it runs against.",
    },
    { kind: "h", text: "Same answer, very different cost" },
    {
      kind: "p",
      text:
        "Take a concrete example: given a list of numbers, does it contain a duplicate? The \"drawer\" " +
        "approach checks every pair — for each number, look at every other number and see if it matches. " +
        "The \"labelled shelf\" approach keeps a running set of numbers already seen, and for each new " +
        "number just checks whether it's already in that set. Both give the exact same true/false answer. " +
        "They do not cost the same.",
    },
    {
      kind: "code",
      caption:
        "Two correct solutions to the same problem: checking every pair, versus remembering what's " +
        "already been seen in a HashSet.",
      code:
        "import java.util.HashSet;\n" +
        "import java.util.Set;\n" +
        "\n" +
        "public class DuplicateCheck {\n" +
        "    static boolean hasDuplicateSlow(int[] nums) {\n" +
        "        for (int i = 0; i < nums.length; i++) {\n" +
        "            for (int j = i + 1; j < nums.length; j++) {\n" +
        "                if (nums[i] == nums[j]) {\n" +
        "                    return true;\n" +
        "                }\n" +
        "            }\n" +
        "        }\n" +
        "        return false;\n" +
        "    }\n" +
        "\n" +
        "    static boolean hasDuplicateFast(int[] nums) {\n" +
        "        Set<Integer> seen = new HashSet<>();\n" +
        "        for (int n : nums) {\n" +
        "            if (!seen.add(n)) {\n" +
        "                return true;\n" +
        "            }\n" +
        "        }\n" +
        "        return false;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] a = {4, 7, 2, 9, 7, 1};\n" +
        "        int[] b = {4, 7, 2, 9, 1, 3};\n" +
        '        System.out.println("a slow: " + hasDuplicateSlow(a));\n' +
        '        System.out.println("a fast: " + hasDuplicateFast(a));\n' +
        '        System.out.println("b slow: " + hasDuplicateSlow(b));\n' +
        '        System.out.println("b fast: " + hasDuplicateFast(b));\n' +
        "    }\n" +
        "}\n",
      output: "a slow: true\na fast: true\nb slow: false\nb fast: false",
      python:
        "def has_duplicate_slow(nums):\n" +
        "    for i in range(len(nums)):\n" +
        "        for j in range(i + 1, len(nums)):\n" +
        "            if nums[i] == nums[j]:\n" +
        "                return True\n" +
        "    return False\n" +
        "\n" +
        "\n" +
        "def has_duplicate_fast(nums):\n" +
        "    seen = set()\n" +
        "    for n in nums:\n" +
        "        if n in seen:\n" +
        "            return True\n" +
        "        seen.add(n)\n" +
        "    return False\n" +
        "\n" +
        "\n" +
        "a = [4, 7, 2, 9, 7, 1]\n" +
        "b = [4, 7, 2, 9, 1, 3]\n" +
        'print(f"a slow: {has_duplicate_slow(a)}")\n' +
        'print(f"a fast: {has_duplicate_fast(a)}")\n' +
        'print(f"b slow: {has_duplicate_slow(b)}")\n' +
        'print(f"b fast: {has_duplicate_fast(b)}")\n',
      pythonOutput: "a slow: True\na fast: True\nb slow: False\nb fast: False",
    },
    {
      kind: "viz",
      title: "hasDuplicateFast on {4, 7, 2, 9, 7, 1} — a done cell is already in seen",
      caption:
        "Each cell is checked once, left to right; the moment a value is already marked done, that's the " +
        "duplicate, and the scan stops without ever looking at the remaining cells.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: 4, state: "active", pointers: ["i"] },
              { value: 7 },
              { value: 2 },
              { value: 9 },
              { value: 7 },
              { value: 1 },
            ],
            note: "seen = {}. i=0: check 4 — not in seen, add it. seen = {4}.",
          },
          {
            cells: [
              { value: 4, state: "done" },
              { value: 7, state: "active", pointers: ["i"] },
              { value: 2 },
              { value: 9 },
              { value: 7 },
              { value: 1 },
            ],
            note: "i=1: check 7 — not in seen, add it. seen = {4, 7}.",
          },
          {
            cells: [
              { value: 4, state: "done" },
              { value: 7, state: "done" },
              { value: 2, state: "active", pointers: ["i"] },
              { value: 9 },
              { value: 7 },
              { value: 1 },
            ],
            note: "i=2: check 2 — not in seen, add it. seen = {4, 7, 2}.",
          },
          {
            cells: [
              { value: 4, state: "done" },
              { value: 7, state: "done" },
              { value: 2, state: "done" },
              { value: 9, state: "active", pointers: ["i"] },
              { value: 7 },
              { value: 1 },
            ],
            note: "i=3: check 9 — not in seen, add it. seen = {4, 7, 2, 9}.",
          },
          {
            cells: [
              { value: 4, state: "done" },
              { value: 7, state: "compare" },
              { value: 2, state: "done" },
              { value: 9, state: "done" },
              { value: 7, state: "compare", pointers: ["i"] },
              { value: 1 },
            ],
            note:
              "i=4: check 7 — already in seen (the value at index 1) — return true immediately. Index 5 is " +
              "never examined. hasDuplicateSlow, on this same array, would have compared (4,7), (4,2), " +
              "(4,9)... up to 15 pairs before happening to reach this matching pair.",
          },
        ],
      },
    },
    {
      kind: "table",
      head: ["Approach", "Time", "Space", "Why"],
      rows: [
        [
          "hasDuplicateSlow",
          "O(n²)",
          "O(1)",
          "Compares every pair of the n numbers, roughly n²/2 comparisons; no extra memory used.",
        ],
        [
          "hasDuplicateFast",
          "O(n)",
          "O(n)",
          "One pass over the n numbers; the set can hold up to n numbers, trading memory for speed.",
        ],
      ],
    },
    {
      kind: "p",
      text:
        "The slow version compares every pair: for n numbers, that's roughly {{O(n²)}} comparisons — a cost " +
        "that's fine for 6 numbers and genuinely unusable for 6 million. The fast version does one pass, " +
        "checking each number against a set that answers \"have I seen this?\" almost instantly — a cost " +
        "that stays close to {{O(n)}} even as n grows huge. The rest of this course is about naming this " +
        "difference precisely (the next chapter), and building a mental library of structures and " +
        "techniques so you reach for the shelf, not the drawer, by habit.",
    },
    { kind: "h", text: "Why interviews specifically test this" },
    {
      kind: "p",
      text:
        "A company interviewing you for a backend, data, or product-engineering role is rarely trying to " +
        "find out whether you personally can implement a hash set — the language's standard library already " +
        "does that. They're testing something that *does* transfer directly to the job: given a problem, " +
        "can you recognise which shape it is, pick an organisation suited to it, and reason about the cost " +
        "of your choice before it becomes a production incident? A recommendation feed, a search " +
        "autocomplete box, and a payments ledger all fail in the same boring way when someone reaches for " +
        "the drawer where a shelf was needed — the feature works perfectly in the demo and falls over the " +
        "day real traffic arrives.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "The Java example above ran both approaches once. Here they are in Python, where you can change " +
        "the numbers and re-run instantly. Try removing the repeated 7 from `nums` and see both answers " +
        "flip together.",
      starter:
        "def has_duplicate_slow(nums):\n" +
        "    for i in range(len(nums)):\n" +
        "        for j in range(i + 1, len(nums)):\n" +
        "            if nums[i] == nums[j]:\n" +
        "                return True\n" +
        "    return False\n" +
        "\n" +
        "\n" +
        "def has_duplicate_fast(nums):\n" +
        "    seen = set()\n" +
        "    for n in nums:\n" +
        "        if n in seen:\n" +
        "            return True\n" +
        "        seen.add(n)\n" +
        "    return False\n" +
        "\n" +
        "\n" +
        "nums = [4, 7, 2, 9, 7, 1]\n" +
        'print("slow:", has_duplicate_slow(nums))\n' +
        'print("fast:", has_duplicate_fast(nums))\n',
      expectedOutput: "slow: True\nfast: True",
    },
    {
      kind: "pitfall",
      items: [
        "Treating DSA as trivia to memorise (\"HashMap is O(1)\") rather than a way of thinking — the " +
          "interview question is rarely the exact problem you rehearsed, but the underlying pattern usually " +
          "is.",
        "Assuming a solution that works on the small example in front of you will scale — always ask " +
          "\"what happens at 10x, or 1000x, the input size?\" before calling a solution done.",
        "Reaching for the most advanced structure you know instead of the simplest one that fits — a plain " +
          "array is the right answer more often than it gets credit for.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A data structure is how information is organised; an algorithm is the procedure that works on it.",
        "The same correct answer can cost wildly different amounts of work depending on the organisation " +
          "chosen — that cost is what DSA studies.",
        "Interviews test DSA as a proxy for judgement under scale, not as trivia to recite.",
        "\"Does this still work if the input were a million times bigger?\" is the single most useful " +
          "question to ask yourself while solving any problem.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Expect to be asked, at least once, to state out loud *why* your solution is efficient, not just " +
          "that it produces the right answer — interviewers listen for this reasoning as much as the code.",
        "\"Can you do better?\" after a correct brute-force answer is one of the most common follow-ups in " +
          "any interview — it's a prompt to reconsider the data structure, not to panic.",
      ],
    },
    {
      kind: "quiz",
      question: "In the kitchen analogy, what does a data structure correspond to?",
      options: [
        "The ingredients themselves, because data structures are the raw material the cook starts with",
        "The deliberate organisation of where things are kept (the spice rack, the drawer)",
        "The recipe being cooked, since a data structure is the list of steps to follow",
        "The person doing the cooking, because they decide what happens with the ingredients",
      ],
      answer: 1,
      why:
        "The data structure is the organisation — how the same underlying data (ingredients, numbers) is " +
        "arranged so that operations on it (finding an item) are cheap or expensive.",
    },
    {
      kind: "quiz",
      question: "Why does hasDuplicateFast typically do less work than hasDuplicateSlow on the same input?",
      options: [
        "It uses a different, faster programming language internally, so each comparison takes less time.",
        "It only checks half the array, because the other half is guaranteed to hold no duplicates.",
        "It checks each number against a running set once, instead of comparing every pair.",
        "It sorts the array first, and Java's sorting step is free, so only the scan is counted.",
      ],
      answer: 2,
      why:
        "hasDuplicateSlow compares every pair of elements (roughly n²/2 comparisons); hasDuplicateFast " +
        "makes one pass, checking each element against a set that answers membership quickly, doing roughly " +
        "n units of work instead.",
    },
    {
      kind: "quiz",
      question: "What is the main reason interviews test DSA, according to this chapter?",
      options: [
        "To check whether you've memorised the names of standard library methods and their exact signatures",
        "Because almost every job requires implementing a HashMap or a balanced tree from scratch each week",
        "As a proxy for recognising a problem's shape and reasoning about cost at scale, which transfers to real work",
        "It's mostly tradition, with no real connection to the work you would actually do on the job",
      ],
      answer: 2,
      why:
        "The chapter argues DSA questions stand in for a transferable skill — picking an organisation " +
        "suited to a problem and reasoning about its cost — rather than testing memorised trivia.",
    },
    {
      kind: "h",
      text: "Practice problems",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "For a list of numbers, describe (in words, no code) two different ways to find the single most " +
          "frequent value, and say which one avoids re-scanning the list for every candidate value.",
        "You're given a phone contact list and asked to check, as new contacts are added one at a time, " +
          "whether a name already exists. Compare re-scanning the whole list each time versus keeping a " +
          "structure built for fast lookup — which grows worse as the list gets longer?",
        "A librarian organises books either by the order they arrived, or by subject on labelled shelves. " +
          "For the task \"find every book on astronomy\", explain which organisation costs less work and " +
          "why, in your own words.",
        "Think of one real app you use daily (maps, messaging, shopping) and name one feature where you " +
          "suspect the wrong data structure would make it noticeably slow at large scale. You don't need to " +
          "know the real implementation — just reason about what would go wrong.",
      ],
    },
  ],
};
