"use client";

import { useId } from "react";

/**
 * The person on the other side of the table.
 *
 * The room used to be a page of text. That is a strange thing to sit in front of with a
 * camera on: the candidate is exposed and nothing is exposed back, which is worse than
 * either being on camera with a person or being on neither. This is what the camera
 * reciprocates.
 *
 * **Drawn, and unmistakably a machine.** A synthetic photoreal face gets mistaken for a
 * real person, and the moment a candidate believes there is a human here the product has
 * lied to them. Krivih is a glowing circuit-drawn head: it occupies the chair and is
 * honest about what it is.
 *
 * **It has a name: Krivih** (owner, 4 November 2026; earlier it had none). The name is
 * shown here and in marketing. The spoken prompts do not yet introduce it by name — that
 * changes what the model says, and wants a live check first.
 *
 * **Nothing here is lip-synced.** The obvious next step would be to run the question
 * audio through a Web Audio analyser and drive the mouth from the real amplitude, and it
 * is deliberately not done: `createMediaElementSource` re-routes the element's output
 * through the audio graph, so getting it wrong makes the interviewer silent, and the
 * signed audio URL is cross-origin, so the analyser would very likely read zeroes and
 * leave the face slack while it talks. A confident, unsynced speaking motion reads better
 * than a broken synced one, and it cannot break the interview.
 *
 * The one thing that *is* driven by real data is listening, which uses the microphone
 * meter the room already has — so the figure genuinely leans into a loud answer.
 */

export type PresenceState =
  /** Reading the question out. */
  | "speaking"
  /** The candidate has the floor. */
  | "listening"
  /** Between the answer ending and the next question existing. */
  | "thinking"
  /** Before the round starts, or after it ends. */
  | "waiting";

interface InterviewerPresenceProps {
  state: PresenceState;
  /** Microphone level, 0 to 1. Only meaningful while listening. */
  level?: number;
  compact?: boolean;
  /**
   * The centred stage for spoken-only rounds: Krivih large, then name, designation and
   * status (owner, 4 November 2026). Workspace rounds keep the compact row.
   */
  stage?: { designation: string };
}

export function InterviewerPresence({ state, level = 0, compact = false, stage }: InterviewerPresenceProps) {
  const attentive = state === "listening";

  if (stage) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative grid size-40 place-items-center">
          {/* Two soft halos; the inner one breathes with the candidate's voice while listening. */}
          <span aria-hidden className="absolute inset-0 rounded-full border border-accent/10 bg-accent-wash/40" />
          <span
            aria-hidden
            className={`absolute inset-4 rounded-full border transition-[transform,border-color] duration-500 ${
              state === "speaking" ? "border-accent/60" : attentive ? "border-positive/50" : "border-accent/15"
            } bg-accent-wash/70`}
            style={attentive ? { transform: `scale(${1 + Math.min(level, 1) * 0.08})` } : undefined}
          />
          <span className="relative">
            <Portrait state={state} size="stage" />
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="flex items-center gap-2 text-heading font-bold text-ink">
            Krivih
            <span className="rounded-full bg-accent-wash px-2 py-0.5 font-mono text-micro font-bold tracking-widest text-accent uppercase">
              AI
            </span>
          </span>
          <span className="text-caption text-ink-muted">{stage.designation}</span>
        </div>
        <span role="status" className="flex items-center gap-2 text-caption font-semibold text-ink">
          <span aria-hidden className={`size-2 rounded-full ${STATUS_DOT[state]}`} />
          {STAGE_STATUS[state]}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${compact ? "gap-2.5" : "gap-4"}`}>
      <div className="relative shrink-0">
        {/*
         * The ring is the only thing that carries the accent, and only while the
         * interviewer is actually doing something. A permanently glowing avatar is
         * decoration; one that lights up when it speaks is information.
         */}
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full border transition-[opacity,transform] duration-500 ${
            state === "speaking"
              ? "border-accent opacity-100"
              : attentive
                ? "border-accent/50 opacity-100"
                : "border-transparent opacity-0"
          }`}
          style={attentive ? { transform: `scale(${1 + Math.min(level, 1) * 0.06})` } : undefined}
        />
        <Portrait state={state} size={compact ? "compact" : "regular"} />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Krivih · your AI interviewer
        </span>
        {/*
         * The one accessible announcement of what the interviewer is doing. The portrait
         * itself is decorative: a screen reader that described both would say it twice.
         */}
        <span role="status" className="text-caption text-ink-muted">
          {DESCRIPTION[state]}
        </span>
      </div>
    </div>
  );
}

