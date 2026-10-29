import type { Chapter } from "@/content/courses/types";

export const chapterTheModelRemembersNothing: Chapter = {
  slug: "the-model-remembers-nothing",
  title: "The Model Remembers Nothing. You Do.",
  summary:
    "Memory in an agent is not a model feature — it is a list your code keeps and re-sends. Once you " +
    "see it that way, threads, sessions and checkpoints all stop being mysterious.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Chapter 3 said the model is stateless. Chapter 12 said the loop's history is its memory. This " +
        "chapter joins those two facts and follows them somewhere useful, because \"memory\" is the word " +
        "under which the largest amount of hand-waving in this field is currently filed. There is no " +
        "memory inside a model. There is a **list your code keeps**, a **decision about what goes into " +
        "the next call**, and — if you want anything to survive a restart — a **place you wrote it " +
        "down**. That is all of it. Every product feature called memory is one of those three.",
    },
    { kind: "h", text: "The picture: the doctor's file, not the doctor" },
    {
      kind: "analogy",
      title: "A locum who has never met you, and a folder that has",
      text:
        "You go to a clinic and a different doctor is on duty every time. Not one of them remembers you. " +
        "And yet the consultation works, because there is a folder with your name on it: previous " +
        "visits, what was prescribed, what you are allergic to. The doctor reads the folder, treats you, " +
        "and writes a new page into it. The continuity was never in anybody's head — it was in the " +
        "filing cabinet, and in the administrator who pulls the right folder. An agent works exactly " +
        "this way, and the interesting engineering is all in the administrator's job: which folder, how " +
        "much of it to hand over, what to write back, and what to shred. Where the analogy stops: a " +
        "folder handed to the wrong doctor is a visible mistake. A conversation history handed to the " +
        "wrong user's session is invisible until somebody reads their own chat and sees a stranger's " +
        "order number.",
    },
    {
      kind: "concept",
      title: "Thread",
      text:
        "A named conversation whose history is stored and reloaded. LangGraph's documentation puts it " +
        "plainly: a `thread_id` names a session, and the checkpointer stores state per thread, so " +
        "re-invoking with the same `thread_id` continues the same conversation while a new one starts " +
        "fresh. The OpenAI Agents SDK calls its equivalent primitive **Sessions** — \"a persistent " +
        "memory layer for maintaining working context\". Same idea, two names: an identifier, and a " +
        "store keyed by it.",
    },
    { kind: "h", text: "Memory, written out" },
    {
      kind: "code",
      caption: "A session object: store everything, send what fits. This is the whole of short-term memory. Plain Python, no model, no database.",
      code:
        '# The model remembers nothing. Whatever "remembers" is your code.\n' +
        "class Session:\n" +
        '    """One conversation thread. This is the whole of an agent\'s short-term memory."""\n' +
        "\n" +
        "    def __init__(self, thread_id, budget_tokens):\n" +
        "        self.thread_id = thread_id\n" +
        "        self.budget = budget_tokens\n" +
        "        self.turns = []\n" +
        "\n" +
        "    def add(self, role, text, tokens):\n" +
        '        self.turns.append({"role": role, "text": text, "tokens": tokens})\n' +
        "\n" +
        "    def context(self):\n" +
        '        """What actually gets sent: the newest turns that fit, oldest first."""\n' +
        "        kept, used = [], 0\n" +
        "        for turn in reversed(self.turns):\n" +
        '            if used + turn["tokens"] > self.budget:\n' +
        "                break\n" +
        "            kept.append(turn)\n" +
        '            used += turn["tokens"]\n' +
        "        return list(reversed(kept)), used\n" +
        "\n" +
        "\n" +
        'a = Session("thread-ravi", budget_tokens=120)\n' +
        'a.add("user", "My reset email never arrived.", 40)\n' +
        'a.add("assistant", "What address did you sign up with?", 35)\n' +
        'a.add("user", "ravi.k@example.com", 30)\n' +
        'a.add("assistant", "The address on file has a typo. Fixing it now.", 45)\n' +
        "\n" +
        "sent, used = a.context()\n" +
        'print(f"thread {a.thread_id}: {len(a.turns)} turns stored, {len(sent)} sent ({used}/{a.budget} tokens)")\n' +
        "for turn in sent:\n" +
        "    print(f\"  {turn['role']:9} {turn['text']}\")\n" +
        "\n" +
        'b = Session("thread-asha", budget_tokens=120)\n' +
        "sent_b, used_b = b.context()\n" +
        'print(f"\\nthread {b.thread_id}: {len(sent_b)} turns -- a different thread knows nothing about Ravi")\n',
      output:
        "thread thread-ravi: 4 turns stored, 3 sent (110/120 tokens)\n" +
        "  assistant What address did you sign up with?\n" +
        "  user      ravi.k@example.com\n" +
        "  assistant The address on file has a typo. Fixing it now.\n" +
        "\n" +
        "thread thread-asha: 0 turns -- a different thread knows nothing about Ravi",
    },
    {
      kind: "p",
      text:
        "Look at what fell off. Four turns were stored and three were sent — the one that dropped is " +
        "\"My reset email never arrived\", which is *the problem being solved*. This is the single most " +
        "common memory bug in real systems, and it is not exotic: the oldest turn is usually where the " +
        "user stated the goal, and a newest-first budget drops it first. An agent that has forgotten why " +
        "it is here does not stop; it carries on, plausibly, on whatever is left.",
    },
    { kind: "h", text: "Four kinds of memory, and only one of them is the model's" },
    {
      kind: "table",
      head: ["What people call it", "Where it actually lives", "How long it lasts", "What it costs"],
      rows: [
        [
          "\"The model knows\"",
          "The weights, fixed at training time",
          "Forever, and you cannot add to it",
          "Nothing per call — it is already in the model",
        ],
        [
          "Working memory",
          "The message list your code builds for this call",
          "One call. It is rebuilt every turn.",
          "Tokens, on every single turn, for everything in it",
        ],
        [
          "Session or thread memory",
          "A store keyed by a thread id, on your side",
          "As long as you keep the row",
          "Storage, plus whatever slice of it you re-send",
        ],
        [
          "Long-term memory",
          "A database, a document store, a vector index",
          "Until deleted — which means it is personal data",
          "Storage, retrieval, and a retention and deletion policy",
        ],
      ],
    },
    {
      kind: "p",
      text:
        "The bottom row is where the engineering gets serious and where this codebase's own rules bite. " +
        "A conversation you persist is a record of what somebody said, so it needs an owner column, " +
        "row-level security, and a deletion path that actually deletes. \"We remember your preferences\" " +
        "is a storage decision with a privacy consequence, not a model capability.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Raise `budget` until the first turn survives. Then try `keep_first=True` — pinning the goal turn costs a few tokens and stops the agent forgetting why it is here.",
      starter:
        "turns = [\n" +
        '    ("user", "My reset email never arrived.", 40),\n' +
        '    ("assistant", "What address did you sign up with?", 35),\n' +
        '    ("user", "ravi.k@example.com", 30),\n' +
        '    ("assistant", "The address on file has a typo. Fixing it now.", 45),\n' +
        "]\n" +
        "\n" +
        "budget = 120\n" +
        "keep_first = False\n" +
        "\n" +
        "\n" +
        "def fit(turns, budget, keep_first):\n" +
        "    pinned = [turns[0]] if keep_first else []\n" +
        "    used = sum(t[2] for t in pinned)\n" +
        "    rest = turns[1:] if keep_first else turns\n" +
        "    kept = []\n" +
        "    for turn in reversed(rest):\n" +
        "        if used + turn[2] > budget:\n" +
        "            break\n" +
        "        kept.append(turn)\n" +
        "        used += turn[2]\n" +
        "    return pinned + list(reversed(kept)), used\n" +
        "\n" +
        "\n" +
        "sent, used = fit(turns, budget, keep_first)\n" +
        'print(f"{len(sent)} of {len(turns)} turns sent, {used}/{budget} tokens")\n' +
        "for role, text, _ in sent:\n" +
        '    print(f"  {role:9} {text}")\n' +
        "\n" +
        "dropped = [t for t in turns if t not in sent]\n" +
        "if dropped:\n" +
        '    print("\\ndropped:")\n' +
        "    for role, text, _ in dropped:\n" +
        '        print(f"  {role:9} {text}")\n',
      expectedOutput:
        "3 of 4 turns sent, 110/120 tokens\n" +
        "  assistant What address did you sign up with?\n" +
        "  user      ravi.k@example.com\n" +
        "  assistant The address on file has a typo. Fixing it now.\n" +
        "\n" +
        "dropped:\n" +
        "  user      My reset email never arrived.",
    },
    { kind: "h", text: "Where the checkpoint goes" },
    {
      kind: "p",
      text:
        "If a run can be interrupted — by an error, by a human approval step, by the process restarting " +
        "— the state has to be written down somewhere durable. LangGraph's answer is a **checkpointer**, " +
        "and its documentation is specific about the granularity: checkpoints are saved at super-step " +
        "boundaries, not mid-function inside a node, and if execution stops and later resumes — for " +
        "example after an interrupt or a retry — the affected node runs again from the start of its " +
        "function. That detail matters far more than it sounds. **A node that is re-run from the start " +
        "will re-do whatever it already did**, so any side effect inside it — an email sent, a refund " +
        "issued — can happen twice unless it is made idempotent or moved outside.",
    },
    {
      kind: "compare",
      title: "Two things both called \"memory\"",
      columns: [
        {
          label: "The transcript",
          items: [
            "What was said, turn by turn, in order",
            "Grows every turn and is re-sent every turn",
            "Overflows, and drops the oldest first — usually the goal",
            "Belongs to one thread and must never cross into another",
          ],
        },
        {
          label: "The facts",
          items: [
            "What was learned: the user's city, the corrected email, the chosen plan",
            "Small, and worth keeping long after the conversation ends",
            "Should be written down deliberately, not left to survive by accident in the transcript",
            "Personal data: needs an owner, access control and a deletion path",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Letting the oldest turn fall off the end — that is usually where the user stated the goal, and an agent that has forgotten the goal carries on plausibly instead of stopping.",
        "Keying sessions by something guessable or shared — a thread id that is not scoped to an authenticated user is how one person's conversation ends up in another's window.",
        "Storing the whole transcript for ever because it is easier — it is personal data, so it needs an owner, row-level security and deletion that actually deletes the rows.",
        "Confusing the transcript with the facts — re-reading eight turns to recover \"the corrected email is ravi.k@example.com\" is expensive; write the fact down once instead.",
        "Assuming a resumed run picks up mid-node — LangGraph re-runs the affected node from the start of its function, so a side effect inside it can happen twice.",
      ],
    },
    {
      kind: "remember",
      items: [
        "There is no memory in the model. There is a list your code keeps, a decision about what to send, and a place you wrote things down.",
        "A thread id names a conversation; a checkpointer or session store keeps its state. Same primitive, different names across frameworks.",
        "Working memory is rebuilt every turn and costs tokens every turn. Storage is cheap; re-sending is not.",
        "Keep the goal turn pinned. The default newest-first budget drops it first.",
        "Persisted conversations are personal data — owner, access control, deletion.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How does an AI assistant remember the conversation?\" sounds basic and catches people out. The answer is that it does not; your code re-sends the history.",
        "Expect a follow-up on long conversations. Budgeting, pinning the goal and summarising the middle is the practical answer.",
        "Mentioning that persisted transcripts are personal data — with an owner, access control and a deletion path — is the answer that gets you taken seriously on anything customer-facing.",
      ],
    },
    {
      kind: "quiz",
      question: "Your assistant forgets the user's original request after ten turns. What is happening?",
      options: [
        "The model's memory is degrading over time, because long conversations wear out the weights it uses to remember",
        "The oldest turns are being dropped to fit the budget, and the first turn is where the goal was stated",
        "The temperature is too high",
        "The session store is corrupt",
      ],
      answer: 1,
      why:
        "A newest-first budget drops the oldest turn first, and that is almost always the one containing " +
        "the goal. Pinning the first user turn, or summarising it into a system line, costs a few tokens " +
        "and fixes it.",
    },
    {
      kind: "quiz",
      question: "In LangGraph, what does re-invoking a graph with the same `thread_id` do?",
      options: [
        "Starts a fresh conversation, because the same id is treated as a duplicate and the stored state is discarded",
        "Continues the same conversation, because the checkpointer stores state per thread",
        "Replays every previous turn through the model again",
        "Nothing — thread_id is only used for logging",
      ],
      answer: 1,
      why:
        "The docs are explicit: `thread_id` names a session, state is stored per thread, and a new " +
        "`thread_id` starts fresh. It is the same primitive the OpenAI Agents SDK calls a Session.",
    },
    {
      kind: "quiz",
      question: "A node in your graph sends an email, then the run is interrupted and later resumed. What should you assume?",
      options: [
        "The node resumes exactly where it stopped, so the email is sent once",
        "The node runs again from the start of its function, so the email can be sent twice unless it is idempotent",
        "The framework detects and skips completed side effects automatically",
        "Interrupted runs are discarded entirely, so the email is never sent and the run must be started again",
      ],
      answer: 1,
      why:
        "Checkpoints are saved at super-step boundaries, not mid-function. A resumed node starts from " +
        "the top, which is why side effects need idempotency keys or need to live outside the node.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Set `keep_first=True` in the playground and work out what pinning the goal turn costs per turn, for a twenty-turn conversation.",
        "Take a conversation you have had with an assistant and list the three facts worth storing separately from the transcript.",
        "Write the deletion story for a stored conversation: what rows go, what storage objects go, and how you would prove it.",
        "Find a side effect in code you know that would be unsafe to run twice, and write down how you would make it idempotent.",
      ],
    },
  ],
};
