package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.sources.AdminProperties
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.dao.DataAccessException
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import tools.jackson.databind.json.JsonMapper
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Tenant isolation against real Postgres with every migration applied (campus plan §2, step 7).
 * A failure here is a merge blocker: it means one college can read or change another's data.
 *
 * Two colleges, A and B, are created through the platform-admin service and given structure
 * through the college service; memberships are seeded by SQL because inviting people is
 * module 3. Every assertion goes through the same services and repositories the API uses.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusIsolationDatabaseIntegrationTest {
    private val dataSource =
        DriverManagerDataSource(
            System.getenv("TEST_DB_URL"),
            System.getenv("TEST_DB_USER") ?: "postgres",
            System.getenv("TEST_DB_PASSWORD") ?: "postgres",
        )
    private val jdbc = JdbcClient.create(dataSource)

    private val operator = person()
    private val adminA = person()
    private val tpoA = person()
    private val facultyA = person()
    private val studentX = person()
    private val studentY = person()
    private val adminB = person()
    private val studentB = person()
    private val outsider = person()
    private val everyone = listOf(operator, adminA, tpoA, facultyA, studentX, studentY, adminB, studentB, outsider)

    private val adminProperties = AdminProperties(emails = listOf(operator.email), userIds = listOf(operator.id.toString()))
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), UserRepository(jdbc))
    private val orgs = OrganisationRepository(jdbc)
    private val structure = StructureRepository(jdbc)
    private val members = MemberRepository(jdbc)
    private val audit = CampusAudit(jdbc, JsonMapper.builder().build())
    private val logos = OrgLogos(StorageProperties())
    private val college = CampusOrgService(access, orgs, structure, members, audit, logos)
    private val platform = CampusAdminService(access, orgs, audit, logos, NoStorage, DataSourceTransactionManager(dataSource))
    private val me = MeCampusService(access, members, audit, logos)

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var departmentA: DepartmentView
    private lateinit var departmentA2: DepartmentView
    private lateinit var batchX: BatchView
    private lateinit var batchY: BatchView
    private lateinit var departmentB: DepartmentView
    private lateinit var batchB: BatchView
    private lateinit var memberAdminA: UUID
    private lateinit var memberTpoA: UUID
    private lateinit var memberFacultyA: UUID
    private lateinit var memberStudentX: UUID
    private lateinit var memberStudentY: UUID
    private lateinit var memberAdminB: UUID
    private lateinit var memberStudentB: UUID

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "college-a-$suffix")).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "college-b-$suffix")).id

        memberAdminA = seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        memberAdminB = seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)

        departmentA = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        departmentA2 = college.createDepartment(adminA, orgA, CreateDepartmentRequest("ECE", "Electronics"))
        batchX = college.createBatch(adminA, orgA, CreateBatchRequest(departmentA.id, 2027, "CSE 2027"))
        batchY = college.createBatch(adminA, orgA, CreateBatchRequest(departmentA2.id, 2027, "ECE 2027"))
        // Same code and name in B: unique per college, not globally.
        departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))

        memberTpoA = seedMember(orgA, tpoA, CampusRole.TPO)
        memberFacultyA = seedMember(orgA, facultyA, CampusRole.FACULTY)
        memberStudentX = seedMember(orgA, studentX, CampusRole.STUDENT, batchX.id, "A-001")
        memberStudentY = seedMember(orgA, studentY, CampusRole.STUDENT, batchY.id, "A-002")
        memberStudentB = seedMember(orgB, studentB, CampusRole.STUDENT, batchB.id, "A-001")
    }

    @AfterEach
    fun cleanUp() {
        for (org in listOfNotNull(if (::orgA.isInitialized) orgA else null, if (::orgB.isInitialized) orgB else null)) {
            jdbc.sql("delete from public.organisations where id = :id").param("id", org).update()
        }
        for (person in everyone) {
            jdbc.sql("delete from auth.users where id = :id").param("id", person.id).update()
        }
    }

    @Test
    fun `lists in college A never contain a row of college B`() {
        val departments = college.departments(adminA, orgA).map { it.id }.toSet()
        assertEquals(setOf(departmentA.id, departmentA2.id), departments)

        val batches = college.batches(adminA, orgA, null).map { it.id }.toSet()
        assertEquals(setOf(batchX.id, batchY.id), batches)
        // Filtering A's batches by B's department finds nothing rather than B's batch.
        assertEquals(emptyList(), college.batches(adminA, orgA, departmentB.id))

        val listed = allMembers(adminA, orgA).map { it.id }.toSet()
        assertEquals(setOf(memberAdminA, memberTpoA, memberFacultyA, memberStudentX, memberStudentY), listed)
        // B's student has A's roll number "A-001" and the same batch name; still not found from A.
        assertEquals(listOf(memberStudentX), allMembers(adminA, orgA, q = "A-001").map { it.id })
        assertEquals(emptyList(), allMembers(adminA, orgA, batchId = batchB.id))
        assertEquals(emptyList(), allMembers(adminA, orgA, departmentId = departmentB.id))

        val auditA = auditIds(adminA, orgA)
        val auditB = auditIds(adminB, orgB)
        assertTrue(auditA.isNotEmpty() && auditB.isNotEmpty())
        assertEquals(emptySet(), auditA intersect auditB)
        assertEquals(auditA, dbAuditIds(orgA))
        assertEquals(auditB, dbAuditIds(orgB))

        assertEquals(1, college.batches(adminA, orgA, departmentA.id).single().studentCount)
    }

    @Test
    fun `an id of college B under college A is not found, for every kind of resource`() {
        assertNotFound { college.updateDepartment(adminA, orgA, departmentB.id, UpdateDepartmentRequest(name = "Taken")) }
        assertNotFound { college.deleteDepartment(adminA, orgA, departmentB.id) }
        assertNotFound { college.createBatch(adminA, orgA, CreateBatchRequest(departmentB.id, 2028, "Sneaky")) }
        assertNotFound { college.updateBatch(adminA, orgA, batchB.id, UpdateBatchRequest(name = "Taken")) }
        assertNotFound { college.deleteBatch(adminA, orgA, batchB.id) }
        assertNotFound { college.updateMember(adminA, orgA, memberStudentB, UpdateMemberRequest(rollNumber = "X")) }
        assertNotFound { college.removeMember(adminA, orgA, memberStudentB) }
        assertNotFound { college.removeMember(adminA, orgA, memberAdminB) }
        assertNotFound { college.changeRole(adminA, orgA, memberAdminB, ChangeRoleRequest("tpo")) }
        assertNotFound { college.facultyScopes(adminA, orgA, memberAdminB) }
        // A's own student, moved into B's batch.
        assertNotFound { college.updateMember(adminA, orgA, memberStudentX, UpdateMemberRequest(batchId = batchB.id)) }
        // A's own faculty member, scoped to B's batch or department.
        assertNotFound { college.replaceFacultyScopes(adminA, orgA, memberFacultyA, FacultyScopesView(batchIds = listOf(batchB.id))) }
        assertNotFound {
            college.replaceFacultyScopes(adminA, orgA, memberFacultyA, FacultyScopesView(departmentIds = listOf(departmentB.id)))
        }

        // Nothing of B's moved.
        assertEquals("Computer Science", structure.findDepartment(scopeOf(adminB, orgB), departmentB.id)?.name)
        assertEquals("CSE 2027", structure.findBatch(scopeOf(adminB, orgB), batchB.id)?.name)
        assertEquals(2, college.members(adminB, orgB, null, null, null, null, null).items.size)
        assertEquals(memberStudentB, members.find(scopeOf(adminB, orgB), memberStudentB)?.view?.id)
        assertEquals(batchX.id, members.find(scopeOf(adminA, orgA), memberStudentX)?.view?.batchId)
        assertEquals(FacultyScopesView(), members.facultyScopes(scopeOf(adminA, orgA), memberFacultyA))
    }

    @Test
    fun `the gate refuses everyone who is not staff of that college`() {
        assertNotFound { college.org(adminA, orgB) }
        assertNotFound { college.departments(adminA, orgB) }
        assertNotFound { college.members(adminB, orgA, null, null, null, null, null) }
        // A student membership is not enough for a college route.
        assertNotFound { college.org(studentX, orgA) }
        assertNotFound { college.org(outsider, orgA) }
        assertNotFound { college.org(adminA, UUID.randomUUID()) }
        // Platform-admin routes are the allow-list only, whoever else asks.
        assertNotFound { platform.get(adminA, orgA) }
        assertNotFound { platform.list(adminA) }

        assertEquals(orgA, college.org(adminA, orgA).id)
    }

    @Test
    fun `a platform admin may read any college, and the read is on that college's log`() {
        val before = dbAuditIds(orgB)
        assertEquals(orgB, college.org(operator, orgB).id)
        college.members(operator, orgB, null, null, null, null, null)

        val entries =
            jdbc
                .sql(
                    "select action, actor_kind, actor_user_id from public.org_audit_log where org_id = :org and id not in (:before) order by id",
                ).param("org", orgB)
                .param("before", before.toList())
                .query { rs, _ -> Triple(rs.getString(1), rs.getString(2), UUID.fromString(rs.getString(3))) }
                .list()
        assertEquals(
            listOf(
                Triple("org.viewed", "platform_admin", operator.id),
                Triple("members.viewed", "platform_admin", operator.id),
            ),
            entries,
        )
        // Nothing of B's reading landed on A's log.
        assertEquals(0, countAudit(orgA, "members.viewed"))
    }

    @Test
    fun `composite keys refuse a row of one college pointing at another's`() {
        assertThrows<DataAccessException> {
            jdbc
                .sql("insert into public.org_batches (org_id, department_id, graduation_year, name) values (:a, :d, 2027, 'Cross')")
                .param("a", orgA)
                .param("d", departmentB.id)
                .update()
        }
        assertThrows<DataAccessException> {
            jdbc
                .sql("insert into public.org_faculty_scopes (org_id, member_id, batch_id) values (:a, :m, :b)")
                .param("a", orgA)
                .param("m", memberFacultyA)
                .param("b", batchB.id)
                .update()
        }
        assertThrows<DataAccessException> {
            jdbc
                .sql("insert into public.org_faculty_scopes (org_id, member_id, department_id) values (:a, :m, :d)")
                .param("a", orgA)
                .param("m", memberFacultyA)
                .param("d", departmentB.id)
                .update()
        }
        // A's scope row naming B's faculty membership is refused too.
        assertThrows<DataAccessException> {
            jdbc
                .sql("insert into public.org_faculty_scopes (org_id, member_id, batch_id) values (:a, :m, :b)")
                .param("a", orgA)
                .param("m", memberAdminB)
                .param("b", batchX.id)
                .update()
        }
        assertThrows<DataAccessException> {
            jdbc
                .sql(
                    """
                    update public.org_members set batch_id = :b where id = :m
                    """.trimIndent(),
                ).param("b", batchB.id)
                .param("m", memberStudentX)
                .update()
        }
    }

    @Test
    fun `faculty scoped to batch X see X's students and nothing of batch Y`() {
        college.replaceFacultyScopes(adminA, orgA, memberFacultyA, FacultyScopesView(batchIds = listOf(batchX.id)))

        assertEquals(listOf(memberStudentX), allMembers(facultyA, orgA).map { it.id })
        assertEquals(emptyList(), allMembers(facultyA, orgA, batchId = batchY.id))
        assertEquals(emptyList(), allMembers(facultyA, orgA, role = "tpo"))
        assertEquals(listOf(batchX.id), college.batches(facultyA, orgA, null).map { it.id })
        assertEquals(listOf(departmentA.id), college.departments(facultyA, orgA).map { it.id })
        val facultyScope = access.resolve(facultyA, orgA)
        assertEquals(null, members.find(facultyScope, memberStudentY))
        assertEquals(null, members.find(facultyScope, memberTpoA))
        assertEquals(null, structure.findBatch(facultyScope, batchY.id))
        assertEquals(null, structure.findDepartment(facultyScope, departmentA2.id))

        // A department scope reaches every batch in it, including one created later.
        college.replaceFacultyScopes(adminA, orgA, memberFacultyA, FacultyScopesView(departmentIds = listOf(departmentA2.id)))
        val later = college.createBatch(tpoA, orgA, CreateBatchRequest(departmentA2.id, 2028, "ECE 2028"))
        assertEquals(setOf(batchY.id, later.id), college.batches(facultyA, orgA, null).map { it.id }.toSet())
        assertEquals(listOf(memberStudentY), allMembers(facultyA, orgA).map { it.id })

        // Unscoped faculty see nothing at all.
        college.replaceFacultyScopes(adminA, orgA, memberFacultyA, FacultyScopesView())
        assertEquals(emptyList(), allMembers(facultyA, orgA))
        assertEquals(emptyList(), college.batches(facultyA, orgA, null))
        assertEquals(emptyList(), college.departments(facultyA, orgA))

        // And faculty cannot change structure or membership.
        assertForbidden { college.createDepartment(facultyA, orgA, CreateDepartmentRequest("ME", "Mechanical")) }
        assertForbidden { college.removeMember(facultyA, orgA, memberStudentX) }
    }

    @Test
    fun `staff changes keep at least one college admin`() {
        val error = assertThrows<ApiException> { college.changeRole(adminA, orgA, memberAdminA, ChangeRoleRequest("tpo")) }
        assertEquals("last_admin", error.code)

        college.changeRole(adminA, orgA, memberTpoA, ChangeRoleRequest("college_admin"))
        college.changeRole(adminA, orgA, memberAdminA, ChangeRoleRequest("faculty"))
        assertEquals("faculty", members.find(scopeOf(tpoA, orgA), memberAdminA)?.view?.role)
        assertEquals("last_admin", assertThrows<ApiException> { college.removeMember(operator, orgA, memberTpoA) }.code)
    }

    @Test
    fun `a suspended college disappears for its members but not for the platform admin`() {
        platform.update(operator, orgA, AdminUpdateOrgRequest(status = "suspended"))

        assertNotFound { college.org(adminA, orgA) }
        assertEquals(null, me.me(studentX).student)
        assertEquals(emptyList(), me.me(adminA).staff)
        assertEquals("suspended", college.org(operator, orgA).status)
        // B is untouched.
        assertEquals("active", college.org(adminB, orgB).status)
        assertEquals(orgB, me.me(studentB).student?.orgId)
    }

    @Test
    fun `a student leaves their own college and nothing else`() {
        me.leave(studentX)

        assertEquals(null, me.me(studentX).student)
        assertEquals(null, members.find(scopeOf(adminA, orgA), memberStudentX))
        assertEquals(memberStudentB, members.find(scopeOf(adminB, orgB), memberStudentB)?.view?.id)
        assertNotFound { me.leave(studentX) }
        assertEquals(1, countAudit(orgA, "member.left"))
        assertEquals(0, countAudit(orgB, "member.left"))
    }

    @Test
    fun `the audit log is append-only, yet account and college deletion still work`() {
        val entry = dbAuditIds(orgA).first()
        assertThrows<DataAccessException> {
            jdbc.sql("update public.org_audit_log set action = 'org.tampered' where id = :id").param("id", entry).update()
        }
        assertThrows<DataAccessException> {
            jdbc.sql("delete from public.org_audit_log where id = :id").param("id", entry).update()
        }

        // Deleting an actor's account (what AccountDeletion does) nulls their id in the log
        // and removes their memberships.
        jdbc.sql("delete from public.users where id = :id").param("id", adminA.id).update()
        val actors =
            jdbc
                .sql("select count(*) from public.org_audit_log where org_id = :org and actor_user_id = :u")
                .param("org", orgA)
                .param("u", adminA.id)
                .query(Long::class.java)
                .single()
        assertEquals(0L, actors)
        assertTrue(countAudit(orgA, "department.created") >= 2)
        assertEquals(0L, count("select count(*) from public.org_members where user_id = :id", adminA.id))

        // Deleting a college cascades through structure, members and its log.
        jdbc.sql("delete from public.organisations where id = :id").param("id", orgA).update()
        assertEquals(0L, count("select count(*) from public.org_audit_log where org_id = :id", orgA))
        assertEquals(0L, count("select count(*) from public.org_batches where org_id = :id", orgA))
        assertTrue(dbAuditIds(orgB).isNotEmpty())
    }

    @Test
    fun `structure deletion is refused while it is in use`() {
        assertEquals(
            "department_has_batches",
            assertThrows<ApiException> { college.deleteDepartment(adminA, orgA, departmentA.id) }.code,
        )
        assertEquals("batch_has_members", assertThrows<ApiException> { college.deleteBatch(adminA, orgA, batchX.id) }.code)
        assertEquals(
            "department_code_taken",
            assertThrows<ApiException> { college.createDepartment(tpoA, orgA, CreateDepartmentRequest("cse", "Again")) }.code,
        )
        assertEquals(
            "roll_number_taken",
            assertThrows<ApiException> {
                college.updateMember(tpoA, orgA, memberStudentY, UpdateMemberRequest(rollNumber = "A-001"))
            }.code,
        )
        val empty = college.createBatch(tpoA, orgA, CreateBatchRequest(departmentA.id, 2029, "CSE 2029"))
        college.deleteBatch(tpoA, orgA, empty.id)
        assertEquals(null, structure.findBatch(scopeOf(adminA, orgA), empty.id))
    }

    // -- helpers -----------------------------------------------------------------

    private fun allMembers(
        who: SupabaseIdentity,
        org: UUID,
        role: String? = null,
        batchId: UUID? = null,
        departmentId: UUID? = null,
        q: String? = null,
    ): List<MemberView> {
        val items = mutableListOf<MemberView>()
        var cursor: String? = null
        do {
            val page = college.members(who, org, role, batchId, departmentId, q, cursor)
            items += page.items
            cursor = page.nextCursor
        } while (cursor != null)
        return items
    }

    private fun auditIds(
        who: SupabaseIdentity,
        org: UUID,
    ): Set<Long> =
        college
            .auditLog(who, org, null)
            .items
            .map { it.id }
            .toSet()

    private fun dbAuditIds(org: UUID): Set<Long> =
        jdbc
            .sql("select id from public.org_audit_log where org_id = :org")
            .param("org", org)
            .query(Long::class.java)
            .list()
            .filterNotNull()
            .toSet()

    private fun countAudit(
        org: UUID,
        action: String,
    ): Int =
        jdbc
            .sql("select count(*) from public.org_audit_log where org_id = :org and action = :action")
            .param("org", org)
            .param("action", action)
            .query(Int::class.java)
            .single()

    private fun count(
        sql: String,
        id: UUID,
    ): Long =
        jdbc
            .sql(sql)
            .param("id", id)
            .query(Long::class.java)
            .single()

    private fun scopeOf(
        who: SupabaseIdentity,
        org: UUID,
    ): OrgScope = access.resolve(who, org)

    private fun assertNotFound(block: () -> Unit) {
        val error = assertThrows<ApiException> { block() }
        assertEquals(HttpStatus.NOT_FOUND, error.status, error.message)
    }

    private fun assertForbidden(block: () -> Unit) {
        val error = assertThrows<ApiException> { block() }
        assertEquals(HttpStatus.FORBIDDEN, error.status, error.message)
        assertEquals("campus_forbidden", error.code)
    }

    private fun seedMember(
        org: UUID,
        who: SupabaseIdentity,
        role: CampusRole,
        batchId: UUID? = null,
        rollNumber: String? = null,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.org_members (org_id, user_id, role, batch_id, roll_number, consent_version, consented_at)
                values (:org, :user, :role, :batch, :roll, :consent, case when :student then now() end)
                returning id
                """.trimIndent(),
            ).param("org", org)
            .param("user", who.id)
            .param("role", role.dbValue)
            .param("batch", batchId)
            .param("roll", rollNumber)
            .param("consent", if (role == CampusRole.STUDENT) "test-v1" else null)
            .param("student", role == CampusRole.STUDENT)
            .query(UUID::class.java)
            .single()

    private fun createUser(who: SupabaseIdentity) {
        jdbc
            .sql(
                """
                insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
                values (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '', now(), now(), now())
                """.trimIndent(),
            ).param("id", who.id)
            .param("email", who.email)
            .update()
        jdbc
            .sql("insert into public.users (id, email) values (:id, :email) on conflict (id) do nothing")
            .param("id", who.id)
            .param("email", who.email)
            .update()
    }

    private companion object {
        fun person(): SupabaseIdentity {
            val id = UUID.randomUUID()
            return SupabaseIdentity(id, "campus-db-test-$id@example.invalid", null)
        }
    }

    /** Logos are not exercised here; nothing may reach a real storage service from a test. */
    private object NoStorage : ObjectStorage {
        override fun upload(
            bucket: String,
            path: String,
            bytes: ByteArray,
            contentType: String,
        ) = error("not used")

        override fun download(
            bucket: String,
            path: String,
        ): ByteArray = error("not used")

        override fun createSignedUrl(
            bucket: String,
            path: String,
            expiresInSeconds: Int,
        ): String = error("not used")

        override fun deleteByPrefix(
            bucket: String,
            prefix: String,
        ) = error("not used")
    }
}
