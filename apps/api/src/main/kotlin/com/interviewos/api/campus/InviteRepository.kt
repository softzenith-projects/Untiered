package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

data class ImportHeader(
    val id: UUID,
    val status: String,
    val createdAt: Instant,
    val expiresAt: Instant,
)

data class InviteFilter(
    /** invited | joined | revoked | expired, as [InviteView.status] shows them. */
    val status: String? = null,
    val role: CampusRole? = null,
    val batchId: UUID? = null,
    val query: String? = null,
)

data class InviteRow(
    val view: InviteView,
    val role: CampusRole,
    /** What the row holds; [InviteView.status] shows a lapsed `invited` as `expired`. */
    val storedStatus: String,
    val createdAt: Instant,
    val expiresAt: Instant,
    val sendCount: Int,
)

data class NewInvite(
    val email: String,
    val fullName: String,
    val role: CampusRole,
    val batchId: UUID?,
    val rollNumber: String?,
)

/** An invite found by its token, with what the join screen and accept need. */
data class TokenInvite(
    val id: UUID,
    val orgId: UUID,
    val orgName: String,
    val orgActive: Boolean,
    val logoPath: String?,
    val role: CampusRole,
    val batchId: UUID?,
    val batchName: String?,
    val email: String,
    val rollNumber: String?,
    val status: String,
    val expiresAt: Instant,
)

/** One invite the sender has claimed, with the hash of the token it is about to email. */
data class SendableInvite(
    val id: UUID,
    val orgId: UUID,
    val orgName: String,
    val email: String,
    val fullName: String,
    val role: CampusRole,
    val expiresAt: Instant,
    val attempts: Int,
)

/**
 * Imports and invites of a college (campus spec §3). Like the module 1–2 repositories, every
 * statement binds `scope.orgId`, with these reviewed exceptions (see [CampusSqlGuardTest]):
 *
 * - `invite-token`: an invite looked up by the SHA-256 of its token. The token is the
 *   capability; it is 256 random bits only the invited mailbox was sent.
 * - `invite-sender` and `import-purge`: the background jobs, which work across colleges and
 *   then bind each row's own `org_id` for every further statement.
 * - `own-membership`: whether the caller, by verified user id, is a student anywhere.
 *
 * Joining binds the org id read from the token's own invite row, never one from the request.
 */
