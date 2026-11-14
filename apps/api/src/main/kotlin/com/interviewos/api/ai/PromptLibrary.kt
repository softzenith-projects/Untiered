package com.interviewos.api.ai

import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * The prompts and response schemas, built once and shared by every provider.
 *
 * These used to be private to the Gemini adapter. Once a second provider existed that
 * was the wrong place for them: a fallback that asks a subtly different question is not
 * a fallback, it is a second product with worse copy. Every provider now composes the
 * identical prompt from the identical files, and only the transport differs.
 *
 * Prompts and schemas live in `src/main/resources/ai/` so they are reviewable in version
 * control rather than buried in string literals.
 */
@Component
class PromptLibrary(
    private val objectMapper: ObjectMapper,
) {
    fun composeRound(query: String): String = loadPrompt("compose-round").replace("{{query}}", query)

    fun composeProblem(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): String = fillBrief(loadPrompt("compose-problem"), brief).replace("{{durationMinutes}}", durationMinutes.toString())

    fun composeCase(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): String = fillBrief(loadPrompt("compose-case"), brief).replace("{{durationMinutes}}", durationMinutes.toString())

    fun openingQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): String = fillRound(fillBrief(loadPrompt("opening-question"), brief), round)

    fun assessAnswer(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): String =
        fillRound(fillBrief(loadPrompt(round.variant.resource), brief), round, clockFree = round.variant != AssessmentVariant.LEGACY)
            .replace("{{currentQuestion}}", currentQuestion)
            .replace("{{history}}", historyOf(priorTurns).ifBlank { "(this is the first answer)" })

    fun offerHint(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): String =
        fillRound(fillBrief(loadPrompt("offer-hint"), brief), round)
            .replace("{{currentQuestion}}", currentQuestion)
            .replace("{{history}}", historyOf(priorTurns).ifBlank { "(nothing yet - this is the first question)" })

    fun extractQuestions(source: SourceDocument): String =
        loadPrompt("extract-questions")
            .replace("{{title}}", source.title ?: "(not given)")
            .replace("{{publisher}}", source.publisher ?: "(not given)")
            .replace("{{company}}", source.companyName ?: "(not given)")
            .replace("{{url}}", source.url ?: "(uploaded document)")
            .replace("{{content}}", source.content)

    /**
     * The question the model is asked *before* it writes anything about an employer.
     *
     * The company's name is in this prompt and nothing else is: no round, no role, no
     * request for questions. Asked cold like this, with nothing already written to be
     * consistent with, a model says "no, I only know the general pattern" far more often
     * than it does when the same question rides along with the work.
     */
    fun employerKnowledge(
        companyName: String,
        archetype: String,
    ): String =
        loadPrompt("employer-knowledge")
            .replace("{{company}}", companyName)
            .replace("{{archetype}}", archetype)

    /**
     * One cell of the question pool.
     *
     * When [PoolQuestionRequest.companyName] is null the employer's name never enters the
     * prompt — it reads "an employer of this kind" — for the same reason
     * [loopPattern] never sees it: a model that was not told the company cannot invent a
     * detail about it, however fluently it could have.
     */
    fun poolQuestions(request: PoolQuestionRequest): String =
        loadPrompt("pool-questions")
            .replace("{{company}}", request.companyName ?: "(not given — write for the kind of employer below)")
            .replace("{{archetype}}", request.archetype)
            .replace("{{roundType}}", request.roundType)
            .replace("{{roleFamily}}", request.roleFamily)
            .replace("{{level}}", request.level)
            .replace("{{roundGuidance}}", request.roundGuidance)
            .replace("{{count}}", request.count.toString())
            .replace("{{knowledge}}", knowledgeOf(request))
            .replace(
                "{{avoid}}",
                request.avoid
                    .takeIf { it.isNotEmpty() }
                    ?.joinToString("\n") { "- $it" }
                    ?: "(nothing yet — this is the first batch for this slot)",
            )

    /**
     * How the knowledge check's answer is put in front of the generator.
     *
     * Written as prose the model has to work against rather than as a flag it can skim
     * past, and the "you do not know" case is stated in the strongest terms available,
     * because that is the case that covers most employers and the one where a fabricated
     * specific would do the damage.
     */
    private fun knowledgeOf(request: PoolQuestionRequest): String {
        val knowledge = request.knowledge
        if (request.companyName == null) {
            return "You have not been told which employer this is. Write for the kind of employer above."
        }
        if (knowledge == null || !knowledge.knowsProcess) {
            return "You were asked separately whether you know this employer's interview process, and you said " +
                "you do not. So you do not. Write for the kind of employer above, and do not name this company " +
                "or any of its products, teams or values in a question."
        }
        val named =
            listOfNotNull(
                namedLine("Rounds you named", knowledge.namedRounds),
                namedLine("Values or principles you named", knowledge.namedValues),
                namedLine("Formats you named", knowledge.namedFormats),
            )
        val stated = knowledge.basis.orEmpty().trim()
        val basis = stated.ifBlank { "(no detail given)" }
        return buildString {
            append("You were asked separately whether you know this employer's interview process, and you said ")
            append("you do. This is what you said:\n\n")
            append(basis)
            if (named.isNotEmpty()) {
                append("\n\n")
                append(named.joinToString("\n") { "- $it" })
            }
            append("\n\nThat list is the whole of what you may treat as known about this employer. Anything not ")
            append("on it is a general pattern, not a fact about them.")
        }
    }

    /** One line of what the model said it could name, or null when it named nothing. */
    private fun namedLine(
        label: String,
        values: List<String>,
    ): String? {
        val kept = values.filter { it.isNotBlank() }
        return if (kept.isEmpty()) null else "$label: ${kept.joinToString("; ")}"
    }

    fun loopPattern(
        archetype: String,
        roleFamily: String,
        level: String,
    ): String =
        loadPrompt("general-loop-pattern")
            .replace("{{archetype}}", archetype)
            .replace("{{roleFamily}}", roleFamily)
            .replace("{{level}}", level)

    /**
     * The one prompt that asks about a named employer *and* lets the model describe it —
     * which is safe only because it is sent with search grounding on, and only the
     * sentences the grounding ties to a page survive (`GroundedAnswer`).
     */
    fun publicEmployerLoop(
        companyName: String,
        roleFamily: String,
        level: String,
    ): String =
        loadPrompt("public-employer-loop")
            .replace("{{company}}", companyName)
            .replace("{{roleFamily}}", roleFamily)
            .replace("{{level}}", level)

    fun report(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): String =
        fillBrief(loadPrompt("report"), brief)
            .replace("{{transcript}}", transcriptOf(transcript))
            .replace("{{assistance}}", assistanceContext(transcript))
            .replace("{{spokenEnglish}}", brief.spokenEnglish.ifBlank { "(no spoken-English figures for this round)" })

    fun resumeParse(): String = loadPrompt("resume-parse")

    fun schema(name: String): JsonNode = objectMapper.readTree(readResource("ai/schemas/$name.json"))

    /** The same schema as text, for providers that take it in the prompt rather than as a field. */
    fun schemaText(name: String): String = readResource("ai/schemas/$name.json")

    private fun historyOf(priorTurns: List<TurnTranscript>): String =
        priorTurns.joinToString("\n") { turn ->
            "Q: ${turn.questionText}\nA: ${turn.answerTranscript ?: "(no answer captured)"}"
        }

    private fun transcriptOf(transcript: List<TurnTranscript>): String =
        transcript
            .mapIndexed { index, turn ->
                buildString {
                    append("Turn $index${if (turn.warmUp) " (warm-up)" else ""}\n")
                    append("Q: ${turn.questionText}\n")
                    append("A: ${turn.answerTranscript ?: "(no answer captured)"}")
                    turn.deliveryNote?.let { append("\n[delivery observed: $it]") }
                    // For judging the answer only — report.md tells the model never to
                    // present this as a sourced fact about the employer.
                    if (turn.referencePoints.isNotEmpty()) {
                        append("\n[what a strong answer to this would cover: ${turn.referencePoints.joinToString("; ")}]")
                    }
                    // Marked inline so the model cannot praise an answer it was handed
                    // without noticing that it handed it over.
                    if (turn.intervention.isAssisted) {
                        append("\n[interviewer intervened — ${turn.intervention.label.lowercase()}")
                        turn.interventionNote?.let { append(": $it") }
                        append("]")
                    }
                }
            }.joinToString("\n\n")

    /**
     * Counts of help given, so the model's narrative is built on the real numbers rather
     * than its own impression of how the round went.
     */
    private fun assistanceContext(transcript: List<TurnTranscript>): String {
        val answered = transcript.filter { it.answerTranscript != null }
        if (answered.isEmpty()) return "No answers were recorded."

        val assisted = answered.filter { it.intervention.isAssisted }
        if (assisted.isEmpty()) {
            return "The candidate answered all ${answered.size} questions without any help."
        }

        return buildString {
            append("The candidate answered ${answered.size - assisted.size} of ${answered.size} unaided. ")
            append("The interviewer stepped in on ${assisted.size}:\n")
            assisted
                .groupingBy { it.intervention }
                .eachCount()
                .forEach { (intervention, count) -> append("- ${intervention.label}: $count turn(s)\n") }
            assisted.mapNotNull { it.interventionNote }.forEach { append("- what was given: $it\n") }
        }
    }

    private fun fillBrief(
        template: String,
        brief: InterviewBrief,
    ): String =
        template
            .replace("{{company}}", brief.company)
            .replace("{{archetype}}", brief.archetype)
            .replace("{{role}}", brief.role)
            .replace("{{roundType}}", brief.roundType)
            .replace("{{roundCovers}}", brief.roundCovers)
            .replace("{{language}}", brief.language)
            .replace("{{candidateFunction}}", brief.candidateFunction ?: "unspecified")
            .replace("{{candidateLevel}}", brief.candidateLevel ?: "unspecified")
            .replace("{{targetLevel}}", brief.targetLevel ?: "unspecified")
            // Blank rather than absent when there is nothing to say: a heading with an
            // empty body under it reads as a section the model may ignore, which is what
            // it should do, and it keeps every template free of leftover placeholders.
            .replace("{{levelCalibration}}", brief.levelCalibration.ifBlank { "(no level calibration for this round)" })
            .replace("{{grounding}}", brief.grounding)
            .replace("{{plannedQuestion}}", plannedQuestionOf(brief.plannedQuestion))
            .replace("{{plannedQuestionWhen}}", plannedQuestionWhen(brief.plannedQuestion))

    private fun plannedQuestionOf(planned: PlannedQuestion?): String =
        when {
            planned == null -> {
                "(none)"
            }

            planned.reported -> {
                "\"${planned.text.trim()}\" (reported for ${planned.company} by sources we hold)"
            }

            else -> {
                "\"${planned.text.trim()}\" (written ahead of time from general knowledge; no source we hold reports " +
                    "${planned.company} asking it, so never say or imply that they do)"
            }
        }

    /**
     * When the planned question is to be asked. Decided by the engine: the first question
     * of the round proper is always the planned one, and after that it waits for the round
     * to move to new ground, because following the candidate's answer is the product.
     */
    private fun plannedQuestionWhen(planned: PlannedQuestion?): String =
        when {
            planned == null -> {
                "There is no planned question on this turn. Carry on from where the round is."
            }

            planned.askNow -> {
                "Ask the planned question on this turn, whatever the candidate just said: it is the first " +
                    "question of the round proper. Lead into it if the turn needs a lead-in."
            }

            else -> {
                "Ask it when you move to new ground - when this line is done and you would otherwise " +
                    "`move_on`. If this answer needs a follow-up, a probe, a challenge or a hand, do that " +
                    "instead and leave the planned question: it will still be here next turn."
            }
        }

    /**
     * Fills in where the round is up to, and what that means the interviewer should be
     * doing now. The pacing sentence is written here rather than left to the model,
     * because a model asked to pace itself will neither warm up nor wrap up.
     */
    private fun fillRound(
        template: String,
        round: RoundContext,
        clockFree: Boolean = false,
    ): String =
        template
            .replace("{{phase}}", round.phase)
            .replace("{{minutesElapsed}}", round.minutesElapsed.toString())
            .replace("{{minutesRemaining}}", round.minutesRemaining.toString())
            .replace("{{durationMinutes}}", round.durationMinutes.toString())
            .replace("{{followUpLimit}}", round.followUpLimit.toString())
            .replace("{{pacing}}", if (clockFree) clockFreePacingFor(round) else pacingFor(round))

    /**
     * The pacing sentence for the two-variant assessment (design review, step 2a): the same
     * sentences with the clock taken out. "There is only about nine minutes left" beside a
     * topic list the model has used up read as an invitation to finish; the server owns the
     * ending now, so the model is not told how near it is.
     *
     * The briefing keeps its time: there it is something the candidate is told, not a cue to
     * the model. The time-up sentence is the final variant's, which asks for no next question.
     */
    private fun clockFreePacingFor(round: RoundContext): String =
        when {
            round.mustConclude -> {
                "This was the candidate's last answer: the round is over. Assess it. The server closes the " +
                    "interview, so you do not write anything to say next."
            }

            round.phase == CLOSING_PHASE && !round.mustMoveOn && !round.briefTheCandidate -> {
                "Do not open new ground. Finish the thread you are on. Do not mention the time or that the " +
                    "interview is ending."
            }

            round.phase == MAIN_PHASE && !round.mustMoveOn && !round.briefTheCandidate -> {
                "You are in the main round. Never spend more than ${round.followUpLimit} consecutive follow-up " +
                    "questions on one answer or thread."
            }

            else -> {
                pacingFor(round)
            }
        }

    private fun pacingFor(round: RoundContext): String =
        when {
            round.mustConclude -> {
                "The time is up. Close the interview off on this turn: thank them, tell them what happens " +
                    "next, and set `suggestedNextAction` to `conclude`. Do not open a new line of questioning."
            }

            round.mustMoveOn -> {
                "This thread has already used the ${round.followUpLimit}-question follow-up budget. " +
                    "Do not ask another follow-up, probe, challenge, or variation on it. Set " +
                    "`suggestedNextAction` to `move_on` and ask a fresh question from untouched round scope."
            }

            round.briefTheCandidate -> {
                "The warm-up is over and you now know who you are talking to. Before your next question, " +
                    "tell them how the rest of the round will run - that there are " +
                    "${timeLeft(round.minutesRemaining)} left, roughly what you will cover given this round " +
                    "type, that you want them to think out loud, and that they can ask you to repeat or " +
                    "clarify anything. Two or three sentences, spoken plainly. Then ask your first " +
                    "substantive question in the same turn."
            }

            round.phase == CLOSING_PHASE -> {
                "There is only ${timeLeft(round.minutesRemaining)} left. " +
                    "Do not open new ground. Finish the thread you are on, or ask one last question you can " +
                    "get a complete answer to. If you mention the time, say exactly this much and no more."
            }

            round.phase == WARMUP_PHASE -> {
                // The beat is the engine's decision, not the model's. Asked to warm up in
                // general terms it would improvise a different opening every run, and on a
                // short round skip straight to the hard part.
                "You are still warming up, and this is where you learn what is worth probing later. " +
                    "No hard questions yet, and nothing about the round topic. " +
                    (round.warmupInstruction ?: "Find out who they are and what they actually work on.")
            }

            else -> {
                "You are in the main round with ${timeLeft(round.minutesRemaining)} left. Pace yourself so " +
                    "the round finishes properly rather than being cut off mid-answer. Never spend more " +
                    "than ${round.followUpLimit} consecutive follow-up questions on one answer or thread."
            }
        }

    /**
     * The time left, as the interviewer should say it. The count is rounded down, so this
     * never promises more than the clock on the candidate's screen shows.
     */
    private fun timeLeft(minutes: Int): String =
        when (minutes) {
            0 -> "less than a minute"
            1 -> "about a minute"
            else -> "about $minutes minutes"
        }

    private fun loadPrompt(name: String): String = readResource("ai/prompts/$name.md")

    private fun readResource(path: String): String = ClassPathResource(path).inputStream.use { it.readBytes().toString(Charsets.UTF_8) }

    private companion object {
        const val WARMUP_PHASE = "warm-up"
        const val CLOSING_PHASE = "closing"
        const val MAIN_PHASE = "main round"
    }
}
