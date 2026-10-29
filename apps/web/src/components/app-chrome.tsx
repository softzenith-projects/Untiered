"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountSummary } from "@/components/account-summary";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { CreditBalance } from "@/components/credit-balance";
import { RailNav } from "@/components/rail-nav";
import { SiteFooter } from "@/components/site-footer";

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
 */
export function AppHeader({ width = "layout-content" }: { width?: "layout-content" | "layout-reader" }) {
  return (
    <header className="z-sticky sticky top-0 border-b border-line bg-surface-raised/95 shadow-[var(--shadow-sm)] backdrop-blur-xl">
      <div className={`${width} page-gutter mx-auto flex flex-wrap items-center gap-x-5 sm:flex-nowrap`}>
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center py-3.5 focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          aria-label="Untiered dashboard"
        >
          <span className="sm:hidden"><BrandMark /></span>
          <span className="hidden sm:block"><BrandWordmark /></span>
        </Link>

        <nav aria-label="Main" className="nav-scroll order-3 w-full min-w-0 overflow-x-auto border-t border-line sm:order-none sm:w-auto sm:flex-1 sm:border-t-0">
          <RailNav />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          <CreditBalance />
          <AccountSummary />
        </div>
      </div>
    </header>
  );
}
