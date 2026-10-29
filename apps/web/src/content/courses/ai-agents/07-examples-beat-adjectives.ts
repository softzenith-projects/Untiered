import type { Chapter } from "@/content/courses/types";

export const chapterExamplesBeatAdjectives: Chapter = {
  slug: "examples-beat-adjectives",
  title: "Examples Beat Adjectives (Few-Shot Prompting)",
  summary:
    "Two or three worked examples specify a task more precisely than a paragraph of description, because " +
    "an example rules out the readings a description leaves open. Here is how to pick them.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "The last chapter ended on a rule: name behaviour, not virtues. This chapter is the strongest " +
        "version of that rule. If you want a model to do a task a particular way, the most reliable thing " +
        "you can put in the prompt is not a better description of the task — it is two or three worked " +
        "examples of it being done. This is called **few-shot prompting**, and it is not a trick; it is " +
        "the natural consequence of a machine that continues patterns.",
    },
    { kind: "h", text: "The picture: showing a new cook one plated dish" },
    {
      kind: "analogy",
      title: "\"Garnish it nicely\" versus one plate you already made",
      text:
        "A new cook joins the kitchen and you tell him to garnish the plates nicely. He does — with a " +
        "great fan of coriander, because that is what nicely meant at his last job. You could write him a " +
        "paragraph: not too much, keep it to one corner, green things only, no coriander on the sweet " +
        "dishes. Or you could plate two dishes yourself and leave them on the pass. The two plates carry " +
        "every rule in the paragraph, plus about ten rules you did not think to write down — how much, " +
        "how high, which corner, what it looks like next to the rest of the food. Where the analogy stops: " +
        "the cook will eventually develop judgement and depart from your plates on purpose. The model " +
        "will not; it will keep continuing the pattern, including the parts of your examples you did not " +
        "mean as a pattern. That is the whole risk, and it is discussed below.",
    },
    {
      kind: "concept",
      title: "Few-shot prompting",
      text:
        "Putting worked examples of the task — input and the exact output you want — into the prompt " +
        "itself, so the model continues the pattern instead of guessing at a description. Zero-shot is " +
        "the same task with description only; one-shot is with a single example. Crucially, the model's " +
        "weights are not changed by any of this: in the GPT-3 paper (*Language Models are Few-Shot " +
        "Learners*, arXiv:2005.14165), the approach is applied \"without any gradient updates or " +
        "fine-tuning, with tasks and few-shot demonstrations specified purely via text interaction with " +
        "the model\". The examples are just more context, and they cost tokens on every call like all " +
        "other context.",
    },
    { kind: "h", text: "Why a description is not enough" },
    {
      kind: "code",
      caption: "One instruction, four honest readings — and what two examples do to them. Plain Python, no model.",
      code:
        "# One instruction, four honest readings. This is why examples beat adjectives.\n" +
        'instruction = "Extract the date."\n' +
        'line = "Dispatched 12/10/2026 from the Pune warehouse."\n' +
        "\n" +
        "readings = {\n" +
        '    "day first, ISO out":   "2026-10-12",\n' +
        '    "month first, ISO out": "2026-12-10",\n' +
        '    "as written":           "12/10/2026",\n' +
        '    "human readable":       "12 October 2026",\n' +
        "}\n" +
        "\n" +
        'print("instruction:", instruction)\n' +
        'print("input:      ", line)\n' +
        "for name, value in readings.items():\n" +
        '    print(f"  {name:22} -> {value}")\n' +
        "print()\n" +
        'print("Nothing in the instruction rules any of these out.")\n' +
        'print("Two examples do:")\n' +
        'examples = [("Shipped 03/04/2026.", "2026-04-03"), ("Returned 28/02/2026.", "2026-02-28")]\n' +
        "for src, out in examples:\n" +
        '    print(f"  {src:22} -> {out}")\n' +
        'print("The second example only parses as day-first. The format is now pinned down.")\n',
      output:
        "instruction: Extract the date.\n" +
        "input:       Dispatched 12/10/2026 from the Pune warehouse.\n" +
        "  day first, ISO out     -> 2026-10-12\n" +
        "  month first, ISO out   -> 2026-12-10\n" +
        "  as written             -> 12/10/2026\n" +
        "  human readable         -> 12 October 2026\n" +
        "\n" +
        "Nothing in the instruction rules any of these out.\n" +
        "Two examples do:\n" +
        "  Shipped 03/04/2026.    -> 2026-04-03\n" +
        "  Returned 28/02/2026.   -> 2026-02-28\n" +
        "The second example only parses as day-first. The format is now pinned down.",
    },
    {
      kind: "p",
      text:
        "Look at what the second example did. `28/02/2026` cannot be month-first, because there is no " +
        "twenty-eighth month — so a single well-chosen example eliminates an entire reading that a " +
        "paragraph of prose would have had to spell out. **That is how to choose examples: pick the ones " +
        "that rule something out.** Two examples that both look like `03/04/2026` teach the model almost " +
        "nothing it did not already assume.",
    },
    {
      kind: "compare",
      title: "Choosing examples",
      columns: [
        {
          label: "Examples that earn their tokens",
          items: [
            "One that rules out an ambiguity — 28/02 settles day-first versus month-first",
            "One near the boundary of the task, where a reasonable person might do it differently",
            "One showing the failure case: what the output looks like when there is nothing to extract",
            "Outputs in exactly the format you want, character for character",
          ],
        },
        {
          label: "Examples that waste them",
          items: [
            "Three easy cases that all look the same",
            "Examples with an accidental pattern you did not mean — every answer two sentences long, every name Indian, every answer \"yes\"",
            "An example whose output you would not actually accept in production",
            "Twenty examples where four would do — they are re-sent on every call",
          ],
        },
      ],
    },
    { kind: "h", text: "The failure example is the one people forget" },
    {
      kind: "p",
      text:
        "Almost every few-shot prompt in the wild shows the model three cases that worked. None of them " +
        "shows what to do when the input does not contain what you are asking for — and so, when that " +
        "happens in production, the model does the only thing the pattern supports: it produces " +
        "something in the right shape. An empty-case example is often the single highest-value line in " +
        "the prompt, and it connects straight back to the hallucination chapter. You are not asking the " +
        "model to be honest. You are showing it what honest output looks like, so honesty becomes the " +
        "continuation of the pattern.",
    },
    {
      kind: "code",
      caption: "A prompt assembled from examples, with the empty case included. String building only — nothing is sent anywhere.",
      code:
        "examples = [\n" +
        '    ("Shipped 03/04/2026 from Nashik.", "2026-04-03"),\n' +
        '    ("Returned 28/02/2026, refund pending.", "2026-02-28"),\n' +
        '    ("Order confirmed, dispatch date to follow.", "NONE"),\n' +
        "]\n" +
        "\n" +
        "system = (\n" +
        '    "Extract the single date from the input and return it as YYYY-MM-DD.\\n"\n' +
        '    "If the input contains no date, return exactly: NONE"\n' +
        ")\n" +
        "\n" +
        "parts = [system, \"\"]\n" +
        "for src, out in examples:\n" +
        '    parts.append(f"Input: {src}")\n' +
        '    parts.append(f"Output: {out}")\n' +
        '    parts.append("")\n' +
        'parts.append("Input: Dispatched 12/10/2026 from the Pune warehouse.")\n' +
        'parts.append("Output:")\n' +
        "\n" +
        'prompt = "\\n".join(parts)\n' +
        "print(prompt)\n" +
        'print("\\n--- prompt is", len(prompt), "characters, re-sent on every call ---")\n',
      output:
        "Extract the single date from the input and return it as YYYY-MM-DD.\n" +
        "If the input contains no date, return exactly: NONE\n" +
        "\n" +
        "Input: Shipped 03/04/2026 from Nashik.\n" +
        "Output: 2026-04-03\n" +
        "\n" +
        "Input: Returned 28/02/2026, refund pending.\n" +
        "Output: 2026-02-28\n" +
        "\n" +
        "Input: Order confirmed, dispatch date to follow.\n" +
        "Output: NONE\n" +
        "\n" +
        "Input: Dispatched 12/10/2026 from the Pune warehouse.\n" +
        "Output:\n" +
        "\n" +
        "--- prompt is 368 characters, re-sent on every call ---",
    },
    {
      kind: "p",
      text:
        "Notice the shape of the last two lines. The prompt ends mid-pattern, with `Output:` and nothing " +
        "after it. That is deliberate and it is the whole mechanism: the most likely continuation of this " +
        "text is a date in the demonstrated format, because that is what followed every previous " +
        "`Output:` in the same string. You have not persuaded the model. You have arranged the context so " +
        "that what you want is the easiest thing for it to produce.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add a fourth example to `examples` and re-run. Then deliberately add a *bad* one — an output in a different format — and see the pattern stop being a pattern.",
      starter:
        "examples = [\n" +
        '    ("Shipped 03/04/2026 from Nashik.", "2026-04-03"),\n' +
        '    ("Returned 28/02/2026, refund pending.", "2026-02-28"),\n' +
        '    ("Order confirmed, dispatch date to follow.", "NONE"),\n' +
        "]\n" +
        "\n" +
        "\n" +
        "def describe(examples):\n" +
        '    """What a pattern-continuer can actually infer from this set."""\n' +
        '    outs = [o for _, o in examples if o != "NONE"]\n' +
        '    lengths = {len(o) for o in outs}\n' +
        '    seps = {o[4] for o in outs if len(o) > 4}\n' +
        "    days = [int(o[8:10]) for o in outs if len(o) == 10]\n" +
        "    day_first = any(d > 12 for d in days)\n" +
        '    empty_case = any(o == "NONE" for _, o in examples)\n' +
        '    print(f"{len(examples)} examples, {len(outs)} of them non-empty")\n' +
        '    print(f"  output lengths seen : {sorted(lengths)}")\n' +
        '    print(f"  separators seen     : {sorted(seps)}")\n' +
        '    print(f"  day-first proved    : {day_first}")\n' +
        '    print(f"  empty case shown    : {empty_case}")\n' +
        "\n" +
        "\n" +
        "describe(examples)\n",
      expectedOutput:
        "3 examples, 2 of them non-empty\n" +
        "  output lengths seen : [10]\n" +
        "  separators seen     : ['-']\n" +
        "  day-first proved    : True\n" +
        "  empty case shown    : True",
    },
    { kind: "h", text: "When few-shot is the wrong tool" },
    {
      kind: "p",
      text:
        "Few-shot is not free and it is not universal. Examples are context, so they are re-sent on every " +
        "call and they eat the window (chapter 3). If a task needs twenty examples to be pinned down, " +
        "that is usually a sign the task should be split, or that it needs a tool rather than a " +
        "demonstration. And examples cannot teach a fact the model does not have — showing it three " +
        "examples of order lookups will not give it access to your orders. It will teach it to produce " +
        "convincing order lookups, which is worse than nothing.",
    },
    {
      kind: "pitfall",
      items: [
        "Showing only successful cases — the model then has no pattern for \"nothing here\", so it produces a plausible answer instead of an honest one.",
        "Leaking an accidental pattern — if every example output is exactly two sentences, or every example customer is angry, the model will continue that too and you will not see why.",
        "Using examples where the pattern is really a fact — demonstrating order lookups teaches the format of an answer, never the answer; that needs a tool.",
        "Letting the example set grow without pruning — twenty examples that could have been four is a cost paid on every single call, forever.",
        "Writing examples by hand that do not match real inputs — real inputs are messier, and a prompt tuned on tidy examples falls over on the first genuine one.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Two well-chosen examples specify a task better than a paragraph, because an example rules out readings a description leaves open.",
        "Choose examples that eliminate something — 28/02 proves day-first; 03/04 proves nothing.",
        "Always include the empty case, or the model has no pattern for honest failure.",
        "Few-shot changes no weights (arXiv:2005.14165). Examples are context, and context costs tokens on every call.",
        "End the prompt mid-pattern. The thing you want should be the obvious continuation.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How would you get consistent output format out of a model?\" — the strong answer is examples plus a schema, not a more emphatic instruction.",
        "Expect to be asked about the cost. Examples are re-sent every call, so \"how few examples can I get away with\" is a real engineering question with a real answer.",
        "A good discriminator: being asked what example you would add *first*. \"The one where there is nothing to extract\" is the answer of someone who has watched this fail in production.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is `28/02/2026 → 2026-02-28` a better example than `03/04/2026 → 2026-04-03`?",
      options: [
        "It is longer, so the model pays more attention to it and treats it as the more important example",
        "It rules out the month-first reading, because there is no 28th month",
        "February is a common month in support data",
        "It has fewer digits to confuse the tokenizer",
      ],
      answer: 1,
      why:
        "A good example eliminates an interpretation. 03/04 is consistent with both day-first and " +
        "month-first, so it settles nothing; 28/02 can only be day-first.",
    },
    {
      kind: "quiz",
      question: "What does few-shot prompting change about the model?",
      options: [
        "Its weights, slightly, for the duration of the session",
        "Nothing about the model — the examples are context, re-sent on every call",
        "Its temperature, so that its answers become more consistent from one call to the next",
        "Its context window size",
      ],
      answer: 1,
      why:
        "The GPT-3 paper is explicit that this happens \"without any gradient updates or fine-tuning\" — " +
        "demonstrations are specified purely as text. Which also means they cost tokens every single call.",
    },
    {
      kind: "quiz",
      question: "Your extraction prompt has three examples, all of which contain a date. What will most likely happen on an input with no date?",
      options: [
        "The model will say plainly that it cannot find a date, because it knows the examples did not cover this case",
        "The model will produce something date-shaped, because that is the only pattern it has been shown",
        "The model will return an empty string",
        "The API will error",
      ],
      answer: 1,
      why:
        "The examples define the pattern, and the pattern says \"an output line contains a date\". Without " +
        "an example of the empty case, honest failure is not a continuation the prompt supports.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take a task you would give a model and write the one example that rules out the most alternative readings. Then write the empty case.",
        "Look at a few-shot prompt you have seen and hunt for an accidental pattern — length, tone, sentiment, name origin — that the examples all share.",
        "Count the tokens in a five-example prompt and multiply by a thousand calls a day. Decide whether all five still earn their place.",
        "Write a prompt where the examples demonstrate a fact rather than a format, and explain to yourself exactly why it will produce confident nonsense.",
      ],
    },
  ],
};
