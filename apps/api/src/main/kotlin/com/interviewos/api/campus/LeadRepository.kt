package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** A lead's notification, as much of it as the email may carry: never the phone or the message. */
data class LeadNotice(
    val id: UUID,
    val collegeName: String,
    val city: String,
    val contactName: String,
    val contactRole: String,
)

/**
 * `campus_leads` (contract Module 13). Leads belong to no college, so nothing here binds an
 * org id: the public write is reached only through [CampusLeadService.submit], and every read
 * through a [PlatformAdmin] proof.
 */
@Repository
class LeadRepository(
    private val jdbc: JdbcClient,
) {
    /**
     * Serialises submissions for one email for the rest of the transaction, so two at once
     * cannot both miss the open lead and store it twice.
     */
    fun lockEmail(email: String) {
        jdbc
            .sql("select pg_advisory_xact_lock(hashtext('campus_lead:' || :email))")
            .param("email", email)
            .query { _, _ -> 1 }
            .list()
    }

    /** The open lead for this email and college registered in the last 30 days, if any. */
    fun findOpenDuplicate(
        email: String,
        collegeName: String,
    ): UUID? =
        jdbc
            .sql(
                """
                select id from public.campus_leads
                 where lower(email) = :email
                   and lower(college_name) = lower(:college)
                   and status in ('new', 'contacted')
                   and created_at > now() - interval '30 days'
                 order by created_at desc
                 limit 1
                """.trimIndent(),
            ).param("email", email)
            .param("college", collegeName)
            .query(UUID::class.java)
            .optional()
            .orElse(null)

    fun insert(
        fields: LeadFields,
        notify: Boolean,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.campus_leads
                       (college_name, city, state, contact_name, contact_role, email, phone, approx_students, message,
                        consented_at, notify_status)
                values (:college, :city, :state, :contactName, :contactRole, :email, :phone, :students, :message,
                        now(), :notify)
                returning id
                """.trimIndent(),
            ).fields(fields)
            .param("notify", if (notify) "pending" else "skipped")
            .query(UUID::class.java)
            .single()

    /**
     * A repeat submission: the latest details win, an optional field left blank keeps what the
     * lead had, and the private notes and status are untouched. No second notification.
     */
    fun merge(
        id: UUID,
        fields: LeadFields,
    ) {
        jdbc
            .sql(
                """
                update public.campus_leads
                   set college_name = :college, city = :city, state = :state, contact_name = :contactName,
                       contact_role = :contactRole, phone = coalesce(:phone, phone),
                       approx_students = coalesce(:students, approx_students), message = coalesce(:message, message),
                       consented_at = now(), submission_count = submission_count + 1
                 where id = :id
                """.trimIndent(),
            ).fields(fields)
            .param("id", id)
            .update()
    }

    fun find(
        @Suppress("UNUSED_PARAMETER") admin: PlatformAdmin,
        id: UUID,
        lock: Boolean = false,
    ): LeadRow? =
        jdbc
            .sql("$SELECT where l.id = :id" + if (lock) " for update" else "")
            .param("id", id)
            .query { rs, _ -> rs.toLeadRow() }
            .optional()
            .orElse(null)

    /** Newest first, keyset-paged on (created_at, id). */
    fun list(
        @Suppress("UNUSED_PARAMETER") admin: PlatformAdmin,
        status: String?,
        query: String?,
        after: MemberCursor?,
        limit: Int,
    ): List<LeadRow> {
        val pattern = query?.let { "%" + escapeLike(it) + "%" }
        val filters =
            buildString {
                append(" where true")
                if (status != null) append(" and l.status = :status")
                if (pattern != null) {
                    append(" and (l.college_name ilike :q escape '\\' or l.contact_name ilike :q escape '\\'")
                    append(" or l.email ilike :q escape '\\' or l.city ilike :q escape '\\' or l.state ilike :q escape '\\')")
                }
                if (after != null) append(" and (l.created_at, l.id) < (:afterAt, :afterId)")
            }
        val statement =
            jdbc
                .sql("$SELECT$filters order by l.created_at desc, l.id desc limit :limit")
                .param("limit", limit)
        status?.let { statement.param("status", it) }
        pattern?.let { statement.param("q", it) }
        if (after != null) {
            statement.param("afterAt", OffsetDateTime.ofInstant(after.joinedAt, ZoneOffset.UTC))
            statement.param("afterId", after.id)
        }
        return statement.query { rs, _ -> rs.toLeadRow() }.list()
    }

    fun update(
        @Suppress("UNUSED_PARAMETER") admin: PlatformAdmin,
        id: UUID,
        status: String,
        statusChanged: Boolean,
        notes: String?,
    ) {
        jdbc
            .sql(
                """
                update public.campus_leads
                   set status = :status, notes = :notes,
                       status_changed_by = case when :changed then cast(:by as uuid) else status_changed_by end,
                       status_changed_at = case when :changed then now() else status_changed_at end
                 where id = :id
                """.trimIndent(),
            ).param("id", id)
            .param("status", status)
            .param("notes", notes)
            .param("changed", statusChanged)
            .param("by", admin.userId)
            .update()
    }

    fun markConverted(
        admin: PlatformAdmin,
        id: UUID,
        orgId: UUID,
    ) {
        jdbc
            .sql(
                """
                update public.campus_leads
                   set status = 'converted', org_id = :orgId, status_changed_by = :by, status_changed_at = now()
                 where id = :id
                """.trimIndent(),
            ).param("id", id)
            .param("orgId", orgId)
            .param("by", admin.userId)
            .update()
    }

    fun delete(
        @Suppress("UNUSED_PARAMETER") admin: PlatformAdmin,
        id: UUID,
    ): Boolean = jdbc.sql("delete from public.campus_leads where id = :id").param("id", id).update() > 0

    /**
     * Claims up to [limit] pending notifications and marks them sent before the email goes:
     * an SES timeout is ambiguous, and a duplicate notice is worse than none for a lead that
     * is on the admin screen either way. Leads older than a week are not announced late.
     */
    fun claimNotices(limit: Int): List<LeadNotice> =
        jdbc
            .sql(
                """
                update public.campus_leads l
                   set notify_status = 'sent'
                 where l.id in (select id from public.campus_leads
                                 where notify_status = 'pending' and created_at > now() - interval '7 days'
                                 order by created_at
                                 limit :limit
                                 for update skip locked)
                returning l.id, l.college_name, l.city, l.contact_name, l.contact_role
                """.trimIndent(),
            ).param("limit", limit)
            .query { rs, _ ->
                LeadNotice(
                    id = UUID.fromString(rs.getString("id")),
                    collegeName = rs.getString("college_name"),
                    city = rs.getString("city"),
                    contactName = rs.getString("contact_name"),
                    contactRole = rs.getString("contact_role"),
                )
            }.list()

    fun markNoticeFailed(id: UUID) {
        jdbc.sql("update public.campus_leads set notify_status = 'failed' where id = :id").param("id", id).update()
    }

    /** Leads marked not a fit more than 180 days ago (contract Module 13, data handling). */
    fun purgeNotAFit(): Int =
        jdbc
            .sql(
                """
                delete from public.campus_leads
                 where status = 'not_a_fit'
                   and coalesce(status_changed_at, updated_at) < now() - interval '180 days'
                """.trimIndent(),
            ).update()

    private fun JdbcClient.StatementSpec.fields(fields: LeadFields): JdbcClient.StatementSpec =
        param("college", fields.collegeName)
            .param("city", fields.city)
            .param("state", fields.state)
            .param("contactName", fields.contactName)
            .param("contactRole", fields.contactRole)
            .param("email", fields.email)
            .param("phone", fields.phone)
            .param("students", fields.approxStudents)
            .param("message", fields.message)

    private fun ResultSet.toLeadRow(): LeadRow =
        LeadRow(
            id = UUID.fromString(getString("id")),
            status = getString("status"),
            collegeName = getString("college_name"),
            city = getString("city"),
            state = getString("state"),
            contactName = getString("contact_name"),
            contactRole = getString("contact_role"),
            email = getString("email"),
            phone = getString("phone"),
            approxStudents = getObject("approx_students") as Int?,
            message = getString("message"),
            notes = getString("notes"),
            orgId = getString("org_id")?.let(UUID::fromString),
            createdAt = getTimestamp("created_at").toInstant(),
            updatedAt = getTimestamp("updated_at").toInstant(),
            statusChangedBy = getString("status_changed_by")?.let(UUID::fromString),
        )

    private fun escapeLike(value: String): String = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    private companion object {
        const val SELECT =
            "select l.id, l.status, l.college_name, l.city, l.state, l.contact_name, l.contact_role, l.email, l.phone, " +
                "l.approx_students, l.message, l.notes, l.org_id, l.created_at, l.updated_at, l.status_changed_by " +
                "from public.campus_leads l"
    }
}
