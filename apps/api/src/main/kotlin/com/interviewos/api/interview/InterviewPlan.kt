package com.interviewos.api.interview

import java.time.Duration
import java.time.Instant

/** Where an exchange sits in the round. Mirrors the `turn_phase` Postgres enum. */
enum class TurnPhase(
    val dbValue: String,
) {
    WARMUP("warmup"),
    MAIN("main"),
    CLOSING("closing"),
    ;

    companion object {
        fun fromDbValue(value: String?): TurnPhase = entries.firstOrNull { it.dbValue == value } ?: MAIN
    }
}

/**
 * What the warm-up is asking about on this turn.
 *
 * Real interviews open the same way every time, in the same order, because it works: who
 * are you, what have you built, what do you actually do all day. Leaving that to the
 * model produced a different opening every run and, on a short round, no opening at all.
 * The engine picks the beat; the model only has to say it well.
 */
enum class WarmupFocus(
    /** Handed to the model as the instruction for this turn. */
    val instruction: String,
    /**
     * The same beat asked of a student (task 048).
     *
     * The professional wording is not merely unhelpful to a fresher, it is unanswerable:
     * the third beat asks what they work in day to day, the size of their team and how
     * much of it they own, and a final-year student has none of those. It was the first
     * thing they heard in the round.
     */
    val campusInstruction: String,
) {
    INTRODUCTION(
        "Ask them to introduce themselves — background, how long they have been doing this, and what " +
            "they are working on at the moment. This is the opening question of the interview.",
        campusInstruction =
            "Ask them to introduce themselves — what they are studying, where they are up to in it, and " +
                "what they have been building or working on lately. This is the opening question of the " +
                "interview, and for most of them it is the first interview they have sat.",
    ),
    PROJECT(
        "Pick something concrete they just mentioned and ask them to walk you through it: what the " +
            "system or project actually did, and what their own part in it was. You are after the shape " +
            "of real work, not an assessment yet. If they mentioned nothing specific, ask for the piece " +
            "of work they are most proud of.",
        campusInstruction =
            "Pick something concrete they just mentioned — a course project, a final-year project, an " +
                "internship, something they built for themselves — and ask them to walk you through it: " +
                "what it did, and which part was theirs. Not an assessment yet. If they mentioned nothing " +
                "specific, ask what they have most enjoyed building.",
    ),
    STACK_AND_EXPERIENCE(
        "Ask what they work in day to day — the stack, the kind of problems, the size of the team, how " +
            "much of it they own. This is the last warm-up question, and it is where you find the ground " +
            "the rest of the round will stand on.",
        campusInstruction =
            "Ask what they actually know their way around — the language they are most comfortable in, " +
                "the subjects they have covered, what they have used outside a classroom. Do not ask about " +
                "a team, a stack they own or what they do day to day: they have no job. This is the last " +
                "warm-up question and it is where you find the ground the rest of the round stands on.",
    ),
    ;

    /** The wording for this beat, given who is in the room. */
    fun instructionFor(campusFresher: Boolean): String = if (campusFresher) campusInstruction else instruction

    companion object {
        /** The beats in order. The nth warm-up turn gets the nth focus. */
        private val SEQUENCE = listOf(INTRODUCTION, PROJECT, STACK_AND_EXPERIENCE)

        fun forTurn(warmupTurnIndex: Int): WarmupFocus = SEQUENCE.getOrElse(warmupTurnIndex) { SEQUENCE.last() }
    }
}

/**
 * What the interviewer should be doing right now.
 *
 * The model is told this; it does not decide it. Where the round is up to, whether the
 * candidate has been told the plan yet, and whether there is time left are all engine
 * decisions — the same rule that keeps question selection and scoring server-side
 * (CLAUDE.md). Left to itself a model will happily open on a system-design question and
 * run until it gets bored.
 */
