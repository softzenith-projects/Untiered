/**
 * Google Analytics, on public pages only and only after the visitor says yes.
 *
 * Nothing here runs until `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set and the visitor has allowed
 * it, because the privacy policy says so. No user id is ever sent, and page addresses go
 * without their query string, so `/login?next=/report/<id>` is recorded as `/login`.
 */

export type AnalyticsConsent = "granted" | "denied" | "unset";

const CONSENT_KEY = "untiered:analytics-consent";

/** The address of the tag, once the id is known to be safe to put in one. */
export function analyticsId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id && /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

/**
 * An allowlist, so a new signed-in page is untracked until somebody decides otherwise. The
 * interview room, reports and chapters are deliberately absent: what a candidate does there
 * is personal, and the room stays near-empty, so it gets no banner either.
 */
const PUBLIC_PAGES = new Set(["/", "/about", "/contact", "/pricing", "/privacy", "/terms", "/refund-policy", "/login", "/courses"]);

export function isTrackedPath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || /^\/courses\/[^/]+$/.test(pathname);
}

let memoryConsent: AnalyticsConsent = "unset";
const listeners = new Set<() => void>();

export function readConsent(): AnalyticsConsent {
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored === "granted" || stored === "denied") return stored;
  } catch {
    /* Storage is optional; the choice then lasts as long as the page does. */
  }
  return memoryConsent;
}

export function subscribeToConsent(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function chooseConsent(choice: "granted" | "denied"): void {
  memoryConsent = choice;
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* Storage is optional. */
  }
  if (choice === "denied") clearAnalyticsCookies();
  listeners.forEach((listener) => listener());
}

/** Google's `_ga` cookies sit on the registrable domain, so try each parent of this host. */
function clearAnalyticsCookies(): void {
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]!.trim())
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
  const labels = window.location.hostname.split(".");
  const domains = labels.map((_, index) => labels.slice(index).join("."));
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
  }
}

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

function gtag(): (...args: unknown[]) => void {
  const target = window as GtagWindow;
  if (!target.gtag) {
    target.dataLayer = target.dataLayer ?? [];
    const layer = target.dataLayer;
    // gtag.js reads the `arguments` object itself and ignores a plain array.
    target.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      layer.push(arguments);
    };
  }
  return target.gtag;
}

const configured = new Set<string>();

/**
 * Google's own off switch. Enhanced measurement (scrolls, outbound clicks) fires by itself
 * once the tag has loaded, so leaving a public page has to silence it, not just stop calling it.
 */
export function setAnalyticsActive(id: string, active: boolean): void {
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = !active;
  if (!active || configured.has(id)) return;
  configured.add(id);
  const send = gtag();
  send("js", new Date());
  send("config", id, {
    // Page views are sent by hand below, so that the query string can be left off.
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

export function sendPageView(pathname: string): void {
  gtag()("event", "page_view", {
    page_location: `${window.location.origin}${pathname}`,
    page_path: pathname,
  });
}
