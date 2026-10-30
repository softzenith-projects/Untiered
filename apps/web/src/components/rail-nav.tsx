"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { featureEnabled } from "@/lib/flags";
import { NAV_LINKS, PUBLIC_NAV_LINKS } from "@/lib/nav-links";

/**
 * The signed-in product navigation, with the page you are on marked.
 *
 * Three identical grey words with no current-page state is not navigation, it is a list;
 * you cannot tell where you are, and every page therefore looks like the same page. The
 * marker is now a filled pill on the current page — the wider revamp (task 044) put pill
 * shapes to work elsewhere (badges, tags), so a pill here reads as the same visual
 * language rather than as one rounded solid on an otherwise square screen.
 */
export function RailNav({ signedOut = false }: { signedOut?: boolean }) {
  const pathname = usePathname();
  const links = signedOut ? PUBLIC_NAV_LINKS : NAV_LINKS;

  return (
    <ul className="flex min-w-max items-stretch gap-1" aria-label={signedOut ? "Site" : "Workspace"}>
      {links.filter((link) => !("feature" in link) || featureEnabled(link.feature)).map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <li key={link.href}>
            {/*
              * `prefetch` fetches the whole page, not just its loading skeleton. These pages
              * render on demand, and without it a click showed the skeleton while the server
              * worked; with it the page is already in the browser when the link is pressed.
              * The server side of each is static content and a flag check, so the five
              * prefetches are cheap; their data is fetched by the page in the browser.
              */}
            <Link
              href={link.href as Route}
              prefetch
              aria-current={active ? "page" : undefined}
              className={`relative block h-full px-3 py-5 text-caption transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full ${
                active
                  ? "font-bold text-ink after:bg-accent"
                  : "font-semibold text-ink-muted after:bg-transparent hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

