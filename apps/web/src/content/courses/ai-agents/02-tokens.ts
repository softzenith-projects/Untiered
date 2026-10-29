import type { Chapter } from "@/content/courses/types";

export const chapterTokens: Chapter = {
  slug: "tokens",
  title: "Tokens: What the Model Actually Reads",
  summary:
    "A model does not see letters and does not see words. It sees tokens — chunks learned by merging " +
    "common pairs. Once you can picture that, half of the model's odd behaviour stops being odd.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "\"How many r's are in *strawberry*?\" became a famous question to ask an AI assistant because " +
        "models kept getting it wrong, and people took that as proof the whole thing was a trick. It is " +
        "not a trick. It is a direct, predictable consequence of the fact that **the model never sees the " +
        "letters**. It sees pieces. This chapter is about what those pieces are, where they come from, and " +
        "the surprisingly long list of everyday behaviours they explain — including the one thing you will " +
        "definitely be billed for later.",
    },
    { kind: "h", text: "The picture: a typesetter's tray" },
    {
      kind: "analogy",
      title: "A printer's tray of blocks, where common pairs got their own block",
      text:
        "Imagine an old printing press. In the drawer are metal blocks, one per letter, and to set a page " +
        "you pick out blocks and line them up. Now imagine the printer notices she is forever reaching for " +
        "\"t\" then \"h\" then \"e\", so she casts a single block that reads \"the\". Then \"ing\". Then " +
        "\"tion\". After a few thousand of these her drawer holds single letters *and* fragments *and* " +
        "whole common words, and setting a page is much faster — but the price is that she now thinks in " +
        "blocks, not letters. Ask her how many \"r\" blocks are in \"strawberry\" and she will look at the " +
        "three blocks she actually reached for — say \"str\", \"aw\", \"berry\" — and find zero, because " +
        "the r's are *inside* blocks, not blocks themselves. That drawer is a tokenizer's vocabulary, and " +
        "the printer is the model. Where the analogy stops: the printer could take a block apart and " +
        "count. The model cannot; the block is the smallest thing it has.",
    },
    {
      kind: "concept",
      title: "Token",
      text:
        "The smallest unit of text a model reads or writes. Usually a word fragment: common words are one " +
        "token, rare words break into several, and a space is normally part of the token that follows it. " +
        "Everything a model is charged for, limited by, and slowed down by is counted in tokens, not " +
        "words and not characters.",
    },
    { kind: "h", text: "Where the pieces come from: byte-pair encoding" },
    {
      kind: "p",
      text:
        "Nobody sits down and writes a list of 50,000 useful fragments. The list is *learned*, by an " +
        "algorithm simple enough to run in front of you. The most widely used one is **byte-pair encoding** " +
        "(BPE), and the recipe is three lines long: start with every single character; count every adjacent " +
        "pair across your text; merge the most frequent pair into one new symbol; repeat until the " +
        "vocabulary is as big as you wanted. The Hugging Face `transformers` documentation works this " +
        "through on a five-word example, so let us run exactly that example and watch the merges appear.",
    },
    {
      kind: "code",
      caption:
        "Byte-pair encoding on the five-word corpus from the Hugging Face tokenizer documentation. Pure Python — no library, no model.",
      code:
        "# Five words and how often each one appears.\n" +
        'corpus = {"hug": 10, "pug": 5, "pun": 12, "bun": 4, "hugs": 5}\n' +
        "\n" +
        "# Step 1: every word starts as a list of single characters.\n" +
        "splits = {word: list(word) for word in corpus}\n" +
        "vocab = sorted({ch for word in corpus for ch in word})\n" +
        'print("base vocabulary:", vocab)\n' +
        "\n" +
        "for round_number in range(1, 4):\n" +
        "    # Step 2: count every adjacent pair, weighted by how often the word appears.\n" +
        "    pairs = {}\n" +
        "    for word, count in corpus.items():\n" +
        "        parts = splits[word]\n" +
        "        for a, b in zip(parts, parts[1:]):\n" +
        "            pairs[(a, b)] = pairs.get((a, b), 0) + count\n" +
        "\n" +
        "    # Step 3: merge the most frequent pair into one new symbol.\n" +
        "    best = max(pairs, key=pairs.get)\n" +
        "    merged = best[0] + best[1]\n" +
        "    vocab.append(merged)\n" +
        '    print(f"round {round_number}: merge {best} -> {merged!r} (seen {pairs[best]} times)")\n' +
        "\n" +
        "    for word in corpus:\n" +
        "        parts = splits[word]\n" +
        "        out, i = [], 0\n" +
        "        while i < len(parts):\n" +
        "            if i < len(parts) - 1 and (parts[i], parts[i + 1]) == best:\n" +
        "                out.append(merged)\n" +
        "                i += 2\n" +
        "            else:\n" +
        "                out.append(parts[i])\n" +
        "                i += 1\n" +
        "        splits[word] = out\n" +
        "\n" +
        'print("final splits:", splits)\n' +
        'print("vocabulary:", vocab)\n',
      output:
        "base vocabulary: ['b', 'g', 'h', 'n', 'p', 's', 'u']\n" +
        "round 1: merge ('u', 'g') -> 'ug' (seen 20 times)\n" +
        "round 2: merge ('u', 'n') -> 'un' (seen 16 times)\n" +
        "round 3: merge ('h', 'ug') -> 'hug' (seen 15 times)\n" +
        "final splits: {'hug': ['hug'], 'pug': ['p', 'ug'], 'pun': ['p', 'un'], 'bun': ['b', 'un'], 'hugs': ['hug', 's']}\n" +
        "vocabulary: ['b', 'g', 'h', 'n', 'p', 's', 'u', 'ug', 'un', 'hug']",
    },
    {
      kind: "viz",
      title: "The word \"hugs\", as BPE merges the vocabulary around it",
      caption: "Each frame is one merge. The word never changes; what changes is how few pieces it takes to write it.",
      viz: {
        type: "array",
        frames: [
          {
            cells: [{ value: "h" }, { value: "u" }, { value: "g" }, { value: "s" }],
            note: "Start: four pieces, one per character. The vocabulary is just the seven letters in the corpus.",
          },
          {
            cells: [{ value: "h" }, { value: "ug", state: "done" }, { value: "s" }],
            note: "Merge 1: ('u','g') was the most frequent pair, seen 20 times across hug, pug and hugs. Three pieces now.",
          },
          {
            cells: [{ value: "h" }, { value: "ug" }, { value: "s" }],
            note: "Merge 2: ('u','n') was next, seen 16 times — but only in pun and bun, so \"hugs\" is untouched this round.",
          },
          {
            cells: [{ value: "hug", state: "done" }, { value: "s" }],
            note: "Merge 3: ('h','ug'), seen 15 times. \"hugs\" is now two pieces: hug + s. The rare plural costs one extra token; the common word costs one.",
          },
        ],
      },
    },
    {
      kind: "p",
      text:
        "Real vocabularies are built the same way, just far longer. The Hugging Face documentation gives " +
        "two concrete sizes: the original GPT used BPE with a vocabulary of 40,478 — 478 base tokens plus " +
        "40,000 merges — and GPT-2 used *byte-level* BPE with 50,257, being 256 byte values, 50,000 " +
        "merges, and one special end-of-text token. Byte-level matters: starting from the 256 possible " +
        "bytes rather than from characters means there is no such thing as text the tokenizer cannot " +
        "represent, in any script, ever.",
    },
    { kind: "h", text: "Why strawberry is hard, and what else is" },
    {
      kind: "code",
      caption: "The same word, seen two ways. The exact split differs between models; the shape of the problem does not.",
      code:
        'word = "strawberry"\n' +
        "\n" +
        "# What a person sees.\n" +
        'print("letters:", list(word))\n' +
        "print(\"count of 'r' by letter:\", word.count(\"r\"))\n" +
        "\n" +
        "# What a model sees: pieces, not letters.\n" +
        'pieces = ["str", "aw", "berry"]\n' +
        'print("pieces:", pieces)\n' +
        "print(\"count of 'r' by piece:\", pieces.count(\"r\"))\n",
      output:
        "letters: ['s', 't', 'r', 'a', 'w', 'b', 'e', 'r', 'r', 'y']\n" +
        "count of 'r' by letter: 3\n" +
        "pieces: ['str', 'aw', 'berry']\n" +
        "count of 'r' by piece: 0",
    },
    {
      kind: "p",
      text:
        "The model is not being stupid; it is being asked a question in a unit it does not have. This one " +
        "example explains a whole family of behaviours: counting letters, reversing a word, spotting " +
        "whether two words rhyme, doing arithmetic on long numbers digit by digit, and why a model is " +
        "better at some languages than others. Text in a script the vocabulary was not built around " +
        "shatters into many more tokens — which means it costs more, fills the context faster, and gives " +
        "the model less structure to work with per token. If you are building for Hindi, Tamil or " +
        "code-switched Hinglish, that is not trivia; it is a line in your budget.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "A rough token counter. Change `samples` to your own text — try a Hindi sentence, a long URL, and a " +
        "line of code — and watch the characters-per-token ratio move.",
      starter:
        "import re\n" +
        "\n" +
        "# A crude stand-in for a real tokenizer: split on word boundaries, then chop\n" +
        "# anything longer than 5 characters, which is roughly what BPE ends up doing.\n" +
        "def rough_tokens(text):\n" +
        '    chunks = re.findall(r"\\s*\\w+|\\s*[^\\w\\s]", text)\n' +
        "    out = []\n" +
        "    for chunk in chunks:\n" +
        "        while len(chunk) > 5:\n" +
        "            out.append(chunk[:5])\n" +
        "            chunk = chunk[5:]\n" +
        "        out.append(chunk)\n" +
        "    return out\n" +
        "\n" +
        "\n" +
        "samples = [\n" +
        '    "Book me a train to Pune tomorrow morning.",\n' +
        '    "https://example.com/orders/A-4471/refund?status=pending",\n' +
        '    "def total(items): return sum(i.price for i in items)",\n' +
        "]\n" +
        "\n" +
        "for text in samples:\n" +
        "    toks = rough_tokens(text)\n" +
        '    print(f"{len(text):3d} chars -> {len(toks):3d} tokens  ({len(text)/len(toks):.1f} chars/token)")\n' +
        "    print(\"   \", toks[:8], \"...\" if len(toks) > 8 else \"\")\n",
      expectedOutput:
        " 41 chars ->  12 tokens  (3.4 chars/token)\n" +
        "    ['Book', ' me', ' a', ' trai', 'n', ' to', ' Pune', ' tomo'] ...\n" +
        " 55 chars ->  24 tokens  (2.3 chars/token)\n" +
        "    ['https', ':', '/', '/', 'examp', 'le', '.', 'com'] ...\n" +
        " 52 chars ->  20 tokens  (2.6 chars/token)\n" +
        "    ['def', ' tota', 'l', '(', 'items', ')', ':', ' retu'] ...",
    },
    {
      kind: "compare",
      title: "Three ways to cut text up, and why only one survived",
      columns: [
        {
          label: "One token per word",
          items: [
            "Short sequences — each token carries a lot of meaning",
            "Vocabulary becomes enormous: love, loving, loved, lovingly all need their own entry",
            "Any word not in the list becomes an <unk> and is simply lost",
            "The embedding table grows with the vocabulary, costing memory and compute",
          ],
        },
        {
          label: "One token per character",
          items: [
            "Tiny vocabulary, and nothing is ever unrepresentable",
            "Sequences become very long, so the same sentence costs far more to process",
            "A single character carries almost no meaning, and performance suffers for it",
          ],
        },
        {
          label: "Subword (BPE and friends)",
          items: [
            "Common words stay whole; rare ones split into known pieces",
            "Vocabulary stays in the tens of thousands",
            "An unseen word can still be written from pieces it has",
            "The price: the model cannot see inside a piece, so letters are invisible to it",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Budgeting in words instead of tokens — English runs roughly four characters to a token, but code, URLs, JSON and non-Latin scripts run far denser, and a budget built on \"about 750 words\" quietly breaks on the first log file somebody pastes in.",
        "Asking a model to count or manipulate letters — reversing a string, counting r's, checking a rhyme — when the letters are inside tokens it cannot open; give it a tool that does the string work instead.",
        "Assuming two models tokenize alike — vocabularies are per-model, so a prompt that fits one model's limit can overflow another's with the same text.",
        "Forgetting that tool descriptions and system prompts are tokens too — they are re-sent on every single turn of an agent loop, so a wordy tool description is a charge you pay again and again.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A token is a word fragment. Common words are one token; rare words are several; letters are invisible inside them.",
        "The vocabulary is learned by merging the most frequent adjacent pair, over and over — that is byte-pair encoding.",
        "Byte-level BPE starts from the 256 byte values, so no text is ever unrepresentable (GPT-2: 50,257 tokens = 256 + 50,000 merges + 1 special).",
        "Cost, speed and context limits are all measured in tokens — so text that tokenizes badly is text that costs more.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Why can't the model count the letters in a word?\" is a common screening question precisely because the right answer shows you know what a token is.",
        "Anything about cost or context limits expects the answer in tokens. Saying \"about 4 characters per token for English, much worse for code and for Indic scripts\" is the kind of specific that lands.",
        "Expect a follow-up on what you would do about it: the answer is a tool, not a better prompt.",
      ],
    },
    {
      kind: "quiz",
      question: "Byte-pair encoding decides which pair to merge next by looking at what?",
      options: [
        "Which adjacent pair forms the most meaningful grammatical unit, as judged by linguists",
        "Which adjacent pair appears most often in the training text",
        "Which pair the model predicts best",
        "Which pair is alphabetically first",
      ],
      answer: 1,
      why:
        "BPE is pure frequency counting — the most common adjacent pair becomes one symbol, and the process " +
        "repeats until the vocabulary reaches its target size. Nothing about grammar or meaning enters into it.",
    },
    {
      kind: "quiz",
      question: "Your prompt is a 2,000-character block of JSON. Roughly how does its token count compare with 2,000 characters of English prose?",
      options: [
        "About the same",
        "Noticeably fewer tokens, because JSON is a compact format that tokenizers are specially built to compress",
        "Noticeably more tokens, because braces, quotes and keys fragment into small pieces",
        "Exactly half, because JSON has no spaces",
      ],
      answer: 2,
      why:
        "Punctuation-heavy, structured text tokenizes far denser than prose — each brace, quote and colon " +
        "tends to be its own token. This is why \"it fits, it's only 2KB\" is not a safe assumption.",
    },
    {
      kind: "quiz",
      question: "Which of these is the *right* fix for a model that keeps miscounting characters in a string?",
      options: [
        "Tell it in the system prompt to count carefully, one character at a time, and to check its count twice",
        "Use a bigger model",
        "Give it a tool that does the string operation and returns the result",
        "Ask the same question three times and take the majority answer",
      ],
      answer: 2,
      why:
        "The letters are genuinely not visible to the model, so no amount of prompting or scale reliably " +
        "recovers them. A tool that counts and hands back the number is the only fix that is not a gamble — " +
        "and building exactly that is what the rest of this course does.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Run the BPE code for ten rounds instead of three. At what point does it stop finding useful merges, and why?",
        "Paste a sentence of Hindi (or any non-Latin script) into the rough token counter and compare its characters-per-token with the English one.",
        "Take a tool description you have seen — or invent one — and count its tokens. Multiply by the number of turns in a ten-step agent loop. That is what the wording costs.",
        "Write down three tasks you would never give a model directly because of tokenization, and what tool you would give it instead.",
      ],
    },
  ],
};