/** The stage's status line: a little warmer than the row's, since it stands alone. */
const STAGE_STATUS: Record<PresenceState, string> = {
  speaking: "Asking you a question",
  listening: "Listening to your answer",
  thinking: "Considering your answer",
  waiting: "Ready when you are",
};

const STATUS_DOT: Record<PresenceState, string> = {
  speaking: "bg-accent",
  listening: "bg-positive",
  thinking: "bg-highlight",
  waiting: "bg-ink-subtle",
};

/** What the figure is doing, in words, for anyone who would rather read than watch. */
const DESCRIPTION: Record<PresenceState, string> = {
  speaking: "Asking you a question",
  listening: "Listening",
  thinking: "Considering your answer",
  waiting: "Ready when you are",
};

/**
 * Krivih: a glowing, circuit-drawn AI head in a dark disc (owner, 4 November 2026).
 *
 * Unmistakably a machine — cyan line-work, circuit traces, lit eyes — so nobody sitting
 * across from it believes there is a person here, which was the reason the earlier
 * portrait was drawn rather than photographed. Fixed colours rather than theme tokens:
 * it is artwork, and it should look the same on a light page and a dark one.
 *
 * The `presence-*` class hooks are the same as before, so it still breathes, talks and
 * glances while thinking.
 */
function Portrait({ state, size }: { state: PresenceState; size: "compact" | "regular" | "stage" }) {
  const id = useId().replace(/:/g, "");
  const glow = `krivih-glow-${id}`;
  const disc = `krivih-disc-${id}`;
  const frame = `krivih-frame-${id}`;

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${size === "compact" ? "size-11" : size === "stage" ? "size-28" : "size-[72px]"} ${state === "speaking" ? "presence-speaking" : ""} ${
        state === "thinking" ? "presence-thinking" : ""
      }`}
      aria-hidden
    >
      <defs>
        <radialGradient id={disc} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#123a6e" />
          <stop offset="60%" stopColor="#0a1f42" />
          <stop offset="100%" stopColor="#050d1f" />
        </radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={frame}>
          <circle cx="60" cy="60" r="56" />
        </clipPath>
      </defs>

      <circle cx="60" cy="60" r="56" fill={`url(#${disc})`} />

      <g clipPath={`url(#${frame})`}>
        {/* Circuit traces behind the head: the room it lives in. */}
        <g stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1" fill="none">
          <path d="M8 34h18l6 6h8M8 78h14l8-8h8M112 30H94l-6 6h-8M112 82H96l-8-8h-8M20 100l12-12M100 100L88 88" />
          <circle cx="40" cy="40" r="1.6" fill="#38bdf8" />
          <circle cx="38" cy="70" r="1.6" fill="#38bdf8" />
          <circle cx="80" cy="36" r="1.6" fill="#38bdf8" />
          <circle cx="80" cy="74" r="1.6" fill="#38bdf8" />
        </g>

        <g
          className="presence-figure"
          filter={`url(#${glow})`}
          stroke="#7dd3fc"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {/* Shoulders and neck, as a glowing contour. */}
          <path d="M18 122c2-18 14-27 28-30l8-2v-10M102 122c-2-18-14-27-28-30l-8-2v-10" />
          <path d="M54 92l6 7 6-7" strokeOpacity="0.8" />
          {/* Head: a smooth shell with a seam across the brow. */}
          <path d="M60 18c-14 0-24 10-24 26 0 13 6 25 15 31 3 2 6 3 9 3s6-1 9-3c9-6 15-18 15-31 0-16-10-26-24-26z" fill="#0b2a52" fillOpacity="0.55" />
          <path d="M40 38c6-4 13-5 20-5s14 1 20 5" strokeOpacity="0.55" />
          <path d="M60 22v9M48 60l-6 4M72 60l6 4" strokeOpacity="0.5" />

          <g className="presence-eyes">
            <path d="M47 47h8M65 47h8" stroke="#e0f2fe" strokeWidth="3" />
          </g>

          {/* The mouth: a light bar that pulses when Krivih talks. */}
          <rect
            x="53"
            y="62"
            width="14"
            height="2.6"
            rx="1.3"
            className="presence-mouth"
            fill="#e0f2fe"
            stroke="none"
          />
        </g>
      </g>

      <circle cx="60" cy="60" r="56" fill="none" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.5" />
    </svg>
  );
}
