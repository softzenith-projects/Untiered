package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.ReportScore
import com.interviewos.api.interview.ReportService
import com.interviewos.api.interview.SessionReportView
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Duration
import java.util.UUID
import kotlin.math.roundToInt

/** One student's readiness and assignment counts, worked out for a read. */
internal data class StudentReadinessFacts(
    val student: ReadinessStudentRow,
    val result: ReadinessResult,
    /** Published assignments only: what the student is currently set. */
    val assigned: Int,
    val completed: Int,
    val overdue: Int,
    /** Not completed and past the deadline, but late attempts are allowed. */
    val dueNow: Int,
    /** Some published assignment is completed or under way. */
    val started: Boolean,
)

/**
 * Student readiness and the placement dashboard (campus spec §6–7, contract "Module 6" and
 * "Module 7").
 *
 * Readiness is derived on every read and stored nowhere. Its evidence is only work done for this
 * college's assignments — a completed attempt at an interview assignment whose report has enough
 * assessable turns, or a completed scenario set — so a student's own practice can never move it.
 * Each read gathers the evidence for its whole scope in a handful of statements
 * ([ReadinessRepository], [AssignmentRepository.recipientFacts]) and then does the arithmetic in
 * memory ([ReadinessCalculator]); a 600-student batch is not 600 queries.
 *
 * Staff routes follow the campus order: resolve the [OrgScope] (404 when not staff there), check
 * the permission by name (403), then validate. A faculty member sees only the students of their
 * batches, and a batch or department filter outside their scope is a 404. A student's readiness
 * is the same whoever on the staff reads it.
 */
