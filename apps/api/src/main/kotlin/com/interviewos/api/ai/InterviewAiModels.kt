package com.interviewos.api.ai

import tools.jackson.databind.JsonNode
import java.time.LocalDate

/*
 * Models exchanged with the interview AI. These are the boundary: everything the engine
 * decides (what to ask next, how scores aggregate, whether a session is billable) is
 * pure Kotlin elsewhere and is unit-tested. What lives here is only what Gemini itself
 * produces — resume structure, speech, per-answer judgement, and the report narrative —
 * and it is mocked at this boundary in tests. No test calls a live model (CLAUDE.md).
 */

/**
 * Token usage for a single model call. Per-session cost is what decides pricing.
 *
 * @param promptTokens every input token, of any modality, as the provider counted them
 * @param outputTokens what the model actually said
 * @param thoughtTokens what it spent reasoning before saying it. **Billed at the output
 *   rate and reported separately**, so a reader who takes [outputTokens] as the bill
 *   undercounts. Measured: `gemini-3.5-flash` spent ~1,600 thinking tokens composing a
 *   report whose visible output was ~1,600 — half that call's output bill was invisible.
 * @param audioTokens the part of [promptTokens] carrying sound, priced higher than text
 * @param cachedTokens the part of [promptTokens] served from a context cache, priced far
 *   lower. Zero unless the provider reports it, which it only does once a stable prefix
 *   is long enough to be cached at all.
 */
data class AiUsage(
    val model: String,
    val promptTokens: Int,
    val outputTokens: Int,
    val thoughtTokens: Int = 0,
    val audioTokens: Int = 0,
    val cachedTokens: Int = 0,
    /**
     * Why the provider stopped generating, normalised by [AiFailureReason.normaliseFinishReason]
     * (`stop`, `max_tokens`, `safety`...). Null when the provider did not say. Recorded on the
     * interview ledger, not the spend ledger, and dropped when two usages are added together.
     */
    val finishReason: String? = null,
) {
    /**
     * Input tokens billed at the text rate: whatever is left once the parts with their
     * own price have been taken out. Floored at zero — a provider whose counts do not
     * reconcile must not produce a negative bill.
     */
    val textTokens: Int get() = (promptTokens - audioTokens - cachedTokens).coerceAtLeast(0)

    /** Everything charged at the output rate, thinking included. */
    val billedOutputTokens: Int get() = outputTokens + thoughtTokens

    operator fun plus(other: AiUsage): AiUsage =
        AiUsage(
            model = if (model == other.model) model else "mixed",
            promptTokens = promptTokens + other.promptTokens,
            outputTokens = outputTokens + other.outputTokens,
            thoughtTokens = thoughtTokens + other.thoughtTokens,
            audioTokens = audioTokens + other.audioTokens,
            cachedTokens = cachedTokens + other.cachedTokens,
        )

    companion object {
        fun none(model: String) = AiUsage(model, 0, 0)
    }
}

/** A model result paired with the usage it cost. */
data class AiResult<T>(
    val value: T,
    val usage: AiUsage,
)

/** A resume as uploaded, handed to the parser. */
data class ResumeFile(
    val bytes: ByteArray,
    val contentType: String,
    val filename: String,
)

// ---------------------------------------------------------------------------
// Resume parsing (PRD 05)
// ---------------------------------------------------------------------------

data class ParsedEmployment(
    val employer: String,
    val title: String?,
    val level: String?,
    val startDate: LocalDate?,
    val endDate: LocalDate?,
    val current: Boolean = false,
)

data class ParsedProject(
    val name: String,
    val description: String?,
    val technologies: List<String> = emptyList(),
    val domain: String?,
)

data class ParsedEducation(
    val institution: String,
    val qualification: String?,
    val field: String?,
    val endYear: Int?,
)

/**
 * What the parser extracted. Fields it was unsure of are named in [lowConfidenceFields]
 * rather than silently guessed — a wrong employer degrades every future interview, so
 * uncertainty is surfaced for the candidate to confirm, not hidden (PRD 05).
 */
