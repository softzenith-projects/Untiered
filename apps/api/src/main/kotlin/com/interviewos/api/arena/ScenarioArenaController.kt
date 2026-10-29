package com.interviewos.api.arena

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.Random
import java.util.UUID

@RestController
@RequestMapping("/api/v1/me/arena/scenarios")
class ScenarioArenaController(
    private val repository: ScenarioArenaRepository,
    private val userRepository: UserRepository,
) {
    @GetMapping("/{course}")
    fun progress(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable course: String,
    ): ScenarioCourseProgressView {
        requireCourse(course)
        val userId = SupabaseIdentity.from(jwt).id
        val completed = repository.completedIds(userId, course)
        val mastery = repository.mastery(userId, course)
        val now = Instant.now()
        return ScenarioCourseProgressView(
            completed.size,
            repository.active(userId, course)?.scenarioId,
            ScenarioSelection.unlockedTier(completed.size),
            // Only concepts the candidate has actually answered. Untouched ones all tie at the
            // starting score, so ranking them just lists the first three alphabetically.
            repository
                .conceptNames(course)
                .filter { (id, _) -> id in mastery }
                .map { (id, name) -> WeakConceptView(id, name, ScenarioSelection.decayedScore(mastery[id], now)) }
                .sortedBy { it.score }
                .take(3),
        )
    }

    @PostMapping("/{course}/start")
    @Transactional
    fun start(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable course: String,
    ): ScenarioPlayView {
        requireCourse(course)
        val identity = SupabaseIdentity.from(jwt)
        userRepository.provision(identity)
        repository.lockCourse(identity.id, course)
        val active = repository.active(identity.id, course, forUpdate = true)
        if (active != null) return play(active.scenarioId, active.currentStepId)
        val candidate =
            ScenarioSelection.pick(
                course,
                repository.scenarios(course),
                repository.completedIds(identity.id, course),
                null,
                repository.mastery(identity.id, course),
                Instant.now(),
                Random(),
            ) ?: return ScenarioPlayView(null, null)
        val first = repository.firstStep(candidate.id) ?: throw ApiException.badRequest("Scenario has no first step.")
        repository.start(identity.id, candidate.id, course, first.id)
        return play(candidate.id, first.id)
    }

    @PostMapping("/{course}/answers")
    @Transactional
    fun answer(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable course: String,
        @RequestBody request: ScenarioAnswerRequest,
    ): ScenarioAnswerView {
        requireCourse(course)
        val userId = SupabaseIdentity.from(jwt).id
        val active =
            repository.active(userId, course, forUpdate = true)
                ?: throw ApiException.badRequest("Start a scenario before answering.")
        val step = repository.step(request.stepId) ?: throw ApiException.badRequest("Unknown step.")
        if (step.scenarioId != active.scenarioId || step.id != active.currentStepId) {
            throw ApiException.badRequest("Answer the current step in order.")
        }
        if (step.options.none { it.id == request.chosenOptionId }) throw ApiException.badRequest("Unknown option.")
        if (repository.previousAnswer(userId, step.id) != null) throw ApiException.badRequest("Step already answered.")
        val correct = step.correctOptionId == request.chosenOptionId
        repository.saveAnswer(userId, step.id, request.chosenOptionId, correct)
        val now = Instant.now()
        val mastery = repository.mastery(userId, course)
        step.conceptIds.forEach { conceptId ->
            repository.saveMastery(userId, conceptId, ScenarioSelection.afterAnswer(mastery[conceptId], correct, now))
        }
        val next = repository.nextStep(step)
        repository.advance(userId, active.scenarioId, next?.id)
        val scenario = repository.scenario(active.scenarioId) ?: throw ApiException.badRequest("Scenario unavailable.")
        return ScenarioAnswerView(
            correct,
            step.correctOptionId,
            step.explanation,
            step.bottleneckNote,
            next?.toPublic(),
            if (next == null) scenario.solutionBrief else null,
            if (next == null) repository.conceptNames(course).filter { it.first in scenario.conceptIds }.map { it.second } else emptyList(),
        )
    }

    private fun play(
        scenarioId: String,
        stepId: String?,
    ): ScenarioPlayView {
        val scenario = repository.scenario(scenarioId) ?: throw ApiException.badRequest("Scenario unavailable.")
        val step = stepId?.let(repository::step) ?: throw ApiException.badRequest("Scenario progress is invalid.")
        return ScenarioPlayView(scenario.toPublic(), step.toPublic())
    }

    private fun requireCourse(course: String) {
        if (!Regex("[a-z0-9][a-z0-9-]{0,99}").matches(course)) throw ApiException.badRequest("Invalid course.")
    }
}

private fun ScenarioDetails.toPublic() = ScenarioPublicView(id, courseId, title, hook, context, tier, estimatedMinutes)

private fun ScenarioStepRow.toPublic() =
    ScenarioStepView(
        id,
        position,
        kind,
        stepType,
        prompt,
        contextNote,
        options,
        codeSnippet,
        language,
        systemState,
    )

data class ScenarioPublicView(
    val id: String,
    val courseId: String,
    val title: String,
    val hook: String,
    val context: String,
    val tier: String,
    val estimatedMinutes: Int,
)

data class ScenarioStepView(
    val id: String,
    val position: Int,
    val kind: String,
    val stepType: String,
    val prompt: String,
    val contextNote: String?,
    val options: List<ScenarioOption>,
    val codeSnippet: String?,
    val language: String?,
    val systemState: ScenarioSystemState?,
)

data class ScenarioPlayView(
    val scenario: ScenarioPublicView?,
    val step: ScenarioStepView?,
)

data class ScenarioAnswerRequest(
    val stepId: String = "",
    val chosenOptionId: String = "",
)

data class ScenarioAnswerView(
    val correct: Boolean,
    val correctOptionId: String,
    val explanation: String,
    val bottleneckNote: String,
    val nextStep: ScenarioStepView?,
    val solutionBrief: String?,
    val conceptsCovered: List<String>,
)

data class WeakConceptView(
    val id: String,
    val name: String,
    val score: Double,
)

data class ScenarioCourseProgressView(
    val scenariosDone: Int,
    val activeScenarioId: String?,
    val unlockedTier: Int,
    val weakestConcepts: List<WeakConceptView>,
)
