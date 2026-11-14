package com.interviewos.api.interview

import com.interviewos.api.ai.AiSpendContext
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.AskedQuestion
import com.interviewos.api.ai.AssessmentVariant
import com.interviewos.api.ai.Intervention
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.PlannedQuestion
import com.interviewos.api.ai.RoundContext
import com.interviewos.api.ai.TurnTranscript
import com.interviewos.api.bank.BankQuestion
import com.interviewos.api.billing.BillingProperties
import com.interviewos.api.common.ApiException
import com.interviewos.api.resume.CandidateBackground
import com.interviewos.api.resume.ResumeService
import com.interviewos.api.resume.ResumeUse
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import com.interviewos.api.storage.StorageKeys
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.dao.DuplicateKeyException
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * Conducts an interview.
 *
 * All of the decision-making lives here, server-side: whether a session may start, what
 * is asked next, when it ends, and what the report says. The client captures media and
 * renders — it never chooses a question or computes a score (CLAUDE.md).
 *
 * When Gemini is unavailable the session is marked `failed` and the candidate is told.
 * It never silently degrades to canned questions and presents the result as a real
 * assessment (task 002, §5).
 */
@Service
class InterviewService(
    private val repository: SessionRepository,
    private val userRepository: UserRepository,
    private val archetypeResolver: ArchetypeResolver,
    private val interviewAi: InterviewAi,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val objectMapper: ObjectMapper,
    private val questionSpeech: QuestionSpeech,
    private val entitlementProperties: EntitlementProperties,
    private val billingProperties: BillingProperties,
    private val roundsProperties: RoundsProperties,
    private val retentionProperties: RetentionProperties,
    private val bankRounds: BankRoundPlanner,
    private val poolRounds: PoolRoundPlanner,
    private val resumeService: ResumeService,
    private val roundWorkspaceComposer: RoundWorkspaceComposer,
    private val codeRunner: CodeRunner,
    private val interviewEvents: InterviewEventRecorder,
    private val activeLeases: ActiveLeaseRenewal,
    transactionManager: PlatformTransactionManager,
    private val interviewerRules: InterviewerRulesProperties = InterviewerRulesProperties(),
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val transactions = TransactionTemplate(transactionManager)

    fun entitlement(userId: UUID): EntitlementView {
        val openSessionId = repository.findOpenSessionId(userId)
        val decision = evaluateEntitlement(userId, requestedMinutes = null, openSessionId = openSessionId)
        return EntitlementView(
            allowed = decision.allowed,
            reason = decision.reason.name.lowercase(),
            message = decision.message,
            openSessionId = openSessionId,
            remainingFree = decision.remainingFree,
            dailyRoundLimit = decision.daily.roundLimit,
            dailyMinuteLimit = decision.daily.minuteLimit,
            remainingRoundsToday = decision.daily.remainingRounds,
            remainingMinutesToday = decision.daily.remainingMinutes,
            creditBalance = decision.creditBalance,
            funding = decision.funding?.name?.lowercase(),
            purchasable = decision.purchasable,
        )
    }

    private fun evaluateEntitlement(
        userId: UUID,
        requestedMinutes: Int?,
        openSessionId: UUID? = repository.findOpenSessionId(userId),
    ): EntitlementDecision {
        val (roundsToday, minutesToday) = repository.practiceUsageSince(userId, startOfToday())
        return Entitlement.evaluate(
            freeRoundsUsed = repository.countFreeRoundsStarted(userId),
            halfCreditBalance = repository.halfCreditBalance(userId),
            sessionInProgress = openSessionId != null,
            freeRounds = entitlementProperties.freeRounds,
            daily =
                DailyUsage(
                    roundsUsed = roundsToday,
                    minutesUsed = minutesToday,
                    roundLimit = entitlementProperties.dailyRounds,
                    minuteLimit = entitlementProperties.dailyMinutes,
                ),
            requestedMinutes = requestedMinutes,
            purchasable = billingProperties.enabled,
        )
    }

    /** Midnight today in the allowance's time zone — when the daily allowance resets. */
    private fun startOfToday(): Instant {
        val zone = entitlementProperties.dayZone
        return java.time.LocalDate
            .now(zone)
            .atStartOfDay(zone)
            .toInstant()
    }

    /**
     * Reads one line of intent into a draft round, and says what it had to assume.
     *
     * Nothing is created here. The draft goes back to the candidate to correct, and the
     * session is started through the normal path — so the composer is a faster way into
     * the same setup rather than a second way to create a session with its own rules.
     *
     * The employer read out of the sentence is resolved to an archetype here rather than
     * in the model, so the candidate learns *before* the round whether we actually
     * recognise where they are interviewing. A model that both guessed the company and
     * described its process would be inventing the one thing we must never invent.
     */
    fun composeRound(request: ComposeRoundRequest): RoundDraft {
        val composed =
            try {
                interviewAi.composeRound(request.query.trim()).value
            } catch (e: AiUnavailableException) {
                log.warn("Could not compose a round from a candidate's query", e)
                throw ApiException.upstreamUnavailable(
                    "We could not read that just now. Fill the round in yourself and it will start the same way.",
                )
            }

        val company = composed.company.trim().take(120)
        val drafted = RoundType.parseOrNull(composed.roundType) ?: RoundType.PROJECT_DEEP_DIVE
        val role = composed.role.trim().take(120)
        val statedLevel = composed.level.trim().take(60)

        // The engine, not the model, decides which round a fresher is given. There is no
        // resume on this path — nobody is signed in to it — so the stage is read from what
        // they wrote: "fresher", "campus", "graduate trainee", "2026 batch".
        val stage = CandidateStage.of(role, experienceMonths = null, statedLevel = statedLevel)
        val excluded = stage.campusFresher && drafted in roundsProperties.campusExcludedTypes
        val roundType = if (excluded) CAMPUS_FALLBACK_ROUND else drafted
        val substitution =
            "You described a fresher or campus round, so this is a ${roundType.label.lowercase()} round rather " +
                "than ${drafted.label.lowercase()}: campus loops do not contain one, and it is not a fair bar " +
                "at this stage. Change it below if that is not what you meant."

        val resolution = archetypeResolver.resolve(company)
        val draftedFocus =
            composed.focusTopic
                ?.trim()
                ?.take(120)
                ?.takeIf { it.isNotBlank() }
        val focusTopic =
            if (roundType == RoundType.CUSTOM_TOPIC) {
                draftedFocus ?: request.query.trim().take(120)
            } else {
                null
            }
        val duration =
            if (roundType == RoundType.CUSTOM_TOPIC) {
                RoundLength.DEFAULT_CUSTOM_TOPIC_MINUTES
            } else {
                composed.durationMinutes?.let { RoundLength.nearest(roundType, it) } ?: RoundLength.DEFAULT_MINUTES
            }

        return RoundDraft(
            companyName = company,
            roleTitle = role,
            level = statedLevel,
            roundType = roundType.dbValue,
            roundLabel = roundType.label,
            durationMinutes = duration,
            language = if (composed.language == "hindi_english") "hindi_english" else "english",
            understood = composed.understood.trim(),
            // Never a silent swap: the draft goes back to the candidate to correct, so the
            // substitution is listed with everything else that was assumed for them.
            assumptions =
                composed.assumptions.map { it.trim() }.filter { it.isNotBlank() } +
                    if (excluded) listOf(substitution) else emptyList(),
            confidence = composed.confidence.lowercase().takeIf { it in DRAFT_CONFIDENCES } ?: "low",
            archetypeLabel = resolution.archetype.label,
            archetypeConfidence = resolution.confidence.dbValue,
            groundingNote =
                if (company.isBlank()) {
                    "You have not named an employer, so this runs on general patterns for the round type. " +
                        "Name one and the round is shaped to that kind of employer instead."
                } else {
                    candidateFacingNote(
                        company,
                        resolution.archetype,
                        resolution.confidence,
                        roundType,
                        bankRounds.questionCount(company, roundType),
                    )
                },
            focusTopic = focusTopic,
        )
    }

    /**
     * Starts a round.
     *
     * **Deliberately not one transaction.** It used to be, and that made setup take three
     * to five minutes. `provision()` upserts the user row, and because `users.email` is
     * unique and appears in the upsert's SET list, Postgres locks that row FOR UPDATE —
     * held until the transaction commits. The transaction then made a Gemini call, and
     * every model call records its cost through `AiSpendRepository`, which runs
     * REQUIRES_NEW: a second connection, on the same thread, inserting an `ai_calls` row
     * whose foreign key needs FOR KEY SHARE on that same user row. The inner write waited
     * for the outer transaction; the outer transaction waited for its own thread. Postgres
     * cannot see that as a deadlock, so it sat there until `statement_timeout` fired, the
     * ledger write was swallowed, and the round finally opened.
     *
     * It was also why `composeOpeningQuestion` never appeared in the ledger at all.
     *
     * So: the rows that must exist together are written in one short transaction, the
     * model is called with no transaction open, and what it produced is written in a
     * second. A slow model call now costs the candidate the model's time and nothing more,
     * and it never holds a database connection while it waits.
     */
    fun start(
        identity: SupabaseIdentity,
        request: StartSessionRequest,
    ): SessionView {
        val userId = identity.id

        if (!request.consentAudio) {
            throw ApiException.badRequest(
                "The interview is spoken, so recording your voice is required. Nothing is captured without your consent.",
                code = "consent_required",
            )
        }

        val roundType =
            RoundType.parseOrNull(request.roundType)
                ?: throw ApiException.badRequest("That is not a round type we run.", code = "unknown_round_type")
        val focusTopic = request.focusTopic?.trim()?.takeIf { it.isNotBlank() }
        if (roundType == RoundType.CUSTOM_TOPIC && focusTopic == null) {
            throw ApiException.badRequest(
                "Name the topic you want this custom round to practise.",
                code = "custom_topic_required",
            )
        }
        if (roundType == RoundType.CUSTOM_TOPIC && request.durationMinutes !in RoundLength.CUSTOM_TOPIC_MINUTES) {
            throw ApiException.badRequest(
                "Custom rounds are 30 minutes.",
                code = "custom_duration_invalid",
            )
        }
        if (request.durationMinutes !in RoundLength.allowedFor(roundType)) {
            throw ApiException.badRequest(
                "Rounds are 30, 45 or 60 minutes.",
                code = "duration_invalid",
            )
        }
        val normalisedRequest =
            request.copy(
                // A custom-topic round is intentionally not employer or job-title
                // preparation. Normalise this server-side too: older clients and browser
                // autofill must not quietly put an employer rubric back into it.
                companyName =
                    if (roundType == RoundType.CUSTOM_TOPIC) {
                        CUSTOM_TOPIC_COMPANY
                    } else {
                        request.companyName.trim().ifBlank { GENERAL_PRACTICE_COMPANY }
                    },
                roleTitle =
                    if (roundType == RoundType.CUSTOM_TOPIC) {
                        CUSTOM_TOPIC_ROLE
                    } else {
                        request.roleTitle.trim().ifBlank { GENERAL_PRACTICE_ROLE }
                    },
                focusTopic = focusTopic?.takeIf { roundType == RoundType.CUSTOM_TOPIC },
            )

        // Optional, and rejected outright when it does not parse rather than silently
        // dropped — the same treatment an unrecognised round type gets above.
        val declaredStage =
            request.candidateStage?.let {
                DeclaredStage.parseOrNull(it)
                    ?: throw ApiException.badRequest(
                        "That is not a stage we recognise. Leave it blank if none of the options fit.",
                        code = "unknown_candidate_stage",
                    )
            }

        // Read before the session row is written, because it decides whether this round may
        // run at all — and read once, then carried, rather than fetched again inside
        // `composeAndOpen`.
        val background = resumeService.backgroundFor(userId)
        val stage = CandidateStage.of(normalisedRequest.roleTitle, background?.tenure?.totalExperienceMonths, declaredStage = declaredStage)
        refuseRoundAboveStage(roundType, stage)

        val resolution = archetypeResolver.resolve(normalisedRequest.companyName)
        val sessionId =
            inTransaction {
                // Provisioning used to be a side effect of GET /me, so starting an interview
                // before that endpoint had ever been called failed on the users foreign key.
                // Any entry point that creates user-owned rows has to stand on its own.
                userRepository.provision(identity)
                admitAndInsert(userId, normalisedRequest, roundType, resolution, declaredStage)
            }

        // The session row has committed, so a failure from here on can no longer be rolled
        // back — it has to be recorded. Without this a round that died mid-setup would sit
        // `in_progress` with no question in it, and block the candidate's next start.
        return try {
            composeAndOpen(userId, sessionId, normalisedRequest, roundType, resolution, background, stage, declaredStage)
        } catch (e: RuntimeException) {
            runCatching { repository.failSessionAndRefundUsage(sessionId, userId) }
                .onSuccess { changed ->
                    if (changed) {
                        recordEvent(userId, sessionId, "session_failed", outcome = "failed", errorType = "unknown")
                    } else {
                        log.info("Session {} was already terminal when setup failed", sessionId)
                    }
                }
            throw e
        }
    }

    /**
     * Refuses a round this candidate should not be sitting at all (task 048).
     *
     * Said out loud rather than quietly substituted. Swapping the round the candidate
     * picked for a different one would leave them practising something they did not
     * choose and a history row that disagrees with what they remember doing; refusing it
     * with the reason lets them decide — and if the level is wrong, the role title they
     * typed is what to fix, which the message says.
     */
    private fun refuseRoundAboveStage(
        roundType: RoundType,
        stage: CandidateStage,
    ) {
        if (!stage.campusFresher || roundType !in roundsProperties.campusExcludedTypes) return
        throw ApiException.badRequest(
            "We do not run a ${roundType.label.lowercase()} round for a campus or new-graduate candidate. " +
                "No fresher loop contains one, and marking a student against that bar would tell you something " +
                "untrue about how ready you are. Coding, technical fundamentals and project deep-dive are the " +
                "rounds this stage is actually decided on. If you are not a fresher, set the role title to the " +
                "one you are interviewing for and start again.",
            code = "round_not_run_at_this_level",
        )
    }

    /**
     * The entitlement check, the session row and what pays for it, together.
     *
     * These have to share a transaction: two starts racing for the same candidate would
     * otherwise both see "no round in progress" and both create one, or both spend the
     * same last credit. The candidate's row is locked first so the second start waits and
     * then reads the first one's charge.
     */
    private fun admitAndInsert(
        userId: UUID,
        request: StartSessionRequest,
        roundType: RoundType,
        resolution: ArchetypeResolution,
        declaredStage: DeclaredStage?,
    ): UUID {
        repository.lockForAdmission(userId)
        val decision = evaluateEntitlement(userId, requestedMinutes = request.durationMinutes)
        if (!decision.allowed) {
            log
                .atInfo()
                .addKeyValue("user_id", userId)
                .addKeyValue("reason", decision.reason.name.lowercase())
                .addKeyValue("requested_minutes", request.durationMinutes)
                .log("Round refused by entitlement")
            throw when (decision.reason) {
                Entitlement.Reason.SESSION_IN_PROGRESS -> {
                    ApiException.conflict(decision.message, code = "session_in_progress")
                }

                Entitlement.Reason.FREE_TIER_EXHAUSTED -> {
                    ApiException.paymentRequired(decision.message)
                }

                else -> {
                    ApiException.paymentRequired(decision.message, code = decision.reason.name.lowercase())
                }
            }
        }

        val sessionId =
            try {
                repository.insertSession(
                    userId = userId,
                    companyName = request.companyName.trim(),
                    archetype = resolution.archetype,
                    confidence = resolution.confidence,
                    roleTitle = request.roleTitle.trim(),
                    roundType = roundType.dbValue,
                    language = request.language,
                    consentAudio = request.consentAudio,
                    consentVideo = request.consentVideo,
                    durationMinutes = request.durationMinutes,
                    declaredStage = declaredStage,
                    focusTopic = request.focusTopic,
                )
            } catch (e: DuplicateKeyException) {
                throw ApiException.conflict(
                    "Finish or leave your current interview before starting another one.",
                    code = "session_in_progress",
                )
            }
        // Same transaction as the check above, so two racing starts cannot both fit in
        // the last minutes of the day. Planned minutes, because the clock is what ends a
        // round and so the plan is what it can cost. A paid round is charged a credit at
        // start instead, and leaves the free allowance untouched.
        if (decision.funding == Entitlement.Funding.CREDIT) {
            repository.spendCredit(userId, sessionId, RoundLength.halfCreditsFor(request.durationMinutes))
        } else {
            repository.recordPracticeUsage(userId, sessionId, request.durationMinutes)
        }
        log
            .atInfo()
            .addKeyValue("user_id", userId)
            .addKeyValue("session_id", sessionId)
            .addKeyValue("funding", decision.funding?.name?.lowercase())
            .log("Round admitted")
        return sessionId
    }

    /**
     * Everything that needs the model, done with no transaction open, then the opening
     * turn written in one short one.
     */
    private fun composeAndOpen(
        userId: UUID,
        sessionId: UUID,
        request: StartSessionRequest,
        roundType: RoundType,
        resolution: ArchetypeResolution,
        background: CandidateBackground?,
        stage: CandidateStage,
        declaredStage: DeclaredStage?,
    ): SessionView {
        val brief =
            briefFor(
                company = request.companyName.trim(),
                resolution = resolution,
                role = request.roleTitle.trim(),
                roundType = roundType,
                language = request.language,
                background = background,
                declaredStage = declaredStage,
                focusTopic = request.focusTopic,
            )
        // A DSA or design round is conducted around material — a problem, or a case — and
        // its opening is templated from that rather than asked of the model separately.
        // One call, not two, on the path the candidate is already waiting on. When the bank
        // holds this company's questions for the round, the material *is* one of them. When
        // it holds none, a problem or case from the pool is used as it stands — no call at all.
        val workspaceRound = roundType in RoundWorkspaceComposer.ROUND_TYPES
        val bankRound = if (workspaceRound) bankRounds.forRound(request.companyName.trim(), roundType) else null
        val seed = bankRound?.let { bankRounds.next(userId, sessionId, it) }
        val fromPool =
            if (workspaceRound && bankRound == null) {
                poolRounds
                    .forRound(
                        request.companyName.trim(),
                        resolution.archetype,
                        roundType,
                        request.roleTitle,
                        background?.tenure?.totalExperienceMonths,
                    )?.let { poolRounds.next(userId, sessionId, it) }
                    ?.let { roundWorkspaceComposer.fromPool(it, roundType, request.durationMinutes) }
            } else {
                null
            }
        val workspace =
            fromPool ?: AiSpendContext.of(userId, sessionId) {
                roundWorkspaceComposer.compose(brief, roundType, request.durationMinutes, seed)
            }
        val warmupTurns = if (workspace == null) roundType.warmupTurns(request.durationMinutes) else 0
        val plan = InterviewPlan.opening(request.durationMinutes, warmupTurns = warmupTurns)

        val opening =
            workspace?.let {
                AskedQuestion(
                    text = it.openingQuestion,
                    questionBasis = it.basis,
                    questionProbes = it.probes,
                    questionAskedBecause = it.askedBecause,
                )
            } ?: try {
                AiSpendContext
                    .of(userId, sessionId) {
                        interviewAi.composeOpeningQuestion(
                            brief,
                            plan.toContext(stage, followUpLimit = roundType.followUpLimit),
                        )
                    }.value
            } catch (e: AiUnavailableException) {
                if (repository.failSessionAndRefundUsage(sessionId, userId)) {
                    recordEvent(userId, sessionId, "session_failed", outcome = "failed", errorType = "ai_unavailable")
                } else {
                    log.info("Session {} was already terminal when opening-question generation failed", sessionId)
                }
                log.warn("Opening question failed for session {}", sessionId, e)
                throw ApiException.upstreamUnavailable(
                    "The interviewer could not be reached just now. Nothing was charged — please try again.",
                )
            }

        inTransaction {
            workspace?.let {
                if (!repository.setWorkspace(sessionId, userId, it.json)) throw sessionStateChanged()
            }
            val opened =
                repository.insertTurn(
                    sessionId = sessionId,
                    userId = userId,
                    turnIndex = 0,
                    questionText = opening.text,
                    phase = plan.phase,
                    // Pending means "a voice is coming". Nothing is coming when the room
                    // speaks for itself, and saying otherwise leaves it polling for ever.
                    speechStatus = if (request.speaksLocally) SpeechStatus.UNAVAILABLE else SpeechStatus.PENDING,
                    provenanceJson =
                        provenanceJson(
                            company = request.companyName.trim(),
                            basis = opening.questionBasis,
                            probes = opening.questionProbes,
                            askedBecause = opening.questionAskedBecause,
                            bankQuestion = workspace?.bankQuestion,
                            poolQuestion = workspace?.poolQuestion,
                        ),
                    bankQuestionId = workspace?.bankQuestion?.id,
                    poolQuestionId = workspace?.poolQuestion?.question?.id,
                )
            if (!opened) throw sessionStateChanged()
            // Registered inside the transaction so it runs once the turn has committed —
            // the background renderer writes to the row this has just inserted.
            if (!request.speaksLocally) {
                questionSpeech.render(SpeechRequest(userId, sessionId, 0, opening.text, request.language))
            }
        }

        return view(userId, sessionId)
    }

    /**
     * Runs [block] in its own short transaction.
     *
     * Programmatic rather than `@Transactional`, because the whole point is to open and
     * close transactions *inside* one method — around the database writes and not around
     * the model call between them — and a self-invoked annotated method would not go
     * through the proxy at all.
     */
    private fun <T> inTransaction(block: () -> T): T = transactions.execute { block() }

    /**
     * Not `@Transactional` (task 056, L4): `interviewAi.assessAnswer` below is the slow
     * model call this whole method exists around, and an annotated method holds its
     * connection open for the whole call if it wraps it. The reads before the call (the
     * `already_answered` check included) run outside any transaction, same as they would
     * inside one under READ_COMMITTED — a bare `SELECT` takes no row lock either way, so
     * this does not narrow or widen the window a genuinely concurrent duplicate submit
     * races in. What changes is what happens after the call: every write that has to land
     * together — the answer record, then whichever of "mark the session completed" or
     * "insert the next turn" follows it — is now one `inTransaction` block below, so a
     * turn can never end up answered with no session-status change or next turn to match.
     */
    fun submitAnswer(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
        audio: AnswerAudio,
        /** The browser will read the next question out itself. See [StartSessionRequest]. */
        speaksLocally: Boolean = false,
        /**
         * The candidate pressed Submit mid-answer: assess this answer as the last one and
         * end the round, rather than asking another question they have chosen not to take.
         */
        endRound: Boolean = false,
        requestId: UUID = UUID.randomUUID(),
        /** The browser's measurement of this answer's speech timing, as JSON. See [AnswerTiming]. */
        timing: String? = null,
    ): SubmitAnswerResponse {
        // The start of "answer uploaded â†’ next question ready", recorded on answer_response_ready.
        val requestStartedAt = System.nanoTime()
        val claim = repository.claimAnswerRequest(sessionId, userId, turnIndex, requestId, ActiveLeaseRenewal.LEASE_SECONDS)
        when (claim.status) {
            TurnRequestClaimStatus.COMPLETED -> {
                return objectMapper.readValue(checkNotNull(claim.responseJson), SubmitAnswerResponse::class.java)
            }

            TurnRequestClaimStatus.IN_PROGRESS -> {
                throw requestInProgress()
            }

            TurnRequestClaimStatus.ACQUIRED,
            TurnRequestClaimStatus.UNAVAILABLE,
            -> {}
        }
        if (claim.status == TurnRequestClaimStatus.ACQUIRED) {
            recordEvent(userId, sessionId, "answer_request_claimed", turnIndex, requestId, outcome = "succeeded")
        }
        val heldLease = if (claim.status == TurnRequestClaimStatus.ACQUIRED) activeLeases.holdAnswer(requestId) else null
        var durable = false
        try {
            val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
            if (session.status != "in_progress") {
                throw ApiException.conflict("This interview is no longer running.", code = "session_not_running")
            }

            val turn =
                repository.findTurn(sessionId, userId, turnIndex)
                    ?: throw ApiException.notFound("That question is not part of this interview.")
            if (turn.answeredAt != null) {
                throw ApiException.conflict("That question has already been answered.", code = "already_answered")
            }
            if (claim.status != TurnRequestClaimStatus.ACQUIRED) throw sessionStateChanged()

            val roundType = RoundType.fromDbValue(session.roundType)
            val priorTurns =
                repository
                    .listTranscript(sessionId, userId)
                    .filter { it.turnIndex < turnIndex && it.answerTranscript != null }
                    .map { it.toTranscript() }
            val consecutiveFollowUps =
                priorTurns
                    .asReversed()
                    .takeWhile { it.nextAction in FOLLOW_UP_ACTIONS }
                    .size
            val mustMoveOn = consecutiveFollowUps >= roundType.followUpLimit

            // The plan for what happens next, decided here rather than by the model: this
            // answer is in the bag, so the count it is planned against includes it.
            val plan =
                InterviewPlan.forTurn(
                    turnIndex = turnIndex + 1,
                    answeredTurns = repository.countAnsweredTurns(sessionId, userId) + 1,
                    startedAt = session.enteredAt ?: session.startedAt,
                    durationMinutes = session.durationMinutes,
                    now = Instant.now(),
                    warmupTurns = if (session.workspace == null) roundType.warmupTurns(session.durationMinutes) else 0,
                )

            // A browser that resends an earlier recording gets the same transcript back, and the
            // model is paid to hear it twice. Caught by hash before any call (design review, 2f).
            // Not when the round is ending anyway, for the same reason as the echo check below.
            val audioSha256 = sha256Hex(audio.bytes)
            if (!endRound && !plan.outOfTime && audioSha256 in repository.answerAudioHashes(sessionId, userId)) {
                val refused = interviewerRules.audioHashGuard
                recordEvent(
                    userId,
                    sessionId,
                    "echo_detected",
                    turnIndex,
                    requestId,
                    outcome = if (refused) "applied" else "shadow",
                    reason = "audio_hash",
                )
                if (refused) throw echoedAnswer(userId, sessionId, turnIndex, requestId)
            }
            // The server knows before the call whether this answer is the last one, and asks for a
            // shape that only allows what that turn can do (design review, 2a).
            val finalTurn = endRound || plan.mustConclude
            val variant =
                when {
                    !interviewerRules.finalVariant -> AssessmentVariant.LEGACY
                    finalTurn -> AssessmentVariant.FINAL
                    else -> AssessmentVariant.TURN
                }

            val resolution =
                ArchetypeResolution(Archetype.fromDbValue(session.archetype), confidenceOf(session.archetypeConfidence))
            // The question planned for the next turn, if the round has one to offer. Never in the
            // warm-up or once the round is closing, and never in a workspace round, whose material
            // already is the question. The first question of the round proper must be it.
            val askNow = plan.briefTheCandidate || mustMoveOn
            val background = resumeService.backgroundFor(userId)
            val plannedWasConsidered =
                session.workspace == null &&
                    roundType != RoundType.CUSTOM_TOPIC &&
                    !plan.mustConclude &&
                    (plan.phase == TurnPhase.MAIN || askNow)
            val planned =
                if (plannedWasConsidered) {
                    plannedQuestion(userId, session, roundType, resolution.archetype, background?.tenure?.totalExperienceMonths)
                } else {
                    null
                }
            val brief =
                briefFor(
                    company = session.companyName,
                    resolution = resolution,
                    role = session.roleTitle,
                    roundType = roundType,
                    language = session.language,
                    background = background,
                    planned = planned?.let { PlannedQuestion(it.text, session.companyName, askNow, reported = it is PlannedFrom.Bank) },
                    declaredStage = session.declaredStage,
                    focusTopic = session.focusTopic,
                )

            val assessmentStartedAt = System.nanoTime()
            recordEvent(userId, sessionId, "answer_assessment_started", turnIndex, requestId, outcome = "started")
            val assessment =
                try {
                    AiSpendContext.ofInterview(userId, sessionId, turnIndex, requestId) {
                        interviewAi.assessAnswer(
                            brief = brief,
                            round =
                                plan.toContext(
                                    CandidateStage.of(
                                        session.roleTitle,
                                        background?.tenure?.totalExperienceMonths,
                                        declaredStage = session.declaredStage,
                                    ),
                                    followUpLimit = roundType.followUpLimit,
                                    mustMoveOn = mustMoveOn,
                                    variant = variant,
                                ),
                            priorTurns = priorTurns,
                            currentQuestion = turn.questionText,
                            answer = audio,
                        )
                    }
                } catch (e: AiUnavailableException) {
                    recordEvent(
                        userId,
                        sessionId,
                        "answer_assessment_failed",
                        turnIndex,
                        requestId,
                        outcome = "failed",
                        errorType = "ai_unavailable",
                        durationMs = elapsedMillis(assessmentStartedAt),
                        reason = e.reason.dbValue,
                        finishReason = e.finishReason,
                    )
                    if (repository.failSessionAndRefundUsage(sessionId, userId)) {
                        recordEvent(
                            userId,
                            sessionId,
                            "session_failed",
                            turnIndex,
                            requestId,
                            outcome = "failed",
                            errorType = "ai_unavailable",
                        )
                    } else {
                        log.info("Session {} was already terminal when answer assessment failed", sessionId)
                    }
                    log.warn("Answer assessment failed for session {} turn {}", sessionId, turnIndex, e)
                    throw ApiException.upstreamUnavailable(
                        "We could not process that answer. The interview has been stopped rather than scored unfairly.",
                    )
                } catch (e: RuntimeException) {
                    recordEvent(
                        userId,
                        sessionId,
                        "answer_assessment_failed",
                        turnIndex,
                        requestId,
                        outcome = "failed",
                        errorType = "unknown",
                        durationMs = elapsedMillis(assessmentStartedAt),
                    )
                    throw e
                }
            recordEvent(
                userId,
                sessionId,
                "answer_assessment_succeeded",
                turnIndex,
                requestId,
                outcome = "succeeded",
                durationMs = elapsedMillis(assessmentStartedAt),
            )

            // A transcript identical to an earlier answer is a failed transcription. Nothing is
            // recorded, the claim is released in `finally`, and the room asks for the answer
            // again. Not when the round is ending anyway: the clock and the End button both
            // mean there is no "again" to ask for. The previous answer has always been checked;
            // every earlier one is checked with `echo-all-answers` (design review, 2f).
            val echo =
                if (!endRound && !plan.outOfTime) {
                    EchoedAnswer.matchOf(assessment.value.transcript, priorTurns.map { it.answerTranscript })
                } else {
                    null
                }
            if (echo != null) {
                val refused = echo == EchoedAnswer.Match.PREVIOUS || interviewerRules.echoAllAnswers
                recordEvent(
                    userId,
                    sessionId,
                    "echo_detected",
                    turnIndex,
                    requestId,
                    outcome = if (refused) "applied" else "shadow",
                    reason = echo.reason,
                )
                if (refused) throw echoedAnswer(userId, sessionId, turnIndex, requestId)
            }

            val suggestedAction = normaliseAction(assessment.value.suggestedNextAction)
            // The model advises how to continue; it does not own the clock. It sometimes
            // returned `conclude` after one or two short answers, which completed the
            // session and made a report out of almost no evidence. Only the engine's
            // clock/turn ceiling or the candidate's explicit submit may end a round.
            val nextAction =
                if (mustMoveOn || (suggestedAction == "conclude" && !plan.mustConclude)) {
                    "move_on"
                } else {
                    suggestedAction
                }
            val intervention = Intervention.parse(assessment.value.intervention)
            interviewEvents.record(
                InterviewEvent(
                    userId = userId,
                    sessionId = sessionId,
                    type = "interviewer_decision",
                    turnIndex = turnIndex,
                    requestId = requestId,
                    action = nextAction,
                    intervention = intervention.wireValue,
                    // Which model actually decided this turn: the primary, or the one behind it.
                    model = assessment.usage.model,
                    finishReason = assessment.usage.finishReason,
                ),
            )
            // Diagnostic only. The browser heard nothing loud enough to be speech; the model
            // was still asked, and whatever it heard stands.
            val measuredTiming = AnswerTiming.parse(timing, objectMapper)
            if (measuredTiming != null && measuredTiming.firstSoundMs == null) {
                recordEvent(userId, sessionId, "no_speech_heard", turnIndex, requestId, reason = "browser_silent")
            }
            // Diagnostic only, never a reason to refuse: short, slow and code-switched answers are
            // all real answers. An implausible pace is a hint the transcript and the audio disagree.
            AnswerPace.outOfRange(assessment.value.transcript, measuredTiming)?.let {
                recordEvent(userId, sessionId, "answer_pace_out_of_range", turnIndex, requestId, reason = it)
            }
            // Rule events for the next line, written once the turn has committed.
            val guardEvents = mutableListOf<GuardEvent>()
            // What reached the candidate over the length limit, and where it came from. Counted
            // after the transaction commits, so a rolled-back turn is not counted.
            var overLimitReason: String? = null
            // Everything from here down writes to the database, and has to land together: the
            // answer record, then whichever of "mark the session completed" or "insert the
            // next turn" follows it. One `inTransaction` block, opened only now that the model
            // call is behind us, so a crash or exception partway through can never leave a turn
            // answered with no session-status change or next turn to match it (task 056, L4).
            val persistStartedAt = System.nanoTime()
            recordEvent(userId, sessionId, "answer_persist_started", turnIndex, requestId, outcome = "started")
            val response =
                try {
                    inTransaction {
                        val recorded =
                            repository.recordAnswer(
                                sessionId = sessionId,
                                userId = userId,
                                turnIndex = turnIndex,
                                transcript = assessment.value.transcript,
                                videoPath = null,
                                assessmentJson = objectMapper.writeValueAsString(assessment.value),
                                nextAction = nextAction,
                                intervention = intervention.wireValue,
                                // Only keep a note when help was actually given, so the report cannot
                                // report assistance that did not happen.
                                interventionNote = assessment.value.interventionNote?.takeIf { intervention.isAssisted },
                                deliveryNote = assessment.value.deliveryObservation?.takeIf { it.isNotBlank() },
                                // Re-serialised from the validated value, so what is stored is only
                                // ever a consistent measurement, never whatever the request carried.
                                timingJson = measuredTiming?.let { objectMapper.writeValueAsString(it) },
                                requestId = requestId,
                                audioSha256 = audioSha256,
                            )
                        if (!recorded) throw sessionStateChanged()

                        val answered = repository.countAnsweredTurns(sessionId, userId)
                        // The clock ends the round. `mustConclude` also covers the turn ceiling, which is
                        // there so a runaway session cannot run up an unbounded model bill.
                        val shouldConclude = endRound || plan.mustConclude
                        if (shouldConclude) {
                            if (!repository.markSessionStatus(sessionId, userId, "completed")) throw sessionStateChanged()
                            return@inTransaction persistAnswerResponse(
                                sessionId,
                                userId,
                                turnIndex,
                                requestId,
                                SubmitAnswerResponse(
                                    sessionComplete = true,
                                    turnsCompleted = answered,
                                    nextTurn = null,
                                    // The clock wins over the button. When time runs out the room submits the
                                    // answer in progress itself, and it arrives here looking exactly like a
                                    // candidate pressing Submit — thanking them for a decision they did not make
                                    // would be the machine not noticing what happened.
                                    closingRemark =
                                        ClosingRemark.forRound(
                                            ranOutOfTime = plan.outOfTime,
                                            endedByCandidate = endRound && !plan.outOfTime,
                                        ),
                                ),
                            )
                        }

                        // Trimmed here rather than trusted to the prompt: three rounds of telling the
                        // model not to open with "That's a great overview" did not stop it. A missing
                        // question is a malformed continuation, not permission to manufacture a
                        // two-answer report, so a conservative scope-bound question keeps it alive.
                        val modelText =
                            assessment.value.nextQuestionText
                                ?.let { QuestionText.withoutPreamble(it) }
                                ?.takeIf { it.isNotBlank() }

                        // Whether this turn asks the planned question is the engine's call, checked against
                        // its stored wording; a drifted question is replaced after its lead-in. Then the
                        // server's rules on the line itself (design review, 2b–2e).
                        val choice =
                            chooseNextLine(
                                modelText = modelText,
                                modelSaysAskedPlanned = assessment.value.askedPlannedQuestion,
                                planned = planned,
                                plannedWasConsidered = plannedWasConsidered,
                                askNow = askNow,
                                plan = plan,
                                fallbackContext = FallbackContext(userId, session, roundType, resolution.archetype, background),
                                answered = answered,
                                askedSoFar = priorTurns.map { it.questionText } + turn.questionText,
                                helpGiven = nextAction in HELP_ACTIONS || intervention.isAssisted,
                                events = guardEvents,
                            )
                        val askedFrom = choice.askedFrom
                        val nextText = choice.text
                        if (nextText.length > QuestionLength.MAX_CHARS) {
                            overLimitReason =
                                when {
                                    plan.briefTheCandidate -> "briefing"
                                    askedFrom != null && nextText == askedFrom.text.trim() -> "planned_stored"
                                    else -> "model_written"
                                }
                        }
                        val nextIndex = turnIndex + 1
                        val inserted =
                            repository.insertTurn(
                                sessionId = sessionId,
                                userId = userId,
                                turnIndex = nextIndex,
                                questionText = nextText,
                                phase = plan.phase,
                                // Pending means "a voice is coming". Nothing is coming when the room
                                // speaks for itself, and saying otherwise leaves it polling for ever.
                                speechStatus = if (speaksLocally) SpeechStatus.UNAVAILABLE else SpeechStatus.PENDING,
                                provenanceJson =
                                    provenanceJson(
                                        company = session.companyName,
                                        // What the model said about a question it did not get to ask describes
                                        // nothing the candidate heard, so it goes with the replaced line.
                                        basis = assessment.value.questionBasis.takeIf { !choice.replaced },
                                        probes = assessment.value.questionProbes.takeIf { choice.faithful },
                                        askedBecause = assessment.value.questionAskedBecause.takeIf { choice.faithful },
                                        bankQuestion = (askedFrom as? PlannedFrom.Bank)?.question,
                                        poolQuestion = askedFrom as? PlannedFrom.Pool,
                                    ),
                                bankQuestionId = (askedFrom as? PlannedFrom.Bank)?.question?.id,
                                poolQuestionId = (askedFrom as? PlannedFrom.Pool)?.question?.id,
                            )
                        if (!inserted) throw sessionStateChanged()
                        // Nothing to synthesise when the room is going to say it: that call is the single
                        // most expensive thing in a turn and it would be thrown away. Registered inside
                        // the transaction, same as `composeAndOpen`, so it runs once the turn this reads
                        // has actually committed.
                        if (!speaksLocally) {
                            questionSpeech.render(SpeechRequest(userId, sessionId, nextIndex, nextText, session.language))
                        }

                        // The question goes back in writing straight away and its voice follows, which
                        // the room asks for separately. A candidate ready to start talking should not be
                        // held behind audio they may well talk over.
                        persistAnswerResponse(
                            sessionId,
                            userId,
                            turnIndex,
                            requestId,
                            SubmitAnswerResponse(
                                sessionComplete = false,
                                turnsCompleted = answered,
                                nextTurn =
                                    TurnView(
                                        turnIndex = nextIndex,
                                        questionText = nextText,
                                        questionAudioUrl = null,
                                        questionAudioStatus = SpeechStatus.PENDING.dbValue,
                                        phase = plan.phase.dbValue,
                                        answered = false,
                                    ),
                            ),
                        )
                    }
                } catch (e: RuntimeException) {
                    recordEvent(
                        userId,
                        sessionId,
                        "answer_persist_failed",
                        turnIndex,
                        requestId,
                        outcome = "failed",
                        errorType = "database_write_failed",
                        durationMs = elapsedMillis(persistStartedAt),
                    )
                    throw e
                }
            recordEvent(
                userId,
                sessionId,
                "answer_persist_succeeded",
                turnIndex,
                requestId,
                outcome = "succeeded",
                durationMs = elapsedMillis(persistStartedAt),
            )
            durable = true
            overLimitReason?.let {
                recordEvent(userId, sessionId, "question_over_limit", turnIndex + 1, requestId, outcome = "ready", reason = it)
            }
            guardEvents.forEach {
                recordEvent(userId, sessionId, it.type, turnIndex + 1, requestId, outcome = it.outcome, reason = it.reason)
            }
            recordEvent(
                userId,
                sessionId,
                "answer_response_ready",
                turnIndex,
                requestId,
                outcome = "ready",
                durationMs = elapsedMillis(requestStartedAt),
            )
            if (response.sessionComplete) {
                recordEvent(userId, sessionId, "session_completed", turnIndex, requestId, outcome = "succeeded")
            }
            return response
        } finally {
            heldLease?.close()
            if (!durable && claim.status == TurnRequestClaimStatus.ACQUIRED) {
                runCatching { repository.releaseAnswerRequest(sessionId, userId, turnIndex, requestId) }
                    .onFailure { log.warn("Could not release answer request {} after failure", requestId, it) }
            }
        }
    }

    /**
     * A nudge on the question the candidate is currently stuck on.
     *
     * One per question, and recorded against them. A candidate frozen on a question had
     * no move but silence before this, which is neither realistic — a real interviewer
     * nudges — nor useful, because a round that stalls produces nothing to score. Making
     * help askable is only fair to everyone else if asking is also counted, so the level
     * the model judges it at is stored and weighed in the report.
     *
     * A hint that cannot be produced does not fail the session. Unlike an assessment,
     * nothing is being scored here, so the round carries on without one.
     *
     * Not `@Transactional` (task 056, L4): `interviewAi.offerHint` below is the same shape
     * of slow model call `submitAnswer` holds a connection open across. There is exactly
     * one write after it (`recordHint`), so it needs no multi-statement atomicity — just to
     * not run inside the same transaction as the call in front of it.
     */
    fun requestHint(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
        requestId: UUID = UUID.randomUUID(),
    ): HintView {
        val claim = repository.claimHintRequest(sessionId, userId, turnIndex, requestId, ActiveLeaseRenewal.LEASE_SECONDS)
        when (claim.status) {
            TurnRequestClaimStatus.COMPLETED -> {
                return objectMapper.readValue(checkNotNull(claim.responseJson), HintView::class.java)
            }

            TurnRequestClaimStatus.IN_PROGRESS -> {
                throw requestInProgress()
            }

            TurnRequestClaimStatus.ACQUIRED,
            TurnRequestClaimStatus.UNAVAILABLE,
            -> {}
        }
        val heldLease = if (claim.status == TurnRequestClaimStatus.ACQUIRED) activeLeases.holdHint(requestId) else null
        var durable = false
        try {
            val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
            if (session.status != "in_progress") {
                throw ApiException.conflict("This interview is no longer running.", code = "session_not_running")
            }

            val turn =
                repository.findTurn(sessionId, userId, turnIndex)
                    ?: throw ApiException.notFound("That question is not part of this interview.")
            if (turn.answeredAt != null) {
                throw ApiException.conflict("That question has already been answered.", code = "already_answered")
            }

            // Asking twice returns the same hint rather than buying a second one. Idempotent
            // because a dropped response or a double click should not cost the candidate
            // more credit than they asked to spend.
            turn.hintText?.let { existing ->
                val level = Intervention.parse(turn.hintLevel)
                return HintView(turnIndex, existing, level.wireValue, level.label)
            }
            if (claim.status != TurnRequestClaimStatus.ACQUIRED) throw sessionStateChanged()

            val roundType = RoundType.fromDbValue(session.roundType)
            val resolution =
                ArchetypeResolution(Archetype.fromDbValue(session.archetype), confidenceOf(session.archetypeConfidence))
            // The resume is read here too, so a hint is pitched at the same candidate the
            // round is: a student asking for help should not be handed a mid-level nudge.
            val background = resumeService.backgroundFor(userId)
            val stage =
                CandidateStage.of(
                    session.roleTitle,
                    background?.tenure?.totalExperienceMonths,
                    declaredStage = session.declaredStage,
                )
            val brief =
                briefFor(
                    company = session.companyName,
                    resolution = resolution,
                    role = session.roleTitle,
                    roundType = roundType,
                    language = session.language,
                    background = background,
                    declaredStage = session.declaredStage,
                    focusTopic = session.focusTopic,
                )
            val plan =
                InterviewPlan.forTurn(
                    turnIndex = turnIndex,
                    answeredTurns = repository.countAnsweredTurns(sessionId, userId),
                    startedAt = session.enteredAt ?: session.startedAt,
                    durationMinutes = session.durationMinutes,
                    now = Instant.now(),
                    warmupTurns = if (session.workspace == null) roundType.warmupTurns(session.durationMinutes) else 0,
                )
            val priorTurns =
                repository
                    .listTranscript(sessionId, userId)
                    .filter { it.turnIndex < turnIndex && it.answerTranscript != null }
                    .map { it.toTranscript() }

            val offered =
                try {
                    AiSpendContext.of(userId, sessionId) {
                        interviewAi.offerHint(
                            brief,
                            plan.toContext(stage, followUpLimit = roundType.followUpLimit),
                            priorTurns,
                            turn.questionText,
                        )
                    }
                } catch (e: AiUnavailableException) {
                    log.warn("Hint unavailable for session {} turn {}", sessionId, turnIndex, e)
                    throw ApiException.upstreamUnavailable(
                        "The interviewer could not be reached for that. Your round is unaffected - answer as best you can.",
                    )
                }

            // A level the model did not supply must not read as free help, so anything
            // unrecognised falls to `hinted` rather than to `none`.
            val level = Intervention.parse(offered.value.assistanceLevel).takeIf { it.isAssisted } ?: Intervention.HINTED
            val response = HintView(turnIndex, offered.value.text, level.wireValue, level.label)
            inTransaction {
                if (!repository.recordHint(
                        sessionId,
                        userId,
                        turnIndex,
                        offered.value.text,
                        level.wireValue,
                        requestId,
                        objectMapper.writeValueAsString(response),
                    )
                ) {
                    throw sessionStateChanged()
                }
            }

            durable = true
            return response
        } finally {
            heldLease?.close()
            if (!durable && claim.status == TurnRequestClaimStatus.ACQUIRED) {
                runCatching { repository.releaseHintRequest(sessionId, userId, turnIndex, requestId) }
                    .onFailure { log.warn("Could not release hint request {} after failure", requestId, it) }
            }
        }
    }

    fun abandon(
        userId: UUID,
        sessionId: UUID,
    ) {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (session.status == "in_progress") {
            val abandoned = repository.markSessionStatus(sessionId, userId, "abandoned")
            if (abandoned) recordEvent(userId, sessionId, "session_abandoned", outcome = "succeeded")
            if (!abandoned && repository.findSession(sessionId, userId)?.status == "in_progress") {
                throw sessionStateChanged()
            }
        }
    }

    /**
     * Runs the candidate's code for a session they own.
     *
     * Ownership is the whole authorisation story: without the session check this is an
     * open code-execution endpoint. The round's state is deliberately not consulted
     * beyond that — someone re-running their solution after the clock stopped, while they
     * wait for the report, is doing something reasonable.
     */
    fun runCode(
        userId: UUID,
        sessionId: UUID,
        request: RunCodeRequest,
    ): CodeRunResult {
        repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        val language =
            CodeLanguage.parse(request.language)
                ?: throw ApiException.badRequest("This round takes Python or Java.")
        return codeRunner.run(language, request.source, request.stdin)
    }

    /** Stores the board, so a reload does not lose twenty minutes of drawing. */
    fun saveBoard(
        userId: UUID,
        sessionId: UUID,
        board: JsonNode,
    ) {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (session.status != "in_progress") throw sessionStateChanged()
        val encoded = objectMapper.writeValueAsBytes(board)
        if (encoded.size > MAX_BOARD_BYTES) {
            throw ApiException(HttpStatus.CONTENT_TOO_LARGE, "board_too_large", "This board is too large to save (5 MB maximum).")
        }
        if (!repository.setBoard(sessionId, userId, String(encoded, Charsets.UTF_8))) throw sessionStateChanged()
    }

    /**
     * The candidate has said all they want to say: end the round now and let the report
     * be written from what they have answered.
     *
     * This is the opposite of [abandon]. Leaving forfeits the round — no report, and it is
     * not counted as practice. Submitting completes it: the answers given so far are
     * assessed exactly as they would be had the clock run out.
     *
     * A round with nothing answered has nothing to assess, so it cannot be submitted; the
     * room only offers the button once there is an answer on the record.
     */
    @Transactional
    fun finish(
        userId: UUID,
        sessionId: UUID,
    ): SubmitAnswerResponse {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (session.status != "in_progress") {
            throw ApiException.conflict("This interview is no longer running.", code = "session_not_running")
        }
        val answered = repository.countAnsweredTurns(sessionId, userId)
        if (answered == 0) {
            throw ApiException.conflict(
                "Answer at least one question before submitting — there is nothing to assess yet.",
                code = "nothing_to_assess",
            )
        }
        // Also how the room ends a round whose clock has run out between answers, so the
        // goodbye says which of the two it was.
        val outOfTime =
            InterviewPlan
                .forTurn(
                    turnIndex = answered,
                    answeredTurns = answered,
                    startedAt = session.enteredAt ?: session.startedAt,
                    durationMinutes = session.durationMinutes,
                    now = Instant.now(),
                ).outOfTime
        if (!repository.markSessionStatus(sessionId, userId, "completed")) throw sessionStateChanged()
        recordEvent(userId, sessionId, "session_completed", outcome = "succeeded")
        return SubmitAnswerResponse(
            sessionComplete = true,
            turnsCompleted = answered,
            nextTurn = null,
            closingRemark = ClosingRemark.forRound(ranOutOfTime = outOfTime, endedByCandidate = !outOfTime),
        )
    }

    /**
     * The candidate has entered the room, so the round's clock starts now — not when the
     * session row was written, which was before the problem existed and before the device
     * check. Idempotent: see [SessionRepository.startClock]. Returns the session with the
     * deadline the room should count down to.
     */
    fun begin(
        userId: UUID,
        sessionId: UUID,
    ): SessionView {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (session.status != "in_progress") throw sessionStateChanged()
        if (repository.startClock(sessionId, userId)) {
            recordEvent(userId, sessionId, "room_entered", outcome = "succeeded")
        }
        return view(userId, sessionId)
    }

    private fun sessionStateChanged() =
        ApiException.conflict(
            "This interview changed while the request was being processed. Refresh to see its current state.",
            code = "session_state_changed",
        )

    private fun requestInProgress() =
        ApiException.conflict(
            "This request is already being processed. Retry it with the same request ID in a moment.",
            code = "request_in_progress",
        )

    private fun recordEvent(
        userId: UUID,
        sessionId: UUID,
        type: String,
        turnIndex: Int? = null,
        requestId: UUID? = null,
        outcome: String? = null,
        errorType: String? = null,
        durationMs: Long? = null,
        reason: String? = null,
        finishReason: String? = null,
    ) {
        interviewEvents.record(
            InterviewEvent(
                userId = userId,
                sessionId = sessionId,
                type = type,
                turnIndex = turnIndex,
                requestId = requestId,
                outcome = outcome,
                errorType = errorType,
                durationMs = durationMs,
                reason = reason,
                finishReason = finishReason,
            ),
        )
    }

    private fun elapsedMillis(startedAt: Long): Long = (System.nanoTime() - startedAt) / 1_000_000

    /** Records a refused answer and returns the error the room shows: "please give it again". */
    private fun echoedAnswer(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
        requestId: UUID,
    ): ApiException {
        recordEvent(userId, sessionId, "answer_rejected", turnIndex, requestId, outcome = "failed", errorType = "echoed_transcript")
        return ApiException.unprocessable("We didn't catch that answer clearly. Please give it again.", code = EchoedAnswer.ERROR_CODE)
    }

    /** A rule event for the next line, held until the turn commits. */
    private data class GuardEvent(
        val type: String,
        val outcome: String,
        val reason: String,
    )

    /** What a fallback needs to look up a planned question the turn did not already have. */
    private data class FallbackContext(
        val userId: UUID,
        val session: SessionRow,
        val roundType: RoundType,
        val archetype: Archetype,
        val background: CandidateBackground?,
    )

    /** The line the candidate hears next, and where it came from. */
    private data class NextLine(
        val text: String,
        /** The planned question this line asks, when it asks one. Its id is stored with the turn. */
        val askedFrom: PlannedFrom?,
        /** False when the words are not the model's own; its notes on the question are then dropped. */
        val faithful: Boolean,
        /** True when a server rule replaced the model's line altogether. */
        val replaced: Boolean = false,
    )

    /**
     * The next line, after the server's rules have had their say (design review, step 2).
     *
     * Every rule in [TurnGuards] runs on every turn. A rule whose flag is off changes nothing and
     * writes a `shadow` event; one whose flag is on replaces the line with the round's planned
     * question — the one the selector already holds, or one looked up now — and writes `applied`.
     * With no stored question to fall back on, the generic continuation is used and the
     * fallback event's outcome is `unavailable`: the alert that this round had nothing to give.
     * A custom-topic round's continuation is written around its own topic, so for it that is
     * the intended fallback, not an alert.
     *
     * With every flag off the line is exactly what it was before these rules existed.
     */
    private fun chooseNextLine(
        modelText: String?,
        modelSaysAskedPlanned: Boolean?,
        planned: PlannedFrom?,
        plannedWasConsidered: Boolean,
        askNow: Boolean,
        plan: TurnPlan,
        fallbackContext: FallbackContext,
        answered: Int,
        askedSoFar: List<String>,
        helpGiven: Boolean,
        events: MutableList<GuardEvent>,
    ): NextLine {
        val rules = interviewerRules
        val resolved = modelText?.let { PlannedQuestionCheck.resolveText(planned?.text, askNow, modelSaysAskedPlanned, it) }
        val facts =
            TurnGuards.TurnFacts(
                briefing = plan.briefTheCandidate,
                askedSoFar = askedSoFar,
                reAskAllowed = helpGiven && !TurnGuards.wasReAsk(askedSoFar, rules.repeatThreshold),
            )
        val violations =
            TurnGuards.violations(
                TurnGuards.NextLine(resolved?.text, resolved?.askedPlanned == true, planned?.text),
                facts,
                rules,
            )
        violations
            .filter { it != TurnGuards.Rule.NO_QUESTION }
            .forEach { events += GuardEvent(it.event, if (it.enabledIn(rules)) "applied" else "shadow", it.reason) }

        val applied = violations.firstOrNull { it.enabledIn(rules) }
        val roundType = fallbackContext.roundType
        if (applied == null) {
            if (resolved != null) return NextLine(resolved.text, planned?.takeIf { resolved.askedPlanned }, resolved.faithful)
            // No question, and the planned fallback is off: the line it has always been.
            events += GuardEvent(TurnGuards.Rule.NO_QUESTION.event, "shadow", TurnGuards.Rule.NO_QUESTION.reason)
            val filler =
                PlannedQuestionCheck.resolveText(
                    planned?.text,
                    askNow,
                    modelSaysAskedPlanned,
                    continuationQuestion(roundType, fallbackContext.session.focusTopic, answered),
                )
            return NextLine(filler.text, planned?.takeIf { filler.askedPlanned }, filler.faithful)
        }

        val fallback = planned ?: if (plannedWasConsidered) null else fallbackPlanned(fallbackContext, plan)
        if (fallback != null) {
            events += GuardEvent("planned_fallback_used", "applied", applied.reason)
            return NextLine(fallback.text.trim(), fallback, faithful = false, replaced = true)
        }
        val outcome = if (roundType == RoundType.CUSTOM_TOPIC) "applied" else "unavailable"
        events += GuardEvent("planned_fallback_used", outcome, applied.reason)
        return NextLine(
            continuationQuestion(roundType, fallbackContext.session.focusTopic, answered),
            askedFrom = null,
            faithful = false,
            replaced = true,
        )
    }

    /**
     * A planned question for a turn that was not offered one: the closing phase, and turns where
     * the model was not due to move on. Not in the warm-up, whose beats are the server's own;
     * not in a workspace round, whose material already is the question; not in a custom-topic
     * round, which has no bank or pool.
     */
    private fun fallbackPlanned(
        context: FallbackContext,
        plan: TurnPlan,
    ): PlannedFrom? {
        if (context.session.workspace != null || context.roundType == RoundType.CUSTOM_TOPIC) return null
        if (plan.phase == TurnPhase.WARMUP) return null
        return plannedQuestion(
            context.userId,
            context.session,
            context.roundType,
            context.archetype,
            context.background?.tenure?.totalExperienceMonths,
        )
    }

    private fun sha256Hex(bytes: ByteArray): String =
        MessageDigest
            .getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { "%02x".format(it) }

    private fun persistAnswerResponse(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        requestId: UUID,
        response: SubmitAnswerResponse,
    ): SubmitAnswerResponse {
        if (!repository.completeAnswerRequest(
                sessionId,
                userId,
                turnIndex,
                requestId,
                objectMapper.writeValueAsString(response),
            )
        ) {
            throw sessionStateChanged()
        }
        return response
    }

    fun view(
        userId: UUID,
        sessionId: UUID,
    ): SessionView {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        val latest = repository.findLatestTurn(sessionId, userId)
        val archetype = Archetype.fromDbValue(session.archetype)
        val confidence = confidenceOf(session.archetypeConfidence)
        val roundType = RoundType.fromDbValue(session.roundType)
        val workspace = session.workspace?.let(objectMapper::readTree)
        // A workspace round is either set on a bank question or it is not, and the workspace
        // says which; a spoken round is described by what the bank holds for it.
        val sourcedQuestions =
            if (workspace != null) {
                if (workspace.path("bankQuestionId").isString) 1 else 0
            } else {
                bankRounds.questionCount(session.companyName, roundType)
            }

        return SessionView(
            id = session.id,
            companyName = session.companyName,
            archetype = archetype.dbValue,
            archetypeLabel = archetype.label,
            archetypeConfidence = confidence.dbValue,
            groundingNote = candidateFacingNote(session.companyName, archetype, confidence, roundType, sourcedQuestions),
            roleTitle = session.roleTitle,
            roundType = roundType.dbValue,
            roundLabel = roundType.label,
            language = session.language,
            status = session.status,
            consentVideo = session.consentVideo,
            startedAt = session.enteredAt ?: session.startedAt,
            endedAt = session.endedAt,
            durationMinutes = session.durationMinutes,
            // The deadline is the server's, so a client clock that drifts or a tab that
            // sleeps cannot buy the candidate extra time.
            scheduledEndAt = session.enteredAt?.plus(Duration.ofMinutes(session.durationMinutes.toLong())),
            turnsCompleted = repository.countAnsweredTurns(sessionId, userId),
            maxTurns = InterviewPlan.maxTurnsFor(session.durationMinutes),
            workspace = workspace,
            board = session.board?.let(objectMapper::readTree),
            currentTurn =
                latest
                    ?.takeIf { it.answeredAt == null }
                    ?.let { turnViewOf(it, userId, sessionId) },
            focusTopic = session.focusTopic,
        )
    }

    /**
     * One turn, so the room can pick up the interviewer's voice once it has rendered.
     *
     * This is a poll rather than a push because the thing being waited on is small, the
     * wait is a few seconds, and a candidate who starts answering before the voice lands
     * has lost nothing — the question was already in front of them in writing.
     */
    fun turn(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
    ): TurnView {
        repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        val turn =
            repository.findTurn(sessionId, userId, turnIndex)
                ?: throw ApiException.notFound("That question is not part of this interview.")
        return turnViewOf(turn, userId, sessionId)
    }

    /**
     * The question a spoken round plans next, in the task-042 order: the sourced bank when
     * it holds anything for this company and round type — it keeps first claim, exactly as
     * before — and the AI pool only when it holds nothing. Null means live questions.
     */
    private fun plannedQuestion(
        userId: UUID,
        session: SessionRow,
        roundType: RoundType,
        archetype: Archetype,
        experienceMonths: Int?,
    ): PlannedFrom? {
        bankRounds.forRound(session.companyName, roundType)?.let { round ->
            return bankRounds.next(userId, session.id, round)?.let { PlannedFrom.Bank(it) }
        }
        return poolRounds
            .forRound(session.companyName, archetype, roundType, session.roleTitle, experienceMonths)
            ?.let { poolRounds.next(userId, session.id, it) }
    }

    /**
     * Why a question was asked, ready to store.
     *
     * Decided per turn: [bankQuestion] is the bank question this turn asked, or null. A
     * turn that asked one is `published_source`, citing that question's sources and no
     * others; a turn that asked [poolQuestion] is `model_knowledge` with that question's
     * label; every other turn — follow-ups included, in a round full of bank questions —
     * is `model_knowledge`. The model never gets a vote either way.
     */
    private fun provenanceJson(
        company: String,
        basis: String?,
        probes: String?,
        askedBecause: String?,
        bankQuestion: BankQuestion?,
        poolQuestion: PlannedFrom.Pool? = null,
    ): String? {
        val provenance =
            when {
                bankQuestion != null -> QuestionProvenance.fromBank(bankQuestion, company, probes, askedBecause)
                poolQuestion != null -> QuestionProvenance.fromPool(poolQuestion.label, probes, askedBecause)
                else -> QuestionProvenance.fromModel(basis, probes, askedBecause)
            }
        return provenance?.let { objectMapper.writeValueAsString(it) }
    }

    /**
     * A bounded page of a candidate's past rounds, with the retention rule applied.
     *
     * The expiry date is computed here rather than in the browser, and the window itself
     * is sent along on every row, because how long a report is kept is server policy — one
     * property in `application.yml`. A client that hardcoded "28 days" into a sentence
     * would keep saying it on the day somebody changed the property, and the client that
     * matters most is the mobile app that does not exist yet and cannot be edited in the
     * same release.
     */
    fun list(
        userId: UUID,
        limit: Int,
        offset: Int,
    ): List<SessionSummary> =
        repository.listSessions(userId, limit.coerceIn(1, MAX_SESSION_PAGE), offset.coerceAtLeast(0)).map { row ->
            SessionSummary(
                id = row.id,
                companyName = row.companyName,
                roleTitle = row.roleTitle,
                roundType = row.roundType,
                status = row.status,
                startedAt = row.startedAt,
                endedAt = row.endedAt,
                hasReport = row.hasReport,
                reportExpired = row.reportExpiredAt != null,
                // Null once it has expired: there is no future date to show for a report
                // that has already gone, and a client rendering one would be promising
                // something that is not there.
                reportExpiresAt =
                    row.retentionFrom
                        ?.takeIf { row.reportExpiredAt == null }
                        ?.let { retentionProperties.expiresAt(it) },
                reportRetentionDays = retentionProperties.days,
            )
        }

    /**
     * A turn as the room sees it.
     *
     * The URL is signed only once the speech is actually `ready`. A `pending` turn that
     * happened to carry a stale path would otherwise hand the room a URL to nothing.
     */
    private fun turnViewOf(
        turn: TurnRow,
        userId: UUID,
        sessionId: UUID,
    ): TurnView {
        val status = SpeechStatus.fromDbValue(turn.questionAudioStatus)
        return TurnView(
            turnIndex = turn.turnIndex,
            questionText = turn.questionText,
            questionAudioUrl = if (status == SpeechStatus.READY) signedUrl(turn.questionAudioPath, userId, sessionId) else null,
            questionAudioStatus = status.dbValue,
            phase = turn.phase,
            answered = turn.answeredAt != null,
        )
    }

    /**
     * What the candidate is told about grounding. Deliberately plain: an inferred
     * archetype is described as a general pattern, never as knowledge of that employer.
     */
    private fun candidateFacingNote(
        company: String,
        archetype: Archetype,
        confidence: Confidence,
        roundType: RoundType,
        sourcedQuestions: Int,
    ): String =
        GroundingNote.forRound(
            company = company,
            archetype = archetype,
            confidence = confidence,
            roundType = roundType,
            sourcedQuestions = sourcedQuestions,
            workspaceRound = roundType in RoundWorkspaceComposer.ROUND_TYPES,
        )

    /**
     * Archetype patterns, then the candidate's own background.
     *
     * There is no list of the employer's reported questions here any more, on purpose. A
     * model handed twelve of them asked whichever it liked, and the engine could not tell
     * which turn was which — so every turn was stamped as sourced. The bank reaches the
     * model only as the one planned question, whose asking the engine checks.
     */
    private fun groundingText(
        resolution: ArchetypeResolution,
        background: CandidateBackground?,
        resumeUse: ResumeUse,
    ): String =
        listOfNotNull(
            resolution.grounding,
            background?.asPrompt(resumeUse),
        ).joinToString(separator = "\n\n")

    /**
     * The brief handed to the model for one turn.
     *
     * [CandidateStage] is derived here rather than passed in, so every path that conducts
     * a round — the opening, every answer, and a hint — is calibrated the same way. A
     * fresher who got a student's opening question and then a mid-level bar on the answer
     * would be worse off than one who got neither (task 048).
     */
    private fun briefFor(
        company: String,
        resolution: ArchetypeResolution,
        role: String,
        roundType: RoundType,
        language: String,
        background: CandidateBackground? = null,
        planned: PlannedQuestion? = null,
        declaredStage: DeclaredStage? = null,
        focusTopic: String? = null,
    ): InterviewBrief {
        val stage = CandidateStage.of(role, background?.tenure?.totalExperienceMonths, declaredStage = declaredStage)
        val roundScope =
            when (roundType) {
                RoundType.CUSTOM_TOPIC -> {
                    listOf(
                        "Stay strictly within the requested topic: ${focusTopic.orEmpty()}.",
                        "Test concepts, trade-offs, and practical application within that topic.",
                    )
                }

                RoundType.PROJECT_DEEP_DIVE -> {
                    stage.covers(roundType) +
                        "This is the dedicated project round. Follow the candidate's project answers where useful."
                }

                else -> {
                    stage.covers(roundType) +
                        listOf(
                            "You may ask at most one short opening question about recent work, then move into this round's scope.",
                            "Do not repeatedly mine the resume or projects; test the named round competencies instead.",
                        )
                }
            }
        return InterviewBrief(
            company = company,
            archetype = resolution.archetype.label,
            role = role,
            roundType = "${roundType.label}. ${roundType.brief}",
            // The ground a *fresher* has to be taken across is not the ground somebody
            // with a job is: four of the professional entries ask a student about work
            // they have not done, and an interviewer with nowhere else to go asks them.
            roundCovers = roundScope.joinToString("\n") { "- $it" },
            language = language,
            // Null on every round until the resume existed, which is precisely why the
            // project deep-dive had nothing of the candidate's own to dig into.
            candidateFunction = background?.resume?.headline,
            // "0 years of experience" was true and useless. What a model can act on is
            // that there is no professional history here at all.
            candidateLevel =
                when {
                    stage.campusFresher -> stage.candidateDescription
                    background != null -> "${background.tenure.totalExperienceMonths / 12} years of experience"
                    else -> null
                },
            targetLevel = stage.targetDescription,
            levelCalibration = stage.interviewerCalibration(),
            grounding = groundingText(resolution, background, roundType.resumeUse),
            plannedQuestion = planned,
        )
    }

    /**
     * @param stage who is in the room, so the warm-up beat is asked in words they can
     *   answer. Null where the caller has not derived it, which reads as the professional
     *   wording — the behaviour before task 048.
     */
    private fun TurnPlan.toContext(
        stage: CandidateStage? = null,
        followUpLimit: Int = 2,
        mustMoveOn: Boolean = false,
        variant: AssessmentVariant = AssessmentVariant.LEGACY,
    ) = RoundContext(
        phase =
            when (phase) {
                TurnPhase.WARMUP -> "warm-up"
                TurnPhase.MAIN -> "main round"
                TurnPhase.CLOSING -> "closing"
            },
        minutesElapsed = minutesElapsed,
        minutesRemaining = minutesRemaining,
        durationMinutes = durationMinutes,
        warmupInstruction = warmupFocus?.instructionFor(stage?.campusFresher == true),
        briefTheCandidate = briefTheCandidate,
        mustConclude = mustConclude,
        followUpLimit = followUpLimit,
        mustMoveOn = mustMoveOn,
        variant = variant,
    )

    private fun TurnRow.toTranscript() =
        TurnTranscript(
            questionText = questionText,
            answerTranscript = answerTranscript,
            intervention = Intervention.parse(intervention),
            interventionNote = interventionNote,
            warmUp = TurnPhase.fromDbValue(phase) == TurnPhase.WARMUP,
            deliveryNote = deliveryNote,
            nextAction = nextAction,
        )

    private fun signedUrl(
        path: String?,
        userId: UUID,
        sessionId: UUID,
    ): String? =
        path?.takeIf { StorageKeys.isDirectChildOf(it, "$userId/$sessionId") }?.let {
            try {
                storage.createSignedUrl(storageProperties.mediaBucket, it, SIGNED_URL_SECONDS)
            } catch (e: ObjectStorageException) {
                log.warn("Could not sign URL for {}", it, e)
                null
            }
        }

    private fun confidenceOf(value: String): Confidence = Confidence.entries.firstOrNull { it.dbValue == value } ?: Confidence.INFERRED

    /** The model's suggestion is advisory; the engine owns what actually happens next. */
    private fun normaliseAction(suggested: String): String = suggested.lowercase().trim().takeIf { it in ALLOWED_ACTIONS } ?: "move_on"

    /**
     * Last-resort continuation when an assessment violates its contract and supplies no
     * next question before the engine says the round is over. These questions make no
     * employer claim and stay inside the selected scope; they are deliberately plain
     * because they should be rare, but a plain question is safer than ending the round.
     */
    private fun continuationQuestion(
        roundType: RoundType,
        focusTopic: String?,
        answeredTurns: Int,
    ): String {
        if (roundType != RoundType.CUSTOM_TOPIC) {
            return "Let's move to another part of this round. How would you approach it in practice?"
        }

        val topic = focusTopic?.takeIf { it.isNotBlank() } ?: "this topic"
        val questions =
            listOf(
                "Let's stay with $topic. Walk me through another core concept and when you would use it.",
                "Within $topic, what trade-off tends to matter most in practice, and why?",
                "What common failure mode or misconception in $topic would you watch for?",
                "Choose a concrete $topic example and explain how it behaves step by step.",
            )
        return questions[answeredTurns % questions.size]
    }

    private companion object {
        const val MAX_SESSION_PAGE = 50
        const val SIGNED_URL_SECONDS = 3600
        const val GENERAL_PRACTICE_COMPANY = "General practice"
        const val GENERAL_PRACTICE_ROLE = "Role not specified"
        const val CUSTOM_TOPIC_COMPANY = "General practice"
        const val CUSTOM_TOPIC_ROLE = "Topic practice"

        val DRAFT_CONFIDENCES = setOf("high", "medium", "low")
        val FOLLOW_UP_ACTIONS = setOf("follow_up", "probe", "challenge")

        /** Actions where the interviewer gave the candidate a hand; the question may be asked again, reworded. */
        val HELP_ACTIONS = setOf("redirect", "hint", "guide")

        /**
         * What a drafted round becomes when the one the model chose is not run at campus
         * level. Technical fundamentals, because it is the round a fresher loop is
         * actually decided on and the one they can prepare for from a syllabus.
         */
        val CAMPUS_FALLBACK_ROUND = RoundType.TECHNICAL_FUNDAMENTALS
        val ALLOWED_ACTIONS =
            setOf(
                "follow_up",
                "probe",
                "challenge",
                "move_on",
                "raise_difficulty",
                "redirect",
                "hint",
                "guide",
                "conclude",
            )
    }
}
