package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/** A package as stored, with what is spent of it. */
data class PackageRow(
    val id: UUID,
    val orgId: UUID,
    val interviews: Int,
    val perStudentLimit: Int?,
    val startsOn: LocalDate,
    val endsOn: LocalDate,
    val graceDays: Int,
    val amountPaise: Long,
    val invoiceNumber: String?,
    val status: PackageStatus,
    val invoicedOn: LocalDate?,
    val paidOn: LocalDate?,
    val paymentReference: String?,
    val notes: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
    /** Attempts charged to it that did not fail. */
    val used: Int,
    val remindersSent: Set<PackageReminderKind>,
) {
    fun usage(): PackageUsage = PackageUsage(id, status, interviews, perStudentLimit, startsOn, endsOn, graceDays, used)
}

/** The writable fields of a package. */
data class PackageFields(
    val interviews: Int,
    val perStudentLimit: Int?,
    val startsOn: LocalDate,
    val endsOn: LocalDate,
    val graceDays: Int,
    val amountPaise: Long,
    val invoiceNumber: String?,
    val notes: String?,
)

/** A college, for the operator's billing page. */
data class BillingOrg(
    val id: UUID,
    val name: String,
    val status: String,
)

/** A package whose end date is near, for the renewal reminder job. */
data class ReminderPackage(
    val orgId: UUID,
    val college: String,
    val row: PackageRow,
)

/**
 * College packages and payments (contract "Module 14"). Every college-scoped statement binds
 * `scope.orgId`; the few that read across colleges take a [PlatformAdmin] proof or are the
 * reminder job's discovery, marked `unscoped`.
 */
