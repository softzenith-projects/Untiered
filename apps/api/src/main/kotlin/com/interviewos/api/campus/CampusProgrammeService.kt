package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.UUID

/**
 * Programmes (campus spec §10, contract "Module 10"): reusable templates of weekly modules that
 * the platform defines, and each college's dated run of one.
 *
 * Starting a programme creates and publishes one ordinary module 4 assignment per module,
 * through [CampusAssignmentService.createPublishedForProgramme] — the same validation, targets
 * check, audit entries and new-assignment emails as a college's own assignment — all inside one
 * transaction, so a programme is cloned whole or not at all. Week n opens at 09:00 IST on
 * `startsOn + 7(n − 1)` days ([ProgrammeSchedule]); the existing admission gate does the weekly
 * unlock for interviews.
 *
 * Completion is module 4's derived completion: a module is done when its assignment is, and the
 * certificate is earned when every module is. Nothing about it is stored.
 */
@Service
class CampusProgrammeService internal constructor(
    private val access: CampusAccess,
    private val programmes: ProgrammeRepository,
    private val assignments: AssignmentRepository,
    private val assignmentService: CampusAssignmentService,
    private val audit: CampusAudit,
    private val features: ProductFeatureProperties,
    private val logos: OrgLogos,
    private val objectMapper: ObjectMapper,
    transactionManager: PlatformTransactionManager,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        access: CampusAccess,
        programmes: ProgrammeRepository,
        assignments: AssignmentRepository,
        assignmentService: CampusAssignmentService,
        audit: CampusAudit,
        features: ProductFeatureProperties,
        logos: OrgLogos,
        objectMapper: ObjectMapper,
        transactionManager: PlatformTransactionManager,
    ) : this(
        access,
        programmes,
        assignments,
        assignmentService,
        audit,
        features,
        logos,
        objectMapper,
        transactionManager,
        Clock.systemUTC(),
    )

    private val transactions = TransactionTemplate(transactionManager)

    // -- templates: platform admin -------------------------------------------------------

    @Transactional(readOnly = true)
    fun adminTemplates(identity: SupabaseIdentity): List<ProgrammeTemplateView> {
        access.requirePlatformAdmin(identity)
        return programmes.templates().map { templateView(it) }
    }

    @Transactional
    fun createTemplate(
        identity: SupabaseIdentity,
        request: ProgrammeTemplateRequest?,
    ): ProgrammeTemplateView {
        val admin = access.requirePlatformAdmin(identity)
        val template = validTemplate(request, base = null)
        val id = programmes.insertTemplate(admin, template.title, template.description, template.weeks, modulesJson(template.modules))
        return templateView(programmes.template(id) ?: throw ApiException.notFound())
    }

    @Transactional
    fun updateTemplate(
        identity: SupabaseIdentity,
        id: UUID,
        request: ProgrammeTemplateRequest?,
    ): ProgrammeTemplateView {
        val admin = access.requirePlatformAdmin(identity)
        val current = programmes.template(id) ?: throw ApiException.notFound()
        val template = validTemplate(request, base = templateView(current))
        programmes.updateTemplate(admin, id, template.title, template.description, template.weeks, modulesJson(template.modules))
        return templateView(programmes.template(id) ?: throw ApiException.notFound())
    }

    /** Programmes already started from it keep running; their template id becomes null. */
    @Transactional
    fun deleteTemplate(
        identity: SupabaseIdentity,
        id: UUID,
    ) {
        val admin = access.requirePlatformAdmin(identity)
        if (!programmes.deleteTemplate(admin, id)) throw ApiException.notFound()
    }

    // -- the college ------------------------------------------------------------------------

    @Transactional(readOnly = true)
    fun templates(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): List<ProgrammeTemplateView> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ORG_VIEW)
        return programmes.templates().map { templateView(it) }
    }

    /** Clones a template into published, dated assignments for [StartProgrammeRequest.batchIds], in one transaction. */
    fun start(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: StartProgrammeRequest?,
    ): ProgrammeView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.PROGRAMMES_MANAGE)
        val templateId = request?.templateId ?: throw programmeInvalid("templateId", "choose a programme template.")
        val template = programmes.template(templateId) ?: throw ApiException.notFound()
        val title =
            (request.title?.trim()?.takeIf { it.isNotEmpty() } ?: template.title).also {
                if (it.length >
                    AssignmentRules.MAX_TITLE
                ) {
                    throw programmeInvalid("title", "keep it to ${AssignmentRules.MAX_TITLE} characters.")
                }
            }
        val startsOn = startDate(request.startsOn)
        val batchIds = request.batchIds.orEmpty().distinct()
        if (batchIds.isEmpty()) throw programmeInvalid("batchIds", "choose at least one batch.")
        if (batchIds.size > CampusAssignmentService.MAX_TARGET_BATCHES) {
            throw programmeInvalid("batchIds", "choose at most ${CampusAssignmentService.MAX_TARGET_BATCHES} batches.")
        }
        val existing = assignments.existingBatches(scope, batchIds)
        if (batchIds.any { it !in existing || !scope.canSeeBatch(it) }) throw ApiException.notFound()
        val modules = parseModules(template.modulesJson)
        if (modules.isEmpty()) throw programmeInvalid("templateId", "this template has no modules yet.")

        val programmeId =
            transactions.execute {
                val id = programmes.insertProgramme(scope, template.id, title, startsOn, template.weeks)
                programmes.insertTargets(scope, id, batchIds)
                for (module in modules) {
                    val week = module.week ?: error("a stored module has a week")
                    val request = assignmentRequest(module, startsOn, batchIds)
                    try {
                        assignmentService.createPublishedForProgramme(scope, request, id, week)
                    } catch (e: ApiException) {
                        if (e.code != "assignment_invalid") throw e
                        throw ApiException(e.status, e.code, "Week $week: ${e.message}")
                    }
                }
                audit.record(
                    scope,
                    "programme.created",
                    TARGET_PROGRAMME,
                    id,
                    mapOf(
                        "templateId" to template.id.toString(),
                        "startsOn" to startsOn.toString(),
                        "batches" to batchIds.size,
                        "modules" to modules.size,
                    ),
                )
                id
            } ?: error("the programme transaction returned nothing")
        return views(scope, listOfNotNull(programmes.find(scope, programmeId))).single()
    }

    @Transactional
    fun list(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): List<ProgrammeView> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENT_PROGRESS_VIEW)
        audit.recordPlatformAdminRead(scope, "programmes.viewed", CampusOrgService.TARGET_ORG, orgId)
        return views(scope, programmes.list(scope))
    }

    @Transactional
    fun get(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
    ): ProgrammeView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENT_PROGRESS_VIEW)
        val row = programmes.find(scope, id) ?: throw ApiException.notFound()
        audit.recordPlatformAdminRead(scope, "programme.viewed", TARGET_PROGRAMME, id)
        return views(scope, listOf(row)).single()
    }

    @Transactional
    fun progress(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
    ): List<ProgrammeProgress> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ASSIGNMENT_PROGRESS_VIEW)
        programmes.find(scope, id) ?: throw ApiException.notFound()
        val modules = programmes.assignments(scope, listOf(id))[id].orEmpty()
        val kinds = modules.associate { it.id to it.kind }
        val facts = if (modules.isEmpty()) emptyList() else assignments.recipientFacts(scope, kinds.keys)
        audit.recordPlatformAdminRead(scope, "programme_progress.viewed", TARGET_PROGRAMME, id)
        return facts
            .groupBy { it.memberId }
            .map { (memberId, mine) ->
                val completed = mine.count { fact -> kinds[fact.assignmentId]?.let(fact::completed) == true }
                ProgrammeProgress(
                    memberId = memberId,
                    name = mine.first().name,
                    completedModules = completed,
                    totalModules = modules.size,
                    certificateIssued = modules.isNotEmpty() && completed == modules.size,
                )
            }.sortedWith(compareBy<ProgrammeProgress, String?>(nullsLast()) { it.name?.lowercase() }.thenBy { it.memberId })
    }

    /** Archives the programme and its assignments that have not opened yet. Asking twice is not an error. */
    @Transactional
    fun archive(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
    ): ProgrammeView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.PROGRAMMES_MANAGE)
        programmes.find(scope, id) ?: throw ApiException.notFound()
        if (!programmes.lock(scope, id)) throw ApiException.notFound()
        if (programmes.archive(scope, id)) {
            val archived = assignments.archiveUnopenedOfProgramme(scope, id, clock.instant())
            audit.record(scope, "programme.archived", TARGET_PROGRAMME, id, mapOf("assignmentsArchived" to archived.size))
            for (assignmentId in archived) {
                audit.record(scope, "assignment.archived", CampusAssignmentService.TARGET_ASSIGNMENT, assignmentId)
            }
        }
        return views(scope, listOfNotNull(programmes.find(scope, id))).single()
    }

    // -- the student ------------------------------------------------------------------------

    /**
     * The caller's programmes with their own progress: the active ones, and archived ones whose
     * certificate they earned. `[]` when the campus switch is off or the caller is not a joined
     * student, as `GET /me/assignments` is, so the dashboard can call it for everyone.
     */
    @Transactional(readOnly = true)
    fun mine(identity: SupabaseIdentity): List<MyProgrammeView> {
        if (!features.campus) return emptyList()
        val scope = access.resolveOwnStudentMembership(identity) ?: return emptyList()
        val memberId = scope.memberId ?: return emptyList()
        assignments.activeOrg(scope) ?: return emptyList()
        return studentProgress(scope, memberId)
            .filter { it.row.status == STATUS_ACTIVE || it.earned }
            .map { it.view(memberId) }
    }

    /** 404 until every module is completed, exactly as for a programme that does not exist. */
    @Transactional(readOnly = true)
    fun certificate(
        identity: SupabaseIdentity,
        programmeId: UUID,
    ): CertificateView {
        if (!features.campus) throw ApiException.notFound()
        val scope = access.resolveOwnStudentMembership(identity) ?: throw ApiException.notFound()
        val memberId = scope.memberId ?: throw ApiException.notFound()
        assignments.activeOrg(scope) ?: throw ApiException.notFound()
        val progress = studentProgress(scope, memberId, programmeId).singleOrNull() ?: throw ApiException.notFound()
        if (!progress.earned) throw ApiException.notFound()
        val head = programmes.certificateHead(scope, memberId) ?: throw ApiException.notFound()
        val ids = progress.modules.map { it.id }
        val times = programmes.completionTimes(scope, memberId, identity.id, ids)
        if (ids.any { it !in times }) throw ApiException.notFound()
        return CertificateView(
            programmeTitle = progress.row.title,
            studentName = head.studentName?.takeIf { it.isNotBlank() } ?: head.email.substringBefore('@'),
            orgName = head.orgName,
            orgLogoUrl = logos.publicUrl(head.logoPath),
            completedAt = times.values.max().toString(),
            certificateId = ProgrammeSchedule.certificateId(progress.row.id, memberId),
        )
    }

    private class StudentProgramme(
        val row: ProgrammeRow,
        val modules: List<ProgrammeAssignmentRow>,
        val completed: Int,
        val batch: TargetBatchView?,
    ) {
        val earned: Boolean get() = modules.isNotEmpty() && completed == modules.size

        fun view(memberId: UUID) =
            MyProgrammeView(
                id = row.id,
                templateId = row.templateId,
                title = row.title,
                startsOn = row.startsOn.toString(),
                weeks = row.weeks,
                targetBatches = listOfNotNull(batch),
                assignmentIds = modules.map { it.id },
                status = row.status,
                completedModules = completed,
                totalModules = modules.size,
                certificateId = if (earned) ProgrammeSchedule.certificateId(row.id, memberId) else null,
            )
    }

    private fun studentProgress(
        scope: OrgScope,
        memberId: UUID,
        only: UUID? = null,
    ): List<StudentProgramme> {
        val rows = programmes.forStudent(scope, memberId).filter { only == null || it.id == only }
        if (rows.isEmpty()) return emptyList()
        val modules = programmes.assignments(scope, rows.map { it.id })
        val kinds = modules.values.flatten().associate { it.id to it.kind }
        val facts = if (kinds.isEmpty()) emptyList() else assignments.recipientFacts(scope, kinds.keys, memberId = memberId)
        val done = facts.filter { fact -> kinds[fact.assignmentId]?.let(fact::completed) == true }.map { it.assignmentId }.toSet()
        val batchId = facts.firstOrNull()?.batchId
        val targets = programmes.targets(scope, rows.map { it.id })
        return rows.map { row ->
            val mine = modules[row.id].orEmpty()
            StudentProgramme(
                row = row,
                modules = mine,
                completed = mine.count { it.id in done },
                batch = targets[row.id].orEmpty().firstOrNull { it.id == batchId },
            )
        }
    }

    // -- views ---------------------------------------------------------------------------------

    private fun views(
        scope: OrgScope,
        rows: List<ProgrammeRow>,
    ): List<ProgrammeView> {
        if (rows.isEmpty()) return emptyList()
        val ids = rows.map { it.id }
        val targets = programmes.targets(scope, ids)
        val modules = programmes.assignments(scope, ids)
        return rows.map { row ->
            ProgrammeView(
                id = row.id,
                templateId = row.templateId,
                title = row.title,
                startsOn = row.startsOn.toString(),
                weeks = row.weeks,
                targetBatches = targets[row.id].orEmpty(),
                assignmentIds = modules[row.id].orEmpty().map { it.id },
                status = row.status,
            )
        }
    }

    private fun templateView(row: ProgrammeTemplateRow) =
        ProgrammeTemplateView(
            id = row.id,
            title = row.title,
            description = row.description,
            weeks = row.weeks,
            modules = parseModules(row.modulesJson),
            createdAt = row.createdAt.toString(),
        )

    // -- validation ------------------------------------------------------------------------------

    private data class ValidTemplate(
        val title: String,
        val description: String,
        val weeks: Int,
        val modules: List<ProgrammeModule>,
    )

    /**
     * A whole template on create; a patch over [base] on update (an absent field is unchanged).
     * Each module goes through the same validation as an assignment, with placeholder dates and
     * no targets, and is stored in its normalised form.
     */
    private fun validTemplate(
        request: ProgrammeTemplateRequest?,
        base: ProgrammeTemplateView?,
    ): ValidTemplate {
        val title =
            (request?.title ?: base?.title)?.trim()?.takeIf { it.length in 1..AssignmentRules.MAX_TITLE }
                ?: throw templateInvalid("title: give the programme a title of 1 to ${AssignmentRules.MAX_TITLE} characters.")
        val description = (request?.description ?: base?.description ?: "").trim()
        if (description.length > MAX_DESCRIPTION) throw templateInvalid("description: keep it to $MAX_DESCRIPTION characters.")
        val weeks = request?.weeks ?: base?.weeks ?: throw templateInvalid("weeks: choose 1 to ${ProgrammeSchedule.MAX_WEEKS} weeks.")
        if (weeks !in 1..ProgrammeSchedule.MAX_WEEKS) throw templateInvalid("weeks: choose 1 to ${ProgrammeSchedule.MAX_WEEKS} weeks.")
        val modules = request?.modules ?: base?.modules ?: emptyList()
        if (modules.isEmpty()) throw templateInvalid("modules: add at least one module.")
        if (modules.size > weeks * MAX_MODULES_PER_WEEK) {
            throw templateInvalid("modules: at most $MAX_MODULES_PER_WEEK modules a week.")
        }
        val normalised =
            modules.mapIndexed { index, module ->
                val week = module.week
                if (week == null || week !in 1..weeks) throw templateInvalid("modules[$index].week: choose a week from 1 to $weeks.")
                val spec = module.assignment ?: throw templateInvalid("modules[$index].assignment: describe the assignment.")
                val fields =
                    try {
                        assignmentService.fieldsFrom(
                            spec.toRequest(PLACEHOLDER_OPENS.toString(), PLACEHOLDER_OPENS.plus(ProgrammeSchedule.WEEK).toString(), null),
                            base = null,
                        )
                    } catch (e: ApiException) {
                        if (e.code != "assignment_invalid") throw e
                        throw templateInvalid("Week $week, module ${index + 1}: ${e.message}")
                    }
                ProgrammeModule(week, fields.toSpec())
            }
        if (normalised
                .groupingBy { it.week }
                .eachCount()
                .values
                .any { it > MAX_MODULES_PER_WEEK }
        ) {
            throw templateInvalid("modules: at most $MAX_MODULES_PER_WEEK modules a week.")
        }
        return ValidTemplate(title, description, weeks, normalised.sortedBy { it.week })
    }

    private fun startDate(value: String?): LocalDate {
        val raw = value?.trim()?.takeIf { it.isNotEmpty() } ?: throw programmeInvalid("startsOn", "choose a start date.")
        val date =
            try {
                LocalDate.parse(raw)
            } catch (e: DateTimeParseException) {
                throw programmeInvalid("startsOn", "use a date such as 2026-12-01.")
            }
        val today = ProgrammeSchedule.today(clock.instant())
        if (date.isBefore(today)) throw programmeInvalid("startsOn", "a programme cannot start in the past.")
        if (date.isAfter(today.plusDays(ProgrammeSchedule.MAX_DAYS_AHEAD))) {
            throw programmeInvalid("startsOn", "start within the next year.")
        }
        return date
    }

    private fun assignmentRequest(
        module: ProgrammeModule,
        startsOn: LocalDate,
        batchIds: List<UUID>,
    ): AssignmentRequest {
        val week = module.week ?: error("a stored module has a week")
        val spec = module.assignment ?: error("a stored module has an assignment")
        return spec.toRequest(
            ProgrammeSchedule.opensAt(startsOn, week).toString(),
            ProgrammeSchedule.dueAt(startsOn, week).toString(),
            AssignmentTargets(batchIds = batchIds, memberIds = emptyList()),
        )
    }

    private fun ProgrammeAssignmentSpec.toRequest(
        opensAt: String,
        dueAt: String,
        targets: AssignmentTargets?,
    ) = AssignmentRequest(
        kind = kind,
        title = title,
        instructions = instructions,
        roundType = roundType,
        durationMinutes = durationMinutes,
        companyName = companyName,
        roleTitle = roleTitle,
        candidateStage = candidateStage,
        focusTopic = focusTopic,
        language = language,
        scenarioIds = scenarioIds,
        opensAt = opensAt,
        dueAt = dueAt,
        allowLate = allowLate,
        attemptLimit = attemptLimit,
        interviewCap = interviewCap,
        targets = targets,
        component = component,
        topic = topic,
    )

    private fun AssignmentFields.toSpec(): ProgrammeAssignmentSpec {
        val interview = kind == AssignmentKind.INTERVIEW
        return ProgrammeAssignmentSpec(
            kind = kind.dbValue,
            title = title,
            instructions = instructions,
            roundType = roundType,
            durationMinutes = durationMinutes,
            companyName = companyName,
            roleTitle = roleTitle,
            candidateStage = candidateStage,
            focusTopic = focusTopic,
            language = if (interview) language else null,
            scenarioIds = scenarioIds,
            allowLate = allowLate,
            attemptLimit = attemptLimit,
            interviewCap = interviewCap,
            component = component,
            topic = topic,
        )
    }

    // -- the stored module list -------------------------------------------------------------------

    private fun modulesJson(modules: List<ProgrammeModule>): String = objectMapper.writeValueAsString(modules)

    /** Read by hand from plain maps, so it does not depend on how the mapper handles Kotlin classes. */
    private fun parseModules(json: String): List<ProgrammeModule> {
        val raw = objectMapper.readValue(json, List::class.java)
        return raw.filterIsInstance<Map<*, *>>().map { module ->
            val spec = module["assignment"] as? Map<*, *>
            ProgrammeModule(
                week = (module["week"] as? Number)?.toInt(),
                assignment =
                    spec?.let {
                        ProgrammeAssignmentSpec(
                            kind = it["kind"] as? String,
                            title = it["title"] as? String,
                            instructions = it["instructions"] as? String,
                            roundType = it["roundType"] as? String,
                            durationMinutes = (it["durationMinutes"] as? Number)?.toInt(),
                            companyName = it["companyName"] as? String,
                            roleTitle = it["roleTitle"] as? String,
                            candidateStage = it["candidateStage"] as? String,
                            focusTopic = it["focusTopic"] as? String,
                            language = it["language"] as? String,
                            scenarioIds = (it["scenarioIds"] as? List<*>)?.map { id -> id.toString() },
                            allowLate = it["allowLate"] as? Boolean,
                            attemptLimit = (it["attemptLimit"] as? Number)?.toInt(),
                            interviewCap = (it["interviewCap"] as? Number)?.toInt(),
                            component = it["component"] as? String,
                            topic = it["topic"] as? String,
                        )
                    },
            )
        }
    }

    companion object {
        const val TARGET_PROGRAMME = "programme"
        const val STATUS_ACTIVE = "active"
        const val MAX_DESCRIPTION = 2000
        const val MAX_MODULES_PER_WEEK = 3

        /** A date far enough ahead that a template's module validates without real dates. */
        private val PLACEHOLDER_OPENS: Instant = Instant.parse("2100-01-04T03:30:00Z")

        fun programmeInvalid(
            field: String,
            message: String,
        ) = ApiException(HttpStatus.BAD_REQUEST, "programme_invalid", "$field: $message")

        fun templateInvalid(message: String) = ApiException(HttpStatus.BAD_REQUEST, "programme_template_invalid", message)
    }
}
