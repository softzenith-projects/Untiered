package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.ComposedRound
import com.interviewos.api.ai.ParsedEducation
import com.interviewos.api.ai.ParsedResume
import com.interviewos.api.common.ApiException
import com.interviewos.api.pool.Level
import com.interviewos.api.resume.CandidateBackground
import com.interviewos.api.resume.ResumeTimeline
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * What a fresher's round actually looks like once it runs through the real
 * [InterviewService] (task 048).
 *
 * The unit tests beside this one hold the rule; this one checks the rule reaches the
 * model, because a calibration that is derived and then not passed on is exactly the bug
 * being fixed — `Level.ENTRY` was computed correctly for a year and changed nothing.
 */
class FresherRoundServiceTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a22")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e02")

    @Test
    fun `the interviewer is told it is a campus round, and given campus ground to cover`() {
        givenCampusRoundAt(RoundType.PROJECT_DEEP_DIVE)
        harness.assessment = assessment("Which part of that did you write yourself?")

        submit()

        val brief = harness.briefs.last()
        assertTrue(brief.levelCalibration.contains("campus and new-graduate hiring"))
        assertTrue(brief.levelCalibration.contains("Do not ask what happened when it broke in production"))
        assertTrue(brief.roundCovers.contains("final-year project"))
        assertTrue(brief.candidateLevel!!.contains("no professional work history"))
        assertEquals(CandidateStage(Level.ENTRY, campusFresher = true).targetDescription, brief.targetLevel)
    }

    /** The same round, run for somebody with a job, is unchanged. */
    @Test
    fun `a working engineer's round is not turned into a campus one`() {
        givenRoundAt(RoundType.PROJECT_DEEP_DIVE, roleTitle = "Senior Software Engineer")
        harness.assessment = assessment("What did that cost you elsewhere?")

        submit()

        val brief = harness.briefs.last()
        assertTrue(!brief.levelCalibration.contains("campus and new-graduate hiring"))
        assertTrue(RoundType.PROJECT_DEEP_DIVE.covers.all(brief.roundCovers::contains))
        assertTrue(brief.roundCovers.contains("This is the dedicated project round"))
    }

    /**
     * No campus loop contains a system design round, and a student marked against a
     * distributed-systems bar is told something untrue about how ready they are. The
     * refusal is explicit rather than a silent swap — the candidate chose this round.
     */
    @Test
    fun `a campus fresher is never given a system design round`() {
        val failure =
            assertFailsWith<ApiException> {
                harness.service.start(
                    identity = SupabaseIdentity(candidate, "student@example.com", null),
                    request =
                        StartSessionRequest(
                            companyName = "Infosys",
                            roleTitle = "Graduate Engineer Trainee",
                            roundType = RoundType.SYSTEM_DESIGN.dbValue,
                            language = "english",
                            consentAudio = true,
                            consentVideo = false,
                            durationMinutes = 45,
                        ),
                )
            }

        assertEquals("round_not_run_at_this_level", failure.code)
        assertTrue(failure.message.contains("campus or new-graduate candidate"))
    }

    /** The engine, not the model, decides. A drafted design round for a fresher becomes one they can sit. */
    @Test
    fun `the round composer substitutes a design round drafted for a fresher, and says so`() {
        harness.composedRound =
            ComposedRound(
                company = "Infosys",
                role = "Graduate Engineer Trainee",
                level = "fresher",
                roundType = RoundType.SYSTEM_DESIGN.dbValue,
                durationMinutes = 40,
                language = "english",
                understood = "A campus round at Infosys.",
                assumptions = listOf("Assumed English."),
                confidence = "medium",
            )

        val draft = harness.service.composeRound(ComposeRoundRequest("infosys fresher round"))

        assertEquals(RoundType.TECHNICAL_FUNDAMENTALS.dbValue, draft.roundType)
        assertTrue(draft.assumptions.any { it.contains("fresher or campus round") }, draft.assumptions.toString())
        assertTrue(draft.assumptions.contains("Assumed English."), "the model's own assumptions are kept")
    }

    @Test
    fun `a design round drafted for somebody with a job is left alone`() {
        harness.composedRound =
            ComposedRound(
                company = "Amazon",
                role = "Senior Software Engineer",
                level = "senior",
                roundType = RoundType.SYSTEM_DESIGN.dbValue,
                durationMinutes = 40,
                language = "english",
                understood = "A design round at Amazon.",
                assumptions = emptyList(),
                confidence = "high",
            )

        val draft = harness.service.composeRound(ComposeRoundRequest("amazon senior design round"))

        assertEquals(RoundType.SYSTEM_DESIGN.dbValue, draft.roundType)
        assertTrue(draft.assumptions.isEmpty())
    }

    private fun givenCampusRoundAt(roundType: RoundType) {
        given(harness.resumeService.backgroundFor(candidate)).willReturn(studentBackground())
        givenRoundAt(roundType, roleTitle = "Graduate Engineer Trainee")
    }

    private fun studentBackground(): CandidateBackground =
        CandidateBackground(
            ParsedResume(
                fullName = "Aditi Rao",
                headline = "Final-year B.Tech student, computer science",
                education = listOf(ParsedEducation("NIT Trichy", "B.Tech", "Computer Science", 2026)),
            ),
            ResumeTimeline.summarise(emptyList(), LocalDate.parse("2026-09-20")),
        )

    private fun givenRoundAt(
        roundType: RoundType,
        roleTitle: String,
    ) {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Infosys",
                archetype = Archetype.SERVICE_BASED_IT.dbValue,
                archetypeConfidence = Confidence.RECOGNISED.dbValue,
                roleTitle = roleTitle,
                roundType = roundType.dbValue,
                language = "english",
                status = "in_progress",
                startedAt = Instant.now().minusSeconds(10 * 60),
                endedAt = null,
                consentVideo = false,
                durationMinutes = 40,
            ),
        )
        given(harness.repository.findTurn(sessionId, candidate, 4)).willReturn(
            TurnRow(
                turnIndex = 4,
                questionText = "Tell me about your final-year project.",
                questionAudioPath = null,
                answerTranscript = null,
                answeredAt = null,
            ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(4)
    }

    private fun submit() =
        harness.service.submitAnswer(
            userId = candidate,
            sessionId = sessionId,
            turnIndex = 4,
            audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm"),
            speaksLocally = true,
        )

    private fun assessment(next: String) =
        AnswerAssessment(
            transcript = "An answer.",
            suggestedNextAction = "move_on",
            nextQuestionText = next,
            questionBasis = "Campus project rounds ask who wrote what.",
            questionProbes = "Whether the work is theirs.",
            questionAskedBecause = "You described the project as a team effort.",
        )
}
