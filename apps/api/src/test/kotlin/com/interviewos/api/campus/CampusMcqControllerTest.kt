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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * The MCQ routes (contract "Module 4b") through the real [CampusMcqService] and
 * [CampusAssignmentService], with the repositories mocked at the boundary: 401 without a token,
 * 404 for someone with no claim, 403 for a role without the permission, then the happy paths.
 * Above all: no answer key or explanation is serialised before a submission. The SQL — scoping,
 * the locks, the attempt limit — is exercised by [CampusMcqDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [MeMcqController::class, CampusMcqController::class, CampusAssignmentController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusMcqService::class,
    CampusAssignmentService::class,
)
class CampusMcqControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var assignments: AssignmentRepository

    @MockitoBean private lateinit var mcq: McqRepository

    @MockitoBean private lateinit var audit: CampusAudit

    @MockitoBean private lateinit var notifications: CampusNotifications

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "student@college.edu", null)
    private val orgId = UUID.fromString("0b000000-0000-0000-0000-00000000000a")
    private val memberId = UUID.fromString("0b000000-0000-0000-0000-0000000000c1")
    private val batchId = UUID.fromString("0b000000-0000-0000-0000-0000000000b1")
    private val assignmentId = UUID.fromString("0b000000-0000-0000-0000-0000000000a1")
    private val attemptId = UUID.fromString("0b000000-0000-0000-0000-0000000000f1")
    private val due = Instant.now().plus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS)

    private val student = OrgScope(orgId, userId, CampusRole.STUDENT, memberId, platformAdmin = false)

    private val questionIds = (1..5).map { "mcq-dsa-arrays-q$it" }
    private val questions =
        questionIds.associateWith { id ->
            McqQuestionRow(
                id = id,
                prompt = "Prompt for $id",
                code = null,
                optionsJson = """[{"id":"a","text":"First"},{"id":"b","text":"Second"},{"id":"c","text":"Third"}]""",
                correctOptionId = "b",
                explanation = "SECRET-EXPLANATION for $id",
            )
        }

    // -- auth and claims -------------------------------------------------------------------

    @Test
    fun `no token is a 401 and nothing is resolved`() {
        mockMvc.perform(post("/api/v1/me/assignments/$assignmentId/mcq-attempts")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/me/mcq-attempts/$attemptId")).andExpect(status().isUnauthorized)
        mockMvc.perform(post("/api/v1/me/mcq-attempts/$attemptId/submit").json("{}")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/mcq-bank")).andExpect(status().isUnauthorized)
        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/students/$memberId/mcq-attempts/$attemptId"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(access, assignments, mcq, audit)
    }

    @Test
    fun `someone who is not a joined student gets 404 on every student route`() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(null)

        mockMvc.perform(post("/api/v1/me/assignments/$assignmentId/mcq-attempts").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/v1/me/mcq-attempts/$attemptId").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(post("/api/v1/me/mcq-attempts/$attemptId/submit").with(signedIn()).json("{}")).andExpect(status().isNotFound)

        verifyNoInteractions(mcq)
    }

    @Test
    fun `someone who is not staff of the college gets 404 on the staff routes`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())

        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/mcq-bank").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/students/$memberId/mcq-attempts/$attemptId").with(signedIn()))
            .andExpect(status().isNotFound)

        verifyNoInteractions(mcq, audit)
    }

    @Test
    fun `a role without report access gets 403 on the staff attempt view, before anything is read`() {
        given(access.resolve(identity, orgId)).willReturn(student)

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/students/$memberId/mcq-attempts/$attemptId").with(signedIn()))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))

        verifyNoInteractions(mcq, audit)
    }

    // -- the student -----------------------------------------------------------------------

    @Test
    fun `starting draws the questions and returns them without any answer key`() {
        signedInStudent()
        given(assignments.publishedFor(student, memberId, assignmentId)).willReturn(listOf(mcqRow()))
        given(mcq.lockMember(student, memberId)).willReturn(true)
        given(mcq.counts(student, assignmentId, memberId)).willReturn(McqAttemptCounts(0, null))
        given(mcq.liveQuestionIds(listOf("dsa"))).willReturn(questionIds + listOf("mcq-dsa-arrays-q6", "mcq-dsa-arrays-q7"))
        given(
            mcq.insert(
                sameScope(student),
                eqUuid(assignmentId),
                eqUuid(memberId),
                ArgumentMatchers.anyLong(),
                anyList(),
                anyInstant(),
                nullableInstant(),
            ),
        ).willReturn(attemptId)
        given(mcq.findOwn(student, memberId, attemptId)).willReturn(attempt())
        given(mcq.questions(questionIds)).willReturn(questions)

        val body =
            mockMvc
                .perform(post("/api/v1/me/assignments/$assignmentId/mcq-attempts").with(signedIn()))
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.attemptId").value(attemptId.toString()))
                .andExpect(jsonPath("$.questions.length()").value(5))
                .andExpect(jsonPath("$.questions[0].options[1].text").value("Second"))
                .andExpect(jsonPath("$.result").isEmpty)
                .andReturn()
                .response.contentAsString

        assertNoKey(body)
        val inserted = mockingDetails(mcq).invocations.single { it.method.name == "insert" }

        @Suppress("UNCHECKED_CAST")
        val drawn = inserted.arguments[4] as List<String>
        assertEquals(5, drawn.size, "questionCount questions are drawn")
        assertEquals(McqDraw.draw(questionIds + listOf("mcq-dsa-arrays-q6", "mcq-dsa-arrays-q7"), 5, inserted.arguments[3] as Long), drawn)
    }

    @Test
    fun `an open attempt must be resumed rather than a new one started`() {
        signedInStudent()
        given(assignments.publishedFor(student, memberId, assignmentId)).willReturn(listOf(mcqRow()))
        given(mcq.lockMember(student, memberId)).willReturn(true)
        given(mcq.counts(student, assignmentId, memberId)).willReturn(McqAttemptCounts(1, attemptId))

        mockMvc
            .perform(post("/api/v1/me/assignments/$assignmentId/mcq-attempts").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("mcq_attempt_open"))
        verify(mcq, never()).insert(
            sameScope(student),
            eqUuid(assignmentId),
            eqUuid(memberId),
            ArgumentMatchers.anyLong(),
            anyList(),
            anyInstant(),
            nullableInstant(),
        )
    }

    @Test
    fun `the attempt limit refuses a further start`() {
        signedInStudent()
        given(assignments.publishedFor(student, memberId, assignmentId)).willReturn(listOf(mcqRow(attemptLimit = 2)))
        given(mcq.lockMember(student, memberId)).willReturn(true)
        given(mcq.counts(student, assignmentId, memberId)).willReturn(McqAttemptCounts(2, null))

        mockMvc
            .perform(post("/api/v1/me/assignments/$assignmentId/mcq-attempts").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("assignment_attempt_limit"))
    }

    @Test
    fun `an interview assignment cannot be started as a test`() {
        signedInStudent()
        given(assignments.publishedFor(student, memberId, assignmentId)).willReturn(listOf(mcqRow().copy(kind = AssignmentKind.INTERVIEW)))

        mockMvc
            .perform(post("/api/v1/me/assignments/$assignmentId/mcq-attempts").with(signedIn()))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("assignment_not_found"))
    }

    @Test
    fun `resuming an open attempt shows the questions and still no key`() {
        signedInStudent()
        given(mcq.findOwn(student, memberId, attemptId)).willReturn(attempt())
        given(mcq.questions(questionIds)).willReturn(questions)

        val body =
            mockMvc
                .perform(get("/api/v1/me/mcq-attempts/$attemptId").with(signedIn()))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.questions.length()").value(5))
                .andExpect(jsonPath("$.submittedAt").isEmpty)
                .andReturn()
                .response.contentAsString
        assertNoKey(body)
    }

    @Test
    fun `a student cannot read another student's attempt, because it is looked up by their own membership only`() {
        signedInStudent()
        given(mcq.findOwn(student, memberId, attemptId)).willReturn(null)

        mockMvc
            .perform(get("/api/v1/me/mcq-attempts/$attemptId").with(signedIn()))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("mcq_attempt_not_found"))
        mockMvc
            .perform(post("/api/v1/me/mcq-attempts/$attemptId/submit").with(signedIn()).json("""{"answers":[]}"""))
            .andExpect(status().isNotFound)
        verify(mcq).findOwn(student, memberId, attemptId, false)
        verify(mcq).findOwn(student, memberId, attemptId, true)
    }

    @Test
    fun `submitting grades on the server and only then reveals the key and explanations`() {
        signedInStudent()
        given(mcq.findOwn(student, memberId, attemptId, true)).willReturn(attempt())
        given(mcq.questions(questionIds)).willReturn(questions)
        given(
            mcq.submit(
                sameScope(student),
                eqUuid(attemptId),
                ArgumentMatchers.anyString() ?: "",
                anyInstant(),
                ArgumentMatchers.any(McqGrade::class.java) ?: McqGrade(0, 0, 0, emptyMap()),
                ArgumentMatchers.anyBoolean(),
            ),
        ).willReturn(true)
        val answers = mapOf(questionIds[0] to "b", questionIds[1] to "b", questionIds[2] to "a")
        given(mcq.findOwn(student, memberId, attemptId)).willReturn(attempt(submitted = true, answers = answers, correct = 2))

        val body =
            """{"answers":[{"questionId":"${questionIds[0]}","optionId":"b"},{"questionId":"${questionIds[1]}","optionId":"b"},""" +
                """{"questionId":"${questionIds[2]}","optionId":"a"}]}"""
        mockMvc
            .perform(post("/api/v1/me/mcq-attempts/$attemptId/submit").with(signedIn()).json(body))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.result.correct").value(2))
            .andExpect(jsonPath("$.result.total").value(5))
            .andExpect(jsonPath("$.result.score").value(40))
            .andExpect(jsonPath("$.result.review[0].correctOptionId").value("b"))
            .andExpect(jsonPath("$.result.review[2].chosenOptionId").value("a"))
            .andExpect(jsonPath("$.result.review[3].chosenOptionId").isEmpty)
            .andExpect(jsonPath("$.result.review[0].explanation").value("SECRET-EXPLANATION for ${questionIds[0]}"))

        val submitted = mockingDetails(mcq).invocations.single { it.method.name == "submit" }
        val grade = submitted.arguments[4] as McqGrade
        assertEquals(2, grade.correct, "graded on the server from the stored key")
        assertEquals(40, grade.score)
    }

    @Test
    fun `a second submission is refused and grades nothing`() {
        signedInStudent()
        given(mcq.findOwn(student, memberId, attemptId, true)).willReturn(attempt(submitted = true, answers = emptyMap(), correct = 0))

        mockMvc
            .perform(post("/api/v1/me/mcq-attempts/$attemptId/submit").with(signedIn()).json("""{"answers":[]}"""))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("mcq_attempt_submitted"))
        assertTrue(mockingDetails(mcq).invocations.none { it.method.name == "submit" })
    }

    @Test
    fun `an answer to a question not drawn, or with an option it does not have, is refused`() {
        signedInStudent()
        given(mcq.findOwn(student, memberId, attemptId, true)).willReturn(attempt())
        given(mcq.questions(questionIds)).willReturn(questions)

        mockMvc
            .perform(
                post("/api/v1/me/mcq-attempts/$attemptId/submit")
                    .with(signedIn())
                    .json("""{"answers":[{"questionId":"mcq-other-question","optionId":"a"}]}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("mcq_answers_invalid"))
        mockMvc
            .perform(
                post("/api/v1/me/mcq-attempts/$attemptId/submit")
                    .with(signedIn())
                    .json("""{"answers":[{"questionId":"${questionIds[0]}","optionId":"z"}]}"""),
            ).andExpect(status().isBadRequest)
        assertTrue(mockingDetails(mcq).invocations.none { it.method.name == "submit" })
    }

    // -- staff -----------------------------------------------------------------------------

    @Test
    fun `staff see a submitted attempt with its review, and the view is audited`() {
        val tpo = OrgScope(orgId, userId, CampusRole.TPO, UUID.randomUUID(), platformAdmin = false)
        given(access.resolve(identity, orgId)).willReturn(tpo)
        given(mcq.findForStaff(tpo, memberId, attemptId)).willReturn(attempt(submitted = true, answers = emptyMap(), correct = 0))
        given(mcq.questions(questionIds)).willReturn(questions)

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/students/$memberId/mcq-attempts/$attemptId").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.result.score").value(0))
            .andExpect(jsonPath("$.result.review.length()").value(5))

        verify(audit).record(tpo, "mcq.viewed", CampusMcqService.TARGET_MCQ_ATTEMPT, attemptId, mapOf("memberId" to memberId.toString()))
    }

    @Test
    fun `staff never see the key of an attempt still being taken`() {
        val tpo = OrgScope(orgId, userId, CampusRole.TPO, UUID.randomUUID(), platformAdmin = false)
        given(access.resolve(identity, orgId)).willReturn(tpo)
        given(mcq.findForStaff(tpo, memberId, attemptId)).willReturn(attempt())
        given(mcq.questions(questionIds)).willReturn(questions)

        val body =
            mockMvc
                .perform(get("/api/v1/campus/orgs/$orgId/students/$memberId/mcq-attempts/$attemptId").with(signedIn()))
                .andExpect(status().isOk)
                .andReturn()
                .response.contentAsString
        assertNoKey(body)
    }

    @Test
    fun `an attempt outside the caller's college or scope is a 404`() {
        val tpo = OrgScope(orgId, userId, CampusRole.TPO, UUID.randomUUID(), platformAdmin = false)
        given(access.resolve(identity, orgId)).willReturn(tpo)
        given(mcq.findForStaff(tpo, memberId, attemptId)).willReturn(null)

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/students/$memberId/mcq-attempts/$attemptId").with(signedIn()))
            .andExpect(status().isNotFound)
        verifyNoInteractions(audit)
    }

    @Test
    fun `the bank lists only courses with at least five live questions`() {
        val tpo = OrgScope(orgId, userId, CampusRole.TPO, UUID.randomUUID(), platformAdmin = false)
        given(access.resolve(identity, orgId)).willReturn(tpo)
        given(assignments.mcqCourses(null)).willReturn(
            listOf(McqCourseRow("dsa", "Data Structures and Algorithms", "dsa", 90), McqCourseRow("tiny", "Tiny", null, 4)),
        )

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/mcq-bank").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].courseSlug").value("dsa"))
            .andExpect(jsonPath("$[0].topic").value("dsa"))
            .andExpect(jsonPath("$[0].questions").value(90))
    }

    // -- the builder -----------------------------------------------------------------------

    @Test
    fun `the builder checks the courses against the live bank`() {
        val tpo = OrgScope(orgId, userId, CampusRole.TPO, UUID.randomUUID(), platformAdmin = false)
        given(access.resolve(identity, orgId)).willReturn(tpo)
        given(assignments.mcqCourses(listOf("dsa", "tiny"))).willReturn(
            listOf(McqCourseRow("dsa", "DSA", "dsa", 90), McqCourseRow("tiny", "Tiny", null, 4)),
        )
        given(assignments.mcqCourses(listOf("dsa"))).willReturn(listOf(McqCourseRow("dsa", "DSA", "dsa", 12)))

        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(mcqBody("""["dsa","tiny"]""", 10)))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("assignment_invalid"))
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("mcq.courseSlugs:")))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(mcqBody("""["dsa"]""", 20)))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("mcq.questionCount:")))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(mcqBody("""["dsa"]""", 4)))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("mcq.questionCount:")))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(mcqBody("""["dsa"]""", 10, minutes = 200)))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("mcq.timeLimitMinutes:")))
        assertFalse(mockingDetails(assignments).invocations.any { it.method.name == "create" })
    }

    @Test
    fun `a valid MCQ test is created with coding as the default component for DSA`() {
        val tpo = OrgScope(orgId, userId, CampusRole.TPO, UUID.randomUUID(), platformAdmin = false)
        given(access.resolve(identity, orgId)).willReturn(tpo)
        given(assignments.mcqCourses(listOf("dsa"))).willReturn(listOf(McqCourseRow("dsa", "DSA", "dsa", 90)))
        given(assignments.existingBatches(tpo, listOf(batchId))).willReturn(setOf(batchId))
        given(assignments.create(sameScope(tpo), anyFields())).willReturn(assignmentId)
        given(assignments.find(tpo, assignmentId)).willReturn(mcqRow(status = "draft"))
        given(assignments.targets(tpo, listOf(assignmentId))).willReturn(
            mapOf(assignmentId to AssignmentTargetRows(emptyList(), emptyList())),
        )

        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/assignments").with(signedIn()).json(mcqBody("""["dsa"]""", 10, minutes = 20)))
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.kind").value("mcq_test"))
            .andExpect(jsonPath("$.mcq.courseSlugs[0]").value("dsa"))

        val fields = mockingDetails(assignments).invocations.single { it.method.name == "create" }.arguments[1] as AssignmentFields
        assertEquals(AssignmentKind.MCQ_TEST, fields.kind)
        assertEquals(listOf("dsa"), fields.mcqCourseSlugs)
        assertEquals(10, fields.mcqQuestionCount)
        assertEquals(20, fields.mcqTimeLimitMinutes)
        assertEquals("coding", fields.component)
        assertEquals(null, fields.interviewCap)
        assertEquals(2, fields.attemptLimit)
    }

    // -- fixtures --------------------------------------------------------------------------

    private fun signedInStudent() {
        given(access.resolveOwnStudentMembership(identity)).willReturn(student)
        given(assignments.activeOrg(student)).willReturn(ActiveOrg("Demo College", 10))
    }

    private fun mcqBody(
        courses: String,
        count: Int,
        minutes: Int? = null,
    ) = """
        {"kind":"mcq_test","title":"DSA check","dueAt":"$due","allowLate":false,"attemptLimit":2,
         "mcq":{"courseSlugs":$courses,"questionCount":$count,"timeLimitMinutes":${minutes ?: "null"}},
         "targets":{"batchIds":["$batchId"],"memberIds":[]}}
        """.trimIndent()

    private fun mcqRow(
        status: String = "published",
        attemptLimit: Int = 1,
    ) = AssignmentRow(
        id = assignmentId,
        kind = AssignmentKind.MCQ_TEST,
        title = "DSA check",
        instructions = null,
        roundType = null,
        durationMinutes = null,
        companyName = null,
        roleTitle = null,
        candidateStage = null,
        language = "english",
        focusTopic = null,
        scenarioIds = null,
        opensAt = due.minus(14, ChronoUnit.DAYS),
        dueAt = due,
        allowLate = false,
        attemptLimit = attemptLimit,
        interviewCap = null,
        component = "coding",
        topic = "dsa",
        status = status,
        createdAt = Instant.parse("2026-11-13T10:00:00Z"),
        publishedAt = if (status == "draft") null else Instant.parse("2026-11-13T11:00:00Z"),
        createdByMemberId = null,
        createdByName = null,
        mcqCourseSlugs = listOf("dsa"),
        mcqQuestionCount = 5,
        mcqTimeLimitMinutes = 20,
    )

    private fun attempt(
        submitted: Boolean = false,
        answers: Map<String, String>? = null,
        correct: Int? = null,
    ): McqAttemptRow {
        val started = Instant.now().minusSeconds(60)
        return McqAttemptRow(
            id = attemptId,
            assignmentId = assignmentId,
            assignmentTitle = "DSA check",
            memberId = memberId,
            seed = 7L,
            questionIds = questionIds,
            answersJson =
                if (submitted) {
                    answers.orEmpty().entries.joinToString(
                        ",",
                        "{",
                        "}",
                    ) { "\"${it.key}\":\"${it.value}\"" }
                } else {
                    null
                },
            startedAt = started,
            deadlineAt = started.plusSeconds(1200),
            submittedAt = if (submitted) Instant.now() else null,
            correct = correct,
            total = if (submitted) questionIds.size else null,
            score = correct?.let { McqGrading.score(it, questionIds.size) },
            late = false,
        )
    }

    /** No answer key, no explanation, by field name or by content. */
    private fun assertNoKey(json: String) {
        for (forbidden in listOf("correctOptionId", "correct_option_id", "explanation", "SECRET-EXPLANATION", "review")) {
            assertFalse(json.contains(forbidden), "'$forbidden' appeared before submission: $json")
        }
    }

    private fun sameScope(scope: OrgScope): OrgScope = ArgumentMatchers.same(scope) ?: scope

    private fun eqUuid(value: UUID): UUID = ArgumentMatchers.eq(value) ?: value

    private fun anyInstant(): Instant = ArgumentMatchers.any(Instant::class.java) ?: Instant.EPOCH

    private fun nullableInstant(): Instant? = ArgumentMatchers.any()

    private fun anyList(): List<String> = ArgumentMatchers.anyList<String>() ?: emptyList()

    private fun anyFields(): AssignmentFields =
        ArgumentMatchers.any(AssignmentFields::class.java)
            ?: AssignmentFields(
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

    private fun MockHttpServletRequestBuilder.json(body: String) = contentType(MediaType.APPLICATION_JSON).content(body)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
