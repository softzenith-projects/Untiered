package com.interviewos.api.interview

import com.interviewos.api.bank.BankQuestion
import com.interviewos.api.bank.Company
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.bank.QuestionBankRepository
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * What a round can ask from the bank, and which question it asks next (task 038).
 *
 * The company is resolved through [CompanyDirectory] — exactly, or by an alias; never a
 * parent, a subsidiary, a region or an archetype sibling. "Google Cloud India" is not Google,
 * and nothing Google is reported to ask is offered for it. When the directory does not know
 * the name, or the bank holds nothing for that company and round type, the round is written
 * by the model from general patterns and says so. Never another company's questions.
 */
@Component
class BankRoundPlanner(
    private val directory: CompanyDirectory,
    private val bank: QuestionBankRepository,
    private val repository: SessionRepository,
) {
    /** The company's questions for this round type, or null when there are none. */
    fun forRound(
        companyName: String,
        roundType: RoundType,
    ): BankRound? {
        val company = directory.resolve(companyName) ?: return null
        val questions =
            bank
                .questionsFor(company.id, roundType, includeUnclassified = false, limit = MAX_CANDIDATES)
                // The query already filters to this company and round type. Checked again here
                // because this is the line a mislabelled question must never cross.
                .filter { it.tagFor(company.id) != null && it.roundType == roundType }
        return if (questions.isEmpty()) null else BankRound(company, questions)
    }

    /** How many sourced questions the bank holds for this company and round type. Cheap. */
    fun questionCount(
        companyName: String,
        roundType: RoundType,
    ): Int = directory.resolve(companyName)?.let { bank.countFor(it.id, roundType) } ?: 0

    /** The question this round plans to ask next, or null when every one has been asked in it. */
    fun next(
        userId: UUID,
        sessionId: UUID,
        round: BankRound,
    ): BankQuestion? {
        val asked = repository.askedBankQuestions(userId, sessionId)
        return BankQuestionSelection.choose(
            companyId = round.company.id,
            candidates = round.questions,
            lastAsked = asked.associate { it.bankQuestionId to it.lastAskedAt },
            askedThisRound = asked.filter { it.inThisRound }.map { it.bankQuestionId }.toSet(),
            random = BankQuestionSelection.randomFor(sessionId),
        )
    }

    private companion object {
        /** More than any round can ask, so exclusion has room to work. */
        const val MAX_CANDIDATES = 100
    }
}

/**
 * What the candidate is told about where a round's questions come from — in the setup, the
 * room and the report alike. Plain on purpose: sourced questions are counted and named as
 * sourced, and a round with none says it has none rather than letting an archetype pattern
 * read as knowledge of the employer.
 */
object GroundingNote {
    fun forRound(
        company: String,
        archetype: Archetype,
        confidence: Confidence,
        roundType: RoundType,
        sourcedQuestions: Int,
        workspaceRound: Boolean,
    ): String {
        val rounds = "$company's ${roundType.label.lowercase()} rounds"
        return when {
            sourcedQuestions > 0 && workspaceRound -> {
                "This round is set on a question reported for $rounds in sources we hold, cited in your " +
                    "report. The follow-ups are written from how you work through it."
            }

            sourcedQuestions > 0 -> {
                val questions = if (sourcedQuestions == 1) "the one question" else "the $sourcedQuestions questions"
                // "Start with", not "come from": a round can outlast its sourced questions, and the
                // ones asked after them are written from general patterns. Saying every main question
                // was sourced would claim a source for questions that have none.
                "The main questions in this round start with $questions reported for $rounds in sources " +
                    "we hold, each cited in your report. Once those have been asked, further questions are " +
                    "written from general patterns and are not cited. Follow-ups are written from your answers."
            }

            confidence == Confidence.RECOGNISED -> {
                "We hold no sourced questions for $rounds; these are written from general patterns for " +
                    "${archetype.inProse}, not from a description of $company's current process."
            }

            else -> {
                "We do not recognise $company and hold no sourced questions for it, so this runs as " +
                    "${archetype.inProse} on general patterns rather than on anything specific to them."
            }
        }
    }
}

/** A company's sourced questions for one round type. Never empty. */
data class BankRound(
    val company: Company,
    val questions: List<BankQuestion>,
)
