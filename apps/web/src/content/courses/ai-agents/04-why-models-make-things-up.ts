import type { Chapter } from "@/content/courses/types";

export const chapterWhyModelsMakeThingsUp: Chapter = {
  slug: "why-models-make-things-up",
  title: "Why Models Make Things Up",
  summary:
    "Hallucination is not a glitch and not a mystery. It is what you get when a system that must always " +
    "produce something is graded by a scheme that rewards a lucky guess over an honest \"I don't know\".",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "A model invents a court case that does not exist, a paper that was never published, an API method " +
        "with a perfectly reasonable name that nobody ever wrote. The usual explanations — \"it's " +
        "dreaming\", \"it's being creative\", \"the AI is broken\" — are all wrong in the same way: they " +
        "treat this as mysterious. It is not. There are two ordinary mechanisms behind it, and once you " +
        "can name them you can also name the fixes, which is the entire reason this chapter comes before " +
        "the chapter on tools.",
    },
    { kind: "h", text: "The picture: an exam with no negative marking" },
    {
      kind: "analogy",
      title: "The student who has worked out that blank scores zero",
      text:
        "Two students sit the same hundred-question multiple-choice paper. Both genuinely know sixty " +
        "answers. Priya leaves the other forty blank because she does not know them. Arjun fills in all " +
        "forty, reasoning that a blank is worth exactly nothing and a guess is worth something. With no " +
        "penalty for a wrong answer, Arjun beats Priya every time — and he is not cheating, he is " +
        "responding correctly to the scoring scheme he was given. Now imagine that the paper is the " +
        "benchmark a model is tuned against, and that the whole industry ranks models on papers scored " +
        "this way. You do not get a model that says \"I don't know\". You get Arjun. Where the analogy " +
        "stops: Arjun knows he is guessing. The model's guess and the model's knowledge come out of the " +
        "same machinery and look identical from the outside — which is the part that actually hurts.",
    },
    {
      kind: "concept",
      title: "Hallucination",
      text:
        "A fluent, confident, specific statement that is not true and was not checked against anything. " +
        "Note the word *checked* — this is not the model lying or malfunctioning. Nothing in the pipeline " +
        "was ever positioned to verify the claim, so \"wrong\" and \"right\" came out of the same process " +
        "and are indistinguishable from the text alone.",
    },
    { kind: "h", text: "Mechanism one: the scoring rewards guessing" },
    {
      kind: "p",
      text:
        "This is not speculation. *Why Language Models Hallucinate* (Kalai, Nachum, Vempala and Zhang, " +
        "arXiv:2509.04664) argues that hallucinations begin as ordinary errors in binary classification " +
        "during training — the model cannot always tell a true statement from a false one — and then " +
        "*persist* because of how models are evaluated afterwards. Their word for the state of the " +
        "leaderboards is an \"epidemic\" of penalising uncertain responses: the models are optimised into " +
        "good test-takers, and for a good test-taker, guessing when uncertain improves the score. Their " +
        "proposed fix is notable for what it is not — not a new hallucination benchmark, but changing the " +
        "scoring of the existing benchmarks that already dominate the leaderboards.",
    },
    {
      kind: "code",
      caption: "The arithmetic behind that argument, on a hundred-question paper. No model involved — this is just scoring.",
      code:
        "# 100 questions. The model is sure of 60 and has a 1-in-4 shot at the other 40.\n" +
        "TOTAL, KNOWN, CHANCE = 100, 60, 0.25\n" +
        "unknown = TOTAL - KNOWN\n" +
        "\n" +
        "\n" +
        "def score(always_guess, wrong_penalty):\n" +
        "    if always_guess:\n" +
        "        right = KNOWN + unknown * CHANCE\n" +
        "        wrong = unknown * (1 - CHANCE)\n" +
        "        abstained = 0\n" +
        "    else:\n" +
        "        right = KNOWN\n" +
        "        wrong = 0\n" +
        "        abstained = unknown\n" +
        "    return right - wrong * wrong_penalty, right, wrong, abstained\n" +
        "\n" +
        "\n" +
        "for penalty in [0.0, 0.33, 1.0]:\n" +
        "    g = score(True, penalty)\n" +
        "    a = score(False, penalty)\n" +
        '    better = "guessing" if g[0] > a[0] else "abstaining"\n' +
        '    print(f"penalty {penalty:>4}:  guess {g[0]:6.1f}   abstain {a[0]:6.1f}   -> {better} wins")\n',
      output:
        "penalty  0.0:  guess   70.0   abstain   60.0   -> guessing wins\n" +
        "penalty 0.33:  guess   60.1   abstain   60.0   -> guessing wins\n" +
        "penalty  1.0:  guess   40.0   abstain   60.0   -> abstaining wins",
    },
    {
      kind: "p",
      text:
        "Read the middle line. Even with a penalty of a third of a mark for being wrong, guessing still " +
        "wins — by a tenth of a point, but it wins, and a leaderboard does not care by how much. Honesty " +
        "only becomes the better strategy when being wrong costs about as much as being right earns. " +
        "Almost no standard benchmark is scored that way. That is the argument, and you can check it " +
        "yourself with the arithmetic above.",
    },
    { kind: "h", text: "Mechanism two: something has to be sampled" },
    {
      kind: "p",
      text:
        "The second mechanism is structural. Remember from chapter one that the model produces a " +
        "probability for every possible next token. Something then has to *choose* one, and that chooser " +
        "has a dial on it called **temperature**. Low temperature sharpens the distribution towards the " +
        "single most likely token; high temperature flattens it, giving unlikely tokens a real chance. " +
        "There is no setting of this dial marked \"only say true things\", because the distribution is " +
        "over *likely text*, and likely text includes a beautifully plausible citation for a paper that " +
        "was never written.",
    },
    {
      kind: "code",
      caption: "Temperature, done by hand. The scores are made up; the arithmetic is the real thing samplers do.",
      code:
        "import math\n" +
        "\n" +
        "# The model's raw scores for four possible next words. Bigger means \"more likely\".\n" +
        'scores = {"leaves": 3.2, "is": 1.9, "was": 1.1, "elephant": -2.0}\n' +
        "\n" +
        "\n" +
        "def softmax(scores, temperature):\n" +
        "    scaled = {w: s / temperature for w, s in scores.items()}\n" +
        "    biggest = max(scaled.values())\n" +
        "    exps = {w: math.exp(s - biggest) for w, s in scaled.items()}\n" +
        "    total = sum(exps.values())\n" +
        "    return {w: round(e / total, 4) for w, e in exps.items()}\n" +
        "\n" +
        "\n" +
        "for t in [0.2, 1.0, 2.0]:\n" +
        '    print(f"temperature {t}: {softmax(scores, t)}")\n',
      output:
        "temperature 0.2: {'leaves': 0.9985, 'is': 0.0015, 'was': 0.0, 'elephant': 0.0}\n" +
        "temperature 1.0: {'leaves': 0.714, 'is': 0.1946, 'was': 0.0874, 'elephant': 0.0039}\n" +
        "temperature 2.0: {'leaves': 0.5138, 'is': 0.2682, 'was': 0.1798, 'elephant': 0.0382}",
    },
    {
      kind: "p",
      text:
        "At temperature 2.0, \"elephant\" — a word the model scored deeply negative — comes up about four " +
        "times in a hundred. That is where \"why is it being weird today?\" comes from. But notice the " +
        "trap in the other direction: turning the temperature down to 0.2 makes the output nearly " +
        "deterministic, and people take that as making it *accurate*. It does not. It makes the model " +
        "reliably produce its single most likely continuation, which is a different thing from a true one. " +
        "A confidently wrong answer at temperature 0 is confidently wrong every single time.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Change `CHANCE` to 0.5 (an easier guess) and then to 0.1 (a harder one). At what wrong-answer penalty does honesty start to pay?",
      starter:
        "TOTAL, KNOWN, CHANCE = 100, 60, 0.25\n" +
        "unknown = TOTAL - KNOWN\n" +
        "\n" +
        "\n" +
        "def guessing_score(penalty):\n" +
        "    right = KNOWN + unknown * CHANCE\n" +
        "    wrong = unknown * (1 - CHANCE)\n" +
        "    return right - wrong * penalty\n" +
        "\n" +
        "\n" +
        "honest = KNOWN  # never guesses, never wrong, never rewarded for saying so\n" +
        "\n" +
        "for penalty in [0.0, 0.25, 0.5, 0.75, 1.0]:\n" +
        "    g = guessing_score(penalty)\n" +
        '    verdict = "guess" if g > honest else "abstain"\n' +
        '    print(f"penalty {penalty:4}: guessing {g:6.1f} vs honest {honest:6.1f} -> {verdict}")\n',
      expectedOutput:
        "penalty  0.0: guessing   70.0 vs honest   60.0 -> guess\n" +
        "penalty 0.25: guessing   62.5 vs honest   60.0 -> guess\n" +
        "penalty  0.5: guessing   55.0 vs honest   60.0 -> abstain\n" +
        "penalty 0.75: guessing   47.5 vs honest   60.0 -> abstain\n" +
        "penalty  1.0: guessing   40.0 vs honest   60.0 -> abstain",
    },
    { kind: "h", text: "What actually reduces it" },
    {
      kind: "compare",
      title: "Things people try, and whether they work",
      columns: [
        {
          label: "Does not fix it",
          items: [
            "Adding \"do not hallucinate\" or \"only say true things\" to the prompt",
            "Setting temperature to 0 — this makes the same wrong answer arrive reliably",
            "Asking \"are you sure?\" — that mostly predicts the text that follows such a question",
            "Using a bigger model — it shifts the average, not the guarantee on any one claim",
          ],
        },
        {
          label: "Actually helps",
          items: [
            "Giving it a tool that looks the fact up, so the claim comes from a source and not from the prediction",
            "Retrieving the passage and asking it to answer only from that passage",
            "Asking for a citation to something in the context, and checking the citation exists",
            "Explicitly permitting, and rewarding, \"I don't know\" — the one instruction that changes the payoff",
            "Verifying the output with code: does that URL resolve, does that function exist, does that number parse",
          ],
        },
      ],
    },
    {
      kind: "p",
      text:
        "Every item in the right-hand column has the same shape: it replaces a prediction with a check. " +
        "That is not a coincidence, and it is the thesis of the whole course. An agent is not a model that " +
        "has stopped making things up; an agent is a model wrapped in a loop where claims get checked " +
        "against something outside the model. In the agent lab later in this course, you will be able to " +
        "switch off the clause that says \"if you cannot look it up, say you do not know\" and watch a " +
        "perfectly well-behaved agent produce a confident refund status for an order it never opened.",
    },
    {
      kind: "pitfall",
      items: [
        "Trying to prompt hallucination away — an instruction not to invent things is itself just text the model conditions on, and it competes with the far stronger pull of producing a fluent, complete-looking answer.",
        "Reading temperature 0 as truth mode — it removes the variability, not the error, and it makes a wrong answer reproducible rather than rare.",
        "Trusting a citation the model produced from nothing — invented references are the single most common form of this, because the *shape* of a reference is extremely easy to predict.",
        "Asking the model to rate its own confidence — a number it generates is produced by the same process as the claim, so it is not independent evidence about the claim.",
        "Forgetting that a specific-sounding detail is the most dangerous kind — \"₹3,499 on 8 September\" reads as though somebody checked, and nothing about the text tells you whether anybody did.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Hallucination is a scoring problem before it is a model problem: benchmarks that give nothing for \"I don't know\" make guessing the winning strategy (arXiv:2509.04664).",
        "Temperature controls variety, never truth. Zero makes the error reproducible, not absent.",
        "Confidence and correctness come out of the same process, so the text carries no signal about which one you got.",
        "The only reliable fix is to replace a prediction with a check — a tool, a retrieved passage, a verified citation.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How would you stop your feature hallucinating?\" is asked in almost every AI-adjacent interview now. The strong answer names the mechanism, then lists fixes that involve checking something, and is honest that prompting alone is not one.",
        "Being able to say why temperature 0 does not solve it is a good, quick discriminator between people who have shipped something and people who have read a thread about it.",
        "Expect a follow-up about what you would show the user. \"Cite the source we retrieved, and say plainly when we have nothing\" is the answer that survives a product-manager in the room.",
      ],
    },
    {
      kind: "quiz",
      question:
        "According to the argument in arXiv:2509.04664, why do models keep guessing rather than saying they do not know?",
      options: [
        "Because guessing produces more fluent text",
        "Because standard benchmarks give no credit for abstaining, so guessing scores better and models are optimised as test-takers",
        "Because saying \"I don't know\" is filtered out by safety systems",
        "Because the training data contains almost no examples of people saying they do not know, so the model cannot learn to abstain",
      ],
      answer: 1,
      why:
        "The paper frames it as a scoring problem: uncertain responses are penalised by the evaluations that " +
        "dominate leaderboards, so a model optimised against them learns that guessing when uncertain pays. " +
        "Their suggested remedy is to change the scoring of those existing benchmarks.",
    },
    {
      kind: "quiz",
      question: "A colleague sets temperature to 0 and reports that the hallucinations are fixed. What has actually changed?",
      options: [
        "Nothing about accuracy — the same most-likely continuation is now produced every time, right or wrong",
        "The model now checks each claim against its training data before it answers, so wrong claims are removed",
        "The model now abstains when uncertain",
        "The context window effectively doubled",
      ],
      answer: 0,
      why:
        "Temperature only shapes how the next token is chosen from the distribution. At 0 the output becomes " +
        "reproducible, which can look like reliability — but a wrong answer at temperature 0 is wrong every single time.",
    },
    {
      kind: "quiz",
      question: "Which of these genuinely reduces invented facts about a specific customer's order?",
      options: [
        "Adding a long, forceful paragraph to the system prompt forbidding invented details and demanding accuracy in capitals",
        "Lowering the temperature",
        "Giving the model a tool that fetches that order and instructing it to answer only from what the tool returned",
        "Asking the model to double-check its own answer",
      ],
      answer: 2,
      why:
        "The order details exist nowhere in the model. The only way a true answer can appear is if a true " +
        "answer is fetched and put into the context. Everything else is asking a predictor to predict harder.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Run the scoring playground with CHANCE = 0.5 and work out the penalty at which honesty starts winning. Then argue for or against scoring a real product that way.",
        "Ask an AI assistant for three sources on a topic you know well, then check whether each one exists. Note which parts of the fabricated ones were most convincing.",
        "Write two versions of a system prompt for a support bot: one that forbids guessing, and one that explicitly rewards \"I could not find that\". Which one would you rather ship, and why?",
        "Take a feature you would like to build. List every claim it would make to a user, and for each, write down what would have to be checked for that claim to be literally true.",
      ],
    },
  ],
};
