"use client";

import type { SessionView } from "@untiered/shared";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { fetchMe } from "@/lib/api";
import { loadVoices, pickVoice, speak, type SpokenHandle } from "@/lib/browser-speech";
import { SPEECH_LEVEL } from "@/lib/silence";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { useInterviewCapture } from "@/lib/use-interview-capture";
import { liveTranscriptSupported } from "@/lib/use-live-transcript";
import { displayNameFor } from "@/lib/display-name";

type Capture = ReturnType<typeof useInterviewCapture>;

/**
 * The antechamber, run as a pre-flight rather than a status panel.
 *
 * Nobody should discover a dead microphone thirty seconds into a round they set aside
 * half an hour for. But the older version of this screen only *reported* — it said the
 * microphone was ready the instant the browser handed over a track, which is not the same
 * claim at all: a muted headset, a microphone captured by another app, and speakers turned
 * to zero all pass that test and all ruin the round.
 *
 * So every check here is something actually attempted, one at a time, in the order a
 * candidate would attempt them. The meter has to genuinely move before the microphone is
 * called working. The interviewer's voice is genuinely spoken aloud, so the candidate hears
 * it here rather than discovering in the room that their volume was down. Nothing is a
 * green tick because a capability exists — only because it was exercised.
 *
 * Running them in sequence is not decoration either. All checks resolving at once is a
 * loading screen; one thing at a time, each settling before the next begins, is a person
 * being walked through it, and this screen's other job is to settle someone's nerves.
 *
 * **Only the microphone gates entry.** No local voice and, for spoken-only rounds, no
 * live transcript are ordinary facts about a browser, not faults. The round runs
 * regardless — a check that blocked on them would invent a requirement.
 *
 * Entering is a click, and that is load-bearing rather than incidental: a browser refuses
 * to play audio with sound until the document has been interacted with, so without a
 * deliberate press the first question is synthesised, stored, served, and then silently
 * swallowed by the tab. It is also why the voice check offers a replay button — the same
 * refusal can hold back the check's own hello, and the way out of it is a press.
 */
