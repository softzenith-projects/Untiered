import type { Chapter } from "@/content/courses/types";

export const chapterTheReactLoop: Chapter = {
  slug: "the-react-loop",
  title: "The Loop: Thought, Action, Observation",
  summary:
    "This is the whole idea. A model that can act and then see what happened, in a loop, is an agent — " +
    "and the observation is the part that does the work. Build one here, then run one in the lab.",
  minutes: 18,
  blocks: [
    {
      kind: "p",
      text:
        "Everything up to now has been one call: text in, text out. This chapter adds one thing, and it " +
        "is the only structural idea in the entire field. **Put the call in a loop, and let the result of " +
        "each action come back as new context before the next call.** That is an agent. Not a bigger " +
        "model, not a cleverer prompt — a loop with a feedback path. The pattern has a name from the " +
        "paper that popularised it, and it is the best-named idea in the field because the name is " +
        "literally what it does.",
    },
    { kind: "h", text: "The picture: finding a friend's flat in an unfamiliar colony" },
    {
      kind: "analogy",
      title: "You do not plan the whole route. You walk, look, and adjust.",
      text:
        "A friend says \"come over, it's the blue building near the second turn after the temple\". You " +
        "do not stand at the gate and compute the full path — you cannot, because you do not know what " +
        "is down there yet. You think (\"the temple must be towards the main road\"), you act (walk to " +
        "the corner), and you observe (there is a temple, and there are *three* turns, not two). That " +
        "observation changes your next thought, which changes your next action. You are not being " +
        "indecisive; the information required to plan step four only becomes available after step three. " +
        "That is thought → action → observation, looping until you are at the door. Where the analogy " +
        "stops: you know when to stop walking. An agent does not, unless you tell it — which is a whole " +
        "chapter of its own, two chapters from here.",
    },
    {
      kind: "concept",
      title: "The ReAct loop",
      text:
        "Interleaving reasoning and acting: the model produces a **thought**, then an **action** (a tool " +
        "call), the runtime executes it and returns an **observation**, and the loop repeats with the " +
        "observation added to the context. From *ReAct: Synergizing Reasoning and Acting in Language " +
        "Models* (Yao et al., arXiv:2210.03629): the approach has models \"generate both reasoning traces " +
        "and task-specific actions in an interleaved manner, allowing for greater synergy between the " +
        "two\" — the reasoning helps track and update plans, and the actions interface with external " +
        "sources to gather information.",
    },
    { kind: "h", text: "What the paper found, and why it matters here" },
    {
      kind: "p",
      text:
        "The ReAct paper's central claim is about a specific failure it fixes. Chain of thought, on its " +
        "own, reasons entirely inside the model — which means it can reason fluently towards a wrong " +
        "fact and never find out. The paper describes ReAct as overcoming \"issues of hallucination and " +
        "error propagation prevalent in chain-of-thought reasoning\" by letting the model interact with " +
        "an external source, in their case a Wikipedia API. On interactive benchmarks the reported gains " +
        "were large: ReAct outperformed baselines on ALFWorld by 34% absolute success rate, using only " +
        "one or two in-context examples, and on WebShop by 10% absolute.",
    },
    {
      kind: "p",
      text:
        "Put that next to chapter 4 and the shape of this whole course becomes clear. Hallucination " +
        "happens because nothing checks. The loop is the check — not because the model became more " +
        "honest, but because a real observation entered the context and outvoted the guess.",
    },
    { kind: "h", text: "The loop, written out" },
    {
      kind: "code",
      caption:
        "A complete ReAct loop. The `policy` function stands in for the model and is a hard-coded script — this course calls no model (CLAUDE.md rule 7). Everything around it is what a real runtime does.",
      code:
        "# A ReAct loop, in full. The POLICY here is a hard-coded script, not a model.\n" +
        "\n" +
        'ORDERS = {"A-4471": {"refund_id": "RFD-9182", "item": "running shoes"}}\n' +
        'REFUNDS = {"RFD-9182": {"state": "paid", "amount_inr": 3499, "paid_on": "2026-09-08"}}\n' +
        "\n" +
        "TOOLS = {\n" +
        '    "find_order": lambda order_id: ORDERS.get(order_id, {"error": "no such order"}),\n' +
        '    "check_refund_status": lambda refund_id: REFUNDS.get(refund_id, {"error": "no such refund"}),\n' +
        "}\n" +
        "\n" +
        "\n" +
        "def policy(goal, history):\n" +
        '    """Stands in for the model. Given what has happened, decide the next action."""\n' +
        "    if not history:\n" +
        '        return ("thought", "I have an order id but the payments system needs a refund id."), \\\n' +
        '               ("action", "find_order", {"order_id": goal})\n' +
        '    last = history[-1]["observation"]\n' +
        '    if "refund_id" in last:\n' +
        '        return ("thought", f"The order gave me {last[\'refund_id\']}. Now check the payment."), \\\n' +
        '               ("action", "check_refund_status", {"refund_id": last["refund_id"]})\n' +
        '    if "state" in last:\n' +
        '        return ("answer", f"Refund is {last[\'state\']}: INR {last[\'amount_inr\']} on {last[\'paid_on\']}."), None\n' +
        '    return ("answer", "I could not find out."), None\n' +
        "\n" +
        "\n" +
        "def run(goal, max_steps=4):\n" +
        "    history = []\n" +
        "    for step in range(1, max_steps + 1):\n" +
        "        head, act = policy(goal, history)\n" +
        '        if head[0] == "answer":\n' +
        '            print(f"step {step}  ANSWER      {head[1]}")\n' +
        "            return head[1]\n" +
        '        print(f"step {step}  THOUGHT     {head[1]}")\n' +
        "        _, name, args = act\n" +
        '        print(f"         ACTION      {name}({args})")\n' +
        "        observation = TOOLS[name](**args)\n" +
        '        print(f"         OBSERVATION {observation}")\n' +
        '        history.append({"action": name, "args": args, "observation": observation})\n' +
        '    print(f"step limit of {max_steps} reached with no answer")\n' +
        "    return None\n" +
        "\n" +
        "\n" +
        'run("A-4471")\n',
      output:
        "step 1  THOUGHT     I have an order id but the payments system needs a refund id.\n" +
        "         ACTION      find_order({'order_id': 'A-4471'})\n" +
        "         OBSERVATION {'refund_id': 'RFD-9182', 'item': 'running shoes'}\n" +
        "step 2  THOUGHT     The order gave me RFD-9182. Now check the payment.\n" +
        "         ACTION      check_refund_status({'refund_id': 'RFD-9182'})\n" +
        "         OBSERVATION {'state': 'paid', 'amount_inr': 3499, 'paid_on': '2026-09-08'}\n" +
        "step 3  ANSWER      Refund is paid: INR 3499 on 2026-09-08.",
    },
    {
      kind: "p",
      text:
        "Two things in that trace deserve a second look. First, **`RFD-9182` appears nowhere in the " +
        "goal.** The goal was `A-4471`. The agent could not have produced that refund id by any amount " +
        "of thinking — it came out of the first observation. Second, **`history` is the memory.** The " +
        "model is stateless (chapter 3), so the only reason step two knows anything about step one is " +
        "that the loop kept a list and re-sent it. Take `history` away and you have two unrelated calls.",
    },
    {
      kind: "viz",
      title: "One pass of the loop",
      caption: "The context grows by exactly one observation per step. That growth is the whole mechanism.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "goal: A-4471", state: "active" }],
            note: "Start. The context holds the goal and the tool definitions. There is no refund id anywhere in it.",
          },
          {
            cells: [
              { value: "goal: A-4471" },
              { value: "thought", state: "active" },
              { value: "action: find_order", state: "compare" },
            ],
            note: "Step 1, thought and action. The model has produced text naming a tool. Nothing has run yet.",
          },
          {
            cells: [
              { value: "goal: A-4471" },
              { value: "thought" },
              { value: "action: find_order" },
              { value: "obs: refund_id RFD-9182", state: "done" },
            ],
            note: "Step 1, observation. The runtime ran the function and appended the result. RFD-9182 is now in the context — a fact that was not there a moment ago.",
          },
          {
            cells: [
              { value: "goal: A-4471" },
              { value: "thought" },
              { value: "action: find_order" },
              { value: "obs: refund_id RFD-9182", state: "done" },
              { value: "action: check_refund_status(RFD-9182)", state: "compare" },
            ],
            note: "Step 2. The next action uses an argument that only the previous observation could have supplied. This is the dependency the loop exists to create.",
          },
          {
            cells: [
              { value: "goal: A-4471" },
              { value: "thought" },
              { value: "action: find_order" },
              { value: "obs: refund_id RFD-9182" },
              { value: "action: check_refund_status" },
              { value: "obs: paid, 3499, 2026-09-08", state: "done" },
              { value: "ANSWER", state: "active" },
            ],
            note: "Step 3. The goal is satisfied, so the model answers instead of acting. Every number in that answer came from an observation, not from the model.",
          },
        ],
      },
    },
    { kind: "h", text: "Build the agent yourself" },
    {
      kind: "p",
      text:
        "Below is the agent lab. You choose which tools the agent gets, what its system prompt says, how " +
        "many steps it may take, and whether it is shown what its actions returned — then you step " +
        "through the trace one frame at a time. Run it once as it stands to see the loop above. Then do " +
        "the interesting thing: **switch both tools off and run it again.** The agent still produces an " +
        "answer. Read that answer carefully, then switch off the clause that tells it to admit when it " +
        "cannot look something up, and run it a third time.",
    },
    { kind: "agentlab", scenarioId: "refund-status" },
    {
      kind: "p",
      text:
        "The difference between those two no-tool runs is the difference between a product you can ship " +
        "and one you cannot. Same model, same goal, same absence of information — and one says \"I " +
        "cannot check this\" while the other gives a customer a refund date that nobody looked up. " +
        "Nothing about the model chose between them. A clause in the prompt did, and the loop is what " +
        "made the difference visible.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Change the last line to `run(\"A-0000\")` — an order that does not exist — and run it. Then set `max_steps=1` and watch the loop get cut off before it can answer.",
      starter:
        'ORDERS = {"A-4471": {"refund_id": "RFD-9182"}}\n' +
        'REFUNDS = {"RFD-9182": {"state": "paid", "amount_inr": 3499}}\n' +
        "\n" +
        "TOOLS = {\n" +
        '    "find_order": lambda order_id: ORDERS.get(order_id, {"error": "no such order"}),\n' +
        '    "check_refund_status": lambda refund_id: REFUNDS.get(refund_id, {"error": "no such refund"}),\n' +
        "}\n" +
        "\n" +
        "\n" +
        "def policy(goal, history):\n" +
        "    if not history:\n" +
        '        return "find_order", {"order_id": goal}, None\n' +
        "    last = history[-1]\n" +
        '    if "refund_id" in last:\n' +
        '        return "check_refund_status", {"refund_id": last["refund_id"]}, None\n' +
        '    if "state" in last:\n' +
        "        return None, None, f\"Refund is {last['state']}, INR {last['amount_inr']}.\"\n" +
        '    return None, None, "I hit an error and cannot answer: " + str(last)\n' +
        "\n" +
        "\n" +
        "def run(goal, max_steps=4):\n" +
        "    history = []\n" +
        "    for step in range(1, max_steps + 1):\n" +
        "        name, args, answer = policy(goal, history)\n" +
        "        if answer:\n" +
        '            print(f"step {step}: ANSWER {answer}")\n' +
        "            return\n" +
        "        observation = TOOLS[name](**args)\n" +
        '        print(f"step {step}: {name}({args}) -> {observation}")\n' +
        "        history.append(observation)\n" +
        '    print(f"stopped: step limit of {max_steps} reached, no answer")\n' +
        "\n" +
        "\n" +
        '# Change this to an order that does not exist, e.g. "A-0000", and run again.\n' +
        'run("A-4471")\n',
      expectedOutput:
        "step 1: find_order({'order_id': 'A-4471'}) -> {'refund_id': 'RFD-9182'}\n" +
        "step 2: check_refund_status({'refund_id': 'RFD-9182'}) -> {'state': 'paid', 'amount_inr': 3499}\n" +
        "step 3: ANSWER Refund is paid, INR 3499.",
    },
    {
      kind: "compare",
      title: "One call versus a loop",
      columns: [
        {
          label: "A single call",
          items: [
            "One shot: everything it needs must already be in the prompt",
            "Cost and latency are predictable — one call, one price",
            "Cannot discover anything it was not given",
            "Fails silently: a wrong answer looks exactly like a right one",
          ],
        },
        {
          label: "A loop with tools",
          items: [
            "Can find out what it needs, in an order decided while running",
            "Cost and latency are variable and open-ended — you are buying several calls, not one",
            "An observation can contradict what the model would have guessed",
            "Fails visibly: you can read the trace and see which step went wrong",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Forgetting to append the observation — a loop that calls tools but never feeds the results back is just the same call repeated, and the agent cannot correct itself.",
        "Letting the history grow unboundedly — every turn re-sends the whole trace, so a fifteen-step run's last call is far more expensive than its first.",
        "Running a loop with no step limit — nothing inside the loop necessarily decides it is finished, which is the subject of chapter 14 and its lab.",
        "Reaching for an agent when one call would do — a loop costs several calls and several times the latency, and buys nothing on a task with no unknowns.",
        "Treating the thought text as a record of the model's reasoning — it is generated text like everything else, and arXiv:2305.04388 showed it can rationalise rather than report.",
      ],
    },
    {
      kind: "remember",
      items: [
        "An agent is a model in a loop with a feedback path. Thought → action → observation → repeat.",
        "The observation is the part that does the work — it puts a fact in the context that the model could not have produced.",
        "ReAct interleaves reasoning and acting, and was reported to beat baselines by 34% absolute on ALFWorld and 10% on WebShop (arXiv:2210.03629).",
        "The loop's history *is* the memory. The model is stateless; the list you keep is the only continuity there is.",
        "A loop buys discovery and pays for it in calls, tokens and latency. Do not buy it when there is nothing to discover.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What makes something an agent rather than just an LLM call?\" is now a very common opening question. The loop with observations fed back is the answer; \"it uses tools\" alone is not.",
        "Expect to be asked what ReAct fixes that chain of thought does not. The answer is error propagation and hallucination, because reasoning alone never meets ground truth.",
        "A good follow-up to be ready for: what does the history cost? Knowing that every turn re-sends the whole trace, and getting more expensive as it goes, marks you out.",
      ],
    },
    {
      kind: "quiz",
      question: "In the loop above, where did the argument `RFD-9182` come from?",
      options: [
        "The goal, which already contained the refund id in its text",
        "The model's knowledge of refund id formats",
        "The observation returned by the first tool call",
        "The tool definition's example value",
      ],
      answer: 2,
      why:
        "The goal was `A-4471`. The refund id entered the context only when `find_order` ran and its " +
        "result was appended. This dependency between steps is exactly what the loop exists to create.",
    },
    {
      kind: "quiz",
      question: "According to the ReAct paper, what problem with chain-of-thought reasoning does the loop address?",
      options: [
        "That it is too slow, because writing out every reasoning step takes the model far too long to be practical",
        "Hallucination and error propagation, because reasoning alone never meets an external source",
        "That it uses too many tokens",
        "That it only works on maths problems",
      ],
      answer: 1,
      why:
        "Reasoning inside the model can proceed fluently from a wrong premise and never find out. " +
        "Interleaving actions lets the model gather information from outside itself, which is what " +
        "interrupts the error.",
    },
    {
      kind: "quiz",
      question: "You build a loop that calls tools but never appends the results to the conversation. What happens?",
      options: [
        "The agent works, just more slowly, because the model remembers what each tool returned without being told",
        "Each turn looks identical to the model, so it repeats the same call until something stops it",
        "The tools fail to execute",
        "The model falls back to its training data and answers correctly",
      ],
      answer: 1,
      why:
        "Without the observation, nothing new enters the context, so the most likely next action is the " +
        "same one again. You can watch exactly this happen in the lab in chapter 15 by switching " +
        "observations off.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "In the lab, turn off `check_refund_status` but leave `find_order` on. How far does the agent get, and what does it do when it runs out of road?",
        "Set the step limit to 2 and run the full scenario. Predict what happens before you press Run.",
        "Write the policy function for a task of your own — three steps, where step two needs something only step one could return.",
        "Take a task you do at work that needs three lookups in different systems and write it as thought / action / observation triples.",
      ],
    },
  ],
};
