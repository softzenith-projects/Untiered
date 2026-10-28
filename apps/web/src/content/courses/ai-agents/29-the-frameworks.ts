import type { Chapter } from "@/content/courses/types";

export const chapterTheFrameworks: Chapter = {
  slug: "the-frameworks",
  title: "The Frameworks, Described Accurately",
  summary:
    "Four open frameworks, each described from its own documentation: what its central abstraction is, " +
    "what it does for you, and what it does not. Then the question of whether you need one.",
  minutes: 16,
  blocks: [
    {
      kind: "p",
      text:
        "You have written the loop by hand, so you now know exactly what a framework would be doing on " +
        "your behalf — and that is the right order. This chapter describes four open frameworks from " +
        "their own documentation, because the comparison tables that circulate are mostly written by " +
        "people who used one of them. **Every claim below is from the project's own published docs, and " +
        "they are stated in the project's own terms rather than translated into a common vocabulary " +
        "that would flatten the actual differences.**",
    },
    { kind: "h", text: "The picture: buying a bicycle or buying the parts" },
    {
      kind: "analogy",
      title: "You still need to know how the gears work",
      text:
        "You can build a bicycle from parts or buy one assembled. The assembled one gets you riding " +
        "today, and it has made decisions for you — gear ratios, frame geometry, tyre width — that suit " +
        "most people most of the time. Build it yourself and every decision is yours, which is better " +
        "if you have unusual requirements and worse if you do not, and it takes a fortnight. The " +
        "genuinely important point is that either way you need to understand gears, because on a hill " +
        "the shop cannot help you. Where the analogy stops: a bicycle you did not build still works the " +
        "same way. A framework you do not understand fails in ways you cannot diagnose, because the loop " +
        "is somewhere inside it and the trace is the only evidence you have.",
    },
    { kind: "h", text: "LangGraph" },
    {
      kind: "p",
      text:
        "LangGraph's central abstraction is a **graph**, and its documentation is precise about the " +
        "pieces. The `StateGraph` is \"the main graph class to use\", parameterised by a user-defined " +
        "State object. The State is \"a shared data structure that represents the current snapshot of " +
        "your application\". Nodes are \"functions that encode the logic of your agents\" — they receive " +
        "the current state, do something, and return an updated state. Normal edges connect A to B " +
        "always; conditional edges route to one or more edges, or terminate, based on a function. " +
        "`START` and `END` are special virtual nodes marking entry and exit. Compiling \"provides a few " +
        "basic checks on the structure of your graph (no orphaned nodes, etc)\" and is where you supply " +
        "runtime arguments like checkpointers and breakpoints.",
    },
    {
      kind: "code",
      caption: "The minimal LangGraph example from its own documentation. It is not run here — this course installs nothing and calls no model.",
      code:
        "from langgraph.graph import StateGraph, START, END\n" +
        "from typing_extensions import TypedDict\n" +
        "\n" +
        "\n" +
        "class State(TypedDict):\n" +
        "    value: int\n" +
        "\n" +
        "\n" +
        "builder = StateGraph(State)\n" +
        'builder.add_node("increment", lambda s: {"value": s["value"] + 1})\n' +
        'builder.add_edge(START, "increment")\n' +
        'builder.add_edge("increment", END)\n' +
        "\n" +
        "graph = builder.compile()\n",
    },
    {
      kind: "concept",
      title: "Reducers",
      text:
        "The LangGraph idea most worth borrowing even if you never use it. Each state key has a reducer " +
        "deciding how a node's update is applied: \"if no reducer function is explicitly specified then " +
        "it is assumed that all updates to that key should override it\". Specify one — `operator.add`, " +
        "say — and updates append instead. Reducers are what make parallel writes well-defined: two " +
        "concurrent nodes updating the same key with no reducer is an error, because the framework " +
        "refuses to guess which write wins.",
    },
    { kind: "h", text: "The OpenAI Agents SDK" },
    {
      kind: "p",
      text:
        "Its README describes it as \"a lightweight yet powerful framework for building multi-agent " +
        "workflows\", under the MIT licence, and states that it is \"provider-agnostic, supporting the " +
        "OpenAI Responses and Chat Completions APIs, as well as 100+ other LLMs\" — worth knowing, " +
        "because the name suggests otherwise. Its primitives are **Agents** (LLMs with instructions and " +
        "tools), **Handoffs** (agents delegating to other agents), **Guardrails** (validation of inputs " +
        "and outputs), **Sessions** (a persistent memory layer for working context) and **Tracing** " +
        "(built-in visualisation and debugging of agentic flows), alongside tools, human-in-the-loop, " +
        "and realtime and voice agents.",
    },
    {
      kind: "p",
      text:
        "Its documented runner loop is the clearest published description of the shape you built by " +
        "hand in chapter 12: each iteration calls the LLM for the current agent with the current input; " +
        "if the output is classified as final, the loop ends and the result is returned; if the LLM " +
        "requests a handoff, the current agent and input are updated and the loop re-runs; if it " +
        "produces tool calls, those are run, the results appended, and the loop re-runs. Output is " +
        "considered final when it \"produces text output with the desired type, and there are no tool " +
        "calls\". Exceed `max_turns` and it raises `MaxTurnsExceeded`.",
    },
    { kind: "h", text: "smolagents" },
    {
      kind: "p",
      text:
        "smolagents is the smallest of the four and the most opinionated, and its conceptual guide is " +
        "the one this course has leaned on most — the agency spectrum in chapter 16 is its table. Its " +
        "distinctive position is **code agents**: rather than writing actions as JSON of tool names and " +
        "arguments, the model writes them as code. The documentation argues this is more natural " +
        "because \"we crafted our code languages specifically to express the actions performed by a " +
        "computer\", and cites research to that effect — including *Executable Code Actions Elicit " +
        "Better LLM Agents*. The advantages it lists are composability (you can nest and reuse " +
        "functions in a way you cannot nest JSON actions), object management (where would you put the " +
        "output of `generate_image` in JSON?), generality, and representation in training data, since " +
        "models have seen a great deal of good code.",
    },
    {
      kind: "p",
      text:
        "It is also refreshingly direct about when not to use it: for low-level cases like chains and " +
        "routers, \"you can write all the code yourself. You'll be much better that way, since it will " +
        "let you control and understand your system better.\" Its list of what a framework must supply " +
        "once you go beyond that is a good specification for anything you build yourself — an engine, a " +
        "tool list, a system prompt describing the loop and the call format, a parser for the model's " +
        "output, a memory, and error logging and retries.",
    },
    { kind: "h", text: "CrewAI" },
    {
      kind: "p",
      text:
        "CrewAI describes itself as \"the leading open-source framework for orchestrating autonomous AI " +
        "agents and building complex workflows\". Its two layers are **Flows** and **Crews**. A Flow is " +
        "the foundational layer, handling state management, event-driven execution and control flow " +
        "logic — its docs say to \"think of a Flow as the 'manager' or the 'process definition' of your " +
        "application\". Crews are \"the 'teams' that do the heavy lifting\": groups of specialised " +
        "agents working autonomously, which a Flow can trigger for a complex problem. The recommended " +
        "approach in its documentation is to start with a Flow for the overall structure and deploy " +
        "Crews within flow steps where a task needs agent autonomy.",
    },
    {
      kind: "p",
      text:
        "That recommendation is, in different words, the whole of module 5: define the predictable " +
        "structure in code, and spend autonomy only where the structure cannot be predicted. It is " +
        "quietly the most useful sentence in CrewAI's introduction.",
    },
    {
      kind: "table",
      head: ["Framework", "Central abstraction", "Described in its own docs as"],
      rows: [
        [
          "LangGraph",
          "A graph: StateGraph, nodes, edges, reducers, checkpointers",
          "State as \"a shared data structure that represents the current snapshot of your application\"; nodes as functions that take state and return an updated state.",
        ],
        [
          "OpenAI Agents SDK",
          "Agents with handoffs, guardrails, sessions and tracing",
          "\"A lightweight yet powerful framework for building multi-agent workflows\"; MIT licensed; provider-agnostic across 100+ LLMs.",
        ],
        [
          "smolagents",
          "A multi-step agent that writes its actions as code",
          "\"AI agents are programs where LLM outputs control the workflow\"; agency as a continuous spectrum, not a category.",
        ],
        [
          "CrewAI",
          "Flows (the process definition) containing Crews (teams of agents)",
          "\"The leading open-source framework for orchestrating autonomous AI agents and building complex workflows.\"",
        ],
      ],
    },
    { kind: "h", text: "Do you need one?" },
    {
      kind: "compare",
      title: "Framework or your own loop",
      columns: [
        {
          label: "Take a framework",
          items: [
            "Persistence, retries and resumption you would otherwise write and get subtly wrong",
            "Tracing you can actually read when a ten-step run goes wrong",
            "A shape other people on your team already recognise",
            "Streaming, interrupts and human-in-the-loop, which are fiddly to build well",
          ],
        },
        {
          label: "Write the loop",
          items: [
            "For a chain or a router — smolagents' own docs say you will understand your system better",
            "When you need to see exactly what is in the context on every turn",
            "When a dependency is a real cost: version churn in this area is fast",
            "When the framework's abstraction and your problem are not the same shape, and you are fighting it",
          ],
        },
      ],
    },
    {
      kind: "playground",
      language: "python",
      prompt:
        "Answer these for a system you want to build. Three or more \"yes\" answers is the honest case for a framework; fewer, and you are buying a dependency for a while loop.",
      starter:
        "questions = {\n" +
        '    "Does a run need to survive a process restart?": False,\n' +
        '    "Does a human approve a step partway through?": False,\n' +
        '    "Are there more than ~5 steps in a typical run?": False,\n' +
        '    "Do several agents hand work to each other?": False,\n' +
        '    "Do you need a readable trace to debug production?": True,\n' +
        '    "Will more than one team work on this?": False,\n' +
        "}\n" +
        "\n" +
        "yes = sum(1 for v in questions.values() if v)\n" +
        "for q, v in questions.items():\n" +
        '    print(f"  [{\'x\' if v else \' \'}] {q}")\n' +
        "\n" +
        'print(f"\\n{yes} of {len(questions)}")\n' +
        "if yes >= 3:\n" +
        '    print("A framework is probably earning its place.")\n' +
        "elif yes >= 1:\n" +
        '    print("Borderline. Write the loop; add the one missing piece yourself.")\n' +
        "else:\n" +
        '    print("Write the loop. It is about forty lines and you will understand it.")\n',
      expectedOutput:
        "  [ ] Does a run need to survive a process restart?\n" +
        "  [ ] Does a human approve a step partway through?\n" +
        "  [ ] Are there more than ~5 steps in a typical run?\n" +
        "  [ ] Do several agents hand work to each other?\n" +
        "  [x] Do you need a readable trace to debug production?\n" +
        "  [ ] Will more than one team work on this?\n" +
        "\n" +
        "1 of 6\n" +
        "Borderline. Write the loop; add the one missing piece yourself.",
    },
    {
      kind: "pitfall",
      items: [
        "Choosing a framework before understanding the loop — when it fails you will be debugging somebody else's abstraction with no model of what it was doing.",
        "Assuming the OpenAI Agents SDK only works with OpenAI models — its own README says it is provider-agnostic across 100+ LLMs.",
        "Repeating a comparison table you did not check — this area moves fast enough that a six-month-old comparison is often wrong about at least one project.",
        "Taking a framework for a chain or a router — smolagents' own documentation says you will be better off writing that code yourself.",
        "Fighting the abstraction — if your problem is not the shape of the framework's central idea, every feature becomes a workaround.",
        "Forgetting you still own the limits — `max_turns`, fan-out caps and write budgets are your numbers, whoever runs the loop.",
      ],
    },
    {
      kind: "remember",
      items: [
        "LangGraph: a graph of nodes over a shared State, with reducers deciding how updates merge and checkpointers persisting per thread.",
        "OpenAI Agents SDK: agents, handoffs, guardrails, sessions, tracing. MIT licensed and provider-agnostic across 100+ LLMs.",
        "smolagents: a small multi-step agent that writes its actions as code, and a documented view of agency as a spectrum.",
        "CrewAI: Flows as the process definition, Crews as the teams triggered within them.",
        "The loop is about forty lines. Take a framework for persistence, tracing, human-in-the-loop and team familiarity — not to avoid writing it.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Which agent framework would you use?\" is really \"do you know what they do?\". Naming each one's central abstraction beats having a favourite.",
        "Saying you would write the loop first, then adopt a framework for a named reason, is a stronger answer than either extreme.",
        "Reducers and checkpointers are good specifics to have ready — they are the parts a hand-rolled loop most often gets wrong.",
      ],
    },
    {
      kind: "quiz",
      question: "In LangGraph, what happens to a state key with no reducer specified?",
      options: [
        "Updates are appended to the existing value",
        "Updates override the existing value",
        "Updates are rejected",
        "The key is read-only",
      ],
      answer: 1,
      why:
        "The docs say that if no reducer is specified, all updates to that key are assumed to override " +
        "it. A reducer such as `operator.add` is how you get appending instead — and it is what makes " +
        "concurrent writes to one key well-defined rather than an error.",
    },
    {
      kind: "quiz",
      question: "When does the OpenAI Agents SDK's runner consider an output final?",
      options: [
        "When the model stops producing tokens, whether or not it has requested any tool or handoff",
        "When it produces text output with the desired type and there are no tool calls",
        "After `max_turns` iterations",
        "When a guardrail passes",
      ],
      answer: 1,
      why:
        "That is the documented condition. Tool calls or a handoff mean the loop runs again; exceeding " +
        "`max_turns` raises `MaxTurnsExceeded`, which is a failure rather than a finish.",
    },
    {
      kind: "quiz",
      question: "What is smolagents' documented argument for writing actions as code rather than JSON?",
      options: [
        "Code is shorter than JSON",
        "JSON cannot express function calls at all, so code is the only way to tell a model which tool to use next",
        "JSON cannot express function calls",
        "Code runs faster",
      ],
      answer: 1,
      why:
        "Those four — composability, object management, generality and representation in training data — " +
        "are exactly the advantages its documentation lists, citing *Executable Code Actions Elicit " +
        "Better LLM Agents* among others.",
    },
    { kind: "h", text: "Try this yourself" },
    {
      kind: "list",
      ordered: true,
      items: [
        "Answer the six questions in the playground for something you actually want to build, and act on the result.",
        "Read the \"concepts\" page of one framework's own documentation and write down its central abstraction in one sentence.",
        "Take the forty-line loop from chapter 12 and add the one thing your project needs — persistence, or a trace log. Then decide if you still want a framework.",
        "Find a framework comparison online and check three of its claims against the projects' own documentation.",
      ],
    },
  ],
};
