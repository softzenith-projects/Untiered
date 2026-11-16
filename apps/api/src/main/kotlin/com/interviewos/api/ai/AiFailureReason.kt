package com.interviewos.api.ai

/**
 * Why a model call failed, as a fixed code.
 *
 * Every failure used to reach the interview ledger as `ai_unavailable`, which says that a
 * turn failed and nothing about whether to look at the network, the bill, the schema or the
 * model. These are the distinctions that change what somebody does next. They are codes, not
 * messages, because `interview_events` is content-free by design: an exception message can
 * carry a model's output, and that must never land there.
 *
 * The `dbValue`s are mirrored by the `reason` check constraint on `interview_events`
 * (migration `20261114200000_interview_event_reasons.sql`). Adding one here without adding
 * it there makes every event that carries it fail to write — silently, because the ledger
 * is best effort. `InterviewEventReasonsTest` holds the two lists together.
 */
enum class AiFailureReason(
    val dbValue: String,
) {
    /** The call outlived its deadline. The chain moves on; this is "slow", not "broken". */
    TIMEOUT("timeout"),

    /** 429 that is request rate. */
    RATE_LIMITED("rate_limited"),

    /** 429 that is the project's spend cap: billing, not a fault in the request. */
    SPEND_CAP("spend_cap"),

    /** 404 on the model: almost always a retired model id. */
    MODEL_NOT_FOUND("model_not_found"),

    /** Any other 4xx: our request is wrong, and will be wrong at the next provider too. */
    REQUEST_REJECTED("request_rejected"),

    /** 5xx: the provider is having problems. */
    PROVIDER_ERROR("provider_error"),

    /** No response at all, for a reason other than the deadline. */
    UNREACHABLE("unreachable"),

    /** A response with no text in it. The finish reason, when there is one, says why. */
    EMPTY_RESPONSE("empty_response"),

    /** Text that is not JSON — usually output cut off at the token limit. */
    MALFORMED_JSON("malformed_json"),

    /** Valid JSON in the wrong shape: a required field missing, or the wrong type. */
    DECODE_FAILED("decode_failed"),

    /** The provider cannot do this kind of call at all (a text-only model and an audio answer). */
    UNSUPPORTED("unsupported"),

    /** No key configured. */
    NOT_CONFIGURED("not_configured"),

    UNKNOWN("unknown"),
    ;

    companion object {
        const val MAX_FINISH_REASON = 40

        /**
         * A provider's finish reason, reduced to something safe to store: lower case, letters
         * and underscores, bounded. Gemini sends `STOP`, `MAX_TOKENS`, `SAFETY` and so on;
         * OpenAI-format providers send `stop`, `length`, `content_filter`. Anything else is
         * dropped rather than stored, so a provider cannot put free text in the ledger.
         */
        fun normaliseFinishReason(raw: String?): String? =
            raw
                ?.trim()
                ?.lowercase()
                ?.takeIf { it.isNotEmpty() && it.length <= MAX_FINISH_REASON && it.all { c -> c in 'a'..'z' || c == '_' } }
    }
}
