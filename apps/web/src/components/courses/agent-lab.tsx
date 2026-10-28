"use client";

import { useCallback, useId, useMemo, useState } from "react";

import { defaultSettings, runAgentLab, systemPromptText } from "@/lib/agent-lab/run";
import { LESSON_BUTTON, LESSON_BUTTON_PRIMARY, LessonLabel } from "@/components/courses/lesson-box";
import type { LabFrame, LabScenario, LabSettings, LabTrace } from "@/lib/agent-lab/types";

/**
 * The agent lab (task 057): assemble an agent, run it, step through the trace.
 *
 * **The banner at the top is not decoration.** CLAUDE.md rule 7 forbids live AI spend
 * without the owner, so this runs a scripted simulation — and a lab that let a reader
 * believe a scripted trace came from a real model would be exactly the failure this
 * codebase treats as unforgivable elsewhere (a report describing eye contact nothing
 * watched). The label says, in as many words, that no model is called. It does not move,
 * it does not collapse, and it is the first thing in the component.
 *
 * Changing any control clears the trace. A trace on screen always belongs to the settings
 * on screen; a stale one would be a quieter version of the same lie.
 *
 * This is a client component that still server-renders: it pulls in no editor, no grammar
 * and no network, so a reader with JavaScript off — or a crawler — still gets the goal,
 * the tools, the tool descriptions and the system prompt as real text. Only the Run button
 * needs the browser.
 */
