import type { Chapter } from "@/content/courses/types";

export const chapterEvaluatingAnAgent: Chapter = {
  slug: "evaluating-an-agent",
  title: "Evaluating an Agent",
  summary:
    "\"It seems better\" is not a measurement. An evaluation set, checks that are mostly code, and a " +
    "readable trace are what let you change something and know whether you improved it.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Here is the situation every team building on models ends up in. Somebody changes a prompt. The " +
        "three examples they tried look better. It ships. Two weeks later something else is worse and " +
        "nobody can say when it started or which change caused it. This is not carelessness — it is " +
        "what happens by default when your system's behaviour is not measured, and it is the single " +
        "biggest difference between a demo and a product.",
    },
    { kind: "h", text: "The picture: tasting versus the thermometer" },
    {
      kind: "analogy",
      title: "The cook who tastes and the baker who measures",
      text:
        "A cook tastes as she goes and adjusts, and for most dishes that is exactly right. A baker " +
        "cannot: by the time you can taste the bread it is finished, so she weighs the flour, times the " +
        "prove and checks the oven with a thermometer. Building on models is baking. You cannot taste " +
        "the effect of a prompt change on the fifty cases you did not try, and the three you did try " +
        "are the ones you were already thinking about. The thermometer is an evaluation set — a fixed " +
        "list of cases with expected outcomes, run every time you change something. Where the analogy " +
        "stops: an oven at 180° is at 180°. Your evaluation set measures the cases you thought of, and " +
        "the interesting failures are always the ones you did not — which is why the set grows from " +
        "production, not from imagination.",
    },
    {
      kind: "concept",
      title: "Evaluation set",
      text:
        "A fixed collection of inputs with expected outcomes, run on every change. For an agent the " +
        "expected outcome is richer than for a single call: not just what it answered, but which tools " +
        "it called, in what order, how many steps it took, whether it cited anything, and whether it " +
        "correctly refused. **Every one of those is checkable by code**, which is what makes agent " +
        "evaluation more tractable than evaluating free prose.",
    },
    { kind: "h", text: "Most of it is code" },
    {
      kind: "code",
      caption:
        "A tiny evaluation harness. The runs are recorded stand-ins so this executes anywhere — but every assertion is the kind you would really write.",
      code:
        "CASES = [\n" +
        '    {"id": "e1", "ask": "Has refund RFD-9182 been paid?",\n' +
        '     "expect": {"tool_calls": ["find_order", "check_refund_status"], "contains": "8 September", "cites": True}},\n' +
        '    {"id": "e2", "ask": "Has refund RFD-0000 been paid?",\n' +
        '     "expect": {"tool_calls": ["find_order"], "contains": "could not", "cites": False}},\n' +
        '    {"id": "e3", "ask": "What is the capital of France?",\n' +
        '     "expect": {"tool_calls": [], "contains": "Paris", "cites": False}},\n' +
        "]\n" +
        "\n" +
        "RUNS = {\n" +
        '    "e1": {"tool_calls": ["find_order", "check_refund_status"], "answer": "Paid on 8 September.", "cites": True},\n' +
        '    "e2": {"tool_calls": ["find_order"], "answer": "It was paid within 7 working days.", "cites": False},\n' +
        '    "e3": {"tool_calls": ["search_web"], "answer": "Paris.", "cites": False},\n' +
        "}\n" +
        "\n" +
        "passed = 0\n" +
        "for case in CASES:\n" +
        '    run = RUNS[case["id"]]\n' +
        '    expect = case["expect"]\n' +
        "    faults = []\n" +
        '    if run["tool_calls"] != expect["tool_calls"]:\n' +
        "        faults.append(f\"tools {run['tool_calls']} != {expect['tool_calls']}\")\n" +
        '    if expect["contains"].lower() not in run["answer"].lower():\n' +
        "        faults.append(f\"answer missing {expect['contains']!r}\")\n" +
        '    if run["cites"] != expect["cites"]:\n' +
        "        faults.append(f\"cites {run['cites']} != {expect['cites']}\")\n" +
        "    if faults:\n" +
        "        print(f\"{case['id']} FAIL  \" + \"; \".join(faults))\n" +
        "    else:\n" +
        "        passed += 1\n" +
        "        print(f\"{case['id']} pass\")\n" +
        "\n" +
        'print(f"\\n{passed}/{len(CASES)} passed. Every check above is code -- no judge model needed.")\n',
      output:
        "e1 pass\n" +
        "e2 FAIL  answer missing 'could not'\n" +
        "e3 FAIL  tools ['search_web'] != []\n" +
        "\n" +
        "1/3 passed. Every check above is code -- no judge model needed.",
    },
    {
      kind: "p",
      text:
        "Look at what the two failures caught, because neither is a wording problem. Case e2 is the " +
        "**honest-refusal** case: asked about a refund that does not exist, the agent produced a " +
        "confident generic answer instead of saying it could not find it. That is chapter 4's failure, " +
        "caught automatically. Case e3 is the opposite: asked something it already knew, it called a " +
        "tool anyway — a wasted call, wasted latency, and a sign the system prompt is pushing too hard " +
        "towards tool use. Neither would have been found by reading the answers, because both answers " +
        "read fine.",
    },
    {
      kind: "compare",
      title: "What to assert, and how",
      columns: [
        {
          label: "Code can check",
          items: [
            "Which tools were called, with what arguments, in what order",
            "Number of steps, and whether a limit was hit",
            "Whether an exact required string appears — a refusal phrase, a reference, a number",
            "Whether every cited id was actually retrieved",
            "Schema validity, token cost and wall-clock time",
          ],
        },
        {
          label: "Needs judgement",
          items: [
            "Is the tone right for an upset customer?",
            "Is this explanation clear to a non-expert?",
            "Is this summary faithful to the source?",
            "Did it choose a reasonable approach among several valid ones?",
            "Expensive per case — so use it on a small, deliberately chosen sample",
          ],
        },
      ],
    },
    { kind: "h", text: "Using a model as a judge, carefully" },
    {
      kind: "p",
      text:
        "For the right-hand column the usual approach is to have a model score the output. It is a " +
        "legitimate tool and it needs two guards. First, **give it a rubric, not an adjective** — the " +
        "same rule as chapter 26; \"rate out of ten\" produces numbers that drift, while \"does the " +
        "reply state a specific date? yes or no\" produces something stable. Second, remember chapter 8: " +
        "a model's stated reasoning is not a reliable account of how it reached its answer " +
        "(arXiv:2305.04388), so a judge's *explanation* is not evidence about the judgement. Calibrate " +
        "against human labels on a sample before you trust the score on anything.",
    },
    { kind: "h", text: "The trace is the evidence" },
    {
      kind: "p",
      text:
        "One more thing has to exist before any of this is useful: a readable record of what happened. " +
        "The OpenAI Agents SDK lists **Tracing** as one of its five primitives — built-in visualisation " +
        "and debugging of agentic flows — and it is on that list for a reason. A ten-step run that " +
        "produced the wrong answer is not debuggable from the answer. You need the system prompt, every " +
        "tool call with its arguments, every observation, the step count and the token count, per run, " +
        "kept long enough to look at. Build it early; it is the difference between diagnosing a failure " +
        "in five minutes and guessing at it for a day.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add a case of your own — especially one where the right answer is a refusal. A suite with no refusal cases cannot catch the failure this whole course is about.",
      starter:
        "def check(run, expect):\n" +
        "    faults = []\n" +
        '    if run["tools"] != expect["tools"]:\n' +
        "        faults.append(f\"tools {run['tools']} != {expect['tools']}\")\n" +
        '    if expect["must_say"] and expect["must_say"].lower() not in run["answer"].lower():\n' +
        "        faults.append(f\"missing {expect['must_say']!r}\")\n" +
        '    if expect["must_not_say"] and expect["must_not_say"].lower() in run["answer"].lower():\n' +
        "        faults.append(f\"should not have said {expect['must_not_say']!r}\")\n" +
        '    if run["steps"] > expect["max_steps"]:\n' +
        "        faults.append(f\"{run['steps']} steps > limit {expect['max_steps']}\")\n" +
        "    return faults\n" +
        "\n" +
        "\n" +
        "suite = [\n" +
        '    ("known refund",\n' +
        '     {"tools": ["find_order", "check_refund_status"], "answer": "Paid on 8 September.", "steps": 2},\n' +
        '     {"tools": ["find_order", "check_refund_status"], "must_say": "8 September", "must_not_say": "", "max_steps": 4}),\n' +
        '    ("unknown refund",\n' +
        '     {"tools": ["find_order"], "answer": "It should arrive within 7 working days.", "steps": 1},\n' +
        '     {"tools": ["find_order"], "must_say": "could not find", "must_not_say": "working days", "max_steps": 4}),\n' +
        "]\n" +
        "\n" +
        "failures = 0\n" +
        "for name, run, expect in suite:\n" +
        "    faults = check(run, expect)\n" +
        "    failures += 1 if faults else 0\n" +
        "    print(f\"{name:16} {'FAIL' if faults else 'pass'}  {'; '.join(faults)}\")\n" +
        "\n" +
        'print(f"\\n{len(suite) - failures}/{len(suite)} passed")\n',
      expectedOutput:
        "known refund     pass  \n" +
        "unknown refund   FAIL  missing 'could not find'; should not have said 'working days'\n" +
        "\n" +
        "1/2 passed",
    },
    {
      kind: "steps",
      title: "Where an evaluation set comes from",
      steps: [
        { label: "Start with ten", text: "Five cases that should work, and five where the right behaviour is to refuse, ask, or stop. Ten is enough to start." },
        { label: "Add every bug", text: "Every production failure becomes a case, with the right behaviour written down. This is how the set stops being your imagination." },
        { label: "Keep the hard ones", text: "Ambiguous inputs, missing data, contradictory sources, and the request that touches two categories at once." },
        { label: "Run on every change", text: "Prompt, model, tool description, chunk size, retrieval parameters. All of them change behaviour; none of them announces it." },
        { label: "Look at the diffs", text: "A number that went from 8/10 to 8/10 can hide two cases that swapped. Compare case by case, not by the total." },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Evaluating only the final answer — an agent that reached the right answer by calling the wrong tools got lucky, and it will stop being lucky.",
        "No refusal cases — if every case in your suite has an answer, the suite cannot catch the model inventing one, which is the failure most likely to hurt you.",
        "Changing the suite and the system in the same commit — then the number moved and nobody can say which change did it.",
        "A judge model with no rubric — a score out of ten drifts between runs and between versions, and you will not notice it drifting.",
        "Trusting a judge's explanation — a stated reason is not a reliable account of the judgement (arXiv:2305.04388); calibrate against human labels instead.",
        "Watching only the total — 8/10 to 8/10 with two cases swapped is a regression that your headline number hid.",
        "No trace — a ten-step run you cannot read is a failure you cannot diagnose, only guess at.",
      ],
    },
    {
      kind: "remember",
      items: [
        "\"It seems better\" is not a measurement. An evaluation set run on every change is.",
        "For agents, assert on the trace as well as the answer: which tools, in what order, how many steps, did it cite, did it refuse.",
        "Most checks should be code. Save a judge model for genuine judgement, and give it a rubric.",
        "Half your cases should be ones where the right behaviour is to refuse, ask, or stop.",
        "Every production failure becomes a case. That is how the suite outgrows your imagination.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How do you know your change made it better?\" is the question that separates people who have shipped. An evaluation set, run per change, compared case by case.",
        "Saying you assert on the tool calls and step count, not just the answer, shows you understand what is different about evaluating an agent.",
        "Mentioning that every production bug becomes a test case is a small thing that signals you have actually maintained one of these.",
      ],
    },
    {
      kind: "quiz",
      question: "Your agent gives the right answer but called a tool it did not need. Should the evaluation case pass?",
      options: [
        "Yes — the answer is correct, which is the only outcome that matters to the user, so the route taken is irrelevant",
        "No — the trace is part of the expected outcome, and an unnecessary call costs money, latency and a step",
        "Only if the extra call was cheap",
        "It cannot be detected automatically",
      ],
      answer: 1,
      why:
        "Getting there by the wrong route is a fault that will surface later as cost, latency or a wrong " +
        "answer when the unnecessary tool returns something misleading. It is trivially checkable, so check it.",
    },
    {
      kind: "quiz",
      question: "Why must half your evaluation cases have no good answer?",
      options: [
        "To make the score look more realistic to readers of the report, because a perfect score is never believed",
        "Because refusing correctly is a behaviour to test, and a suite of answerable cases cannot catch invention",
        "Because models are better at refusing",
        "To reduce the cost of running the suite",
      ],
      answer: 1,
      why:
        "The failure this course keeps returning to is a confident answer where there should have been " +
        "\"I could not find that\". If every case in the suite has an answer, that failure is invisible to it.",
    },
    {
      kind: "quiz",
      question: "You use a model as a judge. What is the most important guard?",
      options: [
        "Use the largest available model as the judge, since a bigger model is always the most reliable grader",
        "Give it an explicit rubric and calibrate its scores against human labels on a sample",
        "Run the judge at temperature 0",
        "Have the judge explain its reasoning in detail",
      ],
      answer: 1,
      why:
        "A rubric makes the score stable and meaningful; calibration tells you whether it agrees with " +
        "people. A detailed explanation is not a guard at all — a stated reason is not a reliable " +
        "account of the judgement (arXiv:2305.04388).",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Write ten evaluation cases for something you would build. Five should be refusals, escalations or stops.",
        "For each case, write the assertions as code. Anything you cannot assert is something you have not defined.",
        "List everything that changes your system's behaviour — prompt, model, tool text, chunk size — and check your suite runs on all of them.",
        "Design the trace: what you would log per run so that \"why did it do that?\" is answerable a week later.",
      ],
    },
  ],
};
