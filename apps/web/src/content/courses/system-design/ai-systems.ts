import type { ChapterSource } from "@/content/courses/system-design/lesson";

export const aiSystems: ChapterSource[] = [
  {
    slug: "ai-request-path",
    title: "The AI Request Path",
    summary: "Place a model behind a controlled gateway with context, streaming and fallbacks.",
    intro: [
      "An AI feature is not just \"call the model\". Between the user's click and the model's answer sits a path of ordinary code: check who is asking, decide what they are allowed to do, gather the information the model needs, call the model, check what came back, and send it on. The model is one step in the middle. Everything around it is normal, predictable software.",
      "That matters because the model is the one part you cannot fully predict. It can be slow, it can fail, and it can say something wrong. If every screen and every service calls a model provider on its own, each one repeats the safety checks differently, and nobody can answer simple questions such as \"how much did we spend today?\". Putting one gateway in front of the model gives you a single place for rules, limits and records.",
    ],
    analogy: [
      "A translator behind a reception desk",
      "Visitors never walk straight into the translator's room. The receptionist checks who they are, collects the right documents, picks the right translator, and writes down what was done. If the first translator is busy, the receptionist tries another one. The visitor only sees a smooth answer.",
    ],
    glossary: [
      ["AI gateway", "The single service through which every model call passes, so rules and records live in one place."],
      ["context", "The extra information, such as instructions and documents, that is placed in front of the question before the model sees it."],
      ["streaming", "Sending the answer to the user in small pieces as the model produces it, instead of waiting for the whole reply."],
      ["fallback", "A second model or a plain message that is used when the first choice fails or is too slow."],
      ["adapter", "A thin piece of code that hides one provider's request format, so the rest of the system never depends on it."],
    ],
    walkthrough: {
      title: "Follow one question through the gateway",
      steps: [
        { label: "Check and limit", text: "A learner types \"Explain this error\" in a help panel. The gateway confirms who they are, checks they have not used up today's allowance, and rejects the request early if they have." },
        { label: "Build the context", text: "The gateway adds the fixed instructions for this feature and the learner's last few messages. It leaves out anything the learner is not allowed to see, then picks which model should handle a short help question." },
        { label: "Call and stream", text: "The adapter sends the request with a timeout of a few seconds. As soon as the first words arrive, the gateway passes them to the browser, so the learner sees text appear instead of a blank wait." },
        { label: "Validate and record", text: "If the first model times out, the gateway tries the fallback once. Finished output is checked against the expected shape, then the gateway logs the model used, the time taken and the token counts, without storing private text it does not need." },
      ],
    },
    example: {
      title: "Worked example: a help panel that cannot hang",
      text: "A help panel gets 40 requests a second at peak. Each model call usually takes 2 seconds, but on a bad day the provider takes 30 seconds. With no timeout, 40 requests a second times 30 seconds means about 1,200 requests waiting at once, and the service runs out of connections even though it did nothing wrong. With an 8-second timeout, at most about 320 wait at a time. Add a one-time fallback to a second model, and the learner usually still gets an answer. The gateway also stops the model call if the learner closes the panel, so nobody pays for text no one will read.",
    },
    tradeoff: {
      title: "What a gateway buys, and what it costs",
      gain: {
        label: "You gain",
        items: [
          "One place to enforce limits, permissions and privacy rules",
          "Switching or adding a model changes one adapter, not every feature",
          "Spend, speed and failures can be measured for the whole product",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Every AI request goes through one more service that must stay up",
          "A little extra delay for the checks before the model is called",
          "The gateway team becomes a bottleneck if features need special handling",
        ],
      },
    },
    pitfalls: [
      "Calling the provider directly from the browser or from each service. The key leaks or the rules get copied slightly differently each time.",
      "Waiting for the full answer before showing anything, so a slow reply looks like a broken page.",
      "Logging the full prompt and answer by default, which quietly stores private user data in your logs.",
    ],
    remember: [
      "The model is one step. Everything around it should be ordinary, checkable code.",
      "Set a timeout and decide the fallback before launch, not during an outage.",
      "Stream long answers, and stop the call when the user leaves.",
      "Log the model, the time and the cost. Think twice before logging the text.",
    ],
    interview: [
      "Trace one request from click to answer and say which steps are deterministic. A strong answer shows the checks happen before and after the model, not inside it.",
      "Mention timeouts, cancellation and a fallback without being asked. They are the difference between a demo and a service.",
    ],
    quizzes: [
      {
        question: "The model provider starts taking 30 seconds per call. What does a gateway with no timeout most likely do?",
        options: [
          "Waiting requests pile up until connections run out and other pages fail",
          "The gateway notices the slowness and quietly switches to a faster model",
          "The network drops every call after one second, so users see quick errors",
          "Nothing else is affected, because a waiting request uses no resources",
        ],
        answer: 0,
        why: "Waiting requests pile up and hold connections and memory. Without a timeout the slowness spreads to parts of the product that never use the model.",
      },
      {
        question: "Why should the gateway cancel the model call when a user closes the help panel?",
        options: [
          "So the provider stores a shorter history of the chat",
          "Because the model refuses to answer a closed page",
          "To stop paying for and waiting on text nobody will read",
          "Because streamed text cannot be sent to a closed page twice",
        ],
        answer: 2,
        why: "Model calls cost money and use capacity for as long as they run. If the reader has gone, finishing the answer only wastes both.",
      },
      {
        question: "A team lets each of five features call the provider directly with its own key. Which problem is most likely to appear first?",
        options: [
          "Each feature applies limits and privacy rules a little differently, and total spend is invisible",
          "The model gives worse answers because too many callers share one key",
          "Streaming stops working for every feature at the same moment",
          "The provider refuses any account that has more than one key",
        ],
        answer: 0,
        why: "Without a shared gateway the rules are copied and drift apart, and there is no single place to count cost or failures. Model quality does not depend on how many callers you have.",
      },
    ],
  },
  {
    slug: "tokens-context-cost-and-capacity",
    title: "Tokens, Context, Cost and Capacity",
    summary: "Budget input, output, latency and spend before the prompt reaches a model.",
    intro: [
      "A model does not read letters or words. It reads tokens, which are small chunks of text, roughly a short word or part of a longer one. Everything you send in, and everything it writes back, is counted in tokens. The amount of text a model can look at in one call is called its context window, and it has a fixed size.",
      "Tokens are the unit that decides both time and money. More input tokens means more work before the first word appears. More output tokens means a longer wait and a bigger bill. A system that attaches everything it has \"because it fits\" is slow, expensive and often less accurate, because the useful lines get buried among the useless ones.",
    ],
    analogy: [
      "A suitcase with a weight limit and extra fees",
      "More clothes might make the trip more comfortable, but the bag has a hard limit and each extra kilogram costs money and slows you at the airport. A good traveller packs what the trip needs, and decides in advance what to leave behind.",
    ],
    glossary: [
      ["token", "A small chunk of text, often a short word or part of a word, which is the unit a model reads, writes and is billed in."],
      ["context window", "The maximum number of tokens a model can take in and produce in one call."],
      ["input and output tokens", "The tokens you send in and the tokens the model writes back, which are often priced and timed differently."],
      ["token budget", "A limit you set on tokens per request, per user or per customer so cost cannot run away."],
      ["summarising", "Replacing a long history with a short version that keeps only what the next step needs."],
    ],
    walkthrough: {
      title: "Follow one chat message through a budget",
      steps: [
        { label: "Estimate before sending", text: "A learner sends their fortieth message in a long study chat. Before calling the model, the service counts the tokens in the fixed instructions, the new message and the saved history." },
        { label: "Trim to fit the budget", text: "The history alone is far larger than the allowance for this kind of request. The service keeps the last few turns word for word and replaces everything older with a short summary written earlier." },
        { label: "Cap the reply", text: "The service sets a maximum for the answer's length, because a study hint does not need an essay. This also puts an upper bound on the wait." },
        { label: "Count the cost", text: "After the call, the real input and output counts are stored against the learner's account. When their daily total passes the limit, later requests get a polite message or a smaller model instead of a surprise bill." },
      ],
    },
    example: {
      title: "Worked example: what a long history costs",
      text: "Suppose each message in a chat is about 150 tokens and you send the full history every time. By message 40 you are sending about 6,000 tokens, plus around 500 for instructions. Across the whole chat, the model has read roughly 150 x (1 + 2 + ... + 40) = about 123,000 tokens of input, even though the learner only typed 6,000. If instead you keep the last 6 messages (900 tokens) plus a 300-token summary, each call stays near 1,700 tokens from then on. The numbers are made up for the sake of the sum, but the shape is real: full history makes cost grow with the square of the chat length, while a budget keeps it flat.",
    },
    tradeoff: {
      title: "What a tight token budget buys, and what it costs",
      gain: {
        label: "You gain",
        items: [
          "Faster first words, because there is less to read",
          "A predictable cost per request and per customer",
          "Clearer answers, since the useful lines are not buried",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Trimmed or summarised history can lose a detail the user cares about",
          "Extra code and tests to count, trim and summarise",
          "Some long requests must be refused or answered with less",
        ],
      },
    },
    pitfalls: [
      "Sending the whole history and every document because the context window technically allows it.",
      "Only limiting the input. A huge reply costs just as much and makes the user wait longer.",
      "Having one global limit but no per-customer limit, so a single heavy user uses up everyone's allowance.",
    ],
    remember: [
      "Tokens drive both speed and cost, on the way in and on the way out.",
      "A model fitting your text does not mean sending it all is a good idea.",
      "Set a budget per request type and per customer, and decide what happens when it is hit.",
      "Summarise or retrieve instead of attaching everything.",
    ],
    interview: [
      "Estimate tokens per minute at peak from users, requests per user and tokens per request, then say what degrades first when the budget is reached.",
      "Offer a way to cap cost per customer. Interviewers like hearing that a single user cannot burn the whole budget.",
    ],
    quizzes: [
      {
        question: "A chat app sends the full history on every message. What happens to the total input read as the chat grows longer?",
        options: [
          "It stays flat, because the model remembers earlier messages for free",
          "It grows steadily, because each message adds the same small amount",
          "It grows faster and faster, because each new call re-reads all earlier messages",
          "It falls, because the model skips older text automatically",
        ],
        answer: 2,
        why: "Each call includes all earlier messages again, so the total tokens read add up like 1 + 2 + 3 + ... and grow much faster than the chat itself.",
      },
      {
        question: "A request has a tight input budget, but the reply length is not capped. What is the main risk?",
        options: [
          "The model refuses to start a reply when no length limit is set",
          "A very long reply can still be slow and costly although the input was small",
          "The input is cut in half automatically, so that enough room is left for the reply",
          "The context window shrinks for the next request from that user",
        ],
        answer: 1,
        why: "Output tokens cost time and money too. Without a cap, one verbose reply can outweigh the saving from a lean prompt.",
      },
      {
        question: "One customer sends ten times more requests than anyone else. Which limit protects the other customers?",
        options: [
          "A larger context window for the whole product",
          "A per-customer allowance checked before each call",
          "A longer timeout on every model call to the provider",
          "Summarising every message into a single sentence",
        ],
        answer: 1,
        why: "A per-customer allowance stops one heavy user from using capacity and budget meant for all. The other options change speed or size, not who gets how much.",
      },
    ],
  },
  {
    slug: "embeddings-vector-search-and-rag",
    title: "Embeddings, Vector Search and RAG",
    summary: "Retrieve small, relevant evidence before asking a model to answer.",
    intro: [
      "A model only knows what it was trained on plus what you put in front of it. It does not know your company's policies, last week's notes or a student's own files. Retrieval-augmented generation, or RAG, solves this by looking up the few most relevant passages first and placing them in the prompt, so the model answers from evidence instead of guessing.",
      "To find relevant passages by meaning rather than exact words, text is turned into embeddings: lists of numbers where similar meanings end up close together. A vector search then returns the passages nearest to the question. This is powerful, but \"nearest\" is not \"true\" and it is not \"allowed\". A search can return an unrelated passage, or a passage the user should never see, and the model will happily use whatever it is given.",
    ],
    analogy: [
      "An open-book exam with the right pages",
      "A student answers far better with three relevant pages open in front of them than with a trolley of every book in the library. Someone has to pick the pages, and has to leave out the ones the student is not allowed to read.",
    ],
    glossary: [
      ["embedding", "A list of numbers that stands for the meaning of a piece of text, so that similar meanings sit close together."],
      ["chunk", "A passage of a document, small enough to fit in a prompt, that is stored and retrieved on its own."],
      ["vector search", "Finding the stored chunks whose embeddings are nearest to the embedding of the question."],
      ["reranking", "A second, more careful ordering of the first candidates so the best few come first."],
      ["grounded answer", "An answer that is based on the retrieved passages and points back to them as sources."],
    ],
    walkthrough: {
      title: "Follow one question through a RAG assistant",
      steps: [
        { label: "Prepare in advance", text: "Before anyone asks anything, the handbook is split into chunks of a few paragraphs. Each chunk is turned into an embedding and stored with its source page and who may read it." },
        { label: "Search by meaning", text: "A staff member asks \"How many days of leave do I get after a year?\". The question is embedded and the store returns the twenty nearest chunks, even those that never use the word \"leave\"." },
        { label: "Filter and pick", text: "Chunks the staff member may not read are dropped. A reranker keeps the best four. The assistant puts those four in the prompt with the instruction to answer only from them." },
        { label: "Answer with sources", text: "The model replies with the policy and cites the page. If none of the four chunks covers the question, it says it could not find the answer instead of inventing one." },
      ],
    },
    example: {
      title: "Worked example: why chunk size matters",
      text: "Take a 20-page handbook. If you embed each whole page as one chunk, a question about leave returns a page that also covers travel, expenses and dress code. The useful sentence is buried, and the prompt carries four pages of noise. If you cut it into 200-word chunks, the leave paragraph becomes its own chunk and the match is sharp. But cut too small, say 20 words, and a rule loses its exception: \"Staff get 24 days\" may land in one chunk and \"except in the first six months\" in the next. A common fix is to let neighbouring chunks overlap by a sentence or two. When answers go wrong, first check whether the right chunk was retrieved at all; if it was not, no change to the prompt will help.",
    },
    tradeoff: {
      title: "What retrieval buys, and what it costs",
      gain: {
        label: "You gain",
        items: [
          "Answers based on your own, current documents",
          "Sources a user can open and check",
          "Updating knowledge by re-indexing a file, with no retraining",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "A pipeline to chunk, embed, store and keep documents fresh",
          "Two places for mistakes: retrieval may miss, and the model may misuse what it found",
          "Access rules that must be applied during retrieval, not afterwards",
        ],
      },
    },
    lab: "rag-assistant",
    pitfalls: [
      "Treating vector similarity as truth. The closest chunk can be on the same topic and still not answer the question.",
      "Searching all documents first and hiding the forbidden ones later. A private passage that reaches the prompt can leak into the answer.",
      "Judging only the final wording. Without checking whether the right chunk was retrieved, you cannot tell a search problem from a writing problem.",
    ],
    remember: [
      "RAG is look up first, then answer from what was found.",
      "Embeddings find similar meaning. They do not check truth or permission.",
      "Apply access rules inside retrieval, before anything reaches the prompt.",
      "Test retrieval and generation separately. Allow the answer \"not found\".",
    ],
    interview: [
      "Separate the ingestion path (chunk, embed, store) from the query path (embed, search, filter, answer). Naming both shows you understand where each failure lives.",
      "When an answer is wrong, say how you would check whether the right chunk was in the prompt before blaming the model.",
    ],
    quizzes: [
      {
        question: "A RAG assistant gives a wrong leave policy. The correct paragraph was never in the prompt. Where is the fault?",
        options: [
          "The model's habit of writing in a formal style",
          "The setting that limits how long a reply may be",
          "Retrieval, because the right chunk never reached the prompt",
          "The tone and wording of the instructions that were given to the model",
        ],
        answer: 2,
        why: "The model can only use what it is given. If the right passage never reached the prompt, improving the prompt or the model will not fix the answer.",
      },
      {
        question: "Chunks are cut every 20 words, so the line \"24 days of leave\" and its exception land in different chunks. What is the likely result?",
        options: [
          "Answers may state the rule without the exception that limits it",
          "Search always returns both neighbouring chunks together",
          "The embeddings become longer and therefore more accurate",
          "The model refuses to read any chunk shorter than a paragraph",
        ],
        answer: 0,
        why: "Search returns chunks independently, so a rule can arrive without the sentence that limits it. Larger or overlapping chunks keep related lines together.",
      },
      {
        question: "Interns must not read salary documents. Where should that rule be applied in a RAG system?",
        options: [
          "In the prompt, by telling the model to ignore any salary text",
          "On the final answer, by deleting every number it contains",
          "In the embedding step, by giving salary text shorter vectors",
          "During retrieval, so forbidden chunks never reach the prompt",
        ],
        answer: 3,
        why: "If a forbidden passage reaches the model, it may appear in the reply however the instructions are worded. The only safe place for the rule is before the prompt is built.",
      },
    ],
  },
  {
    slug: "model-routing-batching-and-caching",
    title: "Model Routing, Batching and Caching",
    summary: "Match request difficulty to capability while protecting latency and quality.",
    intro: [
      "Not every request needs the biggest, slowest, most expensive model. Fixing a typo is a different job from reasoning through a legal contract. Routing means looking at each request and sending it to the model that is good enough for it. Batching means grouping many requests that are not urgent into one run. Caching means reusing an answer you already paid for.",
      "These three ideas are the main ways to cut AI cost and delay without making the product worse, but each has a way of going wrong quietly. A router that guesses badly sends hard questions to a weak model. A batch makes a user wait. A cache that is shared too widely can show one person's private answer to another. The skill is saving money without giving up quality or privacy.",
    ],
    analogy: [
      "Sending each parcel by the right service",
      "A letter to the next town does not need an international courier. A fragile, urgent parcel might. A good post room sorts parcels, holds non-urgent ones for the afternoon van, and does not re-send something already delivered.",
    ],
    glossary: [
      ["router", "A step that looks at a request and chooses which model or path should handle it."],
      ["batching", "Grouping several requests so they are processed together, usually trading a longer wait for lower cost."],
      ["exact cache", "A saved answer that is reused only when the new request is identical to the old one."],
      ["semantic cache", "A saved answer that is reused when a new request means nearly the same thing, even if the words differ."],
      ["cache key", "The value that decides whether two requests count as the same, which should include who is allowed to see the answer."],
    ],
    walkthrough: {
      title: "Follow three requests through a router",
      steps: [
        { label: "Classify", text: "Three requests arrive: \"fix the spelling in this line\", \"summarise this 30-page report\" and \"find the flaw in this argument\". A small classifier labels each by task type and risk." },
        { label: "Route", text: "The spelling fix goes to a small, fast model. The argument goes to a stronger model. If the classifier is unsure about a request, it is sent to the stronger one rather than risk a weak answer." },
        { label: "Batch what can wait", text: "The report summary is not urgent. It joins a queue of similar jobs that run together in a batch, so it costs less but may take several minutes." },
        { label: "Check the cache", text: "Before any call, the service looks up the cache key. An identical earlier spelling fix is returned instantly. The key includes the customer's ID, so no one else can receive that saved answer." },
      ],
    },
    example: {
      title: "Worked example: the saving from sorting",
      text: "Say a product makes 100,000 calls a day. If a small model costs one unit per call and a large one costs ten units, sending everything to the large model costs 1,000,000 units. A review shows 70% of calls are simple tasks the small model handles just as well. Routing those gives 70,000 x 1 + 30,000 x 10 = 370,000 units, a saving of 63%. If a further 20% of calls are exact repeats served from a cache, cost falls again. The saving is only real if you measured the small model on those tasks first. Routing by guesswork can save money and quietly lower quality for the users who ask the hardest questions.",
    },
    tradeoff: {
      title: "What smart routing buys, and what it costs",
      gain: {
        label: "You gain",
        items: [
          "A much lower bill for the same overall quality",
          "Faster answers for simple requests",
          "Spare capacity kept for the hard requests that need it",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "A router that can be wrong and must be tested",
          "Batched jobs make users wait for their answers",
          "Caches that need privacy boundaries and a rule for when saved answers go stale",
        ],
      },
    },
    pitfalls: [
      "Routing by prompt length alone. A short question can be very hard, and a long one very easy.",
      "Sharing a cache across customers, so one person's saved private answer is returned to another.",
      "Moving traffic to a cheaper model without first scoring it on real examples of that task.",
    ],
    remember: [
      "Match the model to the task, and keep a safe default when the router is unsure.",
      "Batch only what can wait.",
      "A cache key should include who is allowed to see the answer.",
      "Prove a cheaper model on real examples before routing to it.",
    ],
    interview: [
      "Define a routing policy in terms of task type, risk and budget, and say what the router does when it is unsure.",
      "Explain how an offline evaluation earns the right to use a cheaper model. Saying \"we measured it first\" is what a strong answer sounds like.",
    ],
    quizzes: [
      {
        question: "A router is unsure whether a request is simple or hard. What is the safest default?",
        options: [
          "Reject the request and ask the user to rephrase it",
          "Send it to the stronger model and accept the cost",
          "Send it to the cheapest model to keep the bill low",
          "Hold it back until the next batch run starts",
        ],
        answer: 1,
        why: "A wrong answer on a hard request costs more than the extra price of one strong-model call. Defaulting upward protects quality while the router is uncertain.",
      },
      {
        question: "Two customers type the same question about their own account. The cache key is just the question text. What goes wrong?",
        options: [
          "The cache refuses to store either answer for later",
          "Both saved answers are deleted at midnight each day",
          "The second customer may be given the first customer's saved answer",
          "The model repeats the question back to both customers",
        ],
        answer: 2,
        why: "Identical text produces an identical key, so an answer containing one customer's data can be served to the other. The key must include who is asking.",
      },
      {
        question: "Which job is the best candidate for batching?",
        options: [
          "Replying to a customer who is waiting for an answer in a live chat",
          "Checking a card payment during checkout",
          "Autocompleting text while a user types",
          "Writing overnight summaries of thousands of support tickets",
        ],
        answer: 3,
        why: "Nobody is waiting for the overnight summaries, so they can be grouped to cost less. The other jobs have a person waiting and need an answer immediately.",
      },
    ],
  },
  {
    slug: "ai-evaluation-and-tracing",
    title: "Evaluation, Tracing and Feedback",
    summary: "Measure task success with representative cases instead of judging a demo.",
    intro: [
      "A model answer that looks good once tells you almost nothing. Models give different answers to similar questions, and a change that fixes one case can quietly break ten others. Evaluation means building a fixed set of realistic test cases, running your system on all of them, and scoring the results the same way every time. Tracing means recording each step of a request so you can see where a bad answer went wrong.",
      "Without these two, teams ship on gut feeling. A demo goes well, a prompt is tweaked, and a week later users complain about something nobody tested. With them, you can say \"this change raised correct answers on billing questions from 72% to 81%, and did not change refund questions\". That sentence is what lets a team improve a product instead of just changing it.",
    ],
    analogy: [
      "A driving test with a route sheet",
      "One smooth drive proves little. A fair test uses the same route every time, with hills, traffic and parking, and the examiner marks the same points. Then you can compare one learner with another, or the same learner a month later.",
    ],
    glossary: [
      ["evaluation set", "A fixed collection of realistic test cases, each with a description of what a good result looks like."],
      ["trace", "A record of every step of one request, such as the prompt, the retrieved passages, the tool calls and the final answer."],
      ["regression", "A case that used to work and no longer does after a change."],
      ["rubric", "Written marking criteria that tell a reviewer, human or automatic, what earns a pass."],
      ["data leakage", "When test answers influence the prompts or training, so the test no longer measures anything."],
    ],
    walkthrough: {
      title: "Follow one prompt change through evaluation",
      steps: [
        { label: "Build the set", text: "A support assistant's team collects 200 real question types, including tricky ones, refusals and an area where users are often upset. Each case has a written note on what a correct answer must contain." },
        { label: "Run and trace", text: "Every case is run through the whole system. For each one the trace stores the retrieved passages, the answer and the tool results, so a failure can be located." },
        { label: "Score by group", text: "Cases are scored with simple checks first, such as \"did it quote the right refund period?\", then a reviewer samples the rest. Results are shown per category, not as one average." },
        { label: "Compare before shipping", text: "The new prompt scores higher overall but drops on billing disputes. The team reads those traces, finds the retrieved passage was cut off, fixes it and runs the same set again before releasing." },
      ],
    },
    example: {
      title: "Worked example: when an average hides a drop",
      text: "A team's evaluation set has 200 cases: 150 about passwords and 50 about refunds. After a prompt change, password cases rise from 80% to 86% correct, and refund cases fall from 80% to 56%. The overall score is (0.86 x 150 + 0.56 x 50) / 200, which is about 78.5%, down from 80%, and the drop looks small. But refunds involve money and complaints, so a 24-point drop there is serious. Reporting scores per category, with the high-risk ones marked, exposes what the average hid. The same tracing then shows whether the refund failures came from search, from the prompt or from a tool.",
    },
    tradeoff: {
      title: "What careful evaluation buys, and what it costs",
      gain: {
        label: "You gain",
        items: [
          "Evidence that a change helped, instead of a feeling",
          "Early warning of regressions in the groups you care about most",
          "Traces that point to the failing step, so fixes are quick",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Time to build and keep the test set up to date",
          "Reviewer effort, because some quality cannot be scored automatically",
          "Stored traces that may hold private text and need retention limits",
        ],
      },
    },
    pitfalls: [
      "Tuning the prompt after reading the test answers, so the test measures memory rather than skill.",
      "Using thumbs-up rate as the only signal. Few users click, and the ones who do are not typical.",
      "Reporting one average score that hides a large drop in a small but important group.",
    ],
    remember: [
      "A demo is not a test. Build a fixed set from real tasks, failures included.",
      "Score by category and risk, not just overall.",
      "Trace each stage so you can tell a search miss from a writing mistake.",
      "Keep some cases hidden from whoever tunes the prompt.",
    ],
    interview: [
      "Explain how one trace separates retrieval, tool and generation problems. A strong answer names what is recorded at each stage.",
      "Describe how you would stop a prompt from being tuned to the test, for example by holding back cases.",
    ],
    quizzes: [
      {
        question: "After a change, overall accuracy rises one point, but accuracy on refund questions falls sharply. What should the team do?",
        options: [
          "Ship it, because the overall score improved",
          "Read the refund traces and fix the cause before shipping",
          "Remove the refund cases so the score looks steadier",
          "Wait for more thumbs-up ratings to settle the question",
        ],
        answer: 1,
        why: "A small overall gain can hide a large drop in an important group. Reading those traces finds the cause, and removing hard cases would just hide the problem.",
      },
      {
        question: "A developer reads the evaluation answers, then edits the prompt until every case passes. Why is the result not trustworthy?",
        options: [
          "Evaluation sets may only be reused once a year",
          "Prompts that pass every case are always far too long",
          "The cases leaked into the prompt, so a pass says little about new questions",
          "The traces are deleted after every single run, so nothing can ever be checked",
        ],
        answer: 2,
        why: "Once the prompt is shaped around known test answers, passing says nothing about questions it has not seen. Hidden cases keep the test honest.",
      },
      {
        question: "Why is a thumbs-up rate a weak measure of answer quality on its own?",
        options: [
          "Only a small, self-selected group clicks it, so it can mislead",
          "Models cannot read thumbs-up counts at all",
          "It only records ratings for answers that are longer than ten words each",
          "It cannot be stored alongside the trace of the request",
        ],
        answer: 0,
        why: "Most users never click, and those who do are not typical. A rating can help as one signal but does not replace a fixed set of cases.",
      },
    ],
  },
  {
    slug: "agent-anatomy",
    title: "Agent Anatomy: Model, Tools and State",
    summary: "Turn a model call into a bounded system that can observe and act.",
    intro: [
      "An agent is a model placed inside a loop. The model reads the task and the current state, chooses a next step, usually calling a tool such as \"search orders\" or \"send email\", sees the result, and repeats until it decides the job is done. The pieces are simple: instructions, a list of tools, some saved state, and the loop that ties them together.",
      "The model's choices are suggestions made by a system that can be wrong or tricked by text it reads. So the code around it, called the runtime, must do the real work of safety. It checks the arguments of every tool call, decides whether this user may use this tool, caps the number of steps, and records each action. Prompt wording cannot be your security boundary, because a prompt is just more text.",
    ],
    analogy: [
      "A trainee with a manual and a locked toolbox",
      "The trainee reads the instructions, asks for a tool, uses it, looks at what happened, and stops when the job is finished. But the supervisor holds the keys: the trainee can only open the drawers they have been given, and anything risky needs a signature.",
    ],
    glossary: [
      ["agent loop", "The repeated cycle of choosing a step, running it, reading the result and deciding whether to continue."],
      ["tool", "A function the agent may call, such as a database lookup or an email sender, defined with a name and typed arguments."],
      ["runtime", "The ordinary code that runs the loop and enforces permissions, limits and logging around the model's choices."],
      ["observation", "The result of a tool call that is fed back to the model as new information."],
      ["step limit", "A hard cap on how many loop rounds or tool calls one task may use."],
    ],
    walkthrough: {
      title: "Follow one task through the agent loop",
      steps: [
        { label: "Receive the task", text: "A learner asks, \"Move my interview to next Tuesday.\" The runtime loads that learner's permissions and starts the loop with the request and the list of tools it may use." },
        { label: "Model proposes a call", text: "The model replies with `find_booking` and an argument, the learner's own account. The runtime checks the arguments match the tool's schema and that this learner may read their own bookings." },
        { label: "Run and observe", text: "The tool returns one booking. The runtime puts that result in front of the model, which now proposes `reschedule` with a new date." },
        { label: "Act and stop", text: "Rescheduling changes real data, so the runtime checks the date is valid and records the action. The model then writes a confirmation, or the runtime stops the loop if it reaches its step limit." },
      ],
    },
    example: {
      title: "Worked example: a loop that must not run away",
      text: "Suppose each loop round costs about 3 seconds and a small amount of money, and the model sometimes gets stuck repeating the same failing call. With no limit, one stuck task could run for minutes and cost far more than a normal one. A step limit of 8 rounds caps the worst case at around 24 seconds. When the limit is reached, the runtime stops, saves what was done and tells the user plainly that it could not finish. The same idea applies to tool arguments: if the model proposes `reschedule` with a booking ID that belongs to another learner, the runtime refuses, no matter how convincing the model's reasoning sounds.",
    },
    tradeoff: {
      title: "What giving a model tools buys, and what it costs",
      gain: {
        label: "You gain",
        items: [
          "Tasks that need several steps and real data, not just text",
          "Flexibility for requests nobody wrote a fixed flow for",
          "A clear log of every action the agent took",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Model mistakes can turn into real actions unless the runtime blocks them",
          "More steps mean more cost and more time per task",
          "Behaviour that varies between runs is harder to test than a fixed script",
        ],
      },
    },
    lab: "tool-using-agent",
    pitfalls: [
      "Giving the agent broad credentials and trusting the prompt to keep it in bounds. Text the model reads can override text you wrote.",
      "Skipping argument checks because the model usually sends sensible values.",
      "No step limit, so a confused agent loops until the money or time runs out.",
    ],
    remember: [
      "An agent is a model plus tools, state and a loop.",
      "The runtime enforces the rules. The prompt only asks nicely.",
      "Validate every tool call and give each tool the least access it needs.",
      "Always cap steps and cost.",
    ],
    interview: [
      "Draw the loop and mark exactly where untrusted model output becomes a real action. A strong answer puts a check at that point.",
      "Say what happens when a tool fails halfway, such as whether the action can be repeated safely.",
    ],
    quizzes: [
      {
        question: "The model proposes cancelling a booking that belongs to a different user. Where should this be stopped?",
        options: [
          "In the prompt, by telling the model never to do it",
          "In the runtime, which checks permission before running the tool",
          "In the model, by training it to refuse every cancellation",
          "After the tool runs, by undoing the cancellation",
        ],
        answer: 1,
        why: "The runtime is ordinary code that can check permission every time. A prompt instruction can be ignored or overridden, and undoing afterwards leaves a window where the harm has happened.",
      },
      {
        question: "An agent keeps calling a search tool that returns nothing, then calls it again with the same arguments. What protects the system?",
        options: [
          "A longer prompt that explains when to stop",
          "A step limit enforced by the runtime",
          "A larger context window",
          "Adding more tools for the model to try",
        ],
        answer: 1,
        why: "A stuck model may not stop itself. A hard cap on steps in the runtime bounds time and cost whatever the model decides.",
      },
      {
        question: "Which part of an agent is the best place to keep a customer's access permissions?",
        options: [
          "The text of the system prompt",
          "The model's own memory of the earlier conversation with this user",
          "The runtime's identity and tool scopes for that user",
          "A note the model writes to itself in the first step",
        ],
        answer: 2,
        why: "Permissions must come from trusted code and data that the model cannot rewrite. Anything the model reads or writes can be influenced by untrusted text.",
      },
    ],
  },
  {
    slug: "agent-workflow-patterns",
    title: "Agent Workflow Patterns",
    summary: "Choose sequential, routed, parallel or planner-worker flows only when they fit.",
    intro: [
      "When a task needs more than one model call, you have to decide how the calls fit together. A sequential chain runs steps in a fixed order, each using the previous result. A router looks at the request and picks one of several specialised paths. Parallel workers handle independent pieces at the same time. A planner-worker design lets one model decide the steps on the fly and hand them to others.",
      "Each step up in flexibility costs you something: more delay, more spend and harder testing, because the path is no longer the same each time. Many teams reach for a planner and several agents because it sounds advanced, when a fixed three-step chain would be faster, cheaper and easier to fix. The rule of thumb is to use the least agentic pattern that does the job and add flexibility only where the path is genuinely unknown.",
    ],
    analogy: [
      "Organising a school project",
      "Some projects follow a checklist: research, draft, proofread. Some split cleanly between classmates who work at the same time. A big, unclear one needs a coordinator to decide who does what. Adding more people to a one-page task only creates more meetings.",
    ],
    glossary: [
      ["sequential workflow", "A fixed chain in which each step runs after the previous one and uses its output."],
      ["router", "A step that chooses which specialised path should handle a request."],
      ["fan-out", "Splitting a task into independent pieces that run at the same time."],
      ["planner-worker", "A design in which one model decides the steps and other calls carry them out."],
      ["join", "The step that gathers parallel results into one answer and checks they fit together."],
    ],
    walkthrough: {
      title: "Follow one report request through three patterns",
      steps: [
        { label: "Classify the dependency", text: "A user asks for a short report on three product features. The system first asks whether the three parts depend on each other. They do not: each feature can be researched on its own." },
        { label: "Fan out", text: "Three workers each research one feature at the same time, with a cap of three so a longer list cannot launch fifty workers at once." },
        { label: "Join and verify", text: "A final step collects the three notes, removes repeats and checks each claim has a source. If one worker failed, the report says that section is missing instead of hiding it." },
        { label: "Keep the rest fixed", text: "The follow-up steps, format the report then email it, run as a fixed chain, because their order never changes. Only the research needed any flexibility." },
      ],
    },
    example: {
      title: "Worked example: when parallel really helps",
      text: "Suppose three research calls each take 10 seconds. Run one after another they take 30 seconds. Run in parallel they take about 10 seconds, plus a few seconds to join. That is a clear win, because the pieces are independent. Now suppose the second call needs the first call's answer. Parallel is impossible, and a chain is correct. A planner-worker flow could handle either case, but it adds a planning call of a few seconds, may choose a different path each run, and is harder to test. If your task is always the same shape, the plain workflow wins on speed, cost and debugging.",
    },
    tradeoff: {
      title: "What more flexible workflows buy, and what they cost",
      gain: {
        label: "You gain",
        items: [
          "Handling of tasks whose steps cannot be known in advance",
          "Shorter total time when independent work runs in parallel",
          "Specialised steps that can each be tuned and tested",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "More model calls, so more latency and spend",
          "Paths that change each run are harder to evaluate and debug",
          "Merge and error handling for the pieces that run together",
        ],
      },
    },
    artifact: {
      kind: "table",
      head: ["Pattern", "Use it when", "Main cost"],
      rows: [
        ["Sequential", "Every step depends on the previous one", "A slow stage delays the whole chain"],
        ["Parallel", "Subtasks are independent", "Fan-out and merge need bounds"],
        ["Planner-worker", "The route cannot be known in advance", "Higher cost and harder evaluation"],
      ],
    },
    pitfalls: [
      "Using several agents because it sounds advanced, when the subtasks are not actually independent.",
      "Fan-out with no limit, so a long list launches dozens of calls at once and exhausts capacity.",
      "Joining parallel results without checking for conflicts or for a failed worker.",
    ],
    remember: [
      "Start with the simplest workflow that works.",
      "Parallel only helps when the pieces are independent.",
      "Planning adds cost and variety. Use it for genuine uncertainty.",
      "Bound fan-out and always check at the join.",
    ],
    interview: [
      "Compare a fixed workflow with a planner for the same task on reliability, cost and ease of debugging, and say which you would pick first.",
      "Show that you ask whether subtasks depend on each other before choosing parallel.",
    ],
    quizzes: [
      {
        question: "A task always runs three steps in the same order: extract, check, format. Which pattern fits best?",
        options: [
          "A planner-worker flow, so the model can choose the order",
          "A sequential workflow, because the path is known",
          "Three agents working in parallel on the steps",
          "A router that picks among many specialised paths",
        ],
        answer: 1,
        why: "When the path never changes, a fixed chain is faster, cheaper and easier to test. Flexibility only costs more when there is nothing to decide.",
      },
      {
        question: "Why can the second of two research calls not simply run in parallel with the first?",
        options: [
          "Parallel calls always return poorer answers than serial ones",
          "Models refuse to run two calls at the same moment",
          "The join step cannot combine two separate results",
          "It needs the first call's result as input, so it must wait",
        ],
        answer: 3,
        why: "Parallel work needs independent pieces. If one step uses another's output, it has to wait for it.",
      },
      {
        question: "A list of 50 documents is sent to 50 parallel workers at once, and the provider starts rejecting calls. What was missing?",
        options: [
          "A longer prompt for each of the workers",
          "A second planner to supervise the first one",
          "A fan-out limit that keeps concurrent calls within capacity",
          "A larger context window on every call",
        ],
        answer: 2,
        why: "Fan-out multiplies load. A cap on concurrent workers keeps the system within the provider's and its own capacity.",
      },
    ],
  },
  {
    slug: "agent-memory-safety-and-recovery",
    title: "Agent Memory, Approval and Recovery",
    summary: "Store only useful state and put humans around irreversible actions.",
    intro: [
      "An agent needs memory, but \"memory\" covers three different things. Conversation context is what is in the current prompt and disappears afterwards. Durable facts are things worth keeping for later, such as a learner's chosen role. Task checkpoints record how far a long job got, so it can resume after a crash. Each has its own purpose, owner and lifetime, and mixing them leads to messy and risky systems.",
      "Memory and actions both carry risk. Saved text can be wrong, out of date or private, and a model's summary of a chat is not a verified fact. Actions that cannot be undone, such as sending money, deleting data or emailing a customer, need a person to approve them. And because tool calls can fail halfway or be repeated, the workflow must be safe to resume: doing the same step twice must not charge a customer twice.",
    ],
    analogy: [
      "A workshop job card",
      "The card records what the customer approved and which steps are finished. A mechanic still asks before replacing an expensive part, and after a lunch break can pick up exactly where they stopped without redoing the oil change.",
    ],
    glossary: [
      ["checkpoint", "A saved record of how far a task has progressed, so it can resume instead of starting again."],
      ["durable memory", "Information deliberately stored for later use, with a clear owner, source and expiry."],
      ["human approval", "A required confirmation from a person before the agent carries out a high-impact action."],
      ["idempotency key", "A unique label on an action so that repeating it does not repeat its effect."],
      ["compensation", "A follow-up action that undoes or corrects an earlier step that cannot simply be rolled back."],
    ],
    walkthrough: {
      title: "Follow one refund through approval and recovery",
      steps: [
        { label: "Load only what is needed", text: "A support agent receives a refund request. It loads the customer's order and the refund rules for this task, not the customer's entire chat history." },
        { label: "Ask before the risky step", text: "Refunds move money, so the agent pauses and shows a person the exact order, amount and reason. The approval is tied to that one refund, not to refunds in general." },
        { label: "Act with a key", text: "After approval the agent calls the payments tool with an idempotency key such as `refund:order-77`, and saves a checkpoint saying the refund was requested." },
        { label: "Recover safely", text: "The server crashes before the reply. On restart the agent reads the checkpoint, repeats the call with the same key, and the payment system returns the original result instead of paying twice." },
      ],
    },
    example: {
      title: "Worked example: the same step run twice",
      text: "An agent has four steps: check the order, request a refund of 1,200 rupees, email the customer, close the ticket. The crash happens after the refund call returns but before the checkpoint is written. On restart, the agent does not know the refund happened and calls the refund tool again. With no idempotency key the customer receives 2,400. With the key `refund:order-77`, the payments system sees a repeat and returns the first result. For the email step, which cannot be tied to a key, the agent first checks whether a refund email already exists. The principle is to make each step safe to repeat, or to check before repeating.",
    },
    tradeoff: {
      title: "What approvals and checkpoints buy, and what they cost",
      gain: {
        label: "You gain",
        items: [
          "Humans stay in charge of actions that cannot be undone",
          "Long tasks can resume after crashes without repeating effects",
          "Stored state that users can see, correct and delete",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Approvals slow the task and need someone available to give them",
          "Extra storage and code for checkpoints and keys",
          "Memory needs consent, expiry and cleanup rules",
        ],
      },
    },
    pitfalls: [
      "Saving every conversation forever and treating a generated summary as a verified fact about the user.",
      "Approving \"refunds\" in general, so a later, different refund runs without a person seeing it.",
      "Retrying a failed step with no idempotency key, so a repeat call causes a second real effect.",
    ],
    remember: [
      "Keep context, durable facts and checkpoints separate, each with its own rules.",
      "Store the minimum, with a source, an expiry and a way for users to delete it.",
      "A person approves irreversible actions, and the approval names the exact action.",
      "Make every step safe to repeat.",
    ],
    interview: [
      "Design a tool workflow that survives a crash after the action but before the record. A strong answer uses an idempotency key and a checkpoint.",
      "Name the actions that always need human confirmation, such as payments, deletions and messages to customers.",
    ],
    quizzes: [
      {
        question: "An agent crashes right after calling the payment tool, before saving its checkpoint. What makes the restart safe?",
        options: [
          "Asking the model whether it remembers paying",
          "Waiting an hour before retrying the call",
          "An idempotency key, so a repeat call returns the first result",
          "Deleting the old checkpoint so that the whole task begins again afresh",
        ],
        answer: 2,
        why: "The system cannot know whether the payment went through, so the call has to be safe to repeat. A key makes the payment system treat the second call as the same request.",
      },
      {
        question: "A person approves \"issue refunds\" once at the start of a day. Why is this a weak approval?",
        options: [
          "Approvals can only ever be given by the model itself",
          "It does not show the exact amount and order of each later refund",
          "Refunds never need any kind of approval",
          "It makes it impossible to write checkpoints",
        ],
        answer: 1,
        why: "A useful approval is tied to the specific action, with its amount and target in front of the person. A blanket approval lets later, different actions through unseen.",
      },
      {
        question: "The agent summarises a chat as \"the user prefers evening calls\" and saves it as a fact. What is the risk?",
        options: [
          "The summary may be wrong or stale, yet later steps treat it as verified",
          "Saved facts always make later replies slower",
          "Summaries written by a model cannot be stored in any kind of database at all",
          "The user can no longer start a new chat afterwards",
        ],
        answer: 0,
        why: "A model's summary can misread the user. Storing it as a fact without a source or a way to correct it lets an error spread to later decisions.",
      },
    ],
  },
];
