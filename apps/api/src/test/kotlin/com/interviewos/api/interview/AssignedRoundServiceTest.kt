package com.interviewos.api.interview

import com.interviewos.api.campus.AssignedRound
import com.interviewos.api.campus.AssignmentGate
import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import org.springframework.http.HttpStatus
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `POST /sessions` with an `assignmentId` (campus spec §4, contract "Admission"), through the
 * real [InterviewService] with the database and the college's admission mocked at the
 * boundary. What is under test: the round is the assignment's whatever the client sent, it is
 * paid for by the college and never by the candidate's free rounds or credits, and consent and
 * one-round-at-a-time still apply. The caps and the race are in `AssignmentGateTest` and
 * `CampusAssignmentsDatabaseIntegrationTest`.
 */
class AssignedRoundServiceTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(candidate, "student@college.example", null)
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
    private val assignmentId = UUID.fromString("a5500000-0000-0000-0000-0000000000a1")

    private val assigned =
        AssignedRound(
            assignmentId = assignmentId,
            roundType = RoundType.TECHNICAL_FUNDAMENTALS.dbValue,
            durationMinutes = 45,
            companyName = "Amazon",
            roleTitle = "SDE 1",
            candidateStage = "student",
            language = "hindi_english",
            focusTopic = null,
        )

    /** Everything a client could send to steer the round elsewhere; all of it must be ignored. */
    private val clientRequest =
        StartSessionRequest(
            companyName = "Google",
            roleTitle = "Staff Engineer",
            roundType = RoundType.APTITUDE.dbValue,
            language = "english",
            consentAudio = true,
            durationMinutes = 30,
            candidateStage = "professional",
            focusTopic = "Anything else",
            assignmentId = assignmentId,
        )

    @Test
    fun `the round is the assignment's, and the college pays for it`() {
        harness.assignedRound = assigned
        stubInsert()

        runCatching { harness.service.start(identity, clientRequest) }

        val inserts = calls("insertSession")
        assertEquals(1, inserts.size, "one session")
        val args = inserts.single()
        assertEquals("Amazon", args[1])
        assertEquals("SDE 1", args[4])
        assertEquals(RoundType.TECHNICAL_FUNDAMENTALS.dbValue, args[5])
        assertEquals("hindi_english", args[6])
        assertEquals(45, args[9])
        assertEquals(DeclaredStage.STUDENT, args[10])
        assertEquals(null, args[11])

        // Admitted through the college's caps, not the candidate's entitlement.
        assertEquals(1, mockingDetails(harness.assignedRounds).invocations.count { it.method.name == "admit" })
        assertEquals(0, calls("recordPracticeUsage").size, "no free round is used")
        assertEquals(0, calls("spendCredit").size, "no credit is spent")
        assertEquals(0, calls("countFreeRoundsStarted").size, "the free tier is not even consulted")
        assertEquals(0, calls("halfCreditBalance").size, "nor the credit balance")
        assertEquals(1, calls("lockForAdmission").size, "still serialised per candidate")
    }

    @Test
    fun `an empty company on the assignment is general practice, not the client's company`() {
        harness.assignedRound = assigned.copy(companyName = null, roleTitle = null)

        runCatching { harness.service.start(identity, clientRequest) }

        val args = calls("insertSession").single()
        assertEquals("General practice", args[1])
        assertEquals("Role not specified", args[4])
    }

    @Test
    fun `a topic round takes the assignment's topic and its 30 minutes`() {
        harness.assignedRound =
            assigned.copy(
                roundType = RoundType.CUSTOM_TOPIC.dbValue,
                durationMinutes = 30,
                companyName = null,
                roleTitle = null,
                focusTopic = "DBMS normalisation",
            )

        runCatching { harness.service.start(identity, clientRequest) }

        val args = calls("insertSession").single()
        assertEquals(RoundType.CUSTOM_TOPIC.dbValue, args[5])
        assertEquals(30, args[9])
        assertEquals("DBMS normalisation", args[11])
    }

    @Test
    fun `audio consent is still required, and asked for before the assignment is read`() {
        harness.assignedRound = assigned

        val error = assertThrows<ApiException> { harness.service.start(identity, clientRequest.copy(consentAudio = false)) }

        assertEquals(HttpStatus.BAD_REQUEST, error.status)
        assertEquals("consent_required", error.code)
        assertEquals(0, mockingDetails(harness.assignedRounds).invocations.size)
        assertEquals(0, calls("insertSession").size)
    }

    @Test
    fun `an assignment that is not the candidate's is a 404 and nothing is written`() {
        harness.assignedRound = null

        val error = assertThrows<ApiException> { harness.service.start(identity, clientRequest) }

        assertEquals(HttpStatus.NOT_FOUND, error.status)
        assertEquals("assignment_not_found", error.code)
        assertEquals(0, calls("insertSession").size)
        assertEquals(0, calls("recordPracticeUsage").size)
    }

    @Test
    fun `a cap refusal is the contract's code, and nothing is written`() {
        harness.assignedRound = assigned
        harness.assignedRefusal = AssignmentGate.Blocked.COLLEGE_ALLOWANCE.toException()

        val error = assertThrows<ApiException> { harness.service.start(identity, clientRequest) }

        assertEquals(HttpStatus.PAYMENT_REQUIRED, error.status)
        assertEquals("college_allowance_exhausted", error.code)
        assertEquals(0, calls("insertSession").size)
        assertEquals(0, calls("recordPracticeUsage").size)
        assertEquals(0, calls("spendCredit").size)
    }

    @Test
    fun `one round at a time still applies, before the college is asked`() {
        harness.assignedRound = assigned
        given(harness.repository.findOpenSessionId(candidate)).willReturn(UUID.randomUUID())

        val error = assertThrows<ApiException> { harness.service.start(identity, clientRequest) }

        assertEquals(HttpStatus.CONFLICT, error.status)
        assertEquals("session_in_progress", error.code)
        assertEquals(0, mockingDetails(harness.assignedRounds).invocations.count { it.method.name == "admit" })
        assertEquals(0, calls("insertSession").size)
    }

    @Test
    fun `a round that dies in setup is failed, which hands the college its interview back`() {
        harness.assignedRound = assigned
        stubInsert()
        // The scripted model has no opening question, so setup fails after admission has committed.

        val outcome = runCatching { harness.service.start(identity, clientRequest) }

        assertTrue(outcome.isFailure)
        // The same hand-back a free round or a credit gets; its SQL also marks the attempt failed.
        assertEquals(listOf(listOf<Any?>(sessionId, candidate)), calls("failSessionAndRefundUsage").map { it.toList() })
    }

    @Test
    fun `a personal round never reaches the college's admission`() {
        given(
            harness.repository.insertSession(
                candidate,
                "Amazon",
                Archetype.GLOBAL_PRODUCT,
                Confidence.RECOGNISED,
                "SDE 2",
                RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                "english",
                true,
                false,
                45,
                null,
            ),
        ).willReturn(sessionId)

        runCatching {
            harness.service.start(
                identity,
                StartSessionRequest(
                    companyName = "Amazon",
                    roleTitle = "SDE 2",
                    roundType = RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                    consentAudio = true,
                ),
            )
        }

        assertEquals(0, mockingDetails(harness.assignedRounds).invocations.size)
        assertEquals(1, calls("recordPracticeUsage").size, "a free round is counted as before")
    }

    private fun stubInsert() {
        given(
            harness.repository.insertSession(
                candidate,
                "Amazon",
                Archetype.GLOBAL_PRODUCT,
                Confidence.RECOGNISED,
                "SDE 1",
                RoundType.TECHNICAL_FUNDAMENTALS.dbValue,
                "hindi_english",
                true,
                false,
                45,
                DeclaredStage.STUDENT,
                null,
            ),
        ).willReturn(sessionId)
    }

    private fun calls(method: String): List<Array<Any?>> =
        mockingDetails(harness.repository)
            .invocations
            .filter { it.method.name == method }
            .map { it.arguments }
}
