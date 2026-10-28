package com.interviewos.api.arena

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import java.util.UUID

@Repository
class ScenarioArenaRepository(
    private val jdbc: JdbcClient,
    private val mapper: ObjectMapper,
) {
    fun lockCourse(
        userId: UUID,
        course: String,
    ) {
        jdbc
            .sql("select 1 from (select pg_advisory_xact_lock(hashtextextended(:key, 0))) as guard")
            .param("key", "$userId:$course")
            .query { rs, _ -> rs.getLong(1) }
            .single()
    }

    fun scenarios(course: String): List<ScenarioCandidate> =
        jdbc
            .sql("select id, course_id, tier, status, concept_ids from public.arena_scenarios where course_id = :course")
            .param("course", course)
            .query { rs, _ ->
                ScenarioCandidate(
                    rs.getString("id"),
                    rs.getString("course_id"),
                    rs.getString("tier"),
                    rs.getString("status"),
                    strings(rs.getArray("concept_ids").array),
                )
            }.list()

    fun active(
        userId: UUID,
        course: String,
        forUpdate: Boolean = false,
    ): ScenarioProgressRow? =
        jdbc
            .sql(
                "select scenario_id, current_step_id from public.user_scenario_progress " +
                    "where user_id = :userId and course_id = :course and status = 'in_progress'" +
                    if (forUpdate) " for update" else "",
            ).param("userId", userId)
            .param("course", course)
            .query { rs, _ -> ScenarioProgressRow(rs.getString("scenario_id"), rs.getString("current_step_id")) }
            .optional()
            .orElse(null)

    fun completedIds(
        userId: UUID,
        course: String,
    ): Set<String> =
        jdbc
            .sql(
                "select scenario_id from public.user_scenario_progress where user_id = :userId and course_id = :course and status = 'completed'",
            ).param("userId", userId)
            .param("course", course)
            .query { rs, _ -> rs.getString(1) }
            .list()
            .toSet()

    fun mastery(
        userId: UUID,
        course: String,
    ): Map<String, ConceptScore> =
        jdbc
            .sql(
                "select m.concept_id, m.score, m.last_seen_at from public.user_concept_mastery m " +
                    "join public.arena_concepts c on c.id = m.concept_id where m.user_id = :userId and c.course_id = :course",
            ).param("userId", userId)
            .param("course", course)
            .query { rs, _ -> rs.getString(1) to ConceptScore(rs.getDouble(2), rs.getTimestamp(3).toInstant()) }
            .list()
            .toMap()

    fun conceptNames(course: String): List<Pair<String, String>> =
        jdbc
            .sql(
                "select c.id, c.name from public.arena_concepts c where c.course_id = :course " +
                    "and exists (select 1 from public.arena_scenarios s where s.course_id = c.course_id " +
                    "and s.status = 'live' and c.id = any(s.concept_ids)) order by c.name",
            ).param("course", course)
            .query { rs, _ -> rs.getString(1) to rs.getString(2) }
            .list()

    fun step(id: String): ScenarioStepRow? =
        jdbc
            .sql(
                "select id, scenario_id, position, kind, step_type, prompt, context_note, options, correct_option_id, " +
                    "explanation, bottleneck_note, concept_ids, code_snippet, language, system_state " +
                    "from public.arena_scenario_steps where id = :id",
            ).param("id", id)
            .query { rs, _ ->
                ScenarioStepRow(
                    rs.getString("id"),
                    rs.getString("scenario_id"),
                    rs.getInt("position"),
                    rs.getString("kind"),
                    rs.getString("step_type"),
                    rs.getString("prompt"),
                    rs.getString("context_note"),
                    mapper.readValue(rs.getString("options"), Array<ScenarioOption>::class.java).toList(),
                    rs.getString("correct_option_id"),
                    rs.getString("explanation"),
                    rs.getString("bottleneck_note"),
                    strings(rs.getArray("concept_ids").array),
                    rs.getString("code_snippet"),
                    rs.getString("language"),
                    rs.getString("system_state")?.let { mapper.readValue(it, ScenarioSystemState::class.java) },
                )
            }.optional()
            .orElse(null)

    fun firstStep(scenarioId: String): ScenarioStepRow? = step("$scenarioId:1")

    fun nextStep(step: ScenarioStepRow): ScenarioStepRow? = this.step("${step.scenarioId}:${step.position + 1}")

    fun scenario(id: String): ScenarioDetails? =
        jdbc
            .sql(
                "select id, course_id, title, hook, context, tier, estimated_minutes, solution_brief, concept_ids " +
                    "from public.arena_scenarios where id = :id",
            ).param("id", id)
            .query { rs, _ ->
                ScenarioDetails(
                    rs.getString("id"),
                    rs.getString("course_id"),
                    rs.getString("title"),
                    rs.getString("hook"),
                    rs.getString("context"),
                    rs.getString("tier"),
                    rs.getInt("estimated_minutes"),
                    rs.getString("solution_brief"),
                    strings(rs.getArray("concept_ids").array),
                )
            }.optional()
            .orElse(null)

    fun start(
        userId: UUID,
        scenarioId: String,
        course: String,
        stepId: String,
    ) {
        jdbc
            .sql(
                "insert into public.user_scenario_progress(user_id, scenario_id, course_id, current_step_id, status) " +
                    "values(:userId,:scenarioId,:course,:stepId,'in_progress')",
            ).param("userId", userId)
            .param("scenarioId", scenarioId)
            .param("course", course)
            .param("stepId", stepId)
            .update()
    }

    fun previousAnswer(
        userId: UUID,
        stepId: String,
    ): StoredScenarioAnswer? =
        jdbc
            .sql("select chosen_option_id, is_correct from public.user_step_answers where user_id = :userId and step_id = :stepId")
            .param("userId", userId)
            .param("stepId", stepId)
            .query { rs, _ -> StoredScenarioAnswer(rs.getString(1), rs.getBoolean(2)) }
            .optional()
            .orElse(null)

    fun saveAnswer(
        userId: UUID,
        stepId: String,
        optionId: String,
        correct: Boolean,
    ) {
        jdbc
            .sql("insert into public.user_step_answers(user_id,step_id,chosen_option_id,is_correct) values(:u,:s,:o,:c)")
            .param("u", userId)
            .param("s", stepId)
            .param("o", optionId)
            .param("c", correct)
            .update()
    }

    fun advance(
        userId: UUID,
        scenarioId: String,
        nextStepId: String?,
    ) {
        jdbc
            .sql(
                // The casts matter: PostgreSQL cannot infer a type for a bare null parameter in
                // "is null", so without them finishing the last step of any scenario failed.
                "update public.user_scenario_progress set current_step_id = cast(:next as text), " +
                    "status = case when cast(:next as text) is null then 'completed' else 'in_progress' end, " +
                    "completed_at = case when cast(:next as text) is null then now() else null end " +
                    "where user_id = :userId and scenario_id = :scenarioId",
            ).param("next", nextStepId)
            .param("userId", userId)
            .param("scenarioId", scenarioId)
            .update()
    }

    fun saveMastery(
        userId: UUID,
        conceptId: String,
        score: Double,
    ) {
        jdbc
            .sql(
                "insert into public.user_concept_mastery(user_id,concept_id,score,last_seen_at) values(:u,:c,:score,now()) " +
                    "on conflict(user_id,concept_id) do update set score=excluded.score,last_seen_at=excluded.last_seen_at",
            ).param("u", userId)
            .param("c", conceptId)
            .param("score", score)
            .update()
    }

    private fun strings(value: Any): List<String> = (value as Array<*>).map { it.toString() }
}

data class ScenarioProgressRow(
    val scenarioId: String,
    val currentStepId: String?,
)

data class StoredScenarioAnswer(
    val chosenOptionId: String,
    val correct: Boolean,
)

data class ScenarioOption(
    val id: String,
    val text: String,
)

data class ScenarioSystemState(
    val nodes: List<String>,
    val links: List<List<String>>,
)

data class ScenarioDetails(
    val id: String,
    val courseId: String,
    val title: String,
    val hook: String,
    val context: String,
    val tier: String,
    val estimatedMinutes: Int,
    val solutionBrief: String,
    val conceptIds: List<String>,
)

data class ScenarioStepRow(
    val id: String,
    val scenarioId: String,
    val position: Int,
    val kind: String,
    val stepType: String,
    val prompt: String,
    val contextNote: String?,
    val options: List<ScenarioOption>,
    val correctOptionId: String,
    val explanation: String,
    val bottleneckNote: String,
    val conceptIds: List<String>,
    val codeSnippet: String?,
    val language: String?,
    val systemState: ScenarioSystemState? = null,
)
