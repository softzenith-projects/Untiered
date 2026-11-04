import type { BoardState, SessionView } from "@untiered/shared";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewRoom } from "./interview-room";
import { ApiRequestError } from "@/lib/api";

const fetchSession = vi.hoisted(() => vi.fn());
const beginSession = vi.hoisted(() => vi.fn());
const captureStart = vi.hoisted(() => vi.fn());
const captureStop = vi.hoisted(() => vi.fn());
const captureLevel = vi.hoisted(() => ({ current: 0 }));
const dsaWorkspaceRender = vi.hoisted(() => vi.fn());
const dsaBoard = vi.hoisted(() => ({ onChange: null as ((board: BoardState) => void) | null }));
const designBoard = vi.hoisted(() => ({ onChange: null as ((board: BoardState) => void) | null }));
const saveBoard = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const reportInterviewClientEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const submitAnswer = vi.hoisted(() => vi.fn());
const fetchReport = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ token: "token-abc" }));
const questionAudio = vi.hoisted(() => ({ current: { url: null as string | null, status: "unavailable" } }));
const transcript = vi.hoisted(() => ({ supported: false, start: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  fetchSession,
  fetchReport,
  beginSession,
  abandonSession: vi.fn(),
  finishSession: vi.fn(),
  requestHint: vi.fn(),
  reportInterviewClientEvent,
  saveBoard,
  submitAnswer,
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => auth.token }));
vi.mock("@/components/device-check", () => ({
  DeviceCheck: ({
    onEnter,
    entering,
    entryError,
  }: {
    onEnter: () => void;
    entering?: boolean;
    entryError?: string | null;
  }) => (
    <div>
      <p>Device check</p>
      <button type="button" onClick={onEnter} disabled={entering}>
        Enter the room
      </button>
      {entryError ? <p role="alert">{entryError}</p> : null}
    </div>
  ),
}));
vi.mock("@/components/design-workspace", () => ({
  DesignWorkspace: ({ onBoardChange }: { onBoardChange: (board: BoardState) => void }) => {
    designBoard.onChange = onBoardChange;
    return <div data-testid="design-workspace" />;
  },
  DesignCasePanel: () => <section aria-label="System design case">Design case details</section>,
}));
vi.mock("@/components/dsa-problem-panel", () => ({
  DsaProblemPanel: () => <section aria-label="Coding problem">Coding problem details</section>,
}));
vi.mock("@/components/dsa-workspace", () => ({ DsaWorkspace: ({ onBoardChange }: { onBoardChange: (board: BoardState) => void }) => {
  dsaWorkspaceRender();
  dsaBoard.onChange = onBoardChange;
  return <div data-testid="dsa-workspace" />;
} }));
vi.mock("@/components/round-clock", () => ({
  RoundClock: () => null,
  formatDuration: () => "00:00",
}));
vi.mock("@/components/interviewer-presence", () => ({ InterviewerPresence: () => null }));
vi.mock("@/lib/use-interview-capture", () => ({
  useInterviewCapture: () => ({
    state: "ready",
    error: null,
    level: captureLevel.current,
    stream: null,
    requestDevices: vi.fn(),
    start: captureStart,
    stop: captureStop,
    release: vi.fn(),
    isRecording: false,
  }),
}));
vi.mock("@/lib/use-browser-voice", () => ({
  useBrowserVoice: () => ({
    available: false,
    settled: true,
    spokenChars: 0,
    speaking: false,
    saying: null,
    said: null,
    say: vi.fn(),
    cancel: vi.fn(),
  }),
}));
vi.mock("@/lib/use-live-transcript", () => ({
  useLiveTranscript: () => ({ supported: transcript.supported, text: "Recognised answer", start: transcript.start, stop: vi.fn(), reset: vi.fn() }),
}));
vi.mock("@/lib/use-question-audio", () => ({
  useQuestionAudio: () => questionAudio.current,
}));

const baseSession = {
  id: "0f2b8a1c-1d3e-4a5b-8c7d-9e0f1a2b3c4d",
  companyName: "Infosys",
  roleTitle: "Senior Backend Engineer",
  roundLabel: "Project deep-dive",
  language: "english",
  status: "in_progress",
  consentVideo: false,
  startedAt: null,
  scheduledEndAt: null,
  currentTurn: {
    turnIndex: 0,
    questionText: "Tell me about the project.",
    questionAudioStatus: "unavailable",
  },
  workspace: null,
} as unknown as SessionView;

