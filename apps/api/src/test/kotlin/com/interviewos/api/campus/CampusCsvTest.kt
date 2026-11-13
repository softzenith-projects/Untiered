package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** The student CSV parser (contract "CSV format"). Anything ambiguous is `400 csv_invalid`. */
class CampusCsvTest {
    private val header = "name,email,roll_number,department,batch,graduation_year"

    private fun students(text: String) = CampusCsv.parseStudents(text.toByteArray(Charsets.UTF_8))

    private fun assertInvalid(bytes: ByteArray) {
        val error = assertThrows<ApiException> { CampusCsv.parseStudents(bytes) }
        assertEquals("csv_invalid", error.code)
    }

    private fun assertInvalid(text: String) = assertInvalid(text.toByteArray(Charsets.UTF_8))

    @Test
    fun `reads a plain file, trimming cells and leaving blanks null`() {
        val rows = students("$header\nAsha Rao, asha@college.edu ,21CS001,CSE,CSE 2027,2027\nRavi,ravi@college.edu,,,CSE 2027,\n")

        assertEquals(2, rows.size)
        assertEquals(CsvStudentRow(1, "Asha Rao", "asha@college.edu", "21CS001", "CSE", "CSE 2027", "2027"), rows[0])
        assertEquals(CsvStudentRow(2, "Ravi", "ravi@college.edu", null, null, "CSE 2027", null), rows[1])
    }

    @Test
    fun `quoted fields hold commas, newlines and escaped quotes`() {
        val rows = students("$header\n\"Rao, Asha \"\"A\"\"\",asha@college.edu,1,CSE,\"CSE\n2027\",2027")

        assertEquals("Rao, Asha \"A\"", rows.single().name)
        assertEquals("CSE\n2027", rows.single().batch)
    }

    @Test
    fun `a UTF-8 byte-order mark and Excel's CRLF are understood`() {
        val bom = byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte())
        val body = "Name,Email,Roll_Number,Department,Batch,Graduation_Year\r\nÅsa Ñúñez,asa@college.edu,7,ECE,ECE 2027,2027\r\n"
        val rows = CampusCsv.parseStudents(bom + body.toByteArray(Charsets.UTF_8))

        assertEquals("Åsa Ñúñez", rows.single().name)
        assertEquals("2027", rows.single().graduationYear)
    }

    @Test
    fun `semicolons are the delimiter when the header uses them`() {
        val rows = students("name;email;roll_number;department;batch;graduation_year\n\"Rao; Asha\";a@c.edu;1;CSE;CSE 2027;2027\n")

        assertEquals("Rao; Asha", rows.single().name)
        assertEquals("CSE 2027", rows.single().batch)
    }

    @Test
    fun `header matching ignores case, spaces and column order, and extra columns`() {
        val rows = students(" Batch ,EMAIL,notes,Full Name,Roll No,graduation-year\nCSE 2027,a@c.edu,hi,Asha,9,2027\n")

        assertEquals(CsvStudentRow(1, "Asha", "a@c.edu", "9", null, "CSE 2027", "2027"), rows.single())
    }

    @Test
    fun `blank lines are skipped but still counted, so row numbers match the sheet`() {
        val rows = students("$header\n\n,,,,,\nAsha,a@c.edu,1,CSE,CSE 2027,2027\n")

        assertEquals(3, rows.single().rowNumber)
    }

    @Test
    fun `a missing required column, a repeated one, or no students is refused`() {
        assertInvalid("name,roll_number,batch\nAsha,1,CSE 2027\n")
        assertInvalid("name,email,email,batch\nAsha,a@c.edu,b@c.edu,X\n")
        assertInvalid("$header\n")
        assertInvalid("")
    }

    @Test
    fun `broken quoting and non-UTF-8 bytes are refused`() {
        assertInvalid("$header\n\"Asha,a@c.edu,1,CSE,CSE 2027,2027\n")
        assertInvalid("$header\n\"Asha\"x,a@c.edu,1,CSE,CSE 2027,2027\n")
        assertInvalid("$header\nAsha,a@c.edu,1,CSE,CSE 2027,2027\n".toByteArray(Charsets.UTF_8) + byteArrayOf(0xC3.toByte(), 0x28))
    }

    @Test
    fun `over 1 MB or over 5000 students is refused, and 5000 exactly is fine`() {
        val row = "Asha,a@c.edu,1,CSE,CSE 2027,2027\n"
        assertEquals(5_000, students(header + "\n" + row.repeat(5_000)).size)
        assertInvalid(header + "\n" + row.repeat(5_001))
        assertInvalid(ByteArray(CampusCsv.MAX_BYTES + 1) { 'a'.code.toByte() })
    }

    @Test
    fun `an over-long name or roll number is refused rather than cut`() {
        assertInvalid("$header\n${"a".repeat(201)},a@c.edu,1,CSE,CSE 2027,2027\n")
        assertInvalid("$header\nAsha,a@c.edu,${"1".repeat(41)},CSE,CSE 2027,2027\n")
    }

    @Test
    fun `a row shorter than the header leaves the missing cells null`() {
        val rows = students("$header\nAsha,a@c.edu\n")

        assertNull(rows.single().batch)
        assertNull(rows.single().graduationYear)
    }
}
