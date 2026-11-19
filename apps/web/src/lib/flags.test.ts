import { afterEach, describe, expect, it, vi } from "vitest";

import { courseEnabled, featureEnabled, questionBankBrowsable } from "@/lib/flags";

describe("product feature flags", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("preserves shipped features by default while the question browser stays private", () => {
    expect(featureEnabled("mockInterviews")).toBe(true);
    expect(featureEnabled("courses")).toBe(true);
    expect(featureEnabled("arena")).toBe(true);
    expect(featureEnabled("reports")).toBe(true);
    expect(questionBankBrowsable()).toBe(false);
  });

  it("disables each product surface only for an explicit false value", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_MOCK_INTERVIEWS", "false");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_COURSES", "false");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_ARENA", "false");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_REPORTS", "false");

    expect(featureEnabled("mockInterviews")).toBe(false);
    expect(featureEnabled("courses")).toBe(false);
    expect(featureEnabled("arena")).toBe(false);
    expect(featureEnabled("reports")).toBe(false);
  });

  it("uses the new questions gate before the legacy alias", () => {
    vi.stubEnv("NEXT_PUBLIC_QUESTION_BANK_BROWSABLE", "true");
    expect(questionBankBrowsable()).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_FEATURE_QUESTIONS", "false");
    expect(questionBankBrowsable()).toBe(false);
  });

  it("gates every current course and denies unregistered additions", () => {
    vi.stubEnv("NEXT_PUBLIC_COURSE_DSA_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_COURSE_SYSTEM_DESIGN_ENABLED", "false");

    expect(courseEnabled("java")).toBe(true);
    expect(courseEnabled("dsa")).toBe(false);
    expect(courseEnabled("ai-agents")).toBe(true);
    expect(courseEnabled("system-design")).toBe(false);
    expect(courseEnabled("new-unreviewed-course")).toBe(false);
  });
});

describe("campus flag", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless explicitly true", async () => {
    const { campusEnabled } = await import("@/lib/flags");
    expect(campusEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    expect(campusEnabled()).toBe(true);
  });
});

describe("campus leads switch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is on unless explicitly turned off, independently of the campus switch", async () => {
    const { campusLeadsEnabled } = await import("@/lib/flags");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "false");
    expect(campusLeadsEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS_LEADS", "false");
    expect(campusLeadsEnabled()).toBe(false);
  });
});

describe("VAD endpointing flag", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless explicitly true", async () => {
    const { vadEndpointingEnabled } = await import("@/lib/flags");
    expect(vadEndpointingEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_VAD_ENDPOINTING", "");
    expect(vadEndpointingEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_VAD_ENDPOINTING", "true");
    expect(vadEndpointingEnabled()).toBe(true);
  });
});