describe("InterviewRoom session entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.token = "token-abc";
    captureLevel.current = 0;
    dsaBoard.onChange = null;
    designBoard.onChange = null;
    questionAudio.current = { url: null, status: "unavailable" };
    transcript.supported = false;
  });

  it.each([
    ["completed", "That’s the end of the round."],
    ["abandoned", "This round was forfeited."],
    ["failed", "This round could not continue."],
    ["created", "This round is still being prepared."],
  ] as const)("keeps a %s session out of device check", async (status, heading) => {
    fetchSession.mockResolvedValue({ ...baseSession, status });

    render(<InterviewRoom sessionId={baseSession.id} />);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByText("Device check")).not.toBeInTheDocument();
    expect(beginSession).not.toHaveBeenCalled();
  });

  it("turns a completed round into a clear report handoff", async () => {
    fetchSession.mockResolvedValue({ ...baseSession, status: "completed" });
    let finishReport!: (report: unknown) => void;
    fetchReport.mockReturnValue(new Promise((resolve) => { finishReport = resolve; }));

    render(<InterviewRoom sessionId={baseSession.id} />);

    expect(await screen.findByRole("heading", { name: /that.s the end of the round/i })).toBeInTheDocument();
    expect(screen.getByText(/competency breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/evidence from your answers/i)).toBeInTheDocument();
    expect(screen.getByText(/analysing your interview/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchReport).toHaveBeenCalledWith(baseSession.id, expect.objectContaining({ accessToken: "token-abc" }));
    });
    // The report is offered only once it exists, so the click opens it rather than a wait.
    expect(screen.queryByRole("link", { name: /read the report/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to dashboard/i })).toHaveAttribute("href", "/dashboard");

    await act(async () => finishReport({ sessionId: baseSession.id }));

    expect(screen.getByText(/your report is ready/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /read the report/i })).toHaveAttribute(
      "href",
      `/report/${baseSession.id}`,
    );
  });

  it("keeps analysing while the report is still being written", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fetchSession.mockResolvedValue({ ...baseSession, status: "completed" });
      fetchReport
        .mockRejectedValueOnce(new ApiRequestError(409, "report_generating", "still writing"))
        .mockResolvedValueOnce({ sessionId: baseSession.id });

      render(<InterviewRoom sessionId={baseSession.id} />);
      expect(await screen.findByText(/analysing your interview/i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /read the report/i })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });

      expect(await screen.findByRole("link", { name: /read the report/i })).toBeInTheDocument();
      expect(fetchReport).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers the report page when the report cannot be prepared on this screen", async () => {
    fetchSession.mockResolvedValue({ ...baseSession, status: "completed" });
    fetchReport.mockRejectedValue(new ApiRequestError(422, "empty_transcript", "This interview has no answers to assess."));

    render(<InterviewRoom sessionId={baseSession.id} />);

    expect(await screen.findByText("This interview has no answers to assess.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the report page/i })).toHaveAttribute("href", `/report/${baseSession.id}`);
  });

  it("shows the server's begin failure and remains in device check", async () => {
    fetchSession.mockResolvedValue(baseSession);
    beginSession.mockRejectedValue(
      new ApiRequestError(409, "session_state_changed", "This interview has already ended."),
    );
    render(<InterviewRoom sessionId={baseSession.id} />);

    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This interview has already ended.");
    expect(screen.getByText("Device check")).toBeInTheDocument();
    expect(beginSession).toHaveBeenCalledTimes(1);
  });

  it("does not announce a writing-mode fallback when question audio is unavailable", async () => {
    fetchSession.mockResolvedValue(baseSession);
    beginSession.mockResolvedValue({
      startedAt: "2026-09-29T09:00:00Z",
      scheduledEndAt: "2026-09-29T09:30:00Z",
    });
    render(<InterviewRoom sessionId={baseSession.id} />);

    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));

    expect(await screen.findByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();
    expect(screen.getByLabelText(/untiered dashboard/i)).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("heading", { name: "Tell me about the project." })).toBeInTheDocument();
    expect(screen.getByLabelText("Question 1")).toBeInTheDocument();
    expect(screen.queryByText(/voice is unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/round is in writing/i)).not.toBeInTheDocument();
  });
});

