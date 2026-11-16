package com.interviewos.api.ai

import com.interviewos.api.common.ContentTypes
import org.slf4j.LoggerFactory
import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.net.SocketTimeoutException
import java.net.http.HttpTimeoutException
import java.time.Duration
import java.util.Base64

/**
 * Google Gemini as the whole interview loop's AI: resume parsing and answer
 * understanding and scoring on `gemini-3.5-flash`, the interviewer's spoken voice on
 * `gemini-3.8-flash-lite-tts`. Prompts and response schemas live in
 * `src/main/resources/ai/` so they are reviewable in version control, not buried in
 * string literals.
 *
 * This class is the boundary. Everything it returns is mocked in tests — no test calls
 * a live model. When the key is absent or a call fails, it raises
 * [AiUnavailableException] so callers can degrade honestly rather than fake a result.
 */
class GeminiInterviewAi(
    private val properties: GeminiProperties,
    private val prompts: PromptLibrary,
    private val objectMapper: ObjectMapper,
    restClientBuilder: RestClient.Builder,
    /**
     * Which Gemini model this instance uses for reasoning.
     *
     * Passed in rather than read from configuration, so one fallback chain can hold
     * several Gemini tiers — a cheap one first and a stronger one behind it, both able to
     * hear a recording, which no text-only fallback can.
     */
    private val reasoningModel: String,
    /**
     * How long a call the candidate is waiting on mid-round may take here before the chain
     * moves on, or null for the shared timeout. See [InRoomDeadline].
     */
    private val inRoomTimeout: Duration? = null,
    private val recorder: AiSpendRecorder = AiSpendRecorder.NONE,
    /**
     * The Gemini 3.x thinking level for in-room calls, sent instead of the numeric budget, or null
     * to keep the budget. See [ProviderConfig.thinkingLevel].
     */
    private val inRoomThinkingLevel: String? = null,
) : InterviewAi {
    private val log = LoggerFactory.getLogger(javaClass)
    private val restClient = restClientBuilder.build()

    init {
        require(inRoomThinkingLevel == null || inRoomThinkingLevel in THINKING_LEVELS) {
            "Unknown Gemini thinking level '$inRoomThinkingLevel' for $reasoningModel; expected one of $THINKING_LEVELS."
        }
    }

    /**
     * Temperature, unless sampling parameters are switched off (design review, step 3: Google
     * advises leaving temperature, topP and topK at their defaults on Gemini 3.x). Off, nothing is
     * sent and the model's default applies. topP and topK have never been sent.
     */
    private fun MutableMap<String, Any>.temperature(value: Number) {
        if (properties.sendSamplingParams) put("temperature", value)
    }

    /**
     * For the calls a candidate sits in silence through: the question, the assessment of
     * their answer, a hint, and the interviewer's voice. Everything else — the report above
     * all — keeps the long timeout.
     */
    private val inRoomClient: RestClient = inRoomTimeout?.let { InRoomDeadline.client(restClientBuilder, it) } ?: restClient

    override val providerName: String = "gemini ($reasoningModel)"

    override fun operationIdentity(
        capability: AiCapability,
        model: String?,
    ): String? =
        when (capability) {
            AiCapability.SPEECH_SYNTHESIS -> "${properties.baseUrl}/models/${properties.speechModel}"
            AiCapability.TEXT_EMBEDDING -> model?.let { "${properties.baseUrl}/models/$it" }
            else -> null
        }

    /**
     * Gemini is the only configured provider that can hear a recording or read a PDF, so
     * it is the only possible home for answer assessment and resume parsing. A text-only
     * fallback can take the rest.
     */
    override val capabilities: Set<AiCapability> =
        setOf(
            AiCapability.STRUCTURED_TEXT,
            AiCapability.AUDIO_UNDERSTANDING,
            AiCapability.DOCUMENT_UNDERSTANDING,
            AiCapability.SPEECH_SYNTHESIS,
            AiCapability.CODE_EXECUTION,
            AiCapability.TEXT_EMBEDDING,
            AiCapability.WEB_GROUNDING,
        )

    override fun parseResume(file: ResumeFile): AiResult<ParsedResume> {
        val prompt = prompts.resumeParse()
        val parts =
            listOf(
                textPart(prompt),
                inlineDataPart(file.contentType, file.bytes),
            )
        val (node, usage) = generateJson(reasoningModel, parts, prompts.schema("resume-parse"))
        return decodedResult(node, usage, ParsedResume::class.java)
    }

    override fun synthesizeSpeech(
        text: String,
        language: String,
    ): AiResult<SpokenAudio> {
        requireConfigured()
        val body =
            mapOf(
                "contents" to listOf(mapOf("parts" to listOf(mapOf("text" to text)))),
                "generationConfig" to
                    mapOf(
                        "responseModalities" to listOf("AUDIO"),
                        "speechConfig" to
                            mapOf(
                                "voiceConfig" to
                                    mapOf(
                                        "prebuiltVoiceConfig" to mapOf("voiceName" to properties.voiceName),
                                    ),
                            ),
                    ),
            )
        val response = call(properties.speechModel, body, client = inRoomClient)
        val inline =
            response
                .path("candidates")
                .path(0)
                .path("content")
                .path("parts")
                .path(0)
                .path("inlineData")
        val data = inline.path("data").asString()
        val mimeType = inline.path("mimeType").asString()?.takeIf { it.isNotBlank() } ?: "audio/L16;rate=24000"
        return billedResult(response, properties.speechModel) {
            if (data.isNullOrBlank()) {
                throw AiUnavailableException(
                    "Gemini returned no audio for the question.",
                    reason = AiFailureReason.EMPTY_RESPONSE,
                    finishReason = finishReasonOf(response),
                )
            }
            playable(Base64.getDecoder().decode(data), mimeType)
        }
    }

    /**
     * Speech leaves here in a form a browser can actually play. Gemini returns headerless
     * PCM, which every `<audio>` element refuses, so it is wrapped in a WAV container
     * before anyone stores or signs a URL for it.
     */
    private fun playable(
        bytes: ByteArray,
        mimeType: String,
    ): SpokenAudio =
        if (WavAudio.isRawPcm(mimeType)) {
            SpokenAudio(WavAudio.wrap(bytes, WavAudio.sampleRateOf(mimeType)), "audio/wav")
        } else {
            SpokenAudio(bytes, ContentTypes.base(mimeType))
        }

    override fun composeRound(query: String): AiResult<ComposedRound> {
        val prompt = prompts.composeRound(query)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("compose-round"))
        return decodedResult(node, usage, ComposedRound::class.java)
    }

    override fun composeProblem(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedProblem> {
        val prompt = prompts.composeProblem(brief, durationMinutes)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("compose-problem"))
        return decodedResult(node, usage, ComposedProblem::class.java)
    }

    override fun composeCase(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedCase> {
        val prompt = prompts.composeCase(brief, durationMinutes)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("compose-case"))
        return decodedResult(node, usage, ComposedCase::class.java)
    }

    /**
     * Runs [program] with Gemini's code-execution tool.
     *
     * The model has to retype the program to run it — there is no "execute this verbatim"
     * call — so what it ran is not guaranteed to be what it was given. The caller checks
     * that from inside the program (it prints hashes of what it is running), rather than
     * this method trying to compare code text the model may have reflowed.
     *
     * Measured on `gemini-3.1-flash-lite` against two real problems: 3.2–3.6s per run, and
     * every embedded program ran byte for byte as sent.
     */
    override fun runPython(program: String): AiResult<SandboxRun> {
        requireConfigured()
        val body =
            mapOf(
                "contents" to
                    listOf(
                        mapOf(
                            "role" to "user",
                            "parts" to
                                listOf(
                                    textPart(
                                        "Execute the Python program below exactly as written, once, using your code " +
                                            "execution tool. Do not modify, reformat, shorten or fix it — copy it " +
                                            "character for character. After it runs, reply with the single word DONE." +
                                            "\n\n```python\n$program\n```",
                                    ),
                                ),
                        ),
                    ),
                "tools" to listOf(mapOf("codeExecution" to emptyMap<String, Any>())),
                "generationConfig" to buildMap<String, Any> { temperature(0) },
            )
        val response = call(reasoningModel, body)
        val outputs =
            response
                .path("candidates")
                .path(0)
                .path("content")
                .path("parts")
                .filter { it.has("codeExecutionResult") }
                .map { it.path("codeExecutionResult").path("output").asString() ?: "" }
        return billedResult(response, reasoningModel) {
            if (outputs.isEmpty()) {
                throw AiUnavailableException(
                    "Gemini did not run the program on $reasoningModel.",
                    reason = AiFailureReason.EMPTY_RESPONSE,
                    finishReason = finishReasonOf(response),
                )
            }
            SandboxRun(outputs)
        }
    }

    override fun composeOpeningQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): AiResult<AskedQuestion> {
        val prompt = prompts.openingQuestion(brief, round)
        val (node, usage) =
            generateJson(
                reasoningModel,
                listOf(textPart(prompt)),
                prompts.schema("opening-question"),
                Thinking.IN_THE_ROOM,
                inRoomClient,
            )
        return decodedResult(node, usage, AskedQuestion::class.java)
    }

    override fun assessAnswer(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
    ): AiResult<AnswerAssessment> {
        val prompt = prompts.assessAnswer(brief, round, priorTurns, currentQuestion)

        val parts = listOf(textPart(prompt), inlineDataPart(answer.contentType, answer.bytes))
        val (node, usage) = generateJson(reasoningModel, parts, prompts.schema(round.variant.resource), Thinking.IN_THE_ROOM, inRoomClient)
        return decodedResult(node, usage, AnswerAssessment::class.java)
    }

    override fun offerHint(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): AiResult<OfferedHint> {
        val prompt = prompts.offerHint(brief, round, priorTurns, currentQuestion)
        val (node, usage) =
            generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("offer-hint"), Thinking.IN_THE_ROOM, inRoomClient)
        return decodedResult(node, usage, OfferedHint::class.java)
    }

    override fun extractQuestions(source: SourceDocument): AiResult<ExtractedQuestions> {
        val prompt = prompts.extractQuestions(source)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("extract-questions"))
        return decodedResult(node, usage, ExtractedQuestions::class.java)
    }

    override fun composeLoopPattern(
        archetype: String,
        roleFamily: String,
        level: String,
    ): AiResult<GeneralLoopPattern> {
        val prompt = prompts.loopPattern(archetype, roleFamily, level)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("general-loop-pattern"))
        return decodedResult(node, usage, GeneralLoopPattern::class.java)
    }

    /**
     * Search-grounded, and so the one call that is plain text rather than JSON: Gemini
     * does not combine a response schema with the search tool on every model in the
     * chain. Structure comes from the grounding metadata instead, which is better
     * evidence than any schema — see [GroundedAnswer].
     */
    override fun researchEmployerLoop(
        companyName: String,
        roleFamily: String,
        level: String,
    ): AiResult<GroundedEmployerLoop> {
        requireConfigured()
        val body =
            mapOf(
                "contents" to
                    listOf(
                        mapOf(
                            "role" to "user",
                            "parts" to listOf(textPart(prompts.publicEmployerLoop(companyName, roleFamily, level))),
                        ),
                    ),
                "tools" to listOf(mapOf("googleSearch" to emptyMap<String, Any>())),
                "generationConfig" to buildMap<String, Any> { temperature(0.2) },
            )
        val response = call(reasoningModel, body)
        val candidate = response.path("candidates").path(0)
        return billedResult(response, reasoningModel) {
            if (candidate.isMissingNode) {
                throw AiUnavailableException(
                    "Gemini returned no answer to the employer search on $reasoningModel.",
                    reason = AiFailureReason.EMPTY_RESPONSE,
                    finishReason = finishReasonOf(response),
                )
            }
            GroundedAnswer.read(candidate)
        }
    }

    override fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent> {
        val prompt = prompts.report(brief, transcript)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("report"))
        return decodedResult(node, usage, ReportContent::class.java)
    }

    override fun assessEmployerKnowledge(
        companyName: String,
        archetype: String,
    ): AiResult<EmployerKnowledge> {
        val prompt = prompts.employerKnowledge(companyName, archetype)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("employer-knowledge"))
        return decodedResult(node, usage, EmployerKnowledge::class.java)
    }

    override fun generatePoolQuestions(request: PoolQuestionRequest): AiResult<GeneratedQuestions> {
        val prompt = prompts.poolQuestions(request)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("pool-questions"))
        return decodedResult(node, usage, GeneratedQuestions::class.java)
    }

    /**
     * Embeds a batch in one request.
     *
     * `SEMANTIC_SIMILARITY` rather than the retrieval task types, because the question
     * being asked of these vectors is symmetric — is this question the same question as
     * that one — rather than "does this document answer this query".
     *
     * **Token usage is best effort here, and that is a real gap.** The embed endpoints do
     * not consistently report `usageMetadata`, so an embedding call can land in the ledger
     * costing zero. It is the cheapest call the product makes by a wide margin, so a run's
     * spend cap is still governed almost entirely by generation — but a pool run's
     * recorded cost is a floor rather than an exact figure, and the ledger should be read
     * that way.
     */
    override fun embed(
        texts: List<String>,
        model: String,
        dimensions: Int,
    ): AiResult<TextEmbeddings> {
        requireConfigured()
        if (texts.isEmpty()) return AiResult(TextEmbeddings(emptyList(), model), AiUsage.none(model))

        val body =
            mapOf(
                "requests" to
                    texts.map { text ->
                        mapOf(
                            "model" to "models/$model",
                            "content" to mapOf("parts" to listOf(mapOf("text" to text))),
                            "taskType" to "SEMANTIC_SIMILARITY",
                            "outputDimensionality" to dimensions,
                        )
                    },
            )
        val response = call(model, body, method = "batchEmbedContents")
        return billedResult(response, model) { readEmbeddings(response, model, texts.size, dimensions) }
    }

    private fun readEmbeddings(
        response: JsonNode,
        model: String,
        expectedCount: Int,
        dimensions: Int,
    ): TextEmbeddings {
        val embeddings = response.path("embeddings")
        val vectors = ArrayList<FloatArray>(embeddings.size())
        for (index in 0 until embeddings.size()) {
            val values = embeddings.path(index).path("values")
            if (!values.isArray || values.isEmpty) {
                throw AiUnavailableException("Gemini returned an empty embedding from $model.", reason = AiFailureReason.DECODE_FAILED)
            }
            vectors += FloatArray(values.size()) { i -> values.path(i).asDouble(0.0).toFloat() }
        }
        if (vectors.size != expectedCount) {
            // Silently short would mis-pair every vector after the gap with the wrong
            // question, and a deduplicator comparing the wrong things drops real questions
            // and keeps duplicates — so this fails rather than guesses.
            throw AiUnavailableException(
                "Gemini embedded ${vectors.size} of $expectedCount texts on $model.",
                reason = AiFailureReason.DECODE_FAILED,
            )
        }
        vectors.firstOrNull()?.let {
            if (it.size != dimensions) {
                throw AiUnavailableException(
                    "Gemini returned ${it.size}-dimension embeddings from $model; the pool column holds $dimensions.",
                    reason = AiFailureReason.DECODE_FAILED,
                )
            }
        }
        return TextEmbeddings(vectors, model)
    }

    // ---------------------------------------------------------------------------
    // HTTP + parsing
    // ---------------------------------------------------------------------------

    private fun <T> billedResult(
        response: JsonNode,
        model: String,
        read: () -> T,
    ): AiResult<T> {
        val usage = usageOf(response, model)
        return try {
            AiResult(read(), usage)
        } catch (ex: RuntimeException) {
            recordFailedAiCall(recorder, providerName, usage)
            throw ex
        }
    }

    /**
     * @param thinkingBudget tokens the model may spend reasoning before it answers, or
     *   null to leave it unbounded. See [Thinking].
     */
    private fun <T> decodedResult(
        node: JsonNode,
        usage: AiUsage,
        type: Class<T>,
    ): AiResult<T> =
        try {
            AiResult(objectMapper.treeToValue(node, type), usage)
        } catch (ex: RuntimeException) {
            recordFailedAiCall(recorder, providerName, usage)
            throw AiUnavailableException(
                "Gemini returned an unusable ${type.simpleName} response.",
                ex,
                reason = AiFailureReason.DECODE_FAILED,
                finishReason = usage.finishReason,
            )
        }

    private fun generateJson(
        model: String,
        parts: List<Map<String, Any>>,
        responseSchema: JsonNode,
        thinkingBudget: Int? = null,
        client: RestClient = restClient,
    ): Pair<JsonNode, AiUsage> {
        requireConfigured()
        val body =
            mapOf(
                "contents" to listOf(mapOf("role" to "user", "parts" to parts)),
                "generationConfig" to
                    buildMap<String, Any> {
                        put("responseMimeType", "application/json")
                        put("responseSchema", responseSchema)
                        temperature(0.7)
                        // A level or a budget, never both: the two together are a 400.
                        thinkingBudget?.let {
                            put(
                                "thinkingConfig",
                                inRoomThinkingLevel?.let { level -> mapOf("thinkingLevel" to level) } ?: mapOf("thinkingBudget" to it),
                            )
                        }
                    },
            )
        for (attempt in 1..2) {
            val response = call(model, body, client = client)
            val text =
                response
                    .path("candidates")
                    .path(0)
                    .path("content")
                    .path("parts")
                    .path(0)
                    .path("text")
                    .asString()
            if (text.isNullOrBlank()) {
                recordFailedAiCall(recorder, providerName, usageOf(response, model))
                throw AiUnavailableException(
                    "Gemini returned an empty response for $model.",
                    reason = AiFailureReason.EMPTY_RESPONSE,
                    finishReason = finishReasonOf(response),
                )
            }
            val parsed = runCatching { objectMapper.readTree(text) }
            if (parsed.isSuccess) return parsed.getOrThrow() to usageOf(response, model)
            recordFailedAiCall(recorder, providerName, usageOf(response, model))
            if (attempt == 2) {
                throw AiUnavailableException(
                    "Gemini returned malformed JSON for $model twice.",
                    parsed.exceptionOrNull(),
                    reason = AiFailureReason.MALFORMED_JSON,
                    finishReason = finishReasonOf(response),
                )
            }
            log.warn("Gemini returned malformed JSON for {}; retrying the same model once", model)
        }
        error("The JSON response loop must return or throw")
    }

    /**
     * @param method the model method to call. Everything in the interview loop is
     *   `generateContent`; the pool's deduplicator is the one caller that needs another
     *   endpoint on the same host, with the same key and the same error handling.
     */
    private fun call(
        model: String,
        body: Map<String, Any>,
        method: String = "generateContent",
        client: RestClient = restClient,
    ): JsonNode =
        try {
            client
                .post()
                .uri("${properties.baseUrl}/models/$model:$method")
                .header("x-goog-api-key", properties.apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode::class.java)
                ?: throw AiUnavailableException("Gemini returned no body for $model.", reason = AiFailureReason.EMPTY_RESPONSE)
        } catch (ex: HttpClientErrorException.TooManyRequests) {
            // Worth telling apart from every other failure. A 429 here is usually the
            // project's spend cap rather than request rate, and the two need completely
            // different actions from whoever reads the log: one is "wait", the other is
            // "go and raise the cap". Being told only that the model "failed" sends them
            // looking for a bug that is not there.
            val quota = ex.responseBodyAsString.contains("spending cap", ignoreCase = true)
            throw AiUnavailableException(
                if (quota) {
                    "Gemini refused the request: the project has exceeded its spend cap. " +
                        "Raise it at https://ai.studio/spend — this is billing, not a fault in the request."
                } else {
                    "Gemini is rate-limiting requests to $model."
                },
                ex,
                reason = if (quota) AiFailureReason.SPEND_CAP else AiFailureReason.RATE_LIMITED,
            )
        } catch (ex: HttpClientErrorException.NotFound) {
            // A retired model, almost always. It is worth shouting about because it does
            // not look like a fault: the chain simply serves every call from whatever sits
            // behind it, which is the expensive model, and the product carries on working
            // while the bill quietly multiplies. That happened — `gemini-2.5-flash-lite`
            // was retired overnight and nothing surfaced until somebody read the ledger.
            log.error(
                "Model {} does not exist. If it was retired, every call is now being served by the " +
                    "next provider in the chain at its price — change interviewos.ai.providers.",
                model,
                ex,
            )
            throw AiUnavailableException(
                "Gemini model $model is not available.",
                ex,
                worthRetryingElsewhere = false,
                reason = AiFailureReason.MODEL_NOT_FOUND,
            )
        } catch (ex: HttpClientErrorException) {
            throw AiUnavailableException(
                "Gemini rejected the request to $model: ${ex.statusCode}.",
                ex,
                worthRetryingElsewhere = ex.statusCode.value() == 408,
                reason = if (ex.statusCode.value() == 408) AiFailureReason.TIMEOUT else AiFailureReason.REQUEST_REJECTED,
            )
        } catch (ex: ResourceAccessException) {
            // Told apart so the log says "slow", not "broken": a deadline that fires is the
            // chain doing its job, and the next provider is already being asked.
            val timedOut = generateSequence<Throwable>(ex) { it.cause }.any { it is HttpTimeoutException || it is SocketTimeoutException }
            if (timedOut) recordFailedAiCall(recorder, providerName, estimatedInputUsage(model, body), estimated = true)
            throw AiUnavailableException(
                if (timedOut) "Gemini did not answer on $model in time." else "Gemini request to $model failed.",
                ex,
                reason = if (timedOut) AiFailureReason.TIMEOUT else AiFailureReason.UNREACHABLE,
            )
        } catch (ex: RestClientException) {
            throw AiUnavailableException(
                "Gemini request to $model failed.",
                ex,
                reason = if (ex is HttpServerErrorException) AiFailureReason.PROVIDER_ERROR else AiFailureReason.UNREACHABLE,
            )
        }

    private fun estimatedInputUsage(
        model: String,
        body: Map<String, Any>,
    ): AiUsage {
        fun textLength(value: Any?): Int =
            when (value) {
                is Map<*, *> -> {
                    value.entries.sumOf { (key, item) ->
                        if (key == "text") (item as? String)?.length ?: 0 else textLength(item)
                    }
                }

                is Iterable<*> -> {
                    value.sumOf(::textLength)
                }

                else -> {
                    0
                }
            }
        return AiUsage(model, (textLength(body["contents"]) / 4).coerceAtLeast(1), 0)
    }

    /**
     * Everything Gemini reports about what a call cost, not just the two obvious numbers.
     *
     * `candidatesTokenCount` is what the model said. `thoughtsTokenCount` is what it spent
     * getting there, it is billed at the same output rate, and it is reported in a
     * separate field — so reading only the first undercounts the bill on any call with
     * thinking left on. It undercounted this one: the report runs unbounded by design, and
     * `gemini-3.5-flash` was measured spending roughly as many tokens thinking as
     * answering. The recorded cost of every report written by that model is about half
     * what it actually was.
     *
     * Audio is pulled out of the prompt count because it is priced separately (3x text on
     * flash-lite), and cached input because it is priced far lower. Both arrive as a
     * per-modality breakdown that is simply absent on calls that have neither.
     *
     * `toolUsePromptTokenCount` is the same trap as thinking: a code-execution call feeds
     * the program's output back to the model as input, bills it as input, and reports it
     * outside `promptTokenCount`. Measured at 2,443 of them against a 1,015-token prompt.
     */
    private fun usageOf(
        response: JsonNode,
        model: String,
    ): AiUsage {
        val usage = response.path("usageMetadata")
        return AiUsage(
            model = model,
            promptTokens = usage.path("promptTokenCount").asInt(0) + usage.path("toolUsePromptTokenCount").asInt(0),
            outputTokens = usage.path("candidatesTokenCount").asInt(0),
            thoughtTokens = usage.path("thoughtsTokenCount").asInt(0),
            audioTokens = modalityTokens(usage.path("promptTokensDetails"), "AUDIO"),
            cachedTokens = usage.path("cachedContentTokenCount").asInt(0),
            finishReason = finishReasonOf(response),
        )
    }

    /**
     * Why generation stopped: `STOP` on a normal answer, `MAX_TOKENS` when the output was cut
     * off (the usual cause of malformed JSON), `SAFETY` and its relatives when it was withheld.
     * A prompt blocked before generation has no candidate at all, only `promptFeedback`.
     */
    private fun finishReasonOf(response: JsonNode): String? {
        val finish =
            response
                .path("candidates")
                .path(0)
                .path("finishReason")
                .asString()
                ?.takeIf { it.isNotBlank() }
        val blocked =
            response
                .path("promptFeedback")
                .path("blockReason")
                .asString()
                ?.takeIf { it.isNotBlank() }
                ?.let { "blocked_$it" }
        return AiFailureReason.normaliseFinishReason(finish ?: blocked)
    }

    private fun modalityTokens(
        details: JsonNode,
        modality: String,
    ): Int =
        details
            .takeIf { it.isArray }
            ?.firstOrNull { it.path("modality").asString() == modality }
            ?.path("tokenCount")
            ?.asInt(0)
            ?: 0

    /**
     * How long the model may think before answering.
     *
     * Measured against live Gemini on a real assessment, three runs each:
     *
     * | thinking  | latency | still challenged a weak answer |
     * |-----------|---------|--------------------------------|
     * | unbounded | 7.1s    | yes                            |
     * | 256       | 3.0s    | yes                            |
     * | 0         | 1.8s    | yes                            |
     *
     * Thinking was not buying quality on this call — every budget pushed back on
     * "it was mostly fine, nobody complained much", and the unbounded one was not the
     * sharpest of them. So the calls a candidate is sitting in silence waiting for do
     * not pay for it.
     *
     * The report is left unbounded deliberately: nobody is waiting on it in real time,
     * it reasons over a whole transcript rather than one answer, and it is the thing
     * they came for.
     *
     * **It is 128 rather than 0, and that is not a preference.** `gemini-3.5-flash-lite`
     * rejects a budget of zero outright — HTTP 400, `INVALID_ARGUMENT` — so the setting
     * that made the old model fast would have made the new one fail on every turn of every
     * round. And a 400 is indistinguishable from an outage to the fallback chain, so each
     * of those failures would have been quietly re-served by `gemini-3.5-flash` at five
     * times the price. Re-measured on the live API when the model changed:
     *
     * | model                 | budget | result                    |
     * |-----------------------|--------|---------------------------|
     * | gemini-3.5-flash-lite | 0      | **400, every time**       |
     * | gemini-3.5-flash-lite | 128    | 1.5s, ~230 thought tokens |
     * | gemini-3.5-flash      | 0      | 1.0s                      |
     * | gemini-3.5-flash      | 128    | 2.7s                      |
     *
     * 128 is the value that works on every model in the chain, and at 1.5s it is quicker
     * than the 1.8s the zero budget bought on the model this replaced. The floor is the
     * model's, not ours: it spends about 230 tokens whatever the number says.
     */
    private object Thinking {
        /** Anything the candidate waits on mid-round: the question, the follow-up, a hint. */
        const val IN_THE_ROOM = 128
    }

    private fun requireConfigured() {
        if (!properties.configured) {
            throw AiUnavailableException(
                "GEMINI_API_KEY is not set; the interview AI is unavailable.",
                reason = AiFailureReason.NOT_CONFIGURED,
            )
        }
    }

    private fun textPart(text: String): Map<String, Any> = mapOf("text" to text)

    private companion object {
        /**
         * Gemini caps a single request's inline payload at 20 MB. Answers are short, so a
         * take larger than this is a runaway recorder rather than a thorough candidate.
         */
        const val WARMUP_PHASE = "warm-up"
        const val CLOSING_PHASE = "closing"

        /** The values Gemini 3.x accepts for `thinkingLevel`, lower case as the REST examples write them. */
        val THINKING_LEVELS = setOf("minimal", "low", "medium", "high")
    }

    private fun inlineDataPart(
        contentType: String,
        bytes: ByteArray,
    ): Map<String, Any> =
        mapOf(
            "inlineData" to
                mapOf(
                    "mimeType" to contentType,
                    "data" to Base64.getEncoder().encodeToString(bytes),
                ),
        )

    private fun readResource(path: String): String = ClassPathResource(path).inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
}
