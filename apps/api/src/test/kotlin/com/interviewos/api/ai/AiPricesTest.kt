package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * The arithmetic behind every cost figure this product reports.
 *
 * These are not tests of a formula for its own sake. Each one pins a mistake that had
 * already been made in the version this replaced: thinking tokens billed but not counted,
 * audio billed at the text rate, and an unrecognised model costing nothing at all.
 */
class AiPricesTest {
    @Test
    fun `a cheap call and the same call on the model behind it are an order of magnitude apart`() {
        val usage = AiUsage(model = "gemini-2.5-flash-lite", promptTokens = 2116, outputTokens = 1900)
        val same = usage.copy(model = "gemini-3.5-flash")

        val lite = AiPrices.microUsd(usage)
        val flash = AiPrices.microUsd(same)

        // 2116 text + 1900 output, at 0.10/0.40 against 1.50/9.00.
        assertEquals(972, lite)
        assertEquals(20_274, flash)
        assertTrue(flash > lite * 20, "the gap this ledger exists to expose was $flash vs $lite")
    }

    /**
     * The undercount that made the recorded cost of every report roughly half the real
     * one. Thinking is billed at the output rate and reported in its own field, so a
     * reader that takes `outputTokens` as the bill is wrong by exactly the thinking.
     */
    @Test
    fun `thinking is billed at the output rate, not free`() {
        val visible = AiUsage("gemini-3.5-flash", promptTokens = 2116, outputTokens = 1791)
        val withThinking = visible.copy(thoughtTokens = 1789)

        assertEquals(1791, visible.billedOutputTokens)
        assertEquals(3580, withThinking.billedOutputTokens)
        // The thinking alone costs more than the entire prompt.
        assertEquals(16_101, AiPrices.microUsd(withThinking) - AiPrices.microUsd(visible))
    }

    @Test
    fun `audio input is charged at the audio rate and taken out of the text count`() {
        val spoken = AiUsage("gemini-2.5-flash-lite", promptTokens = 3000, outputTokens = 0, audioTokens = 1000)

        assertEquals(2000, spoken.textTokens)
        // 2000 text at 0.10 + 1000 audio at 0.30, not 3000 at 0.10.
        assertEquals(500, AiPrices.microUsd(spoken))
    }

    @Test
    fun `cached input is charged at the cache rate and taken out of the text count`() {
        val cached = AiUsage("gemini-2.5-flash-lite", promptTokens = 3000, outputTokens = 0, cachedTokens = 2500)

        assertEquals(500, cached.textTokens)
        // 500 at 0.10 + 2500 at 0.01, against 300 with no cache at all.
        assertEquals(75, AiPrices.microUsd(cached))
    }

    /**
     * The rule that keeps this table honest as models come and go. Costing an unknown
     * model at zero is how the expensive one stayed invisible; an unpriced model must
     * look alarming, not free, so it is charged at the dearest tier until somebody
     * prices it properly.
     */
    @Test
    fun `a model nobody has priced is costed at the most expensive tier, never at zero`() {
        val unknown = AiUsage("gemini-9.9-something-new", promptTokens = 1000, outputTokens = 1000)

        assertFalse(AiPrices.isKnown("gemini-9.9-something-new"))
        assertTrue(AiPrices.microUsd(unknown) > 0)
        assertEquals(AiPrices.microUsd(unknown.copy(model = "gemini-3.5-flash")), AiPrices.microUsd(unknown))
    }

    @Test
    fun `a provider whose counts do not reconcile never produces a negative bill`() {
        val contradictory = AiUsage("gemini-2.5-flash-lite", promptTokens = 10, outputTokens = 0, audioTokens = 999)

        assertEquals(0, contradictory.textTokens)
        assertTrue(AiPrices.microUsd(contradictory) >= 0)
    }

    @Test
    fun `speech is priced on how long the interviewer talks`() {
        // 25 tokens per second of audio: a ten-second question is 250 output tokens.
        val tenSeconds = AiUsage("gemini-2.5-flash-preview-tts", promptTokens = 30, outputTokens = 250)

        assertTrue(AiPrices.isKnown("gemini-2.5-flash-preview-tts"))
        // 250 at $10/M dwarfs the 30-token prompt at $0.50/M — the bill is the talking.
        assertEquals(2515, AiPrices.microUsd(tenSeconds))
    }

    @Test
    fun `the current voice model is priced, not guessed`() {
        val tenSeconds = AiUsage("gemini-3.8-flash-lite-tts", promptTokens = 30, outputTokens = 250)

        assertTrue(AiPrices.isKnown("gemini-3.8-flash-lite-tts"))
        assertTrue(AiPrices.isKnown("gemini-3.8-flash-tts"))
        // 250 at $6/M plus 30 at $0.50/M.
        assertEquals(1515, AiPrices.microUsd(tenSeconds))
    }

    @Test
    fun `usages add up across a round without losing the parts that are priced separately`() {
        val first = AiUsage("gemini-2.5-flash-lite", 100, 10, thoughtTokens = 1, audioTokens = 20, cachedTokens = 30)
        val second = AiUsage("gemini-2.5-flash-lite", 200, 20, thoughtTokens = 2, audioTokens = 40, cachedTokens = 60)

        val total = first + second

        assertEquals(AiUsage("gemini-2.5-flash-lite", 300, 30, 3, 60, 90), total)
    }
}
