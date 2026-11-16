package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import java.time.Instant
import java.util.Locale
import java.util.UUID

// Wire shapes for college self-registration (contract Module 13).

/** The public form. Every field is nullable so a missing one is a `400 lead_invalid`, not a parse error. */
data class LeadRequest(
    val collegeName: String? = null,
    val city: String? = null,
    val state: String? = null,
    val contactName: String? = null,
    val contactRole: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val approxStudents: Int? = null,
    val message: String? = null,
    val consentToContact: Boolean? = null,
    val turnstileToken: String? = null,
    /** Honeypot: hidden from people, filled in by bots. */
    val website: String? = null,
)

data class LeadReceived(
    val received: Boolean = true,
)

data class LeadView(
    val id: UUID,
    val status: String,
    val collegeName: String,
    val city: String,
    val state: String,
    val contactName: String,
    val contactRole: String,
    val email: String,
    val phone: String?,
    val approxStudents: Int?,
    val message: String?,
    val notes: String?,
    val orgId: UUID?,
    val createdAt: String,
    val updatedAt: String,
    val statusChangedBy: UUID?,
)

data class UpdateLeadRequest(
    val status: String? = null,
    val notes: String? = null,
)

data class ConvertLeadRequest(
    val name: String? = null,
    val slug: String? = null,
    val city: String? = null,
    val state: String? = null,
    val interviewAllowance: Int? = null,
)

data class ConvertLeadResult(
    val org: OrgView,
    val invite: InviteView,
)

/** A lead as stored. */
data class LeadRow(
    val id: UUID,
    val status: String,
    val collegeName: String,
    val city: String,
    val state: String,
    val contactName: String,
    val contactRole: String,
    val email: String,
    val phone: String?,
    val approxStudents: Int?,
    val message: String?,
    val notes: String?,
    val orgId: UUID?,
    val createdAt: Instant,
    val updatedAt: Instant,
    val statusChangedBy: UUID?,
) {
    val view: LeadView
        get() =
            LeadView(
                id = id,
                status = status,
                collegeName = collegeName,
                city = city,
                state = state,
                contactName = contactName,
                contactRole = contactRole,
                email = email,
                phone = phone,
                approxStudents = approxStudents,
                message = message,
                notes = notes,
                orgId = orgId,
                createdAt = createdAt.toString(),
                updatedAt = updatedAt.toString(),
                statusChangedBy = statusChangedBy,
            )
}

/** A submission that passed validation, ready to store. */
data class LeadFields(
    val collegeName: String,
    val city: String,
    val state: String,
    val contactName: String,
    val contactRole: String,
    val email: String,
    val phone: String?,
    val approxStudents: Int?,
    val message: String?,
)

/**
 * The public form's rules. They mirror the `check` constraints in
 * `20261114120000_campus_leads.sql`, so a bad value is a `400 lead_invalid` naming the field,
 * never a constraint violation surfacing as a 500.
 */
object LeadValidation {
    const val STATUS_NEW = "new"
    const val STATUS_CONTACTED = "contacted"
    const val STATUS_CONVERTED = "converted"
    const val STATUS_NOT_A_FIT = "not_a_fit"
    val STATUSES = setOf(STATUS_NEW, STATUS_CONTACTED, STATUS_CONVERTED, STATUS_NOT_A_FIT)
    val ROLES = setOf("tpo", "faculty", "college_admin", "other")
    const val MAX_NOTES = 5000
    const val MAX_QUERY = 100

    private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    private val PHONE = Regex("^[0-9 +()-]+$")

    fun validate(request: LeadRequest): LeadFields {
        if (request.consentToContact != true) {
            throw invalid("consentToContact", "Tick the box to say we may contact you about Untiered Campus.")
        }
        val phone =
            request.phone?.trim()?.takeIf { it.isNotEmpty() }?.also {
                if (it.length > 20 || !PHONE.matches(it)) {
                    throw invalid("phone", "Enter a phone number of up to 20 digits, spaces or + - ( ).")
                }
            }
        val students =
            request.approxStudents?.also {
                if (it !in 1..100_000) throw invalid("approxStudents", "Enter a number of students from 1 to 100,000.")
            }
        val message =
            request.message?.trim()?.takeIf { it.isNotEmpty() }?.also {
                if (it.length > 2000) throw invalid("message", "Keep the message under 2,000 characters.")
            }
        return LeadFields(
            collegeName = required(request.collegeName, "collegeName", "college name", 2, 200),
            city = required(request.city, "city", "city", 1, 120),
            state = required(request.state, "state", "state", 1, 120),
            contactName = required(request.contactName, "contactName", "name", 1, 200),
            contactRole =
                request.contactRole?.trim()?.takeIf { it in ROLES }
                    ?: throw invalid("contactRole", "Choose your role: TPO, faculty, college admin or other."),
            email = email(request.email),
            phone = phone,
            approxStudents = students,
            message = message,
        )
    }

    fun email(value: String?): String {
        val clean = value?.trim()?.lowercase(Locale.ROOT).orEmpty()
        if (clean.length > 320 || !EMAIL.matches(clean)) throw invalid("email", "Enter a valid email address.")
        return clean
    }

    /** A filled honeypot. Whitespace alone is not a bot: some autofill tools write a space. */
    fun isBot(request: LeadRequest): Boolean = !request.website.isNullOrBlank()

    private fun required(
        value: String?,
        field: String,
        label: String,
        min: Int,
        max: Int,
    ): String {
        val clean = value?.trim()?.replace(Regex("\\s+"), " ").orEmpty()
        if (clean.length !in min..max) throw invalid(field, "Enter the $label ($min to $max characters).")
        return clean
    }

    private fun invalid(
        field: String,
        message: String,
    ) = ApiException.badRequest("$field: $message", code = "lead_invalid")
}
