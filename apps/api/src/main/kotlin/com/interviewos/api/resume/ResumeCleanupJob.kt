package com.interviewos.api.resume

import com.interviewos.api.storage.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.util.UUID

/** Retries cleanup if an upload's best-effort pruning could not reach the database. */
@Component
class ResumeCleanupJob(
    private val repository: ResumeRepository,
    private val storageProperties: StorageProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(initialDelayString = "PT5M", fixedDelayString = "PT1H")
    fun sweep() {
        var after: UUID? = null
        repeat(MAX_PAGES) {
            val owners = repository.supersededOwnersAfter(after, PAGE_SIZE, storageProperties.resumeBucket)
            if (owners.isEmpty()) return
            owners.forEach { userId ->
                runCatching { repository.enqueueAndDeleteSuperseded(userId, storageProperties.resumeBucket) }
                    .onFailure { log.error("Could not queue superseded resume cleanup for {}", userId, it) }
            }
            after = owners.last()
            if (owners.size < PAGE_SIZE) return
        }
    }

    private companion object {
        const val PAGE_SIZE = 100
        const val MAX_PAGES = 100
    }
}
