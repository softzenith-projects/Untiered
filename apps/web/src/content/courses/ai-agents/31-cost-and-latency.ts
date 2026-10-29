import type { Chapter } from "@/content/courses/types";

export const chapterCostAndLatency: Chapter = {
  slug: "cost-and-latency",
  title: "Cost and Latency",
  summary:
    "The context is re-sent every turn, so an agent's cost grows with the square of its length. Latency " +
    "has three separate parts and only two of them respond to anything you do to the prompt.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Two numbers decide whether a working agent is a shippable one, and both behave in ways that " +
        "surprise people. Cost does not grow linearly with the number of turns — it grows faster, " +
        "because every turn re-sends everything before it. And latency is not one number but three, " +
        "which respond to completely different interventions. Get both wrong and you have a demo that " +
        "everyone loves and nobody can afford to run.",
    },
    { kind: "h", text: "The picture: the meeting that keeps recapping" },
    {
      kind: "analogy",
      title: "\"Let me just bring everyone up to speed\" — every five minutes",
      text:
        "A meeting where, before each new point, somebody recaps everything discussed so far. The first " +
        "recap takes ten seconds. The sixth takes four minutes, and by then most of the meeting is " +
        "recaps. Nobody planned this; it is what you get when every contribution must be preceded by " +
        "the whole history. That is an agent loop, exactly. Turn one sends a small context; turn twelve " +
        "sends everything from turns one to eleven plus the system prompt plus every tool definition. " +
        "Where the analogy stops: the humans would eventually get annoyed and stop recapping. The model " +
        "cannot — it has no memory, so the recap *is* the memory, and removing it removes the agent's " +
        "ability to work.",
    },
    {
      kind: "concept",
      title: "Quadratic context cost",
      text:
        "Across an n-turn run, the total input tokens grow roughly with n² rather than n, because turn " +
        "k sends everything from turns 1 to k−1 again. Two consequences worth internalising: the last " +
        "turn of a long run is by far the most expensive one, and anything you remove from the fixed " +
        "overhead — the system prompt, the tool definitions — is saved once per turn, so on a twelve-turn " +
        "run you save it twelve times.",
    },
    {
      kind: "code",
      caption: "Where the money goes across a run. The per-token prices are illustrative placeholders; the growth curve is the real lesson.",
      code:
        "IN_PER_1K = 0.15     # illustrative, not a real price\n" +
        "OUT_PER_1K = 0.60    # illustrative, not a real price\n" +
        "\n" +
        "system = 400\n" +
        "tools = 900\n" +
        "history_growth = 350   # each turn adds roughly this much\n" +
        "output = 250\n" +
        "\n" +
        "\n" +
        "def run_cost(turns):\n" +
        "    total_in = 0\n" +
        "    for turn in range(turns):\n" +
        "        context = system + tools + history_growth * turn\n" +
        "        total_in += context\n" +
        "    total_out = output * turns\n" +
        "    return total_in, total_out, (total_in / 1000) * IN_PER_1K + (total_out / 1000) * OUT_PER_1K\n" +
        "\n" +
        "\n" +
        "print(f\"{'turns':>5} {'input tok':>10} {'output tok':>11} {'cost':>8}  {'per turn':>9}\")\n" +
        "for turns in [1, 2, 4, 8, 12]:\n" +
        "    tin, tout, cost = run_cost(turns)\n" +
        '    print(f"{turns:5d} {tin:10d} {tout:11d} {cost:8.4f}  {cost / turns:9.4f}")\n' +
        "\n" +
        "print()\n" +
        'print("Turn 12 alone re-sends", system + tools + history_growth * 11, "input tokens.")\n' +
        'print("Halving the tool definitions saves", 450 * 12, "input tokens across a 12-turn run.")\n',
      output:
        "turns  input tok  output tok     cost   per turn\n" +
        "    1       1300         250   0.3450     0.3450\n" +
        "    2       2950         500   0.7425     0.3712\n" +
        "    4       7300        1000   1.6950     0.4237\n" +
        "    8      20200        2000   4.2300     0.5287\n" +
        "   12      38700        3000   7.6050     0.6338\n" +
        "\n" +
        "Turn 12 alone re-sends 5150 input tokens.\n" +
        "Halving the tool definitions saves 5400 input tokens across a 12-turn run.",
    },
    {
      kind: "p",
      text:
        "The per-turn column is the one to look at. A twelve-turn run costs nearly twice as much *per " +
        "turn* as a one-turn call, before you have added a single feature. And notice the last line: " +
        "halving the tool definitions — which chapter 13 said was worth spending tokens on for clarity " +
        "— saves 5,400 input tokens on one twelve-turn run. Both things are true. Write tool " +
        "descriptions that are *clear*, not long, and delete the tools nobody uses.",
    },
    { kind: "h", text: "Latency has three parts" },
    {
      kind: "code",
      caption: "Which part of a turn dominates, under four different shapes. The rates are illustrative; the relative behaviour is what to take away.",
      code:
        "def turn_seconds(context_tokens, output_tokens, tool_ms):\n" +
        "    prefill = context_tokens / 3000        # tokens the model reads, per second\n" +
        "    decode = output_tokens / 80            # tokens it writes, per second\n" +
        "    tool = tool_ms / 1000\n" +
        "    return prefill, decode, tool\n" +
        "\n" +
        "\n" +
        "scenarios = {\n" +
        '    "short context, short answer": (1300, 120, 150),\n' +
        '    "long context, short answer":  (9000, 120, 150),\n' +
        '    "short context, long answer":  (1300, 900, 150),\n' +
        '    "short context, slow tool":    (1300, 120, 2500),\n' +
        "}\n" +
        "\n" +
        "print(f\"{'scenario':30} {'prefill':>8} {'decode':>7} {'tool':>6} {'total':>7}\")\n" +
        "for label, args in scenarios.items():\n" +
        "    p, d, t = turn_seconds(*args)\n" +
        '    print(f"{label:30} {p:8.2f} {d:7.2f} {t:6.2f} {p + d + t:7.2f}")\n' +
        "\n" +
        "print()\n" +
        'print("Decoding is per token and cannot be parallelised: a long answer is slow, always.")\n' +
        'print("A slow tool is slow whatever you do to the prompt.")\n',
      output:
        "scenario                        prefill  decode   tool   total\n" +
        "short context, short answer        0.43    1.50   0.15    2.08\n" +
        "long context, short answer         3.00    1.50   0.15    4.65\n" +
        "short context, long answer         0.43   11.25   0.15   11.83\n" +
        "short context, slow tool           0.43    1.50   2.50    4.43\n" +
        "\n" +
        "Decoding is per token and cannot be parallelised: a long answer is slow, always.\n" +
        "A slow tool is slow whatever you do to the prompt.",
    },
    {
      kind: "compare",
      title: "The three parts, and what actually shortens each",
      columns: [
        {
          label: "Prefill — reading the context",
          items: [
            "Grows with context length, and the attention part grows with its square (chapter 5)",
            "Shortened by: smaller prompts, fewer tools, retrieving less, summarising history",
            "Often cacheable across turns when the prefix is stable — which is an argument for a fixed system prompt",
          ],
        },
        {
          label: "Decode — writing the answer",
          items: [
            "One token at a time, sequentially. This is the part that cannot be parallelised.",
            "Shortened by: asking for shorter output. That is essentially the only lever.",
            "Streaming does not make it faster; it makes the wait *feel* shorter, which is worth a great deal",
          ],
        },
        {
          label: "Tools — waiting for your systems",
          items: [
            "Entirely yours: a slow database is slow no matter what the model does",
            "Shortened by: caching, indexes, running independent tool calls concurrently",
            "Easy to forget, and frequently the largest number in a real trace",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Set `max_output` to 120 and re-run: the single biggest latency win is usually asking for a shorter answer. Then make the tool slow and watch the prompt work stop mattering.",
      starter:
        "context_tokens = 4000\n" +
        "max_output = 900\n" +
        "tool_ms = 150\n" +
        "turns = 5\n" +
        "\n" +
        "PREFILL_PER_SEC = 3000\n" +
        "DECODE_PER_SEC = 80\n" +
        "\n" +
        "prefill = context_tokens / PREFILL_PER_SEC\n" +
        "decode = max_output / DECODE_PER_SEC\n" +
        "tool = tool_ms / 1000\n" +
        "per_turn = prefill + decode + tool\n" +
        "\n" +
        'print(f"prefill {prefill:5.2f}s   decode {decode:5.2f}s   tool {tool:5.2f}s")\n' +
        'print(f"per turn {per_turn:.2f}s, {turns} turns -> {per_turn * turns:.1f}s total\\n")\n' +
        "\n" +
        "biggest = max(\n" +
        '    [("prefill", prefill), ("decode", decode), ("tool", tool)],\n' +
        "    key=lambda p: p[1],\n" +
        ")\n" +
        'print(f"Biggest share: {biggest[0]} ({biggest[1] / per_turn:.0%} of every turn).")\n' +
        "fixes = {\n" +
        '    "prefill": "shorten the prompt, drop unused tools, retrieve less",\n' +
        '    "decode": "ask for a shorter answer -- this is almost the only lever",\n' +
        '    "tool": "cache it, index it, or run independent calls concurrently",\n' +
        "}\n" +
        'print("Fix:", fixes[biggest[0]])\n',
      expectedOutput:
        "prefill  1.33s   decode 11.25s   tool  0.15s\n" +
        "per turn 12.73s, 5 turns -> 63.7s total\n" +
        "\n" +
        "Biggest share: decode (88% of every turn).\n" +
        "Fix: ask for a shorter answer -- this is almost the only lever",
    },
    {
      kind: "steps",
      title: "Cutting the bill, in order of what usually pays most",
      steps: [
        { label: "Fewer turns", text: "Chapter 16's question again. A workflow that does it in two calls beats an agent that does it in six, and the saving is quadratic." },
        { label: "Trim the fixed overhead", text: "System prompt and tool definitions are re-sent every turn. Deleting an unused tool is a saving multiplied by every turn of every run." },
        { label: "Summarise instead of accumulating", text: "Replace the oldest turns with a summary at a checkpoint (chapter 21) rather than carrying the whole transcript forever." },
        { label: "Route by difficulty", text: "Most requests do not need your most capable model. Chapter 23's arithmetic was 12 units against 28." },
        { label: "Cap the output", text: "The single biggest latency lever, and it costs output tokens, which are usually the dearer kind." },
        { label: "Then look at the tools", text: "In a real trace the slowest thing is often your own database. Measure before you optimise the prompt." },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Budgeting an agent as though it were one call — a twelve-turn run costs far more than twelve times a one-turn call, because of the re-sent context.",
        "Leaving unused tools registered — every one is re-sent on every turn of every run, and nobody notices because it is small each time.",
        "Optimising the prompt when the slow part is your database — measure the three parts before choosing what to fix.",
        "Assuming streaming made it faster — it did not; it changed when the user starts seeing output, which is a real product win and not a latency one.",
        "Forgetting retries multiply — a run that fails at step five and retries has paid for five turns twice.",
        "No per-run cost or duration in the trace — without them you cannot find the expensive cases, and the expensive cases are never the ones you expect.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Context is re-sent every turn, so an n-turn run costs roughly n² in input tokens, not n.",
        "Fixed overhead — system prompt, tool definitions — is paid once per turn. Trimming it is a saving multiplied by every turn.",
        "Latency is prefill, decode and tool time. They respond to three different fixes.",
        "Decode is sequential and the only real lever is a shorter answer. Streaming changes the feel, not the time.",
        "Measure before optimising: in real traces, the slowest part is often your own systems.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Your agent costs too much — what do you do?\" Fewer turns first, then the fixed overhead, then routing by difficulty. The quadratic point is what makes the answer sound experienced.",
        "Splitting latency into prefill, decode and tool time, and naming a different fix for each, is a strong practical answer.",
        "Saying that you would measure before optimising, and that it is often the database, gets nods from anybody who has run one of these.",
      ],
    },
    {
      kind: "quiz",
      question: "Why does a 12-turn agent run cost more than 12 times a single call?",
      options: [
        "Long runs are billed at a higher rate per token, so every extra turn is priced above the turn before it",
        "Each turn re-sends the whole context so far, so input tokens grow roughly with the square of the turns",
        "The model gets slower as it works",
        "Retries are included in the price",
      ],
      answer: 1,
      why:
        "Turn 12 sends the system prompt, the tool definitions and every previous turn. Summed across " +
        "the run that is quadratic growth, which is why reducing the number of turns is the highest-value " +
        "change available.",
    },
    {
      kind: "quiz",
      question: "Your agent takes 12 seconds a turn. Prefill is 1.3s, decode is 10.5s, tools are 0.2s. What do you change?",
      options: [
        "Shorten the system prompt",
        "Cache the tool results",
        "Ask for a shorter answer — decode is sequential and dominates the turn",
        "Switch to a model with a larger context window, which lets the model generate its answer sooner",
      ],
      answer: 2,
      why:
        "Decode is nearly ninety per cent of the turn, it is one token at a time, and the only real lever " +
        "on it is generating fewer tokens. Shortening the prompt would attack the 1.3 seconds.",
    },
    {
      kind: "quiz",
      question: "You remove a tool nobody uses from the registry. What do you save?",
      options: [
        "Nothing, because a tool definition only costs anything on the turns where the model actually calls it",
        "Its definition's tokens, once per turn, on every run — which is a saving multiplied by every turn",
        "Only the storage of the tool definition",
        "One model call per run",
      ],
      answer: 1,
      why:
        "Tool definitions are part of the context and are re-sent on every turn. A small per-turn saving " +
        "multiplied by every turn of every run is one of the cheapest real wins available.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Estimate your own system's cost for a one-turn call and an eight-turn run. The ratio is usually worse than people guess.",
        "Count the tokens in your tool definitions and multiply by your average turns per run. Then delete the tools nobody calls.",
        "Split one real turn into prefill, decode and tool time. Whichever is biggest is the only one worth optimising first.",
        "Work out what a retry at step five costs you, and whether your retry policy knows that.",
      ],
    },
  ],
};