data class ParsedResume(
    val fullName: String?,
    val headline: String?,
    /** As printed on the resume. Validated before it is stored — the model is not a URL parser. */
    val linkedinUrl: String? = null,
    val employments: List<ParsedEmployment> = emptyList(),
    val projects: List<ParsedProject> = emptyList(),
    val education: List<ParsedEducation> = emptyList(),
    val certifications: List<String> = emptyList(),
    val detectedSkills: List<String> = emptyList(),
    val lowConfidenceFields: List<String> = emptyList(),
)

// ---------------------------------------------------------------------------
// The interview brief and the spoken loop (PRD 06)
// ---------------------------------------------------------------------------

/** Everything the model needs to conduct one session, resolved server-side. */
data class InterviewBrief(
    val company: String,
    val archetype: String,
    val role: String,
    val roundType: String,
    /**
     * The ground this round has to get across, one per line.
     *
     * Here so the interviewer always has somewhere to go next that is not deeper into the
     * last answer. Without it a round narrows to whatever the candidate first mentioned
     * and stays there.
     */
    val roundCovers: String,
    val language: String,
    val candidateFunction: String?,
    val candidateLevel: String?,
    val targetLevel: String?,
    /**
     * The bar this round is run at, in prose the model has to work against rather than a
     * label it can skim past (task 048).
     *
     * Written by the engine from
     * [com.interviewos.api.interview.CandidateStage] — a level alone never calibrated
     * anything, because "0 years of experience" reads to a model as a number rather than
     * as an instruction not to ask a student about production incidents. Empty when the
     * caller has nothing to say about the level, which is how every prompt behaved before
     * this existed.
     */
    val levelCalibration: String = "",
    /** Archetype-level grounding; carries its own provenance so nothing is invented. */
    val grounding: String,
    /**
     * A question from the bank the engine has chosen for this turn, or for the problem or
     * case a workspace round is set on. Null when there is none, which is the common case.
     */
    val plannedQuestion: PlannedQuestion? = null,
    /**
     * What the report model is told about spoken English for this round: the measured
     * timing figures it must stay consistent with, or the instruction to leave the
     * section out (a Hindi-English round). Written by the engine
     * ([com.interviewos.api.interview.SpokenEnglish]); empty for every other prompt.
     */
    val spokenEnglish: String = "",
)

/**
 * A reported question the interviewer is to ask, chosen server-side from the company's own
 * questions in the bank. The model may lead into it and shape it for speech; the engine
 * checks what was said against [text] and decides the provenance.
 */
data class PlannedQuestion(
    val text: String,
    /** The employer it is reported at, as the candidate named it. */
    val company: String,
    /** True when it must be asked on this turn; false when it waits for the next new topic. */
    val askNow: Boolean,
    /**
     * True for a question from the sourced bank. False for one from the AI pool (task 042),
     * which the model is told plainly is general knowledge that no source reports [company]
     * asking — so it has nothing to pass on to the candidate as a report.
     */
    val reported: Boolean = true,
)

/** 24 kHz PCM as Gemini returns it, plus the mime type to store it under. */
data class SpokenAudio(
    val audio: ByteArray,
    val mimeType: String,
)

/**
 * A round drafted from a candidate's own words, plus what had to be assumed to draft it.
 *
 * [company] may be empty, and that is a real answer rather than a failure — the round
 * runs on general patterns and the candidate is told so. A guessed employer would be
 * worse, because it silently changes which loop they practise against.
 */
data class ComposedRound(
    val company: String,
    val role: String,
    val level: String,
    val roundType: String,
    val durationMinutes: Int?,
    val language: String,
    /** One sentence back to the candidate, saying what was taken from what they wrote. */
    val understood: String,
    /** Everything filled in that they did not say, so they can correct it at a glance. */
    val assumptions: List<String>,
    val confidence: String,
    val focusTopic: String? = null,
)

/**
 * The coding problem a DSA round is conducted around, composed once when the round starts.
 *
 * [starterPython] and [starterJava] are **complete runnable programs**, not fragments.
 * They read one case from standard input in the shape [stdinFormat] describes and print
 * only the answer, so a test case can be piped in verbatim and its output compared. That
 * is what makes Run work without us writing a harness per problem — and it is also the
 * part most likely to come back wrong, which is why the round degrades to an editor with
 * no Run rather than failing when it does.
 */