export function DeviceCheck({
  session,
  capture,
  onEnter,
  entering = false,
  entryError = null,
}: {
  session: SessionView;
  capture: Capture;
  onEnter: () => void;
  entering?: boolean;
  entryError?: string | null;
}) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const requested = useRef(false);

  // Ask once, on arrival. Re-asking on every render would spam a candidate who declined.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void capture.requestDevices();
  }, [capture]);

  useEffect(() => {
    if (previewRef.current && capture.stream) {
      previewRef.current.srcObject = capture.stream;
    }
  }, [capture.stream]);

  const firstName = useCandidateFirstName();
  // The workspace is composed only when the candidate enters the room. Preflight must
  // describe the selected round, even though session.workspace is still null here.
  const workspaceKind =
    session.roundType === "coding_practical"
      ? "dsa"
      : session.roundType === "system_design"
        ? "system_design"
        : session.workspace?.kind ?? null;
  const hasWorkspace = workspaceKind !== null;

  const accessReady = capture.state === "ready" || capture.state === "recording";
  const blocked = capture.state === "denied" || capture.state === "unsupported";

  /* ---- 1. The microphone, as the browser sees it. ------------------------------- */

  const microphone: CheckStatus = accessReady ? "passed" : blocked ? "blocked" : "running";
  const microphoneSettled = microphone === "passed";

  /* ---- 2. The microphone, as the room will hear it. ----------------------------- */

  const [heard, setHeard] = useState(false);

  // The meter changes on every animation frame. Depending on it directly would rebuild the
  // sampler each frame and throw away the readings it has accumulated, so it is read
  // through a ref — the same reason the room's silence detector does it this way.
  const levelRef = useRef(capture.level);
  useEffect(() => {
    levelRef.current = capture.level;
  });

  useEffect(() => {
    if (!microphoneSettled || heard) return;

    // Sound is counted rather than latched. One frame over the threshold is a door closing
    // or a chair moving; a third of a second of it, which need not be continuous, is
    // somebody talking. `SPEECH_LEVEL` is the line the round itself already uses to tell
    // speech from room noise, so this check and the answer detector cannot disagree.
    let ticksHeard = 0;
    const meter = setInterval(() => {
      if (levelRef.current < SPEECH_LEVEL) return;
      ticksHeard += 1;
      if (ticksHeard >= HEARD_TICKS) setHeard(true);
    }, HEARD_TICK_MS);

    return () => {
      clearInterval(meter);
    };
  }, [heard, microphoneSettled]);

  const hearing: CheckStatus = !microphoneSettled
    ? "waiting"
    : heard
      ? "passed"
      : "running";
  const hearingSettled = settled(hearing);

  /* ---- 3. The interviewer's voice, said out loud. ------------------------------- */

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const chosenVoice = useRef<SpeechSynthesisVoice | null>(null);
  const utterance = useRef<SpokenHandle | null>(null);

  /**
   * Say the line. `announce` is false for the replay button, and that is the whole of the
   * difference: a check that has already reached a verdict must not fall back to "running"
   * because somebody asked to hear it again — the counter would go backwards and the two
   * checks behind it would rewind with it. A replay can only ever change the verdict from
   * held to spoken or the other way round.
   */
  const sayHello = useCallback((announce: boolean) => {
    if (announce) setVoiceState("speaking");
    utterance.current?.cancel();
    utterance.current = speak({
      text: VOICE_LINE,
      voice: chosenVoice.current,
      onEnd: (reason) => setVoiceState(reason === "finished" ? "spoke" : "held"),
    });
  }, []);

  useEffect(() => {
    if (!hearingSettled || voiceState !== "idle") return;
    let active = true;

    void loadVoices().then((voices) => {
      if (!active) return;
      const voice = pickVoice(voices, session.language);
      // No usable local voice is an answer, not a failure: the round falls back to the
      // voice synthesised on the server, which is where it came from before browsers were
      // asked at all. Saying so is worth more than a red cross.
      if (!voice) {
        setVoiceState("server");
        return;
      }
      chosenVoice.current = voice;
      setVoiceName(voice.name);
      sayHello(true);
    });

    return () => {
      active = false;
    };
  }, [hearingSettled, sayHello, session.language, voiceState]);

  // A synthesiser that is never going to speak does not report that it is not going to
  // speak; it just never fires an event. Waiting on it forever would strand the sequence.
  useEffect(() => {
    if (voiceState !== "speaking") return;
    const timer = setTimeout(() => setVoiceState("held"), VOICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [voiceState]);

  // Leaving with a sentence still in the air would have the check talking over the first
  // question of the round.
  useEffect(() => () => utterance.current?.cancel(), []);

  const voice: CheckStatus = !hearingSettled
    ? "waiting"
    : voiceState === "spoke"
      ? "passed"
      : voiceState === "server" || voiceState === "held"
        ? "noted"
        : "running";
  const voiceSettled = settled(voice);

  /* ---- 4. Whether their own words can be mirrored back. ------------------------- */

  // A capability rather than state — it cannot change while the page is open, so there is
  // nothing to subscribe to. Read this way rather than during render because the server
  // and the browser disagree about it, and a hydration mismatch on a screen whose whole
  // job is reassurance would be a poor trade.
  const canMirror = useSyncExternalStore(subscribeNever, liveTranscriptSupported, absentOnServer);

  const transcriptDwelt = useDwell(voiceSettled);
  const transcript: CheckStatus = !voiceSettled
    ? "waiting"
    : !transcriptDwelt
      ? "running"
      : canMirror
        ? "passed"
        : "noted";
  const transcriptSettled = hasWorkspace || settled(transcript);

  /* ---- 5. The camera, if they asked for one. ------------------------------------ */

  const cameraLive = (capture.stream?.getVideoTracks().length ?? 0) > 0;
  const cameraDwelt = useDwell(transcriptSettled);
  const camera: CheckStatus = !transcriptSettled
    ? "waiting"
    : !cameraDwelt
      ? "running"
      : cameraLive
        ? "passed"
        : "noted";

  const checks: Check[] = [
    {
      label: "Microphone access",
      detail: accessDetail(capture.state),
      status: microphone,
    },
    {
      label: "Your microphone",
      detail:
        hearing === "waiting"
          ? "The meter has to actually move before this one passes."
          : heard
            ? "Heard you. That is the level the interviewer will be working from."
            : "Say something. “Testing, one two” is plenty, and the meter should move.",
      status: hearing,
      aside: microphoneSettled ? <LevelMeter level={capture.level} /> : undefined,
    },
    {
      label: "The interviewer's voice",
      detail: voiceDetail(voiceState, voiceName),
      status: voice,
      action:
        voiceName && (voiceState === "spoke" || voiceState === "held") ? (
          <button
            type="button"
            onClick={() => sayHello(false)}
            // Underlined at rest, not only on hover. It is the one control on this card,
            // and a candidate who did not hear the line is exactly the person who must not
            // have to guess that the words are pressable.
            className="mt-1 self-start text-caption text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent"
          >
            Say that again
          </button>
        ) : undefined,
    },
  ];

  if (!hasWorkspace) {
    checks.push({
      label: "Your words on screen",
      detail:
        transcript === "passed"
          ? "You will see what we are hearing as you talk. It is a mirror — the report uses the assessed answer and transcript, not this browser preview."
          : transcript === "noted"
            ? "This browser cannot mirror your words back; Chrome and Edge can. Nothing else changes — the round is unaffected."
            : "Whether this browser can show your words back to you as you talk.",
      status: transcript,
    });
  }

  if (session.consentVideo) {
    checks.push({
      label: "Camera",
      detail:
        camera === "passed"
          ? "On, and pointed at you. It never leaves this browser."
          : camera === "noted"
            ? "The camera did not open. The round is spoken, so nothing here depends on it."
            : "Your own view, on this screen and nowhere else.",
      status: camera,
    });
  }

  const done = checks.filter((check) => settled(check.status)).length;
  const allSettled = done === checks.length;
  const anythingNoted = checks.some((check) => check.status === "noted");

  const statusLine = blocked
    ? capture.error
      ? null
      : "The round is spoken, so it cannot start without a microphone."
    : !accessReady
      ? "Your browser is asking for the microphone. Answer that and this opens."
      : !heard
        ? "Say “testing, one two” so we know the microphone carries your voice. The remaining checks start after that."
      : !allSettled
        ? "Your microphone works. Finishing the remaining checks now."
        : anythingNoted
          ? "You are set. A couple of things work differently on this browser — noted above, and none of them stop the round."
          : "Everything works. The interviewer speaks first; take your time when it does. Thinking before you answer is what a good candidate does.";

  return (
    /*
     * Two columns that interlock rather than stack: the greeting and the checks run down
     * the left, the candidate's own camera and what the round will be like down the right,
     * with the camera tile level with the greeting the way it would be in a video call.
     * On a phone this is one column and the DOM order is already the right one — greeting,
     * their own face, the checks, the button, then the notes.
     */
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-center gap-6 px-6 py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:content-center lg:gap-6">
      <header className="relative overflow-hidden rounded-surface bg-navy p-7 text-on-navy shadow-[var(--shadow-md)] lg:col-start-1 lg:row-start-1 sm:p-9">
        <div aria-hidden="true" className="absolute -top-20 -right-14 size-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex max-w-2xl flex-col gap-3">
        <p className="pill pill-navy w-fit">
          {session.companyName} · {session.roundLabel} · {session.durationMinutes} minutes
        </p>
        <h1 className="text-display text-balance text-on-navy">
          {firstName ? `Hi ${firstName}.` : "Before you go in."}
        </h1>
        <p className="max-w-prose text-body text-on-navy-muted">
          A short check first, so nothing has to be discovered mid-answer: your microphone,
          the interviewer&rsquo;s voice, and what you will see on screen while you talk.
        </p>
        <p className="max-w-prose text-caption text-on-navy-muted">{session.groundingNote}</p>
        </div>
      </header>

      {session.consentVideo ? (
        // Capped on a phone. A self-view is a mirror, not the content: at full width it
        // pushes the checks and the button that follow them off the screen entirely.
        <figure className="flex max-w-64 flex-col gap-2.5 rounded-2xl border border-line bg-surface-raised p-3 shadow-[var(--shadow-md)] lg:max-w-none lg:col-start-2 lg:row-start-1 lg:self-stretch">
          <div className="relative overflow-hidden rounded-xl border border-line bg-surface-sunken">
            <video
              ref={previewRef}
              muted
              autoPlay
              playsInline
              aria-label="Your camera preview"
              className="aspect-4/3 w-full object-cover"
            />
            {cameraLive ? (
              // A nameplate, the way every video call puts one there. Solid, not a
              // translucent panel over the picture — there is no reason to blur a
              // candidate's own face to get a label onto it.
              <span className="absolute bottom-2 left-2 rounded-sm border border-line bg-surface-raised px-2 py-1 font-mono text-micro text-ink">
                {firstName ?? "You"}
              </span>
            ) : (
              <span className="absolute inset-0 grid place-items-center px-4 text-center text-caption text-ink-subtle">
                Waiting for the camera.
              </span>
            )}
          </div>
          {/*
            * The same promise the consent checkbox made, kept in front of them at the
            * moment the camera actually opens. It is shown and not recorded, and a screen
            * that let anyone assume otherwise would be the product lying.
            */}
          <figcaption className="text-caption text-ink-muted">
            This stays on your screen. Nothing from the camera is uploaded, recorded or
            scored — the round is assessed from your voice.
          </figcaption>
        </figure>
      ) : null}

      <div className="flex flex-col gap-8 lg:col-start-1 lg:row-start-2">
        <section aria-labelledby="preflight" className="overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-md)]">
          <div className="flex items-baseline justify-between gap-4 px-5 py-3">
            <h2 id="preflight" className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
              System check
            </h2>
            <span className="font-mono text-micro text-ink-subtle tabular-nums">
              {done} of {checks.length}
            </span>
          </div>

          {/* How far through, as a rule rather than a bar. The accent is carrying
              information here, which is the only reason it is on this screen at all. */}
          <div aria-hidden className="h-px w-full bg-line">
            <div
              className="h-px bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${(done / checks.length) * 100}%` }}
            />
          </div>

          {/*
            * Announced as it goes. The whole point of the screen is that each check settles
            * visibly, and somebody using a screen reader is owed the same sequence rather
            * than a silent page and a button that turns on.
            */}
          <ul aria-live="polite" className="flex flex-col divide-y divide-line">
            {checks.map((check) => (
              <CheckRow key={check.label} {...check} />
            ))}
          </ul>
        </section>

        {capture.error ? (
          <p role="alert" className="text-body text-danger">
            {capture.error}
          </p>
        ) : null}

        {entryError ? (
          <p role="alert" className="text-body text-danger">
            {entryError}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={onEnter}
            disabled={!accessReady || !heard || entering}
            className="self-start rounded-xl bg-accent px-7 py-3.5 text-body font-semibold text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {entering ? "Starting the interview…" : "Enter the room"}
          </button>
          {/*
            * Nothing here when the microphone is blocked and the alert above already says
            * so. The row, the alert and this line were all saying the same sentence, and
            * the third telling somebody their microphone is off does not help them.
            */}
          {statusLine ? (
            <p role="status" className="max-w-prose text-caption text-ink-muted">
              {statusLine}
            </p>
          ) : null}
        </div>
      </div>

      {/* Beside the checks, or up level with the greeting when there is no camera tile
          to hold that corner. An empty column would read as something failing to load. */}
      <section
        className={`flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] lg:col-start-2 ${
          session.consentVideo ? "lg:row-start-2" : "lg:row-span-2 lg:row-start-1 lg:self-start"
        }`}
      >
        <h2 className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          How this round runs
        </h2>
        <dl className="flex flex-col divide-y divide-line">
          <Note
            term="It is spoken"
            detail={
              workspaceKind === "dsa"
                ? "Think out loud as you write code in the editor."
                : workspaceKind === "system_design"
                  ? "Think out loud as you sketch on the board."
                  : "You answer out loud. There is nothing to type."
            }
          />
          <Note
            term="It is on a clock"
            detail={`About ${session.durationMinutes} minutes. The round ends when the time does, not after a set number of questions.`}
          />
          <Note
            term="You can ask for help"
            detail="Stuck on a question, ask for a nudge. It is recorded, and the report says so."
          />
          <Note
            term="Your answer ends itself"
            detail={
              hasWorkspace
                ? "The interviewer waits through pauses while you speak, type or draw, then responds once you stop."
                : "Stop talking and it moves on. Pausing to think is fine — a pause is not an ending."
            }
          />
        </dl>
      </section>
    </div>
  );
}

/** What the interviewer says during the check, in the register the round opens in. */
const VOICE_LINE = "Hello — I'll be your interviewer today. Can you hear me?";

/** Roughly a third of a second of sound, which need not be continuous. */
const HEARD_TICKS = 3;
const HEARD_TICK_MS = 100;

/**
 * How long a synthesiser gets to finish the line before it is treated as held back.
 *
 * A browser that refuses usually says so — `onerror` fires and the check settles at once.
 * This is for the ones that neither start nor complain, which is what a headless Chromium
 * with no audio device does, and it wants to be comfortably past a slow voice reading a
 * short sentence (about four seconds) without leaving anybody watching a row that has
 * plainly stopped. It self-corrects: a voice that finishes late still reports it.
 */
const VOICE_TIMEOUT_MS = 8_000;

/**
 * How long a check that resolves instantly is left visible before the next begins.
 *
 * The check is real either way; this only paces the display. Two rows flicking to green in
 * the same frame reads as a progress bar that was always going to fill, which is exactly
 * the impression a pre-flight must not give — the sequence is legible only if each step is
 * seen to happen.
 */
const DWELL_MS = 450;

type CheckStatus =
  /** Queued behind a check that has not finished. */
  | "waiting"
  /** Being attempted right now. */
  | "running"
  /** Worked. */
  | "passed"
  /** Worked out differently, and the round does not care. Never blocks entry. */
  | "noted"
  /** Only the microphone can be this, and it is the one thing that stops the round. */
  | "blocked";

type VoiceState =
  /** Not started. */
  | "idle"
  /** Mid-sentence. */
  | "speaking"
  /** Said out loud, start to finish. */
  | "spoke"
  /** No local voice worth using; the server synthesises it instead. */
  | "server"
  /** The browser would not speak without a press, or never finished. */
  | "held";

interface Check {
  label: string;
  detail: string;
  status: CheckStatus;
  /** Something live beside the label, such as the meter. */
  aside?: React.ReactNode;
  /** A way to retry the check, where retrying is a thing the candidate can usefully do. */
  action?: React.ReactNode;
}

function settled(status: CheckStatus): boolean {
  return status === "passed" || status === "noted";
}

/**
 * True once [active] has been true for [DWELL_MS], and true from then on.
 *
 * It does not reset, deliberately: a check that has run has run, and a counter that could
 * go backwards would undo the only thing this screen is trying to build.
 */
function useDwell(active: boolean): boolean {
  const [dwelt, setDwelt] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setDwelt(true), DWELL_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return dwelt;
}

/** Nothing to subscribe to: the browser does not gain a speech recogniser mid-session. */
const subscribeNever = () => () => undefined;
const absentOnServer = () => false;

/**
 * The candidate's first name, for the greeting and the nameplate on their own camera tile.
 *
 * Read from the versioned public API the mobile apps will use, not from a server render
 * (PRD 13). It is decoration on a screen that works without it, so every failure resolves
 * to "no name" rather than to an error: an interview must not be gated behind a greeting.
 * An email address is not a name and is deliberately not substituted for one — "Hi
 * naman.kaushik06" is worse than no greeting at all.
 */
function useCandidateFirstName(): string | null {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const {
        data: { session },
      } = await createSupabaseBrowserClient().auth.getSession();
      if (!session) return;

      const me = await fetchMe({ accessToken: session.access_token, signal: controller.signal });
      // Never a whole email address as a first name: "Ready, naman.kaushik06@gmail.com?"
      const name = displayNameFor(me);
      const first = name.includes("@") ? undefined : name.split(/\s+/)[0];
      if (first && !controller.signal.aborted) setFirstName(first);
    }

    void load().catch(() => undefined);
    return () => controller.abort();
  }, []);

  return firstName;
}

