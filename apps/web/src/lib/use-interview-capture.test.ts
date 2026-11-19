import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInterviewCapture } from "@/lib/use-interview-capture";

describe("useInterviewCapture", () => {
  const track = { stop: vi.fn() };
  const stream = {
    getAudioTracks: vi.fn(() => [track]),
    getTracks: vi.fn(() => [track]),
  };
  let nextFrame: number;

  beforeEach(() => {
    nextFrame = 1;
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => nextFrame++));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "MediaStream",
      class {
        getAudioTracks = stream.getAudioTracks;
        getTracks = stream.getTracks;
      },
    );
    vi.stubGlobal(
      "AudioContext",
      class {
        createAnalyser() {
          return {
            fftSize: 0,
            frequencyBinCount: 4,
            getByteTimeDomainData: vi.fn(),
          };
        }

        createMediaStreamSource() {
          return { connect: vi.fn() };
        }

        close() {
          return Promise.resolve();
        }
      },
    );
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }

        mimeType = "audio/webm";
        state = "recording";
        ondataavailable = null;
        onstop = null;

        start() {}
        stop() {}
      },
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces the device-check meter instead of running two loops while recording", async () => {
    const { result, unmount } = renderHook(() => useInterviewCapture({ withVideo: false }));

    await act(async () => {
      await result.current.requestDevices();
    });
    await act(async () => {
      await result.current.start();
    });

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("hands over everything recorded so far without stopping the recorder, then stops as before", async () => {
    const recorders: FakeRecorder[] = [];
    class FakeRecorder extends EventTarget {
      static isTypeSupported() {
        return true;
      }

      mimeType = "audio/webm";
      state: RecordingState = "inactive";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      private part = 0;

      constructor() {
        super();
        recorders.push(this);
      }

      start() {
        this.state = "recording";
      }

      requestData() {
        this.emit();
      }

      stop() {
        this.emit();
        this.state = "inactive";
        this.onstop?.();
      }

      private emit() {
        this.part += 1;
        const data = new Blob([`part-${this.part}`]);
        this.ondataavailable?.({ data });
        const event = new Event("dataavailable");
        Object.assign(event, { data });
        this.dispatchEvent(event);
      }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    const { result, unmount } = renderHook(() => useInterviewCapture({ withVideo: false }));

    await act(async () => {
      await result.current.start();
    });
    let first: Awaited<ReturnType<typeof result.current.snapshot>> = null;
    await act(async () => {
      first = await result.current.snapshot();
    });

    expect(recorders).toHaveLength(1);
    expect(recorders[0]?.state).toBe("recording");
    expect(await first!.audio.text()).toBe("part-1");
    expect(result.current.isRecording).toBe(true);

    let second: Awaited<ReturnType<typeof result.current.snapshot>> = null;
    await act(async () => {
      second = await result.current.snapshot();
    });
    // Every chunk from the start of the take, so the continued answer is heard as one.
    expect(await second!.audio.text()).toBe("part-1part-2");

    let final: Awaited<ReturnType<typeof result.current.stop>> = null;
    await act(async () => {
      final = await result.current.stop();
    });
    expect(await final!.audio.text()).toBe("part-1part-2part-3");
    expect(recorders[0]?.state).toBe("inactive");
    unmount();
  });
});
