import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("auth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges an email confirmation code and returns to the chosen page", async () => {
    const response = await GET(request("/auth/callback?code=confirmation-code&next=/courses"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("confirmation-code");
    expect(response.headers.get("location")).toBe("http://localhost:3000/courses");
  });

  it("takes a recovery link to the new-password form", async () => {
    const response = await GET(request("/auth/callback?code=recovery-code&next=/auth/update-password"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/auth/update-password");
  });

  it("sends failed recovery links to sign in with an error", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    const response = await GET(request("/auth/callback?code=expired&next=/auth/update-password"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=link_expired");
  });

  it("reports a used or superseded confirmation link as an expired link, not a failed sign-in", async () => {
    const response = await GET(request("/auth/callback?next=/dashboard&error=access_denied&error_code=otp_expired"));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=link_expired");
  });

  it("keeps provider failures as sign-in errors", async () => {
    const response = await GET(request("/auth/callback?next=/dashboard&error=access_denied"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=oauth");
  });

  it("does not redirect outside the application", async () => {
    const response = await GET(request("/auth/callback?code=valid&next=https://example.com"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });
});
