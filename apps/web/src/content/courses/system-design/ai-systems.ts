import type { ChapterSource } from "@/content/courses/system-design/lesson";
import { legacyDetails } from "@/content/courses/system-design/legacy-details";

export const aiSystems: ChapterSource[] = [
  {
    slug: "ai-request-path", title: "The AI Request Path", summary: "Place a model behind a controlled gateway with context, streaming and fallbacks.",
    ...legacyDetails("ai-request-path"),
    analogy: ["A translator behind a reception desk", "The receptionist checks the request, gathers documents, chooses the translator and records the result instead of letting every visitor enter directly."],
    idea: "An AI request path authenticates the user, applies policy, assembles context, selects a model, calls it, streams or validates output and records safe telemetry. Keep provider details behind an adapter.",
    flow: ["AI gateway", "context and model", "validated response"], best: "Centralise model access so policy, budgets, fallbacks and observability apply consistently.", check: "Check timeouts, streaming cancellation, provider errors and sensitive prompt data.", pitfall: "Calling model providers directly from every client and duplicating policy logic.", interview: "Trace one AI request and name what remains deterministic around the probabilistic call.",
  },
  {
    slug: "tokens-context-cost-and-capacity", title: "Tokens, Context, Cost and Capacity", summary: "Budget input, output, latency and spend before the prompt reaches a model.",
    ...legacyDetails("tokens-context-cost-and-capacity"),
    analogy: ["A suitcase with weight and airline fees", "More items may help the trip, but the suitcase has a hard limit and every extra kilogram costs time and money."],
    idea: "Model work grows with input and generated tokens. Context windows are finite and useful information can be buried. Enforce per-request and per-tenant budgets; summarise or retrieve instead of attaching everything.",
    flow: ["token estimate", "budget decision", "bounded generation"], best: "Set input, output, latency and cost budgets per request type.", check: "Check worst-case context, concurrent demand, cancellation and unit economics.", pitfall: "Sending entire histories and documents because they fit inside the advertised context limit.", interview: "Estimate peak tokens per minute and describe what degrades when the budget is reached.",
  },
  {
    slug: "embeddings-vector-search-and-rag", title: "Embeddings, Vector Search and RAG", summary: "Retrieve small, relevant evidence before asking a model to answer.",
    ...legacyDetails("embeddings-vector-search-and-rag"),
    analogy: ["Give an open-book student the right pages", "The student answers better with three relevant pages than with a trolley of every book in the library."],
    idea: "Chunk source documents, create embeddings, retrieve candidates, optionally rerank, and place cited evidence in the prompt. Access control must filter retrieval. Evaluate retrieval separately from answer generation.",
    flow: ["chunk and index", "retrieve evidence", "grounded answer"], best: "Measure whether retrieval found the answer-bearing chunk before judging model prose.", check: "Check chunk boundaries, freshness, permissions, citations and no-answer behaviour.", pitfall: "Calling vector similarity truth and skipping access filters or source citations.", interview: "Separate ingestion and query paths, then diagnose retrieval misses versus generation mistakes.",
    lab: "rag-assistant",
  },
  {
    slug: "model-routing-batching-and-caching", title: "Model Routing, Batching and Caching", summary: "Match request difficulty to capability while protecting latency and quality.",
    ...legacyDetails("model-routing-batching-and-caching"),
    analogy: ["Send each parcel by the right service", "A local envelope does not need an international express courier. Valuable urgent parcels may justify the expensive route."],
    idea: "A router selects a model from task, risk and budget. Batching raises throughput for delay-tolerant work. Exact or semantic caches can avoid repeated calls but need privacy boundaries and freshness rules.",
    flow: ["classify request", "route or batch", "cache safe result"], best: "Route from measured task quality and cost, with a safe fallback when classification is uncertain.", check: "Check cache tenant isolation, batch delay, route accuracy and provider capacity.", pitfall: "Routing by prompt length alone or sharing cached private outputs across users.", interview: "Define a routing policy and the offline evaluation that earns permission to use a cheaper model.",
  },
  {
    slug: "ai-evaluation-and-tracing", title: "Evaluation, Tracing and Feedback", summary: "Measure task success with representative cases instead of judging a demo.",
    ...legacyDetails("ai-evaluation-and-tracing"),
    analogy: ["A driving test with a route sheet", "One smooth trip proves little. A fair test repeats hills, traffic and parking with recorded criteria."],
    idea: "Build a versioned evaluation set from real task categories, including failures and safety cases. Record prompt, retrieved evidence, tool events and outputs with privacy controls. Combine deterministic checks, expert review and user outcomes.",
    flow: ["representative cases", "trace each stage", "score and compare"], best: "Gate changes on a versioned evaluation set split by task and risk category.", check: "Check leakage, subjective rubrics, regressions by segment and feedback bias.", pitfall: "Using thumbs-up rate alone or changing prompts after looking at the test answers.", interview: "Explain how you isolate retrieval, tool and generation quality in one trace.",
  },
  {
    slug: "agent-anatomy", title: "Agent Anatomy: Model, Tools and State", summary: "Turn a model call into a bounded system that can observe and act.",
    ...legacyDetails("agent-anatomy"),
    analogy: ["A trainee with a manual and locked toolbox", "The trainee reads instructions, chooses an allowed tool, observes the result and stops when the job is complete. Access is limited, not assumed."],
    idea: "An agent combines a model with instructions, typed tools, state and a loop. The runtime validates tool arguments, enforces permissions, records observations and applies step and cost limits.",
    flow: ["decide next step", "validated tool call", "observation and stop"], best: "Keep the runtime deterministic around model choices: validate, authorise, limit and log every action.", check: "Check tool scopes, argument validation, loop limits and recovery after partial side effects.", pitfall: "Giving the model broad credentials and trusting prompt text as the security boundary.", interview: "Draw the agent loop and mark exactly where untrusted model output becomes a real action.",
    lab: "tool-using-agent",
  },
  {
    slug: "agent-workflow-patterns", title: "Agent Workflow Patterns", summary: "Choose sequential, routed, parallel or planner-worker flows only when they fit.",
    ...legacyDetails("agent-workflow-patterns"),
    analogy: ["Organise a school project", "Some tasks follow a checklist, some split among classmates, and some need a coordinator. Adding classmates to a one-page task only adds meetings."],
    idea: "Sequential chains suit ordered transformations. Routers choose specialised paths. Parallel workers suit independent subtasks. Planner-worker flows adapt but add latency, cost and harder evaluation. Start with the least agentic pattern that works.",
    flow: ["classify dependency", "choose workflow", "join and verify"], best: "Use deterministic workflows where the path is known; add planning only for genuine uncertainty.", check: "Check dependency order, fan-out limits, shared state and merge conflicts.", pitfall: "Using multiple agents because the architecture sounds advanced rather than because tasks are independent.", interview: "Compare a fixed workflow and a planner for the same task across reliability, cost and debuggability.",
    artifact: {
      kind: "table",
      head: ["Pattern", "Use it when", "Main cost"],
      rows: [
        ["Sequential", "Every step depends on the previous one", "A slow stage delays the whole chain"],
        ["Parallel", "Subtasks are independent", "Fan-out and merge need bounds"],
        ["Planner-worker", "The route cannot be known in advance", "Higher cost and harder evaluation"],
      ],
    },
  },
  {
    slug: "agent-memory-safety-and-recovery", title: "Agent Memory, Approval and Recovery", summary: "Store only useful state and put humans around irreversible actions.",
    ...legacyDetails("agent-memory-safety-and-recovery"),
    analogy: ["A workshop job card", "The card records approved work and completed steps. A mechanic still asks before replacing an expensive part and can resume after a break."],
    idea: "Separate conversation context, durable user facts and task checkpoints. Give each a schema, retention period and owner controls. Require approval before high-impact tools. Use idempotency and compensation for resumable workflows.",
    flow: ["load scoped state", "approve risky action", "checkpoint or compensate"], best: "Persist minimal typed state with provenance, expiry and a user-visible way to correct or delete it.", check: "Check consent, stale memory, approval binding, duplicate actions and resumability.", pitfall: "Saving every conversation forever and treating generated summaries as verified user facts.", interview: "Design a crash-safe tool workflow and identify the actions that always need human confirmation.",
  },
];
