import type { SessionView } from "@untiered/shared";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewRoom } from "./interview-room";

// Campus module 5 in the room: an assigned round sends integrity counts, a personal round
// sends nothing, and either way the room looks exactly the same.

const fetchSession = vi.hoisted(() => vi.fn());
const beginSession = vi.hoisted(() => vi.fn());
const sendIntegrityEvents = vi.hoisted(() => vi.fn());

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
  fetchReport: vi.fn(),
  beginSession,
  abandonSession: vi.fn(),
  finishSession: vi.fn(),
  requestHint: vi.fn(),
  reportInterviewClientEvent: vi.fn().mockResolvedValue(undefined),
  saveBoard: vi.fn().mockResolvedValue(undefined),
  submitAnswer: vi.fn(),
  sendIntegrityEvents,
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token-abc" }));
vi.mock("@/components/device-check", () => ({
  DeviceCheck: ({ onEnter }: { onEnter: () => void }) => (
    <button type="button" onClick={onEnter}>
      Enter the room
    </button>
  ),
}));
vi.mock("@/components/round-clock", () => ({ RoundClock: () => null, formatDuration: () => "00:00" }));
vi.mock("@/components/interviewer-presence", () => ({ InterviewerPresence: () => null }));
vi.mock("@/lib/use-interview-capture", () => ({
  useInterviewCapture: () => ({
    state: "ready",
    error: null,
    level: 0,
    stream: null,
    requestDevices: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
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
  useLiveTranscript: () => ({ supported: false, text: "", start: vi.fn(), stop: vi.fn(), reset: vi.fn() }),
}));
vi.mock("@/lib/use-question-audio", () => ({ useQuestionAudio: () => ({ url: null, status: "unavailable" }) }));

const baseSession = {
  id: "0f2b8a1c-1d3e-4a5b-8c7d-9e0f1a2b3c4d",
  companyName: "Infosys",
  roleTitle: "Systems Engineer",
  roundLabel: "Technical interview",
  language: "english",
  status: "in_progress",
  consentVideo: false,
  startedAt: null,
  scheduledEndAt: null,
  currentTurn: { turnIndex: 0, questionText: "What is an index?", questionAudioStatus: "unavailable" },
  workspace: null,
} as unknown as SessionView;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

async function enterRoom(session: SessionView) {
  fetchSession.mockResolvedValue(session);
  beginSession.mockResolvedValue({ startedAt: "2026-11-13T10:00:00Z", scheduledEndAt: "2026-11-13T10:30:00Z" });
  const view = render(<InterviewRoom sessionId={session.id} />);
  await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));
  await screen.findByRole("heading", { name: "What is an index?" });
  return view;
}

async function switchTabsAndLeave() {
  await act(async () => {
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendIntegrityEvents.mockResolvedValue(undefined);
  setVisibility("visible");
});
afterEach(() => setVisibility("visible"));

describe("InterviewRoom integrity signals", () => {
  it("sends counts for an assigned round, with the bearer token, on the way out", async () => {
    await enterRoom({ ...baseSession, assigned: true });
    await switchTabsAndLeave();

    await waitFor(() => expect(sendIntegrityEvents).toHaveBeenCalled());
    const [token, sessionId, batch, options] = sendIntegrityEvents.mock.calls[0]!;
    expect([token, sessionId, options]).toEqual(["token-abc", baseSession.id, { keepalive: true }]);
    expect(batch.events).toEqual([expect.objectContaining({ type: "tab_hidden", turnIndex: 0 })]);
  });

  it("never sends anything for a personal round", async () => {
    const first = await enterRoom({ ...baseSession, assigned: false });
    await switchTabsAndLeave();
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    first.unmount();
    expect(sendIntegrityEvents).not.toHaveBeenCalled();
    setVisibility("visible");

    // An older API that sends no flag is a personal round too.
    const { unmount } = await enterRoom(baseSession);
    await switchTabsAndLeave();
    unmount();
    expect(sendIntegrityEvents).not.toHaveBeenCalled();
  });

  it("does not count anything during the device check, before the round begins", async () => {
    fetchSession.mockResolvedValue({ ...baseSession, assigned: true });
    render(<InterviewRoom sessionId={baseSession.id} />);
    await screen.findByRole("button", { name: "Enter the room" });
    await switchTabsAndLeave();
    expect(sendIntegrityEvents).not.toHaveBeenCalled();
  });

  it("renders exactly the same room for an assigned round as for a personal one", async () => {
    const personal = await enterRoom({ ...baseSession, assigned: false });
    const personalMarkup = personal.container.innerHTML;
    personal.unmount();

    const assigned = await enterRoom({ ...baseSession, assigned: true });
    expect(assigned.container.innerHTML).toBe(personalMarkup);
    expect(screen.queryByText(/integrity|tab|paste/i)).not.toBeInTheDocument();
  });
});
