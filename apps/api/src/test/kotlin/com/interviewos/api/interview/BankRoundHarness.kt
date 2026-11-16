package com.interviewos.api.interview

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.ai.ComposedRound
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.OfferedHint
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.bank.BankQuestion
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.bank.QuestionBankRepository
import com.interviewos.api.billing.BillingProperties
import com.interviewos.api.campus.AssignedRound
import com.interviewos.api.campus.AssignedRoundAdmission
import com.interviewos.api.common.ApiException
import com.interviewos.api.pool.PoolQuestion
import com.interviewos.api.pool.QuestionPoolRepository
import com.interviewos.api.pool.RoleFamily
import com.interviewos.api.resume.ResumeService
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.UserRepository
import org.mockito.BDDMockito.given
import org.mockito.Mockito.RETURNS_DEFAULTS
import org.mockito.Mockito.mock
import org.mockito.Mockito.mockingDetails
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.util.UUID

/**
 * A real [InterviewService] over mocks at every boundary — the database, the bank, the
 * model — so a round can be run end to end without a network.
 *
 * The model is a Mockito mock with a scripted default answer rather than a hand-written
 * fake, so a method added to [InterviewAi] later does not break this harness.
 */
class BankRoundHarness(
    /**
     * Defaults to a bare mock whose `getTransaction` hands back a status object, which is
     * enough for every scenario except one: it never calls
     * `TransactionSynchronizationManager.initSynchronization()`, the way a real
     * `PlatformTransactionManager` does, so it cannot tell a test whether a transaction
     * was actually open at a given moment. A test that needs to observe that (task 056,
     * L4's transaction-boundary guard) passes its own.
     */
    transactionManager: PlatformTransactionManager =
        mock(PlatformTransactionManager::class.java) { invocation ->
            if (invocation.method.name == "getTransaction") SimpleTransactionStatus() else null
        },
) {
    val mapper: JsonMapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    val repository: SessionRepository =
        mock(SessionRepository::class.java) { invocation ->
            when (invocation.method.returnType) {
                Boolean::class.javaPrimitiveType -> true

                TurnRequestClaim::class.java -> TurnRequestClaim(TurnRequestClaimStatus.ACQUIRED)

                ReportGenerationClaim::class.java -> ReportGenerationClaim(ReportGenerationClaimStatus.ACQUIRED)

                // Today's practice ledger: nothing used yet, so the daily allowance admits the round.
                Pair::class.java -> 0 to 0

                else -> RETURNS_DEFAULTS.answer(invocation)
            }
        }
    val activeLeases = ActiveLeaseRenewal(repository)

    /** The round a test's assignment holds; null means the assignment is not the candidate's (404). */
    var assignedRound: AssignedRound? = null

    /** What the college's caps say at admission; null admits the round. */
    var assignedRefusal: ApiException? = null

    /**
     * College-assigned rounds (campus spec §4); a personal round never reaches it. Scripted like
     * the model: [AssignedRoundAdmission.admit] runs the session insert it is handed, as the real
     * one does inside the admission transaction, unless [assignedRefusal] says no.
     */
    val assignedRounds: AssignedRoundAdmission =
        mock(AssignedRoundAdmission::class.java) { invocation ->
            when (invocation.method.name) {
                "roundFor" -> {
                    assignedRound ?: throw AssignedRoundAdmission.notFound()
                }

                "admit" -> {
                    assignedRefusal?.let { throw it }
                    @Suppress("UNCHECKED_CAST")
                    (invocation.arguments[2] as () -> UUID).invoke()
                }

                else -> {
                    RETURNS_DEFAULTS.answer(invocation)
                }
            }
        }
    val directory: CompanyDirectory = mock(CompanyDirectory::class.java)
    val bank: QuestionBankRepository = mock(QuestionBankRepository::class.java)
    val pool: QuestionPoolRepository = mock(QuestionPoolRepository::class.java)
    val archetypes = ArchetypeResolver()
    val poolMaterial = PoolMaterial(mapper)

    /** Returns null for every candidate unless a test says otherwise: no resume, as most rounds run. */
    val resumeService: ResumeService = mock(ResumeService::class.java)
    val storage: ObjectStorage = mock(ObjectStorage::class.java)
    val userRepository: UserRepository = mock(UserRepository::class.java)

    /** What the model is asked, in order. */
    val briefs = mutableListOf<InterviewBrief>()
    var case: ComposedCase? = null
    var assessment: AnswerAssessment? = null
    var report: ReportContent? = null
    var hint: OfferedHint? = null

    /** What the model reads out of a candidate's one-line query, when a test exercises the round composer. */
    var composedRound: ComposedRound? = null

    /**
     * Called just before the mock resolves, with the name of the [InterviewAi] method
     * invoked — lets a test observe ambient state (e.g. whether a transaction is open, via
     * a [RecordingTransactionManager]) at the exact moment the model is "called" (task 056,
     * L4).
     */
    var onAiCall: ((String) -> Unit)? = null

    val ai: InterviewAi =
        mock(InterviewAi::class.java) { invocation ->
            val brief = invocation.arguments.firstOrNull() as? InterviewBrief
            brief?.let { briefs += it }
            onAiCall?.invoke(invocation.method.name)
            when (invocation.method.name) {
                "composeCase" -> AiResult(checkNotNull(case), AiUsage.none("test"))
                "composeRound" -> AiResult(checkNotNull(composedRound), AiUsage.none("test"))
                "assessAnswer" -> AiResult(checkNotNull(assessment), AiUsage.none("test"))
                "offerHint" -> AiResult(checkNotNull(hint), AiUsage.none("test"))
                "composeReport" -> AiResult(checkNotNull(report), AiUsage.none("test"))
                else -> RETURNS_DEFAULTS.answer(invocation)
            }
        }

    val service =
        InterviewService(
            repository = repository,
            userRepository = userRepository,
            archetypeResolver = archetypes,
            interviewAi = ai,
            storage = storage,
            storageProperties = StorageProperties(),
            objectMapper = mapper,
            questionSpeech = mock(QuestionSpeech::class.java),
            entitlementProperties = EntitlementProperties(),
            billingProperties = BillingProperties(),
            roundsProperties = RoundsProperties(),
            retentionProperties = RetentionProperties(),
            bankRounds = BankRoundPlanner(directory, bank, repository),
            poolRounds = PoolRoundPlanner(directory, pool, repository, poolMaterial),
            resumeService = resumeService,
            roundWorkspaceComposer = RoundWorkspaceComposer(ai, mapper, ProblemVerifier(ai, mapper), poolMaterial),
            codeRunner = mock(CodeRunner::class.java),
            interviewEvents = InterviewEventRecorder.NONE,
            activeLeases = activeLeases,
            assignedRounds = assignedRounds,
            transactionManager = transactionManager,
        )

    val reportService = ReportService(repository, ai, mapper, RetentionProperties(), resumeService, activeLeases)

    /** The bank holds [questions] for Amazon's [roundType] rounds. */
    fun bankHolds(
        roundType: RoundType,
        vararg questions: BankQuestion,
    ) {
        given(directory.resolve("Amazon")).willReturn(BankFixtures.amazon)
        given(bank.questionsFor(BankFixtures.amazon.id, roundType, false, 100, 0)).willReturn(questions.toList())
        given(bank.countFor(BankFixtures.amazon.id, roundType, false)).willReturn(questions.size)
    }

    /** The pool holds [questions] for [roundType] and the backend family — the rows the repository would return. */
    fun poolHolds(
        roundType: RoundType,
        vararg questions: PoolQuestion,
        companyId: UUID? = BankFixtures.amazon.id,
    ) {
        given(pool.candidatesFor(companyId, Archetype.GLOBAL_PRODUCT, roundType, RoleFamily.BACKEND, 200))
            .willReturn(questions.toList())
    }

    /** A turn as the service wrote it. */
    data class InsertedTurn(
        val turnIndex: Int,
        val questionText: String,
        val provenance: QuestionProvenance?,
        val bankQuestionId: UUID?,
        val poolQuestionId: UUID?,
    )

    /** Every turn the service inserted, read off the mock rather than matched, so no matcher meets a Kotlin non-null. */
    fun insertedTurns(): List<InsertedTurn> =
        mockingDetails(repository)
            .invocations
            .filter { it.method.name == "insertTurn" }
            .map { call ->
                val args = call.arguments
                InsertedTurn(
                    turnIndex = args[2] as Int,
                    questionText = args[3] as String,
                    provenance = (args[6] as String?)?.let { mapper.readValue(it, QuestionProvenance::class.java) },
                    bankQuestionId = args[7] as UUID?,
                    poolQuestionId = args[8] as UUID?,
                )
            }
}
