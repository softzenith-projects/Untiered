import type { Chapter } from "@/content/courses/types";

export const chapterEmbeddings: Chapter = {
  slug: "embeddings",
  title: "Embeddings: Meaning as Coordinates",
  summary:
    "An embedding turns text into a list of numbers positioned so that similar meanings sit close " +
    "together. The whole of semantic search is that, plus one line of arithmetic you can do by hand.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "To find the right document for a question, you could search for matching words — and you would " +
        "miss \"my money hasn't come back\" when the document says \"refund pending\". Not one word " +
        "overlaps and they mean the same thing. **Embeddings** are the standard answer, and they are far " +
        "less mysterious than the vocabulary around them suggests. An embedding turns a piece of text " +
        "into a list of numbers — a point in space — arranged so that texts meaning similar things end " +
        "up near each other. Then \"find the most relevant document\" becomes \"find the nearest point\", " +
        "which is arithmetic.",
    },
    { kind: "h", text: "The picture: seating a wedding" },
    {
      kind: "analogy",
      title: "The seating plan where the axes are not written down",
      text:
        "At a big wedding, somebody has to seat four hundred people. They do it by putting the college " +
        "friends together at one end, the office colleagues in the middle, the relatives from the " +
        "village on the other side — and the cousin who is *both* a relative and a colleague goes " +
        "somewhere in between, closer to whichever pull is stronger. Once the plan exists, \"who should " +
        "this late arrival sit with?\" is answered by looking at the plan and pointing at the nearest " +
        "table. Nobody wrote \"this axis is how rural you are\" on the diagram; the positions carry the " +
        "information. That is an embedding space. Where the analogy stops: a wedding hall is two " +
        "dimensions and you can see it. Real embedding spaces have hundreds, and no dimension has a name " +
        "anybody could tell you — which is exactly why the results sometimes surprise you and cannot be " +
        "argued with.",
    },
    {
      kind: "concept",
      title: "Embedding",
      text:
        "A fixed-length list of numbers produced by a model from a piece of text, positioned so that " +
        "semantically similar texts are close together. The comparison is usually **cosine similarity** " +
        "— the cosine of the angle between two vectors, which ignores length and measures direction " +
        "only. The sentence-transformers documentation gives cosine similarity as its default metric, " +
        "noting that dot product, Euclidean distance and Manhattan distance are valid alternatives.",
    },
    { kind: "h", text: "Cosine similarity, by hand" },
    {
      kind: "p",
      text:
        "Here is the entire mechanism of semantic search, with four-dimensional vectors chosen by hand " +
        "so you can see why each number is what it is. Real embeddings come from a model and have " +
        "hundreds of dimensions that nobody can label — but the arithmetic below is precisely, not " +
        "approximately, what a vector database does.",
    },
    {
      kind: "code",
      caption:
        "Cosine similarity over hand-made vectors. The vectors are invented so the axes are readable; the formula is the real one. No model, no library.",
      code:
        "import math\n" +
        "\n" +
        "# Dimensions, loosely: [travel, money, complaint, food]\n" +
        "VECTORS = {\n" +
        '    "my refund has not arrived":      [0.1, 0.9, 0.8, 0.0],\n' +
        '    "where is my money":              [0.0, 0.95, 0.6, 0.0],\n' +
        '    "book a train to pune":           [0.95, 0.2, 0.0, 0.0],\n' +
        '    "the food on the train was cold": [0.6, 0.0, 0.7, 0.9],\n' +
        '    "cancel my ticket":               [0.9, 0.3, 0.2, 0.0],\n' +
        "}\n" +
        "\n" +
        "\n" +
        "def cosine(a, b):\n" +
        "    dot = sum(x * y for x, y in zip(a, b))\n" +
        "    na = math.sqrt(sum(x * x for x in a))\n" +
        "    nb = math.sqrt(sum(y * y for y in b))\n" +
        "    return dot / (na * nb)\n" +
        "\n" +
        "\n" +
        'query = "refund not received"\n' +
        "query_vec = [0.05, 0.9, 0.75, 0.0]\n" +
        "\n" +
        "scored = sorted(((cosine(query_vec, v), k) for k, v in VECTORS.items()), reverse=True)\n" +
        'print(f"query: {query!r}\\n")\n' +
        "for score, text in scored:\n" +
        '    bar = "#" * round(score * 30)\n' +
        '    print(f"  {score:.3f}  {bar:30} {text}")\n',
      output:
        "query: 'refund not received'\n" +
        "\n" +
        "  0.999  ############################## my refund has not arrived\n" +
        "  0.990  ############################## where is my money\n" +
        "  0.409  ############                   cancel my ticket\n" +
        "  0.367  ###########                    the food on the train was cold\n" +
        "  0.200  ######                         book a train to pune",
    },
    {
      kind: "p",
      text:
        "\"Where is my money\" scores 0.99 against \"refund not received\" **without sharing a single " +
        "word.** That is the whole promise of embeddings, and it is genuinely useful. But look at the " +
        "bottom half of that list as well: \"cancel my ticket\" scores 0.409, and \"book a train to " +
        "pune\" scores 0.200. Nothing is ever zero, nothing is ever excluded, and the system will always " +
        "hand you a ranked list — including when the right answer is not in the collection at all. That " +
        "is the next chapter's problem, and the one after that's danger.",
    },
    {
      kind: "steps",
      title: "What the arithmetic is doing",
      steps: [
        { label: "Dot product", text: "Multiply the two vectors position by position and add it up. Big when the two point the same way in the same dimensions." },
        { label: "Divide by both lengths", text: "This is what makes it cosine rather than dot product: length drops out, so a long document does not beat a short one just for being long." },
        { label: "Read the result", text: "1.0 is the same direction, 0 is unrelated directions. For typical text embeddings the useful range is narrower than you expect — 0.4 may already mean \"not really\"." },
        { label: "Rank and take the top k", text: "Sort by score, keep the best few. There is no natural cut-off, so you choose one — and choosing it badly is how irrelevant text gets into a prompt." },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Change `query_vec` to something travel-heavy like `[0.9, 0.1, 0.1, 0.0]` and re-run. Then add a document of your own and predict its score before you look.",
      starter:
        "import math\n" +
        "\n" +
        "# Dimensions, loosely: [travel, money, complaint, food]\n" +
        "DOCS = {\n" +
        '    "refund policy: refunds are paid within 7 working days": [0.1, 0.95, 0.4, 0.0],\n' +
        '    "how to cancel a booking":                               [0.9, 0.4, 0.2, 0.0],\n' +
        '    "pantry menu for long-distance trains":                  [0.5, 0.1, 0.0, 0.95],\n' +
        '    "complaints procedure and escalation":                   [0.2, 0.2, 0.95, 0.1],\n' +
        "}\n" +
        "\n" +
        "\n" +
        "def cosine(a, b):\n" +
        "    dot = sum(x * y for x, y in zip(a, b))\n" +
        "    na = math.sqrt(sum(x * x for x in a))\n" +
        "    nb = math.sqrt(sum(y * y for y in b))\n" +
        "    return dot / (na * nb)\n" +
        "\n" +
        "\n" +
        "query_vec = [0.05, 0.9, 0.75, 0.0]   # roughly: a complaint about money\n" +
        "TOP_K = 2\n" +
        "\n" +
        "ranked = sorted(((cosine(query_vec, v), k) for k, v in DOCS.items()), reverse=True)\n" +
        "for i, (score, text) in enumerate(ranked):\n" +
        '    mark = "SENT   " if i < TOP_K else "ignored"\n' +
        '    print(f"{mark} {score:.3f}  {text}")\n' +
        "\n" +
        'print(f"\\nTop {TOP_K} go into the prompt. Nothing here scored zero -- a ranking always returns something.")\n',
      expectedOutput:
        "SENT    0.955  refund policy: refunds are paid within 7 working days\n" +
        "SENT    0.773  complaints procedure and escalation\n" +
        "ignored 0.471  how to cancel a booking\n" +
        "ignored 0.091  pantry menu for long-distance trains\n" +
        "\n" +
        "Top 2 go into the prompt. Nothing here scored zero -- a ranking always returns something.",
    },
    { kind: "h", text: "Three things an embedding is not" },
    {
      kind: "compare",
      title: "What it measures, and what people assume it measures",
      columns: [
        {
          label: "It does measure",
          items: [
            "Whether two texts are about similar things, in the embedding model's judgement",
            "Direction in a space the model learned from the data it was trained on",
            "A relative ranking within one collection",
          ],
        },
        {
          label: "It does not measure",
          items: [
            "Whether a document answers your question — \"about refunds\" is not \"says when yours was paid\"",
            "Truth, recency, or authority. A wrong document about refunds embeds just as close as a right one.",
            "Agreement — \"refunds take 7 days\" and \"refunds do not take 7 days\" sit very near each other",
            "Anything comparable across models: scores from two different embedding models mean different things and must never be mixed",
          ],
        },
      ],
    },
    {
      kind: "p",
      text:
        "The negation problem in that right-hand column is worth dwelling on, because it bites people in " +
        "production. \"The policy allows refunds after 30 days\" and \"The policy does not allow refunds " +
        "after 30 days\" are about the same topic in the same words, so they embed very close together. " +
        "A search that finds the topic has done its job. Whether it found the sentence that says the " +
        "*right thing* is a question the arithmetic cannot answer.",
    },
    {
      kind: "pitfall",
      items: [
        "Mixing vectors from different embedding models — the spaces are unrelated, so the scores are meaningless together and the search silently returns nonsense.",
        "Treating a similarity score as a probability — 0.8 is not \"80% relevant\"; it is only meaningful relative to the other scores in the same collection with the same model.",
        "Forgetting that ranking always returns something — with an empty or irrelevant collection you still get a top result, confidently, at some score.",
        "Assuming similarity means agreement — a sentence and its negation are near neighbours, which is exactly the wrong pair to confuse in a policy document.",
        "Embedding a whole document as one vector — one point cannot represent forty pages, so everything after the first section becomes unfindable. Chunking is the next chapter.",
        "Re-embedding with a new model and not rebuilding the index — old and new vectors in one store is the quietest, longest-lived bug in this area.",
      ],
    },
    {
      kind: "remember",
      items: [
        "An embedding is a list of numbers positioned so that similar meanings sit close together.",
        "Cosine similarity is the dot product divided by both lengths — direction only, length ignored. It is the usual default.",
        "It finds topical closeness, not answers, not truth, and not agreement. A sentence and its negation are neighbours.",
        "Scores are only comparable within one collection embedded by one model. Never mix models.",
        "A ranking always returns something, including when the answer is not there at all.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How does semantic search work?\" — embed the query, embed the documents, rank by cosine similarity, take the top k. Being able to write the formula out is a strong signal.",
        "Expect the follow-up: what does a score of 0.8 mean? The honest answer — that it is relative to this collection and this model, and not a probability — is the one interviewers want.",
        "The negation example is a good thing to have ready. It shows you have thought about where retrieval fails rather than just how it works.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is cosine similarity divided by the length of both vectors?",
      options: [
        "To make the numbers smaller and easier to store, because long documents would otherwise take up far more memory",
        "So length drops out and only direction is compared — a long text does not score higher just for being long",
        "Because probabilities must sum to one",
        "To remove negative values",
      ],
      answer: 1,
      why:
        "The division normalises both vectors, leaving the angle between them. Without it you have the " +
        "dot product, which a long text can win simply by having larger numbers.",
    },
    {
      kind: "quiz",
      question: "\"Refunds are allowed after 30 days\" and \"Refunds are not allowed after 30 days\" — what will their embeddings look like?",
      options: [
        "Opposite directions, since the two sentences contradict each other and the vectors encode that meaning",
        "Very close together, because they are about the same topic in nearly the same words",
        "Unrelated, because of the word \"not\"",
        "Identical, because embeddings ignore negation entirely",
      ],
      answer: 1,
      why:
        "Embeddings capture topical similarity, and these two sentences are maximally similar topically. " +
        "This is why retrieval is good at finding the relevant *section* and no good at all at deciding " +
        "which sentence in it is correct.",
    },
    {
      kind: "quiz",
      question: "You switch to a new embedding model but keep the vectors already in your index. What happens?",
      options: [
        "Slightly worse results, because the new vectors need a few days of use before they line up with the old ones",
        "The results become meaningless, because the two models' spaces are unrelated",
        "Nothing — embeddings are a standard format",
        "The index rejects the new vectors",
      ],
      answer: 1,
      why:
        "Each model learns its own space. Comparing a vector from one model with a vector from another " +
        "is comparing coordinates from two different maps. Changing the model means re-embedding " +
        "everything, and the failure is quiet because a ranking still comes back.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "In the playground, write a query vector you expect to match nothing in the collection. Run it and see what comes back anyway.",
        "Add a document that contradicts an existing one and give it almost the same vector. Decide what your system should do when both come back.",
        "Set TOP_K to 4 and think about what the two extra documents do to the prompt — cost, and the chance of the model using the wrong one.",
        "Write down, for a collection you know, what a \"good\" score looks like. Then write down how you would ever find that out.",
      ],
    },
  ],
};
