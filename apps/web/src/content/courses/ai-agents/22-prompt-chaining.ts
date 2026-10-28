import type { Chapter } from "@/content/courses/types";

export const chapterPromptChaining: Chapter = {
  slug: "prompt-chaining",
  title: "Prompt Chaining: One Call Becomes Several",
  summary:
    "Split a task into fixed steps, each one a separate call, with ordinary code checking between them. " +
    "The simplest pattern in the book, and the one that solves the most problems.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "The next five chapters are a catalogue of ways to use more than one model call. They come from " +
        "Anthropic's *Building Effective Agents*, which is the clearest published account of them, and " +
        "they are all — except the last — **workflows** by that piece's own definition: LLMs and tools " +
        "orchestrated through predefined code paths. Your code decides the order. That is not a " +
        "consolation prize; a workflow you can draw on a whiteboard is easier to test, cheaper to run " +
        "and far easier to debug than a loop deciding for itself. Start here.",
    },
    { kind: "h", text: "The picture: the tailor's fitting" },
    {
      kind: "analogy",
      title: "Nobody cuts the cloth before the measurements are checked",
      text:
        "A tailor making a suit does not do it in one motion. He takes measurements, then checks them " +
        "against the customer standing in front of him — chest 40 and sleeve 21 on a person that size, " +
        "does that look right? — and only then cuts. Then a rough basting, then another look, then the " +
        "finishing. Each stage is cheap to redo and the check between stages is what stops an expensive " +
        "mistake going further. If the measurements are obviously wrong, he does not cut the cloth and " +
        "find out later. That check between stages is the whole reason chaining beats one big prompt. " +
        "Where the analogy stops: the tailor's check is judgement. Yours should be code — a length, a " +
        "schema, a required field — because code costs nothing to run and never has an off day.",
    },
    {
      kind: "concept",
      title: "Prompt chaining",
      text:
        "Decomposing a task into a fixed sequence of steps, where each model call processes the output " +
        "of the previous one and your code can check the result before moving on. Anthropic's guidance " +
        "is that it is ideal when the task can be easily and cleanly decomposed into fixed subtasks, and " +
        "that the main goal is to **trade off latency for higher accuracy**. Its examples: generating " +
        "marketing copy and then translating it; writing an outline, checking it meets criteria, then " +
        "writing the full document.",
    },
    { kind: "h", text: "The gate is the point" },
    {
      kind: "p",
      text:
        "A chain without checks between the steps is just a long prompt split into pieces — and it is " +
        "slower and more expensive than the long prompt was. What makes chaining worth it is the " +
        "**gate**: a piece of ordinary code between two calls that looks at the intermediate result and " +
        "decides whether to continue. It is the cheapest quality control in this entire field, because " +
        "it runs in microseconds and costs nothing.",
    },
    {
      kind: "code",
      caption: "A two-step chain with a gate between. The steps are stubs — this course calls no model — but the gate is real and it really stops the chain.",
      code:
        "def step_outline(topic):\n" +
        '    return [f"{topic}: what it is", f"{topic}: how it works", f"{topic}: common mistakes"]\n' +
        "\n" +
        "\n" +
        "def gate_outline(outline):\n" +
        "    problems = []\n" +
        "    if len(outline) < 3:\n" +
        '        problems.append("fewer than 3 sections")\n' +
        '    if not any("mistake" in s for s in outline):\n' +
        '        problems.append("no section on mistakes")\n' +
        "    return problems\n" +
        "\n" +
        "\n" +
        "def step_draft(outline):\n" +
        '    return "\\n".join(f"## {s}\\n(one paragraph)" for s in outline)\n' +
        "\n" +
        "\n" +
        'for topic in ["Refund policy", "X"]:\n' +
        '    outline = step_outline(topic) if topic != "X" else ["X: what it is"]\n' +
        "    problems = gate_outline(outline)\n" +
        '    print(f"topic {topic!r}: outline has {len(outline)} section(s)")\n' +
        "    if problems:\n" +
        "        print(f\"  GATE FAILED: {'; '.join(problems)} -> stop, do not spend the second call\")\n" +
        "        continue\n" +
        '    print("  gate passed -> second call")\n' +
        '    print("  " + step_draft(outline).replace("\\n", "\\n  "))\n',
      output:
        "topic 'Refund policy': outline has 3 section(s)\n" +
        "  gate passed -> second call\n" +
        "  ## Refund policy: what it is\n" +
        "  (one paragraph)\n" +
        "  ## Refund policy: how it works\n" +
        "  (one paragraph)\n" +
        "  ## Refund policy: common mistakes\n" +
        "  (one paragraph)\n" +
        "topic 'X': outline has 1 section(s)\n" +
        "  GATE FAILED: fewer than 3 sections; no section on mistakes -> stop, do not spend the second call",
    },
    {
      kind: "steps",
      title: "Designing a chain",
      steps: [
        { label: "Cut where you can check", text: "The right place to split is wherever the intermediate result is something code can validate. If you cannot check it, splitting there buys nothing." },
        { label: "Make each step narrow", text: "One job per call. A step doing two things is a step whose failure you cannot localise." },
        { label: "Gate every join", text: "Schema, length, required fields, allowed values. The gate is free; the next call is not." },
        { label: "Decide the failure path", text: "When a gate fails: retry that step with the error, fall back, or stop and say so. Pick one per gate, in advance." },
        { label: "Count the latency", text: "Three steps is three round trips. Chaining buys accuracy with time, and somebody is waiting." },
      ],
    },
    {
      kind: "compare",
      title: "One big prompt versus a chain",
      columns: [
        {
          label: "One prompt does everything",
          items: [
            "One round trip — the fastest option there is",
            "Cheapest, if it works",
            "When it is wrong, you cannot tell which part went wrong",
            "No way to intervene halfway",
            "Instructions compete with each other inside one context",
          ],
        },
        {
          label: "A chain with gates",
          items: [
            "One round trip per step, so latency adds up",
            "A failing gate stops the chain before the expensive step",
            "You know exactly which step failed, from the gate that caught it",
            "A human or a rule can sit at any join",
            "Each call has one job and a context focused on it",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add a third gate rule — say, no section longer than 40 characters — and watch which topics stop passing. Gates are where your quality standard actually lives.",
      starter:
        "def gate(outline):\n" +
        "    problems = []\n" +
        "    if len(outline) < 3:\n" +
        '        problems.append("fewer than 3 sections")\n' +
        '    if not any("mistake" in s.lower() for s in outline):\n' +
        '        problems.append("no section on mistakes")\n' +
        "    if len(set(outline)) != len(outline):\n" +
        '        problems.append("duplicate sections")\n' +
        "    return problems\n" +
        "\n" +
        "\n" +
        "candidates = {\n" +
        '    "good":      ["What it is", "How it works", "Common mistakes"],\n' +
        '    "too short": ["What it is"],\n' +
        '    "no gotchas":["What it is", "How it works", "Summary"],\n' +
        '    "duplicate": ["What it is", "What it is", "Common mistakes"],\n' +
        "}\n" +
        "\n" +
        "spent = 0\n" +
        "for name, outline in candidates.items():\n" +
        "    spent += 1                      # the call that produced the outline\n" +
        "    problems = gate(outline)\n" +
        "    if problems:\n" +
        "        print(f\"{name:11} BLOCKED  {'; '.join(problems)}\")\n" +
        "    else:\n" +
        "        spent += 1                  # the second call, only if the gate passed\n" +
        '        print(f"{name:11} passed   -> drafting")\n' +
        "\n" +
        'print(f"\\n{spent} calls made. Without gates it would have been {2 * len(candidates)}.")\n',
      expectedOutput:
        "good        passed   -> drafting\n" +
        "too short   BLOCKED  fewer than 3 sections; no section on mistakes\n" +
        "no gotchas  BLOCKED  no section on mistakes\n" +
        "duplicate   BLOCKED  duplicate sections\n" +
        "\n" +
        "5 calls made. Without gates it would have been 8.",
    },
    {
      kind: "pitfall",
      items: [
        "Chaining without gates — that is one prompt cut into pieces, and it is slower and dearer than the prompt was.",
        "Splitting where you cannot check the intermediate result — the split only pays for itself if code can look at what came out.",
        "Letting an error pass a gate silently — a gate that logs a warning and continues is not a gate, it is a comment.",
        "Forgetting the latency adds up — three steps is three round trips, and a user watching a spinner does not care that the accuracy improved.",
        "Re-sending everything at every step — each step needs the previous step's output, not the entire history of the chain.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Prompt chaining = fixed steps, each a separate call, with code checking between them.",
        "It trades latency for accuracy. That is the deal Anthropic's guidance states outright.",
        "The gate is what makes it worth doing. A chain without gates is a split prompt.",
        "Split where the intermediate result is checkable by code — schema, length, required fields.",
        "Decide each gate's failure path in advance: retry with the error, fall back, or stop.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How would you improve the reliability of a complicated generation task?\" — decompose into steps with validation between them is a strong, concrete answer.",
        "Expect the cost and latency follow-up. Saying explicitly that chaining trades latency for accuracy shows you know it is a trade.",
        "Being able to say where you would put the gate, and what it would check, is what separates this from a diagram.",
      ],
    },
    {
      kind: "quiz",
      question: "What makes a chain better than the same work in one prompt?",
      options: [
        "It uses fewer tokens overall, because each short prompt carries less repeated instruction than one long one",
        "It is faster",
        "Code can check the intermediate result and stop before the expensive next step",
        "The model concentrates better on shorter prompts",
      ],
      answer: 2,
      why:
        "The gate is the value. Chaining costs more calls and more latency; what you buy is a checkable " +
        "point between the steps, and the ability to stop there.",
    },
    {
      kind: "quiz",
      question: "According to Anthropic's guidance, when is prompt chaining ideal?",
      options: [
        "When the number of steps cannot be predicted in advance and the model must choose each one",
        "When the task can be easily and cleanly decomposed into fixed subtasks",
        "When latency is the primary constraint",
        "When you have several models available",
      ],
      answer: 1,
      why:
        "Fixed, cleanly separable subtasks are the precondition. If you cannot predict the steps, you " +
        "are looking at orchestrator-workers or an agent, two and three chapters from here.",
    },
    {
      kind: "quiz",
      question: "Your chain's gate finds a problem. What is the worst thing to do?",
      options: [
        "Retry that step, including the specific error in the prompt",
        "Fall back to a simpler path",
        "Log a warning and carry on to the next step anyway",
        "Stop and tell the user it could not be done",
      ],
      answer: 2,
      why:
        "Carrying on means the gate did nothing except produce a log line nobody reads, and the expensive " +
        "step now runs on input you already knew was bad. Any of the other three is a decision; this is " +
        "the absence of one.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take a task you would give a model and find the point where the intermediate result is checkable. That is where the chain splits.",
        "Write the gate for that point, as code. If you cannot, the split is in the wrong place.",
        "Decide the failure path for that gate, and write down what the user sees when it fires.",
        "Count the round trips your chain needs and decide whether the accuracy is worth the wait for your users.",
      ],
    },
  ],
};
