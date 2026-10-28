import type { Chapter } from "@/content/courses/types";

export const chapterArraysInMemory: Chapter = {
  slug: "arrays-in-memory",
  title: "Arrays in Memory",
  summary:
    "Why array[i] is instant regardless of size, and why inserting into the middle isn't — a look at what " +
    "'contiguous memory' actually means and costs.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "You've used arrays since the Java course. This chapter answers a question worth actually " +
        "understanding, not just accepting: why is `array[500000]` just as fast to read as `array[0]`, no " +
        "matter how big the array is — while inserting one new value near the start of that same array is " +
        "comparatively expensive?",
    },
    { kind: "h", text: "The apartment-building analogy" },
    {
      kind: "analogy",
      title: "A building with identical, numbered flats in a single row",
      text:
        "Picture an apartment building where every flat is exactly the same size, numbered in order, and " +
        "the whole building sits on one street with a known starting address. To find flat 47, you don't " +
        "walk past flats 1 through 46 counting doors — you already know the street's starting number and " +
        "that every flat is, say, 10 metres wide, so flat 47's address is simply start + 47 × 10. An " +
        "array works exactly this way in memory: it's one unbroken block, every element the same fixed " +
        "size, so the computer finds `array[i]` with one piece of arithmetic (`base address + i × " +
        "element size`) instead of counting from the front. This is exactly why array access is O(1) — the " +
        "arithmetic doesn't get harder as the array gets bigger. Where the analogy stops: moving into this " +
        "building isn't free if you want a specific spot in the middle of an occupied row — everyone from " +
        "that point onward has to shift down by one flat to make room, and that's precisely why inserting " +
        "into the middle of an array is expensive, not O(1).",
    },
    {
      kind: "code",
      caption:
        "Inserting 25 at index 2 by hand: everything from index 2 onward shifts one step right first. The " +
        "array has one spare trailing slot to receive the shift.",
      code:
        "import java.util.Arrays;\n" +
        "\n" +
        "public class InsertShift {\n" +
        "    static void insertAt(int[] data, int usedLength, int index, int value) {\n" +
        "        for (int i = usedLength; i > index; i--) {\n" +
        "            data[i] = data[i - 1];\n" +
        "        }\n" +
        "        data[index] = value;\n" +
        "    }\n" +
        "\n" +
        "    public static void main(String[] args) {\n" +
        "        int[] data = {10, 20, 30, 40, 0};\n" +
        '        System.out.println("Before: " + Arrays.toString(data));\n' +
        "        insertAt(data, 4, 2, 25);\n" +
        '        System.out.println("After inserting 25 at index 2: " + Arrays.toString(data));\n' +
        "\n" +
        "        int address0 = 1000;\n" +
        "        int intSize = 4;\n" +
        "        for (int i = 0; i < 5; i++) {\n" +
        '            System.out.println("data[" + i + "] lives at address " + (address0 + i * intSize));\n' +
        "        }\n" +
        "    }\n" +
        "}\n",
      output:
        "Before: [10, 20, 30, 40, 0]\n" +
        "After inserting 25 at index 2: [10, 20, 25, 30, 40]\n" +
        "data[0] lives at address 1000\n" +
        "data[1] lives at address 1004\n" +
        "data[2] lives at address 1008\n" +
        "data[3] lives at address 1012\n" +
        "data[4] lives at address 1016",
      python:
        "def insert_at(data, used_length, index, value):\n" +
        "    # Shift everything from the end down to `index` one slot right, then drop `value`\n" +
        "    # into the gap that opens up.\n" +
        "    for i in range(used_length, index, -1):\n" +
        "        data[i] = data[i - 1]\n" +
        "    data[index] = value\n" +
        "\n" +
        "\n" +
        "data = [10, 20, 30, 40, 0]\n" +
        'print("Before:", data)\n' +
        "insert_at(data, 4, 2, 25)\n" +
        'print("After inserting 25 at index 2:", data)\n' +
        "\n" +
        "# CPython's list is a contiguous array of *pointers* to objects, not raw values -- each\n" +
        "# pointer is a fixed size (8 bytes on a typical 64-bit build), so data[i] is still one\n" +
        "# multiplication and one dereference away, same O(1) reasoning as Java's int[]. Python\n" +
        "# doesn't expose real memory addresses the way this chapter's Java demo does, so there's\n" +
        '# no literal "data[i] lives at address ..." line to print here.\n',
      pythonOutput: "Before: [10, 20, 30, 40, 0]\nAfter inserting 25 at index 2: [10, 20, 25, 30, 40]",
    },
    {
      kind: "viz",
      title: "insertAt({10, 20, 30, 40, 0}, usedLength=4, index=2, value=25)",
      caption: "Shifting right to open a gap at index 2, then dropping 25 into it.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: 10 },
              { value: 20 },
              { value: 30, pointers: ["index"] },
              { value: 40 },
              { value: 0, pointers: ["i"] },
            ],
            note: "Start: i = usedLength = 4, index = 2 is where 25 needs to land. Nothing has moved yet.",
          },
          {
            cells: [
              { value: 10 },
              { value: 20 },
              { value: 30, pointers: ["index"] },
              { value: 40 },
              { value: 40, state: "active", pointers: ["i"] },
            ],
            note: "i(4) > index(2): data[4] = data[3] = 40. The last slot now holds a copy of 40.",
          },
          {
            cells: [
              { value: 10 },
              { value: 20 },
              { value: 30, pointers: ["index"] },
              { value: 30, state: "active", pointers: ["i"] },
              { value: 40 },
            ],
            note: "i becomes 3. i(3) > index(2): data[3] = data[2] = 30 -> {10, 20, 30, 30, 40}.",
          },
          {
            cells: [
              { value: 10 },
              { value: 20 },
              { value: 30, pointers: ["index", "i"] },
              { value: 30 },
              { value: 40 },
            ],
            note: "i becomes 2. i(2) is not greater than index(2) — the shifting loop stops. The gap is ready.",
          },
          {
            cells: [
              { value: 10 },
              { value: 20 },
              { value: 25, state: "done", pointers: ["index"] },
              { value: 30 },
              { value: 40 },
            ],
            note: "data[2] = 25. Final: {10, 20, 25, 30, 40} — everything from index 2 shifted one slot right.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Each element's memory address is `base + i × 4` (an `int` is 4 bytes in Java) — exactly what " +
        "the second half of the program prints, confirming that reading any index is one multiplication " +
        "and one addition, regardless of array size. Inserting, by contrast, had to move every element from " +
        "the target index onward — for an insert near the front of an n-element array, that's roughly n " +
        "moves in the worst case.",
    },
    {
      kind: "table",
      head: ["Operation", "Time", "Reason"],
      rows: [
        ["Read array[i]", "O(1)", "One address calculation (base + i × element size); no scanning needed."],
        ["Write array[i] = v", "O(1)", "Same address calculation; overwrites the slot directly."],
        [
          "Insert/delete at the front or middle",
          "O(n)",
          "Every element from the target index onward must shift one slot to make or close a gap.",
        ],
        [
          "Insert/delete at the end (with spare capacity)",
          "O(1)",
          "No later elements exist to shift; only the one slot is touched.",
        ],
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Assuming all array operations are O(1) because indexing is — insertion and deletion away from the " +
          "end are not, and this distinction is exactly what interviewers probe when they ask \"what's the " +
          "cost of inserting here?\"",
        "Forgetting that a fixed-size array can't grow past its declared length at all — a resizable list " +
          "(covered in the Java course) handles growth by allocating a new, bigger array and copying " +
          "everything across, which is itself an O(n) operation whenever it happens.",
        "Confusing 'array' the fixed-size Java array (`int[]`) with 'array-backed list' (`ArrayList`) — " +
          "the list adds convenience methods on top, but the underlying contiguous-memory cost model here " +
          "still applies to it.",
      ],
    },
    {
      kind: "remember",
      items: [
        "An array is one contiguous block of same-sized slots — that's what makes array[i] O(1).",
        "array[i]'s address is computed, not searched for: base address + i × element size.",
        "Inserting or deleting away from the end costs O(n), because later elements must shift to keep the " +
          "block contiguous.",
        "Inserting or deleting at the end (with room to spare) is the one cheap exception, at O(1).",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Why is array access O(1)?\" tests whether you understand contiguous memory, not just the label " +
          "— be ready to say the address arithmetic out loud.",
        "\"What's the cost of inserting at the start of this array?\" is a common check for whether you " +
          "conflate 'array' with 'free to modify anywhere' — the correct answer names the shifting cost.",
        "Choosing an array versus a linked list (a later chapter) almost always comes down to this exact " +
          "trade-off: fast indexed access versus fast insertion/deletion away from the ends.",
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "`values[2]` reads one slot directly, no matter how long the list is. Inserting at the front shifts " +
        "every existing element along. Try `values.append(60)` instead of the insert and compare.",
      starter:
        "values = [10, 20, 30, 40, 50]\n" +
        'print("values[2] =", values[2])\n' +
        "\n" +
        "values.insert(0, 5)\n" +
        'print("after inserting 5 at the front:", values)\n',
      expectedOutput: "values[2] = 30\nafter inserting 5 at the front: [5, 10, 20, 30, 40, 50]",
    },
    { kind: "h", text: "Practice problems" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Given a 10-element array with 3 spare trailing slots, describe (in words) the exact shifting work " +
          "needed to insert one value at index 2, and separately at index 8.",
        "Explain, in your own words, why deleting the first element of an n-element array costs O(n), " +
          "walking through what has to move and why.",
        "For a program that only ever appends new values to the end of an array with pre-reserved capacity, " +
          "and never inserts elsewhere, explain why its per-operation cost stays O(1).",
        "Describe a real scenario where you'd pick a structure that supports fast insertion anywhere over a " +
          "plain array, and explain what you'd be trading away to get it.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is reading array[i] an O(1) operation regardless of the array's size?",
      options: [
        "Because Java caches every array in a fast memory area, so each read is answered instantly",
        "The element's address is computed directly from the base address and index, with no scanning",
        "Because arrays are always small in practice, so scanning them never takes noticeable time",
        "Because array[i] secretly uses binary search internally, which keeps the lookup very short",
      ],
      answer: 1,
      why:
        "Contiguous, same-sized storage means the address of any element can be calculated directly (base " +
        "+ i × element size) without inspecting any other element — that calculation takes the same " +
        "time whether the array holds 5 elements or 5 million.",
    },
    {
      kind: "quiz",
      question: "Why does inserting a value near the start of an array typically cost O(n)?",
      options: [
        "Because Java recompiles the array's type each time a value is inserted into it, which takes time",
        "Every element from the insertion point onward must shift one slot to keep the array contiguous",
        "Because array insertion always requires sorting the whole array first, so a sort is hidden inside",
        "It doesn't cost O(n): inserting anywhere in an array is O(1), because the index is already known",
      ],
      answer: 1,
      why:
        "To keep the block of memory contiguous and preserve order, every element from the target index " +
        "to the end must move one slot over — for an insert near the front, that can mean shifting " +
        "almost the whole array.",
    },
    {
      kind: "quiz",
      question: "Which operation is the exception that stays O(1) even though it modifies the array's contents?",
      options: [
        "Inserting at the very start, since the index is known",
        "Deleting the middle element, since nothing needs to move",
        "Appending at the end, when spare capacity already exists",
        "Reversing the whole array in place, because swaps are constant time",
      ],
      answer: 2,
      why:
        "Appending to the end, with room already reserved, touches only the one new slot — there are no " +
        "later elements that need to shift to make room, unlike inserting anywhere before the end.",
    },
  ],
};
