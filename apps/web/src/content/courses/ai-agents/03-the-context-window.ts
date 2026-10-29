import type { Chapter } from "@/content/courses/types";

export const chapterTheContextWindow: Chapter = {
  slug: "the-context-window",
  title: "The Context Window, and Why the Model Forgets",
  summary:
    "A model has no memory between calls. What looks like memory is the whole conversation being re-sent " +
    "every time — into a window with a hard edge, where position on the page changes how well it is read.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Here is the fact that surprises people most, and the one that most needs to be true before " +
        "anything later in this course makes sense: **a language model remembers nothing between calls.** " +
        "Not your name, not what you said thirty seconds ago, not the file you uploaded. When a chat " +
        "assistant appears to remember, what is actually happening is that the software around the model " +
        "is taking the entire conversation so far and sending all of it again, from the top, with your new " +
        "message stuck on the end. Every single turn. That re-sent pile of text is the **context**, and " +
        "the maximum size it can be is the **context window**.",
    },
    { kind: "h", text: "The picture: an exam you sit again from scratch every minute" },
    {
      kind: "analogy",
      title: "A brilliant examinee with no memory and one desk",
      text:
        "Imagine hiring someone extraordinarily well-read to answer questions for you, with one catch: " +
        "every sixty seconds they forget everything that has happened and start fresh. Your workaround is " +
        "a desk. Before each question you lay out on the desk everything they need to know — your earlier " +
        "questions, their earlier answers, the rules you want followed, the document you are asking about " +
        "— and they read the whole desk, answer, and forget again. Two things follow immediately. First, " +
        "the desk has edges: put enough paper on it and something has to come off, and whatever comes off " +
        "did not just get de-prioritised, it *stopped existing*. Second, they re-read the entire desk for " +
        "every single question, so a long desk is slow and expensive every time, not just once. Where the " +
        "analogy stops: a human re-reading the desk would notice a page in the middle just as well as one " +
        "on top. As we will see, the model does not quite.",
    },
    {
      kind: "concept",
      title: "Context window",
      text:
        "The maximum number of tokens a model can take in on one call — the system prompt, the tool " +
        "definitions, every previous turn, the documents you pasted, and the space reserved for its own " +
        "reply, all counted together. It is a hard limit, not a soft one. Text that does not fit is not " +
        "summarised or remembered for later; it is simply not there.",
    },
    { kind: "h", text: "What the window is actually spent on" },
    {
      kind: "p",
      text:
        "The mistake is thinking of the window as \"how much I can paste in\". In practice a large part of " +
        "it is gone before you type anything: the system prompt, the tool definitions (which, as the next " +
        "module shows, are real text sent on every turn), and the room the model needs to write its reply. " +
        "The arithmetic below uses a deliberately tiny 200-token window so the numbers stay readable, but " +
        "the shape is exactly what happens at 200,000.",
    },
    {
      kind: "code",
      caption: "Where a context window goes. Small numbers, real arithmetic — this is just bookkeeping, no model involved.",
      code:
        "# Every call re-sends the whole conversation. This is what that costs.\n" +
        "WINDOW = 200  # tokens, kept small so the arithmetic is readable\n" +
        "\n" +
        "system_prompt = 42\n" +
        "tool_definitions = 68\n" +
        "reply_reserve = 40\n" +
        "\n" +
        'turns = [("user", 18), ("assistant", 25), ("user", 22), ("assistant", 31), ("user", 20)]\n' +
        "\n" +
        "fixed = system_prompt + tool_definitions + reply_reserve\n" +
        'print(f"fixed overhead: {fixed} tokens of {WINDOW}")\n' +
        "\n" +
        "spent = fixed\n" +
        "for i, (role, size) in enumerate(turns, start=1):\n" +
        "    spent += size\n" +
        "    left = WINDOW - spent\n" +
        '    flag = "OK" if left >= 0 else "OVERFLOW"\n' +
        '    print(f"turn {i} ({role:9}) +{size:3d} -> {spent:3d} used, {left:4d} free  {flag}")\n',
      output:
        "fixed overhead: 150 tokens of 200\n" +
        "turn 1 (user     ) + 18 -> 168 used,   32 free  OK\n" +
        "turn 2 (assistant) + 25 -> 193 used,    7 free  OK\n" +
        "turn 3 (user     ) + 22 -> 215 used,  -15 free  OVERFLOW\n" +
        "turn 4 (assistant) + 31 -> 246 used,  -46 free  OVERFLOW\n" +
        "turn 5 (user     ) + 20 -> 266 used,  -66 free  OVERFLOW",
    },
    {
      kind: "p",
      text:
        "Three quarters of this window was spent before the conversation started, and it ran out on the " +
        "third turn. That is not a contrived example — it is precisely the failure mode of an agent given " +
        "a dozen chatty tool definitions and a two-page system prompt. And notice that the overhead is " +
        "paid *again on every turn*, because the model is stateless: turn five does not send twenty tokens, " +
        "it sends all 266.",
    },
    {
      kind: "viz",
      title: "A conversation growing against a fixed window",
      caption: "Each frame is one turn. Nothing accumulates in the model — the whole bar is re-sent every time.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: "system 42", state: "done" },
              { value: "tools 68", state: "done" },
              { value: "reserve 40", state: "done" },
            ],
            note: "Before anybody has said anything: 150 of 200 tokens are already committed. 50 free.",
          },
          {
            cells: [
              { value: "system 42", state: "done" },
              { value: "tools 68", state: "done" },
              { value: "reserve 40", state: "done" },
              { value: "user 18", state: "active" },
            ],
            note: "Turn 1. 168 used, 32 free. This whole bar is what gets sent.",
          },
          {
            cells: [
              { value: "system 42", state: "done" },
              { value: "tools 68", state: "done" },
              { value: "reserve 40", state: "done" },
              { value: "user 18" },
              { value: "asst 25", state: "active" },
            ],
            note: "Turn 2. 193 used, 7 free. The model's own reply is now part of what must be re-sent next time.",
          },
          {
            cells: [
              { value: "system 42", state: "done" },
              { value: "tools 68", state: "done" },
              { value: "reserve 40", state: "done" },
              { value: "user 18", state: "compare" },
              { value: "asst 25" },
              { value: "user 22", state: "swap" },
            ],
            note: "Turn 3 does not fit. Something has to go, and the usual answer is the oldest turn — which is often where the user stated the actual goal.",
          },
        ],
      },
    },
    { kind: "h", text: "A bigger window is not the same as a bigger memory" },
    {
      kind: "p",
      text:
        "Windows have grown enormously, and the natural conclusion — \"so just put everything in\" — is " +
        "wrong for a reason worth knowing. In *Lost in the Middle: How Language Models Use Long Contexts* " +
        "(arXiv:2307.03172), Liu and colleagues put the same relevant document at different positions in a " +
        "long context and measured how often the model used it. The result is a **U-shape**: performance " +
        "is highest when the relevant information is at the very beginning or the very end of the input, " +
        "and degrades significantly when the model has to reach for something in the middle. They found " +
        "this on multi-document question answering and on key-value retrieval, and — the part that matters " +
        "for planning — it held even for models explicitly built for long contexts.",
    },
    {
      kind: "concept",
      title: "Lost in the middle",
      text:
        "A measured tendency for models to use information at the start and end of a long input far better " +
        "than information buried in the middle (Liu et al., arXiv:2307.03172). Practically: *where* you " +
        "put something in the context is a design decision, not a formatting detail. Put the instruction " +
        "and the most important evidence at the edges, and do not assume that a document merely being " +
        "inside the window means it is being read.",
    },
    {
      kind: "steps",
      title: "What to do with a window instead of just filling it",
      steps: [
        {
          label: "Count it",
          text: "Know your fixed overhead — system prompt, tool definitions, reply reserve — before you plan what else fits.",
        },
        {
          label: "Retrieve, don't paste",
          text: "Fetch the few passages that are actually relevant rather than the whole document. That is retrieval, and it gets a whole module of this course.",
        },
        {
          label: "Place deliberately",
          text: "Instructions and the most important evidence go at the edges, not buried mid-way through a wall of pasted text.",
        },
        {
          label: "Summarise the past",
          text: "When history overflows, replace old turns with a short summary you generated on purpose, rather than letting them silently fall off the end.",
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "This keeps the newest turns that fit and drops the rest. Change `fixed` to 100 and re-run — notice how much more history survives when the tool definitions get shorter.",
      starter:
        "WINDOW = 200\n" +
        "fixed = 150  # system prompt + tools + room to reply\n" +
        'turns = [("user", 18), ("assistant", 25), ("user", 22), ("assistant", 31), ("user", 20)]\n' +
        "\n" +
        "\n" +
        "def fit(turns, budget):\n" +
        '    """Keep the most recent turns that fit. The oldest ones simply stop existing."""\n' +
        "    kept = []\n" +
        "    used = 0\n" +
        "    for role, size in reversed(turns):\n" +
        "        if used + size > budget:\n" +
        "            break\n" +
        "        kept.append((role, size))\n" +
        "        used += size\n" +
        "    return list(reversed(kept)), used\n" +
        "\n" +
        "\n" +
        "budget = WINDOW - fixed\n" +
        "kept, used = fit(turns, budget)\n" +
        'print(f"budget for history: {budget} tokens")\n' +
        'print(f"kept {len(kept)} of {len(turns)} turns, using {used}")\n' +
        'print("kept:   ", kept)\n' +
        'print("dropped:", turns[: len(turns) - len(kept)])\n',
      expectedOutput:
        "budget for history: 50 tokens\n" +
        "kept 1 of 5 turns, using 20\n" +
        "kept:    [('user', 20)]\n" +
        "dropped: [('user', 18), ('assistant', 25), ('user', 22), ('assistant', 31)]",
    },
    {
      kind: "compare",
      title: "Two completely different things people both call \"what the model knows\"",
      columns: [
        {
          label: "Training (baked in)",
          items: [
            "Fixed when the model was trained — you cannot add to it",
            "General: language, code, widely-published facts",
            "Has a cutoff date, after which it knows nothing",
            "Costs nothing per call, because it is already in the weights",
            "Cannot be corrected by telling the model it is wrong",
          ],
        },
        {
          label: "Context (sent on every call)",
          items: [
            "Chosen by you, per call — this is the only lever you have",
            "Specific: this user, this order, today's price, this document",
            "Vanishes completely the moment the call ends",
            "Costs tokens every turn, and every turn re-sends all of it",
            "Overrides what the model would otherwise have guessed — which is the whole point",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Believing the model remembers the conversation — it does not, and the moment you build your own loop rather than using a chat product, you are the one who has to re-send the history.",
        "Measuring the window against your pasted text alone — the system prompt, every tool definition and the reserved reply space come out of the same budget first.",
        "Pasting an entire document because it fits — fitting is not reading, and the lost-in-the-middle result says the middle of a long paste is the worst place to put something you need.",
        "Letting old turns silently fall off the end — the first message is usually where the user stated the goal, so dropping it is how an agent ends up cheerfully solving the wrong problem.",
        "Treating a bigger window as free — it is paid for in money and in latency on every single turn, because the whole context is processed each time.",
      ],
    },
    {
      kind: "remember",
      items: [
        "The model is stateless. Every call re-sends the entire context from the top.",
        "The window holds the system prompt, tool definitions, all history, the documents and the reply reserve — together.",
        "Information at the very start and very end of a long context is used better than information in the middle (arXiv:2307.03172).",
        "Managing context is not housekeeping; it is the main design job in building anything on a model.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Your chatbot forgets what the user said ten messages ago — what is happening and how do you fix it?\" is a standard question. The answer is context management: budget, summarise, retrieve.",
        "Expect to be pushed on cost. Saying that a long context is re-processed on every turn, so history is a recurring charge rather than a one-off, shows you have run something in production.",
        "Being able to name the lost-in-the-middle finding, and say what you do about it (place important content at the edges), separates reading about this from working with it.",
      ],
    },
    {
      kind: "quiz",
      question: "You send a 50-turn conversation to a model. How much of it does the model process on the final turn?",
      options: [
        "Only the last turn — the provider keeps the earlier turns cached inside the model between calls",
        "All 50 turns, plus the system prompt and tool definitions, from the top",
        "A summary of the earlier turns that the model maintains internally",
        "The last five turns, which is the standard window",
      ],
      answer: 1,
      why:
        "The model holds no state between calls. Everything it is expected to take into account has to be " +
        "in the context of *this* call — which is why long conversations get slower and more expensive as they go.",
    },
    {
      kind: "quiz",
      question:
        "You paste a 40-page contract and ask one question about a clause halfway through. Based on the lost-in-the-middle finding, what is the most likely problem?",
      options: [
        "The model will refuse, because the input is too long",
        "The clause is in the window but in the position the model uses least well",
        "The model will read the middle most carefully, since that is where the content is densest",
        "Nothing — if it fits in the window, it is used equally well",
      ],
      answer: 1,
      why:
        "Liu et al. measured a U-shape: information at the beginning and end of a long input is used best, " +
        "and performance degrades significantly for information in the middle — including in long-context models. " +
        "Retrieving the relevant clause and putting it near an edge beats pasting all 40 pages.",
    },
    {
      kind: "quiz",
      question: "Which of these actually reduces the tokens spent on *every* turn of an agent loop?",
      options: [
        "Asking the model to be concise in its replies",
        "Shortening the tool definitions and the system prompt",
        "Switching to a model with a much bigger context window than before",
        "Sending the conversation in reverse order",
      ],
      answer: 1,
      why:
        "The system prompt and tool definitions are fixed overhead re-sent on every single turn, so trimming " +
        "them pays back once per turn for the whole run. A bigger window does the opposite — it removes the " +
        "limit that was forcing you to be disciplined.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take a real chat you have had with an AI assistant and count the turns. Estimate what the last message actually cost to send, given that the whole history went with it.",
        "Set `fixed` in the playground to 100 and then to 180. At what point does the conversation become unable to hold even one turn of history?",
        "Write a system prompt for a support assistant in 200 words, then rewrite it in 60 without losing a rule. That difference is paid on every turn, forever.",
        "Find a document you would want a model to answer questions about. Decide which three paragraphs you would actually send, and where in the prompt you would put them.",
      ],
    },
  ],
};
