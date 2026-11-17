package com.interviewos.api.interview

import com.interviewos.api.ai.AiSpendContext
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.SpeechChunks
import com.interviewos.api.ai.SpokenAudio
import com.interviewos.api.ai.WavAudio
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.task.TaskExecutor
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CancellationException
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

/** Whether a question's voice is still rendering, ready to play, or never coming. */
enum class SpeechStatus(
    val dbValue: String,
) {
    PENDING("pending"),
    READY("ready"),
    UNAVAILABLE("unavailable"),
    ;

    companion object {
        fun fromDbValue(value: String?): SpeechStatus = entries.firstOrNull { it.dbValue == value } ?: UNAVAILABLE
    }
}

/**
 * Renders the interviewer's voice, off the critical path.
 *
 * Speech used to be synthesised inline, between the candidate finishing an answer and
 * the next question reaching them — roughly half of a measured 24-second turn, spent
 * making audio the candidate had not yet been given a reason to want. The question text
 * now returns the moment it exists and the voice catches up, usually while they are
 * still reading it.
 *
 * Two rules hold this together:
 *
 * - **The work is scheduled after the transaction commits.** The row this writes to is
 *   inserted by the caller's transaction; starting before that commits would race a
 *   background thread against a row it cannot yet see.
 * - **Failure is terminal but harmless.** A turn whose speech fails is marked
 *   `unavailable` and runs as written text. It must never leave the room waiting on a
 *   voice that is not coming, and it must never fail a round — the transcript is what
 *   the report is built from, not the audio.
 */
