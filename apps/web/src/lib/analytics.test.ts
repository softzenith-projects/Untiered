import { describe, expect, it } from "vitest";

import { isTrackedPath } from "./analytics";

describe("isTrackedPath", () => {
  it.each(["/", "/about", "/contact", "/pricing", "/privacy", "/terms", "/refund-policy", "/login", "/courses", "/courses/java"])(
    "tracks the public page %s",
    (path) => expect(isTrackedPath(path)).toBe(true),
  );

  it.each([
    "/interview/new",
    "/interview/abc-123",
    "/report/abc-123",
    "/dashboard",
    "/history",
    "/profile",
    "/rounds",
    "/arena",
    "/upgrade",
    "/daily-challenge",
    "/unsubscribe",
    "/auth/update-password",
    "/courses/java/variables",
    "/some-new-page",
  ])("leaves %s alone", (path) => expect(isTrackedPath(path)).toBe(false));
});
