package com.interviewos.api.campus

import java.util.Locale
import java.util.UUID

/** Why a CSV row will not be invited. The wire values are the contract's `ImportProblem`. */
enum class ImportProblem(
    val code: String,
) {
    MISSING_NAME("missing_name"),
    BAD_EMAIL("bad_email"),
    DUPLICATE_EMAIL_IN_FILE("duplicate_email_in_file"),
    DUPLICATE_ROLL_IN_FILE("duplicate_roll_in_file"),
    UNKNOWN_DEPARTMENT("unknown_department"),
    UNKNOWN_BATCH("unknown_batch"),
    BATCH_DEPARTMENT_MISMATCH("batch_department_mismatch"),
    GRADUATION_YEAR_MISMATCH("graduation_year_mismatch"),
    ALREADY_MEMBER("already_member"),
    ALREADY_INVITED("already_invited"),
    ROLL_NUMBER_TAKEN("roll_number_taken"),
    ;

    // Deliberately no code for "this email has an Untiered account", or for "is in another
    // college": either would tell a college who uses Untiered (campus plan §5, "Never revealed").

    companion object {
        fun fromCode(code: String): ImportProblem? = entries.firstOrNull { it.code == code }
    }
}

/** A batch of the importing college, as validation needs it. */
data class ImportBatch(
    val id: UUID,
    val name: String,
    val departmentCode: String,
    val graduationYear: Int,
)

/**
 * What the importing college already holds, looked up for the emails and roll numbers in the
 * file only. Everything here is about **this** college; nothing about any other college, nor
 * about whether an email has an account, is ever asked for.
 */
data class ImportContext(
    val departmentCodes: Set<String>,
    val batches: List<ImportBatch>,
    /** Emails (lower-cased) of joined members of this college. */
    val memberEmails: Set<String>,
    /** Emails of open, unexpired invites of this college. */
    val invitedEmails: Set<String>,
    /** Roll numbers held by joined members of this college. */
    val takenRollNumbers: Set<String>,
)

/** A CSV row after validation: normalised values, the resolved batch, and its problems. */
data class ValidatedImportRow(
    val rowNumber: Int,
    val fullName: String?,
    val email: String?,
    val rollNumber: String?,
    val departmentCode: String?,
    val batchName: String?,
    val graduationYear: Int?,
    val batchId: UUID?,
    val problems: List<ImportProblem>,
)

/**
 * Pure validation of a parsed student CSV against one college's [ImportContext]. Kept free of
 * the database so every problem code can be tested directly; the repository looks up the
 * context, scoped to the college, and stores the result.
 */
object ImportValidation {
    private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    private const val MAX_EMAIL = 320

    /** Lower-cased and trimmed; null when it cannot be an address. */
    fun normaliseEmail(value: String?): String? {
        val clean = value?.trim()?.lowercase(Locale.ROOT)?.takeIf { it.isNotEmpty() } ?: return null
        return clean.takeIf { it.length <= MAX_EMAIL && EMAIL.matches(it) }
    }

    /** The lower-cased emails and roll numbers the context needs looking up for [rows]. */
    fun lookupKeys(rows: List<CsvStudentRow>): Pair<Set<String>, Set<String>> =
        rows.mapNotNull { normaliseEmail(it.email) }.toSet() to rows.mapNotNull { it.rollNumber }.toSet()

    fun validate(
        rows: List<CsvStudentRow>,
        context: ImportContext,
    ): List<ValidatedImportRow> {
        val emailCounts = rows.mapNotNull { normaliseEmail(it.email) }.groupingBy { it }.eachCount()
        val rollCounts = rows.mapNotNull { it.rollNumber }.groupingBy { it }.eachCount()
        return rows.map { row ->
            val problems = mutableListOf<ImportProblem>()
            val fullName = row.name
            if (fullName.isNullOrBlank()) problems += ImportProblem.MISSING_NAME

            val email = normaliseEmail(row.email)
            if (email == null) {
                problems += ImportProblem.BAD_EMAIL
            } else {
                // Every copy is flagged, not only the later ones: which one was meant is the
                // college's call, not ours.
                if ((emailCounts[email] ?: 0) > 1) problems += ImportProblem.DUPLICATE_EMAIL_IN_FILE
                if (email in context.memberEmails) problems += ImportProblem.ALREADY_MEMBER
                if (email in context.invitedEmails) problems += ImportProblem.ALREADY_INVITED
            }

            val roll = row.rollNumber
            if (roll != null) {
                if ((rollCounts[roll] ?: 0) > 1) problems += ImportProblem.DUPLICATE_ROLL_IN_FILE
                if (roll in context.takenRollNumbers) problems += ImportProblem.ROLL_NUMBER_TAKEN
            }

            val departmentCode = row.department?.uppercase(Locale.ROOT)
            if (departmentCode != null && departmentCode !in context.departmentCodes) problems += ImportProblem.UNKNOWN_DEPARTMENT

            val batch = row.batch?.let { findBatch(it, context.batches) }
            if (batch == null) {
                problems += ImportProblem.UNKNOWN_BATCH
            } else if (departmentCode != null && departmentCode in context.departmentCodes && departmentCode != batch.departmentCode) {
                problems += ImportProblem.BATCH_DEPARTMENT_MISMATCH
            }

            val year = row.graduationYear?.toIntOrNull()?.takeIf { it in Short.MIN_VALUE..Short.MAX_VALUE }
            val yearWrong = row.graduationYear != null && (year == null || (batch != null && year != batch.graduationYear))
            if (yearWrong) problems += ImportProblem.GRADUATION_YEAR_MISMATCH

            ValidatedImportRow(
                rowNumber = row.rowNumber,
                fullName = fullName,
                email =
                    email ?: row.email
                        ?.trim()
                        ?.lowercase(Locale.ROOT)
                        ?.take(MAX_EMAIL),
                rollNumber = roll,
                departmentCode = departmentCode,
                batchName = row.batch,
                graduationYear = year,
                batchId = batch?.id,
                problems = problems,
            )
        }
    }

    /** Exact name first; otherwise a case-insensitive match, if exactly one batch has it. */
    private fun findBatch(
        name: String,
        batches: List<ImportBatch>,
    ): ImportBatch? {
        batches.firstOrNull { it.name.trim() == name }?.let { return it }
        return batches.filter { it.name.trim().equals(name, ignoreCase = true) }.singleOrNull()
    }
}
