import type { Chapter } from "@/content/courses/types";

export const chapterWhatIsALanguageModel: Chapter = {
  slug: "what-is-a-language-model",
  title: "What a Language Model Actually Is",
  summary:
    "Before agents, before prompts, before frameworks: a language model is a machine that predicts the " +
    "next piece of text. Everything else in this course is built on that one sentence.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Almost everything confusing about AI right now comes from people skipping this chapter. They " +
        "hear that a model \"understands\" a question, or \"knows\" a fact, or \"decides\" to call a tool, " +
        "and then they are surprised when it confidently states something untrue about their own bank " +
        "account. None of those verbs are quite right. Start with the accurate sentence instead: **a " +
        "language model is a machine that, given some text, produces a probability for every possible " +
        "next piece of text.** That is the whole of it. The rest of this course is about what you can and " +
        "cannot build on top of that.",
    },
    { kind: "h", text: "The picture: the keyboard on your phone" },
    {
      kind: "analogy",
      title: "Your phone's next-word suggestion, scaled up absurdly",
      text:
        "Type \"I am running\" into your phone's messaging app and three grey suggestions appear above " +
        "the keyboard: \"late\", \"out\", \"to\". Your phone did not understand that you are late. It " +
        "counted, across an enormous pile of text, what usually comes after \"I am running\", and offered " +
        "the top few. A large language model is that idea taken to a ridiculous extreme: instead of " +
        "looking at the last three words it looks at the last several thousand, instead of counting pairs " +
        "of words it has billions of adjustable numbers fitted to a very large amount of text, and instead " +
        "of three suggestions it produces a score for every piece of text it knows. Then it picks one, " +
        "adds it to the end, and does the whole thing again. Where the analogy stops: your phone's " +
        "suggestions are dumb because three words is not much context. Give the same machinery thousands " +
        "of words of context and enough capacity, and the predictions stop looking like autocomplete and " +
        "start looking like answers. That jump is real and it is surprising — but the mechanism underneath " +
        "did not change.",
    },
    {
      kind: "concept",
      title: "Language model",
      text:
        "A function from \"the text so far\" to \"a probability for each possible next piece of text\". " +
        "It is run over and over, each time with its own last output added to the input. Nothing in that " +
        "definition mentions truth, intention, memory or understanding — which is exactly why those four " +
        "things have to be engineered on top of it, and why most of this course is about doing that.",
    },
    { kind: "h", text: "A language model you can build in twenty lines" },
    {
      kind: "p",
      text:
        "You do not need a data centre to see the idea work. Here is a tiny language model: it reads a few " +
        "sentences, counts what follows each word, and turns those counts into probabilities. It is a " +
        "real, if extremely stupid, language model — the same shape as the big ones, minus roughly a " +
        "hundred billion numbers and a great deal of cleverness about context.",
    },
    {
      kind: "code",
      caption: "A next-word model built by counting. Runs anywhere Python runs — no model, no API, no key.",
      code:
        "text = (\n" +
        '    "the train to pune leaves at six. the train to mumbai leaves at seven. "\n' +
        '    "the bus to pune leaves at eight. the train to pune is full."\n' +
        ")\n" +
        "\n" +
        'words = text.replace(".", "").split()\n' +
        "\n" +
        "# Count what follows every word.\n" +
        "following = {}\n" +
        "for current, nxt in zip(words, words[1:]):\n" +
        "    following.setdefault(current, {})\n" +
        "    following[current][nxt] = following[current].get(nxt, 0) + 1\n" +
        "\n" +
        "\n" +
        "def predict(word):\n" +
        "    counts = following.get(word, {})\n" +
        "    total = sum(counts.values())\n" +
        "    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))\n" +
        "    return [(w, round(n / total, 2)) for w, n in ranked]\n" +
        "\n" +
        "\n" +
        'for word in ["the", "train", "to", "pune"]:\n' +
        '    print(word, "->", predict(word))\n',
      output:
        "the -> [('train', 0.75), ('bus', 0.25)]\n" +
        "train -> [('to', 1.0)]\n" +
        "to -> [('pune', 0.75), ('mumbai', 0.25)]\n" +
        "pune -> [('leaves', 0.67), ('is', 0.33)]",
    },
    {
      kind: "p",
      text:
        "Read the output slowly, because every strange behaviour you will ever see from a large model is " +
        "already visible here in miniature. After `train`, this model is certain: the only thing it has " +
        "ever seen after \"train\" is \"to\", so it says 1.0 — total confidence, based on three examples. " +
        "After `to` it will say \"pune\" three times out of four, not because Pune is the right answer but " +
        "because Pune was the frequent one. And ask it about a word it has never seen and it has nothing " +
        "at all. Confidence that comes from frequency rather than from checking; a preference for the " +
        "common answer over the correct one; and silence-shaped-like-an-answer outside its experience. " +
        "Hold on to those three.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Change `text` to a few sentences of your own — song lyrics, a recipe, your WhatsApp style — and " +
        "see what the model predicts. Then add a word to `probe` that never appears in your text.",
      starter:
        'text = "chai with ginger is good. chai with milk is good. chai without sugar is fine."\n' +
        "\n" +
        'words = text.replace(".", "").split()\n' +
        "\n" +
        "following = {}\n" +
        "for current, nxt in zip(words, words[1:]):\n" +
        "    following.setdefault(current, {})\n" +
        "    following[current][nxt] = following[current].get(nxt, 0) + 1\n" +
        "\n" +
        "\n" +
        "def predict(word):\n" +
        "    counts = following.get(word, {})\n" +
        "    total = sum(counts.values())\n" +
        "    if total == 0:\n" +
        '        return "nothing — never seen this word"\n' +
        "    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))\n" +
        "    return [(w, round(n / total, 2)) for w, n in ranked]\n" +
        "\n" +
        "\n" +
        'probe = ["chai", "with", "is", "coffee"]\n' +
        "for word in probe:\n" +
        '    print(word, "->", predict(word))\n',
      expectedOutput:
        "chai -> [('with', 0.67), ('without', 0.33)]\n" +
        "with -> [('ginger', 0.5), ('milk', 0.5)]\n" +
        "is -> [('good', 0.67), ('fine', 0.33)]\n" +
        "coffee -> nothing — never seen this word",
    },
    { kind: "h", text: "So what did scale actually change?" },
    {
      kind: "p",
      text:
        "The counting model above only looks at one word of context, so it can never tell the difference " +
        "between \"the train to Pune\" and \"the road to Pune\". Real models look at a long stretch of " +
        "text at once and learn which earlier parts matter for the next piece — that mechanism has a name, " +
        "*attention*, and it gets its own chapter. What the jump in scale bought is not a different kind " +
        "of machine. It is a machine that can condition its prediction on far more, and far subtler, " +
        "context: on the structure of a question, on the style you asked for, on a rule you stated nine " +
        "paragraphs ago. Prediction that good stops being distinguishable from answering, most of the time.",
    },
    {
      kind: "compare",
      title: "What next-word prediction does and does not give you",
      columns: [
        {
          label: "You get this, genuinely",
          items: [
            "Fluent, grammatical text in dozens of languages, including code",
            "Following a format you demonstrate, closely and reliably",
            "Transforming text you provide — summarising, translating, re-styling, extracting",
            "A large amount of general-knowledge recall, most of it correct",
            "Something that reads like reasoning, and often behaves like it",
          ],
        },
        {
          label: "You do not get this, ever, for free",
          items: [
            "Any guarantee that a specific claim is true",
            "Knowledge of anything after its training data ended",
            "Knowledge of anything private — your database, your orders, today's price",
            "The ability to take an action in the world",
            "A reliable signal of when it does not know something",
          ],
        },
      ],
    },
    {
      kind: "p",
      text:
        "Look at that right-hand column again, because it is a to-do list, not a complaint. Every single " +
        "item on it is fixed by giving the model something it did not have: a tool that can look up your " +
        "order, a retrieval step that fetches today's price, a loop that lets it act and then see what " +
        "happened. That is what an *agent* is. The whole field is the right-hand column, one item at a time.",
    },
    {
      kind: "pitfall",
      items: [
        "Treating a confident tone as evidence — fluency is the one thing these models are guaranteed to have, so it carries no information about whether the content is right.",
        "Assuming the model \"looked something up\" — unless you gave it a tool, nothing was looked up; the answer came out of the same prediction machinery as the grammar did.",
        "Expecting it to know it is wrong — the model produces a next piece of text, not a confidence report about the world, and asking \"are you sure?\" mostly just predicts the text that usually follows that question.",
        "Thinking bigger models remove the problem — scale improves the average answer and does nothing to guarantee any particular one, which is why the rest of this course exists.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A language model predicts the next piece of text, over and over, each time with its own output added to the input.",
        "Confidence comes from frequency in training data, not from checking anything.",
        "It has no access to private data, to today, or to actions — unless you build that access.",
        "Everything a model cannot do on its own is the definition of what an agent adds.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Explain what an LLM is to a non-technical stakeholder\" is a real interview question now, in product and engineering roles alike. The answer above — prediction, repeated, over long context — is the one that holds up to follow-ups.",
        "Expect to be asked what an LLM cannot do. An answer that lists the gaps and then names what closes each one (tools, retrieval, a loop) shows you have built something rather than read about it.",
        "\"Why did the model make that up?\" is a diagnostic question, and the expected answer starts with the mechanism, not with \"the model is bad\".",
      ],
    },
    {
      kind: "quiz",
      question: "In the counting model, why did `train` get a probability of 1.0 for `to`?",
      options: [
        "Because the model verified that trains always go to somewhere",
        "Because \"to\" is the only word the model ever saw after \"train\" in its tiny training text",
        "Because 1.0 is the default when a model is unsure",
        "Because both sentences in its training text were grammatically correct, which the model rewards with full probability",
      ],
      answer: 1,
      why:
        "Certainty here is just a count of one out of one. Large models are less brittle but the principle " +
        "survives: confidence reflects what the training data looked like, not whether the claim is true.",
    },
    {
      kind: "quiz",
      question:
        "A model is asked \"what is the balance on my savings account?\" and gives a specific number. What is the most likely explanation?",
      options: [
        "It has a hidden connection to your bank",
        "It produced text that looks like a plausible balance, because that is what follows such a question in its training data",
        "It picked a number at random between zero and one hundred, because a random number is all it can produce without data",
        "It refused, and the number came from elsewhere",
      ],
      answer: 1,
      why:
        "With no tool connecting it to your bank, there is no path by which the real number could reach the " +
        "model. It produced the shape of an answer. This is exactly the failure that tools and retrieval exist to fix.",
    },
    {
      kind: "quiz",
      question: "Which of these does scale (a much bigger model, much more data) genuinely improve?",
      options: [
        "The guarantee that any single claim it makes about the world will be correct",
        "The model's awareness of what it does not know",
        "How much and how subtly the prediction can be conditioned on its context",
        "Its access to information created after training",
      ],
      answer: 2,
      why:
        "Scale buys richer conditioning on context — which is why bigger models follow complicated " +
        "instructions better. It does not create access to private or future information, and it does not " +
        "turn a probability over text into a guarantee about the world.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take the counting model and make it look at the previous *two* words instead of one. Does it get better or just more certain about less?",
        "Write down three questions you would ask an AI assistant in a normal week. For each, mark whether answering it needs information the model could not possibly have.",
        "Explain to somebody who has never used one, in under a minute and without the word \"understand\", what a language model does.",
        "Find a confident claim an AI assistant made to you recently and work out where in its training data that shape of answer probably came from.",
      ],
    },
  ],
};
