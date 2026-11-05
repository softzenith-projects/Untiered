package com.interviewos.api.common

import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

class ApiExceptionHandlerTest {
    @RestController
    class PostOnlyController {
        @PostMapping("/post-only")
        fun create(): Map<String, String> = mapOf("ok" to "yes")
    }

    private val mockMvc: MockMvc =
        MockMvcBuilders
            .standaloneSetup(PostOnlyController())
            .setControllerAdvice(ApiExceptionHandler())
            .build()

    @Test
    fun `a wrong method on a known path is a 405 in the shared envelope, not a 500`() {
        // UNTIERED-API-8: a newer web client called GET on a POST-only route and the
        // catch-all reported it as an internal error.
        mockMvc
            .perform(get("/post-only"))
            .andExpect(status().isMethodNotAllowed)
            .andExpect(header().string("Allow", "POST"))
            .andExpect(jsonPath("$.error").value("method_not_allowed"))
            .andExpect(jsonPath("$.message").value("GET is not supported at this address."))
    }

    @Test
    fun `the supported method still reaches the controller`() {
        mockMvc
            .perform(post("/post-only"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ok").value("yes"))
    }
}
