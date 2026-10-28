import type { Chapter } from "@/content/courses/types";

export const chapterOrchestratorWorkers: Chapter = {
  slug: "orchestrator-workers",
  title: "Orchestrator and Workers",
  summary:
    "Like parallelisation, except nobody wrote the list of subtasks in advance — a central call decides " +
    "them from the actual input. That flexibility is the feature, and the reason it is not a workflow.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Sectioning assumed you knew the subtasks: check for toxicity, check for personal data, write " +
        "the answer. Three boxes, drawn in advance. **Orchestrator-workers** is what you reach for when " +
        "you genuinely cannot draw them — when the number and nature of the subtasks depends on the " +
        "input in a way nobody can enumerate beforehand. A central call looks at the task, decides what " +
        "the subtasks are, hands them out, and combines the results.",
    },
    { kind: "h", text: "The picture: the foreman on a repair job" },
    {
      kind: "analogy",
      title: "The contractor who cannot quote until he has seen the damp",
      text:
        "You call someone about a damp patch on a wall. He cannot tell you in advance whether this is a " +
        "plumber for an hour, or a plumber and a plasterer and a painter over three days — he has to " +
        "come and look first. Once he has looked, he knows: plumber first, then the plasterer once it is " +
        "dry, and the painter is not needed because the wall is being re-tiled anyway. He assigns the " +
        "work, each tradesman does their part, and he checks the whole thing at the end. Nobody could " +
        "have written that list of three jobs before seeing the wall. Where the analogy stops: the " +
        "contractor is accountable if he assigns the wrong trades. Your orchestrator is a model call " +
        "that will confidently produce a plausible-looking list of subtasks whether or not it is the " +
        "right one, which is why the combining step has to check rather than just concatenate.",
    },
    {
      kind: "concept",
      title: "Orchestrator-workers",
      text:
        "A central LLM dynamically breaks a task down and delegates the pieces to worker LLMs, then " +
        "synthesises their results. Anthropic's guidance says it is well suited to complex tasks where " +
        "you cannot predict the subtasks needed, and names the key difference from parallelisation " +
        "directly: **flexibility — subtasks are not pre-defined, but determined by the orchestrator " +
        "based on the specific input**. Its examples are coding products making complex changes across " +
        "multiple files, and search tasks gathering information from several sources.",
    },
    { kind: "h", text: "The list nobody wrote in advance" },
    {
      kind: "code",
      caption:
        "An orchestrator deciding its own worker jobs from the actual repository contents. The orchestrator is a script, not a model — this course calls none — but the shape is exact.",
      code:
        "REPO = {\n" +
        '    "billing/refund.py":  ["calculate_refund", "issue_refund"],\n' +
        '    "billing/invoice.py": ["build_invoice"],\n' +
        '    "web/checkout.js":    ["renderTotal", "applyRefundBanner"],\n' +
        '    "docs/refunds.md":    [],\n' +
        "}\n" +
        "\n" +
        "\n" +
        "def orchestrator(task):\n" +
        '    """Looks at the actual input and decides what the workers will do."""\n' +
        '    if "refund" not in task.lower():\n' +
        "        return []\n" +
        "    jobs = []\n" +
        "    for path, symbols in REPO.items():\n" +
        '        touched = [s for s in symbols if "refund" in s.lower() or "Refund" in s]\n' +
        "        if touched:\n" +
        "            jobs.append((path, touched))\n" +
        '        elif "refund" in path.lower():\n' +
        '            jobs.append((path, ["prose"]))\n' +
        "    return jobs\n" +
        "\n" +
        "\n" +
        "def worker(path, symbols):\n" +
        '    return f"edited {path}: {\', \'.join(symbols)}"\n' +
        "\n" +
        "\n" +
        'task = "Rename the refund fee field and update everything that mentions it"\n' +
        "jobs = orchestrator(task)\n" +
        'print(f"task: {task}")\n' +
        'print(f"orchestrator decided on {len(jobs)} worker job(s) -- nobody wrote this list in advance\\n")\n' +
        "for path, symbols in jobs:\n" +
        '    print("  " + worker(path, symbols))\n' +
        "\n" +
        'print(f"\\ncalls: 1 orchestrator + {len(jobs)} workers + 1 to combine = {len(jobs) + 2}")\n',
      output:
        "task: Rename the refund fee field and update everything that mentions it\n" +
        "orchestrator decided on 3 worker job(s) -- nobody wrote this list in advance\n" +
        "\n" +
        "  edited billing/refund.py: calculate_refund, issue_refund\n" +
        "  edited web/checkout.js: applyRefundBanner\n" +
        "  edited docs/refunds.md: prose\n" +
        "\n" +
        "calls: 1 orchestrator + 3 workers + 1 to combine = 5",
    },
    {
      kind: "p",
      text:
        "Three jobs, and `billing/invoice.py` was left out — correctly, because nothing in it mentions " +
        "refunds. A different task on a different repository would have produced a different number of " +
        "jobs. That is the flexibility Anthropic points at, and it is also why this pattern sits on the " +
        "agent side of the line: the model, not your code, decided how many calls this request would " +
        "make. Which means your code has to decide how many it is *allowed* to make.",
    },
    {
      kind: "steps",
      title: "Running one safely",
      steps: [
        { label: "Cap the fan-out", text: "The orchestrator decides the number of workers, so your runtime decides the maximum. Without a cap, one badly-scoped task is fifty calls." },
        { label: "Give workers narrow tools", text: "A worker editing one file should not have a tool that can edit any file. Scope the capability to the job it was given." },
        { label: "Make workers independent", text: "If worker B needs worker A's output, this is a chain wearing a costume — and the fan-out will not actually run in parallel." },
        { label: "Check when combining", text: "The synthesis step is not concatenation. Did every worker succeed? Do their results contradict each other? Did one silently do nothing?" },
        { label: "Keep the trace", text: "Five or ten calls per request means debugging by reading. Log the plan, each worker's input and each worker's output, or you will never diagnose it." },
      ],
    },
    {
      kind: "compare",
      title: "Sectioning versus orchestrator-workers",
      columns: [
        {
          label: "Sectioning",
          items: [
            "You wrote the list of subtasks",
            "Fixed number of calls per request — predictable cost",
            "Each section has its own prompt, tuned and tested",
            "Cannot adapt: an input needing a fourth section does not get one",
            "A workflow: your code orchestrates through predefined paths",
          ],
        },
        {
          label: "Orchestrator-workers",
          items: [
            "The orchestrator decides the subtasks from the input",
            "Variable number of calls — you must cap the fan-out yourself",
            "Workers share a general prompt, parameterised by their assignment",
            "Adapts to inputs nobody anticipated, which is the entire point",
            "Agentic: the model decides how much work this request is",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add files to `repo` until the fan-out exceeds `MAX_WORKERS`. That cap is the only thing standing between one vague request and fifty calls.",
      starter:
        "MAX_WORKERS = 4\n" +
        "\n" +
        "repo = {\n" +
        '    "billing/refund.py": ["calculate_refund", "issue_refund"],\n' +
        '    "billing/invoice.py": ["build_invoice"],\n' +
        '    "web/checkout.js": ["renderTotal", "applyRefundBanner"],\n' +
        '    "docs/refunds.md": [],\n' +
        '    "tests/test_refund.py": ["test_refund_amount"],\n' +
        "}\n" +
        "\n" +
        'keyword = "refund"\n' +
        "\n" +
        "jobs = []\n" +
        "for path, symbols in repo.items():\n" +
        "    hits = [s for s in symbols if keyword in s.lower()]\n" +
        "    if hits or keyword in path.lower():\n" +
        '        jobs.append((path, hits or ["prose"]))\n' +
        "\n" +
        'print(f"orchestrator planned {len(jobs)} worker job(s)")\n' +
        "for path, hits in jobs[:MAX_WORKERS]:\n" +
        "    print(f\"  run    {path}: {', '.join(hits)}\")\n" +
        "for path, hits in jobs[MAX_WORKERS:]:\n" +
        '    print(f"  HELD   {path} -- over the cap of {MAX_WORKERS}")\n' +
        "\n" +
        "run = min(len(jobs), MAX_WORKERS)\n" +
        'print(f"\\ncalls this request: 1 + {run} + 1 = {run + 2}")\n',
      expectedOutput:
        "orchestrator planned 4 worker job(s)\n" +
        "  run    billing/refund.py: calculate_refund, issue_refund\n" +
        "  run    web/checkout.js: applyRefundBanner\n" +
        "  run    docs/refunds.md: prose\n" +
        "  run    tests/test_refund.py: test_refund_amount\n" +
        "\n" +
        "calls this request: 1 + 4 + 1 = 6",
    },
    {
      kind: "pitfall",
      items: [
        "No cap on the fan-out — the orchestrator decides how many workers there are, so one vague task becomes fifty calls and a bill nobody predicted.",
        "Giving every worker every tool — a worker assigned one file with a tool that can edit any file has the blast radius of the whole system.",
        "Concatenating worker outputs instead of checking them — two workers renaming the same thing differently produces a result that compiles nowhere.",
        "Using this when the subtasks are actually predictable — if you can write the list, write it; sectioning is cheaper, testable and has a fixed cost.",
        "Workers that depend on each other — that is a chain, and running it as a fan-out means each worker ran on incomplete information.",
        "Not logging the plan — with a variable number of calls per request, a trace you cannot read is a system you cannot debug.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Orchestrator-workers: a central call decides the subtasks from the input, workers do them, a final call combines.",
        "The difference from sectioning is flexibility — the subtasks are not pre-defined (Anthropic).",
        "Because the model decides how many calls happen, your runtime must cap the fan-out.",
        "Workers get narrow tools scoped to their assignment, not the whole toolbox.",
        "The combining step checks and reconciles. Concatenation is not synthesis.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"When would you use orchestrator-workers over just running things in parallel?\" — when you cannot know the subtasks in advance. Say it in those words.",
        "Expect a cost question, because this is the pattern with unbounded cost. A fan-out cap is what they are listening for.",
        "The synthesis step is where most candidates stop thinking. Saying what you would check when combining — contradictions, silent failures — is a differentiator.",
      ],
    },
    {
      kind: "quiz",
      question: "What distinguishes orchestrator-workers from parallelisation by sectioning?",
      options: [
        "It uses a larger number of different models, because each subtask is sent to its own specialised model",
        "The subtasks are determined by the orchestrator from the specific input, rather than being pre-defined",
        "It runs the subtasks sequentially",
        "It requires a vector database",
      ],
      answer: 1,
      why:
        "Anthropic names flexibility as the key difference in exactly those terms. Sectioning means you " +
        "wrote the list; here the orchestrator writes it, which is why the cost per request is variable.",
    },
    {
      kind: "quiz",
      question: "Why does this pattern need a fan-out cap when sectioning does not?",
      options: [
        "Workers are more expensive than sections, because each worker is always a larger model than any of the sections",
        "The number of calls is decided by the model, so without a cap one request can cost an unbounded amount",
        "Workers run for longer",
        "The orchestrator retries automatically",
      ],
      answer: 1,
      why:
        "Sectioning has a fixed number of calls you chose. Here the orchestrator decides, which is the " +
        "same class of problem as an agent with no step limit — and the same fix: a limit in your runtime.",
    },
    {
      kind: "quiz",
      question: "Two workers edit overlapping code and rename the same field differently. Where should this be caught?",
      options: [
        "In the orchestrator, before the workers run",
        "In the synthesis step, which must reconcile rather than concatenate",
        "Nowhere — the model will resolve it",
        "In each worker, which should look at what the others did and change its own rename to match",
      ],
      answer: 1,
      why:
        "The orchestrator cannot know in advance that the workers will conflict, and the workers are " +
        "independent by design. The combining step is the only place with all the results in front of " +
        "it, which is why it has to check rather than glue.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Find a task in your work where the number of subtasks genuinely depends on the input. Then check whether you could enumerate them after all.",
        "Set the fan-out cap for that task and justify the number with a cost per request.",
        "Write down what the synthesis step must check. Start with \"did any worker silently do nothing?\"",
        "Decide the narrowest tool each worker needs. Anything broader is blast radius you did not need.",
      ],
    },
  ],
};
