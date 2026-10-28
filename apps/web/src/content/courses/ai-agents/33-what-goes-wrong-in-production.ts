import type { Chapter } from "@/content/courses/types";

export const chapterWhatGoesWrongInProduction: Chapter = {
  slug: "what-goes-wrong-in-production",
  title: "What Actually Goes Wrong",
  summary:
    "The last chapter: the failures you will really meet, each traced back to where this course covered " +
    "it, and the checklist that separates a demo from something you can leave running.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Thirty-two chapters ago this course started with a deliberately unglamorous sentence: a " +
        "language model is a machine that predicts the next piece of text. Everything since has been " +
        "engineering around that — tools so it can find things out, a loop so it can act and see what " +
        "happened, retrieval so the facts are real, limits so it stops, and checks so you can tell " +
        "whether any of it worked. This last chapter is the list of things that go wrong when one of " +
        "those is missing, and it is deliberately a list of *your* failures rather than the model's.",
    },
    { kind: "h", text: "The picture: the car that passed the test drive" },
    {
      kind: "analogy",
      title: "A test drive is not a monsoon",
      text:
        "A car that drives beautifully round the block has been tested on dry tarmac, at low speed, by " +
        "somebody who wants it to work. It has not been tested at two in the morning in heavy rain with " +
        "a boot full of luggage and a pothole coming. Nobody thinks the test drive was dishonest; it " +
        "simply did not contain the conditions that break cars. A demo is a test drive. Production is " +
        "the monsoon: inputs nobody imagined, a database that times out, a user who pastes something " +
        "strange, and an adversary who read your blog post about the feature. Where the analogy stops: " +
        "a car failing in the rain is obvious to its driver. An agent failing in production produces a " +
        "confident, well-formatted, entirely wrong answer, and nobody finds out until a customer does.",
    },
    { kind: "h", text: "The failures, and where each one was covered" },
    {
      kind: "code",
      caption: "A symptom-to-cause table for the things that actually happen. Plain Python — this is a reference, printed.",
      code:
        "FAILURES = {\n" +
        '    "confident answer, nothing checked":    ("ch04 / ch19", "no tool, or no citation requirement"),\n' +
        '    "same call repeated until the limit":   ("ch15",        "error swallowed, observation never returned"),\n' +
        '    "action taken twice":                   ("ch17",        "resumed node re-ran, side effect not idempotent"),\n' +
        '    "bill 10x the estimate":                ("ch31",        "budgeted per call, not per run"),\n' +
        '    "answered from a chunk that inverted":  ("ch20",        "chunk boundary split a negation"),\n' +
        '    "did the job, then did it again":       ("ch14",        "no stopping condition"),\n' +
        '    "followed an instruction in a document":("ch32",        "indirect prompt injection"),\n' +
        '    "worked yesterday, worse today":        ("ch30",        "no evaluation set; nobody can say what changed"),\n' +
        "}\n" +
        "\n" +
        "width = max(len(k) for k in FAILURES)\n" +
        "for symptom, (where, cause) in FAILURES.items():\n" +
        '    print(f"{symptom:{width}}  {where:12} {cause}")\n',
      output:
        "confident answer, nothing checked      ch04 / ch19  no tool, or no citation requirement\n" +
        "same call repeated until the limit     ch15         error swallowed, observation never returned\n" +
        "action taken twice                     ch17         resumed node re-ran, side effect not idempotent\n" +
        "bill 10x the estimate                  ch31         budgeted per call, not per run\n" +
        "answered from a chunk that inverted    ch20         chunk boundary split a negation\n" +
        "did the job, then did it again         ch14         no stopping condition\n" +
        "followed an instruction in a document  ch32         indirect prompt injection\n" +
        "worked yesterday, worse today          ch30         no evaluation set; nobody can say what changed",
    },
    {
      kind: "p",
      text:
        "Notice what is not on that list: \"the model was not clever enough\". Every entry is a missing " +
        "piece of engineering around the model, and every one has a fix that does not depend on the " +
        "model improving. That is the most useful thing this course has to say, and it is why the " +
        "checklist below is short and boring and worth more than any prompt.",
    },
    {
      kind: "concept",
      title: "The demo-to-production gap",
      text:
        "A demo is run by somebody who wants it to work, on inputs they chose, once. Production is run " +
        "by people who do not care how it works, on inputs nobody imagined, thousands of times, while " +
        "a dependency is down and somebody is deliberately trying to break it. The gap is not closed by " +
        "a better model. It is closed by limits, approvals, evaluation and traces — the four things " +
        "nobody demos.",
    },
    { kind: "h", text: "The checklist" },
    {
      kind: "code",
      caption: "The readiness list, with the chapter each item came from. Change the flags to describe your own system.",
      code:
        "CHECKS = [\n" +
        '    ("A hard step limit, enforced in the runtime", "ch14", False),\n' +
        '    ("A separate budget for irreversible actions", "ch14", False),\n' +
        '    ("Tool errors returned to the model, not swallowed", "ch15", True),\n' +
        '    ("A human approves every irreversible action", "ch32", False),\n' +
        '    ("Tools scoped to this user and this record", "ch32", False),\n' +
        '    ("An evaluation set with refusal cases, run on every change", "ch30", False),\n' +
        '    ("A readable trace: prompt, calls, observations, steps, cost", "ch30", True),\n' +
        '    ("A defined behaviour when the limit is hit", "ch14", False),\n' +
        '    ("Untrusted content fenced and labelled as data", "ch32", True),\n' +
        '    ("Per-run cost and duration recorded", "ch31", False),\n' +
        "]\n" +
        "\n" +
        "done = [c for c in CHECKS if c[2]]\n" +
        "missing = [c for c in CHECKS if not c[2]]\n" +
        "\n" +
        'print(f"ready: {len(done)}/{len(CHECKS)}\\n")\n' +
        'print("still missing:")\n' +
        "for name, ref, _ in missing:\n" +
        '    print(f"  [ ] {name:58} ({ref})")\n' +
        "\n" +
        'blocking = [c for c in missing if c[1] in {"ch14", "ch32"}]\n' +
        'print(f"\\n{len(blocking)} of those are the kind that lose money or data, not just quality.")\n',
      output:
        "ready: 3/10\n" +
        "\n" +
        "still missing:\n" +
        "  [ ] A hard step limit, enforced in the runtime                 (ch14)\n" +
        "  [ ] A separate budget for irreversible actions                 (ch14)\n" +
        "  [ ] A human approves every irreversible action                 (ch32)\n" +
        "  [ ] Tools scoped to this user and this record                  (ch32)\n" +
        "  [ ] An evaluation set with refusal cases, run on every change  (ch30)\n" +
        "  [ ] A defined behaviour when the limit is hit                  (ch14)\n" +
        "  [ ] Per-run cost and duration recorded                         (ch31)\n" +
        "\n" +
        "5 of those are the kind that lose money or data, not just quality.",
    },
    { kind: "h", text: "How to ship one" },
    {
      kind: "steps",
      title: "The order that works",
      steps: [
        { label: "Start read-only", text: "Every tool is a read. The worst case is a wrong answer, which is survivable and which your evaluation set will catch." },
        { label: "Add writes behind a person", text: "The first write tool ships with an approval step showing the actual arguments. Watch what people approve and what they reject." },
        { label: "Narrow the approvals", text: "Auto-approve the cases the evidence says are always approved — a refund under a threshold, for a verified customer. Keep the rest gated." },
        { label: "Measure before you widen", text: "Each loosening is a change; run the evaluation set, watch the traces, and be willing to put the gate back." },
        { label: "Keep the kill switch", text: "One configuration flag that turns the agent off and falls back to the previous path. Somebody will need it at a bad time." },
      ],
    },
    {
      kind: "compare",
      title: "What to log, and what it answers",
      columns: [
        {
          label: "Per run",
          items: [
            "The full prompt, including the system prompt and the tool definitions as sent",
            "Every tool call with its arguments, and every observation returned",
            "Step count, whether a limit was hit, and how the run ended",
            "Input and output tokens, cost, and wall-clock duration",
            "Which prompt version and which model — you will change both",
          ],
        },
        {
          label: "It answers",
          items: [
            "\"Why did it say that?\" — from the observations it actually had",
            "\"Why did it cost that?\" — from the tokens, turn by turn",
            "\"When did this start?\" — from the version stamps",
            "\"How often does it refuse?\" — the number nobody measures and everybody should",
            "\"Which cases should join the evaluation set?\" — the ones that went wrong",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Set the flags to describe something you want to build. Anything still false in the ch14 or ch32 rows is a reason not to ship it yet.",
      starter:
        "checks = {\n" +
        '    "step limit in the runtime":            (False, "ch14"),\n' +
        '    "write budget, separate from steps":    (False, "ch14"),\n' +
        '    "defined behaviour at the limit":       (False, "ch14"),\n' +
        '    "human approves irreversible actions":  (False, "ch32"),\n' +
        '    "tools scoped to this user/record":     (False, "ch32"),\n' +
        '    "untrusted content fenced as data":     (False, "ch32"),\n' +
        '    "errors returned as observations":      (True,  "ch15"),\n' +
        '    "evaluation set with refusal cases":    (False, "ch30"),\n' +
        '    "readable per-run trace":               (False, "ch30"),\n' +
        '    "per-run cost and duration recorded":   (False, "ch31"),\n' +
        "}\n" +
        "\n" +
        'BLOCKING = {"ch14", "ch32"}\n' +
        "\n" +
        "blocking_gaps = []\n" +
        "for name, (ok, ref) in checks.items():\n" +
        '    mark = "x" if ok else " "\n' +
        "    if not ok and ref in BLOCKING:\n" +
        "        blocking_gaps.append(name)\n" +
        '    print(f"  [{mark}] {name:36} ({ref})")\n' +
        "\n" +
        "ready = sum(1 for ok, _ in checks.values() if ok)\n" +
        'print(f"\\n{ready}/{len(checks)} done.")\n' +
        "if blocking_gaps:\n" +
        '    print(f"Do not ship yet. {len(blocking_gaps)} gap(s) can lose money or data:")\n' +
        "    for g in blocking_gaps:\n" +
        '        print(f"  - {g}")\n' +
        "else:\n" +
        '    print("Nothing here can lose money or data. Ship it read-only and watch the traces.")\n',
      expectedOutput:
        "  [ ] step limit in the runtime            (ch14)\n" +
        "  [ ] write budget, separate from steps    (ch14)\n" +
        "  [ ] defined behaviour at the limit       (ch14)\n" +
        "  [ ] human approves irreversible actions  (ch32)\n" +
        "  [ ] tools scoped to this user/record     (ch32)\n" +
        "  [ ] untrusted content fenced as data     (ch32)\n" +
        "  [x] errors returned as observations      (ch15)\n" +
        "  [ ] evaluation set with refusal cases    (ch30)\n" +
        "  [ ] readable per-run trace               (ch30)\n" +
        "  [ ] per-run cost and duration recorded   (ch31)\n" +
        "\n" +
        "1/10 done.\n" +
        "Do not ship yet. 6 gap(s) can lose money or data:\n" +
        "  - step limit in the runtime\n" +
        "  - write budget, separate from steps\n" +
        "  - defined behaviour at the limit\n" +
        "  - human approves irreversible actions\n" +
        "  - tools scoped to this user/record\n" +
        "  - untrusted content fenced as data",
    },
    { kind: "h", text: "The thing worth carrying out of this course" },
    {
      kind: "p",
      text:
        "If one idea survives, let it be this. **A model produces text that is likely. Everything that " +
        "makes it trustworthy is something you built around it.** A tool that fetched the real number. " +
        "An observation that contradicted the guess. A citation somebody can check. A limit that stopped " +
        "the loop. A person who approved the refund. None of those is a property of the model, and none " +
        "of them arrives by using a better one. They are ordinary engineering, applied to a component " +
        "that is unusually fluent and unusually willing to sound certain — and that combination is " +
        "exactly why the ordinary engineering matters more here, not less.",
    },
    {
      kind: "pitfall",
      items: [
        "Shipping with write tools before shipping read-only — the read-only version teaches you what the agent actually does, at the price of a wrong answer instead of a wrong refund.",
        "No kill switch — one flag that turns the agent off and falls back is the cheapest insurance in the list, and it is always written after it was first needed.",
        "Logging the answer but not the observations — then \"why did it say that?\" is unanswerable, and every incident becomes a guess.",
        "Not measuring the refusal rate — a system that never says \"I don't know\" is not confident, it is unable to admit ignorance, and you cannot see that without counting.",
        "Treating each incident as a one-off — every production failure should become a case in the evaluation set the same day, or it will happen twice.",
        "Assuming the next model version is a free upgrade — it is a change, it changes behaviour, and it goes through the evaluation set like everything else.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Almost every production failure is a missing piece of engineering around the model, not a shortcoming of the model.",
        "Limits, approvals, evaluation and traces are the four things nobody demos and everybody needs.",
        "Ship read-only, then writes behind a person, then narrow the approvals with evidence.",
        "Log the whole run — prompt, calls, observations, steps, cost, versions — or incidents become guesswork.",
        "A model produces likely text. Everything that makes it trustworthy is something you built around it.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What would you watch after launching this?\" — limits hit, refusal rate, cost per run, and the traces of anything that went wrong. Most candidates say \"errors\".",
        "Describing the read-only-first rollout is a strong, concrete answer to \"how would you ship it safely?\".",
        "Being able to name a failure you have seen and trace it to the missing piece — rather than to the model — is the thing that marks out someone who has run one of these.",
      ],
    },
    {
      kind: "quiz",
      question: "Your agent gave a confident wrong answer in production. What do you need in order to find out why?",
      options: [
        "The answer it gave, together with the exact question the user typed and the version of the model that wrote it",
        "The full trace: the prompt as sent, every tool call with its arguments, and every observation returned",
        "The model version",
        "The user's original question",
      ],
      answer: 1,
      why:
        "The answer is the symptom. The cause is in what the agent could see and what it did — which " +
        "tools it called, what came back, and what was in its context when it decided. Without the " +
        "trace, every explanation is a guess.",
    },
    {
      kind: "quiz",
      question: "Which is the safest way to ship an agent with a refund tool?",
      options: [
        "Enable it for a small percentage of traffic and watch the metrics",
        "Ship read-only first, then add the refund tool behind a human approval that shows the real arguments",
        "Ship it to everyone with a strong system prompt warning it to be careful with refunds and to double-check each one",
        "Ship it and monitor for complaints",
      ],
      answer: 1,
      why:
        "Read-only limits the worst case to a wrong answer. The approval step then gives you evidence " +
        "about what the agent actually proposes, which is what you need before loosening anything. A " +
        "prompt warning is a request; the gate is enforced.",
    },
    {
      kind: "quiz",
      question: "What is the single idea this course would most like you to keep?",
      options: [
        "Bigger models solve most of these problems, so the best use of your effort is to wait for the next release",
        "A model produces likely text; everything that makes it trustworthy is engineering you built around it",
        "Agents should be preferred to workflows",
        "Prompt engineering is the main skill",
      ],
      answer: 1,
      why:
        "Every chapter has been a version of this. The tool, the observation, the citation, the limit " +
        "and the approval are all things outside the model — which is why they keep working when the " +
        "model does something you did not expect.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Fill in the readiness playground for something you want to build, honestly. Then fix the ch14 and ch32 rows first.",
        "Write the kill switch: what flag, who can flip it, and what the system does when it is off.",
        "Design your trace and check it answers \"why did it say that?\" for a run that went wrong.",
        "Pick one thing from this course you disagree with, work out why, and write down what you would do instead. That is the point of having read the sources.",
      ],
    },
  ],
};
