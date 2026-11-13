package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.user.SupabaseIdentity
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

/**
 * The platform-admin routes (`/admin/campus/orgs…`): creating and onboarding colleges by hand
 * (campus spec §1). Everyone off the `interviewos.admin` allow-list gets a 404. Every write,
 * and every read of one college, goes on that college's audit log as `platform_admin`.
 */
@Service
class CampusAdminService(
    private val access: CampusAccess,
    private val orgs: OrganisationRepository,
    private val audit: CampusAudit,
    private val logos: OrgLogos,
    private val storage: ObjectStorage,
    transactionManager: PlatformTransactionManager,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val transactions = TransactionTemplate(transactionManager)

    /**
     * Every college. Not written to each college's audit log: it is the operator's index, and
     * logging it would add one row per college to every log on every page load. Opening one
     * college is logged.
     */
    @Transactional
    fun list(identity: SupabaseIdentity): List<AdminOrgSummary> {
        val admin = access.requirePlatformAdmin(identity)
        return orgs.listAll(admin).map(logos::summary)
    }

    @Transactional
    fun create(
        identity: SupabaseIdentity,
        request: CreateOrgRequest,
    ): OrgView {
        val admin = access.requirePlatformAdmin(identity)
        val slug = CampusValidation.slug(request.slug)
        val fields =
            OrgFields(
                name = CampusValidation.orgName(request.name),
                city = CampusValidation.optionalText(request.city, "city", 120),
                state = CampusValidation.optionalText(request.state, "state", 120),
                contactName = CampusValidation.optionalText(request.contactName, "contactName", 200),
                contactEmail = CampusValidation.optionalEmail(request.contactEmail),
                contactPhone = CampusValidation.optionalPhone(request.contactPhone),
                interviewAllowance = CampusValidation.interviewAllowance(request.interviewAllowance ?: 0),
                status = STATUS_ACTIVE,
            )
        val id =
            orgs.create(admin, slug, fields)
                ?: throw ApiException.conflict("Another college already uses that slug.", code = "slug_taken")
        val scope = access.resolveAsPlatformAdmin(identity, id)
        audit.record(scope, "org.created", CampusOrgService.TARGET_ORG, id)
        return logos.view(orgs.find(scope) ?: throw ApiException.notFound())
    }

    @Transactional
    fun get(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): AdminOrgSummary {
        val scope = access.resolveAsPlatformAdmin(identity, orgId)
        val row = orgs.find(scope) ?: throw ApiException.notFound()
        audit.record(scope, "org.viewed", CampusOrgService.TARGET_ORG, orgId)
        return logos.summary(row)
    }

    @Transactional
    fun update(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: AdminUpdateOrgRequest,
    ): OrgView {
        val scope = access.resolveAsPlatformAdmin(identity, orgId)
        orgs.lock(scope)
        val row = orgs.find(scope) ?: throw ApiException.notFound()
        val changed = mutableListOf<String>()
        val name = request.name?.let { CampusValidation.orgName(it) } ?: row.name
        if (name != row.name) changed += "name"
        val allowance = request.interviewAllowance?.let { CampusValidation.interviewAllowance(it) } ?: row.interviewAllowance
        if (allowance != row.interviewAllowance) changed += "interviewAllowance"
        val status =
            request.status?.trim()?.let {
                if (it !in STATUSES) {
                    throw ApiException.badRequest("status needs to be active or suspended.", code = "invalid_status")
                }
                it
            } ?: row.status
        if (status != row.status) changed += "status"
        val fields =
            OrgFields(
                name = name,
                city =
                    CampusOrgService.patchText(request.city, row.city, "city", changed) {
                        CampusValidation.optionalText(it, "city", 120)
                    },
                state =
                    CampusOrgService.patchText(request.state, row.state, "state", changed) {
                        CampusValidation.optionalText(it, "state", 120)
                    },
                contactName =
                    CampusOrgService.patchText(request.contactName, row.contactName, "contactName", changed) {
                        CampusValidation.optionalText(it, "contactName", 200)
                    },
                contactEmail =
                    CampusOrgService.patchText(request.contactEmail, row.contactEmail, "contactEmail", changed) {
                        CampusValidation.optionalEmail(it)
                    },
                contactPhone =
                    CampusOrgService.patchText(request.contactPhone, row.contactPhone, "contactPhone", changed) {
                        CampusValidation.optionalPhone(it)
                    },
                interviewAllowance = allowance,
                status = status,
            )
        if (changed.isNotEmpty()) {
            orgs.update(scope, fields)
            audit.record(scope, "org.updated", CampusOrgService.TARGET_ORG, orgId, mapOf("fields" to changed))
            if (status != row.status) {
                val action = if (status == STATUS_SUSPENDED) "org.suspended" else "org.reactivated"
                audit.record(scope, action, CampusOrgService.TARGET_ORG, orgId)
            }
        }
        return logos.view(orgs.find(scope) ?: throw ApiException.notFound())
    }

    /**
     * Stores a new logo, then points the college at it. The upload cannot be rolled back, so
     * it happens first and is deleted again if the database write fails; the replaced logo is
     * deleted only after the new one is committed. Both deletions are best effort: a logo is
     * not personal data, and a stray one costs a few kilobytes, not a person's privacy.
     */
    fun uploadLogo(
        identity: SupabaseIdentity,
        orgId: UUID,
        size: Long,
        read: () -> ByteArray,
    ): OrgView {
        val scope = access.resolveAsPlatformAdmin(identity, orgId)
        // The size is checked, after the gate, before the bytes are read into memory.
        if (size > OrgLogos.MAX_BYTES) throw logoTooLarge()
        val bytes = read()
        if (bytes.isEmpty()) throw ApiException.badRequest("That file was empty.", code = "empty_logo")
        if (bytes.size > OrgLogos.MAX_BYTES) throw logoTooLarge()
        val accepted =
            OrgLogos.sniff(bytes)
                ?: throw ApiException.badRequest("Choose a PNG, JPEG or WebP image.", code = "unsupported_logo_type")
        val path = OrgLogos.objectPath(orgId, accepted)
        storage.upload(OrgLogos.BUCKET, path, bytes, accepted.contentType)
        val replaced =
            try {
                transactions.execute {
                    val old = orgs.replaceLogoPath(scope, path)
                    audit.record(scope, "org.logo_updated", CampusOrgService.TARGET_ORG, orgId)
                    old
                }
            } catch (e: RuntimeException) {
                runCatching { storage.deleteByPrefix(OrgLogos.BUCKET, path) }
                throw e
            }
        if (replaced != null && replaced != path && OrgLogos.isOwnLogoPath(orgId, replaced)) {
            runCatching { storage.deleteByPrefix(OrgLogos.BUCKET, replaced) }
                .onFailure { log.warn("Could not delete a replaced college logo for org {}", orgId, it) }
        }
        return logos.view(orgs.find(scope) ?: throw ApiException.notFound())
    }

    private fun logoTooLarge() = ApiException.badRequest("Keep the logo under 512 KB.", code = "logo_too_large")

    private companion object {
        const val STATUS_ACTIVE = "active"
        const val STATUS_SUSPENDED = "suspended"
        val STATUSES = setOf(STATUS_ACTIVE, STATUS_SUSPENDED)
    }
}
