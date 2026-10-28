import type { Chapter } from "@/content/courses/types";

export const chapterWhenPromptingStopsWorking: Chapter = {
  slug: "when-prompting-stops-working",
  title: "When Prompting Stops Working",
  summary:
    "Four walls no prompt can climb: what the model does not know, what happened today, what it cannot " +
    "do, and what nobody checked. Recognising which wall you have hit is the skill this module ends on.",
  minutes: 12,
  blocks: [
    {
      kind: "p",
      text:
        "Four chapters of prompting, and it is time to be honest about where it runs out. A great deal of " +
        "wasted effort in this field comes from one mistake: treating a wall as a prompting problem and " +
        "attacking it with better wording. You can spend a week rewriting a prompt to make a model tell " +
        "you a customer's balance, and at the end of the week it will still be making the number up, " +
        "because the number was never anywhere near it. This chapter names the four walls so you can " +
        "recognise them in ten seconds instead of a week.",
    },
    { kind: "h", text: "The picture: asking a very well-read stranger about your house" },
    {
      kind: "analogy",
      title: "The stranger on the train who has read everything",
      text:
        "You share a long train journey with someone who has read an extraordinary amount — every " +
        "textbook, every manual, most of the internet up to a certain year. Ask her about Mughal " +
        "architecture, or how a heat pump works, or how to phrase a difficult email, and she is genuinely " +
        "excellent. Now ask her whether your electricity bill was paid this month. She cannot possibly " +
        "know. Ask her what happened in the news this morning — she boarded before it happened. Ask her " +
        "to go and switch your geyser off — she is on a train. Ask her whether what she just told you " +
        "about your bill is correct — she has no way to check either. No amount of asking more nicely, " +
        "more firmly, or more cleverly moves any of this. What would help is a phone. Where the analogy " +
        "stops: the stranger would say \"I have no idea.\" The model, as chapter 4 explained, has been " +
        "scored into answering anyway.",
    },
    {
      kind: "concept",
      title: "The four walls",
      text:
        "**Knowledge** — the fact was never in the training data, because it is private, internal or " +
        "yours. **Recency** — the fact came into existence after training ended. **Action** — the task " +
        "requires changing something in the world, not producing text about it. **Verification** — the " +
        "answer might be right, and nothing in the process establishes whether it is. Every one of these " +
        "is fixed by connecting the model to something outside itself. None of them is fixed by wording.",
    },
    { kind: "h", text: "What \"it knows\" actually looks like" },
    {
      kind: "code",
      caption:
        "A model's baked-in knowledge as a fixed lookup table. Deliberately crude — the point is that prompting cannot add a row. Plain Python.",
      code:
        '# What "the model knows" is a fixed table. Prompting cannot add a row to it.\n' +
        "BAKED_IN = {\n" +
        '    "capital of france": "Paris",\n' +
        '    "who wrote hamlet": "Shakespeare",\n' +
        '    "boiling point of water at sea level": "100 C",\n' +
        "}\n" +
        "\n" +
        "questions = [\n" +
        '    "capital of france",\n' +
        '    "balance of account 4412",\n' +
        '    "price of onions in pune today",\n' +
        '    "who wrote hamlet",\n' +
        "]\n" +
        "\n" +
        "for q in questions:\n" +
        "    if q in BAKED_IN:\n" +
        '        print(f"{q:38} -> {BAKED_IN[q]}")\n' +
        "    else:\n" +
        '        print(f"{q:38} -> not in here. No prompt changes that; only a tool can.")\n',
      output:
        "capital of france                      -> Paris\n" +
        "balance of account 4412                -> not in here. No prompt changes that; only a tool can.\n" +
        "price of onions in pune today          -> not in here. No prompt changes that; only a tool can.\n" +
        "who wrote hamlet                       -> Shakespeare",
    },
    {
      kind: "p",
      text:
        "A real model is not a dictionary, and the analogy is deliberately crude — it has no clean lookup " +
        "and no clean \"not in here\". That is precisely the problem. Where this code prints an honest " +
        "message, a real model produces a fluent, specific, confident sentence, and the two outputs are " +
        "indistinguishable from the outside. The missing branch is the whole difficulty.",
    },
    {
      kind: "table",
      head: ["The wall you hit", "How it shows up", "What actually fixes it"],
      rows: [
        [
          "Knowledge",
          "Specific, confident claims about your data, your customers, your internal processes — all invented.",
          "A tool that queries the real system, or retrieval over your own documents (module 4). The fact has to enter the context from somewhere.",
        ],
        [
          "Recency",
          "Answers that were true once. Prices, versions, schedules, \"the latest\" anything.",
          "A tool that fetches the current value at the time of asking. Nothing about the model changes.",
        ],
        [
          "Action",
          "The model describes what should happen, beautifully, and nothing happens.",
          "A tool that performs the action — and then a decision about who approves it before it runs (module 6).",
        ],
        [
          "Verification",
          "An answer that might be right. Nobody can tell, including the model.",
          "Something that checks: run the code, resolve the URL, query the source, or show the user the citation and let them check.",
        ],
      ],
    },
    { kind: "h", text: "The test that takes ten seconds" },
    {
      kind: "p",
      text:
        "Before rewriting a prompt, ask one question: **is there any path by which the right answer could " +
        "have reached the model?** If the answer lives in your database, in today's newspaper, or in a " +
        "system nobody connected, then no. Stop rewriting. You do not have a prompting problem; you have " +
        "a plumbing problem, and the rest of this course is plumbing.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add your own questions to `asks`. The classifier is crude on purpose — the useful part is doing this in your head before you rewrite a prompt.",
      starter:
        "# Which wall is this? A rough triage, and a reminder of what each one needs.\n" +
        "PRIVATE = [\"my \", \"our \", \"customer\", \"account\", \"order\", \"internal\", \"database\"]\n" +
        'RECENT = ["today", "now", "current", "latest", "this week", "right now"]\n' +
        'ACTION = ["send", "book", "cancel", "refund", "delete", "update", "pay"]\n' +
        "\n" +
        "asks = [\n" +
        '    "Summarise this paragraph in one line.",\n' +
        '    "What is the balance on my account?",\n' +
        '    "What is the current price of onions in Pune?",\n' +
        '    "Cancel my booking for Tuesday.",\n' +
        '    "Explain how a heat pump works.",\n' +
        "]\n" +
        "\n" +
        "\n" +
        "def wall(text):\n" +
        "    t = text.lower()\n" +
        "    if any(w in t for w in ACTION):\n" +
        '        return "ACTION       -> needs a tool that does it, and an approval step"\n' +
        "    if any(w in t for w in RECENT):\n" +
        '        return "RECENCY      -> needs a tool that fetches the value now"\n' +
        "    if any(w in t for w in PRIVATE):\n" +
        '        return "KNOWLEDGE    -> needs retrieval or a lookup tool"\n' +
        '    return "none of them -> prompting alone can do this"\n' +
        "\n" +
        "\n" +
        "for ask in asks:\n" +
        '    print(f"{wall(ask)}\\n   {ask}\\n")\n',
      expectedOutput:
        "none of them -> prompting alone can do this\n" +
        "   Summarise this paragraph in one line.\n" +
        "\n" +
        "KNOWLEDGE    -> needs retrieval or a lookup tool\n" +
        "   What is the balance on my account?\n" +
        "\n" +
        "RECENCY      -> needs a tool that fetches the value now\n" +
        "   What is the current price of onions in Pune?\n" +
        "\n" +
        "ACTION       -> needs a tool that does it, and an approval step\n" +
        "   Cancel my booking for Tuesday.\n" +
        "\n" +
        "none of them -> prompting alone can do this\n" +
        "   Explain how a heat pump works.\n",
    },
    {
      kind: "compare",
      title: "Two kinds of problem that look identical from the outside",
      columns: [
        {
          label: "Really a prompting problem",
          items: [
            "The output is in the wrong format or the wrong tone",
            "The model does the task, but inconsistently between runs",
            "Everything it needs is already in the context and it is using the wrong bit",
            "It gets it right when you explain more precisely",
            "Symptom: better wording measurably improves it",
          ],
        },
        {
          label: "Really a plumbing problem",
          items: [
            "The output is confidently specific and confidently wrong",
            "It is wrong in the same shape every time, with different details",
            "The right answer lives in a system nothing is connected to",
            "It gets *more* convincing when you explain more precisely, and no more correct",
            "Symptom: you have rewritten the prompt four times and the numbers are still invented",
          ],
        },
      ],
    },
    {
      kind: "p",
      text:
        "That last symptom is the tell. If more precise instructions are making the answer more " +
        "*plausible* without making it more *correct*, you are polishing a guess. The model is doing " +
        "exactly what you asked — producing the kind of text you described — and the kind of text you " +
        "described happens to include a number that nobody looked up.",
    },
    {
      kind: "pitfall",
      items: [
        "Rewriting the prompt for the fifth time — if the missing thing is a fact the model cannot have, the sixth wording will not contain it either.",
        "Pasting the data in by hand and calling it solved — that works exactly once, for the one case you tested, and has no path to production.",
        "Assuming a web-connected assistant has your data — browsing the public web closes the recency wall, not the knowledge wall; your database is not on the public web.",
        "Confusing \"it wrote the SQL\" with \"it ran the SQL\" — describing an action is not performing one, and the difference is a tool and an approval step.",
        "Skipping the verification wall because the other three are fixed — a tool that returns the wrong row still produces a confident answer, and nobody checked that either.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Four walls: knowledge, recency, action, verification. Wording climbs none of them.",
        "The ten-second test: is there any path by which the right answer could have reached the model?",
        "If better instructions make the answer more plausible but no more correct, you are polishing a guess.",
        "Every fix has the same shape — connect the model to something outside itself. That is what a tool is, and it is the next chapter.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"When would you not use a bigger model or a better prompt?\" is a design question, and the four walls are the answer. Naming which wall a scenario hits is a strong, concrete response.",
        "Expect a scenario question: a feature is producing confident wrong answers about internal data. The expected answer diagnoses it as a knowledge wall, not a prompting fault.",
        "Being clear that describing an action is not performing one — and that performing one needs an approval decision — shows you are thinking about production, not demos.",
      ],
    },
    {
      kind: "quiz",
      question: "A model keeps inventing order numbers for your customers. You have rewritten the prompt four times. What is the correct next step?",
      options: [
        "A fifth rewrite, with the instruction worded far more forcefully and repeated in the system prompt",
        "Lower the temperature to zero so the model stops guessing and only produces numbers it is sure of",
        "Connect a tool that looks the order up, so the real number can enter the context",
        "Add three more few-shot examples of order lookups",
      ],
      answer: 2,
      why:
        "This is the knowledge wall. The order number exists only in your system, so there is no path by " +
        "which the model could produce the right one. More examples would teach it the *shape* of an order " +
        "lookup, making the invented numbers more convincing rather than more correct.",
    },
    {
      kind: "quiz",
      question: "Which of these is genuinely a prompting problem rather than a plumbing one?",
      options: [
        "The assistant says a refund was processed on a date nobody checked",
        "The assistant writes its summaries in five paragraphs when you wanted three bullets",
        "The assistant quotes last year's price as though it were the current one, because its training ended before the change",
        "The assistant says it has cancelled a booking that is still active",
      ],
      answer: 1,
      why:
        "Format is a shape of text, and shapes of text are exactly what instructions and examples control. " +
        "The other three are the knowledge, recency and action walls respectively.",
    },
    {
      kind: "quiz",
      question: "You give a model web search. Which wall does that close on its own?",
      options: [
        "All four",
        "Recency, for publicly published information — and nothing about your private data",
        "Knowledge, including private systems such as your own customer database and order records",
        "Verification",
      ],
      answer: 1,
      why:
        "Search reaches what is publicly published now, which addresses recency for public facts. Your " +
        "database is not on the public web, so the knowledge wall stands; and a retrieved page being " +
        "fetched is not the same as its claim being checked.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "List five things you would want an assistant to do at work. Mark each with the wall it hits, or none.",
        "Take the one that hits the action wall and write down who would have to approve it before it ran, and how they would see what was about to happen.",
        "Find a prompt somebody has rewritten several times without fixing the problem, and work out which wall it was really up against.",
        "For one knowledge-wall question, write down exactly what tool would have to exist, what it would take as an argument, and what it would return.",
      ],
    },
  ],
};