export function AgentLab({ scenario }: { scenario: LabScenario }) {
  const [settings, setSettings] = useState<LabSettings>(() => defaultSettings(scenario));
  const [trace, setTrace] = useState<LabTrace | null>(null);
  const [revealed, setRevealed] = useState(0);
  const baseId = useId();

  const prompt = useMemo(() => systemPromptText(scenario, settings), [scenario, settings]);

  /** Every settings change invalidates the trace, so the two can never disagree. */
  const change = useCallback((patch: Partial<LabSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setTrace(null);
    setRevealed(0);
  }, []);

  const handleRun = useCallback(() => {
    setTrace(runAgentLab(scenario, settings));
    setRevealed(1);
  }, [scenario, settings]);

  const handleReset = useCallback(() => {
    setSettings(defaultSettings(scenario));
    setTrace(null);
    setRevealed(0);
  }, [scenario]);

  const toggleTool = (name: string, on: boolean) =>
    change({
      enabledTools: on
        ? [...settings.enabledTools, name]
        : settings.enabledTools.filter((t) => t !== name),
    });

  const toggleClause = (id: string, on: boolean) =>
    change({
      enabledClauses: on
        ? [...settings.enabledClauses, id]
        : settings.enabledClauses.filter((c) => c !== id),
    });

  const finished = trace !== null && revealed >= trace.frames.length;

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface-raised"
    >
      <div className="border-b border-line bg-warning-wash px-5 py-3 sm:px-6">
        <LessonLabel>Simulation — no model is called</LessonLabel>
        <p className="mt-1 text-caption leading-relaxed text-ink-muted">
          This lab runs a <strong className="font-medium text-ink">scripted agent in your browser</strong>. There
          is no AI model behind it, nothing you choose or click is sent anywhere, and the same settings always
          produce exactly the same trace. What it teaches is the shape of the loop — which is the part people
          actually get wrong. The words a real model would choose are not what is being demonstrated here.
        </p>
      </div>

      <div className="border-b border-line bg-surface-sunken px-5 py-4 sm:px-6">
        <LessonLabel>Agent lab</LessonLabel>
        <h3 id={`${baseId}-title`} className="mt-1 text-heading font-semibold text-ink">
          {scenario.title}
        </h3>
        <p className="mt-2 text-caption leading-relaxed text-ink-muted">{scenario.brief}</p>
        <p className="mt-3 rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-caption text-ink">
          <span className="font-mono text-micro font-semibold tracking-widest text-ink-subtle uppercase">Goal </span>
          {scenario.goal}
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5 border-b border-line px-5 py-4 lg:border-r lg:border-b-0">
          <fieldset>
            <legend className="font-mono text-micro font-semibold tracking-widest text-ink-subtle uppercase">
              Tools the agent may use
            </legend>
            <div className="mt-2.5 flex flex-col gap-3">
              {scenario.tools.map((tool) => {
                const on = settings.enabledTools.includes(tool.name);
                const chosen = settings.descriptionChoice[tool.name] ?? tool.descriptions[0]?.id;
                return (
                  <div key={tool.name} className="rounded-lg border border-line px-3.5 py-3">
                    <label className="flex items-start gap-2.5 text-caption text-ink">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => toggleTool(tool.name, e.target.checked)}
                        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="font-mono text-caption">{tool.name}</span>
                    </label>
                    <p className="mt-1.5 text-micro leading-relaxed text-ink-subtle">{tool.about}</p>

                    {tool.descriptions.length > 1 ? (
                      <fieldset className="mt-2.5">
                        <legend className="text-micro text-ink-subtle">Description the agent reads</legend>
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {tool.descriptions.map((d) => (
                            <label key={d.id} className="flex items-start gap-2 text-micro leading-relaxed text-ink-muted">
                              <input
                                type="radio"
                                name={`${baseId}-${tool.name}-desc`}
                                checked={chosen === d.id}
                                onChange={() =>
                                  change({
                                    descriptionChoice: { ...settings.descriptionChoice, [tool.name]: d.id },
                                  })
                                }
                                className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]"
                              />
                              <span>
                                <span className="font-medium text-ink">{d.label}: </span>
                                <span className="font-mono">{d.text}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ) : (
                      <p className="mt-2 font-mono text-micro leading-relaxed text-ink-muted">
                        {tool.descriptions[0]?.text}
                      </p>
                    )}

                    <ul className="mt-2 flex flex-col gap-0.5">
                      {tool.parameters.map((p) => (
                        <li key={p.name} className="font-mono text-micro text-ink-subtle">
                          {p.name}: {p.type} — {p.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-mono text-micro font-semibold tracking-widest text-ink-subtle uppercase">
              System prompt
            </legend>
            <p className="mt-1.5 text-micro leading-relaxed text-ink-subtle">
              Assembled from fixed clauses rather than free text, because a scripted runtime can only react to
              choices it was written to understand. A real model reads whatever you type — and ignores plenty of it.
            </p>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {scenario.clauses.map((clause) => (
                <div key={clause.id}>
                  <label className="flex items-start gap-2.5 text-caption leading-relaxed text-ink">
                    <input
                      type="checkbox"
                      checked={settings.enabledClauses.includes(clause.id)}
                      onChange={(e) => toggleClause(clause.id, e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                    />
                    <span>{clause.text}</span>
                  </label>
                  <p className="mt-0.5 pl-7 text-micro leading-relaxed text-ink-subtle">{clause.note}</p>
                </div>
              ))}
            </div>
            <pre className="mt-2.5 overflow-x-auto rounded-lg border border-line bg-surface-sunken px-3 py-2.5 font-mono text-micro leading-relaxed whitespace-pre-wrap text-ink-muted">
              {prompt}
            </pre>
          </fieldset>

          <fieldset>
            <legend className="font-mono text-micro font-semibold tracking-widest text-ink-subtle uppercase">Step limit</legend>
            <p className="mt-1.5 text-micro leading-relaxed text-ink-subtle">
              The most thought → action → observation cycles the loop is allowed before it is cut off.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {scenario.stepLimits.map((limit) => (
                <label
                  key={limit}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-caption transition-colors ${
                    settings.stepLimit === limit
                      ? "border-accent bg-accent-wash text-ink"
                      : "border-line text-ink-muted hover:bg-surface-sunken"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${baseId}-limit`}
                    checked={settings.stepLimit === limit}
                    onChange={() => change({ stepLimit: limit })}
                    className="sr-only"
                  />
                  {limit} steps
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="flex items-start gap-2.5 text-caption leading-relaxed text-ink">
              <input
                type="checkbox"
                checked={settings.showObservations}
                onChange={(e) => change({ showObservations: e.target.checked })}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span>Show the agent what its actions returned</span>
            </label>
            <p className="mt-0.5 pl-7 text-micro leading-relaxed text-ink-subtle">
              Switch this off to see what an agent does when the result of its own action never reaches it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRun}
              className={LESSON_BUTTON_PRIMARY}
            >
              Run the agent
            </button>
            <button
              type="button"
              onClick={handleReset}
              className={LESSON_BUTTON}
            >
              Reset everything
            </button>
          </div>
        </div>

        <div className="flex min-h-[18rem] flex-col px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-micro font-semibold tracking-widest text-ink-subtle uppercase">Trace</p>
            {trace ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRevealed((r) => Math.max(1, r - 1))}
                  disabled={revealed <= 1}
                  className={LESSON_BUTTON}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setRevealed((r) => Math.min(trace.frames.length, r + 1))}
                  disabled={finished}
                  className={LESSON_BUTTON_PRIMARY}
                >
                  Next frame
                </button>
                <button
                  type="button"
                  onClick={() => setRevealed(trace.frames.length)}
                  disabled={finished}
                  className={LESSON_BUTTON}
                >
                  Show all
                </button>
              </div>
            ) : null}
          </div>

          {trace === null ? (
            <p className="mt-4 text-caption leading-relaxed text-ink-subtle">
              Nothing has run yet. Press <span className="font-medium text-ink">Run the agent</span>, then step
              through one frame at a time.
            </p>
          ) : (
            <>
              <ol aria-live="polite" className="mt-3 flex flex-col gap-2.5">
                {trace.frames.slice(0, revealed).map((frame, i) => (
                  <li key={i}>
                    <FrameView frame={frame} />
                  </li>
                ))}
              </ol>

              {finished ? (
                <div role="status" className="mt-4 rounded-lg border border-line bg-surface-sunken px-4 py-3">
                  <p className="text-caption font-medium text-ink">
                    {OUTCOME_LINE[trace.outcome]} · {trace.stepsUsed}{" "}
                    {trace.stepsUsed === 1 ? "step" : "steps"} used of {settings.stepLimit} allowed.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-micro leading-relaxed text-ink-muted">
                    {scenario.lessons.map((lesson, i) => (
                      <li key={i}>{lesson}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-micro text-ink-subtle">
                  Frame {revealed} of {trace.frames.length}.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const OUTCOME_LINE: Record<LabTrace["outcome"], string> = {
  answered: "Reached the answer the goal asked for",
  guessed: "Answered without checking anything — the answer is invented",
  "admitted-uncertainty": "Could not look it up, and said so",
  "step-limit": "Cut off by the step limit with no answer",
  stuck: "Went nowhere",
};

const FRAME_LABEL: Record<LabFrame["kind"], string> = {
  thought: "Thought",
  action: "Action",
  observation: "Observation",
  blocked: "Blocked",
  answer: "Answer",
  stopped: "Stopped",
};

function FrameView({ frame }: { frame: LabFrame }) {
  const tone =
    frame.kind === "answer"
      ? frame.correct
        ? "border-positive/50 bg-positive/10"
        : "border-danger/50 bg-danger/10"
      : frame.kind === "blocked" || frame.kind === "stopped"
        ? "border-danger/40 bg-danger/5"
        : frame.kind === "observation" && frame.error
          ? "border-danger/40 bg-danger/5"
          : frame.kind === "action"
            ? "border-accent/40 bg-accent-wash"
            : "border-line bg-surface-sunken";

  return (
    <div className={`rounded-lg border px-3.5 py-2.5 ${tone}`}>
      <p className="font-mono text-micro font-semibold tracking-widest text-ink-subtle uppercase">
        Step {frame.step} · {FRAME_LABEL[frame.kind]}
        {frame.kind === "action" && frame.wrong ? " · wrong call" : ""}
        {frame.kind === "observation" && frame.error ? " · error" : ""}
      </p>
      {frame.kind === "action" ? (
        <pre className="mt-1 overflow-x-auto font-mono text-caption whitespace-pre-wrap text-ink">
          {`${frame.tool}(${Object.entries(frame.args)
            .map(([k, v]) => `${k}="${v}"`)
            .join(", ")})`}
        </pre>
      ) : frame.kind === "observation" ? (
        frame.hidden ? (
          <p className="mt-1 text-caption leading-relaxed text-ink-subtle italic">
            Hidden from the agent. The tool returned something, but the agent was not shown it — so nothing
            new entered its context this turn.
          </p>
        ) : (
          <pre className="mt-1 overflow-x-auto font-mono text-caption whitespace-pre-wrap text-ink-muted">
            {frame.text}
          </pre>
        )
      ) : (
        <p className="mt-1 text-caption leading-relaxed text-ink">{frame.text}</p>
      )}
    </div>
  );
}