data class ComposedProblem(
    val title: String,
    val topic: String,
    val difficulty: String,
    val statement: String,
    val examples: List<ProblemExample>,
    val constraints: List<String>,
    val starterPython: String,
    val starterJava: String,
    val stdinFormat: String,
    val testCases: List<ProblemTestCase>,
    /**
     * A correct, efficient solution: [starterPython] with the stub filled in.
     *
     * With [bruteForcePython], this is how the expected outputs get checked — see
     * `ProblemVerifier`. Both are cleared before the problem is stored, because the stored
     * problem is sent to the candidate's browser and a solution in the page source is a
     * solution handed over.
     */
    val referencePython: String? = null,
    /** The most obviously correct solution, however slow, written independently of [referencePython]. */
    val bruteForcePython: String? = null,
    /**
     * True when every expected output came from running two independent solutions and
     * getting the same answer, rather than from the model working it out by hand.
     * Set by `ProblemVerifier`, never by the model.
     */
    val testsVerified: Boolean = false,
)

/**
 * What a code sandbox printed, one entry per program the provider actually executed.
 *
 * The output is the sandbox's own stdout, not the model's account of it. A model asked to
 * report what a program prints can get it wrong the same way it gets expected outputs
 * wrong; a sandbox cannot.
 */
data class SandboxRun(
    val outputs: List<String>,
)

data class ProblemExample(
    val input: String,
    val output: String,
    val explanation: String? = null,
)

data class ProblemTestCase(
    val input: String,
    val expected: String,
)

/**
 * The case a system design round is conducted around.
 *
 * [constraints] are the three numbers that force the design's central tension, short
 * enough to sit in a chip on screen. [deepDiveOptions] are for the interviewer and are
 * never shown to the candidate — handing someone the deep dives in advance turns a round
 * that tests scoping into a round that tests reading.
 */
data class ComposedCase(
    val title: String,
    val summary: String,
    val constraints: List<String>,
    val openingPrompt: String,
    val deepDiveOptions: List<String>,
)

data class AskedQuestion(
    val text: String,
    /**
     * Why this question was asked, in the model's own words, captured now rather than
     * reconstructed later. The engine sets the provenance *tier*; the model only
     * describes the pattern it drew on, and is forbidden from citing sources.
     */
    val questionBasis: String? = null,
    val questionProbes: String? = null,
    val questionAskedBecause: String? = null,
)

/**
 * A hint the candidate asked for, and how much of the answer it gave away.
 *
 * [assistanceLevel] maps onto [Intervention], so a requested hint is discounted on the
 * same scale as help the interviewer volunteered.
 */
data class OfferedHint(
    val text: String,
    val assistanceLevel: String,
)

/** The candidate's answer as captured in the browser. */
data class AnswerAudio(
    val bytes: ByteArray,
    val contentType: String,
)

/**
 * Where the round is up to, as the model needs to be told it.
 *
 * The engine decides all of this. A model left to pace itself opens on the hardest
 * question it can think of and never wraps up (CLAUDE.md: interview logic is server-side).
 */
data class RoundContext(
    /** `warm-up`, `main round`, or `closing`. */
    val phase: String,
    val minutesElapsed: Int,
    val minutesRemaining: Int,
    val durationMinutes: Int,
    /**
     * What the warm-up is asking about on this turn, already phrased as an instruction,
     * or null once the round proper has started. The engine owns the opening sequence so
     * that every candidate gets the same one.
     */
    val warmupInstruction: String?,
    /** Set out how the round will run before asking the first substantive question. */
    val briefTheCandidate: Boolean,
    /** The clock has run out. Close the interview off warmly on this turn. */
    val mustConclude: Boolean,
    /** Maximum consecutive probes allowed before the engine requires a new question. */
    val followUpLimit: Int = 2,
    /** The previous thread exhausted its follow-up budget; the next question must change topic. */
    val mustMoveOn: Boolean = false,
)

