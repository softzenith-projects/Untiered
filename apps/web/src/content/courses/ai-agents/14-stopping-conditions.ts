import type { Chapter } from "@/content/courses/types";

export const chapterStoppingConditions: Chapter = {
  slug: "stopping-conditions",
  title: "Knowing When to Stop",
  summary:
    "Nothing inside a loop necessarily decides it is finished. Without a stopping condition and a hard " +
    "limit, the only thing that ends an agent's run is whatever runs out first — patience, money, or luck.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Here is a bug that does not look like a bug. The agent works. It does the task correctly. And " +
        "then it carries on — re-checking, re-confirming, re-doing — because nothing in the loop was " +
        "given the job of deciding that it was finished. In a read-only agent this wastes money. In an " +
        "agent with a write tool it places four real orders. This chapter is about the two things that " +
        "stop a loop, why you need both, and what it looks like when you have neither.",
    },
    { kind: "h", text: "The picture: the tap that fills the tank" },
    {
      kind: "analogy",
      title: "Two ways to stop filling a water tank",
      text:
        "Every building with an overhead tank has a pump, and two quite different things stop it. The " +
        "first is a float switch: when the water reaches the top, the float rises and cuts the motor. " +
        "That is the *right* way — it stops because the job is done. The second is the person who " +
        "remembers to go up and switch it off, or the timer someone wired in after the first flood. That " +
        "is the *backstop* — it stops because time ran out, not because anything was achieved. Any " +
        "building with only the backstop and no float has a wet staircase eventually. Any building with " +
        "only the float has a flood the day the float jams. You want both. Where the analogy stops: a " +
        "jammed float is rare. An agent with no clear idea of \"done\" is the normal case, not the " +
        "failure case, because nobody wrote the float switch in the first place.",
    },
    {
      kind: "concept",
      title: "Stopping condition",
      text:
        "Two different things, both needed. The **success condition** is what the agent is told counts " +
        "as finished — a stated goal specific enough to be recognised as met. The **hard limit** is a " +
        "cap enforced by your runtime regardless of what the model thinks: a maximum number of turns, a " +
        "token budget, a wall-clock timeout, a cap on irreversible actions. The first is a prompt " +
        "concern. The second is code, and it is the one that actually saves you.",
    },
    { kind: "h", text: "Watch it not stop" },
    {
      kind: "p",
      text:
        "The lab below is an agent restocking a kitchen. It does the job correctly in two steps: check " +
        "the stock, place the order. Run it once as it stands. Then **switch off the clause \"Stop as " +
        "soon as you have what the goal asked for\", set the step limit to 9, and run it again.**",
    },
    { kind: "agentlab", scenarioId: "pantry-restock" },
    {
      kind: "p",
      text:
        "Count the orders in that second trace. The agent is not malfunctioning — look at its thoughts. " +
        "It checks the pantry, sees 2 kg against 6 kg a week, correctly concludes that is not enough, " +
        "and orders. Then it checks again. The pantry still says 2 kg, **because the pantry only changes " +
        "when the delivery arrives, not when the order is placed** — which is how nearly every real " +
        "inventory system behaves. So it orders again. Every single step in that loop is locally " +
        "correct. The failure is that no step was ever given the job of noticing the run was over.",
    },
    {
      kind: "code",
      caption: "The same agent with and without a stopping condition, side by side. Scripted Python — no model is called — but `orders_placed` is a real list that really grows.",
      code:
        '# The same agent, twice. The only difference is whether anything says "done".\n' +
        'PANTRY = {"atta_kg": 2, "weekly_use_kg": 6}\n' +
        "orders_placed = []\n" +
        "\n" +
        "\n" +
        "def check_stock():\n" +
        "    return dict(PANTRY)  # the delivery has not arrived, so this never changes\n" +
        "\n" +
        "\n" +
        "def order_item(kg):\n" +
        "    orders_placed.append(kg)\n" +
        '    return {"ordered": "atta", "kg": kg, "delivery": "tomorrow"}\n' +
        "\n" +
        "\n" +
        "def run(stop_when_done, max_steps):\n" +
        "    orders_placed.clear()\n" +
        "    goal_met = False\n" +
        "    for step in range(1, max_steps + 1):\n" +
        "        if goal_met and stop_when_done:\n" +
        '            print(f"  step {step}: goal already met -> stop")\n' +
        "            return step - 1\n" +
        "        if step % 2 == 1:\n" +
        "            obs = check_stock()\n" +
        '            print(f"  step {step}: check_stock() -> {obs}")\n' +
        "        else:\n" +
        "            obs = order_item(5)\n" +
        '            print(f"  step {step}: order_item(5)  -> {obs}")\n' +
        "            goal_met = True\n" +
        '    print(f"  step limit of {max_steps} reached")\n' +
        "    return max_steps\n" +
        "\n" +
        "\n" +
        'print("WITH a stopping condition:")\n' +
        "run(stop_when_done=True, max_steps=8)\n" +
        'print(f"  real orders placed: {len(orders_placed)}\\n")\n' +
        "\n" +
        'print("WITHOUT one:")\n' +
        "run(stop_when_done=False, max_steps=8)\n" +
        'print(f"  real orders placed: {len(orders_placed)}")\n',
      output:
        "WITH a stopping condition:\n" +
        "  step 1: check_stock() -> {'atta_kg': 2, 'weekly_use_kg': 6}\n" +
        "  step 2: order_item(5)  -> {'ordered': 'atta', 'kg': 5, 'delivery': 'tomorrow'}\n" +
        "  step 3: goal already met -> stop\n" +
        "  real orders placed: 1\n" +
        "\n" +
        "WITHOUT one:\n" +
        "  step 1: check_stock() -> {'atta_kg': 2, 'weekly_use_kg': 6}\n" +
        "  step 2: order_item(5)  -> {'ordered': 'atta', 'kg': 5, 'delivery': 'tomorrow'}\n" +
        "  step 3: check_stock() -> {'atta_kg': 2, 'weekly_use_kg': 6}\n" +
        "  step 4: order_item(5)  -> {'ordered': 'atta', 'kg': 5, 'delivery': 'tomorrow'}\n" +
        "  step 5: check_stock() -> {'atta_kg': 2, 'weekly_use_kg': 6}\n" +
        "  step 6: order_item(5)  -> {'ordered': 'atta', 'kg': 5, 'delivery': 'tomorrow'}\n" +
        "  step 7: check_stock() -> {'atta_kg': 2, 'weekly_use_kg': 6}\n" +
        "  step 8: order_item(5)  -> {'ordered': 'atta', 'kg': 5, 'delivery': 'tomorrow'}\n" +
        "  step limit of 8 reached\n" +
        "  real orders placed: 4",
    },
    { kind: "h", text: "This is not a niche concern — it is in the frameworks" },
    {
      kind: "p",
      text:
        "Every serious agent runtime ships a hard limit, because everyone hit this. The OpenAI Agents " +
        "SDK documents a loop that ends in one of three ways — the output is classified as final, the " +
        "model requests a handoff, or there are tool calls to run and the loop goes round again — and " +
        "then adds a cap on top: if you exceed the `max_turns` passed, it raises a `MaxTurnsExceeded` " +
        "exception. Anthropic's *Building Effective Agents* gives the same advice from the other " +
        "direction: agents should include stopping conditions, such as a maximum number of iterations, " +
        "to maintain control. Note what kind of thing both of those are. Neither is a prompt. Both are " +
        "enforced by the runtime, because the runtime is the only part of the system that cannot be " +
        "talked out of it.",
    },
    {
      kind: "compare",
      title: "The two stops, and what each one is for",
      columns: [
        {
          label: "Success condition (the float switch)",
          items: [
            "Lives in the prompt and in the goal's wording",
            "Stops because the job is done — which is the outcome you want",
            "Needs a goal specific enough to be recognisably met: \"the order is placed\", not \"the kitchen is well stocked\"",
            "Can be got wrong by the model, which is exactly why it is not enough on its own",
          ],
        },
        {
          label: "Hard limit (the timer)",
          items: [
            "Lives in your runtime, as code",
            "Stops because something ran out — which is a failure, and should be reported as one",
            "Several kinds at once: turns, tokens, wall-clock, and a separate cap on irreversible actions",
            "Cannot be argued with by the model, which is the entire point",
          ],
        },
      ],
    },
    {
      kind: "code",
      caption: "Three independent budgets, enforced in code. Real Python; the token figures are illustrative, the enforcement is not.",
      code:
        "class Budget:\n" +
        "    def __init__(self, max_steps, max_tokens, max_writes):\n" +
        "        self.max_steps, self.max_tokens, self.max_writes = max_steps, max_tokens, max_writes\n" +
        "        self.steps = self.tokens = self.writes = 0\n" +
        "\n" +
        "    def spend(self, tokens, is_write):\n" +
        "        self.steps += 1\n" +
        "        self.tokens += tokens\n" +
        "        self.writes += 1 if is_write else 0\n" +
        "        if self.steps > self.max_steps:\n" +
        '            return f"STOP: step limit {self.max_steps}"\n' +
        "        if self.tokens > self.max_tokens:\n" +
        '            return f"STOP: token budget {self.max_tokens} (spent {self.tokens})"\n' +
        "        if self.writes > self.max_writes:\n" +
        '            return f"STOP: write limit {self.max_writes} -- refusing to act again"\n' +
        "        return None\n" +
        "\n" +
        "\n" +
        "budget = Budget(max_steps=10, max_tokens=4000, max_writes=1)\n" +
        "plan = [(700, False), (900, False), (850, True), (900, True), (600, False)]\n" +
        "\n" +
        "for i, (tokens, is_write) in enumerate(plan, start=1):\n" +
        "    stop = budget.spend(tokens, is_write)\n" +
        '    kind = "write" if is_write else "read "\n' +
        "    print(f\"step {i} ({kind}) tokens={budget.tokens:5d} writes={budget.writes}  {stop or 'continue'}\")\n" +
        "    if stop:\n" +
        "        break\n",
      output:
        "step 1 (read ) tokens=  700 writes=0  continue\n" +
        "step 2 (read ) tokens= 1600 writes=0  continue\n" +
        "step 3 (write) tokens= 2450 writes=1  continue\n" +
        "step 4 (write) tokens= 3350 writes=2  STOP: write limit 1 -- refusing to act again",
    },
    {
      kind: "p",
      text:
        "The write limit is the one people leave out, and it is the one that matters most. A step limit " +
        "of ten lets an agent place ten orders. A write limit of one lets it place one, however many " +
        "steps it takes to get there. **Count the irreversible things separately from the steps**, " +
        "because they are the only ones you cannot undo by pressing stop.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Raise `max_writes` to 3 and re-run: the agent gets further and places more real orders. Then set `max_steps` to 2 and watch a different limit bite first.",
      starter:
        "class Budget:\n" +
        "    def __init__(self, max_steps, max_writes):\n" +
        "        self.max_steps, self.max_writes = max_steps, max_writes\n" +
        "        self.steps = self.writes = 0\n" +
        "\n" +
        "    def allow(self, is_write):\n" +
        "        if self.steps >= self.max_steps:\n" +
        '            return f"STOP after {self.steps} steps: step limit"\n' +
        "        if is_write and self.writes >= self.max_writes:\n" +
        '            return f"STOP after {self.writes} writes: write limit"\n' +
        "        self.steps += 1\n" +
        "        self.writes += 1 if is_write else 0\n" +
        "        return None\n" +
        "\n" +
        "\n" +
        "budget = Budget(max_steps=10, max_writes=1)\n" +
        "\n" +
        "# The agent alternates for ever: check, order, check, order...\n" +
        "for i in range(1, 11):\n" +
        "    is_write = i % 2 == 0\n" +
        "    stop = budget.allow(is_write)\n" +
        "    if stop:\n" +
        "        print(stop)\n" +
        "        break\n" +
        '    print(f"step {i}: {\'order_item (WRITE)\' if is_write else \'check_stock\'}")\n',
      expectedOutput:
        "step 1: check_stock\n" +
        "step 2: order_item (WRITE)\n" +
        "step 3: check_stock\n" +
        "STOP after 1 writes: write limit",
    },
    {
      kind: "steps",
      title: "Making \"done\" recognisable",
      steps: [
        { label: "State the goal as a test", text: "\"An order for atta has been placed\" can be checked. \"The kitchen is well stocked\" cannot, so nothing can ever satisfy it." },
        { label: "Say what finishing looks like", text: "Tell the agent explicitly to stop and answer once the condition holds, rather than assuming it will infer that." },
        { label: "Cap the turns", text: "In the runtime. Both Anthropic's guidance and the OpenAI Agents SDK's `max_turns` exist for exactly this." },
        { label: "Cap the irreversible actions separately", text: "Steps and writes are different budgets. Ten steps should not mean ten refunds." },
        { label: "Treat hitting a limit as a failure", text: "Report it, log it, alert on it. A run that ends on the timer did not succeed, and silently returning its last output pretends otherwise." },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Relying on the model to know when it is done — it will sometimes, and \"sometimes\" is not a limit; the cap belongs in code that cannot be talked out of it.",
        "Setting only a step limit — ten steps can contain ten irreversible writes, so the number of world-changing actions needs its own budget.",
        "Writing a goal nobody could check — \"make sure everything is fine\" has no state that satisfies it, so the loop has no reason to ever end.",
        "Treating a limit hit as a normal finish — returning the last partial output as though it were an answer hides a failed run from everyone downstream.",
        "Forgetting that a tool result can look unchanged — an inventory that updates on delivery, a ticket that stays open until a human replies, a cache that has not refreshed; each one invites the agent to try again for ever.",
        "Capping only turns and not tokens or time — one turn with an enormous document in it can cost more than ten small ones.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Two stops: a success condition the agent can recognise, and a hard limit your runtime enforces. You need both.",
        "The hard limit is code, not a prompt — it is the only part that cannot be talked out of it.",
        "Both Anthropic's guidance and the OpenAI Agents SDK's `max_turns` exist for this exact failure.",
        "Budget irreversible actions separately from steps. Ten steps must not mean ten refunds.",
        "A run that ends on the limit failed. Report it as a failure, never as an answer.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How do you stop an agent looping?\" is a favourite. Naming both the success condition and the runtime-enforced limit — and saying which one you trust — is the complete answer.",
        "Expect the follow-up about irreversible actions. A separate write budget is the answer that shows production experience.",
        "\"What do you do when the limit is hit?\" catches people out. \"Return whatever it had\" is wrong; it is a failure and should be surfaced as one.",
      ],
    },
    {
      kind: "quiz",
      question: "In the pantry lab, why does the agent keep ordering after the job is done?",
      options: [
        "The model has a fault that makes it forget what it ordered a moment ago, so it orders the same items again",
        "Stock only changes on delivery, so the reading never moves, and nothing tells the agent the job is finished",
        "The order tool is failing silently",
        "The step limit is too low",
      ],
      answer: 1,
      why:
        "Every individual step is correct. The loop simply has no notion of completion, and the " +
        "environment gives it no signal that anything changed — which is exactly how real inventories, " +
        "ticket queues and caches behave.",
    },
    {
      kind: "quiz",
      question: "Your agent has a step limit of 10 and one tool that issues refunds. What is missing?",
      options: [
        "Nothing — ten steps is a reasonable cap, and the step limit already covers refunds and everything else",
        "A separate limit on irreversible actions, since ten steps could mean ten refunds",
        "A larger step limit, so it has room to finish",
        "A longer tool description",
      ],
      answer: 1,
      why:
        "Steps and world-changing actions are different budgets. A step limit bounds cost and time; only " +
        "a write limit bounds the damage.",
    },
    {
      kind: "quiz",
      question: "Where does the hard limit belong?",
      options: [
        "In the system prompt, as an instruction to take at most ten steps",
        "In the tool descriptions",
        "In the runtime that drives the loop, as code",
        "In the model's training",
      ],
      answer: 2,
      why:
        "A prompt is a request; the model may or may not comply, and a confused loop is exactly the " +
        "situation in which it will not. The runtime's counter always holds. That is why the OpenAI " +
        "Agents SDK raises `MaxTurnsExceeded` rather than asking nicely.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "In the lab, turn off the stopping clause and try each step limit in turn. Write down how many real orders each setting would have placed.",
        "Take an agent task you would like to build and write its success condition as something a test could check.",
        "Decide your three budgets for that task — turns, tokens, irreversible actions — and justify each number.",
        "Write down what your system should do, and who it should tell, when a run ends on the limit instead of on the answer.",
      ],
    },
  ],
};
