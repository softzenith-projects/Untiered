package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/** The weekly unlock (contract "Module 10"): every module opens at 09:00 IST, a week apart. */
class ProgrammeScheduleTest {
    private val start = LocalDate.parse("2026-12-07")

    @Test
    fun `week one opens at 09 00 IST on the start date and is due a week later`() {
        assertEquals(Instant.parse("2026-12-07T03:30:00Z"), ProgrammeSchedule.opensAt(start, 1))
        assertEquals(Instant.parse("2026-12-14T03:30:00Z"), ProgrammeSchedule.dueAt(start, 1))
    }

    @Test
    fun `week n opens 7 times n minus 1 days after the start`() {
        assertEquals(Instant.parse("2026-12-14T03:30:00Z"), ProgrammeSchedule.opensAt(start, 2))
        assertEquals(Instant.parse("2027-01-04T03:30:00Z"), ProgrammeSchedule.opensAt(start, 5))
        assertEquals(Instant.parse("2027-02-22T03:30:00Z"), ProgrammeSchedule.opensAt(start, 12))
        for (week in 1..11) {
            assertEquals(ProgrammeSchedule.dueAt(start, week), ProgrammeSchedule.opensAt(start, week + 1), "week $week")
        }
    }

    @Test
    fun `India has no daylight saving, so every module is 09 00 IST and exactly 168 hours long`() {
        // Spans the March and November clock changes of Europe and North America.
        for (startsOn in listOf(LocalDate.parse("2027-03-01"), LocalDate.parse("2027-10-18"))) {
            for (week in 1..12) {
                val opens = ProgrammeSchedule.opensAt(startsOn, week)
                assertEquals(LocalTime.of(9, 0), opens.atZone(CampusEmailCopy.INDIA).toLocalTime(), "$startsOn week $week")
                assertEquals(LocalTime.of(3, 30), opens.atZone(java.time.ZoneOffset.UTC).toLocalTime(), "$startsOn week $week")
                assertEquals(Duration.ofHours(168), Duration.between(opens, ProgrammeSchedule.dueAt(startsOn, week)))
            }
        }
    }

    @Test
    fun `a week outside 1 to 12 is a programming error`() {
        assertThrows<IllegalArgumentException> { ProgrammeSchedule.opensAt(start, 0) }
        assertThrows<IllegalArgumentException> { ProgrammeSchedule.opensAt(start, 13) }
    }

    @Test
    fun `today is India's date`() {
        assertEquals(LocalDate.parse("2026-12-08"), ProgrammeSchedule.today(Instant.parse("2026-12-07T19:00:00Z")))
        assertEquals(LocalDate.parse("2026-12-07"), ProgrammeSchedule.today(Instant.parse("2026-12-07T18:00:00Z")))
    }

    @Test
    fun `a certificate id is stable per student and programme, and differs between them`() {
        val programme = UUID.fromString("0a000000-0000-0000-0000-0000000000a1")
        val member = UUID.fromString("0a000000-0000-0000-0000-0000000000d1")
        val id = ProgrammeSchedule.certificateId(programme, member)
        assertEquals(id, ProgrammeSchedule.certificateId(programme, member))
        assertTrue(Regex("^UT-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$").matches(id), id)
        assertNotEquals(id, ProgrammeSchedule.certificateId(programme, UUID.randomUUID()))
        assertNotEquals(id, ProgrammeSchedule.certificateId(UUID.randomUUID(), member))
    }
}