function accessDetail(state: Capture["state"]): string {
  switch (state) {
    case "ready":
    case "recording":
      return "Granted. The browser has handed over your microphone.";
    case "requesting":
      return "Waiting on the browser's permission prompt.";
    case "denied":
      return "Blocked. Allow the microphone for this site, then reload.";
    case "unsupported":
      return "This browser cannot record audio. Try Chrome, Edge or Safari.";
    default:
      return "Asking your browser for the microphone.";
  }
}

function voiceDetail(state: VoiceState, name: string | null): string {
  switch (state) {
    case "speaking":
      return "Saying hello. Turn your volume up if you cannot hear anything.";
    case "spoke":
      return name
        ? `That was ${name}, speaking from your own browser — which is why it arrives instantly.`
        : "That was the voice this round uses.";
    case "server":
      return "Your browser has no voice worth using, so the interviewer's is synthesised on our side instead. It lands a few seconds after each question, and nothing else differs.";
    case "held":
      return "Your browser held the sound back until you press something. Play it, or go in — entering is a press either way.";
    default:
      return "The interviewer will say hello, so you hear the voice before the round starts.";
  }
}

function CheckRow({ label, detail, status, aside, action }: Check) {
  return (
    <li className="flex items-start gap-3.5 px-5 py-3.5">
      <StatusMark status={status} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className={`text-body ${status === "waiting" ? "text-ink-subtle" : "text-ink"}`}>
            {label}
          </span>
          {aside}
        </div>
        {/* A check that has not begun recedes, label and description together. Dimming
            only the label leaves its explanation shouting louder than its name. */}
        <p className={`text-caption ${status === "waiting" ? "text-ink-subtle" : "text-ink-muted"}`}>
          <span className="sr-only">{STATUS_WORD[status]}. </span>
          {detail}
        </p>
        {action}
      </div>
    </li>
  );
}