data class TurnPlan(
    val turnIndex: Int,
    val phase: TurnPhase,
    val minutesElapsed: Int,
    val minutesRemaining: Int,
    val durationMinutes: Int,
    /** Which warm-up beat this turn is, or null once the round proper has started. */
    val warmupFocus: WarmupFocus?,
    /**
     * True on the one turn where the interviewer sets out how the round will run, before
     * asking the first substantive question. Real interviewers do this and it settles a
     * nervous candidate more than anything else in the first five minutes.
     */
    val briefTheCandidate: Boolean,
    /** The clock or the turn ceiling has run out; this round has to end now. */
    val mustConclude: Boolean,
    /**
     * The clock specifically, as opposed to the turn ceiling. Decides how the round is
     * closed: a candidate stopped by the clock is told so, whoever pressed what.
     */
    val outOfTime: Boolean = false,
)

/**
 * The shape of a round.
 *
 * A real interview opens by finding out who is sitting opposite — background, something
 * they built, what they actually work in — and only then gets to the hard part. That
 * warm-up is not padding: it is where the interviewer learns what is worth probing, and
 * it is why an interview feels like a conversation rather than a viva.
 *
 * **The warm-up is counted in exchanges, not minutes.** It used to end on whichever came
 * first, and the clock always won: a 20-minute round allowed the warm-up 3 minutes, which
 * one honest answer to "tell me about yourself" spends. Candidates got the introduction
 * and then a system-design question, which is exactly the cold open the warm-up exists to
 * prevent. The clock is still here, as a ceiling generous enough that only a genuinely
 * runaway answer trips it.
 */
object InterviewPlan {
    /** Exchanges spent warming up before the round proper: introduction, a project, their stack. */
    const val WARMUP_TURNS = 3

    /** A short round gets a shorter warm-up, so the opening stays proportionate to the whole. */
    private const val SHORT_ROUND_MINUTES = 25
    private const val SHORT_ROUND_WARMUP_TURNS = 2

    /**
     * The warm-up's share of the clock, as a backstop only.
     *
     * This is not how the warm-up normally ends — turns are. It exists so a candidate who
     * talks for eight minutes about their degree cannot consume the whole round before a
     * single substantive question is asked.
     */
    private const val WARMUP_CEILING_SHARE = 0.4

    /** Below this many minutes the interviewer starts wrapping up rather than opening new ground. */
    private const val CLOSING_MINUTES = 4

    /**
     * The closing phase, as a share of a very short round.
     *
     * A five-minute round would otherwise be closing from its first minute — four of its
     * five minutes count as "nearly over" — so it would open, warm up, and wrap up
     * without ever asking anything substantive. That makes the shortest round useless for
     * exactly what it is for: checking that a room actually works.
     *
     * Capped at a third, so a short round is a miniature of a real one rather than an
     * opening and an ending with nothing in between. Unchanged at 20 minutes and above,
     * where a third is already wider than the four minutes.
     */
    private fun closingMinutesFor(durationMinutes: Int): Int = minOf(CLOSING_MINUTES, (durationMinutes / 3).coerceAtLeast(1))

    /**
     * A ceiling, not a target — the clock ends the round. It exists so a pathological
     * session cannot run up an unbounded model bill.
     *
     * It scales with the round. A flat 16 ended a 40-minute round at 18 minutes for a
     * candidate who answered in about a minute a turn (4 November 2026): the ceiling, not
     * the clock, decided how long the interview was. One and a half turns a minute is
     * faster than anyone has answered in practice, so only a runaway session reaches it;
     * the floor keeps short rounds where they were.
     */
    fun maxTurnsFor(durationMinutes: Int): Int = maxOf(MIN_TURN_CEILING, durationMinutes * TURN_CEILING_PER_TEN_MINUTES / 10)

    /** The ceiling for the shortest rounds, and what every round had before it scaled. */
    const val MIN_TURN_CEILING = 16

    /** Fifteen turns per ten minutes — integer arithmetic, so the ceiling never rounds up. */
    private const val TURN_CEILING_PER_TEN_MINUTES = 15

    /**
     * With less than this left, the round ends rather than asking another question.
     *
     * A question nobody has time to answer is worse than no question: the candidate starts
     * an answer, the clock stops them mid-sentence, and the last thing the round did was
     * cut them off. So an answer that lands in the final half-minute is the last answer.
     */
    const val LAST_QUESTION_SECONDS = 30

