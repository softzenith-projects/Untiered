"use client";

import type { BoardState, CodeRunResult, HintView, SessionView, TurnView } from "@untiered/shared";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { DesignCasePanel, DesignWorkspace } from "@/components/design-workspace";
import { DsaProblemPanel } from "@/components/dsa-problem-panel";
import { DeviceCheck } from "@/components/device-check";
import { InterviewCompletePanel } from "@/components/interview-complete-panel";
import { RoundClock, formatDuration } from "@/components/round-clock";
import {
  ApiRequestError,
  abandonSession,
  beginSession,
  fetchSession,
  finishSession,
  type InterviewClientEvent,
  type InterviewClientPhase,
  reportInterviewClientEvent,
  requestHint,
  runCode,
  saveBoard,
  submitAnswer,
} from "@/lib/api";
import { initialSilenceState, observe, shouldEnd, shouldEndWorkspace } from "@/lib/silence";
import { revealedText } from "@/lib/spoken-text";
import { useBrowserVoice } from "@/lib/use-browser-voice";
import { useLiveTranscript } from "@/lib/use-live-transcript";
import { useAccessToken } from "@/lib/use-access-token";
import { InterviewerPresence, type PresenceState } from "@/components/interviewer-presence";
import { useInterviewCapture } from "@/lib/use-interview-capture";
import { useQuestionAudio } from "@/lib/use-question-audio";

// The editor and its language grammars are needed only in coding rounds. Keep them
// out of the first load for every other interview room.
const DsaWorkspace = dynamic(() => import("@/components/dsa-workspace").then((module) => module.DsaWorkspace), {
  ssr: false,
  loading: () => <div role="status" className="flex h-full items-center justify-center bg-navy text-on-navy-muted">Loading the editor…</div>,
});

/**
 * How long the voice gets to arrive before the question goes up in writing anyway.
 *
 * Deliberately long, and that is the interesting decision here. Measured end to end
 * against live Gemini, the next question's *text* is ready about 4s after an answer and
 * its *voice* about 14s. Speech latency is the model's, not ours: it is roughly 5s for a
 * sentence and 14s for a paragraph, and splitting a question into parallel calls (see
 * SpeechChunks) took it from 17.7s to 14s and no further.
 *
 * A short window therefore did the opposite of what it was for. The text would go up at
 * 6s, the voice would arrive at 14s and read out something already on screen — exactly
 * the mismatch this was meant to fix.
 *
 * So the room waits, and covers the wait honestly: the interviewer says "let me think
 * about that" the moment the candidate stops, and the room shows it is thinking. A pause
 * before a question, with an audible acknowledgement in it, is what a real interviewer
 * does. Text arriving ten seconds before the voice is not.
 *
 * This falls back rather than hanging: speech that genuinely failed comes back
 * `unavailable` and the question is shown immediately.
 */
const VOICE_GRACE_MS = 25_000;

/** Save while drawing at a measured cadence, and flush on window blur. */
const BOARD_SAVE_MS = 5_000;
const MAX_BOARD_BYTES = 5 * 1024 * 1024;

/** How often the design rail re-checks which phase the round is in. */
const ROUND_CLOCK_TICK_MS = 10_000;

/** A missing next heartbeat bounds when a room stopped making progress. */
const OBSERVABILITY_HEARTBEAT_MS = 30_000;

/** Last-provider calls may use the API's three-minute read deadline. This reports the stall without aborting it. */
const ANSWER_SUBMISSION_SLOW_MS = 190_000;

/**
 * How long a candidate gets to read a question that has no voice, before the microphone
 * opens. Long enough to read a couple of sentences without feeling rushed.
 */
const READING_TIME_MS = 4_000;

/** A stream that makes no progress is treated as broken, not as an infinitely long pause. */
const MODEL_AUDIO_STALL_MS = 8_000;

/** Final guard for browser/media failures that emit neither `ended` nor `error`. */
const MODEL_AUDIO_TIMEOUT_MS = 90_000;

/**
 * The longest one unbroken turn runs in a room with a workspace before the interviewer
 * comes in on their own.
 *
 * Silence usually ends a turn once speech and visible work have stopped. This ceiling
 * still bounds a take if speech or board activity never settles, keeping one recording
 * at about 3.6 MB, far inside what the model accepts in a single request.
 */
const LONGEST_WORKSPACE_TAKE_MS = 10 * 60_000;

type Phase =
  | "loading"
  | "checking"
  | "asking"
  | "answering"
  | "submitting"
  /** The interviewer is saying goodbye. A round ends with somebody saying it has. */
  | "closing"
  | "complete"
  | "terminal"
  | "error";

/**
 * The live interview.
 *
 * Deliberately near-empty (CLAUDE.md): the question, a speaking indicator, the round
 * clock, and a way out. No score ticker, no running feedback, nothing that tells a
 * candidate mid-answer how they are doing — a real interview does not.
 *
 * Two controls earn their place beside those. The answer ends itself on silence, because
 * pressing a button when you stop talking is the tell that this is a form rather than a
 * conversation. And help can be asked for, because a candidate frozen on a question has
 * no realistic move otherwise — a real interviewer nudges. Asking is recorded, and the
 * room says so before they ask rather than after.
 */
