package com.interviewos.api.resume

import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.springframework.http.HttpStatus
import tools.jackson.databind.ObjectMapper
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ResumeDeletionTest {
    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val resumeId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
    private val bucket = "resumes"
    private val path = "$userId/resume.pdf"
    private val repository = mock(ResumeRepository::class.java)
    private val storage = mock(ObjectStorage::class.java)
    private val service =
        ResumeService(
            repository,
            mock(InterviewAi::class.java),
            storage,
            StorageProperties(resumeBucket = bucket),
            mock(ObjectMapper::class.java),
        )

    @Test
    fun `owned resume is queued for deletion before the request succeeds`() {
        given(repository.findById(userId, resumeId)).willReturn(resume(bucket, path))
        given(repository.enqueueAndDelete(resumeId, userId, bucket, path)).willReturn(true)

        service.delete(userId, resumeId)

        verify(repository).enqueueAndDelete(resumeId, userId, bucket, path)
        verify(storage, never()).deleteByPrefix(bucket, path)
    }

    @Test
    fun `forged cross-user bucket or path is refused before enqueueing`() {
        val forged =
            listOf(
                resume("interview-media", path),
                resume(bucket, "11111111-2222-3333-4444-555555555555/recording.wav"),
                resume(bucket, "$userId/../recording.wav"),
                resume(bucket, userId.toString()),
            )
        forged.forEach { row ->
            given(repository.findById(userId, resumeId)).willReturn(row)
            val failure = assertFailsWith<ApiException> { service.delete(userId, resumeId) }
            assertEquals(HttpStatus.CONFLICT, failure.status)
            assertEquals("invalid_resume_storage_scope", failure.code)
        }
        forged.forEach { row ->
            verify(repository, never()).enqueueAndDelete(resumeId, userId, row.storageBucket, row.storagePath)
        }
    }

    @Test
    fun `another candidate's resume cannot create a deletion job`() {
        given(repository.findById(userId, resumeId)).willReturn(null)
        val failure = assertFailsWith<ApiException> { service.delete(userId, resumeId) }
        assertEquals(HttpStatus.NOT_FOUND, failure.status)
    }

    private fun resume(
        bucket: String,
        path: String,
    ) = ResumeRow(
        id = resumeId,
        originalFilename = "resume.pdf",
        contentType = "application/pdf",
        sizeBytes = 100,
        parseStatus = "parsed",
        parseError = null,
        parsedPayloadJson = null,
        uploadedAt = null,
        parsedAt = null,
        storageBucket = bucket,
        storagePath = path,
    )
}
