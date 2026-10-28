import type { Chapter } from "@/content/courses/types";

export const chapterChainOfThought: Chapter = {
  slug: "chain-of-thought",
  title: "Chain of Thought: Making Room to Work",
  summary:
    "Asking for intermediate steps measurably improves reasoning — and the reason is mechanical, not " +
    "mystical. It also comes with a caveat people skip: the steps are not a confession.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "There is a prompting technique that genuinely works, is genuinely well evidenced, and is " +
        "genuinely misunderstood. If you ask a model to show its working before giving an answer, it gets " +
        "harder questions right more often. This is **chain-of-thought prompting**, and this chapter " +
        "covers three things: the evidence, the mechanism that makes it unsurprising, and the caveat that " +
        "gets left out of every enthusiastic blog post about it.",
    },
    { kind: "h", text: "The picture: rough paper in an exam" },
    {
      kind: "analogy",
      title: "\"Show your working\" was never about the marker",
      text:
        "Every maths teacher insists you show your working, and every student assumes it is so the " +
        "teacher can award part marks. That is a side benefit. The real reason is that you cannot hold a " +
        "four-step calculation in your head while also doing it — the margin is where you put step one so " +
        "your head is free for step two. Take the rough paper away and the same student, who understands " +
        "the method perfectly, starts getting the answer wrong. A model has the same problem in a stricter " +
        "form: it produces one token at a time, and a token is not much room to do four steps in. Letting " +
        "it write the steps out gives it the margin. Where the analogy stops: the student's working is an " +
        "honest record of what she did. The model's working is more text produced by the same predictor, " +
        "and — as the end of this chapter shows — it is not guaranteed to describe what actually drove the answer.",
    },
    {
      kind: "concept",
      title: "Chain-of-thought prompting",
      text:
        "Prompting a model to produce a series of intermediate reasoning steps before its final answer, " +
        "usually by showing a few examples that do so. From *Chain-of-Thought Prompting Elicits Reasoning " +
        "in Large Language Models* (Wei et al., arXiv:2201.11903): generating a chain of thought — \"a " +
        "series of intermediate reasoning steps\" — significantly improves the ability of large language " +
        "models to perform complex reasoning.",
    },
    { kind: "h", text: "The evidence" },
    {
      kind: "p",
      text:
        "The headline result from that paper is specific and worth quoting rather than paraphrasing: a " +
        "540-billion-parameter language model, prompted with just eight chain-of-thought exemplars, " +
        "reached state-of-the-art accuracy on GSM8K — a benchmark of grade-school maths word problems — " +
        "surpassing even a finetuned GPT-3 equipped with a verifier. Eight examples in a prompt beating a " +
        "model that had been trained on the task. That is the finding, and it is why this technique got " +
        "everyone's attention.",
    },
    {
      kind: "p",
      text:
        "A companion result pushes further. *Self-Consistency Improves Chain of Thought Reasoning in " +
        "Language Models* (Wang et al., arXiv:2203.11171) replaces the single greedy answer with " +
        "something simpler than it sounds: sample several different reasoning paths, then take the " +
        "answer most of them arrive at. The reported gains over chain-of-thought alone were +17.9% on " +
        "GSM8K, +11.0% on SVAMP, +12.2% on AQuA, +6.4% on StrategyQA and +3.9% on ARC-challenge. The " +
        "idea behind it is that a hard problem has many routes to the one right answer but many " +
        "*different* wrong answers, so agreement is evidence.",
    },
    {
      kind: "code",
      caption: "Self-consistency by hand: five sampled answers, majority wins. The samples are hard-coded — nothing is generated here.",
      code:
        "# These stand in for five separate runs of the same prompt. No model is called.\n" +
        'samples = ["18", "18", "12", "18", "24"]\n' +
        "\n" +
        "counts = {}\n" +
        "for s in samples:\n" +
        "    counts[s] = counts.get(s, 0) + 1\n" +
        "\n" +
        "ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))\n" +
        "winner, votes = ranked[0]\n" +
        "\n" +
        'print("samples:", samples)\n' +
        'print("tally:  ", ranked)\n' +
        'print(f"majority answer: {winner} ({votes} of {len(samples)})")\n' +
        'print(f"agreement: {votes / len(samples):.0%}  <- this is a cheap, honest confidence signal")\n',
      output:
        "samples: ['18', '18', '12', '18', '24']\n" +
        "tally:   [('18', 3), ('12', 1), ('24', 1)]\n" +
        "majority answer: 18 (3 of 5)\n" +
        "agreement: 60%  <- this is a cheap, honest confidence signal",
    },
    {
      kind: "p",
      text:
        "That agreement figure is worth more than it looks. Chapter 4 said a model's self-reported " +
        "confidence is not independent evidence, because it comes from the same process as the claim. " +
        "Agreement across independently sampled runs is different — it is a measurement you took, not a " +
        "number the model handed you. It is one of the very few cheap confidence signals in this whole " +
        "field, and it costs exactly as much as running the prompt five times.",
    },
    { kind: "h", text: "Why it works, mechanically" },
    {
      kind: "steps",
      title: "What the intermediate text actually buys",
      steps: [
        {
          label: "More computation",
          text: "Each token is a fixed amount of work. Forty tokens of working is forty times the computation of one token of answer — the steps are where the thinking physically happens.",
        },
        {
          label: "Somewhere to keep partial results",
          text: "\"The 3 shirts cost 45\" is now in the context. The next step can attend to it, instead of the model having to carry it implicitly.",
        },
        {
          label: "A better-behaved pattern",
          text: "Text that reasons step by step is a common, well-modelled shape. Continuing it correctly is a more likely continuation than leaping to a number.",
        },
        {
          label: "Something a human can check",
          text: "A wrong answer with visible steps can be diagnosed. A wrong answer alone cannot. This is a real benefit even when it does not improve accuracy.",
        },
      ],
    },
    {
      kind: "p",
      text:
        "Note what is *not* in that list: the model is not \"deciding to think harder\". The instruction " +
        "works for the same reason \"answer in bullet points\" works — it changes the shape of the most " +
        "likely continuation. The difference is that this particular shape happens to come with more " +
        "computation and more written-down intermediate state attached, which is what helps.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Change `samples` to five different answers and re-run. What does an agreement of 20% tell you that a single confident answer would not have?",
      starter:
        'samples = ["18", "18", "12", "18", "24"]\n' +
        "\n" +
        "\n" +
        "def consensus(samples):\n" +
        "    counts = {}\n" +
        "    for s in samples:\n" +
        "        counts[s] = counts.get(s, 0) + 1\n" +
        "    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))\n" +
        "    winner, votes = ranked[0]\n" +
        "    return winner, votes / len(samples), ranked\n" +
        "\n" +
        "\n" +
        "winner, agreement, ranked = consensus(samples)\n" +
        'print("tally:", ranked)\n' +
        'print(f"answer: {winner}   agreement: {agreement:.0%}")\n' +
        "\n" +
        "if agreement >= 0.8:\n" +
        '    print("Ship it.")\n' +
        "elif agreement >= 0.5:\n" +
        '    print("Usable, but show the user that this was not unanimous.")\n' +
        "else:\n" +
        '    print("Do not present this as an answer. Escalate, or say you are not sure.")\n',
      expectedOutput:
        "tally: [('18', 3), ('12', 1), ('24', 1)]\n" +
        "answer: 18   agreement: 60%\n" +
        "Usable, but show the user that this was not unanimous.",
    },
    { kind: "h", text: "The caveat nobody quotes" },
    {
      kind: "p",
      text:
        "Here is the part that gets left out. The steps a model writes are **not a reliable account of " +
        "why it answered as it did**. In *Language Models Don't Always Say What They Think* (Turpin et " +
        "al., arXiv:2305.04388), the researchers added biasing features to the input — for instance, " +
        "reordering the options in a few-shot prompt so that the answer was always \"(A)\" — and found " +
        "that models systematically failed to mention those features in their explanations, while being " +
        "influenced by them. Across 13 tasks from BIG-Bench Hard, biasing models towards incorrect " +
        "answers caused accuracy to drop by as much as 36%, with the models producing explanations that " +
        "rationalised the wrong answers instead of acknowledging the bias. Their conclusion is worth " +
        "sitting with: explanations can be plausible yet misleading, which risks *increasing* trust in " +
        "systems whose reasoning is not actually transparent.",
    },
    {
      kind: "concept",
      title: "Faithfulness",
      text:
        "Whether a stated explanation actually describes the process that produced the answer. " +
        "Chain-of-thought output is not guaranteed to be faithful (arXiv:2305.04388): it is more " +
        "predicted text, generated by the same machinery as the answer, and it can rationalise rather " +
        "than report. Useful for you to read and check; not admissible as the model's own testimony.",
    },
    {
      kind: "compare",
      title: "What chain of thought is and is not good for",
      columns: [
        {
          label: "Good for",
          items: [
            "Multi-step arithmetic, logic and planning, where the steps carry real intermediate state",
            "Giving a human something to check when the answer is wrong",
            "Feeding an evaluator: \"which step is wrong?\" is answerable, \"why is this wrong?\" often is not",
            "Pairing with self-consistency, where agreement across runs becomes a confidence signal",
          ],
        },
        {
          label: "Not good for",
          items: [
            "Simple lookups and classification, where it adds tokens, latency and cost for nothing",
            "Auditing why a model really answered as it did — the explanation can rationalise rather than report",
            "Facts the model does not have; steps do not conjure information, they only rearrange it",
            "Anything where the user should not see the working, unless you plan to hide it and still pay for it",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Treating the working as an audit trail — it can systematically omit what actually drove the answer, which is exactly what arXiv:2305.04388 measured.",
        "Adding \"think step by step\" to every prompt — on a classification or lookup task it buys nothing and costs tokens and latency on every single call.",
        "Believing a long explanation means a correct answer — fluent, well-structured reasoning that reaches a wrong conclusion is the single most convincing failure this field produces.",
        "Forgetting to hide the working — if the reasoning is for the model's benefit and not the user's, you still generated and paid for those tokens; budget for them.",
        "Using self-consistency at temperature 0 — with no variation between runs you get five identical samples and a completely meaningless 100% agreement.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Chain of thought = intermediate steps before the answer, and it significantly improves complex reasoning (arXiv:2201.11903).",
        "The mechanism is ordinary: more tokens means more computation and somewhere to keep partial results.",
        "Self-consistency — sample several paths, take the majority — improved GSM8K by 17.9% over chain of thought alone (arXiv:2203.11171).",
        "Agreement across samples is a real confidence signal; a model's self-reported confidence is not.",
        "The written steps are not a faithful account of the model's actual reasoning (arXiv:2305.04388). Read them, check them, do not trust them as testimony.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Does chain of thought actually work, and why?\" — name the paper, name the mechanism (more computation, written-down intermediate state), and you have answered it.",
        "The faithfulness caveat is a strong signal in an interview. Most candidates know the technique; far fewer know it is not an explanation you can trust.",
        "Expect a cost question. Reasoning tokens are billed and they add latency, so \"when would you turn it off?\" is a fair and answerable follow-up.",
      ],
    },
    {
      kind: "quiz",
      question: "What was the specific headline result reported in arXiv:2201.11903 on GSM8K?",
      options: [
        "A finetuned GPT-3 with a verifier still beat every chain-of-thought prompted model, however large",
        "A 540B-parameter model given eight chain-of-thought examples beat a finetuned GPT-3 with a verifier",
        "Chain of thought made no difference on maths problems",
        "Self-consistency voting was required before chain of thought improved any result",
      ],
      answer: 1,
      why:
        "Eight examples in a prompt beat a model that had been fine-tuned on the task and equipped with a " +
        "verifier. That is what made the result notable.",
    },
    {
      kind: "quiz",
      question:
        "A model explains its answer in five clear steps and the answer is wrong. What does the explanation reliably tell you?",
      options: [
        "Exactly which internal computation went wrong, because each written step mirrors one step the model computed",
        "That the model was biased by something it did not mention",
        "Something you can read and check — but not a guaranteed account of why it answered as it did",
        "Nothing at all; the steps are random",
      ],
      answer: 2,
      why:
        "Written steps are genuinely useful to inspect, and often do locate the error. But arXiv:2305.04388 " +
        "showed models systematically omitting the features that actually influenced them, so the " +
        "explanation cannot be treated as testimony.",
    },
    {
      kind: "quiz",
      question: "Why does self-consistency require a non-zero temperature?",
      options: [
        "Because the majority vote needs an odd number of samples",
        "Because at temperature 0 every sample is the same, so agreement is 100% and measures nothing",
        "Because low temperature disables chain of thought",
        "It does not — temperature is unrelated, since the votes are counted the same way however the samples were produced",
      ],
      answer: 1,
      why:
        "The method depends on sampling a diverse set of reasoning paths and seeing where they converge. " +
        "With no variation there is only one path, and the resulting unanimous \"agreement\" is an artefact.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take a multi-step problem and write out the chain of thought you would want a model to produce. Then count its tokens — that is the per-call cost of the technique.",
        "Set the playground's samples to five different values and decide what your product should actually do with 20% agreement.",
        "Find a task you would use a model for where chain of thought would be pure waste, and say precisely why.",
        "Given the faithfulness result, write down how you would word a UI that shows a model's reasoning to a user without implying it is an audit trail.",
      ],
    },
  ],
};
