import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("next/script", () => ({ default: ({ src }: { src: string }) => <script data-testid="ga-tag" data-src={src} /> }));

const ID = "G-TEST123";
const CONSENT_KEY = "untiered:analytics-consent";

type Sent = [string, ...unknown[]];

function sent(): Sent[] {
  const layer = (window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? [];
  return layer.map((entry) => Array.from(entry) as Sent);
}

function pageViews() {
  return sent().filter(([command, name]) => command === "event" && name === "page_view").map(([, , params]) => params);
}

function disabled(): unknown {
  return (window as unknown as Record<string, unknown>)[`ga-disable-${ID}`];
}

// analytics.ts remembers the choice and the configured id for the life of the page, so each
// test loads a fresh copy, as a fresh page load would.
async function load() {
  const { SiteAnalytics, AnalyticsChoice } = await import("./site-analytics");
  return { SiteAnalytics, AnalyticsChoice };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", ID);
  route.pathname = "/";
  window.localStorage.clear();
  const target = window as unknown as Record<string, unknown>;
  delete target.dataLayer;
  delete target.gtag;
  delete target[`ga-disable-${ID}`];
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("SiteAnalytics", () => {
  it("does nothing at all without a measurement id", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    const { SiteAnalytics } = await load();
    render(<SiteAnalytics />);

    expect(screen.queryByRole("region", { name: "Analytics choice" })).toBeNull();
    expect(screen.queryByTestId("ga-tag")).toBeNull();
    expect(sent()).toEqual([]);
  });

  it("ignores a malformed measurement id rather than building a script address from it", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-1\"><script>");
    const { SiteAnalytics } = await load();
    render(<SiteAnalytics />);

    expect(screen.queryByRole("region", { name: "Analytics choice" })).toBeNull();
    expect(screen.queryByTestId("ga-tag")).toBeNull();
  });

  it("asks first, and loads and sends nothing until the visitor answers", async () => {
    const { SiteAnalytics } = await load();
    render(<SiteAnalytics />);

    expect(screen.getByRole("region", { name: "Analytics choice" })).toBeTruthy();
    expect(screen.queryByTestId("ga-tag")).toBeNull();
    expect(sent()).toEqual([]);
    expect(disabled()).toBe(true);
  });

  it("loads the tag and counts the page once the visitor allows it", async () => {
    const { SiteAnalytics } = await load();
    render(<SiteAnalytics />);

    await userEvent.click(screen.getByRole("button", { name: "Allow" }));

    expect(window.localStorage.getItem(CONSENT_KEY)).toBe("granted");
    expect(screen.queryByRole("region", { name: "Analytics choice" })).toBeNull();
    expect(screen.getByTestId("ga-tag").getAttribute("data-src")).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
    expect(disabled()).toBe(false);
    expect(pageViews()).toEqual([{ page_location: `${window.location.origin}/`, page_path: "/" }]);
    expect(sent().find(([command]) => command === "config")).toEqual([
      "config",
      ID,
      { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false },
    ]);
  });

  it("stays out of the way after the visitor declines", async () => {
    const { SiteAnalytics } = await load();
    render(<SiteAnalytics />);

    await userEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(window.localStorage.getItem(CONSENT_KEY)).toBe("denied");
    expect(screen.queryByRole("region", { name: "Analytics choice" })).toBeNull();
    expect(screen.queryByTestId("ga-tag")).toBeNull();
    expect(sent()).toEqual([]);
  });

  it("does not ask again once answered", async () => {
    window.localStorage.setItem(CONSENT_KEY, "denied");
    const { SiteAnalytics } = await load();
    render(<SiteAnalytics />);

    expect(screen.queryByRole("region", { name: "Analytics choice" })).toBeNull();
  });

  it.each(["/interview/abc-123", "/report/abc-123", "/dashboard", "/courses/java/variables"])(
    "shows no banner on %s and loads nothing there, even with consent",
    async (path) => {
      route.pathname = path;
      const { SiteAnalytics } = await load();
      const { unmount } = render(<SiteAnalytics />);
      expect(screen.queryByRole("region", { name: "Analytics choice" })).toBeNull();
      unmount();

      window.localStorage.setItem(CONSENT_KEY, "granted");
      render(<SiteAnalytics />);
      expect(screen.queryByTestId("ga-tag")).toBeNull();
      expect(sent()).toEqual([]);
      expect(disabled()).toBe(true);
    },
  );

  it("counts each public page in a visit and silences the tag on a private one", async () => {
    window.localStorage.setItem(CONSENT_KEY, "granted");
    const { SiteAnalytics } = await load();
    const { rerender } = render(<SiteAnalytics />);

    route.pathname = "/courses/java";
    rerender(<SiteAnalytics />);
    expect(disabled()).toBe(false);

    route.pathname = "/report/abc-123";
    rerender(<SiteAnalytics />);
    expect(disabled()).toBe(true);

    route.pathname = "/pricing";
    rerender(<SiteAnalytics />);
    expect(disabled()).toBe(false);

    expect(pageViews().map((view) => (view as { page_path: string }).page_path)).toEqual(["/", "/courses/java", "/pricing"]);
    expect(sent().filter(([command]) => command === "config")).toHaveLength(1);
  });
});

describe("AnalyticsChoice", () => {
  it("lets a visitor withdraw, which stops the tag and removes its cookies", async () => {
    window.localStorage.setItem(CONSENT_KEY, "granted");
    document.cookie = "_ga=GA1.1.1; path=/";
    document.cookie = "_ga_TEST123=GS1.1.1; path=/";
    document.cookie = "keep=me; path=/";
    const { SiteAnalytics, AnalyticsChoice } = await load();
    render(<><SiteAnalytics /><AnalyticsChoice /></>);

    await userEvent.click(screen.getByRole("button", { name: "Turn it off" }));

    expect(window.localStorage.getItem(CONSENT_KEY)).toBe("denied");
    expect(disabled()).toBe(true);
    expect(document.cookie).not.toContain("_ga");
    expect(document.cookie).toContain("keep=me");
    expect(screen.getByRole("button", { name: "Allow it" })).toBeTruthy();
    document.cookie = "keep=; Max-Age=0; path=/";
  });

  it("offers nothing when analytics is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    const { AnalyticsChoice } = await load();
    const { container } = render(<AnalyticsChoice />);

    await act(async () => {});
    expect(container.textContent).toBe("");
  });
});
