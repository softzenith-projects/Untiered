package com.interviewos.api.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.task.SimpleAsyncTaskExecutor
import org.springframework.core.task.TaskExecutor

/**
 * Separate bounded executors for source and pool work, and optional question speech.
 *
 * Speech rejects at capacity so after-commit threads do not wait for a permit.
 *
 * Tasks run on platform threads, bounded by each executor's concurrency limit. They used to
 * run on virtual threads, which share the request handlers' two or so carriers: on Java 21
 * a pinned background task can freeze web requests too (see `spring.threads.virtual` in
 * application.yml). Speech's Gemini calls are bounded separately by QuestionSpeech.
 */
@Configuration
class BackgroundWorkConfig {
    @Bean(name = ["interviewBackgroundExecutor"])
    fun interviewBackgroundExecutor(): TaskExecutor =
        SimpleAsyncTaskExecutor("interview-bg-").apply {
            setVirtualThreads(false)
            setConcurrencyLimit(MAX_CONCURRENT_BACKGROUND_TASKS)
            setTaskTerminationTimeout(110_000)
            setCancelRemainingTasksOnClose(false)
        }

    @Bean(name = ["interviewSpeechExecutor"])
    fun interviewSpeechExecutor(): TaskExecutor = boundedExecutor("interview-speech-", MAX_CONCURRENT_SPEECH_TASKS)

    private fun boundedExecutor(
        prefix: String,
        limit: Int,
    ): TaskExecutor =
        SimpleAsyncTaskExecutor(prefix).apply {
            setVirtualThreads(false)
            setConcurrencyLimit(limit)
            setRejectTasksWhenLimitReached(true)
            // During a deploy, let accepted work finish before the process exits. A
            // crashed process still stops renewing its database leases immediately.
            setTaskTerminationTimeout(110_000)
            setCancelRemainingTasksOnClose(false)
        }

    private companion object {
        const val MAX_CONCURRENT_BACKGROUND_TASKS = 32
        const val MAX_CONCURRENT_SPEECH_TASKS = 32
    }
}
