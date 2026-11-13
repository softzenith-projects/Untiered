package com.interviewos.api.campus

import com.interviewos.api.storage.StorageProperties
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * College logos: stored in our own public `org-logos` bucket (campus spec §1 — never a
 * hotlink to the college's site, which would tell a third party about each student's visit).
 *
 * The bytes must really be a PNG, JPEG or WebP: the declared content type is not trusted,
 * and the stored object is served with the type its signature proves, so an HTML or SVG file
 * renamed `.png` cannot be served from our domain as a page.
 */
@Component
class OrgLogos(
    private val storageProperties: StorageProperties,
) {
    data class Accepted(
        val extension: String,
        val contentType: String,
    )

    /** The public URL for a stored logo, or null when there is none (or storage is not configured). */
    fun publicUrl(path: String?): String? {
        if (path.isNullOrBlank() || storageProperties.supabaseUrl.isBlank()) return null
        return "${storageProperties.restBaseUrl}/object/public/$BUCKET/$path"
    }

    fun view(row: OrgRow): OrgView = row.toView()

    fun summary(row: OrgRow): AdminOrgSummary =
        AdminOrgSummary(
            id = row.id,
            name = row.name,
            slug = row.slug,
            city = row.city,
            state = row.state,
            logoUrl = publicUrl(row.logoPath),
            contactName = row.contactName,
            contactEmail = row.contactEmail,
            contactPhone = row.contactPhone,
            status = row.status,
            interviewAllowance = row.interviewAllowance,
            interviewsUsed = 0,
            createdAt = row.createdAt.toString(),
            staffCount = row.staffCount,
            studentCount = row.studentCount,
        )

    private fun OrgRow.toView() =
        OrgView(
            id = id,
            name = name,
            slug = slug,
            city = city,
            state = state,
            logoUrl = publicUrl(logoPath),
            contactName = contactName,
            contactEmail = contactEmail,
            contactPhone = contactPhone,
            status = status,
            interviewAllowance = interviewAllowance,
            // Org-funded interviews are spent from module 4 on; until then, none have been.
            interviewsUsed = 0,
            createdAt = createdAt.toString(),
        )

    companion object {
        const val BUCKET = "org-logos"
        const val MAX_BYTES = 512 * 1024

        private val PNG = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        private val JPEG = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())
        private val RIFF = "RIFF".toByteArray(Charsets.US_ASCII)
        private val WEBP = "WEBP".toByteArray(Charsets.US_ASCII)

        /** What the bytes are, by signature; null when they are none of the three. */
        fun sniff(bytes: ByteArray): Accepted? =
            when {
                bytes.startsWith(PNG, 0) -> Accepted("png", "image/png")
                bytes.startsWith(JPEG, 0) -> Accepted("jpg", "image/jpeg")
                bytes.size >= 12 && bytes.startsWith(RIFF, 0) && bytes.startsWith(WEBP, 8) -> Accepted("webp", "image/webp")
                else -> null
            }

        /** `{orgId}/logo-{random}.{ext}`: a fresh key per upload, so a cached old logo never lingers. */
        fun objectPath(
            orgId: UUID,
            accepted: Accepted,
        ): String = "$orgId/logo-${UUID.randomUUID()}.${accepted.extension}"

        /** Only a key this class could have written for this college is ever deleted. */
        fun isOwnLogoPath(
            orgId: UUID,
            path: String,
        ): Boolean = LOGO_PATH.matches(path) && path.startsWith("$orgId/")

        private val LOGO_PATH = Regex("^[0-9a-f-]{36}/logo-[0-9a-f-]{36}\\.(png|jpg|webp)$")

        private fun ByteArray.startsWith(
            prefix: ByteArray,
            offset: Int,
        ): Boolean = size >= offset + prefix.size && prefix.indices.all { this[offset + it] == prefix[it] }
    }
}