/** One completed exchange, as the model needs to see the history. */
data class TurnTranscript(
    val questionText: String,
    val answerTranscript: String?,
    /** What the interviewer supplied on this turn, so the report can weigh it. */
    val intervention: Intervention = Intervention.NONE,
    val interventionNote: String? = null,
    /**
     * Warm-up answers are context — who the candidate is, what they have built. They are
     * not evidence of competence and the report must not score them as though they were.
     */
    val warmUp: Boolean = false,
    /** How they came across on this turn, from the video when there was one. */
    val deliveryNote: String? = null,
    /**
     * What a strong answer to this question would cover, when it was asked from the AI
     * question pool (task 042) and that pool row carries `strong_answer_covers`. Given to
     * the report model as reference material for judging the answer and writing a better
     * one — never shown to the candidate as though it were a sourced fact, because the
     * pool question itself is not (`PlannedQuestion.reported`).
     */
    val referencePoints: List<String> = emptyList(),
    val nextAction: String? = null,
)

/**
 * The model's judgement of a single spoken answer: the transcript it heard, a short
 * assessment, and — crucially — what it thinks the interviewer should do next. The
 * engine, not the model, owns the final decision about whether the session may continue
 * (PRD 06: all interview logic is server-side), so [suggestedNextAction] is advisory.
 */
data class AnswerAssessment(
    val transcript: String,
    /*
     * There was a per-turn `summary`, `strengths` and `gaps` here. They were written to
     * the assessment JSON on every turn and read by nothing: the report reasons over the
     * transcript itself, not over these. They cost about 130 output tokens per turn on
     * the one call the candidate sits waiting for, so they are gone.
     */
    val suggestedNextAction: String,
    /** What the interviewer had to supply on this turn. See [Intervention]. */
    val intervention: String = Intervention.NONE.wireValue,
    /** One sentence naming what was supplied, so the report can tell the candidate. */
    val interventionNote: String? = null,
    /**
     * How the candidate came across on this turn through their answer: pace, structure,
     * and composure. Observation only: it never becomes a score on its own.
     */
    val deliveryObservation: String? = null,
    val nextQuestionText: String?,
    /**
     * Why the *next* question is being asked, captured as it is composed. Null on a
     * concluding turn, which has no next question to justify.
     *
     * The engine sets the provenance tier; the model only describes the pattern it drew
     * on and its reasoning about this candidate, and is forbidden from citing sources.
     */
    val questionBasis: String? = null,
    val questionProbes: String? = null,
    val questionAskedBecause: String? = null,
    /**
     * The model's word that [nextQuestionText] asks the planned question. Advisory, like
     * everything else here: the engine checks the text before it believes it.
     */
    val askedPlannedQuestion: Boolean? = null,
)

/**
 * How much the interviewer had to help on a single turn.
 *
 * A real interviewer interrupts rambling, offers a forgotten term, and nudges a
 * candidate who is circling the answer — sitting in silence while someone drowns is
 * neither realistic nor informative. But help received is signal: reaching the answer
 * after two hints is not the same performance as reaching it unaided, and the report
 * says so rather than averaging the difference away.
 */
enum class Intervention(
    val wireValue: String,
    val label: String,
    /**
     * How much this turn's competence should be discounted when the candidate needed
     * this level of help. 1.0 means the answer stands entirely on its own.
     */
    val credit: Double,
) {
    NONE("none", "Answered unaided", 1.0),
    REDIRECTED("redirected", "Needed refocusing", 0.85),
    HINTED("hinted", "Needed a nudge", 0.7),
    GUIDED("guided", "Needed leading", 0.5),
    CORRECTED("corrected", "Was corrected", 0.4),
    ;

    val isAssisted: Boolean get() = this != NONE

    companion object {
        fun parse(value: String?): Intervention = entries.firstOrNull { it.wireValue.equals(value?.trim(), ignoreCase = true) } ?: NONE
    }
}

// ---------------------------------------------------------------------------
// The report (PRD 09)
// ---------------------------------------------------------------------------

