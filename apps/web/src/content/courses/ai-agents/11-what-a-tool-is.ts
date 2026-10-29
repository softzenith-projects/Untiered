import type { Chapter } from "@/content/courses/types";

export const chapterWhatAToolIs: Chapter = {
  slug: "what-a-tool-is",
  title: "What a Tool Actually Is",
  summary:
    "A tool is a function plus a description the model reads. The model never runs anything — it asks, " +
    "your code decides, your code executes, and the result comes back as text.",
  minutes: 14,
  blocks: [
    {
      kind: "p",
      text:
        "\"Giving the model a tool\" sounds like installing something. It is much more boring than that, " +
        "and the boringness is the good news, because it means you can see exactly where the safety " +
        "decisions live. A tool is **a function you already have, plus a written description of it that " +
        "goes into the prompt**. The model cannot run your function. It can only produce text that says " +
        "it would like to — and then your code reads that text and decides what to do.",
    },
    { kind: "h", text: "The picture: a doctor and a prescription pad" },
    {
      kind: "analogy",
      title: "The doctor writes the prescription. The pharmacist decides what to hand over.",
      text:
        "A doctor examines you and writes a prescription. She does not walk into the dispensary and take " +
        "the medicine off the shelf herself — she produces a piece of paper naming a drug and a dose. " +
        "The pharmacist reads it, checks the name is a real drug, checks the dose is in range, checks it " +
        "against what you are already taking, and only then hands something over. Two separate jobs, and " +
        "the second one is where the real safety lives. A model writing a tool call is the doctor: it " +
        "produces a piece of text naming a function and some arguments. Your runtime is the pharmacist. " +
        "Where the analogy stops: the doctor has years of accountability behind her handwriting. Your " +
        "model has none, which makes the pharmacist's checks more important rather than less.",
    },
    {
      kind: "concept",
      title: "Tool",
      text:
        "A function the runtime can execute, described to the model by a `name`, a `description`, and an " +
        "`inputSchema` — a JSON Schema for its arguments. The Model Context Protocol specification " +
        "describes tools as **model-controlled**, meaning the model can discover and invoke them based " +
        "on its understanding of the context and the user's prompts. \"Invoke\" is doing careful work in " +
        "that sentence: the model asks, and something else carries it out.",
    },
    { kind: "h", text: "The whole mechanism, in one file" },
    {
      kind: "code",
      caption:
        "A tool registry and a dispatcher — the code that sits between \"the model asked\" and \"the model sees\". Real Python; the data is invented and no model is called.",
      code:
        "import json\n" +
        "\n" +
        "# A tool is two things: a function, and a description of it the model can read.\n" +
        'ORDERS = {"A-4471": {"item": "running shoes", "returned_on": "2026-08-30", "refund_id": "RFD-9182"}}\n' +
        'REFUNDS = {"RFD-9182": {"state": "paid", "amount_inr": 3499, "paid_on": "2026-09-08"}}\n' +
        "\n" +
        "\n" +
        "def find_order(order_id):\n" +
        '    return ORDERS.get(order_id, {"error": f"no order {order_id}"})\n' +
        "\n" +
        "\n" +
        "def check_refund_status(refund_id):\n" +
        '    return REFUNDS.get(refund_id, {"error": f"no refund {refund_id}"})\n' +
        "\n" +
        "\n" +
        "TOOLS = {\n" +
        '    "find_order": {\n' +
        '        "fn": find_order,\n' +
        '        "schema": {\n' +
        '            "name": "find_order",\n' +
        '            "description": "Look up one order by its order id. Returns the item, the return date, and the refund id if a refund was raised.",\n' +
        '            "inputSchema": {\n' +
        '                "type": "object",\n' +
        '                "properties": {"order_id": {"type": "string", "description": "The order id, e.g. A-4471."}},\n' +
        '                "required": ["order_id"],\n' +
        "            },\n" +
        "        },\n" +
        "    },\n" +
        '    "check_refund_status": {\n' +
        '        "fn": check_refund_status,\n' +
        '        "schema": {\n' +
        '            "name": "check_refund_status",\n' +
        '            "description": "Look up one refund by its refund id. Returns its state, amount and payment date.",\n' +
        '            "inputSchema": {\n' +
        '                "type": "object",\n' +
        '                "properties": {"refund_id": {"type": "string", "description": "The refund id, e.g. RFD-9182."}},\n' +
        '                "required": ["refund_id"],\n' +
        "            },\n" +
        "        },\n" +
        "    },\n" +
        "}\n" +
        "\n" +
        "\n" +
        "def call_tool(name, arguments):\n" +
        '    """Everything a runtime does between \'the model asked\' and \'the model sees\'."""\n' +
        "    tool = TOOLS.get(name)\n" +
        "    if tool is None:\n" +
        '        return {"isError": True, "content": f"unknown tool: {name}"}\n' +
        '    required = tool["schema"]["inputSchema"]["required"]\n' +
        "    missing = [r for r in required if r not in arguments]\n" +
        "    if missing:\n" +
        "        return {\"isError\": True, \"content\": f\"missing required argument(s): {', '.join(missing)}\"}\n" +
        "    try:\n" +
        '        return {"isError": False, "content": json.dumps(tool["fn"](**arguments))}\n' +
        "    except TypeError as exc:\n" +
        '        return {"isError": True, "content": f"bad arguments: {exc}"}\n' +
        "\n" +
        "\n" +
        "for name, args in [\n" +
        '    ("find_order", {"order_id": "A-4471"}),\n' +
        '    ("find_order", {}),\n' +
        '    ("check_refund_status", {"refund_id": "RFD-9182"}),\n' +
        '    ("send_email", {"to": "x"}),\n' +
        '    ("find_order", {"order_id": "A-4471", "colour": "blue"}),\n' +
        "]:\n" +
        "    result = call_tool(name, args)\n" +
        '    mark = "ERR " if result["isError"] else "OK  "\n' +
        "    print(f\"{mark}{name}({args}) -> {result['content']}\")\n",
      output:
        "OK  find_order({'order_id': 'A-4471'}) -> {\"item\": \"running shoes\", \"returned_on\": \"2026-08-30\", \"refund_id\": \"RFD-9182\"}\n" +
        "ERR find_order({}) -> missing required argument(s): order_id\n" +
        "OK  check_refund_status({'refund_id': 'RFD-9182'}) -> {\"state\": \"paid\", \"amount_inr\": 3499, \"paid_on\": \"2026-09-08\"}\n" +
        "ERR send_email({'to': 'x'}) -> unknown tool: send_email\n" +
        "ERR find_order({'order_id': 'A-4471', 'colour': 'blue'}) -> bad arguments: find_order() got an unexpected keyword argument 'colour'",
    },
    {
      kind: "p",
      text:
        "`call_tool` is the pharmacist, and it is worth noticing how much of it is refusal. Unknown tool: " +
        "refused. Missing argument: refused. Wrong argument name: refused. **The model asked for " +
        "`send_email` and did not get it** — not because the model was well-behaved, but because " +
        "`send_email` is not in `TOOLS`. That is the only kind of guarantee in this entire field that " +
        "does not depend on the model behaving: a function that is not in the registry cannot be called, " +
        "however convincingly the model asks.",
    },
    {
      kind: "steps",
      title: "One turn of a tool-using call",
      steps: [
        { label: "Describe", text: "The tool definitions go into the prompt, as text, alongside the system prompt and the history. Every turn." },
        { label: "Ask", text: "The model produces a tool call: a name and a JSON object of arguments. It has executed nothing." },
        { label: "Decide", text: "Your runtime checks the tool exists, the arguments validate, the user is allowed, and — for anything that changes the world — whether a human should approve first." },
        { label: "Execute", text: "Your code calls your function. The model is not involved and cannot see inside." },
        { label: "Return", text: "The result is serialised to text and appended to the conversation as an observation." },
        { label: "Repeat", text: "The whole context, now one observation longer, goes back to the model. That repetition is the loop, and it is the next chapter." },
      ],
    },
    { kind: "h", text: "Errors are information, not failure" },
    {
      kind: "p",
      text:
        "Look again at the `isError` flag. That is not decoration; it is the MCP specification's own " +
        "distinction, and it matters. The spec separates **protocol errors** — an unknown tool, a " +
        "malformed request, things \"models are less likely to be able to fix\" — from **tool execution " +
        "errors**, which \"contain actionable feedback that language models can use to self-correct and " +
        "retry with adjusted parameters\": API failures, input validation errors such as a date in the " +
        "wrong format, business logic errors. Its guidance is that clients *should* provide tool " +
        "execution errors to the model, precisely so it can recover. The spec's own example is a good " +
        "one to copy: `\"Invalid departure date: must be in the future. Current date is 08/08/2025.\"`",
    },
    {
      kind: "compare",
      title: "Two error messages, same failure",
      columns: [
        {
          label: "Nothing to act on",
          items: [
            "\"Error.\"",
            "\"Bad request (400).\"",
            "\"Invalid input.\"",
            "A stack trace with no statement of what was expected",
            "Result: the agent retries the same call, or gives up and invents an answer",
          ],
        },
        {
          label: "Something to act on",
          items: [
            "\"unknown station 'Pune' — expected a station code such as PUNE\"",
            "\"missing required argument: order_id\"",
            "\"Invalid departure date: must be in the future. Current date is 08/08/2025.\"",
            "\"no order A-4471 for this customer — check the id or ask them to confirm it\"",
            "Result: the agent fixes the call and continues, which you will watch happen in the next chapter's lab",
          ],
        },
      ],
    },
    { kind: "h", text: "The interface you are designing is for a model" },
    {
      kind: "p",
      text:
        "Anthropic's *Building Effective Agents* makes a point that is easy to skip and expensive to " +
        "skip: think about how much effort goes into human-computer interfaces, and plan to invest just " +
        "as much effort in creating good **agent-computer interfaces** (ACI). The guidance that follows " +
        "is practical — make tool formats natural for the model to produce, leave it enough tokens to " +
        "think before it commits to a shape, avoid formatting overhead, and test extensively with real " +
        "example inputs. Its list of three core principles for building agents puts this alongside " +
        "simplicity and transparency: craft the agent-computer interface through thorough tool " +
        "documentation and testing.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Try to call a tool that is not in the registry, or with a misspelled argument. Notice that every refusal is your code's decision, never the model's.",
      starter:
        "REGISTRY = {\n" +
        '    "find_order": {"required": ["order_id"], "writes": False},\n' +
        '    "check_refund_status": {"required": ["refund_id"], "writes": False},\n' +
        '    "issue_refund": {"required": ["order_id", "amount_inr"], "writes": True},\n' +
        "}\n" +
        "\n" +
        "\n" +
        "def gate(name, arguments, human_approved=False):\n" +
        '    """The pharmacist. Everything here is a decision your code makes, not the model."""\n' +
        "    tool = REGISTRY.get(name)\n" +
        "    if tool is None:\n" +
        '        return f"REFUSED  no such tool: {name}"\n' +
        '    missing = [r for r in tool["required"] if r not in arguments]\n' +
        "    if missing:\n" +
        "        return f\"REFUSED  missing: {', '.join(missing)}\"\n" +
        '    if tool["writes"] and not human_approved:\n' +
        '        return "HELD     this changes something. A person has to approve it first."\n' +
        '    return f"ALLOWED  {name}({arguments})"\n' +
        "\n" +
        "\n" +
        "requests = [\n" +
        '    ("find_order", {"order_id": "A-4471"}, False),\n' +
        '    ("issue_refund", {"order_id": "A-4471", "amount_inr": 3499}, False),\n' +
        '    ("issue_refund", {"order_id": "A-4471", "amount_inr": 3499}, True),\n' +
        '    ("delete_everything", {}, True),\n' +
        '    ("check_refund_status", {}, False),\n' +
        "]\n" +
        "\n" +
        "for name, args, approved in requests:\n" +
        "    print(gate(name, args, approved))\n",
      expectedOutput:
        "ALLOWED  find_order({'order_id': 'A-4471'})\n" +
        "HELD     this changes something. A person has to approve it first.\n" +
        "ALLOWED  issue_refund({'order_id': 'A-4471', 'amount_inr': 3499})\n" +
        "REFUSED  no such tool: delete_everything\n" +
        "REFUSED  missing: refund_id",
    },
    {
      kind: "p",
      text:
        "That `HELD` branch is not something this course invented. The MCP specification says that for " +
        "trust and safety there **should** always be a human in the loop with the ability to deny tool " +
        "invocations, and that applications should make clear which tools are exposed, show visual " +
        "indicators when tools are invoked, and present confirmation prompts. Module 6 returns to this " +
        "under the name OWASP gives it — excessive agency — but the place it is implemented is right " +
        "here, in the six lines between the model's request and your function.",
    },
    {
      kind: "pitfall",
      items: [
        "Thinking the model executes anything — it produces text naming a function; your runtime executes, and every refusal is yours to make.",
        "Registering a tool that can do more than the task needs — a general \"run this SQL\" tool has no safe version, while \"find_order(order_id)\" has no dangerous one.",
        "Returning raw exceptions to the model — a stack trace is not actionable feedback, and the agent will retry the same call or give up and invent an answer.",
        "Treating read tools and write tools the same — a wrong read costs a wasted step; a wrong write costs a real refund to a real customer, and needs an approval gate.",
        "Forgetting that tool definitions are tokens — they are re-sent on every turn of every loop, so a dozen chatty tools is a permanent tax on the context window.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A tool is a function plus a name, description and inputSchema the model reads. The model asks; your code decides and executes.",
        "A function not in the registry cannot be called, however convincingly the model asks for it. That is the one guarantee that does not depend on the model.",
        "Separate protocol errors from tool execution errors, and return the second kind to the model so it can self-correct (MCP specification).",
        "An error message is only useful if it says what was expected. \"Bad request\" produces a retry loop; \"expected a station code such as PUNE\" produces a fix.",
        "Invest in the agent-computer interface as you would in a human one (Anthropic, *Building Effective Agents*).",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Walk me through what happens when a model calls a tool\" is a standard question, and the expected answer has the model executing nothing at all.",
        "Expect to be asked where you would put authorisation. \"In the runtime, before the call, per user\" is right; \"in the system prompt\" is the wrong answer people give.",
        "Being able to say why a narrow tool is safer than a general one — and giving the SQL example — shows you have thought about blast radius rather than capability.",
      ],
    },
    {
      kind: "quiz",
      question: "A model produces a tool call for `delete_all_orders`, which you never registered. What happens?",
      options: [
        "The function runs anyway, because the model asked for it and the dispatcher trusts the model's request",
        "Nothing runs — the dispatcher does not find it and returns an error the model can read",
        "The model is blocked from producing tool calls for the rest of the session",
        "It depends on the system prompt",
      ],
      answer: 1,
      why:
        "The model only ever produces text. If no such function is registered, there is nothing to " +
        "execute. This is the one security property in the whole system that does not depend on the " +
        "model behaving well — which is why the registry, not the prompt, is where capability is decided.",
    },
    {
      kind: "quiz",
      question: "Which error message is most likely to let an agent recover on its next turn?",
      options: [
        "\"Error: 400 — the request could not be processed, please try again later.\"",
        "\"Invalid input: the request failed validation, so it was not processed. Contact support.\"",
        "\"Invalid departure date: must be in the future. Current date is 08/08/2025.\"",
        "A full Python traceback",
      ],
      answer: 2,
      why:
        "The MCP specification's own example, and for a reason: it names what was wrong *and* what would " +
        "be right. That is actionable feedback the model can use to self-correct and retry with adjusted parameters.",
    },
    {
      kind: "quiz",
      question: "Where should the decision that a refund needs human approval live?",
      options: [
        "In the system prompt, as a firm instruction to always ask a human before issuing any refund",
        "In the tool description, as a warning",
        "In the runtime, between the model's request and the function call",
        "In the model's training",
      ],
      answer: 2,
      why:
        "Prompts and descriptions are text the model may or may not follow. The gate in the runtime is " +
        "code, and it holds whatever the model produces. The MCP specification puts it the same way: " +
        "there should always be a human in the loop with the ability to deny tool invocations.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Pick a function in a system you know and write its full tool definition: name, description, inputSchema with a description per argument.",
        "Write its three most likely error messages so that each one says what was expected, not just that something failed.",
        "Split your tools into reads and writes, and write the approval rule for each write. Who approves, and what do they see?",
        "In the playground, add a tool that can do too much — a general query or shell tool — and write down what its safe version would have to look like.",
      ],
    },
  ],
};
