package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.UUID

/**
 * College packages and payments (contract "Module 14"). A platform admin records what a
 * college bought — N interviews for a term, an optional per-student limit, the invoiced
 * price — then marks it invoiced and paid by hand: colleges pay by bank transfer or cheque.
 *
 * Every write takes the organisation row lock first, the same lock assigned-interview
 * admission takes, so a package cannot be shrunk underneath a start that is reading it. Every
 * write goes on the college's audit log as `platform_admin`, with field names only, never an
 * amount.
 *
 * College staff read the packages through [collegeView]: a college admin sees what was bought
 * and billed; a TPO or faculty member sees only the interviews remaining, the per-student
 * limit and the end date.
 */
@Service
class CollegePackageService internal constructor(
    private val access: CampusAccess,
    private val packages: CollegePackageRepository,
    private val orgs: OrganisationRepository,
    private val audit: CampusAudit,
    private val billing: CollegeBillingProperties,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        access: CampusAccess,
        packages: CollegePackageRepository,
        orgs: OrganisationRepository,
        audit: CampusAudit,
        billing: CollegeBillingProperties,
    ) : this(access, packages, orgs, audit, billing, Clock.systemUTC())

    private fun today(): LocalDate = CollegePackages.today(clock.instant())

    // -- platform admin -------------------------------------------------------------------

    @Transactional
    fun adminList(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): List<AdminPackageView> {
        val scope = adminScope(identity, orgId)
        audit.record(scope, "packages.viewed", CampusOrgService.TARGET_ORG, orgId)
        val today = today()
        return packages.list(scope).map { it.toAdminView(today) }
    }

    @Transactional
    fun create(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: PackageRequest,
    ): AdminPackageView {
        val scope = adminScope(identity, orgId)
        val fields = PackageValidation.create(request)
        orgs.lock(scope)
        val id = packages.insert(scope, fields)
        audit.record(scope, "package.created", TARGET_PACKAGE, id)
        return view(scope, id)
    }

    @Transactional
    fun update(
        identity: SupabaseIdentity,
        orgId: UUID,
        packageId: UUID,
        request: PackageRequest,
    ): AdminPackageView {
        val scope = adminScope(identity, orgId)
        orgs.lock(scope)
        val row = packages.find(scope, packageId) ?: throw ApiException.notFound()
        if (row.status == PackageStatus.VOID) throw voided()
        val (fields, changed) = PackageValidation.patch(row, request)
        if (fields.interviews < row.used) {
            throw ApiException.conflict(
                "${row.used} interviews have already been started from this package, so it cannot hold fewer.",
                code = "package_below_used",
            )
        }
        if (row.status.issued && fields.invoiceNumber == null) {
            throw ApiException.badRequest("An invoiced package keeps its invoice number.", code = "invalid_invoice_number")
        }
        if (changed.isNotEmpty()) {
            packages.update(scope, packageId, fields)
            audit.record(scope, "package.updated", TARGET_PACKAGE, packageId, mapOf("fields" to changed))
        }
        return view(scope, packageId)
    }

    /** A draft becomes invoiced: from here it funds interviews (by default) and gets reminders. */
    @Transactional
    fun invoice(
        identity: SupabaseIdentity,
        orgId: UUID,
        packageId: UUID,
        request: InvoicePackageRequest,
    ): AdminPackageView {
        val scope = adminScope(identity, orgId)
        orgs.lock(scope)
        val row = packages.find(scope, packageId) ?: throw ApiException.notFound()
        if (row.status != PackageStatus.DRAFT) {
            throw ApiException.conflict("Only a draft package can be marked invoiced.", code = "package_status_conflict")
        }
        val number = PackageValidation.invoiceNumber(request.invoiceNumber) ?: row.invoiceNumber ?: throw missingInvoiceNumber()
        val on = PackageValidation.date(request.invoicedOn, "invoicedOn") ?: today()
        packages.markInvoiced(scope, packageId, number, on)
        audit.record(scope, "package.invoiced", TARGET_PACKAGE, packageId)
        return view(scope, packageId)
    }

    /** A draft or invoiced package is paid. */
    @Transactional
    fun markPaid(
        identity: SupabaseIdentity,
        orgId: UUID,
        packageId: UUID,
        request: PayPackageRequest,
    ): AdminPackageView {
        val scope = adminScope(identity, orgId)
        orgs.lock(scope)
        val row = packages.find(scope, packageId) ?: throw ApiException.notFound()
        if (row.status != PackageStatus.DRAFT && row.status != PackageStatus.INVOICED) {
            throw ApiException.conflict("Only a draft or invoiced package can be marked paid.", code = "package_status_conflict")
        }
        val number = row.invoiceNumber ?: throw missingInvoiceNumber()
        val on = PackageValidation.date(request.paidOn, "paidOn") ?: today()
        val reference = CampusValidation.optionalText(request.paymentReference, "paymentReference", 120)
        packages.markPaid(scope, packageId, number, on, reference)
        audit.record(scope, "package.paid", TARGET_PACKAGE, packageId)
        return view(scope, packageId)
    }

    /**
     * Cancels a package that should never have been issued. Refused once an interview has been
     * charged to it: those interviews happened, and voiding would quietly hand the college a
     * second pool. Correct the package with an edit instead.
     */
    @Transactional
    fun void(
        identity: SupabaseIdentity,
        orgId: UUID,
        packageId: UUID,
    ): AdminPackageView {
        val scope = adminScope(identity, orgId)
        orgs.lock(scope)
        val row = packages.find(scope, packageId) ?: throw ApiException.notFound()
        if (row.status == PackageStatus.VOID) throw voided()
        if (row.used > 0) {
            throw ApiException.conflict(
                "Interviews have already been started from this package. Edit it instead of voiding it.",
                code = "package_in_use",
            )
        }
        packages.markVoid(scope, packageId)
        audit.record(scope, "package.voided", TARGET_PACKAGE, packageId)
        return view(scope, packageId)
    }

    /** Only a draft can be deleted: an issued package is a record of what the college was billed. */
    @Transactional
    fun delete(
        identity: SupabaseIdentity,
        orgId: UUID,
        packageId: UUID,
    ) {
        val scope = adminScope(identity, orgId)
        orgs.lock(scope)
        val row = packages.find(scope, packageId) ?: throw ApiException.notFound()
        if (row.status != PackageStatus.DRAFT || packages.deleteDraft(scope, packageId) == 0) {
            throw ApiException.conflict("Only a draft package can be deleted. Void an issued one instead.", code = "package_not_draft")
        }
        audit.record(scope, "package.deleted", TARGET_PACKAGE, packageId)
    }

    /**
     * Every college on one page (`/admin/campus/billing`). Not written to each college's audit
     * log, as the college index is not: it is the operator's own overview.
     */
    @Transactional(readOnly = true)
    fun billing(identity: SupabaseIdentity): List<CollegeBillingRow> {
        val admin = access.requirePlatformAdmin(identity)
        val today = today()
        val byOrg = packages.allPackages(admin).groupBy { it.orgId }
        return packages.allOrgs(admin).map { org ->
            val rows = byOrg[org.id].orEmpty()
            val usages = rows.map { it.usage() }
            val current = CollegePackages.current(usages, today, billing.funding)
            val aiCost =
                current?.let {
                    val from = it.startsOn.atStartOfDay(CollegePackages.INDIA).toInstant()
                    val to =
                        it.lastUsableOn
                            .plusDays(1)
                            .atStartOfDay(CollegePackages.INDIA)
                            .toInstant()
                    packages.aiCostMicroUsd(admin, org.id, from, to) / MICRO
                }
            val nextReminder =
                rows
                    .mapNotNull { row ->
                        CollegePackages.nextReminderOn(
                            row.usage(),
                            today,
                            row.remindersSent,
                            CollegePackages.superseded(row.usage(), usages),
                        )
                    }.minOrNull()
            CollegeBillingRow(
                orgId = org.id,
                orgName = org.name,
                orgStatus = org.status,
                fundedByPackages = usages.any { it.status.issued },
                current =
                    current?.let { pkg ->
                        BillingPackageSummary(
                            id = pkg.id,
                            status = pkg.status.wireValue,
                            interviews = pkg.interviews,
                            interviewsUsed = pkg.used,
                            interviewsRemaining = pkg.remaining,
                            perStudentLimit = pkg.perStudentLimit,
                            startsOn = pkg.startsOn.toString(),
                            endsOn = pkg.endsOn.toString(),
                            lastUsableOn = pkg.lastUsableOn.toString(),
                            daysLeft = CollegePackages.daysLeft(pkg, today),
                        )
                    },
                outstandingInvoices = rows.count { it.status == PackageStatus.INVOICED },
                outstandingPaise = rows.filter { it.status == PackageStatus.INVOICED }.sumOf { it.amountPaise },
                totalPaidPaise = rows.filter { it.status == PackageStatus.PAID }.sumOf { it.amountPaise },
                aiCostUsd = aiCost,
                nextReminderOn = nextReminder?.toString(),
            )
        }
    }

    // -- the college --------------------------------------------------------------------

    /** Any staff role or a platform admin; money only for a college admin or a platform admin. */
    @Transactional
    fun collegeView(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): CollegePackagesView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.PACKAGES_VIEW)
        audit.recordPlatformAdminRead(scope, "packages.viewed", CampusOrgService.TARGET_ORG, orgId)
        val rows = packages.list(scope)
        val today = today()
        val usages = rows.map { it.usage() }
        val current = CollegePackages.current(usages, today, billing.funding)
        return CollegePackagesView(
            fundedByPackages = usages.any { it.status.issued },
            current = current?.let { PackageBalanceView(it.remaining, it.perStudentLimit, it.endsOn.toString()) },
            packages =
                if (scope.has(CampusPermission.PACKAGE_PAYMENTS_VIEW)) {
                    rows.filter { it.status != PackageStatus.DRAFT }.map { it.toCollegeView() }
                } else {
                    null
                },
        )
    }

    // -- private --------------------------------------------------------------------------

    private fun adminScope(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): OrgScope {
        val scope = access.resolveAsPlatformAdmin(identity, orgId)
        scope.require(CampusPermission.ORGS_ADMINISTER)
        return scope
    }

    private fun view(
        scope: OrgScope,
        id: UUID,
    ): AdminPackageView = (packages.find(scope, id) ?: throw ApiException.notFound()).toAdminView(today())

    private fun PackageRow.toAdminView(today: LocalDate): AdminPackageView {
        val usage = usage()
        return AdminPackageView(
            id = id,
            orgId = orgId,
            interviews = interviews,
            interviewsUsed = used,
            interviewsRemaining = usage.remaining,
            perStudentLimit = perStudentLimit,
            startsOn = startsOn.toString(),
            endsOn = endsOn.toString(),
            graceDays = graceDays,
            lastUsableOn = usage.lastUsableOn.toString(),
            amountPaise = amountPaise,
            invoiceNumber = invoiceNumber,
            status = status.wireValue,
            invoicedOn = invoicedOn?.toString(),
            paidOn = paidOn?.toString(),
            paymentReference = paymentReference,
            notes = notes,
            inWindow = CollegePackages.inWindow(usage, today, billing.funding),
            remindersSent = PackageReminderKind.entries.filter { it in remindersSent }.map { it.dbValue },
            createdAt = createdAt.toString(),
            updatedAt = updatedAt.toString(),
        )
    }

    private fun PackageRow.toCollegeView(): CollegePackageView {
        val usage = usage()
        return CollegePackageView(
            id = id,
            interviews = interviews,
            interviewsUsed = used,
            interviewsRemaining = usage.remaining,
            perStudentLimit = perStudentLimit,
            startsOn = startsOn.toString(),
            endsOn = endsOn.toString(),
            lastUsableOn = usage.lastUsableOn.toString(),
            status = status.wireValue,
            amountPaise = amountPaise,
            invoiceNumber = invoiceNumber,
            invoicedOn = invoicedOn?.toString(),
            paidOn = paidOn?.toString(),
        )
    }

    private fun voided() = ApiException.conflict("This package has been voided and can no longer change.", code = "package_void")

    private fun missingInvoiceNumber() =
        ApiException.badRequest("Add the invoice number before marking the package invoiced or paid.", code = "invalid_invoice_number")

    companion object {
        const val TARGET_PACKAGE = "college_package"
        private const val MICRO = 1_000_000.0
    }
}

