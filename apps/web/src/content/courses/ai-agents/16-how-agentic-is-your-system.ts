import type { Chapter } from "@/content/courses/types";

export const chapterHowAgenticIsYourSystem: Chapter = {
  slug: "how-agentic-is-your-system",
  title: "How Agentic Should It Be?",
  summary:
    "\"Agent\" is not a yes or no. It is a ladder, and every rung costs calls, latency and reliability. " +
    "The useful skill is knowing the lowest rung that solves your problem, and stopping there.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "You now know how to build an agent, which makes this the right moment to be talked out of it. " +
        "The most common mistake in this field is not building agents badly — it is building them when a " +
        "single call, or a fixed sequence of two, would have been better, cheaper, faster and far more " +
        "reliable. This chapter gives you the ladder, and the arithmetic that tells you which rung to " +
        "stand on.",
    },
    { kind: "h", text: "The picture: the dish that needs tasting" },
    {
      kind: "analogy",
      title: "A recipe card, a cook who tastes, and a kitchen with a head chef",
      text:
        "Making tea is a recipe card: water, leaves, three minutes, milk. Nobody needs judgement, and a " +
        "cook who improvises is making it worse. Making a dal is a recipe plus tasting — you cannot know " +
        "in advance how much salt, because it depends on the dal, so somebody has to taste and adjust. " +
        "Running a wedding kitchen is a head chef directing six cooks, because the work cannot even be " +
        "listed in advance. Three different arrangements, and the cost rises steeply along that line. " +
        "Putting a head chef on the tea does not make better tea; it makes tea that arrives late, costs " +
        "more, and occasionally has cardamom in it because somebody exercised judgement they did not " +
        "need. Where the analogy stops: an under-salted dal is obvious. A system that needed tasting and " +
        "did not get it produces something that looks exactly right and is wrong.",
    },
    { kind: "h", text: "The ladder" },
    {
      kind: "p",
      text:
        "The most useful framing of this comes from the smolagents documentation, which treats agency as " +
        "a spectrum rather than a category. Its summary is a single sentence — AI agents are programs " +
        "where LLM outputs control the workflow — and it notes that under that definition \"agent\" is " +
        "not a discrete, 0 or 1 property: agency evolves on a continuous spectrum, as you give more or " +
        "less power to the LLM over your workflow. The rungs it lists run from an LLM output that has no " +
        "effect on program flow at all (a simple processor), through controlling an if/else switch (a " +
        "router), controlling which function runs (a tool call), controlling iteration and whether the " +
        "program continues (a multi-step agent), up to one agentic workflow starting another " +
        "(multi-agent).",
    },
    {
      kind: "concept",
      title: "Workflow or agent",
      text:
        "Anthropic's *Building Effective Agents* draws the line in one place, precisely. A **workflow** " +
        "is a system where \"LLMs and tools are orchestrated through predefined code paths\". An " +
        "**agent** is a system where \"LLMs dynamically direct their own processes and tool usage, " +
        "maintaining control over how they accomplish tasks\". The question to ask about your own system " +
        "is therefore not \"does it use AI?\" but *who decides what happens next — my code, or the model?*",
    },
    {
      kind: "code",
      caption: "The ladder as four yes/no questions about your own system. Plain Python — this is a thinking tool, not a measurement.",
      code:
        "# The agency ladder, as a set of yes/no questions about YOUR system.\n" +
        "QUESTIONS = [\n" +
        '    ("Does an LLM output decide which branch of your code runs?", "router"),\n' +
        '    ("Does an LLM output decide which function is called, and with what?", "tool call"),\n' +
        '    ("Does an LLM output decide whether to go round the loop again?", "multi-step agent"),\n' +
        '    ("Can one LLM-driven process start another one?", "multi-agent"),\n' +
        "]\n" +
        "\n" +
        "systems = {\n" +
        '    "Summariser": [False, False, False, False],\n' +
        '    "Ticket triage": [True, False, False, False],\n' +
        '    "Support assistant with lookups": [True, True, False, False],\n' +
        '    "Refund investigator": [True, True, True, False],\n' +
        '    "Research orchestrator": [True, True, True, True],\n' +
        "}\n" +
        "\n" +
        "for name, answers in systems.items():\n" +
        "    reached = [label for (_, label), yes in zip(QUESTIONS, answers) if yes]\n" +
        "    level = len(reached)\n" +
        '    stars = "*" * level + "." * (4 - level)\n' +
        '    top = reached[-1] if reached else "simple processor"\n' +
        '    print(f"{name:32} {stars}  {top}")\n',
      output:
        "Summariser                       ....  simple processor\n" +
        "Ticket triage                    *...  router\n" +
        "Support assistant with lookups   **..  tool call\n" +
        "Refund investigator              ***.  multi-step agent\n" +
        "Research orchestrator            ****  multi-agent",
    },
    { kind: "h", text: "Every rung has a price" },
    {
      kind: "p",
      text:
        "Anthropic's piece puts this in one line worth memorising: agentic systems often trade latency " +
        "and cost for better task performance. That is a trade, not a free upgrade, and it should be a " +
        "decision. The arithmetic below is uncomfortable in the right way — and the reliability line at " +
        "the bottom is the part people never do.",
    },
    {
      kind: "code",
      caption: "What each rung costs per request. The per-call figures are illustrative placeholders; the multiplication is the real point.",
      code:
        "CALL_TOKENS = 1200      # one round trip, context included\n" +
        "CALL_SECONDS = 1.4\n" +
        "\n" +
        "designs = {\n" +
        '    "one call":            1,\n' +
        '    "router + one call":   2,\n' +
        '    "4-step agent":        4,\n' +
        '    "4-step agent, one retry": 5,\n' +
        '    "orchestrator + 3 workers": 8,\n' +
        "}\n" +
        "\n" +
        "print(f\"{'design':28} {'calls':>5} {'tokens':>8} {'seconds':>8}\")\n" +
        "for name, calls in designs.items():\n" +
        '    print(f"{name:28} {calls:5d} {calls * CALL_TOKENS:8d} {calls * CALL_SECONDS:8.1f}")\n' +
        "print()\n" +
        'print("The reliability question is the same shape: 4 calls at 97% each is",\n' +
        '      f"{0.97 ** 4:.0%} end to end.")\n',
      output:
        "design                       calls   tokens  seconds\n" +
        "one call                         1     1200      1.4\n" +
        "router + one call                2     2400      2.8\n" +
        "4-step agent                     4     4800      5.6\n" +
        "4-step agent, one retry          5     6000      7.0\n" +
        "orchestrator + 3 workers         8     9600     11.2\n" +
        "\n" +
        "The reliability question is the same shape: 4 calls at 97% each is 89% end to end.",
    },
    {
      kind: "p",
      text:
        "Four steps at 97% each is 89% end to end. Nothing went wrong; the multiplication just happened. " +
        "This is the strongest argument for the lowest rung that works: **each step you add is another " +
        "factor in that product, and the product only ever goes down.** It is also the argument for " +
        "checkpoints, retries and human approval on the steps that matter, which module 6 comes back to.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Change `per_step` to 0.99 and then to 0.90, and see how many steps each one survives before the end-to-end figure drops below 90%.",
      starter:
        "per_step = 0.97\n" +
        "\n" +
        "print(f\"per-step success: {per_step:.0%}\\n\")\n" +
        'print(f"{\'steps\':>5} {\'end to end\':>11}")\n' +
        "for steps in range(1, 11):\n" +
        "    end_to_end = per_step ** steps\n" +
        '    flag = "" if end_to_end >= 0.90 else "  <- below 90%"\n' +
        '    print(f"{steps:5d} {end_to_end:10.1%}{flag}")\n',
      expectedOutput:
        "per-step success: 97%\n" +
        "\n" +
        "steps  end to end\n" +
        "    1      97.0%\n" +
        "    2      94.1%\n" +
        "    3      91.3%\n" +
        "    4      88.5%  <- below 90%\n" +
        "    5      85.9%  <- below 90%\n" +
        "    6      83.3%  <- below 90%\n" +
        "    7      80.8%  <- below 90%\n" +
        "    8      78.4%  <- below 90%\n" +
        "    9      76.0%  <- below 90%\n" +
        "   10      73.7%  <- below 90%",
    },
    { kind: "h", text: "So when is an agent the right answer?" },
    {
      kind: "p",
      text:
        "Anthropic's guidance is specific: agents can be used for open-ended problems where it is " +
        "difficult or impossible to predict the required number of steps, and where you cannot hardcode " +
        "a fixed path. The smolagents documentation reaches the same place from a worked example — a " +
        "surfing-trip booking site where requests fall into two known buckets can just be coded, giving " +
        "a fully reliable system with no risk from unpredictable LLM behaviour, and its advice is to " +
        "\"regularize towards not using any agentic behaviour\". Its counter-example is a request that " +
        "hinges on many factors at once — a passport delay, a date change, cancellation insurance — " +
        "where no predetermined criterion suffices. That is the test. **Can you write the steps down in " +
        "advance? Then write them down.**",
    },
    {
      kind: "compare",
      title: "Which rung",
      columns: [
        {
          label: "Stay low",
          items: [
            "You can list the steps in advance",
            "The same shape of request arrives every time",
            "Latency matters — somebody is waiting",
            "Being wrong is expensive, and a fixed path is auditable",
            "There is nothing to discover: everything needed is already in the request",
          ],
        },
        {
          label: "Climb",
          items: [
            "The number of steps genuinely cannot be predicted",
            "What to do next depends on what the previous step returned",
            "The request space is open-ended and new shapes keep arriving",
            "A human doing this job would also have to investigate rather than follow a list",
            "You have the budget, the latency headroom and the observability to run it honestly",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Building an agent because agents are interesting — the cost lands on every request, and the interest wears off during the first latency complaint.",
        "Calling a fixed two-step pipeline an agent — if your code decides the order, it is a workflow, and that is a compliment rather than a criticism.",
        "Ignoring the reliability multiplication — four steps at 97% is 89%, and nobody notices until the eleven per cent starts writing in.",
        "Climbing a rung to avoid writing an if statement — a router that exists because nobody wanted to enumerate three cases is more fragile than the three cases.",
        "Starting at multi-agent — one agent with good tools beats three agents coordinating badly, and module 5 is honest about how often that is the real comparison.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Agency is a spectrum, not a category: simple processor → router → tool call → multi-step agent → multi-agent (smolagents).",
        "The dividing line: a workflow has LLMs orchestrated through predefined code paths; an agent has the LLM directing its own process (Anthropic).",
        "Agentic systems trade latency and cost for task performance. It is a trade, so make it deliberately.",
        "Reliability multiplies down: 0.97 to the power of four is 0.885.",
        "If you can write the steps down in advance, write them down. Agents are for when you genuinely cannot.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"When would you not use an agent?\" is asked constantly, and a candidate who answers it well is immediately more credible than one who only knows how to build them.",
        "Quoting the reliability multiplication with a number is a strong move. It shows you think about systems, not demos.",
        "Expect to be asked to classify a described system on the spectrum. Naming who decides what happens next — your code or the model — is the crisp way to answer.",
      ],
    },
    {
      kind: "quiz",
      question: "Your code classifies a ticket with one LLM call, then routes it through one of three fixed handlers. Where is this on the ladder?",
      options: [
        "A multi-step agent, because an LLM is making a decision and so it must be choosing its own path",
        "A router — an LLM output controls an if/else switch, and nothing more",
        "A multi-agent system",
        "Not agentic at all",
      ],
      answer: 1,
      why:
        "The model decides a branch; your code decides everything else, including that there are exactly " +
        "three handlers and that the run ends after one. Anthropic would call this a workflow: LLMs " +
        "orchestrated through predefined code paths.",
    },
    {
      kind: "quiz",
      question: "Four independent steps each succeed 97% of the time. What is the end-to-end success rate?",
      options: ["97%", "about 94%", "about 89%", "about 100% — the errors cancel out"],
      answer: 2,
      why:
        "0.97⁴ ≈ 0.885. Reliability multiplies down with every step, which is the least glamorous and most " +
        "important argument for keeping the number of steps small.",
    },
    {
      kind: "quiz",
      question: "Which of these is the clearest case for climbing to a multi-step agent?",
      options: [
        "Summarising every incoming support email into three bullet points, whatever it happens to say",
        "Routing a request to one of two known departments",
        "Investigating why a payment failed, where each check depends on what the last one returned",
        "Translating a page into Marathi",
      ],
      answer: 2,
      why:
        "The number of steps cannot be predicted and each one depends on the previous result — exactly " +
        "the open-ended case Anthropic describes, where you cannot hardcode a fixed path. The other three " +
        "have paths you can write down in advance.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take a feature you want to build and answer the four ladder questions honestly. Then argue for one rung lower.",
        "Work out the end-to-end reliability of your design and decide what happens to the requests in the remainder.",
        "Write down the fixed path for your task. If you can write it, you have just saved yourself an agent.",
        "Find something you have seen built as an agent that did not need to be, and name the rung it should have been on.",
      ],
    },
  ],
};
