import type { Chapter } from "@/content/courses/types";

export const chapterParallelisation: Chapter = {
  slug: "parallelisation",
  title: "Parallelisation: Sectioning and Voting",
  summary:
    "Two different reasons to run several calls at once — split the work into independent parts, or ask " +
    "the same question repeatedly and count the answers. They buy completely different things.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "Anthropic's *Building Effective Agents* lists parallelisation as one pattern with two " +
        "variations, and keeping them separate in your head is most of the value of the chapter. " +
        "**Sectioning** breaks a task into independent subtasks run simultaneously. **Voting** runs the " +
        "same task several times to get diverse outputs. One buys you speed and separation of concerns; " +
        "the other buys you confidence. They are not interchangeable and the mistake is using the word " +
        "\"parallel\" for both and then wondering why the second one did not get faster.",
    },
    { kind: "h", text: "The picture: two kitchens" },
    {
      kind: "analogy",
      title: "Four cooks on four dishes, and four tasters on one",
      text:
        "In the first kitchen, four cooks each make a different dish at the same time. Dinner is ready " +
        "when the slowest dish is done rather than when the last of four consecutive dishes finishes, " +
        "and the total work is identical — four dishes, four cooks. That is sectioning. In the second " +
        "kitchen, four people each taste the *same* pot and say whether it needs salt. Nothing is faster " +
        "and you have spent four people's time on one pot; what you have bought is that if three of the " +
        "four say it needs salt, you can be fairly confident it does. That is voting. Where the analogy " +
        "stops: the four tasters have genuinely different palates. Four calls to the same model at " +
        "temperature zero are the same taster four times, and their unanimous agreement means nothing at all.",
    },
    { kind: "h", text: "Sectioning: the same cost, less waiting" },
    {
      kind: "code",
      caption: "What each variation actually buys. Illustrative durations; the arithmetic is the point. No calls are made.",
      code:
        "# Two shapes of parallel work: sectioning (different questions, run together)\n" +
        "# and voting (the same question, several times).\n" +
        'SECTION_SECONDS = {"toxicity check": 0.9, "PII check": 1.1, "answer": 2.4}\n' +
        "\n" +
        'print("SECTIONING -- different subtasks at once")\n' +
        'print(f"  sequential: {sum(SECTION_SECONDS.values()):.1f}s")\n' +
        'print(f"  parallel:   {max(SECTION_SECONDS.values()):.1f}s (the slowest one)")\n' +
        'print(f"  cost:       identical -- {len(SECTION_SECONDS)} calls either way\\n")\n' +
        "\n" +
        'print("VOTING -- the same subtask, several times")\n' +
        'votes = ["unsafe", "safe", "unsafe", "unsafe", "safe"]\n' +
        "for threshold in [1, 3, 5]:\n" +
        '    unsafe = votes.count("unsafe")\n' +
        '    verdict = "BLOCK" if unsafe >= threshold else "allow"\n' +
        '    print(f"  threshold {threshold}/5 unsafe votes -> {verdict}  (got {unsafe})")\n' +
        'print("  The threshold is a product decision, not a technical one.")\n',
      output:
        "SECTIONING -- different subtasks at once\n" +
        "  sequential: 4.4s\n" +
        "  parallel:   2.4s (the slowest one)\n" +
        "  cost:       identical -- 3 calls either way\n" +
        "\n" +
        "VOTING -- the same subtask, several times\n" +
        "  threshold 1/5 unsafe votes -> BLOCK  (got 3)\n" +
        "  threshold 3/5 unsafe votes -> BLOCK  (got 3)\n" +
        "  threshold 5/5 unsafe votes -> allow  (got 3)\n" +
        "  The threshold is a product decision, not a technical one.",
    },
    {
      kind: "concept",
      title: "Sectioning",
      text:
        "Breaking a task into independent subtasks and running them simultaneously. Anthropic's examples " +
        "are exactly the ones you will want: implementing guardrails, where one model screens for " +
        "inappropriate content while another handles the core response; and automating evaluations, " +
        "where each call assesses a different aspect of performance. Its guidance is that " +
        "parallelisation is effective when the subtasks can be parallelised for speed, or when multiple " +
        "perspectives or attempts are needed.",
    },
    {
      kind: "p",
      text:
        "The guardrail example is the one to notice, because the benefit is not really speed. Asking one " +
        "call to both answer the question *and* check whether the question was acceptable is asking a " +
        "single context to hold two jobs with different success criteria — and the safety check is the " +
        "one that loses, because it is the smaller part of a prompt mostly about answering. Two separate " +
        "calls, each with one job, are easier to prompt, easier to test, and independently replaceable. " +
        "Running them at the same time just means you do not pay for that separation in latency.",
    },
    { kind: "h", text: "Voting: counting, and what the count is worth" },
    {
      kind: "concept",
      title: "Voting",
      text:
        "Running the same task several times and combining the results — usually by majority, sometimes " +
        "by a threshold that is deliberately not a majority. Anthropic's examples are reviewing code for " +
        "vulnerabilities with multiple prompts, and evaluating content appropriateness with different " +
        "vote thresholds. This is the same machinery as self-consistency from chapter 8, applied to a " +
        "decision rather than an answer.",
    },
    {
      kind: "p",
      text:
        "The threshold is where the thinking is. A majority is the obvious rule and it is often the " +
        "wrong one. For \"is this content harmful?\", one vote out of five may be enough to block, " +
        "because a false block is an inconvenience and a false allow is not. For \"should we issue this " +
        "refund automatically?\", you might want five out of five. **The threshold encodes which kind of " +
        "mistake you would rather make**, and writing it down forces somebody to decide that on purpose.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Set every vote to `\"unsafe\"` except one and see which thresholds still allow it. Then change `varied` to False — unanimous agreement from identical runs is worth nothing.",
      starter:
        'votes = ["unsafe", "safe", "unsafe", "unsafe", "safe"]\n' +
        "varied = True   # were these genuinely independent samples?\n" +
        "\n" +
        'unsafe = votes.count("unsafe")\n' +
        "n = len(votes)\n" +
        "\n" +
        "if not varied:\n" +
        '    print("WARNING: identical runs. Agreement here measures nothing.\\n")\n' +
        "\n" +
        "for name, threshold in [\n" +
        '    ("cautious (1 of 5)", 1),\n' +
        '    ("majority (3 of 5)", 3),\n' +
        '    ("unanimous (5 of 5)", 5),\n' +
        "]:\n" +
        '    verdict = "BLOCK" if unsafe >= threshold else "allow"\n' +
        '    print(f"{name:20} {verdict:5}  ({unsafe}/{n} said unsafe)")\n' +
        "\n" +
        'print("\\nWhich mistake would you rather make: blocking something fine,")\n' +
        'print("or allowing something harmful? That answer IS your threshold.")\n',
      expectedOutput:
        "cautious (1 of 5)    BLOCK  (3/5 said unsafe)\n" +
        "majority (3 of 5)    BLOCK  (3/5 said unsafe)\n" +
        "unanimous (5 of 5)   allow  (3/5 said unsafe)\n" +
        "\n" +
        "Which mistake would you rather make: blocking something fine,\n" +
        "or allowing something harmful? That answer IS your threshold.",
    },
    {
      kind: "compare",
      title: "Sectioning versus voting",
      columns: [
        {
          label: "Sectioning",
          items: [
            "Different subtasks, run at the same time",
            "Buys latency: you wait for the slowest, not the sum",
            "Cost unchanged — the same calls, differently scheduled",
            "Each call has one job, so each is easier to prompt and to test",
            "Needs the subtasks to be genuinely independent",
          ],
        },
        {
          label: "Voting",
          items: [
            "The same subtask, run several times",
            "Buys confidence: agreement across runs is a measurement, not a self-report",
            "Cost multiplies by the number of votes, and latency is the slowest run",
            "Needs real variation between runs — temperature zero makes this meaningless",
            "The threshold encodes which kind of mistake you prefer",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Voting at temperature zero — five identical runs produce unanimous agreement that measures nothing, and it looks like a very strong signal.",
        "Calling voting \"parallelisation for speed\" — it costs five times as much and is no faster than one call; what it buys is confidence.",
        "Sectioning subtasks that are not independent — if section B needs section A's answer, you have a chain, and running them together just means B ran on nothing.",
        "Defaulting the threshold to a majority — majority is a choice, and for a safety check it is usually the wrong one.",
        "Forgetting that latency is the slowest branch — one slow section holds up everything, so a three-second guardrail makes a one-second answer a three-second product.",
        "Running the guardrail after the answer — a check that happens after the response has been streamed to the user is not a guardrail.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Sectioning = different subtasks at once. Same cost, less waiting, and each call has one job.",
        "Voting = the same subtask several times. Multiplied cost, no speed gain, and confidence in return.",
        "Voting needs genuine variation between runs, or the agreement is an artefact.",
        "The voting threshold encodes which mistake you would rather make. Decide it deliberately.",
        "Parallel latency is the slowest branch, not the average — one slow section sets the pace.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How would you add a safety check without slowing the product down?\" — sectioning, with the guardrail running alongside the answer, is the expected answer.",
        "Being able to distinguish sectioning from voting, and say what each one costs and buys, is a clean way to show you have read the source rather than the summary.",
        "Expect a question about the threshold. Framing it as \"which error would you rather make\" rather than \"majority\" is the mature answer.",
      ],
    },
    {
      kind: "quiz",
      question: "You run the same classification five times at temperature 0 and all five agree. What have you learned?",
      options: [
        "That the answer is almost certainly correct, because five independent runs have all reached it",
        "Nothing — with no variation between runs, the agreement is an artefact of determinism",
        "That the model is confident",
        "That the threshold should be raised",
      ],
      answer: 1,
      why:
        "Voting works because independent samples that agree are evidence. Five identical runs are one " +
        "sample counted five times — and it looks like the strongest possible signal, which makes it " +
        "worse than no signal.",
    },
    {
      kind: "quiz",
      question: "Three sections take 0.9s, 1.1s and 2.4s. Run in parallel, how long does the whole thing take and what does it cost?",
      options: [
        "4.4s, and three calls",
        "2.4s, and three calls",
        "2.4s, and one call",
        "1.47s (the average), and three calls",
      ],
      answer: 1,
      why:
        "Parallel latency is the slowest branch; the cost is unchanged because the same three calls are " +
        "made either way. Sectioning buys time, never money.",
    },
    {
      kind: "quiz",
      question: "For a content-safety check, why might \"1 of 5 votes says unsafe\" be a better rule than a majority?",
      options: [
        "Because one vote is cheaper to compute than a majority, which needs every one of the five votes counted before it can decide",
        "Because a false block is an inconvenience while a false allow may not be — the threshold encodes which error you prefer",
        "Because majorities are statistically invalid",
        "Because safety models are usually wrong",
      ],
      answer: 1,
      why:
        "The threshold is where your tolerance for each kind of error is written down. Anthropic's own " +
        "example mentions evaluating content appropriateness with *different vote thresholds*, precisely " +
        "because a majority is not always what you want.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take a feature you would build and find two genuinely independent subtasks in it. If you cannot, it is a chain, not a section.",
        "For a decision your system makes, write down the threshold and the sentence that justifies it in terms of which error is worse.",
        "Work out your parallel latency: which branch is slowest, and what that does to the user's experience.",
        "Design the guardrail: what it checks, what happens when it fires, and how it runs without adding to the wait.",
      ],
    },
  ],
};
