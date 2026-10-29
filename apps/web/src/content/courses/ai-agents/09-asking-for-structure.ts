import type { Chapter } from "@/content/courses/types";

export const chapterAskingForStructure: Chapter = {
  slug: "asking-for-structure",
  title: "Asking for Structure",
  summary:
    "The moment a model's output is read by code rather than by a person, prose is a liability. A schema, " +
    "a validator and a repair loop turn a fluent guess into something a program can rely on.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "Everything so far has assumed a human reads the answer. As soon as a *program* reads it — to " +
        "update a row, to route a ticket, to decide whether to call a tool — the rules change completely. " +
        "A human forgives \"Sure! Here's the refund status: it was paid on the 8th.\" A parser does not. " +
        "This chapter is about getting output a program can consume, and it is the last thing you need " +
        "before tools, because **a tool call is just structured output with a function attached.**",
    },
    { kind: "h", text: "The picture: the form versus the covering letter" },
    {
      kind: "analogy",
      title: "Why the bank gives you a form and not a blank sheet",
      text:
        "Walk into a bank to change your address and nobody hands you a blank sheet saying \"describe " +
        "your situation\". You get a form: name here, old address here, new address here, signature in " +
        "the box. The form is not there to be rude about your writing. It is there because the clerk who " +
        "keys it in has to find each field in a fixed place, and because the form itself makes some " +
        "mistakes impossible — there is no box for your opinion of the bank, so you do not put one. A " +
        "schema is that form. Where the analogy stops: a person who fills the form in wrongly can be " +
        "called back. A model that fills it in wrongly hands you a plausible-looking record that your " +
        "code will happily save, which is why validation is not optional.",
    },
    {
      kind: "concept",
      title: "Structured output",
      text:
        "Constraining a model's reply to a machine-readable shape — almost always JSON described by a " +
        "**JSON Schema**, which says what fields exist, what type each one is, and which are required. " +
        "Some providers can enforce the schema during generation so the output is guaranteed to parse; " +
        "where that is not available, you ask for the shape in the prompt and validate afterwards. " +
        "Either way, *you validate*. The guarantee is about shape, never about whether the values are true.",
    },
    { kind: "h", text: "Validate, then repair" },
    {
      kind: "p",
      text:
        "Here are four replies to the same request for JSON. One is clean; the others fail in the three " +
        "ways this goes wrong in practice — a friendly preamble that breaks the parse, a right-looking " +
        "value of the wrong type, and a confidently invented set of field names. All three would sail " +
        "past a human reviewer skim-reading the output.",
    },
    {
      kind: "code",
      caption:
        "Validating four candidate replies and composing the message you would send back. Real Python, no model — the replies are hard-coded.",
      code:
        "import json\n" +
        "\n" +
        "replies = [\n" +
        '    \'{"order_id": "A-4471", "status": "paid", "amount_inr": 3499}\',\n' +
        "    'Sure! Here is the JSON:\\n{\"order_id\": \"A-4471\", \"status\": \"paid\", \"amount_inr\": 3499}',\n" +
        '    \'{"order_id": "A-4471", "status": "paid", "amount_inr": "3499"}\',\n' +
        '    \'{"order": "A-4471", "state": "paid"}\',\n' +
        "]\n" +
        "\n" +
        'REQUIRED = {"order_id": str, "status": str, "amount_inr": int}\n' +
        "\n" +
        "\n" +
        "def validate(text):\n" +
        "    try:\n" +
        "        data = json.loads(text)\n" +
        "    except json.JSONDecodeError as exc:\n" +
        '        return None, f"not valid JSON: {exc.msg}"\n' +
        "    problems = []\n" +
        "    for field, kind in REQUIRED.items():\n" +
        "        if field not in data:\n" +
        '            problems.append(f"missing field {field!r}")\n' +
        "        elif not isinstance(data[field], kind):\n" +
        '            problems.append(f"{field!r} should be {kind.__name__}, got {type(data[field]).__name__}")\n' +
        '    return (data, None) if not problems else (None, "; ".join(problems))\n' +
        "\n" +
        "\n" +
        "for i, reply in enumerate(replies, start=1):\n" +
        "    data, error = validate(reply)\n" +
        '    label = "OK  " if data else "FAIL"\n' +
        '    print(f"reply {i}: {label} {error or data}")\n' +
        "    if error:\n" +
        '        print(f"          -> send back: your output was rejected. {error}. Reply with JSON only.")\n',
      output:
        "reply 1: OK   {'order_id': 'A-4471', 'status': 'paid', 'amount_inr': 3499}\n" +
        "reply 2: FAIL not valid JSON: Expecting value\n" +
        "          -> send back: your output was rejected. not valid JSON: Expecting value. Reply with JSON only.\n" +
        "reply 3: FAIL 'amount_inr' should be int, got str\n" +
        "          -> send back: your output was rejected. 'amount_inr' should be int, got str. Reply with JSON only.\n" +
        "reply 4: FAIL missing field 'order_id'; missing field 'status'; missing field 'amount_inr'\n" +
        "          -> send back: your output was rejected. missing field 'order_id'; missing field 'status'; missing field 'amount_inr'. Reply with JSON only.",
    },
    {
      kind: "p",
      text:
        "The important line is the last one in each failing case. When validation fails, you do not throw " +
        "the response away and retry blindly — you send the *specific* error back and ask again. A model " +
        "told \"`amount_inr` should be int, got str\" fixes that, because the error names a checkable " +
        "behaviour. A model told \"that was wrong, try again\" has been given an adjective. This is the " +
        "same principle as chapter 6, applied to a machine reader, and it is the first appearance of an " +
        "idea the whole of module 3 is built on: **an error message is an observation, and an " +
        "observation is what lets a loop correct itself.**",
    },
    {
      kind: "steps",
      title: "The shape of every structured-output call worth shipping",
      steps: [
        { label: "Describe", text: "Write the schema first — fields, types, which are required, and what each one means." },
        { label: "Constrain", text: "Use the provider's schema-constrained mode if it has one. It removes the whole class of parse failures." },
        { label: "Parse", text: "Parse it yourself anyway, in a try/except. Constrained or not, the response is data from outside your program." },
        { label: "Validate", text: "Check types and required fields, and check values against your own rules — a status of \"banana\" parses perfectly." },
        { label: "Repair once", text: "On failure, send the exact validation error back and ask again. Once, maybe twice — not forever." },
        { label: "Give up loudly", text: "If it still fails, fail visibly. A silent fallback to a default is how bad data gets into a database." },
      ],
    },
    { kind: "h", text: "A tool definition is this, with a function behind it" },
    {
      kind: "p",
      text:
        "Everything above is also, exactly, how a tool is described to a model. The Model Context " +
        "Protocol specification — which gets its own chapter in module 6 — defines a tool as a `name`, an " +
        "optional human-readable `title`, a `description`, and an `inputSchema` that \"MUST be a valid " +
        "JSON Schema object\", defaulting to draft 2020-12 when no `$schema` field is present. So the " +
        "thing you are about to spend a whole module on is: structured output, where the structure " +
        "happens to be the arguments to a function somebody wrote.",
    },
    {
      kind: "code",
      caption:
        "A tool definition in the shape the MCP specification describes. This is data, not a call — nothing is sent, and no server is contacted.",
      code:
        "import json\n" +
        "\n" +
        "tool = {\n" +
        '    "name": "check_refund_status",\n' +
        '    "title": "Refund Status",\n' +
        '    "description": (\n' +
        '        "Look up one refund by its refund id. Returns its state, the amount, "\n' +
        '        "and the date and account it was paid to."\n' +
        "    ),\n" +
        '    "inputSchema": {\n' +
        '        "type": "object",\n' +
        '        "properties": {\n' +
        '            "refund_id": {"type": "string", "description": "The refund id, e.g. RFD-9182."}\n' +
        "        },\n" +
        '        "required": ["refund_id"],\n' +
        "    },\n" +
        "}\n" +
        "\n" +
        "print(json.dumps(tool, indent=2))\n" +
        "print()\n" +
        'print("characters:", len(json.dumps(tool)))\n' +
        'print("This text is sent to the model on EVERY turn of the loop.")\n',
      output:
        "{\n" +
        '  "name": "check_refund_status",\n' +
        '  "title": "Refund Status",\n' +
        '  "description": "Look up one refund by its refund id. Returns its state, the amount, and the date and account it was paid to.",\n' +
        '  "inputSchema": {\n' +
        '    "type": "object",\n' +
        '    "properties": {\n' +
        '      "refund_id": {\n' +
        '        "type": "string",\n' +
        '        "description": "The refund id, e.g. RFD-9182."\n' +
        "      }\n" +
        "    },\n" +
        '    "required": [\n' +
        '      "refund_id"\n' +
        "    ]\n" +
        "  }\n" +
        "}\n" +
        "\n" +
        "characters: 343\n" +
        "This text is sent to the model on EVERY turn of the loop.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add a `\"paid_on\"` field to `REQUIRED` and re-run: every reply now fails. That is what happens when a schema changes and the prompt does not.",
      starter:
        "import json\n" +
        "\n" +
        "REQUIRED = {\n" +
        '    "order_id": str,\n' +
        '    "status": str,\n' +
        '    "amount_inr": int,\n' +
        "}\n" +
        'ALLOWED_STATUS = {"pending", "paid", "failed"}\n' +
        "\n" +
        "replies = [\n" +
        '    \'{"order_id": "A-4471", "status": "paid", "amount_inr": 3499}\',\n' +
        '    \'{"order_id": "A-4471", "status": "banana", "amount_inr": 3499}\',\n' +
        '    \'{"order_id": "A-4471", "status": "paid", "amount_inr": "3499"}\',\n' +
        "]\n" +
        "\n" +
        "\n" +
        "def check(text):\n" +
        "    try:\n" +
        "        data = json.loads(text)\n" +
        "    except json.JSONDecodeError as exc:\n" +
        '        return [f"not valid JSON: {exc.msg}"]\n' +
        "    problems = []\n" +
        "    for field, kind in REQUIRED.items():\n" +
        "        if field not in data:\n" +
        '            problems.append(f"missing {field}")\n' +
        "        elif not isinstance(data[field], kind):\n" +
        '            problems.append(f"{field} should be {kind.__name__}")\n' +
        "    # Shape is not the same as sense: a valid string can still be a nonsense status.\n" +
        '    if data.get("status") not in ALLOWED_STATUS:\n' +
        '        problems.append(f"status must be one of {sorted(ALLOWED_STATUS)}")\n' +
        "    return problems\n" +
        "\n" +
        "\n" +
        "for i, reply in enumerate(replies, start=1):\n" +
        "    problems = check(reply)\n" +
        '    print(f"reply {i}:", "OK" if not problems else "; ".join(problems))\n',
      expectedOutput:
        "reply 1: OK\n" +
        "reply 2: status must be one of ['failed', 'paid', 'pending']\n" +
        "reply 3: amount_inr should be int",
    },
    {
      kind: "compare",
      title: "What a schema guarantees, and what it does not",
      columns: [
        {
          label: "A schema gives you",
          items: [
            "Fields in known places with known types, so your code can stop guessing",
            "A parse failure you can catch instead of a sentence you have to regex",
            "A description per field, which is itself instruction the model reads",
            "A precise error to send back when something is wrong",
          ],
        },
        {
          label: "A schema does not give you",
          items: [
            "Any guarantee that the values are true — \"amount_inr\": 99999 is perfectly valid JSON",
            "Protection from a well-typed status that means nothing in your system",
            "Freedom from validating: constrained generation is a provider feature, not a law of nature",
            "Cheapness — the schema is tokens, sent on every call, like everything else",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Parsing with a regular expression instead of a JSON parser — it works on the first ten replies and then meets a string containing a brace.",
        "Trusting a valid parse as a valid value — type-correct nonsense is the most common structured-output bug, and it goes straight into your database.",
        "Retrying without saying what was wrong — \"that was wrong, try again\" gives the model nothing to correct; the exact validation error does.",
        "Retrying forever — a repair loop with no cap is the same bug as an agent with no step limit, which the agent lab lets you watch happen.",
        "Falling back to a default on failure — a silent default looks like it worked and quietly poisons everything downstream; fail loudly instead.",
        "Letting the schema and the prompt drift apart — when a field is added in one place and not the other, every single call starts failing at once.",
      ],
    },
    {
      kind: "remember",
      items: [
        "The moment code reads the output, prose is a liability. Ask for JSON described by a schema.",
        "Use constrained generation where you have it, and validate anyway — the response is data from outside your program.",
        "A valid parse is not a valid value. Check the values against your own rules too.",
        "On failure, send the exact error back and repair once or twice — then fail loudly, never silently.",
        "A tool definition is a name, a description and an `inputSchema` that must be a valid JSON Schema (MCP specification). Tools are structured output with a function attached.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"How do you get reliable JSON out of a model?\" is a standard practical question. Schema, constrained generation if available, parse, validate, repair once with the specific error, fail loudly.",
        "Expect to be pushed on what happens when it still fails. \"Fall back to a default\" is the wrong answer and interviewers know it.",
        "Being able to say that a tool call *is* structured output shows you understand what the next module is really about, rather than treating tools as a separate magic feature.",
      ],
    },
    {
      kind: "quiz",
      question: "A model returns `{\"order_id\": \"A-4471\", \"status\": \"paid\", \"amount_inr\": \"3499\"}` against a schema requiring an integer amount. What is the best next move?",
      options: [
        "Cast the string to an integer yourself and carry on, since the value is plainly meant to be a number",
        "Send back the specific error — amount_inr should be int, got str — and ask for a corrected reply",
        "Lower the temperature and retry",
        "Accept it; JSON types are advisory",
      ],
      answer: 1,
      why:
        "A precise error is something the model can act on, exactly as a precise instruction is. Silently " +
        "casting hides a fault that will show up later with a value that does not cast so cleanly.",
    },
    {
      kind: "quiz",
      question: "What does schema-constrained generation guarantee?",
      options: [
        "That the values are correct",
        "That the output matches the declared shape and types",
        "That the model used a tool",
        "That no validation is needed afterwards, because the values will be correct too",
      ],
      answer: 1,
      why:
        "Constraining generation is about shape. `{\"status\": \"paid\", \"amount_inr\": 99999}` satisfies " +
        "the schema perfectly and may still be entirely wrong, which is why value-level validation stays your job.",
    },
    {
      kind: "quiz",
      question: "According to the MCP specification, what must a tool's `inputSchema` be?",
      options: [
        "A plain string that describes the arguments in ordinary English for the model to read",
        "A valid JSON Schema object, defaulting to draft 2020-12 when no $schema is given",
        "An example call",
        "Optional — tools may omit it",
      ],
      answer: 1,
      why:
        "The spec requires `inputSchema` to be a valid JSON Schema object and not null, and says it defaults " +
        "to 2020-12 if no `$schema` field is present. Even a tool with no parameters has to declare one.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Write the JSON Schema for something you would want extracted from a support email. Then write the value-level rules a schema cannot express.",
        "Add `paid_on` to REQUIRED in the playground and watch every reply fail at once. That is a schema change shipped without a prompt change.",
        "Design the repair loop: how many attempts, what you send back each time, and exactly what happens when it still fails.",
        "Take a tool you would like a model to call and write its full definition — name, description, inputSchema. Count the characters and remember they are sent every turn.",
      ],
    },
  ],
};
