package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.util.Locale

/** One data line of a student CSV, as written (trimmed; blank cells are null). */
data class CsvStudentRow(
    /** 1-based, the header row excluded. Blank lines count, so it matches the spreadsheet. */
    val rowNumber: Int,
    val name: String?,
    val email: String?,
    val rollNumber: String?,
    val department: String?,
    val batch: String?,
    val graduationYear: String?,
)

/**
 * The student CSV (contract "CSV format"): UTF-8 with or without a BOM, comma- or
 * semicolon-separated, RFC 4180 quoting, a header row matched case-insensitively.
 *
 * Hand-written rather than a library: the format is small, and the one thing that matters
 * here — refusing anything ambiguous with `400 csv_invalid` instead of guessing — is easier
 * to see in sixty lines than in a dependency's options.
 */
object CampusCsv {
    const val MAX_BYTES = 1_048_576
    const val MAX_ROWS = 5_000
    const val MAX_NAME = 200
    const val MAX_ROLL = 40
    private const val MAX_CELL = 320

    private val COLUMNS: Map<String, String> =
        mapOf(
            "name" to "name",
            "full_name" to "name",
            "email" to "email",
            "email_address" to "email",
            "roll_number" to "roll_number",
            "roll_no" to "roll_number",
            "department" to "department",
            "department_code" to "department",
            "batch" to "batch",
            "batch_name" to "batch",
            "graduation_year" to "graduation_year",
        )
    private val REQUIRED = listOf("name", "email", "batch")

    fun parseStudents(bytes: ByteArray): List<CsvStudentRow> {
        if (bytes.size > MAX_BYTES) throw invalid("Keep the file under 1 MB.")
        val records = parse(decode(bytes))
        val header = records.firstOrNull() ?: throw invalid("The file is empty.")
        val columns = mapHeader(header)
        val rows = mutableListOf<CsvStudentRow>()
        for ((index, record) in records.drop(1).withIndex()) {
            if (record.all { it.isBlank() }) continue
            if (rows.size == MAX_ROWS) throw invalid("Keep the file to $MAX_ROWS students or fewer.")

            fun cell(column: String): String? = columns[column]?.let { record.getOrNull(it) }?.trim()?.takeIf { it.isNotEmpty() }
            val rowNumber = index + 1
            val row =
                CsvStudentRow(
                    rowNumber = rowNumber,
                    name = cell("name"),
                    email = cell("email"),
                    rollNumber = cell("roll_number"),
                    department = cell("department"),
                    batch = cell("batch"),
                    graduationYear = cell("graduation_year"),
                )
            if ((row.name?.length ?: 0) > MAX_NAME) throw invalid("Row $rowNumber: keep the name under $MAX_NAME characters.")
            if ((row.rollNumber?.length ?: 0) > MAX_ROLL) throw invalid("Row $rowNumber: keep the roll number under $MAX_ROLL characters.")
            val tooLong = listOf(row.email, row.department, row.batch, row.graduationYear).any { (it?.length ?: 0) > MAX_CELL }
            if (tooLong) throw invalid("Row $rowNumber has a cell longer than $MAX_CELL characters.")
            rows += row
        }
        if (rows.isEmpty()) throw invalid("The file has a header but no students.")
        return rows
    }

    /** Strict UTF-8, minus a leading byte-order mark. */
    internal fun decode(bytes: ByteArray): String {
        val start = if (bytes.size >= 3 && bytes[0] == 0xEF.toByte() && bytes[1] == 0xBB.toByte() && bytes[2] == 0xBF.toByte()) 3 else 0
        return try {
            Charsets.UTF_8
                .newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes, start, bytes.size - start))
                .toString()
        } catch (e: CharacterCodingException) {
            throw invalid("Save the file as UTF-8 CSV.")
        }
    }

    /**
     * RFC 4180 records. The delimiter is whichever of `,` and `;` appears more often outside
     * quotes on the first line (Excel writes `;` where the decimal mark is a comma). Lines end
     * in CRLF, LF or a lone CR; a quoted field may contain any of them, the delimiter, and `""`
     * for a quote. A quote that is never closed, or text after a closing quote, is refused.
     */
    internal fun parse(text: String): List<List<String>> {
        val delimiter = detectDelimiter(text)
        val records = mutableListOf<List<String>>()
        var record = mutableListOf<String>()
        val field = StringBuilder()
        var i = 0
        var inQuotes = false
        var quotedField = false
        var afterQuote = false

        fun endField() {
            record += field.toString()
            field.setLength(0)
            quotedField = false
            afterQuote = false
        }

        fun endRecord() {
            endField()
            records += record
            record = mutableListOf()
        }

        while (i < text.length) {
            val c = text[i]
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < text.length && text[i + 1] == '"') {
                        field.append('"')
                        i++
                    } else {
                        inQuotes = false
                        afterQuote = true
                    }
                } else {
                    field.append(c)
                }
            } else {
                when {
                    c == delimiter -> {
                        endField()
                    }

                    c == '\r' || c == '\n' -> {
                        if (c == '\r' && i + 1 < text.length && text[i + 1] == '\n') i++
                        endRecord()
                    }

                    afterQuote -> {
                        throw invalid("Line ${records.size + 1}: text after a closing quote.")
                    }

                    c == '"' && field.isEmpty() && !quotedField -> {
                        inQuotes = true
                        quotedField = true
                    }

                    else -> {
                        field.append(c)
                    }
                }
            }
            i++
        }
        if (inQuotes) throw invalid("A quoted field is never closed.")
        // The last line may or may not end in a newline; an empty tail is not a record.
        if (field.isNotEmpty() || record.isNotEmpty() || quotedField) endRecord()
        return records
    }

    private fun detectDelimiter(text: String): Char {
        var commas = 0
        var semicolons = 0
        var quoted = false
        for (c in text) {
            when {
                c == '"' -> {
                    quoted = !quoted
                }

                quoted -> {}

                c == '\n' || c == '\r' -> {
                    break
                }

                c == ',' -> {
                    commas++
                }

                c == ';' -> {
                    semicolons++
                }
            }
        }
        return if (semicolons > commas) ';' else ','
    }

    /** Column name to index. Case, surrounding space, inner spaces and hyphens do not matter. */
    private fun mapHeader(header: List<String>): Map<String, Int> {
        val columns = mutableMapOf<String, Int>()
        header.forEachIndexed { index, raw ->
            val key = raw.trim().lowercase(Locale.ROOT).replace(Regex("[\\s-]+"), "_")
            val column = COLUMNS[key] ?: return@forEachIndexed
            if (columns.put(column, index) != null) throw invalid("The header names the $column column twice.")
        }
        val missing = REQUIRED.filter { it !in columns }
        if (missing.isNotEmpty()) {
            throw invalid(
                "The header needs these columns: name, email, roll_number, department, batch, graduation_year. " +
                    "Missing: ${missing.joinToString(", ")}.",
            )
        }
        return columns
    }

    fun invalid(message: String) = ApiException.badRequest(message, code = "csv_invalid")
}