@Repository
class CollegePackageRepository(
    private val jdbc: JdbcClient,
) {
    /** Every package of the college, newest term first. */
    fun list(scope: OrgScope): List<PackageRow> =
        jdbc
            .sql("$SELECT where p.org_id = :orgId order by p.starts_on desc, p.created_at desc, p.id")
            .param("orgId", scope.orgId)
            .query { rs, _ -> rs.toPackage() }
            .list()

    fun find(
        scope: OrgScope,
        id: UUID,
    ): PackageRow? =
        jdbc
            .sql("$SELECT where p.org_id = :orgId and p.id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .query { rs, _ -> rs.toPackage() }
            .optional()
            .orElse(null)

    fun insert(
        scope: OrgScope,
        fields: PackageFields,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.college_packages
                       (org_id, interviews, per_student_limit, starts_on, ends_on, grace_days, amount_paise,
                        invoice_number, notes, created_by)
                values (:orgId, :interviews, :limit, :startsOn, :endsOn, :grace, :amount, :invoice, :notes, :createdBy)
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .bindFields(fields)
            .param("createdBy", scope.actorUserId)
            .query(UUID::class.java)
            .single()

    fun update(
        scope: OrgScope,
        id: UUID,
        fields: PackageFields,
    ): Int =
        jdbc
            .sql(
                """
                update public.college_packages
                   set interviews = :interviews, per_student_limit = :limit, starts_on = :startsOn, ends_on = :endsOn,
                       grace_days = :grace, amount_paise = :amount, invoice_number = :invoice, notes = :notes
                 where org_id = :orgId and id = :id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .bindFields(fields)
            .update()

    fun markInvoiced(
        scope: OrgScope,
        id: UUID,
        invoiceNumber: String,
        invoicedOn: LocalDate,
    ): Int =
        jdbc
            .sql(
                """
                update public.college_packages set status = 'invoiced', invoice_number = :invoice, invoiced_on = :on
                 where org_id = :orgId and id = :id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .param("invoice", invoiceNumber)
            .param("on", invoicedOn)
            .update()

    fun markPaid(
        scope: OrgScope,
        id: UUID,
        invoiceNumber: String,
        paidOn: LocalDate,
        paymentReference: String?,
    ): Int =
        jdbc
            .sql(
                """
                update public.college_packages
                   set status = 'paid', invoice_number = :invoice, paid_on = :on, payment_reference = :reference
                 where org_id = :orgId and id = :id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .param("invoice", invoiceNumber)
            .param("on", paidOn)
            .param("reference", paymentReference)
            .update()

    fun markVoid(
        scope: OrgScope,
        id: UUID,
    ): Int =
        jdbc
            .sql("update public.college_packages set status = 'void' where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update()

    /** A draft only: an issued package is a record of what the college was billed. */
    fun deleteDraft(
        scope: OrgScope,
        id: UUID,
    ): Int =
        jdbc
            .sql("delete from public.college_packages where org_id = :orgId and id = :id and status = 'draft'")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update()

    // -- across colleges -----------------------------------------------------------------

    /** [admin] is proof the caller passed the platform-admin gate. */
    @Suppress("UNUSED_PARAMETER")
    fun allOrgs(admin: PlatformAdmin): List<BillingOrg> =
        jdbc
            .sql(
                """
                /* unscoped: platform-admin-billing */
                select o.id, o.name, o.status from public.organisations o order by o.name, o.id
                """.trimIndent(),
            ).query { rs, _ -> BillingOrg(UUID.fromString(rs.getString("id")), rs.getString("name"), rs.getString("status")) }
            .list()

    /** Every package of every college. [admin] is proof the caller passed the platform-admin gate. */
    @Suppress("UNUSED_PARAMETER")
    fun allPackages(admin: PlatformAdmin): List<PackageRow> =
        jdbc
            .sql("/* unscoped: platform-admin-billing */ $SELECT order by p.org_id, p.ends_on, p.id")
            .query { rs, _ -> rs.toPackage() }
            .list()

    /** Estimated model cost per college in [from, to), for the billing page's package windows. */
    @Suppress("UNUSED_PARAMETER")
    fun aiCostMicroUsd(
        admin: PlatformAdmin,
        orgId: UUID,
        from: Instant,
        to: Instant,
    ): Long =
        jdbc
            .sql(
                """
                /* unscoped: platform-admin-billing */
                select coalesce(sum(c.micro_usd), 0)
                  from public.assignment_attempts a
                  join public.ai_calls c on c.session_id = a.session_id
                 where a.org_id = :orgId
                   and c.occurred_at >= :from and c.occurred_at < :to
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("from", Timestamp.from(from))
            .param("to", Timestamp.from(to))
            .query(Long::class.java)
            .single()

    /** Issued packages of active colleges whose end date is from [today] to 30 days on. */
    fun reminderCandidates(today: LocalDate): List<ReminderPackage> =
        jdbc
            .sql(
                """
                /* unscoped: notification-discovery */
                select o.name as college, x.*
                  from ($SELECT) x
                  join public.organisations o on o.id = x.org_id and o.status = 'active'
                 where x.status in ('invoiced', 'paid')
                   and x.ends_on >= :today
                   and x.ends_on <= cast(:today as date) + 30
                 order by x.org_id, x.ends_on, x.id
                """.trimIndent(),
            ).param("today", today)
            .query { rs, _ -> ReminderPackage(UUID.fromString(rs.getString("org_id")), rs.getString("college"), rs.toPackage()) }
            .list()

    /** Whether the college has an issued package ending after [endsOn]. */
    fun laterIssued(
        orgId: UUID,
        packageId: UUID,
        endsOn: LocalDate,
    ): Boolean =
        jdbc
            .sql(
                """
                select exists (select 1 from public.college_packages
                                where org_id = :orgId and id <> :id and status in ('invoiced', 'paid') and ends_on > :endsOn)
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("id", packageId)
            .param("endsOn", endsOn)
            .query(Boolean::class.java)
            .single()

    /**
     * Claims the reminder [kind] for the package, once ever: false when it was already sent.
     * Runs in the same transaction as the emails it queues.
     */
    fun claimReminder(
        orgId: UUID,
        packageId: UUID,
        kind: PackageReminderKind,
        today: LocalDate,
        recipients: Int,
    ): Boolean =
        jdbc
            .sql(
                """
                insert into public.college_package_reminders (org_id, package_id, kind, sent_on, recipients)
                values (:orgId, :id, :kind, :today, :recipients)
                on conflict (package_id, kind) do nothing
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("id", packageId)
            .param("kind", kind.dbValue)
            .param("today", today)
            .param("recipients", recipients)
            .update() == 1

    /** Joined admins and placement officers of an active college: who a billing notice goes to. */
    fun billingRecipients(orgId: UUID): Int =
        jdbc
            .sql(
                """
                select count(distinct m.user_id)
                  from public.org_members m
                  join public.organisations o on o.id = m.org_id and o.status = 'active'
                 where m.org_id = :orgId and m.role in ('college_admin', 'tpo') and m.status = 'joined'
                """.trimIndent(),
            ).param("orgId", orgId)
            .query(Int::class.java)
            .single()

    /** One outbox row per admin and placement officer; the dedupe key makes a repeat a no-op. */
    fun enqueueForStaff(
        orgId: UUID,
        email: CampusEmail,
    ): Int =
        jdbc
            .sql(
                """
                insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                select distinct m.user_id, cast(:key as text), cast(:category as text), cast(:subject as text), cast(:body as text)
                  from public.org_members m
                  join public.organisations o on o.id = :orgId and o.status = 'active'
                 where m.org_id = :orgId and m.role in ('college_admin', 'tpo') and m.status = 'joined'
                on conflict (user_id, dedupe_key) do nothing
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("key", email.dedupeKey)
            .param("category", email.category)
            .param("subject", email.subject)
            .param("body", email.body)
            .update()

    private fun JdbcClient.StatementSpec.bindFields(fields: PackageFields): JdbcClient.StatementSpec =
        param("interviews", fields.interviews)
            .param("limit", fields.perStudentLimit)
            .param("startsOn", fields.startsOn)
            .param("endsOn", fields.endsOn)
            .param("grace", fields.graceDays)
            .param("amount", fields.amountPaise)
            .param("invoice", fields.invoiceNumber)
            .param("notes", fields.notes)

    private fun ResultSet.toPackage(): PackageRow =
        PackageRow(
            id = UUID.fromString(getString("id")),
            orgId = UUID.fromString(getString("org_id")),
            interviews = getInt("interviews"),
            perStudentLimit = getObject("per_student_limit")?.let { (it as Number).toInt() },
            startsOn = getObject("starts_on", LocalDate::class.java),
            endsOn = getObject("ends_on", LocalDate::class.java),
            graceDays = getInt("grace_days"),
            amountPaise = getLong("amount_paise"),
            invoiceNumber = getString("invoice_number"),
            status = checkNotNull(PackageStatus.fromWireValue(getString("status"))),
            invoicedOn = getObject("invoiced_on", LocalDate::class.java),
            paidOn = getObject("paid_on", LocalDate::class.java),
            paymentReference = getString("payment_reference"),
            notes = getString("notes"),
            createdAt = getTimestamp("created_at").toInstant(),
            updatedAt = getTimestamp("updated_at").toInstant(),
            used = getInt("used"),
            remindersSent =
                (getArray("reminders")?.array as? Array<*>)
                    .orEmpty()
                    .mapNotNull { PackageReminderKind.fromDbValue(it as String?) }
                    .toSet(),
        )

    private companion object {
        val SELECT =
            """
            select p.id, p.org_id, p.interviews, p.per_student_limit, p.starts_on, p.ends_on, p.grace_days, p.amount_paise,
                   p.invoice_number, p.status, p.invoiced_on, p.paid_on, p.payment_reference, p.notes, p.created_at,
                   p.updated_at,
                   (select count(*) from public.assignment_attempts a
                     where a.org_id = p.org_id and a.package_id = p.id and a.status <> 'failed') as used,
                   array(select r.kind from public.college_package_reminders r where r.package_id = p.id) as reminders
              from public.college_packages p
            """.trimIndent()
    }
}