/** What each state is, in words, for anyone who cannot see the mark beside it. */
const STATUS_WORD: Record<CheckStatus, string> = {
  waiting: "Not started",
  running: "Checking",
  passed: "Done",
  noted: "Noted",
  blocked: "Blocked",
};

function StatusMark({ status }: { status: CheckStatus }) {
  if (status === "passed") {
    return (
      <Mark className="bg-positive">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3 stroke-surface-raised"
        >
          <path d="M3.5 8.4l3 3 6-6.8" />
        </svg>
      </Mark>
    );
  }

  if (status === "blocked") {
    return (
      <Mark className="bg-danger">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="size-3 stroke-surface-raised"
        >
          <path d="M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8" />
        </svg>
      </Mark>
    );
  }

  if (status === "running") {
    return (
      <Mark className="border border-accent/40">
        <span className="size-2 rounded-full bg-accent motion-safe:animate-pulse" />
      </Mark>
    );
  }

  // Noted keeps a mark of its own rather than borrowing the failure's: a browser without a
  // neural voice has not done anything wrong, and a red cross would say it had.
  if (status === "noted") {
    return (
      <Mark className="border border-line-strong">
        <span className="h-px w-2 bg-ink-subtle" />
      </Mark>
    );
  }

  return <Mark className="border border-line" />;
}

function Mark({ className, children }: { className: string; children?: React.ReactNode }) {
  return (
    <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${className}`}>
      {children}
    </span>
  );
}

/** Proof the microphone is live, which is the only thing that settles the question. */
function LevelMeter({ level }: { level: number }) {
  const bars = 8;
  const lit = Math.round(Math.min(1, level) * bars);
  return (
    <span aria-hidden className="flex shrink-0 items-end gap-0.5" role="presentation">
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className={`w-1 rounded-xs transition-colors ${index < lit ? "bg-accent" : "bg-line-strong"}`}
          style={{ height: `${6 + index * 2}px` }}
        />
      ))}
    </span>
  );
}

function Note({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <dt className="text-caption text-ink">{term}</dt>
      <dd className="text-caption text-ink-muted">{detail}</dd>
    </div>
  );
}
