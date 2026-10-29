import type { Chapter } from "@/content/courses/types";

export const chapterRetrievalAndRag: Chapter = {
  slug: "retrieval-and-rag",
  title: "Retrieval: Putting the Facts in the Prompt",
  summary:
    "RAG is three steps — retrieve, assemble, answer from what was retrieved. The discipline is in the " +
    "third: cite the passage, and say NOT IN THE SOURCES when it is not there.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Chapter 10 named the knowledge wall: the model cannot answer from information it never had. " +
        "Chapter 18 gave you a way to find the right piece of text. Put those together and you get the " +
        "most widely deployed pattern in the whole field — **retrieval-augmented generation**, which is " +
        "a grand name for something almost embarrassingly simple: look the relevant passages up first, " +
        "paste them into the prompt, and tell the model to answer from those and nothing else.",
    },
    { kind: "h", text: "The picture: the open-book exam with a rule" },
    {
      kind: "analogy",
      title: "Open book, and every answer must give a page number",
      text:
        "Two students sit an open-book exam. The first answers from memory and glances at the book " +
        "occasionally; where memory fails, he writes something confident and moves on. The second is " +
        "given a stricter instruction: for every claim you make, write the page number it came from, " +
        "and if you cannot find a page, write \"not in the book\". Both have the same knowledge and the " +
        "same book. The second one's paper is *checkable* — a marker can look up every page number in " +
        "ten minutes and find out exactly which claims are supported. That is the difference between " +
        "pasting some context in and doing retrieval properly, and it is almost entirely about the rule, " +
        "not the book. Where the analogy stops: the second student would notice when the book does not " +
        "cover something. A model has to be given the exact words to write in that case, or it will " +
        "quietly go back to answering from memory.",
    },
    {
      kind: "concept",
      title: "Retrieval-augmented generation (RAG)",
      text:
        "Combining the model's built-in knowledge with a searchable external collection, so that the " +
        "facts for a specific answer come from the collection rather than the weights. The original " +
        "paper (Lewis et al., arXiv:2005.11401) frames this as combining **parametric memory** — a " +
        "pre-trained model — with **non-parametric memory**, in their case a dense vector index of " +
        "Wikipedia accessed with a pre-trained neural retriever. It reports state-of-the-art results on " +
        "three open-domain question-answering tasks, and — the part that matters most for building " +
        "things — that RAG models generated \"more specific, diverse and factual language\" than a " +
        "parametric-only baseline.",
    },
    { kind: "h", text: "The whole pipeline" },
    {
      kind: "steps",
      title: "Retrieve, assemble, answer",
      steps: [
        { label: "Index, once", text: "Split the documents into chunks, embed each chunk, store the vectors with their text and their source. This is the part you do ahead of time." },
        { label: "Retrieve, per question", text: "Embed the question, find the nearest chunks, and — crucially — drop anything below a score floor rather than always taking the top k." },
        { label: "Assemble", text: "Build a prompt containing only those passages, each labelled with an id and a source, and an instruction to answer from them alone." },
        { label: "Answer, with citations", text: "Require a passage id on every claim, so the answer is checkable rather than merely plausible." },
        { label: "Or refuse", text: "Give an exact string for \"the passages do not contain this\" — and if nothing cleared the floor, do not call the model at all." },
      ],
    },
    {
      kind: "code",
      caption:
        "A whole RAG pipeline, small enough to read. The vectors are hand-made; the retrieval, the score floor, the prompt and the refusal path are all real. No model is called.",
      code:
        "import math\n" +
        "\n" +
        "CORPUS = [\n" +
        '    {"id": "policy-3", "text": "Refunds for returned items are paid within 7 working days of the return being received.",\n' +
        '     "vec": [0.1, 0.95, 0.3, 0.0], "source": "Returns policy, section 3", "updated": "2026-04-01"},\n' +
        '    {"id": "policy-9", "text": "Refunds are paid to the original payment method. We cannot pay to a different account.",\n' +
        '     "vec": [0.05, 0.9, 0.35, 0.0], "source": "Returns policy, section 9", "updated": "2026-04-01"},\n' +
        '    {"id": "faq-12", "text": "To cancel a booking, open My Trips and choose Cancel at least 4 hours before departure.",\n' +
        '     "vec": [0.9, 0.35, 0.1, 0.0], "source": "Help centre, FAQ 12", "updated": "2025-11-20"},\n' +
        "]\n" +
        "\n" +
        "\n" +
        "def cosine(a, b):\n" +
        "    dot = sum(x * y for x, y in zip(a, b))\n" +
        "    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))\n" +
        "\n" +
        "\n" +
        "def retrieve(query_vec, k=2, floor=0.5):\n" +
        '    scored = sorted(((cosine(query_vec, d["vec"]), d) for d in CORPUS), key=lambda p: -p[0])\n' +
        "    return [(s, d) for s, d in scored[:k] if s >= floor]\n" +
        "\n" +
        "\n" +
        "def build_prompt(question, hits):\n" +
        "    if not hits:\n" +
        "        return None\n" +
        "    lines = [\n" +
        '        "Answer the question using ONLY the passages below.",\n' +
        '        "Cite the passage id for every claim, like this: [policy-3].",\n' +
        '        "If the passages do not contain the answer, reply exactly: NOT IN THE SOURCES.",\n' +
        '        "",\n' +
        "    ]\n" +
        "    for score, doc in hits:\n" +
        "        lines.append(f\"[{doc['id']}] ({doc['source']}, updated {doc['updated']}, score {score:.2f})\")\n" +
        '        lines.append(doc["text"])\n' +
        '        lines.append("")\n' +
        '    lines.append(f"Question: {question}")\n' +
        '    return "\\n".join(lines)\n' +
        "\n" +
        "\n" +
        'question = "How long does a refund take?"\n' +
        "hits = retrieve([0.05, 0.9, 0.4, 0.0])\n" +
        "prompt = build_prompt(question, hits)\n" +
        'print(prompt if prompt else "Nothing cleared the score floor. Say so; do not call the model.")\n' +
        'print("---")\n' +
        "\n" +
        'question2 = "What is the baggage allowance?"\n' +
        "hits2 = retrieve([0.3, 0.1, 0.1, 0.9])\n" +
        "prompt2 = build_prompt(question2, hits2)\n" +
        'print(prompt2 if prompt2 else "Nothing cleared the score floor. Say so; do not call the model.")\n',
      output:
        "Answer the question using ONLY the passages below.\n" +
        "Cite the passage id for every claim, like this: [policy-3].\n" +
        "If the passages do not contain the answer, reply exactly: NOT IN THE SOURCES.\n" +
        "\n" +
        "[policy-9] (Returns policy, section 9, updated 2026-04-01, score 1.00)\n" +
        "Refunds are paid to the original payment method. We cannot pay to a different account.\n" +
        "\n" +
        "[policy-3] (Returns policy, section 3, updated 2026-04-01, score 0.99)\n" +
        "Refunds for returned items are paid within 7 working days of the return being received.\n" +
        "\n" +
        "Question: How long does a refund take?\n" +
        "---\n" +
        "Nothing cleared the score floor. Say so; do not call the model.",
    },
    {
      kind: "p",
      text:
        "Two things in that output are worth more than the code. First, look at the ranking: the " +
        "question is *how long* a refund takes, and the top hit is the passage about *which account* it " +
        "goes to, scoring 1.00. Retrieval found the topic, not the answer — exactly as chapter 18 " +
        "warned. The right passage is there, in second place, which is why taking two passages rather " +
        "than one saved this query. Second, the baggage question returned nothing above the floor, and " +
        "the pipeline **did not call the model at all**. That is not an error path; it is the correct " +
        "behaviour, and it is the cheapest honest answer in the entire system.",
    },
    { kind: "h", text: "The three lines that do the work" },
    {
      kind: "p",
      text:
        "The instructions at the top of that prompt are not boilerplate. Each one closes a specific " +
        "failure from earlier in this course. \"Using ONLY the passages below\" stops the model topping " +
        "up from its own memory, which is where the plausible invention comes from. \"Cite the passage " +
        "id for every claim\" makes the answer checkable — and gives you something to test " +
        "automatically, since an id that does not appear in the retrieved set is a fault you can detect " +
        "without a human. \"Reply exactly: NOT IN THE SOURCES\" gives honest failure a *shape*, which " +
        "chapter 7 established is the only way to make it the likely continuation.",
    },
    {
      kind: "compare",
      title: "Retrieval versus giving the agent a search tool",
      columns: [
        {
          label: "Retrieve first, then answer",
          items: [
            "One retrieval, one model call — predictable cost and latency",
            "You control exactly what is in the context",
            "Simpler to test: the same question retrieves the same passages",
            "Cannot follow up — if the first retrieval missed, the answer is built on the wrong passages",
          ],
        },
        {
          label: "Give the agent a search tool",
          items: [
            "The agent can search again with better words after seeing what came back",
            "Can combine several searches, and stop when it has enough",
            "Costs a loop: several calls, variable latency, and the reliability multiplication from chapter 16",
            "Needs everything module 3 taught — stopping conditions, observations, step limits",
          ],
        },
      ],
    },
    {
      kind: "p",
      text:
        "Both are legitimate and the choice is the one from chapter 16. If the question is answerable " +
        "from one good retrieval, retrieve and answer — it is one call and it is testable. If the user's " +
        "question needs several lookups whose order you cannot predict, make search a tool and put it in " +
        "a loop. Do not start with the loop.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Raise `floor` to 0.995 and re-run: the refund question now keeps only one passage, and it is the one about payment method, not the one that answers the question. Then try 0.1 and see what a too-low floor lets through.",
      starter:
        "import math\n" +
        "\n" +
        "CORPUS = [\n" +
        '    ("policy-3", "Refunds are paid within 7 working days.", [0.1, 0.95, 0.3, 0.0]),\n' +
        '    ("policy-9", "Refunds go to the original payment method.", [0.05, 0.9, 0.35, 0.0]),\n' +
        '    ("faq-12", "Cancel in My Trips, 4 hours before departure.", [0.9, 0.35, 0.1, 0.0]),\n' +
        "]\n" +
        "\n" +
        "\n" +
        "def cosine(a, b):\n" +
        "    dot = sum(x * y for x, y in zip(a, b))\n" +
        "    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))\n" +
        "\n" +
        "\n" +
        "query = [0.05, 0.9, 0.4, 0.0]   # 'how long does a refund take?'\n" +
        "floor = 0.5\n" +
        "k = 2\n" +
        "\n" +
        "ranked = sorted(((cosine(query, v), i, t) for i, t, v in CORPUS), reverse=True)\n" +
        "kept = [r for r in ranked[:k] if r[0] >= floor]\n" +
        "\n" +
        "for score, doc_id, text in ranked:\n" +
        "    state = (\n" +
        '        "SENT   " if (score, doc_id, text) in kept\n' +
        '        else "cut    " if score < floor\n' +
        '        else "beyond k"\n' +
        "    )\n" +
        '    print(f"{state} {score:.3f}  [{doc_id}] {text}")\n' +
        "\n" +
        "if not kept:\n" +
        '    print("\\nNothing cleared the floor -> answer NOT IN THE SOURCES without calling the model.")\n',
      expectedOutput:
        "SENT    0.999  [policy-9] Refunds go to the original payment method.\n" +
        "SENT    0.993  [policy-3] Refunds are paid within 7 working days.\n" +
        "cut     0.418  [faq-12] Cancel in My Trips, 4 hours before departure.",
    },
    {
      kind: "pitfall",
      items: [
        "Always taking the top k — a ranking never returns nothing, so without a score floor every question gets passages, including questions your collection cannot answer.",
        "Omitting the refusal string — without an exact phrase to produce, \"the passages do not cover this\" is not a shape the model has, so it tops up from memory instead.",
        "Not citing — an uncited RAG answer is indistinguishable from an uncited invented one, and you have given up the one property that made retrieval worth doing.",
        "Not checking the citations — a cited id that was not in the retrieved set is a fault a five-line test catches, and almost nobody writes that test.",
        "Pasting the whole document because it fits — the lost-in-the-middle result from chapter 3 says the middle of a long paste is the worst place for the sentence you need.",
        "Forgetting the collection goes stale — a policy updated in the source system and not re-indexed produces a confidently cited, correctly formatted, out-of-date answer.",
      ],
    },
    {
      kind: "remember",
      items: [
        "RAG = retrieve the relevant passages, put them in the prompt, answer from them alone, cite each claim.",
        "The original paper frames it as parametric memory (the model) plus non-parametric memory (a vector index) — arXiv:2005.11401.",
        "A score floor is not optional. Without one, every question gets passages, including the ones your collection cannot answer.",
        "Give honest failure an exact string, or the model will fall back to answering from memory.",
        "Citations are what make the answer checkable — and checking that the cited ids were actually retrieved is a test you can automate.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Explain RAG\" is now table stakes. Say the three steps, then say the discipline — score floor, citations, an exact refusal string — because that is what separates having read about it.",
        "Expect \"how do you stop it answering from memory?\" The answer is the ONLY-these-passages instruction plus citation checking, not a stronger adjective.",
        "A strong closing point: an uncited RAG answer has thrown away the only advantage retrieval gave you.",
      ],
    },
    {
      kind: "quiz",
      question: "Your RAG system always sends the top 3 passages. A user asks about something your collection does not cover. What happens?",
      options: [
        "Retrieval returns nothing and the system tells the user plainly that the collection has no answer",
        "The three least-irrelevant passages are sent anyway, and the model answers from them",
        "The embedding model raises an error",
        "The scores are all exactly zero",
      ],
      answer: 1,
      why:
        "A ranking always produces a top 3. Without a score floor, irrelevant passages are presented to " +
        "the model as though they were the relevant ones — which is how a confidently cited wrong answer " +
        "gets built.",
    },
    {
      kind: "quiz",
      question: "Why require a passage id on every claim?",
      options: [
        "It makes the answer longer and therefore more thorough, because every claim then carries extra text",
        "It makes each claim checkable — by a person, and by a test that verifies the cited ids were really retrieved",
        "The model reasons better when it cites",
        "It is required by the RAG paper",
      ],
      answer: 1,
      why:
        "Citations turn a plausible answer into a verifiable one, and they give you something to assert " +
        "in a test. An id that was never in the retrieved set is a fault you can detect automatically.",
    },
    {
      kind: "quiz",
      question: "In the pipeline above, the top passage for \"how long does a refund take?\" was the one about payment method. What does this illustrate?",
      options: [
        "The embedding model is broken, because a model that worked would have ranked the passage about timing first",
        "Retrieval finds topical closeness, not answers — which is why k > 1 and a citation requirement both matter",
        "The score floor was set too low",
        "Cosine similarity should have been dot product",
      ],
      answer: 1,
      why:
        "Both passages are about refunds, so both are topically close. Retrieval cannot tell which one " +
        "answers the question; taking more than one passage, and requiring the model to cite which it " +
        "used, is how the system copes with that.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Set the floor to 0.995 in the playground and read the answer the model would have had to build from one wrong passage.",
        "Write the three prompt lines for a collection you know — the ONLY instruction, the citation format, and the exact refusal string.",
        "Write the test that checks every cited id was in the retrieved set. It is about five lines and almost nobody has it.",
        "Work out how your collection would get re-indexed when a source document changes, and what a stale answer would look like to a user.",
      ],
    },
  ],
};
