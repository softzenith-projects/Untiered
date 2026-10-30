"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountSummary } from "@/components/account-summary";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { CreditBalance } from "@/components/credit-balance";
import { RailNav } from "@/components/rail-nav";
import { SiteFooter } from "@/components/site-footer";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * Pages that sit in the signed-in frame. Everything else — the landing page, sign-in,
 * legal pages, the chapter reader with its own bar, and the interview room, which is
 * near-empty by design — renders bare.
 */
const SHELL_PREFIXES = [
  "/dashboard",
  "/courses",
  "/arena",
  "/questions",
  "/history",
  "/profile",
  "/report",
  "/rounds",
  "/upgrade",
  "/daily-challenge",
  "/interview/new",
];

export function isShellPath(pathname: string): boolean {
  const inShell = SHELL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  // `/courses/<course>/<chapter>` is the reader, which brings its own header.
  const isChapter = /^\/courses\/[^/]+\/[^/]+/.test(pathname);
  return inShell && !isChapter;
}

/**
 * The frame every signed-in page sits in, mounted once in the root layout.
 *
 * It used to be rendered by each page (and again by each `loading.tsx`), so every click on
 * the top navigation unmounted the bar and built a new one — twice, once for the skeleton
 * and once for the page — and the account block, the nav and the backdrop all repainted.
 * Held here, above the route, the bar survives navigation and only the page body changes.
 * `AppShell` is now just that body.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!isShellPath(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-surface">
      <AppHeader />

      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,var(--surface-tint)_0,transparent_24rem)]">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}

/**
 * The signed-in top bar. The app frame uses it at content width; the chapter reader, which
 * renders outside the frame for its three-column layout, uses it at reader width, so moving
 * between a course page and a chapter keeps the same nav and account menu.
 *
 * Course overviews are public, so it also has to work with no session: the logo goes home
 * rather than through sign-in, the nav lists what a visitor can reach, and sign-in brings
 * them back to this page. While the session is still unknown it shows the signed-in nav, so
 * that is never what flashes at someone who is signed in.
 */
export function AppHeader({ width = "layout-content" }: { width?: "layout-content" | "layout-reader" }) {
  const token = useAccessToken();
  const pathname = usePathname();
  const signedOut = token === null;

  return (
    <header className="z-sticky sticky top-0 border-b border-line bg-surface-raised/95 shadow-[var(--shadow-sm)] backdrop-blur-xl">
      <div className={`${width} page-gutter mx-auto flex flex-wrap items-center gap-x-5 sm:flex-nowrap`}>
        <Link
          href={token ? "/dashboard" : "/"}
          className="flex shrink-0 items-center py-3.5 focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          aria-label={token ? "Untiered dashboard" : "Untiered home"}
        >
          <span className="sm:hidden"><BrandMark /></span>
          <span className="hidden sm:block"><BrandWordmark /></span>
        </Link>

        <nav aria-label="Main" className="nav-scroll order-3 w-full min-w-0 overflow-x-auto border-t border-line sm:order-none sm:w-auto sm:flex-1 sm:border-t-0">
          <RailNav signedOut={signedOut} />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          {signedOut ? (
            <Link href={`/login?next=${encodeURIComponent(pathname)}` as Route} className="inline-flex min-h-11 items-center rounded-lg px-3 text-caption font-semibold text-accent transition-colors hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Sign in
            </Link>
          ) : (
            <>
              <CreditBalance />
              <AccountSummary />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
