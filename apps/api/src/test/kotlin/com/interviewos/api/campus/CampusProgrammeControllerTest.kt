package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.user.SupabaseIdentity
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willReturn
import org.mockito.Mockito.mockingDetails
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.PlatformTransactionManager
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The programme routes (contract "Module 10") through the real [CampusProgrammeService] and
 * [CampusAssignmentService] (whose validation templates reuse), with the gate and repositories
 * mocked: 401, 404 for the wrong caller, 403 for the wrong role, then validation and the happy
 * paths. Cloning in one transaction, isolation and certificates are
 * [CampusProgrammeDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [AdminProgrammeTemplateController::class, CampusProgrammeController::class, MeProgrammeController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusAssignmentService::class,
    CampusProgrammeService::class,
)
class CampusProgrammeControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var programmes: ProgrammeRepository

    @MockitoBean private lateinit var assignments: AssignmentRepository

    @MockitoBean private lateinit var audit: CampusAudit

    @MockitoBean private lateinit var notifications: CampusNotifications

    @MockitoBean private lateinit var logos: OrgLogos

    @MockitoBean private lateinit var transactionManager: PlatformTransactionManager

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "staff@college.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val callerMember = UUID.fromString("0a000000-0000-0000-0000-0000000000c1")
    private val templateId = UUID.fromString("0a000000-0000-0000-0000-0000000000e7")
    private val programmeId = UUID.fromString("0a000000-0000-0000-0000-0000000000f7")
    private val batchId = UUID.fromString("0a000000-0000-0000-0000-0000000000b1")

    private val base = "/api/v1/campus/orgs/$orgId"
    private val admin = "/api/v1/admin/campus/programme-templates"
    private val tomorrow = LocalDate.now().plusDays(2)

    private fun scope(role: CampusRole) = OrgScope(orgId, userId, role, callerMember, platformAdmin = false)

    private val interviewModule =
        """{"week":1,"assignment":{"kind":"interview","title":"DBMS round","roundType":"technical_fundamentals",
           "durationMinutes":30,"allowLate":false,"attemptLimit":2,"topic":"dbms"}}"""

    private fun templateRow() =
        ProgrammeTemplateRow(
            templateId,
            "Placement Accelerator",
            "Six weeks of rounds.",
            6,
            """[{"week":1,"assignment":{"kind":"interview","title":"DBMS round","roundType":"technical_fundamentals",""" +
                """"durationMinutes":30,"candidateStage":"student","language":"english","allowLate":false,"attemptLimit":2,""" +
                """"component":"technical_interview","topic":"dbms"}}]""",
            Instant.parse("2026-11-13T00:00:00Z"),
        )

    @Test
    fun `no token is a 401 everywhere and nothing is resolved`() {
        mockMvc.perform(get(admin)).andExpect(status().isUnauthorized)
        mockMvc.perform(post(admin).json("{}")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("$base/programme-templates")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("$base/programmes")).andExpect(status().isUnauthorized)
        mockMvc.perform(post("$base/programmes").json("{}")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("$base/programmes/$programmeId/progress")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("$base/programmes/$programmeId/weeks")).andExpect(status().isUnauthorized)
        mockMvc.perform(post("$base/programmes/$programmeId/archive")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/me/programmes")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/me/programmes/$programmeId/certificate")).andExpect(status().isUnauthorized)

        verifyNoInteractions(access, programmes, assignments, audit)
    }

    @Test
    fun `the template catalogue is a 404 for anyone off the platform allow-list`() {
        given(access.requirePlatformAdmin(identity)).willThrow(ApiException.notFound())

        mockMvc.perform(get(admin).with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(post(admin).with(signedIn()).json("{}")).andExpect(status().isNotFound)
        mockMvc.perform(patch("$admin/$templateId").with(signedIn()).json("{}")).andExpect(status().isNotFound)
        mockMvc.perform(delete("$admin/$templateId").with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(programmes)
    }

    @Test
    fun `a template is validated module by module through the assignment rules`() {
        given(access.requirePlatformAdmin(identity)).willReturn(PlatformAdmin(userId))

        mockMvc
            .perform(post(admin).with(signedIn()).json("""{"title":"P","weeks":13,"modules":[$interviewModule]}"""))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("programme_template_invalid"))
            .andExpect(jsonPath("$.message").value(containsString("weeks")))
        mockMvc
            .perform(post(admin).with(signedIn()).json("""{"title":"P","weeks":2,"modules":[]}"""))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(containsString("at least one module")))
        mockMvc
            .perform(
                post(admin).with(signedIn()).json("""{"title":"P","weeks":2,"modules":[{"week":3,"assignment":{"kind":"interview"}}]}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(containsString("modules[0].week")))
        // A custom-topic round with no topic fails the module 4 rule, named by week.
        mockMvc
            .perform(
                post(admin)
                    .with(signedIn())
                    .json(
                        """{"title":"P","weeks":2,"modules":[{"week":2,"assignment":{"kind":"interview","title":"Topic",
                           "roundType":"custom_topic","durationMinutes":30,"attemptLimit":1}}]}""",
                    ),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("programme_template_invalid"))
            .andExpect(jsonPath("$.message").value(containsString("Week 2, module 1: focusTopic")))

        verifyNoInteractions(programmes)
    }

    @Test
    fun `a valid template is stored in normalised form`() {
        given(access.requirePlatformAdmin(identity)).willReturn(PlatformAdmin(userId))
        given(programmes.insertTemplate(anyAdmin(), anyString(), anyString(), ArgumentMatchers.anyInt(), anyString()))
            .willReturn(templateId)
        given(programmes.template(templateId)).willReturn(templateRow())

        mockMvc
            .perform(
                post(admin)
                    .with(signedIn())
                    .json("""{"title":"  Placement Accelerator ","description":"Six weeks.","weeks":6,"modules":[$interviewModule]}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(templateId.toString()))
            .andExpect(jsonPath("$.modules[0].assignment.component").value("technical_interview"))

        val stored =
            mockingDetails(programmes)
                .invocations
                .single { it.method.name == "insertTemplate" }
                .arguments
        assertEquals("Placement Accelerator", stored[1])
        val json = stored[4] as String
        // The defaults the assignment rules fill in are stored, so a clone is exactly what was validated.
        assertTrue(json.contains("\"candidateStage\":\"student\""), json)
        assertTrue(json.contains("\"component\":\"technical_interview\""), json)
    }

    @Test
    fun `starting a programme is for a college admin or TPO, checked before the body`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.FACULTY))

        mockMvc
            .perform(post("$base/programmes").with(signedIn()).json("{}"))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))
        mockMvc.perform(post("$base/programmes/$programmeId/archive").with(signedIn())).andExpect(status().isForbidden)

        verifyNoInteractions(programmes)
    }

    @Test
    fun `someone who is not staff of the college gets 404 on every college route`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())

        mockMvc.perform(get("$base/programme-templates").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("$base/programmes").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("$base/programmes/$programmeId").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(post("$base/programmes").with(signedIn()).json("{}")).andExpect(status().isNotFound)
        mockMvc.perform(get("$base/programmes/$programmeId/progress").with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(programmes)
    }

    @Test
    fun `a programme's start date, template and batches are checked`() {
        val tpo = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(tpo)
        given(programmes.template(templateId)).willReturn(templateRow())
        val good = """{"templateId":"$templateId","startsOn":"$tomorrow","batchIds":["$batchId"]}"""

        mockMvc
            .perform(post("$base/programmes").with(signedIn()).json("""{"startsOn":"$tomorrow","batchIds":["$batchId"]}"""))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("programme_invalid"))
        mockMvc
            .perform(post("$base/programmes").with(signedIn()).json(good.replace(templateId.toString(), UUID.randomUUID().toString())))
            .andExpect(status().isNotFound)
        for (date in listOf("2020-01-01", "12/12/2026", LocalDate.now().plusYears(2).toString())) {
            mockMvc
                .perform(post("$base/programmes").with(signedIn()).json(good.replace(tomorrow.toString(), date)))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.message").value(containsString("startsOn")))
        }
        mockMvc
            .perform(post("$base/programmes").with(signedIn()).json(good.replace("[\"$batchId\"]", "[]")))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(containsString("batchIds")))
        // A batch of another college is a 404, never a hint that it exists.
        given(assignments.existingBatches(tpo, listOf(batchId))).willReturn(emptySet())
        mockMvc.perform(post("$base/programmes").with(signedIn()).json(good)).andExpect(status().isNotFound)
    }

    @Test
    fun `any staff member reads the template catalogue`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.FACULTY))
        given(programmes.templates()).willReturn(listOf(templateRow()))

        mockMvc
            .perform(get("$base/programme-templates").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].title").value("Placement Accelerator"))
            .andExpect(jsonPath("$[0].weeks").value(6))
            .andExpect(jsonPath("$[0].modules[0].week").value(1))
    }

    @Test
    fun `the week-by-week view is a 404 for a non-member, a programme outside the college, and a student role is refused`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())
        mockMvc.perform(get("$base/programmes/$programmeId/weeks").with(signedIn())).andExpect(status().isNotFound)

        val staff = scope(CampusRole.TPO)
        willReturn(staff).given(access).resolve(identity, orgId)
        given(programmes.find(staff, programmeId)).willReturn(null)
        mockMvc.perform(get("$base/programmes/$programmeId/weeks").with(signedIn())).andExpect(status().isNotFound)

        willReturn(scope(CampusRole.STUDENT)).given(access).resolve(identity, orgId)
        mockMvc
            .perform(get("$base/programmes/$programmeId/weeks").with(signedIn()))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))

        verifyNoInteractions(assignments)
    }

    @Test
    fun `the week-by-week view says which weeks are open and how many of their students finished`() {
        val staff = scope(CampusRole.FACULTY)
        given(access.resolve(identity, orgId)).willReturn(staff)
        val row = ProgrammeRow(programmeId, templateId, "Placement Accelerator", LocalDate.now().minusDays(3), 6, "active")
        given(programmes.find(staff, programmeId)).willReturn(row)
        val weekOne = UUID.randomUUID()
        val weekTwo = UUID.randomUUID()
        given(programmes.assignments(staff, listOf(programmeId))).willReturn(
            mapOf(
                programmeId to
                    listOf(
                        ProgrammeAssignmentRow(weekOne, programmeId, 1, AssignmentKind.INTERVIEW, "DBMS round"),
                        ProgrammeAssignmentRow(weekTwo, programmeId, 2, AssignmentKind.INTERVIEW, "OS round"),
                    ),
            ),
        )
        val other = UUID.randomUUID()
        given(assignments.recipientFacts(staff, setOf(weekOne, weekTwo))).willReturn(
            listOf(
                facts(weekOne, completed = true),
                facts(weekOne, completed = false).copy(memberId = other),
                facts(weekTwo, completed = true),
                facts(weekTwo, completed = false).copy(memberId = other),
            ),
        )

        mockMvc
            .perform(get("$base/programmes/$programmeId/weeks").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].week").value(1))
            .andExpect(jsonPath("$[0].opened").value(true))
            .andExpect(jsonPath("$[0].assignments[0].title").value("DBMS round"))
            .andExpect(jsonPath("$[0].students").value(2))
            .andExpect(jsonPath("$[0].completedStudents").value(1))
            .andExpect(jsonPath("$[0].completionRate").value(0.5))
            // Week 2 is still locked: nothing to report yet, whatever a student did early.
            .andExpect(jsonPath("$[1].week").value(2))
            .andExpect(jsonPath("$[1].opened").value(false))
            .andExpect(jsonPath("$[1].completionRate").doesNotExist())
    }

    @Test
    fun `a caller with no college has no programmes and no certificate`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(null)

        mockMvc
            .perform(get("/api/v1/me/programmes").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))
        mockMvc.perform(get("/api/v1/me/programmes/$programmeId/certificate").with(signedIn())).andExpect(status().isNotFound)
    }

    @Test
    fun `the certificate is a 404 until every module is completed`() {
        val student = OrgScope(orgId, userId, CampusRole.STUDENT, callerMember, platformAdmin = false)
        given(access.resolveOwnStudentMembership(identity)).willReturn(student)
        given(assignments.activeOrg(student)).willReturn(ActiveOrg("College A", 10))
        val row = ProgrammeRow(programmeId, templateId, "Placement Accelerator", tomorrow, 6, "active")
        given(programmes.forStudent(student, callerMember)).willReturn(listOf(row))
        val module = UUID.randomUUID()
        given(programmes.assignments(student, listOf(programmeId))).willReturn(
            mapOf(programmeId to listOf(ProgrammeAssignmentRow(module, programmeId, 1, AssignmentKind.INTERVIEW))),
        )
        given(assignments.recipientFacts(student, setOf(module), null, callerMember))
            .willReturn(listOf(facts(module, completed = false)))

        mockMvc.perform(get("/api/v1/me/programmes/$programmeId/certificate").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(get("/api/v1/me/programmes").with(signedIn()))
            .andExpect(jsonPath("$[0].completedModules").value(0))
            .andExpect(jsonPath("$[0].totalModules").value(1))
            .andExpect(jsonPath("$[0].certificateId").doesNotExist())

        given(assignments.recipientFacts(student, setOf(module), null, callerMember))
            .willReturn(listOf(facts(module, completed = true)))
        given(programmes.certificateHead(student, callerMember))
            .willReturn(CertificateHead("Asha Rao", "asha@college.edu", "College A", null))
        given(programmes.completionTimes(student, callerMember, userId, listOf(module))).willReturn(
            mapOf(module to Instant.parse("2026-12-20T10:00:00Z")),
        )
        mockMvc
            .perform(get("/api/v1/me/programmes/$programmeId/certificate").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.studentName").value("Asha Rao"))
            .andExpect(jsonPath("$.orgName").value("College A"))
            .andExpect(jsonPath("$.completedAt").value("2026-12-20T10:00:00Z"))
            .andExpect(jsonPath("$.certificateId").value(ProgrammeSchedule.certificateId(programmeId, callerMember)))
            .andExpect(jsonPath("$.score").doesNotExist())
    }

    private fun facts(
        assignmentId: UUID,
        completed: Boolean,
    ) = RecipientFacts(
        assignmentId = assignmentId,
        memberId = callerMember,
        userId = userId,
        name = "Asha Rao",
        email = "asha@college.edu",
        rollNumber = null,
        batchId = batchId,
        batchName = "CSE 2027",
        attemptsUsed = 1,
        orgFundedUsed = 1,
        attemptCompleted = completed,
        attemptInProgress = false,
        sessionIds = emptyList(),
        completedSessionIds = emptyList(),
        stepsAnswered = 0,
        stepsCorrect = 0,
        stepsTotal = 0,
        lastActivityAt = null,
    )

    private fun anyAdmin(): PlatformAdmin = ArgumentMatchers.any(PlatformAdmin::class.java) ?: PlatformAdmin(userId)

    private fun anyString(): String = ArgumentMatchers.anyString() ?: ""

    private fun MockHttpServletRequestBuilder.json(body: String) = contentType(MediaType.APPLICATION_JSON).content(body)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