@Service
class CampusReadinessService internal constructor(
    private val access: CampusAccess,
    private val readiness: ReadinessRepository,
    private val assignments: AssignmentRepository,
    private val audit: CampusAudit,
    private val reports: ReportService,
    private val objectMapper: ObjectMapper,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        access: CampusAccess,
        readiness: ReadinessRepository,
        assignments: AssignmentRepository,
        audit: CampusAudit,
        reports: ReportService,
        objectMapper: ObjectMapper,
    ) : this(access, readiness, assignments, audit, reports, objectMapper, Clock.systemUTC())

    // -- the student -------------------------------------------------------------------

    /** The caller's own readiness at the college they study at. 404 when not a joined student. */
    @Transactional(readOnly = true)
    fun mine(identity: SupabaseIdentity): StudentReadiness {
        val scope = access.resolveOwnStudentMembership(identity) ?: throw ApiException.notFound()
        scope.require(CampusPermission.OWN_MEMBERSHIP)
        val memberId = scope.memberId ?: throw ApiException.notFound()
        // A suspended college is treated as not there, as `GET /me/campus` treats it.
        assignments.activeOrg(scope) ?: throw ApiException.notFound()
        val weights = readiness.weights(scope)
        val facts = compute(scope, ReadinessFilter(memberId = memberId), weights).singleOrNull() ?: throw ApiException.notFound()
        return studentView(facts, weights)
    }

    // -- staff: one student -------------------------------------------------------------

    @Transactional
    fun student(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
    ): StudentReadiness {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.READINESS_VIEW)
        val weights = readiness.weights(scope)
        val facts = compute(scope, ReadinessFilter(memberId = memberId), weights).singleOrNull() ?: throw ApiException.notFound()
        audit.record(scope, "readiness.viewed", CampusOrgService.TARGET_MEMBER, memberId)
        return studentView(facts, weights)
    }

    /**
     * The existing report of one of the student's assignment attempts, through the existing
     * report path (and its generation lease, when it is opened for the first time). Any other
     * session — a personal round above all — is a 404, exactly as a session that does not exist.
     *
     * Deliberately not one transaction: generating a report waits on the model, and must not
     * hold a database transaction open while it does. The entry is written once the report has
     * been produced, so the log records what was actually shown.
     */
    fun report(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
        sessionId: UUID,
    ): SessionReportView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENT_REPORT_VIEW)
        val ownerUserId = readiness.attemptSessionOwner(scope, memberId, sessionId) ?: throw ApiException.notFound()
        val report = reports.report(ownerUserId, sessionId)
        audit.record(scope, "report.viewed", TARGET_SESSION, sessionId, mapOf("memberId" to memberId.toString()))
        return report
    }

    // -- weights -------------------------------------------------------------------------

    @Transactional
    fun weights(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): ReadinessWeights {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.READINESS_VIEW)
        audit.recordPlatformAdminRead(scope, "readiness_weights.viewed", CampusOrgService.TARGET_ORG, orgId)
        return ReadinessWeights.of(readiness.weights(scope))
    }

    @Transactional
    fun updateWeights(
        identity: SupabaseIdentity,
        orgId: UUID,
        body: Map<String, Any?>?,
    ): ReadinessWeights {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.READINESS_WEIGHTS_EDIT)
        val weights = parseWeights(body)
        if (!readiness.updateWeights(scope, weights)) throw ApiException.notFound()
        audit.record(
            scope,
            "readiness_weights.updated",
            CampusOrgService.TARGET_ORG,
            orgId,
            mapOf(
                "coding" to weights.coding,
                "coreCs" to weights.coreCs,
                "technicalInterview" to weights.technicalInterview,
                "communication" to weights.communication,
                "aptitude" to weights.aptitude,
            ),
        )
        return ReadinessWeights.of(weights)
    }

    // -- the dashboard ---------------------------------------------------------------------

    @Transactional
    fun dashboard(
        identity: SupabaseIdentity,
        orgId: UUID,
        batchId: UUID?,
        departmentId: UUID?,
    ): DashboardView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.READINESS_VIEW)
        val filter = checkedFilter(scope, batchId, departmentId)
        val weights = readiness.weights(scope)
        val students = compute(scope, filter, weights)
        val now = clock.instant()
        val activeSince = now.minus(ACTIVE_WINDOW)

        val joined = students.size
        val enrolled = readiness.openStudentInvites(scope, filter) + joined
        val active = students.count { it.student.lastActiveAt?.isAfter(activeSince) == true }
        val completed = students.sumOf { it.completed }
        val denominator = completed + students.sumOf { it.overdue } + students.sumOf { it.dueNow }
        val bands = ReadinessBand.entries.associate { band -> band.wireValue to students.count { it.result.band == band } }

        audit.recordPlatformAdminRead(scope, "dashboard.viewed", CampusOrgService.TARGET_ORG, orgId)
        return DashboardView(
            filters = DashboardFilters(filter.batchId, filter.departmentId),
            enrolled = enrolled,
            joined = joined,
            active = active,
            completionRate = if (denominator == 0) null else completed.toDouble() / denominator,
            bands = bands,
            heatmap = heatmap(students),
        )
    }

    // -- the student table and its CSV ----------------------------------------------------------

    @Transactional
    fun table(
        identity: SupabaseIdentity,
        orgId: UUID,
        query: StudentTableQuery,
        cursor: String?,
    ): Page<StudentReadinessRow> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.READINESS_VIEW)
        val parsed = parseTable(query)
        val after = ReadinessTableSort.decodeCursor(cursor, parsed.sort, parsed.descending)
        val filter = checkedFilter(scope, query.batchId, query.departmentId)
        val rows = sortedRows(scope, filter, parsed)
        val remaining = if (after == null) rows else rows.filter { parsed.comparator.compare(it.key, after) > 0 }
        val page = remaining.take(CampusCursor.PAGE_SIZE)
        val next =
            if (remaining.size > page.size) ReadinessTableSort.encodeCursor(parsed.sort, parsed.descending, page.last().key) else null
        audit.recordPlatformAdminRead(scope, "students_readiness.viewed", CampusOrgService.TARGET_ORG, orgId)
        return Page(page.map { it.row }, next)
    }

    /** The whole filtered, sorted table as CSV, audited with the filters it was asked for. */
    @Transactional
    fun exportCsv(
        identity: SupabaseIdentity,
        orgId: UUID,
        query: StudentTableQuery,
    ): ByteArray {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.EXPORT)
        val parsed = parseTable(query)
        val filter = checkedFilter(scope, query.batchId, query.departmentId)
        val rows = sortedRows(scope, filter, parsed).map { it.row }
        audit.record(
            scope,
            "students.exported",
            CampusOrgService.TARGET_ORG,
            orgId,
            mapOf(
                "batchId" to filter.batchId?.toString(),
                "departmentId" to filter.departmentId?.toString(),
                "band" to parsed.band?.wireValue,
                "completion" to parsed.completion?.wireValue,
                "sort" to parsed.sort.wireValue,
                "order" to if (parsed.descending) "desc" else "asc",
                "rows" to rows.size,
            ),
        )
        return ReadinessCsv.students(rows)
    }

    /** The print-to-PDF batch report was opened. Nothing is returned; the entry is the point. */
    @Transactional
    fun batchReportViewed(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: BatchReportViewedRequest?,
    ) {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.EXPORT)
        val filter = checkedFilter(scope, request?.batchId, request?.departmentId)
        audit.record(
            scope,
            "batch_report.viewed",
            CampusOrgService.TARGET_ORG,
            orgId,
            mapOf("batchId" to filter.batchId?.toString(), "departmentId" to filter.departmentId?.toString()),
        )
    }

    // -- computing -----------------------------------------------------------------------------

    /**
     * Every student in scope with their readiness and counts, from five statements whatever the
     * number of students: the students, the assignments, the recipients' facts, the interview
     * evidence (and the weights, read by the caller).
     */
    internal fun compute(
        scope: OrgScope,
        filter: ReadinessFilter,
        weights: ReadinessWeightSet,
    ): List<StudentReadinessFacts> {
        val students = readiness.students(scope, filter)
        if (students.isEmpty()) return emptyList()
        val inScope = students.map { it.memberId }.toSet()
        val rows = readiness.assignments(scope).associateBy { it.id }
        val facts =
            if (rows.isEmpty()) {
                emptyList()
            } else {
                assignments
                    .recipientFacts(scope, rows.keys, batchId = filter.batchId, memberId = filter.memberId)
                    .filter { it.memberId in inScope }
            }
        val now = clock.instant()

        val evidence = mutableMapOf<UUID, MutableList<ReadinessEvidence>>()
        for (row in readiness.interviewEvidence(scope, filter)) {
            if (row.memberId !in inScope) continue
            val item = interviewItem(row) ?: continue
            evidence.getOrPut(row.memberId, ::mutableListOf) += item
        }
        for (fact in facts) {
            val assignment = rows[fact.assignmentId] ?: continue
            val item = scenarioItem(assignment, fact) ?: continue
            evidence.getOrPut(fact.memberId, ::mutableListOf) += item
        }

        val published = facts.filter { rows[it.assignmentId]?.status == STATUS_PUBLISHED }.groupBy { it.memberId }
        return students.map { student ->
            val mine = published[student.memberId].orEmpty()
            var completed = 0
            var overdue = 0
            var dueNow = 0
            var started = false
            for (fact in mine) {
                val assignment = rows.getValue(fact.assignmentId)
                val done = fact.completed(assignment.kind)
                val underway = fact.inProgress(assignment.kind)
                if (done || underway) started = true
                when (AssignmentRules.completion(done, underway, assignment.dueAt, assignment.allowLate, now)) {
                    CompletionStatus.COMPLETED -> completed++
                    CompletionStatus.OVERDUE -> overdue++
                    else -> if (!now.isBefore(assignment.dueAt)) dueNow++
                }
            }
            StudentReadinessFacts(
                student = student,
                result = ReadinessCalculator.compute(evidence[student.memberId].orEmpty(), weights),
                assigned = mine.size,
                completed = completed,
                overdue = overdue,
                dueNow = dueNow,
                started = started,
            )
        }
    }

    /** An interview attempt is evidence only when its report clears the evidence threshold. */
    private fun interviewItem(row: InterviewEvidenceRow): ReadinessEvidence? {
        val component = ReadinessComponent.fromWireValue(row.component) ?: return null
        val payload =
            try {
                objectMapper.readValue(row.scoringPayloadJson, Map::class.java)
            } catch (_: Exception) {
                return null
            }
        val percentage = ReportScore.averageCompetencyPercentage(payload) ?: return null
        return ReadinessEvidence(
            assignmentId = row.assignmentId,
            assignmentTitle = row.title,
            component = component,
            topic = row.topic,
            kind = AssignmentKind.INTERVIEW,
            sessionId = row.sessionId,
            score = ReadinessCalculator.itemScore(percentage),
            completedAt = row.completedAt,
        )
    }

    /** A scenario set is evidence once every step has an answer; its score is correct ÷ answered. */
    private fun scenarioItem(
        assignment: ReadinessAssignmentRow,
        fact: RecipientFacts,
    ): ReadinessEvidence? {
        if (assignment.kind != AssignmentKind.ARENA_SCENARIOS || !fact.completed(assignment.kind)) return null
        val component = ReadinessComponent.fromWireValue(assignment.component) ?: return null
        val score = fact.scenarioScore(assignment.kind) ?: return null
        val completedAt = fact.lastActivityAt ?: return null
        return ReadinessEvidence(
            assignmentId = assignment.id,
            assignmentTitle = assignment.title,
            component = component,
            topic = assignment.topic,
            kind = AssignmentKind.ARENA_SCENARIOS,
            sessionId = null,
            score = ReadinessCalculator.itemScore(score * 100),
            completedAt = completedAt,
        )
    }

    /**
     * Each department's latest item per student per topic. A cell's average is withheld below
     * [HEATMAP_MIN_STUDENTS] students, so it never stands for one identifiable person.
     */
    private fun heatmap(students: List<StudentReadinessFacts>): Heatmap {
        val topicsPresent = students.flatMap { s -> s.result.evidence.mapNotNull { it.topic } }.toSet()
        val columns = ReadinessCalculator.TOPIC_LABELS.keys.filter { it in topicsPresent }
        val rows =
            students
                .groupBy { it.student.departmentId }
                .values
                .map { inDepartment ->
                    val first = inDepartment.first().student
                    HeatmapRow(
                        departmentId = first.departmentId,
                        departmentCode = first.departmentCode,
                        cells =
                            columns.map { topic ->
                                // Evidence is newest first, so the first item with the topic is the latest.
                                val latest =
                                    inDepartment.mapNotNull { s ->
                                        s.result.evidence
                                            .firstOrNull { it.topic == topic }
                                            ?.score
                                    }
                                HeatmapCell(
                                    topic = topic,
                                    average = if (latest.size >= HEATMAP_MIN_STUDENTS) latest.average().roundToInt() else null,
                                    students = latest.size,
                                )
                            },
                    )
                }.sortedWith(compareBy<HeatmapRow> { it.departmentCode }.thenBy { it.departmentId })
        return Heatmap(columns, rows)
    }

    private fun sortedRows(
        scope: OrgScope,
        filter: ReadinessFilter,
        parsed: ParsedTableQuery,
    ): List<KeyedRow> {
        val weights = readiness.weights(scope)
        return compute(scope, filter, weights)
            .filter { parsed.band == null || it.result.band == parsed.band }
            .filter { parsed.completion == null || parsed.completion.matches(it) }
            .map { facts ->
                val row = tableRow(facts)
                KeyedRow(row, ReadinessTableSort.keyOf(parsed.sort, row))
            }.sortedWith { a, b -> parsed.comparator.compare(a.key, b.key) }
    }

    private fun tableRow(facts: StudentReadinessFacts): StudentReadinessRow =
        StudentReadinessRow(
            memberId = facts.student.memberId,
            name = facts.student.name,
            rollNumber = facts.student.rollNumber,
            batchName = facts.student.batchName,
            departmentCode = facts.student.departmentCode,
            overall = facts.result.overall,
            band = facts.result.band.wireValue,
            components = ComponentScores.of(facts.result.components),
            assignmentsCompleted = facts.completed,
            assignmentsOverdue = facts.overdue,
            lastActiveAt = facts.student.lastActiveAt?.toString(),
        )

    private fun studentView(
        facts: StudentReadinessFacts,
        weights: ReadinessWeightSet,
    ): StudentReadiness =
        StudentReadiness(
            memberId = facts.student.memberId,
            name = facts.student.name,
            rollNumber = facts.student.rollNumber,
            batchName = facts.student.batchName,
            departmentCode = facts.student.departmentCode,
            overall = facts.result.overall,
            band = facts.result.band.wireValue,
            components = ComponentScores.of(facts.result.components),
            weights = ReadinessWeights.of(weights),
            evidence =
                facts.result.evidence.map {
                    EvidenceItem(
                        assignmentId = it.assignmentId,
                        assignmentTitle = it.assignmentTitle,
                        component = it.component.wireValue,
                        topic = it.topic,
                        kind = it.kind.dbValue,
                        sessionId = it.sessionId,
                        score = it.score,
                        completedAt = it.completedAt.toString(),
                    )
                },
            suggestedTopics = facts.result.suggestions.map { SuggestedTopic(it.component.wireValue, it.topic, it.reason) },
        )

    // -- validation ------------------------------------------------------------------------------

    /** A batch or department of another college, or outside a faculty member's scope, is a 404. */
    private fun checkedFilter(
        scope: OrgScope,
        batchId: UUID?,
        departmentId: UUID?,
    ): ReadinessFilter {
        if (batchId != null) {
            readiness.batchDepartment(scope, batchId) ?: throw ApiException.notFound()
            if (!scope.canSeeBatch(batchId)) throw ApiException.notFound()
        }
        if (departmentId != null) {
            if (!readiness.departmentExists(scope, departmentId)) throw ApiException.notFound()
            if (!scope.canSeeDepartment(departmentId)) throw ApiException.notFound()
        }
        return ReadinessFilter(batchId = batchId, departmentId = departmentId)
    }

    private fun parseTable(query: StudentTableQuery): ParsedTableQuery {
        val band =
            query.band?.trim()?.takeIf { it.isNotEmpty() }?.let {
                ReadinessBand.fromWireValue(it)
                    ?: throw ApiException.badRequest(
                        "band must be strong, interview_ready, needs_improvement, needs_structured_prep or not_enough_evidence.",
                        code = "invalid_band",
                    )
            }
        val completion =
            query.completion?.trim()?.takeIf { it.isNotEmpty() }?.let {
                CompletionFilter.fromWireValue(it)
                    ?: throw ApiException.badRequest(
                        "completion must be all_done, has_overdue or not_started.",
                        code = "invalid_completion",
                    )
            }
        val sort =
            query.sort?.trim()?.takeIf { it.isNotEmpty() }?.let {
                ReadinessSortField.fromWireValue(it)
                    ?: throw ApiException.badRequest("sort must be name, overall, last_active or overdue.", code = "invalid_sort")
            } ?: ReadinessSortField.NAME
        val descending =
            when (query.order?.trim()?.takeIf { it.isNotEmpty() }) {
                null, "asc" -> false
                "desc" -> true
                else -> throw ApiException.badRequest("order must be asc or desc.", code = "invalid_order")
            }
        return ParsedTableQuery(band, completion, sort, descending)
    }

    companion object {
        const val TARGET_SESSION = "session"
        const val HEATMAP_MIN_STUDENTS = 3
        private const val STATUS_PUBLISHED = "published"

        /** The same window module 3's `active` uses. */
        val ACTIVE_WINDOW: Duration = Duration.ofDays(14)

        /**
         * `PUT …/readiness-weights`: exactly the five keys, each a whole number 0–100, summing to
         * 100. Anything else is `400 weights_invalid` — including 30.0, which is not an integer on
         * the wire, and an unknown key, which might be a typo for one of the five.
         */
        fun parseWeights(body: Map<String, Any?>?): ReadinessWeightSet {
            if (body == null) throw weightsInvalid("Send all five weights.")
            val unknown = body.keys - WEIGHT_KEYS
            if (unknown.isNotEmpty()) throw weightsInvalid("Unknown weight: ${unknown.sorted().joinToString()}.")
            val values =
                WEIGHT_KEYS.associateWith { key ->
                    val value = body[key] ?: throw weightsInvalid("$key is missing.")
                    val whole =
                        when (value) {
                            is Int -> value.toLong()
                            is Long -> value
                            is Short -> value.toLong()
                            is java.math.BigInteger -> value.toLong()
                            else -> throw weightsInvalid("$key must be a whole number from 0 to 100.")
                        }
                    if (whole !in 0..100) throw weightsInvalid("$key must be a whole number from 0 to 100.")
                    whole.toInt()
                }
            val weights =
                ReadinessWeightSet(
                    coding = values.getValue("coding"),
                    coreCs = values.getValue("coreCs"),
                    technicalInterview = values.getValue("technicalInterview"),
                    communication = values.getValue("communication"),
                    aptitude = values.getValue("aptitude"),
                )
            if (weights.sum != 100) throw weightsInvalid("The weights add up to ${weights.sum}; they must add up to 100.")
            return weights
        }

        private val WEIGHT_KEYS = listOf("coding", "coreCs", "technicalInterview", "communication", "aptitude")

        private fun weightsInvalid(message: String) = ApiException.badRequest(message, code = "weights_invalid")
    }
}

