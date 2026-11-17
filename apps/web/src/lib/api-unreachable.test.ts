import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiUnreachableError, fetchMe, submitCollegeLead, updateProfile } from "@/lib/api";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const fetchMock = vi.fn();
const capture = vi.mocked(Sentry.captureException);

// Reports are throttled to one a minute per tab, in module state that outlives a test;
// each test starts an hour after the last so they cannot throttle one another.
let clock = Date.UTC(2026, 10, 17);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("requests that get no answer from the API", () => {
  beforeEach(() => {
    clock += 3_600_000;
    vi.useFakeTimers({ now: clock });
    fetchMock.mockReset();
    capture.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports a read once every repeat has failed, and still throws the original error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = fetchMe({ accessToken: "token" }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();

    const error = await result;
    expect(error).toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(capture).toHaveBeenCalledTimes(1);
    const [reported, context] = capture.mock.calls[0]!;
    expect(reported).toBeInstanceOf(ApiUnreachableError);
    expect((reported as ApiUnreachableError).path).toBe("/api/v1/me");
    expect(context).toMatchObject({ fingerprint: ["api-unreachable"], tags: { api_path: "/api/v1/me", api_reachable: "no" } });
  });

  it("does not report a read that recovered on a repeat", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(json(200, { id: "me" }));

    const result = fetchMe({ accessToken: "token" });
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ id: "me" });
    expect(capture).not.toHaveBeenCalled();
  });

  it("reports a write that got no answer", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(updateProfile("token", {} as never)).rejects.toThrow("Failed to fetch");
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("reports the public college form too", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(submitCollegeLead({} as never)).rejects.toThrow("Failed to fetch");
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![1]).toMatchObject({ tags: { api_path: "/api/v1/campus/leads" } });
  });

  it("sends one report a minute however many requests fail, then another after the minute", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(updateProfile("token", {} as never)).rejects.toThrow();
    await expect(updateProfile("token", {} as never)).rejects.toThrow();
    await expect(submitCollegeLead({} as never)).rejects.toThrow();
    expect(capture).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);
    await expect(updateProfile("token", {} as never)).rejects.toThrow();
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("does not report while the browser knows it is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(updateProfile("token", {} as never)).rejects.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });

  it("does not report a request the page cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    await expect(fetchMe({ accessToken: "token", signal: controller.signal })).rejects.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });

  it("does not report an answer the API gave, even an unwelcome one", async () => {
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized", message: "Sign in." }));

    await expect(updateProfile("token", {} as never)).rejects.toMatchObject({ status: 401 });
    expect(capture).not.toHaveBeenCalled();
  });
});
