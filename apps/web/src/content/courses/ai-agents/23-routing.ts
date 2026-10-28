import type { Chapter } from "@/content/courses/types";

export const chapterRouting: Chapter = {
  slug: "routing",
  title: "Routing: Sending It to the Right Place",
  summary:
    "One cheap classification decides which specialised path runs. It buys better answers and a smaller " +
    "bill at once — provided you have somewhere to send the things it cannot classify.",
  minutes: 13,
  blocks: [
    {
      kind: "p",
      text:
        "A single prompt that handles refunds, technical faults and general questions is three prompts " +
        "fighting each other in one context. Every instruction for one case is noise for the other two, " +
        "and improving the refund wording makes the technical answers slightly worse. **Routing** fixes " +
        "this by separating the decision from the work: one small call classifies the request, and then " +
        "a handler built for exactly that kind of request takes over.",
    },
    { kind: "h", text: "The picture: the hospital reception desk" },
    {
      kind: "analogy",
      title: "The desk that sends you to the right department",
      text:
        "At a large hospital, the person at the front desk does not treat anybody. Her entire job is " +
        "thirty seconds long: work out whether this is an emergency, an appointment, a pharmacy " +
        "collection or a billing query, and point. She is not a doctor, she does not need to be, and " +
        "putting a consultant on that desk would be an expensive way to get the same pointing. The value " +
        "is that everybody downstream gets people they are set up for. And notice the one thing she " +
        "absolutely must have: somewhere to send the person she cannot categorise. A desk with no " +
        "\"sit here and someone will come\" option produces people wandering the corridors. Where the " +
        "analogy stops: the receptionist can ask a follow-up question. Your classifier gets one look and " +
        "must produce a confidence you are willing to act on.",
    },
    {
      kind: "concept",
      title: "Routing",
      text:
        "Classifying an input and directing it to a specialised follow-up task. Anthropic's guidance: it " +
        "works well for complex tasks where there are distinct categories better handled separately, and " +
        "where classification can be handled accurately. Two example uses it gives are worth separating " +
        "in your head — routing different customer-service queries to different processes, and routing " +
        "easy questions to a smaller model and hard ones to a more capable one. The first is about " +
        "quality; the second is purely about cost.",
    },
    { kind: "h", text: "Routing as a cost decision" },
    {
      kind: "code",
      caption:
        "A router with a confidence floor and a fallback. The costs are illustrative units; the arithmetic and the fallback branch are real. No model is called.",
      code:
        "ROUTES = {\n" +
        '    "refund":    {"handler": "refund_flow",    "model": "small", "cost": 1},\n' +
        '    "technical": {"handler": "tech_support",   "model": "large", "cost": 6},\n' +
        '    "general":   {"handler": "faq_lookup",     "model": "small", "cost": 1},\n' +
        "}\n" +
        'FALLBACK = {"handler": "human_queue", "model": "none", "cost": 0}\n' +
        "\n" +
        "CLASSIFIER_COST = 1\n" +
        "CONFIDENCE_FLOOR = 0.7\n" +
        "\n" +
        "queries = [\n" +
        '    ("Where is my money?", "refund", 0.94),\n' +
        '    ("The app crashes on login after the update", "technical", 0.88),\n' +
        '    ("What are your opening hours?", "general", 0.97),\n' +
        '    ("I want to talk about the thing from last time", "general", 0.41),\n' +
        "]\n" +
        "\n" +
        "total = 0\n" +
        "for text, label, confidence in queries:\n" +
        "    route = ROUTES[label] if confidence >= CONFIDENCE_FLOOR else FALLBACK\n" +
        '    cost = CLASSIFIER_COST + route["cost"]\n' +
        "    total += cost\n" +
        '    why = "" if confidence >= CONFIDENCE_FLOOR else f" (confidence {confidence:.2f} below floor)"\n' +
        "    print(f\"{cost:2d}u  {route['handler']:12} {route['model']:5}  {text[:44]}{why}\")\n" +
        "\n" +
        'print(f"\\ntotal {total}u. Routing everything to the large model would have cost "\n' +
        "      f\"{len(queries) * (CLASSIFIER_COST + ROUTES['technical']['cost'])}u.\")\n",
      output:
        " 2u  refund_flow  small  Where is my money?\n" +
        " 7u  tech_support large  The app crashes on login after the update\n" +
        " 2u  faq_lookup   small  What are your opening hours?\n" +
        " 1u  human_queue  none   I want to talk about the thing from last tim (confidence 0.41 below floor)\n" +
        "\n" +
        "total 12u. Routing everything to the large model would have cost 28u.",
    },
    {
      kind: "p",
      text:
        "Twelve units against twenty-eight, and the answers on the simple queries are *better* rather " +
        "than worse, because each handler has a prompt written for one job. That is the unusual thing " +
        "about routing among these patterns: chaining trades latency for accuracy, parallelisation " +
        "trades cost for latency, and routing can improve quality and cost at the same time. The catch " +
        "is the fourth row.",
    },
    { kind: "h", text: "The fourth row is the whole design" },
    {
      kind: "p",
      text:
        "\"I want to talk about the thing from last time\" is not any of your categories, and a " +
        "classifier without a fallback will assign it to one anyway — whichever scored highest — with no " +
        "signal that it was a guess. It will then be handled confidently by a path built for something " +
        "else. **A router is only as good as its fallback**, and the fallback needs two parts: a " +
        "confidence floor, and a real destination for whatever falls below it. \"General\" is not a " +
        "fallback; it is a fourth category that quietly absorbs everything the classifier could not " +
        "understand.",
    },
    {
      kind: "compare",
      title: "How to classify",
      columns: [
        {
          label: "A small model",
          items: [
            "Handles wording it has never seen, and other languages",
            "Gives you a label plus something you can treat as a confidence",
            "Costs a call and adds latency on every single request",
            "Can be wrong in ways you cannot predict from the code",
          ],
        },
        {
          label: "Rules and keywords",
          items: [
            "Free, instant, and completely predictable",
            "Trivially testable and auditable",
            "Brittle: misses paraphrases, misspellings and code-switched text entirely",
            "Excellent as a first pass — catch the obvious cases, send the rest to the model",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Lower `floor` to 0.3 and see which query stops going to a human. Raise it to 0.95 and see how much of your traffic you have just sent to the queue.",
      starter:
        "COSTS = {\"refund\": 1, \"technical\": 6, \"general\": 1, \"human_queue\": 0}\n" +
        "CLASSIFIER = 1\n" +
        "floor = 0.7\n" +
        "\n" +
        "traffic = [\n" +
        '    ("refund", 0.94), ("technical", 0.88), ("general", 0.97),\n' +
        '    ("general", 0.41), ("refund", 0.66), ("technical", 0.72),\n' +
        "]\n" +
        "\n" +
        "total, to_human = 0, 0\n" +
        "for label, confidence in traffic:\n" +
        "    if confidence >= floor:\n" +
        "        total += CLASSIFIER + COSTS[label]\n" +
        '        print(f"{confidence:.2f} -> {label}")\n' +
        "    else:\n" +
        '        total += CLASSIFIER + COSTS["human_queue"]\n' +
        "        to_human += 1\n" +
        '        print(f"{confidence:.2f} -> human_queue (below floor {floor})")\n' +
        "\n" +
        'print(f"\\n{total}u spent, {to_human} of {len(traffic)} sent to a person "\n' +
        '      f"({to_human / len(traffic):.0%} of traffic).")\n',
      expectedOutput:
        "0.94 -> refund\n" +
        "0.88 -> technical\n" +
        "0.97 -> general\n" +
        "0.41 -> human_queue (below floor 0.7)\n" +
        "0.66 -> human_queue (below floor 0.7)\n" +
        "0.72 -> technical\n" +
        "\n" +
        "20u spent, 2 of 6 sent to a person (33% of traffic).",
    },
    {
      kind: "p",
      text:
        "Notice what the floor really is. It is not a technical parameter — it is the dial between " +
        "\"more things handled automatically, some of them wrongly\" and \"more things handled by a " +
        "person, all of them correctly\". At 0.7 you are sending a third of this traffic to a human. " +
        "Whether that is right depends entirely on what a wrong answer costs you, and that is a product " +
        "decision, not an engineering one.",
    },
    {
      kind: "pitfall",
      items: [
        "No fallback — every input gets a label whether it fits or not, and the odd ones are handled confidently by a path built for something else.",
        "Using \"general\" as the fallback — it is a fourth category that silently absorbs everything the classifier could not understand, and nobody ever looks at it.",
        "Ignoring the confidence — a label without a confidence you act on is a router with the floor set to zero.",
        "Overlapping categories — a refund question about a technical fault belongs to two routes, and the classifier will flip between them on near-identical inputs.",
        "Never reviewing what the router sent where — a category that drifts, or a new kind of request nobody added a route for, is invisible without a sample somebody reads.",
        "Routing before it is worth it — with two categories and a clear keyword between them, an if statement is more reliable and costs nothing.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Routing separates the decision from the work: one cheap classification, then a handler built for that one case.",
        "It can improve quality and cost at the same time — the only pattern here that does.",
        "A router is only as good as its fallback. A confidence floor plus a real destination below it.",
        "\"General\" is not a fallback. It is a category, and it will quietly collect everything you did not plan for.",
        "The floor is a product decision about what a wrong answer costs, not a technical one.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How would you cut the cost of an LLM feature?\" — routing easy requests to a small model is a concrete, credible answer with a number attached.",
        "Expect to be asked what happens to inputs the classifier cannot handle. A confidence floor and a human queue is the answer; \"it picks the closest\" is the one that loses points.",
        "Saying that you would sample what the router did and read it weekly shows you have operated something rather than designed it.",
      ],
    },
    {
      kind: "quiz",
      question: "Why is a small classification call often cheaper overall than sending everything to a large model?",
      options: [
        "Small models are always more accurate than large ones, so nothing is lost by sending every request to a small one",
        "One cheap classification call lets most requests go to a cheap handler instead of an expensive one",
        "Classification calls are not billed",
        "The large model caches the classification",
      ],
      answer: 1,
      why:
        "You pay a small fixed cost per request to avoid a large variable one on most of them. It only " +
        "works if the cheap handlers genuinely handle their categories — which is the other half of the design.",
    },
    {
      kind: "quiz",
      question: "Your classifier returns \"general\" with confidence 0.41. What should happen?",
      options: [
        "Route it to the general handler — that is what the label says",
        "Route it to the fallback, because the confidence is below the floor you set",
        "Retry the classification at a higher temperature until it returns a label with higher confidence",
        "Route it to the most expensive handler to be safe",
      ],
      answer: 1,
      why:
        "A low-confidence label is the classifier saying it does not know, not saying \"general\". Acting " +
        "on it as though it were a real classification is the failure a floor exists to prevent.",
    },
    {
      kind: "quiz",
      question: "When is routing the wrong pattern?",
      options: [
        "When there are three or more categories, because a classifier cannot tell more than two apart reliably",
        "When the categories are distinct and classification is reliable",
        "When the categories overlap, so the same input legitimately belongs to two of them",
        "When you want to use a cheaper model for easy cases",
      ],
      answer: 2,
      why:
        "Routing assumes the categories are distinct. Overlapping ones make the classifier flip between " +
        "labels on near-identical inputs, which shows up as a system that is inconsistent for no visible " +
        "reason. Merge the categories, or handle the overlap explicitly.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "List the categories for a request type you know. Then find the input that legitimately belongs to two of them.",
        "Decide your confidence floor and work out, from the playground, what share of traffic it sends to a person.",
        "Write the fallback destination. Not \"general\" — an actual place, with an actual person or an actual message.",
        "Work out the saving from routing easy requests to a cheaper handler, for your real traffic mix.",
      ],
    },
  ],
};
