package com.interviewos.api.config

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.web.method.HandlerMethod
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProductFeatureInterceptorTest {
    private val handler = HandlerMethod(TestHandler(), TestHandler::class.java.getDeclaredMethod("handle"))

    @Test
    fun `disabled feature paths answer not found`() {
        val interceptor =
            ProductFeatureInterceptor(
                ProductFeatureProperties(
                    mockInterviews = false,
                    courses = false,
                    arena = false,
                    reports = false,
                    questions = false,
                    campus = false,
                ),
            )

        for ((method, path) in gatedPaths) {
            val error =
                assertThrows<ApiException>("$method $path should be gated") {
                    interceptor.preHandle(request(method, path), MockHttpServletResponse(), handler)
                }
            assertEquals(HttpStatus.NOT_FOUND, error.status)
        }
    }

    @Test
    fun `enabled features and deletion routes remain available`() {
        val enabled = ProductFeatureInterceptor(ProductFeatureProperties(questions = true, campus = true))
        for ((method, path) in gatedPaths) {
            assertTrue(enabled.preHandle(request(method, path), MockHttpServletResponse(), handler))
        }

        val allOff =
            ProductFeatureInterceptor(
                ProductFeatureProperties(false, false, false, false, false),
            )
        assertTrue(
            allOff.preHandle(
                request("DELETE", "/api/v1/sessions/86fcddf4-5e2b-4cab-b0c6-05e928d04529"),
                MockHttpServletResponse(),
                handler,
            ),
        )
    }

    @Test
    fun `campus is off by default and closes only its own paths`() {
        val defaults = ProductFeatureInterceptor(ProductFeatureProperties())
        assertThrows<ApiException> {
            defaults.preHandle(request("GET", "/api/v1/me/campus"), MockHttpServletResponse(), handler)
        }
        assertEquals(null, defaults.featureFor("GET", "/api/v1/me/campusfoo"))
        assertEquals(null, defaults.featureFor("GET", "/api/v1/admin/sources"))
        assertEquals(null, defaults.featureFor("GET", "/api/v1/me"))
        assertTrue(defaults.preHandle(request("DELETE", "/api/v1/me"), MockHttpServletResponse(), handler))
        // The dashboard calls this for everyone; with campus off it answers [] instead of 404 (contract, module 4).
        assertEquals(null, defaults.featureFor("GET", "/api/v1/me/assignments"))
        assertTrue(defaults.preHandle(request("GET", "/api/v1/me/assignments"), MockHttpServletResponse(), handler))
        assertEquals(
            ProductFeature.CAMPUS,
            defaults.featureFor("GET", "/api/v1/campus/orgs/86fcddf4-5e2b-4cab-b0c6-05e928d04529/assignments"),
        )
    }

    private fun request(
        method: String,
        path: String,
    ) = MockHttpServletRequest(method, path)

    private val gatedPaths =
        listOf(
            "POST" to "/api/v1/sessions",
            "POST" to "/api/v1/sessions/86fcddf4-5e2b-4cab-b0c6-05e928d04529/begin",
            "GET" to "/api/v1/sessions",
            "GET" to "/api/v1/sessions/86fcddf4-5e2b-4cab-b0c6-05e928d04529/report",
            "GET" to "/api/v1/readiness",
            "GET" to "/api/v1/me/course-progress",
            "POST" to "/api/v1/me/arena/answers",
            "GET" to "/api/v1/campus/orgs/86fcddf4-5e2b-4cab-b0c6-05e928d04529",
            "DELETE" to "/api/v1/campus/orgs/86fcddf4-5e2b-4cab-b0c6-05e928d04529/members/86fcddf4-5e2b-4cab-b0c6-05e928d04529",
            "GET" to "/api/v1/admin/campus/orgs",
            "POST" to "/api/v1/admin/campus/orgs",
            "GET" to "/api/v1/me/campus",
            "POST" to "/api/v1/me/campus/leave",
        )

    private class TestHandler {
        @Suppress("unused")
        fun handle() = Unit
    }
}
