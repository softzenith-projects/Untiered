import { chapterWhatIsALanguageModel } from "@/content/courses/ai-agents/01-what-is-a-language-model";
import { chapterTokens } from "@/content/courses/ai-agents/02-tokens";
import { chapterTheContextWindow } from "@/content/courses/ai-agents/03-the-context-window";
import { chapterWhyModelsMakeThingsUp } from "@/content/courses/ai-agents/04-why-models-make-things-up";
import { chapterWhatATransformerIs } from "@/content/courses/ai-agents/05-what-a-transformer-is";
import { chapterAnatomyOfAPrompt } from "@/content/courses/ai-agents/06-anatomy-of-a-prompt";
import { chapterExamplesBeatAdjectives } from "@/content/courses/ai-agents/07-examples-beat-adjectives";
import { chapterChainOfThought } from "@/content/courses/ai-agents/08-chain-of-thought";
import { chapterAskingForStructure } from "@/content/courses/ai-agents/09-asking-for-structure";
import { chapterWhenPromptingStopsWorking } from "@/content/courses/ai-agents/10-when-prompting-stops-working";
import { chapterWhatAToolIs } from "@/content/courses/ai-agents/11-what-a-tool-is";
import { chapterTheReactLoop } from "@/content/courses/ai-agents/12-the-react-loop";
import { chapterWritingAToolDescription } from "@/content/courses/ai-agents/13-writing-a-tool-description";
import { chapterStoppingConditions } from "@/content/courses/ai-agents/14-stopping-conditions";
import { chapterObservationsAndRecovery } from "@/content/courses/ai-agents/15-observations-and-recovery";
import { chapterHowAgenticIsYourSystem } from "@/content/courses/ai-agents/16-how-agentic-is-your-system";
import { chapterTheModelRemembersNothing } from "@/content/courses/ai-agents/17-the-model-remembers-nothing";
import { chapterEmbeddings } from "@/content/courses/ai-agents/18-embeddings";
import { chapterRetrievalAndRag } from "@/content/courses/ai-agents/19-retrieval-and-rag";
import { chapterWhyVectorSearchIsNotMagic } from "@/content/courses/ai-agents/20-why-vector-search-is-not-magic";
import { chapterShortAndLongTermMemory } from "@/content/courses/ai-agents/21-short-and-long-term-memory";
import { chapterPromptChaining } from "@/content/courses/ai-agents/22-prompt-chaining";
import { chapterRouting } from "@/content/courses/ai-agents/23-routing";
import { chapterParallelisation } from "@/content/courses/ai-agents/24-parallelisation";
import { chapterOrchestratorWorkers } from "@/content/courses/ai-agents/25-orchestrator-workers";
import { chapterEvaluatorOptimiser } from "@/content/courses/ai-agents/26-evaluator-optimiser";
import { chapterMultiAgentAndHandoffs } from "@/content/courses/ai-agents/27-multi-agent-and-handoffs";
import { chapterTheModelContextProtocol } from "@/content/courses/ai-agents/28-the-model-context-protocol";
import { chapterTheFrameworks } from "@/content/courses/ai-agents/29-the-frameworks";
import { chapterEvaluatingAnAgent } from "@/content/courses/ai-agents/30-evaluating-an-agent";
import { chapterCostAndLatency } from "@/content/courses/ai-agents/31-cost-and-latency";
import { chapterPromptInjectionAndSecurity } from "@/content/courses/ai-agents/32-prompt-injection-and-security";
import { chapterWhatGoesWrongInProduction } from "@/content/courses/ai-agents/33-what-goes-wrong-in-production";
import type { Course } from "@/content/courses/types";

/**
 * AI and Agentic AI (task 057). The third course, alongside `java` and `dsa`, and the
 * first whose code is Python — hence `codeLanguage`.
 *
 * Every non-obvious claim in this course is grounded in an openly published source, named
 * in the chapter that uses it: the ReAct paper (arXiv:2210.03629), Anthropic's *Building
 * Effective Agents*, the Model Context Protocol specification, chain-of-thought prompting
 * (arXiv:2201.11903), RAG (arXiv:2005.11401), *Attention Is All You Need*
 * (arXiv:1706.03762), *Lost in the Middle* (arXiv:2307.03172), *Why Language Models
 * Hallucinate* (arXiv:2509.04664), the OWASP Top 10 for LLM Applications, and the open
 * documentation of LangGraph, the OpenAI Agents SDK and smolagents. CLAUDE.md holds a
 * claim about a named framework or model to the same bar as a claim about a named
 * employer: sourced, or not made. Where the text describes a general pattern rather than a
 * specific system, it says so.
 *
 * The agent lab (module 3) is a **scripted local simulation** and says so on its face. No
 * chapter in this course, and no code path it reaches, calls a model — CLAUDE.md rule 7.
 */
export const aiAgentsCourse: Course = {
  slug: "ai-agents",
  title: "AI and Agentic AI",
  seoTitle: "AI and Agentic AI Course for Beginners",
  seoDescription: "From what a language model is to an agent you assemble and run yourself, in plain language. No machine learning background needed.",
  tagline:
    "From \"what is a language model\" to an agent you assemble and run yourself — in plain language, " +
    "grounded in the papers and specs, with nothing invented.",
  level: "Beginner — no machine learning background, and no programming needed for the first module",
  codeLanguage: "python",
  modules: [
    {
      title: "What these models actually are",
      chapters: [
        chapterWhatIsALanguageModel,
        chapterTokens,
        chapterTheContextWindow,
        chapterWhyModelsMakeThingsUp,
        chapterWhatATransformerIs,
      ],
    },
    {
      title: "Talking to a model",
      chapters: [
        chapterAnatomyOfAPrompt,
        chapterExamplesBeatAdjectives,
        chapterChainOfThought,
        chapterAskingForStructure,
        chapterWhenPromptingStopsWorking,
      ],
    },
    {
      title: "From a model to an agent",
      chapters: [
        chapterWhatAToolIs,
        chapterTheReactLoop,
        chapterWritingAToolDescription,
        chapterStoppingConditions,
        chapterObservationsAndRecovery,
        chapterHowAgenticIsYourSystem,
      ],
    },
    {
      title: "Giving an agent a memory",
      chapters: [
        chapterTheModelRemembersNothing,
        chapterEmbeddings,
        chapterRetrievalAndRag,
        chapterWhyVectorSearchIsNotMagic,
        chapterShortAndLongTermMemory,
      ],
    },
    {
      title: "More than one call",
      chapters: [
        chapterPromptChaining,
        chapterRouting,
        chapterParallelisation,
        chapterOrchestratorWorkers,
        chapterEvaluatorOptimiser,
        chapterMultiAgentAndHandoffs,
      ],
    },
    {
      title: "Making it real",
      chapters: [
        chapterTheModelContextProtocol,
        chapterTheFrameworks,
        chapterEvaluatingAnAgent,
        chapterCostAndLatency,
        chapterPromptInjectionAndSecurity,
        chapterWhatGoesWrongInProduction,
      ],
    },
  ],
};
