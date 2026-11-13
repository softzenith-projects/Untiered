package com.interviewos.api.campus

import com.interviewos.api.email.EmailProperties
import com.interviewos.api.email.SesEmailSender
import com.interviewos.api.email.isTransientSesFailure
import com.interviewos.api.email.retryDelaySeconds
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import software.amazon.awssdk.services.sesv2.model.SesV2Exception
import java.net.URLEncoder
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Emails pending college invites, and deletes import previews past their day.
 *
 * The raw token never touches the database: for each invite the job draws a fresh token,
 * stores only its hash (which retires the previous link), and sends the link. If the process
 * dies between storing and sending, the claim goes stale and is marked failed, and staff can
 * resend. The claim, lease, retry and "never retry an ambiguous result" rules are the same as
 * [com.interviewos.api.email.LifecycleEmailJob]'s.
 *
 * When SES is not configured (`interviewos.email.enabled` false), nothing is sent and invites
 * stay `pending`, as the lifecycle emails do.
 */
@Component
class CampusInviteEmailJob(
    private val invites: InviteRepository,
    private val properties: EmailProperties,
    private val sender: SesEmailSender,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /** Up to [BATCH] emails every five seconds per API instance: about one a second. */
    @Scheduled(initialDelay = 95_000, fixedDelay = 5_000)
    fun dispatch() {
        if (!properties.enabled) return
        invites.failStaleSends()
        for ((orgId, id) in invites.claimPendingSends(BATCH)) {
            val token = InviteTokens.generate()
            val hash = InviteTokens.hash(token)
            val invite = invites.rotateForSend(orgId, id, hash) ?: continue
            try {
                val message = message(invite)
                sender.sendTransactional(invite.email, message.subject, message.body, "Join ${invite.orgName}", link(token))
                invites.markSent(orgId, id, hash)
            } catch (cause: Exception) {
                // Messages can carry the address; log the class and the row id only.
                val retry = cause is SesV2Exception && isTransientSesFailure(cause) && invite.attempts < MAX_ATTEMPTS
                log.error("Campus invite email {} failed ({}); retryable={}", id, cause.javaClass.simpleName, retry)
                val delay = if (retry) retryDelaySeconds(invite.attempts.coerceIn(1, MAX_ATTEMPTS)) else 0L
                invites.markSendFailed(orgId, id, hash, retry, delay, if (retry) "ses_transient" else "ses_permanent_or_ambiguous")
            }
        }
    }

    @Scheduled(initialDelayString = "PT3M", fixedDelayString = "PT1H")
    fun purgeExpiredImports() {
        val deleted = invites.purgeExpiredImports()
        if (deleted > 0) log.info("Deleted {} expired campus import previews", deleted)
    }

    private fun link(token: String): String =
        "${properties.publicBaseUrl.trimEnd('/')}/campus/join?token=${URLEncoder.encode(token, Charsets.UTF_8)}"

    data class InviteMessage(
        val subject: String,
        val body: String,
    )

    companion object {
        const val BATCH = 5
        private const val MAX_ATTEMPTS = 3
        private val INDIA: ZoneId = ZoneId.of("Asia/Kolkata")
        private val DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH)

        /**
         * Plain and honest: who invited them (the college, never a staff member's address), what
         * Untiered is, when the link stops working, and that ignoring it is fine. The link itself
         * is the email's one button, added by [SesEmailSender.sendTransactional].
         */
        fun message(invite: SendableInvite): InviteMessage {
            val college = invite.orgName
            val asRole =
                when (invite.role) {
                    CampusRole.STUDENT -> "as a student"
                    CampusRole.COLLEGE_ADMIN -> "as a college admin"
                    CampusRole.TPO -> "as a placement officer"
                    CampusRole.FACULTY -> "as faculty"
                }
            val until = DATE.format(invite.expiresAt.atZone(INDIA))
            val body =
                buildString {
                    appendLine("Hello ${invite.fullName},")
                    appendLine()
                    appendLine("$college has invited you to join them on Untiered $asRole.")
                    appendLine("Untiered is a place to practise job interviews: spoken mock interviews, with a feedback report on each.")
                    appendLine()
                    appendLine("To join, open the link below and sign in with Google or an email address.")
                    appendLine("The link works once, until $until.")
                    append("If you were not expecting this email, you can ignore it. Nothing happens unless you open the link and agree.")
                }
            return InviteMessage("Join $college on Untiered", body)
        }
    }
}
