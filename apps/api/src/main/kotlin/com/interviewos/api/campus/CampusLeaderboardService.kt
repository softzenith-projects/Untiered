package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

// Campus module 12 (docs/campus-api-contract.md "Module 12"): the opt-in leaderboard. Student
// only; staff have the readiness table. Ranks come from [CampusReadinessService.compute], never
// recomputed here, so the board can never disagree with a student's own readiness page.

data class LeaderboardRow(
    val rank: Int,
    val displayName: String,
    val overall: Int,
    val isMe: Boolean,
)

data class LeaderboardView(
    val scope: String,
    val optedIn: Boolean,
    val myRank: Int?,
    val rows: List<LeaderboardRow>,
)

data class LeaderboardPreference(
    val optIn: Boolean,
)

/** One student as the ranking sees them: nothing that identifies a membership beyond [memberId], which never leaves the server. */
internal data class LeaderboardCandidate(
    val memberId: UUID,
    val name: String?,
    val overall: Int?,
    val band: ReadinessBand,
    val optedIn: Boolean,
)

/** Pure ranking, so every rule is pinned by a unit test. */
internal object LeaderboardRanking {
    const val TOP = 50
    const val ANONYMOUS = "Anonymous student"

    /**
     * Students with a band other than `not_enough_evidence` ranked by `overall`, highest first.
     * Ties share a rank (1, 2, 2, 4). The result is the top [TOP] plus the caller's own row when
     * they are ranked but below it; `myRank` is null when the caller is unranked.
     */
    fun rank(
        candidates: List<LeaderboardCandidate>,
        me: UUID,
        scope: String,
    ): LeaderboardView {
        val ranked =
            candidates
                .filter { it.band != ReadinessBand.NOT_ENOUGH_EVIDENCE && it.overall != null }
                .sortedWith(compareByDescending<LeaderboardCandidate> { it.overall }.thenBy { it.memberId })
        val rows = mutableListOf<LeaderboardRow>()
        var rank = 0
        var previous: Int? = null
        var myRow: LeaderboardRow? = null
        ranked.forEachIndexed { index, candidate ->
            val overall = candidate.overall ?: return@forEachIndexed
            if (overall != previous) rank = index + 1
            previous = overall
            val row = LeaderboardRow(rank, displayName(candidate), overall, candidate.memberId == me)
            if (row.isMe) myRow = row
            if (index < TOP) rows += row
        }
        val mine = myRow
        if (mine != null && rows.none { it.isMe }) rows += mine
        return LeaderboardView(
            scope = scope,
            optedIn = candidates.firstOrNull { it.memberId == me }?.optedIn ?: false,
            myRank = mine?.rank,
            rows = rows,
        )
    }

    private fun displayName(candidate: LeaderboardCandidate): String {
        val name = candidate.name?.trim()
        return if (candidate.optedIn && !name.isNullOrEmpty()) name else ANONYMOUS
    }
}

@Repository
class LeaderboardRepository(
    private val jdbc: JdbcClient,
) {
    /** The members of this college who chose to show their name. */
    fun optedIn(scope: OrgScope): Set<UUID> =
        jdbc
            .sql(
                """
                select m.id from public.org_members m
                 where m.org_id = :orgId and m.role = 'student' and m.status = 'joined' and m.leaderboard_opt_in
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .query { rs, _ -> UUID.fromString(rs.getString("id")) }
            .list()
            .toSet()

    fun setOptIn(
        scope: OrgScope,
        memberId: UUID,
        optIn: Boolean,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.org_members set leaderboard_opt_in = :optIn
                 where org_id = :orgId and id = :memberId and role = 'student' and status = 'joined'
                """.trimIndent(),
            ).param("optIn", optIn)
            .param("orgId", scope.orgId)
            .param("memberId", memberId)
            .update() > 0
}

@Service
class CampusLeaderboardService(
    private val access: CampusAccess,
    private val readiness: CampusReadinessService,
    private val readinessRepository: ReadinessRepository,
    private val assignments: AssignmentRepository,
    private val leaderboard: LeaderboardRepository,
) {
    /** 404 when the caller is not a joined student of an active college. 400 `scope_invalid` for an unknown scope. */
    @Transactional(readOnly = true)
    fun view(
        identity: SupabaseIdentity,
        scopeName: String?,
    ): LeaderboardView {
        val scope = access.resolveOwnStudentMembership(identity) ?: throw ApiException.notFound()
        scope.require(CampusPermission.OWN_MEMBERSHIP)
        val memberId = scope.memberId ?: throw ApiException.notFound()
        assignments.activeOrg(scope) ?: throw ApiException.notFound()
        val wanted = scopeName?.trim()?.lowercase() ?: BATCH
        if (wanted != BATCH && wanted != COLLEGE) {
            throw ApiException.badRequest("`scope` must be batch or college.", code = "scope_invalid")
        }
        val weights = readinessRepository.weights(scope)
        val everyone = readiness.compute(scope, ReadinessFilter(), weights)
        val mine = everyone.firstOrNull { it.student.memberId == memberId } ?: throw ApiException.notFound()
        val inScope = if (wanted == BATCH) everyone.filter { it.student.batchId == mine.student.batchId } else everyone
        val opted = leaderboard.optedIn(scope)
        return LeaderboardRanking.rank(
            inScope.map {
                LeaderboardCandidate(it.student.memberId, it.student.name, it.result.overall, it.result.band, it.student.memberId in opted)
            },
            memberId,
            wanted,
        )
    }

    @Transactional
    fun setPreference(
        identity: SupabaseIdentity,
        optIn: Boolean?,
    ): LeaderboardPreference {
        val scope = access.resolveOwnStudentMembership(identity) ?: throw ApiException.notFound()
        scope.require(CampusPermission.OWN_MEMBERSHIP)
        val memberId = scope.memberId ?: throw ApiException.notFound()
        assignments.activeOrg(scope) ?: throw ApiException.notFound()
        if (optIn == null) throw ApiException.badRequest("`optIn` must be true or false.", code = "opt_in_invalid")
        if (!leaderboard.setOptIn(scope, memberId, optIn)) throw ApiException.notFound()
        return LeaderboardPreference(optIn)
    }

    private companion object {
        const val BATCH = "batch"
        const val COLLEGE = "college"
    }
}

@RestController
@RequestMapping("/api/v1/me/campus")
class MeCampusLeaderboardController(
    private val service: CampusLeaderboardService,
) {
    @GetMapping("/leaderboard")
    fun leaderboard(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam(required = false) scope: String?,
    ): LeaderboardView = service.view(SupabaseIdentity.from(jwt), scope)

    @PutMapping("/leaderboard-preference")
    fun preference(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): LeaderboardPreference = service.setPreference(SupabaseIdentity.from(jwt), body?.get("optIn") as? Boolean)
}
