package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Module 12's ranking rules, pure. */
class LeaderboardRankingTest {
    private fun candidate(
        n: Int,
        overall: Int?,
        band: ReadinessBand = ReadinessBand.INTERVIEW_READY,
        optedIn: Boolean = false,
        name: String? = "Student $n",
    ) = LeaderboardCandidate(UUID(0, n.toLong()), name, overall, band, optedIn)

    private val me = UUID(0, 1)

    @Test
    fun `ties share a rank and the next rank skips`() {
        val view =
            LeaderboardRanking.rank(
                listOf(candidate(1, 70), candidate(2, 90), candidate(3, 70), candidate(4, 50)),
                me,
                "batch",
            )
        assertEquals(listOf(1, 2, 2, 4), view.rows.map { it.rank })
        assertEquals(listOf(90, 70, 70, 50), view.rows.map { it.overall })
        assertEquals(2, view.myRank)
    }

    @Test
    fun `students without enough evidence are unranked, and so is a caller who is one`() {
        val view =
            LeaderboardRanking.rank(
                listOf(candidate(1, null, ReadinessBand.NOT_ENOUGH_EVIDENCE), candidate(2, 40, ReadinessBand.NEEDS_STRUCTURED_PREP)),
                me,
                "college",
            )
        assertEquals(1, view.rows.size)
        assertNull(view.myRank)
        assertFalse(view.rows.any { it.isMe })
    }

    @Test
    fun `names are hidden unless the student opted in, and the caller is flagged`() {
        val view =
            LeaderboardRanking.rank(
                listOf(
                    candidate(1, 80, optedIn = true, name = "Asha Rao"),
                    candidate(2, 60, name = "Ravi"),
                    candidate(3, 50, optedIn = true, name = " "),
                ),
                me,
                "batch",
            )
        assertEquals(listOf("Asha Rao", "Anonymous student", "Anonymous student"), view.rows.map { it.displayName })
        assertTrue(view.optedIn)
        assertEquals(listOf(true, false, false), view.rows.map { it.isMe })
    }

    @Test
    fun `the top 50 plus the callers own row below them`() {
        val field = (1..60).map { candidate(it + 1, 100 - it) } + candidate(1, 5)
        val view = LeaderboardRanking.rank(field, me, "college")
        assertEquals(51, view.rows.size)
        assertEquals(61, view.myRank)
        assertTrue(view.rows.last().isMe)
        assertEquals(61, view.rows.last().rank)
    }
}

/** Module 12 routes through the real service with the gate and the SQL mocked at the boundary. */
@WebMvcTest(
    controllers = [MeCampusLeaderboardController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusLeaderboardService::class,
    CampusReadinessService::class,
)
class CampusLeaderboardControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var readiness: ReadinessRepository

    @MockitoBean private lateinit var assignments: AssignmentRepository

    @MockitoBean private lateinit var leaderboard: LeaderboardRepository

    @MockitoBean private lateinit var audit: CampusAudit

    @MockitoBean private lateinit var reports: com.interviewos.api.interview.ReportService

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "asha@college.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val memberId = UUID.fromString("0a000000-0000-0000-0000-0000000000d1")
    private val scope = OrgScope(orgId, userId, CampusRole.STUDENT, memberId, platformAdmin = false)

    @Test
    fun `no token is a 401`() {
        mockMvc.perform(get("/api/v1/me/campus/leaderboard")).andExpect(status().isUnauthorized)
        mockMvc.perform(put("/api/v1/me/campus/leaderboard-preference").json("""{"optIn":true}""")).andExpect(status().isUnauthorized)
        verifyNoInteractions(access, readiness, leaderboard)
    }

    @Test
    fun `someone who is not a joined student gets 404 on both routes`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(null)
        mockMvc.perform(get("/api/v1/me/campus/leaderboard").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(put("/api/v1/me/campus/leaderboard-preference").with(signedIn()).json("""{"optIn":true}"""))
            .andExpect(status().isNotFound)
        verifyNoInteractions(readiness, leaderboard)
    }

    @Test
    fun `a student with no evidence sees an empty board and no rank`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(scope)
        given(assignments.activeOrg(scope)).willReturn(ActiveOrg("College A", 10))
        given(readiness.weights(scope)).willReturn(ReadinessWeightSet.DEFAULT)
        given(readiness.students(scope, ReadinessFilter())).willReturn(
            listOf(
                ReadinessStudentRow(
                    memberId,
                    userId,
                    "Asha Rao",
                    "A-001",
                    UUID.randomUUID(),
                    "CSE 2027",
                    UUID.randomUUID(),
                    "CSE",
                    Instant.now(),
                ),
            ),
        )
        given(leaderboard.optedIn(scope)).willReturn(setOf(memberId))

        mockMvc
            .perform(get("/api/v1/me/campus/leaderboard?scope=college").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.scope").value("college"))
            .andExpect(jsonPath("$.optedIn").value(true))
            .andExpect(jsonPath("$.myRank").value(null as Any?))
            .andExpect(jsonPath("$.rows.length()").value(0))
    }

    @Test
    fun `an unknown scope is a 400`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(scope)
        given(assignments.activeOrg(scope)).willReturn(ActiveOrg("College A", 10))
        mockMvc
            .perform(get("/api/v1/me/campus/leaderboard?scope=world").with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("scope_invalid"))
    }

    @Test
    fun `the preference is saved and echoed, and a missing value is a 400`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(scope)
        given(assignments.activeOrg(scope)).willReturn(ActiveOrg("College A", 10))
        given(leaderboard.setOptIn(scope, memberId, true)).willReturn(true)

        mockMvc
            .perform(put("/api/v1/me/campus/leaderboard-preference").with(signedIn()).json("""{"optIn":true}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.optIn").value(true))
        verify(leaderboard).setOptIn(scope, memberId, true)
        mockMvc
            .perform(put("/api/v1/me/campus/leaderboard-preference").with(signedIn()).json("""{"optIn":"yes"}"""))
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `a suspended college is a 404`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(scope)
        given(assignments.activeOrg(scope)).willReturn(null)
        mockMvc.perform(get("/api/v1/me/campus/leaderboard").with(signedIn())).andExpect(status().isNotFound)
        assertTrue(ApiException.notFound().status.is4xxClientError)
    }

    private fun org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder.json(body: String) =
        contentType(MediaType.APPLICATION_JSON).content(body)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
