package com.interviewos.api.arena

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

@WebMvcTest(ScenarioArenaController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class ScenarioArenaControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var repository: ScenarioArenaRepository

    @MockitoBean private lateinit var userRepository: UserRepository

    @Test
    fun `course progress is scoped to authenticated user`() {
        given(repository.completedIds(USER, "dsa")).willReturn(setOf("dsa:done"))
        given(repository.conceptNames("dsa")).willReturn(listOf("dsa:trie" to "Trie lookup"))
        given(repository.mastery(USER, "dsa")).willReturn(mapOf("dsa:trie" to ConceptScore(0.4, Instant.now())))
        mockMvc
            .perform(get("/api/v1/me/arena/scenarios/dsa").with(token()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.scenariosDone").value(1))
            .andExpect(jsonPath("$.weakestConcepts[0].name").value("Trie lookup"))
        verify(repository).completedIds(USER, "dsa")
    }

    @Test
    fun `a candidate who has answered nothing has no concepts to practise yet`() {
        given(repository.conceptNames("dsa")).willReturn(listOf("dsa:heap" to "Heap", "dsa:trie" to "Trie lookup"))
        mockMvc
            .perform(get("/api/v1/me/arena/scenarios/dsa").with(token()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.weakestConcepts").isEmpty)
    }

    @Test
    fun `scenario routes reject missing identity`() {
        mockMvc
            .perform(get("/api/v1/me/arena/scenarios/dsa"))
            .andExpect(status().isUnauthorized)
        mockMvc
            .perform(post("/api/v1/me/arena/scenarios/dsa/start"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `answer is graded on server and advances only to the next step`() {
        val first =
            ScenarioStepRow(
                "dsa:autocomplete:1",
                "dsa:autocomplete",
                1,
                "initial",
                "algo_choice",
                "Which structure?",
                null,
                listOf(ScenarioOption("a", "trie"), ScenarioOption("b", "array"), ScenarioOption("c", "stack")),
                "a",
                "Trie follows the prefix; the others scan or lack an index.",
                "Index prefixes.",
                listOf("dsa:trie"),
                null,
                null,
            )
        val next =
            first.copy(
                id = "dsa:autocomplete:2",
                position = 2,
                kind = "probe",
                contextNote = "Now scale the reads.",
                systemState = ScenarioSystemState(listOf("browser", "trie"), listOf(listOf("browser", "trie"))),
            )
        given(repository.active(USER, "dsa", true)).willReturn(ScenarioProgressRow("dsa:autocomplete", first.id))
        given(repository.step(first.id)).willReturn(first)
        given(repository.nextStep(first)).willReturn(next)
        given(repository.scenario("dsa:autocomplete"))
            .willReturn(
                ScenarioDetails(
                    "dsa:autocomplete",
                    "dsa",
                    "Autocomplete",
                    "Hook",
                    "Search",
                    "foundations",
                    7,
                    "Use a trie.",
                    listOf("dsa:trie"),
                ),
            )
        mockMvc
            .perform(
                post("/api/v1/me/arena/scenarios/dsa/answers")
                    .with(token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"stepId":"${first.id}","chosenOptionId":"b"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.correct").value(false))
            .andExpect(jsonPath("$.correctOptionId").value("a"))
            .andExpect(jsonPath("$.nextStep.id").value(next.id))
            .andExpect(jsonPath("$.nextStep.systemState.nodes[0]").value("browser"))
        verify(repository).saveAnswer(USER, first.id, "b", false)
        verify(repository).advance(USER, first.scenarioId, next.id)
    }

    private fun token() = jwt().jwt { builder: Jwt.Builder -> builder.subject(USER.toString()).claim("email", "candidate@example.com") }

    private companion object {
        val USER: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    }
}