    /**
     * @param hasWarmup false for a round conducted around a problem or a design case. Its
     *   opening *is* the round — "here is the problem, read it out" — and three warm-up
     *   beats about the candidate's CV would be three turns not spent on it. Worse, the
     *   project beat instructs the model to ask about a project, which in a DSA round is a
     *   question about something else entirely.
     */
    fun forTurn(
        turnIndex: Int,
        answeredTurns: Int,
        startedAt: Instant?,
        durationMinutes: Int,
        now: Instant,
        hasWarmup: Boolean = true,
        warmupTurns: Int? = null,
    ): TurnPlan {
        // Seconds, not minutes. Whole minutes rounded the time left *up* by as much as 59
        // seconds, so the interviewer said "about two minutes left" while the clock on the
        // candidate's screen said 1:07.
        val elapsedSeconds = secondsBetween(startedAt, now)
        val remainingSeconds = (durationMinutes * 60L - elapsedSeconds).coerceAtLeast(0)
        val elapsed = (elapsedSeconds / 60).toInt()

        val effectiveWarmupTurns = warmupTurns ?: if (hasWarmup) warmupTurnsFor(durationMinutes) else 0
        val warmupCeiling = (durationMinutes * WARMUP_CEILING_SHARE).toInt().coerceAtLeast(2)

        // Turns are what end the warm-up. The clock only overrides a runaway one.
        val warmingUp = answeredTurns < effectiveWarmupTurns && elapsed < warmupCeiling
        val justFinishedWarmup = effectiveWarmupTurns > 0 && !warmingUp && answeredTurns <= effectiveWarmupTurns

        val phase =
            when {
                warmingUp -> TurnPhase.WARMUP
                remainingSeconds <= closingMinutesFor(durationMinutes) * 60L -> TurnPhase.CLOSING
                else -> TurnPhase.MAIN
            }
        val outOfTime = remainingSeconds < LAST_QUESTION_SECONDS

        return TurnPlan(
            turnIndex = turnIndex,
            phase = phase,
            minutesElapsed = elapsed,
            // Rounded down, so the interviewer never promises time the clock does not show.
            minutesRemaining = (remainingSeconds / 60).toInt(),
            durationMinutes = durationMinutes,
            // `answeredTurns` counts the answers in hand, so it is also the index of the
            // warm-up beat now due: one answer given means the project question is next.
            warmupFocus = if (warmingUp) WarmupFocus.forTurn(answeredTurns) else null,
            // Said once, on the first turn that is no longer warm-up.
            briefTheCandidate = justFinishedWarmup && phase != TurnPhase.WARMUP,
            mustConclude = outOfTime || answeredTurns >= maxTurnsFor(durationMinutes),
            outOfTime = outOfTime,
        )
    }

    /**
     * The opening turn, before a clock has started or anything has been answered.
     *
     * A round with a workspace opens on its material, in the main round — the DSA room used
     * to show "Warm-up" beside the clock for the whole time the candidate was solving the
     * problem.
     */
    fun opening(
        durationMinutes: Int,
        hasWarmup: Boolean = true,
        warmupTurns: Int? = null,
    ): TurnPlan {
        val effectiveWarmupTurns = warmupTurns ?: if (hasWarmup) warmupTurnsFor(durationMinutes) else 0
        return TurnPlan(
            turnIndex = 0,
            phase = if (effectiveWarmupTurns > 0) TurnPhase.WARMUP else TurnPhase.MAIN,
            minutesElapsed = 0,
            minutesRemaining = durationMinutes,
            durationMinutes = durationMinutes,
            warmupFocus = if (effectiveWarmupTurns > 0) WarmupFocus.INTRODUCTION else null,
            briefTheCandidate = false,
            mustConclude = false,
        )
    }

    fun warmupTurnsFor(durationMinutes: Int): Int = if (durationMinutes < SHORT_ROUND_MINUTES) SHORT_ROUND_WARMUP_TURNS else WARMUP_TURNS

    private fun secondsBetween(
        from: Instant?,
        to: Instant,
    ): Long = from?.let { Duration.between(it, to).seconds.coerceAtLeast(0) } ?: 0
}
