import type { Chapter } from "@/content/courses/types";

export const chapterObservationsAndRecovery: Chapter = {
  slug: "observations-and-recovery",
  title: "Observations: How an Agent Corrects Itself",
  summary:
    "An agent's next move is a function of its context. If nothing new enters the context, nothing new " +
    "comes out — which is why an agent that cannot see its own results repeats itself until stopped.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Chapter 12 said the observation is the part that does the work. This chapter is that sentence " +
        "taken seriously. An agent's next action is a function of one thing: what is in its context. " +
        "Observations are the only channel by which anything from outside gets in there. Which leads " +
        "straight to a result that sounds obvious written down and surprises everyone in practice: " +
        "**remove the observations and the agent cannot advance, cannot correct itself, and will make " +
        "the same call for ever.**",
    },
    { kind: "h", text: "The picture: the darts player with the lights off" },
    {
      kind: "analogy",
      title: "Throwing darts in the dark",
      text:
        "A good darts player throws, sees where it landed, and adjusts — a little lower, a little left. " +
        "Turn the lights off and hand her the same darts. She is exactly as skilled as before, her aim " +
        "is exactly as good, and she will throw the second dart the same way as the first, because " +
        "nothing has told her to do otherwise. She is not getting worse; she is getting no information. " +
        "Every dart is the first dart. That is an agent whose observations are missing, truncated, " +
        "unreadable or uselessly vague. Where the analogy stops: the player knows the lights are off. " +
        "An agent has no way to notice that it is not receiving feedback, so it does not slow down, " +
        "hedge, or ask. It just throws again, confidently, until the step limit.",
    },
    {
      kind: "concept",
      title: "Observation",
      text:
        "The result of an action, put back into the model's context as text. It is the only path by " +
        "which anything outside the model reaches it. Anthropic's *Building Effective Agents* describes " +
        "agents as needing **ground truth from the environment at each step** — tool results, code " +
        "execution — to assess their own progress. \"Ground truth\" is the right phrase: it is the one " +
        "part of the context that was not produced by predicting text.",
    },
    { kind: "h", text: "Turn the lights off" },
    {
      kind: "p",
      text:
        "The lab below is a four-step helpdesk task, and every step exists because of what the previous " +
        "one returned. Run it once as it stands and read the thoughts in order. Then **switch off \"show " +
        "the agent what its actions returned\"** and run it again.",
    },
    { kind: "agentlab", scenarioId: "helpdesk-reset" },
    {
      kind: "p",
      text:
        "In the first run, step 2 happens because step 1 came back with a *misspelled* address — " +
        "`ravi.k@exampel.com`. Step 3 happens because step 2 said the mail bounced with \"domain not " +
        "found\". Step 4 happens because step 3 fixed the address. Take the observations away and none " +
        "of that reasoning is available: the agent calls `find_user` and, since nothing changed in its " +
        "context, calls `find_user` again. And again. It has four tools and uses one, for ever, until " +
        "the limit ends it.",
    },
    {
      kind: "code",
      caption: "The same plan run twice, once with observations and once without. Scripted Python — no model, but the mechanism is real.",
      code:
        "# An agent's next move is a function of its context. Take the observation away\n" +
        "# and the context stops changing -- so the next move stops changing too.\n" +
        "STEPS = [\n" +
        '    ("find_user", {"email": "ravi.k@example.com"},\n' +
        '     {"user_id": "U-2290", "email_on_file": "ravi.k@exampel.com"}),\n' +
        '    ("check_email_log", {"user_id": "U-2290"},\n' +
        '     {"to": "ravi.k@exampel.com", "delivery": "bounced: domain not found"}),\n' +
        '    ("update_email", {"user_id": "U-2290", "email": "ravi.k@example.com"},\n' +
        '     {"updated": True}),\n' +
        '    ("resend_reset", {"user_id": "U-2290"},\n' +
        '     {"delivery": "delivered"}),\n' +
        "]\n" +
        "\n" +
        "\n" +
        "def run(show_observations, max_steps=6):\n" +
        "    context = []            # everything the agent can see\n" +
        "    cursor = 0              # which planned step it is on\n" +
        "    for step in range(1, max_steps + 1):\n" +
        "        name, args, result = STEPS[cursor]\n" +
        '        print(f"  step {step}: {name}({args})")\n' +
        "        if show_observations:\n" +
        '            print(f"           -> {result}")\n' +
        "            context.append(result)\n" +
        "            cursor += 1\n" +
        "            if cursor == len(STEPS):\n" +
        '                print("  ANSWER: address was misspelled, corrected it, resend delivered.")\n' +
        "                return\n" +
        "        else:\n" +
        '            print("           -> (hidden from the agent)")\n' +
        "            # Nothing new entered the context, so the next turn is identical.\n" +
        '    print(f"  stopped at the step limit with {len(context)} observations")\n' +
        "\n" +
        "\n" +
        'print("observations shown:")\n' +
        "run(show_observations=True)\n" +
        'print("\\nobservations hidden:")\n' +
        "run(show_observations=False)\n",
      output:
        "observations shown:\n" +
        "  step 1: find_user({'email': 'ravi.k@example.com'})\n" +
        "           -> {'user_id': 'U-2290', 'email_on_file': 'ravi.k@exampel.com'}\n" +
        "  step 2: check_email_log({'user_id': 'U-2290'})\n" +
        "           -> {'to': 'ravi.k@exampel.com', 'delivery': 'bounced: domain not found'}\n" +
        "  step 3: update_email({'user_id': 'U-2290', 'email': 'ravi.k@example.com'})\n" +
        "           -> {'updated': True}\n" +
        "  step 4: resend_reset({'user_id': 'U-2290'})\n" +
        "           -> {'delivery': 'delivered'}\n" +
        "  ANSWER: address was misspelled, corrected it, resend delivered.\n" +
        "\n" +
        "observations hidden:\n" +
        "  step 1: find_user({'email': 'ravi.k@example.com'})\n" +
        "           -> (hidden from the agent)\n" +
        "  step 2: find_user({'email': 'ravi.k@example.com'})\n" +
        "           -> (hidden from the agent)\n" +
        "  step 3: find_user({'email': 'ravi.k@example.com'})\n" +
        "           -> (hidden from the agent)\n" +
        "  step 4: find_user({'email': 'ravi.k@example.com'})\n" +
        "           -> (hidden from the agent)\n" +
        "  step 5: find_user({'email': 'ravi.k@example.com'})\n" +
        "           -> (hidden from the agent)\n" +
        "  step 6: find_user({'email': 'ravi.k@example.com'})\n" +
        "           -> (hidden from the agent)\n" +
        "  stopped at the step limit with 0 observations",
    },
    { kind: "h", text: "You will not switch observations off. You will do worse things." },
    {
      kind: "p",
      text:
        "Nobody sets a flag called \"hide the observations\". The failure arrives in disguises, and all " +
        "of them are ordinary engineering decisions that looked sensible at the time.",
    },
    {
      kind: "table",
      head: ["The disguise", "What it looks like in the trace", "What to do instead"],
      rows: [
        [
          "Swallowing the exception",
          "The tool errors, your code catches it and appends nothing. The agent retries the identical call.",
          "Return the error as an observation, with what was expected — the MCP specification's tool execution errors exist for exactly this.",
        ],
        [
          "Truncating from the wrong end",
          "A 4,000-token log cut to its first 200, and the line that mattered was at the bottom.",
          "Summarise with the goal in mind, or filter to the relevant rows, rather than slicing blindly.",
        ],
        [
          "Returning a status with no content",
          "\"ok: true\" — technically an observation, carrying nothing the next step can use.",
          "Return the fields the next step will actually need. An observation that changes nothing is a wasted turn.",
        ],
        [
          "A generic error string",
          "\"Error\" or \"400\", repeated, with the agent trying the same arguments each time.",
          "Say what was wrong and what would be right. This is the difference you can watch in the tool-description lab.",
        ],
        [
          "Dropping old turns to save tokens",
          "The observation from step 2 falls out of the window, and step 6 re-does step 2.",
          "Summarise the trace deliberately, keeping the facts that were discovered. Never let the window decide what to forget.",
        ],
      ],
    },
    { kind: "h", text: "Observations fill the window faster than anything else" },
    {
      kind: "p",
      text:
        "There is a real tension here and it is worth being straight about it. Observations are how the " +
        "loop learns, and they are also, usually, the biggest thing in the context — a database row is " +
        "small, but a log, a search result set or an HTML page is not. Truncating is not optional " +
        "forever. The rule is: **truncate on purpose, towards the goal, and never by accident.**",
    },
    {
      kind: "code",
      caption: "Two ways to fit observations into a budget. Arithmetic on invented sizes, but the choice is the real one you face.",
      code:
        "observations = [\n" +
        '    ("find_user",       120),\n' +
        '    ("check_email_log", 4200),   # a whole log, most of it irrelevant\n' +
        '    ("update_email",     80),\n' +
        '    ("resend_reset",    110),\n' +
        "]\n" +
        "\n" +
        "BUDGET = 2000\n" +
        "\n" +
        "\n" +
        "def keep_whole(obs, budget):\n" +
        "    used, kept = 0, []\n" +
        "    for name, size in obs:\n" +
        "        if used + size > budget:\n" +
        "            kept.append((name, 0))     # dropped entirely\n" +
        "        else:\n" +
        "            kept.append((name, size))\n" +
        "            used += size\n" +
        "    return kept, used\n" +
        "\n" +
        "\n" +
        "def summarise_big(obs, budget, cap=300):\n" +
        "    used, kept = 0, []\n" +
        "    for name, size in obs:\n" +
        "        size = min(size, cap)          # keep only the part that mattered\n" +
        "        kept.append((name, size))\n" +
        "        used += size\n" +
        "    return kept, used\n" +
        "\n" +
        "\n" +
        'for label, fn in [("keep whole, drop what does not fit", keep_whole),\n' +
        '                  ("summarise anything over 300 tokens", summarise_big)]:\n' +
        "    kept, used = fn(observations, BUDGET)\n" +
        "    lost = [n for n, s in kept if s == 0]\n" +
        '    print(f"{label}:")\n' +
        '    print(f"  {used} of {BUDGET} tokens used, {len(lost)} observation(s) lost entirely {lost}")\n',
      output:
        "keep whole, drop what does not fit:\n" +
        "  310 of 2000 tokens used, 1 observation(s) lost entirely ['check_email_log']\n" +
        "summarise anything over 300 tokens:\n" +
        "  610 of 2000 tokens used, 0 observation(s) lost entirely []",
    },
    {
      kind: "p",
      text:
        "The first strategy fits comfortably inside the budget and throws away the single observation " +
        "the task depended on — the mail log, which is where the bounce was. It used fewer tokens and " +
        "lost the answer. The second uses twice as many tokens, stays well under budget, and keeps " +
        "something from every step. Cheapest is not the same as best when what you dropped was the fact.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Change `cap` to 50 and re-run. At what point does summarising start throwing away the line that mattered? That is the question this decision really is.",
      starter:
        "observations = [\n" +
        '    ("find_user",       120),\n' +
        '    ("check_email_log", 4200),\n' +
        '    ("update_email",     80),\n' +
        '    ("resend_reset",    110),\n' +
        "]\n" +
        "\n" +
        "BUDGET = 2000\n" +
        "cap = 300\n" +
        "\n" +
        "total = 0\n" +
        "for name, size in observations:\n" +
        "    kept = min(size, cap)\n" +
        "    total += kept\n" +
        '    note = "" if kept == size else f"  (cut from {size})"\n' +
        '    print(f"{name:18} {kept:5d} tokens{note}")\n' +
        "\n" +
        'print(f"\\ntotal {total} of {BUDGET}", "-- fits" if total <= BUDGET else "-- OVER BUDGET")\n',
      expectedOutput:
        "find_user            120 tokens\n" +
        "check_email_log      300 tokens  (cut from 4200)\n" +
        "update_email          80 tokens\n" +
        "resend_reset         110 tokens\n" +
        "\n" +
        "total 610 of 2000 -- fits",
    },
    {
      kind: "pitfall",
      items: [
        "Catching an exception and appending nothing — the agent sees an unchanged context and retries the identical call, which is the darts-in-the-dark failure with a try/except around it.",
        "Truncating a log from the top — the interesting line in a log is almost always near the bottom, and blind slicing removes exactly the part the agent needed.",
        "Returning only a status flag — \"ok: true\" is an observation that carries nothing, so the next turn has no more to work with than the last one.",
        "Letting the context window silently drop an old observation — the agent will re-discover it, spending a whole turn learning something it already knew.",
        "Summarising an observation with a generic summariser — a summary written without the goal in mind drops the one field the next step needed.",
      ],
    },
    {
      kind: "remember",
      items: [
        "The next action is a function of the context. If nothing new enters, nothing new comes out.",
        "Observations are the only channel from the outside world into the model, and the only ground truth in the context.",
        "Errors are observations. Swallowing one is the same as turning the lights off.",
        "Observations are usually the biggest thing in the context. Truncate towards the goal, deliberately — never by accident and never from the wrong end.",
        "An agent cannot tell that it is receiving no feedback. It will repeat itself confidently until a limit stops it.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Your agent keeps making the same call — what is happening?\" The answer is almost always that nothing new is reaching its context, and the usual cause is a swallowed error.",
        "Expect a question about context growth. Saying that observations dominate the window, and that you summarise towards the goal rather than truncating, is the practical answer.",
        "\"What do you return when a tool fails?\" — an actionable error, as an observation, so the agent can self-correct. This is exactly what the MCP specification recommends.",
      ],
    },
    {
      kind: "quiz",
      question: "An agent calls the same tool with the same arguments five turns in a row. What is the most likely cause?",
      options: [
        "The model is too small to remember the arguments it used on the previous turns of the loop",
        "The temperature is too low",
        "Nothing new is entering its context — the result or the error is not being fed back",
        "The tool is too slow, so the model keeps timing out and asking for the same result again",
      ],
      answer: 2,
      why:
        "The next action depends on the context. If the context looks the same at turn five as at turn " +
        "one, the most likely continuation is the same action. The usual culprit is a caught exception " +
        "that appended nothing.",
    },
    {
      kind: "quiz",
      question: "A tool returns a 4,000-token log and your budget is 2,000. What is the best approach?",
      options: [
        "Drop the observation entirely to stay under budget",
        "Keep the first 200 tokens and discard the rest, since logs always put the important lines at the start",
        "Summarise or filter it towards what the goal needs, keeping the lines that matter",
        "Raise the budget and send all of it, every turn, for the rest of the run",
      ],
      answer: 2,
      why:
        "Dropping it loses the fact. Keeping the first 200 tokens usually loses it too, since logs put " +
        "the interesting part at the end. Sending all 4,000 on every subsequent turn is the expensive " +
        "option and crowds out everything else.",
    },
    {
      kind: "quiz",
      question: "Why is a swallowed exception worse than a returned error?",
      options: [
        "It is slower, because the exception has to be caught and thrown away before the next turn can begin",
        "The agent sees an unchanged context, so it cannot know anything went wrong and repeats the call",
        "It breaks the tool registry",
        "It uses more tokens",
      ],
      answer: 1,
      why:
        "A returned error is information the agent can act on — the tool-description lab shows exactly " +
        "that recovery. A swallowed one leaves the context identical to the turn before, which is " +
        "indistinguishable, from the agent's side, from never having acted at all.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "In the lab, hide the observations and count how many of the four tools the agent ever reaches. Then predict what a step limit of 12 would change.",
        "Find a place in code you have written where an exception is caught and nothing is reported onward. Write the observation it should have returned instead.",
        "Take a verbose API response you know and write the summary an agent would actually need. Note which fields you kept and why.",
        "Design the observation for a tool that returns 500 search results. What does the agent see, and how do you decide which ones?",
      ],
    },
  ],
};
