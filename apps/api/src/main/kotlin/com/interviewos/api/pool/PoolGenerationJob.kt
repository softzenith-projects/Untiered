package com.interviewos.api.pool

import com.interviewos.api.ai.AiSpendContext
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.interview.RoundType
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.util.Optional
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * The resumable driver that fills the pool.
 *
 * **It is not scheduled and it does not start on boot.** It runs when an admin asks it to,
 * and only when `interviewos.pool.enabled` is true — two switches rather than one, because
 * this is the only thing in the product that spends money with nobody waiting on the other
 * end, and a job like that going off unattended is how a bill arrives with no story
 * attached (CLAUDE.md rule 7).
 *
 * Three properties hold it together:
 *
 * - **Resumable.** The work is written down as cells before any of it is attempted, each
 *   cell is claimed and marked as it goes, and a process that dies leaves a truthful
 *   record of what still needs doing. Resuming regenerates nothing that was paid for.
 * - **Capped.** Before every model call the run's spend is read out of `ai_calls` and the
 *   run pauses if the next call might exceed its budget. See [PoolSpendCap].
 * - **Labelled.** Every question goes through [PoolAssociationGate] on the way in, so no
 *   claim the model makes about a real employer survives without the separate answer that
 *   licensed it. A claim that is refused is dropped, not written under a weaker label — and
 *   the drops are counted, because a generator whose claims are being refused nine times in
 *   ten is a generator with a broken prompt.
 */
