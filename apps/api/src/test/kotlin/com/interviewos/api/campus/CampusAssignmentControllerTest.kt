package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.user.SupabaseIdentity
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.test.assertEquals

/**
 * The assignment routes through the real [CampusAssignmentService], with the gate and the
 * repository mocked at the boundary: no token 401, not staff 404, wrong role 403 (before the
 * body is read), then validation and the happy paths. The SQL — scoping, recipients,
 * completion, the race — is exercised by [CampusAssignmentsDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [CampusAssignmentController::class, MeAssignmentsController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusAssignmentService::class,
)
class CampusAssignmentControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var notifications: CampusNotifications

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var assignments: AssignmentRepository

    @MockitoBean private lateinit var audit: CampusAudit

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "staff@college.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val callerMember = UUID.fromString("0a000000-0000-0000-0000-0000000000c1")
    private val otherMember = UUID.fromString("0a000000-0000-0000-0000-0000000000c2")
    private val batchId = UUID.fromString("0a000000-0000-0000-0000-0000000000b1")
    private val otherBatch = UUID.fromString("0a000000-0000-0000-0000-0000000000b2")
    private val assignmentId = UUID.fromString("0a000000-0000-0000-0000-0000000000a1")
    private val due = Instant.now().plus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS)

    private fun scope(
        role: CampusRole,
        batches: Set<UUID> = emptySet(),
    ) = OrgScope(orgId, userId, role, callerMember, platformAdmin = false, facultyBatchIds = batches)

    private val validBody =
        """
        {"kind":"interview","title":"Mock technical round","roundType":"technical_fundamentals","durationMinutes":45,
         "companyName":"Infosys","roleTitle":"Systems Engineer","candidateStage":"student","language":"english",
         "dueAt":"$due","allowLate":false,"attemptLimit":2,"interviewCap":1,
         "targets":{"batchIds":["$batchId"],"memberIds":[]}}
        """.trimIndent()

    @Test
    fun `no token is a 401 and nothing is resolved`() {
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/assignments")).andExpect(status().isUnauthorized)
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").contentType(MediaType.APPLICATION_JSON).content(validBody))
            .andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/me/assignments")).andExpect(status().isUnauthorized)

        verifyNoInteractions(access, assignments, audit)
    }

    @Test
    fun `someone who is not staff of the college gets 404 on every route`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())

        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/assignments").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/arena-scenarios").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(validBody))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("not_found"))
        mockMvc
            .perform(
                get("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/progress").with(signedIn()),
            ).andExpect(status().isNotFound)
        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/publish").with(signedIn()),
            ).andExpect(status().isNotFound)

        verifyNoInteractions(assignments, audit)
    }

    @Test
    fun `a platform admin may read assignments but not create one`() {
        given(access.resolve(identity, orgId)).willReturn(OrgScope(orgId, userId, null, null, platformAdmin = true))

        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json("""{"kind":"nonsense"}"""))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))

        verifyNoInteractions(assignments, audit)
    }

    @Test
    fun `a TPO creates a draft interview assignment`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(assignments.existingBatches(scope, listOf(batchId))).willReturn(setOf(batchId))
        given(assignments.create(sameScope(scope), anyFields())).willReturn(assignmentId)
        given(assignments.find(scope, assignmentId)).willReturn(row())
        given(assignments.targets(scope, listOf(assignmentId)))
            .willReturn(mapOf(assignmentId to AssignmentTargetRows(listOf(TargetBatchView(batchId, "CSE 2027")), emptyList())))

        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(validBody))
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(assignmentId.toString()))
            .andExpect(jsonPath("$.status").value("draft"))
            .andExpect(jsonPath("$.component").value("technical_interview"))
            .andExpect(jsonPath("$.targetBatches[0].name").value("CSE 2027"))
            .andExpect(jsonPath("$.counts.recipients").value(0))

        val written = createdFields()
        assertEquals("technical_fundamentals", written.roundType)
        assertEquals(45, written.durationMinutes)
        assertEquals("Infosys", written.companyName)
        assertEquals(2, written.attemptLimit)
        assertEquals(1, written.interviewCap)
        // Defaulted from the round type, as the contract says, because staff did not choose one.
        assertEquals("technical_interview", written.component)
        verify(assignments).replaceTargets(scope, assignmentId, listOf(batchId), emptyList())
        verify(audit).record(
            scope,
            "assignment.created",
            "assignment",
            assignmentId,
            mapOf("kind" to "interview", "batches" to 1, "students" to 0),
        )
    }

    @Test
    fun `a bad value is a 400 assignment_invalid naming the field, and nothing is written`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.COLLEGE_ADMIN))

        fun refused(
            body: String,
            field: String,
        ) {
            mockMvc
                .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(body))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("assignment_invalid"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("$field:")))
        }

        refused(validBody.replace("technical_fundamentals", "system_design"), "roundType")
        refused(validBody.replace("\"durationMinutes\":45", "\"durationMinutes\":50"), "durationMinutes")
        refused(
            validBody.replace("technical_fundamentals", "custom_topic").replace("\"durationMinutes\":45", "\"durationMinutes\":30"),
            "focusTopic",
        )
        refused(
            validBody
                .replace("technical_fundamentals", "custom_topic")
                .replace("\"durationMinutes\":45,", "\"durationMinutes\":45,\"focusTopic\":\"DBMS\","),
            "durationMinutes",
        )
        refused(validBody.replace("\"interviewCap\":1", "\"interviewCap\":3"), "interviewCap")
        refused(validBody.replace("\"attemptLimit\":2", "\"attemptLimit\":11"), "attemptLimit")
        refused(validBody.replace("\"dueAt\":\"$due\"", "\"dueAt\":\"2020-01-01T00:00:00Z\""), "dueAt")
        refused(validBody.replace("\"dueAt\":\"$due\"", "\"dueAt\":\"tomorrow\""), "dueAt")
        refused(validBody.replace("\"batchIds\":[\"$batchId\"]", "\"batchIds\":[]"), "targets")
        refused(validBody.replace("\"title\":\"Mock technical round\"", "\"title\":\"  \""), "title")
        refused(validBody.replace("\"candidateStage\":\"student\"", "\"candidateStage\":\"professional\""), "candidateStage")
        refused(validBody.replace("\"allowLate\":false", "\"allowLate\":false,\"component\":\"vibes\""), "component")
        refused(
            """{"kind":"arena_scenarios","title":"Set","dueAt":"$due","allowLate":false,"scenarioIds":[],""" +
                """"targets":{"batchIds":["$batchId"]}}""",
            "scenarioIds",
        )

        verify(assignments, never()).create(sameScope(scope(CampusRole.COLLEGE_ADMIN)), anyFields())
        verifyNoInteractions(audit)
    }

    @Test
    fun `a scenario id that is not live is refused`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(assignments.liveScenarios(listOf("dsa:two-sum", "dsa:withdrawn"))).willReturn(listOf(scenario("dsa:two-sum")))

        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/assignments")
                    .with(signedIn())
                    .json(
                        """{"kind":"arena_scenarios","title":"DSA set","dueAt":"$due","allowLate":false,""" +
                            """"scenarioIds":["dsa:two-sum","dsa:withdrawn"],"targets":{"batchIds":["$batchId"]}}""",
                    ),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("dsa:withdrawn")))
    }

    @Test
    fun `a target outside the college, or outside a faculty member's batches, is a 404`() {
        val tpo = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(tpo)
        given(assignments.existingBatches(tpo, listOf(batchId))).willReturn(emptySet())
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(validBody))
            .andExpect(status().isNotFound)

        val faculty = scope(CampusRole.FACULTY, batches = setOf(otherBatch))
        given(access.resolve(identity, orgId)).willReturn(faculty)
        given(assignments.existingBatches(faculty, listOf(batchId))).willReturn(setOf(batchId))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(validBody))
            .andExpect(status().isNotFound)

        // A student of the faculty member's batch is fine; one of another batch is not.
        val body = validBody.replace("\"batchIds\":[\"$batchId\"],\"memberIds\":[]", "\"memberIds\":[\"$otherMember\"]")
        given(assignments.joinedStudents(faculty, listOf(otherMember))).willReturn(mapOf(otherMember to batchId))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(body))
            .andExpect(status().isNotFound)

        verify(assignments, never()).create(sameScope(tpo), anyFields())
        verify(assignments, never()).create(sameScope(faculty), anyFields())
    }

    @Test
    fun `faculty may change only what they created`() {
        val faculty = scope(CampusRole.FACULTY, batches = setOf(batchId))
        given(access.resolve(identity, orgId)).willReturn(faculty)
        given(assignments.find(faculty, assignmentId)).willReturn(row(createdBy = otherMember))

        mockMvc
            .perform(patch("/api/v1/campus/orgs/$orgId/assignments/$assignmentId").with(signedIn()).json("""{"title":"Mine now"}"""))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/archive").with(signedIn()))
            .andExpect(status().isForbidden)

        verify(assignments, never()).lock(faculty, assignmentId)
        verifyNoInteractions(audit)
    }

    @Test
    fun `a published assignment accepts only the deadline, late attempts and instructions`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(assignments.find(scope, assignmentId)).willReturn(row(status = "published"))
        given(assignments.lock(scope, assignmentId)).willReturn(true)
        given(assignments.targets(scope, listOf(assignmentId))).willReturn(
            mapOf(assignmentId to AssignmentTargetRows(emptyList(), emptyList())),
        )

        mockMvc
            .perform(patch("/api/v1/campus/orgs/$orgId/assignments/$assignmentId").with(signedIn()).json("""{"roundType":"aptitude"}"""))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("roundType:")))

        val later = due.plus(2, ChronoUnit.DAYS)
        mockMvc
            .perform(
                patch("/api/v1/campus/orgs/$orgId/assignments/$assignmentId")
                    .with(signedIn())
                    .json("""{"dueAt":"$later","allowLate":true,"instructions":"Bring a resume."}"""),
            ).andExpect(status().isOk)
        val updated =
            mockingDetails(assignments)
                .invocations
                .single { it.method.name == "update" }
                .arguments[2] as AssignmentFields
        assertEquals(later, updated.dueAt)
        assertEquals(true, updated.allowLate)
        assertEquals("Bring a resume.", updated.instructions)
        assertEquals("technical_fundamentals", updated.roundType)
        verify(audit).record(
            scope,
            "assignment.updated",
            "assignment",
            assignmentId,
            mapOf("fields" to listOf("instructions", "dueAt", "allowLate")),
        )
    }

    @Test
    fun `publishing needs a draft and a deadline still ahead`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(assignments.lock(scope, assignmentId)).willReturn(true)

        given(assignments.find(scope, assignmentId)).willReturn(row(status = "published"))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/publish").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("assignment_not_draft"))

        given(assignments.find(scope, assignmentId)).willReturn(row(dueAt = Instant.now().minusSeconds(60)))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/publish").with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("dueAt:")))

        given(assignments.find(scope, assignmentId)).willReturn(row())
        given(assignments.targets(scope, listOf(assignmentId)))
            .willReturn(mapOf(assignmentId to AssignmentTargetRows(listOf(TargetBatchView(batchId, "CSE 2027")), emptyList())))
        given(assignments.publish(scope, assignmentId)).willReturn(true)
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/publish").with(signedIn()))
            .andExpect(status().isOk)
        verify(audit).record(scope, "assignment.published", "assignment", assignmentId)
    }

    @Test
    fun `progress derives each recipient's status and filters by it`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(assignments.find(scope, assignmentId)).willReturn(row())
        val sessionId = UUID.randomUUID()
        given(assignments.recipientFacts(scope, listOf(assignmentId), null, null))
            .willReturn(
                listOf(
                    facts(callerMember, attemptsUsed = 1, completed = true, sessions = listOf(sessionId)),
                    facts(otherMember),
                ),
            )

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/progress").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].status").value("completed"))
            .andExpect(jsonPath("$[0].attemptsUsed").value(1))
            .andExpect(jsonPath("$[0].sessionIds[0]").value(sessionId.toString()))
            .andExpect(jsonPath("$[0].scenarioScore").doesNotExist())
            .andExpect(jsonPath("$[1].status").value("not_started"))
        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/progress?status=not_started").with(signedIn()))
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].memberId").value(otherMember.toString()))
        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/assignments/$assignmentId/progress?status=late").with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_status"))
    }

    @Test
    fun `a caller with no college gets an empty list of their own assignments`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(null)

        mockMvc
            .perform(get("/api/v1/me/assignments").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))
        verifyNoInteractions(assignments)
    }

    @Test
    fun `a student sees whether they may start, by the same rule admission uses`() {
        val student = OrgScope(orgId, userId, CampusRole.STUDENT, callerMember, platformAdmin = false)
        given(access.resolveOwnStudentMembership(identity)).willReturn(student)
        given(assignments.activeOrg(student)).willReturn(ActiveOrg("Demo College", 1))
        given(assignments.publishedFor(student, callerMember, null)).willReturn(listOf(row(status = "published")))
        given(assignments.recipientFacts(student, listOf(assignmentId), null, callerMember))
            .willReturn(listOf(facts(callerMember, attemptsUsed = 0)))
        given(assignments.collegeUsage(student)).willReturn(1)

        mockMvc
            .perform(get("/api/v1/me/assignments").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].orgName").value("Demo College"))
            .andExpect(jsonPath("$[0].roundType").value("technical_fundamentals"))
            .andExpect(jsonPath("$[0].candidateStage").value("student"))
            .andExpect(jsonPath("$[0].status").value("not_started"))
            .andExpect(jsonPath("$[0].canStart").value(false))
            .andExpect(jsonPath("$[0].blockedReason").value("college_allowance"))
    }

    // -- fixtures --------------------------------------------------------------------

    private fun row(
        status: String = "draft",
        createdBy: UUID? = callerMember,
        dueAt: Instant = due,
    ) = AssignmentRow(
        id = assignmentId,
        kind = AssignmentKind.INTERVIEW,
        title = "Mock technical round",
        instructions = null,
        roundType = "technical_fundamentals",
        durationMinutes = 45,
        companyName = "Infosys",
        roleTitle = "Systems Engineer",
        candidateStage = "student",
        language = "english",
        focusTopic = null,
        scenarioIds = null,
        opensAt = dueAt.minus(14, ChronoUnit.DAYS),
        dueAt = dueAt,
        allowLate = false,
        attemptLimit = 2,
        interviewCap = 1,
        component = "technical_interview",
        topic = null,
        status = status,
        createdAt = Instant.parse("2026-11-13T10:00:00Z"),
        publishedAt = if (status == "draft") null else Instant.parse("2026-11-13T11:00:00Z"),
        createdByMemberId = createdBy,
        createdByName = "A Staff Member",
    )

    private fun facts(
        memberId: UUID,
        attemptsUsed: Int = 0,
        completed: Boolean = false,
        sessions: List<UUID> = emptyList(),
    ) = RecipientFacts(
        assignmentId = assignmentId,
        memberId = memberId,
        userId = UUID.randomUUID(),
        name = "A Student",
        email = "student@college.edu",
        rollNumber = null,
        batchId = batchId,
        batchName = "CSE 2027",
        attemptsUsed = attemptsUsed,
        orgFundedUsed = attemptsUsed,
        attemptCompleted = completed,
        attemptInProgress = false,
        sessionIds = sessions,
        completedSessionIds = if (completed) sessions else emptyList(),
        stepsAnswered = 0,
        stepsCorrect = 0,
        stepsTotal = 0,
        lastActivityAt = null,
    )

    private fun scenario(id: String) = ScenarioRow(id, "dsa", "dsa", "Data Structures and Algorithms", "Two sum", "foundations", 10)

    private fun createdFields(): AssignmentFields =
        mockingDetails(assignments)
            .invocations
            .single { it.method.name == "create" }
            .arguments[1] as AssignmentFields

    private fun sameScope(scope: OrgScope): OrgScope = ArgumentMatchers.same(scope) ?: scope

    private fun anyFields(): AssignmentFields = ArgumentMatchers.any(AssignmentFields::class.java) ?: placeholderFields

    private val placeholderFields =
        AssignmentFields(
            AssignmentKind.INTERVIEW,
            "x",
            null,
            null,
            null,
            null,
            null,
            null,
            "english",
            null,
            null,
            Instant.EPOCH,
            Instant.EPOCH,
            false,
            1,
            null,
            "core_cs",
            null,
        )

    private fun org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder.json(body: String) =
        contentType(MediaType.APPLICATION_JSON).content(body)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
