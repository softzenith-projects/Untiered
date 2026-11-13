import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound }));

describe("campus pages while the flag is off", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockClear();
  });

  it.each([
    ["/campus", () => import("./page")],
    ["/campus/structure", () => import("./structure/page")],
    ["/campus/staff", () => import("./staff/page")],
    ["/campus/students", () => import("./students/page")],
    ["/campus/students/import", () => import("./students/import/page")],
    ["/campus/join", () => import("./join/page")],
    ["/campus/settings", () => import("./settings/page")],
    ["/admin/campus", () => import("../admin/campus/page")],
  ])("%s is a 404", async (_route, load) => {
    const page = (await load()).default as () => unknown;
    expect(() => page()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("the admin detail page is a 404 too", async () => {
    const page = (await import("../admin/campus/[orgId]/page")).default;
    await expect(page({ params: Promise.resolve({ orgId: "o1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders once the flag is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    const page = (await import("./settings/page")).default;
    expect(() => page()).not.toThrow();
  });
});
