import type { Chapter } from "@/content/courses/types";

export const chapterBitManipulation: Chapter = {
  slug: "bit-manipulation",
  title: "Bit Manipulation",
  summary:
    "Underneath every int is 32 binary switches — a handful of tricks with AND, OR, XOR, and shifts read " +
    "or flip exactly one switch at a time, often replacing a loop with a single expression.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Every `int` in Java is stored as 32 binary digits (**bits**), each either 0 or 1. Four operators let " +
        "you manipulate those bits directly: `&` (AND — 1 only where *both* inputs have 1), `|` (OR — 1 " +
        "where *either* input has 1), `^` (XOR — 1 where the inputs *differ*), and `<<` / `>>` (shift all " +
        "bits left or right by a number of positions, equivalent to multiplying or dividing by a power of " +
        "2). These aren't a separate topic from everything else in this course — they're a toolkit for " +
        "doing certain jobs (checking membership, toggling a flag, finding an unpaired value) in O(1) per " +
        "operation instead of a loop, and for representing a *set* of small values compactly as the bits of " +
        "a single integer.",
    },
    { kind: "h", text: "The row of light switches analogy" },
    {
      kind: "analogy",
      title: "A row of 32 light switches on one panel",
      text:
        "Picture an int as a control panel with 32 light switches in a row, each independently on or off. " +
        "`n & (1 << i)` asks 'is switch i currently on?' by holding up a mask that's lit *only* at position " +
        "i, and AND keeps a light on only where both the panel and the mask agree — so the result is nonzero " +
        "exactly when switch i was on. `n | (1 << i)` flips switch i on regardless of its current state — " +
        "OR-ing with a mask that's lit only at i can only ever turn that one switch on, never off. XOR is " +
        "the odd one out and the most useful: `n ^ (1 << i)` *toggles* switch i, on to off or off to on, and " +
        "XOR-ing a value with itself always cancels to zero — which is exactly the mechanism behind this " +
        "chapter's `singleNumber` trick below. Where the analogy stops: a real light switch takes a moment " +
        "to flip; every one of these bit operations, however many bits are involved, is a single CPU " +
        "instruction — this is part of why bit tricks are so fast.",
    },
    { kind: "h", text: "Reading, setting, and clearing one bit at a time" },
    {
      kind: "code",
      caption:
        "Checking, setting, and clearing a single bit; counting how many bits are set (Brian Kernighan's " +
        "trick); and finding the one number that appears an odd number of times in an array using XOR.",
      code:
        "public class BitOps {\n" +
        "    static boolean isBitSet(int n, int i) {\n" +
        "        return (n & (1 << i)) != 0;\n" +
        "    }\n" +
        "\n" +
        "    static int setBit(int n, int i) {\n" +
        "        return n | (1 << i);\n" +
        "    }\n" +
        "\n" +
        "    static int clearBit(int n, int i) {\n" +
        "        return n & ~(1 << i);\n" +
        "    }\n" +
        "\n" +
        "    static int countSetBits(int n) {\n" +
        "        int count = 0;\n" +
        "        while (n != 0) {\n" +
        "            n = n & (n - 1); // clears the lowest set bit\n" +
        "            count++;\n" +
        "        }\n" +
        "        return count;\n" +
        "    }\n" +
        "\n" +
        "    static int singleNumber(int[] nums) {\n" +
        "        int result = 0;\n" +
        "        for (int n : nums) {\n" +
        "            result ^= n;\n" +
        "        }\n" +
        "        return result;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int n = 0b1010; // 10 in decimal\n" +
        '        System.out.println("n = " + n + " (binary " + Integer.toBinaryString(n) + ")");\n' +
        '        System.out.println("isBitSet(n, 1): " + isBitSet(n, 1));\n' +
        '        System.out.println("isBitSet(n, 0): " + isBitSet(n, 0));\n' +
        '        System.out.println("setBit(n, 0) = " + setBit(n, 0) + " (binary " + ' +
        "Integer.toBinaryString(setBit(n, 0)) + \")\");\n" +
        '        System.out.println("clearBit(n, 1) = " + clearBit(n, 1) + " (binary " + ' +
        "Integer.toBinaryString(clearBit(n, 1)) + \")\");\n" +
        '        System.out.println("countSetBits(n) = " + countSetBits(n));\n' +
        '        System.out.println("countSetBits(255) = " + countSetBits(255));\n' +
        "\n" +
        "        int[] nums = {4, 1, 2, 1, 2};\n" +
        '        System.out.println("singleNumber: " + singleNumber(nums));\n' +
        "    }\n" +
        "}\n",
      output:
        "n = 10 (binary 1010)\nisBitSet(n, 1): true\nisBitSet(n, 0): false\n" +
        "setBit(n, 0) = 11 (binary 1011)\nclearBit(n, 1) = 8 (binary 1000)\ncountSetBits(n) = 2\n" +
        "countSetBits(255) = 8\nsingleNumber: 4",
      python:
        "def is_bit_set(n, i):\n" +
        "    return (n & (1 << i)) != 0\n" +
        "\n" +
        "\n" +
        "def set_bit(n, i):\n" +
        "    return n | (1 << i)\n" +
        "\n" +
        "\n" +
        "def clear_bit(n, i):\n" +
        "    return n & ~(1 << i)\n" +
        "\n" +
        "\n" +
        "def count_set_bits(n):\n" +
        "    count = 0\n" +
        "    while n != 0:\n" +
        "        n = n & (n - 1)  # clears the lowest set bit\n" +
        "        count += 1\n" +
        "    return count\n" +
        "\n" +
        "\n" +
        "def single_number(nums):\n" +
        "    result = 0\n" +
        "    for n in nums:\n" +
        "        result ^= n\n" +
        "    return result\n" +
        "\n" +
        "\n" +
        "n = 0b1010  # 10 in decimal\n" +
        'print(f"n = {n} (binary {n:b})")\n' +
        'print("isBitSet(n, 1):", is_bit_set(n, 1))\n' +
        'print("isBitSet(n, 0):", is_bit_set(n, 0))\n' +
        'print(f"setBit(n, 0) = {set_bit(n, 0)} (binary {set_bit(n, 0):b})")\n' +
        'print(f"clearBit(n, 1) = {clear_bit(n, 1)} (binary {clear_bit(n, 1):b})")\n' +
        'print("countSetBits(n) =", count_set_bits(n))\n' +
        'print("countSetBits(255) =", count_set_bits(255))\n' +
        "\n" +
        "nums = [4, 1, 2, 1, 2]\n" +
        'print("singleNumber:", single_number(nums))\n',
      pythonOutput:
        "n = 10 (binary 1010)\nisBitSet(n, 1): True\nisBitSet(n, 0): False\n" +
        "setBit(n, 0) = 11 (binary 1011)\nclearBit(n, 1) = 8 (binary 1000)\ncountSetBits(n) = 2\n" +
        "countSetBits(255) = 8\nsingleNumber: 4",
    },
    {
      kind: "viz",
      title: "countSetBits(10) — clearing the lowest set bit each round (10 is binary 1010)",
      caption: "Cells read bit3, bit2, bit1, bit0 left to right; the pointer marks the lowest '1' that n & (n-1) is about to clear.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: 1 }, { value: 0 }, { value: 1, state: "active", pointers: ["lowest 1"] }, { value: 0 }],
            note:
              "n = 1010 (binary). n - 1 = 1001. n & (n-1) = 1010 & 1001 = 1000. This cleared the lowest " +
              "set bit (the one at position 1) — notice 1000 has one fewer '1' than 1010. count = 1.",
          },
          {
            cells: [{ value: 1, state: "active", pointers: ["lowest 1"] }, { value: 0 }, { value: 0, state: "done" }, { value: 0 }],
            note:
              "n = 1000. n - 1 = 0111. n & (n-1) = 1000 & 0111 = 0000. This cleared the last remaining " +
              "set bit (position 3). count = 2.",
          },
          {
            cells: [{ value: 0, state: "done" }, { value: 0 }, { value: 0, state: "done" }, { value: 0 }],
            note: "n = 0000. Loop condition n != 0 is false — stop. Final count = 2, matching 1010 having exactly two '1' bits.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Why does `n & (n - 1)` always clear exactly the lowest set bit? Subtracting 1 from any binary number " +
        "flips every trailing 0 to a 1, and flips the first (lowest) 1 it hits to a 0 — 1010 minus 1 becomes " +
        "1001, for instance: the trailing 0 became a 1, and the 1 before it became a 0. ANDing the original " +
        "number with that result keeps only the bits that were 1 in *both* — every trailing 0 in the " +
        "original stays 0 (AND with anything and a 0 stays 0), and the lowest 1 bit, now flipped to 0 in " +
        "`n-1`, gets cleared. Every bit above the lowest set bit is untouched by the subtraction, so it " +
        "survives the AND unchanged. Repeating this exactly `(number of set bits)` times reaches zero — " +
        "which is why `countSetBits` runs proportional to the *number of set bits*, not the full 32, making " +
        "it faster than checking all 32 positions individually for a sparse number.",
    },
    { kind: "h", text: "XOR's cancelling property: finding the unpaired value" },
    {
      kind: "p",
      text:
        "`singleNumber` solves: given an array where every value appears exactly twice except one, find the " +
        "one that appears once — in O(n) time and O(1) extra space, with no HashMap needed. It works because " +
        "XOR is commutative and associative (order doesn't matter), and `x ^ x = 0` for any x, while " +
        "`x ^ 0 = x`. XOR-ing the *entire* array together, every value that appears twice cancels itself out " +
        "to 0 (in whatever order the cancellation happens), leaving only the unpaired value XOR-ed with 0 — " +
        "which is just itself.",
    },
    {
      kind: "table",
      head: ["Technique", "Time", "Space", "Why"],
      rows: [
        [
          "isBitSet / setBit / clearBit",
          "O(1)",
          "O(1)",
          "Each is a single shift plus a single AND/OR operation — one CPU instruction sequence regardless " +
            "of which bit position.",
        ],
        [
          "countSetBits (Brian Kernighan's trick)",
          "O(number of set bits)",
          "O(1)",
          "Each iteration clears exactly one set bit, so the loop runs once per '1' present, not once per " +
            "all 32 bit positions.",
        ],
        [
          "singleNumber via XOR",
          "O(n)",
          "O(1)",
          "One pass, XOR-ing every value together; paired values cancel to 0 regardless of order, leaving " +
            "only the unpaired value — no hash set needed to track seen values.",
        ],
        [
          "Naive singleNumber (HashMap of counts)",
          "O(n)",
          "O(n)",
          "Same time, but needs extra space proportional to the number of distinct values, to count " +
            "occurrences explicitly.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting operator precedence — `n & 1 << i` without parentheses can silently do the wrong thing " +
          "in some contexts if you're not certain of Java's precedence rules; writing `n & (1 << i)` " +
          "explicitly avoids the ambiguity entirely.",
        "Using `clearBit` without the `~` (bitwise NOT) — `n & (1 << i)` would only *keep* bit i (and clear " +
          "everything else), which is the opposite of clearing just that one bit; the mask needs inverting " +
          "first.",
        "Assuming `>>` sign-extends the same way for all types, or confusing it with `>>>` — Java's `>>` is " +
          "an arithmetic shift (preserves the sign bit, useful for negative numbers), while `>>>` is a " +
          "logical shift (always fills with 0s); picking the wrong one changes the result for negative " +
          "inputs.",
        "Reaching for bit tricks where a plain, readable loop or HashSet would do — bit manipulation trades " +
          "readability for speed and compactness; it earns its place in genuinely bit-shaped problems (flags, " +
          "small fixed sets, XOR-cancellation), not as a default style.",
      ],
    },
    {
      kind: "remember",
      items: [
        "AND (&) reads/keeps bits; OR (|) sets bits on; XOR (^) toggles bits and, critically, x^x=0 while " +
          "x^0=x.",
        "isBitSet/setBit/clearBit are each built from a shifted mask (`1 << i`) combined with AND/OR/AND-NOT.",
        "n & (n-1) clears the lowest set bit — repeating it counts set bits in O(number of set bits).",
        "XOR-ing an entire array cancels every value that appears an even number of times, leaving only an " +
          "odd-count value exposed — the classic 'find the single number' trick.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Count the number of set bits\" (Hamming weight) and \"find the single number in an array where " +
          "everything else is paired\" are both extremely common warm-up questions specifically testing " +
          "these two tricks.",
        "\"Check if a number is a power of two\" is a compact bit trick worth knowing: n is a power of two " +
          "if and only if `n > 0 && (n & (n - 1)) == 0` — clearing the lowest set bit leaves zero only when " +
          "there was exactly one bit to begin with.",
        "Using an int (or a BitSet, for more than 32 flags) as a compact set of small values — checking " +
          "membership, adding, and removing all in O(1) — comes up in problems involving small, bounded " +
          "state spaces, like tracking which of a handful of rooms have been visited.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does n & (n - 1) always clear exactly the lowest set bit of n?",
      options: [
        "It's a coincidence that holds only for even numbers, where the trailing zeros give the subtraction something to borrow from.",
        "Subtracting 1 flips the trailing 0s and the lowest 1; ANDing with n then clears that lowest 1.",
        "It always clears the highest set bit instead, because subtracting 1 borrows from the leftmost 1 in the binary number first.",
        "It only works when n is a power of two, which is the one case where n - 1 has every lower bit set to 1.",
      ],
      answer: 1,
      why:
        "The subtraction's effect is localized to the trailing zeros and the first 1 bit; everything above " +
        "that point is unaffected, which is exactly why ANDing removes only the lowest set bit.",
    },
    {
      kind: "quiz",
      question: "Why does XOR-ing every element of an array together find the value that appears an odd number of times, when every other value appears an even number of times?",
      options: [
        "XOR happens to sort the array first, so the single unpaired value ends up alone at one end of it.",
        "x ^ x = 0 and XOR is commutative, so equal pairs cancel in any order, leaving the odd-count value.",
        "It only works if the array is sorted beforehand, because the equal values must sit next to each other to cancel.",
        "It actually finds the maximum value in the array, not the unpaired one, because XOR keeps the larger bits.",
      ],
      answer: 1,
      why:
        "Because order doesn't matter for XOR, every even-count value's occurrences pair off and cancel to " +
        "zero regardless of array order, and 0 XOR-ed with the remaining unpaired value just returns that " +
        "value.",
    },
    {
      kind: "quiz",
      question: "What does the expression n & (1 << i) compute?",
      options: [
        "Sets bit i of n to 1",
        "Clears bit i of n",
        "Checks whether bit i of n is currently set (result is nonzero if and only if bit i was 1)",
        "Toggles bit i of n",
      ],
      answer: 2,
      why:
        "`1 << i` creates a mask with only bit i set; ANDing it with n keeps only that position's value — " +
        "nonzero exactly when bit i was already 1, and 0 otherwise, which is a read, not a modification.",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Describe, in your own words, how you'd check whether a given integer is a power of two, using the " +
          "n & (n-1) trick from this chapter, and explain why it works.",
        "Given an array where every element appears exactly three times except one that appears once, " +
          "explain why the simple XOR trick from this chapter no longer works directly, and describe (in " +
          "words) what would need to change.",
        "Describe how you would use bits of an integer to represent a small set of flags (for example, which " +
          "of 5 features a user has enabled), and how you'd check, add, and remove a flag.",
        "Explain, in your own words, the difference between Java's `>>` and `>>>` operators, and describe a " +
          "situation where using the wrong one would produce an incorrect result.",
      ],
    },
  ],
};
