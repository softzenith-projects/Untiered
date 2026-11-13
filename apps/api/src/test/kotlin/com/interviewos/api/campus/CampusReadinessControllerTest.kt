package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.interview.ReportAssistanceView
import com.interviewos.api.interview.ReportCommunicationView
import com.interviewos.api.interview.ReportOutcomeView
import com.interviewos.api.interview.ReportService
import com.interviewos.api.interview.SessionReportView
import com.interviewos.api.user.SupabaseIdentity
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.never
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The readiness and dashboard routes through the real [CampusReadinessService], with the gate,
 * the repositories and the report path mocked at the boundary: no token 401, not staff 404,
 * wrong role 403, then validation and the happy paths. The SQL — scoping, isolation, which
 * sessions count — is exercised by [CampusReadinessDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [CampusReadinessController::class, MeCampusReadinessController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusReadinessService::class,
)
class CampusReadinessControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var readiness: ReadinessRepository

    @MockitoBean private lateinit var assignments: AssignmentRepository

    @MockitoBean private lateinit var audit: CampusAudit

    @MockitoBean private lateinit var reports: ReportService

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "staff@college.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val callerMember = UUID.fromString("0a000000-0000-0000-0000-0000000000c1")
    private val studentMember = UUID.fromString("0a000000-0000-0000-0000-0000000000d1")
    private val studentUser = UUID.fromString("0a000000-0000-0000-0000-0000000000e1")
    private val batchId = UUID.fromString("0a000000-0000-0000-0000-0000000000b1")
    private val departmentId = UUID.fromString("0a000000-0000-0000-0000-0000000000f1")
    private val sessionId = UUID.fromString("0a000000-0000-0000-0000-000000000051")
    private val assignmentId = UUID.fromString("0a000000-0000-0000-0000-0000000000a1")

    private val base = "/api/v1/campus/orgs/$orgId"
    private val staffGets =
        listOf(
            "$base/students/$studentMember/readiness",
            "$base/students/$studentMember/reports/$sessionId",
            "$base/readiness-weights",
            "$base/dashboard",
            "$base/students/readiness",
            "$base/exports/students.csv",
        )

    private fun scope(
        role: CampusRole,
        batches: Set<UUID> = emptySet(),
    ) = OrgScope(orgId, userId, role, callerMember, platformAdmin = false, facultyBatchIds = batches)

    @Test
    fun `no token is a 401 and nothing is resolved`() {
        for (path in staffGets) mockMvc.perform(get(path)).andExpect(status().isUnauthorized)
        mockMvc.perform(put("$base/readiness-weights").json(DEFAULT_WEIGHTS)).andExpect(status().isUnauthorized)
        mockMvc.perform(post("$base/exports/batch-report-viewed")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/me/campus/readiness")).andExpect(status().isUnauthorized)

        verifyNoInteractions(access, readiness, assignments, audit, reports)
    }

    @Test
    fun `someone who is not staff of the college gets 404 on every route`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())

        for (path in staffGets) {
            mockMvc
                .perform(get(path).with(signedIn()))
                .andExpect(status().isNotFound)
                .andExpect(jsonPath("$.error").value("not_found"))
        }
        mockMvc.perform(put("$base/readiness-weights").with(signedIn()).json(DEFAULT_WEIGHTS)).andExpect(status().isNotFound)
        mockMvc.perform(post("$base/exports/batch-report-viewed").with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(readiness, assignments, audit, reports)
    }

    @Test
    fun `someone who is not a joined student gets 404 for their own readiness`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(null)

        mockMvc.perform(get("/api/v1/me/campus/readiness").with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(readiness, assignments, audit, reports)
    }

    @Test
    fun `only a college admin may change the weights, and the permission is checked before the body`() {
        for (role in listOf(CampusRole.TPO, CampusRole.FACULTY)) {
            given(access.resolve(identity, orgId)).willReturn(scope(role))
            mockMvc
                .perform(put("$base/readiness-weights").with(signedIn()).json("""{"coding":"nonsense"}"""))
                .andExpect(status().isForbidden)
                .andExpect(jsonPath("$.error").value("campus_forbidden"))
        }
        given(access.resolve(identity, orgId)).willReturn(OrgScope(orgId, userId, null, null, platformAdmin = true))
        mockMvc
            .perform(put("$base/readiness-weights").with(signedIn()).json(DEFAULT_WEIGHTS))
            .andExpect(status().isForbidden)

        verify(readiness, never()).updateWeights(anyScope(), anyWeights())
        verifyNoInteractions(audit)
    }

    @Test
    fun `a platform admin may read readiness but not export it`() {
        given(access.resolve(identity, orgId)).willReturn(OrgScope(orgId, userId, null, null, platformAdmin = true))

        mockMvc.perform(get("$base/exports/students.csv").with(signedIn())).andExpect(status().isForbidden)
        mockMvc.perform(post("$base/exports/batch-report-viewed").with(signedIn())).andExpect(status().isForbidden)

        verifyNoInteractions(readiness, audit)
    }

    @Test
    fun `weights must be five whole numbers from 0 to 100 that sum to 100`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.COLLEGE_ADMIN))

        for (
        body in listOf(
            """{"coding":30,"coreCs":25,"technicalInterview":25,"communication":10,"aptitude":9}""",
            """{"coding":30.5,"coreCs":24.5,"technicalInterview":25,"communication":10,"aptitude":10}""",
            """{"coding":30,"coreCs":25,"technicalInterview":25,"communication":10}""",
            """{"coding":130,"coreCs":-30,"technicalInterview":0,"communication":0,"aptitude":0}""",
            """{"coding":30,"coreCs":25,"technicalInterview":25,"communication":10,"aptitude":10,"typo":0}""",
            """{"coding":"30","coreCs":25,"technicalInterview":25,"communication":10,"aptitude":10}""",
        )
        ) {
            mockMvc
                .perform(put("$base/readiness-weights").with(signedIn()).json(body))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("weights_invalid"))
        }
        verify(readiness, never()).updateWeights(anyScope(), anyWeights())
    }

    @Test
    fun `a college admin changes the weights and the change is audited`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        val weights = ReadinessWeightSet(coding = 40, coreCs = 20, technicalInterview = 20, communication = 10, aptitude = 10)
        given(readiness.updateWeights(scope, weights)).willReturn(true)

        mockMvc
            .perform(
                put("$base/readiness-weights")
                    .with(signedIn())
                    .json("""{"coding":40,"coreCs":20,"technicalInterview":20,"communication":10,"aptitude":10}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.coding").value(40))
            .andExpect(jsonPath("$.aptitude").value(10))

        verify(audit).record(
            scope,
            "readiness_weights.updated",
            CampusOrgService.TARGET_ORG,
            orgId,
            mapOf("coding" to 40, "coreCs" to 20, "technicalInterview" to 20, "communication" to 10, "aptitude" to 10),
        )
    }

    @Test
    fun `a student's readiness shows not attempted as null, the band needs two items, and the view is audited`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        stubOneStudent(scope, ReadinessFilter(memberId = studentMember), interviewScores = listOf(4))

        mockMvc
            .perform(get("$base/students/$studentMember/readiness").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.memberId").value(studentMember.toString()))
            .andExpect(jsonPath("$.components.technicalInterview").value(80))
            .andExpect(jsonPath("$.components.coding").value(null as Any?))
            // Present and null on the wire: "Not attempted", never a missing key and never 0.
            .andExpect(content().string(containsString("\"coding\":null")))
            .andExpect(jsonPath("$.overall").value(null as Any?))
            .andExpect(jsonPath("$.band").value("not_enough_evidence"))
            .andExpect(jsonPath("$.evidence[0].sessionId").value(sessionId.toString()))
            .andExpect(jsonPath("$.evidence[0].score").value(80))
            .andExpect(jsonPath("$.weights.coding").value(30))

        verify(audit).record(scope, "readiness.viewed", CampusOrgService.TARGET_MEMBER, studentMember)
    }

    @Test
    fun `a student outside the faculty member's scope is a 404 and nothing is audited`() {
        val scope = scope(CampusRole.FACULTY, setOf(batchId))
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.weights(scope)).willReturn(ReadinessWeightSet.DEFAULT)
        given(readiness.students(scope, ReadinessFilter(memberId = studentMember))).willReturn(emptyList())

        mockMvc.perform(get("$base/students/$studentMember/readiness").with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(audit)
    }

    @Test
    fun `a report that is not one of the member's attempts is a 404 and the report path is never called`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.attemptSessionOwner(scope, studentMember, sessionId)).willReturn(null)

        mockMvc.perform(get("$base/students/$studentMember/reports/$sessionId").with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(reports, audit)
    }

    @Test
    fun `an attempt's report is served through the existing report path for the student, then audited`() {
        val scope = scope(CampusRole.FACULTY, setOf(batchId))
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.attemptSessionOwner(scope, studentMember, sessionId)).willReturn(studentUser)
        given(reports.report(ArgumentMatchers.eq(studentUser) ?: studentUser, ArgumentMatchers.eq(sessionId) ?: sessionId, anyUuid()))
            .willReturn(report())

        mockMvc
            .perform(get("$base/students/$studentMember/reports/$sessionId").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))

        verify(audit).record(
            scope,
            "report.viewed",
            CampusReadinessService.TARGET_SESSION,
            sessionId,
            mapOf("memberId" to studentMember.toString()),
        )
    }

    @Test
    fun `the student table rejects unknown filter values by name`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.TPO))

        val cases =
            mapOf(
                "sort=age" to "invalid_sort",
                "order=up" to "invalid_order",
                "band=great" to "invalid_band",
                "completion=half" to "invalid_completion",
                "cursor=bm9wZQ" to "invalid_cursor",
            )
        for ((query, code) in cases) {
            mockMvc
                .perform(get("$base/students/readiness?$query").with(signedIn()))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value(code))
        }
    }

    @Test
    fun `a batch outside the faculty member's scope is a 404 on the dashboard`() {
        val scope = scope(CampusRole.FACULTY, setOf(batchId))
        given(access.resolve(identity, orgId)).willReturn(scope)
        val otherBatch = UUID.randomUUID()
        given(readiness.batchDepartment(scope, otherBatch)).willReturn(departmentId)

        mockMvc.perform(get("$base/dashboard?batchId=$otherBatch").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("$base/dashboard?departmentId=${UUID.randomUUID()}").with(signedIn())).andExpect(status().isNotFound)
    }

    @Test
    fun `the dashboard counts and bands`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        stubOneStudent(scope, ReadinessFilter(), interviewScores = listOf(4, 5))
        given(readiness.openStudentInvites(scope, ReadinessFilter())).willReturn(2)

        mockMvc
            .perform(get("$base/dashboard").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.enrolled").value(3))
            .andExpect(jsonPath("$.joined").value(1))
            .andExpect(jsonPath("$.active").value(1))
            .andExpect(jsonPath("$.completionRate").value(1.0))
            .andExpect(jsonPath("$.bands.strong").value(1))
            .andExpect(jsonPath("$.bands.not_enough_evidence").value(0))
            .andExpect(jsonPath("$.heatmap.columns[0]").value("dbms"))
            .andExpect(jsonPath("$.heatmap.rows[0].cells[0].students").value(1))
            .andExpect(jsonPath("$.heatmap.rows[0].cells[0].average").value(null as Any?))
    }

    @Test
    fun `the CSV export has a BOM, neutralises formulas, and is audited with its filters`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        stubOneStudent(scope, ReadinessFilter(), interviewScores = listOf(4, 5), name = "=HYPERLINK(\"http://x\")")

        val body =
            mockMvc
                .perform(get("$base/exports/students.csv?band=strong&sort=overall&order=desc").with(signedIn()))
                .andExpect(status().isOk)
                .andExpect(header().string("Content-Type", "text/csv;charset=UTF-8"))
                .andReturn()
                .response.contentAsByteArray

        assertEquals(listOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()), body.take(3))
        val lines = String(body.drop(3).toByteArray(), Charsets.UTF_8).split("\r\n")
        assertEquals(ReadinessCsv.HEADER.joinToString(","), lines[0])
        assertTrue(lines[1].startsWith("\"'=HYPERLINK(\"\"http://x\"\")\",A-001,CSE,CSE 2027,90,Strong,Not attempted,"), lines[1])
        val detail = auditDetail("students.exported")
        assertEquals("strong", detail["band"])
        assertEquals("overall", detail["sort"])
        assertEquals("desc", detail["order"])
        assertEquals(1, detail["rows"])
    }

    @Test
    fun `opening the batch report is a 204 and an audit entry`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.batchDepartment(scope, batchId)).willReturn(departmentId)

        mockMvc
            .perform(post("$base/exports/batch-report-viewed").with(signedIn()).json("""{"batchId":"$batchId"}"""))
            .andExpect(status().isNoContent)

        verify(audit).record(
            scope,
            "batch_report.viewed",
            CampusOrgService.TARGET_ORG,
            orgId,
            mapOf("batchId" to batchId.toString(), "departmentId" to null),
        )
    }

    // -- fixtures ------------------------------------------------------------------------

    /** One student with one completed interview attempt per score (out of 5), topic DBMS. */
    private fun stubOneStudent(
        scope: OrgScope,
        filter: ReadinessFilter,
        interviewScores: List<Int>,
        name: String = "Asha Rao",
    ) {
        val now = Instant.now().truncatedTo(ChronoUnit.SECONDS)
        given(readiness.weights(scope)).willReturn(ReadinessWeightSet.DEFAULT)
        given(readiness.students(scope, filter)).willReturn(
            listOf(
                ReadinessStudentRow(
                    studentMember,
                    studentUser,
                    name,
                    "A-001",
                    batchId,
                    "CSE 2027",
                    departmentId,
                    "CSE",
                    now.minus(1, ChronoUnit.DAYS),
                ),
            ),
        )
        given(readiness.assignments(scope)).willReturn(
            listOf(
                ReadinessAssignmentRow(
                    assignmentId,
                    AssignmentKind.INTERVIEW,
                    "Technical round",
                    "technical_interview",
                    "dbms",
                    "published",
                    now.minus(1, ChronoUnit.DAYS),
                    false,
                ),
            ),
        )
        given(assignments.recipientFacts(scope, setOf(assignmentId), filter.batchId, filter.memberId)).willReturn(
            listOf(
                RecipientFacts(
                    assignmentId = assignmentId,
                    memberId = studentMember,
                    userId = studentUser,
                    name = name,
                    email = "asha@college.edu",
                    rollNumber = "A-001",
                    batchId = batchId,
                    batchName = "CSE 2027",
                    attemptsUsed = interviewScores.size,
                    orgFundedUsed = interviewScores.size,
                    attemptCompleted = true,
                    attemptInProgress = false,
                    sessionIds = listOf(sessionId),
                    completedSessionIds = listOf(sessionId),
                    stepsAnswered = 0,
                    stepsCorrect = 0,
                    stepsTotal = 0,
                    lastActivityAt = now,
                ),
            ),
        )
        given(readiness.interviewEvidence(scope, filter)).willReturn(
            interviewScores.mapIndexed { index, score ->
                InterviewEvidenceRow(
                    assignmentId = assignmentId,
                    memberId = studentMember,
                    sessionId = if (index == 0) sessionId else UUID.randomUUID(),
                    title = "Technical round",
                    component = "technical_interview",
                    topic = "dbms",
                    completedAt = now.minus(index.toLong(), ChronoUnit.HOURS),
                    scoringPayloadJson =
                        """{"assessableTurns":3,"answeredTurns":4,"competencies":[{"competency":"DB","score":$score,"maxScore":5}]}""",
                )
            },
        )
    }

    private fun auditDetail(action: String): Map<*, *> =
        mockingDetails(audit)
            .invocations
            .single { it.method.name == "record" && it.arguments[1] == action }
            .arguments[4] as Map<*, *>

    private fun report() =
        SessionReportView(
            sessionId = sessionId,
            companyName = "General practice",
            roleTitle = "Software Engineer",
            roundType = "technical_fundamentals",
            roundLabel = "Technical interview",
            archetypeLabel = "Service-based IT",
            answeredTurns = 3,
            generatedAt = Instant.parse("2026-11-13T08:00:00Z"),
            headline = "Solid fundamentals",
            summary = "A short report.",
            assistance = ReportAssistanceView(3, 3, 0, "No help used", "", emptyList(), emptyList()),
            competencies = emptyList(),
            annotations = emptyList(),
            communication = ReportCommunicationView("Clear", "Low", "Steady", "No", "Direct"),
            practicePlan = emptyList(),
            recommendedNextSession = "Another technical round",
            outcomeSimulation = ReportOutcomeView("Likely", "medium", "Grounded in the answers."),
        )

    private fun anyScope(): OrgScope = ArgumentMatchers.any(OrgScope::class.java) ?: scope(CampusRole.TPO)

    private fun anyWeights(): ReadinessWeightSet = ArgumentMatchers.any(ReadinessWeightSet::class.java) ?: ReadinessWeightSet.DEFAULT

    private fun anyUuid(): UUID = ArgumentMatchers.any(UUID::class.java) ?: UUID.randomUUID()

    private fun MockHttpServletRequestBuilder.json(body: String) = contentType(MediaType.APPLICATION_JSON).content(body)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }

    private companion object {
        const val DEFAULT_WEIGHTS = """{"coding":30,"coreCs":25,"technicalInterview":25,"communication":10,"aptitude":10}"""
    }
}
