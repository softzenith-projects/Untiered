package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

/** A private staff note as stored, with its author's display name. */
data class StaffCommentRow(
    val id: UUID,
    val memberId: UUID,
    val sessionId: UUID?,
    val authorMemberId: UUID?,
    val authorName: String?,
    val body: String,
    val createdAt: Instant,
    val editedAt: Instant?,
)

/**
 * Private staff notes about a student (campus spec §8). Every statement binds `scope.orgId`,
 * and every read is narrowed to the faculty member's batches through the student the note is
 * about: a note on a student outside their scope is as invisible as one in another college.
 * Only joined students' notes are read; a student who has left keeps none on screen.
 *
 * Nothing here is reachable from a student route — the table is staff-only by construction.
 */
@Repository
class StaffCommentRepository(
    private val jdbc: JdbcClient,
) {
    /** True when [memberId] is a joined student of this college the caller may see. */
    fun studentInScope(
        scope: OrgScope,
        memberId: UUID,
    ): Boolean {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return false
        val statement =
            jdbc
                .sql(
                    """
                    select count(*) from public.org_members m
                     where m.org_id = :orgId and m.id = :memberId and m.role = 'student'
                       and m.status = 'joined'${if (visible != null) " and m.batch_id in (:visible)" else ""}
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("memberId", memberId)
        if (visible != null) statement.param("visible", visible.toList())
        return statement.query(Long::class.java).single() > 0
    }

    /** The notes on one student, newest first. */
    fun list(
        scope: OrgScope,
        memberId: UUID,
    ): List<StaffCommentRow> = select(scope, "c.member_id = :memberId", "memberId", memberId)

    /** One note, when it belongs to this college and its student is in the caller's scope. */
    fun find(
        scope: OrgScope,
        id: UUID,
    ): StaffCommentRow? = select(scope, "c.id = :id", "id", id).singleOrNull()

    fun insert(
        scope: OrgScope,
        memberId: UUID,
        sessionId: UUID?,
        body: String,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.campus_staff_comments (org_id, member_id, session_id, author_member_id, body)
                values (:orgId, :memberId, :sessionId, :author, :body)
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("memberId", memberId)
            .param("sessionId", sessionId)
            .param("author", scope.memberId)
            .param("body", body)
            .query(UUID::class.java)
            .single()

    fun updateBody(
        scope: OrgScope,
        id: UUID,
        body: String,
    ): Boolean =
        jdbc
            .sql("update public.campus_staff_comments set body = :body, edited_at = now() where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .param("body", body)
            .update() == 1

    fun delete(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql("delete from public.campus_staff_comments where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update() == 1

    private fun select(
        scope: OrgScope,
        condition: String,
        name: String,
        value: UUID,
    ): List<StaffCommentRow> {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val statement =
            jdbc
                .sql(
                    """
                    select c.id, c.member_id, c.session_id, c.author_member_id, au.display_name as author_name,
                           c.body, c.created_at, c.edited_at
                      from public.campus_staff_comments c
                      join public.org_members m on m.org_id = c.org_id and m.id = c.member_id
                      left join public.org_members am on am.org_id = c.org_id and am.id = c.author_member_id
                      left join public.users au on au.id = am.user_id
                     where c.org_id = :orgId and $condition and m.role = 'student'
                       and m.status = 'joined'${if (visible != null) " and m.batch_id in (:visible)" else ""}
                     order by c.created_at desc, c.id desc
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param(name, value)
        if (visible != null) statement.param("visible", visible.toList())
        return statement.query { rs, _ -> rs.toComment() }.list()
    }

    private fun ResultSet.toComment(): StaffCommentRow =
        StaffCommentRow(
            id = UUID.fromString(getString("id")),
            memberId = UUID.fromString(getString("member_id")),
            sessionId = getString("session_id")?.let(UUID::fromString),
            authorMemberId = getString("author_member_id")?.let(UUID::fromString),
            authorName = getString("author_name"),
            body = getString("body"),
            createdAt = getTimestamp("created_at").toInstant(),
            editedAt = getTimestamp("edited_at")?.toInstant(),
        )
}
