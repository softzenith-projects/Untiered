package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CampusValidationTest {
    @Test
    fun `slugs are normalised to lower case and must match the database rule`() {
        assertEquals("iit-bombay", CampusValidation.slug("  IIT-Bombay "))
        assertEquals("abc", CampusValidation.slug("abc"))
        assertEquals("a".repeat(60), CampusValidation.slug("a".repeat(60)))
        val bad = listOf(null, "", "ab", "-abc", "abc-", "a b c", "abc_def", "a".repeat(61), "abç")
        for (value in bad) {
            assertEquals("invalid_slug", assertThrows<ApiException>("slug $value") { CampusValidation.slug(value) }.code)
        }
    }

    @Test
    fun `department codes are upper-cased and limited to the database's alphabet`() {
        assertEquals("CSE", CampusValidation.departmentCode(" cse "))
        assertEquals("E&TC", CampusValidation.departmentCode("e&tc"))
        assertEquals("AI-ML", CampusValidation.departmentCode("AI-ML"))
        val bad = listOf(null, "", "C S E", "CSE/IT", "A".repeat(17), "CSÉ")
        for (value in bad) {
            val error = assertThrows<ApiException>("code $value") { CampusValidation.departmentCode(value) }
            assertEquals("invalid_department_code", error.code)
        }
    }

    @Test
    fun `graduation years and allowances are range checked`() {
        assertEquals(2027, CampusValidation.graduationYear(2027))
        assertThrows<ApiException> { CampusValidation.graduationYear(1999) }
        assertThrows<ApiException> { CampusValidation.graduationYear(2101) }
        assertThrows<ApiException> { CampusValidation.graduationYear(null) }
        assertEquals(0, CampusValidation.interviewAllowance(0))
        assertThrows<ApiException> { CampusValidation.interviewAllowance(-1) }
    }

    @Test
    fun `names are trimmed and length checked`() {
        assertEquals("CSE 2027", CampusValidation.batchName("  CSE 2027 "))
        assertThrows<ApiException> { CampusValidation.batchName("   ") }
        assertThrows<ApiException> { CampusValidation.orgName("A") }
        assertThrows<ApiException> { CampusValidation.departmentName("x".repeat(161)) }
    }

    @Test
    fun `optional contact fields clear on blank and refuse junk`() {
        assertNull(CampusValidation.optionalEmail("  "))
        assertEquals("tpo@college.edu", CampusValidation.optionalEmail(" TPO@College.edu "))
        assertEquals("invalid_contact_email", assertThrows<ApiException> { CampusValidation.optionalEmail("not an email") }.code)
        assertEquals("+91 98765 43210", CampusValidation.optionalPhone("+91 98765 43210"))
        assertEquals("invalid_contact_phone", assertThrows<ApiException> { CampusValidation.optionalPhone("call me") }.code)
        assertEquals("invalid_city", assertThrows<ApiException> { CampusValidation.optionalText("x".repeat(121), "city", 120) }.code)
        assertEquals("invalid_roll_number", assertThrows<ApiException> { CampusValidation.optionalRollNumber("x".repeat(41)) }.code)
    }

    @Test
    fun `patch text leaves null alone, clears blank and records what moved`() {
        val changed = mutableListOf<String>()
        assertEquals("Pune", CampusOrgService.patchText(null, "Pune", "city", changed) { it.trim().ifEmpty { null } })
        assertEquals(emptyList(), changed)
        assertNull(CampusOrgService.patchText("", "Pune", "city", changed) { it.trim().ifEmpty { null } })
        assertEquals(listOf("city"), changed)
    }

    @Test
    fun `logos are recognised by their bytes, not their name`() {
        val png = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0)
        val jpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0)
        val webp = "RIFF\u0000\u0000\u0000\u0000WEBPVP8 ".toByteArray(Charsets.ISO_8859_1)
        assertEquals("image/png", OrgLogos.sniff(png)?.contentType)
        assertEquals("image/jpeg", OrgLogos.sniff(jpeg)?.contentType)
        assertEquals("image/webp", OrgLogos.sniff(webp)?.contentType)
        assertNull(OrgLogos.sniff("<svg xmlns=\"http://www.w3.org/2000/svg\"/>".toByteArray()))
        assertNull(OrgLogos.sniff("RIFF0000WAVE".toByteArray()))
    }

    @Test
    fun `only a logo key of the same college is ever deleted`() {
        val org = UUID.randomUUID()
        val path = OrgLogos.objectPath(org, OrgLogos.Accepted("png", "image/png"))
        assertTrue(OrgLogos.isOwnLogoPath(org, path))
        assertFalse(OrgLogos.isOwnLogoPath(UUID.randomUUID(), path))
        assertFalse(OrgLogos.isOwnLogoPath(org, "$org/../other/logo.png"))
        assertFalse(OrgLogos.isOwnLogoPath(org, "$org"))
    }

    @Test
    fun `cursors round-trip and a forged one is a 400`() {
        val cursor = MemberCursor(Instant.parse("2026-11-13T10:15:30.123456Z"), UUID.randomUUID())
        assertEquals(cursor, CampusCursor.decodeMember(CampusCursor.encodeMember(cursor)))
        assertNull(CampusCursor.decodeMember(null))
        assertEquals("invalid_cursor", assertThrows<ApiException> { CampusCursor.decodeMember("not-a-cursor") }.code)
        assertEquals(42L, CampusCursor.decodeAudit("42"))
        assertEquals("invalid_cursor", assertThrows<ApiException> { CampusCursor.decodeAudit("-1") }.code)
    }
}
