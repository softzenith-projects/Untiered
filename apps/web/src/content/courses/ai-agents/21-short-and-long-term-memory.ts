import type { Chapter } from "@/content/courses/types";

export const chapterShortAndLongTermMemory: Chapter = {
  slug: "short-and-long-term-memory",
  title: "Short-Term and Long-Term Memory",
  summary:
    "The transcript overflows and the facts survive. Deciding what to summarise, what to write down, " +
    "and what never to store at all is a design job — and a privacy one.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Two chapters ago the model remembered nothing and your code kept a list. Since then the list " +
        "has grown, and it is now the most expensive thing in every call. This chapter is about the two " +
        "decisions that follow: what to do when the transcript no longer fits, and what — separately, " +
        "deliberately, and with consequences — to write down for next time.",
    },
    { kind: "h", text: "The picture: the notebook and the file" },
    {
      kind: "analogy",
      title: "What a good receptionist keeps, and what she throws away",
      text:
        "A clinic receptionist takes notes all day on a pad: who called, what they wanted, who she " +
        "transferred them to. At the end of the day the pad goes in the bin — but three things from it " +
        "do not. Mrs Shah's new phone number goes into her file. The fact that the second-floor lift is " +
        "broken goes on the noticeboard. And the fact that someone read out their card number over the " +
        "phone goes nowhere at all, because she was trained never to write that down. Three different " +
        "fates for three kinds of information, decided by someone who thought about it once and then " +
        "applied the rule every day. An agent needs the same three. Where the analogy stops: the " +
        "receptionist's pad genuinely goes in the bin. A transcript sitting in a database goes nowhere " +
        "unless somebody wrote the deletion.",
    },
    { kind: "h", text: "When the transcript overflows" },
    {
      kind: "p",
      text:
        "The default behaviour — drop the oldest turns until it fits — is the worst option, because the " +
        "oldest turn is where the goal was. The alternative costs a few tokens and is strictly better: " +
        "**replace what you are about to lose with a short summary of it**, produced on purpose, and " +
        "carry that forward instead.",
    },
    {
      kind: "code",
      caption: "Dropping versus summarising, on the same conversation and the same budget. Plain Python; the summary is built by joining the dropped turns rather than by calling a model.",
      code:
        "turns = [\n" +
        '    ("user", "My reset email never arrived.", 40),\n' +
        '    ("assistant", "What address did you sign up with?", 35),\n' +
        '    ("user", "ravi.k@example.com", 30),\n' +
        '    ("assistant", "The address on file is ravi.k@exampel.com -- a typo.", 50),\n' +
        '    ("assistant", "Corrected it and resent. Delivered at 09:12.", 45),\n' +
        '    ("user", "Got it, thanks. Can you also change my phone number?", 55),\n' +
        "]\n" +
        "\n" +
        "BUDGET = 120\n" +
        "SUMMARY_COST = 30\n" +
        "\n" +
        "\n" +
        "def naive(turns, budget):\n" +
        "    kept, used = [], 0\n" +
        "    for t in reversed(turns):\n" +
        "        if used + t[2] > budget:\n" +
        "            break\n" +
        "        kept.append(t)\n" +
        "        used += t[2]\n" +
        "    return list(reversed(kept)), used, None\n" +
        "\n" +
        "\n" +
        "def with_summary(turns, budget, summary_cost):\n" +
        "    kept, used = [], summary_cost\n" +
        "    for t in reversed(turns):\n" +
        "        if used + t[2] > budget:\n" +
        "            break\n" +
        "        kept.append(t)\n" +
        "        used += t[2]\n" +
        "    dropped = turns[: len(turns) - len(kept)]\n" +
        '    facts = "; ".join(text for _, text, _ in dropped)\n' +
        "    return list(reversed(kept)), used, facts\n" +
        "\n" +
        "\n" +
        'for label, fn in [("drop the oldest", naive), ("summarise the oldest", None)]:\n' +
        "    if fn:\n" +
        "        kept, used, summary = fn(turns, BUDGET)\n" +
        "    else:\n" +
        "        kept, used, summary = with_summary(turns, BUDGET, SUMMARY_COST)\n" +
        '    print(f"{label}: {len(kept)} of {len(turns)} turns, {used}/{BUDGET} tokens")\n' +
        "    if summary is not None:\n" +
        "        print(f\"  summary ({SUMMARY_COST} tokens): {summary[:90]}...\")\n" +
        "    for role, text, _ in kept:\n" +
        '        print(f"  {role:9} {text}")\n' +
        "    print()\n",
      output:
        "drop the oldest: 2 of 6 turns, 100/120 tokens\n" +
        "  assistant Corrected it and resent. Delivered at 09:12.\n" +
        "  user      Got it, thanks. Can you also change my phone number?\n" +
        "\n" +
        "summarise the oldest: 1 of 6 turns, 85/120 tokens\n" +
        "  summary (30 tokens): My reset email never arrived.; What address did you sign up with?; ravi.k@example.com; The...\n" +
        "  user      Got it, thanks. Can you also change my phone number?",
    },
    {
      kind: "p",
      text:
        "The honest comparison is that summarising kept fewer *turns* — it paid 30 tokens for the " +
        "summary — but it kept the *thread*. In the dropped version, an assistant asked \"can you also " +
        "change my phone number?\" has no idea who this is, what the original problem was, or that the " +
        "email was just corrected. In the summarised version it has all three, in one line. Summarising " +
        "is not free and it is not lossless. It is a deliberate choice about *which* information " +
        "survives, made by you instead of by an arithmetic accident.",
    },
    {
      kind: "concept",
      title: "Summarisation checkpoint",
      text:
        "A point in a long conversation where the older turns are replaced by a written summary that is " +
        "carried forward in their place. Two rules make it work. Summarise **towards the goal** — the " +
        "summary must keep the original request, any decisions made, and any facts discovered. And " +
        "summarise **once and keep the result**, rather than re-summarising the summary every turn, " +
        "which loses a little more each time and costs a call each time.",
    },
    { kind: "h", text: "What to write down, and what never to" },
    {
      kind: "p",
      text:
        "Long-term memory is where the product features live — remembering a preference, a correction, " +
        "a name — and it is where this stops being an engineering question. Anything you write down " +
        "about a person is personal data. It needs an owner, access control, a retention period, and a " +
        "deletion path that removes the rows and any storage objects with them. The useful habit is to " +
        "decide these four things at the moment you decide to store something, not afterwards.",
    },
    {
      kind: "code",
      caption: "A retention review, as a small table with a rule per fact. Plain Python — this is a design artefact, not a library.",
      code:
        "FACTS = [\n" +
        '    {"owner": "user-2290", "key": "preferred_language", "value": "Marathi", "keep_days": 365, "sensitive": False},\n' +
        '    {"owner": "user-2290", "key": "email", "value": "ravi.k@example.com", "keep_days": 365, "sensitive": True},\n' +
        '    {"owner": "user-2290", "key": "card_last4", "value": "4412", "keep_days": 0, "sensitive": True},\n' +
        '    {"owner": "user-2290", "key": "last_complaint", "value": "reset email bounced", "keep_days": 90, "sensitive": False},\n' +
        "]\n" +
        "\n" +
        "\n" +
        "def review(facts):\n" +
        "    for f in facts:\n" +
        '        if f["keep_days"] == 0:\n' +
        '            verdict = "DO NOT STORE -- fetch it from the source system when needed"\n' +
        '        elif f["sensitive"]:\n' +
        "            verdict = f\"store {f['keep_days']}d, encrypted, deleted with the account\"\n" +
        "        else:\n" +
        "            verdict = f\"store {f['keep_days']}d\"\n" +
        "        print(f\"{f['key']:20} {verdict}\")\n" +
        "\n" +
        "\n" +
        "review(FACTS)\n" +
        "print()\n" +
        'print("Deleting the account must delete every row above, not just the login.")\n',
      output:
        "preferred_language   store 365d\n" +
        "email                store 365d, encrypted, deleted with the account\n" +
        "card_last4           DO NOT STORE -- fetch it from the source system when needed\n" +
        "last_complaint       store 90d\n" +
        "\n" +
        "Deleting the account must delete every row above, not just the login.",
    },
    {
      kind: "compare",
      title: "Three fates for a piece of information",
      columns: [
        {
          label: "Keep in the transcript",
          items: [
            "Needed for this conversation to make sense and nothing beyond it",
            "Costs tokens on every remaining turn",
            "Disappears when the conversation ends, which is usually correct",
          ],
        },
        {
          label: "Write down as a fact",
          items: [
            "Useful next week: a preference, a correction, a decision",
            "Cheap to store, cheap to look up, small in the prompt",
            "Personal data: needs an owner, access control, a retention period and a deletion path",
          ],
        },
        {
          label: "Never store",
          items: [
            "Card numbers, passwords, one-time codes, anything you would not want in a log",
            "Fetch it from the source system at the moment it is needed, or do not have it",
            "Cheapest of all, because the thing you never stored cannot leak",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add a fact of your own to `candidates` and make the rule decide. Anything your rule cannot classify is a design decision you have not made yet.",
      starter:
        "NEVER = {\"card number\", \"cvv\", \"password\", \"otp\", \"aadhaar\", \"passport number\"}\n" +
        'SHORT = {"current mood", "what they typed in the search box", "which page they were on"}\n' +
        "\n" +
        "candidates = [\n" +
        '    "preferred language",\n' +
        '    "card number",\n' +
        '    "the corrected email address",\n' +
        '    "current mood",\n' +
        '    "the plan they chose",\n' +
        '    "otp",\n' +
        "]\n" +
        "\n" +
        "for item in candidates:\n" +
        "    if item in NEVER:\n" +
        '        print(f"{item:32} NEVER STORE -- fetch from the source at the moment of use")\n' +
        "    elif item in SHORT:\n" +
        '        print(f"{item:32} transcript only -- gone when the conversation ends")\n' +
        "    else:\n" +
        '        print(f"{item:32} store as a fact -- owner, retention, deletion path")\n',
      expectedOutput:
        "preferred language               store as a fact -- owner, retention, deletion path\n" +
        "card number                      NEVER STORE -- fetch from the source at the moment of use\n" +
        "the corrected email address      store as a fact -- owner, retention, deletion path\n" +
        "current mood                     transcript only -- gone when the conversation ends\n" +
        "the plan they chose              store as a fact -- owner, retention, deletion path\n" +
        "otp                              NEVER STORE -- fetch from the source at the moment of use",
    },
    {
      kind: "pitfall",
      items: [
        "Letting the window decide what to forget — the oldest turn is the goal, and losing it silently is how an agent ends up cheerfully answering a question nobody asked.",
        "Re-summarising the summary every turn — each pass loses a little more and costs a call, and after ten turns the goal has been through a photocopier ten times.",
        "Storing the whole transcript as \"memory\" — it is the most expensive and least useful form of long-term memory, and the largest privacy liability you could choose.",
        "Storing a fact with no owner column — you cannot apply access control to a row that does not say whose it is, and you cannot delete it on request either.",
        "Deleting the login and calling it account deletion — the stored facts, the transcripts and any uploaded objects have to go too.",
        "Remembering something the user did not ask you to remember — \"we noticed you prefer window seats\" is delightful until it is a preference they did not want recorded.",
      ],
    },
    {
      kind: "remember",
      items: [
        "When history overflows, summarise deliberately rather than letting the oldest turn fall off the end.",
        "Summarise towards the goal — keep the original request, the decisions and the facts discovered.",
        "Summarise once and carry the result. Re-summarising a summary loses a little more every time.",
        "Separate the transcript from the facts. The transcript is expensive and temporary; a fact is small and worth keeping.",
        "Every stored fact needs an owner, access control, a retention period and a deletion path. Some facts should never be stored at all.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How would you handle a very long conversation?\" — budget, pin the goal, summarise the middle once. The word \"once\" is what shows you have done it.",
        "Expect a privacy follow-up on anything user-facing. Owner column, retention, deletion that removes rows and objects.",
        "\"What would you refuse to store?\" is a question with a right answer, and giving it confidently is a good sign in any interview touching customer data.",
      ],
    },
    {
      kind: "quiz",
      question: "Your assistant summarises the conversation every turn, summarising the previous summary each time. What goes wrong?",
      options: [
        "Nothing goes wrong — this keeps the context small, and each pass makes the summary a little more accurate than before",
        "Detail is lost a little more on every pass, and you pay for a summarisation call every turn",
        "The summary grows without bound",
        "The model refuses after a few iterations",
      ],
      answer: 1,
      why:
        "Each summarisation is lossy, so repeated passes compound the loss — and each one is a call you " +
        "paid for. Summarise at a checkpoint, keep the result, and carry it forward unchanged.",
    },
    {
      kind: "quiz",
      question: "Which of these belongs in long-term storage rather than the transcript?",
      options: [
        "The user's current question, since it is the most important thing to remember for next time",
        "The corrected email address you established this session",
        "Which page of the help centre they were reading",
        "The one-time code they just typed",
      ],
      answer: 1,
      why:
        "A correction is a durable fact worth having next week. The question and the page are transcript " +
        "material, and a one-time code is in the never-store column — fetch or verify it at the moment " +
        "of use and keep nothing.",
    },
    {
      kind: "quiz",
      question: "What does a stored fact need besides its value?",
      options: [
        "A confidence score from the model",
        "An owner, access control, a retention period and a deletion path",
        "An embedding",
        "A timestamp, so that you can tell how old the fact is — nothing more is needed",
      ],
      answer: 1,
      why:
        "The moment you write something down about a person it is personal data. Without an owner column " +
        "you cannot apply row-level security and cannot honour a deletion request — and deletion has to " +
        "remove the rows and any storage objects, not just the login.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Write the summarisation prompt for a support conversation. Which three things must survive, and what happens if one does not?",
        "Take a product you use that \"remembers\" something about you. Work out whether it is a transcript, a fact, or something it should not have stored.",
        "For an assistant you would build, list every fact you would store, with an owner, a retention period and a reason.",
        "Write the account-deletion checklist: which tables, which storage objects, and how you would demonstrate it worked.",
      ],
    },
  ],
};