@Component
class PoolGenerationJob(
    private val ai: InterviewAi,
    private val properties: PoolProperties,
    private val runs: PoolRunRepository,
    private val pool: QuestionPoolRepository,
    private val deduplicator: PoolDeduplicator,
    generators: List<QuestionGenerator>,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * One generator per round type. A run whose cells name a round type nobody generates
     * for skips those cells rather than failing — tasks 040 and 041 fill the gaps, and
     * until they do, a run for the round types that exist should still work.
     */
    private val generatorsByRound: Map<RoundType, QuestionGenerator> = generators.associateBy { it.roundType }

    /** Which round types can actually be generated today. The controller refuses the rest up front. */
    val supportedRoundTypes: Set<RoundType> get() = generatorsByRound.keys

    fun run(runId: UUID): PoolRunProgress {
        val run = runs.findRun(runId) ?: throw IllegalArgumentException("No generation run $runId.")

        if (!properties.enabled) {
            // The plan exists, the cells are written, and nothing has been spent. This is
            // the state task 039 leaves the product in: a run the owner can read before
            // deciding to pay for it.
            log.info(
                "Generation run {} was not started: interviewos.pool.enabled is false. Its {} cells are planned " +
                    "and pending, and no model call has been made.",
                runId,
                runs.progress(run).totalCells,
            )
            runs.updateStatus(runId, PoolRunStatus.PAUSED, note = "Not started: interviewos.pool.enabled is false.")
            return runs.progress(runs.findRun(runId) ?: run)
        }

        // A previous attempt that died mid-cell left rows claimed that nobody is working
        // on. Without this they would never be picked up and the run would finish with
        // holes in it.
        val released = runs.releaseStaleCells(runId)
        if (released > 0) log.info("Released {} cells left in progress by an earlier attempt of run {}", released, runId)

        runs.updateStatus(runId, PoolRunStatus.RUNNING)

        val cap = PoolSpendCap(run.spendCapMicroUsd, properties.callHeadroomMicroUsd) { runs.spentOn(runId) }
        val limiter = PoolRateLimiter(properties.requestsPerMinute)
        val state = RunState(runId, cap, limiter)

        workConcurrently(state)

        val spent = runs.spentOn(runId)
        runs.recordSpend(runId, spent)

        val status =
            when {
                state.paused.get() -> PoolRunStatus.PAUSED
                state.everyAttemptFailed() -> PoolRunStatus.FAILED
                else -> PoolRunStatus.FINISHED
            }
        val statusNote =
            when (status) {
                PoolRunStatus.PAUSED -> {
                    "Paused at the spend cap: %.4f USD of %.4f USD used. Resume to continue."
                        .format(spent / 1_000_000.0, run.spendCapMicroUsd / 1_000_000.0)
                }

                PoolRunStatus.FAILED -> {
                    "Stopped: every cell attempted in this pass failed."
                }

                else -> {
                    null
                }
            }
        // Written to `pool_generation_runs.note`, a column that already exists and is
        // already read back by every caller of `GET /runs/{id}` — so the rate the owner
        // needs to see at task 043 travels with the run record itself rather than needing
        // its own migration. Appended to whatever the status above already says rather than
        // replacing it, so a paused run's spend note and its drop count are both visible.
        val dropNote =
            state.unlicensedClaimsDropped.get().takeIf { it > 0 }?.let {
                "Dropped $it question(s) that claimed to be company-specific without a value the knowledge " +
                    "check licensed."
            }
        val note = listOfNotNull(statusNote, dropNote).joinToString(" ").ifBlank { null }
        runs.updateStatus(runId, status, note)
        if (state.unlicensedClaimsDropped.get() > 0) {
            // Loud on purpose. This is the number that says whether the provenance gate is
            // doing its job or whether a prompt is asking for something it never gets — and
            // task 041 changed what happens to it: a refused claim is no longer written
            // under a weaker label, it is not written at all.
            log.info(
                "Run {} dropped {} question(s) whose company-specific claim was refused, out of {} written",
                runId,
                state.unlicensedClaimsDropped.get(),
                state.written.get(),
            )
        }
        return runs.progress(runs.findRun(runId) ?: run)
    }

    // ---------------------------------------------------------------------------
    // Working the cells
    // ---------------------------------------------------------------------------

    private fun workConcurrently(state: RunState) {
        val workers =
            (1..properties.concurrency).map { index ->
                Thread.ofPlatform().name("pool-gen-${state.runId}-$index").unstarted { drain(state) }
            }
        workers.forEach { it.start() }
        workers.forEach {
            try {
                it.join()
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                state.paused.set(true)
                log.warn("Generation run {} was interrupted; it will resume from its pending cells", state.runId, e)
            }
        }
    }

    private fun drain(state: RunState) {
        while (!state.paused.get()) {
            val cell = runs.claimNextCell(state.runId, properties.maxAttemptsPerCell) ?: return
            val verdict = state.cap.check()
            if (!verdict.mayCall) {
                // Hand the cell straight back, untouched. It has cost nothing and the
                // resume will pick it up exactly as it is.
                runs.completeCell(cell.id, PoolCellOutcome(PoolCellStatus.PENDING, 0, 0, 0))
                state.paused.set(true)
                log.info(
                    "Run {} paused before its next call: {} of {} micro-USD spent, less than the {} headroom left",
                    state.runId,
                    verdict.spentMicroUsd,
                    verdict.remainingMicroUsd + verdict.spentMicroUsd,
                    properties.callHeadroomMicroUsd,
                )
                return
            }
            val outcome = AiSpendContext.ofPoolRun(state.runId) { work(cell, state) }
            runs.completeCell(cell.id, outcome)
            state.written.addAndGet(outcome.questionsWritten)
            state.unlicensedClaimsDropped.addAndGet(outcome.unlicensedClaimsDropped)
            state.attempted.incrementAndGet()
            if (outcome.status == PoolCellStatus.FAILED) state.failures.incrementAndGet()
        }
    }

    private fun work(
        cell: PoolCell,
        state: RunState,
    ): PoolCellOutcome {
        val generator =
            generatorsByRound[cell.coordinate.roundType]
                ?: return PoolCellOutcome(
                    PoolCellStatus.SKIPPED,
                    0,
                    0,
                    0,
                    "No generator for ${cell.coordinate.roundType.dbValue} yet.",
                )

        return try {
            val knowledge = knowledgeFor(cell, state)
            val existing = pool.existingFor(cell.coordinate)

            state.limiter.acquire()
            val generated =
                generator.generate(
                    PoolGenerationRequest(
                        cell = cell,
                        count = properties.questionsPerCell,
                        // The wording, not the fingerprints: the model is being asked not
                        // to write these again, and it cannot read a normalised form.
                        // Capped, because the point of the list is to steer the model away
                        // from ground already covered, and a prompt carrying two hundred
                        // questions costs more in input tokens than the duplicates it saves.
                        avoid = (existing.poolTexts + existing.bankTexts).take(MAX_AVOID),
                        knowledge = knowledge?.answer,
                    ),
                )
            val writingModel = generated.usage.model

            val deduped = deduplicator.dedupe(generated.value.questions, existing, pool.embeddingsSupported)

            var unlicensedClaimsDropped = 0
            val toWrite =
                deduped.kept.mapNotNull { kept ->
                    val decision =
                        PoolAssociationGate.decide(
                            companyId = cell.coordinate.companyId,
                            claimedCompanySpecific = kept.question.companySpecific,
                            knowledge = knowledge?.answer,
                            vouchingModel = knowledge?.model,
                            writingModel = writingModel,
                        )
                    // A refused company-specific claim is dropped, not written as
                    // `employer_kind` — the question's own text was built around the claim,
                    // and relabelling the row does not un-fabricate what the text says
                    // (task 041's fix; PRD §04, §08). A question that never claimed to be
                    // company-specific is unaffected: it reaches the `else` below exactly
                    // as it did before.
                    if (decision.dropped) {
                        unlicensedClaimsDropped++
                        log.info("Dropped a refused company-specific claim: {}", decision.reason)
                        null
                    } else {
                        NewPoolQuestion(
                            coordinate = cell.coordinate,
                            text = kept.question.text,
                            followUps = kept.question.followUps,
                            strongAnswerCovers = kept.question.strongAnswerCovers,
                            association = decision.association,
                            knowledgeBasis = decision.knowledgeBasis,
                            generatorVersion = generator.version,
                            model = writingModel,
                            embedding = kept.embedding,
                            payload = kept.question.payload,
                        )
                    }
                }

            val written = pool.writeBatch(cell.id, toWrite)
            PoolCellOutcome(PoolCellStatus.DONE, written, deduped.dropped, unlicensedClaimsDropped)
        } catch (e: AiUnavailableException) {
            log.warn("Cell {} failed", cell.id, e)
            PoolCellOutcome(PoolCellStatus.FAILED, 0, 0, 0, e.message?.take(ERROR_LIMIT))
        } catch (e: RuntimeException) {
            // A bad row, a constraint, a parse: the cell fails and the run carries on. One
            // company's questions being unwritable is not a reason to stop generating for
            // the other thirty-nine.
            log.warn("Cell {} could not be written", cell.id, e)
            PoolCellOutcome(PoolCellStatus.FAILED, 0, 0, 0, e.message?.take(ERROR_LIMIT))
        }
    }

    /**
     * Asks — once per employer per run — whether the model knows this employer's process.
     *
     * Cached because a run has up to twenty-eight cells for the same company, and asking
     * the same question twenty-eight times would be twenty-seven calls spent on an answer
     * that cannot change, plus twenty-seven chances for the answer to come back
     * differently and give one company two different provenance stories in one run.
     *
     * A failed check is cached as "does not know", which is the safe direction: every
     * question in that cell is then archetype-level, which is always a true label.
     */
    private fun knowledgeFor(
        cell: PoolCell,
        state: RunState,
    ): KnowledgeAnswer? {
        val companyId = cell.coordinate.companyId ?: return null
        val companyName = cell.companyName ?: return null

        state.knowledge[companyId]?.let { return it.orElse(null) }

        synchronized(state.knowledgeLock) {
            state.knowledge[companyId]?.let { return it.orElse(null) }
            val answer =
                try {
                    state.limiter.acquire()
                    val result = ai.assessEmployerKnowledge(companyName, cell.coordinate.archetype.label)
                    KnowledgeAnswer(result.value, result.usage.model)
                } catch (e: AiUnavailableException) {
                    log.warn("Could not check what the model knows about {}; treating it as unknown", companyName, e)
                    null
                }
            state.knowledge[companyId] = Optional.ofNullable(answer)
            return answer
        }
    }

    /** What the model said about one employer, and which model said it. */
    private data class KnowledgeAnswer(
        val answer: EmployerKnowledge,
        val model: String,
    )

    private class RunState(
        val runId: UUID,
        val cap: PoolSpendCap,
        val limiter: PoolRateLimiter,
    ) {
        val paused = AtomicBoolean(false)
        val written = AtomicInteger(0)
        val unlicensedClaimsDropped = AtomicInteger(0)
        val attempted = AtomicInteger(0)
        val failures = AtomicInteger(0)
        val knowledge = ConcurrentHashMap<UUID, Optional<KnowledgeAnswer>>()
        val knowledgeLock = Any()

        /**
         * A pass that attempted cells and failed every one of them.
         *
         * Not "wrote nothing": a pass whose every cell was skipped for want of a generator
         * did exactly what it should, and a run with nothing left to do has attempted
         * nothing at all. Both of those are finished, not failed.
         */
        fun everyAttemptFailed(): Boolean = attempted.get() > 0 && failures.get() == attempted.get()
    }

    private companion object {
        /** `pool_generation_cells.error` is read by a human, not parsed. A stack trace belongs in the log. */
        const val ERROR_LIMIT = 500

        /** How many already-held questions the prompt is given to steer away from. */
        const val MAX_AVOID = 40
    }
}
