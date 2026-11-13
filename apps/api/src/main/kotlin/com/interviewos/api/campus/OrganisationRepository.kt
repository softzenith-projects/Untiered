package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.util.UUID

/** An organisation as stored. Mapped to [OrgView] by [CampusViewsMapper]. */
data class OrgRow(
    val id: UUID,
    val name: String,
    val slug: String,
    val city: String?,
    val state: String?,
    val logoPath: String?,
    val contactName: String?,
    val contactEmail: String?,
    val contactPhone: String?,
    val status: String,
    val interviewAllowance: Int,
    val createdAt: java.time.Instant,
    val staffCount: Int,
    val studentCount: Int,
)

/** The editable columns, written together after the service has applied a patch. */
data class OrgFields(
    val name: String,
    val city: String?,
    val state: String?,
    val contactName: String?,
    val contactEmail: String?,
    val contactPhone: String?,
    val interviewAllowance: Int,
    val status: String,
)

@Repository
class OrganisationRepository(
    private val jdbc: JdbcClient,
) {
    /** Every college, for the platform-admin screen. Admin-only by the [PlatformAdmin] proof. */
    fun listAll(
        @Suppress("UNUSED_PARAMETER") admin: PlatformAdmin,
    ): List<OrgRow> =
        jdbc
            .sql(
                """
                /* unscoped: platform-admin-listing */
                select o.id, o.name, o.slug, o.city, o.state, o.logo_path, o.contact_name, o.contact_email,
                       o.contact_phone, o.status, o.interview_allowance, o.created_at,
                       (select count(*) from public.org_members m
                         where m.org_id = o.id and m.status = 'joined' and m.role <> 'student') as staff_count,
                       (select count(*) from public.org_members m
                         where m.org_id = o.id and m.status = 'joined' and m.role = 'student') as student_count
                  from public.organisations o
                 order by o.name, o.id
                """.trimIndent(),
            ).query { rs, _ -> rs.toOrgRow() }
            .list()

    /**
     * Creates a college. Returns null when the slug is taken, rather than raising, so the
     * caller's transaction is not left aborted by a unique violation.
     */
    fun create(
        admin: PlatformAdmin,
        slug: String,
        fields: OrgFields,
    ): UUID? =
        jdbc
            .sql(
                """
                /* unscoped: platform-admin-create */
                insert into public.organisations
                       (name, slug, city, state, contact_name, contact_email, contact_phone, interview_allowance, created_by)
                values (:name, :slug, :city, :state, :contactName, :contactEmail, :contactPhone, :allowance, :createdBy)
                on conflict (slug) do nothing
                returning id
                """.trimIndent(),
            ).param("name", fields.name)
            .param("slug", slug)
            .param("city", fields.city)
            .param("state", fields.state)
            .param("contactName", fields.contactName)
            .param("contactEmail", fields.contactEmail)
            .param("contactPhone", fields.contactPhone)
            .param("allowance", fields.interviewAllowance)
            .param("createdBy", admin.userId)
            .query(UUID::class.java)
            .optional()
            .orElse(null)

    fun find(scope: OrgScope): OrgRow? =
        jdbc
            .sql(
                """
                select o.id, o.name, o.slug, o.city, o.state, o.logo_path, o.contact_name, o.contact_email,
                       o.contact_phone, o.status, o.interview_allowance, o.created_at,
                       (select count(*) from public.org_members m
                         where m.org_id = o.id and m.status = 'joined' and m.role <> 'student') as staff_count,
                       (select count(*) from public.org_members m
                         where m.org_id = o.id and m.status = 'joined' and m.role = 'student') as student_count
                  from public.organisations o
                 where o.id = :orgId
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .query { rs, _ -> rs.toOrgRow() }
            .optional()
            .orElse(null)

    /**
     * Takes the college's row lock for the rest of the transaction. Staff changes take it
     * first, so two admins demoting each other at once cannot leave the college with none.
     */
    fun lock(scope: OrgScope) {
        jdbc
            .sql("select id from public.organisations where id = :orgId for update")
            .param("orgId", scope.orgId)
            .query(UUID::class.java)
            .optional()
    }

    fun update(
        scope: OrgScope,
        fields: OrgFields,
    ) {
        jdbc
            .sql(
                """
                update public.organisations
                   set name = :name, city = :city, state = :state,
                       contact_name = :contactName, contact_email = :contactEmail, contact_phone = :contactPhone,
                       interview_allowance = :allowance, status = :status
                 where id = :orgId
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("name", fields.name)
            .param("city", fields.city)
            .param("state", fields.state)
            .param("contactName", fields.contactName)
            .param("contactEmail", fields.contactEmail)
            .param("contactPhone", fields.contactPhone)
            .param("allowance", fields.interviewAllowance)
            .param("status", fields.status)
            .update()
    }

    /** Points the college at a new logo object and returns the path it replaced, if any. */
    fun replaceLogoPath(
        scope: OrgScope,
        path: String,
    ): String? {
        val old =
            jdbc
                .sql("select logo_path from public.organisations where id = :orgId for update")
                .param("orgId", scope.orgId)
                .query { rs, _ -> rs.getString("logo_path") }
                .optional()
                .orElse(null)
        jdbc
            .sql("update public.organisations set logo_path = :path where id = :orgId")
            .param("orgId", scope.orgId)
            .param("path", path)
            .update()
        return old
    }

    private fun ResultSet.toOrgRow() =
        OrgRow(
            id = UUID.fromString(getString("id")),
            name = getString("name"),
            slug = getString("slug"),
            city = getString("city"),
            state = getString("state"),
            logoPath = getString("logo_path"),
            contactName = getString("contact_name"),
            contactEmail = getString("contact_email"),
            contactPhone = getString("contact_phone"),
            status = getString("status"),
            interviewAllowance = getInt("interview_allowance"),
            createdAt = getTimestamp("created_at").toInstant(),
            staffCount = getInt("staff_count"),
            studentCount = getInt("student_count"),
        )
}
