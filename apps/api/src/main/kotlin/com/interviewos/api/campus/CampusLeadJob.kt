package com.interviewos.api.campus

import com.interviewos.api.email.EmailProperties
import com.interviewos.api.email.SesEmailSender
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * The lead form's background work (contract Module 13): one notification email to the
 * operator per new lead, and deleting what is no longer needed: leads marked not a fit more
 * than 180 days ago, and rate-limit buckets past their windows.
 *
 * The notification is an address-only send, like module 3's invite email: no user row, no
 * unsubscribe, one button. It names the college, the city and who wrote, and links to the
 * lead; it never carries the phone number or the message, which stay on the admin screen.
 */
@Component
class CampusLeadJob(
    private val leads: LeadRepository,
    private val rateLimiter: LeadRateLimiter,
    private val emailProperties: EmailProperties,
    private val leadProperties: CampusLeadProperties,
    private val sender: SesEmailSender,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(initialDelay = 100_000, fixedDelay = 30_000)
    fun notifyNewLeads() {
        val address = leadProperties.leadNotifyEmail.trim()
        if (!emailProperties.enabled || address.isEmpty()) return
        for (notice in leads.claimNotices(BATCH)) {
            try {
                val message = message(notice)
                sender.sendTransactional(address, message.subject, message.body, "Open the lead", link(notice))
            } catch (cause: Exception) {
                // At most once: a failed or ambiguous send is marked and left for the admin screen.
                log.error("Campus lead notification {} failed ({})", notice.id, cause.javaClass.simpleName)
                leads.markNoticeFailed(notice.id)
            }
        }
    }

    @Scheduled(initialDelayString = "PT4M", fixedDelayString = "PT6H")
    fun purge() {
        val leadsDeleted = leads.purgeNotAFit()
        val bucketsDeleted = rateLimiter.purgeStale()
        if (leadsDeleted > 0 || bucketsDeleted > 0) {
            log.info("Deleted {} not-a-fit campus leads and {} stale lead rate-limit buckets", leadsDeleted, bucketsDeleted)
        }
    }

    private fun link(notice: LeadNotice): String = "${emailProperties.publicBaseUrl.trimEnd('/')}/admin/campus/leads/${notice.id}"

    data class LeadMessage(
        val subject: String,
        val body: String,
    )

    companion object {
        const val BATCH = 5

        fun message(notice: LeadNotice): LeadMessage {
            val role =
                when (notice.contactRole) {
                    "tpo" -> "placement officer (TPO)"
                    "faculty" -> "faculty"
                    "college_admin" -> "college admin"
                    else -> "other role"
                }
            val body =
                buildString {
                    appendLine("A college has registered interest in Untiered Campus.")
                    appendLine()
                    appendLine("College: ${notice.collegeName}")
                    appendLine("City: ${notice.city}")
                    appendLine("Contact: ${notice.contactName}, $role")
                    appendLine()
                    append("The full details are on the admin screen.")
                }
            return LeadMessage("New college lead: ${notice.collegeName}", body)
        }
    }
}
