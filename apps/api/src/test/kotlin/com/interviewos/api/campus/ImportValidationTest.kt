package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Every `ImportProblem`, against one college's context only. */
class ImportValidationTest {
    private val cse2027 = ImportBatch(UUID.randomUUID(), "CSE 2027", "CSE", 2027)
    private val ece2027 = ImportBatch(UUID.randomUUID(), "ECE 2027", "ECE", 2027)
    private val context =
        ImportContext(
            departmentCodes = setOf("CSE", "ECE"),
            batches = listOf(cse2027, ece2027),
            memberEmails = setOf("member@college.edu"),
            invitedEmails = setOf("invited@college.edu"),
            takenRollNumbers = setOf("21CS999"),
        )

    private fun row(
        n: Int = 1,
        name: String? = "Asha",
        email: String? = "asha$n@college.edu",
        roll: String? = "21CS00$n",
        department: String? = "CSE",
        batch: String? = "CSE 2027",
        year: String? = "2027",
    ) = CsvStudentRow(n, name, email, roll, department, batch, year)

    private fun problems(vararg rows: CsvStudentRow) =
        ImportValidation.validate(rows.toList(), context).map { it.problems.map { p -> p.code } }

    @Test
    fun `a clean row has no problems and resolves its batch`() {
        val result = ImportValidation.validate(listOf(row(email = " Asha1@College.EDU ", department = "cse")), context).single()

        assertEquals(emptyList(), result.problems)
        assertEquals("asha1@college.edu", result.email)
        assertEquals("CSE", result.departmentCode)
        assertEquals(cse2027.id, result.batchId)
        assertEquals(2027, result.graduationYear)
    }

    @Test
    fun `missing name and bad email`() {
        assertEquals(listOf(listOf("missing_name")), problems(row(name = null)))
        assertEquals(listOf(listOf("bad_email")), problems(row(email = "not-an-email")))
        assertEquals(listOf(listOf("bad_email")), problems(row(email = null)))
    }

    @Test
    fun `every copy of a duplicated email or roll number is flagged`() {
        val result = problems(row(1, email = "same@college.edu"), row(2, email = "SAME@college.edu"), row(3))
        assertEquals(listOf(listOf("duplicate_email_in_file"), listOf("duplicate_email_in_file"), emptyList()), result)

        val rolls = problems(row(1, roll = "R1"), row(2, roll = "R1"))
        assertEquals(listOf(listOf("duplicate_roll_in_file"), listOf("duplicate_roll_in_file")), rolls)
    }

    @Test
    fun `department and batch must be this college's, and agree with each other`() {
        assertEquals(listOf(listOf("unknown_department")), problems(row(department = "MECH")))
        assertEquals(listOf(listOf("unknown_batch")), problems(row(batch = "MECH 2027")))
        assertEquals(listOf(listOf("unknown_batch")), problems(row(batch = null)))
        assertEquals(listOf(listOf("batch_department_mismatch")), problems(row(department = "ECE")))
        // No department column at all is fine: the batch names it.
        assertEquals(listOf(emptyList()), problems(row(department = null)))
        // Batch names match case-insensitively.
        assertEquals(listOf(emptyList()), problems(row(batch = "cse 2027")))
    }

    @Test
    fun `graduation year must match the batch, and be a number`() {
        assertEquals(listOf(listOf("graduation_year_mismatch")), problems(row(year = "2028")))
        assertEquals(listOf(listOf("graduation_year_mismatch")), problems(row(year = "twenty")))
        assertEquals(listOf(emptyList()), problems(row(year = null)))
    }

    @Test
    fun `already a member, already invited, or roll number taken in this college`() {
        assertEquals(listOf(listOf("already_member")), problems(row(email = "Member@college.edu")))
        assertEquals(listOf(listOf("already_invited")), problems(row(email = "invited@college.edu")))
        assertEquals(listOf(listOf("roll_number_taken")), problems(row(roll = "21CS999")))
    }

    @Test
    fun `lookup keys are the normalised emails and the roll numbers, nothing more`() {
        val (emails, rolls) = ImportValidation.lookupKeys(listOf(row(1, email = " A@B.co "), row(2, email = "junk", roll = null)))

        assertEquals(setOf("a@b.co"), emails)
        assertEquals(setOf("21CS001"), rolls)
    }

    @Test
    fun `no problem code can say whether an email has an account or another college`() {
        val codes = ImportProblem.entries.map { it.code }
        assertTrue(codes.none { "account" in it || "other" in it || "elsewhere" in it || "exists" in it }, codes.toString())
        assertEquals(11, codes.size)
    }
}
