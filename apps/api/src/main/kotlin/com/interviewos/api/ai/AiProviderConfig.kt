package com.interviewos.api.ai

import com.interviewos.api.interview.EntitlementProperties
import com.interviewos.api.interview.InterviewEventRecorder
import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestClient
import tools.jackson.databind.ObjectMapper

/**
 * The ordered list of models the interview loop will try.
 *
 * Absent, it is one Gemini model and the behaviour is exactly what it was. Configured,
 * each entry is tried in order for calls it is able to serve — see [FallbackInterviewAi],
 * which is where the "able to serve" part is enforced.
 *
 * ```yaml
 * interviewos:
 *   ai:
 *     providers:
 *       - name: gemini-cheap
 *         kind: gemini
 *         model: gemini-2.5-flash-lite
 *       - name: gemini-strong
 *         kind: gemini
 *         model: gemini-3.5-flash
 *       - name: kimi
 *         kind: openai
 *         base-url: https://api.moonshot.ai/v1
 *         model: kimi-k2-0711-preview
 *         api-key: ${MOONSHOT_API_KEY:}
 * ```
 *
 * `kind: openai` means the OpenAI *wire format*, not OpenAI the vendor — Moonshot,
 * DeepSeek, Groq, OpenRouter and Together all speak it, so which one you get is decided
 * by `base-url` alone.
 */
@ConfigurationProperties(prefix = "interviewos.ai")
data class AiProviderProperties(
    val providers: List<ProviderConfig> = emptyList(),
)

@Configuration
class AiProviderConfig {
    private val log = LoggerFactory.getLogger(javaClass)

    @Bean
    fun dailyAiSpendGuard(
        properties: AiBudgetProperties,
        spend: AiSpendReadModel,
    ): DailyAiSpendGuard = DailyAiSpendGuard(properties, spend)

    @Bean
    fun userAiSpendGuard(
        properties: AiBudgetProperties,
        spend: AiSpendReadModel,
        entitlement: EntitlementProperties,
    ): UserAiSpendGuard = UserAiSpendGuard(properties, spend, entitlement.dayZone)

    @Bean
    fun interviewAi(
        properties: AiProviderProperties,
        gemini: GeminiProperties,
        prompts: PromptLibrary,
        objectMapper: ObjectMapper,
        restClientBuilder: RestClient.Builder,
        recorder: AiSpendRecorder,
        eventRecorder: InterviewEventRecorder,
        spendGuard: DailyAiSpendGuard,
    ): InterviewAi {
        val configured =
            properties.providers.mapNotNull { provider ->
                when (provider.kind.lowercase()) {
                    "gemini" -> {
                        GeminiInterviewAi(
                            properties = gemini,
                            prompts = prompts,
                            objectMapper = objectMapper,
                            restClientBuilder = restClientBuilder,
                            reasoningModel = provider.model.ifBlank { gemini.reasoningModel },
                            inRoomTimeout = provider.inRoomTimeout,
                            recorder = recorder,
                            inRoomThinkingLevel =
                                provider.thinkingLevel
                                    ?.trim()
                                    ?.lowercase()
                                    ?.takeIf { it.isNotEmpty() },
                        )
                    }

                    "openai", "openai-compatible" -> {
                        if (provider.configured) {
                            OpenAiCompatibleInterviewAi(provider, prompts, objectMapper, restClientBuilder, recorder)
                        } else {
                            // A provider with no key is not an error worth failing startup
                            // over — it is a slot somebody has not filled in yet. Skipping
                            // it silently would be worse, so it is named in the log.
                            log.warn("AI provider '{}' has no API key or model; skipping it", provider.name)
                            null
                        }
                    }

                    else -> {
                        log.warn("Unknown AI provider kind '{}' for '{}'; skipping it", provider.kind, provider.name)
                        null
                    }
                }
            }

        // Nothing configured means the single Gemini model this has always used. The
        // fallback chain is opt-in, and its absence changes no behaviour.
        val chain =
            configured.ifEmpty {
                listOf(
                    GeminiInterviewAi(
                        properties = gemini,
                        prompts = prompts,
                        objectMapper = objectMapper,
                        restClientBuilder = restClientBuilder,
                        reasoningModel = gemini.reasoningModel,
                        recorder = recorder,
                    ),
                )
            }

        val ai = FallbackInterviewAi(chain, recorder, eventRecorder, spendGuard)
        log.info("Interview AI will try, in order: {}", ai.providerName)
        warnAboutSingleMultimodalProvider(chain)
        return ai
    }

    /**
     * The gap worth knowing about before an outage rather than during one.
     *
     * Text-only providers cover most of the loop, but an answer carries the candidate's
     * recorded voice — so with one multimodal provider configured, a Gemini outage still
     * stops every interview mid-round even though reports and hints would keep working.
     * The cheapest fix is a second Gemini model, which costs nothing until it is used.
     */
    private fun warnAboutSingleMultimodalProvider(chain: List<InterviewAi>) {
        val multimodal = chain.count { AiCapability.AUDIO_UNDERSTANDING in it.capabilities }
        if (multimodal <= 1) {
            log.warn(
                "Only {} provider can understand a spoken answer, so a live round has no fallback. " +
                    "Adding a second `kind: gemini` entry with a different model would give it one.",
                multimodal,
            )
        }
    }
}
