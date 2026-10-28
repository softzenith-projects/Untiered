import type { Chapter } from "@/content/courses/types";

export const chapterWritingAToolDescription: Chapter = {
  slug: "writing-a-tool-description",
  title: "Writing a Tool Description",
  summary:
    "The description is the only thing the model knows about your tool. A vague one produces a wrong " +
    "call — and in the lab you can break the description yourself and watch it happen.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "The model has never seen your code. It cannot read your function, your types, your tests or the " +
        "comment you left above the tricky bit. It has one sentence or two — the `description` field — " +
        "and whatever the argument descriptions say. **That text is your API documentation, and its only " +
        "reader is a machine that will do exactly what the documentation implies.** Most tool-calling " +
        "failures people blame on the model are failures of this paragraph.",
    },
    { kind: "h", text: "The picture: the form with no hints on it" },
    {
      kind: "analogy",
      title: "\"Station\" on a form, with no example next to it",
      text:
        "A railway booking counter has a form with a box labelled \"Station\". A hundred people fill it " +
        "in and you get Pune, PUNE, Pune Junction, pune jn, Poona and Shivajinagar. Nobody was careless; " +
        "the box simply did not say what it wanted. Print \"Station code (e.g. PUNE, CSMT)\" under the " +
        "box and the same hundred people fill it in correctly. The clerk did not get stricter and the " +
        "public did not get cleverer — the form started saying what it needed. A tool description is " +
        "that line under the box, except that the person filling it in is a model that will never ask " +
        "\"do you mean the code or the name?\" It will pick the most plausible-looking thing and commit.",
    },
    {
      kind: "concept",
      title: "The description is part of the prompt",
      text:
        "Tool definitions are text, placed in the model's context on every single turn. That has two " +
        "consequences people forget. First, the description competes for attention with your system " +
        "prompt and your history, so it must be clear rather than exhaustive. Second, it costs tokens " +
        "per turn, for the whole run — a tool definition is not a one-off registration, it is a " +
        "subscription.",
    },
    { kind: "h", text: "Break it yourself" },
    {
      kind: "p",
      text:
        "The lab below has one tool with two descriptions. Nothing else about it changes: same name, " +
        "same parameters, same data behind it. Run it once with the accurate description. Then choose " +
        "the vague one — \"Finds trains.\" — and run it again. Read the first action in each trace " +
        "side by side.",
    },
    { kind: "agentlab", scenarioId: "train-booking" },
    {
      kind: "p",
      text:
        "With the accurate description the agent passes `from=\"PUNE\"`. With the vague one it passes " +
        "`from=\"Pune\"`, the API rejects it, and the whole first step is wasted. The agent recovers — " +
        "but only because the error message says what was expected. That is the chain from the last " +
        "chapter working in your favour: a good description prevents the mistake, and a good error " +
        "message survives it. Now do the harder experiment: leave the vague description selected and " +
        "**switch off \"show the agent what its actions returned\"**. It never learns, repeats the same " +
        "rejected call, and the step limit ends the run.",
    },
    { kind: "h", text: "What a description has to contain" },
    {
      kind: "steps",
      title: "Five things, and only these five",
      steps: [
        { label: "What it does", text: "One sentence, in the model's terms not your codebase's. \"Look up one order by its order id\", not \"wraps OrderService#findByExternalRef\"." },
        { label: "What it needs", text: "Per argument: the format, with an example. `from` must be a station code such as PUNE, never a city name. This is the line under the box." },
        { label: "What it returns", text: "So the model knows whether this call gets it closer to the goal, and what the next step can use." },
        { label: "When not to use it", text: "The line that prevents the most wrong calls. \"Do not use this to check seat availability\" saves a whole wasted turn." },
        { label: "Whether it changes anything", text: "Say plainly if it writes, sends, charges or deletes. A model that thinks a tool is a read will happily call it to look something up." },
      ],
    },
    {
      kind: "code",
      caption: "A crude audit of four tool descriptions against those criteria. Plain Python string matching — no model, and no substitute for reading them yourself.",
      code:
        "# A description is the tool's entire user manual. Audit it like one.\n" +
        "CHECKS = {\n" +
        '    "says what it returns": ["returns", "gives back", "responds with"],\n' +
        '    "names the format of an argument": ["must be", "format", "e.g.", "such as", "code"],\n' +
        '    "says when NOT to use it": ["do not use", "not for", "instead use", "never use"],\n' +
        '    "mentions a side effect": ["places", "sends", "charges", "deletes", "changes", "writes"],\n' +
        "}\n" +
        "\n" +
        "descriptions = {\n" +
        '    "search_trains (vague)": "Finds trains.",\n' +
        '    "search_trains (good)": (\n' +
        '        "Search trains between two stations on one date. `from` and `to` must be station "\n' +
        '        "codes such as PUNE or CSMT, never city names. Returns train number, name and "\n' +
        '        "departure time, earliest first. Do not use this to check seat availability."\n' +
        "    ),\n" +
        '    "order_item (risky)": "Orders an item.",\n' +
        '    "order_item (good)": (\n' +
        '        "Places a real grocery order for one item, in kilograms, and charges the account on "\n' +
        '        "file. Returns the expected delivery day. This changes the world: do not use it to "\n' +
        '        "check anything."\n' +
        "    ),\n" +
        "}\n" +
        "\n" +
        "for name, text in descriptions.items():\n" +
        "    lowered = text.lower()\n" +
        "    passed = [label for label, words in CHECKS.items() if any(w in lowered for w in words)]\n" +
        '    print(f"{name:24} {len(passed)}/4  {sorted(passed)}")\n' +
        "    print(f\"{'':24} {len(text)} characters, re-sent every turn\")\n",
      output:
        "search_trains (vague)    0/4  []\n" +
        "                         13 characters, re-sent every turn\n" +
        "search_trains (good)     3/4  ['names the format of an argument', 'says what it returns', 'says when NOT to use it']\n" +
        "                         232 characters, re-sent every turn\n" +
        "order_item (risky)       0/4  []\n" +
        "                         15 characters, re-sent every turn\n" +
        "order_item (good)        3/4  ['mentions a side effect', 'says what it returns', 'says when NOT to use it']\n" +
        "                         180 characters, re-sent every turn",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Paste a tool description you have actually written into `mine` and run it. Most real descriptions fail on \"when not to use it\".",
      starter:
        "CHECKS = {\n" +
        '    "what it returns": ["returns", "gives back", "responds with"],\n' +
        '    "argument format": ["must be", "format", "e.g.", "such as", "code"],\n' +
        '    "when NOT to use": ["do not use", "not for", "instead use", "never use"],\n' +
        '    "side effect":     ["places", "sends", "charges", "deletes", "changes", "writes"],\n' +
        "}\n" +
        "\n" +
        "mine = (\n" +
        '    "Look up one order by its order id, e.g. A-4471. Returns the item, the return "\n' +
        '    "date, and the refund id if a refund was raised. Read only; do not use it to "\n' +
        '    "issue a refund."\n' +
        ")\n" +
        "\n" +
        "lowered = mine.lower()\n" +
        "for label, words in CHECKS.items():\n" +
        "    hit = any(w in lowered for w in words)\n" +
        '    print(f"  [{\'x\' if hit else \' \'}] {label}")\n' +
        "\n" +
        'print(f"\\n{len(mine)} characters, about {len(mine)//4} tokens, re-sent every turn.")\n',
      expectedOutput:
        "  [x] what it returns\n" +
        "  [x] argument format\n" +
        "  [x] when NOT to use\n" +
        "  [ ] side effect\n" +
        "\n" +
        "168 characters, about 42 tokens, re-sent every turn.",
    },
    { kind: "h", text: "\"But long descriptions cost tokens\"" },
    {
      kind: "p",
      text:
        "They do, and this is the objection that makes people write \"Finds trains.\" So put a number on " +
        "it. The good description costs about 44 extra tokens per turn. One wasted retry — an extra " +
        "thought, an extra action, an extra error observation, and the whole context re-sent to produce " +
        "them — costs hundreds. The arithmetic is not close, and it gets less close the longer the run.",
    },
    {
      kind: "code",
      caption: "The trade, with numbers. The 900-token figure for a wasted retry is an illustrative estimate, not a measurement; the description sizes are real.",
      code:
        "CHARS_PER_TOKEN = 4  # rough, for English prose\n" +
        "\n" +
        'vague = "Finds trains."\n' +
        "good = (\n" +
        '    "Search trains between two stations on one date. `from` and `to` must be station "\n' +
        '    "codes such as PUNE or CSMT, never city names. Returns train number, name and "\n' +
        '    "departure time, earliest first."\n' +
        ")\n" +
        "\n" +
        "extra_tokens = (len(good) - len(vague)) / CHARS_PER_TOKEN\n" +
        'print(f"vague: {len(vague):3d} chars ~ {len(vague)/CHARS_PER_TOKEN:5.0f} tokens")\n' +
        'print(f"good:  {len(good):3d} chars ~ {len(good)/CHARS_PER_TOKEN:5.0f} tokens")\n' +
        'print(f"the good one costs about {extra_tokens:.0f} extra tokens per turn")\n' +
        "print()\n" +
        "\n" +
        "for turns in [1, 4, 10]:\n" +
        "    wasted_turn_tokens = 900  # a whole extra thought + action + error observation\n" +
        '    print(f"{turns:2d}-turn run: description overhead {extra_tokens * turns:6.0f} tokens, "\n' +
        '          f"one wasted retry {wasted_turn_tokens:6d} tokens")\n',
      output:
        "vague:  13 chars ~     3 tokens\n" +
        "good:  188 chars ~    47 tokens\n" +
        "the good one costs about 44 extra tokens per turn\n" +
        "\n" +
        " 1-turn run: description overhead     44 tokens, one wasted retry    900 tokens\n" +
        " 4-turn run: description overhead    175 tokens, one wasted retry    900 tokens\n" +
        "10-turn run: description overhead    438 tokens, one wasted retry    900 tokens",
    },
    {
      kind: "compare",
      title: "Two descriptions of the same function",
      columns: [
        {
          label: "\"Finds trains.\"",
          items: [
            "The model has to guess what `from` wants — and city names are the plausible guess",
            "No idea what comes back, so it cannot plan the next step",
            "No idea what this tool is *not* for, so it may call it for availability too",
            "Cheap per turn, expensive the moment it is wrong",
          ],
        },
        {
          label: "The accurate one",
          items: [
            "States the format and gives two examples, so the first call is right",
            "Says what it returns and in what order, so the next step is obvious",
            "Says explicitly not to use it for availability",
            "About 44 tokens a turn more, against hundreds for a single wasted retry",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Writing the description for a developer — the model does not know your class names, your conventions or your internal jargon, and it will not ask.",
        "Leaving the argument format implicit — \"station\" without \"code, e.g. PUNE\" produces city names, every time, in every system anyone has built.",
        "Omitting what the tool is not for — this is the single cheapest line you can add, because it prevents a whole category of wasted turns.",
        "Not saying that a tool writes — a model that believes `order_item` is a lookup will call it to check something, and the order will be real.",
        "Naming two tools so similarly that only you can tell them apart — `get_order` and `fetch_order` in the same registry is a coin flip on every turn.",
        "Never reading your own traces — the tool call the model actually made is the only real evidence about whether your description says what you think it says.",
      ],
    },
    {
      kind: "remember",
      items: [
        "The description is the only thing the model knows about your tool. It is API documentation whose sole reader is a machine.",
        "Five things: what it does, what it needs (with an example), what it returns, when not to use it, and whether it changes anything.",
        "Tool definitions are re-sent on every turn — clarity is worth the tokens, and one wasted retry costs far more than a good paragraph.",
        "A vague description does not produce no call. It produces a wrong call, confidently.",
        "Test descriptions by reading the traces. The call the model made is the only honest review of your wording.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Your agent keeps calling the wrong tool — how do you debug it?\" The first place to look is the descriptions, and specifically whether two of them overlap.",
        "Being able to say that a tool definition costs tokens on every turn, and doing the arithmetic against a wasted retry, is a very practical answer that lands well.",
        "Expect to be asked how you test a tool description. \"Read the traces and look at the arguments it actually passed\" is the answer of somebody who has done it.",
      ],
    },
    {
      kind: "quiz",
      question: "Your agent calls `search_trains(from=\"Pune\")` and the API rejects it. What is the first thing to fix?",
      options: [
        "The model — switch to a larger one that is less likely to guess a city name for a station code",
        "The system prompt — add \"always use station codes\"",
        "The tool description — state that `from` must be a station code, with an example",
        "The API — make it accept city names too",
      ],
      answer: 2,
      why:
        "The model made a reasonable guess from what it was told. The description is where that " +
        "information belongs: it sits right next to the argument, every turn, exactly when the model is " +
        "deciding what to pass. A system-prompt rule about one tool's arguments is the wrong place and is " +
        "easily lost among everything else.",
    },
    {
      kind: "quiz",
      question: "Which line most reliably prevents wasted turns?",
      options: [
        "\"This is a very important tool, so choose it before any of the other tools whenever you are unsure.\"",
        "\"Do not use this to check seat availability — use check_availability instead.\"",
        "\"Use this tool carefully.\"",
        "\"This tool is fast.\"",
      ],
      answer: 1,
      why:
        "It names a specific wrong use and points at the right tool. The others are adjectives, which " +
        "chapter 6 already established do nothing — there is no shape of text called \"carefully\".",
    },
    {
      kind: "quiz",
      question: "Why is a wordy tool description more expensive than it looks?",
      options: [
        "It is stored permanently on the provider's servers, so you are billed for it every month it sits there",
        "It is re-sent to the model on every turn of every run, so the cost multiplies by turns and by runs",
        "It slows down your own function",
        "It counts against the output token limit",
      ],
      answer: 1,
      why:
        "Tool definitions are part of the context, and the context is re-sent every turn. That is an " +
        "argument for clarity over length — not for vagueness, since one wasted retry costs far more " +
        "than a well-written paragraph.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "In the lab, select the vague description and turn observations off. Predict how the run ends before you press Run.",
        "Take a tool description you have written and check it against all five requirements. Most real ones fail on \"when not to use it\".",
        "Write two tool descriptions deliberately similar enough that a model could not tell them apart, then fix them.",
        "For a write tool in a system you know, write the sentence that makes it unmistakable that calling it changes something real.",
      ],
    },
  ],
};
