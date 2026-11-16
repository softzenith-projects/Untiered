package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.util.UUID
import kotlin.test.assertEquals

/** The student table's order and cursor, and the CSV's escaping, without a database. */
class ReadinessTableTest {
    @Test
    fun `a cell that starts like a formula is prefixed so a spreadsheet shows it as text`() {
        assertEquals("'=SUM(A1:A9)", ReadinessCsv.cell("=SUM(A1:A9)"))
        assertEquals("'+91 98765", ReadinessCsv.cell("+91 98765"))
        assertEquals("'-2+3", ReadinessCsv.cell("-2+3"))
        assertEquals("'@cmd", ReadinessCsv.cell("@cmd"))
        assertEquals("'\tx", ReadinessCsv.cell("\tx"))
        assertEquals("\"'\rx\"", ReadinessCsv.cell("\rx"))
        // Only the first character matters; ordinary text and numbers are untouched.
        assertEquals("Asha = top", ReadinessCsv.cell("Asha = top"))
        assertEquals("72", ReadinessCsv.cell("72"))
        assertEquals("", ReadinessCsv.cell(""))
    }

    @Test
    fun `commas, quotes and line breaks are quoted per RFC 4180, after the formula guard`() {
        assertEquals("\"Rao, Asha\"", ReadinessCsv.cell("Rao, Asha"))
        assertEquals("\"Asha \"\"AR\"\" Rao\"", ReadinessCsv.cell("Asha \"AR\" Rao"))
        assertEquals("\"line\nbreak\"", ReadinessCsv.cell("line\nbreak"))
        assertEquals("\"'=HYPERLINK(\"\"http://x\"\",\"\"y\"\")\"", ReadinessCsv.cell("=HYPERLINK(\"http://x\",\"y\")"))
    }

    @Test
    fun `the file starts with a BOM, has the contract's columns and shows not attempted rather than a blank`() {
        val bytes =
            ReadinessCsv.students(
                listOf(row("Asha", overall = null, band = "not_enough_evidence", coding = null, overdue = 1)),
            )

        assertEquals(listOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()), bytes.take(3))
        val lines = String(bytes.drop(3).toByteArray(), Charsets.UTF_8).split("\r\n")
        assertEquals(
            "Name,Roll number,Department,Batch,Overall,Band,Coding,Core CS,Technical interview,Communication,Aptitude," +
                "Completed,Overdue,Last active",
            lines[0],
        )
        assertEquals(
            "Asha,R-1,CSE,CSE 2027,,Not enough evidence,Not attempted,Not attempted,Not attempted,Not attempted,Not attempted,0,1,",
            lines[1],
        )
        assertEquals("", lines[2], "the last line ends with CRLF")
    }

    @Test
    fun `missing values sort last in both orders, and ties break by name then id`() {
        val a = row("asha", overall = 80)
        val b = row("Bilal", overall = null)
        val c = row("Chen", overall = 80)
        val d = row("Dev", overall = 40)

        fun sorted(descending: Boolean) =
            listOf(a, b, c, d)
                .sortedWith { x, y ->
                    ReadinessTableSort.comparator(descending).compare(
                        ReadinessTableSort.keyOf(ReadinessSortField.OVERALL, x),
                        ReadinessTableSort.keyOf(ReadinessSortField.OVERALL, y),
                    )
                }.map { it.name }

        assertEquals(listOf("Dev", "asha", "Chen", "Bilal"), sorted(descending = false))
        assertEquals(listOf("asha", "Chen", "Dev", "Bilal"), sorted(descending = true))
    }

    @Test
    fun `a cursor round-trips and refuses to continue under another sort or order`() {
        val key = ReadinessTableSort.keyOf(ReadinessSortField.NAME, row("Asha.Rao|x", overall = 50))
        val cursor = ReadinessTableSort.encodeCursor(ReadinessSortField.NAME, false, key)

        assertEquals(key, ReadinessTableSort.decodeCursor(cursor, ReadinessSortField.NAME, false))
        val overallKey = ReadinessTableSort.keyOf(ReadinessSortField.OVERALL, row("Asha", overall = null))
        assertEquals(
            overallKey,
            ReadinessTableSort.decodeCursor(
                ReadinessTableSort.encodeCursor(ReadinessSortField.OVERALL, true, overallKey),
                ReadinessSortField.OVERALL,
                true,
            ),
        )

        for ((value, sort, descending) in listOf(
            Triple(cursor, ReadinessSortField.NAME, true),
            Triple(cursor, ReadinessSortField.OVERALL, false),
            Triple("not-a-cursor", ReadinessSortField.NAME, false),
            Triple("", ReadinessSortField.NAME, false),
        )) {
            if (value.isEmpty()) {
                assertEquals(null, ReadinessTableSort.decodeCursor(value, sort, descending))
                continue
            }
            val error = assertThrows<ApiException> { ReadinessTableSort.decodeCursor(value, sort, descending) }
            assertEquals("invalid_cursor", error.code)
        }
    }

    private fun row(
        name: String?,
        overall: Int?,
        band: String = "interview_ready",
        coding: Int? = overall,
        overdue: Int = 0,
    ) = StudentReadinessRow(
        memberId = UUID.nameUUIDFromBytes((name ?: "none").toByteArray()),
        name = name,
        rollNumber = "R-1",
        batchName = "CSE 2027",
        departmentCode = "CSE",
        overall = overall,
        band = band,
        components = ComponentScores(coding, null, null, null, null),
        assignmentsCompleted = 0,
        assignmentsOverdue = overdue,
        lastActiveAt = null,
    )
}
