import type { Chapter } from "@/content/courses/types";

export const chapterEvaluatorOptimiser: Chapter = {
  slug: "evaluator-optimiser",
  title: "Evaluator and Optimiser",
  summary:
    "One call produces, another judges against explicit criteria, and the feedback goes back round. It " +
    "works exactly as well as your criteria are clear — and no better.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "The last of the workflow patterns is a loop with two roles: one call generates, another " +
        "evaluates and gives feedback, and the generator tries again with that feedback in hand. It is " +
        "the most appealing pattern on the list — self-improvement, for free! — and it is the one with " +
        "the sharpest precondition. It works when you can say, clearly and in advance, what good looks " +
        "like. When you cannot, it produces a lot of confident feedback and a bill.",
    },
    { kind: "h", text: "The picture: the essay and the marking scheme" },
    {
      kind: "analogy",
      title: "Two kinds of feedback on a draft",
      text:
        "A student hands in an essay. The first teacher writes \"could be better\" at the bottom. The " +
        "student rewrites it, longer, and gets \"could be better\" again. The second teacher has a " +
        "marking scheme on the desk: must state a thesis in the first paragraph, must cite three " +
        "sources, must address the counter-argument. Her feedback is \"no counter-argument, and only two " +
        "sources\" — and the next draft fixes both, because both were named. Same student, same essay, " +
        "same number of rounds. The difference is entirely that the second teacher wrote down what she " +
        "was looking for before she started reading. Where the analogy stops: the first teacher at least " +
        "knows her feedback was vague. An evaluator model will produce confident, specific-sounding " +
        "criticism whether or not it has any criteria behind it, and the generator will dutifully act " +
        "on it.",
    },
    {
      kind: "concept",
      title: "Evaluator-optimiser",
      text:
        "One LLM generates a response while another evaluates it and provides feedback, in a loop. " +
        "Anthropic's guidance names the precondition plainly: it is particularly effective when we have " +
        "**clear evaluation criteria**, and when iterative refinement provides measurable value. Its " +
        "examples are literary translation, where nuanced feedback genuinely helps, and complex search " +
        "requiring multiple rounds of analysis.",
    },
    { kind: "h", text: "Criteria you can check are worth more than a judge" },
    {
      kind: "p",
      text:
        "The strongest version of this pattern is often not two models at all. If your criteria can be " +
        "expressed as code — a length, a required field, a schema, a regular expression, a test suite " +
        "that must pass — then the evaluator should be code. It is free, instant, perfectly consistent, " +
        "and its feedback is exact. Reach for a model as the evaluator only for the criteria that " +
        "genuinely need judgement, and even then, write the criteria down first.",
    },
    {
      kind: "code",
      caption:
        "An evaluator-optimiser loop where the evaluator is a list of checkable criteria. The drafts are hard-coded to stand in for three rounds — no model is called.",
      code:
        "CRITERIA = {\n" +
        '    "has a number": lambda t: any(c.isdigit() for c in t),\n' +
        '    "under 25 words": lambda t: len(t.split()) <= 25,\n' +
        '    "names the next step": lambda t: "next" in t.lower() or "will" in t.lower(),\n' +
        "}\n" +
        "\n" +
        "DRAFTS = [\n" +
        '    "Your refund is being processed and should arrive soon. Thank you for your patience with us "\n' +
        '    "during this time, we appreciate your understanding.",\n' +
        '    "Your refund of INR 3,499 is being processed. Thank you for your patience.",\n' +
        '    "Your refund of INR 3,499 was sent on 8 September and will reach your account within 3 days.",\n' +
        "]\n" +
        "\n" +
        "MAX_ROUNDS = 4\n" +
        "\n" +
        "for round_number, draft in enumerate(DRAFTS[:MAX_ROUNDS], start=1):\n" +
        "    failed = [name for name, check in CRITERIA.items() if not check(draft)]\n" +
        '    print(f"round {round_number}: {draft[:58]}...")\n' +
        "    if failed:\n" +
        "        print(f\"  REJECTED: {', '.join(failed)} -> send this feedback back and revise\")\n" +
        "    else:\n" +
        '        print("  ACCEPTED -- all criteria met")\n' +
        "        break\n" +
        "else:\n" +
        '    print(f"gave up after {MAX_ROUNDS} rounds. Return the best draft and say it was not accepted.")\n',
      output:
        "round 1: Your refund is being processed and should arrive soon. Tha...\n" +
        "  REJECTED: has a number, names the next step -> send this feedback back and revise\n" +
        "round 2: Your refund of INR 3,499 is being processed. Thank you for...\n" +
        "  REJECTED: names the next step -> send this feedback back and revise\n" +
        "round 3: Your refund of INR 3,499 was sent on 8 September and will ...\n" +
        "  ACCEPTED -- all criteria met",
    },
    {
      kind: "p",
      text:
        "Two details in that loop matter more than the criteria themselves. The feedback is **specific** " +
        "— \"has a number, names the next step\", not \"not good enough\" — which is the same principle " +
        "as every error message in this course. And there is a **round cap**, with a defined behaviour " +
        "when it is reached: return the best draft and say it was not accepted. An evaluator-optimiser " +
        "loop without a cap is chapter 14's pantry agent with better manners.",
    },
    {
      kind: "compare",
      title: "Who should be the evaluator?",
      columns: [
        {
          label: "Code",
          items: [
            "Schema valid, required fields present, length within bounds",
            "Tests pass, the code compiles, the JSON parses",
            "Every cited id was actually in the retrieved set",
            "Free, instant, perfectly consistent, and its feedback is exact",
          ],
        },
        {
          label: "A model",
          items: [
            "Is the tone right for an upset customer?",
            "Does this translation keep the register of the original?",
            "Is this explanation clear to somebody who does not know the jargon?",
            "Costs a call per round, and its judgement varies between runs",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add a criterion that is genuinely subjective — \"friendly tone\", say — and try to write it as a lambda. Where you get stuck is exactly where a model evaluator earns its cost.",
      starter:
        "CRITERIA = {\n" +
        '    "has a number": lambda t: any(c.isdigit() for c in t),\n' +
        '    "under 25 words": lambda t: len(t.split()) <= 25,\n' +
        '    "names the next step": lambda t: "next" in t.lower() or "will" in t.lower(),\n' +
        '    "no empty reassurance": lambda t: "soon" not in t.lower(),\n' +
        "}\n" +
        "\n" +
        "MAX_ROUNDS = 3\n" +
        "\n" +
        "drafts = [\n" +
        '    "Your refund is being processed and should arrive soon.",\n' +
        '    "Your refund of INR 3,499 is being processed and should arrive soon.",\n' +
        '    "Your refund of INR 3,499 was sent on 8 September and will arrive within 3 days.",\n' +
        "]\n" +
        "\n" +
        "best, fewest = None, len(CRITERIA) + 1\n" +
        "for i, draft in enumerate(drafts[:MAX_ROUNDS], start=1):\n" +
        "    failed = [name for name, check in CRITERIA.items() if not check(draft)]\n" +
        "    if len(failed) < fewest:\n" +
        "        best, fewest = draft, len(failed)\n" +
        '    print(f"round {i}: {len(failed)} failure(s) {failed}")\n' +
        "    if not failed:\n" +
        '        print("  accepted")\n' +
        "        break\n" +
        "else:\n" +
        '    print(f"\\nno draft passed in {MAX_ROUNDS} rounds.")\n' +
        '    print(f"best had {fewest} failure(s): {best}")\n',
      expectedOutput:
        "round 1: 3 failure(s) ['has a number', 'names the next step', 'no empty reassurance']\n" +
        "round 2: 2 failure(s) ['names the next step', 'no empty reassurance']\n" +
        "round 3: 0 failure(s) []\n" +
        "  accepted",
    },
    { kind: "h", text: "When this pattern lies to you" },
    {
      kind: "p",
      text:
        "There is a specific failure worth naming, because it feels like success. With vague criteria, " +
        "the evaluator produces feedback anyway — that is what a language model does — and the generator " +
        "produces a revision that addresses it. Round after round, the drafts change, the feedback " +
        "changes, everything looks like progress, and there is no evidence whatsoever that the output is " +
        "getting better. This is the same trap as chapter 4's self-reported confidence: the evaluation " +
        "and the thing being evaluated come out of the same kind of process, so \"the evaluator " +
        "approved it\" is not independent evidence unless the criteria came from outside.",
    },
    {
      kind: "pitfall",
      items: [
        "Running the loop without written criteria — the evaluator will produce feedback regardless, and changing drafts will feel like improvement while measuring nothing.",
        "Using a model to check something code could check — a schema, a length, a passing test: code is free, exact and consistent, and a model is none of those.",
        "No round cap — this is the pantry agent again, and each round is two calls rather than one.",
        "Feedback that is a grade rather than a fault — \"6/10\" gives the generator nothing to act on; \"no counter-argument, two sources not three\" does.",
        "Letting the generator see its own previous drafts unboundedly — the context grows every round and the later rounds are the expensive ones.",
        "Treating evaluator approval as quality assurance — it is evidence about the criteria, not about the world, and a human should still see a sample.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Evaluator-optimiser: generate, evaluate against explicit criteria, feed the specific faults back, repeat.",
        "It is effective when the evaluation criteria are clear, and when refinement provides measurable value (Anthropic).",
        "If a criterion can be code, make it code. Free, instant, consistent, and the feedback is exact.",
        "Cap the rounds, and define what happens at the cap: return the best attempt and say it was not accepted.",
        "Vague criteria produce a loop that looks like progress and measures nothing.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How would you improve output quality automatically?\" — evaluate against explicit criteria and feed the specific failures back. The word \"explicit\" is the one that matters.",
        "Saying that most of your evaluator should be code, not a model, is a practical answer that shows cost awareness.",
        "Expect to be asked how you know the loop is helping. \"We have criteria we set in advance, and we measure against a held-out set\" is the answer; \"the drafts get better\" is not.",
      ],
    },
    {
      kind: "quiz",
      question: "When is evaluator-optimiser particularly effective, according to Anthropic's guidance?",
      options: [
        "When the task is open-ended and hard to specify, because the evaluator can then work out the goal itself",
        "When there are clear evaluation criteria, and iterative refinement provides measurable value",
        "Whenever the first draft is unsatisfactory",
        "When you have two different models available",
      ],
      answer: 1,
      why:
        "Clear criteria are the precondition, not a nice-to-have. Without them the loop still runs, still " +
        "produces feedback and still changes the draft — with no evidence that anything improved.",
    },
    {
      kind: "quiz",
      question: "Your criterion is \"the JSON must match this schema\". Who should evaluate it?",
      options: [
        "A model, because it understands intent and can judge whether the shape of the JSON is acceptable",
        "Code, because a schema check is free, instant, exact and perfectly consistent",
        "Both, for redundancy",
        "A human reviewer",
      ],
      answer: 1,
      why:
        "Anything mechanically checkable should be checked mechanically. Save the model evaluator for " +
        "judgement calls — tone, register, clarity — where code genuinely cannot reach.",
    },
    {
      kind: "quiz",
      question: "Which feedback will the generator act on most reliably?",
      options: [
        "\"Quality: 6/10, so there is clearly still room to improve this draft before it is finished.\"",
        "\"This could be better.\"",
        "\"Missing a counter-argument; two sources cited, three required.\"",
        "\"Try again, more carefully.\"",
        ],
      answer: 2,
      why:
        "It names the specific faults, which is the same principle as a good tool error message in " +
        "chapter 11 and a good prompt line in chapter 6. A score and an adjective give the generator " +
        "nothing to change.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Write the evaluation criteria for something you would generate. Mark each one as code-checkable or judgement.",
        "Take a criterion you marked as judgement and try again to make it code. Most of them can be, with effort.",
        "Set the round cap and write down exactly what your system returns and says when it is reached.",
        "Design how you would find out whether the loop actually improves quality, rather than just changing the draft.",
      ],
    },
  ],
};