/** A competency score, each one anchored to something the candidate actually said. */
data class CompetencyScore(
    val competency: String,
    val score: Int,
    val maxScore: Int,
    val rationale: String,
    /** A quote from the candidate's own transcript. Required — a score without evidence is a badge. */
    val evidenceQuote: String,
    val turnIndex: Int?,
)

data class AnswerAnnotation(
    val turnIndex: Int,
    val question: String,
    val worked: String?,
    val vague: String?,
    val wouldProbe: String?,
    /**
     * How this specific answer could have been stronger — what to lead with, what was
     * missing, how to structure it, and where useful a short example of the stronger
     * version. Required: every answered question gets one, engine-side
     * ([com.interviewos.api.interview.AnswerAnnotations]) fills in an honest placeholder
     * when the model skipped a turn rather than letting the question go without a note.
     */
    val strongerFraming: String,
)

data class CommunicationAnalysis(
    val structure: String,
    val fillerDensity: String,
    val pace: String,
    val rambling: String,
    val handlingUncertainty: String,
    /**
     * How they carried themselves on camera. Null when the candidate declined video —
     * the report says nothing about presence it did not see.
     */
    val presence: String? = null,
)

data class PracticePlanItem(
    val focus: String,
    val why: String,
    val drill: String,
)

data class OutcomeSimulation(
    /** Always rendered as an explicit simulation, never as a verdict. */
    val label: String,
    val likelihood: String,
    val reasoning: String,
)

/** The report narrative Gemini composes. Assembly and quote-checking happen elsewhere. */
data class ReportContent(
    val headline: String,
    val summary: String,
    /**
     * How the candidate did once the interviewer's help is accounted for. Written by the
     * model; the counts it is given are computed from the turns, not guessed.
     */
    val assistedPerformance: String? = null,
    val competencies: List<CompetencyScore>,
    val annotations: List<AnswerAnnotation>,
    val communication: CommunicationAnalysis,
    /**
     * What held up and what did not, each anchored to something the candidate said.
     *
     * Competency scores answer "how well"; these answer "at what, and what do I do about
     * it" — which is the question a candidate actually leaves with. Both carry an
     * evidence quote and both are dropped if that quote is not in the transcript.
     */
    val strengths: List<AssessedArea> = emptyList(),
    val developmentAreas: List<AssessedArea> = emptyList(),
    val practicePlan: List<PracticePlanItem>,
    val recommendedNextSession: String,
    val outcomeSimulation: OutcomeSimulation,
    /**
     * Judgements about the candidate's spoken English, each tied to a quote. Optional:
     * a Hindi-English round has none, and the engine verifies every quote and discards
     * anything that is not about the words (see `SpokenEnglish.verifiedObservations`).
     */
    val spokenEnglish: SpokenEnglishContent? = null,
)

data class SpokenEnglishContent(
    val observations: List<SpokenEnglishObservation> = emptyList(),
)

/**
 * One finding about how the candidate used spoken English — fluency, filler words,
 * grammar, vocabulary, clarity, coherence — with the words that show it. Never about
 * accent or pronunciation: the report model reads a transcript and has heard nothing.
 */
data class SpokenEnglishObservation(
    val aspect: String,
    val finding: String,
    val evidenceQuote: String,
    val turnIndex: Int? = null,
    val suggestion: String,
)

/** One thing the candidate did well or badly, with the words that show it. */
data class AssessedArea(
    val area: String,
    val evidenceQuote: String,
    val turnIndex: Int? = null,
    val whyItMatters: String,
    val whatToDo: String,
)

// ---------------------------------------------------------------------------
// The curated source library (PRD 03, 04)
// ---------------------------------------------------------------------------

/** One document from the source library, as the extractor needs to see it. */
data class SourceDocument(
    val title: String?,
    val publisher: String?,
    val companyName: String?,
    val url: String?,
    /** Plain text. HTML is stripped before it gets here. */
    val content: String,
)

/**
 * What was read out of a source.
 *
 * [askedOn] is null far more often than not, and that is correct: the date is shown to
 * candidates as evidence of how current a question is, so it is only ever taken from
 * something the document actually stated.
 */
