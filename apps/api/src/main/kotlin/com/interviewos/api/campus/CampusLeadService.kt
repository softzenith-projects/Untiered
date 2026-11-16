package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.common.TurnstileVerifier
import com.interviewos.api.email.EmailProperties
import com.interviewos.api.user.SupabaseIdentity
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

/**
 * College self-registration (contract Module 13): the public form, and the platform admin's
 * review and conversion of what it collects.
 *
 * The public write answers the same `202 { received: true }` whether it stored a new lead,
 * merged a repeat into an open one, or dropped a bot, so the response never says whether a
 * lead or an email is already known. What it can say is that a field is wrong, the captcha
 * failed, or the caller has asked too often.
 *
 * Logs carry lead ids and admin user ids, never a name, an email, a phone number or an IP.
 */
@Service
class CampusLeadService(
    private val access: CampusAccess,
    private val leads: LeadRepository,
    private val rateLimiter: LeadRateLimiter,
    private val turnstile: TurnstileVerifier,
    private val colleges: CampusAdminService,
    private val onboarding: CampusOnboardingService,
    private val audit: CampusAudit,
    private val emailProperties: EmailProperties,
    private val leadProperties: CampusLeadProperties,
    transactionManager: PlatformTransactionManager,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val transactions = TransactionTemplate(transactionManager)

    // -- public -------------------------------------------------------------------

    /**
     * Order matters. A bot that fills the honeypot is told it succeeded and leaves no trace,
     * not even a rate-limit count. The IP limit comes before validation, so probing the rules
     * is bounded too; the email limit comes after the captcha, so nobody can use up another
     * person's three a day without solving it.
     */
    fun submit(
        request: LeadRequest,
        clientIp: String?,
    ) {
        if (LeadValidation.isBot(request)) {
            log.info("Campus lead dropped: honeypot filled")
            return
        }
        if (!rateLimiter.allowIp(clientIp ?: UNKNOWN_IP)) throw rateLimited()
        val fields = LeadValidation.validate(request)
        if (!turnstile.verify(request.turnstileToken, clientIp)) {
            throw ApiException.badRequest("The security check did not pass. Try it again.", code = "turnstile_failed")
        }
        if (!rateLimiter.allowEmail(fields.email)) throw rateLimited()
        val notify = emailProperties.enabled && leadProperties.leadNotifyEmail.isNotBlank()
        val (id, merged) =
            transactions.execute {
                leads.lockEmail(fields.email)
                val open = leads.findOpenDuplicate(fields.email, fields.collegeName)
                if (open != null) {
                    leads.merge(open, fields)
                    open to true
                } else {
                    leads.insert(fields, notify) to false
                }
            }!!
        log.info("Campus lead {} {}", id, if (merged) "merged into an open lead" else "received")
    }

    // -- platform admin -----------------------------------------------------------

    fun list(
        identity: SupabaseIdentity,
        status: String?,
        query: String?,
        cursor: String?,
    ): Page<LeadView> {
        val admin = access.requirePlatformAdmin(identity)
        val statusFilter = status?.trim()?.takeIf { it.isNotEmpty() }?.let(::parseStatus)
        val q = query?.trim()?.takeIf { it.isNotEmpty() }
        if (q != null && q.length > LeadValidation.MAX_QUERY) {
            throw ApiException.badRequest("Keep the search under ${LeadValidation.MAX_QUERY} characters.")
        }
        val after = CampusCursor.decodeInvite(cursor)
        val rows = leads.list(admin, statusFilter, q, after, CampusCursor.PAGE_SIZE + 1)
        val page = rows.take(CampusCursor.PAGE_SIZE)
        val next = if (rows.size > CampusCursor.PAGE_SIZE) page.last().let { CampusCursor.encodeInvite(it.createdAt, it.id) } else null
        return Page(page.map { it.view }, next)
    }

    fun get(
        identity: SupabaseIdentity,
        id: UUID,
    ): LeadView {
        val admin = access.requirePlatformAdmin(identity)
        return (leads.find(admin, id) ?: throw ApiException.notFound()).view
    }

    fun update(
        identity: SupabaseIdentity,
        id: UUID,
        request: UpdateLeadRequest,
    ): LeadView {
        val admin = access.requirePlatformAdmin(identity)
        return transactions.execute {
            val lead = leads.find(admin, id, lock = true) ?: throw ApiException.notFound()
            val status = request.status?.trim()?.let(::parseStatus) ?: lead.status
            if (status != lead.status) {
                if (status == LeadValidation.STATUS_CONVERTED) {
                    throw ApiException.badRequest("A lead becomes converted only by converting it.", code = "invalid_status")
                }
                if (lead.status == LeadValidation.STATUS_CONVERTED) {
                    throw ApiException.conflict("This lead is already a college.", code = "lead_already_converted")
                }
            }
            val notes =
                when (val raw = request.notes) {
                    null -> {
                        lead.notes
                    }

                    else -> {
                        raw.trim().takeIf { it.isNotEmpty() }?.also {
                            if (it.length > LeadValidation.MAX_NOTES) {
                                throw ApiException.badRequest(
                                    "Keep the notes under ${LeadValidation.MAX_NOTES} characters.",
                                    code = "invalid_notes",
                                )
                            }
                        }
                    }
                }
            val statusChanged = status != lead.status
            leads.update(admin, id, status, statusChanged, notes)
            if (statusChanged) {
                log.info("Campus lead {} status {} -> {} by admin {}", id, lead.status, status, admin.userId)
            } else if (notes != lead.notes) {
                log.info("Campus lead {} notes updated by admin {}", id, admin.userId)
            }
            (leads.find(admin, id) ?: throw ApiException.notFound()).view
        }!!
    }

    fun delete(
        identity: SupabaseIdentity,
        id: UUID,
    ) {
        val admin = access.requirePlatformAdmin(identity)
        if (!leads.delete(admin, id)) throw ApiException.notFound()
        log.info("Campus lead {} deleted by admin {}", id, admin.userId)
    }

    /**
     * One transaction: the college (as `POST /admin/campus/orgs` makes it), a `college_admin`
     * invite to the lead's email (as module 3 makes it, and its job emails it), and the lead
     * marked converted. Any failure leaves all three as they were. The lead row is locked
     * first, so a double click waits and then finds it converted.
     */
    fun convert(
        identity: SupabaseIdentity,
        id: UUID,
        request: ConvertLeadRequest,
    ): ConvertLeadResult {
        val admin = access.requirePlatformAdmin(identity)
        return transactions.execute {
            val lead = leads.find(admin, id, lock = true) ?: throw ApiException.notFound()
            if (lead.status == LeadValidation.STATUS_CONVERTED) {
                throw ApiException.conflict("This lead is already a college.", code = "lead_already_converted")
            }
            val org =
                colleges.create(
                    identity,
                    CreateOrgRequest(
                        name = request.name ?: lead.collegeName,
                        slug = request.slug,
                        city = request.city ?: lead.city,
                        state = request.state ?: lead.state,
                        contactName = lead.contactName,
                        contactEmail = lead.email,
                        contactPhone = lead.phone?.takeIf { it.length >= MIN_ORG_PHONE },
                        interviewAllowance = request.interviewAllowance,
                    ),
                )
            val invite =
                onboarding.adminCreateInvite(
                    identity,
                    org.id,
                    AdminCreateInviteRequest(email = lead.email, fullName = lead.contactName, role = CampusRole.COLLEGE_ADMIN.dbValue),
                )
            leads.markConverted(admin, id, org.id)
            audit.record(access.resolveAsPlatformAdmin(identity, org.id), "lead.converted", TARGET_LEAD, id)
            log.info("Campus lead {} converted to org {} by admin {}", id, org.id, admin.userId)
            ConvertLeadResult(org, invite)
        }!!
    }

    private fun parseStatus(value: String): String =
        value.takeIf { it in LeadValidation.STATUSES }
            ?: throw ApiException.badRequest("status needs to be new, contacted, converted or not_a_fit.", code = "invalid_status")

    private fun rateLimited() =
        ApiException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited", "That has been sent a few times already. Try again later.")

    companion object {
        const val TARGET_LEAD = "lead"
        private const val UNKNOWN_IP = "unknown"

        /** The organisation's phone rule wants five characters; a shorter one is left off the college. */
        private const val MIN_ORG_PHONE = 5
    }
}
