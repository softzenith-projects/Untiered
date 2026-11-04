package com.interviewos.api.resume

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageKeys
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.net.URI
import java.util.UUID

/**
 * The candidate's own profile: who they are, what they work in, and the resume an
 * interview is grounded in.
 *
 * Every route derives the caller from the verified token. No route accepts a user id, so
 * one candidate cannot read or write another's profile, resume or skills.
 */
@RestController
@RequestMapping("/api/v1/me")
class ProfileController(
    private val resumeService: ResumeService,
    private val repository: ResumeRepository,
    private val userRepository: UserRepository,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
) {
    @PutMapping("/profile")
    fun updateProfile(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody request: UpdateProfileRequest,
    ): ProfileDetails {
        val identity = SupabaseIdentity.from(jwt)
        // Any entry point that writes user-owned rows has to stand on its own rather than
        // assume GET /me was called first — that assumption already broke session start.
        userRepository.provision(identity)

        request.linkedinUrl
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?.let { requireLinkedInUrl(it) }

        repository.upsertProfile(
            identity.id,
            ProfileUpdate(
                function = request.function.cleaned(),
                currentLevel = request.currentLevel.cleaned(),
                targetLevel = request.targetLevel.cleaned(),
                location = request.location.cleaned(),
                headline = request.headline.cleaned(),
                linkedinUrl = request.linkedinUrl.cleaned(),
                noticePeriodDays = request.noticePeriodDays,
                workAuthorisationStatus = request.workAuthorisationStatus.cleaned(),
                relocationIntent = request.relocationIntent.cleaned(),
                peopleManagementScope = request.peopleManagementScope.cleaned(),
            ),
        )
        return details(identity)
    }

    @GetMapping("/profile")
    fun profile(
        @AuthenticationPrincipal jwt: Jwt,
    ): ProfileDetails = details(SupabaseIdentity.from(jwt))

    // -- resume ----------------------------------------------------------------

    @PostMapping("/resume")
    @ResponseStatus(HttpStatus.CREATED)
    fun uploadResume(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam file: MultipartFile,
    ): ResumeView {
        val identity = SupabaseIdentity.from(jwt)
        userRepository.provision(identity)
        return resumeService.upload(
            identity.id,
            ResumeUpload(
                bytes = file.bytes,
                contentType = file.contentType ?: "application/octet-stream",
                filename = file.originalFilename ?: "resume",
            ),
        )
    }

    @GetMapping("/resume")
    fun resume(
        @AuthenticationPrincipal jwt: Jwt,
    ): ResumeView? = resumeService.current(SupabaseIdentity.from(jwt).id)

    @DeleteMapping("/resume/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteResume(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ) = resumeService.delete(SupabaseIdentity.from(jwt).id, id)

    // -- avatar ----------------------------------------------------------------

    @PostMapping("/avatar")
    fun uploadAvatar(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam file: MultipartFile,
    ): ProfileDetails {
        val identity = SupabaseIdentity.from(jwt)
        userRepository.provision(identity)

        if (file.size > MAX_AVATAR_BYTES) {
            throw ApiException.badRequest("Keep the photo under 2MB.", code = "avatar_too_large")
        }

        val image =
            AvatarImage.normalise(file.contentType ?: "", file.bytes)
                ?: throw ApiException.badRequest("Choose a valid PNG or JPEG photo.", code = "unsupported_avatar_type")

        val path = "${identity.id}/avatar-${UUID.randomUUID()}"
        storage.upload(storageProperties.resumeBucket, path, image.bytes, image.contentType)
        try {
            repository.replaceAvatarPath(identity.id, path, storageProperties.resumeBucket)
        } catch (e: RuntimeException) {
            // The database transaction rolled back, so this new object is not referenced.
            // Best-effort cleanup keeps a storage failure from hiding the original error.
            runCatching { storage.deleteByPrefix(storageProperties.resumeBucket, path) }
            throw e
        }
        return details(identity)
    }

    // -- skills ----------------------------------------------------------------

    @PutMapping("/skills")
    fun upsertSkill(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody request: UpsertSkillRequest,
    ): List<SkillRow> {
        val identity = SupabaseIdentity.from(jwt)
        userRepository.provision(identity)
        repository.upsertSkill(
            identity.id,
            request.name.trim(),
            request.selfRatedConfidence,
            request.flaggedAsWeak,
        )
        return repository.listSkills(identity.id)
    }

    @DeleteMapping("/skills/{name}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteSkill(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable name: String,
    ) = repository.deleteSkill(SupabaseIdentity.from(jwt).id, name)

    /**
     * Just the photo, for the account menu on every page. `/profile` also reads the resume
     * and skills, which is far too much to load for a 44-pixel circle.
     */
    @GetMapping("/avatar")
    fun avatar(
        @AuthenticationPrincipal jwt: Jwt,
    ): AvatarView = AvatarView(photoUrlFor(SupabaseIdentity.from(jwt)))

    /** The photo they uploaded, or else the one on their Google account. */
    private fun photoUrlFor(identity: SupabaseIdentity): String? = signedAvatarUrl(identity.id) ?: identity.providerPhotoUrl

    /** A short-lived URL for the candidate's own photo, or null when they have none. */
    private fun signedAvatarUrl(userId: UUID): String? {
        val avatarPath =
            repository.avatarPath(userId)?.takeIf { path ->
                StorageKeys.isDirectChildOf(path, userId.toString()) &&
                    path.substringAfterLast('/').startsWith("avatar-")
            }
        return avatarPath?.let {
            runCatching { storage.createSignedUrl(storageProperties.resumeBucket, it, AVATAR_URL_SECONDS) }.getOrNull()
        }
    }

    private fun details(identity: SupabaseIdentity): ProfileDetails {
        val userId = identity.id
        val profile = repository.findProfile(userId)
        return ProfileDetails(
            resume = resumeService.current(userId),
            skills = repository.listSkills(userId),
            avatarUrl = photoUrlFor(identity),
            // Returned so the form can show what was saved. Without these the profile was
            // write-only: everything the candidate entered persisted and none of it ever
            // came back, which reads as the save having silently failed.
            currentLevel = profile?.currentLevel,
            targetLevel = profile?.targetLevel,
            linkedinUrl = profile?.linkedinUrl,
        )
    }

    /**
     * A LinkedIn URL is stored, shown back, and given to nothing else — we do not fetch
     * it. Validating the host anyway, because a field labelled "LinkedIn" that silently
     * accepts anything is a field that will end up holding anything.
     */
    private fun requireLinkedInUrl(value: String) {
        val host =
            try {
                URI(value).host?.lowercase()
            } catch (e: IllegalArgumentException) {
                null
            }
        if (host == null || !(host == "linkedin.com" || host.endsWith(".linkedin.com"))) {
            throw ApiException.badRequest(
                "That does not look like a LinkedIn profile URL.",
                code = "invalid_linkedin_url",
            )
        }
    }

    /** Blank means "clear this", which is different from absent meaning "leave it". */
    private fun String?.cleaned(): String? = this?.trim()

    private companion object {
        const val MAX_AVATAR_BYTES = 2_000_000
        const val AVATAR_URL_SECONDS = 3600
    }
}

data class UpdateProfileRequest(
    @field:Size(max = 120) val function: String? = null,
    @field:Size(max = 60) val currentLevel: String? = null,
    @field:Size(max = 60) val targetLevel: String? = null,
    @field:Size(max = 120) val location: String? = null,
    @field:Size(max = 200) val headline: String? = null,
    @field:Size(max = 300) val linkedinUrl: String? = null,
    @field:Min(0) @field:Max(365) val noticePeriodDays: Int? = null,
    @field:Size(max = 120) val workAuthorisationStatus: String? = null,
    @field:Size(max = 40) val relocationIntent: String? = null,
    @field:Size(max = 200) val peopleManagementScope: String? = null,
)

data class UpsertSkillRequest(
    @field:Size(min = 1, max = 80) val name: String,
    @field:Min(1) @field:Max(5) val selfRatedConfidence: Int? = null,
    val flaggedAsWeak: Boolean = false,
)

data class ProfileDetails(
    val resume: ResumeView?,
    val skills: List<SkillRow>,
    val avatarUrl: String?,
    val currentLevel: String?,
    val targetLevel: String?,
    val linkedinUrl: String?,
)

/** The caller's profile photo as a signed URL, or null when they have not set one. */
data class AvatarView(
    val avatarUrl: String?,
)
