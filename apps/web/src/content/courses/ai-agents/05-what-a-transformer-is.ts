import type { Chapter } from "@/content/courses/types";

export const chapterWhatATransformerIs: Chapter = {
  slug: "what-a-transformer-is",
  title: "What a Transformer Actually Is",
  summary:
    "One chapter that says what the architecture is without hand-waving: attention is a weighted blend " +
    "of everything in the context, computed from the context itself. You can do it by hand, and here you do.",
  minutes: 16,
  blocks: [
    {
      kind: "p",
      text:
        "You can build good agents without this chapter. You cannot talk confidently about the thing you " +
        "are building without it, and \"it's a neural network, it's complicated\" is not an answer anybody " +
        "should accept from themselves. So: one chapter, no hand-waving, and by the end you will have " +
        "computed an attention step with a pocket calculator's worth of arithmetic. The architecture is " +
        "called a **transformer**, and it comes from a 2017 paper with an unusually literal title.",
    },
    { kind: "h", text: "The picture: everyone in the room reads everyone's notes" },
    {
      kind: "analogy",
      title: "A round table where each person asks a question and everyone else holds up a label",
      text:
        "Twelve people sit around a table, each holding one word of a sentence. Person nine, holding " +
        "\"it\", needs to work out what \"it\" refers to. In the old way of doing this, a message would be " +
        "whispered around the table one seat at a time — person one to person two to person three — and " +
        "by the time it reached person nine, most of the detail had blurred into a summary, and anything " +
        "from person one had had eight chances to get lost. In the new way, person nine writes down what " +
        "she is looking for (\"a thing that could be broken\"), everyone else holds up a label saying what " +
        "they are (\"I'm a verb\", \"I'm a laptop\", \"I'm a full stop\"), she compares her question " +
        "against every label at once, and then builds her new understanding as a *blend* of everyone's " +
        "contents, weighted by how well each label matched. Nobody is whispering. Everyone is read " +
        "simultaneously, and distance around the table costs nothing. That is attention. Where the " +
        "analogy stops: the question, the labels and the contents are not words — they are lists of " +
        "numbers the model learned, and each person does this several times over with different questions " +
        "at once.",
    },
    {
      kind: "concept",
      title: "Self-attention",
      text:
        "For each position in the input, compare a *query* vector derived from that position against a " +
        "*key* vector derived from every position, turn those comparisons into weights that sum to one, " +
        "and output the weighted blend of every position's *value* vector. \"Self\" because the queries, " +
        "keys and values all come from the same sequence. The whole thing is a weighted average whose " +
        "weights are computed from the data itself — that is the entire idea, and everything else in a " +
        "transformer is scaffolding around it.",
    },
    { kind: "h", text: "The paper, and what it actually claimed" },
    {
      kind: "p",
      text:
        "*Attention Is All You Need* (Vaswani et al., arXiv:1706.03762) proposed the Transformer as an " +
        "architecture \"based solely on attention mechanisms, dispensing with recurrence and convolutions " +
        "entirely\" — that phrase is the whole contribution. Before it, sequence models read a sentence " +
        "one step at a time and carried a running summary forward, which is inherently sequential and " +
        "therefore hard to parallelise. Attention replaces the running summary with direct comparison " +
        "between every pair of positions, all at once. The results they reported on WMT 2014 translation " +
        "were 28.4 BLEU on English-to-German and 41.8 on English-to-French, the latter after training for " +
        "3.5 days on eight GPUs — which the paper describes as a small fraction of the training costs of " +
        "the best models then in the literature.",
    },
    {
      kind: "p",
      text:
        "It is worth being precise about what that paper is and is not. It is a machine-translation paper. " +
        "It does not describe chat, instruction-following, tool use or anything else this course is about " +
        "— all of that came later, from training much larger models on much more text and then tuning " +
        "them on examples of being helpful. What the paper gave the field is the block that all of those " +
        "models are stacks of.",
    },
    { kind: "h", text: "Attention, by hand" },
    {
      kind: "code",
      caption:
        "One attention step, computed from scratch. The vectors are hand-picked three-number stand-ins; real models learn hundreds or thousands of numbers per position.",
      code:
        "import math\n" +
        "\n" +
        "tokens = [\"the\", \"train\", \"to\", \"pune\"]\n" +
        "vectors = {\n" +
        '    "the":   [0.1, 0.0, 0.0],\n' +
        '    "train": [0.9, 0.2, 0.1],\n' +
        '    "to":    [0.0, 0.8, 0.0],\n' +
        '    "pune":  [0.2, 0.1, 0.9],\n' +
        "}\n" +
        "\n" +
        "\n" +
        "def dot(a, b):\n" +
        "    return sum(x * y for x, y in zip(a, b))\n" +
        "\n" +
        "\n" +
        "def softmax(xs):\n" +
        "    biggest = max(xs)\n" +
        "    exps = [math.exp(x - biggest) for x in xs]\n" +
        "    total = sum(exps)\n" +
        "    return [e / total for e in exps]\n" +
        "\n" +
        "\n" +
        '# "pune" asks: of the words here, which should I pay attention to?\n' +
        'query = vectors["pune"]\n' +
        "scale = math.sqrt(len(query))\n" +
        "\n" +
        "raw = [dot(query, vectors[t]) / scale for t in tokens]\n" +
        "weights = softmax(raw)\n" +
        "\n" +
        "print(\"query word: 'pune'\")\n" +
        "for token, r, w in zip(tokens, raw, weights):\n" +
        '    bar = "#" * round(w * 40)\n' +
        '    print(f"  {token:6} score {r:+.3f}  weight {w:.3f}  {bar}")\n' +
        "\n" +
        "blended = [sum(w * vectors[t][i] for t, w in zip(tokens, weights)) for i in range(3)]\n" +
        'print("blended representation:", [round(v, 3) for v in blended])\n',
      output:
        "query word: 'pune'\n" +
        "  the    score +0.012  weight 0.207  ########\n" +
        "  train  score +0.167  weight 0.242  ##########\n" +
        "  to     score +0.046  weight 0.214  #########\n" +
        "  pune   score +0.497  weight 0.336  #############\n" +
        "blended representation: [0.306, 0.254, 0.327]",
    },
    {
      kind: "p",
      text:
        "That is it. A dot product per pair, a divide by the square root of the vector length to keep the " +
        "numbers from getting extreme, a softmax to turn scores into weights that sum to one, and a " +
        "weighted average. \"Pune\" attends most to itself and second-most to \"train\", because those " +
        "vectors point in more similar directions. In a real model the query, key and value are each " +
        "produced by multiplying the position's vector by a learned matrix — so the model learns *what to " +
        "ask*, *what to advertise*, and *what to hand over*, separately — and this whole operation is run " +
        "several times in parallel with different learned matrices (that is what \"multi-head\" means) and " +
        "then stacked dozens of layers deep.",
    },
    {
      kind: "viz",
      title: "What \"pune\" attends to",
      caption: "The same weights as the code above. The output for this position is the blend of all four, in these proportions.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [
              { value: "the", pointers: ["0.21"] },
              { value: "train", pointers: ["0.24"] },
              { value: "to", pointers: ["0.21"] },
              { value: "pune", pointers: ["0.34"], state: "active" },
            ],
            note: "Step 1 — compare: the query from \"pune\" is dotted against every position's key. Raw scores: +0.012, +0.167, +0.046, +0.497.",
          },
          {
            cells: [
              { value: "the", pointers: ["0.21"] },
              { value: "train", pointers: ["0.24"], state: "compare" },
              { value: "to", pointers: ["0.21"] },
              { value: "pune", pointers: ["0.34"], state: "active" },
            ],
            note: "Step 2 — weight: softmax turns those scores into weights that sum to 1. \"pune\" gets 0.34, \"train\" 0.24; nothing is ignored, it is a blend and not a choice.",
          },
          {
            cells: [
              { value: "the", state: "done" },
              { value: "train", state: "done" },
              { value: "to", state: "done" },
              { value: "[0.306, 0.254, 0.327]", state: "active" },
            ],
            note: "Step 3 — blend: the new vector for this position is the weighted average of all four value vectors. That blend is what the next layer sees.",
          },
        ],
      },
    },
    {
      kind: "steps",
      title: "What happens to your prompt, start to finish",
      steps: [
        { label: "Tokenise", text: "Your text becomes a list of token ids, using the vocabulary from chapter 2." },
        {
          label: "Embed",
          text: "Each id is looked up in a big table, becoming a vector of numbers. A position signal is added, because attention by itself has no notion of order.",
        },
        {
          label: "Attend and transform, many times",
          text: "Each layer runs self-attention (blend information across positions), then a small feed-forward network applied at each position independently. Dozens of these, stacked.",
        },
        {
          label: "Score the vocabulary",
          text: "The final vector at the last position is turned into one score per token in the vocabulary.",
        },
        {
          label: "Sample, append, repeat",
          text: "A sampler picks one token (chapter 4), it is appended to the input, and the entire thing runs again — which is why generation gets slower the longer the output.",
        },
      ],
    },
    { kind: "h", text: "Where the weights actually are" },
    {
      kind: "code",
      caption: "Counting the parameters of a small transformer, at the paper's base dimensions. Arithmetic only — nothing is trained or downloaded here.",
      code:
        "vocab = 50_000\n" +
        "d_model = 512\n" +
        "layers = 6\n" +
        "d_ff = 2048\n" +
        "\n" +
        "embedding = vocab * d_model\n" +
        "attention_per_layer = 4 * d_model * d_model      # query, key, value, output\n" +
        "feedforward_per_layer = 2 * d_model * d_ff       # in and out\n" +
        "per_layer = attention_per_layer + feedforward_per_layer\n" +
        "\n" +
        "total = embedding + layers * per_layer\n" +
        "\n" +
        'print(f"embedding table   : {embedding:>12,}")\n' +
        'print(f"attention / layer : {attention_per_layer:>12,}")\n' +
        'print(f"feed-forward/layer: {feedforward_per_layer:>12,}")\n' +
        'print(f"{layers} layers          : {layers * per_layer:>12,}")\n' +
        'print(f"total             : {total:>12,}")\n' +
        'print(f"attention is {100 * layers * attention_per_layer / total:.1f}% of the weights")\n',
      output:
        "embedding table   :   25,600,000\n" +
        "attention / layer :    1,048,576\n" +
        "feed-forward/layer:    2,097,152\n" +
        "6 layers          :   18,874,368\n" +
        "total             :   44,474,368\n" +
        "attention is 14.1% of the weights",
    },
    {
      kind: "p",
      text:
        "A pleasing surprise: attention, the part everything is named after, is a minority of the " +
        "parameters. Most of the weights are in the feed-forward blocks and — at this small scale — the " +
        "embedding table. Attention is where information *moves between positions*; the feed-forward " +
        "layers are where most of the stored knowledge lives. That is a useful mental model when somebody " +
        "asks where a model's facts are kept.",
    },
    {
      kind: "compare",
      title: "Why attention replaced reading one word at a time",
      columns: [
        {
          label: "Recurrent (the old way)",
          items: [
            "Reads position by position, carrying a running summary",
            "Information from far back has to survive every intermediate step",
            "Inherently sequential, so training is hard to parallelise",
            "Cost grows linearly with sequence length",
          ],
        },
        {
          label: "Attention (the transformer)",
          items: [
            "Every position compares directly against every position, in one step",
            "Distance costs nothing — position 1 and position 900 are one comparison apart",
            "All positions computed together, so training parallelises across the sequence",
            "Cost grows with the square of the sequence length, which is why long contexts are expensive",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Change the vector for `to` to `[0.2, 0.1, 0.85]` — almost the same direction as `pune` — and re-run. Watch which word \"pune\" starts attending to.",
      starter:
        "import math\n" +
        "\n" +
        'tokens = ["the", "train", "to", "pune"]\n' +
        "vectors = {\n" +
        '    "the":   [0.1, 0.0, 0.0],\n' +
        '    "train": [0.9, 0.2, 0.1],\n' +
        '    "to":    [0.0, 0.8, 0.0],\n' +
        '    "pune":  [0.2, 0.1, 0.9],\n' +
        "}\n" +
        "\n" +
        "\n" +
        "def dot(a, b):\n" +
        "    return sum(x * y for x, y in zip(a, b))\n" +
        "\n" +
        "\n" +
        "def softmax(xs):\n" +
        "    biggest = max(xs)\n" +
        "    exps = [math.exp(x - biggest) for x in xs]\n" +
        "    return [e / sum(exps) for e in exps]\n" +
        "\n" +
        "\n" +
        'query = vectors["pune"]\n' +
        "scale = math.sqrt(len(query))\n" +
        "weights = softmax([dot(query, vectors[t]) / scale for t in tokens])\n" +
        "\n" +
        "for token, w in zip(tokens, weights):\n" +
        '    bar = "#" * round(w * 40)\n' +
        '    print(f"{token:6} {w:.3f} {bar}")\n',
      expectedOutput:
        "the    0.207 ########\n" +
        "train  0.242 ##########\n" +
        "to     0.214 #########\n" +
        "pune   0.336 #############",
    },
    {
      kind: "pitfall",
      items: [
        "Thinking attention is a database lookup — it is a weighted average over everything, so nothing is ever fully selected and nothing is ever fully ignored, which is part of why a long context dilutes rather than fails cleanly.",
        "Assuming the 2017 paper explains chat behaviour — it is a translation paper describing the block; instruction-following and tool use come from later training, not from the architecture.",
        "Believing attention is where the knowledge is stored — attention moves information between positions, while most parameters, and most stored knowledge, sit in the feed-forward layers.",
        "Forgetting the quadratic cost — every position attending to every position means doubling the context roughly quadruples that part of the work, which is the real reason long contexts cost what they do.",
        "Treating position as free — attention alone is order-blind, so position information has to be added explicitly; without it, \"Pune to Mumbai\" and \"Mumbai to Pune\" would be identical inputs.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Attention = compare a query against every key, softmax the scores into weights, output the weighted blend of values. That is the whole operation.",
        "The Transformer paper's claim was doing this \"dispensing with recurrence and convolutions entirely\" (arXiv:1706.03762).",
        "Attention moves information between positions; the feed-forward layers hold most of the parameters and most of the knowledge.",
        "Every position attends to every position, so the cost grows with the square of the context length.",
        "The architecture explains fluency and context use. It does not explain truth, and nothing in it checks anything.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Explain attention\" is asked in a great many AI interviews and most answers are vague. Query, key, value, softmax, weighted average — named in order, with what each one is for — is a complete answer in thirty seconds.",
        "A common follow-up is why long context is expensive. \"Every position attends to every position, so it is quadratic in sequence length\" is what they are listening for.",
        "Expect to be asked what the architecture does *not* give you. That it contains no mechanism for verifying a claim is the answer that leads naturally into agents.",
      ],
    },
    {
      kind: "quiz",
      question: "In self-attention, what determines how much one position contributes to another's output?",
      options: [
        "How close the two positions are in the sequence, with nearby tokens always weighted more heavily",
        "The softmax of the dot product between one position's query and the other's key",
        "The order in which the tokens were generated",
        "A fixed table set when the model was designed",
      ],
      answer: 1,
      why:
        "The weights are computed from the data itself — a query-key dot product, scaled, then softmaxed. " +
        "Distance in the sequence has no direct effect, which is exactly what attention bought over recurrence.",
    },
    {
      kind: "quiz",
      question: "What did *Attention Is All You Need* say the Transformer dispenses with?",
      options: [
        "Training data, and the need for labelled examples",
        "Recurrence and convolutions, entirely",
        "Tokenization",
        "Positional information",
      ],
      answer: 1,
      why:
        "The paper's central claim is an architecture \"based solely on attention mechanisms, dispensing with " +
        "recurrence and convolutions entirely\". Positional information is very much still needed — it is " +
        "added explicitly, precisely because attention alone is order-blind.",
    },
    {
      kind: "quiz",
      question: "Why does doubling the context length cost more than twice as much in the attention layers?",
      options: [
        "Because the model has to learn a larger vocabulary every time the context gets longer, which doubles the training cost of each layer",
        "Because every position attends to every position, so the number of comparisons grows with the square of the length",
        "Because the embedding table doubles",
        "Because the model has to run twice",
      ],
      answer: 1,
      why:
        "n positions each comparing against n positions is n² comparisons. This quadratic term is the reason " +
        "long-context calls are priced and timed the way they are, and one reason retrieving the right few " +
        "passages beats pasting the whole document.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "In the playground, make two words' vectors nearly identical and predict what will happen to the attention weights before you run it.",
        "Work out by hand what the attention weights would be if every vector were identical. What does that tell you about a context full of near-duplicate text?",
        "Explain attention to somebody in sixty seconds using the round-table picture, without using the words \"query\", \"key\" or \"value\". Then do it again using only those words.",
        "Given that attention is quadratic in length, estimate how much more the attention work costs for a 32,000-token context than for an 8,000-token one.",
      ],
    },
  ],
};
