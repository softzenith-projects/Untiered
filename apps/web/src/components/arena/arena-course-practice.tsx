"use client";

import { useEffect, useMemo, useState } from "react";

import type { ScenarioAnswerView, ScenarioCourseProgressView, ScenarioPlayView, ScenarioStepView } from "@untiered/shared";
import { answerScenarioStep, fetchScenarioCourseProgress, startScenario } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import { shuffleScenarioOptions } from "@/lib/arena/shuffle-options";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/field";
import { Alert, Skeleton } from "@/components/ui/feedback";

export function ArenaCoursePractice({ courseSlug }: { courseSlug: string }) {
  const token = useAccessToken();
  const [progress, setProgress] = useState<ScenarioCourseProgressView | null>(null);
  const [play, setPlay] = useState<ScenarioPlayView | null>(null);
  const [step, setStep] = useState<ScenarioStepView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScenarioAnswerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const displayedOptions = useMemo(() => shuffleScenarioOptions(step?.options ?? []), [step]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetchScenarioCourseProgress(courseSlug, { accessToken: token })
      .then((value) => { if (active) { setProgress(value); setLoadStatus("ready"); } })
      .catch(() => { if (active) { setLoadStatus("error"); setError("We couldn't load your Arena progress. Please try again."); } });
    return () => { active = false; };
  }, [courseSlug, token, retryCount]);

  async function start() {
    if (!token || busy) return;
    setBusy(true); setError(null);
    try {
      const value = await startScenario(courseSlug, token);
      setPlay(value); setStep(value.step); setSelected(null); setFeedback(null);
    } catch { setError("We couldn't start a scenario. Try again."); }
    finally { setBusy(false); }
  }

  async function answer() {
    if (!token || !step || !selected || busy) return;
    setBusy(true); setError(null);
    try { setFeedback(await answerScenarioStep(courseSlug, token, step.id, selected)); }
    catch { setError("Your answer wasn't saved. Try again."); }
    finally { setBusy(false); }
  }

  function continuePlaying() {
    if (!feedback?.nextStep) return;
    setStep(feedback.nextStep); setSelected(null); setFeedback(null);
  }

  async function finish() {
    setPlay(null); setStep(null); setFeedback(null); setSelected(null);
    if (token) {
      try { setProgress(await fetchScenarioCourseProgress(courseSlug, { accessToken: token })); }
      catch { setError("We couldn't refresh your progress."); }
    }
  }

  return (
    <div className="space-y-7">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!play ? (
        <>
          <div><p className="eyebrow text-accent">Course Arena</p><h2 className="mt-2 text-heading text-ink">One situation. Deeper questions.</h2><p className="mt-2 max-w-2xl text-body text-ink-muted">Work through a real-world situation and its follow-up decisions. Each answer shapes what you should review next.</p></div>
          {progress ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-sunken p-4"><p className="text-caption text-ink-muted">Scenarios completed</p><p className="text-title font-bold text-ink">{progress.scenariosDone}</p></div>
              <div className="rounded-xl border border-line bg-surface-sunken p-4"><p className="text-caption text-ink-muted">Concepts to practise</p><p className="mt-1 text-caption font-medium text-ink">{progress.weakestConcepts.map((c) => c.name).join(" · ") || "Start a scenario to see these"}</p></div>
            </div>
          ) : loadStatus === "loading" ? <div role="status" aria-label="Loading your progress"><Skeleton className="h-24 w-full" /></div> : null}
          {loadStatus === "error" ? (
            <Button onClick={() => { setLoadStatus("loading"); setError(null); setRetryCount((count) => count + 1); }}>Try again</Button>
          ) : (
            <Button disabled={!token || !progress} loading={busy} onClick={start}>{busy ? "Opening…" : progress?.activeScenarioId ? "Resume scenario" : "Start scenario"}</Button>
          )}
        </>
      ) : play.scenario === null || step === null ? (
        <div className="space-y-4"><p className="text-body text-ink-muted">No more live scenarios are unlocked for this course yet. More are on the way.</p><Button variant="ghost" onClick={() => setPlay(null)}>Back to course Arena</Button></div>
      ) : (
        <section aria-label="Scenario" className="space-y-6">
          <div className="rounded-xl border border-line bg-surface-sunken px-6 py-5"><p className="eyebrow text-ink-muted">{play.scenario.context} · {play.scenario.estimatedMinutes} min</p><h2 className="mt-2 text-heading font-semibold text-ink">{play.scenario.title}</h2><p className="mt-2 text-body leading-relaxed text-ink-muted">{play.scenario.hook}</p></div>
          {step.contextNote ? <p className="rounded-xl border-l-4 border-accent bg-accent-wash p-4 text-body text-ink">{step.contextNote}</p> : null}
          {step.systemState ? (
            <section aria-label="System map" className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm">
              <h3 className="text-caption font-bold uppercase tracking-wide text-ink-muted">System so far</h3>
              <ul aria-label="Components" className="mt-3 flex flex-wrap gap-2">
                {step.systemState.nodes.map((node) => <li key={node} className="rounded-lg border border-accent/20 bg-accent-wash px-3 py-2 text-caption font-medium text-ink">{node.replaceAll("-", " ")}</li>)}
              </ul>
              <p className="mt-4 text-caption font-semibold text-ink-muted">Connections</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {step.systemState.links.map(([from, to], index) => <li key={`${from}-${to}-${index}`} className="rounded-lg bg-surface-sunken px-3 py-2 text-caption text-ink">{from.replaceAll("-", " ")} <span aria-label="connects to">→</span> {to.replaceAll("-", " ")}</li>)}
              </ul>
            </section>
          ) : null}
          <div className="rounded-xl border border-accent/30 bg-accent-wash px-6 py-5 shadow-sm"><p className="eyebrow text-accent-strong">{step.kind === "initial" ? "First decision" : `Probe ${step.position - 1}`} · {step.stepType.replaceAll("_", " ")}</p><h3 className="mt-2 text-title text-ink">{step.prompt}</h3></div>
          {step.codeSnippet ? <pre className="overflow-x-auto rounded-xl bg-navy p-5 font-mono text-caption text-on-navy"><code>{step.codeSnippet}</code></pre> : null}
          <fieldset disabled={feedback !== null || busy} className="space-y-3"><legend className="sr-only">Choose one answer</legend>
          {displayedOptions.map((option) => <label key={option.id} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 text-body transition-colors focus-within:ring-2 focus-within:ring-accent ${selected === option.id ? "border-accent bg-accent-wash" : "border-line bg-surface-raised"}`}><Radio name={`step-${step.id}`} value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} className="mt-1" /><span>{option.text}</span></label>)}
          </fieldset>
          {!feedback ? <Button disabled={!selected} loading={busy} onClick={answer}>{busy ? "Saving…" : "Check answer"}</Button> : (
            <div role="status" className="space-y-3 rounded-xl border border-line bg-surface-sunken p-5"><p className={`font-bold ${feedback.correct ? "text-positive" : "text-danger"}`}>{feedback.correct ? "Correct" : "Not quite"}</p>{feedback.correct ? null : <p className="text-body text-ink"><strong>Best answer:</strong> {step.options.find((option) => option.id === feedback.correctOptionId)?.text}</p>}<p className="text-body text-ink">{feedback.explanation}</p><p className="text-caption text-ink-muted"><strong>Key point:</strong> {feedback.bottleneckNote}</p>
              {feedback.solutionBrief ? <div className="space-y-2 border-t border-line pt-4"><h3 className="text-heading text-ink">Solution in brief</h3><p className="text-body text-ink-muted">{feedback.solutionBrief}</p><p className="text-caption text-ink-muted">Concepts covered: {feedback.conceptsCovered.join(" · ")}</p></div> : null}
              <Button onClick={feedback.nextStep ? continuePlaying : finish}>{feedback.nextStep ? "Next probe" : "Back to course Arena"}</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
