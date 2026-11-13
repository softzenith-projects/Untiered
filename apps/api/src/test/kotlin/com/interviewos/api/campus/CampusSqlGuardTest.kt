package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * Tenant isolation, checked at the source (campus plan §2, step 6).
 *
 * Reads every `.kt` file under `campus/` and fails when a string literal that names a campus
 * table does not bind the caller's college: `org_id = :orgId`, `id = :orgId` (the
 * organisations table itself), or, for an insert, `:orgId` among its values. It catches the
 * "a new query forgot the filter" bug at PR time, before the isolation suite has to.
 *
 * A query that is deliberately not about one college carries a marker in its SQL,
 * `/ * unscoped: <reason> * /` (without the spaces), and each reason is allow-listed here with
 * the one file it may appear in and how many times. Adding a marker anywhere else, or one
 * more time, fails this test: an unscoped query is a reviewed decision, not a comment.
 */
class CampusSqlGuardTest {
    private val campusTables =
        listOf(
            "organisations",
            "org_departments",
            "org_batches",
            "org_members",
            "org_faculty_scopes",
            "org_audit_log",
            "assignments",
            "assignment_targets",
            "assignment_attempts",
            "campus_imports",
            "campus_import_rows",
            "campus_invites",
            "campus_staff_comments",
            "programme_templates",
            "programmes",
            "programme_targets",
        )

    /** reason to (file it may appear in to how many statements there) */
    private val allowList: Map<String, Map<String, Int>> =
        mapOf(
            // Every college, for the platform-admin screen; the method requires a PlatformAdmin proof.
            "platform-admin-listing" to mapOf("OrganisationRepository.kt" to 1),
            // Creating a college: there is no org id to bind yet. Requires a PlatformAdmin proof.
            "platform-admin-create" to mapOf("OrganisationRepository.kt" to 1),
            // The caller's own memberships, by the verified user id and nothing from the request:
            // GET /me/campus (student and staff), and the student's own membership that
            // POST /me/campus/leave resolves into a scope.
            // ...and, when accepting an invite, whether the caller is a joined student anywhere.
            "own-membership" to mapOf("MemberRepository.kt" to 2, "CampusAccess.kt" to 1, "InviteRepository.kt" to 1),
            // An invite found by the SHA-256 of its token. The token is the capability: 256 random
            // bits sent only to the invited mailbox. Everything after binds the invite's own org_id.
            "invite-token" to mapOf("InviteRepository.kt" to 1),
            // The invite email job: failing stale sends and claiming due ones across colleges. Each
            // claimed row's own org_id is then bound for every further statement on it.
            "invite-sender" to mapOf("InviteRepository.kt" to 2),
            // Deleting import previews past their one-day expiry, in every college.
            "import-purge" to mapOf("InviteRepository.kt" to 1),
            // Notification discovery: assignments inside their reminder window, the session a round
            // came from, and colleges with students, each across colleges. Every email written from
            // what they find binds that one college org_id.
            "notification-discovery" to mapOf("CampusNotificationRepository.kt" to 4),
            // Integrity signals (module 5): whether the caller's own session, bound by the verified
            // user id, was started from an assignment. Reads the attempt by session id only; no
            // college's data is returned.
            "own-session" to mapOf("IntegrityRepository.kt" to 2),
            // Usage and AI cost for every college, for the platform operator (module 11); the
            // method requires a PlatformAdmin proof, and each college's figures join on its own org_id.
            "platform-admin-usage" to mapOf("UsageRepository.kt" to 1),
            // Programme templates (module 10) are a global catalogue that belongs to no college: every
            // college reads the same list, and only a platform admin writes it (a PlatformAdmin proof).
            "programme-templates" to mapOf("ProgrammeRepository.kt" to 5),
        )

    /**
     * A shared select list, completed by every caller with `m.org_id = :orgId`. Checked as a
     * fragment: each use of it must itself bind the college (and does, as a separate string).
     */
    private val fragments =
        mapOf(
            "MemberRepository.kt" to listOf("MEMBER_SELECT"),
            "AssignmentRepository.kt" to listOf("ASSIGNMENT_SELECT"),
            "InviteRepository.kt" to listOf("INVITE_SELECT"),
        )

    private val source = File("src/main/kotlin/com/interviewos/api/campus")