/** Input rules for packages, mirroring the `check` constraints of the module 14 migration. */
object PackageValidation {
    const val MAX_INTERVIEWS = 1_000_000
    const val MAX_PER_STUDENT = 1000
    const val MAX_GRACE_DAYS = 90
    const val DEFAULT_GRACE_DAYS = 14
    const val MAX_AMOUNT_PAISE = 100_000_000_000L

    fun create(request: PackageRequest): PackageFields {
        val startsOn = date(request.startsOn, "startsOn") ?: throw invalidDate("startsOn")
        val endsOn = date(request.endsOn, "endsOn") ?: throw invalidDate("endsOn")
        return PackageFields(
            interviews = interviews(request.interviews),
            perStudentLimit = perStudentLimit(request.perStudentLimit),
            startsOn = startsOn,
            endsOn = term(startsOn, endsOn),
            graceDays = graceDays(request.graceDays ?: DEFAULT_GRACE_DAYS),
            amountPaise = amount(request.amountPaise),
            invoiceNumber = invoiceNumber(request.invoiceNumber),
            notes = CampusValidation.optionalText(request.notes, "notes", 2000),
        )
    }

    /** The fields after a PATCH, and the names of those that changed. */
    fun patch(
        row: PackageRow,
        request: PackageRequest,
    ): Pair<PackageFields, List<String>> {
        val changed = mutableListOf<String>()
        val interviews = request.interviews?.let(::interviews) ?: row.interviews
        if (interviews != row.interviews) changed += "interviews"
        val limit = if (request.perStudentLimit != null) perStudentLimit(request.perStudentLimit) else row.perStudentLimit
        if (limit != row.perStudentLimit) changed += "perStudentLimit"
        val startsOn = date(request.startsOn, "startsOn") ?: row.startsOn
        if (startsOn != row.startsOn) changed += "startsOn"
        val endsOn = term(startsOn, date(request.endsOn, "endsOn") ?: row.endsOn)
        if (endsOn != row.endsOn) changed += "endsOn"
        val grace = request.graceDays?.let(::graceDays) ?: row.graceDays
        if (grace != row.graceDays) changed += "graceDays"
        val amount = request.amountPaise?.let(::amount) ?: row.amountPaise
        if (amount != row.amountPaise) changed += "amountPaise"
        val invoice = CampusOrgService.patchText(request.invoiceNumber, row.invoiceNumber, "invoiceNumber", changed, ::invoiceNumber)
        val notes =
            CampusOrgService.patchText(request.notes, row.notes, "notes", changed) {
                CampusValidation.optionalText(it, "notes", 2000)
            }
        return PackageFields(interviews, limit, startsOn, endsOn, grace, amount, invoice, notes) to changed
    }

