package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import java.util.Locale

/**
 * Input rules for campus writes. They mirror the `check` constraints in
 * `20261113120000_campus_organisations.sql`, so a bad value is a 400 with a reason rather
 * than a constraint violation surfacing as a 500.
 *
 * Text fields follow one convention on PATCH: `null` (or absent) leaves the value alone, and
 * an empty or blank string clears it where clearing is allowed.
 */
object CampusValidation {
    private val SLUG = Regex("^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$")
    private val DEPARTMENT_CODE = Regex("^[A-Z0-9&-]{1,16}$")
    private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    private val PHONE = Regex("^[0-9+()\\-. ]{5,40}$")
    const val MIN_GRADUATION_YEAR = 2000
    const val MAX_GRADUATION_YEAR = 2100
    const val MAX_INTERVIEW_ALLOWANCE = 1_000_000

    /** Lower-case, trimmed; 3–60 characters of a-z, 0-9 and inner hyphens. */
    fun slug(value: String?): String {
        val clean = value?.trim()?.lowercase(Locale.ROOT).orEmpty()
        if (!SLUG.matches(clean)) {
            throw ApiException.badRequest(
                "slug needs 3 to 60 lower-case letters, digits or hyphens, not starting or ending with a hyphen.",
                code = "invalid_slug",
            )
        }
        return clean
    }

    /** Upper-cased and trimmed, so "cse" and "CSE" are the same department. */
    fun departmentCode(value: String?): String {
        val clean = value?.trim()?.uppercase(Locale.ROOT).orEmpty()
        if (!DEPARTMENT_CODE.matches(clean)) {
            throw ApiException.badRequest(
                "code needs 1 to 16 capital letters, digits, '&' or '-', such as CSE.",
                code = "invalid_department_code",
            )
        }
        return clean
    }

    fun orgName(value: String?): String = requiredText(value, "name", min = 2, max = 200)

    fun departmentName(value: String?): String = requiredText(value, "name", min = 1, max = 160)

    fun batchName(value: String?): String = requiredText(value, "name", min = 1, max = 80)

    fun graduationYear(value: Int?): Int {
        if (value == null || value !in MIN_GRADUATION_YEAR..MAX_GRADUATION_YEAR) {
            throw ApiException.badRequest(
                "graduationYear needs to be a year between $MIN_GRADUATION_YEAR and $MAX_GRADUATION_YEAR.",
                code = "invalid_graduation_year",
            )
        }
        return value
    }

    fun interviewAllowance(value: Int?): Int {
        if (value == null || value !in 0..MAX_INTERVIEW_ALLOWANCE) {
            throw ApiException.badRequest(
                "interviewAllowance needs to be a whole number from 0 to $MAX_INTERVIEW_ALLOWANCE.",
                code = "invalid_interview_allowance",
            )
        }
        return value
    }

    /** An optional text field: trimmed, blank becomes null, refused when too long. */
    fun optionalText(
        value: String?,
        field: String,
        max: Int,
    ): String? {
        val clean = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        if (clean.length > max) {
            throw ApiException.badRequest("Keep $field under $max characters.", code = "invalid_$field".snake())
        }
        return clean
    }

    fun optionalEmail(value: String?): String? {
        val clean = optionalText(value, "contactEmail", max = 320)?.lowercase(Locale.ROOT) ?: return null
        if (!EMAIL.matches(clean)) {
            throw ApiException.badRequest("contactEmail needs to be an email address.", code = "invalid_contact_email")
        }
        return clean
    }

    fun optionalPhone(value: String?): String? {
        val clean = optionalText(value, "contactPhone", max = 40) ?: return null
        if (!PHONE.matches(clean)) {
            throw ApiException.badRequest("contactPhone needs to be a phone number.", code = "invalid_contact_phone")
        }
        return clean
    }

    fun optionalRollNumber(value: String?): String? = optionalText(value, "rollNumber", max = 40)

    private fun requiredText(
        value: String?,
        field: String,
        min: Int,
        max: Int,
    ): String {
        val clean = value?.trim().orEmpty()
        if (clean.length !in min..max) {
            throw ApiException.badRequest("$field needs $min to $max characters.", code = "invalid_$field")
        }
        return clean
    }

    private fun String.snake(): String = replace(Regex("([a-z])([A-Z])"), "$1_$2").lowercase(Locale.ROOT)
}
