import type { IntegrityEvent } from "@untiered/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INTEGRITY_BATCH_SIZE,
  INTEGRITY_FLUSH_MS,
  createIntegrityRecorder,
  pasteSurface,
  useIntegritySignals,
} from "./use-integrity-signals";

const sendIntegrityEvents = vi.hoisted(() => vi.fn());
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
  sendIntegrityEvents,
}));

const { ApiRequestError } = await import("@/lib/api");

const tab = (): IntegrityEvent => ({ type: "tab_hidden", at: "2026-11-13T10:00:00Z" });

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  sendIntegrityEvents.mockResolvedValue(undefined);
  setVisibility("visible");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createIntegrityRecorder", () => {
  it("gathers events and sends them together, at most 50 a request", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const recorder = createIntegrityRecorder(send);
    for (let i = 0; i < 120; i += 1) recorder.record(tab());
    expect(send).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTEGRITY_FLUSH_MS);
    });

    expect(send.mock.calls.map(([events]) => events.length)).toEqual([INTEGRITY_BATCH_SIZE, INTEGRITY_BATCH_SIZE, 20]);
    expect(send.mock.calls.every(([, keepalive]) => keepalive === false)).toBe(true);
  });

  it("keeps the events when a send fails and retries later, backing off", async () => {
    const send = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(undefined);
    const recorder = createIntegrityRecorder(send, 1_000);
    recorder.record(tab());

    await vi.advanceTimersByTimeAsync(1_000);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls.every(([events]) => events.length === 1)).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("drops a batch the API refused rather than sending it forever", async () => {
    const send = vi.fn().mockRejectedValue(new ApiRequestError(400, "invalid_integrity_events", "no"));
    const recorder = createIntegrityRecorder(send, 1_000);
    recorder.record(tab());
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("flushes at once with keepalive, and sends nothing after stopping", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const recorder = createIntegrityRecorder(send);
    recorder.record(tab());
    await recorder.flush(true);
    expect(send).toHaveBeenCalledWith([tab()], true);

    recorder.stop();
    recorder.record(tab());
    await vi.advanceTimersByTimeAsync(INTEGRITY_FLUSH_MS * 4);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("pasteSurface", () => {
  it("tells the code editor from a text field, and ignores anything else", () => {
    const editor = document.createElement("div");
    editor.className = "cm-editor";
    const line = document.createElement("div");
    editor.appendChild(line);
    expect(pasteSurface(line)).toBe("code");
    expect(pasteSurface(document.createElement("textarea"))).toBe("text");
    expect(pasteSurface(document.createElement("input"))).toBe("text");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(pasteSurface(checkbox)).toBeNull();
    expect(pasteSurface(document.createElement("p"))).toBeNull();
    expect(pasteSurface(null)).toBeNull();
  });
});

describe("useIntegritySignals", () => {
  function paste(target: Element, text: string) {
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    Object.defineProperty(event, "clipboardData", { value: { getData: () => text } });
    target.dispatchEvent(event);
  }

  it("counts nothing and sends nothing while disabled", async () => {
    renderHook(() => useIntegritySignals({ sessionId: "s1", accessToken: "token", enabled: false, turnIndex: 0 }));
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(INTEGRITY_FLUSH_MS * 2);
    expect(sendIntegrityEvents).not.toHaveBeenCalled();
  });

  it("counts a tab switch once, a focus change, and a paste's length but never its text", async () => {
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    renderHook(() => useIntegritySignals({ sessionId: "s1", accessToken: "token", enabled: true, turnIndex: 2 }));

    // Switching tabs fires both; it is one tab switch.
    window.dispatchEvent(new Event("blur"));
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(300);
    setVisibility("visible");
    // Another application took focus while the tab stayed visible.
    window.dispatchEvent(new Event("blur"));
    await vi.advanceTimersByTimeAsync(300);
    paste(field, "SELECT * FROM students;");

    await vi.advanceTimersByTimeAsync(INTEGRITY_FLUSH_MS);
    expect(sendIntegrityEvents).toHaveBeenCalledTimes(1);
    const [token, sessionId, batch, options] = sendIntegrityEvents.mock.calls[0]!;
    expect([token, sessionId, options]).toEqual(["token", "s1", { keepalive: false }]);
    expect(batch.events.map((event: IntegrityEvent) => event.type)).toEqual(["tab_hidden", "window_blur", "paste"]);
    expect(batch.events[2]).toMatchObject({ surface: "text", chars: 23, turnIndex: 2 });
    expect(JSON.stringify(batch)).not.toContain("SELECT");
    field.remove();
  });

  it("flushes with keepalive when the page is hidden for good", async () => {
    renderHook(() => useIntegritySignals({ sessionId: "s1", accessToken: "token", enabled: true, turnIndex: null }));
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0);
    expect(sendIntegrityEvents).toHaveBeenCalledWith("token", "s1", { events: [expect.objectContaining({ type: "tab_hidden" })] }, { keepalive: true });
  });

  it("sends what is left when the round stops being under way, then stops listening", async () => {
    const { rerender } = renderHook(
      ({ enabled }) => useIntegritySignals({ sessionId: "s1", accessToken: "token", enabled, turnIndex: 0 }),
      { initialProps: { enabled: true } },
    );
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    rerender({ enabled: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(sendIntegrityEvents).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(INTEGRITY_FLUSH_MS * 2);
    expect(sendIntegrityEvents).toHaveBeenCalledTimes(1);
  });
});
