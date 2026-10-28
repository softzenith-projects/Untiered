package com.interviewos.api.resume

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.multipart.MultipartFile
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.util.UUID
import javax.imageio.ImageIO
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ProfileAvatarTest {
    private val userId = UUID.randomUUID()
    private val repository = mock(ResumeRepository::class.java)
    private val storage = mock(ObjectStorage::class.java)
    private val controller =
        ProfileController(
            mock(ResumeService::class.java),
            repository,
            mock(UserRepository::class.java),
            storage,
            StorageProperties(resumeBucket = "resumes"),
        )
    private val jwt =
        Jwt
            .withTokenValue("test")
            .header("alg", "RS256")
            .subject(userId.toString())
            .claim("email", "candidate@example.invalid")
            .build()

    @Test
    fun `invalid bytes are refused before storage or profile update`() {
        val file = file("image/png", "<html>not a photo</html>".toByteArray())

        val failure = assertFailsWith<ApiException> { controller.uploadAvatar(jwt, file) }

        assertEquals("unsupported_avatar_type", failure.code)
        verifyNoInteractions(storage, repository)
    }

    @Test
    fun `valid photo is stored and old path is queued by repository replacement`() {
        val photo = BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB)
        val bytes = ByteArrayOutputStream().also { ImageIO.write(photo, "png", it) }.toByteArray()
        val file = file("image/png", bytes)

        controller.uploadAvatar(jwt, file)

        val upload = mockingDetails(storage).invocations.single { it.method.name == "upload" }
        assertEquals("resumes", upload.arguments[0])
        assertEquals("image/png", upload.arguments[3])
        val replacement = mockingDetails(repository).invocations.single { it.method.name == "replaceAvatarPath" }
        assertEquals(userId, replacement.arguments[0])
        assertEquals(upload.arguments[1], replacement.arguments[1])
    }

    private fun file(
        contentType: String,
        bytes: ByteArray,
    ): MultipartFile =
        mock(MultipartFile::class.java).also {
            given(it.contentType).willReturn(contentType)
            given(it.bytes).willReturn(bytes)
            given(it.size).willReturn(bytes.size.toLong())
        }
}
