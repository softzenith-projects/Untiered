package com.interviewos.api.interview

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import tools.jackson.databind.JsonNode
import java.time.Instant
import java.util.UUID

/**
 * Request and response shapes for the interview loop. The web app and, in Phase 3, the
 * mobile apps consume these unchanged.
 */

data class StartSessionRequest(
    /**
     * The client will read the questions out itself, so the server should not synthesise
     * them.
     *
     * Modern browsers have a speech synthesiser with neural voices in it, and a client
     * that has one does not need ours: it speaks instantly, for nothing, and can say
     * exactly where in the sentence it has reached. Ours costs a call against a quota of a
     * hundred a day — small enough that benchmarking it once has already turned a real
     * candidate's round silent — and takes about six seconds a question.
     *
     * Per request rather than per session on purpose. It is a property of the browser in
     * front of us, not of the interview: the same candidate may come back on a phone that
     * has no usable voice, and that round should be spoken by the model as before.
     */
    val speaksLocally: Boolean = false,
    @field:Size(max = 120)
    val companyName: String = "",
    @field:Size(max = 120)
    val roleTitle: String = "",
    @field:NotBlank
    val roundType: String = "",
    @field:Pattern(
        regexp = "english|hindi_english",
        message = "Language must be english or hindi_english.",
    )
    val language: String = "english",
    /**
     * Consent is a hard gate and is recorded per stream, with a timestamp. The server
     * refuses to start a session without audio consent, because the interview is spoken.
     */
    val consentAudio: Boolean = false,
    val consentVideo: Boolean = false,
    /**
     * How long the round should run. Real loops are time-boxed and so is this one — the
     * clock is what ends the interview, not a turn counter.
     */
    @field:Min(30)
    @field:Max(60)
    val durationMinutes: Int = RoundLength.DEFAULT_MINUTES,
    /**
     * The candidate saying, in their own words, where they are: `student`,
     * `recent_graduate` or `professional` (task 051). Optional — null reproduces today's
     * behaviour exactly, deriving the stage from the role title and resume alone
     * ([CandidateStage.of]). An unrecognised value is a `400`, not a silent ignore.
     */
    val candidateStage: String? = null,
    @field:Size(max = 160)
    val focusTopic: String? = null,
    /**
     * A round a college assigned (campus spec §4). When present, the round's configuration is
     * taken from the assignment and the client's values for it are ignored, and the college
     * pays for it rather than the candidate's free rounds or credits.
     */
    val assignmentId: UUID? = null,
)

/** One exchange as the client needs to render it. */
data class TurnView(
    val turnIndex: Int,
    val questionText: String,
    /** Short-lived signed URL for the spoken question. Null until the voice has rendered. */
    val questionAudioUrl: String?,
    /**
     * `pending`, `ready` or `unavailable`. Speech is synthesised after the question text
     * is sent, so the room needs to tell "still coming" apart from "not coming" — a null
     * URL alone says only that there is nothing to play yet.
     */
    val questionAudioStatus: String,
    /** `warmup`, `main` or `closing` — the room labels the stage the candidate is in. */
    val phase: String,
    val answered: Boolean,
)

data class SessionView(
    val id: UUID,
    val companyName: String,
    val archetype: String,
    val archetypeLabel: String,
    /** `recognised` or `inferred`. The UI must say when it is inferred. */
    val archetypeConfidence: String,
    /**
     * Plain-language provenance for the candidate. Never claims knowledge of a specific
     * employer's process — see PRD §04.
     */
    val groundingNote: String,
    val roleTitle: String,
    val roundType: String,
    val roundLabel: String,
    val language: String,
    val status: String,
    /**
     * Whether video was consented to. The client decides whether to open the camera from
     * this and nothing else — consent is per stream and is a hard gate (PRD 12).
     */
    val consentVideo: Boolean,
    val startedAt: Instant?,
    val endedAt: Instant?,
    /** The scheduled length of the round, in minutes. */
    val durationMinutes: Int,
    /**
     * When the round is scheduled to end. The server's clock is the authority — a client
     * that sleeps its tab or drifts cannot buy the candidate extra time.
     */
    val scheduledEndAt: Instant?,
    val turnsCompleted: Int,
    /** A ceiling on exchanges, not a target. The clock ends the round. */
    val maxTurns: Int,
    val currentTurn: TurnView?,
    /**
     * The problem or case this round is conducted around, composed once at the start.
     *
     * Null for every round that is only a conversation, and null too when composition
     * failed — the client renders the plain spoken room in both cases rather than an
     * empty editor, because a DSA round with no problem in it is worse than a DSA round
     * held entirely out loud.
     */
    val workspace: JsonNode? = null,
    /** What the candidate has drawn or written so far, so a reload does not lose it. */
    val board: JsonNode? = null,
    /** Candidate-selected syllabus for a custom topic round. */
    val focusTopic: String? = null,
    /**
     * Whether a college assigned this round (campus spec §4). Only then does the room send
     * integrity events (§5); the student was told so on the start screen, before consent.
     */
    val assigned: Boolean = false,
)

