import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "./session";

const getClaims = vi.hoisted(() => vi.fn());
/** Kept only so a test can assert the proxy never reaches for it. See the last test here. */
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims, getUser } }),
}));

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function signedIn() {
  getClaims.mockResolvedValue({
    data: { claims: { sub: "6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11" } },
    error: null,
  });
}

/** What `getClaims` returns when there is no token at all, or it does not verify. */
function signedOut() {
  getClaims.mockResolvedValue({ data: null, error: null });
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a signed-out visitor from the dashboard to sign in", async () => {
    signedOut();

    const response = await updateSession(requestFor("/dashboard"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("sends a signed-out visitor from a company's questions to sign in", async () => {
    signedOut();

    const response = await updateSession(requestFor("/questions/amazon"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/questions/amazon");
  });

  it.each([
    "/courses/dsa/11-backtracking",
    "/courses/java/variables/extra",
    "/arena",
    "/arena/dsa",
    "/interview/new",
    "/interview/3f2a",
    "/rounds",
    "/profile",
    "/history",
    "/report/3f2a",
  ])("sends a signed-out visitor from %s to sign in, remembering where they were going", async (path) => {
    signedOut();

    const response = await updateSession(requestFor(path));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(path);
  });

  it("keeps the query string, so an invite link survives sign-in", async () => {
    signedOut();

    const response = await updateSession(requestFor("/campus/join?token=abc-_123"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/campus/join?token=abc-_123");
  });

  it.each(["/courses", "/courses/dsa/11-backtracking", "/arena", "/interview/new", "/report/3f2a"])(
    "lets a signed-in candidate through to %s",
    async (path) => {
      signedIn();

      expect((await updateSession(requestFor(path))).headers.get("location")).toBeNull();
    },
  );

  it.each(["/courses", "/courses/java", "/courses/no-such-course"])(
    "lets a signed-out visitor see %s, which the page itself may then 404",
    async (path) => {
      signedOut();

      const response = await updateSession(requestFor(path));

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("keeps refreshing a signed-in learner's session on public course pages", async () => {
    signedIn();

    await updateSession(requestFor("/courses/java"));

    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("does not open a chapter when the path is spelled to look like an overview", async () => {
    signedOut();

    const response = await updateSession(requestFor("/courses/java//variables"));

    expect(response.status).toBe(307);
  });

  it("does not treat a look-alike path as protected", async () => {
    signedOut();

    expect((await updateSession(requestFor("/arenas"))).headers.get("location")).toBeNull();
  });

  it("keeps the login page itself reachable when signed out", async () => {
    signedOut();

    expect((await updateSession(requestFor("/login"))).headers.get("location")).toBeNull();
  });

  it("lets a signed-in candidate through to the dashboard", async () => {
    signedIn();

    const response = await updateSession(requestFor("/dashboard"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("sends a signed-in candidate away from the sign-in page", async () => {
    signedIn();

    const response = await updateSession(requestFor("/login"));

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/dashboard");
  });

  it("sends a signed-in person on to a same-origin next, such as the college portal", async () => {
    signedIn();

    const response = await updateSession(requestFor("/login?next=%2Fcampus%3Forg%3Do1"));

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe("http://localhost:3000");
    expect(location.pathname).toBe("/campus");
    expect(location.searchParams.get("org")).toBe("o1");
  });

  it.each(["https://example.com/campus", "//example.com", "/login?next=/login"])(
    "never follows an unsafe or looping next (%s) from the sign-in page",
    async (next) => {
      signedIn();

      const response = await updateSession(requestFor(`/login?next=${encodeURIComponent(next)}`));

      const location = new URL(response.headers.get("location") ?? "");
      expect(location.origin).toBe("http://localhost:3000");
      expect(location.pathname).toBe("/dashboard");
      expect(location.search).toBe("");
    },
  );

  it("verifies the token locally instead of asking the auth server who this is", async () => {
    signedIn();

    await updateSession(requestFor("/dashboard"));

    expect(getClaims).toHaveBeenCalledTimes(1);
    // The proxy runs on protected navigations and their RSC prefetches, so an auth
    // round trip here would delay both.
    expect(getUser).not.toHaveBeenCalled();
  });

  it("treats a token that does not verify as signed out", async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: "invalid claim: signature" } });

    const response = await updateSession(requestFor("/dashboard"));

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("leaves the public landing page reachable either way", async () => {
    signedOut();
    expect((await updateSession(requestFor("/"))).headers.get("location")).toBeNull();

    signedIn();
    expect((await updateSession(requestFor("/"))).headers.get("location")).toBeNull();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it.each(["/privacy", "/terms", "/contact"])("opens %s without an auth round trip", async (path) => {
    expect((await updateSession(requestFor(path))).headers.get("location")).toBeNull();
    expect(getClaims).not.toHaveBeenCalled();
  });
});
