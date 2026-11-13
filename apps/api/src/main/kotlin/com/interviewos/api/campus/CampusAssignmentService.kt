package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.interview.RoundLength
import com.interviewos.api.interview.RoundType
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.UUID

/**
 * Assignments (campus spec §4, contract "Module 4"): the staff routes under
 * `/campus/orgs/{org}/…` and the student's own `GET /me/assignments`.
 *
 * Staff routes follow the module 1–2 order: resolve the [OrgScope] (404 when not staff there),
 * check the permission by name (403 `campus_forbidden`), and only then look anything up or
 * validate the body. A faculty member sees only assignments touching their batches, and may
 * create them only for their batches and those batches' students; an id outside the college
 * or outside their scope is a 404. Every write is audit-logged in its transaction.
 */
@Service
class CampusAssignmentService internal constructor(
    private val access: CampusAccess,
    private val assignments: AssignmentRepository,
    private val audit: CampusAudit,
    private val features: ProductFeatureProperties,
    private val notifications: CampusNotifications,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        access: CampusAccess,
        assignments: AssignmentRepository,
        audit: CampusAudit,
        features: ProductFeatureProperties,
        notifications: CampusNotifications,
    ) : this(access, assignments, audit, features, notifications, Clock.systemUTC())

    // -- the scenario catalogue ------------------------------------------------------

    @Transactional(readOnly = true)
    fun scenarioOptions(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): List<CampusScenarioOption> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ORG_VIEW)
        return assignments.liveScenarios().map {
            CampusScenarioOption(it.id, it.courseTitle, it.title, it.tier, it.estimatedMinutes)
        }
    }

    // -- staff -----------------------------------------------------------------------

    @Transactional
    fun list(
        identity: SupabaseIdentity,
        orgId: UUID,
        status: String?,
    ): List<AssignmentView> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENT_PROGRESS_VIEW)
        val statusFilter = status?.trim()?.takeIf { it.isNotEmpty() }
        if (statusFilter != null && statusFilter !in STATUSES) {
            throw ApiException.badRequest("status must be draft, published or archived.", code = "invalid_status")
        }
        val rows = assignments.list(scope, statusFilter)
        audit.recordPlatformAdminRead(scope, "assignments.viewed", CampusOrgService.TARGET_ORG, orgId)
        return views(scope, rows)
    }

    @Transactional
    fun get(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
    ): AssignmentView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENT_PROGRESS_VIEW)
        val row = assignments.find(scope, id) ?: throw ApiException.notFound()
        audit.recordPlatformAdminRead(scope, "assignment.viewed", TARGET_ASSIGNMENT, id)
        return views(scope, listOf(row)).single()
    }

    @Transactional
    fun create(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: AssignmentRequest,
    ): AssignmentView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENTS_MANAGE)
        val fields = fieldsFrom(request, base = null)
        val targets = targetsFrom(scope, request.targets, required = true) ?: error("targets are required on create")
        val id = assignments.create(scope, fields)
        assignments.replaceTargets(scope, id, targets.first, targets.second)
        audit.record(
            scope,
            "assignment.created",
            TARGET_ASSIGNMENT,
            id,
            mapOf("kind" to fields.kind.dbValue, "batches" to targets.first.size, "students" to targets.second.size),
        )
        return views(scope, listOf(assignments.find(scope, id) ?: throw ApiException.notFound())).single()
    }

    @Transactional
    fun update(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
        request: AssignmentRequest,
    ): AssignmentView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENTS_MANAGE)
        val current = editable(scope, id)
        val changed =
            when (current.status) {
                STATUS_DRAFT -> updateDraft(scope, current, request)
                STATUS_PUBLISHED -> updatePublished(scope, current, request)
                else -> throw archived()
            }
        if (changed.isNotEmpty()) {
            audit.record(scope, "assignment.updated", TARGET_ASSIGNMENT, id, mapOf("fields" to changed))
        }
        return views(scope, listOf(assignments.find(scope, id) ?: throw ApiException.notFound())).single()
    }

    @Transactional
    fun publish(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
    ): AssignmentView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENTS_MANAGE)
        val current = editable(scope, id)
        if (current.status != STATUS_DRAFT) {
            throw ApiException.conflict("Only a draft can be published.", code = "assignment_not_draft")
        }
        if (!clock.instant().isBefore(current.dueAt)) {
            throw invalid("dueAt", "the deadline has already passed. Move it later before publishing.")
        }
        if (current.kind == AssignmentKind.ARENA_SCENARIOS) {
            val ids = current.scenarioIds.orEmpty()
            val live = assignments.liveScenarios(ids).map { it.id }.toSet()
            val withdrawn = ids.filterNot { it in live }
            if (withdrawn.isNotEmpty()) {
                throw invalid("scenarioIds", "${withdrawn.joinToString()} is no longer available. Choose another scenario.")
            }
        }
        val targets = assignments.targets(scope, listOf(id)).getValue(id)
        if (targets.batches.isEmpty() && targets.students.isEmpty()) {
            throw invalid("targets", "choose at least one batch or student before publishing.")
        }
        if (!assignments.publish(scope, id)) throw ApiException.conflict("Only a draft can be published.", code = "assignment_not_draft")
        audit.record(scope, "assignment.published", TARGET_ASSIGNMENT, id)
        // Same transaction as the publish: the students are told exactly when it is true.
        notifications.assignmentPublished(scope.orgId, id)
        return views(scope, listOf(assignments.find(scope, id) ?: throw ApiException.notFound())).single()
    }

    @Transactional
    fun archive(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
    ): AssignmentView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENTS_MANAGE)
        editable(scope, id)
        // Archiving twice is not an error: the second asks for what is already true.
        if (assignments.archive(scope, id)) audit.record(scope, "assignment.archived", TARGET_ASSIGNMENT, id)
        return views(scope, listOf(assignments.find(scope, id) ?: throw ApiException.notFound())).single()
    }

    @Transactional
    fun progress(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
        batchId: UUID?,
        status: String?,
    ): List<RecipientProgress> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENT_PROGRESS_VIEW)
        val statusFilter =
            status?.trim()?.takeIf { it.isNotEmpty() }?.let {
                CompletionStatus.fromWireValue(it)
                    ?: throw ApiException.badRequest(
                        "status must be not_started, in_progress, completed or overdue.",
                        code = "invalid_status",
                    )
            }
        val row = assignments.find(scope, id) ?: throw ApiException.notFound()
        val now = clock.instant()
        val result =
            assignments
                .recipientFacts(scope, listOf(id), batchId = batchId)
                .map { facts ->
                    val completion =
                        AssignmentRules.completion(facts.completed(row.kind), facts.inProgress(row.kind), row.dueAt, row.allowLate, now)
                    completion to
                        RecipientProgress(
                            memberId = facts.memberId,
                            name = facts.name,
                            email = facts.email,
                            rollNumber = facts.rollNumber,
                            batchName = facts.batchName,
                            status = completion.wireValue,
                            attemptsUsed = if (row.kind == AssignmentKind.INTERVIEW) facts.attemptsUsed else 0,
                            lastActivityAt = facts.lastActivityAt?.toString(),
                            sessionIds = if (row.kind == AssignmentKind.INTERVIEW) facts.sessionIds else emptyList(),
                            scenarioScore = facts.scenarioScore(row.kind),
                        )
                }.filter { (completion, _) -> statusFilter == null || completion == statusFilter }
                .map { it.second }
        audit.recordPlatformAdminRead(scope, "assignment_progress.viewed", TARGET_ASSIGNMENT, id)
        return result
    }

    // -- the student -------------------------------------------------------------------

    /**
     * The caller's published assignments, soonest due first. `[]` when the campus switch is
     * off, when the caller is not a joined student, or when their college is suspended — the
     * dashboard calls this for everyone, so it must never fail for someone with no college.
     */
    @Transactional(readOnly = true)
    fun mine(identity: SupabaseIdentity): List<AssignedItem> {
        if (!features.campus) return emptyList()
        val scope = access.resolveOwnStudentMembership(identity) ?: return emptyList()
        val memberId = scope.memberId ?: return emptyList()
        val org = assignments.activeOrg(scope) ?: return emptyList()
        val orgName = org.name
        val rows = assignments.publishedFor(scope, memberId)
        if (rows.isEmpty()) return emptyList()

        val facts = assignments.recipientFacts(scope, rows.map { it.id }, memberId = memberId).associateBy { it.assignmentId }
        val allowance = org.interviewAllowance
        val collegeUsed = if (rows.any { it.kind == AssignmentKind.INTERVIEW }) assignments.collegeUsage(scope) else 0
        val scenarioIds = rows.flatMap { it.scenarioIds.orEmpty() }.distinct()
        val scenarios = assignments.scenarios(scenarioIds).associateBy { it.id }
        val progress = assignments.scenarioProgress(identity.id, scenarioIds)
        val now = clock.instant()

        return rows.map { row ->
            val mine = facts[row.id]
            val interview = row.kind == AssignmentKind.INTERVIEW
            val completed = mine?.completed(row.kind) ?: false
            val inProgress = mine?.inProgress(row.kind) ?: false
            val blocked =
                AssignmentGate.evaluate(
                    kind = row.kind,
                    now = now,
                    opensAt = row.opensAt,
                    dueAt = row.dueAt,
                    allowLate = row.allowLate,
                    attemptsUsed = mine?.attemptsUsed ?: 0,
                    attemptLimit = row.attemptLimit,
                    orgFundedUsed = mine?.orgFundedUsed ?: 0,
                    interviewCap = row.interviewCap,
                    collegeUsed = collegeUsed,
                    collegeAllowance = allowance,
                )
            AssignedItem(
                id = row.id,
                orgName = orgName,
                title = row.title,
                instructions = row.instructions,
                kind = row.kind.dbValue,
                roundType = row.roundType,
                durationMinutes = row.durationMinutes,
                companyName = row.companyName,
                roleTitle = row.roleTitle,
                candidateStage = if (interview) row.candidateStage else null,
                language = if (interview) row.language else null,
                focusTopic = row.focusTopic,
                scenarios =
                    row.scenarioIds.orEmpty().mapNotNull { scenarioId ->
                        val scenario = scenarios[scenarioId] ?: return@mapNotNull null
                        val done = progress[scenarioId]?.let { it.total > 0 && it.answered >= it.total } ?: false
                        AssignedScenario(scenario.id, scenario.title, scenario.courseSlug, done)
                    },
                opensAt = row.opensAt.toString(),
                dueAt = row.dueAt.toString(),
                allowLate = row.allowLate,
                status = AssignmentRules.completion(completed, inProgress, row.dueAt, row.allowLate, now).wireValue,
                attemptsUsed = if (interview) mine?.attemptsUsed ?: 0 else 0,
                attemptLimit = row.attemptLimit,
                canStart = blocked == null,
                blockedReason = blocked?.wireValue,
                sessionIds = if (interview) mine?.sessionIds.orEmpty() else emptyList(),
            )
        }
    }

    // -- writing ---------------------------------------------------------------------

    /**
     * The assignment, locked for this transaction, and the caller allowed to change it: the
     * creator, a college admin or a TPO. A faculty member who did not create it gets 403 —
     * they can see it, so its existence is no secret — and one who cannot see it gets 404.
     */
    private fun editable(
        scope: OrgScope,
        id: UUID,
    ): AssignmentRow {
        val visible = assignments.find(scope, id) ?: throw ApiException.notFound()
        if (scope.role == CampusRole.FACULTY && visible.createdByMemberId != scope.memberId) throw OrgScope.forbidden()
        if (!assignments.lock(scope, id)) throw ApiException.notFound()
        return assignments.find(scope, id) ?: throw ApiException.notFound()
    }

    private fun updateDraft(
        scope: OrgScope,
        current: AssignmentRow,
        request: AssignmentRequest,
    ): List<String> {
        val fields = fieldsFrom(request, base = current)
        val changed = changedFields(current, fields).toMutableList()
        if (changed.isNotEmpty()) assignments.update(scope, current.id, fields)
        val replace = request.kind != null
        targetsFrom(scope, request.targets, required = replace)?.let { (batchIds, memberIds) ->
            val before = assignments.targets(scope, listOf(current.id)).getValue(current.id)
            val same =
                before.batches.map { it.id }.toSet() == batchIds.toSet() &&
                    before.students.map { it.id }.toSet() == memberIds.toSet()
            if (!same) {
                assignments.replaceTargets(scope, current.id, batchIds, memberIds)
                changed += "targets"
            }
        }
        return changed
    }

    /** Once published, only the deadline, late attempts and instructions may change (contract). */
    private fun updatePublished(
        scope: OrgScope,
        current: AssignmentRow,
        request: AssignmentRequest,
    ): List<String> {
        val locked =
            listOfNotNull(
                "kind".takeIf { request.kind != null },
                "title".takeIf { request.title != null },
                "roundType".takeIf { request.roundType != null },
                "durationMinutes".takeIf { request.durationMinutes != null },
                "companyName".takeIf { request.companyName != null },
                "roleTitle".takeIf { request.roleTitle != null },
                "candidateStage".takeIf { request.candidateStage != null },
                "focusTopic".takeIf { request.focusTopic != null },
                "language".takeIf { request.language != null },
                "scenarioIds".takeIf { request.scenarioIds != null },
                "opensAt".takeIf { request.opensAt != null },
                "attemptLimit".takeIf { request.attemptLimit != null },
                "interviewCap".takeIf { request.interviewCap != null },
                "targets".takeIf { request.targets != null },
                "component".takeIf { request.component != null },
                "topic".takeIf { request.topic != null },
            )
        if (locked.isNotEmpty()) {
            throw invalid(locked.first(), "only dueAt, allowLate and instructions can change once an assignment is published.")
        }
        val instructions = request.instructions?.let { optionalText(it, "instructions", AssignmentRules.MAX_INSTRUCTIONS) }
        val dueAt = request.dueAt?.let { instant(it, "dueAt") } ?: current.dueAt
        if (!dueAt.isAfter(current.opensAt)) throw invalid("dueAt", "the deadline must be after the assignment opens.")
        val fields =
            current.toFields().copy(
                instructions = if (request.instructions != null) instructions else current.instructions,
                dueAt = dueAt,
                allowLate = request.allowLate ?: current.allowLate,
            )
        val changed = changedFields(current, fields)
        if (changed.isNotEmpty()) assignments.update(scope, current.id, fields)
        return changed
    }

    /**
     * The validated columns. With no [base] (create), or when the body carries `kind` — the
     * web's edit form sends the whole input — this is the whole assignment, and an absent
     * optional field takes its default. Otherwise it is a patch over [base]: an absent or null
     * field is left unchanged, and an empty string clears an optional text field.
     */
    internal fun fieldsFrom(
        request: AssignmentRequest,
        base: AssignmentRow?,
    ): AssignmentFields {
        val whole = base == null || request.kind != null
        val kind =
            if (whole) {
                AssignmentKind.fromDbValue(request.kind?.trim())
                    ?: throw invalid("kind", "choose interview or arena_scenarios.")
            } else {
                base.kind
            }

        val title =
            (request.title ?: base?.title.takeUnless { whole })
                ?.trim()
                ?.takeIf { it.length in 1..AssignmentRules.MAX_TITLE }
                ?: throw invalid("title", "give the assignment a title of 1 to ${AssignmentRules.MAX_TITLE} characters.")
        val instructions =
            text(request.instructions, base?.instructions, whole) { optionalText(it, "instructions", AssignmentRules.MAX_INSTRUCTIONS) }

        val opensAt = request.opensAt?.let { instant(it, "opensAt") } ?: base?.opensAt ?: clock.instant()
        val dueAt =
            request.dueAt?.let { instant(it, "dueAt") }
                ?: base?.dueAt.takeUnless { whole }
                ?: throw invalid("dueAt", "set a deadline.")
        if (!dueAt.isAfter(opensAt)) throw invalid("dueAt", "the deadline must be after the assignment opens.")
        val allowLate = request.allowLate ?: base?.allowLate.takeUnless { whole } ?: false

        val component =
            request.component?.trim()?.also {
                if (it !in AssignmentRules.READINESS_COMPONENTS) {
                    throw invalid("component", "choose one of ${AssignmentRules.READINESS_COMPONENTS.joinToString()}.")
                }
            }
        val topic =
            text(request.topic, base?.topic, whole) {
                it.trim().takeIf { value -> value.isNotEmpty() }?.also { value ->
                    if (value !in AssignmentRules.TOPICS) {
                        throw invalid("topic", "choose one of ${AssignmentRules.TOPICS.joinToString()}.")
                    }
                }
            }

        return when (kind) {
            AssignmentKind.INTERVIEW -> {
                interviewFields(request, base.takeUnless { whole }, title, instructions, opensAt, dueAt, allowLate, component, topic)
            }

            AssignmentKind.ARENA_SCENARIOS -> {
                scenarioFields(request, base.takeUnless { whole }, title, instructions, opensAt, dueAt, allowLate, component, topic)
            }
        }
    }

    private fun interviewFields(
        request: AssignmentRequest,
        base: AssignmentRow?,
        title: String,
        instructions: String?,
        opensAt: Instant,
        dueAt: Instant,
        allowLate: Boolean,
        component: String?,
        topic: String?,
    ): AssignmentFields {
        val roundTypeValue = request.roundType?.trim() ?: base?.roundType
        val roundType =
            roundTypeValue
                ?.let(RoundType::parseOrNull)
                ?.takeIf { it in AssignmentRules.ASSIGNABLE_ROUND_TYPES }
                ?: throw invalid(
                    "roundType",
                    "choose one of ${AssignmentRules.ASSIGNABLE_ROUND_TYPES.joinToString { it.dbValue }}.",
                )
        val custom = roundType == RoundType.CUSTOM_TOPIC
        val duration =
            request.durationMinutes
                ?: base?.durationMinutes?.takeIf { it in RoundLength.allowedFor(roundType) }
                ?: RoundLength.defaultFor(roundType)
        if (duration !in RoundLength.allowedFor(roundType)) {
            throw invalid(
                "durationMinutes",
                if (custom) "a topic round is 30 minutes." else "choose 30, 45 or 60 minutes.",
            )
        }
        val whole = base == null
        // A topic round is not employer preparation: no company or role, as InterviewService normalises it.
        val company =
            if (custom) {
                null
            } else {
                text(request.companyName, base?.companyName, whole) {
                    optionalText(it, "companyName", AssignmentRules.MAX_COMPANY)
                }
            }
        val role =
            if (custom) {
                null
            } else {
                text(
                    request.roleTitle,
                    base?.roleTitle,
                    whole,
                ) { optionalText(it, "roleTitle", AssignmentRules.MAX_ROLE) }
            }
        val focusTopic =
            if (custom) {
                text(request.focusTopic, base?.focusTopic, whole) { optionalText(it, "focusTopic", AssignmentRules.MAX_FOCUS_TOPIC) }
                    ?: throw invalid("focusTopic", "a topic round needs a focus topic, such as \"DBMS normalisation\".")
            } else {
                null
            }
        val stage = (request.candidateStage?.trim() ?: base?.candidateStage ?: "student")
        if (stage !in AssignmentRules.CANDIDATE_STAGES) throw invalid("candidateStage", "choose student or recent_graduate.")
        val language = request.language?.trim() ?: base?.language ?: "english"
        if (language !in AssignmentRules.LANGUAGES) throw invalid("language", "choose english or hindi_english.")
        val attemptLimit = request.attemptLimit ?: base?.attemptLimit ?: 1
        if (attemptLimit !in 1..AssignmentRules.MAX_ATTEMPTS) {
            throw invalid("attemptLimit", "allow 1 to ${AssignmentRules.MAX_ATTEMPTS} attempts per student.")
        }
        val interviewCap = request.interviewCap ?: base?.interviewCap.takeUnless { whole }
        if (interviewCap != null && interviewCap !in 1..attemptLimit) {
            throw invalid("interviewCap", "the interview cap must be from 1 to the attempts per student ($attemptLimit).")
        }
        return AssignmentFields(
            kind = AssignmentKind.INTERVIEW,
            title = title,
            instructions = instructions,
            roundType = roundType.dbValue,
            durationMinutes = duration,
            companyName = company,
            roleTitle = role,
            candidateStage = stage,
            language = language,
            focusTopic = focusTopic,
            scenarioIds = null,
            opensAt = opensAt,
            dueAt = dueAt,
            allowLate = allowLate,
            attemptLimit = attemptLimit,
            interviewCap = interviewCap,
            component =
                component ?: base?.component?.takeIf { base.roundType == roundType.dbValue }
                    ?: AssignmentRules.defaultComponent(AssignmentKind.INTERVIEW, roundType),
            topic = topic,
        )
    }

    private fun scenarioFields(
        request: AssignmentRequest,
        base: AssignmentRow?,
        title: String,
        instructions: String?,
        opensAt: Instant,
        dueAt: Instant,
        allowLate: Boolean,
        component: String?,
        topic: String?,
    ): AssignmentFields {
        val ids =
            (request.scenarioIds ?: base?.scenarioIds)
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                ?.distinct()
                .orEmpty()
        if (ids.size !in 1..AssignmentRules.MAX_SCENARIOS) {
            throw invalid("scenarioIds", "choose between 1 and ${AssignmentRules.MAX_SCENARIOS} scenarios.")
        }
        if (ids.any { it.length > 160 || !SCENARIO_ID.matches(it) }) throw invalid("scenarioIds", "that is not a scenario id.")
        val live = assignments.liveScenarios(ids).associateBy { it.id }
        val missing = ids.filterNot { it in live }
        if (missing.isNotEmpty()) throw invalid("scenarioIds", "${missing.joinToString()} is not a live scenario.")
        val sameSet = base?.scenarioIds?.toSet() == ids.toSet()
        return AssignmentFields(
            kind = AssignmentKind.ARENA_SCENARIOS,
            title = title,
            instructions = instructions,
            roundType = null,
            durationMinutes = null,
            companyName = null,
            roleTitle = null,
            candidateStage = null,
            language = "english",
            focusTopic = null,
            scenarioIds = ids,
            opensAt = opensAt,
            dueAt = dueAt,
            allowLate = allowLate,
            // Interviews only (contract); a scenario set has no attempts to limit.
            attemptLimit = 1,
            interviewCap = null,
            component =
                component ?: base?.component?.takeIf { sameSet }
                    ?: AssignmentRules.defaultComponent(AssignmentKind.ARENA_SCENARIOS, null, ids.map { live.getValue(it).courseId }),
            topic = topic,
        )
    }

    /**
     * The targets in the body, checked against this college and the caller's scope; null when
     * the body has none and none are [required]. A batch or student of another college, or one
     * outside a faculty member's batches, is a 404 — as it is everywhere else in campus.
     */
    private fun targetsFrom(
        scope: OrgScope,
        targets: AssignmentTargets?,
        required: Boolean,
    ): Pair<List<UUID>, List<UUID>>? {
        if (targets == null && !required) return null
        val batchIds = targets?.batchIds.orEmpty().distinct()
        val memberIds = targets?.memberIds.orEmpty().distinct()
        if (batchIds.isEmpty() && memberIds.isEmpty()) throw invalid("targets", "choose at least one batch or student.")
        if (batchIds.size > MAX_TARGET_BATCHES) throw invalid("targets.batchIds", "choose at most $MAX_TARGET_BATCHES batches.")
        if (memberIds.size > MAX_TARGET_STUDENTS) {
            throw invalid("targets.memberIds", "choose at most $MAX_TARGET_STUDENTS students; target their batch instead.")
        }
        val batches = assignments.existingBatches(scope, batchIds)
        if (batchIds.any { it !in batches || !scope.canSeeBatch(it) }) throw ApiException.notFound()
        val students = assignments.joinedStudents(scope, memberIds)
        if (memberIds.any { id -> students[id]?.let(scope::canSeeBatch) != true }) throw ApiException.notFound()
        return batchIds to memberIds
    }

    // -- views -----------------------------------------------------------------------

    private fun views(
        scope: OrgScope,
        rows: List<AssignmentRow>,
    ): List<AssignmentView> {
        if (rows.isEmpty()) return emptyList()
        val ids = rows.map { it.id }
        val targets = assignments.targets(scope, ids)
        val facts = assignments.recipientFacts(scope, ids).groupBy { it.assignmentId }
        val now = clock.instant()
        return rows.map { row ->
            val statuses =
                facts[row.id].orEmpty().map {
                    AssignmentRules.completion(it.completed(row.kind), it.inProgress(row.kind), row.dueAt, row.allowLate, now)
                }
            val rowTargets = targets[row.id] ?: AssignmentTargetRows(emptyList(), emptyList())
            val interview = row.kind == AssignmentKind.INTERVIEW
            AssignmentView(
                id = row.id,
                kind = row.kind.dbValue,
                title = row.title,
                instructions = row.instructions,
                roundType = row.roundType,
                durationMinutes = row.durationMinutes,
                companyName = row.companyName,
                roleTitle = row.roleTitle,
                candidateStage = row.candidateStage,
                focusTopic = row.focusTopic,
                language = if (interview) row.language else null,
                scenarioIds = row.scenarioIds,
                opensAt = row.opensAt.toString(),
                dueAt = row.dueAt.toString(),
                allowLate = row.allowLate,
                attemptLimit = row.attemptLimit,
                interviewCap = row.interviewCap,
                targets = AssignmentTargets(rowTargets.batches.map { it.id }, rowTargets.students.map { it.id }),
                component = row.component,
                topic = row.topic,
                status = row.status,
                createdAt = row.createdAt.toString(),
                publishedAt = row.publishedAt?.toString(),
                createdByName = row.createdByName,
                targetBatches = rowTargets.batches,
                targetStudents = rowTargets.students,
                counts =
                    AssignmentCounts(
                        recipients = statuses.size,
                        notStarted = statuses.count { it == CompletionStatus.NOT_STARTED },
                        inProgress = statuses.count { it == CompletionStatus.IN_PROGRESS },
                        completed = statuses.count { it == CompletionStatus.COMPLETED },
                        overdue = statuses.count { it == CompletionStatus.OVERDUE },
                    ),
            )
        }
    }

    // -- helpers ---------------------------------------------------------------------

    /** An optional text field under the PATCH convention: null keeps [current] on a patch; empty clears. */
    private fun text(
        value: String?,
        current: String?,
        whole: Boolean,
        clean: (String) -> String?,
    ): String? =
        when {
            value != null -> clean(value)
            whole -> null
            else -> current
        }

    private fun optionalText(
        value: String,
        field: String,
        max: Int,
    ): String? {
        val clean = value.trim().takeIf { it.isNotEmpty() } ?: return null
        if (clean.length > max) throw invalid(field, "keep it to $max characters.")
        return clean
    }

    private fun instant(
        value: String,
        field: String,
    ): Instant =
        try {
            OffsetDateTime.parse(value.trim()).toInstant()
        } catch (e: DateTimeParseException) {
            try {
                Instant.parse(value.trim())
            } catch (e2: DateTimeParseException) {
                throw invalid(field, "use an ISO-8601 date and time, such as 2026-12-01T18:30:00Z.")
            }
        }

    private fun changedFields(
        current: AssignmentRow,
        next: AssignmentFields,
    ): List<String> {
        val before = current.toFields()
        return listOfNotNull(
            "kind".takeIf { before.kind != next.kind },
            "title".takeIf { before.title != next.title },
            "instructions".takeIf { before.instructions != next.instructions },
            "roundType".takeIf { before.roundType != next.roundType },
            "durationMinutes".takeIf { before.durationMinutes != next.durationMinutes },
            "companyName".takeIf { before.companyName != next.companyName },
            "roleTitle".takeIf { before.roleTitle != next.roleTitle },
            "candidateStage".takeIf { before.candidateStage != next.candidateStage },
            "language".takeIf { before.language != next.language },
            "focusTopic".takeIf { before.focusTopic != next.focusTopic },
            "scenarioIds".takeIf { before.scenarioIds != next.scenarioIds },
            "opensAt".takeIf { before.opensAt != next.opensAt },
            "dueAt".takeIf { before.dueAt != next.dueAt },
            "allowLate".takeIf { before.allowLate != next.allowLate },
            "attemptLimit".takeIf { before.attemptLimit != next.attemptLimit },
            "interviewCap".takeIf { before.interviewCap != next.interviewCap },
            "component".takeIf { before.component != next.component },
            "topic".takeIf { before.topic != next.topic },
        )
    }

    private fun AssignmentRow.toFields() =
        AssignmentFields(
            kind = kind,
            title = title,
            instructions = instructions,
            roundType = roundType,
            durationMinutes = durationMinutes,
            companyName = companyName,
            roleTitle = roleTitle,
            candidateStage = candidateStage,
            language = language,
            focusTopic = focusTopic,
            scenarioIds = scenarioIds,
            opensAt = opensAt,
            dueAt = dueAt,
            allowLate = allowLate,
            attemptLimit = attemptLimit,
            interviewCap = interviewCap,
            component = component,
            topic = topic,
        )

    private fun archived() = ApiException.conflict("An archived assignment cannot be changed.", code = "assignment_archived")

    companion object {
        const val TARGET_ASSIGNMENT = "assignment"
        const val STATUS_DRAFT = "draft"
        const val STATUS_PUBLISHED = "published"
        private val STATUSES = setOf("draft", "published", "archived")
        const val MAX_TARGET_BATCHES = 100
        const val MAX_TARGET_STUDENTS = 1000
        private val SCENARIO_ID = Regex("^[a-z0-9-]+:[a-z0-9-]+$")

        fun invalid(
            field: String,
            message: String,
        ) = ApiException(HttpStatus.BAD_REQUEST, "assignment_invalid", "$field: $message")
    }
}
