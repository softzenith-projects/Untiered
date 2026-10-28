import type { Chapter } from "@/content/courses/types";

export const chapterWhyVectorSearchIsNotMagic: Chapter = {
  slug: "why-vector-search-is-not-magic",
  title: "Why Vector Search Is Not Magic",
  summary:
    "Most RAG failures are not the model's. They are chunks that split a sentence in half, a query whose " +
    "words the embedding ignored, and a store that hands one tenant's documents to another.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "A retrieval system that is demonstrably working can still be quietly, systematically wrong, and " +
        "the causes are almost never exotic. They are decisions made early, by someone choosing a " +
        "default, about how the text was cut up and how the search is done — plus one category that is " +
        "not a quality problem at all but a security one. This chapter is the list, with the one that " +
        "does the most damage first.",
    },
    { kind: "h", text: "The picture: the photocopier that cut the page" },
    {
      kind: "analogy",
      title: "The notice that was photocopied in two halves",
      text:
        "A hostel notice reads: \"Visitors are not permitted after 9pm.\" Somebody photocopies the " +
        "noticeboard in two overlapping halves and pins the halves in different corridors. One of them " +
        "reads \"Visitors are\" and the other reads \"permitted after 9pm.\" Both are accurate " +
        "photocopies. Neither is a lie. And the second one, read alone by somebody who never saw the " +
        "first, says the opposite of the rule. Nobody forged anything; the scissors did it. That is " +
        "chunking. Where the analogy stops: a student would probably notice the sentence looked odd. A " +
        "retrieval system will hand that half-notice to a model as an authoritative passage, and the " +
        "model — correctly following your instruction to answer only from the passages — will tell a " +
        "customer that visitors are permitted after 9pm, with a citation.",
    },
    { kind: "h", text: "Failure one: the chunks" },
    {
      kind: "code",
      caption: "The same policy text cut two ways. Real Python string splitting, and the flagged chunk is genuinely what the retriever would store.",
      code:
        "text = (\n" +
        '    "Refunds. Refunds for returned items are paid within seven working days of the return "\n' +
        '    "being received at our warehouse. The refund is paid to the original payment method. "\n' +
        '    "We cannot pay a refund to a different account, even at the customer\'s request."\n' +
        ")\n" +
        "\n" +
        'CLAIM = "pay a refund to a different account"\n' +
        'NEGATION = "cannot pay a refund to a different account"\n' +
        "\n" +
        "\n" +
        "def chunk(text, size, overlap):\n" +
        "    words = text.split()\n" +
        "    out, start = [], 0\n" +
        "    while start < len(words):\n" +
        '        out.append(" ".join(words[start:start + size]))\n' +
        "        start += size - overlap\n" +
        "    return out\n" +
        "\n" +
        "\n" +
        "for size, overlap in [(15, 0), (15, 10)]:\n" +
        "    chunks = chunk(text, size, overlap)\n" +
        '    print(f"size={size} overlap={overlap}: {len(chunks)} chunks")\n' +
        "    for i, c in enumerate(chunks, start=1):\n" +
        "        if CLAIM in c and NEGATION not in c:\n" +
        '            flag = "  <-- says the OPPOSITE of the policy"\n' +
        "        elif NEGATION in c:\n" +
        '            flag = "  <-- correct, negation intact"\n' +
        "        else:\n" +
        '            flag = ""\n' +
        '        print(f"  chunk {i}: {c}{flag}")\n' +
        "    print()\n",
      output:
        "size=15 overlap=0: 3 chunks\n" +
        "  chunk 1: Refunds. Refunds for returned items are paid within seven working days of the return being\n" +
        "  chunk 2: received at our warehouse. The refund is paid to the original payment method. We cannot\n" +
        "  chunk 3: pay a refund to a different account, even at the customer's request.  <-- says the OPPOSITE of the policy\n" +
        "\n" +
        "size=15 overlap=10: 9 chunks\n" +
        "  chunk 1: Refunds. Refunds for returned items are paid within seven working days of the return being\n" +
        "  chunk 2: are paid within seven working days of the return being received at our warehouse. The\n" +
        "  chunk 3: days of the return being received at our warehouse. The refund is paid to the\n" +
        "  chunk 4: received at our warehouse. The refund is paid to the original payment method. We cannot\n" +
        "  chunk 5: refund is paid to the original payment method. We cannot pay a refund to a\n" +
        "  chunk 6: original payment method. We cannot pay a refund to a different account, even at the  <-- correct, negation intact\n" +
        "  chunk 7: pay a refund to a different account, even at the customer's request.  <-- says the OPPOSITE of the policy\n" +
        "  chunk 8: different account, even at the customer's request.\n" +
        "  chunk 9: customer's request.",
    },
    {
      kind: "p",
      text:
        "Read that carefully, because it is more uncomfortable than the usual advice suggests. With no " +
        "overlap, the word \"cannot\" ends one chunk and its verb begins the next — and chunk 3, stored " +
        "and retrievable and perfectly quotable, states the opposite of the policy. Adding overlap " +
        "*does* produce a correct chunk — but it does not remove the dangerous one; it adds a correct " +
        "neighbour beside it and triples the number of chunks. **Overlap improves your odds. It does " +
        "not make the problem go away.** What does help is chunking on structure — sentences, " +
        "paragraphs, headings — rather than on a word count that knows nothing about where a thought ends.",
    },
    {
      kind: "compare",
      title: "Chunking choices, and what each one costs",
      columns: [
        {
          label: "Small chunks",
          items: [
            "Precise: a hit is mostly the thing you wanted",
            "Cheap to put several in a prompt",
            "Lose the surrounding context that made the sentence mean what it means",
            "Split sentences, and a split sentence can invert",
          ],
        },
        {
          label: "Large chunks",
          items: [
            "Keep the argument, the exceptions and the negations together",
            "Fewer, more self-contained units to reason about",
            "One vector has to represent a lot, so the match gets vaguer",
            "Expensive in the prompt, and the lost-in-the-middle effect applies within them",
          ],
        },
        {
          label: "Structural chunks",
          items: [
            "Split on headings, paragraphs and sentence ends — where a human would",
            "Chunks are naturally self-contained and rarely invert",
            "Needs documents with structure, which not all of them have",
            "Uneven sizes, so your budgeting has to handle a chunk ten times the average",
          ],
        },
      ],
    },
    { kind: "h", text: "Failure two: the words the embedding did not care about" },
    {
      kind: "p",
      text:
        "Semantic search is good at meaning and bad at exact tokens. Search for order `A-4471`, or error " +
        "code `ERR_TLS_CERT_ALTNAME_INVALID`, or the surname of one customer, and an embedding will " +
        "cheerfully return things that are *about* orders, errors and customers. The identifier is " +
        "precisely the part that does not survive being turned into a direction in space. The standard " +
        "answer is **hybrid search**: run a keyword search and a vector search, and combine the results, " +
        "so exact matches and semantic matches can both surface. If your users search for identifiers — " +
        "and in any support, legal or engineering domain they will — this is not an optimisation, it is " +
        "the difference between working and not.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "The vector side scores high on topic and the keyword side scores high on the exact id. Change `alpha` to 1.0 (vector only) and watch the right document drop.",
      starter:
        "# A crude hybrid: combine a semantic score with an exact-match score.\n" +
        "DOCS = {\n" +
        '    "ticket-88": ("Order A-4471 was refunded on 8 September.", 0.55),\n' +
        '    "guide-2":   ("How refunds work and when they are paid.",   0.95),\n' +
        '    "guide-7":   ("Common questions about returns and refunds.", 0.92),\n' +
        "}\n" +
        "\n" +
        'query = "refund for order A-4471"\n' +
        "alpha = 0.5   # 1.0 = vector only, 0.0 = keyword only\n" +
        "\n" +
        "terms = [t for t in query.split() if any(c.isdigit() for c in t) or t[:1].isupper()]\n" +
        'print("exact-ish terms the keyword side looks for:", terms, "\\n")\n' +
        "\n" +
        "rows = []\n" +
        "for doc_id, (text, vector_score) in DOCS.items():\n" +
        "    keyword_score = sum(1 for t in terms if t in text) / max(1, len(terms))\n" +
        "    combined = alpha * vector_score + (1 - alpha) * keyword_score\n" +
        "    rows.append((combined, vector_score, keyword_score, doc_id, text))\n" +
        "\n" +
        "for combined, v, k, doc_id, text in sorted(rows, reverse=True):\n" +
        '    print(f"{combined:.3f}  (vec {v:.2f}, kw {k:.2f})  [{doc_id}] {text}")\n',
      expectedOutput:
        "exact-ish terms the keyword side looks for: ['A-4471'] \n" +
        "\n" +
        "0.775  (vec 0.55, kw 1.00)  [ticket-88] Order A-4471 was refunded on 8 September.\n" +
        "0.475  (vec 0.95, kw 0.00)  [guide-2] How refunds work and when they are paid.\n" +
        "0.460  (vec 0.92, kw 0.00)  [guide-7] Common questions about returns and refunds.",
    },
    { kind: "h", text: "Failure three: the one that is a security problem" },
    {
      kind: "p",
      text:
        "This category is not about quality at all. The OWASP Top 10 for LLM Applications 2025 lists " +
        "**LLM08: Vector and Embedding Weaknesses**, noting that vectors and embeddings present " +
        "significant security risks in systems using RAG. The risks it names are worth reading as a " +
        "checklist rather than a warning:",
    },
    {
      kind: "table",
      head: ["Risk (OWASP LLM08:2025)", "What it looks like", "What it means for your design"],
      rows: [
        [
          "Unauthorised access and data leakage",
          "Inadequate access controls let sensitive, personal or proprietary content be retrieved from embeddings.",
          "The vector store needs the same authorisation as the source system. A document nobody could open must not be retrievable either.",
        ],
        [
          "Cross-context information leaks",
          "In multi-tenant environments, one group's data is retrieved for another group's queries.",
          "Filter by tenant *in the query*, not after ranking. A shared index with post-filtering leaks the moment a filter is forgotten.",
        ],
        [
          "Embedding inversion",
          "Attackers reverse-engineer embeddings to recover substantial source information.",
          "Treat stored vectors as carrying the content, not as an anonymised form of it. They are personal data if the text was.",
        ],
        [
          "Data poisoning",
          "Manipulated source data leads to corrupted content and manipulated outputs.",
          "Validate what enters the collection. Anything user-submitted is untrusted, and retrieval puts it straight into a prompt.",
        ],
        [
          "Behaviour alteration",
          "Retrieval augmentation unintentionally modifies the model's characteristics, such as reducing empathy in responses.",
          "Evaluate the assistant's behaviour after adding retrieval, not just its accuracy. The tone can move without anybody deciding it should.",
        ],
      ],
    },
    {
      kind: "p",
      text:
        "The prevention measures OWASP lists are correspondingly ordinary: fine-grained access controls " +
        "and permission-aware vector stores, robust validation pipelines for knowledge sources, tagging " +
        "and classifying data to control access levels, and detailed immutable logs of retrieval " +
        "activity. Note that the second and fourth of those connect directly to the next module — a " +
        "poisoned document is an instruction sitting in your collection, waiting to be retrieved into a " +
        "prompt, which is prompt injection with extra steps.",
    },
    {
      kind: "concept",
      title: "Permission-aware retrieval",
      text:
        "Applying the user's actual permissions to the retrieval query itself, so the candidate set only " +
        "ever contains documents that user may see. The tempting alternative — retrieve widely, then " +
        "filter the results — is wrong in two ways: the filter is one forgotten branch away from " +
        "leaking, and by the time the passage is in the prompt, the model has already read it.",
    },
    {
      kind: "pitfall",
      items: [
        "Chunking by character count and moving on — the default settings split sentences, and a split sentence can state the opposite of the source.",
        "Relying on overlap to fix chunking — it adds a correct neighbour, it does not remove the dangerous chunk, and it multiplies the size of your index.",
        "Using pure vector search where users search for identifiers — order numbers, error codes and surnames are exactly what embeddings blur away.",
        "Filtering by tenant after ranking instead of inside the query — one missed branch and one user's documents are in another user's prompt.",
        "Treating a vector as anonymised text — embedding inversion is on OWASP's list, and a vector derived from personal data is personal data.",
        "Indexing user-submitted content without validation — that is a poisoned document with a guaranteed route into a prompt.",
        "Never reading the retrieved passages — most RAG debugging is answered in ten seconds by printing what was actually sent.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Most RAG failures happen before the model: bad chunks, a query the embedding blurred, or the wrong documents retrieved.",
        "A chunk that splits a negation can state the opposite of the source, and it will be cited.",
        "Overlap improves your odds; structural chunking, on sentences and headings, is the actual fix.",
        "Use hybrid search wherever users search for identifiers. Embeddings are bad at exact tokens by design.",
        "OWASP LLM08 makes the vector store a security surface: permission-aware retrieval, tenant filtering in the query, validated sources, retrieval logs.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Your RAG system gives confidently wrong answers — where do you look first?\" The expected answer is the retrieved passages, then the chunking, then the query. The model is the last place to look.",
        "Being able to name hybrid search, and say why exact identifiers need it, is a very practical signal.",
        "Bringing up multi-tenant leakage unprompted marks you out. Most candidates talk about quality; few talk about who is allowed to see the passage.",
      ],
    },
    {
      kind: "quiz",
      question: "A chunk reads \"pay a refund to a different account, even at the customer's request.\" The source says \"We cannot pay a refund to a different account.\" What went wrong?",
      options: [
        "The embedding model mis-encoded the negation, so the stored chunk carries the opposite meaning",
        "The chunk boundary fell between \"cannot\" and its verb, so the stored passage says the opposite of the source",
        "The model hallucinated the passage when it summarised the source, adding words that were never in it",
        "The similarity score was too low",
      ],
      answer: 1,
      why:
        "Nothing was invented and nothing was mis-encoded. The scissors did it. The passage is a faithful " +
        "copy of a fragment, and the fragment means the opposite of the whole — which is why a model " +
        "instructed to answer only from the passages will confidently cite it.",
    },
    {
      kind: "quiz",
      question: "Users search your support collection by order number. Pure vector search keeps returning general refund guides. What is the fix?",
      options: [
        "A bigger embedding model, which will learn to recognise order numbers as a distinct kind of meaning",
        "Hybrid search — combine keyword matching with vector similarity so exact identifiers surface",
        "A higher score floor",
        "More chunks",
      ],
      answer: 1,
      why:
        "Embeddings capture meaning, and an order number carries almost none — it blurs into \"this is " +
        "about an order\". A keyword side of the search is what makes exact tokens findable.",
    },
    {
      kind: "quiz",
      question: "According to OWASP LLM08:2025, what is the risk in a multi-tenant RAG system?",
      options: [
        "Embeddings become slower with more tenants, because every query has to be compared with every tenant's vectors",
        "Data from one user group can be retrieved for another group's queries — cross-context information leakage",
        "Tenants share the same embedding model",
        "Vector stores cannot support multiple tenants",
      ],
      answer: 1,
      why:
        "Cross-context information leaks are named explicitly. The mitigation OWASP points at is " +
        "permission-aware vector stores and fine-grained access controls — enforced in the query, since " +
        "a passage that reaches the prompt has already been read by the model.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Take a policy paragraph you know and chunk it at 15 words with no overlap. Look for a chunk that means something the source does not.",
        "Set `alpha` to 1.0 in the hybrid playground and work out what your users would experience if they searched by order number.",
        "For a collection you would build, write down how a tenant filter would be applied — and where exactly in the query it goes.",
        "Write the three lines of logging you would want for every retrieval, so that \"why did it say that?\" is answerable tomorrow.",
      ],
    },
  ],
};