/** The student table's query string, as the controller received it. */
data class StudentTableQuery(
    val batchId: UUID? = null,
    val departmentId: UUID? = null,
    val band: String? = null,
    val completion: String? = null,
    val sort: String? = null,
    val order: String? = null,
)

/** Contract `completion` filter values. */
internal enum class CompletionFilter(
    val wireValue: String,
) {
    /** Has been set at least one assignment and has completed every one. */
    ALL_DONE("all_done"),

    /** Has at least one overdue assignment. */
    HAS_OVERDUE("has_overdue"),

    /** Has been set at least one assignment and has neither completed nor begun any. */
    NOT_STARTED("not_started"),
    ;

    fun matches(facts: StudentReadinessFacts): Boolean =
        when (this) {
            ALL_DONE -> facts.assigned > 0 && facts.completed == facts.assigned
            HAS_OVERDUE -> facts.overdue > 0
            NOT_STARTED -> facts.assigned > 0 && !facts.started
        }

    companion object {
        fun fromWireValue(value: String): CompletionFilter? = entries.firstOrNull { it.wireValue == value }
    }
}

internal data class ParsedTableQuery(
    val band: ReadinessBand?,
    val completion: CompletionFilter?,
    val sort: ReadinessSortField,
    val descending: Boolean,
) {
    val comparator: Comparator<ReadinessRowKey> = ReadinessTableSort.comparator(descending)
}

internal data class KeyedRow(
    val row: StudentReadinessRow,
    val key: ReadinessRowKey,
)
