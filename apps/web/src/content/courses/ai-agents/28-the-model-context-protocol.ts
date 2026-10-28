import type { Chapter } from "@/content/courses/types";

export const chapterTheModelContextProtocol: Chapter = {
  slug: "the-model-context-protocol",
  title: "MCP: A Standard Way to Reach a Tool",
  summary:
    "An open protocol so that a tool written once can be used by any client. JSON-RPC, three roles, and " +
    "a security section that is worth more attention than the wire format.",
  minutes: 15,
  blocks: [
    {
      kind: "p",
      text:
        "Every chapter so far has assumed your tools live in your own codebase. That works until there " +
        "are four teams, each with their own assistant, each writing its own wrapper around the same " +
        "orders database. The **Model Context Protocol** is the open answer to that: a published " +
        "specification for how a model-facing application asks another process what tools it has and " +
        "calls them. Write the server once; any client that speaks the protocol can use it.",
    },
    { kind: "h", text: "The picture: the plug socket" },
    {
      kind: "analogy",
      title: "Why nobody hard-wires a lamp",
      text:
        "Before standard sockets, connecting a lamp to a building's electricity meant an electrician " +
        "and a permanent join. Now the lamp has a plug, the wall has a socket, and neither the lamp " +
        "maker nor the builder needs to know anything about the other beyond the shape. The lamp does " +
        "not become more capable — it becomes *portable*, and that is worth more. MCP is the socket " +
        "standard for tools. Where the analogy stops: a plug carries power in one direction and cannot " +
        "lie to you. A tool server sends *text*, which reaches a model that acts on text — which is why " +
        "the specification devotes a whole section to trust, and why its most important sentence is " +
        "that tool descriptions from an untrusted server must themselves be treated as untrusted.",
    },
    {
      kind: "concept",
      title: "Model Context Protocol",
      text:
        "In the specification's own words, \"an open protocol that enables seamless integration between " +
        "LLM applications and external data sources and tools\". It uses **JSON-RPC 2.0** messages and " +
        "takes some inspiration from the Language Server Protocol, which standardised adding language " +
        "support across every development tool. The parallel is exact and deliberate: LSP meant writing " +
        "one language server instead of one plugin per editor; MCP means writing one tool server instead " +
        "of one integration per assistant.",
    },
    { kind: "h", text: "Three roles, and who offers what" },
    {
      kind: "compare",
      title: "The participants, as the specification defines them",
      columns: [
        {
          label: "Host",
          items: [
            "The LLM application that initiates connections",
            "Where the user is, and where consent is asked for",
            "Contains one client per server it connects to",
          ],
        },
        {
          label: "Server — offers",
          items: [
            "**Resources**: context and data, for the user or the model to use",
            "**Prompts**: templated messages and workflows for users",
            "**Tools**: functions for the model to execute",
          ],
        },
        {
          label: "Client — may offer",
          items: [
            "**Sampling**: server-initiated agentic behaviours and recursive LLM interactions",
            "**Roots**: server-initiated inquiries into the URI or filesystem boundaries to operate in",
            "**Elicitation**: server-initiated requests for additional information from users",
          ],
        },
      ],
    },
    {
      kind: "p",
      text:
        "Most people meet MCP as \"a way to give an assistant tools\" and never notice the other two " +
        "server features or any of the client ones. Sampling is the surprising one: it lets a *server* " +
        "ask the client to run a model call on its behalf — which is powerful and is exactly why the " +
        "specification insists users must explicitly approve any sampling request, and should control " +
        "whether it happens at all, what prompt is sent, and what results the server can see.",
    },
    { kind: "h", text: "The wire, in three messages" },
    {
      kind: "code",
      caption:
        "The three MCP messages worth memorising, built as JSON. Nothing is sent and no server exists here — this is the shape, not a client.",
      code:
        "import json\n" +
        "\n" +
        "tools_list_response = {\n" +
        '    "jsonrpc": "2.0",\n' +
        '    "id": 1,\n' +
        '    "result": {\n' +
        '        "resultType": "complete",\n' +
        '        "tools": [\n' +
        "            {\n" +
        '                "name": "get_weather",\n' +
        '                "title": "Weather Information Provider",\n' +
        '                "description": "Get current weather information for a location",\n' +
        '                "inputSchema": {\n' +
        '                    "type": "object",\n' +
        '                    "properties": {\n' +
        '                        "location": {"type": "string", "description": "City name or zip code"}\n' +
        "                    },\n" +
        '                    "required": ["location"],\n' +
        "                },\n" +
        "            }\n" +
        "        ],\n" +
        "    },\n" +
        "}\n" +
        "\n" +
        "tools_call_request = {\n" +
        '    "jsonrpc": "2.0",\n' +
        '    "id": 2,\n' +
        '    "method": "tools/call",\n' +
        '    "params": {"name": "get_weather", "arguments": {"location": "New York"}},\n' +
        "}\n" +
        "\n" +
        "tool_error_result = {\n" +
        '    "jsonrpc": "2.0",\n' +
        '    "id": 4,\n' +
        '    "result": {\n' +
        '        "resultType": "complete",\n' +
        '        "content": [\n' +
        "            {\n" +
        '                "type": "text",\n' +
        '                "text": "Invalid departure date: must be in the future. Current date is 08/08/2025.",\n' +
        "            }\n" +
        "        ],\n" +
        '        "isError": True,\n' +
        "    },\n" +
        "}\n" +
        "\n" +
        "for label, message in [\n" +
        '    ("server lists its tools", tools_list_response),\n' +
        '    ("client calls one", tools_call_request),\n' +
        '    ("tool execution error -- the model is meant to see this", tool_error_result),\n' +
        "]:\n" +
        '    print(f"--- {label} ---")\n' +
        "    print(json.dumps(message, indent=2))\n" +
        "    print()\n",
      output:
        "--- server lists its tools ---\n" +
        "{\n" +
        '  "jsonrpc": "2.0",\n' +
        '  "id": 1,\n' +
        '  "result": {\n' +
        '    "resultType": "complete",\n' +
        '    "tools": [\n' +
        "      {\n" +
        '        "name": "get_weather",\n' +
        '        "title": "Weather Information Provider",\n' +
        '        "description": "Get current weather information for a location",\n' +
        '        "inputSchema": {\n' +
        '          "type": "object",\n' +
        '          "properties": {\n' +
        '            "location": {\n' +
        '              "type": "string",\n' +
        '              "description": "City name or zip code"\n' +
        "            }\n" +
        "          },\n" +
        '          "required": [\n' +
        '            "location"\n' +
        "          ]\n" +
        "        }\n" +
        "      }\n" +
        "    ]\n" +
        "  }\n" +
        "}\n" +
        "\n" +
        "--- client calls one ---\n" +
        "{\n" +
        '  "jsonrpc": "2.0",\n' +
        '  "id": 2,\n' +
        '  "method": "tools/call",\n' +
        '  "params": {\n' +
        '    "name": "get_weather",\n' +
        '    "arguments": {\n' +
        '      "location": "New York"\n' +
        "    }\n" +
        "  }\n" +
        "}\n" +
        "\n" +
        "--- tool execution error -- the model is meant to see this ---\n" +
        "{\n" +
        '  "jsonrpc": "2.0",\n' +
        '  "id": 4,\n' +
        '  "result": {\n' +
        '    "resultType": "complete",\n' +
        '    "content": [\n' +
        "      {\n" +
        '        "type": "text",\n' +
        '        "text": "Invalid departure date: must be in the future. Current date is 08/08/2025."\n' +
        "      }\n" +
        "    ],\n" +
        '    "isError": true\n' +
        "  }\n" +
        "}",
    },
    {
      kind: "p",
      text:
        "Everything from chapter 11 is visible in those three messages — the name, the description, the " +
        "JSON Schema, and the `isError` flag that distinguishes an error the model should see from one " +
        "it cannot act on. The specification says clients **should** provide tool execution errors to " +
        "language models to enable self-correction, and **may** provide protocol errors though these " +
        "are less likely to result in successful recovery. You watched that distinction decide a run in " +
        "chapter 13's lab.",
    },
    { kind: "h", text: "Versioning, briefly, because it will bite you" },
    {
      kind: "p",
      text:
        "MCP versions are date strings, `YYYY-MM-DD`, marking the last date backwards-incompatible " +
        "changes were made — and the version is deliberately *not* incremented for backwards-compatible " +
        "updates. At the time of writing the current revision is **2026-07-28**. In that revision every " +
        "request declares its protocol version in the `_meta` field under " +
        "`io.modelcontextprotocol/protocolVersion`, and the server accepts or rejects each request " +
        "independently; if it does not support the version it responds with an " +
        "`UnsupportedProtocolVersionError` listing what it does support. A client that wants to choose " +
        "up front can call `server/discover`, a mandatory RPC returning supported versions, capabilities " +
        "and identity in one request — but calling it is optional. Earlier, handshake-based revisions " +
        "(2025-11-25 and before) work differently, which is exactly the sort of thing to check in the " +
        "spec rather than assume from a blog post.",
    },
    { kind: "h", text: "The security section is the important one" },
    {
      kind: "p",
      text:
        "The specification is unusually direct: MCP \"enables powerful capabilities through arbitrary " +
        "data access and code execution paths\", and with that power come considerations all " +
        "implementors must address. Its four key principles are worth reading as requirements rather " +
        "than advice.",
    },
    {
      kind: "table",
      head: ["Principle", "What the spec says", "What it means for you"],
      rows: [
        [
          "User consent and control",
          "Users must explicitly consent to and understand all data access and operations, and retain control over what is shared and what is done.",
          "Consent is per-capability and visible, not a checkbox at install time. Implementors should provide clear UIs for reviewing and authorising activities.",
        ],
        [
          "Data privacy",
          "Hosts must obtain explicit user consent before exposing user data to servers, and must not transmit resource data elsewhere without consent.",
          "Connecting a server is a data-sharing decision. Know what each one can see, and say so where the user can read it.",
        ],
        [
          "Tool safety",
          "Tools represent arbitrary code execution. Descriptions of tool behaviour, such as annotations, should be considered untrusted unless obtained from a trusted server. Hosts must obtain explicit user consent before invoking any tool.",
          "A tool's own description of itself is not evidence about what it does. A hostile server can describe a destructive tool as harmless, and the model reads that description.",
        ],
        [
          "LLM sampling controls",
          "Users must explicitly approve any sampling request, and should control whether it happens, the prompt sent, and what the server sees.",
          "A server asking your client to run a model call is a cost and a privacy event. The protocol intentionally limits server visibility into prompts.",
        ],
      ],
    },
    {
      kind: "concept",
      title: "An untrusted tool description",
      text:
        "The most under-appreciated line in the specification. A model decides which tool to call by " +
        "reading descriptions, so a server that describes `delete_everything` as \"lists your recent " +
        "files\" has given the model a false manual — and chapter 13 showed how completely the " +
        "description determines the call. This is why capability belongs in your registry and your " +
        "approval gate, both of which are code you control, and never in text a third party supplied.",
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Add a server of your own to `servers` and decide its trust level. Anything you would not run unsupervised should not be auto-approved either.",
      starter:
        "# Connecting a server is a trust decision. Write it down per server.\n" +
        "servers = [\n" +
        '    {"name": "internal-orders", "trusted": True,  "tools": ["find_order"],            "writes": False},\n' +
        '    {"name": "internal-billing", "trusted": True, "tools": ["issue_refund"],          "writes": True},\n' +
        '    {"name": "community-utils", "trusted": False, "tools": ["format_date", "run_sh"], "writes": True},\n' +
        "]\n" +
        "\n" +
        "for s in servers:\n" +
        '    if not s["trusted"]:\n' +
        "        verdict = (\n" +
        '            "descriptions are UNTRUSTED -- every call needs explicit approval, "\n' +
        '            "and the tool list needs a human to read it"\n' +
        "        )\n" +
        '    elif s["writes"]:\n' +
        '        verdict = "trusted, but it changes things -- approval gate on every write"\n' +
        "    else:\n" +
        '        verdict = "trusted and read-only -- safe to auto-approve"\n' +
        "    print(f\"{s['name']:18} {len(s['tools'])} tool(s)  {verdict}\")\n",
      expectedOutput:
        "internal-orders    1 tool(s)  trusted and read-only -- safe to auto-approve\n" +
        "internal-billing   1 tool(s)  trusted, but it changes things -- approval gate on every write\n" +
        "community-utils    2 tool(s)  descriptions are UNTRUSTED -- every call needs explicit approval, and the tool list needs a human to read it",
    },
    {
      kind: "pitfall",
      items: [
        "Trusting a tool description from a server you do not control — the specification says to treat these as untrusted, and the model decides what to call by reading them.",
        "Connecting a server without knowing what it can see — that is a data-sharing decision, and hosts must get explicit consent before exposing user data to a server.",
        "Auto-approving every tool on a server because one of them is harmless — the unit of trust is the tool and the call, not the connection.",
        "Ignoring sampling — a server that can ask your client to run model calls can spend your money and see whatever you let it see.",
        "Assuming a version from a blog post — versions are dates marking backwards-incompatible changes, and the revision before the current one worked differently.",
        "Reaching for MCP for a single tool in a single codebase — a local function is simpler, and the protocol's value is portability you may not need yet.",
      ],
    },
    {
      kind: "remember",
      items: [
        "MCP is an open protocol over JSON-RPC 2.0, inspired by LSP: one tool server instead of one integration per assistant.",
        "Hosts connect; servers offer resources, prompts and tools; clients may offer sampling, roots and elicitation.",
        "tools/list to discover, tools/call to invoke, isError: true for an error the model should read and recover from.",
        "Versions are dates marking backwards-incompatible changes. The current revision at the time of writing is 2026-07-28.",
        "Tool descriptions from an untrusted server are untrusted. Capability lives in your registry and your approval gate, not in somebody else's text.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is MCP and why does it exist?\" — an open protocol so a tool is written once rather than integrated per assistant. The LSP comparison is the spec's own and it lands well.",
        "Naming the untrusted-description rule is a strong signal; most people know MCP as a convenience and have not read the trust section.",
        "Expect to be asked when you would not use it. A single tool in a single codebase is a local function, and the portability is not yet worth the protocol.",
      ],
    },
    {
      kind: "quiz",
      question: "Which features does an MCP *server* offer, according to the specification?",
      options: [
        "Sampling, roots and elicitation",
        "Resources, prompts and tools",
        "Hosts, clients and transports",
        "Only tools",
      ],
      answer: 1,
      why:
        "Servers offer resources (context and data), prompts (templated messages and workflows) and " +
        "tools (functions for the model to execute). Sampling, roots and elicitation are what a *client* " +
        "may offer back to a server.",
    },
    {
      kind: "quiz",
      question: "A community MCP server's tool is described as \"lists your recent files\". What does the specification tell you about that description?",
      options: [
        "It is verified by the protocol before the client sees it, so a false description is rejected before it can reach the model",
        "Descriptions of tool behaviour should be considered untrusted unless obtained from a trusted server",
        "It is only advisory and the model ignores it",
        "It must match the tool's actual behaviour or the call fails",
      ],
      answer: 1,
      why:
        "Nothing in the protocol verifies that a description is true. Since the model chooses what to " +
        "call by reading descriptions, a false one from an untrusted server is a direct route to a call " +
        "you did not intend — which is why consent and the approval gate sit in your code.",
    },
    {
      kind: "quiz",
      question: "What does `\"isError\": true` in a tool result mean the client should do?",
      options: [
        "Retry the call automatically without telling the model",
        "Abort the run, because any tool error means the whole task has failed and nothing can be recovered",
        "Provide the error to the model, so it can self-correct and retry with adjusted parameters",
        "Log it and return the last successful result",
      ],
      answer: 2,
      why:
        "Tool execution errors are meant to carry actionable feedback, and the spec says clients should " +
        "give them to the model for exactly that reason. Protocol errors are a different category and " +
        "are less likely to lead to a successful recovery.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Write the tools/list response your own system would return: names, descriptions, inputSchemas.",
        "For each tool, write the tool execution error it should return when the input is wrong, in the style of the spec's date example.",
        "List the MCP servers you would connect and write down, per server, what data it can see and whether its descriptions are trusted.",
        "Decide which tools may be auto-approved and which need a person. Write the rule as code, not as a note.",
      ],
    },
  ],
};
