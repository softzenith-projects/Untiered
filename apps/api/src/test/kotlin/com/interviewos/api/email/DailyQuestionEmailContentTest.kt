package com.interviewos.api.email

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class DailyQuestionEmailContentTest {
    @Test
    fun `includes the complete question and options without an answer`() {
        val content = DailyQuestionEmailContent("What does this return?", listOf("One", "Two", "Three"), "Given this input")
        val text = content.asText("https://example.com/daily-challenge")

        assertTrue(text.contains("Given this input\n\nWhat does this return?"))
        assertTrue(text.contains("A. One\nB. Two\nC. Three"))
        assertTrue(text.contains("https://example.com/daily-challenge"))
        assertFalse(text.contains("Correct answer"))
    }
}
