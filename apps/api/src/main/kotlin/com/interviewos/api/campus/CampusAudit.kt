package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * The college's audit log (campus spec §2): who viewed, exported or changed what.
 *
 * Written in the same transaction as the change it records, so a change is never kept
 * without its entry. `detail` holds ids, role names and field names only — never a name,
 * an email, or anything a student wrote. The table is append-only in the database.
 */
@Repository
class CampusAudit(
    private val jdbc: JdbcClient,
    private val objectMapper: ObjectMapper,
) {
    fun record(
        scope: OrgScope,
        action: String,
        targetType: String? = null,
        targetId: UUID? = null,
        detail: Map<String, Any?> = emptyMap(),
    ) {
        require(ACTION.matches(action)) { "Audit action $action is not entity.verb" }
        jdbc
            .sql(
                """
                insert into public.org_audit_log (org_id, actor_user_id, actor_kind, action, target_type, target_id, detail)
                values (:orgId, :actor, :actorKind, :action, :targetType, :targetId, cast(:detail as jsonb))
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("actor", scope.actorUserId)
            .param("actorKind", scope.actorKind)
            .param("action", action)
            .param("targetType", targetType)
            .param("targetId", targetId)
            .param("detail", objectMapper.writeValueAsString(detail))
            .update()
    }

    /**
     * A platform admin's read of a college is recorded on that college's log (campus plan §3,
     * "audited"). A member's ordinary reads are not: they are the member's job.
     */
    fun recordPlatformAdminRead(
        scope: OrgScope,
        action: String,
        targetType: String? = null,
        targetId: UUID? = null,
    ) {
        if (scope.platformAdmin) record(scope, action, targetType, targetId)
    }

    /** Newest first, keyset-paged on the identity column. */
    fun list(
        scope: OrgScope,
        beforeId: Long?,
        limit: Int,
    ): List<AuditEntryView> =
        jdbc
            .sql(
                """
                select a.id, a.occurred_at, u.display_name as actor_name, a.actor_kind, a.action, a.target_type, a.target_id
                  from public.org_audit_log a
                  left join public.users u on u.id = a.actor_user_id
                 where a.org_id = :orgId
                   and (cast(:beforeId as bigint) is null or a.id < cast(:beforeId as bigint))
                 order by a.id desc
                 limit :limit
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("beforeId", beforeId)
            .param("limit", limit)
            .query { rs, _ ->
                AuditEntryView(
                    id = rs.getLong("id"),
                    occurredAt = rs.getTimestamp("occurred_at").toInstant().toString(),
                    actorName = rs.getString("actor_name"),
                    actorKind = rs.getString("actor_kind"),
                    action = rs.getString("action"),
                    targetType = rs.getString("target_type"),
                    targetId = rs.getString("target_id")?.let(UUID::fromString),
                )
            }.list()

    private companion object {
        val ACTION = Regex("^[a-z_]+\\.[a-z_]+$")
    }
}
