package com.interviewos.api.ai

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Gemini configuration shared by every Gemini provider. The reasoning models actually used are
 * the `interviewos.ai.providers` chain in `application.yml` (`GEMINI_PRIMARY_MODEL`,
 * `GEMINI_FALLBACK_MODEL`); [reasoningModel] is only the single-model default when no chain is
 * configured. [speechModel] is the interviewer's voice. Model lifecycle notes:
 * `docs/model-lifecycle.md`.
 */
@ConfigurationProperties(prefix = "interviewos.gemini")
data class GeminiProperties(
    val apiKey: String = "",
    val baseUrl: String = "https://generativelanguage.googleapis.com/v1beta",
    val reasoningModel: String = "gemini-3.6-flash",
    val speechModel: String = "gemini-3.8-flash-lite-tts",
    /** One of Gemini's prebuilt TTS voices. */
    val voiceName: String = "Kore",
    /**
     * Whether requests carry a `temperature` (interviewer design review, step 3). Google advises
     * removing temperature, topP and topK from Gemini 3.x requests. True keeps today's settings;
     * set `interviewos.gemini.send-sampling-params: false` to stop sending them.
     */
    val sendSamplingParams: Boolean = true,
) {
    val configured: Boolean
        get() = apiKey.isNotBlank()
}
