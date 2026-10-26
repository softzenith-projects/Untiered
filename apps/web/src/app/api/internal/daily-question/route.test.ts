import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/internal/daily-question/route";
import { dailyQuestionsByDate } from "@/lib/arena/daily-question";

afterEach(() => vi.unstubAllEnvs());

describe("daily question email content", () => {
  it("requires the private server token", async () => {
    vi.stubEnv("EMAIL_CONTENT_TOKEN", "private-token");
    const response = await GET(new Request("http://localhost/api/internal/daily-question?date=2026-10-23"));
    expect(response.status).toBe(401);
  });

  it("returns the exact in-app question without its answer", async () => {
    vi.stubEnv("EMAIL_CONTENT_TOKEN", "private-token");
    const [date, expected] = Object.entries(dailyQuestionsByDate())[0]!;
    const response = await GET(new Request(`http://localhost/api/internal/daily-question?date=${date}`, {
      headers: { Authorization: "Bearer private-token" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      prompt: expected.prompt,
      options: expected.options,
      context: expected.context ?? null,
    });
  });
});