@Repository
class InviteRepository(
    private val jdbc: JdbcClient,
) {
    // -- imports -----------------------------------------------------------------

    fun importContext(
        scope: OrgScope,
        emails: Set<String>,
        rollNumbers: Set<String>,
    ): ImportContext {
        val departments =
            jdbc
                .sql("select code from public.org_departments where org_id = :orgId")
                .param("orgId", scope.orgId)
                .query(String::class.java)
                .list()
                .filterNotNull()
                .toSet()
        val batches =
            jdbc
                .sql(
                    """
                    select b.id, b.name, d.code, b.graduation_year
                      from public.org_batches b
                      join public.org_departments d on d.org_id = b.org_id and d.id = b.department_id
                     where b.org_id = :orgId
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .query { rs, _ ->
                    ImportBatch(UUID.fromString(rs.getString(1)), rs.getString(2), rs.getString(3), rs.getInt(4))
                }.list()
        val members = mutableSetOf<String>()
        val invited = mutableSetOf<String>()
        for (chunk in emails.chunked(LOOKUP_CHUNK)) {
            members +=
                jdbc
                    .sql(
                        """
                        select distinct lower(u.email)
                          from public.org_members m
                          join public.users u on u.id = m.user_id
                         where m.org_id = :orgId and m.status = 'joined' and lower(u.email) in (:emails)
                        """.trimIndent(),
                    ).param("orgId", scope.orgId)
                    .param("emails", chunk)
                    .query(String::class.java)
                    .list()
                    .filterNotNull()
            invited +=
                jdbc
                    .sql(
                        """
                        select email from public.campus_invites
                         where org_id = :orgId and status = 'invited' and expires_at > now() and email in (:emails)
                        """.trimIndent(),
                    ).param("orgId", scope.orgId)
                    .param("emails", chunk)
                    .query(String::class.java)
                    .list()
                    .filterNotNull()
        }
        val rolls = mutableSetOf<String>()
        for (chunk in rollNumbers.chunked(LOOKUP_CHUNK)) {
            rolls +=
                jdbc
                    .sql(
                        """
                        select roll_number from public.org_members
                         where org_id = :orgId and status = 'joined' and roll_number in (:rolls)
                        """.trimIndent(),
                    ).param("orgId", scope.orgId)
                    .param("rolls", chunk)
                    .query(String::class.java)
                    .list()
                    .filterNotNull()
        }
        return ImportContext(departments, batches, members, invited, rolls)
    }

    fun createImport(
        scope: OrgScope,
        rows: List<ValidatedImportRow>,
    ): UUID {
        val id =
            jdbc
                .sql(
                    """
                    insert into public.campus_imports (org_id, created_by, row_count)
                    values (:orgId, :createdBy, :rowCount)
                    returning id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("createdBy", scope.actorUserId)
                .param("rowCount", rows.size)
                .query(UUID::class.java)
                .single()
        for (chunk in rows.chunked(INSERT_CHUNK)) {
            val values =
                chunk.indices.joinToString(", ") { i ->
                    "(cast(:n$i as integer), cast(:f$i as text), cast(:e$i as text), cast(:r$i as text), cast(:d$i as text), " +
                        "cast(:b$i as text), cast(:y$i as smallint), cast(:bi$i as uuid), cast(:p$i as text))"
                }
            val statement =
                jdbc
                    .sql(
                        """
                        insert into public.campus_import_rows
                               (org_id, import_id, row_number, full_name, email, roll_number, department_code, batch_name,
                                graduation_year, batch_id, problems)
                        select :orgId, :importId, v.n, v.f, v.e, v.r, v.d, v.b, v.y, v.bi, string_to_array(v.p, ',')
                          from (values $values) as v (n, f, e, r, d, b, y, bi, p)
                        """.trimIndent(),
                    ).param("orgId", scope.orgId)
                    .param("importId", id)
            chunk.forEachIndexed { i, row ->
                statement
                    .param("n$i", row.rowNumber)
                    .param("f$i", row.fullName)
                    .param("e$i", row.email)
                    .param("r$i", row.rollNumber)
                    .param("d$i", row.departmentCode)
                    .param("b$i", row.batchName)
                    .param("y$i", row.graduationYear)
                    .param("bi$i", row.batchId)
                    .param("p$i", row.problems.joinToString(",") { it.code })
            }
            statement.update()
        }
        return id
    }

    fun findImport(
        scope: OrgScope,
        id: UUID,
        lock: Boolean = false,
    ): ImportHeader? =
        jdbc
            .sql(
                """
                select id, status, created_at, expires_at from public.campus_imports
                 where org_id = :orgId and id = :id ${if (lock) "for update" else ""}
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .query { rs, _ ->
                ImportHeader(
                    UUID.fromString(rs.getString("id")),
                    rs.getString("status"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("expires_at").toInstant(),
                )
            }.optional()
            .orElse(null)

    fun importRows(
        scope: OrgScope,
        id: UUID,
    ): List<ImportRowView> =
        jdbc
            .sql(
                """
                select row_number, full_name, email, roll_number, department_code, batch_name, graduation_year, problems
                  from public.campus_import_rows
                 where org_id = :orgId and import_id = :id
                 order by row_number
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .query { rs, _ ->
                ImportRowView(
                    rowNumber = rs.getInt("row_number"),
                    fullName = rs.getString("full_name"),
                    email = rs.getString("email"),
                    rollNumber = rs.getString("roll_number"),
                    departmentCode = rs.getString("department_code"),
                    batchName = rs.getString("batch_name"),
                    graduationYear = rs.getObject("graduation_year")?.let { (it as Number).toInt() },
                    problems = rs.getArray("problems")?.let { (it.array as Array<*>).map(Any?::toString) }.orEmpty(),
                )
            }.list()

    /** Marks a preview discarded and drops its rows (names and emails) at once. */
    fun discardImport(
        scope: OrgScope,
        id: UUID,
    ) {
        jdbc
            .sql("update public.campus_imports set status = 'discarded' where org_id = :orgId and id = :id and status = 'previewed'")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update()
        jdbc
            .sql("delete from public.campus_import_rows where org_id = :orgId and import_id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update()
    }

    /**
     * Invites every valid stored row of a locked, open import, and marks it committed. Rows
     * whose email became a member or got an open invite since the preview are skipped; a lapsed
     * invite for the same email is marked expired so the new one can take its place. Returns
     * how many invites were created.
     */
    fun commitImport(
        scope: OrgScope,
        id: UUID,
    ): Int {
        jdbc
            .sql(
                """
                update public.campus_invites i set status = 'expired'
                 where i.org_id = :orgId and i.status = 'invited' and i.expires_at <= now()
                   and i.email in (select r.email from public.campus_import_rows r
                                    where r.org_id = :orgId and r.import_id = :id and r.problems = '{}')
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .update()
        val invited =
            jdbc
                .sql(
                    """
                    insert into public.campus_invites
                           (org_id, role, batch_id, email, full_name, roll_number, invited_by, invited_by_platform_admin, expires_at)
                    select :orgId, 'student', r.batch_id, r.email, btrim(r.full_name), r.roll_number, :invitedBy, :platformAdmin,
                           now() + make_interval(days => :days)
                      from public.campus_import_rows r
                     where r.org_id = :orgId and r.import_id = :id and r.problems = '{}' and r.batch_id is not null
                       and not exists (select 1 from public.org_members m
                                         join public.users u on u.id = m.user_id
                                        where m.org_id = :orgId and m.status = 'joined' and lower(u.email) = r.email)
                     order by r.row_number
                    on conflict (org_id, email) where status = 'invited' do nothing
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("id", id)
                .param("invitedBy", scope.actorUserId)
                .param("platformAdmin", scope.platformAdmin)
                .param("days", INVITE_DAYS)
                .update()
        jdbc
            .sql("update public.campus_imports set status = 'committed', committed_at = now() where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update()
        return invited
    }

    // -- invites -----------------------------------------------------------------

    fun listInvites(
        scope: OrgScope,
        filter: InviteFilter,
        after: MemberCursor?,
        limit: Int,
        staffOnly: Boolean = false,
    ): List<InviteRow> {
        val pattern = filter.query?.let { "%" + escapeLike(it) + "%" }
        val filters =
            buildString {
                if (staffOnly) append(" and i.role <> 'student'")
                when (filter.status) {
                    null -> {}

                    "invited" -> {
                        append(" and i.status = 'invited' and i.expires_at > now()")
                    }

                    "expired" -> {
                        append(" and (i.status = 'expired' or (i.status = 'invited' and i.expires_at <= now()))")
                    }

                    else -> {
                        append(" and i.status = :status")
                    }
                }
                if (filter.role != null) append(" and i.role = :role")
                if (filter.batchId != null) append(" and i.batch_id = :batchId")
                if (pattern != null) {
                    append(" and (i.email ilike :q escape '\\' or i.full_name ilike :q escape '\\'")
                    append(" or i.roll_number ilike :q escape '\\')")
                }
                if (after != null) append(" and (i.created_at, i.id) < (:afterAt, :afterId)")
            }
        val statement =
            jdbc
                .sql(
                    """
                    $INVITE_SELECT
                     where i.org_id = :orgId$filters
                     order by i.created_at desc, i.id desc
                     limit :limit
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("limit", limit)
        if (filter.status != null && filter.status != "invited" && filter.status != "expired") statement.param("status", filter.status)
        filter.role?.let { statement.param("role", it.dbValue) }
        filter.batchId?.let { statement.param("batchId", it) }
        pattern?.let { statement.param("q", it) }
        if (after != null) {
            statement.param("afterAt", OffsetDateTime.ofInstant(after.joinedAt, ZoneOffset.UTC))
            statement.param("afterId", after.id)
        }
        return statement.query { rs, _ -> rs.toInvite() }.list()
    }

    fun findInvite(
        scope: OrgScope,
        id: UUID,
        lock: Boolean = false,
    ): InviteRow? =
        jdbc
            .sql(
                """
                $INVITE_SELECT
                 where i.org_id = :orgId and i.id = :id ${if (lock) "for update of i" else ""}
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .query { rs, _ -> rs.toInvite() }
            .optional()
            .orElse(null)

    /** Whether a joined member of this college signs in with [email]. */
    fun isMemberEmail(
        scope: OrgScope,
        email: String,
    ): Boolean =
        jdbc
            .sql(
                """
                select count(*) from public.org_members m
                  join public.users u on u.id = m.user_id
                 where m.org_id = :orgId and m.status = 'joined' and lower(u.email) = :email
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("email", email)
            .query(Long::class.java)
            .single() > 0

    /** Whether an open, unexpired invite of this college goes to [email]. */
    fun hasOpenInvite(
        scope: OrgScope,
        email: String,
    ): Boolean =
        jdbc
            .sql(
                """
                select count(*) from public.campus_invites
                 where org_id = :orgId and email = :email and status = 'invited' and expires_at > now()
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("email", email)
            .query(Long::class.java)
            .single() > 0

    /** Null when an open invite for the email already exists (lost a race with another write). */
    fun createInvite(
        scope: OrgScope,
        invite: NewInvite,
    ): UUID? {
        jdbc
            .sql(
                """
                update public.campus_invites set status = 'expired'
                 where org_id = :orgId and email = :email and status = 'invited' and expires_at <= now()
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("email", invite.email)
            .update()
        return jdbc
            .sql(
                """
                insert into public.campus_invites
                       (org_id, role, batch_id, email, full_name, roll_number, invited_by, invited_by_platform_admin, expires_at)
                values (:orgId, :role, :batchId, :email, :fullName, :rollNumber, :invitedBy, :platformAdmin,
                        now() + make_interval(days => :days))
                on conflict (org_id, email) where status = 'invited' do nothing
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("role", invite.role.dbValue)
            .param("batchId", invite.batchId)
            .param("email", invite.email)
            .param("fullName", invite.fullName)
            .param("rollNumber", invite.rollNumber)
            .param("invitedBy", scope.actorUserId)
            .param("platformAdmin", scope.platformAdmin)
            .param("days", INVITE_DAYS)
            .query(UUID::class.java)
            .optional()
            .orElse(null)
    }

    /**
     * Invalidates the current link at once (a fresh unsent hash), resets the expiry, counts one
     * more email and queues it. The sender draws the token that goes in the email.
     */
    fun resend(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.campus_invites
                   set token_hash = sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')),
                       expires_at = now() + make_interval(days => :days),
                       send_count = send_count + 1,
                       send_status = 'pending',
                       send_attempts = 0,
                       next_send_at = now(),
                       send_claimed_at = null,
                       send_error = null
                 where org_id = :orgId and id = :id and status = 'invited' and send_count < :maxSends
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .param("days", INVITE_DAYS)
            .param("maxSends", MAX_SENDS)
            .update() > 0

    fun revoke(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql("update public.campus_invites set status = 'revoked' where org_id = :orgId and id = :id and status = 'invited'")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update() > 0

    // -- joining -----------------------------------------------------------------

    /** The invite whose current token hashes to [tokenHash]; [lock] takes its row lock. */
    fun findByTokenHash(
        tokenHash: ByteArray,
        lock: Boolean,
    ): TokenInvite? =
        jdbc
            .sql(
                """
                /* unscoped: invite-token */
                select i.id, i.org_id, o.name as org_name, o.status = 'active' as org_active, o.logo_path, i.role,
                       i.batch_id, b.name as batch_name, i.email, i.roll_number, i.status, i.expires_at
                  from public.campus_invites i
                  join public.organisations o on o.id = i.org_id
                  left join public.org_batches b on b.org_id = i.org_id and b.id = i.batch_id
                 where i.token_hash = :hash ${if (lock) "for update of i" else ""}
                """.trimIndent(),
            ).param("hash", tokenHash)
            .query { rs, _ ->
                TokenInvite(
                    id = UUID.fromString(rs.getString("id")),
                    orgId = UUID.fromString(rs.getString("org_id")),
                    orgName = rs.getString("org_name"),
                    orgActive = rs.getBoolean("org_active"),
                    logoPath = rs.getString("logo_path"),
                    role = CampusRole.fromDbValue(rs.getString("role")) ?: error("Unknown campus role in campus_invites"),
                    batchId = rs.getString("batch_id")?.let(UUID::fromString),
                    batchName = rs.getString("batch_name"),
                    email = rs.getString("email"),
                    rollNumber = rs.getString("roll_number"),
                    status = rs.getString("status"),
                    expiresAt = rs.getTimestamp("expires_at").toInstant(),
                )
            }.optional()
            .orElse(null)

    /** Whether [userId] holds a joined membership, in any role, of the invite's college. */
    fun isJoinedIn(
        orgId: UUID,
        userId: UUID,
    ): Boolean =
        jdbc
            .sql("select count(*) from public.org_members where org_id = :orgId and user_id = :userId and status = 'joined'")
            .param("orgId", orgId)
            .param("userId", userId)
            .query(Long::class.java)
            .single() > 0

    /** Whether [userId] is a joined student of any college. */
    fun isStudentAnywhere(userId: UUID): Boolean =
        jdbc
            .sql(
                """
                /* unscoped: own-membership */
                select count(*) from public.org_members where user_id = :userId and role = 'student' and status = 'joined'
                """.trimIndent(),
            ).param("userId", userId)
            .query(Long::class.java)
            .single() > 0

    fun rollNumberHeld(
        orgId: UUID,
        rollNumber: String,
    ): Boolean =
        jdbc
            .sql("select count(*) from public.org_members where org_id = :orgId and roll_number = :roll and status = 'joined'")
            .param("orgId", orgId)
            .param("roll", rollNumber)
            .query(Long::class.java)
            .single() > 0

    fun insertMembership(
        invite: TokenInvite,
        userId: UUID,
        rollNumber: String?,
        consentVersion: String?,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.org_members (org_id, user_id, role, batch_id, roll_number, consent_version, consented_at)
                values (:orgId, :userId, :role, :batchId, :roll, :consent, case when :student then now() end)
                returning id
                """.trimIndent(),
            ).param("orgId", invite.orgId)
            .param("userId", userId)
            .param("role", invite.role.dbValue)
            .param("batchId", invite.batchId)
            .param("roll", rollNumber)
            .param("consent", consentVersion)
            .param("student", invite.role == CampusRole.STUDENT)
            .query(UUID::class.java)
            .single()

    fun markJoined(
        invite: TokenInvite,
        memberId: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.campus_invites set status = 'joined', joined_at = now(), member_id = :memberId
                 where org_id = :orgId and id = :id and status = 'invited'
                """.trimIndent(),
            ).param("orgId", invite.orgId)
            .param("id", invite.id)
            .param("memberId", memberId)
            .update() > 0

    // -- the invite email job ----------------------------------------------------

    /** A send that has been `sending` for too long died with its process. It is not retried. */
    fun failStaleSends(): Int =
        jdbc
            .sql(
                """
                /* unscoped: invite-sender */
                update public.campus_invites set send_status = 'failed', send_error = 'interrupted'
                 where send_status = 'sending' and send_claimed_at < now() - interval '5 minutes'
                """.trimIndent(),
            ).update()

    /** Claims up to [limit] due invites of active colleges, oldest first, across colleges. */
    fun claimPendingSends(limit: Int): List<Pair<UUID, UUID>> =
        jdbc
            .sql(
                """
                /* unscoped: invite-sender */
                with next as (
                  select i.id from public.campus_invites i
                    join public.organisations o on o.id = i.org_id
                   where i.send_status = 'pending' and i.next_send_at <= now()
                     and i.status = 'invited' and i.expires_at > now() and o.status = 'active'
                   order by i.next_send_at, i.id
                   for update of i skip locked
                   limit :limit
                )
                update public.campus_invites c
                   set send_status = 'sending', send_attempts = c.send_attempts + 1, send_claimed_at = now()
                  from next where c.id = next.id
                returning c.org_id, c.id
                """.trimIndent(),
            ).param("limit", limit)
            .query { rs, _ -> UUID.fromString(rs.getString("org_id")) to UUID.fromString(rs.getString("id")) }
            .list()

    /**
     * Stores the hash of the token about to be emailed, replacing the previous one, and
     * returns what the email says. Null when the claim was lost (resent or revoked meanwhile).
     */
    fun rotateForSend(
        orgId: UUID,
        id: UUID,
        tokenHash: ByteArray,
    ): SendableInvite? =
        jdbc
            .sql(
                """
                update public.campus_invites i set token_hash = :hash
                  from public.organisations o
                 where i.org_id = :orgId and i.id = :id and o.id = i.org_id
                   and i.send_status = 'sending' and i.status = 'invited'
                returning i.id, i.org_id, o.name as org_name, i.email, i.full_name, i.role, i.expires_at, i.send_attempts
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("id", id)
            .param("hash", tokenHash)
            .query { rs, _ ->
                SendableInvite(
                    id = UUID.fromString(rs.getString("id")),
                    orgId = UUID.fromString(rs.getString("org_id")),
                    orgName = rs.getString("org_name"),
                    email = rs.getString("email"),
                    fullName = rs.getString("full_name"),
                    role = CampusRole.fromDbValue(rs.getString("role")) ?: error("Unknown campus role in campus_invites"),
                    expiresAt = rs.getTimestamp("expires_at").toInstant(),
                    attempts = rs.getInt("send_attempts"),
                )
            }.optional()
            .orElse(null)

    /** Only while the row still carries this send's token: a resend meanwhile queues another. */
    fun markSent(
        orgId: UUID,
        id: UUID,
        tokenHash: ByteArray,
    ) {
        jdbc
            .sql(
                """
                update public.campus_invites set send_status = 'sent', last_sent_at = now(), send_error = null
                 where org_id = :orgId and id = :id and token_hash = :hash and send_status = 'sending'
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("id", id)
            .param("hash", tokenHash)
            .update()
    }

    fun markSendFailed(
        orgId: UUID,
        id: UUID,
        tokenHash: ByteArray,
        retry: Boolean,
        delaySeconds: Long,
        code: String,
    ) {
        jdbc
            .sql(
                """
                update public.campus_invites
                   set send_status = case when :retry then 'pending' else 'failed' end,
                       next_send_at = now() + (:delay * interval '1 second'),
                       send_error = :code
                 where org_id = :orgId and id = :id and token_hash = :hash and send_status = 'sending'
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("id", id)
            .param("hash", tokenHash)
            .param("retry", retry)
            .param("delay", delaySeconds)
            .param("code", code)
            .update()
    }

    /** Previews older than a day, committed or not: they are lists of names and emails. */
    fun purgeExpiredImports(): Int =
        jdbc
            .sql(
                """
                /* unscoped: import-purge */
                delete from public.campus_imports where expires_at < now()
                """.trimIndent(),
            ).update()

    private fun ResultSet.toInvite(): InviteRow {
        val role = CampusRole.fromDbValue(getString("role")) ?: error("Unknown campus role in campus_invites")
        val createdAt = getTimestamp("created_at").toInstant()
        val expiresAt = getTimestamp("expires_at").toInstant()
        return InviteRow(
            view =
                InviteView(
                    id = UUID.fromString(getString("id")),
                    email = getString("email"),
                    fullName = getString("full_name"),
                    role = role.dbValue,
                    batchId = getString("batch_id")?.let(UUID::fromString),
                    batchName = getString("batch_name"),
                    rollNumber = getString("roll_number"),
                    status = getString("shown_status"),
                    sendStatus = getString("send_status"),
                    sendCount = getInt("send_count"),
                    lastSentAt = getTimestamp("last_sent_at")?.toInstant()?.toString(),
                    createdAt = createdAt.toString(),
                    expiresAt = expiresAt.toString(),
                    joinedAt = getTimestamp("joined_at")?.toInstant()?.toString(),
                ),
            role = role,
            storedStatus = getString("status"),
            createdAt = createdAt,
            expiresAt = expiresAt,
            sendCount = getInt("send_count"),
        )
    }

    private fun escapeLike(value: String): String = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    companion object {
        const val INVITE_DAYS = 14
        const val MAX_SENDS = 10
        private const val LOOKUP_CHUNK = 1_000
        private const val INSERT_CHUNK = 500

        /** Completed by every caller with `i.org_id = :orgId`. */
        private const val INVITE_SELECT = """select i.id, i.email, i.full_name, i.role, i.batch_id, b.name as batch_name,
                   i.roll_number, i.status,
                   case when i.status = 'invited' and i.expires_at <= now() then 'expired' else i.status end as shown_status,
                   i.send_status, i.send_count, i.last_sent_at, i.created_at, i.expires_at, i.joined_at
              from public.campus_invites i
              left join public.org_batches b on b.org_id = i.org_id and b.id = i.batch_id"""
    }
}