    fun interviews(value: Int?): Int {
        if (value == null || value !in 1..MAX_INTERVIEWS) {
            throw ApiException.badRequest("interviews needs to be a whole number from 1 to $MAX_INTERVIEWS.", code = "invalid_interviews")
        }
        return value
    }

    /** Null or 0 means no limit. */
    fun perStudentLimit(value: Int?): Int? {
        if (value == null || value == 0) return null
        if (value !in 1..MAX_PER_STUDENT) {
            throw ApiException.badRequest(
                "perStudentLimit needs to be a whole number from 1 to $MAX_PER_STUDENT, or 0 for no limit.",
                code = "invalid_per_student_limit",
            )
        }
        return value
    }

    fun graceDays(value: Int): Int {
        if (value !in 0..MAX_GRACE_DAYS) {
            throw ApiException.badRequest("graceDays needs to be from 0 to $MAX_GRACE_DAYS.", code = "invalid_grace_days")
        }
        return value
    }

    fun amount(value: Long?): Long {
        if (value == null || value !in 0..MAX_AMOUNT_PAISE) {
            throw ApiException.badRequest("amountPaise needs to be a whole number of paise, 0 or more.", code = "invalid_amount")
        }
        return value
    }

    fun invoiceNumber(value: String?): String? = CampusValidation.optionalText(value, "invoiceNumber", 60)

    /** A YYYY-MM-DD date; null when absent or blank. */
    fun date(
        value: String?,
        field: String,
    ): LocalDate? {
        if (value.isNullOrBlank()) return null
        return try {
            LocalDate.parse(value.trim())
        } catch (_: DateTimeParseException) {
            throw invalidDate(field)
        }
    }

    private fun term(
        startsOn: LocalDate,
        endsOn: LocalDate,
    ): LocalDate {
        if (endsOn.isBefore(startsOn)) {
            throw ApiException.badRequest("endsOn must not be before startsOn.", code = "invalid_term")
        }
        return endsOn
    }

    private fun invalidDate(field: String) =
        ApiException(HttpStatus.BAD_REQUEST, "invalid_date", "$field needs to be a date like 2026-11-01.")
}
