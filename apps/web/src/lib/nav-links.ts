import type { ProductFeature } from "@/lib/flags";

/**
 * The primary destinations, shared by the left rail (`RailNav`) and the top bar the
 * course and Arena pages use (`SiteNavLinks`) so the two cannot drift apart. Typed routes
 * are on, so these are literals rather than a widened string[].
 */
export const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "Courses", feature: "courses" },
  { href: "/interview/new", label: "Mock interviews", feature: "mockInterviews" },
  { href: "/arena", label: "Arena", feature: "arena" },
  { href: "/questions", label: "Questions", feature: "questions" },
] as const satisfies readonly { href: string; label: string; feature?: ProductFeature }[];

/** What the same bar offers with no session: only places a visitor can actually go. */
export const PUBLIC_NAV_LINKS = [
  { href: "/courses", label: "Courses", feature: "courses" },
  { href: "/pricing", label: "Pricing" },
] as const satisfies readonly { href: string; label: string; feature?: ProductFeature }[];