data class ExtractedQuestion(
    val questionText: String,
    /**
     * Every employer the document says asked this, as it names them. Empty when it names
     * none — never a group like "FAANG". The engine, not the model, falls back to the
     * source's declared company (see `ReportPlan`).
     */
    val companies: List<String> = emptyList(),
    val roundType: String? = null,
    val seniority: String? = null,
    val roleFamily: String? = null,
    val askedOn: java.time.LocalDate? = null,
    val notes: String? = null,
)

/**
 * One stage of an employer's interview loop, as a document reports it.
 *
 * [evidence] is a verbatim quote of at most about 300 characters. The engine — not the
 * model — checks it actually occurs in the fetched text before this stage is ever
 * written down; a stage whose evidence does not check out is dropped rather than kept
 * with a warning, because a process claim nobody can verify is exactly the fabricated
 * specificity `CLAUDE.md` calls out.
 */
data class ExtractedProcessStage(
    /** Every employer the document says runs this stage. Empty when it names none. */
    val companies: List<String> = emptyList(),
    val roleFamily: String? = null,
    /** Where this stage sits in the loop, if the document makes the order clear. */
    val order: Int? = null,
    /** The stage's name as the document gives it: "Online assessment", "Bar raiser". */
    val stageName: String,
    val format: String? = null,
    val durationMinutes: Int? = null,
    /** What the stage is testing, in the document's own account. */
    val assesses: String? = null,
    /** One of `RoundType`'s db values, or null for a stage we do not simulate. */
    val roundType: String? = null,
    val evidence: String,
)

data class ExtractedQuestions(
    val questions: List<ExtractedQuestion> = emptyList(),
    val processStages: List<ExtractedProcessStage> = emptyList(),
)

// ---------------------------------------------------------------------------
// The loop brief's general pattern (PRD 04, 08) — archetype-level, never given the
// company's name while it is written, so it cannot invent a company-specific detail.
// ---------------------------------------------------------------------------

data class GeneralLoopStage(
    val order: Int,
    val stageName: String,
    val format: String? = null,
    val assesses: String? = null,
    /** One of `RoundType`'s db values, or null for a stage this product does not simulate. */
    val roundType: String? = null,
)

data class GeneralLoopPattern(
    val stages: List<GeneralLoopStage> = emptyList(),
)

// ---------------------------------------------------------------------------
// Public-source research for an employer we hold no sourced account of (task 065).
//
// This is the one model call that is told the company's name and allowed to describe
// it, so it is held to a stricter rule than anything else the model writes: a claim
// survives only if the search grounding ties it to at least one public page. Anything
// the model said from memory, without a page behind it, is dropped before it leaves the
// boundary (`GroundedAnswer`).
// ---------------------------------------------------------------------------

/** A public page the search grounding returned. */
data class GroundedWebSource(
    val title: String,
    val url: String,
)

/** One sentence about the employer's process, and the [GroundedEmployerLoop.sources] behind it. */
data class GroundedClaim(
    val text: String,
    /** Indexes into [GroundedEmployerLoop.sources]; never empty. */
    val sourceIndexes: List<Int>,
)

/**
 * What public sources say about one employer's interview loop.
 *
 * Empty [claims] is a real answer — "the search found nothing we can cite" — and is
 * what the brief's archetype fallback is for.
 */
data class GroundedEmployerLoop(
    val claims: List<GroundedClaim> = emptyList(),
    val sources: List<GroundedWebSource> = emptyList(),
) {
    val isEmpty: Boolean get() = claims.isEmpty()
}

// ---------------------------------------------------------------------------
// The hidden question pool (PRD 03, 04, 08) — task 039.
//
// Two calls, and the order between them is the whole provenance gate. The model is asked
// first whether it genuinely knows an employer's interview process; only then is it asked
// to write questions, and only an answer that claimed real knowledge can license a
// question being labelled as being about that company rather than about its kind.
// ---------------------------------------------------------------------------