/**
 * A request to run the candidate's code against one input.
 *
 * [stdin] is the test case, written exactly as the problem's `stdinFormat` describes, so
 * the starter program can read it without a per-problem harness on our side.
 */
data class RunCodeRequest(
    @field:NotBlank(message = "There is no code to run.")
    @field:Size(max = 40_000)
    val source: String = "",
    @field:NotBlank
    val language: String = "python",
    @field:Size(max = 10_000)
    val stdin: String = "",
)

/** What the candidate typed into the composer. */
data class ComposeRoundRequest(
    @field:NotBlank(message = "Tell us what you are preparing for.")
    @field:Size(max = 600)
    val query: String = "",
)

/**
 * A round drafted from one sentence, shown back before anything is created.
 *
 * Nothing here is saved. The candidate corrects what is wrong and starts the round from
 * the normal endpoint, so the composer is a convenience over the same setup rather than
 * a second way to create a session.
 *
 * [groundingNote] and [archetypeConfidence] are resolved server-side from whatever
 * employer was read out of the sentence, so a candidate learns before the round starts
 * whether we actually recognise where they are interviewing.
 */
data class RoundDraft(
    val companyName: String,
    val roleTitle: String,
    val level: String,
    val roundType: String,
    val roundLabel: String,
    val durationMinutes: Int,
    val language: String,
    val understood: String,
    val assumptions: List<String>,
    val confidence: String,
    val archetypeLabel: String,
    val archetypeConfidence: String,
    val groundingNote: String,
    val focusTopic: String? = null,
)

/**
 * Help the candidate asked for, and the fact that asking was recorded.
 *
 * [assistanceLabel] is shown in the room at the moment the hint is given, not saved for
 * the report. Someone deciding whether to ask for help should know what it will cost
 * them before they read about it afterwards.
 */
data class HintView(
    val turnIndex: Int,
    val text: String,
    val assistanceLevel: String,
    val assistanceLabel: String,
)

data class SubmitAnswerResponse(
    val sessionComplete: Boolean,
    val turnsCompleted: Int,
    val nextTurn: TurnView?,
    /**
     * The last thing the interviewer says, when this answer ended the round.
     *
     * Null on every other turn. The room speaks it before it shows the completion screen,
     * so a round ends with somebody saying it has rather than with the page changing.
     */
    val closingRemark: String? = null,
)

/** Whether the candidate may start another interview, and why not if not. */
data class EntitlementView(
    val allowed: Boolean,
    val reason: String,
    val message: String,
    /** How many free rounds are left, or null when there is no limit — which is the case today. */
    val remainingFree: Int?,
    /** The daily allowance; each is null when that allowance is switched off. */
    val dailyRoundLimit: Int? = null,
    val dailyMinuteLimit: Int? = null,
    val remainingRoundsToday: Int? = null,
    val remainingMinutesToday: Int? = null,
    /**
     * The round that blocks a new one, when there is one. Sent so a client can always offer
     * "Resume" — without it, a dashboard whose session list failed to load showed "in
     * progress" next to a disabled Start button and no way back into the round.
     */
    val openSessionId: UUID? = null,
    /** Paid credit not yet spent, in credits: may be a half (2.5) since a 30-minute round costs half. */
    val creditBalance: Double = 0.0,
    /** What would pay for a round started now — `free` or `credit` — or null when none may start. */
    val funding: String? = null,
    /** Whether interviews can be bought here; false until Razorpay keys are configured. */
    val purchasable: Boolean = false,
)

/**
 * One past round, as the candidate's history lists it.
 *
 * The three retention fields exist so a client never has to guess what a "Read report"
 * link will do. [reportExpired] means the report, the transcript and the recordings have
 * been cleared and are not coming back — the link must not be rendered, because following
 * it is the broken page this whole shape exists to prevent. [reportExpiresAt] is when that
 * will happen, so a candidate can be warned before it does rather than after.
 * [reportRetentionDays] is the rule itself, sent rather than hardcoded in the browser: it
 * is one property on the server, and the client that will most struggle to keep up with a
 * change to it is the mobile app that ships on its own release cycle.
 */
data class SessionSummary(
    val id: UUID,
    val companyName: String,
    val roleTitle: String,
    val roundType: String,
    val status: String,
    val startedAt: Instant?,
    val endedAt: Instant?,
    val hasReport: Boolean,
    /** Cleared by retention. There is nothing left to open, and nothing to recompose from. */
    val reportExpired: Boolean = false,
    /** When this round will be cleared. Null once it has been. */
    val reportExpiresAt: Instant? = null,
    /** How long a report is kept, in days. The server is the authority on the number. */
    val reportRetentionDays: Int = 0,
)

/**
 * Readiness for one (company, role), derived by grouping completed sessions after the
 * fact. There is no stored target list — see PRD §05.
 */
data class ReadinessGroup(
    val companyName: String,
    val roleTitle: String,
    val sessionsCompleted: Int,
    val firstAttemptAt: Instant?,
    val latestAttemptAt: Instant?,
    val latestAverageScore: Double?,
    val firstAverageScore: Double?,
    val recurringWeaknesses: List<String>,
)