export function InterviewRoom({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const accessToken = useAccessToken();

  const [session, setSession] = useState<SessionView | null>(null);
  const [turn, setTurn] = useState<TurnView | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState<HintView | null>(null);
  const [hintPending, setHintPending] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [entering, setEntering] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const answerRequestIds = useRef(new Map<number, string>());
  const hintRequestIds = useRef(new Map<number, string>());
  const lastWorkspaceChange = useRef<number | null>(null);

  // Consent, and only consent, decides whether the camera opens. Tying this to session
  // status meant a candidate who declined video was recorded anyway (PRD 12).
  const withVideo = session?.consentVideo === true;
  const capture = useInterviewCapture({ withVideo });
  /*
   * The interviewer speaks locally when the browser has a voice worth using: instantly,
   * for nothing, and reporting where in the sentence it has reached — which is the sync
   * the reveal has been approximating with a timer. The model's recording is the fallback,
   * not the default. See use-browser-voice.ts.
   */
  const browserVoice = useBrowserVoice({ language: session?.language ?? "english" });
  /* A mirror of what the candidate is saying. Never sent anywhere; see use-live-transcript.ts. */
  const liveTranscript = useLiveTranscript({ language: session?.language ?? "english" });
  const reportSpeechEvent = useCallback(
    (event: InterviewClientEvent, eventTurnIndex: number, durationMs?: number) => {
      if (!accessToken) return;
      void reportInterviewClientEvent(
        accessToken,
        sessionId,
        event,
        eventTurnIndex,
        durationMs,
      ).catch(() => {
        // Observability must never become another way to interrupt an interview.
      });
    },
    [accessToken, sessionId],
  );
  const reportRoomEvent = useCallback(
    (
      event: InterviewClientEvent,
      eventPhase: InterviewClientPhase,
      eventTurnIndex?: number,
      requestId?: string,
    ) => {
      if (!accessToken) return;
      void reportInterviewClientEvent(
        accessToken,
        sessionId,
        event,
        eventTurnIndex,
        undefined,
        requestId,
        eventPhase,
      ).catch(() => {
        // A diagnostic signal must never interfere with the interview it describes.
      });
    },
    [accessToken, sessionId],
  );
  const questionAudio = useQuestionAudio({
    sessionId,
    turn,
    accessToken,
    onPollTimeout: (eventTurnIndex, durationMs) =>
      reportSpeechEvent("question_audio_poll_timed_out", eventTurnIndex, durationMs),
  });

  /*
   * The question appears as it is spoken, not before it.
   *
   * Reading a question, waiting, and then being read it back is worse than either alone:
   * it breaks the sense that anyone is talking to you, and it invites an answer to a
   * question the interviewer has not finished asking.
   *
   * But syncing unconditionally would be worse still. Speech takes a few seconds to
   * render, and holding the text until it lands would leave the candidate looking at an
   * empty room — so the voice only gets to lead if it arrives promptly. Past that, the
   * question goes up in writing and stays up, which is the behaviour this replaced.
   */
  const questionText = turn?.questionText ?? "";
  const turnIndex = turn?.turnIndex ?? null;

  useEffect(() => {
    reportRoomEvent("client_phase_changed", phase, turnIndex ?? undefined);
  }, [phase, reportRoomEvent, turnIndex]);

  useEffect(() => {
    if (phase === "complete" || phase === "terminal") return;
    const heartbeat = () => reportRoomEvent("client_heartbeat", phase, turnIndex ?? undefined);
    const timer = window.setInterval(heartbeat, OBSERVABILITY_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [phase, reportRoomEvent, turnIndex]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        reportRoomEvent("client_page_hidden", phase, turnIndex ?? undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [phase, reportRoomEvent, turnIndex]);

  // Both of these carry the turn they belong to, and a mismatch reads as "not yet"
  // during the same render. Clearing them in an effect instead would show one frame of
  // the previous question's progress against the new question's text.
  const [progress, setProgress] = useState({ turnIndex: -1, currentTime: 0, duration: 0 });
  const [lateFor, setLateFor] = useState<number | null>(null);
  const [closingRemark, setClosingRemark] = useState<string | null>(null);

  useEffect(() => {
    if (turnIndex === null) return;
    const timer = setTimeout(() => setLateFor(turnIndex), VOICE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [turnIndex]);

  const withinGrace = lateFor !== turnIndex;
  /** The voice is still rendering and has not used up its head start. Hold the text. */
  const speaksLocally = browserVoice.available;
  /**
   * A DSA or design room: the candidate works on something on screen, and going quiet to
   * type or draw is the work, not the end of an answer.
   */
  const hasWorkspace = session?.workspace != null;

  /*
   * What the figure opposite is doing. "asking" with a voice still rendering is thinking
   * rather than speaking — the candidate should not watch a mouth move in silence.
   */
  const presenceState: PresenceState =
    phase === "answering"
      ? "listening"
      : phase === "submitting"
        ? "thinking"
        : phase === "asking"
          ? speaksLocally
            ? browserVoice.speaking
              ? "speaking"
              : "thinking"
            : questionAudio.status === "pending"
              ? "thinking"
              : "speaking"
          : "waiting";

  const awaitingVoice = !speaksLocally && questionAudio.status === "pending" && withinGrace;
  const voiceLeads = questionAudio.status === "ready" && !!questionAudio.url && withinGrace;
  const spoken = progress.turnIndex === turnIndex ? progress : { currentTime: 0, duration: 0 };

  const visibleQuestion = speaksLocally
    ? browserVoice.saying === questionText
      ? questionText.slice(0, browserVoice.spokenChars)
      : browserVoice.said === questionText
        ? // Read to the end, or the utterance failed. Either way the question stands.
          questionText
        : // Asked for, not started. A word appearing before the voice reaches it is the
          // thing this whole mechanism exists to prevent.
          ""
    : awaitingVoice
      ? ""
      : voiceLeads
        ? revealedText(questionText, spoken.currentTime, spoken.duration)
        : // No voice is coming, or it took too long to wait for. Better an unsynced
          // question than an empty room.
          questionText;

  /*
   * The room is loaded once per sign-in, not once per access token.
   *
   * Supabase rotates the access token about an hour after it was issued, and
   * `useAccessToken` hands the room the new string. This effect used to depend on that
   * string, so a rotation mid-round re-read the session and put the room back in the device
   * check — mid-answer, or mid-question. Re-entering then left a round whose question had
   * already been spoken locally sitting in "asking" with the microphone shut, because the
   * voice will not read out a question it has already said. A rotation lands inside a
   * 20-minute round about one time in three and inside a 45-minute round most of the time,
   * which is why only the long rounds stalled. Every later request reads the token from
   * render, so it still picks up the new one.
   */
  const tokenForLoad = useRef(accessToken);
  useEffect(() => {
    tokenForLoad.current = accessToken;
  });
  const signedIn = !!accessToken;

  useEffect(() => {
    const accessToken = tokenForLoad.current;
    if (!signedIn || !accessToken) return;
    let active = true;

    fetchSession(sessionId, { accessToken })
      .then((loaded) => {
        if (!active) return;
        setSession(loaded);
        setTurn(loaded.currentTurn);
        if (loaded.status === "completed") {
          setPhase("complete");
        } else if (loaded.status === "in_progress" && loaded.currentTurn) {
          setPhase("checking");
        } else {
          setPhase("terminal");
        }
      })
      .catch((cause) => {
        if (!active) return;
        setPhase("error");
        setError(
          cause instanceof ApiRequestError ? cause.message : "This interview could not be loaded.",
        );
      });

    return () => {
      active = false;
    };
  }, [signedIn, sessionId]);

  useEffect(() => {
    if (videoRef.current && capture.stream) {
      videoRef.current.srcObject = capture.stream;
    }
  }, [capture.stream, phase]);

  /*
   * The round has ended — by the clock, by the interviewer, or by the candidate pressing
   * Submit. However it ended, it ends the same way: somebody says so, then the screen
   * changes.
   */
  const closeRound = useCallback(
    (closing: string | null) => {
      capture.release();
      if (closing) {
        setClosingRemark(closing);
        setPhase("closing");
        if (speaksLocally) {
          browserVoice.say(closing, () => setPhase("complete"));
        } else {
          window.setTimeout(() => setPhase("complete"), READING_TIME_MS * 2);
        }
        return;
      }
      setPhase("complete");
    },
    [browserVoice, capture, speaksLocally],
  );

  const finishAnswer = useCallback(async (endRound = false) => {
    if (!accessToken || !turn) return;
    const priorPhase = phase;
    setPhase("submitting");
    setError(null);
    const captured = await capture.stop();
    if (!captured) {
      setPhase(priorPhase);
      return;
    }

    liveTranscript.stop();
    const requestId = answerRequestIds.current.get(turn.turnIndex) ?? crypto.randomUUID();
    answerRequestIds.current.set(turn.turnIndex, requestId);
    reportRoomEvent("answer_submission_started", "submitting", turn.turnIndex, requestId);
    const slowRequestTimer = window.setTimeout(
      () =>
        reportInterviewClientEvent(
          accessToken,
          sessionId,
          "answer_submission_slow",
          turn.turnIndex,
          ANSWER_SUBMISSION_SLOW_MS,
          requestId,
          "submitting",
        ).catch(() => {
          // Reporting a stuck request must not abort or duplicate the idempotent answer.
        }),
      ANSWER_SUBMISSION_SLOW_MS,
    );
    try {
      const result = await submitAnswer(
        accessToken,
        sessionId,
        turn.turnIndex,
        captured.audio,
        requestId,
        speaksLocally,
        endRound,
        captured.timing,
      );
      answerRequestIds.current.delete(turn.turnIndex);
      if (result.sessionComplete || !result.nextTurn) {
        /*
         * A round ends with somebody saying it has.
         *
         * It used to end by the page changing: the candidate gave an answer and the room
         * replaced itself, with no goodbye and no way to tell a finished interview from a
         * crashed one. The remark is spoken first, and only when it has been said does
         * the completion screen appear.
         *
         * With no voice available the text still shows, and `onDone` fires from the
         * speech watchdog, so the screen is never held by a voice that is not coming.
         */
        closeRound(result.closingRemark ?? null);
        return;
      }
      setHint(null);
      setTurn(result.nextTurn);
      setSession((current) =>
        current ? { ...current, turnsCompleted: result.turnsCompleted } : current,
      );
      setPhase("asking");
    } catch (cause) {
      reportRoomEvent("answer_submission_failed", "error", turn.turnIndex, requestId);
      setPhase("error");
      setError(
        cause instanceof ApiRequestError ? cause.message : "That answer could not be submitted.",
      );
    } finally {
      window.clearTimeout(slowRequestTimer);
    }
  }, [accessToken, capture, closeRound, liveTranscript, phase, reportRoomEvent, sessionId, speaksLocally, turn]);

  // The meter and the submit callback are read through refs by the tick below. The
  // meter changes on every animation frame, and rebuilding the interval each time would
  // throw away the silence it has accumulated and mean an answer never ended itself.
  const latest = useRef({ level: capture.level, finish: finishAnswer });
  useEffect(() => {
    latest.current = { level: capture.level, finish: finishAnswer };
  });

  // The answer timer and silence detector run off one tick. Workspace rounds wait longer
  // and also wait for editor or board activity to settle before taking the floor.
  useEffect(() => {
    if (phase !== "answering") return;
    const startedAt = Date.now();
    let silence = initialSilenceState;
    let ended = false;

    const TICK_MS = 200;
    const id = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - startedAt) / 1000));

      silence = observe(silence, latest.current.level, now);
      const over = hasWorkspace
        ? shouldEndWorkspace(silence, now, startedAt, lastWorkspaceChange.current) ||
          now - startedAt >= LONGEST_WORKSPACE_TAKE_MS
        : shouldEnd(silence, now, startedAt);
      if (!ended && over) {
        ended = true;
        void latest.current.finish();
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [phase, hasWorkspace]);

  const beginAnswering = useCallback(async () => {
    const started = await capture.start();
    if (started) {
      setElapsed(0);
      lastWorkspaceChange.current = null;
      // Workspace rounds use the microphone meter for feedback and do not display a
      // running transcript. In spoken-only rounds, clear the previous answer first.
      if (!hasWorkspace) {
        liveTranscript.reset();
        liveTranscript.start();
      }
      setPhase("answering");
    }
  }, [capture, hasWorkspace, liveTranscript]);

  /*
   * The floor passes to the candidate on its own.
   *
   * A real interviewer stops talking and you answer; there is no moment where you press
   * something first. So the microphone opens when the question finishes being spoken —
   * or, when there is no voice to wait for, after a beat long enough to read it.
   *
   * `beginAnswering` is read through a ref rather than depended on: it changes identity
   * whenever the capture hook re-renders, and re-running this effect would re-open the
   * microphone mid-answer.
   */
  const handOver = useRef(beginAnswering);
  useEffect(() => {
    handOver.current = beginAnswering;
  });

  /*
   * Read the question out locally, once per turn, and hand the floor over when the voice
   * actually stops — which the browser tells us, rather than being inferred from a
   * recording's duration or a reading-speed guess.
   */
  useEffect(() => {
    if (phase !== "asking" || !speaksLocally || !questionText) return;
    // Already reading it, or already read it. Neither is a reason to start again.
    if (browserVoice.saying === questionText || browserVoice.said === questionText) return;
    const startedAt = Date.now();
    browserVoice.say(questionText, (reason) => {
      if (turnIndex !== null && reason !== "finished") {
        reportSpeechEvent(
          reason === "timed_out" ? "browser_speech_timed_out" : "browser_speech_failed",
          turnIndex,
          Date.now() - startedAt,
        );
      }
      void handOver.current();
    });
  }, [browserVoice, phase, questionText, reportSpeechEvent, speaksLocally, turnIndex]);

  useEffect(() => {
    if (phase !== "asking" || speaksLocally) return;

    const element = audioRef.current;
    // A question with a voice hands over when the voice stops.
    if (questionAudio.status === "ready" && element) {
      const startedAt = Date.now();
      let finished = false;
      let stallTimer: ReturnType<typeof setTimeout> | null = null;

      const clearStall = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = null;
      };
      const finish = (failure?: InterviewClientEvent) => {
        if (finished) return;
        finished = true;
        clearStall();
        clearTimeout(ceilingTimer);
        if (failure && turnIndex !== null) {
          element.pause();
          reportSpeechEvent(failure, turnIndex, Date.now() - startedAt);
        }
        void handOver.current();
      };
      const armStall = () => {
        clearStall();
        stallTimer = setTimeout(() => finish("model_audio_stalled"), MODEL_AUDIO_STALL_MS);
      };
      const onEnded = () => finish();
      const onError = () => finish("model_audio_error");
      const ceilingTimer = setTimeout(
        () => finish("model_audio_timed_out"),
        MODEL_AUDIO_TIMEOUT_MS,
      );

      element.addEventListener("ended", onEnded);
      element.addEventListener("error", onError);
      element.addEventListener("stalled", armStall);
      element.addEventListener("waiting", armStall);
      element.addEventListener("playing", clearStall);
      element.addEventListener("timeupdate", clearStall);
      return () => {
        finished = true;
        clearStall();
        clearTimeout(ceilingTimer);
        element.removeEventListener("ended", onEnded);
        element.removeEventListener("error", onError);
        element.removeEventListener("stalled", armStall);
        element.removeEventListener("waiting", armStall);
        element.removeEventListener("playing", clearStall);
        element.removeEventListener("timeupdate", clearStall);
      };
    }

    // No voice is coming, so the candidate is reading. Give them time to, then listen.
    //
    // A voice still rendering once the grace period is spent counts as not coming. The
    // question has been on screen since then, and the microphone used to stay shut until
    // the poll gave up at 45 seconds — twenty more seconds of a silent room in front of a
    // question the candidate had already read. A voice that lands after this is not
    // played: the play effect only runs while the room is asking.
    if (questionAudio.status === "unavailable" || (questionAudio.status === "pending" && !withinGrace)) {
      const timer = setTimeout(() => void handOver.current(), READING_TIME_MS);
      return () => clearTimeout(timer);
    }

    // Still rendering. This effect re-runs when that resolves or the grace runs out.
    return undefined;
  }, [phase, questionAudio.status, questionAudio.url, reportSpeechEvent, speaksLocally, turnIndex, withinGrace]);

  const askForHint = useCallback(async () => {
    if (!accessToken || !turn || hintPending) return;
    setHintPending(true);
    setError(null);
    const requestId = hintRequestIds.current.get(turn.turnIndex) ?? crypto.randomUUID();
    hintRequestIds.current.set(turn.turnIndex, requestId);
    try {
      setHint(await requestHint(accessToken, sessionId, turn.turnIndex, requestId));
      hintRequestIds.current.delete(turn.turnIndex);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "The interviewer could not be reached for that.",
      );
    } finally {
      setHintPending(false);
    }
  }, [accessToken, hintPending, sessionId, turn]);

  // Autoplay with sound is refused until the document has been interacted with. Entering
  // the room is that interaction, which is most of why the antechamber exists — but a
  // refusal is still surfaced rather than swallowed, because silence with no explanation
  // is how the interviewer stayed mute for a whole release.
  useEffect(() => {
    if (phase !== "asking") return;
    const element = audioRef.current;
    if (!element || !questionAudio.url) return;
    setAudioBlocked(false);
    const startedAt = Date.now();
    element.play().catch(() => {
      setAudioBlocked(true);
      if (turnIndex !== null) {
        reportSpeechEvent("model_audio_play_rejected", turnIndex, Date.now() - startedAt);
      }
    });
  }, [phase, questionAudio.url, reportSpeechEvent, turnIndex]);

  /*
   * The question is revealed in step with the voice reading it, so `timeupdate` drives
   * the text. It fires about four times a second, which is enough for a reveal that is
   * meant to feel like speech rather than a typewriter.
   *
   * `ended` matters as much as the ticks: a browser that stops firing `timeupdate`
   * slightly before the end would otherwise leave the last word or two permanently
   * withheld.
   */
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const at = (currentTime: number, duration: number) =>
      setProgress({ turnIndex: turnIndex ?? -1, currentTime, duration });
    const sync = () => at(element.currentTime, element.duration);
    // `ended` matters as much as the ticks: a browser that stops firing `timeupdate`
    // just short of the end would otherwise withhold the last word for good.
    const finish = () => at(element.duration || 1, element.duration || 1);

    element.addEventListener("timeupdate", sync);
    element.addEventListener("loadedmetadata", sync);
    element.addEventListener("ended", finish);
    return () => {
      element.removeEventListener("timeupdate", sync);
      element.removeEventListener("loadedmetadata", sync);
      element.removeEventListener("ended", finish);
    };
  }, [questionAudio.url, turnIndex]);

  const replayQuestion = useCallback(() => {
    const element = audioRef.current;
    if (!element) return;
    element.currentTime = 0;
    setAudioBlocked(false);
    const startedAt = Date.now();
    element.play().catch(() => {
      setAudioBlocked(true);
      if (turnIndex !== null) {
        reportSpeechEvent("model_audio_play_rejected", turnIndex, Date.now() - startedAt);
      }
    });
  }, [reportSpeechEvent, turnIndex]);

  /*
   * The board, saved as they work.
   *
   * Excalidraw fires on every pointer move; a five-second timer bounds the writes while
   * drawing. Transient failures retry after a later change or blur. A size rejection is
   * shown because the candidate must reduce the board before it can be saved.
   */
  const boardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBoard = useRef<BoardState | null>(null);
  const boardDirty = useRef(false);
  const [boardSaveError, setBoardSaveError] = useState<string | null>(null);

  const flushBoard = useCallback(() => {
    if (boardTimer.current) clearTimeout(boardTimer.current);
    boardTimer.current = null;
    const board = latestBoard.current;
    if (!accessToken || !board || !boardDirty.current) return;
    if (new TextEncoder().encode(JSON.stringify(board)).length > MAX_BOARD_BYTES) {
      setBoardSaveError("Your board is over 5 MB and cannot be saved. Remove some content before leaving.");
      return;
    }
    setBoardSaveError(null);
    boardDirty.current = false;
    void saveBoard(accessToken, sessionId, board).catch((error: unknown) => {
      boardDirty.current = true;
      if (error instanceof ApiRequestError && error.status === 413) {
        boardDirty.current = false;
        setBoardSaveError("Your board is over 5 MB and cannot be saved. Remove some content before leaving.");
      }
    });
  }, [accessToken, sessionId]);

  useEffect(() => {
    window.addEventListener("blur", flushBoard);
    return () => {
      window.removeEventListener("blur", flushBoard);
      if (boardTimer.current) clearTimeout(boardTimer.current);
    };
  }, [flushBoard]);

  const onBoardChange = useCallback(
    (next: BoardState) => {
      latestBoard.current = next;
      boardDirty.current = true;
      lastWorkspaceChange.current = Date.now();
      if (!accessToken || boardTimer.current) return;
      boardTimer.current = setTimeout(flushBoard, BOARD_SAVE_MS);
    },
    [accessToken, flushBoard],
  );

  // Java runs on the server, against this round, so the run endpoint can check the round is theirs.
  const runJava = useCallback(
    (source: string, stdin: string): Promise<CodeRunResult> =>
      accessToken
        ? runCode(accessToken, sessionId, { source, language: "java", stdin })
        : Promise.resolve({
            stdout: "",
            stderr: "",
            exitCode: -1,
            timedOut: false,
            available: false,
            message: "Your sign-in has lapsed. Reload the page to run code; your work is saved.",
          }),
    [accessToken, sessionId],
  );

  const workspace = session?.workspace ?? null;

  /*
   * Minutes into the round, for the design rail. Advisory only — it paces the candidate,
   * it does not gate anything.
   *
   * Ticked from an effect rather than read during render: the clock is not a pure
   * function of props, and the React compiler is right to say so. Starting at zero is
   * correct rather than a compromise — a round that has just begun is in Requirements.
   */
  const [minutesElapsed, setMinutesElapsed] = useState(0);
  const startedAt = session?.startedAt ?? null;
  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const timer = setInterval(
      () => setMinutesElapsed(Math.max(0, Math.floor((Date.now() - start) / 60_000))),
      ROUND_CLOCK_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [startedAt]);

  // The microphone level changes on animation frames. Keep the editor/board element
  // stable across those room renders so typing and drawing do not reconcile with the
  // speaking indicator; rebuild it only when its own inputs change.
  const workspaceNode = useMemo(
    () =>
      workspace === null ? null : workspace.kind === "dsa" ? (
        <DsaWorkspace
          problem={workspace.problem}
          board={session?.board ?? null}
          onBoardChange={onBoardChange}
          runJava={runJava}
        />
      ) : (
        <DesignWorkspace
          board={session?.board ?? null}
          onBoardChange={onBoardChange}
        />
      ),
    [workspace, session?.board, onBoardChange, runJava],
  );

  /*
   * Two ways out, and they are not the same thing.
   *
   * Submit completes the round: whatever has been answered is assessed and the report is
   * written, exactly as if the clock had run out. Pressed mid-answer, the answer being
   * given is submitted as the last one rather than thrown away.
   *
   * Leave forfeits it: no report, and it is not counted as practice. That is a real loss,
   * so it is confirmed rather than one stray click away.
   */
  const answeredSoFar = session?.turnsCompleted ?? 0;
  const canSubmit =
    (phase === "answering" || ((phase === "asking" || phase === "error") && answeredSoFar > 0)) && !!accessToken;

  async function submitAndFinish() {
    if (!accessToken) return;
    if (phase === "answering") {
      await finishAnswer(true);
      return;
    }
    setPhase("submitting");
    setError(null);
    browserVoice.cancel();
    try {
      const result = await finishSession(accessToken, sessionId);
      closeRound(result.closingRemark ?? null);
    } catch (cause) {
      setPhase("error");
      setError(cause instanceof ApiRequestError ? cause.message : "The interview could not be submitted.");
    }
  }

  /*
   * The clock ends the round — on the candidate's screen, when it says 0:00.
   *
   * It used to be enforced only when the next answer arrived at the server, so a round
   * whose clock ran out mid-answer simply carried on: one five-minute round ran to 7:17
   * with the clock sat at zero. Now the room ends it itself. The answer in progress is
   * submitted as the last one — it is assessed, not thrown away — and the interviewer
   * says time is up.
   *
   * Level-triggered on purpose: an answer still being assessed at 0:00 can come back
   * with another question, and that question must end the round too rather than open
   * the microphone on a round that is over. One automatic attempt; if it fails, Submit is
   * still there.
   */
  const [timeUp, setTimeUp] = useState(false);
  const endingForTime = useRef(false);
  const endForTime = useRef<() => void>(() => undefined);
  useEffect(() => {
    endForTime.current = () => {
      if (endingForTime.current) return;
      if (phase === "answering") {
        endingForTime.current = true;
        void finishAnswer(true);
      } else if ((phase === "asking" || phase === "error") && answeredSoFar > 0) {
        endingForTime.current = true;
        void submitAndFinish();
      }
    };
  });
  useEffect(() => {
    if (timeUp) endForTime.current();
  }, [timeUp, phase]);

  /*
   * Walking into the room is what starts the clock.
   *
   * It used to start when the session row was written — before the problem had been
   * composed, before the device check, before the candidate had read a word — so a
   * five-minute round opened on 3:50. The server starts it once; a reload mid-round
   * finds it already running and changes nothing.
   */
  async function enterRoom() {
    if (!accessToken || entering) return;
    setEntering(true);
    setError(null);
    try {
      const view = await beginSession(accessToken, sessionId);
      setSession((current) =>
        current
          ? { ...current, startedAt: view.startedAt, scheduledEndAt: view.scheduledEndAt }
          : current,
      );
      setPhase("asking");
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "This interview could not be started. Check your connection and try again.",
      );
    } finally {
      setEntering(false);
    }
  }

  async function leave() {
    const confirmed = window.confirm(
      "Leave this interview?\n\nIt will be counted as forfeited: nothing you have said is assessed " +
        "and there will be no report. To end early and still get your report, use Submit instead.",
    );
    if (!confirmed) return;
    capture.release();
    if (accessToken) {
      await abandonSession(accessToken, sessionId).catch(() => undefined);
    }
    router.push("/dashboard");
  }

  if (phase === "loading") {
    return <Centered role="status">Loading your interview…</Centered>;
  }

  if (phase === "error" && !session) {
    return <Centered role="alert">{error}</Centered>;
  }

  if (phase === "closing") {
    return (
      <Centered>
        <div className="flex max-w-md flex-col items-center gap-6 text-center">
          <InterviewerPresence state={browserVoice.speaking ? "speaking" : "waiting"} level={0} />
          <p className="text-title text-balance text-ink">{closingRemark}</p>
        </div>
      </Centered>
    );
  }

  if (phase === "complete") {
    return <InterviewCompletePanel sessionId={sessionId} />;
  }

  if (phase === "terminal" && session) {
    return <TerminalSession session={session} />;
  }

  if (phase === "checking" && session) {
    return (
      <DeviceCheck
        session={session}
        capture={capture}
        onEnter={() => void enterRoom()}
        entering={entering}
        entryError={error}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line bg-surface-raised/95 px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur-sm sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href="/dashboard"
            aria-label="Untiered dashboard"
            className="grid shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="sm:hidden"><BrandMark /></span>
            <span className="hidden sm:block"><BrandWordmark /></span>
          </a>
          <span aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />
          <div className="min-w-0">
            <p className="truncate text-caption font-semibold text-ink">
              {session?.companyName} · {session?.roleTitle}
            </p>
            <p className="truncate font-mono text-micro tracking-widest text-ink-subtle uppercase">
              {session?.roundLabel}
            </p>
          </div>
        </div>

        <div className="hidden min-w-32 flex-col items-center gap-1 lg:flex" aria-label={`Question ${(turnIndex ?? 0) + 1}`}>
          <span aria-hidden="true" className="h-1 w-24 rounded-full bg-accent" />
          <span className="font-mono text-micro text-ink-subtle">Question {(turnIndex ?? 0) + 1}</span>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-4">
          <RoundClock endsAt={session?.scheduledEndAt ?? null} phase={turn?.phase} onExpired={() => setTimeUp(true)} />
          <button
            type="button"
            onClick={() => void submitAndFinish()}
            disabled={!canSubmit}
            title={
              canSubmit
                ? "End the round now and get your report"
                : "Answer at least one question before submitting"
            }
            className="rounded-lg bg-accent px-3.5 py-2 text-caption font-semibold whitespace-nowrap text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit and finish
          </button>
          <button
            type="button"
            onClick={() => void leave()}
            className="hidden text-caption whitespace-nowrap text-ink-muted underline-offset-4 hover:text-ink hover:underline sm:inline-flex"
          >
            Leave (forfeit)
          </button>
        </div>
      </header>

      <div className={workspace ? "flex min-h-0 flex-1 flex-col lg:flex-row" : "contents"}>
        {workspace ? (
          <div className="order-2 min-h-[34rem] flex-1 border-t border-line lg:min-h-0 lg:w-[66%] lg:border-t-0 lg:border-l">
            {boardSaveError ? <p role="alert" className="border-b border-danger/30 bg-danger/5 px-4 py-2 text-caption text-danger">{boardSaveError}</p> : null}
            {workspaceNode}
          </div>
        ) : null}

      <main
        className={
          workspace
            ? "order-1 flex w-full shrink-0 flex-col gap-5 overflow-y-auto bg-surface px-5 py-6 lg:w-[34%] lg:px-7"
            : "mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-6 py-16 sm:px-10"
        }
      >
        <div className={`flex flex-col ${workspace ? "gap-3" : "gap-5 rounded-surface border border-line bg-surface-raised p-7 shadow-[var(--shadow-md)] sm:p-10"}`}>
          <div className="flex items-center justify-between gap-4">
            <InterviewerPresence state={presenceState} level={capture.level} compact={!!workspace} />
            {phase === "answering" ? (
              <span className="flex items-center gap-2 font-mono text-caption text-ink-subtle">
                <SpeakingDot active level={capture.level} />
                {formatDuration(elapsed)}
              </span>
            ) : null}
          </div>

          {/*
            * In a workspace the prompt is compact and available at once beside its
            * details. Spoken-only rounds still reveal it with the voice. `aria-live`
            * stays absent so a screen reader never announces every partial reveal.
            */}
          <p className={`eyebrow text-accent ${workspace ? "mt-2" : "mt-4"}`}>Current question</p>
          <h1 className={workspace ? "text-heading font-semibold text-ink" : "text-display text-balance text-ink"}>
            {workspace ? (
              questionText
            ) : awaitingVoice ? (
              <span className="text-ink-subtle">Composing the next question…</span>
            ) : (
              <>
                {visibleQuestion}
                {visibleQuestion.length < questionText.length ? (
                  <span aria-hidden className="animate-pulse text-ink-subtle">
                    {" "}
                    ▍
                  </span>
                ) : null}
              </>
            )}
          </h1>
          {/* Spoken-only rounds also expose the complete question to assistive technology. */}
          {!workspace ? <p className="sr-only">{questionText}</p> : null}

          {questionAudio.url ? (
            <div className="flex flex-col gap-2">
              {/* No `controls`: scrubbing an interviewer is not a thing you can do. */}
              <audio ref={audioRef} src={questionAudio.url} className="hidden" />
              <button
                type="button"
                onClick={replayQuestion}
                className="self-start text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                {audioBlocked ? "Play the question" : "Say that again"}
              </button>
              {audioBlocked ? (
                <p className="text-caption text-ink-subtle">
                  Your browser held the audio back — press play, or just read the question and
                  answer.
                </p>
              ) : null}
            </div>
          ) : questionAudio.status === "pending" ? (
            <p className="text-caption text-ink-subtle" role="status">
              The interviewer is working out what to ask next.
            </p>
          ) : null}
        </div>

        {workspace?.kind === "dsa" ? (
          <DsaProblemPanel problem={workspace.problem} />
        ) : workspace?.kind === "system_design" ? (
          <DesignCasePanel
            designCase={workspace.case}
            minutesElapsed={minutesElapsed}
            durationMinutes={session?.durationMinutes ?? 45}
          />
        ) : null}

        {/*
          * In spoken-only rounds, what the candidate is saying, as they say it.
          *
          * Speaking into a machine that shows no sign of hearing you is the least
          * interview-like part of this, and the specific worry it removes is not knowing
          * whether your words are arriving intact. It is explicitly a mirror: the report is
          * built from the model's own transcription of the recording, not from this, and
          * saying so matters because the two will sometimes disagree.
          */}
        {!workspace && phase === "answering" && liveTranscript.supported ? (
          <div className="flex flex-col gap-1.5 border-l-2 border-line pl-4">
            <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
              What we are hearing
            </p>
            <p className="text-body text-ink-muted" aria-live="off">
              {liveTranscript.text || (
                <span className="text-ink-subtle">Listening — start whenever you are ready.</span>
              )}
            </p>
          </div>
        ) : null}

        {hint ? (
          <aside className="rounded-xl border border-accent/25 bg-accent-wash px-5 py-4 shadow-[var(--shadow-sm)]">
            <p className="pb-1.5 font-mono text-micro tracking-widest text-ink-subtle uppercase">
              You asked for help · recorded as &ldquo;{hint.assistanceLabel.toLowerCase()}&rdquo;
            </p>
            <p className="text-body text-ink">{hint.text}</p>
          </aside>
        ) : null}

        {error ? (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        ) : null}

        {/* The microphone opens after the question and closes after speech and, in
            workspace rounds, visible work have settled. Help remains available. */}
        <div className="flex flex-wrap items-center gap-4">
          {phase === "submitting" ? (
            <p role="status" className="text-body text-ink-muted">
              Listening to your answer…
            </p>
          ) : null}

          {!hint && (phase === "asking" || phase === "answering") ? (
            <button
              type="button"
              onClick={askForHint}
              disabled={hintPending}
              className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
            >
              {hintPending ? "Asking…" : "I'm stuck — give me a nudge"}
            </button>
          ) : null}
        </div>

        <p className="text-caption text-ink-subtle">
          {phase === "answering"
            ? hasWorkspace
              ? "Think out loud as you work. The interviewer waits through pauses and comes in after you stop speaking and working."
              : "Just start talking. Stop, and the interviewer moves on — pausing to think is fine."
            : "Asking for a nudge is allowed once per question, and the report records that you did."}
        </p>

        {capture.error ? (
          <p role="alert" className="text-caption text-danger">
            {capture.error}
          </p>
        ) : null}
      </main>
      </div>

      {withVideo ? (
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          aria-label="Your camera preview"
          className="fixed right-6 bottom-6 h-28 w-36 rounded-2xl border border-line bg-surface-sunken object-cover shadow-[var(--shadow-lg)]"
        />
      ) : null}
    </div>
  );
}

function TerminalSession({ session }: { session: SessionView }) {
  if (session.status === "completed") {
    return <InterviewCompletePanel sessionId={session.id} />;
  }

  const content =
    session.status === "abandoned"
      ? {
          eyebrow: "Interview ended",
          title: "This round was forfeited.",
          detail: "Its answers are not assessed, so there is no report for this round.",
        }
      : session.status === "failed"
        ? {
            eyebrow: "Interview stopped",
            title: "This round could not continue.",
            detail: "Nothing more can be submitted to this session. Start a new round when you are ready.",
          }
        : session.status === "created"
          ? {
              eyebrow: "Interview not ready",
              title: "This round is still being prepared.",
              detail: "Return to your dashboard and open it again once the first question is ready.",
            }
          : {
              eyebrow: "Interview unavailable",
              title: "This round cannot be opened.",
              detail: "Return to your dashboard to review its current state.",
            };

  return (
    <Centered>
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {content.eyebrow}
        </p>
        <h1 className="text-title text-ink">{content.title}</h1>
        <p className="text-body text-ink-muted">{content.detail}</p>
        <a
          href="/dashboard"
          className="rounded-xl bg-accent px-5 py-2.5 text-body font-semibold text-accent-contrast shadow-[var(--shadow-sm)] hover:bg-accent-strong"
        >
          Back to dashboard
        </a>
      </div>
    </Centered>
  );
}

function SpeakingDot({ active, level }: { active: boolean; level: number }) {
  return (
    <span
      aria-hidden
      className={`size-2.5 rounded-full transition-colors ${active ? "bg-accent" : "bg-ink-subtle"}`}
      style={active ? { transform: `scale(${1 + level * 0.8})` } : undefined}
    />
  );
}

function Centered({ children, role }: { children: React.ReactNode; role?: "status" | "alert" }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-tint px-6 py-12">
      <div role={role} className="text-body text-ink-muted">
        {children}
      </div>
    </div>
  );
}