/**
 * What the model says it knows about one employer's interview process, asked before any
 * question is written and never in the same call.
 *
 * Separate so the claim can be stored, read back and argued with. A model asked "write
 * Amazon questions and tell me whether they are really Amazon's" will answer the first
 * part fluently and the second to match; asked only the second, with nothing yet invested
 * in an answer, it is far likelier to say no.
 *
 * [knowsProcess] alone does not earn the stronger label — see `PoolAssociationGate`. The
 * named specifics are what the gate weighs, because "yes, I know Amazon's process" with
 * nothing behind it is precisely the failure this exists to catch.
 */
data class EmployerKnowledge(
    val knowsProcess: Boolean = false,
    /** The model's own account of what it knows, stored verbatim on every row it licenses. */
    val basis: String? = null,
    /** Rounds it can name for this employer: "bar raiser", "hiring manager loop". */
    val namedRounds: List<String> = emptyList(),
    /** Values or principles it can name: "Customer Obsession", "Googleyness". */
    val namedValues: List<String> = emptyList(),
    /** Formats it can name: "45-minute phone screen", "take-home", "onsite panel of four". */
    val namedFormats: List<String> = emptyList(),
) {
    /** Whether the answer names anything at all, as opposed to asserting familiarity. */
    val namesSomething: Boolean
        get() = (namedRounds + namedValues + namedFormats).any { it.isNotBlank() }
}

/** One question the model wrote, before anything has decided what it may be labelled. */
data class GeneratedQuestion(
    val text: String = "",
    /** Where the interviewer goes next. Two or three; the schema says so and the database checks it. */
    val followUps: List<String> = emptyList(),
    val strongAnswerCovers: List<String> = emptyList(),
    /**
     * The model's own claim that this question reflects the named employer specifically.
     * A claim, not a decision: `PoolAssociationGate` decides, and the question is *dropped*
     * — not written under a weaker label — whenever the knowledge check did not earn it,
     * because [text] itself was written around the claim and relabelling the row would not
     * remove it.
     */
    val companySpecific: Boolean = false,
    /**
     * Which of [EmployerKnowledge.namedValues] this question is built around, verbatim, or
     * null when it is not a values question. Only ever a name the knowledge check licensed
     * — task 041's behavioural generator checks it against that list and drops the whole
     * question, rather than letting [companySpecific] stand, when it does not match, because
     * a plausible-sounding value the check never named is exactly the fabricated
     * leadership-principle failure CLAUDE.md calls out. Not itself a database column: the
     * check is what stops the fabrication, and the value that survives it is already in
     * [text] and cross-checked against the stored `knowledge_basis`.
     */
    val valueClaimed: String? = null,
    /**
     * Round-type-specific detail a generator wants stored alongside the question — a
     * verified coding problem's test cases, a system-design case's constraints and deep
     * dives. Null for round types with nothing beyond the question itself (task 040).
     * Never set by the model directly: [GeneratedQuestion] is what a provider returns, and
     * only [com.interviewos.api.pool.QuestionGenerator] implementations that build this
     * value themselves (rather than deserialising it from the model) populate it.
     */
    val payload: JsonNode? = null,
)

data class GeneratedQuestions(
    val questions: List<GeneratedQuestion> = emptyList(),
)

/**
 * One cell's worth of work, as the provider sees it.
 *
 * [companyName] is null for an archetype-level cell, and when it is null the company's
 * name never reaches the model at all — the same discipline `composeLoopPattern` keeps. A
 * model that was never told the employer cannot invent a detail about it.
 */
data class PoolQuestionRequest(
    val companyName: String?,
    val archetype: String,
    val roundType: String,
    val roleFamily: String,
    val level: String,
    /** What this round is for, supplied by the generator for its own round type. */
    val roundGuidance: String,
    val count: Int,
    /** Questions already held for this cell, so the model is not asked to repeat itself. */
    val avoid: List<String> = emptyList(),
    /** The knowledge check's answer, or null when there is no named employer to know about. */
    val knowledge: EmployerKnowledge? = null,
)

/**
 * Vectors for a batch of texts, in the order they were given.
 *
 * `FloatArray` rather than `List<Double>`: a 768-dimension vector per question, boxed, is
 * most of a kilobyte of pointers for arithmetic that never needs double precision.
 */
data class TextEmbeddings(
    val vectors: List<FloatArray>,
    val model: String,
)