    @Test
    fun `every statement on a campus table binds the caller's college`() {
        assertTrue(source.isDirectory, "Run from apps/api: ${source.absolutePath} is missing")
        val files = source.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        assertTrue(files.size >= 5, "Expected the campus package, found ${files.map { it.name }}")

        val problems = mutableListOf<String>()
        val markers = mutableMapOf<Pair<String, String>, Int>()
        var checked = 0
        for (file in files) {
            for (literal in stringLiterals(file.readText(), fragments[file.name].orEmpty())) {
                val sql = literal.lowercase()
                val usesFragment = fragments.values.flatten().any { literal.contains("\$$it") }
                if (!namesCampusTable(sql) && !usesFragment) continue
                if (!usesFragment && !looksLikeSql(sql)) continue
                checked++
                UNQUALIFIED.find(sql)?.let { problems += "${file.name}: refer to campus tables as public.<table>: ${it.value}" }
                val marker = MARKER.find(literal)?.groupValues?.get(1)
                if (marker != null) {
                    markers.merge(marker to file.name, 1, Int::plus)
                    continue
                }
                if (!bindsCollege(literal)) problems += "${file.name}: no org_id = :orgId in\n${literal.trim()}"
            }
        }

        assertTrue(checked >= 30, "Only $checked campus statements found; is the guard still reading the right literals?")
        val expectedMarkers = allowList.flatMap { (reason, files) -> files.map { (file, count) -> (reason to file) to count } }.toMap()
        for ((key, count) in markers) {
            val (reason, file) = key
            val allowed = expectedMarkers[key]
            if (allowed == null) {
                problems += "$file: unscoped marker '$reason' is not allow-listed for this file"
            } else if (count != allowed) {
                problems += "$file: '$reason' used $count times, the allow-list says $allowed"
            }
        }
        for (key in expectedMarkers.keys - markers.keys) {
            problems += "${key.second}: allow-listed '${key.first}' is no longer used there; remove it from the list"
        }
        if (problems.isNotEmpty()) fail(problems.joinToString("\n\n"))
    }

    @Test
    fun `the guard itself flags an unscoped query and accepts a scoped one`() {
        assertEquals(false, bindsCollege("select * from public.org_batches where id = :id"))
        assertEquals(false, bindsCollege("select * from public.org_batches b where b.org_id = :otherOrg and b.id = :id"))
        assertEquals(true, bindsCollege("select * from public.org_batches b where b.org_id = :orgId and b.id = :id"))
        assertEquals(true, bindsCollege("select status from public.organisations where id = :orgId"))
        assertEquals(false, bindsCollege("select * from public.org_members m where m.id = :orgId"))
        assertEquals(true, bindsCollege("insert into public.org_departments (org_id, code) values (:orgId, :code)"))
        assertEquals(false, bindsCollege("insert into public.org_departments (org_id, code) values (:other, :code)"))
        assertEquals(
            listOf("select 1 from public.org_members where org_id = :orgId", "plain \"quoted\" text"),
            stringLiterals(
                "val a = \"\"\"select 1 from public.org_members where org_id = :orgId\"\"\"\nval b = \"plain \\\"quoted\\\" text\"",
                emptyList(),
            ),
        )
    }

    private fun namesCampusTable(sql: String): Boolean = campusTables.any { Regex("\\b${Regex.escape(it)}\\b").containsMatchIn(sql) }

    private fun looksLikeSql(sql: String): Boolean = SQL_VERB.containsMatchIn(sql)

    private fun bindsCollege(literal: String): Boolean {
        if (ORG_ID_BOUND.containsMatchIn(literal) || ID_BOUND.containsMatchIn(literal)) return true
        return INSERT.containsMatchIn(literal) && literal.contains(":orgId")
    }

    /**
     * The string literals of a Kotlin file: raw `"""…"""` strings, then ordinary ones. Named
     * constants in [fragmentNames] are skipped; they are partial statements completed elsewhere.
     */
    private fun stringLiterals(
        text: String,
        fragmentNames: List<String>,
    ): List<String> {
        var rest = text
        for (name in fragmentNames) {
            rest = Regex("const val $name = \"\"\"[\\s\\S]*?\"\"\"").replace(rest, "")
        }
        val raw = RAW_STRING.findAll(rest).map { it.groupValues[1] }.toList()
        val withoutRaw = RAW_STRING.replace(rest, "")
        val plain = PLAIN_STRING.findAll(withoutRaw).map { it.groupValues[1].replace("\\\"", "\"") }.toList()
        return raw + plain
    }

    private companion object {
        val RAW_STRING = Regex("\"\"\"([\\s\\S]*?)\"\"\"")
        val PLAIN_STRING = Regex("\"((?:[^\"\\\\\\n]|\\\\.)*)\"")
        val SQL_VERB = Regex("\\b(select|insert|update|delete)\\b[\\s\\S]*\\b(from|into|set|public\\.)")
        val ORG_ID_BOUND = Regex("\\borg_id\\s*=\\s*:orgId\\b")
        val ID_BOUND = Regex("(^|[\\s(])(o\\.)?id\\s*=\\s*:orgId\\b")
        val INSERT = Regex("\\binsert\\s+into\\b", RegexOption.IGNORE_CASE)
        val MARKER = Regex("/\\*\\s*unscoped:\\s*([a-z-]+)\\s*\\*/")
        val UNQUALIFIED =
            Regex(
                "\\b(from|join|into|update)\\s+" +
                    "(organisations|org_departments|org_batches|org_members|org_faculty_scopes|org_audit_log" +
                    "|campus_imports|campus_import_rows|campus_invites|campus_staff_comments" +
                    "|programme_templates|programmes|programme_targets" +
                    "|assignments|assignment_targets|assignment_attempts)\\b",
            )
    }
}
