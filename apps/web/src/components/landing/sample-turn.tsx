"use client";

import { useEffect, useRef, useState } from "react";

import { InterviewerPresence, type PresenceState } from "@/components/interviewer-presence";
import { SegmentedTabs } from "@/components/landing/segmented-tabs";

type SampleId = "service" | "product" | "consulting" | "europe";

interface Sample {
  id: SampleId;
  tab: string;
  round: string;
  question: string;
  answer: string;
  move: "challenge" | "probe" | "interrupts";
  followUp: string;
  /** The service-IT exchange is from a real session; the others are written to show the format. */
  real: boolean;
}

/**
 * Archetype-level, never employer-specific: none of these claim anything about how a
 * named company interviews (CLAUDE.md, "never fabricate employer-specific detail").
 */
export const SAMPLES: readonly [Sample, ...Sample[]] = [
  {
    id: "service",
    tab: "Service IT",
    round: "Project deep-dive",
    question: "Walk me through how your service kept the reporting view in sync with the ledger.",
    answer: "Yeah, so we used a background worker that polled the ledger table every few seconds. If it failed we just retried it. It was mostly fine.",
    move: "challenge",
    followUp: "Polling a ledger table taking hundreds of writes per second degrades the database and adds lag. How did you track which records still needed projecting?",
    real: true,
  },
  {
    id: "product",
    tab: "Product",
    round: "System design",
    question: "Design the redirect path for a URL shortener. Where does the latency go?",
    answer: "We'd put everything in a cache, so reads are basically instant, and the database only ever handles the writes.",
    move: "probe",
    followUp: "Everything? After a deploy the cache is cold and every read hits the database at once. What stops that?",
    real: false,
  },
  {
    id: "consulting",
    tab: "Big Four",
    round: "Client scenario",
    question: "The client's CFO says the migration is over budget and blames your team. What do you do in the first meeting?",
    answer: "I'd show them the timeline and explain the delays were mostly from their side changing the requirements.",
    move: "challenge",
    followUp: "You've opened by blaming the person paying you. What would you say first if you wanted to keep the account?",
    real: false,
  },
  {
    id: "europe",
    tab: "Europe",
    round: "Competency round",
    question: "Tell me about a time you disagreed with a decision and carried it out anyway.",
    answer: "So, um, there was this time, basically, the team wanted to change frameworks, and honestly a lot of things were happening that quarter, and like —",
    move: "interrupts",
    followUp: "Let me stop you there. What was the decision, and what did you do?",
    real: false,
  },
];

type Phase = "question" | "answering" | "thinking" | "followUp";

const WORD_MS = 110;
const THINK_MS = 900;
const BARS = [5, 11, 7, 16, 9, 20, 12, 8, 18, 10, 6, 14, 9, 19, 12, 7, 15, 10, 5, 13, 8, 17, 11, 6];

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The hero's interactive piece: one spoken turn, played back. The visitor picks an
 * interview archetype, presses play, watches the answer come in, and sees the
 * interviewer push back on it — which is the product's whole claim in about five
 * seconds, shown rather than described.
 */
export function SampleTurn() {
  const [sampleId, setSampleId] = useState<SampleId>("service");
  const [phase, setPhase] = useState<Phase>("question");
  const [words, setWords] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  const answerWords = sample.answer.split(" ");

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  useEffect(() => clearTimers, []);

  function select(id: SampleId) {
    clearTimers();
    setSampleId(id);
    setPhase("question");
    setWords(0);
  }

  function play() {
    clearTimers();
    const total = answerWords.length;
    if (prefersReducedMotion()) {
      setWords(total);
      setPhase("followUp");
      return;
    }
    setWords(0);
    setPhase("answering");
    for (let i = 1; i <= total; i++) {
      timers.current.push(setTimeout(() => setWords(i), i * WORD_MS));
    }
    timers.current.push(setTimeout(() => setPhase("thinking"), total * WORD_MS + 200));
    timers.current.push(setTimeout(() => setPhase("followUp"), total * WORD_MS + 200 + THINK_MS));
  }

  const presence: PresenceState =
    phase === "answering" ? "listening" : phase === "thinking" ? "thinking" : "speaking";
  const answered = phase !== "question";

  return (
    <div className="card relative w-full overflow-hidden text-ink shadow-[var(--shadow-lg)]">
      <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-5">
        <SegmentedTabs
          label="Interview type"
          idPrefix="sample-turn"
          options={SAMPLES.map((s) => ({ id: s.id, label: s.tab }))}
          value={sampleId}
          onChange={select}
        />
        <div className="flex items-center justify-between gap-3">
          <InterviewerPresence state={presence} compact />
          <span className="pill pill-accent shrink-0">{sample.round}</span>
        </div>
      </div>

      <div id="sample-turn-panel" role="tabpanel" aria-labelledby={`sample-turn-tab-${sampleId}`} className="flex min-h-[22rem] flex-col gap-3 bg-surface p-4 sm:p-5">
        <Bubble side="left" who="Interviewer">{sample.question}</Bubble>

        {answered ? (
          <Bubble side="right" who="You">
            <span className="sr-only">{sample.answer}</span>
            <span aria-hidden="true">
              {answerWords.slice(0, words).join(" ")}
              {phase === "answering" ? <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-current" /> : null}
            </span>
          </Bubble>
        ) : null}

        <div aria-live="polite" className="contents">
          {phase === "followUp" ? (
            <div className="rise-in">
              <Bubble side="left" who="Interviewer" tag={sample.move}>{sample.followUp}</Bubble>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={play}
            disabled={phase === "answering" || phase === "thinking"}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-caption font-semibold text-accent-contrast transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            <PlayIcon />
            {phase === "followUp" ? "Play again" : "Play the answer"}
          </button>
          <Waveform active={phase === "answering"} />
        </div>
      </div>

      <p className="border-t border-line px-4 py-2.5 text-micro text-ink-subtle sm:px-5">
        {sample.real ? "From a real session." : "Written to show the format, not taken from a session."}
      </p>
    </div>
  );
}

function Bubble({ side, who, tag, children }: { side: "left" | "right"; who: string; tag?: string; children: React.ReactNode }) {
  const mine = side === "right";
  return (
    <div className={`flex max-w-[88%] flex-col gap-1 ${mine ? "self-end items-end" : "self-start"}`}>
      <span className="flex items-center gap-2 text-micro font-semibold tracking-widest text-ink-subtle uppercase">
        {who}
        {tag ? <span className="pill pill-highlight normal-case tracking-normal">{tag}</span> : null}
      </span>
      <p className={`rounded-2xl px-4 py-2.5 text-caption ${mine ? "rounded-br-sm bg-navy text-on-navy" : "rounded-bl-sm border border-line bg-surface-raised text-ink"}`}>
        {children}
      </p>
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div aria-hidden="true" className="flex h-8 flex-1 items-center gap-[3px] overflow-hidden">
      {BARS.map((h, i) => (
        <span
          key={i}
          className={`w-1 shrink-0 rounded-full transition-colors ${active ? "wave-bar bg-accent" : "bg-line-strong"}`}
          style={{ height: `${h + 8}px`, animationDelay: `${(i % 6) * 90}ms` }}
        />
      ))}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
      <path d="M4 2.5v11a.5.5 0 0 0 .76.43l9-5.5a.5.5 0 0 0 0-.86l-9-5.5A.5.5 0 0 0 4 2.5Z" />
    </svg>
  );
}
