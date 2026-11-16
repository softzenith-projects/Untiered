package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.util.Base64
import java.util.Locale
import java.util.UUID

/** Contract `ReadinessSort`. */
enum class ReadinessSortField(
    val wireValue: String,
) {
    NAME("name"),
    OVERALL("overall"),
    LAST_ACTIVE("last_active"),
    OVERDUE("overdue"),
    ;

    companion object {
        fun fromWireValue(value: String): ReadinessSortField? = entries.firstOrNull { it.wireValue == value }
    }
}

/**
 * Where a row sits in the sorted table: the sorted-on value, then the name, then the member id,
 * so two students never tie and a page boundary is never ambiguous.
 */
data class ReadinessRowKey(
    /** A lower-cased name for `name`, a number for the others; null sorts last either way. */
    val primary: Comparable<*>?,
    val name: String?,
    val memberId: UUID,
)

/**
 * Sorting and keyset paging for the student readiness table. The table is computed in memory
 * for the whole scope (readiness is derived, not a column to `order by`), so the cursor is the
 * last row's key: the next page is every row after it, which stays correct when a student
 * joins or a score changes between pages, where an offset would skip or repeat someone.
 */
object ReadinessTableSort {
    private val encoder = Base64.getUrlEncoder().withoutPadding()
    private val decoder = Base64.getUrlDecoder()
    private const val VERSION = "r1"
    private const val NULL = "~"

    fun keyOf(
        sort: ReadinessSortField,
        row: StudentReadinessRow,
    ): ReadinessRowKey {
        val name = row.name?.lowercase(Locale.ROOT)
        val primary: Comparable<*>? =
            when (sort) {
                ReadinessSortField.NAME -> name
                ReadinessSortField.OVERALL -> row.overall?.toLong()
                ReadinessSortField.LAST_ACTIVE -> row.lastActiveAt?.let { Instant.parse(it).toEpochMilli() }
                ReadinessSortField.OVERDUE -> row.assignmentsOverdue.toLong()
            }
        return ReadinessRowKey(primary, name, row.memberId)
    }

    /** [descending] flips the sorted-on value only; missing values stay last, and ties stay A–Z. */
    fun comparator(descending: Boolean): Comparator<ReadinessRowKey> =
        Comparator { a, b ->
            val primary = nullsLast(a.primary, b.primary, descending)
            if (primary != 0) return@Comparator primary
            val name = nullsLast(a.name, b.name, descending = false)
            if (name != 0) return@Comparator name
            a.memberId.compareTo(b.memberId)
        }

    fun encodeCursor(
        sort: ReadinessSortField,
        descending: Boolean,
        key: ReadinessRowKey,
    ): String =
        listOf(VERSION, sort.wireValue, if (descending) "desc" else "asc", key.primary?.toString(), key.name, key.memberId.toString())
            .joinToString(".") { part -> if (part == null) NULL else encoder.encodeToString(part.toByteArray()) }

    /**
     * The key a cursor stands for. A cursor this server did not issue, or one issued for another
     * sort or order, is `400 invalid_cursor`: continuing it under a different order would page
     * through the wrong rows.
     */
    fun decodeCursor(
        value: String?,
        sort: ReadinessSortField,
        descending: Boolean,
    ): ReadinessRowKey? {
        val raw = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        try {
            val parts = raw.split('.').map { if (it == NULL) null else String(decoder.decode(it)) }
            if (parts.size != 6 || parts[0] != VERSION) throw badCursor()
            if (parts[1] != sort.wireValue || parts[2] != (if (descending) "desc" else "asc")) throw badCursor()
            val primary: Comparable<*>? =
                parts[3]?.let { if (sort == ReadinessSortField.NAME) it else it.toLongOrNull() ?: throw badCursor() }
            val memberId = UUID.fromString(parts[5] ?: throw badCursor())
            return ReadinessRowKey(primary, parts[4], memberId)
        } catch (e: IllegalArgumentException) {
            throw badCursor()
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun nullsLast(
        a: Comparable<*>?,
        b: Comparable<*>?,
        descending: Boolean,
    ): Int {
        if (a == null && b == null) return 0
        if (a == null) return 1
        if (b == null) return -1
        val order = (a as Comparable<Any>).compareTo(b)
        return if (descending) -order else order
    }

    private fun badCursor() = ApiException.badRequest("That cursor is not one this list gave out.", code = "invalid_cursor")
}

/**
 * The student readiness CSV (contract "Module 7", exports): UTF-8 with a BOM so Excel reads names
 * in any script, RFC 4180 quoting, CRLF line ends.
 *
 * Every cell is guarded against formula injection: a cell that begins with `=`, `+`, `-`, `@`,
 * a tab or a carriage return is prefixed with `'`, so a student named `=HYPERLINK(…)` is shown
 * as text, not run, when a TPO opens the file. A component with no evidence says "Not attempted"
 * rather than leaving a blank someone could read as 0.
 */
object ReadinessCsv {
    val HEADER =
        listOf(
            "Name",
            "Roll number",
            "Department",
            "Batch",
            "Overall",
            "Band",
            "Coding",
            "Core CS",
            "Technical interview",
            "Communication",
            "Aptitude",
            "Completed",
            "Overdue",
            "Last active",
        )

    private val BOM = byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte())
    private const val NOT_ATTEMPTED = "Not attempted"

    private val BAND_LABELS =
        mapOf(
            ReadinessBand.STRONG.wireValue to "Strong",
            ReadinessBand.INTERVIEW_READY.wireValue to "Interview-ready",
            ReadinessBand.NEEDS_IMPROVEMENT.wireValue to "Needs improvement",
            ReadinessBand.NEEDS_STRUCTURED_PREP.wireValue to "Needs structured prep",
            ReadinessBand.NOT_ENOUGH_EVIDENCE.wireValue to "Not enough evidence",
        )

    fun students(rows: List<StudentReadinessRow>): ByteArray {
        val text = StringBuilder()
        text.append(line(HEADER))
        for (row in rows) {
            text.append(
                line(
                    listOf(
                        row.name.orEmpty(),
                        row.rollNumber.orEmpty(),
                        row.departmentCode,
                        row.batchName,
                        row.overall?.toString().orEmpty(),
                        BAND_LABELS[row.band] ?: row.band,
                        component(row.components.coding),
                        component(row.components.coreCs),
                        component(row.components.technicalInterview),
                        component(row.components.communication),
                        component(row.components.aptitude),
                        row.assignmentsCompleted.toString(),
                        row.assignmentsOverdue.toString(),
                        row.lastActiveAt.orEmpty(),
                    ),
                ),
            )
        }
        val out = ByteArrayOutputStream()
        out.write(BOM)
        out.write(text.toString().toByteArray(Charsets.UTF_8))
        return out.toByteArray()
    }

    /** One cell, neutralised against formulas and then quoted when it needs to be. */
    fun cell(value: String): String {
        val safe = if (value.isNotEmpty() && value[0] in FORMULA_STARTS) "'$value" else value
        val needsQuotes = safe.any { it == ',' || it == '"' || it == '\n' || it == '\r' }
        return if (needsQuotes) "\"" + safe.replace("\"", "\"\"") + "\"" else safe
    }

    private fun component(score: Int?): String = score?.toString() ?: NOT_ATTEMPTED

    private fun line(cells: List<String>): String = cells.joinToString(",") { cell(it) } + "\r\n"

    private val FORMULA_STARTS = setOf('=', '+', '-', '@', '\t', '\r')
}