describe("InterviewRoom workspace isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dsaBoard.onChange = null;
    designBoard.onChange = null;
    auth.token = "token-abc";
    captureLevel.current = 0;
    questionAudio.current = { url: null, status: "unavailable" };
    transcript.supported = false;
  });

  it.each([
    ["dsa", { kind: "dsa", problem: {} }, "Coding problem", "dsa-workspace"],
    ["system design", { kind: "system_design", case: {} }, "System design case", "design-workspace"],
  ])("keeps %s question details beside the interviewer and the answer workspace separate", async (_label, workspace, panelName, workspaceId) => {
    transcript.supported = true;
    fetchSession.mockResolvedValue({ ...baseSession, workspace });
    beginSession.mockResolvedValue({
      startedAt: "2026-09-29T09:00:00Z",
      scheduledEndAt: "2026-09-29T09:45:00Z",
    });
    render(<InterviewRoom sessionId={baseSession.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));

    const questionPane = screen.getByRole("main");
    expect(questionPane).toContainElement(screen.getByRole("region", { name: panelName }));
    expect(questionPane).toContainElement(screen.getByRole("heading", { name: "Tell me about the project." }));
    expect(questionPane).not.toContainElement(await screen.findByTestId(workspaceId));
    expect(screen.queryByText("What we are hearing")).not.toBeInTheDocument();
  });

  it("saves the latest board after five seconds and flushes on window blur", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fetchSession.mockResolvedValue({ ...baseSession, workspace: { kind: "dsa", problem: {} } });
      beginSession.mockResolvedValue({ startedAt: "2026-09-29T09:00:00Z", scheduledEndAt: "2026-09-29T09:45:00Z" });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<InterviewRoom sessionId={baseSession.id} />);
      await user.click(await screen.findByRole("button", { name: "Enter the room" }));
      await screen.findByTestId("dsa-workspace");

      const first: BoardState = { kind: "dsa", sources: { python: "print(1)" } };
      const second: BoardState = { kind: "dsa", sources: { python: "print(2)" } };
      act(() => { dsaBoard.onChange?.(first); dsaBoard.onChange?.(second); });
      await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
      expect(saveBoard).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(saveBoard).toHaveBeenCalledWith("token-abc", baseSession.id, second);
      act(() => window.dispatchEvent(new Event("blur")));
      expect(saveBoard).toHaveBeenCalledTimes(1);

      act(() => { dsaBoard.onChange?.(first); window.dispatchEvent(new Event("blur")); });
      expect(saveBoard).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("warns instead of uploading an oversized board", async () => {
    fetchSession.mockResolvedValue({ ...baseSession, workspace: { kind: "dsa", problem: {} } });
    beginSession.mockResolvedValue({ startedAt: "2026-09-29T09:00:00Z", scheduledEndAt: "2026-09-29T09:45:00Z" });
    render(<InterviewRoom sessionId={baseSession.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));

    act(() => {
      dsaBoard.onChange?.({ kind: "dsa", sources: { python: "x".repeat(5 * 1024 * 1024) } });
      window.dispatchEvent(new Event("blur"));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/over 5 MB/i);
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("shows a server size rejection so the candidate knows the board was not saved", async () => {
    fetchSession.mockResolvedValue({ ...baseSession, workspace: { kind: "dsa", problem: {} } });
    beginSession.mockResolvedValue({ startedAt: "2026-09-29T09:00:00Z", scheduledEndAt: "2026-09-29T09:45:00Z" });
    saveBoard.mockRejectedValueOnce(new ApiRequestError(413, "board_too_large", "Board too large"));
    render(<InterviewRoom sessionId={baseSession.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));

    act(() => {
      dsaBoard.onChange?.({ kind: "dsa", sources: { python: "print(1)" } });
      window.dispatchEvent(new Event("blur"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be saved/i);
  });

  it("does not rerender the code editor when only the microphone level changes", async () => {
    fetchSession.mockResolvedValue({ ...baseSession, workspace: { kind: "dsa", problem: {} } });
    beginSession.mockResolvedValue({
      startedAt: "2026-09-29T09:00:00Z",
      scheduledEndAt: "2026-09-29T09:45:00Z",
    });
    const { rerender } = render(<InterviewRoom sessionId={baseSession.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));
    expect(await screen.findByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();
    const before = dsaWorkspaceRender.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    captureLevel.current = 0.7;
    rerender(<InterviewRoom sessionId={baseSession.id} />);

    expect(dsaWorkspaceRender).toHaveBeenCalledTimes(before);
  });
});

/*
 * The mid-round stall (3 Oct 2026). A long round outlives the hourly access token, and the
 * room used to reload itself into the device check when the new token arrived.
 */
describe("InterviewRoom across an access-token rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.token = "token-abc";
    questionAudio.current = { url: null, status: "unavailable" };
    transcript.supported = false;
  });

  it("stays in the room, without re-reading the session, when the token rotates", async () => {
    fetchSession.mockResolvedValue(baseSession);
    beginSession.mockResolvedValue({
      startedAt: "2026-09-29T09:00:00Z",
      scheduledEndAt: "2026-09-29T09:45:00Z",
    });
    const { rerender } = render(<InterviewRoom sessionId={baseSession.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));
    expect(await screen.findByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();

    auth.token = "token-rotated";
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    // Give a re-read every chance to land before checking it did not.
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("Device check")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();
    expect(fetchSession).toHaveBeenCalledTimes(1);
  });
});

describe("InterviewRoom when the interviewer's recorded voice is slow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.token = "token-abc";
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the microphone once the grace period is spent, not when the poll gives up", async () => {
    questionAudio.current = { url: null, status: "pending" };
    fetchSession.mockResolvedValue({
      ...baseSession,
      currentTurn: { ...baseSession.currentTurn, questionAudioStatus: "pending" },
    });
    beginSession.mockResolvedValue({
      startedAt: "2026-09-29T09:00:00Z",
      scheduledEndAt: "2026-09-29T09:45:00Z",
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InterviewRoom sessionId={baseSession.id} />);
    await user.click(await screen.findByRole("button", { name: "Enter the room" }));
    expect(await screen.findByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();

    // Inside the grace period the room is still waiting for the voice.
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(captureStart).not.toHaveBeenCalled();

    // The grace period (25s) runs out: the question goes up in writing, and the candidate
    // gets the usual time to read it (4s) before the floor passes to them — well before
    // the 45-second poll ceiling the room used to wait for.
    await act(async () => {
      vi.advanceTimersByTime(6_000);
    });
    expect(captureStart).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(captureStart).toHaveBeenCalledTimes(1);
  });
});

describe("InterviewRoom operational telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    auth.token = "token-abc";
    captureLevel.current = 0;
    dsaBoard.onChange = null;
    designBoard.onChange = null;
    questionAudio.current = { url: null, status: "unavailable" };
    captureStart.mockResolvedValue(true);
    captureStop.mockResolvedValue({
      audio: new Blob(["voice"], { type: "audio/webm" }),
      timing: null,
    });
    submitAnswer.mockReturnValue(new Promise(() => undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows processing feedback before the recorder finishes stopping", async () => {
    transcript.supported = true;
    let completeStop!: (answer: { audio: Blob; timing: null }) => void;
    captureStop.mockReturnValueOnce(new Promise((resolve) => { completeStop = resolve; }));
    fetchSession.mockResolvedValue({ ...baseSession, workspace: { kind: "dsa" } });
    beginSession.mockResolvedValue({
      startedAt: new Date().toISOString(),
      scheduledEndAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<InterviewRoom sessionId={baseSession.id} />);

    await user.click(await screen.findByRole("button", { name: "Enter the room" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(screen.queryByText("Recognised answer")).not.toBeInTheDocument();
    expect(transcript.start).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Over to you" })).not.toBeInTheDocument();
    captureLevel.current = 0.4;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    captureLevel.current = 0;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(8_400); });

    expect(screen.getByRole("status")).toHaveTextContent("Listening to your answer…");

    await act(async () => completeStop({ audio: new Blob(["voice"], { type: "audio/webm" }), timing: null }));
  });

  it.each([
    ["coding", { kind: "dsa", problem: {} }, "dsa-workspace"],
    ["system design", { kind: "system_design", case: {} }, "design-workspace"],
  ] as const)("waits for %s work to stop before advancing", async (_label, workspace, workspaceId) => {
    fetchSession.mockResolvedValue({ ...baseSession, workspace });
    beginSession.mockResolvedValue({
      startedAt: new Date().toISOString(),
      scheduledEndAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<InterviewRoom sessionId={baseSession.id} />);

    await user.click(await screen.findByRole("button", { name: "Enter the room" }));
    await screen.findByTestId(workspaceId);
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    captureLevel.current = 0.4;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    captureLevel.current = 0;
    rerender(<InterviewRoom sessionId={baseSession.id} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    act(() => {
      if (workspace.kind === "dsa") {
        dsaBoard.onChange?.({ kind: "dsa", sources: { python: "print(1)" } });
      } else {
        designBoard.onChange?.({ kind: "system_design", elements: [{ id: "box-1" }] });
      }
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(submitAnswer).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(4_200); });
    expect(submitAnswer).toHaveBeenCalledTimes(1);
  });

  it("reports phases, heartbeats, submission start and a still-pending request as slow", async () => {
    fetchSession.mockResolvedValue({ ...baseSession, workspace: { kind: "dsa" } });
    beginSession.mockResolvedValue({
      ...baseSession,
      workspace: { kind: "dsa" },
      startedAt: new Date().toISOString(),
      scheduledEndAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<InterviewRoom sessionId={baseSession.id} />);

    await user.click(await screen.findByRole("button", { name: "Enter the room" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(captureStart).toHaveBeenCalledTimes(1);
    captureLevel.current = 0.4;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(reportInterviewClientEvent).toHaveBeenCalledWith(
      "token-abc",
      baseSession.id,
      "client_phase_changed",
      0,
      undefined,
      undefined,
      "answering",
    );
    expect(reportInterviewClientEvent).toHaveBeenCalledWith(
      "token-abc",
      baseSession.id,
      "client_heartbeat",
      0,
      undefined,
      undefined,
      expect.any(String),
    );
    captureLevel.current = 0;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(8_400); });
    expect(submitAnswer).toHaveBeenCalledTimes(1);
    expect(reportInterviewClientEvent).toHaveBeenCalledWith(
      "token-abc",
      baseSession.id,
      "answer_submission_started",
      0,
      undefined,
      expect.any(String),
      "submitting",
    );

    await act(async () => {
      vi.advanceTimersByTime(190_000);
    });
    expect(reportInterviewClientEvent).toHaveBeenCalledWith(
      "token-abc",
      baseSession.id,
      "answer_submission_slow",
      0,
      190_000,
      expect.any(String),
      "submitting",
    );
  });

  it("asks for the answer again, on the same question, when the server did not hear it", async () => {
    submitAnswer.mockRejectedValueOnce(
      new ApiRequestError(422, "answer_not_heard", "We didn't catch that answer clearly. Please give it again."),
    );
    fetchSession.mockResolvedValue({ ...baseSession, workspace: { kind: "dsa" } });
    beginSession.mockResolvedValue({
      startedAt: new Date().toISOString(),
      scheduledEndAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<InterviewRoom sessionId={baseSession.id} />);

    await user.click(await screen.findByRole("button", { name: "Enter the room" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(captureStart).toHaveBeenCalledTimes(1);
    captureLevel.current = 0.4;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    captureLevel.current = 0;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(8_400); });

    expect(submitAnswer).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent("Please give it again.");
    // The microphone reopens on the same question; the room does not stall on an error.
    expect(captureStart).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    captureLevel.current = 0.4;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    captureLevel.current = 0;
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

    expect(submitAnswer).toHaveBeenCalledTimes(2);
    const [first, second] = submitAnswer.mock.calls as [unknown[], unknown[]];
    expect(second[2]).toBe(first[2]);
    // A new take is a new request, not a replay of the one the server refused.
    expect(second[4]).not.toBe(first[4]);
  });
});