@Component
class QuestionSpeech(
    private val interviewAi: InterviewAi,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val compressor: QuestionAudioCompressor,
    private val repository: SessionRepository,
    private val events: InterviewEventRecorder,
    @Qualifier("interviewSpeechExecutor") private val executor: TaskExecutor,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val geminiSpeechPermits = Semaphore(MAX_CONCURRENT_GEMINI_SPEECH_CALLS)

    /**
     * Speaks [text] for a turn already written by the calling transaction, once that
     * transaction commits. Outside a transaction it runs immediately, which is what the
     * tests and any non-transactional caller want.
     */
    fun render(request: SpeechRequest) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            dispatch(request)
            return
        }
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                override fun afterCommit() = dispatch(request)
            },
        )
    }

    private fun dispatch(request: SpeechRequest) {
        try {
            executor.execute { renderNow(request) }
        } catch (e: RejectedExecutionException) {
            log.warn("Speech capacity reached for session {} turn {}; continuing as text", request.sessionId, request.turnIndex)
            // A rejected task must not leave the browser polling `pending` indefinitely.
            runCatching {
                repository.setQuestionSpeech(request.sessionId, request.userId, request.turnIndex, null, SpeechStatus.UNAVAILABLE)
            }.onFailure { log.error("Could not mark rejected speech unavailable for session {}", request.sessionId, it) }
        }
    }

    private fun renderNow(request: SpeechRequest) {
        val startedAt = System.nanoTime()
        events.record(
            InterviewEvent(
                userId = request.userId,
                sessionId = request.sessionId,
                type = "question_speech_started",
                turnIndex = request.turnIndex,
                provider = interviewAi.providerName,
                operation = "synthesizeSpeech",
                outcome = "started",
            ),
        )
        log
            .atInfo()
            .addKeyValue("event", "question_speech_started")
            .addKeyValue("session_id", request.sessionId)
            .addKeyValue("turn_index", request.turnIndex)
            .addKeyValue("provider", interviewAi.providerName)
            .log("Question speech rendering started")

        val path =
            try {
                val spoken = compressor.compress(speak(request))
                val extension =
                    when (spoken.mimeType.substringBefore(';').lowercase()) {
                        "audio/mpeg" -> "mp3"
                        "audio/ogg" -> "ogg"
                        "audio/wav" -> "wav"
                        else -> "audio"
                    }
                val objectPath = "${request.userId}/${request.sessionId}/turn-${request.turnIndex}-question.$extension"
                storage.upload(storageProperties.mediaBucket, objectPath, spoken.audio, spoken.mimeType)
                objectPath
            } catch (e: RuntimeException) {
                val cause = rootCause(e)
                events.record(
                    InterviewEvent(
                        userId = request.userId,
                        sessionId = request.sessionId,
                        type = "question_speech_failed",
                        turnIndex = request.turnIndex,
                        provider = interviewAi.providerName,
                        operation = "synthesizeSpeech",
                        outcome = "failed",
                        errorType =
                            if (cause is com.interviewos.api.storage.ObjectStorageException) {
                                "storage_unavailable"
                            } else {
                                "ai_unavailable"
                            },
                        durationMs = elapsedMillis(startedAt),
                    ),
                )
                log
                    .atWarn()
                    .setCause(cause)
                    .addKeyValue("event", "question_speech_failed")
                    .addKeyValue("session_id", request.sessionId)
                    .addKeyValue("turn_index", request.turnIndex)
                    .addKeyValue("provider", interviewAi.providerName)
                    .addKeyValue("duration_ms", elapsedMillis(startedAt))
                    .addKeyValue("error_type", cause.javaClass.simpleName)
                    .log("Question speech failed; the turn will continue as text")
                null
            }

        val status = if (path != null) SpeechStatus.READY else SpeechStatus.UNAVAILABLE
        try {
            repository.setQuestionSpeech(
                sessionId = request.sessionId,
                userId = request.userId,
                turnIndex = request.turnIndex,
                audioPath = path,
                status = status,
            )
            if (status == SpeechStatus.READY) {
                events.record(
                    InterviewEvent(
                        userId = request.userId,
                        sessionId = request.sessionId,
                        type = "question_speech_succeeded",
                        turnIndex = request.turnIndex,
                        provider = interviewAi.providerName,
                        operation = "synthesizeSpeech",
                        outcome = "succeeded",
                        durationMs = elapsedMillis(startedAt),
                    ),
                )
            }
            log
                .atInfo()
                .addKeyValue("event", "question_speech_finished")
                .addKeyValue("session_id", request.sessionId)
                .addKeyValue("turn_index", request.turnIndex)
                .addKeyValue("provider", interviewAi.providerName)
                .addKeyValue("duration_ms", elapsedMillis(startedAt))
                .addKeyValue("status", status.dbValue)
                .log("Question speech rendering finished")
        } catch (e: RuntimeException) {
            events.record(
                InterviewEvent(
                    userId = request.userId,
                    sessionId = request.sessionId,
                    type = "question_speech_state_write_failed",
                    turnIndex = request.turnIndex,
                    provider = interviewAi.providerName,
                    operation = "synthesizeSpeech",
                    outcome = "failed",
                    errorType = "database_write_failed",
                    durationMs = elapsedMillis(startedAt),
                ),
            )
            // The room polls while a turn is `pending`. Losing this write would leave it
            // polling forever, so it is worth a line in the log even though the round is
            // unaffected — the candidate still has the question in writing.
            log
                .atError()
                .setCause(e)
                .addKeyValue("event", "question_speech_state_write_failed")
                .addKeyValue("session_id", request.sessionId)
                .addKeyValue("turn_index", request.turnIndex)
                .addKeyValue("duration_ms", elapsedMillis(startedAt))
                .addKeyValue("status", status.dbValue)
                .addKeyValue("error_type", e.javaClass.simpleName)
                .log("Could not record terminal question speech state")
        }
    }

    private fun rootCause(error: RuntimeException): Throwable = generateSequence<Throwable>(error) { it.cause }.last()

    private fun elapsedMillis(startedAt: Long): Long = (System.nanoTime() - startedAt) / 1_000_000

    /**
     * The question, spoken.
     *
     * Gemini's speech latency scales with the length of the text — 4.7s for a sentence
     * against 14.5s for a paragraph, measured against the live API. A long question is
     * therefore synthesised a sentence at a time, in parallel, and the clips are joined
     * before anything is stored: the candidate waits for the slowest sentence rather than
     * for their sum, and the room still gets one file.
     *
     * A single chunk takes the direct path, so the common case adds nothing.
     */
    private fun speak(request: SpeechRequest): SpokenAudio {
        val text = request.text
        val language = request.language
        val chunks = SpeechChunks.split(text)
        // Attribution is re-established per call rather than inherited. This method is
        // already on a background thread, and the parallel path below puts each chunk on
        // a different one again, so nothing survives from the request that started it.
        // Speech is the single most expensive thing in a round, and spend that cannot be
        // traced to a session is the exact gap this ledger exists to close.
        val attributed = { block: () -> SpokenAudio -> AiSpendContext.of(request.userId, request.sessionId, block) }

        if (chunks.size == 1) return withGeminiPermit { attributed { interviewAi.synthesizeSpeech(text, language).value } }

        val spoken =
            Executors.newThreadPerTaskExecutor(Thread.ofPlatform().name("speech-chunk-", 0).factory()).let { chunkExecutor ->
                try {
                    val calls =
                        chunks.map { chunk ->
                            Callable { withGeminiPermit { attributed { interviewAi.synthesizeSpeech(chunk, language).value } } }
                        }
                    val futures = chunkExecutor.invokeAll(calls, CHUNK_WAIT_SECONDS, TimeUnit.SECONDS)
                    futures.map { it.get() }
                } catch (e: ExecutionException) {
                    throw IllegalStateException("Speech chunk failed", e.cause ?: e)
                } catch (e: CancellationException) {
                    throw IllegalStateException("Speech chunks timed out", e)
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    throw IllegalStateException("Speech chunks interrupted", e)
                } finally {
                    // `close()` waits for tasks that ignore interruption. A timed-out
                    // provider must not hold the speech slot until its own long timeout.
                    chunkExecutor.shutdownNow()
                }
            }

        // Any chunk arriving as something other than WAV means the assumption behind
        // joining them no longer holds, so the whole question is spoken in one call
        // instead of stitching containers that may not match.
        if (spoken.any { it.mimeType != "audio/wav" }) {
            log.warn("Speech chunks came back as {}; falling back to one call", spoken.map { it.mimeType }.distinct())
            return withGeminiPermit { attributed { interviewAi.synthesizeSpeech(text, language).value } }
        }

        return SpokenAudio(WavAudio.join(spoken.map { it.audio }), "audio/wav")
    }

    private fun <T> withGeminiPermit(block: () -> T): T {
        val acquired =
            try {
                geminiSpeechPermits.tryAcquire(PERMIT_WAIT_SECONDS, TimeUnit.SECONDS)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                throw IllegalStateException("Speech interrupted", e)
            }
        if (!acquired) {
            throw IllegalStateException("Speech capacity reached")
        }
        try {
            return block()
        } finally {
            geminiSpeechPermits.release()
        }
    }

    private companion object {
        const val MAX_CONCURRENT_GEMINI_SPEECH_CALLS = 16
        const val PERMIT_WAIT_SECONDS = 2L
        const val CHUNK_WAIT_SECONDS = 60L
    }
}

data class SpeechRequest(
    val userId: UUID,
    val sessionId: UUID,
    val turnIndex: Int,
    val text: String,
    val language: String,
)
