import type { Chapter } from "@/content/courses/types";

export const chapterMultiAgentAndHandoffs: Chapter = {
  slug: "multi-agent-and-handoffs",
  title: "More Than One Agent",
  summary:
    "A handoff replaces the agent driving the loop. It is a real mechanism with real uses — and the " +
    "honest comparison is usually against one agent with good tools, which often wins.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "\"Multi-agent\" is the top rung of the ladder from chapter 16, and the most oversold idea in " +
        "this field. There is something genuinely useful here, and this chapter covers it — but it " +
        "starts with the comparison that most write-ups skip. **The alternative to five specialist " +
        "agents is not chaos. It is one agent with five well-described tools**, and that alternative is " +
        "cheaper, simpler, easier to debug, and wins more often than the diagrams suggest.",
    },
    { kind: "h", text: "The picture: the phone tree" },
    {
      kind: "analogy",
      title: "Being transferred, versus being helped",
      text:
        "You ring a bank about one problem that touches two departments. The person who answers cannot " +
        "help, so she transfers you. The second person cannot either, so he transfers you back. On the " +
        "third transfer you are asked for your account number for the third time. Nobody has been " +
        "unhelpful; each of them has a narrow remit and the problem does not fit inside any single one. " +
        "Now imagine the alternative: one person with access to both systems, who deals with it in four " +
        "minutes. The second arrangement is not less sophisticated — it is better, because the cost of " +
        "handing over turned out to exceed the benefit of specialisation. Where the analogy stops: a " +
        "human being transferred can say \"I have already told two people this\". An agent cannot, and " +
        "the context it loses on each handoff is lost silently.",
    },
    {
      kind: "concept",
      title: "Handoff",
      text:
        "Replacing the agent that is driving the loop with a different one — different instructions, " +
        "different tools — and continuing. The OpenAI Agents SDK names **handoffs** as one of its core " +
        "primitives, agents delegating to other agents for specific tasks, and its documented runner " +
        "loop makes the mechanism explicit: if the LLM requests a handoff, the runner updates the " +
        "current agent and input, and re-runs the loop. That is the whole of it — the loop does not " +
        "restart, the driver changes.",
    },
    { kind: "h", text: "A handoff, written out" },
    {
      kind: "code",
      caption:
        "Handoffs with an allow-list and a handoff limit. The decisions are a hard-coded script — no model is called — but the two guards are the real ones.",
      code:
        "AGENTS = {\n" +
        '    "triage":  {"tools": [],                       "handoffs": ["refunds", "technical"]},\n' +
        '    "refunds": {"tools": ["find_order", "issue_refund"], "handoffs": ["triage"]},\n' +
        '    "technical": {"tools": ["read_logs"],          "handoffs": ["triage"]},\n' +
        "}\n" +
        "\n" +
        "MAX_HANDOFFS = 3\n" +
        "\n" +
        "\n" +
        "def run(script):\n" +
        '    """`script` stands in for what each agent decides -- no model is called."""\n' +
        '    current = "triage"\n' +
        "    handoffs = 0\n" +
        "    for step, decision in enumerate(script, start=1):\n" +
        "        kind, value = decision\n" +
        '        if kind == "handoff":\n' +
        '            if value not in AGENTS[current]["handoffs"]:\n' +
        '                print(f"step {step}: {current} -> {value}  REFUSED (not an allowed handoff)")\n' +
        "                return\n" +
        "            handoffs += 1\n" +
        "            if handoffs > MAX_HANDOFFS:\n" +
        '                print(f"step {step}: handoff limit of {MAX_HANDOFFS} reached -- stopping")\n' +
        "                return\n" +
        '            print(f"step {step}: {current} hands off to {value}")\n' +
        "            current = value\n" +
        '        elif kind == "tool":\n' +
        '            allowed = value in AGENTS[current]["tools"]\n' +
        '            mark = "calls" if allowed else "CANNOT call"\n' +
        '            print(f"step {step}: {current} {mark} {value}")\n' +
        "            if not allowed:\n" +
        "                return\n" +
        "        else:\n" +
        '            print(f"step {step}: {current} answers: {value}")\n' +
        "            return\n" +
        "\n" +
        "\n" +
        'print("a good run:")\n' +
        'run([("handoff", "refunds"), ("tool", "find_order"), ("answer", "Refund RFD-9182 was paid on 8 September.")])\n' +
        "\n" +
        'print("\\nping-pong, stopped by the limit:")\n' +
        'run([("handoff", "refunds"), ("handoff", "triage"), ("handoff", "technical"),\n' +
        '     ("handoff", "triage"), ("handoff", "refunds")])\n',
      output:
        "a good run:\n" +
        "step 1: triage hands off to refunds\n" +
        "step 2: refunds calls find_order\n" +
        "step 3: refunds answers: Refund RFD-9182 was paid on 8 September.\n" +
        "\n" +
        "ping-pong, stopped by the limit:\n" +
        "step 1: triage hands off to refunds\n" +
        "step 2: refunds hands off to triage\n" +
        "step 3: triage hands off to technical\n" +
        "step 4: handoff limit of 3 reached -- stopping",
    },
    {
      kind: "p",
      text:
        "The second run is the failure everybody meets, and it is chapter 14's problem in a new costume: " +
        "nothing in the system decides it is finished, so it hands back and forth until a limit stops " +
        "it. Notice also the allow-list. Which agent may hand off to which is a decision your code " +
        "makes, exactly like the tool registry — and for the same reason, it is the only guarantee that " +
        "does not depend on the model behaving.",
    },
    { kind: "h", text: "The honest comparison" },
    {
      kind: "code",
      caption:
        "One agent with five tools against several agents with fewer. The per-token figures are illustrative placeholders; the shape of the comparison is the point.",
      code:
        'TOOLS = ["find_order", "issue_refund", "read_logs", "send_email", "search_docs"]\n' +
        "\n" +
        "\n" +
        "def single_agent(steps):\n" +
        "    # Tool definitions are re-sent every turn.\n" +
        "    per_turn = 60 * len(TOOLS)\n" +
        "    return steps, steps * per_turn, 0\n" +
        "\n" +
        "\n" +
        "def multi_agent(steps, handoffs, tools_each=2):\n" +
        "    per_turn = 60 * tools_each\n" +
        "    # Each handoff costs a turn of its own, plus re-establishing context.\n" +
        "    total_steps = steps + handoffs\n" +
        "    handoff_overhead = handoffs * 400\n" +
        "    return total_steps, total_steps * per_turn + handoff_overhead, handoffs\n" +
        "\n" +
        "\n" +
        "for label, (steps, tokens, hops) in {\n" +
        '    "1 agent, 5 tools":        single_agent(4),\n' +
        '    "3 agents, 2 tools each":  multi_agent(4, 2),\n' +
        '    "5 agents, 1 tool each":   multi_agent(4, 4, tools_each=1),\n' +
        "}.items():\n" +
        '    print(f"{label:26} {steps:2d} turns  {tokens:6d} tokens  {hops} handoff(s)")\n',
      output:
        "1 agent, 5 tools            4 turns    1200 tokens  0 handoff(s)\n" +
        "3 agents, 2 tools each      6 turns    1520 tokens  2 handoff(s)\n" +
        "5 agents, 1 tool each       8 turns    2080 tokens  4 handoff(s)",
    },
    {
      kind: "p",
      text:
        "Splitting into specialists does shrink each agent's tool list, which is the real benefit — but " +
        "it adds turns, and every handoff costs a turn of its own plus the work of re-establishing " +
        "context for the new agent. On this arithmetic, five specialists cost nearly twice what one " +
        "generalist does and take twice as many turns, and every extra turn is another factor in the " +
        "reliability product from chapter 16. **Make the comparison before you draw the diagram.**",
    },
    {
      kind: "compare",
      title: "When splitting genuinely pays",
      columns: [
        {
          label: "Worth splitting",
          items: [
            "The tool list is too long for one agent to choose from reliably",
            "Different parts need genuinely different permissions — a refunds agent that can issue refunds, a read-only agent that cannot",
            "Different parts should run on different models, for cost or capability",
            "Different teams own different parts and need to deploy them separately",
            "The system prompts genuinely conflict — a strict compliance voice and a warm support voice",
          ],
        },
        {
          label: "Not worth splitting",
          items: [
            "Because the diagram looks impressive",
            "To avoid writing five good tool descriptions",
            "When the specialists will need to hand back and forth to finish one request",
            "When latency matters and each handoff adds a turn",
            "When you have not yet tried one agent and found out where it fails",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Raise `handoffs` and watch the arithmetic. At what point does specialising stop paying for itself for your own latency budget?",
      starter:
        "TOKENS_PER_TOOL_DEF = 60\n" +
        "HANDOFF_OVERHEAD = 400     # re-establishing context for the new agent\n" +
        "PER_STEP_SECONDS = 1.4\n" +
        "\n" +
        "work_steps = 4\n" +
        "\n" +
        "designs = [\n" +
        '    ("1 agent, 5 tools",       5, 0),\n' +
        '    ("2 agents, 3 tools each", 3, 1),\n' +
        '    ("3 agents, 2 tools each", 2, 2),\n' +
        '    ("5 agents, 1 tool each",  1, 4),\n' +
        "]\n" +
        "\n" +
        'print(f"{\'design\':24} {\'turns\':>5} {\'tokens\':>7} {\'seconds\':>8}")\n' +
        "for label, tools_each, handoffs in designs:\n" +
        "    turns = work_steps + handoffs\n" +
        "    tokens = turns * tools_each * TOKENS_PER_TOOL_DEF + handoffs * HANDOFF_OVERHEAD\n" +
        '    print(f"{label:24} {turns:5d} {tokens:7d} {turns * PER_STEP_SECONDS:8.1f}")\n',
      expectedOutput:
        "design                   turns  tokens  seconds\n" +
        "1 agent, 5 tools             4    1200      5.6\n" +
        "2 agents, 3 tools each       5    1300      7.0\n" +
        "3 agents, 2 tools each       6    1520      8.4\n" +
        "5 agents, 1 tool each        8    2080     11.2",
    },
    {
      kind: "p",
      text:
        "On these numbers every split is worse than not splitting, on every axis, and it gets steadily " +
        "worse as you add agents. That is not a universal law — change the per-turn overhead, the " +
        "handoff cost or the number of work steps and the ordering can move — but it is the default you " +
        "should assume until you have run your own numbers. The saving from a shorter tool list has to " +
        "outweigh an extra turn *plus* the cost of re-establishing context, and at four work steps it " +
        "does not come close. **Put your own figures in before you draw the diagram.**",
    },
    {
      kind: "pitfall",
      items: [
        "Splitting to avoid writing good tool descriptions — the descriptions still have to be good, and now there is a handoff protocol to get wrong as well.",
        "Losing context at the handoff — the new agent needs the goal and what has been established, and \"the user asked something about refunds\" is not that.",
        "No handoff limit — agents hand back and forth, each pass costing a turn, until something external stops it.",
        "No allow-list — which agent may hand to which is a code decision, like the tool registry, and leaving it to the model gives up the only hard guarantee you had.",
        "Every agent having every tool — then it is one agent with extra steps, and none of the permission separation that justified splitting.",
        "Not being able to read the trace — with several agents and several handoffs, a log that does not say which agent did what is a system nobody can debug.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A handoff replaces the agent driving the loop: different instructions, different tools, same loop (OpenAI Agents SDK).",
        "The honest alternative is one agent with well-described tools, and it wins more often than the diagrams suggest.",
        "Every handoff costs a turn plus the work of re-establishing context, and every turn is another factor in the reliability product.",
        "Split for real reasons: tool-list size, different permissions, different models, different owners, conflicting instructions.",
        "Allow-list the handoffs and cap their number. Both are code decisions, like the tool registry.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"When would you use multiple agents?\" — the strong answer starts by naming the single-agent alternative and then gives a specific reason to reject it.",
        "Different permissions is the most defensible reason to split, and mentioning it shows you are thinking about blast radius rather than architecture diagrams.",
        "Expect to be asked what goes wrong. Ping-ponging handoffs and lost context are the two real answers, and both have concrete fixes.",
      ],
    },
    {
      kind: "quiz",
      question: "In the OpenAI Agents SDK's documented loop, what happens when the LLM requests a handoff?",
      options: [
        "The run ends and a brand-new run starts from scratch with the second agent as the only one",
        "The runner updates the current agent and input, and re-runs the loop",
        "The handoff is queued until the current agent finishes",
        "Both agents run in parallel from then on",
      ],
      answer: 1,
      why:
        "The loop continues; only the driver changes. That is why a handoff costs a turn rather than a " +
        "whole new run — and why ping-ponging is a loop problem with a loop-shaped fix.",
    },
    {
      kind: "quiz",
      question: "What is the most defensible reason to split one agent into several?",
      options: [
        "It looks more sophisticated in a design review, which helps when you need others to approve the design",
        "The parts need genuinely different permissions — one can issue refunds, another is read-only",
        "It reduces the number of model calls",
        "Each agent can then have its own name and personality, which makes users trust the answers more",
        ],
      answer: 1,
      why:
        "Different permissions is a real boundary your runtime can enforce, and it limits blast radius. " +
        "Splitting does not reduce calls — it adds turns for the handoffs.",
    },
    {
      kind: "quiz",
      question: "Your agents hand back and forth without resolving the request. What is the fix?",
      options: [
        "A better system prompt that tells the agents firmly to cooperate and not to hand the request back",
        "A handoff limit in the runtime, plus an allow-list of which agent may hand to which",
        "More agents, so there is always one that can help",
        "A larger model for each agent",
      ],
      answer: 1,
      why:
        "This is chapter 14's problem again: nothing inside the loop decides it is finished. A prompt is " +
        "a request; a limit in the runtime is enforced. The allow-list stops the cycle existing at all.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take a multi-agent design you have seen and write down what the single-agent version would look like. Then say what it could not do.",
        "For a system you would build, draw the handoff allow-list. Which pairs are missing, and is any cycle possible?",
        "Run the playground with your own numbers and find the point where splitting stops paying for itself.",
        "Write down exactly what one agent must pass to the next at a handoff, so the second one does not start from nothing.",
      ],
    },
  ],
};
